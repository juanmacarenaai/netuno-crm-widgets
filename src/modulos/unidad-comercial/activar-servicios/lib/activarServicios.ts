/**
 * Activar servicios (pestaña de Administrar cuenta). Origen en el widget jQuery (UnidadComercialJS/app/index.js):
 * showTab → activarServicios (elegibilidad), activarServicios (paquetes), activeClickActivacion/marcaje
 * (selección única), continueActivarServicio (confirmación y formularios), validarDatosActivacion,
 * actualizarCRM_Y_Activar y activarServicio (cuerpo y resultado).
 */
import type { Contrato, Cuenta } from '@/shared/cuentas';
import { hoyIso } from '@/shared/lib/fechas';

export { hoyIso };

// ── Tipos de servicio ───────────────────────────────────────────────

export type TipoServicioActivable = 'premium' | 'netunogo' | 'telefonia' | 'salud';

/**
 * Parámetros de GET /consultar/servicios y de POST /activacion/servicios por tipo.
 * `paquete`: 1 = servicio nuevo, 2 = paquete Premium sobre un NetUnoGO existente.
 */
export const SERVICIOS_ACTIVABLES: Readonly<
  Record<
    TipoServicioActivable,
    { etiqueta: string; paquete: 1 | 2; codServicio: number; extra?: Readonly<Record<string, string>> }
  >
> = {
  premium: { etiqueta: 'NetUnoGO Premium', paquete: 2, codServicio: 6 },
  netunogo: { etiqueta: 'NetUnoGO', paquete: 1, codServicio: 6 },
  telefonia: { etiqueta: 'Telefonía', paquete: 1, codServicio: 4 },
  salud: {
    etiqueta: 'Salud',
    paquete: 1,
    codServicio: 7,
    extra: { solo911: '1', tipo: '1', codTipoVenta: '2' },
  },
};

/** Máximo de contratos de Salud (titular + adicionales) por cuenta. */
export const MAXIMO_SALUD = 5;

/** Telefonía se muestra con este precio fijo (el widget jQuery ignora el precio de la API). */
export const PRECIO_TELEFONIA = '$1';

const texto = (valor: unknown) =>
  String(valor ?? '')
    .trim()
    .toLowerCase();
const conectado = (c: Contrato) => texto(c.status) === 'conectado';

// ── Elegibilidad ────────────────────────────────────────────────────

export const MENSAJES_ELEGIBILIDAD = {
  empresa: 'Aún no disponible para unidad Empresa.',
  comercio: 'Aún no disponible para Comercios.',
  saldo: 'Cliente cuenta con factura pendiente por cancelar.',
  sinInternet: 'Debes tener activo el servicio de Internet Fibra.',
} as const;

export type Elegibilidad =
  | { ok: true; internet: Contrato }
  | { ok: false; motivo: keyof typeof MENSAJES_ELEGIBILIDAD; mensaje: string };

/** Internet FTTH conectado de la cuenta: es el contrato al que se asocian las activaciones. */
export function internetFibra(cuenta: Pick<Cuenta, 'contratos'>): Contrato | null {
  return (
    (cuenta.contratos ?? []).find(
      (c) => conectado(c) && texto(c.nombreServicio) === 'internet' && texto(c.tipoRed) === 'ftth',
    ) ?? null
  );
}

/**
 * Mismo orden que el widget jQuery: Empresa, Comercio (Hogar con RIF), factura pendiente.
 * Sin Internet FTTH conectado el widget jQuery fallaba sin aviso; aquí se muestra su mensaje "NoInternet".
 */
export function elegibilidadActivacion(cuenta: Cuenta): Elegibilidad {
  const no = (motivo: keyof typeof MENSAJES_ELEGIBILIDAD): Elegibilidad => ({
    ok: false,
    motivo,
    mensaje: MENSAJES_ELEGIBILIDAD[motivo],
  });
  const tipoCliente = Number(cuenta.codTipoCliente);
  if (tipoCliente === 2) return no('empresa');
  if (tipoCliente === 1 && Number(cuenta.tipoIdentificacion) === 2) return no('comercio');
  if (Number(cuenta.saldo) > 0) return no('saldo');
  const internet = internetFibra(cuenta);
  return internet ? { ok: true, internet } : no('sinInternet');
}

/**
 * Servicios que se consultan: Premium si ya tiene NetUnoGO (si no, NetUnoGO), Telefonía si no tiene,
 * y Salud mientras tenga menos de 5 contratos.
 */
export function serviciosAConsultar(cuenta: Pick<Cuenta, 'contratos'>): TipoServicioActivable[] {
  const contratos = (cuenta.contratos ?? []).filter(conectado);
  const de = (servicio: string) => contratos.filter((c) => texto(c.nombreServicio) === servicio);
  const tieneNetunogo = de('streaming').some((c) => texto(c.nombrePaquete).includes('netunogo'));
  const tipos: TipoServicioActivable[] = [tieneNetunogo ? 'premium' : 'netunogo'];
  if (de('telefonía').length === 0) tipos.push('telefonia');
  if (de('salud').length < MAXIMO_SALUD) tipos.push('salud');
  return tipos;
}

/** Parámetros de GET /consultar/servicios para un tipo. */
export function parametrosConsulta(
  tipo: TipoServicioActivable,
  datos: { documento: string; idProducto: string },
): Record<string, string> {
  const { paquete, codServicio, extra } = SERVICIOS_ACTIVABLES[tipo];
  return {
    paquete: String(paquete),
    cedularif: datos.documento,
    contrato: datos.idProducto,
    codServicio: String(codServicio),
    ...extra,
  };
}

// ── Paquetes ────────────────────────────────────────────────────────

export interface PaqueteActivable {
  codigo: string;
  /** Nombre que se muestra (Premium sin el prefijo "Paquete Premium "). */
  nombre: string;
  /** "$4.99" */
  precio: string;
  servicio: TipoServicioActivable;
}

interface PrecioApi {
  Moneda?: unknown;
  Precio?: unknown;
}
export interface MensualidadApi {
  Codigo?: unknown;
  Paquete?: unknown;
  /** Premium, NetUnoGO y Telefonía: lista; Salud: valor plano junto a `Moneda`. */
  Precio?: PrecioApi[] | string | number | null;
  Moneda?: unknown;
}
export interface RespuestaServicios {
  mensualidad?: MensualidadApi[] | null;
  [campo: string]: unknown;
}

const cadena = (valor: unknown) => String(valor ?? '').trim();

function precioDeLista(m: MensualidadApi): string {
  const p = Array.isArray(m.Precio) ? m.Precio[0] : undefined;
  return p ? `${cadena(p.Moneda)}${cadena(p.Precio)}` : '';
}

/** Convierte la respuesta de /consultar/servicios en paquetes, como activarServicios() del widget jQuery. */
export function paquetesDesdeRespuesta(
  tipo: TipoServicioActivable,
  respuesta: RespuestaServicios | null | undefined,
): PaqueteActivable[] {
  const mensualidad = Array.isArray(respuesta?.mensualidad) ? respuesta.mensualidad : [];
  return mensualidad.map((m) => {
    const paquete = cadena(m.Paquete);
    let nombre = paquete;
    let precio: string;
    if (tipo === 'premium') {
      if (paquete.toLowerCase().includes('paquete')) nombre = paquete.replace('Paquete Premium ', '');
      precio = precioDeLista(m);
    } else if (tipo === 'telefonia') {
      precio = PRECIO_TELEFONIA;
    } else if (tipo === 'salud') {
      const moneda = cadena(m.Moneda) || '$';
      const valor = Array.isArray(m.Precio) ? '' : cadena(m.Precio);
      precio = `${moneda}${valor || '0'}`;
    } else {
      precio = precioDeLista(m);
    }
    return { codigo: cadena(m.Codigo), nombre, precio, servicio: tipo };
  });
}

// ── Requisitos de la confirmación ───────────────────────────────────

export type TipoSalud = 'titular' | 'adicional' | 'otro';

/** "Beneficiario ppal" = póliza del titular; "Beneficiario adicional" = póliza de un familiar. */
export function tipoSalud(nombre: string): TipoSalud {
  const n = nombre.toLowerCase();
  if (n.includes('beneficiario ppal')) return 'titular';
  if (n.includes('beneficiario adicional')) return 'adicional';
  return 'otro';
}

export type Sexo = 'F' | 'M';

/** Campo "Sexo" de la cuenta en CRM ("Femenino" / "Masculino") a F/M. Vacío = falta el dato. */
export function sexoDesdeCrm(valor: unknown): Sexo | null {
  const v = cadena(valor);
  if (!v) return null;
  return v === 'Femenino' ? 'F' : 'M';
}
export const sexoParaCrm = (sexo: Sexo) => (sexo === 'F' ? 'Femenino' : 'Masculino');

/** Fecha "AAAA-MM-DD" del campo Fecha_de_nacimiento de CRM, o null si falta. */
export function fechaDesdeCrm(valor: unknown): string | null {
  return cadena(valor) || null;
}

export interface Requisitos {
  /** NetUnoGO: correo de acceso. */
  correoNetunoGo: boolean;
  /** Datos del titular de la póliza que faltan en CRM. */
  titular: { sexo: boolean; fechaNacimiento: boolean };
  /** Salud adicional: formulario del beneficiario. */
  beneficiario: boolean;
}

export function requisitosActivacion(
  paquete: Pick<PaqueteActivable, 'servicio' | 'nombre'>,
  registro: Record<string, unknown>,
): Requisitos {
  const salud = paquete.servicio === 'salud' ? tipoSalud(paquete.nombre) : null;
  const pideTitular = salud === 'titular' || salud === 'adicional';
  return {
    correoNetunoGo: paquete.servicio === 'netunogo',
    titular: {
      sexo: pideTitular && sexoDesdeCrm(registro.Sexo) === null,
      fechaNacimiento: pideTitular && fechaDesdeCrm(registro.Fecha_de_nacimiento) === null,
    },
    beneficiario: salud === 'adicional',
  };
}

// ── Formulario ──────────────────────────────────────────────────────

export const TIPOS_DOCUMENTO = [
  { valor: 'V', etiqueta: 'Venezolano' },
  { valor: 'E', etiqueta: 'Extranjero' },
  { valor: 'P', etiqueta: 'Menor de edad (Sin cédula)' },
  { valor: 'B', etiqueta: 'Menor de edad (Con cédula)' },
] as const;
export const CODIGOS_CELULAR = ['0414', '0424', '0412', '0422', '0416', '0426'] as const;
export const ESTADOS_CIVILES = [
  { valor: 'C', etiqueta: 'Casado' },
  { valor: 'S', etiqueta: 'Soltero' },
  { valor: 'D', etiqueta: 'Divorciado' },
] as const;
export const PARENTESCOS = [
  { valor: '2', etiqueta: 'Conyuge' },
  { valor: '3', etiqueta: 'Hijo(A)' },
  { valor: '4', etiqueta: 'Hermano(A)' },
  { valor: '31', etiqueta: 'Padre/Madre' },
  { valor: '32', etiqueta: 'Otro parentesco' },
] as const;
export const SEXOS = [
  { valor: 'F', etiqueta: 'Femenino' },
  { valor: 'M', etiqueta: 'Masculino' },
] as const;

/** Tipo de documento "P" (menor sin cédula): no se pide el número. */
export const SIN_DOCUMENTO = 'P';

export interface DatosBeneficiario {
  nombre: string;
  apellido: string;
  tipoDocumento: string;
  nDocumento: string;
  correo: string;
  nArea: string;
  nTelefono: string;
  estadoCivil: string;
  cParentesco: string;
  fNacimiento: string;
  sexo: string;
}

export interface FormularioActivacion {
  correo: string;
  titular: { sexo: string; fechaNacimiento: string };
  beneficiario: DatosBeneficiario;
}

export const FORMULARIO_VACIO: FormularioActivacion = {
  correo: '',
  titular: { sexo: '', fechaNacimiento: '' },
  beneficiario: {
    nombre: '',
    apellido: '',
    tipoDocumento: '',
    nDocumento: '',
    correo: '',
    nArea: '',
    nTelefono: '',
    estadoCivil: '',
    cParentesco: '',
    fNacimiento: '',
    sexo: '',
  },
};

/** Mensajes de error del widget jQuery (más los de formato, que son nuevos). */
export const MENSAJES_FORMULARIO = {
  correo: 'Debe ingresar el correo',
  correoBeneficiario: 'Debe ingresar el correo del beneficiario',
  correoInvalido: 'El correo no es válido',
  titularSexo: 'Debe seleccionar el sexo del titular',
  titularFecha: 'Debe seleccionar la fecha de nacimiento del titular',
  nombre: 'Debe ingresar el nombre del beneficiario',
  apellido: 'Debe ingresar el apellido del beneficiario',
  tipoDocumento: 'Debe ingresar el tipo de documento',
  nDocumento: 'Debe ingresar el nro. de documento',
  nArea: 'Debe ingresar el código',
  nTelefono: 'Debe ingresar el celular',
  nTelefonoInvalido: 'El celular debe tener 7 dígitos',
  estadoCivil: 'Debe ingresar el edo.civil',
  cParentesco: 'Debe ingresar el parentesco',
  fNacimiento: 'Debe seleccionar la fecha de nacimiento',
  fechaFutura: 'La fecha no puede ser posterior a hoy',
  sexo: 'Debe seleccionar el sexo del beneficiario',
} as const;

export type CampoError =
  'correo' | 'titular.sexo' | 'titular.fechaNacimiento' | `beneficiario.${keyof DatosBeneficiario}`;
export type ErroresActivacion = Partial<Record<CampoError, string>>;

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function errorFecha(valor: string, vacio: string, hoy: string): string | undefined {
  if (!valor.trim()) return vacio;
  if (valor > hoy) return MENSAJES_FORMULARIO.fechaFutura;
  return undefined;
}

/** Valida todos los campos a la vez (como el widget jQuery con el beneficiario). */
export function validarActivacion(
  requisitos: Requisitos,
  f: FormularioActivacion,
  hoy = hoyIso(),
): ErroresActivacion {
  const e: ErroresActivacion = {};
  if (requisitos.correoNetunoGo) {
    if (!f.correo.trim()) e.correo = MENSAJES_FORMULARIO.correo;
    else if (!CORREO.test(f.correo.trim())) e.correo = MENSAJES_FORMULARIO.correoInvalido;
  }
  if (requisitos.titular.sexo && !f.titular.sexo) e['titular.sexo'] = MENSAJES_FORMULARIO.titularSexo;
  if (requisitos.titular.fechaNacimiento) {
    const error = errorFecha(f.titular.fechaNacimiento, MENSAJES_FORMULARIO.titularFecha, hoy);
    if (error) e['titular.fechaNacimiento'] = error;
  }
  if (requisitos.beneficiario) {
    const b = f.beneficiario;
    const vacio = (campo: keyof DatosBeneficiario) => !b[campo].trim();
    if (vacio('nombre')) e['beneficiario.nombre'] = MENSAJES_FORMULARIO.nombre;
    if (vacio('apellido')) e['beneficiario.apellido'] = MENSAJES_FORMULARIO.apellido;
    if (vacio('tipoDocumento')) e['beneficiario.tipoDocumento'] = MENSAJES_FORMULARIO.tipoDocumento;
    if (b.tipoDocumento !== SIN_DOCUMENTO && vacio('nDocumento')) {
      e['beneficiario.nDocumento'] = MENSAJES_FORMULARIO.nDocumento;
    }
    if (vacio('correo')) e['beneficiario.correo'] = MENSAJES_FORMULARIO.correoBeneficiario;
    else if (!CORREO.test(b.correo.trim())) e['beneficiario.correo'] = MENSAJES_FORMULARIO.correoInvalido;
    if (vacio('nArea')) e['beneficiario.nArea'] = MENSAJES_FORMULARIO.nArea;
    if (vacio('nTelefono')) e['beneficiario.nTelefono'] = MENSAJES_FORMULARIO.nTelefono;
    else if (!/^\d{7}$/.test(b.nTelefono.trim())) {
      e['beneficiario.nTelefono'] = MENSAJES_FORMULARIO.nTelefonoInvalido;
    }
    if (vacio('estadoCivil')) e['beneficiario.estadoCivil'] = MENSAJES_FORMULARIO.estadoCivil;
    if (vacio('cParentesco')) e['beneficiario.cParentesco'] = MENSAJES_FORMULARIO.cParentesco;
    const fecha = errorFecha(b.fNacimiento, MENSAJES_FORMULARIO.fNacimiento, hoy);
    if (fecha) e['beneficiario.fNacimiento'] = fecha;
    if (vacio('sexo')) e['beneficiario.sexo'] = MENSAJES_FORMULARIO.sexo;
  }
  return e;
}

// ── Activación ──────────────────────────────────────────────────────

/** Correo del titular en base64, como lo envía el widget jQuery (btoa). */
export function correoBase64(correo: string): string {
  const bytes = new TextEncoder().encode(correo);
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario);
}

export interface DatosActivacion {
  paquete: PaqueteActivable;
  /** Internet FTTH de la cuenta. */
  internet: Pick<Contrato, 'idProducto'>;
  cuenta: Pick<Cuenta, 'cuenta' | 'documentoIdentificacion'>;
  registro: Record<string, unknown>;
  formulario: FormularioActivacion;
  /** Email del asesor sin dominio. */
  aliasUsuario: string;
}

/** Sexo y fecha de nacimiento del titular: los de CRM o, si faltan, los del formulario. */
export function datosTitular(registro: Record<string, unknown>, f: FormularioActivacion) {
  return {
    sexo: sexoDesdeCrm(registro.Sexo) ?? (f.titular.sexo as Sexo | ''),
    fechaNacimiento: fechaDesdeCrm(registro.Fecha_de_nacimiento) ?? f.titular.fechaNacimiento,
  };
}

/** Cuerpo de POST /activacion/servicios (activarServicio del widget jQuery). */
export function cuerpoActivacion(d: DatosActivacion): Record<string, unknown> {
  const { paquete, internet, cuenta, registro, formulario: f, aliasUsuario } = d;
  const { paquete: tipoPaquete, codServicio } = SERVICIOS_ACTIVABLES[paquete.servicio];
  const cedularif = cuenta.documentoIdentificacion ?? '';

  if (paquete.servicio !== 'salud') {
    return {
      cedularif,
      contrato: internet.idProducto,
      codServicio,
      paquete: tipoPaquete,
      // Telefonía no lleva correo; Premium lo envía vacío
      ...(paquete.servicio === 'telefonia'
        ? {}
        : { correo: paquete.servicio === 'netunogo' ? f.correo.trim() : '' }),
      idPaquete: paquete.codigo,
      usuarioRef: aliasUsuario,
    };
  }

  const salud = tipoSalud(paquete.nombre);
  const conTitular = salud !== 'otro';
  const titular = conTitular ? datosTitular(registro, f) : { sexo: '', fechaNacimiento: '' };
  const adicional = salud === 'adicional';
  const b = adicional ? f.beneficiario : FORMULARIO_VACIO.beneficiario;
  const parentesco = Number(b.cParentesco);
  return {
    codServicio,
    cedularif,
    sexoCliente: titular.sexo,
    fNacimientoCliente: titular.fechaNacimiento,
    correo: conTitular ? correoBase64(String(registro.email ?? '')) : '',
    idCuenta: String(cuenta.cuenta),
    // El idProducto tiene la forma "x-y-idContrato"
    idContratoFibra: internet.idProducto.split('-')[2],
    idPaquete: paquete.codigo,
    otp: '',
    validarOtp: adicional,
    usuarioRef: aliasUsuario,
    asociado: {
      nombre: b.nombre.trim(),
      apellido: b.apellido.trim(),
      tipoDocumento: b.tipoDocumento,
      // Menor sin cédula: documento del titular + "1"
      nDocumento: b.tipoDocumento === SIN_DOCUMENTO ? `${cedularif}1` : b.nDocumento.trim(),
      correo: b.correo.trim(),
      nArea: b.nArea,
      nTelefono: b.nTelefono.trim(),
      fNacimiento: b.fNacimiento,
      sexo: b.sexo,
      estadoCivil: b.estadoCivil,
      cParentesco: parentesco === 0 || Number.isNaN(parentesco) ? null : parentesco,
      ocupacion: '',
    },
  };
}

/** Salud titular o adicional: antes de activar se guardan sexo y fecha de nacimiento en la cuenta de CRM. */
export function actualizacionCuenta(
  d: Pick<DatosActivacion, 'paquete' | 'registro' | 'formulario'>,
): Record<string, unknown> & { id: string } {
  const titular = datosTitular(d.registro, d.formulario);
  return {
    id: String(d.registro.id ?? ''),
    Fecha_de_nacimiento: titular.fechaNacimiento,
    Sexo: sexoParaCrm(titular.sexo === 'F' ? 'F' : 'M'),
  };
}

export const debeActualizarCuenta = (paquete: Pick<PaqueteActivable, 'servicio' | 'nombre'>) =>
  paquete.servicio === 'salud' && tipoSalud(paquete.nombre) !== 'otro';

export interface RespuestaActivacion {
  respuesta?: unknown;
  code?: unknown;
  codaprobacion?: unknown;
  [campo: string]: unknown;
}

export interface ResultadoActivacion {
  ok: boolean;
  /** "✅ Completado - <paquete>" */
  texto: string;
  /** Línea que va en la descripción del evento de CRM. */
  historial: string;
}

/** `valor == numero` del widget jQuery para respuestas de la API (texto o número). */
const igualA = (valor: unknown, numero: number) =>
  valor !== null && valor !== undefined && typeof valor !== 'object' && Number(valor) === numero;

export function resultadoActivacion(
  respuesta: RespuestaActivacion | null | undefined,
  paquete: Pick<PaqueteActivable, 'nombre'>,
  internet: Pick<Contrato, 'idProducto'>,
): ResultadoActivacion {
  const ok =
    igualA(respuesta?.respuesta, 0) || igualA(respuesta?.code, 1) || igualA(respuesta?.codaprobacion, 0);
  return {
    ok,
    texto: `${ok ? '✅ Completado' : '❌ Ha ocurrido un error activando el servicio'} - ${paquete.nombre}`,
    historial: `Contrato: ${internet.idProducto}. Paquete: ${paquete.nombre}. Estatus: ${ok ? 'Exitoso' : 'Fallido'}.`,
  };
}

export const MENSAJE_ERROR_CONEXION =
  'Ocurrió un error al procesar la solicitud de activación del servicio. Inténtalo nuevamente más tarde.';

export const EVENTO_ACTIVACION = {
  nombre: 'Activación de servicio desde Zoho CRM',
  registro: 'Activación',
  subtipo: 'Activación de servicio',
  descripcion: (historial: string) => `Resultado de activación. Datos enviados: ${historial}`,
} as const;
