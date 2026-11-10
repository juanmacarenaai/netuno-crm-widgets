import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2, RotateCw } from 'lucide-react';
import { cn } from './cn';

const CONTENEDOR = 'flex animate-aparecer flex-col items-center justify-center gap-3 p-6 text-center';
const PANTALLA = 'min-h-screen w-full bg-fondo';

export function Cargando({
  mensaje = 'Cargando...',
  porcentaje,
  pantallaCompleta = false,
}: {
  mensaje?: string;
  porcentaje?: number;
  pantallaCompleta?: boolean;
}) {
  return (
    <div className={cn(CONTENEDOR, pantallaCompleta && PANTALLA)} role="status">
      <Loader2 aria-hidden="true" className="h-9 w-9 animate-spin text-netuno-500" />
      <p className="text-sm font-semibold text-gray-500">{mensaje}</p>
      {porcentaje !== undefined && (
        <div className="h-2 w-64 overflow-hidden rounded bg-gray-200">
          <div
            className="h-full bg-netuno-500 transition-all"
            style={{ width: `${Math.min(Math.max(porcentaje, 0), 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function MensajeError({
  mensaje,
  titulo,
  onReintentar,
  pantallaCompleta = false,
}: {
  mensaje: ReactNode;
  titulo?: string;
  onReintentar?: () => void;
  pantallaCompleta?: boolean;
}) {
  return (
    <div className={cn(CONTENEDOR, pantallaCompleta && PANTALLA)} role="alert">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
        <AlertTriangle aria-hidden="true" className="h-6 w-6" />
      </span>
      {titulo && <p className="font-semibold text-gray-900">{titulo}</p>}
      <p className="max-w-md text-sm text-gray-700">{mensaje}</p>
      {onReintentar && (
        <button
          type="button"
          onClick={onReintentar}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-accion hover:bg-sky-50"
        >
          <RotateCw aria-hidden="true" className="h-4 w-4" /> Reintentar
        </button>
      )}
    </div>
  );
}

export function EstadoVacio({ mensaje, children }: { mensaje: string; children?: ReactNode }) {
  return (
    <div className={cn(CONTENEDOR, 'rounded-lg border border-dashed border-gray-200 bg-gray-50/50')}>
      <Inbox aria-hidden="true" className="h-7 w-7 text-gray-400" />
      <p className="text-sm text-texto-suave">{mensaje}</p>
      {children}
    </div>
  );
}

/** Bloque con brillo mientras carga. Las clases dan forma y tamaño: `<Esqueleto className="h-5 w-24" />`. */
export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('esqueleto', className)} />;
}
