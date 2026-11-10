import type { HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';

export interface TarjetaProps extends HTMLAttributes<HTMLElement> {
  titulo?: ReactNode;
  icono?: LucideIcon;
  /** Acciones a la derecha del título (botones, enlaces "Ver detalle"). */
  acciones?: ReactNode;
  /** Pie con fondo gris (acciones principales de la tarjeta). */
  pie?: ReactNode;
  /** Sin relleno interno (para listas o tablas que llegan al borde). */
  sinRelleno?: boolean;
}

/** Contenedor base de todos los módulos: borde, sombra y radio iguales en todos los widgets. */
export function Tarjeta({
  titulo,
  icono: Icono,
  acciones,
  pie,
  sinRelleno = false,
  className,
  children,
  ...props
}: TarjetaProps) {
  return (
    <section
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-tarjeta',
        className,
      )}
      {...props}
    >
      {(titulo || acciones) && (
        <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <h2 className="flex min-w-0 items-center gap-2 truncate text-base font-bold text-netuno-800">
            {Icono && <Icono aria-hidden="true" className="h-5 w-5 shrink-0 text-netuno-800" />}
            {titulo}
          </h2>
          {acciones && <div className="flex shrink-0 items-center gap-2">{acciones}</div>}
        </header>
      )}
      <div className={cn('flex-1', !sinRelleno && 'p-4')}>{children}</div>
      {pie && (
        <footer className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-4 py-3">
          {pie}
        </footer>
      )}
    </section>
  );
}
