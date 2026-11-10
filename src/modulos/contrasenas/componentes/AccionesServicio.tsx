import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Pencil,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import type { Contrato } from '@/shared/cuentas';
import { esStreaming, type TipoGestion } from '../lib/contrasenas';
import { consultarWifi } from '../servicio';

export type AccionContrasena = TipoGestion | 'correo';

const NOTA = 'flex w-full items-center gap-1.5 text-xs text-texto-suave';

/** Acciones en columna: una línea por acción, todas del mismo ancho. */
function ListaAcciones({ children }: { children: ReactNode }) {
  return <div className="flex w-full flex-col gap-1.5">{children}</div>;
}

/** Una acción: ícono, nombre, descripción corta y flecha. */
function FilaAccion({
  icono: Icono,
  texto,
  descripcion,
  onClick,
}: {
  icono: LucideIcon;
  texto: string;
  descripcion: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-accion hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accion active:scale-[0.99]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-100 text-accion">
        <Icono aria-hidden="true" className="h-4 w-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-[13px] font-semibold text-netuno-800">{texto}</span>
        <span className="truncate text-[11px] text-texto-suave">{descripcion}</span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-accion"
      />
    </button>
  );
}

/** Internet: la ONT se valida al desplegar el servicio (el widget jQuery la validaba al cargar cada cuenta). */
function AccionesWifi({
  contrato,
  onAccion,
}: {
  contrato: Contrato;
  onAccion: (a: AccionContrasena) => void;
}) {
  const wifi = useQuery({
    queryKey: ['netuno', 'ont-wifi', contrato.idProducto],
    queryFn: () => consultarWifi(contrato.idProducto),
    staleTime: Infinity,
    retry: false,
  });

  if (wifi.isPending) {
    return (
      <p className={NOTA} role="status">
        <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin text-netuno-500" />
        Validando la ONT, por favor espere...
      </p>
    );
  }
  if (wifi.isError) {
    return (
      <p className={NOTA} role="alert">
        No se pudo validar la ONT.
        <button
          type="button"
          onClick={() => void wifi.refetch()}
          className="inline-flex items-center gap-1 font-bold text-accion hover:underline"
        >
          <RotateCw aria-hidden="true" className="h-3 w-3" /> Reintentar
        </button>
      </p>
    );
  }
  if (!wifi.data) {
    return (
      <p className={NOTA}>
        <WifiOff aria-hidden="true" className="h-3.5 w-3.5" />
        La ONT de este servicio no permite cambiar el nombre ni la contraseña del WiFi.
      </p>
    );
  }
  return (
    <ListaAcciones>
      <FilaAccion
        icono={Pencil}
        texto="Cambio de nombre"
        descripcion="Nombre de la red WiFi (SSID)"
        onClick={() => onAccion('wifi-nombre')}
      />
      <FilaAccion
        icono={Lock}
        texto="Cambio de contraseña"
        descripcion="Contraseña de la red WiFi"
        onClick={() => onAccion('wifi-clave')}
      />
      <FilaAccion
        icono={KeyRound}
        texto="Cambio de nombre y contraseña"
        descripcion="Ambos datos de la red en un solo paso"
        onClick={() => onAccion('wifi-ambos')}
      />
    </ListaAcciones>
  );
}

/** Acciones de un servicio con contraseña: NetUno Go (Streaming) o Internet WiFi. */
export function AccionesServicio({
  contrato,
  onAccion,
}: {
  contrato: Contrato;
  onAccion: (accion: AccionContrasena) => void;
}) {
  if (!esStreaming(contrato)) return <AccionesWifi contrato={contrato} onAccion={onAccion} />;
  const correo = String(contrato.serial ?? '');
  return (
    <>
      <p className={NOTA}>
        <Mail aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        Correo de acceso:{' '}
        <strong className="break-all text-gray-700">{correo || 'Sin correo registrado'}</strong>
      </p>
      <ListaAcciones>
        <FilaAccion
          icono={RotateCcw}
          texto="Restablecer contraseña"
          descripcion="Contraseña de acceso a NetUno Go"
          onClick={() => onAccion('netunogo')}
        />
        <FilaAccion
          icono={ShieldCheck}
          texto="Control parental"
          descripcion="Restablecer la contraseña de control parental"
          onClick={() => onAccion('parental')}
        />
        <FilaAccion
          icono={Mail}
          texto="Cambio de correo"
          descripcion="Correo con el que el cliente entra a NetUno Go"
          onClick={() => onAccion('correo')}
        />
      </ListaAcciones>
    </>
  );
}
