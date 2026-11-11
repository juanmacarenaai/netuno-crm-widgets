import type { ReactNode } from 'react';
import { Lock, type LucideIcon } from 'lucide-react';
import { cn } from './cn';

/** Clase de los controles editables (input, select, textarea) de los formularios de gestión. */
export const CLASE_CONTROL =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[13px] transition focus:border-accion focus:ring-2 focus:ring-accion/20 focus:outline-none';
/** Clase de un dato de solo lectura dentro del formulario. */
export const CLASE_LECTURA =
  'rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-700';

/** Bloque de formulario con cabecera oscura (Traslado, Cambio de equipo...). Contenido en dos columnas. */
export function SeccionFormulario({
  titulo,
  icono: Icono,
  insignia,
  children,
}: {
  titulo: string;
  icono: LucideIcon;
  insignia?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-tarjeta">
      <header className="flex items-center justify-between bg-gestion px-5 py-3.5 text-white">
        <h3 className="flex items-center gap-2 text-[15px] font-bold">
          <Icono aria-hidden="true" className="h-4 w-4 text-netuno-500" />
          {titulo}
        </h3>
        {insignia && (
          <span className="rounded bg-ts-badge px-2.5 py-1 text-xs font-bold text-gray-200">{insignia}</span>
        )}
      </header>
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 p-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Etiqueta + control + error/ayuda. `completo` ocupa las dos columnas de la sección. */
export function CampoFormulario({
  etiqueta,
  htmlFor,
  requerido,
  lectura,
  completo,
  ayuda,
  error,
  children,
}: {
  etiqueta: string;
  htmlFor?: string;
  requerido?: boolean;
  lectura?: boolean;
  completo?: boolean;
  ayuda?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', completo && 'sm:col-span-2')}>
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-[13px] font-bold text-gray-700">
        {etiqueta} {requerido && <span className="text-red-600">*</span>}{' '}
        {lectura && <Lock aria-label="Solo lectura" role="img" className="h-3.5 w-3.5 text-gray-400" />}
      </label>
      {children}
      {error && (
        <span role="alert" className="text-xs font-bold text-red-600">
          {error}
        </span>
      )}
      {ayuda && <span className="text-[11px] text-gray-400">{ayuda}</span>}
    </div>
  );
}
