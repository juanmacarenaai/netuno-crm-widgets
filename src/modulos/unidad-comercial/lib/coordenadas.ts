/**
 * Normaliza el campo coordenadasGps de la API de Netuno/BOSS a { lat, lon }.
 * Migrado sin cambios de comportamiento desde app/maps/maps.coords.js (UnidadComercialJS), vía
 * UnidadComercialReact. Ver widgetUnidadComercial/app/maps/README.md para la tabla de formatos.
 */

export const LIMITES_PAIS = { latMin: 0.6, latMax: 12.3, lonMin: -73.5, lonMax: -59.5 } as const;

export const MOTIVOS = {
  VACIO: 'sin_dato',
  FORMATO: 'formato_no_reconocible',
  RANGO: 'fuera_de_rango',
  FUERA_PAIS: 'fuera_del_pais',
  NULO: 'coordenada_nula',
} as const;

export type Motivo = (typeof MOTIVOS)[keyof typeof MOTIVOS];

export interface Geo {
  ok: boolean;
  lat: number | null;
  lon: number | null;
  orden: string | null;
  origen: string | null;
  motivo: Motivo | null;
  crudo: unknown;
}

function error(motivo: Motivo, crudo: unknown, lat: number | null = null, lon: number | null = null): Geo {
  return { ok: false, motivo, lat, lon, orden: null, origen: null, crudo };
}

function exito(lat: number, lon: number, orden: string, origen: string, crudo: unknown): Geo {
  return { ok: true, lat, lon, orden, origen, motivo: null, crudo };
}

export function dentroDePais(lat: number, lon: number): boolean {
  const l = LIMITES_PAIS;
  return lat >= l.latMin && lat <= l.latMax && lon >= l.lonMin && lon <= l.lonMax;
}

function enRangoMundial(lat: number, lon: number): boolean {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && !(lat === 0 && lon === 0);
}

const VACIOS = new Set([
  '',
  '-',
  '--',
  'n/a',
  'na',
  'null',
  'undefined',
  'nan',
  'sin datos',
  'sin dato',
  'sin informacion',
  'no aplica',
  '0',
  '0,0',
  '0.0,0.0',
]);

function esVacio(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true;
  return VACIOS.has(String(valor).trim().toLowerCase());
}

function aNumero(valor: unknown): number {
  const n = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

// Solo cuenta como hemisferio una letra suelta pegada al número:
// "GPS 10.12 -67.12" no tiene sur y "Caracas" tampoco.
function letraAlFinal(texto: string): string | null {
  const m = /(?:^|[^a-zñáéíóúü])([nsoew])\s*$/i.exec(texto);
  return m?.[1] ? m[1].toLowerCase() : null;
}

function letraAlInicio(texto: string): string | null {
  const m = /^\s*([nsoew])(?:\s|$|[,;|/()[\]:-])/i.exec(texto);
  return m?.[1] ? m[1].toLowerCase() : null;
}

const esSur = (h: string | null) => h === 's';
const esNorte = (h: string | null) => h === 'n';
const esOeste = (h: string | null) => h === 'w' || h === 'o';
const esEste = (h: string | null) => h === 'e';
const soloLatitud = (h: string | null) => (h === 'n' || h === 's' ? h : null);
const soloLongitud = (h: string | null) => (h === 'e' || h === 'w' || h === 'o' ? h : null);

interface Token {
  valor: number;
  ini: number;
  fin: number;
}

function aplicarHemisferios(texto: string, primero: Token, segundo: Token) {
  const hueco = texto.slice(primero.fin, segundo.ini);

  const hemLat = letraAlFinal(texto.slice(0, primero.ini)) || soloLatitud(letraAlInicio(hueco));
  const hemLon = soloLongitud(letraAlFinal(hueco)) || letraAlInicio(texto.slice(segundo.fin));

  let lat = primero.valor;
  let lon = segundo.valor;

  if (esSur(hemLat)) lat = -Math.abs(lat);
  else if (esNorte(hemLat)) lat = Math.abs(lat);

  if (esOeste(hemLon)) lon = -Math.abs(lon);
  else if (esEste(hemLon)) lon = Math.abs(lon);

  return { lat, lon, hemLat, hemLon };
}

function extraerNumeros(texto: string): Token[] {
  const re = /-?\d+(?:[.,]\d+)?/g;
  const tokens: Token[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    tokens.push({ valor: aNumero(m[0]), ini: m.index, fin: m.index + m[0].length });
  }
  return tokens;
}

interface Hemisferios {
  lat: string | null;
  lon: string | null;
}

function decidirOrden(a: number, b: number, crudo: unknown, origen: string, hem?: Hemisferios): Geo {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return error(MOTIVOS.FORMATO, crudo);

  const comoLatLon = dentroDePais(a, b);
  const comoLonLat = dentroDePais(b, a);

  if (comoLatLon && !comoLonLat) return exito(a, b, 'lat_lon', origen, crudo);
  if (comoLonLat && !comoLatLon) return exito(b, a, 'lon_lat', origen, crudo);
  if (comoLatLon && comoLonLat) return exito(a, b, 'lat_lon_ambiguo', origen, crudo);

  // Con hemisferio explícito no se "corrige" el signo: "10.1S 67.1W" es el Pacífico Sur
  const latFirme = hem?.lat;
  const lonFirme = hem?.lon;

  if (!lonFirme && dentroDePais(a, -Math.abs(b)))
    return exito(a, -Math.abs(b), 'lon_sin_signo', origen, crudo);
  if (!latFirme && dentroDePais(Math.abs(a), b)) return exito(Math.abs(a), b, 'lat_sin_signo', origen, crudo);

  if (!enRangoMundial(a, b)) return error(MOTIVOS.RANGO, crudo, a, b);
  return error(MOTIVOS.FUERA_PAIS, crudo, a, b);
}

function esGradosMinutosSegundos(texto: string): boolean {
  return /[°º]/.test(texto) || /(\d+\s*['’]\s*\d)/.test(texto);
}

function parsearGMS(texto: string, crudo: unknown): Geo {
  const re = /(\d+(?:[.,]\d+)?)\s*[°º]\s*(\d+(?:[.,]\d+)?)?\s*['’]?\s*(\d+(?:[.,]\d+)?)?/g;
  const partes: Array<{ valor: number; hem: string | null }> = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(texto)) !== null) {
    const d = aNumero(m[1]);
    const min = m[2] !== undefined ? aNumero(m[2]) : 0;
    const seg = m[3] !== undefined ? aNumero(m[3]) : 0;
    const valor = d < 0 ? d - min / 60 - seg / 3600 : d + min / 60 + seg / 3600;
    const hem = /^\s*([nsoew])/i.exec(texto.slice(re.lastIndex));
    partes.push({ valor, hem: hem?.[1] ? hem[1].toLowerCase() : null });
  }

  const [primera, segunda] = partes;
  if (!primera || !segunda) return error(MOTIVOS.FORMATO, crudo);

  let lat = primera.valor;
  let lon = segunda.valor;
  if (primera.hem === 's') lat = -Math.abs(lat);
  if (segunda.hem === 'o' || segunda.hem === 'w') lon = -Math.abs(lon);

  return decidirOrden(lat, lon, crudo, 'gms', {
    lat: primera.hem ? (primera.hem === 's' ? 'sur' : 'norte') : null,
    lon: segunda.hem ? (segunda.hem === 'o' || segunda.hem === 'w' ? 'oeste' : 'este') : null,
  });
}

const PARES_OBJETO = [
  ['lat', 'lon'],
  ['lat', 'lng'],
  ['latitud', 'longitud'],
  ['latitude', 'longitude'],
  ['y', 'x'],
  ['y', 'lon'],
] as const;

function desdeObjeto(objeto: Record<string, unknown>, crudo: unknown): Geo {
  const coordenadas = objeto.coordinates;
  if (Array.isArray(coordenadas) && coordenadas.length >= 2) {
    return decidirOrden(aNumero(coordenadas[1]), aNumero(coordenadas[0]), crudo, 'geojson');
  }
  for (const [claveLat, claveLon] of PARES_OBJETO) {
    const lat = aNumero(objeto[claveLat]);
    const lon = aNumero(objeto[claveLon]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return decidirOrden(lat, lon, crudo, 'objeto');
  }
  return error(MOTIVOS.FORMATO, crudo);
}

export function parsearCoordenadas(valor: unknown): Geo {
  if (valor === null || valor === undefined) return error(MOTIVOS.NULO, valor);

  if (typeof valor === 'object') return desdeObjeto(valor as Record<string, unknown>, valor);
  if (esVacio(valor)) return error(MOTIVOS.VACIO, valor);

  const texto = String(valor).trim();
  if (esGradosMinutosSegundos(texto)) return parsearGMS(texto, valor);

  const tokens = extraerNumeros(texto).filter((t) => Number.isFinite(t.valor));
  const [primero, segundo] = tokens;
  if (!primero || !segundo) return error(MOTIVOS.FORMATO, valor);

  const conSigno = aplicarHemisferios(texto, primero, segundo);
  return decidirOrden(conSigno.lat, conSigno.lon, valor, 'decimal', {
    lat: conSigno.hemLat,
    lon: conSigno.hemLon,
  });
}

/** Distancia en metros entre dos puntos { lat, lon } (haversine). */
export function metrosEntre(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

export function describirMotivo(geo: Geo | null | undefined): string {
  if (!geo || geo.ok) return '';
  switch (geo.motivo) {
    case MOTIVOS.VACIO:
    case MOTIVOS.NULO:
      return 'sin geolocalizacion';
    case MOTIVOS.FUERA_PAIS:
      return 'coordenadas fuera del area de operacion';
    case MOTIVOS.RANGO:
      return 'coordenadas fuera de rango';
    default:
      return 'formato no reconocido';
  }
}

/** "GPS: lat, lon" para mostrar; si no se puede interpretar se muestra el valor tal cual llegó. */
export function formatearGps(coordenadasGps: unknown): string {
  if (!coordenadasGps) return '';
  const geo = parsearCoordenadas(coordenadasGps);
  if (geo.motivo === MOTIVOS.VACIO) return '';
  return `GPS: ${geo.ok ? `${geo.lat}, ${geo.lon}` : String(coordenadasGps).trim()}`;
}
