/**
 * Zoho CRM.
 * - Registro y usuario del contexto: métodos del SDK de widgets (ZOHO.CRM.API / CONFIG).
 * - Todo lo demás: API REST v8 a través de la conexión `entorno.conexiones.crm`.
 *   Reemplaza las llamadas a /crm/v2 y /crm/v7 de los widgets jQuery.
 */
import { entorno } from '@/core/config';
import { ApiError } from '@/core/http/errores';
import { invocarConexion, obtenerZoho } from '@/core/zoho/sdk';
import type {
  MetodoHttp,
  Registro,
  RespuestaRegistros,
  ResultadoEscritura,
  UsuarioCrm,
} from '@/core/zoho/tipos';

// ── SDK de widgets ───────────────────────────────────────────────

export async function obtenerUsuarioActual(): Promise<UsuarioCrm> {
  const respuesta = await obtenerZoho().CRM.CONFIG.getCurrentUser();
  const usuario = respuesta?.users?.[0];
  if (!usuario) throw new ApiError('No se encontraron datos del usuario actual.');
  return usuario;
}

/** Usuario con sus campos personalizados (Departamento, Almacen...). */
export async function obtenerUsuario(id: string): Promise<Registro | null> {
  const respuesta = await obtenerZoho().CRM.API.getUser({ ID: id });
  return respuesta?.users?.[0] ?? null;
}

/** Información de la organización de CRM. No todas las versiones del SDK la exponen. */
export async function obtenerOrganizacion(): Promise<unknown> {
  const getOrgInfo = obtenerZoho().CRM.CONFIG.getOrgInfo;
  if (!getOrgInfo)
    throw new ApiError('Esta versión del SDK no expone CONFIG.getOrgInfo.', { codigo: 'NO_SOPORTADO' });
  return getOrgInfo();
}

export async function obtenerRegistro(entidad: string, id: string): Promise<Registro> {
  const respuesta = await obtenerZoho().CRM.API.getRecord({ Entity: entidad, RecordID: id });
  const registro = respuesta?.data?.[0];
  if (!registro) throw new ApiError(`No se pudo leer el registro ${id} de ${entidad} en Zoho CRM.`);
  return registro;
}

function verificarEscritura(respuesta: { data?: ResultadoEscritura[] }, accion: string): ResultadoEscritura {
  const resultado = respuesta?.data?.[0];
  if (resultado?.code !== 'SUCCESS') {
    throw new ApiError(resultado?.message || `Zoho CRM no confirmó ${accion}.`, {
      codigo: resultado?.code,
      respuesta,
    });
  }
  return resultado;
}

/** Crea un registro (p. ej. en Eventos: "Registrar canal de atención"). */
export async function insertarRegistro(
  entidad: string,
  datos: Record<string, unknown>,
): Promise<ResultadoEscritura> {
  const respuesta = await obtenerZoho().CRM.API.insertRecord({ Entity: entidad, APIData: datos });
  return verificarEscritura(respuesta, 'el registro');
}

/** Actualiza un registro. `disparadores` (p. ej. ["workflow"]) ejecuta las reglas de flujo de trabajo. */
export async function actualizarRegistro(
  entidad: string,
  datos: Record<string, unknown> & { id: string },
  { disparadores }: { disparadores?: string[] } = {},
): Promise<ResultadoEscritura> {
  const respuesta = await obtenerZoho().CRM.API.updateRecord({
    Entity: entidad,
    APIData: datos,
    ...(disparadores ? { Trigger: disparadores } : {}),
  });
  return verificarEscritura(respuesta, 'la actualización');
}

// ── API REST v8 (conexión) ───────────────────────────────────────

function v8<T>(metodo: MetodoHttp, ruta: string, parametros: Record<string, unknown> = {}): Promise<T> {
  return invocarConexion<T>(entorno.conexiones.crm, {
    method: metodo,
    url: `${entorno.crm.apiBase}${ruta}`,
    param_type: metodo === 'GET' ? 1 : 2,
    parameters: parametros,
  });
}

export const crmV8 = {
  /** GET libre sobre la API v8, p. ej. `crmV8.get('/settings/modules')`. */
  get: <T = unknown>(ruta: string, parametros?: Record<string, unknown>) => v8<T>('GET', ruta, parametros),

  /** POST libre sobre la API v8, p. ej. `crmV8.post('/Accounts/1/actions/send_mail', cuerpo)`. */
  post: <T = unknown>(ruta: string, cuerpo: Record<string, unknown>) => v8<T>('POST', ruta, cuerpo),

  /** Un registro. `campos` limita la respuesta (la API v8 exige `fields` en las consultas de listas). */
  async registro<T extends Registro = Registro>(modulo: string, id: string, campos?: string[]): Promise<T> {
    const respuesta = await v8<RespuestaRegistros<T>>(
      'GET',
      `/${modulo}/${id}`,
      campos ? { fields: campos.join(',') } : {},
    );
    const registro = respuesta?.data?.[0];
    if (!registro) throw new ApiError(`No se encontró el registro ${id} en ${modulo}.`);
    return registro;
  },

  /** Búsqueda por criterio, p. ej. `(Cuenta:equals:1524542)`. Sin resultados devuelve una lista vacía. */
  async buscar<T extends Registro = Registro>(
    modulo: string,
    criterio: string,
    opciones: { pagina?: number; porPagina?: number } = {},
  ): Promise<T[]> {
    const respuesta = await v8<RespuestaRegistros<T> | ''>('GET', `/${modulo}/search`, {
      criteria: criterio,
      page: opciones.pagina ?? 1,
      per_page: opciones.porPagina ?? 200,
    });
    // La API responde 204 (sin cuerpo) cuando no hay coincidencias
    return respuesta && typeof respuesta === 'object' ? (respuesta.data ?? []) : [];
  },
};
