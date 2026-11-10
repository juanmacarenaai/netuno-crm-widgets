import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from './cn';

/**
 * Tarjeta que se marca y desmarca (planes, servicios...): cabecera celeste, oscura al elegirla.
 * `atenuada`: marcada como consecuencia de otra (p. ej. un Streaming que arrastra NetUnoGO).
 */
export function TarjetaSeleccionable({
  titulo,
  marcada,
  atenuada = false,
  insignia,
  onClick,
  children,
}: {
  titulo: ReactNode;
  marcada: boolean;
  atenuada?: boolean;
  insignia?: ReactNode;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      onClick={onClick}
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border bg-white text-left shadow-tarjeta transition hover:-translate-y-0.5 hover:shadow-tarjeta-hover focus-visible:outline-2 focus-visible:outline-accion',
        marcada ? 'border-netuno-oscuro ring-2 ring-netuno-500/30' : 'border-gray-200',
        atenuada && 'opacity-80',
      )}
    >
      <span
        className={cn(
          'flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-bold text-white transition-colors',
          marcada ? 'bg-netuno-oscuro' : 'bg-netuno-link',
        )}
      >
        {titulo}
        <span
          aria-hidden="true"
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-full border-2 border-white transition',
            marcada && 'bg-white text-netuno-oscuro',
          )}
        >
          {marcada && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
      </span>
      <span className="flex flex-col gap-1 px-3 py-2.5 text-xs text-gray-600">
        {children}
        {insignia}
      </span>
    </button>
  );
}
