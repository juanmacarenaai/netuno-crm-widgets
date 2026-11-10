/**
 * Funciones de Catalyst del proyecto "crm" (org 884905664), llamadas con ZOHO.CRM.HTTP y la cabecera ZCFKEY.
 * La URL base depende del entorno (src/core/config/entornos.ts → catalyst.funciones).
 */
import { credenciales, entorno } from '@/core/config';
import { ApiError } from '@/core/http/errores';
import { httpGet, httpPost } from '@/core/zoho/sdk';

function cabeceras(): Record<string, string> {
  if (!credenciales.catalyst.zcfkey) {
    throw new ApiError(
      'Falta VITE_ZCFKEY_CATALYST en .env.local: no se pueden llamar las funciones de Catalyst.',
      {
        codigo: 'SIN_ZCFKEY',
      },
    );
  }
  return { ZCFKEY: credenciales.catalyst.zcfkey, Accept: '*/*' };
}

async function get<T = unknown>(ruta: string): Promise<T> {
  return httpGet<T>({ url: `${entorno.catalyst.funciones}${ruta}`, headers: cabeceras() });
}

async function post<T = unknown>(ruta: string, cuerpo: unknown): Promise<T> {
  return httpPost<T>({
    url: `${entorno.catalyst.funciones}${ruta}`,
    headers: { ...cabeceras(), 'Content-Type': 'application/json' },
    body: cuerpo,
  });
}

export interface RespuestaTerritorio {
  data?: { parent?: { name?: string } | null; territory?: { name?: string } | null } | null;
}

/** Territorio de Catalyst: el padre si existe; si no, el propio. */
export function nombreTerritorio(respuesta: RespuestaTerritorio | null | undefined): string {
  return respuesta?.data?.parent?.name ?? respuesta?.data?.territory?.name ?? '';
}

export const catalystApi = {
  /** Eventos masivos (tickets padre) cuya cobertura incluye la ubicación del servicio (TEM). */
  eventosMasivosPorCobertura: <T = unknown>(cobertura: unknown) =>
    post<{ data?: T[] | null }>('/massive_failure/searchByCoverage', cobertura),
  /** Posible evento masivo del nodo (PEM): `code` 1001 = afectado; sin `code`, 1002 o 1003 = no. */
  posibleEventoMasivo: (nodo: string) =>
    get<{ code?: number | string }>(
      `/possibleMassiveFailure/affectedNode?nasNode=${encodeURIComponent(nodo)}`,
    ),

  /**
   * Sube un archivo y devuelve su URL pública (Crear ticket: imágenes pegadas en la descripción).
   * Va con fetch y FormData, como el widget jQuery: ZOHO.CRM.HTTP no envía archivos.
   * ⚠️ La función no responde cabeceras CORS: desde el navegador la subida puede fallar (ver docs/migracion.md).
   */
  async subirArchivo(archivo: File): Promise<string> {
    const datos = new FormData();
    datos.append('file', archivo);
    datos.append('fileName', archivo.name);
    const respuesta = await fetch(`${entorno.catalyst.funciones}/tools/uploadFile`, {
      method: 'POST',
      headers: { ZCFKEY: cabeceras().ZCFKEY ?? '' },
      body: datos,
    });
    if (!respuesta.ok) throw new ApiError(`Error al subir el archivo: ${respuesta.status}`);
    const { url } = (await respuesta.json()) as { url?: string };
    if (!url) throw new ApiError('Catalyst no devolvió la URL del archivo.');
    return url;
  },

  /** Territorio de una ciudad (campo "Operación" de los tickets de Desk). */
  territorio: (ciudad: string) =>
    get<RespuestaTerritorio>(`/tools/territories?territoryName=${encodeURIComponent(ciudad)}`),
  /** Nombre del territorio de la ciudad (padre o propio). */
  nombreTerritorio: async (ciudad: string) => nombreTerritorio(await catalystApi.territorio(ciudad)),
};
