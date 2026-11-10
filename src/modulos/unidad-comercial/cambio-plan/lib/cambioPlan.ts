/**
 * Cambio de plan: elegibilidad, paquetes, reglas de downgrade, ticket de Zoho Desk y evento en CRM.
 * Origen: lib/cambioPlan.js de UnidadComercialReact (showTab("cambioPlan"), continueCambioPlan,
 * continueCambioPlanSelect, procesarDowngradeBeneficiarios, activarCambioPlan y crearTicketZohoCambioPlan
 * en app/index.js).
 */
import {
  normalizarPaquete,
  parteDespuesDeGuion,
  planActual,
  type Contrato,
  type Cuenta,
} from '@/shared/cuentas';
import { aliasDeEmail } from '@/shared/lib/cliente';
import { eventoGestion } from '@/shared/canal-atencion';
import {
  BENEFICIARIOS_PERMITIDOS,
  DOWNGRADES_CON_APROBACION,
  SERVICIOS_CAMBIO_PLAN,
  TICKET_DOWNGRADE,
  TIPOS_CAMBIO,
  type TipoCambio,
} from '../config';

type Registro = Record<string, unknown>;

/* ------------------------- Regla de un cambio por mes ------------------------- */

/**
 * Un cliente solo puede cambiar de plan una vez por mes calendario. Origen: obtenerDiferencia().
 *
 * Diferencia intencional: app/index.js comparaba contra la hora UTC leída como hora local, por lo que en
 * Venezuela (UTC-4) después de las 20:00 del último día del mes ya "cambiaba" de mes. Aquí se compara en
 * hora local. Las fechas "AAAA-MM-DD" también se leen como hora local (new Date() las trataría como UTC).
 */
function leerFecha(valor: unknown): Date {
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor));
  if (soloFecha) return new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]));
  return new Date(String(valor));
}

export function puedeCambiarPlanEsteMes(ultFechaCambPaq: unknown, ahora: Date = new Date()): boolean {
  if (ultFechaCambPaq === null || ultFechaCambPaq === undefined || ultFechaCambPaq === '') return true;
  const ultimoCambio = leerFecha(ultFechaCambPaq);
  if (Number.isNaN(ultimoCambio.getTime())) return true;
  return !(
    ultimoCambio.getFullYear() === ahora.getFullYear() && ultimoCambio.getMonth() === ahora.getMonth()
  );
}

/** Texto secundario de la tarjeta: Internet → nombre de facturación; Streaming → correo de la cuenta. */
export function detalleContrato(contrato: Contrato): string {
  if (contrato.nombreServicio === 'Internet') return contrato.nombrePaqueteFact ?? '';
  if (contrato.nombreServicio === 'Streaming') return String(contrato.serial ?? '').toLowerCase();
  return '';
}

/* -------------------------------- Elegibilidad -------------------------------- */

const conectado = (c: Contrato) => c.status?.toLowerCase() === 'conectado';

export interface ServicioElegible {
  idProducto: string;
  codContrato?: string;
  cuenta: string | number;
  servicio: string;
  plan: string | null | undefined;
  detalle: string;
  contrato: Contrato;
}

/** Internet FTTH y NetUnoGO conectados, en ese orden (como se listan hoy). */
export function serviciosElegibles(cuenta: Cuenta): ServicioElegible[] {
  const contratos = cuenta.contratos ?? [];
  const internet = contratos.filter(
    (c) =>
      conectado(c) && c.nombreServicio?.toLowerCase() === 'internet' && c.tipoRed?.toLowerCase() === 'ftth',
  );
  const streaming = contratos.filter(
    (c) =>
      conectado(c) &&
      c.nombreServicio?.toLowerCase() === 'streaming' &&
      Boolean(c.nombrePaquete?.toLowerCase().includes('netunogo')),
  );
  return [...internet, ...streaming].map((c) => ({
    idProducto: c.idProducto,
    codContrato: c.codContrato,
    cuenta: c.cuenta ?? cuenta.cuenta,
    servicio: c.nombreServicio,
    plan: planActual(c),
    detalle: detalleContrato(c),
    contrato: c,
  }));
}

export interface Elegibilidad {
  ok: boolean;
  motivo: 'empresa' | 'desconectada' | 'saldo' | 'sin-servicios' | null;
  mensaje: string | null;
}

/** El widget jQuery mostraba "Factura pendiente" para cualquier causa; aquí cada causa tiene su mensaje. */
export function elegibilidadCambioPlan(cuenta: Cuenta): Elegibilidad {
  if (Number(cuenta.codTipoCliente) === 2) {
    return {
      ok: false,
      motivo: 'empresa',
      mensaje: 'El cambio de plan para clientes Empresa no se gestiona desde este widget.',
    };
  }
  if (cuenta.descStatusCuenta !== 'Conectado') {
    return { ok: false, motivo: 'desconectada', mensaje: 'La cuenta no está conectada.' };
  }
  // Igual que `saldo == 0 || Number(saldo) < 0` en app/index.js (null no cuenta como 0; "" sí)
  const saldo = cuenta.saldo;
  const saldoEnCero = saldo !== null && saldo !== undefined && Number(saldo) === 0;
  if (!(saldoEnCero || Number(saldo) < 0)) {
    return {
      ok: false,
      motivo: 'saldo',
      mensaje: `El cliente tiene una factura pendiente por cancelar (saldo ${cuenta.saldo}).`,
    };
  }
  if (serviciosElegibles(cuenta).length === 0) {
    return {
      ok: false,
      motivo: 'sin-servicios',
      mensaje: 'La cuenta no tiene Internet FTTH ni NetUnoGO conectados.',
    };
  }
  return { ok: true, motivo: null, mensaje: null };
}

/* ------------------------- Selección del plan a cambiar ------------------------- */

/**
 * Marca o desmarca el servicio `indice` aplicando sus dependencias (dependencyServicesCP):
 * - Internet: deja solo ese servicio marcado.
 * - NetUnoGO: arrastra (marca y bloquea) los Streaming del mismo correo que no son NetUnoGO y desmarca el resto.
 */
export function alternarServicio(
  servicios: ReadonlyArray<Pick<ServicioElegible, 'servicio' | 'plan' | 'detalle'>>,
  marcados: readonly boolean[],
  indice: number,
): { marcados: boolean[]; arrastrados: boolean[] } {
  const nuevo = [...marcados];
  const arrastrados = servicios.map(() => false);
  const elegido = servicios[indice];
  if (!elegido) return { marcados: nuevo, arrastrados };
  const marcar = !nuevo[indice];
  nuevo[indice] = marcar;

  servicios.forEach((s, j) => {
    if (j === indice) return;
    if (elegido.servicio === 'Internet') {
      nuevo[j] = false;
    } else if (elegido.servicio === 'Streaming' && elegido.plan?.includes('NetUnoGO')) {
      if (s.servicio === 'Streaming' && s.detalle === elegido.detalle && !s.plan?.includes('NetUnoGO')) {
        nuevo[j] = marcar;
        arrastrados[j] = marcar;
      } else {
        nuevo[j] = false;
      }
    }
  });
  return { marcados: nuevo, arrastrados };
}

/* ------------------------------ Paquetes disponibles ------------------------------ */

export interface ParametrosPaquetes {
  cuenta: string | number;
  contrato: string;
  servicio: number;
  tipoPaquete: number;
  orderPaq: 1 | 2;
}

export function parametrosConsulta(
  servicioElegido: Pick<ServicioElegible, 'servicio' | 'cuenta' | 'codContrato'>,
  tipo: TipoCambio,
): ParametrosPaquetes | null {
  const s = SERVICIOS_CAMBIO_PLAN[servicioElegido.servicio];
  if (!s) return null;
  return {
    cuenta: servicioElegido.cuenta,
    contrato: servicioElegido.codContrato ?? '',
    servicio: s.servicio,
    tipoPaquete: s.tipoPaquete,
    orderPaq: TIPOS_CAMBIO[tipo].orderPaq,
  };
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export interface PaqueteApi {
  Codigo?: string | number;
  Paquete?: string;
  Precio?: Array<{ precio?: string | number; Moneda?: string; Precio?: string | number }>;
  ComboDetalle?: Array<{ NbrFacturacion?: string }>;
  NbrFacturacion?: string;
}

export interface RespuestaPaquetes {
  ultFechaCambPaq?: string | null;
  mensualidad?: PaqueteApi[];
}

export interface OpcionPlan {
  codigo: string;
  nombre: string;
  precio: string;
  resumen: string;
  tipoCambio: TipoCambio;
}

/** Paquete de la API → opción para elegir. Internet: precio = suma de conceptos; Streaming: primer precio. */
export function opcionPaquete(paquete: PaqueteApi, tipoCambio: TipoCambio, servicio: string): OpcionPlan {
  if (servicio === 'Internet') {
    const total = redondear((paquete.Precio ?? []).reduce((acc, p) => acc + Number(p.precio), 0));
    const resumen = [...new Set((paquete.ComboDetalle ?? []).map((cd) => cd.NbrFacturacion))].join(' | ');
    return {
      codigo: String(paquete.Codigo ?? ''),
      nombre: normalizarPaquete(parteDespuesDeGuion(paquete.Paquete)) ?? '',
      precio: `$${total}`,
      resumen,
      tipoCambio,
    };
  }
  const precio = paquete.Precio?.[0];
  return {
    codigo: String(paquete.Codigo ?? ''),
    nombre: paquete.Paquete ?? '',
    precio: precio ? `${precio.Moneda ?? ''}${precio.Precio ?? ''}` : '',
    resumen: paquete.NbrFacturacion ?? '',
    tipoCambio,
  };
}

/** Respuestas de upgrade y downgrade → opciones (primero upgrades) y si ya hubo un cambio este mes. */
export function combinarPaquetes(
  respuestaUp: RespuestaPaquetes | null | undefined,
  respuestaDown: RespuestaPaquetes | null | undefined,
  servicio: string,
  ahora: Date = new Date(),
): { opciones: OpcionPlan[]; cambioEsteMes: boolean } {
  const lista = (r: RespuestaPaquetes | null | undefined, tipo: TipoCambio) =>
    (Array.isArray(r?.mensualidad) ? r.mensualidad : []).map((p) => opcionPaquete(p, tipo, servicio));
  const cambioEsteMes = [respuestaUp, respuestaDown].some(
    (r) => r && !puedeCambiarPlanEsteMes(r.ultFechaCambPaq, ahora),
  );
  return { opciones: [...lista(respuestaUp, 'U'), ...lista(respuestaDown, 'D')], cambioEsteMes };
}

/* --------------------------------- Downgrade --------------------------------- */

export interface Beneficiario {
  contrato: string;
  cuenta: string;
  nombre: string;
}

/** Beneficiarios adicionales de Salud conectados de la cuenta. */
export function beneficiariosAdicionales(cuenta: Cuenta): Beneficiario[] {
  return (cuenta.contratos ?? [])
    .filter(
      (c) =>
        conectado(c) &&
        c.nombreServicio?.toLowerCase() === 'salud' &&
        Boolean(c.nombrePaquete?.toLowerCase().includes('beneficiario adicional')),
    )
    .map((c) => ({
      contrato: String(c.idProducto),
      cuenta: String(c.cuenta ?? cuenta.cuenta),
      nombre: c.NombreAseg == null ? 'Sin Nombre' : c.NombreAseg.trim(),
    }));
}

export function requiereAprobacion(nuevo: string, anterior: string | null | undefined): boolean {
  return DOWNGRADES_CON_APROBACION.some(
    (r) => r.nuevo === nuevo && (!r.anterior || r.anterior.includes(anterior ?? '')),
  );
}

const pantallas = (plan: string | null | undefined) => Number(/plus\s*(\d+)/i.exec(plan ?? '')?.[1]);

export interface ReglaDowngrade {
  tipo: 'internet' | 'streaming';
  /** Va a Servicio al Cliente como "Pendiente por aprobación". */
  aprobacion: boolean;
  /** Beneficiarios de Salud que hay que excluir. */
  excluir: number;
  /** El asesor debe elegir cuáles excluir (se excluye una parte, no todos). */
  elegir: boolean;
  /** Internet: el plan nuevo no admite Salud. */
  eliminaSalud?: boolean;
  /** Streaming: pantallas que se pierden. */
  pantallasMenos?: number | null;
}

/**
 * Qué hay que confirmar en un downgrade:
 *   Internet: cuántos beneficiarios de Salud se excluyen (todos si el plan no admite ninguno),
 *             si hay que elegirlos y si va a aprobación.
 *   Streaming: cuántas pantallas se pierden.
 */
export function reglaDowngrade({
  servicio,
  nuevo,
  anterior,
  adicionales = [],
}: {
  servicio: string;
  nuevo: string;
  anterior: string | null | undefined;
  adicionales?: readonly unknown[];
}): ReglaDowngrade {
  if (servicio === 'Streaming') {
    const menos = pantallas(anterior) - pantallas(nuevo);
    return {
      tipo: 'streaming',
      pantallasMenos: Number.isFinite(menos) && menos > 0 ? menos : null,
      aprobacion: false,
      excluir: 0,
      elegir: false,
    };
  }
  const permitidos = BENEFICIARIOS_PERMITIDOS[nuevo];
  const total = adicionales.length;
  const excluir = permitidos === undefined ? 0 : Math.max(0, total - permitidos);
  return {
    tipo: 'internet',
    aprobacion: requiereAprobacion(nuevo, anterior),
    eliminaSalud: permitidos === 0,
    excluir,
    // Si se excluyen todos no hay nada que elegir
    elegir: excluir > 0 && excluir < total,
  };
}

/* ------------------------------ Ticket de Zoho Desk ------------------------------ */

export function asuntoDowngrade(registro: Registro, cuenta: string | number): string {
  return `Downgrade|Doc.Identidad: ${String(registro.cf_documento_de_identidad)}|CRM|Cuenta: ${cuenta}`;
}

export interface UsuarioTicket {
  id?: string;
  nombre?: string;
  email?: string;
}

export interface SeleccionDowngrade {
  servicioElegido: Pick<ServicioElegible, 'servicio' | 'plan' | 'cuenta' | 'codContrato'>;
  opcion: Pick<OpcionPlan, 'codigo' | 'nombre'>;
  excluidos: Beneficiario[];
  adicionales: Beneficiario[];
  regla: Pick<ReglaDowngrade, 'aprobacion'>;
}

export interface DeskTicket {
  departamentos: { atc: string | null; ave: string | null };
  /** Producto de Desk por servicio ("Internet", "Streaming"). */
  productos: Readonly<Record<string, string | null>>;
}

/** Parámetros del ticket de downgrade (crearTicketZohoCambioPlan). */
export function ticketDowngrade({
  seleccion,
  cuenta,
  registro,
  usuario,
  contactoId,
  desk,
}: {
  seleccion: SeleccionDowngrade;
  cuenta: Cuenta | null | undefined;
  registro: Registro | null | undefined;
  usuario: UsuarioTicket | null | undefined;
  contactoId: string;
  desk: DeskTicket;
}): { parametros: Record<string, unknown>; departamento: string; departamentoId: string | null } {
  const r = registro ?? {};
  const { servicioElegido, opcion, excluidos, adicionales, regla } = seleccion;
  const t = TICKET_DOWNGRADE;
  const departamento = regla.aprobacion ? t.departamentoAprobacion : t.departamentoProgramado;
  const servicioApi = SERVICIOS_CAMBIO_PLAN[servicioElegido.servicio]?.servicio;
  const departmentId = desk.departamentos[departamento.clave];

  const lineas = [
    'Downgrade:',
    `Doc.Identidad: ${String(r.cf_documento_de_identidad)}`,
    `Nombre: ${String(r.Account_Name)}`,
    `Paquete Nuevo: ${opcion.nombre}`,
    `Paquete Anterior: ${servicioElegido.plan}`,
  ];
  if (excluidos.length) {
    lineas.push(
      `Beneficiarios Asociados: ${adicionales.map((b) => `${b.nombre} - ${b.contrato} - ${b.cuenta}`).join(' , ')}`,
    );
    lineas.push(`Contrato(s)Beneficiarios a Excluir: ${excluidos.map((b) => b.contrato).join(' , ')}`);
  }

  const parametros: Record<string, unknown> = {
    channel: t.canal,
    departmentId,
    subject: asuntoDowngrade(r, servicioElegido.cuenta),
    contactId: contactoId,
    email: r.email,
    description: lineas.join('<br>'),
    category: t.categoria,
    subCategory: t.subcategoria,
    priority: t.prioridad,
    status: regla.aprobacion ? t.estadoAprobacion : t.estadoProgramado,
    cf: {
      cf_ciudad: cuenta?.descCiudad,
      cf_documento_de_identidad: r.cf_documento_de_identidad,
      cf_id_producto: servicioElegido.codContrato,
      cf_numero_de_cuenta: servicioElegido.cuenta,
      cf_sub_producto: 'FTTX',
      cf_tipo_cliente: cuenta?.descTipoCliente,
      cf_avance_del_ticket: 'Sin Información',
      cf_nodo: cuenta?.nodoNas,
      cf_tipo_de_documento_de_identidad: r.cf_tipo_documento,
      cf_downgrade_plan: JSON.stringify({
        cedularif: r.cf_documento_de_identidad,
        cuenta: servicioElegido.cuenta,
        contrato: servicioElegido.codContrato,
        servicio: String(servicioApi),
        codPaquete: opcion.codigo,
        usuarioCambPaq: aliasDeEmail(usuario?.email),
      }),
      cf_segmentacion: r.Segmentaci_n,
      cf_clase_de_cliente: r.Clase_de_cliente,
      cf_creador_ticket: usuario?.nombre,
      cf_id_creador_ticket: usuario?.id,
      cf_id_cliente_crm: r.id,
      cf_downgrade_salud: excluidos.length
        ? JSON.stringify(
            excluidos.map((b) => ({ contrato: b.contrato, cuenta: b.cuenta, codMotDesc: t.motivoBajaSalud })),
          )
        : null,
      cf_lista_de_seleccion_1: 'Baja ingresada',
      cf_contratos: excluidos.length ? excluidos.map((b) => `Salud: ${b.contrato}`).join(', ') : null,
      cf_tipo_de_contrato: 'Secundario',
    },
  };
  // Sin ID configurado para el entorno el ticket se crea sin producto (en Desk es opcional)
  const producto = desk.productos[servicioElegido.servicio];
  if (producto) parametros.productId = producto;
  return { parametros, departamento: departamento.nombre, departamentoId: departmentId };
}

export interface TicketDesk {
  status?: string;
  subCategory?: string;
  ticketNumber?: string;
  webUrl?: string;
  [campo: string]: unknown;
}

/** Ya hay un downgrade programado para la cuenta en ese departamento (misma regla que app/index.js). */
export function ticketDowngradeExistente(
  tickets: readonly TicketDesk[] | null | undefined,
): TicketDesk | null {
  return (
    (tickets ?? []).find(
      (t) =>
        t.status === TICKET_DOWNGRADE.estadoProgramado && t.subCategory === TICKET_DOWNGRADE.subcategoria,
    ) ?? null
  );
}

/* ------------------------------- Upgrade y evento ------------------------------- */

export function cuerpoActualizarPlan({
  cuenta,
  servicioElegido,
  opcion,
  usuario,
}: {
  cuenta: Pick<Cuenta, 'documentoIdentificacion'>;
  servicioElegido: Pick<ServicioElegible, 'servicio' | 'cuenta' | 'codContrato'>;
  opcion: Pick<OpcionPlan, 'codigo'>;
  usuario: UsuarioTicket | null | undefined;
}) {
  return {
    cedularif: cuenta.documentoIdentificacion,
    cuenta: servicioElegido.cuenta,
    contrato: servicioElegido.codContrato,
    servicio: Number(SERVICIOS_CAMBIO_PLAN[servicioElegido.servicio]?.servicio),
    codPaquete: opcion.codigo,
    usuarioCambPaq: aliasDeEmail(usuario?.email),
  };
}

export interface RespuestaActualizar {
  codigo?: number;
  code?: number;
  mensaje?: string;
  status?: number;
  descripcion?: string;
}

export interface ResultadoUpgrade {
  estado: 'ok' | 'aviso' | 'periodo' | 'error';
  texto: string;
  historial: string | null;
}

/** Respuesta de /cambio/paquete/actualizar. */
export function resultadoActualizarPlan(
  datos: RespuestaActualizar | null | undefined,
  opcion: Pick<OpcionPlan, 'nombre'>,
  servicioElegido: Pick<ServicioElegible, 'codContrato'>,
): ResultadoUpgrade {
  if (datos?.codigo === 0 || datos?.code === 0) {
    return {
      estado: 'ok',
      texto: `Completado - ${opcion.nombre}`,
      historial: `Contrato: ${servicioElegido.codContrato}. Paquete: ${opcion.nombre}. Estatus: Exitoso.`,
    };
  }
  if (datos?.codigo === 2 || datos?.code === 2) {
    return {
      estado: 'aviso',
      texto: `${datos.mensaje} - ${opcion.nombre}`,
      historial: `Contrato: ${servicioElegido.codContrato}. Paquete: ${opcion.nombre}. Estatus: ${datos.mensaje}`,
    };
  }
  if (datos?.status === 412) {
    return {
      estado: 'periodo',
      texto: 'En este período ya se registró un cambio de plan asociado a la cuenta.',
      historial: null,
    };
  }
  return {
    estado: 'error',
    texto: `${datos?.descripcion ?? 'Ha ocurrido un error activando el servicio'} - ${opcion.nombre}`,
    historial: null,
  };
}

/** Registro en el módulo Eventos ("Registrar canal de atención") tras un upgrade. */
export function eventoCambioPlan({
  canal,
  cuenta,
  servicioElegido,
  opcion,
  historial,
  registro,
  documento,
  usuario,
  fecha = new Date(),
}: {
  canal: string;
  cuenta: Pick<Cuenta, 'cuenta'>;
  servicioElegido: Pick<ServicioElegible, 'servicio' | 'plan' | 'codContrato'> & {
    contrato?: Pick<Contrato, 'ubicacionJSON'>;
  };
  opcion: Pick<OpcionPlan, 'nombre'>;
  historial: string | null;
  registro: Registro | null | undefined;
  documento: string | null;
  usuario: UsuarioTicket | null | undefined;
  fecha?: Date;
}): Record<string, unknown> {
  return eventoGestion({
    nombre: 'Cambio de Plan desde Zoho CRM',
    registro: 'Modificación',
    subtipo: 'Cambio de plan (upgrade)',
    descripcion: `Resultado de cambio de plan. Datos enviados: ${historial}`,
    canal,
    cuenta,
    contrato: {
      codContrato: servicioElegido.codContrato,
      ubicacionJSON: servicioElegido.contrato?.ubicacionJSON,
    },
    producto: servicioElegido.servicio,
    // El widget jQuery dejaba Plan_nuevo vacío (la variable nunca se asignaba)
    planNuevo: opcion.nombre,
    planAnterior: servicioElegido.plan,
    registroCrm: registro,
    documento,
    usuario,
    fecha,
  });
}
