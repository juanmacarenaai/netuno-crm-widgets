import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  ExternalLink,
  Eye,
  HelpCircle,
  Lock,
  RotateCcw,
  Send,
  TriangleAlert,
} from 'lucide-react';
import { entorno } from '@/core/config';
import { mensajeDeError } from '@/core/http/errores';
import { numeroContrato, SIN_DATOS, type Contrato, type Cuenta } from '@/shared/cuentas';
import { hoyIso } from '@/shared/lib/fechas';
import { useZoho } from '@/shared/zoho/contexto';
import {
  Alerta,
  Boton,
  CampoFormulario,
  Cargando,
  CLASE_CONTROL,
  CLASE_LECTURA,
  cn,
  Modal,
  Pasos,
  PuntoEstado,
  SeccionFormulario,
  TarjetaSeleccionable,
  useAvisos,
} from '@/ui';
import { RegistrarCanalAtencion } from '@/shared/canal-atencion';
import { ContratoModal } from '../contrato/ContratoModal';
import {
  alternarBaja,
  camposBaja,
  contratosParaBaja,
  decidirBaja,
  departamentoTicket,
  elegibilidadBaja,
  equipoSinRetencion,
  esEmpresa,
  etiquetaContratoBaja,
  formularioInicial,
  internetConDependencias,
  MENSAJES_BAJA,
  seleccionVacia,
  serviciosBaja,
  textoResultadoBaja,
  validarBaja,
  type CampoBaja,
  type DecisionBaja,
  type EscenarioBaja,
  type FormularioBaja,
  type SeleccionBaja,
} from './lib/bajaVoluntaria';
import {
  buscarTicketAbierto,
  consultarPaquetizados,
  crearTicketBaja,
  darDeBaja,
  motivosDeBaja,
  registrarEventoBaja,
  type TicketAbierto,
} from './servicio';

type Paso = 'elegir' | 'formulario' | 'resultado';
const PASOS = ['Servicios', 'Datos de la gestión', 'Resultado'] as const;
const INDICE_PASO: Record<Paso, number> = { elegir: 0, formulario: 1, resultado: 2 };

type Dialogo =
  | { tipo: 'ticket'; ticket: TicketAbierto }
  | { tipo: 'retencion' }
  | { tipo: 'devolucion'; serial: string }
  | { tipo: 'noCumple' }
  | { tipo: 'confirmarBaja'; decision: DecisionBaja };

type Resultado =
  | { ok: true; texto: string; numero: string; url?: string; bajaRealizada: boolean }
  | { ok: false; mensaje: string; bajaRealizada: boolean };

function Pregunta({ icono, children }: { icono: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
        {icono}
      </span>
      <div className="text-sm text-gray-700">{children}</div>
    </div>
  );
}

/**
 * Baja voluntaria (pestaña de Administrar cuenta): servicios a desconectar con sus dependencias, retención,
 * devolución del equipo, ticket en Zoho Desk y, cuando corresponde, desconexión inmediata en Netuno.
 */
export function BajaVoluntaria({ cuenta, onCompletado }: { cuenta: Cuenta; onCompletado?: () => void }) {
  const { usuario, registro, documento } = useZoho();
  const { avisar } = useAvisos();
  const elegibilidad = useMemo(() => elegibilidadBaja(cuenta, registro), [cuenta, registro]);
  const conectados = useMemo(() => (elegibilidad.ok ? elegibilidad.conectados : []), [elegibilidad]);
  const conDependencias = internetConDependencias(registro);
  const empresa = esEmpresa(cuenta);
  const hoy = hoyIso();

  const paquetizados = useQuery({
    queryKey: ['baja-voluntaria', 'paquetizados', String(cuenta.cuenta), conectados.map((c) => c.idProducto)],
    queryFn: () => consultarPaquetizados(cuenta.cuenta, conectados),
    enabled: conectados.length > 0,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const servicios = useMemo(
    () => (paquetizados.data ? serviciosBaja(conectados, paquetizados.data) : []),
    [conectados, paquetizados.data],
  );

  const [paso, setPaso] = useState<Paso>('elegir');
  const [seleccion, setSeleccion] = useState<SeleccionBaja | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [escenario, setEscenario] = useState<EscenarioBaja | null>(null);
  const [formulario, setFormulario] = useState<FormularioBaja | null>(null);
  const [errores, setErrores] = useState<Partial<Record<CampoBaja, string>>>({});
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [verContrato, setVerContrato] = useState<Contrato | null>(null);

  const sel = seleccion ?? seleccionVacia(servicios.length);
  const elegidos = servicios.filter((_, i) => sel.marcados[i]);
  const contratosElegidos = elegidos.map((s) => s.contrato);
  const departamento = escenario ? departamentoTicket(cuenta, escenario, entorno.desk.departamentos) : null;

  const motivos = useQuery({
    queryKey: ['baja-voluntaria', 'motivos', departamento?.id],
    queryFn: () => motivosDeBaja(departamento?.id ?? ''),
    enabled: paso === 'formulario' && Boolean(departamento?.id),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const irAlFormulario = (e: EscenarioBaja) => {
    setEscenario(e);
    setFormulario(formularioInicial(e, hoy));
    setErrores({});
    setDialogo(null);
    setPaso('formulario');
  };

  const continuar = async () => {
    setAviso(null);
    if (elegidos.length === 0) {
      setAviso(MENSAJES_BAJA.sinSeleccion);
      return;
    }
    setVerificando(true);
    try {
      const ticket = await buscarTicketAbierto(cuenta, registro);
      setDialogo(ticket ? { tipo: 'ticket', ticket } : { tipo: 'retencion' });
    } catch (error) {
      console.error('Error al buscar tickets de baja en Desk:', error);
      setAviso(
        `No se pudo verificar si el cliente tiene un ticket abierto en Zoho Desk: ${mensajeDeError(error)}`,
      );
    } finally {
      setVerificando(false);
    }
  };

  const sinRetencion = () => {
    const equipo = equipoSinRetencion(cuenta, contratosElegidos);
    if (equipo.pregunta) setDialogo({ tipo: 'devolucion', serial: equipo.serial });
    else irAlFormulario({ retencion: false, equipo: equipo.equipo });
  };

  const ejecutar = async (decision: DecisionBaja) => {
    if (!escenario || !formulario || !departamento?.id) return;
    setDialogo(null);
    setEnviando(true);
    let bajaRealizada = false;
    let r: Resultado;
    try {
      if (decision.bajaInmediata) {
        await darDeBaja(contratosParaBaja(contratosElegidos, cuenta.cuenta));
        bajaRealizada = true;
      }
      const ticket = await crearTicketBaja({
        cuenta,
        registro,
        elegidos: contratosElegidos,
        escenario,
        formulario,
        decision,
        departamentoId: departamento.id,
        hoy,
        emailUsuario: usuario.email,
      });
      r = {
        ok: true,
        texto: textoResultadoBaja(escenario.retencion, decision.aprobacion),
        numero: ticket.numero,
        url: ticket.url,
        bajaRealizada,
      };
    } catch (error) {
      console.error('Error en la baja voluntaria:', error);
      const motivo = mensajeDeError(error);
      r = {
        ok: false,
        bajaRealizada,
        mensaje: bajaRealizada
          ? `Los servicios se desconectaron, pero no se creó el ticket en Zoho Desk: ${motivo}`
          : `Se generó un error en la gestión: ${motivo}`,
      };
    }
    setEnviando(false);
    setResultado(r);
    setPaso('resultado');
    if (r.ok) {
      avisar({ tipo: 'exito', titulo: 'Baja voluntaria registrada', texto: `Ticket #${r.numero}` });
      if (!r.bajaRealizada) onCompletado?.();
    } else {
      avisar({ tipo: 'error', titulo: 'No se completó la baja voluntaria', texto: r.mensaje });
    }
  };

  const registrar = () => {
    if (!escenario || !formulario) return;
    const encontrados = validarBaja(escenario, formulario, hoy);
    setErrores(encontrados);
    if (Object.values(encontrados).some(Boolean)) return;
    if (!departamento?.id) {
      setAviso(
        `Falta el ID del departamento "${departamento?.nombre ?? ''}" de Zoho Desk para el entorno ${entorno.etiqueta} (src/core/config/entornos.ts).`,
      );
      return;
    }
    const decision = decidirBaja({
      empresa,
      escenario,
      contieneAprobacion: elegidos.some((s) => s.aprobacion),
      incluyeInternet: contratosElegidos.some((c) => c.nombreServicio === 'Internet'),
      fecha: camposBaja(escenario).fecha ? formulario.fecha : null,
      hoy,
    });
    if (decision.bajaInmediata) setDialogo({ tipo: 'confirmarBaja', decision });
    else void ejecutar(decision);
  };

  const reiniciar = () => {
    setPaso('elegir');
    setSeleccion(null);
    setAviso(null);
    setDialogo(null);
    setEscenario(null);
    setFormulario(null);
    setErrores({});
    setResultado(null);
    void paquetizados.refetch();
  };

  const cambiar = (campo: CampoBaja, valor: string) => {
    setFormulario((f) => (f ? { ...f, [campo]: valor } : f));
    setErrores((x) => ({ ...x, [campo]: undefined }));
  };

  if (!elegibilidad.ok) {
    return (
      <Alerta tono="aviso">
        <strong>No es posible gestionar la baja voluntaria.</strong>
        <br />
        {elegibilidad.mensaje}
      </Alerta>
    );
  }

  const pasos = <Pasos pasos={PASOS} actual={INDICE_PASO[paso]} />;
  let contenido: ReactNode;

  if (paso === 'elegir') {
    contenido = (
      <>
        {paquetizados.isPending && <Cargando mensaje="Consultando los servicios de la cuenta..." />}
        {paquetizados.isError && (
          <Alerta tono="error">
            No se pudo consultar si los contratos están paquetizados. {paquetizados.error.message}{' '}
            <button
              type="button"
              className="font-bold text-accion underline"
              onClick={() => void paquetizados.refetch()}
            >
              Reintentar
            </button>
          </Alerta>
        )}
        {servicios.length > 0 && (
          <>
            <p className="text-sm font-bold text-gray-700">Elige los servicios a dar de baja:</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {servicios.map((s, i) => (
                <div key={s.contrato.idProducto} className="relative grid">
                  <TarjetaSeleccionable
                    titulo={s.titulo || s.servicio}
                    marcada={Boolean(sel.marcados[i])}
                    atenuada={Boolean(sel.bloqueados[i])}
                    onClick={() => {
                      setAviso(null);
                      setSeleccion(
                        alternarBaja(servicios, sel, i, { internetConDependencias: conDependencias }),
                      );
                    }}
                    insignia={
                      <span className="flex flex-wrap gap-1">
                        <span className="w-fit rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 uppercase">
                          {s.servicio}
                        </span>
                        {s.aprobacion && (
                          <span className="w-fit rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase">
                            Paquetizado
                          </span>
                        )}
                        {sel.bloqueados[i] && (
                          <span className="inline-flex w-fit items-center gap-1 rounded bg-netuno-500/10 px-1.5 py-0.5 text-[10px] font-bold text-netuno-800 uppercase">
                            <Lock aria-hidden="true" className="h-3 w-3" /> Incluido
                          </span>
                        )}
                      </span>
                    }
                  >
                    {s.detalle && <span className="truncate pr-8 text-gray-700">{s.detalle}</span>}
                    <span className="pr-8 text-xs text-gray-500">{s.contrato.codContrato ?? '—'}</span>
                  </TarjetaSeleccionable>
                  <button
                    type="button"
                    onClick={() => setVerContrato(s.contrato)}
                    className="absolute right-2 bottom-2 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-accion"
                    title="Ver contrato"
                    aria-label={`Ver contrato ${s.contrato.codContrato ?? s.contrato.idProducto}`}
                  >
                    <Eye aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        {aviso && <Alerta tono="aviso">{aviso}</Alerta>}
        <div className="flex justify-end">
          <Boton
            icono={ArrowRight}
            cargando={verificando}
            disabled={servicios.length === 0}
            onClick={() => void continuar()}
          >
            {verificando ? 'Verificando tickets...' : 'Continuar'}
          </Boton>
        </div>
      </>
    );
  } else if (paso === 'formulario' && escenario && formulario) {
    const campos = camposBaja(escenario);
    const primero = contratosElegidos[0];
    contenido = (
      <>
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
          <PuntoEstado activo={cuenta.descStatusCuenta === 'Conectado'} />
          <span>Cuenta {cuenta.cuenta}</span>
          <span className="text-gray-300">/</span>
          <PuntoEstado activo={primero?.status === 'Conectado'} />
          <span>
            {numeroContrato(primero?.idProducto) === SIN_DATOS
              ? (primero?.codContrato ?? primero?.idProducto)
              : numeroContrato(primero?.idProducto)}
          </span>
          <span className="text-gray-300">/</span>
          <span className="font-bold">Desconexión voluntaria</span>
        </p>

        <SeccionFormulario
          titulo={escenario.retencion ? 'Información de Retención' : 'Información de la baja'}
          icono={ClipboardList}
          insignia={escenario.retencion ? 'Retención' : 'Sin retención'}
        >
          <CampoFormulario etiqueta="Departamento" lectura>
            <div className={CLASE_LECTURA}>{departamento?.nombre}</div>
          </CampoFormulario>
          <CampoFormulario etiqueta="Contratos" lectura>
            <div className={cn(CLASE_LECTURA, 'flex flex-wrap gap-1')}>
              {contratosElegidos.map((c) => (
                <span
                  key={c.idProducto}
                  className="rounded bg-white px-1.5 py-0.5 text-xs ring-1 ring-gray-200"
                >
                  {etiquetaContratoBaja(c)}
                </span>
              ))}
            </div>
          </CampoFormulario>

          <CampoFormulario
            etiqueta={escenario.retencion ? 'Intención de desconexión' : 'Motivo de baja'}
            htmlFor="bv_motivo"
            requerido
            error={errores.motivo}
          >
            <select
              id="bv_motivo"
              className={cn(CLASE_CONTROL, errores.motivo && 'border-red-400')}
              value={formulario.motivo}
              disabled={enviando || motivos.isPending}
              onChange={(e) => cambiar('motivo', e.target.value)}
            >
              <option value="">{motivos.isPending ? 'Cargando...' : 'Seleccione'}</option>
              {(motivos.data ?? []).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            {motivos.isError && (
              <span className="text-xs text-red-600">
                No se cargaron los motivos de Zoho Desk: {motivos.error.message}
              </span>
            )}
            {motivos.data?.length === 0 && (
              <span className="text-xs text-amber-700">
                El diseño de tickets del departamento no tiene subcategorías para "Desconexión voluntaria".
              </span>
            )}
          </CampoFormulario>

          {campos.estrategia && (
            <CampoFormulario
              etiqueta="Estrategia de retención aplicada"
              htmlFor="bv_estrategia"
              requerido
              error={errores.estrategia}
            >
              <textarea
                id="bv_estrategia"
                rows={3}
                className={cn(CLASE_CONTROL, errores.estrategia && 'border-red-400')}
                value={formulario.estrategia}
                disabled={enviando}
                onChange={(e) => cambiar('estrategia', e.target.value)}
              />
            </CampoFormulario>
          )}
          {campos.serial && (
            <CampoFormulario
              etiqueta="Serial del equipo"
              htmlFor="bv_serial"
              requerido
              error={errores.serial}
            >
              <input
                id="bv_serial"
                className={cn(CLASE_CONTROL, 'font-mono', errores.serial && 'border-red-400')}
                value={formulario.serial}
                disabled={enviando}
                onChange={(e) => cambiar('serial', e.target.value)}
              />
            </CampoFormulario>
          )}
          {campos.fecha && (
            <CampoFormulario
              etiqueta="Fecha de desconexión"
              htmlFor="bv_fecha"
              requerido
              error={errores.fecha}
              ayuda="Hoy: se desconecta de inmediato. Una fecha futura programa la desconexión."
            >
              <input
                id="bv_fecha"
                type="date"
                min={hoy}
                className={cn(CLASE_CONTROL, errores.fecha && 'border-red-400')}
                value={formulario.fecha}
                disabled={enviando}
                onChange={(e) => cambiar('fecha', e.target.value)}
              />
            </CampoFormulario>
          )}
          {campos.comentarios && (
            <CampoFormulario etiqueta="Comentarios" htmlFor="bv_comentarios" completo>
              <textarea
                id="bv_comentarios"
                rows={3}
                className={CLASE_CONTROL}
                value={formulario.comentarios}
                disabled={enviando}
                onChange={(e) => cambiar('comentarios', e.target.value)}
              />
            </CampoFormulario>
          )}
        </SeccionFormulario>

        {aviso && <Alerta tono="error">{aviso}</Alerta>}
        <div className="flex justify-between gap-2">
          <Boton variante="secundario" icono={ArrowLeft} onClick={reiniciar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton icono={Send} cargando={enviando} onClick={registrar}>
            {enviando ? 'Registrando...' : 'Registrar'}
          </Boton>
        </div>
      </>
    );
  } else {
    const r = resultado;
    contenido = (
      <>
        {r?.ok && (
          <Alerta tono="exito">
            <strong>{r.texto}</strong>
            <br />
            Ticket: #{r.numero}{' '}
            {r.url && (
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-bold text-accion underline"
              >
                Ver ticket <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            )}
          </Alerta>
        )}
        {r && !r.ok && <Alerta tono="error">{r.mensaje}</Alerta>}
        {r?.bajaRealizada && (
          <RegistrarCanalAtencion
            registrar={(canal) =>
              registrarEventoBaja({
                canal,
                cuenta,
                elegidos: contratosElegidos,
                registroCrm: registro,
                documento,
                usuario,
              })
            }
            onTerminar={() => onCompletado?.()}
          />
        )}
        <div className="flex justify-end">
          <Boton variante="secundario" icono={RotateCcw} onClick={reiniciar}>
            Nueva baja voluntaria
          </Boton>
        </div>
      </>
    );
  }

  const d = dialogo;
  const cerrar = () => setDialogo(null);
  return (
    <div className="flex flex-col gap-4">
      {pasos}
      {contenido}

      <Modal
        abierto={d?.tipo === 'ticket'}
        titulo="Ticket abierto"
        onCerrar={cerrar}
        ancho="max-w-md"
        pie={
          <>
            <Boton variante="secundario" onClick={cerrar}>
              Cerrar
            </Boton>
            {d?.tipo === 'ticket' && d.ticket.url && (
              <Boton icono={ExternalLink} onClick={() => window.open(d.ticket.url, '_blank', 'noopener')}>
                #{d.ticket.numero}
              </Boton>
            )}
          </>
        }
      >
        <Pregunta icono={<TriangleAlert aria-hidden="true" className="h-6 w-6" />}>
          <strong className="block text-gray-900">{MENSAJES_BAJA.ticketAbierto}</strong>
          {d?.tipo === 'ticket' && `Ticket #${d.ticket.numero}.`}
        </Pregunta>
      </Modal>

      <Modal
        abierto={d?.tipo === 'retencion'}
        titulo="Retención"
        onCerrar={cerrar}
        ancho="max-w-md"
        pie={
          <>
            <Boton variante="secundario" onClick={sinRetencion}>
              No
            </Boton>
            <Boton onClick={() => irAlFormulario({ retencion: true, equipo: 'No aplica' })}>Sí</Boton>
          </>
        }
      >
        <Pregunta icono={<HelpCircle aria-hidden="true" className="h-6 w-6" />}>
          <strong className="block text-base text-gray-900">{MENSAJES_BAJA.retencion}</strong>
        </Pregunta>
      </Modal>

      <Modal
        abierto={d?.tipo === 'devolucion'}
        titulo="Recepción del equipo"
        onCerrar={cerrar}
        ancho="max-w-md"
        pie={
          <>
            <Boton variante="secundario" onClick={() => setDialogo({ tipo: 'noCumple' })}>
              No
            </Boton>
            <Boton
              onClick={() =>
                irAlFormulario({
                  retencion: false,
                  equipo: 'Sin equipo propio',
                  serial: d?.tipo === 'devolucion' ? d.serial : '',
                })
              }
            >
              Sí
            </Boton>
          </>
        }
      >
        <Pregunta icono={<HelpCircle aria-hidden="true" className="h-6 w-6" />}>
          <strong className="block text-base text-gray-900">{MENSAJES_BAJA.devolucion}</strong>
          El equipo de Internet es alquilado.
        </Pregunta>
      </Modal>

      <Modal
        abierto={d?.tipo === 'noCumple'}
        titulo="Baja voluntaria"
        onCerrar={cerrar}
        ancho="max-w-md"
        pie={<Boton onClick={cerrar}>Continuar</Boton>}
      >
        <Pregunta icono={<TriangleAlert aria-hidden="true" className="h-6 w-6" />}>
          <strong className="block text-gray-900">{MENSAJES_BAJA.noCumple}</strong>
          El cliente debe devolver el equipo alquilado.
        </Pregunta>
      </Modal>

      <Modal
        abierto={d?.tipo === 'confirmarBaja'}
        titulo="Desconexión de servicios"
        onCerrar={cerrar}
        ancho="max-w-md"
        pie={
          <>
            <Boton variante="secundario" onClick={cerrar}>
              Cancelar
            </Boton>
            <Boton onClick={() => d?.tipo === 'confirmarBaja' && void ejecutar(d.decision)}>Continuar</Boton>
          </>
        }
      >
        <Pregunta icono={<TriangleAlert aria-hidden="true" className="h-6 w-6" />}>
          <strong className="block text-gray-900">{MENSAJES_BAJA.inmediata}</strong>
          {contratosElegidos.map(etiquetaContratoBaja).join(' · ')}
        </Pregunta>
      </Modal>

      {verContrato && (
        <ContratoModal
          key={verContrato.idProducto}
          cuenta={cuenta}
          servicio={verContrato}
          documento={documento}
          onCerrar={() => setVerContrato(null)}
        />
      )}
    </div>
  );
}
