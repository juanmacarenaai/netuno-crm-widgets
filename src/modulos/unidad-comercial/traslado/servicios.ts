/** Servicios de Traslado: Weezie (NAP y edificios cercanos) y búsqueda de lugares (Photon). */
import { credenciales } from '@/core/config';
import { ApiError } from '@/core/http/errores';
import { httpGet } from '@/core/zoho/sdk';
import { configBuscador, configWeezie, type ConsultaWeezie } from './config';
import { lugaresDesdePhoton, urlPhoton, type Lugar, type Vista } from './lib/lugares';
import { normalizarWeezie, type ResultadoWeezie } from './lib/weezie';

export const consultaPorDefecto = (): ConsultaWeezie => ({ ...configWeezie.consulta });

export const weezieUsaMuestra = () => configWeezie.fuente !== 'api';

/** PENDIENTE: confirmar credenciales y ambiente de Weezie (widgetUnidadComercial/docs/weezie-closures-nearby.md). */
async function consultarApi(consulta: ConsultaWeezie): Promise<unknown> {
  const respuesta = await httpGet<{ code?: number; message?: string }>(
    {
      url:
        `${configWeezie.url}?lat=${encodeURIComponent(consulta.lat)}&lng=${encodeURIComponent(consulta.lon)}` +
        `&radius=${encodeURIComponent(consulta.radius)}&radius_mdu=${encodeURIComponent(consulta.radiusMdu)}`,
      headers: {
        client_id: credenciales.netuno.clientId,
        client_secret: credenciales.netuno.clientSecret,
        ZCFKEY: credenciales.weezie.zcfkey,
        Accept: '*/*',
      },
    },
    { timeoutMs: configWeezie.timeoutMs },
  );
  if (!respuesta || respuesta.code !== 0) {
    throw new ApiError(respuesta?.message || 'Respuesta de Weezie no válida.', { respuesta });
  }
  return respuesta;
}

/** Cajas NAP y edificios cerca de `punto`. Sin punto se usa la consulta por defecto. */
export async function consultarWeezie(punto?: { lat: number; lon: number } | null): Promise<ResultadoWeezie> {
  const consulta = consultaPorDefecto();
  if (punto && Number.isFinite(punto.lat) && Number.isFinite(punto.lon)) {
    consulta.lat = punto.lat;
    consulta.lon = punto.lon;
  }
  if (configWeezie.fuente === 'api') {
    return normalizarWeezie(await consultarApi(consulta), consulta, configWeezie.puertos);
  }
  // La muestra corresponde al punto guardado en la configuración (se descarga solo cuando se necesita)
  const { default: muestra } = await import('./datos/weezie-muestra.json');
  return normalizarWeezie(muestra, consultaPorDefecto(), configWeezie.puertos);
}

export const tituloLugares = 'Lugares (OpenStreetMap)';

/**
 * Lugares en Photon (OpenStreetMap), directo desde el navegador como en el widget actual.
 * vista: { lat, lon, zoom } para priorizar lo cercano. senal: cancela búsquedas anteriores.
 */
export async function buscarLugares(
  texto: string,
  vista: Vista | null | undefined,
  senal?: AbortSignal,
): Promise<Lugar[]> {
  const control = new AbortController();
  const abortar = () => control.abort();
  senal?.addEventListener('abort', abortar);
  const temporizador = setTimeout(abortar, configBuscador.timeoutMs);
  try {
    const respuesta = await fetch(urlPhoton(texto, vista, configBuscador), { signal: control.signal });
    if (!respuesta.ok) throw new ApiError(`Photon respondió HTTP ${respuesta.status}`);
    return lugaresDesdePhoton(await respuesta.json(), vista);
  } finally {
    clearTimeout(temporizador);
    senal?.removeEventListener('abort', abortar);
  }
}
