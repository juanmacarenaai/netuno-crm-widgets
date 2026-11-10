import { Check } from 'lucide-react';
import { cn } from './cn';

/** Indicador de pasos de un flujo. `actual` empieza en 0. */
export function Pasos({ pasos, actual }: { pasos: readonly string[]; actual: number }) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1" aria-label="Pasos">
      {pasos.map((paso, i) => {
        const hecho = i < actual;
        const activo = i === actual;
        return (
          <li
            key={paso}
            className="flex shrink-0 items-center gap-1"
            aria-current={activo ? 'step' : undefined}
          >
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors',
                hecho && 'bg-netuno-500 text-white',
                activo && 'bg-netuno-oscuro text-white ring-4 ring-netuno-500/20',
                !hecho && !activo && 'bg-gray-200 text-gray-500',
              )}
            >
              {hecho ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn('text-xs font-semibold', activo ? 'text-gray-900' : 'text-gray-500')}>
              {paso}
            </span>
            {i < pasos.length - 1 && (
              <span
                aria-hidden="true"
                className={cn('mx-1 h-px w-6 sm:w-10', hecho ? 'bg-netuno-500' : 'bg-gray-300')}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
