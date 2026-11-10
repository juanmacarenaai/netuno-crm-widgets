import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react';
import { mensajeDeError } from '@/core/http/errores';
import type { Cuenta } from '@/shared/cuentas';
import { useZoho } from '@/shared/zoho/contexto';
import { Alerta, Boton, Cargando, cn, Pasos, TarjetaSeleccionable, useAvisos, type TonoAlerta } from '@/ui';
import { RegistrarCanalAtencion } from '@/shared/canal-atencion';
import { AlertaDowngrade } from './AlertaDowngrade';
import { TIPOS_CAMBIO } from './config';
import {
  alternarServicio,
  beneficiariosAdicionales,
  elegibilidadCambioPlan,
  reglaDowngrade,
  serviciosElegibles,
  type OpcionPlan,
  type ResultadoUpgrade,
} from './lib/cambioPlan';
import {
  aplicarUpgrade,
  consultarPaquetes,
  crearTicketDowngrade,
  registrarEventoCambioPlan,
  type ResultadoTicket,
} from './servicio';

type Paso = 'elegir' | 'nuevo' | 'confirmar' | 'resultado';

const PASOS = ['Plan actual', 'Nuevo plan', 'Confirmar', 'Resultado'] as const;
const INDICE_PASO: Record<Paso, number> = { elegir: 0, nuevo: 1, confirmar: 2, resultado: 3 };

type Consulta =
  | { estado: 'cargando' }
  | { estado: 'error'; mensaje: string }
  | { estado: 'sin-paquetes' | 'cambio-este-mes' | 'listo' };

type Resultado =
  | ({ tipo: 'upgrade' } & ResultadoUpgrade)
  | ({ tipo: 'ticket' } & ResultadoTicket)
  | { tipo: 'error'; texto: string };

interface Estado {
  paso: Paso;
  marcados: boolean[] | null;
  arrastrados: boolean[];
  consulta: Consulta | null;
  opciones: OpcionPlan[];
  opcion: OpcionPlan | null;
  /** Contratos de Salud elegidos para excluir. */
  excluidos: string[];
  ejecutando: boolean;
  resultado: Resultado | null;
}

const INICIAL: Estado = {
  paso: 'elegir',
  marcados: null,
  arrastrados: [],
  consulta: null,
  opciones: [],
  opcion: null,
  excluidos: [],
  ejecutando: false,
  resultado: null,
};

const TONO_UPGRADE: Record<ResultadoUpgrade['estado'], TonoAlerta> = {
  ok: 'exito',
  aviso: 'aviso',
  periodo: 'aviso',
  error: 'error',
};

/**
 * Cambio de plan (pestaña de Administrar cuenta). Upgrade: se aplica en Netuno y se registra el canal de
 * atención. Downgrade: crea un ticket en Zoho Desk según las reglas de config.ts.
 */
export function CambioPlan({ cuenta, onCompletado }: { cuenta: Cuenta; onCompletado?: () => void }) {
  const { usuario, registro, documento } = useZoho();
  const { avisar } = useAvisos();
  const elegibilidad = useMemo(() => elegibilidadCambioPlan(cuenta), [cuenta]);
  const servicios = useMemo(() => serviciosElegibles(cuenta), [cuenta]);
  const adicionales = useMemo(() => beneficiariosAdicionales(cuenta), [cuenta]);
  const [e, setE] = useState<Estado>(INICIAL);

  const marcados = e.marcados ?? servicios.map(() => false);
  // Como en continueCambioPlan: se cambia el primer servicio marcado
  const servicioElegido = servicios[marcados.indexOf(true)] ?? null;
  const regla =
    e.opcion?.tipoCambio === 'D' && servicioElegido
      ? reglaDowngrade({
          servicio: servicioElegido.servicio,
          nuevo: e.opcion.nombre,
          anterior: servicioElegido.plan,
          adicionales,
        })
      : null;
  // Si el plan nuevo no admite beneficiarios se excluyen todos; si no, los que eligió el asesor
  const excluidos =
    regla && regla.excluir > 0
      ? regla.elegir
        ? adicionales.filter((b) => e.excluidos.includes(b.contrato))
        : adicionales
      : [];
  const faltanExcluir = regla?.elegir ? regla.excluir - excluidos.length : 0;

  const reiniciar = () => setE(INICIAL);

  const continuar = async () => {
    if (!servicioElegido) return;
    setE((x) => ({ ...x, paso: 'nuevo', consulta: { estado: 'cargando' }, opciones: [], opcion: null }));
    try {
      const { opciones, cambioEsteMes } = await consultarPaquetes(servicioElegido);
      const estado = cambioEsteMes ? 'cambio-este-mes' : opciones.length ? 'listo' : 'sin-paquetes';
      setE((x) => ({ ...x, consulta: { estado }, opciones }));
    } catch (error) {
      console.error('Error al consultar los paquetes:', error);
      setE((x) => ({ ...x, consulta: { estado: 'error', mensaje: mensajeDeError(error) } }));
    }
  };

  const confirmar = async () => {
    const opcion = e.opcion;
    if (!servicioElegido || !opcion) return;
    setE((x) => ({ ...x, ejecutando: true }));
    let resultado: Resultado;
    try {
      if (opcion.tipoCambio === 'U') {
        resultado = {
          tipo: 'upgrade',
          ...(await aplicarUpgrade({ cuenta, servicioElegido, opcion, usuario })),
        };
      } else {
        const seleccion = {
          servicioElegido,
          opcion,
          excluidos,
          adicionales,
          regla: regla ?? { aprobacion: false },
        };
        resultado = {
          tipo: 'ticket',
          ...(await crearTicketDowngrade({ seleccion, cuenta, registro, usuario })),
        };
      }
    } catch (error) {
      console.error('Error en el cambio de plan:', error);
      resultado = {
        tipo: 'error',
        texto:
          opcion.tipoCambio === 'U'
            ? `No se pudo actualizar el plan: ${mensajeDeError(error)}`
            : `No se pudo crear el ticket de downgrade en Zoho Desk: ${mensajeDeError(error)}`,
      };
    }
    setE((x) => ({ ...x, ejecutando: false, paso: 'resultado', resultado }));

    if (resultado.tipo === 'upgrade' && resultado.estado === 'ok') {
      avisar({ tipo: 'exito', titulo: 'Plan actualizado', texto: `Nuevo plan: ${opcion.nombre}` });
    } else if (resultado.tipo === 'ticket' && resultado.estado === 'creado') {
      avisar({
        tipo: 'exito',
        titulo: 'Ticket de downgrade creado',
        texto: `Ticket ${resultado.numero ?? ''} · ${resultado.departamento}`,
      });
      onCompletado?.();
    } else if (resultado.tipo === 'error') {
      avisar({ tipo: 'error', titulo: 'No se completó el cambio de plan', texto: resultado.texto });
    }
  };

  const registrarEvento = (canal: string) => {
    if (!servicioElegido || !e.opcion || e.resultado?.tipo !== 'upgrade') return Promise.resolve();
    return registrarEventoCambioPlan({
      canal,
      cuenta,
      servicioElegido,
      opcion: e.opcion,
      historial: e.resultado.historial,
      registro,
      documento,
      usuario,
    });
  };

  if (!elegibilidad.ok) {
    return (
      <Alerta tono="aviso">
        <strong>No es posible cambiar el plan.</strong>
        <br />
        {elegibilidad.mensaje}
      </Alerta>
    );
  }

  const pasos = <Pasos pasos={PASOS} actual={INDICE_PASO[e.paso]} />;

  /* ---------- Paso 1: plan a cambiar ---------- */
  if (e.paso === 'elegir' || !servicioElegido) {
    return (
      <div className="flex flex-col gap-4">
        {pasos}
        <p className="text-sm font-bold text-gray-700">Elegir plan a cambiar:</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {servicios.map((s, i) => (
            <TarjetaSeleccionable
              key={s.idProducto}
              titulo={s.plan}
              marcada={Boolean(marcados[i])}
              atenuada={Boolean(e.arrastrados[i])}
              onClick={() => setE((x) => ({ ...x, ...alternarServicio(servicios, marcados, i) }))}
            >
              <span className="font-bold text-gray-700">{s.servicio}</span>
              <span className="truncate">{s.detalle}</span>
            </TarjetaSeleccionable>
          ))}
        </div>
        <div className="flex justify-end">
          <Boton icono={ArrowRight} onClick={() => void continuar()} disabled={!servicioElegido}>
            Continuar
          </Boton>
        </div>
      </div>
    );
  }

  /* ---------- Paso 2: nuevo plan ---------- */
  if (e.paso === 'nuevo') {
    const { consulta } = e;
    return (
      <div className="flex flex-col gap-4">
        {pasos}
        <p className="text-sm text-gray-600">
          Plan actual: <strong>{servicioElegido.plan}</strong> ({servicioElegido.servicio})
        </p>
        {consulta?.estado === 'cargando' && <Cargando mensaje="Consultando los planes disponibles..." />}
        {consulta?.estado === 'error' && (
          <Alerta tono="error">No se pudieron consultar los planes disponibles. {consulta.mensaje}</Alerta>
        )}
        {consulta?.estado === 'sin-paquetes' && (
          <Alerta>No hay planes disponibles para cambiar este servicio.</Alerta>
        )}
        {consulta?.estado === 'cambio-este-mes' && (
          <Alerta tono="aviso">
            Este servicio ya tuvo un cambio de plan este mes. Solo se permite un cambio por mes.
          </Alerta>
        )}
        {consulta?.estado === 'listo' && (
          <>
            <p className="text-sm font-bold text-gray-700">Elegir el nuevo plan:</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {e.opciones.map((o) => (
                <TarjetaSeleccionable
                  key={`${o.tipoCambio}-${o.codigo}`}
                  titulo={o.nombre}
                  marcada={e.opcion === o}
                  onClick={() => setE((x) => ({ ...x, opcion: x.opcion === o ? null : o, excluidos: [] }))}
                  insignia={
                    <span
                      className={cn(
                        'w-fit rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                        o.tipoCambio === 'U'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-800',
                      )}
                    >
                      {TIPOS_CAMBIO[o.tipoCambio].etiqueta}
                    </span>
                  }
                >
                  <span className="text-sm font-bold text-gray-500">TOTAL mensual: {o.precio}</span>
                </TarjetaSeleccionable>
              ))}
            </div>
          </>
        )}
        <div className="flex justify-between gap-2">
          <Boton
            variante="secundario"
            icono={ArrowLeft}
            onClick={() => setE((x) => ({ ...x, paso: 'elegir' }))}
          >
            Regresar
          </Boton>
          {consulta?.estado === 'listo' && (
            <Boton
              icono={ArrowRight}
              onClick={() => setE((x) => ({ ...x, paso: 'confirmar' }))}
              disabled={!e.opcion}
            >
              Continuar
            </Boton>
          )}
        </div>
      </div>
    );
  }

  /* ---------- Paso 3: confirmación ---------- */
  if (e.paso === 'confirmar' && e.opcion) {
    const esUpgrade = e.opcion.tipoCambio === 'U';
    return (
      <div className="flex flex-col gap-4">
        {pasos}
        <div className="grid grid-cols-1 items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-tarjeta sm:grid-cols-[1fr_auto_1fr]">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">Plan actual</p>
            <p className="text-base font-bold text-gray-700">{servicioElegido.plan}</p>
          </div>
          <ArrowRight aria-hidden="true" className="hidden h-5 w-5 text-gray-300 sm:block" />
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">Nuevo plan</p>
            <p className="text-base font-bold text-netuno-800">{e.opcion.nombre}</p>
          </div>
          {servicioElegido.servicio === 'Streaming' && e.opcion.resumen && (
            <p className="text-xs text-gray-600 sm:col-span-3">Incluye: {e.opcion.resumen}</p>
          )}
          <p className="border-t border-gray-100 pt-3 text-sm sm:col-span-3">
            Total: <strong className="text-base text-gray-900">{e.opcion.precio}/mes</strong>
          </p>
        </div>

        {!esUpgrade && regla && (
          <AlertaDowngrade
            regla={regla}
            nuevo={e.opcion.nombre}
            cuenta={cuenta.cuenta}
            adicionales={adicionales}
            excluidos={excluidos.map((b) => b.contrato)}
            onAlternar={(contrato) =>
              setE((x) => ({
                ...x,
                excluidos: x.excluidos.includes(contrato)
                  ? x.excluidos.filter((c) => c !== contrato)
                  : [...x.excluidos, contrato],
              }))
            }
          />
        )}

        <p className="text-sm font-bold text-gray-700">
          {esUpgrade
            ? 'Haz clic en «Confirmar» para aceptar actualizar el cargo mensual.'
            : 'Al confirmar se creará el ticket de downgrade en Zoho Desk.'}
        </p>
        {faltanExcluir > 0 && (
          <p role="alert" className="text-xs font-bold text-red-600">
            Selecciona {faltanExcluir} beneficiario(s) más para continuar.
          </p>
        )}

        <div className="flex justify-between gap-2">
          <Boton
            variante="secundario"
            icono={ArrowLeft}
            onClick={() => setE((x) => ({ ...x, paso: 'nuevo' }))}
            disabled={e.ejecutando}
          >
            Regresar
          </Boton>
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={reiniciar} disabled={e.ejecutando}>
              Cancelar
            </Boton>
            <Boton
              icono={Check}
              cargando={e.ejecutando}
              onClick={() => void confirmar()}
              disabled={faltanExcluir > 0}
            >
              {e.ejecutando ? (esUpgrade ? 'Actualizando plan...' : 'Creando ticket...') : 'Confirmar'}
            </Boton>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Paso 4: resultado ---------- */
  const r = e.resultado;
  return (
    <div className="flex flex-col gap-4">
      {pasos}
      {r?.tipo === 'upgrade' && (
        <Alerta tono={TONO_UPGRADE[r.estado]}>
          <strong>Resultado de cambio de plan:</strong>
          <br />
          {r.texto}
        </Alerta>
      )}
      {r?.tipo === 'ticket' && (
        <Alerta tono={r.estado === 'creado' ? 'exito' : 'aviso'}>
          <strong>
            {r.estado === 'creado'
              ? 'El ticket se ha creado exitosamente.'
              : `Ya existe un ticket «${r.estadoTicket ?? ''}» para este cliente.`}
          </strong>
          <br />
          Departamento: {r.departamento}
          <br />
          Ticket: {r.numero ?? '—'}{' '}
          {r.url && (
            <a href={r.url} target="_blank" rel="noreferrer" className="font-bold text-accion underline">
              Ver ticket
            </a>
          )}
        </Alerta>
      )}
      {r?.tipo === 'error' && <Alerta tono="error">{r.texto}</Alerta>}

      {r?.tipo === 'upgrade' && (r.estado === 'ok' || r.estado === 'aviso') && (
        <RegistrarCanalAtencion registrar={registrarEvento} onTerminar={() => onCompletado?.()} />
      )}

      <div className="flex justify-end">
        <Boton variante="secundario" icono={RotateCcw} onClick={reiniciar}>
          Nuevo cambio de plan
        </Boton>
      </div>
    </div>
  );
}
