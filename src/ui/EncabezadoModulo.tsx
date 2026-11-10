import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface EncabezadoModuloProps {
  titulo: string;
  icono?: LucideIcon;
  descripcion?: ReactNode;
  /** Botones a la derecha (Refrescar, acciones del módulo). */
  acciones?: ReactNode;
}

/** Título de cada módulo. Mismo tamaño, color e ícono en todos los widgets. */
export function EncabezadoModulo({ titulo, icono: Icono, descripcion, acciones }: EncabezadoModuloProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 pb-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icono && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-netuno-oscuro text-netuno-500">
            <Icono aria-hidden="true" className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-netuno-800">{titulo}</h1>
          {descripcion && <p className="text-xs text-texto-suave">{descripcion}</p>}
        </div>
      </div>
      {acciones && <div className="flex items-center gap-2">{acciones}</div>}
    </header>
  );
}
