import { createElement, useRef, useState, type KeyboardEvent } from 'react';
import {
  BadgePercent,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Gauge,
  Headset,
  History,
  MessagesSquare,
  RefreshCw,
  Ticket,
  UserRoundCog,
  type LucideIcon,
} from 'lucide-react';
import {
  haceCuanto,
  PESTANAS,
  tonoEstado,
  ultimoRegistro,
  usePestanaHistorial,
  type FilaHistorial,
  type IdPestana,
  type Pestana,
} from '@/shared/historial';
import { Boton, Chip, cn, EncabezadoModulo, Esqueleto, EstadoVacio, MensajeError, type TonoChip } from '@/ui';

const ICONOS: Record<IdPestana, LucideIcon> = {
  atencion: Headset,
  tickets: Ticket,
  pagos: CreditCard,
  promociones: BadgePercent,
  cuentas: UserRoundCog,
  comunicaciones: MessagesSquare,
  consumo: Gauge,
};

/** Las consultas de Pagos y Consumo solo traen los últimos 3 meses. */
const ALCANCE: Partial<Record<IdPestana, string>> = {
  pagos: 'últimos 3 meses',
  consumo: 'últimos 3 meses',
};

const tonoNegocio = (negocio: string): TonoChip =>
  negocio.toUpperCase() === 'HOGAR' ? 'hogar' : negocio.toUpperCase() === 'EMPRESA' ? 'empresa' : 'neutro';

// ── Pestañas ────────────────────────────────────────────────────────

function BarraPestanas({ activa, onCambiar }: { activa: IdPestana; onCambiar: (id: IdPestana) => void }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const indice = PESTANAS.findIndex((p) => p.id === activa);

  // Desplaza la barra (no la página: el widget está dentro de un iframe del Canvas) hasta la pestaña
  const elegir = (i: number, enfocar = false) => {
    const destino = PESTANAS[i];
    if (!destino) return;
    onCambiar(destino.id);
    const caja = contenedor.current;
    const boton = caja?.querySelector<HTMLButtonElement>(`#resumen-tab-${destino.id}`);
    if (caja && boton) {
      caja.scrollTo({
        left: boton.offsetLeft - (caja.clientWidth - boton.offsetWidth) / 2,
        behavior: 'smooth',
      });
      if (enfocar) boton.focus({ preventScroll: true });
    }
  };

  const teclado = (e: KeyboardEvent) => {
    const destinos: Record<string, number> = {
      ArrowLeft: indice - 1,
      ArrowRight: indice + 1,
      Home: 0,
      End: PESTANAS.length - 1,
    };
    const destino = destinos[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    elegir(Math.min(Math.max(destino, 0), PESTANAS.length - 1), true);
  };

  const flecha =
    'shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-netuno-800 disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div className="mb-3 flex items-center gap-1 rounded-xl bg-gray-100/80 p-1">
      <button
        type="button"
        className={flecha}
        onClick={() => elegir(indice - 1)}
        disabled={indice <= 0}
        aria-label="Sección anterior"
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
      </button>
      <div
        ref={contenedor}
        role="tablist"
        aria-label="Secciones del historial"
        onKeyDown={teclado}
        className="relative flex min-w-0 flex-1 [scrollbar-width:none] gap-1 overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_10px,black_calc(100%-10px),transparent)] px-1 [&::-webkit-scrollbar]:hidden"
      >
        {PESTANAS.map((p, i) => {
          const seleccionada = p.id === activa;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={`resumen-tab-${p.id}`}
              aria-selected={seleccionada}
              aria-controls="resumen-panel"
              tabIndex={seleccionada ? 0 : -1}
              onClick={() => elegir(i)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
                seleccionada
                  ? 'bg-netuno-oscuro text-white shadow-sm'
                  : 'text-gray-600 hover:bg-white hover:text-netuno-800',
              )}
            >
              {createElement(ICONOS[p.id], {
                'aria-hidden': true,
                className: cn('h-3.5 w-3.5', seleccionada && 'text-netuno-500'),
              })}
              {p.etiqueta}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={flecha}
        onClick={() => elegir(indice + 1)}
        disabled={indice >= PESTANAS.length - 1}
        aria-label="Sección siguiente"
      >
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Último registro ─────────────────────────────────────────────────

function UltimoRegistro({ fila }: { fila: FilaHistorial }) {
  const r = fila.resumen;
  const hace = haceCuanto(fila.momento);
  const negocios = r.negocio ? r.negocio.split(', ') : [];

  return (
    <article className="animate-aparecer rounded-xl border border-gray-200 bg-white p-3.5 shadow-tarjeta">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {negocios.map((n) => (
            <Chip key={n} tono={tonoNegocio(n)}>
              {n}
            </Chip>
          ))}
          {r.cuenta && (
            <span className="text-xs font-semibold text-gray-700">
              Cuenta <span className="tabular-nums">{r.cuenta}</span>
            </span>
          )}
        </div>
        {r.fecha && (
          <span className="inline-flex items-center gap-1 text-xs text-texto-suave">
            <CalendarClock aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="tabular-nums">{r.fecha}</span>
            {hace && <span className="font-semibold text-netuno-800">· {hace}</span>}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] leading-snug font-bold text-gray-900">{r.titulo}</h2>
          {r.subtitulo && (
            <p className="mt-0.5 line-clamp-2 text-xs text-texto-suave" title={r.subtitulo}>
              {r.subtitulo}
            </p>
          )}
        </div>
        {r.estado && (
          <Chip tono={tonoEstado(r.estado)} className="shrink-0">
            {r.estado}
          </Chip>
        )}
      </div>

      {r.campos.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-gray-50 px-3 py-2.5">
          {r.campos.map((c) => (
            <div key={c.etiqueta} className="min-w-0">
              <dt className="text-[11px] font-bold tracking-wide text-gray-500 uppercase">{c.etiqueta}</dt>
              <dd className="truncate text-[13px] text-gray-800" title={c.valor}>
                {c.url ? (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-accion underline"
                    title="Abrir en Zoho Desk"
                  >
                    {c.valor}
                  </a>
                ) : (
                  c.valor
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {r.nota && (
        <div className="mt-3 border-l-2 border-netuno-500 pl-2.5">
          <p className="text-[11px] font-bold tracking-wide text-gray-500 uppercase">{r.nota.etiqueta}</p>
          <p className="line-clamp-2 text-[13px] whitespace-pre-line text-gray-700" title={r.nota.valor}>
            {r.nota.valor}
          </p>
        </div>
      )}
    </article>
  );
}

function UltimoRegistroCargando() {
  return (
    <div
      role="status"
      aria-label="Consultando"
      className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-tarjeta"
    >
      <div className="flex justify-between gap-2">
        <div className="flex gap-1.5">
          <Esqueleto className="h-5 w-14" />
          <Esqueleto className="h-5 w-24" />
        </div>
        <Esqueleto className="h-4 w-28" />
      </div>
      <Esqueleto className="mt-3 h-5 w-48" />
      <Esqueleto className="mt-1.5 h-4 w-64 max-w-full" />
      <Esqueleto className="mt-3 h-14 w-full" />
    </div>
  );
}

function ContenidoPestana({ pestana }: { pestana: Pestana }) {
  const consulta = usePestanaHistorial(pestana.id);

  if (consulta.isPending) return <UltimoRegistroCargando />;
  if (consulta.isError) {
    return (
      <MensajeError
        mensaje={`No se lograron cargar los datos. ${consulta.error.message}`}
        onReintentar={() => void consulta.refetch()}
      />
    );
  }
  const { filas, mensaje } = consulta.data;
  const ultima = ultimoRegistro(filas);
  if (!ultima) {
    return <EstadoVacio mensaje={mensaje ?? `No hay registros en ${pestana.etiqueta}.`} />;
  }
  const alcance = ALCANCE[pestana.id];
  return (
    <>
      <UltimoRegistro key={ultima.clave} fila={ultima} />
      <p className="mt-2 text-right text-[11px] text-texto-suave">
        Más reciente de {filas.length} {filas.length === 1 ? 'registro' : 'registros'}
        {alcance && ` (${alcance})`}
      </p>
    </>
  );
}

/**
 * Historial Resumen: el último registro de cada pestaña del Historial, para la pestaña principal del cliente.
 * Comparte consultas y formato con el widget Historial (src/shared/historial).
 */
export default function HistorialResumen() {
  const [activa, setActiva] = useState<IdPestana>('atencion');
  const pestana = PESTANAS.find((p) => p.id === activa) ?? PESTANAS[0];
  const consulta = usePestanaHistorial(activa);

  if (!pestana) return null;

  return (
    <main className="p-2 sm:p-3">
      <EncabezadoModulo
        titulo="Historial"
        icono={History}
        descripcion="Último registro de cada sección"
        acciones={
          <Boton
            tamano="sm"
            variante="secundario"
            icono={RefreshCw}
            iconoGira
            cargando={consulta.isFetching}
            onClick={() => void consulta.refetch()}
            aria-label="Refrescar"
            title="Refrescar"
          />
        }
      />
      <BarraPestanas activa={activa} onCambiar={setActiva} />
      <section id="resumen-panel" role="tabpanel" aria-labelledby={`resumen-tab-${pestana.id}`}>
        <ContenidoPestana key={pestana.id} pestana={pestana} />
      </section>
    </main>
  );
}
