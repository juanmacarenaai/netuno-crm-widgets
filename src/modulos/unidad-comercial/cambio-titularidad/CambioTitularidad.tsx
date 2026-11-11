import { useEffect, useMemo, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { mensajeDeError } from '@/core/http/errores';
import type { Cuenta } from '@/shared/cuentas';
import { useZoho } from '@/shared/zoho/contexto';
import { Alerta, useAvisos } from '@/ui';
import { DatosNuevoTitular, type Verificacion } from './componentes/DatosNuevoTitular';
import { DocumentosRequeridos, VistaPrevia } from './componentes/DocumentosYVistaPrevia';
import type { DatosTitular } from './componentes/Piezas';
import { RegistroSolicitud, type EstadoSaldo } from './componentes/RegistroSolicitud';
import {
  Seguimiento,
  type ControlesDemostracion,
  type EventoSolicitud,
  type SolicitudEnCurso,
  type TipoEvento,
} from './componentes/Seguimiento';
import { ServiciosTransferidos } from './componentes/ServiciosTransferidos';
import {
  accionesPrevistas,
  beneficiarioVacio,
  beneficiariosCompletos,
  CANALES_ORIGEN,
  contratosTransferibles,
  DOCUMENTOS_REQUERIDOS,
  faltantesNuevoTitular,
  inicioFacturacion,
  MAX_BENEFICIARIOS,
  motivoInicial,
  nombreNuevoTitular,
  nuevoTitularVacio,
  pasosEjecucion,
  serviciosOpcionales,
  unidadDeCuenta,
  type Beneficiario,
  type NuevoTitular,
} from './lib/cambioTitularidad';
import {
  enviarSolicitud,
  leerDocumentoOcr,
  resultadoDemostracion,
  SERVICIOS_SIMULADOS,
  subirDocumento,
  validarCorreoNetunoGo,
  validarDocumentoNuevo,
  verificarSaldo,
} from './servicio';

const ahora = () => new Date().toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });

function nuevoEvento(tipo: TipoEvento, titulo: string, detalle: string, archivo?: string): EventoSolicitud {
  return { id: `${tipo}-${Date.now()}-${Math.random()}`, fecha: ahora(), tipo, titulo, detalle, archivo };
}

/**
 * Cambio de titularidad (pestaña de Administrar cuenta), según el diseño de la PM: registro de la solicitud,
 * datos del nuevo titular, servicios transferidos, documentos, vista previa y seguimiento (aprobación, Zoho Sign
 * y ejecución en BOSS). Los servicios aún no están conectados: ver ./servicio.ts y docs/cambio-titularidad.md.
 */
// onCompletado (refrescar las cuentas) se usará cuando la ejecución en BOSS sea real: la demostración no cambia nada
export function CambioTitularidad({ cuenta }: { cuenta: Cuenta; onCompletado?: () => void }) {
  const { registro, documento, usuario } = useZoho();
  const { avisar } = useAvisos();
  const unidad = unidadDeCuenta(cuenta);
  const contratos = useMemo(() => contratosTransferibles(cuenta), [cuenta]);
  const opcionales = useMemo(() => serviciosOpcionales(cuenta), [cuenta]);
  const documentosRequeridos = DOCUMENTOS_REQUERIDOS[unidad];
  const facturacion = inicioFacturacion();
  const nombreAnterior = String(registro.Account_Name ?? registro.Nombres ?? 'Titular actual');
  const correoAnterior = String(registro.Email ?? registro.email ?? '');
  const documentoAnterior = registro.cf_documento_de_identidad
    ? `${String(registro.cf_tipo_documento ?? '')} ${String(registro.cf_documento_de_identidad)}`.trim()
    : (documento ?? '');

  // Registro de la solicitud
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [motivo, setMotivo] = useState(motivoInicial(unidad));
  const [canal, setCanal] = useState<string>(CANALES_ORIGEN[0]);
  const [observaciones, setObservaciones] = useState('');
  const [saldo, setSaldo] = useState<EstadoSaldo>({ estado: 'sin-verificar' });
  // Nuevo titular
  const [titular, setTitular] = useState<NuevoTitular>(() => nuevoTitularVacio(unidad));
  const [ocr, setOcr] = useState<Verificacion>('inicial');
  const [validacionDocumento, setValidacionDocumento] = useState<Verificacion>('inicial');
  // Servicios opcionales
  const [conNetunoGo, setConNetunoGo] = useState(Boolean(opcionales.streaming));
  const [correoNetunoGo, setCorreoNetunoGo] = useState('');
  const [validacionCorreo, setValidacionCorreo] = useState<Verificacion>('inicial');
  const [conSalud, setConSalud] = useState(Boolean(opcionales.salud));
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);
  // Documentos y envío
  const [archivos, setArchivos] = useState<Record<string, string>>({});
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [solicitud, setSolicitud] = useState<SolicitudEnCurso | null>(null);

  const elegidos = contratos.filter((c) => seleccion.includes(c.idProducto));
  const nombreNuevo = nombreNuevoTitular(titular, unidad);
  const faltantes = faltantesNuevoTitular(titular, unidad);

  const registroListo = seleccion.length > 0 && saldo.estado === 'apto';
  const titularListo = registroListo && validacionDocumento === 'ok' && faltantes.length === 0;
  const netunoGoListo = !opcionales.streaming || !conNetunoGo || validacionCorreo === 'ok';
  const saludListo = !opcionales.salud || !conSalud || beneficiariosCompletos(beneficiarios);
  const serviciosListos = titularListo && netunoGoListo && saludListo;
  const documentosListos = serviciosListos && documentosRequeridos.every((d) => archivos[d.id]);

  // ── Registro ──────────────────────────────────────────────────────────────────────────────────
  const alternarContrato = (idProducto: string) => {
    const nueva = seleccion.includes(idProducto)
      ? seleccion.filter((id) => id !== idProducto)
      : [...seleccion, idProducto];
    setSeleccion(nueva);
    if (nueva.length === 0) {
      setSaldo({ estado: 'sin-verificar' });
    } else if (saldo.estado === 'sin-verificar') {
      setSaldo({ estado: 'verificando' });
      verificarSaldo(cuenta)
        .then(setSaldo)
        .catch((error: unknown) => {
          setSaldo({ estado: 'sin-verificar' });
          avisar({ tipo: 'error', titulo: 'No se pudo verificar el saldo', texto: mensajeDeError(error) });
        });
    }
  };

  // ── Nuevo titular ─────────────────────────────────────────────────────────────────────────────
  const cambiarTitular = (cambios: Partial<NuevoTitular>) => {
    setTitular((t) => ({ ...t, ...cambios }));
    if ('documento' in cambios || 'tipoDocumento' in cambios) setValidacionDocumento('inicial');
  };

  const escanear = (archivo: File) => {
    setOcr('verificando');
    leerDocumentoOcr(unidad, archivo)
      .then((datos) => {
        cambiarTitular(datos);
        setOcr('ok');
      })
      .catch(() => setOcr('error'));
  };

  const validarDocumento = () => {
    setValidacionDocumento('verificando');
    validarDocumentoNuevo(titular.documento, documento)
      .then((ok) => setValidacionDocumento(ok ? 'ok' : 'rechazado'))
      .catch(() => setValidacionDocumento('error'));
  };

  // ── Servicios opcionales ──────────────────────────────────────────────────────────────────────
  const validarCorreo = () => {
    setValidacionCorreo('verificando');
    validarCorreoNetunoGo(
      correoNetunoGo,
      [opcionales.streaming?.serial ?? null, correoAnterior].filter(Boolean) as string[],
    )
      .then((ok) => setValidacionCorreo(ok ? 'ok' : 'rechazado'))
      .catch(() => setValidacionCorreo('error'));
  };

  const agregarBeneficiario = () =>
    setBeneficiarios((lista) =>
      lista.length >= MAX_BENEFICIARIOS ? lista : [...lista, beneficiarioVacio(`b-${Date.now()}`)],
    );
  const cambiarBeneficiario = (id: string, cambios: Partial<Beneficiario>) =>
    setBeneficiarios((lista) => lista.map((b) => (b.id === id ? { ...b, ...cambios } : b)));
  const quitarBeneficiario = (id: string) => setBeneficiarios((lista) => lista.filter((b) => b.id !== id));

  // ── Documentos ────────────────────────────────────────────────────────────────────────────────
  const subir = (id: string, archivo: File) => {
    setSubiendo(id);
    subirDocumento(id, archivo)
      .then(({ nombre }) => setArchivos((a) => ({ ...a, [id]: nombre })))
      .catch((error: unknown) =>
        avisar({ tipo: 'error', titulo: 'No se pudo subir el documento', texto: mensajeDeError(error) }),
      )
      .finally(() => setSubiendo(null));
  };
  const quitar = (id: string) =>
    setArchivos((a) => {
      const { [id]: _quitado, ...resto } = a;
      return resto;
    });

  // ── Tarjetas de titulares ─────────────────────────────────────────────────────────────────────
  const estado = solicitud?.estado;
  const anterior: DatosTitular = {
    nombre: nombreAnterior,
    documento: documentoAnterior,
    detalle: [
      registro.Nro_de_Cliente ? `Cliente ${String(registro.Nro_de_Cliente)}` : '',
      `Cuenta ${cuenta.cuenta}`,
    ]
      .filter(Boolean)
      .join(' · '),
    estado:
      estado === 'completada' ? 'Desconectado por cambio de titularidad' : (cuenta.descStatusCuenta ?? '—'),
    tono: estado === 'completada' ? 'desconectado' : 'conectado',
  };
  const nuevo: DatosTitular = {
    nombre: nombreNuevo,
    documento: titular.documento ? `${titular.tipoDocumento} ${titular.documento}` : '',
    detalle: solicitud?.resultado ? `Cliente ${solicitud.resultado.nuevoCliente}` : undefined,
    estado:
      estado === 'completada' && solicitud?.resultado
        ? `Conectado · Cuenta ${solicitud.resultado.cuentaBoss}`
        : 'Pendiente de activación',
    tono: estado === 'completada' ? 'conectado' : 'pendiente',
  };

  // ── Envío y seguimiento ───────────────────────────────────────────────────────────────────────
  const serviciosDelContrato = () => [
    ...elegidos.map((c) => `${c.plan} · ${c.direccion}${c.serial ? ` · ONT ${c.serial}` : ''}`),
    ...(opcionales.streaming && conNetunoGo ? [`Streaming NetunoGo · usuario ${correoNetunoGo}`] : []),
    ...(opcionales.salud && conSalud ? [`Salud · titular + ${beneficiarios.length} beneficiario(s)`] : []),
  ];

  const enviar = async () => {
    setEnviando(true);
    setErrorEnvio(null);
    try {
      const { numero } = await enviarSolicitud({
        cuenta: String(cuenta.cuenta),
        unidad,
        contratos: seleccion,
        motivo,
        canal,
        observaciones,
        nuevoTitular: titular,
        netunoGo: opcionales.streaming && conNetunoGo ? { correo: correoNetunoGo } : null,
        salud: opcionales.salud && conSalud ? { beneficiarios } : null,
        documentos: archivos,
        agente: usuario.email,
      });
      const codigos = elegidos.map((c) => c.codigo);
      setSolicitud({
        numero,
        estado: 'validacion',
        unidad,
        contratos: codigos,
        motivo,
        canal,
        documentos: documentosRequeridos.length,
        correoFirma: titular.correo,
        servicios: serviciosDelContrato(),
        facturacion,
        pasoEjecucion: 0,
        errorBoss: false,
        motivoRechazo: null,
        resultado: null,
        eventos: [
          nuevoEvento(
            'enviada',
            `Solicitud de Cambio de Titularidad registrada · ${numero}`,
            `Contrato(s) ${codigos.join(', ')} · Nuevo titular: ${nombreNuevo} (${titular.documento}). Motivo: ${motivo}. Enviada a aprobación.`,
          ),
        ],
      });
      avisar({ tipo: 'exito', titulo: 'Solicitud enviada a aprobación', texto: numero });
    } catch (error) {
      setErrorEnvio(`No se pudo enviar la solicitud: ${mensajeDeError(error)}`);
    } finally {
      setEnviando(false);
    }
  };

  const actualizar = (cambios: Partial<SolicitudEnCurso>, evento?: EventoSolicitud) =>
    setSolicitud((s) => (s ? { ...s, ...cambios, eventos: evento ? [evento, ...s.eventos] : s.eventos } : s));

  // Demostración: la validación pasa a aprobación y la ejecución en BOSS avanza sola
  useEffect(() => {
    if (!SERVICIOS_SIMULADOS || !solicitud) return undefined;
    const { estado: e, numero, errorBoss, pasoEjecucion } = solicitud;
    if (e === 'validacion') {
      const t = setTimeout(() => actualizar({ estado: 'aprobacion' }), 1500);
      return () => clearTimeout(t);
    }
    if (e === 'ejecucion' && !errorBoss) {
      const total = pasosEjecucion(unidad).length;
      if (pasoEjecucion < total) {
        const t = setTimeout(() => actualizar({ pasoEjecucion: pasoEjecucion + 1 }), 900);
        return () => clearTimeout(t);
      }
      const resultado = resultadoDemostracion();
      const t = setTimeout(() => {
        actualizar(
          { estado: 'completada', resultado },
          nuevoEvento(
            'completada',
            `Cambio de titularidad aplicado en BOSS · ${numero}`,
            `Nuevo cliente ${resultado.nuevoCliente} · Cuenta ${resultado.cuentaBoss}. ${nombreAnterior} queda Desconectado por cambio de titularidad (no cuenta como baja). Facturación del nuevo titular desde ${facturacion}.`,
          ),
        );
      }, 600);
      return () => clearTimeout(t);
    }
    return undefined;
    // actualizar no cambia el resultado del efecto
    // oxlint-disable-next-line react/exhaustive-deps
  }, [solicitud?.estado, solicitud?.pasoEjecucion, solicitud?.errorBoss]);

  const rechazar = (motivoRechazo: string) =>
    actualizar(
      { estado: 'rechazada', motivoRechazo },
      nuevoEvento(
        'rechazada',
        `Cambio de titularidad rechazado · ${solicitud?.numero}`,
        `Motivo: ${motivoRechazo}.`,
      ),
    );

  const demostracion: ControlesDemostracion | null = SERVICIOS_SIMULADOS
    ? {
        aprobar: () =>
          actualizar(
            { estado: 'firma' },
            nuevoEvento(
              'aprobada',
              `Cambio de titularidad aprobado por Supervisor · ${solicitud?.numero}`,
              `Contrato del nuevo titular enviado por Zoho Sign a ${titular.correo}. Sin costo de instalación.`,
              `Contrato_${solicitud?.numero}_NuevoTitular.pdf`,
            ),
          ),
        rechazar: () => rechazar('Documentación inválida o incompleta'),
        firmar: () =>
          actualizar(
            { estado: 'ejecucion', pasoEjecucion: 0, errorBoss: false },
            nuevoEvento(
              'firma',
              `Contrato firmado en Zoho Sign · ${solicitud?.numero}`,
              `Firmado por ${nombreNuevo} desde ${titular.correo}.`,
              `Contrato_${solicitud?.numero}_Firmado.pdf`,
            ),
          ),
        vencerFirma: () => rechazar('Firma vencida / cancelada por el nuevo titular'),
        errorBoss: () =>
          actualizar(
            { errorBoss: true },
            nuevoEvento(
              'error',
              `Error en BOSS · ${solicitud?.numero}`,
              'El servicio de cambio de titularidad respondió con error. El titular anterior no se desconecta.',
            ),
          ),
      }
    : null;

  const reiniciar = () => {
    setSeleccion([]);
    setMotivo(motivoInicial(unidad));
    setCanal(CANALES_ORIGEN[0]);
    setObservaciones('');
    setSaldo({ estado: 'sin-verificar' });
    setTitular(nuevoTitularVacio(unidad));
    setOcr('inicial');
    setValidacionDocumento('inicial');
    setConNetunoGo(Boolean(opcionales.streaming));
    setCorreoNetunoGo('');
    setValidacionCorreo('inicial');
    setConSalud(Boolean(opcionales.salud));
    setBeneficiarios([]);
    setArchivos({});
    setErrorEnvio(null);
    setSolicitud(null);
  };

  const avisoDemostracion = SERVICIOS_SIMULADOS && (
    <Alerta tono="aviso">
      <span className="flex items-center gap-1.5 font-bold">
        <FlaskConical aria-hidden="true" className="h-4 w-4" /> Vista de demostración
      </span>
      Los servicios del cambio de titularidad aún no están conectados: las validaciones, el OCR, la carga de
      documentos y el envío responden con datos de prueba. No se registra nada en CRM, Desk ni BOSS.
    </Alerta>
  );

  if (solicitud) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {avisoDemostracion}
        <Seguimiento
          solicitud={solicitud}
          anterior={anterior}
          nuevo={nuevo}
          nombreNuevo={nombreNuevo}
          nombreAnterior={nombreAnterior}
          correoAnterior={correoAnterior}
          demostracion={demostracion}
          onReintentar={() => actualizar({ errorBoss: false })}
          onNueva={reiniciar}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      {avisoDemostracion}
      <RegistroSolicitud
        unidad={unidad}
        contratos={contratos}
        seleccion={seleccion}
        onAlternar={alternarContrato}
        motivo={motivo}
        onMotivo={setMotivo}
        canal={canal}
        onCanal={setCanal}
        observaciones={observaciones}
        onObservaciones={setObservaciones}
        saldo={saldo}
      />
      {registroListo && (
        <DatosNuevoTitular
          unidad={unidad}
          titular={titular}
          onCambiar={cambiarTitular}
          documentoActual={documento ?? ''}
          ocr={ocr}
          onEscanear={escanear}
          validacionDocumento={validacionDocumento}
          onValidarDocumento={validarDocumento}
        />
      )}
      {titularListo && (
        <ServiciosTransferidos
          unidad={unidad}
          contratos={elegidos}
          streaming={opcionales.streaming}
          salud={opcionales.salud}
          conNetunoGo={conNetunoGo}
          onNetunoGo={setConNetunoGo}
          correoNetunoGo={correoNetunoGo}
          onCorreoNetunoGo={(valor) => {
            setCorreoNetunoGo(valor);
            setValidacionCorreo('inicial');
          }}
          validacionCorreo={validacionCorreo}
          onValidarCorreo={validarCorreo}
          conSalud={conSalud}
          onSalud={setConSalud}
          titularSalud={{
            nombre: nombreNuevo,
            documento: titular.documento,
            fecha: titular.fecha,
            sexo: titular.sexo,
          }}
          beneficiarios={beneficiarios}
          onAgregarBeneficiario={agregarBeneficiario}
          onCambiarBeneficiario={cambiarBeneficiario}
          onQuitarBeneficiario={quitarBeneficiario}
        />
      )}
      {serviciosListos && (
        <DocumentosRequeridos
          unidad={unidad}
          documentos={documentosRequeridos}
          archivos={archivos}
          subiendo={subiendo}
          onSubir={subir}
          onQuitar={quitar}
        />
      )}
      {documentosListos && (
        <VistaPrevia
          anterior={anterior}
          nuevo={nuevo}
          acciones={accionesPrevistas({
            unidad,
            documentos: documentosRequeridos.length,
            correo: titular.correo,
            nuevoTitular: nombreNuevo,
            titularActual: nombreAnterior,
            contratos: elegidos.length,
            facturacion,
          })}
          enviando={enviando}
          error={errorEnvio}
          onEnviar={() => void enviar()}
        />
      )}
    </div>
  );
}
