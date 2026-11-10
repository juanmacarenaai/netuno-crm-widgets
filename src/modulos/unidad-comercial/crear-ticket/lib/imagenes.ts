/**
 * Imágenes pegadas en la descripción del ticket (obtenerImagenesPegadas, extraerInfoBase64 y base64ToFile del
 * widget jQuery): se suben a Catalyst y su src base64 se reemplaza por la URL pública. Si una subida falla,
 * la imagen queda en base64, igual que en el widget jQuery.
 */

const IMAGEN_BASE64 = /(<img\b[^>]*?\bsrc=")(data:([^;"]+);base64,([^"]+))(")/gi;

/** Data URLs de las imágenes pegadas, en orden. */
export function imagenesPegadas(html: string): string[] {
  return [...html.matchAll(IMAGEN_BASE64)].map((m) => m[2] ?? '');
}

/** "archivo_<timestamp>_<aleatorio>.<extensión>" */
export function nombreArchivo(
  tipoMime: string,
  ahora = Date.now(),
  aleatorio = Math.floor(Math.random() * 10000),
) {
  return `archivo_${ahora}_${aleatorio}.${tipoMime.split('/')[1] || 'bin'}`;
}

export function archivoDesdeDataUrl(dataUrl: string, nombre?: string): File {
  const coincidencia = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  const tipo = coincidencia?.[1] ?? 'image/png';
  const binario = atob(coincidencia?.[2] ?? '');
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new File([bytes], nombre ?? nombreArchivo(tipo), { type: tipo });
}

/** Sube las imágenes en paralelo y devuelve el HTML con las URL y cuántas no se pudieron subir. */
export async function subirImagenesPegadas(
  html: string,
  subir: (archivo: File) => Promise<string>,
): Promise<{ html: string; fallidas: number }> {
  const urls = imagenesPegadas(html);
  if (urls.length === 0) return { html, fallidas: 0 };
  const resultados = await Promise.allSettled(urls.map((url) => subir(archivoDesdeDataUrl(url))));
  let i = 0;
  let fallidas = 0;
  const nuevo = html.replace(IMAGEN_BASE64, (...grupos: string[]) => {
    const [, antes = '', dataUrl = '', , , despues = ''] = grupos;
    const r = resultados[i++];
    if (r?.status === 'fulfilled') return `${antes}${r.value}${despues}`;
    fallidas++;
    console.error('No se pudo subir una imagen pegada:', r?.reason);
    return `${antes}${dataUrl}${despues}`;
  });
  return { html: nuevo, fallidas };
}
