/**
 * Contraseñas del cliente. Origen: Netuno-Zoho-CRM-widgetContrasenas/app/index.js (rama nuevaFuncionalidad):
 * restablecerContrasena, restablecerNombre, restablecerNombreypw, abrirModalCambioCorreo, enviarCambioCorreo y
 * RegistrarCanalAtencion.
 */
import type { Contrato, Cuenta } from '@/shared/cuentas';
import { correoValido } from '@/shared/lib/correo';

export { correoValido };

// ── Gestiones ───────────────────────────────────────────────────────

/** Gestiones que van por POST /contrato/contrasena/restablecer. El cambio de correo de NetUno Go va aparte. */
export type TipoGestion = 'portal' | 'netunogo' | 'parental' | 'wifi-clave' | 'wifi-nombre' | 'wifi-ambos';

export interface TextosEvento {
  nombre: string;
  subtipo: string;
  descripcion: string;
}

export interface DefinicionGestion {
  titulo: string;
  /** Servicio sobre el que se hace la gestión (insignia del formulario). */
  insignia: string;
  /** Enumerado `servicio` de la API: 1 NetUno Go, 2 control parental, 3 portal web, 4 WiFi. */
  servicio: 1 | 2 | 3 | 4;
  pideClave: boolean;
  pideNombre: boolean;
  exito: string;
  /** Textos del evento en CRM: se conservan los del widget jQuery (incluidos sus espacios) para los reportes. */
  evento: TextosEvento;
}

export const GESTIONES: Readonly<Record<TipoGestion, DefinicionGestion>> = {
  portal: {
    titulo: 'Restablecer contraseña',
    insignia: 'Portal Web interno',
    servicio: 3,
    pideClave: true,
    pideNombre: false,
    exito: 'Contraseña reiniciada.',
    evento: {
      nombre: 'Restablecimiento (Contraseña de acceso a la web)',
      subtipo: 'Contraseña de acceso a la web',
      descripcion: 'Se ha reestablecido la contraseña de acceso a la web',
    },
  },
  netunogo: {
    titulo: 'Restablecer contraseña',
    insignia: 'NetUno Go',
    servicio: 1,
    pideClave: true,
    pideNombre: false,
    exito: 'Contraseña reiniciada.',
    evento: {
      nombre: 'Restablecimiento (Contraseña de acceso a Netuno GO)',
      subtipo: 'Contraseña de Netuno Go',
      descripcion: 'Se ha reestablecido la contraseña de acceso a Netuno GO',
    },
  },
  parental: {
    titulo: 'Restablecer control parental',
    insignia: 'Control parental',
    servicio: 2,
    pideClave: true,
    pideNombre: false,
    exito: 'Contraseña reiniciada.',
    evento: {
      nombre: 'Restablecimiento (Contraseña de acceso parental)',
      subtipo: 'Contraseña de control parental',
      descripcion: 'Se ha reestablecido la contraseña de acceso parental',
    },
  },
  'wifi-clave': {
    titulo: 'Cambio de contraseña',
    insignia: 'Internet WIFI',
    servicio: 4,
    pideClave: true,
    pideNombre: false,
    exito: 'Contraseña reiniciada.',
    evento: {
      nombre: 'Restablecimiento (Contraseña de acceso a  WIFI)',
      subtipo: 'Contraseña de WIFI',
      descripcion: 'Se ha reestablecido la contraseña de acceso a  WIFI',
    },
  },
  'wifi-nombre': {
    titulo: 'Cambio de nombre',
    insignia: 'Internet WIFI',
    servicio: 4,
    pideClave: false,
    pideNombre: true,
    exito: 'Cambio de nombre realizado con éxito.',
    evento: {
      nombre: 'Restablecimiento (SSID de WIFI)',
      subtipo: 'SSID de WIFI',
      descripcion: 'Se ha reestablecido la SSID  a  WIFI',
    },
  },
  'wifi-ambos': {
    titulo: 'Cambio de nombre y contraseña',
    insignia: 'Internet WIFI',
    servicio: 4,
    pideClave: true,
    pideNombre: true,
    exito: 'Contraseña reiniciada y nombre cambiado.',
    evento: {
      nombre: 'Restablecimiento (Contraseña y SSID de acceso a  WIFI)',
      subtipo: 'Contraseña y SSID de WIFI',
      descripcion: 'Se ha reestablecido la contraseña y el SSID de acceso a  WIFI',
    },
  },
};

/** Tipo de registro del evento en CRM (todas las gestiones de Contraseñas). */
export const REGISTRO_EVENTO = 'Modificación';

export function eventoCambioCorreo(anterior: string, nuevo: string, idProducto: string): TextosEvento {
  return {
    nombre: 'Modificación (Correo de acceso a Netuno GO)',
    subtipo: 'Correo de Netuno Go',
    descripcion: `Se ha cambiado el correo de acceso a Netuno GO de ${anterior} a ${nuevo} (contrato ${idProducto})`,
  };
}

// ── Servicios con contraseña ────────────────────────────────────────

const servicio = (c: Pick<Contrato, 'nombreServicio'>) =>
  String(c.nombreServicio ?? '')
    .trim()
    .toLowerCase();
export const esStreaming = (c: Pick<Contrato, 'nombreServicio'> | null | undefined) =>
  Boolean(c) && servicio(c as Contrato) === 'streaming';
export const esInternet = (c: Pick<Contrato, 'nombreServicio'> | null | undefined) =>
  Boolean(c) && servicio(c as Contrato) === 'internet';

/**
 * Gestiones del WiFi de Internet (nombre y contraseña de la red). Apagadas: el widget publicado solo muestra
 * NetUno Go; el WiFi viene de la rama en desarrollo del widget jQuery (nuevaFuncionalidad). Con `true` se
 * muestran también los contratos de Internet (las acciones ya están hechas y probadas).
 */
export const GESTION_WIFI_ACTIVA = false;

/** Servicios con contraseñas configurables, en cualquier posición de la lista: NetUno Go (Streaming). */
export function serviciosConContrasena(cuenta: Cuenta, conWifi = GESTION_WIFI_ACTIVA): Contrato[] {
  return (cuenta.contratos ?? []).filter((c) => esStreaming(c) || (conWifi && esInternet(c)));
}

/** GET /ont/wifi: la ONT permite cambiar el nombre y la contraseña del WiFi. */
export function wifiAdministrable(respuesta: unknown): boolean {
  return Boolean(
    respuesta && typeof respuesta === 'object' && (respuesta as { wifi?: unknown }).wifi === true,
  );
}

// ── Validaciones ────────────────────────────────────────────────────

export interface RequisitoClave {
  id: 'longitud' | 'mayuscula' | 'numero' | 'especial' | 'caracteres' | 'secuencias';
  texto: string;
  cumple: boolean;
}

/** Signos permitidos: puntuación ASCII sin comillas. */
const ESPECIAL = /[!#$%&()*+,\-./:;<=>?@[\\\]^_{|}~]/;
/** Solo caracteres ASCII visibles, sin comillas (la API rechaza comillas y tildes). */
const PERMITIDOS = /^[A-Za-z0-9!#$%&()*+,\-./:;<=>?@[\\\]^_{|}~]*$/;

/**
 * Requisitos de la contraseña. Combina la validación del widget jQuery (sin "123", "abc" ni "password") con
 * las reglas que informa la API en el código -2 (8 a 15 caracteres, una mayúscula, un número y un carácter
 * especial, sin comillas ni tildes).
 */
export function requisitosClave(clave: string): RequisitoClave[] {
  const minusculas = clave.toLowerCase();
  return [
    { id: 'longitud', texto: 'Entre 8 y 15 caracteres', cumple: clave.length >= 8 && clave.length <= 15 },
    { id: 'mayuscula', texto: 'Una letra mayúscula', cumple: /[A-Z]/.test(clave) },
    { id: 'numero', texto: 'Un número', cumple: /\d/.test(clave) },
    { id: 'especial', texto: 'Un carácter especial (p. ej. * _ - . , @ #)', cumple: ESPECIAL.test(clave) },
    {
      id: 'caracteres',
      texto: 'Sin espacios, comillas, tildes ni ñ',
      cumple: clave.length > 0 && PERMITIDOS.test(clave),
    },
    {
      id: 'secuencias',
      texto: 'Sin "123", "abc" ni la palabra "password"',
      cumple: clave.length > 0 && !['123', 'abc', 'password'].some((s) => minusculas.includes(s)),
    },
  ];
}

export const claveValida = (clave: string) => requisitosClave(clave).every((r) => r.cumple);

/** Nombre de la red (SSID): solo letras, números y guion bajo, sin espacios (máximo 32, límite del SSID). */
export function errorNombreRed(nombre: string): string | null {
  if (!nombre) return 'Debe ingresar el nombre.';
  if (/[^A-Za-z0-9_]/.test(nombre)) return 'El nombre no puede contener espacios ni caracteres especiales.';
  if (nombre.length > 32) return 'El nombre puede tener como máximo 32 caracteres.';
  return null;
}

export function errorCorreoNuevo(nuevo: string, anterior: string): string | null {
  const valor = nuevo.trim();
  if (!valor) return 'Debe ingresar el correo nuevo.';
  if (!correoValido(valor)) return 'El formato del correo no es válido (ej: usuario@dominio.com).';
  if (valor.toLowerCase() === anterior.trim().toLowerCase())
    return 'El correo nuevo debe ser distinto al anterior.';
  return null;
}

// ── Petición y respuesta ────────────────────────────────────────────

export interface ContextoGestion {
  /** Documento con prefijo (cedularif). */
  documento: string;
  /** Nombre del asesor en Zoho. */
  usuario: string;
  /** Correo del cliente en CRM. */
  correoCliente: string;
  /** Contrato del servicio (todas menos el portal web). */
  contrato?: Pick<Contrato, 'idProducto' | 'serial'> | null;
}

export interface ValoresGestion {
  clave?: string;
  nombre?: string;
}

/** Cuerpo de POST /contrato/contrasena/restablecer, campo por campo como el widget jQuery. */
export function cuerpoGestion(
  tipo: TipoGestion,
  valores: ValoresGestion,
  ctx: ContextoGestion,
): Record<string, unknown> {
  const { servicio: enumServicio } = GESTIONES[tipo];
  const base = { cedularif: ctx.documento, servicio: enumServicio, usuarioZoho: ctx.usuario };
  const serial = String(ctx.contrato?.serial ?? '');
  const contrato = ctx.contrato?.idProducto ?? '';
  switch (tipo) {
    case 'portal':
      return { ...base, correo: ctx.correoCliente, ssid: null, contrasena: valores.clave };
    case 'netunogo':
    case 'parental':
      // El correo de acceso de NetUno Go llega en el serial del contrato
      return { ...base, correo: serial, ssid: null, contrasena: valores.clave };
    case 'wifi-clave':
      return { ...base, correo: ctx.correoCliente, contrasena: valores.clave, ssid: null, contrato };
    case 'wifi-nombre':
      return { ...base, correo: serial, contrasena: null, ssid: valores.nombre, contrato };
    case 'wifi-ambos':
      return { ...base, correo: serial, contrasena: valores.clave, ssid: valores.nombre, contrato };
  }
}

export interface ResultadoGestion {
  tono: 'exito' | 'aviso' | 'error';
  mensaje: string;
}

const SIN_ENVIO = 'No se ha logrado enviar el comando. Consulte con el administrador.';
export const MENSAJE_CLAVE_INVALIDA =
  'La contraseña es inválida. Debe tener entre 8 y 15 caracteres e incluir al menos: una mayúscula, un número y un carácter especial (exceptuando comillas y tildes).';

/** Códigos de la API: 0 éxito, -2 contraseña inválida, -4 formato incorrecto. */
export function resultadoGestion(tipo: TipoGestion, respuesta: unknown): ResultadoGestion {
  const definicion = GESTIONES[tipo];
  const r = (respuesta && typeof respuesta === 'object' ? respuesta : {}) as {
    code?: unknown;
    message?: unknown;
  };
  const codigo = r.code === undefined || r.code === null || r.code === '' ? Number.NaN : Number(r.code);
  // Portal y NetUno Go también aceptaban message "Exitoso." (restablecerContrasena)
  if (codigo === 0 || (definicion.servicio !== 4 && r.message === 'Exitoso.')) {
    return { tono: 'exito', mensaje: definicion.exito };
  }
  if (codigo === -2 && definicion.pideClave) return { tono: 'error', mensaje: MENSAJE_CLAVE_INVALIDA };
  if (codigo === -4) {
    return {
      tono: 'error',
      mensaje: definicion.pideClave ? 'Formato de clave incorrecto.' : 'Formato del nombre incorrecto.',
    };
  }
  return { tono: 'error', mensaje: Number.isNaN(codigo) ? SIN_ENVIO : `${SIN_ENVIO} (código ${codigo})` };
}

/** POST /contrato/correo/streaming: `{ code: 0 }` si la plataforma aceptó el cambio. */
export const correoAceptado = (respuesta: unknown) =>
  Boolean(respuesta && typeof respuesta === 'object' && Number((respuesta as { code?: unknown }).code) === 0);

export interface ResultadoCorreo extends ResultadoGestion {
  /** Correo que muestra el contrato después del cambio (si se pudo consultar). */
  correoVigente?: string;
}

export const MENSAJE_CORREO_RECHAZADO =
  'No se pudo cambiar el correo de NetUno Go. Verifique los datos e intente nuevamente; si el problema persiste, consulte con el administrador.';

export const correoSinConfirmar = (idProducto: string): ResultadoCorreo => ({
  tono: 'aviso',
  mensaje: `Se envió el cambio a la plataforma, pero no se pudo confirmar el correo del contrato ${idProducto}. Verifique en unos minutos.`,
});

/** Compara el correo del contrato (GET /contrato, campo `serial`) con el solicitado. */
export function confirmacionCorreo(contrato: unknown, nuevo: string, idProducto: string): ResultadoCorreo {
  const serial =
    contrato && typeof contrato === 'object'
      ? String((contrato as { serial?: unknown }).serial ?? '').trim()
      : '';
  if (!serial) return correoSinConfirmar(idProducto);
  if (serial.toLowerCase() === nuevo.trim().toLowerCase()) {
    return { tono: 'exito', mensaje: `Correo de NetUno Go actualizado: ${serial}`, correoVigente: serial };
  }
  return {
    tono: 'aviso',
    mensaje: `Se envió el cambio a la plataforma, pero el contrato aún muestra ${serial}. Verifique en unos minutos.`,
    correoVigente: serial,
  };
}

/** Cambia el correo (serial) de un contrato en la lista de cuentas, sin mutarla. */
export function conCorreoActualizado(cuentas: Cuenta[], idProducto: string, correo: string): Cuenta[] {
  return cuentas.map((c) =>
    c.contratos?.some((x) => x.idProducto === idProducto)
      ? {
          ...c,
          contratos: c.contratos.map((x) => (x.idProducto === idProducto ? { ...x, serial: correo } : x)),
        }
      : c,
  );
}

// ── Evento en CRM ───────────────────────────────────────────────────

/**
 * Cuenta y contrato del evento: los del servicio de la gestión. El portal web no tiene contrato: se usa el primer
 * contrato de la primera cuenta, como el widget jQuery.
 */
export function cuentaYContratoDelEvento(
  cuentas: readonly Cuenta[],
  contrato: Contrato | null | undefined,
): { cuenta: Pick<Cuenta, 'cuenta'>; contrato: Partial<Contrato> | null } | null {
  if (contrato) {
    const duena = cuentas.find((c) => c.contratos?.some((x) => x.idProducto === contrato.idProducto));
    const codContrato =
      contrato.codContrato ??
      (String(contrato.idProducto).split('-').slice(2).join('-') || contrato.idProducto);
    return {
      cuenta: { cuenta: contrato.cuenta ?? duena?.cuenta ?? '' },
      contrato: { codContrato, ubicacionJSON: contrato.ubicacionJSON },
    };
  }
  const primera = cuentas[0];
  if (!primera) return null;
  return { cuenta: primera, contrato: primera.contratos?.[0] ?? null };
}
