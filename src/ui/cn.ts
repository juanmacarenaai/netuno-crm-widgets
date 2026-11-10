/** Une clases de Tailwind ignorando valores vacíos: `cn('p-2', activo && 'bg-white')`. */
export function cn(...clases: Array<string | false | null | undefined>): string {
  return clases.filter(Boolean).join(' ');
}
