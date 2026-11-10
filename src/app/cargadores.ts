import type { ComponentType } from 'react';

/**
 * Código de cada módulo, descubierto automáticamente desde `src/modulos/<id>/index.tsx`.
 * Cada módulo queda en su propio chunk: una página solo descarga el código de su módulo.
 */
export const paginasDeModulos = import.meta.glob<{ default: ComponentType }>('../modulos/*/index.tsx');

export function rutaDeModulo(id: string): string {
  return `../modulos/${id}/index.tsx`;
}

export function cargadorDe(id: string): (() => Promise<{ default: ComponentType }>) | undefined {
  return paginasDeModulos[rutaDeModulo(id)];
}
