import { createElement } from 'react';
import {
  Building2,
  CalendarCheck2,
  CalendarClock,
  Coins,
  CreditCard,
  Network,
  type LucideIcon,
} from 'lucide-react';
import { iconoServicio, type Cuenta } from '@/shared/cuentas';
import { cn } from '@/ui';
import {
  estadoCompromiso,
  estadoUltimoPago,
  nombreMoneda,
  serviciosDeCuenta,
  type EstadoFecha,
} from '../lib/facturacion';

const SERVICIOS_VISIBLES = 4;

const TONO_FECHA: Record<EstadoFecha['tono'], string> = {
  vencido: 'border-red-200 bg-red-50 text-red-700',
  proximo: 'border-amber-200 bg-amber-50 text-amber-800',
  vigente: 'border-gray-200 bg-white text-gray-900',
  sin: 'border-dashed border-gray-200 bg-gray-50/60 text-gray-400',
};

/** Recuadro de una fecha de pago: la fecha grande y debajo cuánto falta o cuánto pasó. */
function RecuadroFecha({
  etiqueta,
  icono,
  estado,
}: {
  etiqueta: string;
  icono: LucideIcon;
  estado: EstadoFecha;
}) {
  const sinFecha = estado.tono === 'sin' && !estado.fecha;
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5 rounded-lg border px-3 py-2', TONO_FECHA[estado.tono])}>
      <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
        {createElement(icono, { 'aria-hidden': true, className: 'h-3.5 w-3.5 shrink-0' })}
        {etiqueta}
      </span>
      {sinFecha ? (
        <span className="text-sm font-medium">{estado.detalle}</span>
      ) : (
        <>
          <span className="text-base leading-tight font-bold tabular-nums">{estado.fecha}</span>
          {estado.detalle && <span className="text-xs font-medium opacity-90">{estado.detalle}</span>}
        </>
      )}
    </div>
  );
}

/** Dato secundario con ícono, en una línea. */
function Dato({
  icono,
  children,
  titulo,
}: {
  icono: LucideIcon;
  children: React.ReactNode;
  titulo?: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={titulo}>
      {createElement(icono, { 'aria-hidden': true, className: 'h-4 w-4 shrink-0 text-gray-400' })}
      <span className="truncate">{children}</span>
    </span>
  );
}

/**
 * Datos de facturación de la tarjeta: primero los pagos (último pago y compromiso, con color si está próximo o
 * vencido), luego los servicios como chips y al final los datos secundarios en una línea.
 */
export function DatosCuenta({
  cuenta,
  onVerDomiciliacion,
}: {
  cuenta: Cuenta;
  /** Abre los datos de la domiciliación (solo cuentas domiciliadas). */
  onVerDomiciliacion?: () => void;
}) {
  const servicios = serviciosDeCuenta(cuenta);
  const visibles = servicios.slice(0, SERVICIOS_VISIBLES);
  const ocultos = servicios.slice(SERVICIOS_VISIBLES);
  const domiciliada = cuenta.domiciliada === true;
  const facturador = String(cuenta.descEmpresa ?? '').trim();
  const nodo = String(cuenta.descNodo ?? '').trim();

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <RecuadroFecha
          etiqueta="Último pago"
          icono={CalendarCheck2}
          estado={estadoUltimoPago(cuenta.ultimaFechaPago)}
        />
        <RecuadroFecha
          etiqueta="Compromiso de pago"
          icono={CalendarClock}
          estado={estadoCompromiso(cuenta.fCompromisoPago)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-gray-500">
          Servicios{servicios.length ? ` (${servicios.length})` : ''}
        </span>
        {servicios.length === 0 ? (
          <span className="text-sm text-gray-400">Sin servicios</span>
        ) : (
          <ul className="flex flex-wrap gap-1.5" aria-label="Servicios de la cuenta">
            {visibles.map((s) => (
              <li
                key={s.clave}
                title={
                  [s.servicio, s.conectado === false ? 'Desconectado' : ''].filter(Boolean).join(' · ') ||
                  s.nombre
                }
                className={cn(
                  'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
                  s.conectado === false
                    ? 'border-gray-200 bg-gray-50 text-gray-500'
                    : 'border-sky-100 bg-sky-50 text-netuno-800',
                )}
              >
                {createElement(iconoServicio(s.servicio), {
                  'aria-hidden': true,
                  className: cn(
                    'h-3.5 w-3.5 shrink-0',
                    s.conectado === false ? 'text-gray-400' : 'text-accion',
                  ),
                })}
                <span className="truncate">{s.nombre}</span>
                {s.conectado === false && <span className="sr-only">(desconectado)</span>}
              </li>
            ))}
            {ocultos.length > 0 && (
              <li
                className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600"
                title={ocultos.map((s) => s.nombre).join(', ')}
              >
                +{ocultos.length} más
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-2.5 text-[13px] text-gray-700">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <Dato icono={Coins}>{nombreMoneda(cuenta)}</Dato>
          {domiciliada && onVerDomiciliacion ? (
            <button
              type="button"
              onClick={onVerDomiciliacion}
              title="Ver los datos de la domiciliación"
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <CreditCard aria-hidden="true" className="h-3.5 w-3.5" />
              Domiciliada · <span className="underline">Ver datos</span>
            </button>
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold',
                domiciliada ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600',
              )}
            >
              <CreditCard aria-hidden="true" className="h-3.5 w-3.5" />
              {domiciliada ? 'Domiciliada' : 'No domiciliada'}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-gray-500">
          {facturador && (
            <Dato icono={Building2} titulo={facturador}>
              Factura {facturador}
            </Dato>
          )}
          {nodo && (
            <Dato icono={Network} titulo={nodo}>
              Nodo {nodo}
            </Dato>
          )}
        </div>
      </div>
    </div>
  );
}
