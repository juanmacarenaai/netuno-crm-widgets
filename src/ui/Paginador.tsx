import { ChevronLeft, ChevronRight } from 'lucide-react';
import { paginasVisibles } from '@/shared/lib/paginacion';
import { cn } from './cn';

const FLECHA =
  'flex h-8 w-8 items-center justify-center rounded-lg text-netuno-800 transition hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent';

export interface PaginadorProps {
  totalPaginas: number;
  /** Empieza en 0. */
  pagina: number;
  onCambiar: (pagina: number) => void;
  etiqueta?: string;
  /** "‹ 1 de 2 ›" para espacios reducidos. */
  compacto?: boolean;
}

export function Paginador({
  totalPaginas,
  pagina,
  onCambiar,
  etiqueta = 'Paginación',
  compacto = false,
}: PaginadorProps) {
  if (totalPaginas <= 1) return null;

  const anterior = (
    <button
      type="button"
      className={FLECHA}
      disabled={pagina === 0}
      onClick={() => onCambiar(pagina - 1)}
      aria-label="Página anterior"
    >
      <ChevronLeft aria-hidden="true" className="h-4 w-4" />
    </button>
  );
  const siguiente = (
    <button
      type="button"
      className={FLECHA}
      disabled={pagina === totalPaginas - 1}
      onClick={() => onCambiar(pagina + 1)}
      aria-label="Página siguiente"
    >
      <ChevronRight aria-hidden="true" className="h-4 w-4" />
    </button>
  );

  if (compacto) {
    return (
      <nav className="flex items-center gap-0.5 text-xs text-gray-500" aria-label={etiqueta}>
        {anterior}
        <span className="min-w-12 text-center tabular-nums" aria-live="polite">
          {pagina + 1} de {totalPaginas}
        </span>
        {siguiente}
      </nav>
    );
  }

  const conFlechas = totalPaginas > 4;
  return (
    <nav className="flex items-center gap-1" aria-label={etiqueta}>
      {conFlechas && anterior}
      {paginasVisibles(totalPaginas, pagina).map((numero) => (
        <button
          key={numero}
          type="button"
          aria-current={numero === pagina ? 'page' : undefined}
          onClick={() => onCambiar(numero)}
          className={cn(
            'flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-semibold tabular-nums transition',
            numero === pagina
              ? 'bg-netuno-oscuro text-white shadow-sm'
              : 'text-netuno-800 hover:bg-white hover:shadow-sm',
          )}
        >
          {numero + 1}
        </button>
      ))}
      {conFlechas && siguiente}
    </nav>
  );
}
