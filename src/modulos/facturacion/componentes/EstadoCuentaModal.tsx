import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Eye, FilePlus2, FilterX, Mail, ReceiptText } from 'lucide-react';
import { entorno } from '@/core/config';
import { mensajeDeError } from '@/core/http/errores';
import { estadoSaldo, estaConectado, type Cuenta } from '@/shared/cuentas';
import { dividirEnBloques } from '@/shared/lib/paginacion';
import { useZoho } from '@/shared/zoho/contexto';
import {
  Alerta,
  Boton,
  Cargando,
  Chip,
  CLASE_CONTROL,
  cn,
  EstadoVacio,
  MensajeError,
  Modal,
  Paginador,
  PuntoEstado,
} from '@/ui';
import {
  esFactura,
  filtrarMovimientos,
  formatoMonto,
  nombreArchivo,
  opcionesMovimientos,
  simboloMoneda,
  SIN_FILTROS_MOVIMIENTOS,
  tipoVisor,
  tituloDocumento,
  totalesMovimientos,
  urlDescarga,
  type FiltrosMovimientos,
  type Movimiento,
  type ResultadoEnlace,
} from '../lib/facturacion';
import { consultarMovimientos, descargarArchivo, enlaceEstadoCuenta, enlaceMovimiento } from '../servicio';
import { EnviarCorreo, VisorDocumento } from './Documento';

const POR_PAGINA = 10;

type Vista =
  | { tipo: 'lista' }
  | { tipo: 'documento'; movimiento: Movimiento }
  | { tipo: 'correo'; movimiento?: Movimiento; enlace: string };

/** Abre o descarga el documento según su enlace (Unidigital se abre en otra pestaña). */
function descargar(url: string, nombre: string) {
  if (tipoVisor(url) === 'externo') window.open(url, '_blank', 'noopener');
  else descargarArchivo(urlDescarga(entorno.catalyst.descargaAdjuntos, url, nombre));
}

/** Gestiones de la entrega 2 (tickets en Zoho Desk): visibles pero deshabilitadas por ahora. */
function BotonPronto({ texto }: { texto: string }) {
  return (
    <Boton
      tamano="sm"
      variante="secundario"
      icono={FilePlus2}
      disabled
      title="Disponible en la próxima entrega"
    >
      {texto} <Chip className="ml-1">Pronto</Chip>
    </Boton>
  );
}

// ── Lista de movimientos ────────────────────────────────────────────

function ListaMovimientos({
  cuenta,
  movimientos,
  onAbrir,
  onEnviarEstado,
}: {
  cuenta: Cuenta;
  movimientos: Movimiento[];
  onAbrir: (m: Movimiento) => void;
  onEnviarEstado: (enlace: string) => void;
}) {
  const { idRegistro } = useZoho();
  const clienteConsultas = useQueryClient();
  const [filtros, setFiltros] = useState<FiltrosMovimientos>(SIN_FILTROS_MOVIMIENTOS);
  const [pagina, setPagina] = useState(0);
  const [preparando, setPreparando] = useState<'descargar' | 'enviar' | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const visibles = useMemo(() => filtrarMovimientos(movimientos, filtros), [movimientos, filtros]);
  const opciones = useMemo(() => opcionesMovimientos(movimientos, filtros), [movimientos, filtros]);
  const totales = totalesMovimientos(visibles);
  const saldo = estadoSaldo(cuenta);
  const paginas = dividirEnBloques(visibles, POR_PAGINA);
  const actual = Math.min(pagina, Math.max(paginas.length - 1, 0));
  const moneda = simboloMoneda(cuenta);
  const conFiltros = Object.values(filtros).some(Boolean);

  const cambiar = (campo: keyof FiltrosMovimientos, valor: string) => {
    setFiltros((f) => ({ ...f, [campo]: valor }));
    setPagina(0);
  };

  /** Enlace del estado de cuenta (queda en caché para descargar y enviar). */
  const conEnlace = async (accion: 'descargar' | 'enviar') => {
    setAviso(null);
    setPreparando(accion);
    try {
      const r: ResultadoEnlace = await clienteConsultas.fetchQuery({
        queryKey: ['facturacion', 'enlace-estado', cuenta.cuenta],
        queryFn: () => enlaceEstadoCuenta(cuenta, idRegistro),
        staleTime: 5 * 60_000,
      });
      if ('error' in r) setAviso(r.error);
      else if (accion === 'descargar') descargar(r.url, `Estado de cuenta - ${String(cuenta.cuenta)}`);
      else onEnviarEstado(r.url);
    } catch (error) {
      setAviso(`No se logró obtener el estado de cuenta: ${mensajeDeError(error)}`);
    } finally {
      setPreparando(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Boton
          tamano="sm"
          icono={Download}
          cargando={preparando === 'descargar'}
          disabled={preparando !== null}
          onClick={() => void conEnlace('descargar')}
        >
          Descargar estado de cuenta
        </Boton>
        <Boton
          tamano="sm"
          variante="secundario"
          icono={Mail}
          cargando={preparando === 'enviar'}
          disabled={preparando !== null}
          onClick={() => void conEnlace('enviar')}
        >
          Enviar estado de cuenta
        </Boton>
        <BotonPronto texto="Cargo variable" />
        <BotonPronto texto="Factura manual" />
      </div>
      {aviso && <Alerta tono="aviso">{aviso}</Alerta>}

      <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filtros">
        {(
          [
            ['desde', 'Desde'],
            ['hasta', 'Hasta'],
          ] as const
        ).map(([campo, etiqueta]) => (
          <label key={campo} className="flex flex-col gap-1 text-xs font-bold text-gray-600">
            {etiqueta}
            <input
              type="date"
              value={filtros[campo]}
              min={opciones.fechaMinima || undefined}
              max={opciones.fechaMaxima || undefined}
              onChange={(e) => cambiar(campo, e.target.value)}
              className={cn(CLASE_CONTROL, 'py-1.5')}
            />
          </label>
        ))}
        {(
          [
            ['documento', 'Documento', opciones.documentos],
            ['estatus', 'Estatus', opciones.estatus],
          ] as const
        ).map(([campo, etiqueta, lista]) => (
          <label key={campo} className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-bold text-gray-600">
            {etiqueta}
            <select
              value={filtros[campo]}
              onChange={(e) => cambiar(campo, e.target.value)}
              className={cn(CLASE_CONTROL, 'py-1.5')}
            >
              <option value="">Todos</option>
              {lista.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        ))}
        {conFiltros && (
          <button
            type="button"
            onClick={() => {
              setFiltros(SIN_FILTROS_MOVIMIENTOS);
              setPagina(0);
            }}
            className="inline-flex items-center gap-1 pb-2 text-xs font-bold text-accion hover:underline"
          >
            <FilterX aria-hidden="true" className="h-3.5 w-3.5" /> Limpiar filtros
          </button>
        )}
      </div>

      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(
          [
            ['Abonos', totales.abonos, 'text-emerald-700', true],
            ['Cargos', totales.cargos, 'text-red-700', true],
            // Saldo de la cuenta como en la tarjeta: "Saldo a favor", "Pendiente" o "Al día"
            [saldo.etiqueta, Math.abs(Number(cuenta.saldo ?? 0)), 'text-netuno-800', false],
          ] as const
        ).map(([etiqueta, valor, color, filtrable]) => (
          <div key={etiqueta} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <dt className="text-[11px] font-bold tracking-wide text-gray-500 uppercase">
              {etiqueta}
              {filtrable && conFiltros && ' (filtrados)'}
            </dt>
            <dd className={cn('text-base font-bold tabular-nums', color)}>
              {moneda} {formatoMonto(valor) || '0,00'}
            </dd>
          </div>
        ))}
      </dl>

      {visibles.length === 0 ? (
        <EstadoVacio
          mensaje={
            movimientos.length ? 'No hay movimientos con estos filtros.' : 'La cuenta no tiene movimientos.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead className="bg-ts-cabecera text-xs text-white">
              <tr>
                {['Fecha', 'Documento', 'Estatus', 'Descripción', 'Ticket'].map((c) => (
                  <th key={c} scope="col" className="px-3 py-2.5 font-bold">
                    {c}
                  </th>
                ))}
                {['Abono', 'Cargo', 'Saldo'].map((c) => (
                  <th key={c} scope="col" className="px-3 py-2.5 text-right font-bold">
                    {c} ({moneda})
                  </th>
                ))}
                <th scope="col" className="w-10 px-2">
                  <span className="sr-only">Ver</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(paginas[actual] ?? []).map((m) => (
                <tr
                  key={String(m.id)}
                  onClick={() => onAbrir(m)}
                  className="cursor-pointer border-t border-gray-100 transition-colors hover:bg-netuno-500/5"
                >
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{m.fecha ?? '-'}</td>
                  <td className="px-3 py-2">{m.descTipoDocumento ?? '-'}</td>
                  <td className="px-3 py-2">{m.statusDocumento ?? '-'}</td>
                  <td className="max-w-64 truncate px-3 py-2" title={m.descripcion ?? ''}>
                    {m.descripcion ?? '-'}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{m.numTicket ?? '-'}</td>
                  <td className="px-3 py-2 text-right text-emerald-700 tabular-nums">
                    {formatoMonto(m.abono)}
                  </td>
                  <td className="px-3 py-2 text-right text-red-700 tabular-nums">{formatoMonto(m.cargo)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatoMonto(m.saldo)}</td>
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAbrir(m);
                      }}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-accion"
                      aria-label={`Ver ${tituloDocumento(m)}`}
                    >
                      <Eye aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>
          {visibles.length} {visibles.length === 1 ? 'movimiento' : 'movimientos'}
          {conFiltros && ` de ${movimientos.length}`}
        </span>
        <Paginador
          totalPaginas={paginas.length}
          pagina={actual}
          onCambiar={setPagina}
          etiqueta="Páginas de movimientos"
        />
      </div>
    </div>
  );
}

// ── Detalle de un documento ─────────────────────────────────────────

function DetalleDocumento({
  cuenta,
  movimiento,
  onEnviar,
}: {
  cuenta: Cuenta;
  movimiento: Movimiento;
  onEnviar: (enlace: string) => void;
}) {
  const { idRegistro } = useZoho();
  const enlace = useQuery({
    queryKey: ['facturacion', 'enlace-movimiento', cuenta.cuenta, movimiento.id],
    queryFn: () => enlaceMovimiento(cuenta, movimiento, idRegistro),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const moneda = simboloMoneda(cuenta);

  const resumen = (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-gray-50 px-3 py-2.5 text-[13px] sm:grid-cols-4">
      {(
        [
          ['Fecha', movimiento.fecha],
          ['Estatus', movimiento.statusDocumento],
          [
            'Cargo',
            movimiento.cargo !== null && movimiento.cargo !== undefined
              ? `${moneda} ${formatoMonto(movimiento.cargo)}`
              : '',
          ],
          [
            'Abono',
            movimiento.abono !== null && movimiento.abono !== undefined
              ? `${moneda} ${formatoMonto(movimiento.abono)}`
              : '',
          ],
          ['Descripción', movimiento.descripcion],
          ['Ticket', movimiento.numTicket],
        ] as const
      )
        .filter(([, v]) => v !== null && v !== undefined && String(v) !== '')
        .map(([etiqueta, valor]) => (
          <div key={etiqueta} className={cn('min-w-0', etiqueta === 'Descripción' && 'col-span-2')}>
            <dt className="text-[11px] font-bold tracking-wide text-gray-500 uppercase">{etiqueta}</dt>
            <dd className="truncate text-gray-800" title={String(valor)}>
              {String(valor)}
            </dd>
          </div>
        ))}
    </dl>
  );

  let visor;
  if (enlace.isPending) visor = <Cargando mensaje="Consultando el documento..." />;
  else if (enlace.isError)
    visor = (
      <MensajeError
        mensaje={`No se logró consultar el documento. ${enlace.error.message}`}
        onReintentar={() => void enlace.refetch()}
      />
    );
  else if ('error' in enlace.data) visor = <Alerta tono="aviso">{enlace.data.error}</Alerta>;
  else visor = <VisorDocumento url={enlace.data.url} titulo={tituloDocumento(movimiento)} />;

  const url = enlace.data && 'url' in enlace.data ? enlace.data.url : null;
  const tipo = movimiento.descTipoDocumento ?? 'documento';
  return (
    <div className="flex flex-col gap-4">
      {resumen}
      <div className="flex flex-wrap items-center gap-2">
        <Boton
          tamano="sm"
          icono={Download}
          disabled={!url}
          onClick={() => url && descargar(url, nombreArchivo(movimiento))}
        >
          Descargar {tipo.toLowerCase()}
        </Boton>
        <Boton
          tamano="sm"
          variante="secundario"
          icono={Mail}
          disabled={!url}
          onClick={() => url && onEnviar(url)}
        >
          Enviar {tipo.toLowerCase()}
        </Boton>
        {esFactura(movimiento) && (
          <>
            <BotonPronto texto="Reelaboración" />
            <BotonPronto texto="Nota de débito" />
            <BotonPronto texto="Nota de crédito" />
          </>
        )}
      </div>
      {visor}
    </div>
  );
}

// ── Modal ───────────────────────────────────────────────────────────

/** Estado de cuenta (movimientos de Netuno), detalle de cada documento y envío por correo. */
export function EstadoCuentaModal({ cuenta, onCerrar }: { cuenta: Cuenta; onCerrar: () => void }) {
  const { idRegistro } = useZoho();
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });
  const movimientos = useQuery({
    queryKey: ['facturacion', 'movimientos', cuenta.cuenta],
    queryFn: () => consultarMovimientos(cuenta, idRegistro),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const conectada = estaConectado(cuenta.descStatusCuenta);
  const subtitulo = (
    <span className="inline-flex items-center gap-1.5">
      <PuntoEstado activo={conectada} />
      Cuenta {String(cuenta.cuenta)} · {cuenta.descStatusCuenta ?? 'Sin estado'}
    </span>
  );

  let titulo = 'Estado de cuenta';
  let contenido;
  let regresar: (() => void) | undefined;
  if (vista.tipo === 'documento') {
    titulo = tituloDocumento(vista.movimiento);
    regresar = () => setVista({ tipo: 'lista' });
    contenido = (
      <DetalleDocumento
        cuenta={cuenta}
        movimiento={vista.movimiento}
        onEnviar={(enlace) => setVista({ tipo: 'correo', movimiento: vista.movimiento, enlace })}
      />
    );
  } else if (vista.tipo === 'correo') {
    const { movimiento } = vista;
    titulo = movimiento ? `Enviar ${tituloDocumento(movimiento)}` : 'Enviar estado de cuenta';
    regresar = () => setVista(movimiento ? { tipo: 'documento', movimiento } : { tipo: 'lista' });
    contenido = (
      <EnviarCorreo
        tipo={movimiento ? 'factura' : 'estadoCuenta'}
        cuenta={cuenta}
        movimiento={movimiento}
        enlace={vista.enlace}
      />
    );
  } else if (movimientos.isPending) {
    contenido = <Cargando mensaje="Consultando los movimientos de la cuenta..." />;
  } else if (movimientos.isError) {
    contenido = (
      <MensajeError
        mensaje={`No se lograron cargar los movimientos. ${movimientos.error.message}`}
        onReintentar={() => void movimientos.refetch()}
      />
    );
  } else {
    contenido = (
      <ListaMovimientos
        cuenta={cuenta}
        movimientos={movimientos.data}
        onAbrir={(movimiento) => setVista({ tipo: 'documento', movimiento })}
        onEnviarEstado={(enlace) => setVista({ tipo: 'correo', enlace })}
      />
    );
  }

  return (
    <Modal
      abierto
      titulo={
        <span className="inline-flex items-center gap-2">
          <ReceiptText aria-hidden="true" className="h-5 w-5 text-accion" />
          {titulo}
        </span>
      }
      etiqueta={titulo}
      subtitulo={subtitulo}
      onCerrar={onCerrar}
      onRegresar={regresar}
      ancho="max-w-6xl"
    >
      {contenido}
    </Modal>
  );
}
