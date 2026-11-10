/**
 * Registro de conexiones en Catalyst (proyecto "connectionlog"; registrarLog de los widgets jQuery).
 * Guarda cada consulta a una API: método, endpoint, parámetros, respuesta, estado y duración.
 * No bloquea ni falla: si no hay clave o el registro no responde, solo se informa en la consola.
 * A diferencia del widget jQuery, NO se envían las cabeceras (llevaban client_id y client_secret).
 */
import { credenciales, entorno } from '@/core/config';
import { httpPost } from '@/core/zoho/sdk';

const LIMITE_RESPUESTA = 30_000;

export interface Conexion {
  metodo: string;
  endpoint: string;
  parametros?: unknown;
  respuesta: unknown;
  estado: string | number;
  duracionMs: number;
}

/** "2026-11-05 14:03:09" en hora de Caracas. */
export function fechaHoraCaracas(fecha = new Date()): string {
  return fecha
    .toLocaleString('sv-SE', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    .replace(', ', ' ');
}

export function registrarConexion(conexion: Conexion, contexto: { funcionalidad: string; sesion: string }) {
  if (!credenciales.catalyst.zcfkeyRegistro) return;
  const respuesta = JSON.stringify(conexion.respuesta ?? null);
  httpPost({
    url: entorno.catalyst.registroConexiones,
    headers: { ZCFKEY: credenciales.catalyst.zcfkeyRegistro, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      METHOD: conexion.metodo,
      ENDPOINT: conexion.endpoint,
      REQUEST_HEADERS: '{}',
      REQUEST_BODY: conexion.parametros ?? {},
      RESPONSE_BODY:
        respuesta.length > LIMITE_RESPUESTA ? `${respuesta.slice(0, LIMITE_RESPUESTA)}…` : respuesta,
      STATUS_CODE: String(conexion.estado),
      DURATION_MS: `${conexion.duracionMs}ms`,
      CREATED_AT: fechaHoraCaracas(),
      CHANNEL: 'Zoho CRM',
      BOTNAME: '-',
      SESSIONID: contexto.sesion,
      FUNCTIONALITY: contexto.funcionalidad,
      INSTANCEID: '87011000000023022',
    }),
  }).catch((error: unknown) => console.warn('No se registró la conexión en Catalyst:', error));
}

/**
 * Ejecuta una consulta y la registra (éxito o error). Devuelve el resultado o relanza el error.
 */
export async function conRegistro<T>(
  datos: Omit<Conexion, 'respuesta' | 'estado' | 'duracionMs'>,
  contexto: { funcionalidad: string; sesion: string },
  consulta: () => Promise<T>,
): Promise<T> {
  const inicio = Date.now();
  try {
    const resultado = await consulta();
    registrarConexion(
      { ...datos, respuesta: resultado, estado: 200, duracionMs: Date.now() - inicio },
      contexto,
    );
    return resultado;
  } catch (error) {
    const { codigo, message } = error as { codigo?: string | number; message?: string };
    registrarConexion(
      {
        ...datos,
        respuesta: message ?? String(error),
        estado: codigo ?? '500/Timeout',
        duracionMs: Date.now() - inicio,
      },
      contexto,
    );
    throw error;
  }
}
