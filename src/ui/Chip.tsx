import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';

const TONOS = {
  neutro: 'bg-gray-100 text-gray-700',
  info: 'bg-sky-50 text-accion',
  exito: 'bg-emerald-50 text-emerald-700',
  aviso: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-700',
  /** Tipo de cuenta HOGAR */
  hogar: 'bg-hogar text-netuno-900',
  /** Tipo de cuenta EMPRESA */
  empresa: 'bg-empresa text-white',
} as const;

export type TonoChip = keyof typeof TONOS;

export interface ChipProps {
  tono?: TonoChip;
  icono?: LucideIcon;
  className?: string;
  children: ReactNode;
}

/** Etiqueta corta: tipo de cuenta, estado, entorno... */
export function Chip({ tono = 'neutro', icono: Icono, className, children }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase',
        TONOS[tono],
        className,
      )}
    >
      {Icono && <Icono aria-hidden="true" className="h-3 w-3" />}
      {children}
    </span>
  );
}

/** Punto de estado conectado / desconectado (reemplaza los emojis 🟢🔴). */
export function PuntoEstado({ activo, className }: { activo: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex h-2 w-2 shrink-0 rounded-full',
        activo ? 'bg-conectado' : 'bg-desconectado',
        className,
      )}
    >
      {activo && (
        <span className="absolute inset-0 animate-ping rounded-full bg-conectado opacity-40 motion-reduce:hidden" />
      )}
    </span>
  );
}
