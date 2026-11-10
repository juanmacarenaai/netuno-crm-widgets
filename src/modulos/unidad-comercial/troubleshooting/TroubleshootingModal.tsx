import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Gauge,
  Headset,
  LoaderCircle,
  Power,
  RotateCcw,
  Ticket,
  TriangleAlert,
  WifiOff,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { mensajeDeError } from '@/core/http/errores';
import type { Contrato, Cuenta } from '@/shared/cuentas';
import { useZoho } from '@/shared/zoho/contexto';
import { Alerta, Boton, Cargando, cn, Modal, PuntoEstado, type TonoAlerta } from '@/ui';
import senalNegativa from '../assets/SenalNegativa.jpg';
import senalPositiva from '../assets/SenalPositiva.jpg';
import { RegistrarCanalAtencion } from '@/shared/canal-atencion';
import imagenLos from './assets/LOS.png';
import imagenApagado from './assets/Off.png';
import imagenPon from './assets/Pon.png';
import imagenPonIntermitente from './assets/PonInt.gif';
import {
  datosTicketPadre,
  diagnosticoLos,
  estadoPotencia,
  FALLAS,
  ipAsignada,
  MENSAJES,
  textoValorOptico,
  type EstadoPaso,
  type TipoFalla,
} from './lib/troubleshooting';
import {
  asistenciaRemota,
  consultarValoresOpticos,
  diagnosticoInicial,
  refrescarOnt,
  registrarEventoRefrescamiento,
  reportarFalla,
} from './servicio';

type Paso = 'tipoFalla' | 'luces' | 'apagado' | 'los' | 'panel' | 'final';

interface Final {
  tono: TonoAlerta;
  texto: string;
  crearTicket: boolean;
}

type Refresco =
  { estado: 'confirmar' } | { estado: 'enviando' } | { estado: 'ok' } | { estado: 'error'; texto: string };

const ICONO_PASO: Record<EstadoPaso, { Icono: LucideIcon; clase: string; texto: string }> = {
  ok: { Icono: CheckCircle2, clase: 'text-emerald-600', texto: 'Correcto' },
  falla: { Icono: XCircle, clase: 'text-red-600', texto: 'Con falla' },
  progreso: { Icono: LoaderCircle, clase: 'animate-spin text-accion', texto: 'Verificando' },
  neutro: { Icono: Circle, clase: 'text-gray-300', texto: 'Sin verificar' },
};

function Verificacion({ etiqueta, estado }: { etiqueta: string; estado: EstadoPaso }) {
  const { Icono, clase, texto } = ICONO_PASO[estado];
  return (
    <li className="flex items-center gap-2 py-1 text-sm text-gray-700">
      <Icono aria-hidden="true" className={cn('h-4 w-4 shrink-0', clase)} />
      <span className="flex-1">{etiqueta}</span>
      <span className="sr-only">{texto}</span>
    </li>
  );
}

function Opcion({
  titulo,
  detalle,
  imagen,
  icono: Icono,
  onClick,
}: {
  titulo: string;
  detalle?: string;
  imagen?: string;
  icono?: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 text-center shadow-tarjeta transition hover:-translate-y-0.5 hover:border-accion hover:shadow-tarjeta-hover focus-visible:outline-2 focus-visible:outline-accion"
    >
      {imagen ? (
        <img src={imagen} alt="" className="h-20 w-full rounded-lg object-contain" />
      ) : (
        Icono && <Icono aria-hidden="true" className="h-8 w-8 text-accion" />
      )}
      <span className="text-sm font-bold text-gray-800">{titulo}</span>
      {detalle && <span className="text-xs text-gray-500">{detalle}</span>}
    </button>
  );
}

/**
 * Troubleshooting de un servicio de Internet: evento masivo, posible evento masivo y diagnóstico guiado según
 * el tipo de falla, con restablecimiento de la ONT y, si no se resuelve, creación del ticket.
 */
export default function TroubleshootingModal({
  cuenta,
  servicio,
  onCerrar,
  onCrearTicket,
}: {
  cuenta: Cuenta;
  servicio: Contrato;
  onCerrar: () => void;
  /** Abre "Crear Ticket" para el mismo servicio. */
  onCrearTicket: () => void;
}) {
  const { registro, usuario, documento } = useZoho();
  const esInternet = servicio.nombreServicio === 'Internet';

  const diagnostico = useQuery({
    queryKey: ['troubleshooting', 'diagnostico', servicio.idProducto],
    queryFn: () => diagnosticoInicial({ cuenta, servicio, registro }),
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });

  const [paso, setPaso] = useState<Paso>('tipoFalla');
  const [falla, setFalla] = useState<TipoFalla | null>(null);
  const [luzPon, setLuzPon] = useState(false);
  const [encendido, setEncendido] = useState<EstadoPaso>('neutro');
  const [resultadoPanel, setResultadoPanel] = useState<EstadoPaso | null>(null);
  const [final, setFinal] = useState<Final | null>(null);
  const [verValores, setVerValores] = useState(false);
  const [refresco, setRefresco] = useState<Refresco | null>(null);
  const [verPadre, setVerPadre] = useState(false);
  const [asistencia, setAsistencia] = useState<
    { estado: 'abriendo' } | { estado: 'ok'; url: string } | { estado: 'error'; texto: string } | null
  >(null);

  const valores = useQuery({
    queryKey: ['troubleshooting', 'valores', servicio.idProducto, falla, luzPon],
    queryFn: () => consultarValoresOpticos(servicio),
    enabled: paso === 'los' || paso === 'panel',
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const potencia: EstadoPaso = valores.isPending
    ? 'progreso'
    : valores.isError
      ? 'falla'
      : estadoPotencia(servicio.codTecnologia, valores.data);
  const ip: EstadoPaso = valores.isPending ? 'progreso' : ipAsignada(valores.data) ? 'ok' : 'falla';

  const elegirFalla = (tipo: TipoFalla) => {
    reportarFalla(cuenta, servicio);
    setFalla(tipo);
    setResultadoPanel(null);
    setRefresco(null);
    setVerValores(false);
    if (tipo === 'sinConexion') {
      setPaso('luces');
    } else {
      setEncendido('ok');
      setPaso('panel');
    }
  };

  const terminar = (f: Final) => {
    setFinal(f);
    setPaso('final');
  };

  const abrirAsistencia = async () => {
    setAsistencia({ estado: 'abriendo' });
    try {
      const url = await asistenciaRemota(String(registro.email ?? ''));
      setAsistencia({ estado: 'ok', url });
      window.open(url, '_blank', 'noopener');
    } catch (error) {
      console.error('Error al iniciar la asistencia remota:', error);
      setAsistencia({ estado: 'error', texto: mensajeDeError(error) });
    }
  };

  const enviarRefresco = async () => {
    setRefresco({ estado: 'enviando' });
    try {
      await refrescarOnt(servicio);
      setRefresco({ estado: 'ok' });
    } catch (error) {
      console.error('Error al restablecer la ONT:', error);
      setRefresco({ estado: 'error', texto: mensajeDeError(error) });
    }
  };

  // ── Checklist ──
  const d = diagnostico.data;
  const verificaciones: { etiqueta: string; estado: EstadoPaso }[] = [
    { etiqueta: 'Evento Masivo', estado: diagnostico.isPending ? 'progreso' : (d?.tem ?? 'neutro') },
  ];
  if (!d?.masivo) {
    verificaciones.push({
      etiqueta: 'Posible Evento Masivo',
      estado: diagnostico.isPending ? 'neutro' : (d?.pem ?? 'neutro'),
    });
  }
  if (falla) {
    verificaciones.push({ etiqueta: 'Equipo encendido', estado: encendido });
    if (paso === 'los') {
      verificaciones.push({ etiqueta: 'Recepción de potencia', estado: potencia });
    }
    if (falla !== 'sinConexion') verificaciones.push({ etiqueta: 'ONT Sincronizada', estado: 'ok' });
    if (falla !== 'sinConexion' || luzPon) {
      verificaciones.push({ etiqueta: FALLAS[falla].verificacion, estado: resultadoPanel ?? 'progreso' });
    }
  }

  // ── Contenido ──
  let contenido: ReactNode;
  if (diagnostico.isPending) {
    contenido = <Cargando mensaje="Buscando eventos masivos que afecten al cliente..." />;
  } else if (diagnostico.isError) {
    contenido = (
      <Alerta tono="error">
        No se completó la verificación de evento masivo: {diagnostico.error.message}{' '}
        <button
          type="button"
          className="font-bold text-accion underline"
          onClick={() => void diagnostico.refetch()}
        >
          Reintentar
        </button>
      </Alerta>
    );
  } else if (d?.masivo) {
    const { padre, hijo } = d.masivo;
    contenido = (
      <div className="flex flex-col gap-3">
        <Alerta tono="aviso">
          <strong className="block">{MENSAJES.masivo}</strong>
          Ticket del cliente: #{hijo.numero} {hijo.creado ? '(creado ahora)' : '(ya existía)'}{' '}
          {hijo.url && (
            <a
              href={hijo.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-bold text-accion underline"
            >
              Ver ticket <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            </a>
          )}
        </Alerta>
        <div>
          <Boton variante="secundario" tamano="sm" icono={Ticket} onClick={() => setVerPadre((v) => !v)}>
            {verPadre ? 'Ocultar ticket padre' : 'Ticket padre'}
          </Boton>
        </div>
        {verPadre && (
          <section
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-tarjeta"
            aria-label="Información del evento masivo"
          >
            <h4 className="mb-3 text-sm font-bold text-gray-800">Información del evento masivo</h4>
            <dl className="grid grid-cols-1 gap-x-5 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold text-gray-500">Nro. Ticket</dt>
                <dd>
                  {padre.webUrl ? (
                    <a
                      href={padre.webUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-accion underline"
                    >
                      {padre.ticketNumber ?? 'Ver'}
                    </a>
                  ) : (
                    (padre.ticketNumber ?? 'Sin datos')
                  )}
                </dd>
              </div>
              {datosTicketPadre(padre).map((c) => (
                <div key={c.etiqueta} className={c.etiqueta === 'Descripción' ? 'sm:col-span-2' : undefined}>
                  <dt className="text-xs font-bold text-gray-500">{c.etiqueta}</dt>
                  <dd className="break-words whitespace-pre-line text-gray-800">{c.valor}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    );
  } else if (d?.posibleMasivo) {
    contenido = (
      <Alerta tono="error">
        <strong>{MENSAJES.posibleMasivo}</strong>
      </Alerta>
    );
  } else if (!esInternet) {
    contenido = (
      <div className="flex flex-col gap-3">
        <Alerta tono="aviso">{MENSAJES.especializado}</Alerta>
        <div>
          <Boton icono={Ticket} onClick={onCrearTicket}>
            Crear Ticket
          </Boton>
        </div>
      </div>
    );
  } else if (paso === 'tipoFalla') {
    contenido = (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-bold text-gray-700">¿Qué falla presenta el servicio?</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Opcion titulo="Sin conexión" icono={WifiOff} onClick={() => elegirFalla('sinConexion')} />
          <Opcion titulo="Intermitencia" icono={Zap} onClick={() => elegirFalla('intermitencia')} />
          <Opcion titulo="Lentitud" icono={Gauge} onClick={() => elegirFalla('lentitud')} />
          <Opcion titulo="Asistencia remota" icono={Headset} onClick={() => void abrirAsistencia()} />
        </div>
        {asistencia?.estado === 'abriendo' && (
          <Cargando mensaje="Creando la sesión de asistencia remota..." />
        )}
        {asistencia?.estado === 'ok' && (
          <Alerta tono="exito">
            Sesión de asistencia remota creada.{' '}
            <a
              href={asistencia.url}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-accion underline"
            >
              Abrir sesión
            </a>
          </Alerta>
        )}
        {asistencia?.estado === 'error' && (
          <Alerta tono="error">No se pudo iniciar la asistencia remota: {asistencia.texto}</Alerta>
        )}
      </div>
    );
  } else if (paso === 'luces') {
    contenido = (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-bold text-gray-700">¿Qué luces muestra la ONT?</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Opcion
            titulo="POWER"
            detalle="(Apagado)"
            imagen={imagenApagado}
            onClick={() => {
              setEncendido('falla');
              setPaso('apagado');
            }}
          />
          <Opcion
            titulo="LOS"
            detalle="(Luz roja)"
            imagen={imagenLos}
            onClick={() => {
              setEncendido('ok');
              setLuzPon(false);
              setPaso('los');
            }}
          />
          <Opcion
            titulo="PON"
            detalle="(Fijo)"
            imagen={imagenPon}
            onClick={() => {
              setEncendido('ok');
              setLuzPon(true);
              setPaso('panel');
            }}
          />
          <Opcion
            titulo="PON"
            detalle="(Intermitente)"
            imagen={imagenPonIntermitente}
            onClick={() => {
              setEncendido('ok');
              setLuzPon(true);
              setPaso('panel');
            }}
          />
        </div>
        <div>
          <Boton
            variante="secundario"
            tamano="sm"
            onClick={() => {
              setFalla(null);
              setEncendido('neutro');
              setPaso('tipoFalla');
            }}
          >
            Cambiar tipo de falla
          </Boton>
        </div>
      </div>
    );
  } else if (paso === 'apagado') {
    contenido = (
      <div className="flex flex-col gap-3">
        <Alerta tono="aviso">
          <strong>{MENSAJES.apagado}</strong>
        </Alerta>
        <div className="flex gap-2">
          <Boton
            variante="secundario"
            onClick={() => {
              setEncendido('neutro');
              setPaso('luces');
            }}
          >
            Cerrar
          </Boton>
          <Boton
            icono={Power}
            onClick={() => {
              setEncendido('ok');
              setPaso('luces');
            }}
          >
            Encendido
          </Boton>
        </div>
      </div>
    );
  } else if (paso === 'los') {
    const diag = diagnosticoLos(servicio.codTecnologia, valores.data);
    contenido = valores.isPending ? (
      <Cargando mensaje="Consultando la potencia óptica..." />
    ) : (
      <div className="flex flex-col gap-3">
        <Alerta tono={diag.estado === 'falla' ? 'error' : diag.estado === 'ok' ? 'exito' : 'aviso'}>
          <strong>
            {valores.isError
              ? 'No se logró obtener los datos de valores. ¿Desea crear el ticket?'
              : diag.mensaje}
          </strong>
        </Alerta>
        <div className="flex gap-2">
          <Boton variante="secundario" onClick={onCerrar}>
            Cerrar
          </Boton>
          <Boton icono={Ticket} onClick={onCrearTicket}>
            Crear Ticket
          </Boton>
        </div>
      </div>
    );
  } else if (paso === 'panel' && falla) {
    const textos = FALLAS[falla];
    const senalOk = (luzPon ? ip === 'ok' : true) && potencia === 'ok';
    contenido = (
      <div className="flex flex-col gap-4">
        <section
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-tarjeta"
          aria-label={textos.titulo}
        >
          <h4 className="mb-3 text-sm font-bold text-gray-800">{textos.titulo}</h4>
          <div className="flex flex-wrap items-center gap-4">
            <ul className="min-w-48 flex-1">
              {luzPon && <Verificacion etiqueta="IP asignada" estado={ip} />}
              <Verificacion etiqueta="Valores ópticos" estado={potencia} />
            </ul>
            {!valores.isPending && (
              <img
                src={senalOk ? senalPositiva : senalNegativa}
                alt={senalOk ? 'Señal correcta' : 'Señal con falla'}
                className="h-24 rounded-lg"
              />
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Boton
              variante="secundario"
              tamano="sm"
              disabled={valores.isPending}
              onClick={() => setVerValores((v) => !v)}
            >
              {verValores ? 'Ocultar valores' : 'Ver valores'}
            </Boton>
            <Boton
              variante="secundario"
              tamano="sm"
              icono={RotateCcw}
              disabled={refresco?.estado === 'enviando'}
              onClick={() => setRefresco({ estado: 'confirmar' })}
            >
              Restablecer configuración
            </Boton>
          </div>
          {verValores && (
            <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-3 text-sm">
              {(['estatus', 'conexion', 'potencia'] as const).map((clave) => (
                <div key={clave}>
                  <dt className="text-xs font-bold text-gray-500">
                    {clave === 'estatus' ? 'Estatus' : clave === 'conexion' ? 'Conexión' : 'Potencia'}
                  </dt>
                  <dd>{valores.isError ? 'Sin datos' : textoValorOptico(clave, valores.data)}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {refresco?.estado === 'confirmar' && (
          <Alerta tono="aviso">
            <strong className="block">Restablecer configuración</strong>
            {MENSAJES.refrescamiento}
            <span className="mt-2 flex gap-2">
              <Boton tamano="sm" variante="secundario" onClick={() => setRefresco(null)}>
                Cancelar
              </Boton>
              <Boton tamano="sm" onClick={() => void enviarRefresco()}>
                Enviar comando
              </Boton>
            </span>
          </Alerta>
        )}
        {refresco?.estado === 'enviando' && <Cargando mensaje="Enviando el comando a la ONT..." />}
        {refresco?.estado === 'error' && (
          <Alerta tono="error">Error al enviar el comando: {refresco.texto}</Alerta>
        )}
        {refresco?.estado === 'ok' && (
          <>
            <Alerta tono="exito">Comando enviado exitosamente</Alerta>
            <RegistrarCanalAtencion
              registrar={(canal) =>
                registrarEventoRefrescamiento({
                  canal,
                  cuenta,
                  servicio,
                  registroCrm: registro,
                  documento,
                  usuario,
                })
              }
            />
          </>
        )}

        <p className="text-sm font-bold text-gray-700">¿Se resolvió la falla?</p>
        <div className="flex gap-2">
          <Boton
            variante="secundario"
            icono={XCircle}
            onClick={() => {
              setResultadoPanel('falla');
              terminar({ tono: 'error', texto: textos.visita, crearTicket: true });
            }}
          >
            {textos.noResuelto}
          </Boton>
          <Boton
            icono={CheckCircle2}
            onClick={() => {
              setResultadoPanel('ok');
              terminar({ tono: 'exito', texto: MENSAJES.enConexion, crearTicket: false });
            }}
          >
            {textos.resuelto}
          </Boton>
        </div>
      </div>
    );
  } else if (final) {
    contenido = (
      <div className="flex flex-col gap-3">
        <Alerta tono={final.tono}>
          <strong>{final.texto}</strong>
        </Alerta>
        <div className="flex gap-2">
          <Boton variante="secundario" onClick={onCerrar}>
            Cerrar
          </Boton>
          {final.crearTicket && (
            <Boton icono={Ticket} onClick={onCrearTicket}>
              Crear Ticket
            </Boton>
          )}
        </div>
      </div>
    );
  }

  return (
    <Modal
      abierto
      titulo="Troubleshooting"
      subtitulo={
        <span className="flex flex-wrap items-center gap-1.5 text-xs">
          <PuntoEstado activo={cuenta.descStatusCuenta === 'Conectado'} />
          Cuenta {cuenta.cuenta}
          <span className="opacity-40">/</span>
          <PuntoEstado activo={servicio.status === 'Conectado'} />
          {servicio.nombreServicio}
          <span className="opacity-40">/</span>
          Troubleshooting
        </span>
      }
      onCerrar={onCerrar}
      ancho="max-w-4xl"
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[14rem_1fr]">
        <aside className="rounded-xl border border-gray-200 bg-gray-50 p-3" aria-label="Verificaciones">
          <h4 className="mb-1 text-xs font-bold tracking-wide text-gray-500 uppercase">Verificaciones</h4>
          <ul>
            {verificaciones.map((v) => (
              <Verificacion key={v.etiqueta} etiqueta={v.etiqueta} estado={v.estado} />
            ))}
          </ul>
          {d && d.avisos.length > 0 && (
            <p className="mt-2 flex gap-1.5 text-[11px] text-amber-700">
              <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              {d.avisos.join(' ')}
            </p>
          )}
        </aside>
        <div className="min-w-0">{contenido}</div>
      </div>
    </Modal>
  );
}
