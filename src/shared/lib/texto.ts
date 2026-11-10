/** Minúsculas y sin acentos, para comparar textos en búsquedas ("Mérida" → "merida"). */
export function normalizarBusqueda(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Mayúsculas, sin acentos, sin puntos ni espacios: "P.B." → "PB". */
export function claveTexto(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[\s.]+/g, '');
}
