import type { ButtonHTMLAttributes } from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from './cn';

const VARIANTES = {
  primario: 'bg-netuno-500 text-white shadow-sm hover:bg-sky-500 active:bg-sky-600',
  secundario: 'border border-gray-300 bg-white text-netuno-800 shadow-sm hover:bg-gray-50 active:bg-gray-100',
  peligro: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
  fantasma: 'text-netuno-800 hover:bg-gray-100 active:bg-gray-200',
  claro: 'bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20 active:bg-white/25',
} as const;

const TAMANOS = {
  sm: 'gap-1.5 rounded-md px-2.5 py-1.5 text-xs',
  md: 'gap-2 rounded-lg px-4 py-2 text-sm',
} as const;

export interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: keyof typeof VARIANTES;
  tamano?: keyof typeof TAMANOS;
  /** Ícono de lucide-react. */
  icono?: LucideIcon;
  /** Deshabilita el botón y muestra un indicador de carga. */
  cargando?: boolean;
  /** Con `cargando`, hace girar el ícono propio (p. ej. Refrescar) en lugar de cambiarlo por el indicador. */
  iconoGira?: boolean;
}

export function Boton({
  variante = 'primario',
  tamano = 'md',
  icono: Icono,
  cargando = false,
  iconoGira = false,
  className,
  type = 'button',
  disabled,
  children,
  ...props
}: BotonProps) {
  const IconoMostrado = cargando && !iconoGira ? Loader2 : Icono;
  return (
    <button
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition duration-150 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accion active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        TAMANOS[tamano],
        VARIANTES[variante],
        className,
      )}
      {...props}
    >
      {IconoMostrado && (
        <IconoMostrado
          aria-hidden="true"
          className={cn('shrink-0', tamano === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4', cargando && 'animate-spin')}
        />
      )}
      {children}
    </button>
  );
}
