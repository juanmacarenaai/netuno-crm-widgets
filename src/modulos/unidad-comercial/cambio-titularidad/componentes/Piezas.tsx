import type { ReactNode } from 'react';
import { ArrowRight, Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/ui';

/** Bloque del flujo con cabecera oscura (mismo estilo que SeccionFormulario), contenido en una columna. */
export function Bloque({
  titulo,
  icono: Icono,
  insignia,
  insigniaLista = false,
  children,
}: {
  titulo: string;
  icono: LucideIcon;
  insignia?: ReactNode;
  /** Insignia resaltada (p. ej. todos los documentos cargados). */
  insigniaLista?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="animate-aparecer overflow-hidden rounded-xl border border-gray-200 bg-white shadow-tarjeta">
      <header className="flex items-center justify-between gap-3 bg-ts-cabecera px-5 py-3.5 text-white">
        <h3 className="flex items-center gap-2 text-[15px] font-bold">
          <Icono aria-hidden="true" className="h-4 w-4 shrink-0 text-netuno-500" />
          {titulo}
        </h3>
        {insignia && (
          <span
            className={cn(
              'shrink-0 rounded px-2.5 py-1 text-xs font-bold',
              insigniaLista ? 'bg-emerald-400 text-netuno-900' : 'bg-ts-badge text-gray-200',
            )}
          >
            {insignia}
          </span>
        )}
      </header>
      <div className="flex flex-col gap-4 p-5">{children}</div>
    </section>
  );
}

/** Mensaje mientras se consulta un servicio (mismo formato que Alerta). */
export function AlertaCargando({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex animate-aparecer items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800"
    >
      <Loader2 aria-hidden="true" className="h-5 w-5 shrink-0 animate-spin text-accion" />
      <div>{children}</div>
    </div>
  );
}

/** Subtítulo dentro de un bloque ("Contacto", "Servicios opcionales del nuevo titular"). */
export function Subtitulo({ children }: { children: ReactNode }) {
  return (
    <p className="border-t border-gray-100 pt-3 text-[11px] font-bold tracking-wide text-gray-500 uppercase">
      {children}
    </p>
  );
}

/** Dato heredado en solo lectura. */
export function Lectura({ children, vacio = false }: { children: ReactNode; vacio?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[13px]',
        vacio ? 'text-gray-400' : 'text-gray-700',
      )}
    >
      {children}
    </div>
  );
}

interface DatosTitular {
  nombre: string;
  documento: string;
  detalle?: string;
  estado: string;
  tono: 'conectado' | 'pendiente' | 'desconectado';
}

const TONO_ESTADO = {
  conectado: 'bg-emerald-100 text-emerald-700',
  pendiente: 'bg-amber-100 text-amber-700',
  desconectado: 'bg-red-100 text-red-700',
} as const;

function TarjetaTitular({ titulo, datos, nuevo }: { titulo: string; datos: DatosTitular; nuevo?: boolean }) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border p-3.5 text-xs',
        nuevo ? 'border-netuno-500/40 bg-sky-50' : 'border-gray-200 bg-gray-50',
      )}
    >
      <p
        className={cn(
          'mb-1 text-[10.5px] font-bold tracking-wide uppercase',
          nuevo ? 'text-accion' : 'text-gray-500',
        )}
      >
        {titulo}
      </p>
      <p className="truncate text-sm font-bold text-gray-900" title={datos.nombre}>
        {datos.nombre || '—'}
      </p>
      <p className="truncate font-mono text-[11px] text-gray-500">
        {datos.documento || '—'}
        {datos.detalle ? ` · ${datos.detalle}` : ''}
      </p>
      <span className={cn('mt-2 inline-block rounded px-1.5 py-0.5 font-semibold', TONO_ESTADO[datos.tono])}>
        {datos.estado}
      </span>
    </div>
  );
}

/** Titular anterior → Nuevo titular (vista previa y seguimiento). */
export function ResumenTitulares({ anterior, nuevo }: { anterior: DatosTitular; nuevo: DatosTitular }) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <TarjetaTitular titulo="Titular anterior" datos={anterior} />
      <div className="flex items-center justify-center text-accion">
        <ArrowRight aria-hidden="true" className="h-5 w-5 rotate-90 sm:rotate-0" />
      </div>
      <TarjetaTitular titulo="Nuevo titular" datos={nuevo} nuevo />
    </div>
  );
}

export type { DatosTitular };
