import { createElement, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { dividirEnBloques } from '@/shared/lib/paginacion';
import { cn, Paginador, PuntoEstado } from '@/ui';
import { iconoServicio } from '../iconos';
import { estaConectado, nombreServicioLegible, SERVICIOS_POR_PAGINA } from '../lib/cuentas';
import type { Contrato } from '../tipos';

function FilaServicio({
  servicio,
  derecha,
  conContrato,
}: {
  servicio: Contrato;
  derecha?: ReactNode;
  conContrato?: boolean;
}) {
  const conectado = estaConectado(servicio.status);
  return (
    <>
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
          conectado ? 'bg-sky-100 text-accion' : 'bg-gray-100 text-gray-400',
        )}
      >
        {createElement(iconoServicio(servicio.nombreServicio), { 'aria-hidden': true, className: 'h-4 w-4' })}
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-sm font-semibold text-gray-800">
          {nombreServicioLegible(servicio)}
        </span>
        <span className="flex flex-wrap items-center gap-x-1 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <PuntoEstado activo={conectado} />
            {servicio.nombreServicio} · {servicio.status}
          </span>
          {conContrato && (
            <span>
              · Contrato{' '}
              <strong className="font-semibold text-gray-700 tabular-nums">
                {servicio.codContrato ?? servicio.idProducto}
              </strong>
            </span>
          )}
        </span>
      </span>
      {derecha}
    </>
  );
}

export interface ListaServiciosProps {
  servicios: Contrato[];
  /**
   * Acciones de un servicio (Ver contrato, Ver mapa...). Si se indica, cada servicio se despliega
   * al hacer clic (uno a la vez). Sin acciones, la lista es solo de lectura (p. ej. Resumen).
   */
  acciones?: (servicio: Contrato) => ReactNode;
  porPagina?: number;
  /** Texto cuando no hay servicios (p. ej. Contraseñas muestra solo los que tienen contraseña). */
  mensajeVacio?: string;
  /** Muestra el número de contrato en cada servicio, aun cerrado (Contraseñas: guía al cliente). */
  mostrarContrato?: boolean;
}

/** Servicios de una cuenta, paginados. */
export function ListaServicios({
  servicios,
  acciones,
  porPagina = SERVICIOS_POR_PAGINA,
  mensajeVacio = 'La cuenta no tiene servicios.',
  mostrarContrato = false,
}: ListaServiciosProps) {
  const [pagina, setPagina] = useState(0);
  const [abierto, setAbierto] = useState<string | null>(null);

  const paginas = dividirEnBloques(servicios, porPagina);
  const visibles = paginas[pagina] ?? [];

  if (servicios.length === 0) {
    return (
      <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-texto-suave">{mensajeVacio}</p>
    );
  }

  const cambiarPagina = (nueva: number) => {
    setPagina(nueva);
    setAbierto(null);
  };

  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
          Servicios ({servicios.length})
        </span>
        <Paginador
          compacto
          totalPaginas={paginas.length}
          pagina={pagina}
          onCambiar={cambiarPagina}
          etiqueta="Páginas de servicios"
        />
      </div>
      <ul className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-100">
        {visibles.map((servicio) => {
          if (!acciones) {
            return (
              <li
                key={servicio.idProducto}
                className="flex items-center gap-3 px-2 py-2"
                title={`${servicio.nombreServicio} - ${servicio.nombrePaquete ?? ''}`}
              >
                <FilaServicio servicio={servicio} conContrato={mostrarContrato} />
              </li>
            );
          }
          const activo = abierto === servicio.idProducto;
          return (
            <li key={servicio.idProducto} className={activo ? 'bg-sky-50/60' : undefined}>
              <button
                type="button"
                aria-expanded={activo}
                title={`${servicio.nombreServicio} - ${servicio.nombrePaquete ?? ''}`}
                onClick={() => setAbierto(activo ? null : servicio.idProducto)}
                className="flex w-full items-center gap-3 px-2 py-2 text-left transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-accion"
              >
                <FilaServicio
                  servicio={servicio}
                  conContrato={mostrarContrato}
                  derecha={
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        'h-4 w-4 shrink-0 text-gray-400 transition-transform',
                        activo && 'rotate-180',
                      )}
                    />
                  }
                />
              </button>
              {activo && (
                <div className="flex animate-aparecer flex-wrap gap-1.5 px-2 pt-1 pb-2.5 pl-11">
                  {acciones(servicio)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
