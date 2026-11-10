/**
 * Qué módulo mostrar según la URL:
 *   /resumen.html            → "resumen"   (lo normal: cada widget de Zoho apunta a su página)
 *   /index.html?modulo=x     → "x"         (útil para pruebas)
 *   /  o  /index.html        → null        (Lanzador con la lista de módulos)
 * Zoho agrega sus propios parámetros a la URL (serviceOrigin, frameorigin...): se ignoran.
 */
export function idDesdeUbicacion(ruta: string, consulta: string): string | null {
  const archivo = ruta.split('/').pop() ?? '';
  if (archivo.endsWith('.html') && archivo !== 'index.html') return archivo.slice(0, -'.html'.length);
  const porConsulta = new URLSearchParams(consulta).get('modulo');
  return porConsulta ? porConsulta.trim() : null;
}
