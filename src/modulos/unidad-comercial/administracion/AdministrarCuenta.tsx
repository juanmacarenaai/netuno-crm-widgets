import { createElement, useState, type ComponentType } from 'react';
import {
  ArrowLeft,
  CirclePlus,
  Construction,
  Repeat,
  Router,
  Truck,
  UserMinus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { estaConectado, tipoCliente, type Cuenta } from '@/shared/cuentas';
import { Boton, cn, PuntoEstado } from '@/ui';
import { ActivarServicios } from '../activar-servicios/ActivarServicios';
import { BajaVoluntaria } from '../baja-voluntaria/BajaVoluntaria';
import { CambioEquipo } from '../cambio-equipo/CambioEquipo';
import { CambioPlan } from '../cambio-plan/CambioPlan';
import { CambioTitularidad } from '../cambio-titularidad/CambioTitularidad';
import { TrasladoServicio } from '../traslado/TrasladoServicio';

/** Props que recibe cada gestión de Administrar cuenta. */
export interface PropsGestion {
  cuenta: Cuenta;
  /** La gestión cambió datos de la cuenta: se vuelven a consultar las cuentas. */
  onCompletado?: () => void;
}

interface Opcion {
  id: string;
  etiqueta: string;
  icono: LucideIcon;
  /** Sin componente = todavía se hace en el widget anterior ("Pronto"). */
  componente?: ComponentType<PropsGestion>;
  entrega?: string;
}

/** Pestañas de #popupAdministracionCuenta del widget jQuery. Cada una se migra en su entrega. */
const OPCIONES: readonly Opcion[] = [
  { id: 'cambioPlan', etiqueta: 'Cambio de plan', icono: Repeat, componente: CambioPlan },
  { id: 'cambioEquipo', etiqueta: 'Cambio de equipo', icono: Router, componente: CambioEquipo },
  { id: 'activarServicios', etiqueta: 'Activar servicios', icono: CirclePlus, componente: ActivarServicios },
  { id: 'bajaVoluntaria', etiqueta: 'Baja voluntaria', icono: UserMinus, componente: BajaVoluntaria },
  { id: 'cambioTitularidad', etiqueta: 'Cambio titularidad', icono: Users, componente: CambioTitularidad },
  { id: 'trasladoServicio', etiqueta: 'Traslado de Servicio', icono: Truck, componente: TrasladoServicio },
];

export function AdministrarCuenta({
  cuenta,
  onVolver,
  onCompletado,
}: {
  cuenta: Cuenta;
  onVolver: () => void;
  onCompletado?: () => void;
}) {
  const [activa, setActiva] = useState(OPCIONES[0]?.id ?? '');
  const opcion = OPCIONES.find((o) => o.id === activa) ?? OPCIONES[0];
  const conectada = estaConectado(cuenta.descStatusCuenta);

  return (
    <div className="flex min-h-screen w-full flex-col bg-fondo">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 bg-netuno-800 px-4 py-2.5 text-white shadow-md">
        <Boton variante="claro" tamano="sm" icono={ArrowLeft} onClick={onVolver}>
          Volver a las cuentas
        </Boton>
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-base font-bold">Administración de cuenta</h1>
          <p className="flex items-center gap-1.5 text-xs text-white/70">
            <PuntoEstado activo={conectada} />
            <span>Cuenta {cuenta.cuenta}</span>
            <span className="text-white/40">·</span>
            {tipoCliente(cuenta)}
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          className="flex shrink-0 flex-row gap-1 overflow-x-auto bg-netuno-900 p-2 text-white md:w-60 md:flex-col md:p-3"
          aria-label="Administración de cuenta"
        >
          {OPCIONES.map(({ id, etiqueta, icono, componente }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiva(id)}
              aria-current={activa === id ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors',
                activa === id
                  ? 'bg-netuno-500 text-white shadow-sm'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white',
              )}
            >
              {createElement(icono, { 'aria-hidden': true, className: 'h-4 w-4 shrink-0' })}
              <span className="whitespace-nowrap">{etiqueta}</span>
              {!componente && (
                <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white/60 uppercase">
                  Pronto
                </span>
              )}
            </button>
          ))}
        </nav>

        <main className="min-w-0 flex-1 p-4 text-gray-800 sm:p-6">
          {opcion && (
            <div className="mx-auto max-w-5xl">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-900">
                {createElement(opcion.icono, { 'aria-hidden': true, className: 'h-5 w-5 text-accion' })}
                {opcion.etiqueta}
              </h2>
              {opcion.componente ? (
                <div key={opcion.id} className="animate-aparecer">
                  {createElement(opcion.componente, { key: String(cuenta.cuenta), cuenta, onCompletado })}
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <Construction aria-hidden="true" className="h-5 w-5 shrink-0" />
                  <p>
                    Esta gestión se está migrando al nuevo widget
                    {opcion.entrega ? ` (${opcion.entrega})` : ''}. Mientras tanto, realícela en el widget
                    anterior de Unidad Comercial.
                  </p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
