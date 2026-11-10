import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Crosshair, MapPin, MapPinned } from 'lucide-react';
import { normalizarBusqueda } from '@/shared/lib/texto';
import { cn } from './cn';

export type IconoOpcion = 'zona' | 'lugar' | 'coordenadas' | { forma: 'circulo' | 'cuadro'; color: string };

export interface OpcionCombobox {
  id: string;
  titulo: string;
  subtitulo?: string;
  icono?: IconoOpcion;
  /** Atenuada (p. ej. NAP sin puertos): se ve pero se distingue. */
  atenuado?: boolean;
  /** Sin onElegir la opción es solo informativa. */
  onElegir?: () => void;
}

export interface SeccionCombobox {
  titulo: string;
  items: OpcionCombobox[];
  /** Se muestra si la sección no tiene items ("Buscando...", "Sin resultados"). */
  mensaje?: string;
}

/** Título con las coincidencias de la búsqueda resaltadas. */
function Resaltado({ texto, consulta }: { texto: string; consulta: string }) {
  const base = normalizarBusqueda(texto);
  const tokens = normalizarBusqueda(consulta).split(/\s+/).filter(Boolean);
  if (!tokens.length || base.length !== texto.length) return <>{texto}</>;

  const marcas = new Array<boolean>(texto.length).fill(false);
  for (const t of tokens) {
    let desde = 0;
    let i: number;
    while ((i = base.indexOf(t, desde)) !== -1) {
      for (let k = i; k < i + t.length; k++) marcas[k] = true;
      desde = i + t.length;
    }
  }

  const partes: ReactNode[] = [];
  let i = 0;
  while (i < texto.length) {
    let j = i;
    while (j < texto.length && marcas[j] === marcas[i]) j++;
    partes.push(
      marcas[i] ? (
        <mark key={i} className="bg-yellow-200 text-inherit">
          {texto.slice(i, j)}
        </mark>
      ) : (
        texto.slice(i, j)
      ),
    );
    i = j;
  }
  return <>{partes}</>;
}

const ICONOS = { zona: MapPinned, lugar: MapPin, coordenadas: Crosshair } as const;

function Icono({ icono }: { icono?: IconoOpcion }) {
  if (!icono) return null;
  if (typeof icono === 'object') {
    return (
      <span
        className={cn('h-3 w-3 shrink-0', icono.forma === 'cuadro' ? 'rounded-sm' : 'rounded-full')}
        style={{ background: icono.color }}
      />
    );
  }
  const Simbolo = ICONOS[icono];
  return <Simbolo aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-texto-suave" />;
}

export interface ComboboxProps {
  valor: string;
  onCambiar: (valor: string) => void;
  secciones: SeccionCombobox[];
  /** Texto a resaltar en los resultados (por defecto, el valor escrito). */
  consulta?: string;
  placeholder?: string;
  /** Nombre accesible de la caja. */
  etiqueta: string;
  id?: string;
  className?: string;
  /** Botón × para vaciar la caja. */
  conLimpiar?: boolean;
}

/**
 * Caja de búsqueda con resultados por secciones. Flechas para moverse, Enter para elegir y Escape cierra solo
 * la lista (no el modal que la contiene).
 */
export function Combobox({
  valor,
  onCambiar,
  secciones,
  consulta = valor,
  placeholder,
  etiqueta,
  id,
  className,
  conLimpiar = false,
}: ComboboxProps) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const lista = useRef<HTMLDivElement>(null);
  const idLista = useId();

  const elegibles = secciones.flatMap((s) => s.items.filter((it) => it.onElegir));
  const visibles = abierto && secciones.some((s) => s.items.length || s.mensaje);
  const indiceActivo = Math.min(activo, Math.max(elegibles.length - 1, 0));

  const elegir = (item: OpcionCombobox) => {
    setAbierto(false);
    item.onElegir?.();
  };

  const alTeclear = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!abierto) return setAbierto(true);
      if (!elegibles.length) return;
      const siguiente =
        (indiceActivo + (e.key === 'ArrowDown' ? 1 : -1) + elegibles.length) % elegibles.length;
      setActivo(siguiente);
      lista.current?.querySelector(`[data-indice="${siguiente}"]`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!abierto) return setAbierto(true);
      const item = elegibles[indiceActivo];
      if (item) elegir(item);
    } else if (e.key === 'Escape' && abierto) {
      e.stopPropagation(); // cierra solo la lista, no la ventana
      setAbierto(false);
    }
  };

  return (
    <div className={cn('relative', className)}>
      <input
        id={id}
        type="text"
        autoComplete="off"
        role="combobox"
        aria-expanded={visibles}
        aria-controls={idLista}
        aria-label={etiqueta}
        placeholder={placeholder}
        value={valor}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-[13px] transition focus:border-accion focus:ring-2 focus:ring-accion/20 focus:outline-none"
        onChange={(e) => {
          onCambiar(e.target.value);
          setActivo(0);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 120)}
        onKeyDown={alTeclear}
      />
      {conLimpiar && valor && (
        <button
          type="button"
          title="Limpiar búsqueda"
          aria-label="Limpiar búsqueda"
          className="absolute top-1/2 right-2 -translate-y-1/2 text-lg leading-none text-gray-400 hover:text-gray-700"
          onMouseDown={(e) => {
            e.preventDefault();
            onCambiar('');
            setAbierto(true);
          }}
        >
          ×
        </button>
      )}
      {visibles && (
        <div
          ref={lista}
          id={idLista}
          role="listbox"
          className="absolute z-[1100] mt-1 max-h-80 w-full min-w-72 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {secciones
            .filter((s) => s.items.length || s.mensaje)
            .map((s) => (
              <div key={s.titulo}>
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-wide text-texto-suave uppercase">
                  {s.titulo}
                </div>
                {s.mensaje && !s.items.length && (
                  <div className="px-3 py-1.5 text-xs text-texto-suave italic">{s.mensaje}</div>
                )}
                {s.items.map((it) => {
                  const indice = it.onElegir ? elegibles.indexOf(it) : null;
                  const esActivo = indice !== null && indice === indiceActivo;
                  return (
                    <div
                      key={it.id}
                      role="option"
                      aria-selected={esActivo}
                      data-indice={indice ?? undefined}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 px-3 py-1.5',
                        esActivo ? 'bg-sky-50' : 'hover:bg-gray-50',
                        it.atenuado && 'opacity-60',
                      )}
                      // mousedown + preventDefault: elegir sin que la caja pierda el foco antes
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (it.onElegir) elegir(it);
                      }}
                      onMouseEnter={() => indice !== null && setActivo(indice)}
                    >
                      <Icono icono={it.icono} />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[13px] text-texto">
                          <Resaltado texto={it.titulo} consulta={consulta} />
                        </span>
                        {it.subtitulo && (
                          <span className="truncate text-[11px] text-texto-suave">{it.subtitulo}</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
