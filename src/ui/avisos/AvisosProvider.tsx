import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '../cn';
import { AvisosContext, type Aviso, type TipoAviso } from './contexto';

const ESTILOS: Record<TipoAviso, { Icono: typeof Info; color: string }> = {
  exito: { Icono: CheckCircle2, color: 'text-emerald-600' },
  error: { Icono: XCircle, color: 'text-red-600' },
  aviso: { Icono: AlertTriangle, color: 'text-amber-600' },
  info: { Icono: Info, color: 'text-accion' },
};

interface AvisoVisible extends Aviso {
  id: number;
}

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<AvisoVisible[]>([]);
  const siguiente = useRef(0);

  const cerrar = useCallback((id: number) => setAvisos((lista) => lista.filter((a) => a.id !== id)), []);

  const avisar = useCallback(
    ({ duracion = 3500, ...aviso }: Aviso) => {
      const id = ++siguiente.current;
      setAvisos((lista) => [...lista.slice(-2), { id, ...aviso }]);
      setTimeout(() => cerrar(id), duracion);
    },
    [cerrar],
  );

  const valor = useMemo(() => ({ avisar }), [avisar]);

  return (
    <AvisosContext.Provider value={valor}>
      {children}
      <div
        className="pointer-events-none fixed right-3 bottom-3 z-[60] flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {avisos.map(({ id, tipo = 'info', titulo, texto }) => {
          const { Icono, color } = ESTILOS[tipo];
          return (
            <div
              key={id}
              className="pointer-events-auto flex animate-aviso items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
            >
              <Icono aria-hidden="true" className={cn('mt-0.5 h-5 w-5 shrink-0', color)} />
              <div className="min-w-0 flex-1 text-sm">
                {titulo && <p className="font-semibold text-gray-900">{titulo}</p>}
                {texto && <p className="text-gray-600">{texto}</p>}
              </div>
              <button
                type="button"
                onClick={() => cerrar(id)}
                aria-label="Cerrar aviso"
                className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </AvisosContext.Provider>
  );
}
