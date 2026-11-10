import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, FolderClock, Mail, Users } from 'lucide-react';
import { estaConectado, type Cuenta } from '@/shared/cuentas';
import { TablaHistorial } from '@/shared/historial';
import { useZoho } from '@/shared/zoho/contexto';
import { Cargando, cn, EstadoVacio, MensajeError, Modal, PuntoEstado } from '@/ui';
import { PESTANAS_HISTORICO } from '../lib/facturacion';
import { consultarContactos, consultarDomiciliacion, consultarHistorico } from '../servicio';

/** Modal de consulta de una cuenta, con el estado de la cuenta como subtítulo. */
function ModalCuenta({
  cuenta,
  titulo,
  icono: Icono,
  ancho = 'max-w-2xl',
  onCerrar,
  children,
}: {
  cuenta: Cuenta;
  titulo: string;
  icono: typeof Users;
  ancho?: string;
  onCerrar: () => void;
  children: ReactNode;
}) {
  return (
    <Modal
      abierto
      titulo={
        <span className="inline-flex items-center gap-2">
          <Icono aria-hidden="true" className="h-5 w-5 text-accion" />
          {titulo}
        </span>
      }
      etiqueta={titulo}
      subtitulo={
        <span className="inline-flex items-center gap-1.5">
          <PuntoEstado activo={estaConectado(cuenta.descStatusCuenta)} />
          Cuenta {String(cuenta.cuenta)} · {cuenta.descStatusCuenta ?? 'Sin estado'}
        </span>
      }
      onCerrar={onCerrar}
      ancho={ancho}
    >
      {children}
    </Modal>
  );
}

/** Pestañas sencillas (role="tablist"). */
function Pestanas<T extends string>({
  opciones,
  activa,
  onCambiar,
  etiqueta,
}: {
  opciones: readonly { id: T; etiqueta: string }[];
  activa: T;
  onCambiar: (id: T) => void;
  etiqueta: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={etiqueta}
      className="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200"
    >
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.id === activa}
          onClick={() => onCambiar(o.id)}
          className={cn(
            '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
            o.id === activa
              ? 'border-accion text-netuno-800'
              : 'border-transparent text-gray-500 hover:text-gray-800',
          )}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}

// ── Datos de contacto ───────────────────────────────────────────────

export function ContactosModal({ cuenta, onCerrar }: { cuenta: Cuenta; onCerrar: () => void }) {
  const { documento, idRegistro } = useZoho();
  const consulta = useQuery({
    queryKey: ['facturacion', 'contactos', documento, cuenta.cuenta],
    queryFn: () => consultarContactos(documento ?? '', cuenta, idRegistro),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const [elegida, setElegida] = useState<string | null>(null);

  let contenido;
  if (consulta.isPending) contenido = <Cargando mensaje="Consultando los contactos de la cuenta..." />;
  else if (consulta.isError)
    contenido = (
      <MensajeError
        mensaje={`No se lograron cargar los contactos. ${consulta.error.message}`}
        onReintentar={() => void consulta.refetch()}
      />
    );
  else if (consulta.data.length === 0)
    contenido = <EstadoVacio mensaje="La cuenta no tiene contactos registrados." />;
  else {
    const areas = consulta.data;
    const activa = areas.find((a) => a.area === elegida) ?? areas[0];
    contenido = (
      <>
        <Pestanas
          etiqueta="Áreas"
          opciones={areas.map((a) => ({ id: a.area, etiqueta: a.area }))}
          activa={activa?.area ?? ''}
          onCambiar={setElegida}
        />
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="tabpanel">
          {activa?.contactos.map((c) => (
            <li
              key={`${c.nombre}-${c.correo}`}
              className="flex flex-col gap-0.5 rounded-xl border border-gray-200 bg-white p-3 shadow-tarjeta"
            >
              <span className="text-sm font-bold text-gray-900">{c.nombre || 'Sin nombre'}</span>
              <span className="text-xs text-texto-suave">{c.cargo || 'Sin cargo'}</span>
              {c.correo ? (
                <a
                  href={`mailto:${c.correo}`}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-bold break-all text-accion hover:underline"
                >
                  <Mail aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  {c.correo}
                </a>
              ) : (
                <span className="mt-1 text-xs text-gray-400">Sin correo</span>
              )}
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <ModalCuenta cuenta={cuenta} titulo="Datos de contacto" icono={Users} onCerrar={onCerrar}>
      {contenido}
    </ModalCuenta>
  );
}

// ── Datos de domiciliación ──────────────────────────────────────────

export function DomiciliacionModal({ cuenta, onCerrar }: { cuenta: Cuenta; onCerrar: () => void }) {
  const { idRegistro } = useZoho();
  const consulta = useQuery({
    queryKey: ['facturacion', 'domiciliacion', cuenta.cuenta],
    queryFn: () => consultarDomiciliacion(cuenta, idRegistro),
    staleTime: 5 * 60_000,
    retry: false,
  });

  let contenido;
  if (consulta.isPending) contenido = <Cargando mensaje="Consultando la domiciliación..." />;
  else if (consulta.isError)
    contenido = (
      <MensajeError
        mensaje={`No se lograron cargar los datos. ${consulta.error.message}`}
        onReintentar={() => void consulta.refetch()}
      />
    );
  else if (!consulta.data.domiciliada) contenido = <EstadoVacio mensaje={consulta.data.mensaje} />;
  else
    contenido = (
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {consulta.data.campos.map((c) => (
          <div key={c.etiqueta} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <dt className="text-[11px] font-bold tracking-wide text-gray-500 uppercase">{c.etiqueta}</dt>
            <dd className="text-sm font-semibold text-gray-800">{c.valor}</dd>
          </div>
        ))}
      </dl>
    );

  return (
    <ModalCuenta cuenta={cuenta} titulo="Datos de domiciliación" icono={CreditCard} onCerrar={onCerrar}>
      {contenido}
    </ModalCuenta>
  );
}

// ── Histórico de documentos ─────────────────────────────────────────

function PestanaHistorico({ cuenta, indice }: { cuenta: Cuenta; indice: number }) {
  const { registro } = useZoho();
  const pestana = PESTANAS_HISTORICO[indice] ?? PESTANAS_HISTORICO[0]!;
  const documentoSinPrefijo = String(registro.cf_documento_de_identidad ?? '');
  const consulta = useQuery({
    queryKey: ['facturacion', 'historico', pestana.id, String(cuenta.descTipoCliente), documentoSinPrefijo],
    queryFn: () => consultarHistorico(pestana, cuenta, documentoSinPrefijo),
    staleTime: 5 * 60_000,
    retry: false,
  });
  if (consulta.isPending) return <Cargando mensaje={`Consultando ${pestana.etiqueta.toLowerCase()}...`} />;
  if (consulta.isError) {
    return (
      <MensajeError
        mensaje={`No se lograron cargar los documentos. ${consulta.error.message}`}
        onReintentar={() => void consulta.refetch()}
      />
    );
  }
  if (consulta.data.length === 0)
    return <EstadoVacio mensaje="No se encontraron registros para esta sección." />;
  return <TablaHistorial key={consulta.dataUpdatedAt} pestana={pestana} filas={consulta.data} />;
}

export function HistoricoModal({ cuenta, onCerrar }: { cuenta: Cuenta; onCerrar: () => void }) {
  const [activa, setActiva] = useState(PESTANAS_HISTORICO[0]!.id);
  const indice = Math.max(
    PESTANAS_HISTORICO.findIndex((p) => p.id === activa),
    0,
  );
  return (
    <ModalCuenta
      cuenta={cuenta}
      titulo="Histórico de documentos"
      icono={FolderClock}
      ancho="max-w-5xl"
      onCerrar={onCerrar}
    >
      <Pestanas
        etiqueta="Tipos de documento"
        opciones={PESTANAS_HISTORICO}
        activa={activa}
        onCambiar={setActiva}
      />
      <div role="tabpanel">
        <PestanaHistorico key={activa} cuenta={cuenta} indice={indice} />
      </div>
      <p className="mt-3 text-[11px] text-texto-suave">
        Solicitudes registradas como tickets en Zoho Desk (
        {String(cuenta.descTipoCliente).toUpperCase() === 'EMPRESA'
          ? 'Administración de Ventas'
          : 'Cobranzas'}
        ) para el documento del cliente.
      </p>
    </ModalCuenta>
  );
}
