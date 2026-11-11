import type { ReactNode } from 'react';
import {
  CheckCircle2,
  Circle,
  FileSignature,
  FileText,
  FlaskConical,
  History,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
  Server,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { Alerta, Boton, cn, Pasos } from '@/ui';
import {
  ETAPAS_SOLICITUD,
  ETIQUETA_ESTADO,
  indiceEtapa,
  pasosEjecucion,
  type EstadoSolicitud,
  type UnidadComercial,
} from '../lib/cambioTitularidad';
import { AlertaCargando, Bloque, ResumenTitulares, type DatosTitular } from './Piezas';

export type TipoEvento = 'enviada' | 'aprobada' | 'firma' | 'completada' | 'rechazada' | 'error';

export interface EventoSolicitud {
  id: string;
  fecha: string;
  tipo: TipoEvento;
  titulo: string;
  detalle: string;
  archivo?: string;
}

export interface SolicitudEnCurso {
  numero: string;
  estado: EstadoSolicitud;
  unidad: UnidadComercial;
  contratos: string[];
  motivo: string;
  canal: string;
  documentos: number;
  correoFirma: string;
  /** Servicios que recibe el nuevo titular (texto del correo de Zoho Sign). */
  servicios: string[];
  facturacion: string;
  /** Ejecución en BOSS: pasos terminados (0-4). */
  pasoEjecucion: number;
  errorBoss: boolean;
  motivoRechazo: string | null;
  resultado: { nuevoCliente: string; cuentaBoss: string } | null;
  eventos: EventoSolicitud[];
}

const TONO_ESTADO: Record<EstadoSolicitud, string> = {
  validacion: 'bg-amber-100 text-amber-700',
  aprobacion: 'bg-amber-100 text-amber-700',
  firma: 'bg-amber-100 text-amber-700',
  ejecucion: 'bg-sky-100 text-sky-700',
  completada: 'bg-emerald-100 text-emerald-700',
  rechazada: 'bg-red-100 text-red-700',
};

const PUNTO_EVENTO: Record<TipoEvento, string> = {
  enviada: 'bg-amber-500',
  aprobada: 'bg-emerald-500',
  firma: 'bg-violet-500',
  completada: 'bg-accion',
  rechazada: 'bg-red-500',
  error: 'bg-red-500',
};

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2.5 text-xs">
      <span className="text-gray-500">{etiqueta}:</span> <b className="text-gray-900">{children}</b>
    </div>
  );
}

function Historial({ eventos }: { eventos: EventoSolicitud[] }) {
  if (eventos.length === 0) return null;
  return (
    <Bloque titulo="Historial de la solicitud" icono={History}>
      <ol className="relative flex flex-col gap-4 pl-6">
        <span aria-hidden="true" className="absolute top-1 bottom-1 left-[7px] w-px bg-gray-200" />
        {eventos.map((e) => (
          <li key={e.id} className="relative">
            <span
              aria-hidden="true"
              className={cn(
                'absolute top-1 -left-6 h-3.5 w-3.5 rounded-full ring-4 ring-white',
                PUNTO_EVENTO[e.tipo],
              )}
            />
            <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-bold text-gray-900">{e.titulo}</span>
                <span className="text-[10.5px] text-gray-400">{e.fecha}</span>
              </div>
              <p className="mt-0.5 text-gray-500">{e.detalle}</p>
              {e.archivo && (
                <span className="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-accion">
                  <FileText aria-hidden="true" className="h-3.5 w-3.5" /> {e.archivo}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Bloque>
  );
}

/** Controles para recorrer los estados mientras los servicios no están conectados. */
export interface ControlesDemostracion {
  aprobar: () => void;
  rechazar: () => void;
  firmar: () => void;
  vencerFirma: () => void;
  errorBoss: () => void;
}

function Demostracion({
  estado,
  errorBoss,
  controles,
}: {
  estado: EstadoSolicitud;
  errorBoss: boolean;
  controles: ControlesDemostracion;
}) {
  let botones: ReactNode = null;
  if (estado === 'aprobacion') {
    botones = (
      <>
        <Boton variante="secundario" tamano="sm" onClick={controles.rechazar}>
          Rechazar
        </Boton>
        <Boton tamano="sm" icono={UserCheck} onClick={controles.aprobar}>
          Aprobar (supervisor)
        </Boton>
      </>
    );
  } else if (estado === 'firma') {
    botones = (
      <>
        <Boton variante="secundario" tamano="sm" onClick={controles.vencerFirma}>
          Firma vencida
        </Boton>
        <Boton tamano="sm" icono={FileSignature} onClick={controles.firmar}>
          Firma del nuevo titular
        </Boton>
      </>
    );
  } else if (estado === 'ejecucion' && !errorBoss) {
    botones = (
      <Boton variante="secundario" tamano="sm" onClick={controles.errorBoss}>
        Error de BOSS
      </Boton>
    );
  }
  if (!botones) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-violet-300 bg-violet-50 px-4 py-3">
      <p className="flex items-center gap-2 text-xs font-semibold text-violet-800">
        <FlaskConical aria-hidden="true" className="h-4 w-4" />
        Demostración: simular la respuesta de los otros procesos
      </p>
      <div className="flex flex-wrap gap-2">{botones}</div>
    </div>
  );
}

export function Seguimiento({
  solicitud,
  anterior,
  nuevo,
  nombreNuevo,
  nombreAnterior,
  correoAnterior,
  demostracion,
  onReintentar,
  onNueva,
}: {
  solicitud: SolicitudEnCurso;
  anterior: DatosTitular;
  nuevo: DatosTitular;
  nombreNuevo: string;
  nombreAnterior: string;
  correoAnterior: string;
  demostracion: ControlesDemostracion | null;
  onReintentar: () => void;
  onNueva: () => void;
}) {
  const s = solicitud;
  const pasos = pasosEjecucion(s.unidad);
  return (
    <div className="flex animate-aparecer flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] text-gray-400">Solicitud</p>
          <p className="text-base font-bold text-gray-900">{s.numero} · Cambio de Titularidad</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('rounded px-2 py-0.5 text-[11px] font-bold uppercase', TONO_ESTADO[s.estado])}>
            {ETIQUETA_ESTADO[s.estado]}
          </span>
          <span className="rounded bg-netuno-oscuro px-2 py-0.5 text-[11px] font-bold text-white">
            {s.unidad.toUpperCase()}
          </span>
        </div>
      </div>

      {s.estado !== 'rechazada' && <Pasos pasos={ETAPAS_SOLICITUD} actual={indiceEtapa(s.estado)} />}
      <ResumenTitulares anterior={anterior} nuevo={nuevo} />
      {demostracion && <Demostracion estado={s.estado} errorBoss={s.errorBoss} controles={demostracion} />}

      {s.estado === 'validacion' && (
        <AlertaCargando>
          <strong>Validando solicitud…</strong>
          <br />
          Saldo cero en BOSS ✓ · Documento del nuevo titular sin duplicados en CRM/BOSS · Correo NetunoGo
          único · Documentos completos.
        </AlertaCargando>
      )}

      {s.estado === 'aprobacion' && (
        <Bloque titulo="Pendiente de aprobación · Supervisor comercial" icono={UserCheck}>
          <Alerta tono="aviso">
            <strong>Solicitud en bandeja del Supervisor / Administración de Ventas</strong>
            <br />
            Se notificó al supervisor. Al aprobar, se genera el contrato del nuevo titular y se envía para
            firma remota por Zoho Sign.
          </Alerta>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Dato etiqueta="Contratos">{s.contratos.join(', ')}</Dato>
            <Dato etiqueta="Motivo">
              {s.motivo} · <span className="font-normal">{s.canal}</span>
            </Dato>
            <Dato etiqueta="Documentos">
              {s.documentos}/{s.documentos} cargados
            </Dato>
            <Dato etiqueta="Costo de instalación">US$ 0,00</Dato>
          </div>
        </Bloque>
      )}

      {s.estado === 'firma' && (
        <Bloque titulo="Contrato enviado · Esperando firma (Zoho Sign)" icono={Mail}>
          <div className="overflow-hidden rounded-lg border border-gray-200 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-[10.5px] text-gray-400">
                  Para: <span className="font-mono">{s.correoFirma}</span> · vía Zoho Sign
                </p>
                <p className="font-bold text-gray-900">Contrato de Servicio · Nuevo Titular · {s.numero}</p>
              </div>
              <span className="rounded bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-700">
                ENVIADO · PENDIENTE DE FIRMA
              </span>
            </div>
            <div className="flex flex-col gap-2 p-4 text-gray-700">
              <p>
                Estimado(a) <b>{nombreNuevo}</b>, NETUNO le envía el contrato de los servicios que recibe por
                cambio de titularidad:
              </p>
              <ul className="list-disc pl-5 text-[11.5px]">
                {s.servicios.map((servicio) => (
                  <li key={servicio}>{servicio}</li>
                ))}
              </ul>
              <p className="text-[11.5px] text-gray-500">
                Sin costo de instalación ni visita técnica. Facturación a su nombre desde el{' '}
                <b>{s.facturacion}</b>.
              </p>
              <p className="flex justify-center pt-1">
                <span className="rounded-md bg-netuno-500 px-8 py-2 font-bold text-white">
                  Revisar y firmar
                </span>
              </p>
            </div>
          </div>
          <Alerta>
            La cuenta del nuevo titular en BOSS se crea <b>solo después</b> de la firma. Recordatorio
            automático a las 48 h; la solicitud vence si no se firma en el plazo configurado.
          </Alerta>
        </Bloque>
      )}

      {s.estado === 'ejecucion' && (
        <Bloque titulo="Ejecución en BOSS (Mulesoft · servicio de Ingeniería)" icono={Server}>
          <ol className="flex flex-col gap-2.5">
            {pasos.map((paso, i) => {
              const hecho = s.pasoEjecucion > i;
              const fallo = s.errorBoss && s.pasoEjecucion === i;
              const actual = !s.errorBoss && s.pasoEjecucion === i;
              let icono = <Circle aria-hidden="true" className="h-4 w-4 shrink-0" />;
              if (hecho) icono = <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />;
              else if (fallo) icono = <XCircle aria-hidden="true" className="h-4 w-4 shrink-0" />;
              else if (actual)
                icono = <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" />;
              return (
                <li
                  key={paso}
                  className={cn(
                    'flex items-center gap-2.5 text-xs',
                    hecho && 'text-emerald-700',
                    fallo && 'text-red-700',
                    actual && 'font-semibold text-sky-700',
                    !hecho && !fallo && !actual && 'text-gray-400',
                  )}
                >
                  {icono}
                  {paso}
                </li>
              );
            })}
          </ol>
          {s.errorBoss && (
            <>
              <Alerta tono="error">
                <strong>Error en el servicio de cambio de titularidad de BOSS</strong>
                <br />
                La solicitud permanece <b>En ejecución</b> y el titular anterior <b>no</b> se desconecta. Se
                alertó al agente, al supervisor y a TI.
              </Alerta>
              <div className="flex justify-end">
                <Boton icono={RefreshCw} onClick={onReintentar}>
                  Reintentar
                </Boton>
              </div>
            </>
          )}
        </Bloque>
      )}

      {s.estado === 'completada' && s.resultado && (
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 aria-hidden="true" className="h-8 w-8" />
          </span>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Cambio de titularidad completado</h3>
            <p className="mx-auto max-w-md text-sm text-gray-500">
              Los servicios quedaron a nombre de <b>{nombreNuevo}</b>. El histórico y los pagos permanecen en
              el titular anterior.
            </p>
          </div>
          <ul className="flex w-full flex-col gap-2.5 rounded-xl border border-gray-200 bg-gray-50 p-5 text-left text-xs text-emerald-700">
            <li className="border-b border-gray-200 pb-2 font-bold text-gray-900">Acciones ejecutadas:</li>
            {[
              <>
                Nuevo cliente <b>{s.resultado.nuevoCliente}</b> · Cuenta BOSS <b>{s.resultado.cuentaBoss}</b>{' '}
                · referencia &quot;Proviene de cambio de titularidad&quot;
              </>,
              <>
                {nombreAnterior} → <b>Desconectado por cambio de titularidad</b> (no se contabiliza como baja)
              </>,
              <>Servicios migrados sin visita técnica: {s.contratos.join(', ')}</>,
              <>
                Facturación del nuevo titular desde el <b>{s.facturacion}</b>, sin prorrateo
              </>,
              <>
                Notificación enviada a {correoAnterior || 'el titular anterior'} y {s.correoFirma}
              </>,
              <>
                Solicitud, contrato firmado y documentos en la <b>Cronología</b> de ambos clientes
              </>,
            ].map((texto, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 aria-hidden="true" className="mt-px h-4 w-4 shrink-0" />
                <span>{texto}</span>
              </li>
            ))}
          </ul>
          <Boton icono={RotateCcw} onClick={onNueva}>
            Volver a administración
          </Boton>
        </div>
      )}

      {s.estado === 'rechazada' && (
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
            <XCircle aria-hidden="true" className="h-8 w-8" />
          </span>
          <h3 className="text-lg font-bold text-gray-900">Solicitud rechazada</h3>
          <p className="max-w-md text-sm text-gray-500">
            {s.motivoRechazo}. El titular anterior conserva sus servicios sin cambios. El agente fue
            notificado y el registro quedó en la Cronología.
          </p>
          <Boton icono={RotateCcw} onClick={onNueva}>
            Nueva solicitud
          </Boton>
        </div>
      )}

      <Historial eventos={s.eventos} />
    </div>
  );
}
