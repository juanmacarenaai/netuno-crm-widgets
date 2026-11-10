/**
 * Crear ticket (botón "Crear Ticket" de cada servicio). Origen en el widget jQuery (UnidadComercialJS/app/index.js):
 * crearTicket(event) → departamentos y diseño de Desk, campos dinámicos por tipo, carga automática de
 * datos (cf_*, cuenta, contacto, producto, categoría), validación (button-CrearTicket) y crearTicketZoho.
 */
import type { CampoDisenoDesk, DisenoTicketsDesk } from '@/services/desk.api';
import type { Contrato, Cuenta, UbicacionContrato } from '@/shared/cuentas';

// ── Diseño ──────────────────────────────────────────────────────────

export type TipoCampo =
  | 'LookUp'
  | 'Picklist'
  | 'Multiselect'
  | 'Text'
  | 'Textarea'
  | 'Phone'
  | 'Email'
  | 'Number'
  | 'Decimal'
  | 'Date'
  | 'DateTime'
  | 'Boolean'
  | 'Percent'
  | 'Currency'
  | 'URL';

const TIPOS: readonly string[] = [
  'LookUp',
  'Picklist',
  'Multiselect',
  'Text',
  'Textarea',
  'Phone',
  'Email',
  'Number',
  'Decimal',
  'Date',
  'DateTime',
  'Boolean',
  'Percent',
  'Currency',
  'URL',
];

export interface CampoTicket {
  api: string;
  etiqueta: string;
  tipo: TipoCampo;
  obligatorio: boolean;
  /** Picklist y Multiselect. */
  opciones: string[];
  defecto: string | null;
}

export interface SeccionTicket {
  nombre: string;
  campos: CampoTicket[];
  /** Secciones que el widget jQuery oculta al crear el ticket (se llenan después en Desk). */
  oculta: boolean;
  /** "RCJ": solo para clientes que no son Hogar. */
  soloNoHogar: boolean;
}

export const SECCIONES_OCULTAS = [
  'Información Visita Técnica',
  'Informacion de resolución',
  'Valoración del Servicio',
  'Información adicional',
  'Información de desconexión',
] as const;

/** Departamentos donde se precargan los datos técnicos del servicio. */
export const DEPARTAMENTOS_TECNICOS = ['Operaciones', 'NOC'] as const;

/** Valor "vacío" de las listas de Desk. */
export const NINGUNA = '--Ninguna--';

/** Campos con valor fijo (se muestran deshabilitados). */
export const VALORES_FIJOS: Readonly<Record<string, string>> = { channel: 'Interno', status: 'Nuevo' };

/**
 * Secciones y campos del diseño. Se omiten el departamento (se elige aparte) y los tipos no soportados.
 * El asunto siempre es obligatorio (el widget jQuery lo rotula "Asunto *").
 */
export function seccionesDelDiseno(diseno: DisenoTicketsDesk | null | undefined): SeccionTicket[] {
  return (diseno?.sections ?? []).map((seccion, s) => {
    const nombre = String(seccion.i18NLabel ?? '').trim();
    const campos = (seccion.fields ?? [])
      // El widget jQuery salta el primer campo de la primera sección (el departamento)
      .filter((campo, f) => !(s === 0 && f === 0) && campo.apiName !== 'departmentId')
      .filter((campo) => TIPOS.includes(campo.type))
      .map((campo) => campoTicket(campo));
    return {
      nombre,
      campos,
      oculta: (SECCIONES_OCULTAS as readonly string[]).includes(nombre),
      soloNoHogar: nombre === 'RCJ',
    };
  });
}

function campoTicket(campo: CampoDisenoDesk): CampoTicket {
  const asunto = campo.apiName === 'subject';
  return {
    api: campo.apiName,
    etiqueta: asunto ? 'Asunto' : String(campo.i18NLabel ?? campo.displayLabel ?? campo.apiName),
    tipo: campo.type as TipoCampo,
    obligatorio: asunto || Boolean(campo.isMandatory),
    opciones: Array.isArray(campo.allowedValues) ? campo.allowedValues.map(String) : [],
    defecto: campo.defaultValue ?? null,
  };
}

/** Secciones visibles para el tipo de cliente. */
export const seccionVisible = (s: SeccionTicket, tipoCliente: unknown) =>
  !s.oculta && !(s.soloNoHogar && tipoCliente === 'Hogar');

// ── Valores ─────────────────────────────────────────────────────────

export type ValorCampo = string | string[] | boolean;
export type Valores = Record<string, ValorCampo>;

export interface OpcionLookup {
  valor: string;
  etiqueta: string;
}

/** Valor vacío de cada tipo: Picklist toma el valor por defecto o la primera opción (como el navegador). */
export function valorVacio(campo: CampoTicket): ValorCampo {
  if (campo.tipo === 'Boolean') return false;
  if (campo.tipo === 'Multiselect') return [];
  if (campo.tipo === 'Picklist') {
    if (campo.defecto && campo.opciones.includes(campo.defecto)) return campo.defecto;
    return campo.opciones[0] ?? '';
  }
  return '';
}

/** Datos de los que se precarga el formulario. */
export interface ContextoTicket {
  cuenta: Pick<Cuenta, 'cuenta' | 'descTipoCliente'>;
  servicio: Contrato;
  registro: Record<string, unknown>;
  /** Contrato de BOSS (GET /contrato). */
  boss: {
    ubicacion?: UbicacionContrato[] | null;
    etiqueta?: unknown;
    listaPrecio?: unknown;
    alquilerEquipo?: unknown;
    coordenadasGps?: unknown;
    serial?: unknown;
    telefonogpo?: unknown;
  } | null;
  departamento: string;
  territorio: string;
  /** Producto de Desk que corresponde al servicio (si el diseño tiene "Producto"). */
  producto: OpcionLookup | null;
  nas: { tarjeta?: unknown; puerto?: unknown; ip?: unknown; idont?: unknown } | null;
  potencia: unknown;
}

const texto = (valor: unknown) => (valor === null || valor === undefined ? '' : String(valor));
const oSinDatos = (valor: unknown) => (valor === null || valor === undefined ? 'Sin datos' : String(valor));

/** "22/02/2022 10:00" → "2022-02-22". */
export function fechaInstalacion(valor: unknown): string {
  const [fecha] = texto(valor).split(' ');
  const [dia, mes, anio] = (fecha ?? '').split('/');
  return dia && mes && anio ? `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}` : '';
}

/** Subproducto de Desk: FTTH/FTTO → "FTTX". */
export const subProductoDesk = (tipoRed: unknown) =>
  tipoRed === 'FTTH' || tipoRed === 'FTTO' ? 'FTTX' : texto(tipoRed) || NINGUNA;

/** Valores que el widget jQuery carga solos. Solo se devuelven los campos que existen en el diseño. */
export function valoresAutomaticos(campos: readonly CampoTicket[], c: ContextoTicket): Valores {
  const r = c.registro;
  const u = c.boss?.ubicacion?.[0] ?? {};
  const empresa = c.cuenta.descTipoCliente === 'Empresa';
  const tecnico = (DEPARTAMENTOS_TECNICOS as readonly string[]).includes(c.departamento);
  const servicio = c.servicio.nombreServicio;
  const alquiler = c.boss?.alquilerEquipo === 'SI';

  const v: Record<string, ValorCampo> = {
    cf_tipo_de_documento_de_identidad: texto(r.cf_tipo_documento),
    cf_documento_de_identidad: texto(r.cf_documento_de_identidad),
    cf_clase_de_cliente: texto(r.Clase_de_cliente),
    cf_segmentacion: texto(r.Segmentaci_n),
    cf_direccion_1: texto((u as { direccion?: unknown }).direccion),
    cf_numero_de_cuenta: texto(c.cuenta.cuenta),
    cf_tipo_cliente: texto(c.cuenta.descTipoCliente),
    cf_id_cliente_crm: texto(r.id),
    cf_etiqueta: texto(c.boss?.etiqueta),
    cf_lista_de_precio: texto(c.boss?.listaPrecio),
    cf_estado: texto(u.estado),
    cf_ciudad: texto(u.ciudad),
    cf_municipio: texto(u.municipio),
    cf_parroquia: texto(u.parroquia),
    cf_sector: texto(u.urbanizacion),
    cf_urbanizacion: texto(u.urbanizacion),
    cf_avenida: texto(u.avCalle),
    cf_calle: texto(u.calle),
    cf_edificio: texto(u.edificioCasa),
    cf_nro_de_cliente: texto(r.Nro_de_Cliente),
    cf_operacion: c.territorio,
    ...VALORES_FIJOS,
  };
  if (empresa) {
    v.cf_nombre_de_persona_contacto = texto(r.contactTechnologyNames);
    v.cf_numero_de_telefono_persona_contacto = texto(r.contactTechnologyPhone);
    v.cf_correo_electronico_persona_contacto = texto(r.contactTechnologyEmail);
  }
  if (c.producto) {
    v.productId = c.producto.valor;
    // "X-Y-12345" → "12345" (vacío si no trae prefijos, como el widget jQuery)
    v.cf_id_producto = c.servicio.idProducto.split('-').slice(2).join('-');
    v.cf_contrato_completo = c.servicio.idProducto;
    v.cf_nodo = texto(c.servicio.nodo);
    v.cf_nombre_del_plan = texto(c.servicio.nombrePaquete);
    v.cf_sub_producto = subProductoDesk(c.servicio.tipoRed);
  }
  if (c.producto && tecnico) {
    const noAplica = (...apis: string[]) => apis.forEach((api) => (v[api] = 'No aplica'));
    const instalacion = fechaInstalacion(c.servicio.fechaInstalacion);
    if (instalacion) v.cf_fecha_instalacion = instalacion;
    v.cf_alquiler_de_equipo = alquiler;
    v.cf_gps = oSinDatos(c.boss?.coordenadasGps);
    if (servicio === 'Internet') {
      v.cf_serial_del_equipo = oSinDatos(c.servicio.serial);
      v.cf_numero_de_tarjeta = oSinDatos(c.nas?.tarjeta);
      v.cf_puerto = oSinDatos(c.nas?.puerto);
      v.cf_direccion_ip = oSinDatos(c.nas?.ip);
      v.cf_id_ont = oSinDatos(c.nas?.idont);
      v.cf_potencia_nas = oSinDatos(c.potencia);
      noAplica('cf_correo_electronico_netuno_go', 'cf_nro_telefonico');
    } else if (servicio === 'Streaming') {
      v.cf_serial_del_equipo = oSinDatos(c.servicio.serial);
      v.cf_correo_electronico_netuno_go = oSinDatos(c.servicio.serial);
      noAplica(
        'cf_numero_de_tarjeta',
        'cf_puerto',
        'cf_direccion_ip',
        'cf_nro_telefonico',
        'cf_potencia_nas',
      );
    } else if (servicio === 'Telefonía') {
      v.cf_serial_del_equipo = oSinDatos(c.boss?.serial);
      v.cf_nro_telefonico = oSinDatos(c.boss?.telefonogpo);
      noAplica(
        'cf_correo_electronico_netuno_go',
        'cf_numero_de_tarjeta',
        'cf_puerto',
        'cf_direccion_ip',
        'cf_potencia_nas',
      );
    }
  }

  const porApi = new Map(campos.map((campo) => [campo.api, campo]));
  const resultado: Valores = {};
  for (const [api, valor] of Object.entries(v)) {
    const campo = porApi.get(api);
    if (!campo) continue;
    if (campo.tipo === 'Boolean') resultado[api] = valor === true || valor === 'true';
    else resultado[api] = typeof valor === 'boolean' ? String(valor) : valor;
  }
  return resultado;
}

/** Valores iniciales: vacíos según el tipo, más los automáticos, cuenta, contacto, correo y teléfono. */
export function valoresIniciales(
  secciones: readonly SeccionTicket[],
  contexto: ContextoTicket,
  lookups: { cuenta: OpcionLookup | null; contacto: OpcionLookup | null },
  categorias: Record<string, string[]> = {},
): Valores {
  const campos = secciones.flatMap((s) => s.campos);
  const valores: Valores = Object.fromEntries(campos.map((campo) => [campo.api, valorVacio(campo)]));
  const existe = (api: string) => api in valores;
  Object.assign(valores, valoresAutomaticos(campos, contexto));
  if (lookups.cuenta && existe('accountId')) valores.accountId = lookups.cuenta.valor;
  if (lookups.contacto && existe('contactId')) valores.contactId = lookups.contacto.valor;
  const r = contexto.registro;
  if (lookups.cuenta) {
    if (existe('email')) valores.email = texto(r.email);
    if (existe('phone')) valores.phone = `${texto(r.Codigo_de_Celular)}-${texto(r.Tel_fono_Celular)}`;
  }
  // Subcategoría: la primera de la categoría inicial (apply_subCategory al cargar el diseño)
  if (existe('subCategory')) {
    const lista = categorias[String(valores.category ?? '')];
    if (lista) valores.subCategory = lista[0] ?? '';
  }
  return valores;
}

/** Opciones de la subcategoría: las de la categoría elegida o, si Desk no las define, las del diseño. */
export function opcionesSubcategoria(
  categorias: Record<string, string[]>,
  categoria: ValorCampo | undefined,
  campo: Pick<CampoTicket, 'opciones'>,
): string[] {
  return categorias[String(categoria ?? '')] ?? campo.opciones;
}

// ── Validación y parámetros ─────────────────────────────────────────

export const mensajeObligatorio = (campo: Pick<CampoTicket, 'etiqueta'>) =>
  `${campo.etiqueta} no puede estar en blanco`;

/** Descripción sin contenido: solo etiquetas vacías, saltos o espacios (y sin imágenes). */
export function htmlVacio(html: string): boolean {
  if (/<img\b/i.test(html)) return false;
  return (
    html
      .replace(/<br\s*\/?>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim() === ''
  );
}

function vacio(campo: CampoTicket, valor: ValorCampo | undefined): boolean {
  if (campo.tipo === 'Boolean') return valor !== true;
  if (Array.isArray(valor)) return valor.length === 0;
  const v = String(valor ?? '');
  if (campo.api === 'description') return htmlVacio(v);
  if (campo.tipo === 'Picklist' || campo.tipo === 'LookUp') return v === '' || v === NINGUNA;
  return v.trim() === '';
}

/**
 * Valida los obligatorios de las secciones visibles y arma los parámetros del ticket:
 * campos "cf_*" en `cf`, el resto en la raíz; Multiselect separado por ";"; DateTime en ISO.
 * Los campos de secciones ocultas se envían si tienen valor, pero no se exigen.
 */
export function parametrosTicket(
  secciones: readonly SeccionTicket[],
  valores: Valores,
  departamentoId: string,
  tipoCliente: unknown,
): { errores: Record<string, string>; parametros: Record<string, unknown> } {
  const errores: Record<string, string> = {};
  const raiz: Record<string, unknown> = { departmentId: departamentoId };
  const cf: Record<string, unknown> = {};

  for (const seccion of secciones) {
    const visible = seccionVisible(seccion, tipoCliente);
    for (const campo of seccion.campos) {
      const valor = valores[campo.api];
      if (visible && campo.obligatorio && vacio(campo, valor)) {
        errores[campo.api] = mensajeObligatorio(campo);
        continue;
      }
      let enviar: unknown;
      if (campo.tipo === 'Boolean') enviar = valor === true;
      else if (Array.isArray(valor)) enviar = valor.length ? valor.join(';') : undefined;
      else {
        const v = String(valor ?? '');
        if (campo.api !== 'description' && v.trim() === '') enviar = undefined;
        else if (campo.api === 'description' && htmlVacio(v)) enviar = undefined;
        else if (campo.tipo === 'DateTime') enviar = new Date(v).toISOString();
        else enviar = campo.api === 'description' ? v : v.trim();
      }
      if (enviar === undefined) continue;
      if (campo.api.startsWith('cf_')) cf[campo.api] = enviar;
      else raiz[campo.api] = enviar;
    }
  }
  return { errores, parametros: { ...raiz, cf } };
}

// ── Ticket existente ────────────────────────────────────────────────

export const TIPOS_ABIERTOS = ['Open', 'On Hold'] as const;

/** "Ya existe un ticket abierto/en progreso para este cliente." */
export function mensajeTicketExistente(statusType: unknown): string {
  return `Ya existe un ticket ${statusType === 'Open' ? 'abierto' : 'en progreso'} para este cliente.`;
}
