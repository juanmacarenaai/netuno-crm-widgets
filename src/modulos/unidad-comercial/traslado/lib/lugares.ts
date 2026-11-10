/**
 * Búsqueda de lugares (Photon / OpenStreetMap) y de la infraestructura cargada en el mapa.
 * Origen: app/maps/maps.lugares.js y maps.buscador.js de UnidadComercialJS, vía UnidadComercialReact.
 */
import { normalizarBusqueda } from '@/shared/lib/texto';
import { metrosEntre } from '../../lib/coordenadas';
import type { ConfigBuscador } from '../config';
import type { PuntoRed } from './weezie';

export { normalizarBusqueda };

const ZOOM_POR_NIVEL = {
  pais: 6,
  estado: 8,
  municipio: 11,
  ciudad: 12,
  sector: 15,
  calle: 17,
  punto: 18,
} as const;
type Nivel = keyof typeof ZOOM_POR_NIVEL;

/** Categoría visible según osm_value (comercios, servicios, lugares). */
const CATEGORIA: Readonly<Record<string, string>> = {
  mall: 'Centro comercial',
  supermarket: 'Supermercado',
  convenience: 'Tienda',
  bakery: 'Panadería',
  restaurant: 'Restaurante',
  fast_food: 'Comida rápida',
  cafe: 'Café',
  bar: 'Bar',
  bank: 'Banco',
  atm: 'Cajero',
  pharmacy: 'Farmacia',
  hospital: 'Hospital',
  clinic: 'Clínica',
  doctors: 'Consultorio',
  school: 'Escuela',
  college: 'Instituto',
  university: 'Universidad',
  kindergarten: 'Preescolar',
  place_of_worship: 'Iglesia / templo',
  police: 'Policía',
  fire_station: 'Bomberos',
  fuel: 'Estación de servicio',
  hotel: 'Hotel',
  museum: 'Museo',
  theatre: 'Teatro',
  cinema: 'Cine',
  stadium: 'Estadio',
  sports_centre: 'Centro deportivo',
  park: 'Parque / plaza',
  square: 'Plaza',
  garden: 'Jardín',
  events_venue: 'Salón de eventos',
  office: 'Oficina',
  apartments: 'Edificio residencial',
  residential: 'Zona residencial',
  commercial: 'Edificio comercial',
  bus_station: 'Terminal',
  station: 'Estación',
  airport: 'Aeropuerto',
  aerodrome: 'Aeropuerto',
  river: 'Río',
  stream: 'Quebrada',
  peak: 'Cerro',
  beach: 'Playa',
  motorway_junction: 'Distribuidor',
};

const VIAS: Readonly<Record<string, string>> = {
  motorway: 'Autopista',
  trunk: 'Autopista',
  primary: 'Avenida',
  secondary: 'Avenida',
};

export interface PropiedadesPhoton {
  osm_type?: string;
  osm_id?: number | string;
  osm_key?: string;
  osm_value?: string;
  type?: string;
  name?: string;
  street?: string;
  housenumber?: string;
  locality?: string;
  district?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  extent?: number[];
}

const categoria = (pr: PropiedadesPhoton) => (pr.osm_value ? CATEGORIA[pr.osm_value] : undefined);

/** Nivel y tipo visible de un resultado de Photon (type = capa: state, city, street, house...). */
export function clasificarPhoton(pr: PropiedadesPhoton): { nivel: Nivel; tipo: string; esArea: boolean } {
  switch (pr.type) {
    case 'country':
      return { nivel: 'pais', tipo: 'País', esArea: true };
    case 'state':
      return { nivel: 'estado', tipo: 'Estado', esArea: true };
    case 'county':
      return {
        nivel: 'municipio',
        tipo: /^distrito/i.test(pr.name || '') ? 'Distrito' : 'Municipio',
        esArea: true,
      };
    case 'city':
      return {
        nivel: 'ciudad',
        esArea: true,
        tipo:
          pr.osm_value === 'village' || pr.osm_value === 'hamlet'
            ? 'Pueblo'
            : /^parroquia/i.test(pr.name || '')
              ? 'Parroquia'
              : 'Ciudad',
      };
    case 'district':
      return { nivel: 'sector', tipo: 'Urbanización / sector', esArea: true };
    case 'locality':
      return { nivel: 'sector', tipo: 'Sector', esArea: true };
    case 'street':
      return {
        nivel: 'calle',
        tipo:
          (pr.osm_value && VIAS[pr.osm_value]) ||
          (pr.osm_key === 'highway' ? 'Calle' : categoria(pr) || 'Vía'),
        esArea: false,
      };
    case 'house':
      return {
        nivel: 'punto',
        esArea: false,
        tipo:
          categoria(pr) || (pr.osm_key === 'building' ? 'Edificio' : pr.housenumber ? 'Dirección' : 'Lugar'),
      };
    default:
      return { nivel: 'punto', tipo: categoria(pr) || 'Lugar', esArea: false };
  }
}

function unicos(valores: Array<string | null | undefined>, excluir?: string): string[] {
  const vistos = new Set<string>();
  return valores.filter((x): x is string => {
    if (!x) return false;
    const clave = String(x).toLowerCase();
    if (vistos.has(clave) || (excluir && clave === String(excluir).toLowerCase())) return false;
    vistos.add(clave);
    return true;
  });
}

export interface Vista {
  lat: number;
  lon: number;
  zoom?: number;
}

function distanciaDesde(vista: Vista | null | undefined, lat: number, lon: number): number | null {
  if (!vista || !Number.isFinite(vista.lat) || !Number.isFinite(lat)) return null;
  return metrosEntre({ lat: vista.lat, lon: vista.lon }, { lat, lon });
}

export interface Extent {
  oeste: number;
  norte: number;
  este: number;
  sur: number;
}

/** extent de Photon: [oeste, norte, este, sur]. */
function extentPhoton(e: number[] | undefined): Extent | null {
  if (!Array.isArray(e) || e.length !== 4) return null;
  const [oeste, norte, este, sur] = e as [number, number, number, number];
  return { oeste, norte, este, sur };
}

export function urlPhoton(
  texto: string,
  vista: Vista | null | undefined,
  cfg: Pick<ConfigBuscador, 'photon' | 'limiteLugares'>,
): string {
  const ph = cfg.photon;
  let url = `${ph.url}?q=${encodeURIComponent(texto)}&limit=${cfg.limiteLugares}&countrycode=${encodeURIComponent(ph.countrycode)}`;
  if (vista && Number.isFinite(vista.lat) && Number.isFinite(vista.lon)) {
    url +=
      `&lat=${vista.lat.toFixed(5)}&lon=${vista.lon.toFixed(5)}` +
      `&zoom=${Math.max(5, Math.min(18, Math.round(vista.zoom || 12)))}&location_bias_scale=${ph.sesgoEscala}`;
  }
  return url;
}

export interface Lugar {
  id: string;
  nombre: string;
  detalle: string;
  tipo: string;
  esArea: boolean;
  zoom: number;
  distancia: number | null;
  lat: number;
  lon: number;
  extent: Extent | null;
}

interface GeoJsonPhoton {
  features?: Array<{ properties?: PropiedadesPhoton; geometry?: { coordinates?: [number, number] } }>;
}

/** GeoJSON de Photon → lugares. */
export function lugaresDesdePhoton(geojson: GeoJsonPhoton, vista: Vista | null | undefined): Lugar[] {
  const vistos = new Set<string>();
  return (
    (geojson.features ?? [])
      .flatMap((f) =>
        f.properties && f.geometry?.coordinates ? [{ pr: f.properties, coords: f.geometry.coordinates }] : [],
      )
      .map(({ pr, coords }) => {
        const c = clasificarPhoton(pr);
        const [lon, lat] = coords;
        const calle = pr.street ? pr.street + (pr.housenumber ? ` ${pr.housenumber}` : '') : null;
        const nombre = pr.name || calle || 'Sin nombre';
        return {
          id: `osm-${pr.osm_type}${pr.osm_id}`,
          nombre,
          // Jerarquía como el texto secundario de Google: calle, sector, ciudad, municipio, estado
          detalle: unicos(
            c.nivel === 'estado'
              ? [pr.country]
              : [c.nivel !== 'calle' ? calle : null, pr.locality, pr.district, pr.city, pr.county, pr.state],
            nombre,
          ).join(', '),
          tipo: c.tipo,
          esArea: c.esArea,
          zoom: ZOOM_POR_NIVEL[c.nivel],
          distancia: c.esArea ? null : distanciaDesde(vista, lat, lon),
          lat,
          lon,
          extent: extentPhoton(pr.extent),
        };
      })
      // OpenStreetMap divide calles largas en tramos: mismo nombre y dirección = un solo resultado
      .filter((l) => {
        const clave = `${l.nombre}|${l.detalle}`.toLowerCase();
        if (vistos.has(clave)) return false;
        vistos.add(clave);
        return true;
      })
  );
}

/* ---------------- Buscador del mapa (NAP y edificios cargados) ---------------- */

type PuntoBuscable = Pick<
  PuntoRed,
  'tipo' | 'etiqueta' | 'puertosLibres' | 'seleccionable' | 'distancia' | 'enZonaEstimada' | 'grupoEtiqueta'
> &
  Partial<Pick<PuntoRed, 'zonaEtiqueta'>>;

export function formatoMetros(valor: number | null | undefined): string | null {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return null;
  if (valor < 1000) return `${Math.round(valor)} m`;
  return valor < 100000 ? `${(valor / 1000).toFixed(1)} km` : `${Math.round(valor / 1000)} km`;
}

export function subtituloPunto(p: PuntoBuscable): string {
  return [
    p.tipo === 'nap' ? 'NAP' : 'Edificio',
    p.puertosLibres > 0
      ? `${p.puertosLibres}${p.puertosLibres === 1 ? ' puerto libre' : ' puertos libres'}`
      : 'Sin puertos',
    formatoMetros(p.distancia),
    (p.grupoEtiqueta || '') + (p.enZonaEstimada ? ' (estimada)' : ''),
  ]
    .filter(Boolean)
    .join(' · ');
}

export function coincidePunto(p: PuntoBuscable, consulta: string): boolean {
  const tokens = normalizarBusqueda(consulta).split(/\s+/).filter(Boolean);
  const pajar = normalizarBusqueda(
    [p.etiqueta, p.zonaEtiqueta, p.grupoEtiqueta, p.tipo === 'nap' ? 'nap caja' : 'edificio mdu'].join(' '),
  );
  return tokens.every((t) => pajar.includes(t));
}

const porDistancia = (a: PuntoBuscable, b: PuntoBuscable) =>
  (a.distancia ?? Infinity) - (b.distancia ?? Infinity);

/** Empieza con el texto > zona estimada > con puertos > más cercano. Devuelve el índice en el mapa. */
export function buscarPuntos<T extends PuntoBuscable>(
  puntos: readonly T[],
  consulta: string,
  limite: number,
): Array<{ p: T; indice: number }> {
  const q = normalizarBusqueda(consulta);
  return puntos
    .map((p, indice) => ({ p, indice }))
    .filter(({ p }) => coincidePunto(p, consulta))
    .sort((a, b) => {
      const ea = normalizarBusqueda(a.p.etiqueta).startsWith(q) ? 0 : 1;
      const eb = normalizarBusqueda(b.p.etiqueta).startsWith(q) ? 0 : 1;
      if (ea !== eb) return ea - eb;
      if (a.p.enZonaEstimada !== b.p.enZonaEstimada) return a.p.enZonaEstimada ? -1 : 1;
      if (a.p.seleccionable !== b.p.seleccionable) return a.p.seleccionable ? -1 : 1;
      return porDistancia(a.p, b.p);
    })
    .slice(0, limite);
}

/** Caja de búsqueda vacía: los más cercanos con puertos disponibles. */
export function sugerenciasPuntos<T extends PuntoBuscable>(
  puntos: readonly T[],
  limite: number,
): Array<{ p: T; indice: number }> {
  return puntos
    .map((p, indice) => ({ p, indice }))
    .filter(({ p }) => p.seleccionable)
    .sort((a, b) => porDistancia(a.p, b.p))
    .slice(0, limite);
}
