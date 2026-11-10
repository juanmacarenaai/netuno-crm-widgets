/**
 * Autoactualización del widget.
 *
 * Slate responde los HTML con `cache-control: public, max-age=31536000` (un año) y no permite cambiarlo.
 * Un navegador que ya abrió una versión podría seguir mostrándola después de publicar otra. Para evitarlo,
 * al abrir el widget se lee la versión publicada sin caché; si es distinta a la que corre, se recarga la
 * página con `?nv=<marca>` (una URL nueva que el navegador no tiene en caché).
 * Se conservan los parámetros que agrega Zoho (serviceOrigin, frameorigin...): el SDK los necesita.
 */
import { aplicacion } from '@/core/config';

export const PARAMETRO_VERSION = 'nv';

/** Marca de esta compilación, igual a la de `<meta name="netuno-build">` (ver tooling/paginas-modulos.ts). */
export const marcaEnEjecucion = () => `${aplicacion.version}|${aplicacion.compilado}`;

export function marcaDelHtml(html: string): string | null {
  return /<meta name="netuno-build" content="([^"]+)"/.exec(html)?.[1] ?? null;
}

/** Marca de la página publicada, leída sin caché. */
export async function marcaPublicada(ruta: string = window.location.pathname): Promise<string | null> {
  const respuesta = await fetch(ruta, { cache: 'no-store' });
  if (!respuesta.ok) return null;
  return marcaDelHtml(await respuesta.text());
}

/**
 * URL a la que hay que ir para cargar `publicada`, o null si no hace falta recargar:
 * - si ya corre esa versión, o
 * - si la URL ya pidió esa versión (evita recargas en bucle si algo intermedio sigue sirviendo la anterior).
 */
export function urlParaActualizar(
  href: string,
  enEjecucion: string,
  publicada: string | null,
): string | null {
  if (!publicada || publicada === enEjecucion) return null;
  const url = new URL(href);
  if (url.searchParams.get(PARAMETRO_VERSION) === publicada) return null;
  url.searchParams.set(PARAMETRO_VERSION, publicada);
  return url.toString();
}

/**
 * Un módulo del widget no se pudo descargar: se recarga una vez con una URL nueva (`nr=1` evita repetirlo si el
 * problema no es de caché, p. ej. sin conexión).
 */
export function recuperarDescargaFallida(href: string = window.location.href): void {
  const destino = urlDeRecuperacion(href, Date.now());
  if (!destino) return;
  console.warn('[Widgets Netuno] No se pudo descargar un módulo: recargando con una URL nueva.');
  window.location.replace(destino);
}

/** URL nueva para recuperarse de una descarga fallida, o null si ya se intentó (`nr=1`). */
export function urlDeRecuperacion(href: string, marca: number): string | null {
  const url = new URL(href);
  if (url.searchParams.get('nr') === '1') return null;
  url.searchParams.set(PARAMETRO_VERSION, String(marca));
  url.searchParams.set('nr', '1');
  return url.toString();
}

/** Revisa en segundo plano y recarga si hay una versión más reciente. Solo en builds publicados. */
export async function actualizarSiHayVersionNueva(): Promise<void> {
  if (!import.meta.env.PROD) return;
  try {
    const destino = urlParaActualizar(window.location.href, marcaEnEjecucion(), await marcaPublicada());
    if (destino) {
      console.info('[Widgets Netuno] Hay una versión más reciente publicada: recargando.');
      window.location.replace(destino);
    }
  } catch (error) {
    // Sin red o sin acceso a la página: se sigue con la versión actual
    console.warn('[Widgets Netuno] No se pudo verificar la versión publicada:', error);
  }
}
