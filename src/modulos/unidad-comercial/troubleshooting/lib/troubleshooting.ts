/**
 * Troubleshooting (botón de los servicios de Internet). Origen en el widget jQuery (UnidadComercialJS/app/index.js):
 * Troubleshooting → buscarTEM (evento masivo y ticket hijo, crearTicketAutomatico), verTicketPadre,
 * buscarPEM (posible evento masivo), tipoFallaCliente (sin conexión, intermitencia, lentitud, asistencia remota),
 * validarPotencia e ipAsignada, y el refrescamiento de la ONT.
 */
import type { ReporteFalla } from '@/services/soporte.api';
import type { Contrato, Cuenta } from '@/shared/cuentas';
import { ESTADO_POTENCIA, evaluarPotencia } from '../../lib/potencia';

const texto = (valor: unknown) => (valor === null || valor === undefined ? '' : String(valor));

// ── Evento masivo (TEM) ─────────────────────────────────────────────

interface UbicacionBoss {
  estado?: unknown;
  ciudad?: unknown;
  municipio?: unknown;
  parroquia?: unknown;
  urbanizacion?: unknown;
  avCalle?: unknown;
  calle?: unknown;
  edificioCasa?: unknown;
  nodo?: unknown;
}

export interface ContratoBossTs {
  idProducto?: unknown;
  codContrato?: unknown;
  nombreServicio?: unknown;
  nombrePaquete?: unknown;
  tipoRed?: unknown;
  serial?: unknown;
  etiqueta?: unknown;
  listaPrecio?: unknown;
  alquilerEquipo?: unknown;
  coordenadasGps?: unknown;
  fechaInstalacion?: unknown;
  ubicacion?: UbicacionBoss[] | null;
}

/** FTTH/FTTO → "FTTX". */
const tipoDeRed = (tipoRed: unknown, alterno: string) =>
  tipoRed === 'FTTH' || tipoRed === 'FTTO' ? 'FTTX' : texto(tipoRed) || alterno;

/** Cuerpo de la búsqueda de eventos masivos por cobertura (Catalyst searchByCoverage). */
export function coberturaDelServicio(boss: ContratoBossTs, cuenta: Pick<Cuenta, 'descNodo'>) {
  const u = boss.ubicacion?.[0] ?? {};
  const o = (valor: unknown) => texto(valor) || '-';
  return {
    serviceType: boss.nombreServicio,
    networkType: tipoDeRed(boss.tipoRed, 'Sin datos'),
    location: {
      state: o(u.estado),
      city: o(u.ciudad),
      municipality: o(u.municipio),
      parish: o(u.parroquia),
      urbanization: o(u.urbanizacion),
      avenueStreet: o(u.avCalle),
      street: o(u.calle),
      building: o(u.edificioCasa),
      node: o(cuenta.descNodo),
    },
  };
}

/** Ticket padre de un evento masivo (lo que devuelve Catalyst). */
export interface TicketPadre {
  id?: string;
  ticketNumber?: string;
  departmentId?: string;
  department?: { name?: string } | null;
  status?: string;
  createdTime?: string;
  subject?: string;
  description?: string | null;
  category?: string;
  subCategory?: string;
  webUrl?: string;
  cf?: Record<string, unknown> | null;
}

export const TICKET_HIJO = {
  estado: 'Evento masivo',
  tiposAbiertos: ['Open', 'On Hold'],
} as const;

/** "AAAA-MM-DD" o "dd/mm/aaaa hh" → "AAAA-MM-DD". */
function fechaIso(valor: unknown): string {
  const t = texto(valor).split(' ')[0] ?? '';
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const [d, m, a] = t.split('/');
  return d && m && a ? `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : '';
}

/** Ticket hijo del cliente dentro del evento masivo (crearTicketAutomatico). */
export function ticketHijoMasivo(d: {
  padre: TicketPadre;
  boss: ContratoBossTs;
  cuenta: Pick<Cuenta, 'descTipoCliente'>;
  registro: Record<string, unknown>;
  contactoId: string;
  cuentaDeskId: string;
  productoInternet: string | null;
  nas: { tarjeta?: unknown; puerto?: unknown; ip?: unknown; idont?: unknown } | null;
  potencia: unknown;
  territorio: string;
}): Record<string, unknown> {
  const { padre, boss, registro: r } = d;
  const u = boss.ubicacion?.[0] ?? {};
  const empresa = d.cuenta.descTipoCliente === 'Empresa';
  const oSinDatos = (valor: unknown) => (valor === null || valor === undefined ? 'Sin datos' : valor);
  return {
    subject: `AB${texto(r.Nro_de_Cliente)} || CRM || Asociado a Evento Masivo`,
    departmentId: padre.departmentId,
    contactId: d.contactoId,
    accountId: d.cuentaDeskId,
    ...(d.productoInternet ? { productId: d.productoInternet } : {}),
    status: TICKET_HIJO.estado,
    category: padre.category,
    subCategory: padre.subCategory,
    description: padre.description,
    email: r.email,
    phone: `${texto(r.Codigo_de_Celular)}-${texto(r.Tel_fono_Celular)}`,
    cf: {
      cf_tipo_de_documento_de_identidad: r.cf_tipo_documento,
      cf_documento_de_identidad: r.cf_documento_de_identidad,
      cf_clase_de_cliente: r.Clase_de_cliente,
      cf_segmentacion: r.Segmentaci_n,
      cf_direccion_1: r.Direcci_n_Corta,
      cf_tipo_cliente: d.cuenta.descTipoCliente,
      cf_id_cliente_crm: r.id,
      cf_ticket_padre_relacionado: padre.id,
      cf_nombre_de_persona_contacto: empresa ? r.contactTechnologyNames : '',
      cf_numero_de_telefono_persona_contacto: empresa ? r.contactTechnologyPhone : '',
      cf_correo_electronico_persona_contacto: empresa ? r.contactTechnologyEmail : '',
      cf_etiqueta: boss.etiqueta,
      cf_lista_de_precio: boss.listaPrecio,
      cf_estado: u.estado,
      cf_ciudad: u.ciudad,
      cf_municipio: u.municipio,
      cf_parroquia: u.parroquia,
      cf_sector: u.urbanizacion,
      cf_urbanizacion: u.urbanizacion,
      cf_avenida: u.avCalle,
      cf_calle: u.calle,
      cf_edificio: u.edificioCasa,
      cf_nodo: u.nodo,
      cf_id_producto: boss.codContrato,
      cf_contrato_completo: boss.idProducto,
      cf_nombre_del_plan: boss.nombrePaquete,
      cf_sub_producto: tipoDeRed(boss.tipoRed, '--Ninguna--'),
      cf_serial_del_equipo: boss.serial,
      cf_fecha_instalacion: fechaIso(boss.fechaInstalacion) || undefined,
      // El widget jQuery asignaba en lugar de comparar (`= "SI"`): siempre enviaba true
      cf_alquiler_de_equipo: boss.alquilerEquipo === 'SI',
      cf_gps: oSinDatos(boss.coordenadasGps),
      cf_correo_electronico_netuno_go: 'No aplica',
      cf_nro_telefonico: 'No aplica',
      cf_numero_de_tarjeta: d.nas?.tarjeta ?? null,
      cf_puerto: d.nas?.puerto ?? null,
      cf_direccion_ip: oSinDatos(d.nas?.ip),
      cf_id_ont: oSinDatos(d.nas?.idont),
      cf_potencia_nas: oSinDatos(d.potencia),
      cf_operacion: d.territorio,
    },
  };
}

/** "2026-11-05T14:30:00.000Z" → "05/11/2026 10:30:00 a. m." (hora local). */
function fechaHoraLocal(valor: unknown): string {
  if (!valor) return 'Sin datos';
  const fecha = new Date(texto(valor));
  if (Number.isNaN(fecha.getTime())) return 'Sin datos';
  const [a, m, d] = texto(valor).split('T')[0]?.split('-') ?? [];
  return `${d}/${m}/${a} ${fecha.toLocaleTimeString('es-VE')}`;
}

/** Datos del ticket padre que se muestran (verTicketPadre). */
export function datosTicketPadre(p: TicketPadre): { etiqueta: string; valor: string }[] {
  const cf = p.cf ?? {};
  const [a, m, d] = texto(p.createdTime).split('T')[0]?.split('-') ?? [];
  const inicio = cf.cf_fecha_y_hora_inicio_afectacion;
  const fin = cf.cf_fecha_y_hora_fin_afectacion;
  const minutos =
    inicio && fin ? (new Date(texto(fin)).getTime() - new Date(texto(inicio)).getTime()) / 60000 : NaN;
  const afectacion = cf.cf_afectacion_de_servicio;
  return [
    { etiqueta: 'Departamento', valor: texto(p.department?.name) || 'Sin datos' },
    { etiqueta: 'Estatus', valor: texto(p.status) || 'Sin datos' },
    { etiqueta: 'Fecha', valor: a && m && d ? `${d}/${m}/${a}` : 'Sin datos' },
    { etiqueta: 'Asunto', valor: texto(p.subject) || 'Sin datos' },
    // El widget jQuery asignaba en lugar de comparar: siempre mostraba "Si"
    {
      etiqueta: 'Afectación del servicio',
      valor:
        afectacion === true || afectacion === 'true'
          ? 'Sí'
          : afectacion === false || afectacion === 'false'
            ? 'No'
            : 'Sin datos',
    },
    { etiqueta: 'Creador del ticket', valor: texto(cf.cf_creador_ticket) || 'Sin datos' },
    { etiqueta: 'Fecha y hora de inicio', valor: fechaHoraLocal(inicio) },
    { etiqueta: 'Fecha y hora de fin', valor: fechaHoraLocal(fin) },
    {
      etiqueta: 'Tiempo total',
      valor: Number.isFinite(minutos) ? `${Math.round(minutos)} min` : 'Sin datos',
    },
    { etiqueta: 'Cobertura de afectación', valor: texto(cf.cf_cobertura_de_afectacion) || 'Sin datos' },
    { etiqueta: 'Tipo de servicio', valor: texto(cf.cf_tipo_de_servicio) || 'Sin datos' },
    { etiqueta: 'Tipo de red', valor: texto(cf.cf_sub_producto) || 'Sin datos' },
    { etiqueta: 'Nodo', valor: texto(cf.cf_nodo) || 'Sin datos' },
    { etiqueta: 'Descripción', valor: texto(p.description) || 'Sin datos' },
    { etiqueta: 'Avance del ticket', valor: texto(cf.cf_avance_del_ticket) || 'Sin datos' },
  ];
}

// ── Posible evento masivo (PEM) ─────────────────────────────────────

/** `code` 1001 = el nodo tiene un posible evento masivo; sin `code`, 1002 o 1003 = no. */
export const hayPosibleEventoMasivo = (respuesta: { code?: unknown } | null | undefined) =>
  Number(respuesta?.code) === 1001;

// ── Tipo de falla ───────────────────────────────────────────────────

export type TipoFalla = 'sinConexion' | 'intermitencia' | 'lentitud';

/** Textos de cada tipo de falla (checklist, diagnóstico, botones y mensaje de visita técnica). */
export const FALLAS: Readonly<
  Record<
    TipoFalla,
    { titulo: string; verificacion: string; resuelto: string; noResuelto: string; visita: string }
  >
> = {
  sinConexion: {
    titulo: 'ONT no sincronizada',
    verificacion: 'ONT no sincronizada',
    resuelto: 'Conectado',
    noResuelto: 'Sin conexión',
    visita: 'Sin conexión. Requiere visita técnica.',
  },
  intermitencia: {
    titulo: 'Conexión Intermitente',
    verificacion: 'Conexion estable',
    resuelto: 'Conectado',
    noResuelto: 'Sin conexión',
    visita: 'Conexión intermitente. Requiere visita técnica.',
  },
  lentitud: {
    titulo: 'Conexión con lentitud',
    verificacion: 'Velocidad optima',
    resuelto: 'Resuelto',
    noResuelto: 'No resuelto',
    visita: 'Conexión con lentitud. Requiere visita técnica.',
  },
};

export const MENSAJES = {
  masivo: 'Este cliente se encuentra asociado a un evento masivo',
  posibleMasivo: 'Posible falla masiva, Requiere atención.',
  especializado: 'Servicio requiere intervención especializada.',
  apagado: 'Verificar conexión eléctrica ONT.',
  enConexion: 'En conexión',
  refrescamiento:
    'Este comando provocará un restablecimiento transitorio de la configuración operativa de la ONT.',
} as const;

/** Fecha y hora local "AAAA-MM-DDTHH:MM:SS" del reporte de falla. */
export function fechaHoraReporte(fecha = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}T${p(fecha.getHours())}:${p(fecha.getMinutes())}:${p(fecha.getSeconds())}`;
}

/**
 * Reporte de falla para node-red. El widget jQuery envía "Sin conexión" en los tres tipos de falla
 * (también en intermitencia y lentitud); se conserva porque alimenta el cálculo de posibles eventos masivos.
 */
export function reporteFalla(
  cuenta: Pick<Cuenta, 'cuenta' | 'descNodo' | 'codNodo' | 'descCiudad'>,
  servicio: Pick<Contrato, 'codContrato'>,
  fecha = new Date(),
): ReporteFalla {
  const nodo = texto(cuenta.descNodo);
  return {
    fechaHora: fechaHoraReporte(fecha),
    nroCuenta: texto(cuenta.cuenta),
    codNodo: texto(cuenta.codNodo),
    nodoCatastro: nodo,
    nodoNas: nodo,
    cuentaValida: texto(cuenta.cuenta),
    nroContrato: texto(servicio.codContrato),
    ciudad: texto(cuenta.descCiudad),
    ordinal: 'false',
    reporteFallasId: 'Sin conexión',
    reporteFallasName: 'Sin conexión a internet',
  };
}

// ── Valores ópticos ─────────────────────────────────────────────────

export interface ValoresOpticos {
  estatus?: unknown;
  conexion?: unknown;
  potencia?: unknown;
}

export type EstadoPaso = 'ok' | 'falla' | 'progreso' | 'neutro';

/** Estatus "1"/"0" → Conectado/Desconectado (modal de valores ópticos). */
export function textoValorOptico(
  clave: keyof ValoresOpticos,
  datos: ValoresOpticos | null | undefined,
): string {
  if (!datos || !(clave in datos)) return 'Sin datos';
  const v = datos[clave];
  if (v === '1') return 'Conectado';
  if (v === '0') return 'Desconectado';
  return texto(v) || 'Sin datos';
}

export const ipAsignada = (datos: ValoresOpticos | null | undefined) => datos?.conexion === 'IP Asignada';

/** Estado de la potencia para la checklist ("neutro" si la tecnología no tiene rango). */
export function estadoPotencia(codTecnologia: unknown, datos: ValoresOpticos | null | undefined): EstadoPaso {
  const e = evaluarPotencia(codTecnologia, datos?.potencia);
  if (e === ESTADO_POTENCIA.OPTIMA) return 'ok';
  if (e === ESTADO_POTENCIA.FUERA_DE_RANGO) return 'falla';
  return 'neutro';
}

/** Diagnóstico de LOS (luz roja): mensaje y si se ofrece crear el ticket. */
export function diagnosticoLos(codTecnologia: unknown, datos: ValoresOpticos | null | undefined) {
  const estado = estadoPotencia(codTecnologia, datos);
  if (estado === 'falla') return { estado, mensaje: 'Sin potencia óptica. Requiere visita técnica.' };
  if (estado === 'ok') return { estado, mensaje: 'Valores óptimos. ¿Desea crear el ticket?' };
  return { estado, mensaje: 'No se logró obtener los datos de valores. ¿Desea crear el ticket?' };
}

// ── Evento de CRM del refrescamiento ────────────────────────────────

export const EVENTO_REFRESCAMIENTO = {
  nombre: 'Restablecimiento de configuración desde Zoho CRM',
  registro: 'Modificación',
  subtipo: 'Refrescamiento de ONT',
  descripcion: 'Comando enviado exitosamente a la plataforma',
} as const;
