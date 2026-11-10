import type { ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, XCircle } from 'lucide-react';
import { cn } from './cn';

const TONOS = {
  info: { clase: 'border-gray-200 bg-white text-gray-700', Icono: Info, color: 'text-accion' },
  error: { clase: 'border-red-200 bg-red-50 text-red-700', Icono: XCircle, color: 'text-red-600' },
  exito: {
    clase: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    Icono: CheckCircle2,
    color: 'text-emerald-600',
  },
  aviso: {
    clase: 'border-amber-200 bg-amber-50 text-amber-800',
    Icono: TriangleAlert,
    color: 'text-amber-600',
  },
} as const;

export type TonoAlerta = keyof typeof TONOS;

/**
 * Mensaje en línea dentro de un flujo (resultado de una operación, motivo por el que no se puede continuar).
 * Para confirmaciones breves que se cierran solas usar `useAvisos()`.
 */
export function Alerta({ tono = 'info', children }: { tono?: TonoAlerta; children: ReactNode }) {
  const { clase, Icono, color } = TONOS[tono];
  return (
    <div
      role="status"
      className={cn('flex animate-aparecer items-start gap-3 rounded-xl border p-4 text-sm', clase)}
    >
      <Icono aria-hidden="true" className={cn('h-5 w-5 shrink-0', color)} />
      <div>{children}</div>
    </div>
  );
}
