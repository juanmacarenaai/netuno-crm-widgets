/**
 * Infraestructura cercana de Weezie (cajas NAP y edificios) convertida en puntos para el mapa.
 * Origen: app/maps/maps.weezie.js de UnidadComercialJS, vía UnidadComercialReact (lib/weezie.js).
 */
import { metrosEntre } from '../../lib/coordenadas';
import type { ConsultaWeezie, Puertos } from '../config';
import type { ClosureApi, CoordenadasApi, IdWeezie, MduApi, SeleccionUnidad, ZonaApi } from './tipos';

interface DatosWeezie {
  estimated_client_connection?: ZonaApi | null;
  /** Formato nuevo { macpl, loc } o anterior [zona]. */
  same_area?: ZonaApi[] | Record<string, ZonaApi[]>;
  other_area?: ZonaApi[] | Record<string, ZonaApi[]>;
  outside_area?: { closures?: ClosureApi[]; mdus?: MduApi[] };
}

/* ------------------------------ Puntos del mapa ------------------------------ */

export const GRUPOS = {
  same_area: 'Misma zona',
  other_area: 'Otra zona',
  outside_area: 'Fuera de zona',
} as const;

export type Grupo = keyof typeof GRUPOS;

export const COLOR = {
  verde: '#2e9e4f',
  naranja: '#f57c00',
  rojo: '#c0392b',
  edificio: '#1e88e5',
  edificioSinPuertos: '#90a4ae',
} as const;

export interface Categoria {
  id: string;
  etiqueta: string;
  color: string;
  forma: 'circulo' | 'cuadro';
}

/** Filtros del mapa, en el orden en que se muestran. */
export const CATEGORIAS: readonly Categoria[] = [
  { id: 'nap-con-puertos', etiqueta: 'NAP con puertos', color: COLOR.verde, forma: 'circulo' },
  { id: 'nap-pocos-puertos', etiqueta: 'Pocos puertos', color: COLOR.naranja, forma: 'circulo' },
  { id: 'nap-sin-puertos', etiqueta: 'Sin puertos', color: COLOR.rojo, forma: 'circulo' },
  { id: 'edificio', etiqueta: 'Edificio', color: COLOR.edificio, forma: 'cuadro' },
  {
    id: 'edificio-sin-puertos',
    etiqueta: 'Edificio sin puertos',
    color: COLOR.edificioSinPuertos,
    forma: 'cuadro',
  },
];

/** NAP o edificio de Weezie listo para dibujar, buscar y elegir. */
export interface PuntoRed {
  tipo: 'nap' | 'edificio';
  id: string;
  /** ID del NAP (closure) o del edificio (MDU) en Weezie, sin prefijo. */
  idWeezie: IdWeezie;
  uuid: string | null;
  /** Zona PON donde está el punto (null fuera de área). */
  zonaPon: ZonaPon | null;
  lat: number;
  lon: number;
  forma: 'circulo' | 'cuadro';
  color: string;
  categoria: string;
  titulo: string;
  etiqueta: string;
  zonaEtiqueta: string | null;
  seleccionable: boolean;
  textoBoton: string;
  motivoNoSeleccionable: string;
  grupo: Grupo;
  grupoEtiqueta: string;
  enZonaEstimada: boolean;
  puertosLibres: number;
  distancia: number | null;
  subtitulo: string;
  /** Filas de la ficha (popup) del mapa. */
  filas: Array<[string, string | number]>;
  /** Edificio: MDU original, para la vista de pisos y unidades. */
  mdu?: MduApi;
  /** Edificio: unidad elegida en la vista de edificio. */
  unidad?: SeleccionUnidad;
}

export interface ZonaPon {
  id: IdWeezie;
  etiqueta: string | null;
  tipo: string | null;
}

const lista = <T>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : []);

const zonaPonDe = (zona: ZonaApi | null): ZonaPon | null =>
  zona ? { id: zona.anz_id ?? null, etiqueta: zona.anz_label ?? null, tipo: zona.anz_type ?? null } : null;

function zonasDe(grupo: DatosWeezie['same_area']): ZonaApi[] {
  if (Array.isArray(grupo)) return grupo;
  if (!grupo || typeof grupo !== 'object') return [];
  return Object.values(grupo).flatMap((zonas) => lista(zonas));
}

function categoriaNap(libres: number, puertos: Puertos): Categoria {
  const [conPuertos, pocos, sin] = CATEGORIAS as [Categoria, Categoria, Categoria];
  if (libres >= puertos.alto) return conPuertos;
  if (libres >= puertos.medio) return pocos;
  return sin;
}

const subtitulo = (tipo: string, grupo: Grupo, enZonaEstimada: boolean) =>
  `${tipo} · ${GRUPOS[grupo]}${enZonaEstimada ? ' (zona estimada)' : ''}`;

function napDesde(
  closure: ClosureApi & { coordinates: CoordenadasApi },
  grupo: Grupo,
  zona: ZonaApi | null,
  enZonaEstimada: boolean,
  puertos: Puertos,
): PuntoRed {
  const libres = Number(closure.available_ports) || 0;
  const ocupados = Number(closure.occupied_ports) || 0;
  const distancia = Number(closure.distance);
  const categoria = categoriaNap(libres, puertos);
  const zonaEtiqueta = zona?.anz_label ?? null;

  return {
    tipo: 'nap',
    id: `nap-${closure.id}`,
    idWeezie: closure.id,
    uuid: closure.closure_uuid ?? null,
    zonaPon: zonaPonDe(zona),
    lat: closure.coordinates.lat,
    lon: closure.coordinates.lon,
    forma: 'circulo',
    color: categoria.color,
    categoria: categoria.id,
    titulo: `${closure.label} · ${libres}${libres === 1 ? ' libre' : ' libres'}`,
    etiqueta: closure.label,
    zonaEtiqueta,
    seleccionable: libres > 0,
    textoBoton: 'Usar esta NAP',
    motivoNoSeleccionable: 'Sin puertos disponibles',
    grupo,
    grupoEtiqueta: GRUPOS[grupo],
    enZonaEstimada,
    puertosLibres: libres,
    distancia: Number.isFinite(distancia) ? distancia : null,
    subtitulo: subtitulo('Caja NAP', grupo, enZonaEstimada),
    filas: [
      ['Zona', zonaEtiqueta ?? 'Sin zona'],
      ['Puertos libres', `${libres} de ${libres + ocupados}`],
      ['Siguiente puerto libre', libres > 0 ? String(closure.free_port ?? '—') : '—'],
      ['Distancia', Number.isFinite(distancia) ? `${Math.round(distancia)} m` : '—'],
    ],
  };
}

function edificioDesde(
  mdu: MduApi & { coordinates: CoordenadasApi },
  grupo: Grupo,
  zona: ZonaApi | null,
  enZonaEstimada: boolean,
  origen: { lat: number; lon: number } | null,
): PuntoRed {
  const planta = mdu.mdu_plant ?? {};
  const pisos = lista(planta.floors);
  let unidades = 0;
  let cajas = 0;
  let libres = 0;
  for (const piso of pisos) {
    unidades += lista(piso.fractions).length;
    for (const caja of lista(piso.floorboxes)) {
      cajas += 1;
      libres += Number(caja.available_ports) || 0;
    }
  }

  const nombre = (planta.building_label || `Edificio ${mdu.mdu_id}`).replace(/\s+/g, ' ').trim();
  const distancia = origen ? metrosEntre(origen, mdu.coordinates) : null;
  const zonaEtiqueta = zona?.anz_label ?? null;

  return {
    tipo: 'edificio',
    id: `mdu-${mdu.mdu_id}`,
    idWeezie: mdu.mdu_id,
    uuid: mdu.mdu_uuid ?? null,
    zonaPon: zonaPonDe(zona),
    lat: mdu.coordinates.lat,
    lon: mdu.coordinates.lon,
    forma: 'cuadro',
    color: libres > 0 ? COLOR.edificio : COLOR.edificioSinPuertos,
    categoria: libres > 0 ? 'edificio' : 'edificio-sin-puertos',
    titulo: nombre,
    etiqueta: nombre,
    zonaEtiqueta,
    seleccionable: libres > 0,
    textoBoton: 'Usar este edificio',
    motivoNoSeleccionable: 'Sin puertos disponibles en las cajas de piso',
    grupo,
    grupoEtiqueta: GRUPOS[grupo],
    enZonaEstimada,
    puertosLibres: libres,
    distancia,
    mdu,
    subtitulo: subtitulo('Edificio', grupo, enZonaEstimada),
    filas: [
      ['Zona', zonaEtiqueta ?? 'Sin zona'],
      ['Pisos', pisos.length],
      ['Unidades', unidades],
      ['Cajas de piso', `${cajas} (${libres} puertos libres)`],
      ['Avance acometida', planta.bd_adduction_progress || '—'],
      ['Distancia', distancia !== null ? `${Math.round(distancia)} m` : '—'],
    ],
  };
}

const conCoordenadas = <T extends { coordinates?: CoordenadasApi | null }>(
  x: T,
): x is T & { coordinates: CoordenadasApi } => Boolean(x.coordinates);

export interface ResultadoWeezie {
  consulta: Partial<ConsultaWeezie> & { lat: number; lon: number };
  zonaEstimada: { id: number | string | undefined; etiqueta: string | undefined } | null;
  puntos: PuntoRed[];
  resumen: { naps: number; edificios: number };
}

/** `respuesta`: cuerpo de closures/nearby (o la muestra guardada). */
export function normalizarWeezie(
  respuesta: unknown,
  consulta: ResultadoWeezie['consulta'],
  puertos: Puertos = { alto: 4, medio: 1 },
): ResultadoWeezie {
  const data: DatosWeezie = (respuesta as { data?: DatosWeezie } | null)?.data ?? {};
  const estimada = data.estimated_client_connection ?? null;
  const idEstimada = estimada ? estimada.anz_id : null;
  const puntos: PuntoRed[] = [];
  const vistos = new Set<string>();

  const agregar = (punto: PuntoRed) => {
    if (vistos.has(punto.id) || !Number.isFinite(punto.lat) || !Number.isFinite(punto.lon)) return;
    vistos.add(punto.id);
    puntos.push(punto);
  };

  for (const grupo of ['same_area', 'other_area'] as const) {
    for (const zona of zonasDe(data[grupo])) {
      const enEstimada = idEstimada !== null && zona.anz_id === idEstimada;
      for (const c of lista(zona.closures).filter(conCoordenadas))
        agregar(napDesde(c, grupo, zona, enEstimada, puertos));
      for (const m of lista(zona.mdus).filter(conCoordenadas))
        agregar(edificioDesde(m, grupo, zona, enEstimada, consulta));
    }
  }

  const fuera = data.outside_area ?? {};
  for (const c of lista(fuera.closures).filter(conCoordenadas))
    agregar(napDesde(c, 'outside_area', null, false, puertos));
  for (const m of lista(fuera.mdus).filter(conCoordenadas))
    agregar(edificioDesde(m, 'outside_area', null, false, consulta));

  // Lo que la zona estimada trae y no vino en same_area también se dibuja
  if (estimada) {
    for (const c of lista(estimada.closures).filter(conCoordenadas))
      agregar(napDesde(c, 'same_area', estimada, true, puertos));
    for (const m of lista(estimada.mdus).filter(conCoordenadas))
      agregar(edificioDesde(m, 'same_area', estimada, true, consulta));
  }

  return {
    consulta,
    zonaEstimada: estimada ? { id: estimada.anz_id, etiqueta: estimada.anz_label } : null,
    puntos,
    resumen: {
      naps: puntos.filter((p) => p.tipo === 'nap').length,
      edificios: puntos.filter((p) => p.tipo === 'edificio').length,
    },
  };
}

/** Texto bajo los filtros del mapa (capasWeezieTraslado en app/index.js). */
export function resumenWeezie(r: Pick<ResultadoWeezie, 'zonaEstimada' | 'resumen'>): string {
  return [
    r.zonaEstimada ? `Zona estimada: ${r.zonaEstimada.etiqueta}` : 'Sin zona estimada',
    `${r.resumen.naps} NAP`,
    `${r.resumen.edificios} edificios`,
  ].join(' · ');
}
