import { useState } from 'react';
import { dividirEnBloques } from '@/shared/lib/paginacion';
import { cn } from '@/ui';
import { useConsultaSerial } from './useConsultas';
import type { PropsConsulta } from './Consultas';
import { Resultado } from './Resultado';

const COLUMNAS_DETALLE = 3;

/** Un valor que es objeto se muestra plegado ("Ver detalles") en 3 columnas, como el modal del widget jQuery. */
function Entrada({ clave, valor }: { clave: string; valor: unknown }) {
  const [abierto, setAbierto] = useState(false);

  if (typeof valor !== 'object' || valor === null) {
    return (
      <p className="text-sm">
        <strong>▪️{clave}</strong>: <span className="text-texto-suave">{String(valor)}</span>
      </p>
    );
  }

  const entradas = Object.entries(valor);
  const columnas = dividirEnBloques(entradas, Math.max(Math.ceil(entradas.length / COLUMNAS_DETALLE), 1));

  return (
    <div className="text-sm">
      <strong>▪️{clave}</strong>:{' '}
      <button
        type="button"
        className="rounded bg-netuno-link px-2 py-0.5 text-xs font-semibold text-white hover:bg-sky-500"
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
      >
        {abierto ? 'Ocultar detalles' : 'Ver detalles'}
      </button>
      {abierto && (
        <div className="mt-2 grid grid-cols-1 gap-x-6 rounded border border-gray-200 bg-gray-50 p-3 sm:grid-cols-3">
          {columnas.map((columna, i) => (
            <ul key={i} className="flex flex-col gap-0.5">
              {columna.map(([subClave, subValor]) => (
                <li key={subClave} className="text-xs break-all">
                  <strong>{subClave}</strong>:{' '}
                  {typeof subValor === 'object' && subValor !== null
                    ? JSON.stringify(subValor)
                    : String(subValor)}
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}
    </div>
  );
}

/** Consulta Serial ONT (#popupVerConsultaSerial): una pestaña por área de payload.data. */
export function ConsultaSerial({ servicio }: Pick<PropsConsulta, 'servicio'>) {
  const consulta = useConsultaSerial(servicio.idProducto);
  const [pestana, setPestana] = useState<string | null>(null);

  return (
    <Resultado consulta={consulta}>
      {(respuesta) => {
        const datos = respuesta?.payload?.data;
        const areas = datos && typeof datos === 'object' ? Object.keys(datos) : [];
        if (!datos || areas.length === 0) {
          return (
            <p className="p-4 text-center text-texto-suave">
              La consulta no devolvió datos del serial de la ONT.
            </p>
          );
        }

        const activa = pestana && areas.includes(pestana) ? pestana : (areas[0] ?? '');
        const contenido = datos[activa];

        return (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1" role="tablist">
              {areas.map((area) => (
                <button
                  key={area}
                  type="button"
                  role="tab"
                  aria-selected={area === activa}
                  className={cn(
                    'min-w-28 rounded px-3 py-1 text-sm text-white',
                    area === activa ? 'bg-netuno-link' : 'bg-netuno-oscuro hover:bg-netuno-800',
                  )}
                  onClick={() => setPestana(area)}
                >
                  {area}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1.5" role="tabpanel">
              {contenido && typeof contenido === 'object' ? (
                Object.entries(contenido).map(([clave, valor]) => (
                  <Entrada key={clave} clave={clave} valor={valor} />
                ))
              ) : (
                <p className="text-sm text-texto-suave">{String(contenido)}</p>
              )}
            </div>
          </div>
        );
      }}
    </Resultado>
  );
}
