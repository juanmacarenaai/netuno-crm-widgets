import { aplicacion, entorno } from '@/core/config';

/**
 * Versión y entorno en una esquina. En pruebas se ve en ámbar para que nadie confunda
 * el sandbox con producción; en producción es discreta.
 */
export function InsigniaEntorno() {
  const esPruebas = entorno.nombre === 'pruebas';
  return (
    <div
      className={`pointer-events-none fixed bottom-1 left-1 z-40 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
        esPruebas ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' : 'text-gray-400'
      }`}
      title={`Compilado: ${aplicacion.compilado}`}
    >
      v{aplicacion.version}
      {esPruebas && ` · ${entorno.etiqueta.toUpperCase()}`}
    </div>
  );
}
