import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, X } from 'lucide-react';
import { cn } from './cn';

// Modales abiertos, del más antiguo al más reciente: Escape solo cierra el de arriba
const pila: symbol[] = [];

export interface ModalProps {
  abierto: boolean;
  titulo: ReactNode;
  /** Nombre accesible si `titulo` no es texto. */
  etiqueta?: string;
  subtitulo?: ReactNode;
  onCerrar?: () => void;
  onRegresar?: () => void;
  pie?: ReactNode;
  /** Clase de ancho máximo de Tailwind, p. ej. "max-w-md". */
  ancho?: string;
  textoCerrar?: string;
  children: ReactNode;
}

/** Se dibuja en document.body para quedar siempre encima (incluso sobre mapas de Leaflet). */
export function Modal({
  abierto,
  titulo,
  etiqueta,
  subtitulo,
  onCerrar,
  onRegresar,
  pie,
  ancho = 'max-w-2xl',
  textoCerrar = 'Cerrar',
  children,
}: ModalProps) {
  const alCerrar = useRef(onCerrar);
  useEffect(() => {
    alCerrar.current = onCerrar;
  });

  useEffect(() => {
    if (!abierto) return;
    const id = Symbol('modal');
    pila.push(id);
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape' && pila[pila.length - 1] === id) alCerrar.current?.();
    };
    document.addEventListener('keydown', alPresionar);
    return () => {
      document.removeEventListener('keydown', alPresionar);
      pila.splice(pila.indexOf(id), 1);
    };
  }, [abierto]);

  if (!abierto) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex animate-aparecer items-center justify-center bg-netuno-900/60 p-3 backdrop-blur-[2px] sm:p-4"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={etiqueta ?? (typeof titulo === 'string' ? titulo : undefined)}
        className={cn(
          'flex max-h-full w-full animate-entrar-modal flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5',
          ancho,
        )}
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="flex min-w-0 items-center gap-1.5 truncate text-lg font-bold text-netuno-800">
              {titulo}
            </h2>
            {subtitulo && <div className="text-xs text-texto-suave">{subtitulo}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-1 text-sm">
            {onRegresar && (
              <button
                type="button"
                onClick={onRegresar}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold text-accion transition hover:bg-sky-50"
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                Regresar
              </button>
            )}
            {onCerrar && (
              <button
                type="button"
                onClick={onCerrar}
                title={textoCerrar}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
              >
                <X aria-hidden="true" className="h-4 w-4" />
                {textoCerrar}
              </button>
            )}
          </div>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {pie && (
          <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3">{pie}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
