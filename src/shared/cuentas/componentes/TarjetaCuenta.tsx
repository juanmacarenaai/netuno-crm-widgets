import type { ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import { Chip, cn, Esqueleto, PuntoEstado, type TonoChip } from '@/ui';
import { estadoSaldo, estaConectado, tipoCliente, ubicacionCuenta, type TipoSaldo } from '../lib/cuentas';
import type { Contrato, Cuenta } from '../tipos';
import { ListaServicios } from './ListaServicios';

const TIPO: Record<string, { tono: TonoChip }> = {
  HOGAR: { tono: 'hogar' },
  EMPRESA: { tono: 'empresa' },
};

const SALDO: Record<TipoSaldo, string> = {
  'a-favor': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'al-dia': 'bg-gray-50 text-gray-700 ring-gray-200',
  pendiente: 'bg-amber-50 text-amber-800 ring-amber-200',
  'sin-datos': 'bg-gray-50 text-gray-700 ring-gray-200',
};

export interface TarjetaCuentaProps {
  cuenta: Cuenta;
  /** Acciones de cada servicio. Sin ellas, los servicios se muestran solo para lectura. */
  accionesServicio?: (servicio: Contrato) => ReactNode;
  /** Pie con las acciones de la cuenta (Ver mapa, Administrar cuenta...). */
  pie?: ReactNode;
  /** Servicios por página dentro de la tarjeta. */
  serviciosPorPagina?: number;
  /** Texto cuando la cuenta no tiene servicios para mostrar. */
  mensajeSinServicios?: string;
  /** Contenido propio en lugar de la lista de servicios (p. ej. Facturación). */
  cuerpo?: ReactNode;
}

/**
 * Tarjeta de una cuenta: tipo, estado, saldo, ubicación y servicios.
 * La usan Unidad Comercial (con acciones) y Resumen (solo lectura): un cambio aquí llega a los dos widgets.
 */
export function TarjetaCuenta({
  cuenta,
  accionesServicio,
  pie,
  serviciosPorPagina,
  mensajeSinServicios,
  cuerpo,
}: TarjetaCuentaProps) {
  const tipo = tipoCliente(cuenta);
  const estiloTipo = TIPO[tipo];
  const conectada = estaConectado(cuenta.descStatusCuenta);
  const saldo = estadoSaldo(cuenta);

  return (
    <article className="flex h-full flex-col rounded-xl border border-gray-200 bg-white shadow-tarjeta transition-shadow hover:shadow-tarjeta-hover">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tono={estiloTipo?.tono ?? 'neutro'}>{tipo || 'SIN TIPO'}</Chip>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                conectada ? 'bg-emerald-50 text-conectado' : 'bg-red-50 text-desconectado',
              )}
            >
              <PuntoEstado activo={conectada} />
              {cuenta.descStatusCuenta}
            </span>
          </div>
          <span
            className={cn(
              'inline-flex items-baseline gap-1 rounded-lg px-2 py-1 text-xs ring-1',
              SALDO[saldo.tipo],
            )}
          >
            {saldo.etiqueta}: <strong className="text-sm tabular-nums">{saldo.monto}</strong>
          </span>
        </div>

        <div className="leading-tight">
          <h3 className="text-base font-bold text-gray-900">
            Cuenta <span className="tabular-nums">{cuenta.cuenta}</span>
          </h3>
          <p className="mt-0.5 flex items-start gap-1 text-xs text-texto-suave">
            <MapPin aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
            {ubicacionCuenta(cuenta)}
          </p>
        </div>

        {cuerpo ?? (
          <ListaServicios
            servicios={cuenta.contratos ?? []}
            acciones={accionesServicio}
            porPagina={serviciosPorPagina}
            mensajeVacio={mensajeSinServicios}
          />
        )}
      </div>

      {pie && (
        <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-gray-100 bg-gray-50/70 px-4 py-2.5">
          {pie}
        </div>
      )}
    </article>
  );
}

/** Tarjeta "fantasma" mientras se consultan las cuentas. */
export function TarjetaCuentaEsqueleto({ conPie = true }: { conPie?: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-tarjeta">
      <div className="flex gap-2">
        <Esqueleto className="h-5 w-16" />
        <Esqueleto className="h-5 w-24" />
      </div>
      <Esqueleto className="h-6 w-40" />
      <Esqueleto className="h-4 w-56" />
      <div className="flex flex-col gap-2 pt-2">
        <Esqueleto className="h-9 w-full" />
        <Esqueleto className="h-9 w-full" />
        <Esqueleto className="h-9 w-3/4" />
      </div>
      {conPie && (
        <div className="flex justify-end gap-2 pt-1">
          <Esqueleto className="h-8 w-32" />
          <Esqueleto className="h-8 w-24" />
        </div>
      )}
    </div>
  );
}
