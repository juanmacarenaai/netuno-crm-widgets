import { useMemo, useState, type CSSProperties } from 'react';
import { Boton, cn, Modal } from '@/ui';
import {
  coincideUnidad,
  ESTADOS_CAJA,
  estadoCaja,
  motivoNoElegible,
  normalizarEdificio,
  opcionesEdificio,
  puedeElegirUnidad,
  seleccionUnidad,
  type Caja,
  type SeleccionUnidad,
} from '../lib/edificio';
import type { MduApi } from '../lib/tipos';
import './edificio.css';

function CajaPiso({ caja, resaltada }: { caja: Caja; resaltada: boolean }) {
  const estado = caja.activa ? estadoCaja(caja) : 'sin-caja';
  return (
    <span
      data-caja={caja.id}
      title={`${caja.etiqueta} · ${caja.libres} de ${caja.total} puertos libres${caja.activa ? '' : ' · inactiva'}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap',
        resaltada ? 'border-[#1565c0] bg-[#1565c0] text-white' : 'border-gray-300 bg-white text-gray-700',
      )}
    >
      <i
        className={cn('h-2 w-2 rounded-full', resaltada && 'ring-2 ring-white')}
        style={{ background: ESTADOS_CAJA[estado].color }}
      />
      {caja.etiqueta} · {caja.libres}
      {caja.activa ? ' libres' : ' (inactiva)'}
    </span>
  );
}

function Cifra({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-center text-[11px] text-texto-suave">
      <strong className="block text-xl text-gray-800">{valor}</strong>
      {etiqueta}
    </div>
  );
}

/** Vista del edificio de Weezie para elegir la unidad del cliente (Maps.edificio en UnidadComercialJS). */
export function VistaEdificio({
  mdu,
  subtitulo,
  soloConsulta = false,
  textoCerrar = 'Volver al mapa',
  onElegir,
  onCerrar,
}: {
  mdu: MduApi | undefined;
  subtitulo?: string;
  soloConsulta?: boolean;
  textoCerrar?: string;
  onElegir: (seleccion: SeleccionUnidad) => void;
  onCerrar: () => void;
}) {
  const cfg = useMemo(() => opcionesEdificio(), []);
  const modelo = useMemo(() => normalizarEdificio(mdu, cfg), [mdu, cfg]);
  const [elegida, setElegida] = useState<{ iPiso: number; iUnidad: number } | null>(null);
  const [apuntada, setApuntada] = useState<string | null>(null); // id de caja bajo el mouse
  const [busqueda, setBusqueda] = useState('');

  const opciones = { soloConsulta, permitirSinPuertos: cfg.permitirSinPuertos };
  const pisoElegido = elegida ? (modelo.pisos[elegida.iPiso] ?? null) : null;
  const unidadElegida = pisoElegido && elegida ? (pisoElegido.unidades[elegida.iUnidad] ?? null) : null;
  const elegible = pisoElegido ? puedeElegirUnidad(pisoElegido, opciones) : false;
  const cajaResaltada = apuntada ?? pisoElegido?.caja?.id ?? null;
  const acometida = modelo.acometida
    ? modelo.acometida.texto
      ? `${modelo.acometida.texto} (${modelo.acometida.codigo})`
      : modelo.acometida.codigo
    : '—';

  const usar = () => {
    if (!elegible || !pisoElegido || !unidadElegida) return;
    onElegir(seleccionUnidad(modelo, pisoElegido, unidadElegida, cfg.prefijoObservacion));
  };

  // De arriba hacia abajo: el último piso primero
  const filas = modelo.pisos.map((piso, iPiso) => ({ piso, iPiso })).reverse();

  return (
    <Modal
      abierto
      titulo={modelo.nombre}
      onCerrar={onCerrar}
      ancho="max-w-6xl"
      textoCerrar={textoCerrar}
      subtitulo={subtitulo || 'Vista del edificio'}
    >
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="edif-vista flex min-w-0 flex-1 flex-col items-center overflow-auto rounded-lg pt-9 pr-10 pl-3 md:max-h-[70vh]">
          <div className="edif-torre mt-auto w-full max-w-3xl">
            <div className="edif-techo px-3 py-1.5 text-center text-[13px] font-bold tracking-wide text-white uppercase">
              {modelo.nombre}
            </div>
            {filas.length === 0 && (
              <div className="p-8 text-center text-xs text-gray-500 italic">
                Sin pisos registrados en Weezie
              </div>
            )}
            {filas.map(({ piso, iPiso }) => (
              <div
                key={piso.id}
                className={`edif-piso edif-piso-${piso.tipo} grid grid-cols-[70px_1fr] items-center gap-2.5 px-2.5 py-2 sm:grid-cols-[86px_1fr_minmax(150px,auto)]`}
              >
                <div
                  className="truncate rounded-full border border-gray-300 bg-white px-2 py-0.5 text-center text-xs font-bold text-gray-600"
                  title={`Nivel en Weezie: ${piso.nivelOriginal}`}
                >
                  {piso.etiqueta}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {piso.unidades.length === 0 && (
                    <span className="text-xs text-gray-500 italic">Sin unidades registradas</span>
                  )}
                  {piso.unidades.map((u, iUnidad) => {
                    const puede = puedeElegirUnidad(piso, opciones);
                    const seleccionada = elegida?.iPiso === iPiso && elegida.iUnidad === iUnidad;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        aria-pressed={seleccionada}
                        title={`${piso.etiqueta} · Unidad ${u.etiqueta}${piso.caja ? ` · Caja ${piso.caja.etiqueta}` : ' · Sin caja'}`}
                        className={cn(
                          'edif-unidad h-10 max-w-32 min-w-11 truncate px-1.5 text-xs font-bold text-gray-800',
                          puede ? 'cursor-pointer' : 'cursor-help opacity-55',
                          coincideUnidad(piso, u, busqueda) && 'edif-coincide',
                        )}
                        style={{ '--edif-estado': ESTADOS_CAJA[piso.estado].color } as CSSProperties}
                        onClick={() => setElegida({ iPiso, iUnidad })}
                        onMouseEnter={() => setApuntada(piso.caja?.id ?? null)}
                        onMouseLeave={() => setApuntada(null)}
                      >
                        {u.etiqueta}
                      </button>
                    );
                  })}
                </div>
                <div className="col-start-2 flex flex-wrap gap-1.5 sm:col-start-auto sm:justify-end">
                  {piso.cajas.map((c) => (
                    <CajaPiso key={c.id} caja={c} resaltada={cajaResaltada === c.id} />
                  ))}
                </div>
              </div>
            ))}
            <div className="edif-suelo" />
          </div>
        </div>

        <aside className="flex flex-col gap-3 md:w-72 md:shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <Cifra valor={modelo.totales.pisos} etiqueta="pisos" />
            <Cifra valor={modelo.totales.unidades} etiqueta="unidades" />
            <Cifra valor={modelo.totales.cajas} etiqueta="cajas" />
            <Cifra valor={modelo.totales.libres} etiqueta="puertos libres" />
          </div>
          <div className="text-xs text-texto-suave">
            Avance acometida: <strong>{acometida}</strong>
          </div>

          {modelo.advertencias.map((a) => (
            <div key={a} className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              {a}
            </div>
          ))}
          {soloConsulta && (
            <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              Este edificio no tiene puertos disponibles: se muestra solo como consulta.
            </div>
          )}
          {modelo.totales.unidades >= cfg.buscadorDesde && (
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar unidad"
              placeholder="Buscar unidad (p. ej. 4B, L2)"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-[13px]"
            />
          )}

          <div className="flex flex-col gap-1 text-xs text-gray-600">
            {Object.entries(ESTADOS_CAJA).map(([k, e]) => (
              <span key={k} className="flex items-center gap-2">
                <i className="h-1.5 w-4 rounded-sm" style={{ background: e.color }} />
                {e.etiqueta}
              </span>
            ))}
          </div>

          <div
            className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-2.5 text-[13px] text-gray-600"
            aria-live="polite"
          >
            {!pisoElegido && !soloConsulta && 'Seleccione la unidad del cliente en el edificio.'}
            {!pisoElegido && soloConsulta && 'Puede revisar las unidades y cajas del edificio.'}
            {pisoElegido && unidadElegida && (
              <>
                <div className="text-[15px] font-bold text-gray-800">
                  {pisoElegido.etiqueta} · Unidad {unidadElegida.etiqueta}
                </div>
                {pisoElegido.caja ? (
                  <>
                    <div>
                      Caja de piso: <strong>{pisoElegido.caja.etiqueta}</strong> ({pisoElegido.caja.piso})
                    </div>
                    <div>
                      {pisoElegido.caja.libres} de {pisoElegido.caja.total} puertos libres
                    </div>
                  </>
                ) : (
                  <div>Sin caja de piso asignada</div>
                )}
                {!elegible && (
                  <div className="mt-1.5 font-bold text-red-700">
                    {motivoNoElegible(pisoElegido, soloConsulta)}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-auto flex gap-2">
            <Boton variante="secundario" className="flex-1" onClick={onCerrar}>
              Cancelar
            </Boton>
            {!soloConsulta && (
              <Boton className="flex-1" disabled={!elegible} onClick={usar}>
                Usar esta ubicación
              </Boton>
            )}
          </div>
        </aside>
      </div>
    </Modal>
  );
}
