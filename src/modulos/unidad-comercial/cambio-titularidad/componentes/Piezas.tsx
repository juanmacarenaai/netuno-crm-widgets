import type { ReactNode } from 'react';
import { ArrowRight, Check, ChevronDown, Loader2, Lock, type LucideIcon } from 'lucide-react';
import { Boton, cn } from '@/ui';

/** Paso del formulario como acordeón: uno abierto a la vez, los siguientes bloqueados hasta completar el anterior. */
export interface Acordeon {
  /** Número del paso (1, 2, 3...). */
  paso: number;
  /** Id del elemento, para desplazarse hasta el paso al abrirlo. */
  id: string;
  abierto: boolean;
  bloqueado: boolean;
  completo: boolean;
  /** Lo que ya se llenó, visible con el paso cerrado. */
  resumen?: string;
  onAlternar: () => void;
  /** Cierra este paso y abre el siguiente (sin él, no hay botón "Continuar"). */
  onContinuar?: () => void;
}

function Insignia({ insignia, lista }: { insignia: ReactNode; lista: boolean }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded px-2.5 py-1 text-xs font-bold',
        lista ? 'bg-emerald-400 text-netuno-900' : 'bg-ts-badge text-gray-200',
      )}
    >
      {insignia}
    </span>
  );
}

function MarcaPaso({ acordeon }: { acordeon: Acordeon }) {
  if (acordeon.bloqueado) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/50">
        <Lock aria-hidden="true" className="h-3 w-3" />
      </span>
    );
  }
  if (acordeon.completo) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-netuno-900">
        <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-netuno-500 text-xs font-bold text-white">
      {acordeon.paso}
    </span>
  );
}

/**
 * Bloque del flujo con cabecera oscura (mismo estilo que SeccionFormulario), contenido en una columna.
 * Con `acordeon`, la cabecera abre y cierra el bloque y muestra el número del paso y su resumen.
 */
export function Bloque({
  titulo,
  icono: Icono,
  insignia,
  insigniaLista = false,
  acordeon,
  children,
}: {
  titulo: string;
  icono: LucideIcon;
  insignia?: ReactNode;
  /** Insignia resaltada (p. ej. todos los documentos cargados). */
  insigniaLista?: boolean;
  acordeon?: Acordeon;
  children: ReactNode;
}) {
  if (!acordeon) {
    return (
      <section className="animate-aparecer overflow-hidden rounded-xl border border-gray-200 bg-white shadow-tarjeta">
        <header className="flex items-center justify-between gap-3 bg-gestion px-5 py-3.5 text-white">
          <h3 className="flex items-center gap-2 text-[15px] font-bold">
            <Icono aria-hidden="true" className="h-4 w-4 shrink-0 text-netuno-500" />
            {titulo}
          </h3>
          {insignia && <Insignia insignia={insignia} lista={insigniaLista} />}
        </header>
        <div className="flex flex-col gap-4 p-5">{children}</div>
      </section>
    );
  }

  const { abierto, bloqueado, completo, resumen, onAlternar, onContinuar } = acordeon;
  const cuerpo = `${acordeon.id}-contenido`;
  return (
    <section
      id={acordeon.id}
      className={cn(
        'scroll-mt-20 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-tarjeta transition-opacity',
        bloqueado && 'opacity-60',
      )}
    >
      <h3>
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={cuerpo}
          disabled={bloqueado}
          onClick={onAlternar}
          className="flex w-full items-center gap-3 bg-gestion px-5 py-3.5 text-left text-white transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-netuno-500 enabled:hover:bg-netuno-800 disabled:cursor-not-allowed"
        >
          <MarcaPaso acordeon={acordeon} />
          {/* En pantallas angostas la insignia baja debajo del título en lugar de apretarlo */}
          <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <span className="flex min-w-[min(100%,14rem)] flex-1 flex-col">
              <span className="flex items-center gap-2 text-[15px] font-bold">
                <Icono aria-hidden="true" className="h-4 w-4 shrink-0 text-netuno-500" />
                <span className="min-w-0">{titulo}</span>
              </span>
              {!abierto && !bloqueado && resumen && (
                <span className="mt-0.5 truncate text-xs font-normal text-white/60">{resumen}</span>
              )}
            </span>
            {insignia && <Insignia insignia={insignia} lista={insigniaLista} />}
          </span>
          {!bloqueado && (
            <ChevronDown
              aria-hidden="true"
              className={cn('h-4 w-4 shrink-0 text-white/70 transition-transform', abierto && 'rotate-180')}
            />
          )}
        </button>
      </h3>
      {abierto && (
        <div id={cuerpo} className="animate-aparecer">
          <div className="flex flex-col gap-4 p-5">{children}</div>
          {onContinuar && (
            <div className="flex justify-end border-t border-gray-100 bg-gray-50/70 px-5 py-3">
              <Boton icono={ArrowRight} disabled={!completo} onClick={onContinuar}>
                Continuar
              </Boton>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Mensaje mientras se consulta un servicio (mismo formato que Alerta). */
export function AlertaCargando({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex animate-aparecer items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800"
    >
      <Loader2 aria-hidden="true" className="h-5 w-5 shrink-0 animate-spin text-accion" />
      <div>{children}</div>
    </div>
  );
}

/** Subtítulo dentro de un bloque ("Contacto", "Servicios opcionales del nuevo titular"). */
export function Subtitulo({ children }: { children: ReactNode }) {
  return (
    <p className="border-t border-gray-100 pt-3 text-[11px] font-bold tracking-wide text-gray-500 uppercase">
      {children}
    </p>
  );
}

/** Dato heredado en solo lectura. */
export function Lectura({ children, vacio = false }: { children: ReactNode; vacio?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[13px]',
        vacio ? 'text-gray-400' : 'text-gray-700',
      )}
    >
      {children}
    </div>
  );
}

interface DatosTitular {
  nombre: string;
  documento: string;
  detalle?: string;
  estado: string;
  tono: 'conectado' | 'pendiente' | 'desconectado';
}

const TONO_ESTADO = {
  conectado: 'bg-emerald-100 text-emerald-700',
  pendiente: 'bg-amber-100 text-amber-700',
  desconectado: 'bg-red-100 text-red-700',
} as const;

function TarjetaTitular({ titulo, datos, nuevo }: { titulo: string; datos: DatosTitular; nuevo?: boolean }) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border p-3.5 text-xs',
        nuevo ? 'border-netuno-500/40 bg-sky-50' : 'border-gray-200 bg-gray-50',
      )}
    >
      <p
        className={cn(
          'mb-1 text-[10.5px] font-bold tracking-wide uppercase',
          nuevo ? 'text-accion' : 'text-gray-500',
        )}
      >
        {titulo}
      </p>
      <p className="truncate text-sm font-bold text-gray-900" title={datos.nombre}>
        {datos.nombre || '—'}
      </p>
      <p className="truncate font-mono text-[11px] text-gray-500">
        {datos.documento || '—'}
        {datos.detalle ? ` · ${datos.detalle}` : ''}
      </p>
      <span className={cn('mt-2 inline-block rounded px-1.5 py-0.5 font-semibold', TONO_ESTADO[datos.tono])}>
        {datos.estado}
      </span>
    </div>
  );
}

/** Titular anterior → Nuevo titular (vista previa y seguimiento). */
export function ResumenTitulares({ anterior, nuevo }: { anterior: DatosTitular; nuevo: DatosTitular }) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <TarjetaTitular titulo="Titular anterior" datos={anterior} />
      <div className="flex items-center justify-center text-accion">
        <ArrowRight aria-hidden="true" className="h-5 w-5 rotate-90 sm:rotate-0" />
      </div>
      <TarjetaTitular titulo="Nuevo titular" datos={nuevo} nuevo />
    </div>
  );
}

export type { DatosTitular };
