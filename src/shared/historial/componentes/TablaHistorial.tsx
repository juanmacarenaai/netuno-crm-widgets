import { useMemo, useState } from 'react';
import { Eye, FilterX } from 'lucide-react';
import { EstadoVacio, HtmlSeguro, Modal, Paginador, cn, CLASE_CONTROL } from '@/ui';
import {
  filtrar,
  opcionesFiltros,
  pagina,
  SIN_FILTROS,
  totalPaginas,
  type FilaHistorial,
  type Pestana,
  type Seleccion,
} from '../lib/historial';

/** Lo que la tabla necesita de una pestaña (Historial o el histórico de documentos de Facturación). */
export type PestanaTabla = Pick<Pestana, 'etiqueta' | 'columnas' | 'filtros' | 'tituloDetalle'> & {
  id: string;
};

function Detalle({ fila, titulo, onCerrar }: { fila: FilaHistorial; titulo: string; onCerrar: () => void }) {
  return (
    <Modal abierto titulo={titulo} onCerrar={onCerrar} ancho="max-w-3xl">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {fila.detalle.map((campo) => (
          <div key={campo.etiqueta} className={cn(campo.tipo === 'html' && 'sm:col-span-2')}>
            <dt className="text-xs font-bold text-gray-500">{campo.etiqueta}</dt>
            <dd className="break-words text-gray-800">
              {campo.tipo === 'html' ? (
                <HtmlSeguro
                  html={campo.valor}
                  sinDatos="Sin información"
                  className="max-h-60 overflow-auto"
                />
              ) : campo.url ? (
                <a
                  href={campo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-accion underline"
                  title="Ver información completa"
                >
                  {campo.valor}
                </a>
              ) : (
                <span className="whitespace-pre-line">{campo.valor}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}

/** Tabla de una pestaña: 4 filtros en cascada, 7 registros por página y detalle al hacer clic. */
export function TablaHistorial({
  pestana,
  filas,
}: {
  pestana: PestanaTabla;
  filas: readonly FilaHistorial[];
}) {
  const [seleccion, setSeleccion] = useState<Seleccion>(SIN_FILTROS);
  const [numeroPagina, setNumeroPagina] = useState(0);
  const [abierta, setAbierta] = useState<FilaHistorial | null>(null);

  const filtradas = useMemo(() => filtrar(filas, seleccion), [filas, seleccion]);
  const opciones = useMemo(() => opcionesFiltros(filas, seleccion), [filas, seleccion]);
  const paginas = totalPaginas(filtradas.length);
  const actual = Math.min(numeroPagina, paginas - 1);
  const conFiltros = seleccion.some(Boolean);

  const elegir = (i: number, valor: string) => {
    setSeleccion((s) => s.map((v, j) => (j === i ? valor : v)));
    setNumeroPagina(0);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filtros">
        {pestana.filtros.map((etiqueta, i) => {
          const lista = opciones[i] ?? [];
          // Un filtro sin valores en los registros no se muestra
          if (lista.length === 0) return null;
          const id = `filtro-${pestana.id}-${i}`;
          return (
            <label
              key={etiqueta}
              htmlFor={id}
              className="flex min-w-36 flex-1 flex-col gap-1 text-xs font-bold text-gray-600"
            >
              {etiqueta}
              <select
                id={id}
                className={cn(CLASE_CONTROL, 'py-1.5')}
                value={seleccion[i] ?? ''}
                onChange={(e) => elegir(i, e.target.value)}
              >
                <option value="">Todos</option>
                {lista.map((valor) => (
                  <option key={valor} value={valor}>
                    {valor}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        {conFiltros && (
          <button
            type="button"
            onClick={() => {
              setSeleccion(SIN_FILTROS);
              setNumeroPagina(0);
            }}
            className="inline-flex items-center gap-1 pb-2 text-xs font-bold text-accion hover:underline"
          >
            <FilterX aria-hidden="true" className="h-3.5 w-3.5" /> Limpiar filtros
          </button>
        )}
      </div>

      {filtradas.length === 0 ? (
        <EstadoVacio mensaje="No hay registros con estos filtros." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-tarjeta">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="bg-ts-cabecera text-xs text-white">
              <tr>
                {pestana.columnas.map((c) => (
                  <th key={c} scope="col" className="px-3 py-2.5 font-bold">
                    {c}
                  </th>
                ))}
                <th scope="col" className="w-10 px-2 py-2.5">
                  <span className="sr-only">Ver</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pagina(filtradas, actual).map((fila) => (
                <tr
                  key={fila.clave}
                  onClick={() => setAbierta(fila)}
                  className="cursor-pointer border-t border-gray-100 transition-colors hover:bg-netuno-500/5"
                >
                  {fila.celdas.map((valor, i) => (
                    <td
                      key={pestana.columnas[i] ?? i}
                      className="max-w-56 truncate px-3 py-2 text-gray-700"
                      title={valor}
                    >
                      {valor}
                    </td>
                  ))}
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAbierta(fila);
                      }}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-accion"
                      aria-label={`Ver ${pestana.tituloDetalle.toLowerCase()}`}
                    >
                      <Eye aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>
          {filtradas.length} {filtradas.length === 1 ? 'registro' : 'registros'}
          {conFiltros && ` de ${filas.length}`}
        </span>
        <Paginador
          totalPaginas={paginas}
          pagina={actual}
          onCambiar={setNumeroPagina}
          etiqueta={`Páginas de ${pestana.etiqueta}`}
        />
      </div>

      {abierta && <Detalle fila={abierta} titulo={pestana.tituloDetalle} onCerrar={() => setAbierta(null)} />}
    </div>
  );
}
