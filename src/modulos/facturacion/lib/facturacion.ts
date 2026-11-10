/**
 * Facturación (consulta y documentos). Origen: widgetFacturacionV1.2/app/index.js, rama facturacionFase2:
 * setDataToSections, estadoCuenta, dataFilter/applyFilter, descargar_verFactura, descargar_edoCuenta,
 * enviar_edoCuenta, domiciliacion, datosContacto, historicoDocumentos/showTab/verRegistro.
 */
import { estaConectado, nombreServicioLegible, type Cuenta } from '@/shared/cuentas';
import type { CampoDetalle, FilaHistorial } from '@/shared/historial';
import { correoValido, listaCorreos } from '@/shared/lib/correo';
import { PLANTILLAS_CORREO } from './plantillasCorreo';

type Datos = Record<string, unknown>;

const texto = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

// ── Montos y fechas ─────────────────────────────────────────────────

const SIMBOLOS: Record<string, string> = { USD: '$', VEF: 'Bs' };

/** Símbolo de la moneda de la cuenta (USD → $, VEF → Bs). */
export function simboloMoneda(cuenta: Pick<Cuenta, 'descMoneda' | 'monedaPago'>): string {
  const moneda = texto(cuenta.descMoneda) || texto(cuenta.monedaPago);
  return SIMBOLOS[moneda] ?? moneda;
}

/** Número de la API (número o texto "1.234,56" / "1234.56"); NaN si no se reconoce. */
export function numero(valor: unknown): number {
  if (typeof valor === 'number') return valor;
  const t = texto(valor);
  if (!t) return Number.NaN;
  // "1.234,56" → "1234.56"; "1234.56" queda igual
  const normalizado = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return Number(normalizado);
}

const FORMATO = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1234.5 → "1.234,50"; vacío si no es un número. */
export function formatoMonto(valor: unknown): string {
  const n = numero(valor);
  return Number.isNaN(n) ? '' : FORMATO.format(n);
}

/** "dd/mm/aaaa" → "aaaa-mm-dd" (valor de un input date); "" si no se reconoce. */
export function isoDeFecha(fecha: unknown): string {
  const [d, m, a] = texto(fecha).split('/');
  return d && m && a && a.length === 4 ? `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : '';
}

/** "aaaa-mm-dd…" → "dd/mm/aaaa"; "" si no se reconoce. */
export function fechaDeIso(valor: unknown): string {
  const [a, m, d] = texto(valor).split('T')[0]?.split('-') ?? [];
  return a && m && d ? `${d}/${m}/${a}` : '';
}

// ── Tarjeta de la cuenta ────────────────────────────────────────────

const NOMBRES_MONEDA: Record<string, string> = { USD: 'Dólares ($)', VEF: 'Bolívares (Bs)' };

/** "Dólares ($)" / "Bolívares (Bs)"; otra moneda, su símbolo o código. */
export function nombreMoneda(cuenta: Pick<Cuenta, 'descMoneda' | 'monedaPago'>): string {
  return NOMBRES_MONEDA[texto(cuenta.descMoneda)] ?? (simboloMoneda(cuenta) || 'Sin moneda');
}

/** Fecha de la API ("dd/mm/aaaa", "aaaa-mm-dd" o ISO) → fecha local; null si no se reconoce. */
export function fechaDe(valor: unknown): Date | null {
  const t = texto(valor);
  if (!t) return null;
  const dma = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (dma) return new Date(Number(dma[3]), Number(dma[2]) - 1, Number(dma[1]));
  const amd = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (amd) return new Date(Number(amd[1]), Number(amd[2]) - 1, Number(amd[3]));
  return null;
}

const dos = (n: number) => String(n).padStart(2, '0');
/** Fecha para mostrar ("dd/mm/aaaa"); si no se reconoce, el texto tal cual. */
export function fechaLegible(valor: unknown): string {
  const f = fechaDe(valor);
  return f ? `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${f.getFullYear()}` : texto(valor);
}

const DIA = 86_400_000;
/** Días de calendario desde `hoy` hasta `fecha` (negativo: ya pasó). */
const diasHasta = (fecha: Date, hoy: Date) =>
  Math.round(
    (new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime() -
      new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) /
      DIA,
  );
const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;

export interface EstadoFecha {
  tono: 'vencido' | 'proximo' | 'vigente' | 'sin';
  fecha: string;
  detalle: string;
}

/** Compromiso de pago: vencido (rojo), vence en 5 días o menos (ámbar), vigente o sin compromiso. */
export function estadoCompromiso(valor: unknown, hoy = new Date()): EstadoFecha {
  const f = fechaDe(valor);
  if (!f) return { tono: 'sin', fecha: texto(valor), detalle: texto(valor) ? '' : 'Sin compromiso de pago' };
  const n = diasHasta(f, hoy);
  const fecha = fechaLegible(valor);
  if (n < 0) return { tono: 'vencido', fecha, detalle: n === -1 ? 'Venció ayer' : `Venció hace ${dias(-n)}` };
  if (n === 0) return { tono: 'proximo', fecha, detalle: 'Vence hoy' };
  if (n <= 5) return { tono: 'proximo', fecha, detalle: n === 1 ? 'Vence mañana' : `Vence en ${dias(n)}` };
  return { tono: 'vigente', fecha, detalle: `Faltan ${dias(n)}` };
}

/** Último pago: fecha y hace cuánto. */
export function estadoUltimoPago(valor: unknown, hoy = new Date()): EstadoFecha {
  const f = fechaDe(valor);
  if (!f) return { tono: 'sin', fecha: texto(valor), detalle: texto(valor) ? '' : 'Sin pagos registrados' };
  const n = -diasHasta(f, hoy);
  const detalle = n <= 0 ? 'Hoy' : n === 1 ? 'Ayer' : `Hace ${dias(n)}`;
  return { tono: 'vigente', fecha: fechaLegible(valor), detalle };
}

export interface ServicioTarjeta {
  clave: string;
  /** Nombre legible ("400 Megas", "NetUnoGO Plus 5"). */
  nombre: string;
  /** Tipo de servicio (Internet, Telefonía...) para el ícono. */
  servicio: string;
  conectado: boolean | null;
}

/** Servicios de la cuenta desde sus contratos; sin contratos, desde `resumenServicios` (texto separado por comas). */
export function serviciosDeCuenta(cuenta: Pick<Cuenta, 'contratos' | 'resumenServicios'>): ServicioTarjeta[] {
  if (cuenta.contratos?.length) {
    return cuenta.contratos.map((c) => ({
      clave: c.idProducto,
      nombre: nombreServicioLegible(c) || texto(c.nombreServicio) || 'Servicio',
      servicio: texto(c.nombreServicio),
      conectado: estaConectado(c.status),
    }));
  }
  return texto(cuenta.resumenServicios)
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
    .map((nombre, i) => ({ clave: `${nombre}-${i}`, nombre, servicio: '', conectado: null }));
}

// ── Estado de cuenta ────────────────────────────────────────────────

/** Movimiento de GET /movimientos (factura, pago, nota de crédito o débito...). */
export interface Movimiento {
  id: string | number;
  /** "dd/mm/aaaa" */
  fecha?: string | null;
  descTipoDocumento?: string | null;
  statusDocumento?: string | null;
  descripcion?: string | null;
  numTicket?: string | number | null;
  cargo?: number | string | null;
  abono?: number | string | null;
  saldo?: number | string | null;
  codigoFiscal?: string | number | null;
  [campo: string]: unknown;
}

export interface FiltrosMovimientos {
  /** "aaaa-mm-dd" o "" */
  desde: string;
  hasta: string;
  documento: string;
  estatus: string;
}

export const SIN_FILTROS_MOVIMIENTOS: FiltrosMovimientos = {
  desde: '',
  hasta: '',
  documento: '',
  estatus: '',
};

const enRango = (m: Movimiento, desde: string, hasta: string) => {
  const iso = isoDeFecha(m.fecha);
  if (!desde && !hasta) return true;
  if (!iso) return false;
  return (!desde || iso >= desde) && (!hasta || iso <= hasta);
};

export function filtrarMovimientos(movimientos: readonly Movimiento[], f: FiltrosMovimientos): Movimiento[] {
  return movimientos.filter(
    (m) =>
      enRango(m, f.desde, f.hasta) &&
      (!f.documento || texto(m.descTipoDocumento) === f.documento) &&
      (!f.estatus || texto(m.statusDocumento) === f.estatus),
  );
}

const unicos = (valores: string[]) =>
  [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b));

/**
 * Opciones en cascada: cada lista sale de los movimientos que quedan con los demás filtros (más el valor elegido),
 * y el rango de fechas posible es el de todos los movimientos.
 */
export function opcionesMovimientos(movimientos: readonly Movimiento[], f: FiltrosMovimientos) {
  const documentos = unicos(
    filtrarMovimientos(movimientos, { ...f, documento: '' }).map((m) => texto(m.descTipoDocumento)),
  );
  const estatus = unicos(
    filtrarMovimientos(movimientos, { ...f, estatus: '' }).map((m) => texto(m.statusDocumento)),
  );
  const fechas = movimientos
    .map((m) => isoDeFecha(m.fecha))
    .filter(Boolean)
    .sort();
  return {
    documentos: f.documento && !documentos.includes(f.documento) ? [...documentos, f.documento] : documentos,
    estatus: f.estatus && !estatus.includes(f.estatus) ? [...estatus, f.estatus] : estatus,
    fechaMinima: fechas[0] ?? '',
    fechaMaxima: fechas.at(-1) ?? '',
  };
}

/** Suma de abonos y cargos de los movimientos visibles. */
export function totalesMovimientos(movimientos: readonly Movimiento[]): { abonos: number; cargos: number } {
  const suma = (campo: 'abono' | 'cargo') =>
    movimientos.reduce((total, m) => {
      const n = numero(m[campo]);
      return Number.isNaN(n) ? total : total + n;
    }, 0);
  return { abonos: suma('abono'), cargos: suma('cargo') };
}

export const esFactura = (m: Pick<Movimiento, 'descTipoDocumento'>) =>
  texto(m.descTipoDocumento) === 'Factura';

/** "Factura: 00-123456" o, para un pago, "Recibo: 4567" (número al inicio de la descripción). */
export function tituloDocumento(m: Movimiento): string {
  const tipo = texto(m.descTipoDocumento) || 'Documento';
  if (tipo !== 'Pago') return `${tipo}: ${texto(m.codigoFiscal) || texto(m.id)}`;
  const recibo = texto(m.descripcion).split(' - ')[0]?.trim();
  return `Recibo: ${recibo && /^\d+$/.test(recibo) ? recibo : texto(m.id)}`;
}

/** Nombre del archivo descargado, como el widget jQuery: "Nota de Credito - 123". */
export function nombreArchivo(m: Movimiento): string {
  const tipo = texto(m.descTipoDocumento).replace('Nota de Crédito', 'Nota de Credito') || 'Documento';
  return `${tipo} - ${texto(m.id)}`;
}

// ── Documentos (PDF) ────────────────────────────────────────────────

export type ResultadoEnlace = { url: string } | { error: string };

/** Respuesta de /estado-cuenta/link o /movimiento/link: `{ code: 0, data: url }`. */
export function enlaceDocumento(respuesta: unknown): ResultadoEnlace {
  const r = (respuesta && typeof respuesta === 'object' ? respuesta : {}) as {
    code?: unknown;
    data?: unknown;
  };
  if (Number(r.code) !== 0)
    return { error: 'El documento no se ha logrado cargar. Consulte al administrador.' };
  const url = texto(r.data);
  return url ? { url } : { error: 'Este documento no está disponible en este momento.' };
}

/**
 * Cómo se muestra el documento: Unidigital no permite incrustarlo (se abre aparte); un enlace http no se puede
 * mostrar dentro de una página https (contenido mixto).
 */
export function tipoVisor(url: string): 'pdf' | 'externo' | 'inseguro' | 'invalido' {
  try {
    const u = new URL(url);
    if (u.hostname === 'www.unidigital.global') return 'externo';
    return u.protocol === 'http:' ? 'inseguro' : 'pdf';
  } catch {
    return 'invalido';
  }
}

/** Descarga con nombre a través de la función attachmentMule de Catalyst. */
export function urlDescarga(base: string, url: string, nombre: string): string {
  return `${base}?url=${encodeURIComponent(url)}&name=${encodeURIComponent(nombre)}`;
}

// ── Correo ──────────────────────────────────────────────────────────

export type DocumentoCorreo = 'factura' | 'estadoCuenta';

const negociosDe = (registro: Datos): string[] =>
  Array.isArray(registro.Negocio)
    ? registro.Negocio.map(texto).filter(Boolean)
    : texto(registro.Negocio)
      ? [texto(registro.Negocio)]
      : [];

/**
 * Destinatarios propuestos (como el widget jQuery): un solo negocio Hogar → correo personal; Empresa → correo de
 * empresa (Correo_electr_nico_5) o el personal; ambos negocios → personal y empresa en copia.
 */
export function destinatariosIniciales(registro: Datos): { para: string; cc: string } {
  const personal = texto(registro.email);
  const empresa = texto(registro.Correo_electr_nico_5);
  const negocios = negociosDe(registro);
  if (negocios.length >= 2) return { para: personal, cc: empresa };
  if (negocios[0] && negocios[0] !== 'Hogar') return { para: empresa || personal, cc: '' };
  return { para: personal, cc: '' };
}

export function asuntoInicial(tipo: DocumentoCorreo, cuenta: Cuenta, movimiento?: Movimiento): string {
  if (tipo === 'estadoCuenta' || !movimiento) return `Estado de cuenta - ${texto(cuenta.cuenta)}`;
  return `${texto(movimiento.descTipoDocumento) || 'Documento'} - ${texto(movimiento.codigoFiscal) || texto(movimiento.id)}`;
}

export interface ErroresCorreo {
  para?: string;
  cc?: string;
  asunto?: string;
}

export function validarCorreo(f: { para: string; cc: string; asunto: string }): ErroresCorreo {
  const errores: ErroresCorreo = {};
  if (!f.para.trim()) errores.para = 'El destinatario del correo no puede estar vacío.';
  else if (!correoValido(f.para)) errores.para = 'El correo del destinatario no es válido.';
  const invalidos = listaCorreos(f.cc).filter((c) => !correoValido(c));
  if (invalidos.length) errores.cc = `Correo inválido en copia: ${invalidos.join(', ')}`;
  if (!f.asunto.trim()) errores.asunto = 'El asunto del correo no puede estar vacío.';
  return errores;
}

const escaparHtml = (t: string) =>
  t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Plantilla del jQuery (Hogar o Empresa según el tipo de la cuenta) con el cliente y el enlace del documento. */
export function contenidoCorreo(
  tipo: DocumentoCorreo,
  tipoCliente: unknown,
  cliente: string,
  enlace: string,
): string {
  const empresa = texto(tipoCliente).toUpperCase() === 'EMPRESA';
  const plantilla =
    tipo === 'factura'
      ? empresa
        ? PLANTILLAS_CORREO.facturaEmpresa
        : PLANTILLAS_CORREO.facturaHogar
      : empresa
        ? PLANTILLAS_CORREO.estadoCuentaEmpresa
        : PLANTILLAS_CORREO.estadoCuentaHogar;
  return plantilla
    .replaceAll('{{CLIENTE}}', escaparHtml(cliente))
    .replaceAll('{{ENLACE}}', escaparHtml(enlace));
}

export interface Remitente {
  nombre: string;
  correo: string;
}

/** Cuerpo de POST /{módulo}/{id}/actions/send_mail (API de CRM). */
export function cuerpoEnvioCorreo(d: {
  remitente: Remitente;
  para: string;
  nombreDestinatario: string;
  cc: string;
  asunto: string;
  contenido: string;
}): Record<string, unknown> {
  const copia = listaCorreos(d.cc);
  return {
    data: [
      {
        from: { user_name: d.remitente.nombre, email: d.remitente.correo },
        to: [{ user_name: d.nombreDestinatario, email: d.para.trim() }],
        ...(copia.length && { cc: copia.map((email) => ({ user_name: email, email })) }),
        subject: d.asunto.trim(),
        content: d.contenido,
        mail_format: 'html',
        org_email: true,
      },
    ],
  };
}

/** Resultado de send_mail: `{ data: [{ code: "SUCCESS" | "NOT_ALLOWED" | ..., message }] }`. */
export function resultadoEnvioCorreo(
  respuesta: unknown,
  remitente: string,
): { ok: boolean; mensaje: string } {
  const r = (respuesta && typeof respuesta === 'object' ? respuesta : {}) as {
    data?: { code?: unknown; message?: unknown }[];
  };
  const primero = r.data?.[0];
  const codigo = texto(primero?.code);
  if (codigo === 'SUCCESS') return { ok: true, mensaje: 'El correo se ha enviado exitosamente.' };
  if (codigo === 'NOT_ALLOWED') {
    return {
      ok: false,
      mensaje: `CRM no permite enviar desde ${remitente}: debe estar habilitado como correo de la organización.`,
    };
  }
  return {
    ok: false,
    mensaje: `Error en el envío del correo${codigo ? ` (${codigo}${texto(primero?.message) ? `: ${texto(primero?.message)}` : ''})` : ''}.`,
  };
}

// ── Contactos y domiciliación ───────────────────────────────────────

export interface ContactoArea {
  area: string;
  contactos: { nombre: string; cargo: string; correo: string }[];
}

/** GET /cliente/contacto: asesores de la cuenta agrupados por área. */
export function contactosDeCuenta(respuesta: unknown, cuenta: Cuenta['cuenta']): ContactoArea[] {
  const lista = (respuesta as { contactoCuenta?: unknown } | null)?.contactoCuenta;
  if (!Array.isArray(lista)) return [];
  const areas = new Map<string, ContactoArea>();
  for (const c of lista as Datos[]) {
    if (texto(c.cuenta) !== texto(cuenta)) continue;
    const area = texto(c.area) || 'Sin área';
    if (!areas.has(area)) areas.set(area, { area, contactos: [] });
    areas
      .get(area)
      ?.contactos.push({ nombre: texto(c.nombreAsesor), cargo: texto(c.cargo), correo: texto(c.correo) });
  }
  return [...areas.values()];
}

export type Domiciliacion =
  | { domiciliada: true; campos: { etiqueta: string; valor: string }[] }
  | { domiciliada: false; mensaje: string };

/** GET /cuenta/domiciliada: datos de la tarjeta o `{ code: -1, message: "Cuenta no domiciliada" }`. */
export function datosDomiciliacion(respuesta: unknown): Domiciliacion {
  const r = (respuesta && typeof respuesta === 'object' ? respuesta : {}) as Datos;
  if (r.code !== undefined && Number(r.code) !== 0 && !r.nombreTitular) {
    return { domiciliada: false, mensaje: texto(r.message) || 'Cuenta no domiciliada' };
  }
  const campo = (etiqueta: string, valor: unknown) => ({ etiqueta, valor: texto(valor) || 'Sin datos' });
  return {
    domiciliada: true,
    campos: [
      campo('Titular', r.nombreTitular),
      campo('Tipo de documento', r.desTipoDocumento),
      campo('Número de documento', r.nroDocumento),
      campo('Fecha de vencimiento', r.fechaVencimiento),
      campo('Banco', r.nombreBanco),
      campo('Tipo de tarjeta', r.desTipoTarjeta),
    ],
  };
}

// ── Histórico de documentos (tickets de Zoho Desk) ──────────────────

export interface PestanaHistorico {
  id: string;
  etiqueta: string;
  /** Categoría del ticket en Desk. */
  categoria: string;
  /** Valor de cf_tipo_de_documento. */
  tipoDocumento: string;
  columnas: readonly string[];
  filtros: readonly string[];
  tituloDetalle: string;
}

const COLUMNAS_HISTORICO = ['Cuenta', 'Fecha de solicitud', 'Monto total', 'Nro. Ticket', 'Estatus'] as const;
const FILTROS_HISTORICO = ['Cuenta', 'Estatus', 'Mes de solicitud'] as const;

const pestanaHistorico = (
  id: string,
  etiqueta: string,
  categoria: string,
  tipoDocumento: string,
): PestanaHistorico => ({
  id,
  etiqueta,
  categoria,
  tipoDocumento,
  columnas: COLUMNAS_HISTORICO,
  filtros: FILTROS_HISTORICO,
  tituloDetalle: 'Información del documento',
});

/** Las 6 pestañas del widget jQuery ("Documentos no fiscales" son los ajustes de factura). */
export const PESTANAS_HISTORICO: readonly PestanaHistorico[] = [
  pestanaHistorico('notasDebito', 'Notas de débito', 'Gestión de facturas', 'Nota de Débito'),
  pestanaHistorico('notasCredito', 'Notas de crédito', 'Gestión de facturas', 'Nota de Crédito'),
  pestanaHistorico('cargosVariables', 'Cargos variables', 'Gestión de facturas', 'Cargo variable'),
  pestanaHistorico('reelaboracion', 'Reelaborar factura', 'Solicitudes', 'Reelaboración de factura'),
  pestanaHistorico('facturaManual', 'Facturación manual', 'Solicitudes', 'Factura manual'),
  pestanaHistorico('noFiscales', 'Documentos no fiscales', 'Reclamo en Facturación', 'Ajuste de factura'),
];

/** Parámetros de GET /tickets/search (sin paginación). */
export function parametrosHistorico(
  pestana: PestanaHistorico,
  departamentoId: string,
  documentoSinPrefijo: string,
): Record<string, string> {
  return {
    departmentId: departamentoId,
    category: pestana.categoria,
    customField1: `cf_tipo_de_documento:${pestana.tipoDocumento}`,
    customField2: `cf_documento_de_identidad:${documentoSinPrefijo}`,
  };
}

/** Departamento de Desk de los documentos: Cobranzas (Hogar) o Administración de Ventas (Empresa). */
export function departamentoFacturacion(
  tipoCliente: unknown,
  departamentos: readonly { id: string; name: string }[],
  configurados: { cob: string | null; ave: string | null },
): { id: string; nombre: string } | null {
  const empresa = texto(tipoCliente).toUpperCase() === 'EMPRESA';
  const nombre = empresa ? 'Administración de Ventas' : 'Cobranzas';
  const configurado = empresa ? configurados.ave : configurados.cob;
  if (configurado) return { id: configurado, nombre };
  const patron = empresa ? /administraci[oó]n de ventas/i : /cobranza/i;
  const encontrado = departamentos.find((d) => patron.test(d.name));
  return encontrado ? { id: encontrado.id, nombre: encontrado.name } : null;
}

const detalle = (etiqueta: string, valor: unknown, extra: Partial<CampoDetalle> = {}): CampoDetalle => ({
  etiqueta,
  valor: texto(valor) || 'Sin información',
  ...extra,
});

/** Fila de la tabla del histórico (formato de @/shared/historial) a partir de un ticket de Desk. */
export function filaDocumentoDesk(t: Datos, pestana: PestanaHistorico): FilaHistorial {
  const cf = (t.cf ?? {}) as Datos;
  const moneda = texto(cf.cf_moneda_factura);
  const monto = texto(cf.cf_monto_total);
  const montoTexto = monto ? `${moneda ? `${moneda} ` : ''}${monto}` : '';
  const solicitud = fechaDeIso(cf.cf_fecha_de_creacion) || fechaDeIso(t.createdTime);
  const [, mes = '', anio = ''] = solicitud.split('/');
  const asignado = t.assignee as { firstName?: unknown; lastName?: unknown } | null | undefined;
  const producto = t.product as { productName?: unknown } | null | undefined;
  const departamento = t.department as { name?: unknown } | null | undefined;
  const cuenta = texto(cf.cf_numero_de_cuenta);
  return {
    clave: texto(t.id),
    celdas: [cuenta, solicitud, montoTexto, texto(t.ticketNumber), texto(t.status)].map((c) => c || '-'),
    filtros: [
      cuenta ? [cuenta] : [],
      texto(t.status) ? [texto(t.status)] : [],
      mes && anio ? [`${mes}/${anio}`] : [],
    ],
    detalle: [
      detalle('Nro. Ticket', t.ticketNumber, { url: texto(t.webUrl) || undefined }),
      detalle('Estatus', t.status),
      detalle('Fecha de solicitud', solicitud),
      detalle('Cuenta', cuenta),
      detalle('Departamento', departamento?.name),
      detalle('Asunto', t.subject),
      producto ? detalle('Producto', producto.productName) : detalle('Contratos', cf.cf_contratos),
      detalle('Categoría', t.category),
      detalle('Subcategoría', t.subCategory),
      detalle(
        'Propietario del ticket',
        asignado ? `${texto(asignado.firstName)} ${texto(asignado.lastName)}` : '',
      ),
      detalle('Concepto', cf.cf_concepto),
      detalle('Monto sin IVA', cf.cf_monto_sin_iva),
      detalle('% IVA', cf.cf_porcentaje_iva),
      detalle('Monto total', montoTexto),
      detalle('Descripción', t.description, { tipo: 'html' }),
      detalle('Resolución', t.resolution, { tipo: 'html' }),
    ],
    momento: new Date(texto(t.createdTime)).getTime(),
    resumen: {
      negocio: texto(cf.cf_tipo_cliente),
      cuenta,
      fecha: solicitud,
      titulo: `${pestana.tipoDocumento} · Ticket ${texto(t.ticketNumber)}`,
      ...(texto(t.status) && { estado: texto(t.status) }),
      campos: montoTexto ? [{ etiqueta: 'Monto total', valor: montoTexto }] : [],
    },
  };
}

/** Tickets del más reciente al más antiguo (sin fecha, al final). */
export function ordenarPorCreacion(tickets: readonly Datos[]): Datos[] {
  const fecha = (t: Datos) => {
    const n = new Date(texto(t.createdTime)).getTime();
    return Number.isNaN(n) ? -Infinity : n;
  };
  return [...tickets].sort((a, b) => fecha(b) - fecha(a));
}
