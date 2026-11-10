/** Divide una lista en bloques de `tamano` elementos. Origen: chunkArray() de los widgets jQuery. */
export function dividirEnBloques<T>(lista: readonly T[], tamano: number): T[][] {
  if (!Array.isArray(lista) || tamano <= 0) return [];
  const bloques: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) bloques.push(lista.slice(i, i + tamano));
  return bloques;
}

/**
 * Números de página visibles cuando hay muchas: se muestran de `porGrupo` en `porGrupo`.
 * `pagina` empieza en 0.
 */
export function paginasVisibles(totalPaginas: number, pagina: number, porGrupo = 4): number[] {
  const inicio = Math.floor(pagina / porGrupo) * porGrupo;
  const fin = Math.min(inicio + porGrupo, totalPaginas);
  return Array.from({ length: Math.max(fin - inicio, 0) }, (_, i) => inicio + i);
}
