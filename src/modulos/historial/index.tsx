import { createElement, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  BadgePercent,
  CreditCard,
  Gauge,
  Headset,
  History,
  MessagesSquare,
  Plus,
  RefreshCw,
  Ticket,
  UserRoundCog,
  type LucideIcon,
} from 'lucide-react';
import { useCuentas } from '@/shared/cuentas';
import { useZoho } from '@/shared/zoho/contexto';
import { Boton, Cargando, cn, EncabezadoModulo, EstadoVacio, MensajeError, useAvisos } from '@/ui';
import { RegistrarModal } from './componentes/RegistrarModal';
import {
  claveHistorial,
  PESTANAS,
  TablaHistorial,
  usePestanaHistorial,
  type IdPestana,
  type Pestana,
} from '@/shared/historial';
import { formularioInicial, type TipoRegistro } from './lib/registros';
import { registrar } from './servicio';

const ICONOS: Record<IdPestana, LucideIcon> = {
  atencion: Headset,
  tickets: Ticket,
  pagos: CreditCard,
  promociones: BadgePercent,
  cuentas: UserRoundCog,
  comunicaciones: MessagesSquare,
  consumo: Gauge,
};

function ContenidoPestana({ pestana }: { pestana: Pestana }) {
  const consulta = usePestanaHistorial(pestana.id);

  if (consulta.isPending) return <Cargando mensaje={`Consultando ${pestana.etiqueta.toLowerCase()}...`} />;
  if (consulta.isError) {
    return (
      <MensajeError
        mensaje={`No se lograron cargar los datos. ${consulta.error.message}`}
        onReintentar={() => void consulta.refetch()}
      />
    );
  }
  if (consulta.data.filas.length === 0) {
    return (
      <EstadoVacio mensaje={consulta.data.mensaje ?? 'No se encontraron registros para esta sección.'} />
    );
  }
  return <TablaHistorial key={consulta.dataUpdatedAt} pestana={pestana} filas={consulta.data.filas} />;
}

/**
 * Historial del cliente (reemplaza a widgetHistorialV1.1): atenciones, tickets de Desk, pagos, promociones,
 * gestiones registradas (Eventos), comunicaciones y consumo. Cada pestaña se consulta al abrirla por primera vez.
 */
export default function Historial() {
  const { registro, documento, usuario } = useZoho();
  const { avisar } = useAvisos();
  const clienteConsultas = useQueryClient();
  const cuentas = useCuentas();
  const [activa, setActiva] = useState<IdPestana>('atencion');
  const [registrando, setRegistrando] = useState<TipoRegistro | null>(null);

  const pestana = PESTANAS.find((p) => p.id === activa) ?? PESTANAS[0];
  const clave = claveHistorial(activa, registro.id);
  const actualizando = clienteConsultas.isFetching({ queryKey: clave }) > 0;
  const cliente = String(registro.Account_Name ?? registro.Nombres ?? 'Cliente');

  const actualizar = () => void clienteConsultas.refetchQueries({ queryKey: clave });

  const registrarYActualizar = async (tipo: TipoRegistro, formulario: Parameters<typeof registrar>[1]) => {
    await registrar(tipo, formulario, { registro, documento });
    setRegistrando(null);
    avisar({ tipo: 'exito', titulo: 'El registro se ha creado exitosamente.' });
    void clienteConsultas.refetchQueries({ queryKey: claveHistorial(tipo, registro.id) });
  };

  if (!pestana) return null;

  return (
    <main className="mx-auto max-w-7xl p-3 sm:p-4">
      <EncabezadoModulo
        titulo="Historial"
        icono={History}
        descripcion={[cliente, documento].filter(Boolean).join(' · ')}
        acciones={
          <>
            {pestana.registrar && (
              <Boton
                tamano="sm"
                icono={Plus}
                onClick={() => setRegistrando(pestana.id as TipoRegistro)}
                disabled={cuentas.isPending}
                title={cuentas.isPending ? 'Cargando las cuentas del cliente...' : undefined}
              >
                {pestana.registrar}
              </Boton>
            )}
            <Boton
              tamano="sm"
              variante="secundario"
              icono={RefreshCw}
              iconoGira
              cargando={actualizando}
              onClick={actualizar}
              aria-label="Actualizar"
            >
              <span className="max-sm:sr-only">Actualizar</span>
            </Boton>
          </>
        }
      />

      <div
        role="tablist"
        aria-label="Secciones del historial"
        className="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200"
      >
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            id={`tab-${p.id}`}
            aria-selected={p.id === activa}
            aria-controls={`panel-${p.id}`}
            onClick={() => setActiva(p.id)}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
              p.id === activa
                ? 'border-accion text-netuno-800'
                : 'border-transparent text-gray-500 hover:text-gray-800',
            )}
          >
            {createElement(ICONOS[p.id], { 'aria-hidden': true, className: 'h-4 w-4' })}
            {p.etiqueta}
          </button>
        ))}
      </div>

      <section id={`panel-${pestana.id}`} role="tabpanel" aria-labelledby={`tab-${pestana.id}`}>
        <ContenidoPestana key={pestana.id} pestana={pestana} />
      </section>

      {registrando && (
        <RegistrarModal
          tipo={registrando}
          inicial={formularioInicial(registrando, { negocio: registro.Negocio, usuario: usuario.nombre })}
          cuentas={(cuentas.data ?? []).map((c) => String(c.cuenta))}
          onRegistrar={(f) => registrarYActualizar(registrando, f)}
          onCerrar={() => setRegistrando(null)}
        />
      )}
    </main>
  );
}
