/**
 * Única puerta de entrada al SDK de Zoho (window.ZOHO).
 * Los módulos NUNCA llaman a ZOHO.* directamente: usan src/services/*, que se apoyan en estas funciones.
 */
import { tiempos } from '@/core/config';
import { ApiError, conTimeout } from '@/core/http/errores';
import type { PeticionConexion, PeticionHttp, ZohoSdk } from './tipos';

export function obtenerZoho(): ZohoSdk {
  if (!window.ZOHO) {
    throw new ApiError('El SDK de Zoho no está disponible. Abra el widget desde Zoho CRM.', {
      codigo: 'SIN_SDK',
    });
  }
  return window.ZOHO;
}

export function hayZoho(): boolean {
  return Boolean(window.ZOHO);
}

/**
 * ZOHO.CRM.HTTP devuelve el cuerpo como texto. La API de Netuno señala errores con `status_code`.
 */
export function parsearRespuesta<T = unknown>(texto: unknown): T {
  let datos: unknown;
  try {
    datos = typeof texto === 'string' ? JSON.parse(texto) : texto;
  } catch (causa) {
    throw new ApiError('Respuesta inválida del servidor.', { causa, respuesta: texto });
  }
  if (datos && typeof datos === 'object' && !Array.isArray(datos) && 'status_code' in datos) {
    const codigo = (datos as { status_code: string | number }).status_code;
    throw new ApiError(`Error del servidor: ${codigo}`, { codigo, respuesta: datos });
  }
  return datos as T;
}

interface OpcionesPeticion {
  timeoutMs?: number;
}

export async function httpGet<T = unknown>(
  peticion: PeticionHttp,
  opciones: OpcionesPeticion = {},
): Promise<T> {
  const texto = await conTimeout(
    obtenerZoho().CRM.HTTP.get(peticion),
    opciones.timeoutMs ?? tiempos.peticionMs,
  );
  return parsearRespuesta<T>(texto);
}

export async function httpPost<T = unknown>(
  peticion: PeticionHttp,
  opciones: OpcionesPeticion = {},
): Promise<T> {
  const texto = await conTimeout(
    obtenerZoho().CRM.HTTP.post(peticion),
    opciones.timeoutMs ?? tiempos.peticionMs,
  );
  return parsearRespuesta<T>(texto);
}

/**
 * CONNECTION.invoke responde `{ details: { statusMessage } }`. Devuelve directamente `statusMessage`.
 * Zoho Desk y CRM informan sus errores dentro de statusMessage (`errorCode` / `code`).
 */
export function extraerMensajeConexion<T = unknown>(respuesta: unknown): T {
  const mensaje = (respuesta as { details?: { statusMessage?: unknown } } | null)?.details?.statusMessage;
  if (mensaje === undefined) {
    throw new ApiError('Respuesta inesperada de la conexión.', { respuesta });
  }
  if (mensaje && typeof mensaje === 'object') {
    const { errorCode, message, status, code } = mensaje as Record<string, unknown>;
    if (errorCode) {
      throw new ApiError(String(message ?? `Error ${String(errorCode)}`), {
        codigo: String(errorCode),
        respuesta,
      });
    }
    if (status === 'error') {
      throw new ApiError(String(message ?? `Error ${String(code)}`), { codigo: String(code), respuesta });
    }
  }
  return mensaje as T;
}

export async function invocarConexion<T = unknown>(
  conexion: string,
  peticion: PeticionConexion,
  opciones: OpcionesPeticion = {},
): Promise<T> {
  const respuesta = await conTimeout(
    obtenerZoho().CRM.CONNECTION.invoke(conexion, { param_type: 1, parameters: {}, ...peticion }),
    opciones.timeoutMs ?? tiempos.peticionMs,
  );
  return extraerMensajeConexion<T>(respuesta);
}
