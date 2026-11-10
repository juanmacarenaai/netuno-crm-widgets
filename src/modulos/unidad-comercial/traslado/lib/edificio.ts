/**
 * Edificio (MDU) de Weezie normalizado: pisos ordenados, unidades, cajas de piso y la caja que atiende a cada piso.
 * Origen: app/maps/maps.edificio.js de UnidadComercialJS, vía UnidadComercialReact (lib/edificio.js).
 */
import { claveTexto } from '@/shared/lib/texto';
import { configEdificio, configWeezie, type Puertos } from '../config';
import type { FloorboxApi, MduApi, SeleccionUnidad } from './tipos';

export type { SeleccionUnidad };

export { claveTexto };

export const ESTADOS_CAJA = {
  alta: { etiqueta: 'Caja con puertos', color: '#2e9e4f' },
  media: { etiqueta: 'Pocos puertos', color: '#f39c12' },
  'sin-puertos': { etiqueta: 'Caja sin puertos', color: '#c0392b' },
  'sin-caja': { etiqueta: 'Sin caja asignada', color: '#90a4ae' },
} as const;

export type EstadoCaja = keyof typeof ESTADOS_CAJA;

export interface Caja {
  id: string;
  etiqueta: string;
  activa: boolean;
  libres: number;
  ocupadas: number;
  total: number;
  /** Etiqueta del piso donde está la caja. */
  piso?: string;
}

export interface Unidad {
  id: string;
  etiqueta: string;
}

export interface Piso {
  id: string;
  nivelOriginal: string | number | null | undefined;
  orden: number | null;
  tipo: string;
  etiqueta: string;
  posicionOriginal: number;
  unidades: Unidad[];
  cajas: Caja[];
  /** Caja que atiende al piso (según la regla de asignación). */
  caja: Caja | null;
  estado: EstadoCaja;
}

export interface OpcionesEdificio {
  asignacionCaja: 'mas-cercana' | 'mismo-piso' | 'ninguna' | ((piso: Piso, pisos: Piso[]) => Caja | null);
  preferirConPuertos: boolean;
  desempate: 'abajo' | 'arriba';
  distanciaMaxima: number | null;
  permitirSinPuertos: boolean;
  aliasPlantaBaja: string[];
  ordenPersonalizado: Record<string, number>;
  avanceAcometida: Record<string, string>;
  prefijoObservacion: string;
  buscadorDesde: number;
}

const POR_DEFECTO: OpcionesEdificio = {
  asignacionCaja: 'mas-cercana',
  preferirConPuertos: false,
  desempate: 'abajo',
  distanciaMaxima: null,
  permitirSinPuertos: false,
  aliasPlantaBaja: ['PB', 'P.B.', 'P.B', 'PLANTA BAJA', '0'],
  ordenPersonalizado: {},
  avanceAcometida: {},
  prefijoObservacion: 'Ubicación en edificio',
  buscadorDesde: 30,
};

const lista = <T>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : []);

export function opcionesEdificio(propias: Partial<OpcionesEdificio> = configEdificio): OpcionesEdificio {
  const definidas = Object.fromEntries(Object.entries(propias ?? {}).filter(([, v]) => v !== undefined));
  return { ...POR_DEFECTO, ...definidas };
}

/** floor_level llega como texto ("1", "P.B.", "0", "-1") y sin orden. */
export function interpretarNivel(
  etiqueta: unknown,
  cfg: OpcionesEdificio = opcionesEdificio(),
): { orden: number | null; tipo: string; texto: string } {
  const texto = String(etiqueta ?? '').trim();
  const k = claveTexto(texto);
  let m: RegExpExecArray | null;

  for (const [p, orden] of Object.entries(cfg.ordenPersonalizado)) {
    if (claveTexto(p) === k) return { orden: Number(orden), tipo: 'personalizado', texto };
  }
  if (cfg.aliasPlantaBaja.some((a) => claveTexto(a) === k))
    return { orden: 0, tipo: 'planta-baja', texto: 'P.B.' };
  if (/^-?\d+$/.test(k)) {
    const n = Number(k);
    return n < 0
      ? { orden: n, tipo: 'sotano', texto: `Sótano ${Math.abs(n)}` }
      : { orden: n, tipo: 'piso', texto: `Piso ${n}` };
  }
  if ((m = /^(?:S|SOT|SOTANO)-?(\d+)$/.exec(k)))
    return { orden: -Number(m[1]), tipo: 'sotano', texto: `Sótano ${m[1]}` };
  if ((m = /^(?:P|PISO|NIVEL|N)(\d+)$/.exec(k)))
    return { orden: Number(m[1]), tipo: 'piso', texto: `Piso ${m[1]}` };
  if (/^(MZ|MEZ|MEZZ?ANINA)/.test(k)) return { orden: 0.5, tipo: 'mezzanina', texto };
  if (/^(PH|PENT|TERRAZA|AZOTEA)/.test(k)) return { orden: Infinity, tipo: 'superior', texto };
  return { orden: null, tipo: 'otro', texto: texto || 'Sin nivel' };
}

function cajaDesde(fb: FloorboxApi): Caja {
  const libres = Number(fb.available_ports) || 0;
  const ocupadas = Number(fb.occupied_ports) || 0;
  return {
    id: `fb-${fb.fbox_id !== undefined ? fb.fbox_id : fb.cl_id}`,
    etiqueta: (fb.fbox_label || fb.cl_label || `Caja ${fb.fbox_id || ''}`).trim(),
    activa: fb.fbx_active !== false,
    libres,
    ocupadas,
    total: libres + ocupadas,
  };
}

export function estadoCaja(
  caja: Pick<Caja, 'libres'> | null | undefined,
  puertos: Puertos = configWeezie.puertos,
): EstadoCaja {
  if (!caja) return 'sin-caja';
  if (caja.libres >= puertos.alto) return 'alta';
  if (caja.libres >= puertos.medio) return 'media';
  return 'sin-puertos';
}

/** Caja activa del piso con más puertos libres. */
const mejorDelPiso = (piso: Piso): Caja | null =>
  [...piso.cajas].filter((c) => c.activa).sort((a, b) => b.libres - a.libres)[0] ?? null;

/** Caja que atiende a un piso según cfg.asignacionCaja (la distancia se cuenta en pisos de la lista ordenada). */
export function asignarCaja(
  modelo: { pisos: Piso[] },
  indicePiso: number,
  cfg: OpcionesEdificio = opcionesEdificio(),
): Caja | null {
  const { pisos } = modelo;
  const piso = pisos[indicePiso];
  if (!piso) return null;
  const regla = cfg.asignacionCaja;

  if (typeof regla === 'function') return regla(piso, pisos) || null;
  if (regla === 'ninguna') return null;
  if (regla === 'mismo-piso') return mejorDelPiso(piso);

  let candidatos: Array<{ caja: Caja; distancia: number; abajo: boolean }> = [];
  pisos.forEach((p, i) => {
    const caja = mejorDelPiso(p);
    if (!caja) return;
    const distancia = Math.abs(i - indicePiso);
    if (cfg.distanciaMaxima !== null && distancia > cfg.distanciaMaxima) return;
    candidatos.push({ caja, distancia, abajo: i <= indicePiso });
  });
  if (cfg.preferirConPuertos && candidatos.some((c) => c.caja.libres > 0)) {
    candidatos = candidatos.filter((c) => c.caja.libres > 0);
  }
  candidatos.sort((a, b) => {
    if (a.distancia !== b.distancia) return a.distancia - b.distancia;
    if (a.abajo !== b.abajo) return (cfg.desempate === 'arriba' ? !a.abajo : a.abajo) ? -1 : 1;
    return b.caja.libres - a.caja.libres;
  });
  return candidatos[0]?.caja ?? null;
}

export interface ModeloEdificio {
  id: string;
  nombre: string;
  lat: number;
  lon: number;
  acometida: { codigo: string; texto: string | null } | null;
  pisos: Piso[];
  cajas: Caja[];
  totales: { pisos: number; unidades: number; cajas: number; libres: number };
  advertencias: string[];
}

export function normalizarEdificio(
  mdu: MduApi | null | undefined,
  cfg: OpcionesEdificio = opcionesEdificio(),
  puertos: Puertos = configWeezie.puertos,
): ModeloEdificio {
  const planta = mdu?.mdu_plant ?? {};
  const coords = mdu?.coordinates ?? planta.coordinates ?? null;
  const advertencias: string[] = [];

  const pisos: Piso[] = lista(planta.floors).map((f, i) => {
    const nivel = interpretarNivel(f.floor_level, cfg);
    return {
      id: `piso-${f.floor_id !== undefined ? f.floor_id : i}`,
      nivelOriginal: f.floor_level,
      orden: nivel.orden,
      tipo: nivel.tipo,
      etiqueta: nivel.texto,
      posicionOriginal: i,
      unidades: lista(f.fractions).map((fr, j) => ({
        id: `u-${fr.fraction_id !== undefined ? fr.fraction_id : `${i}-${j}`}`,
        etiqueta: String(fr.fraction_label ?? '?').trim() || '?',
      })),
      cajas: lista(f.floorboxes).map(cajaDesde),
      caja: null,
      estado: 'sin-caja',
    };
  });

  // Niveles no reconocidos van arriba, en el orden en que llegaron
  const conOrden = pisos.filter((p) => p.orden !== null && Number.isFinite(p.orden));
  const maximo = conOrden.length ? Math.max(...conOrden.map((p) => p.orden ?? 0)) : 0;
  for (const p of pisos) {
    if (p.orden === null) {
      p.orden = maximo + 1 + p.posicionOriginal / 1000;
      advertencias.push(`Nivel no reconocido: "${p.nivelOriginal}" (se muestra arriba)`);
    } else if (p.orden === Infinity) {
      p.orden = maximo + 2 + p.posicionOriginal / 1000;
    }
  }
  pisos.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.posicionOriginal - b.posicionOriginal);

  const acometida = planta.bd_adduction_progress;
  const modelo: ModeloEdificio = {
    id: `mdu-${mdu?.mdu_id}`,
    nombre: (planta.building_label || `Edificio ${mdu?.mdu_id}`).replace(/\s+/g, ' ').trim(),
    lat: Number(coords?.lat),
    lon: Number(coords?.lon),
    acometida: acometida ? { codigo: acometida, texto: cfg.avanceAcometida[acometida] || null } : null,
    pisos,
    cajas: [],
    totales: { pisos: pisos.length, unidades: 0, cajas: 0, libres: 0 },
    advertencias,
  };

  pisos.forEach((p, i) => {
    p.caja = asignarCaja(modelo, i, cfg);
    p.estado = estadoCaja(p.caja, puertos);
    modelo.totales.unidades += p.unidades.length;
    for (const c of p.cajas) {
      c.piso = p.etiqueta;
      modelo.cajas.push(c);
      modelo.totales.cajas += 1;
      if (c.activa) modelo.totales.libres += c.libres;
    }
  });

  if (!pisos.length) advertencias.push('Weezie no trae pisos para este edificio.');
  else if (!modelo.totales.unidades)
    advertencias.push('Weezie no trae unidades (apartamentos/locales) para este edificio.');
  return modelo;
}

export function puedeElegirUnidad(
  piso: Pick<Piso, 'estado'>,
  {
    soloConsulta = false,
    permitirSinPuertos = false,
  }: { soloConsulta?: boolean; permitirSinPuertos?: boolean } = {},
): boolean {
  if (soloConsulta) return false;
  return permitirSinPuertos || piso.estado === 'alta' || piso.estado === 'media';
}

export function motivoNoElegible(piso: Pick<Piso, 'estado'>, soloConsulta?: boolean): string {
  if (soloConsulta) return 'Edificio sin puertos disponibles: solo consulta.';
  if (piso.estado === 'sin-caja') return 'Ninguna caja de piso atiende esta unidad.';
  return 'La caja que atiende este piso no tiene puertos libres.';
}

/** Selección que se devuelve al elegir una unidad (misma forma que en UnidadComercialJS). */
export function seleccionUnidad(
  modelo: Pick<ModeloEdificio, 'nombre' | 'lat' | 'lon'>,
  piso: Piso,
  unidad: Unidad,
  prefijo: string = opcionesEdificio().prefijoObservacion,
): SeleccionUnidad {
  const partes = [`${prefijo}: ${modelo.nombre}`, piso.etiqueta, `Unidad ${unidad.etiqueta}`];
  if (piso.caja) {
    partes.push(
      `Caja de piso ${piso.caja.etiqueta} (${piso.caja.libres} de ${piso.caja.total} puertos libres)`,
    );
  }
  return {
    edificio: modelo.nombre,
    piso: piso.etiqueta,
    nivel: piso.nivelOriginal,
    unidad: unidad.etiqueta,
    caja: piso.caja
      ? {
          etiqueta: piso.caja.etiqueta,
          libres: piso.caja.libres,
          total: piso.caja.total,
          piso: piso.caja.piso,
        }
      : null,
    lat: modelo.lat,
    lon: modelo.lon,
    texto: partes.join(' · '),
  };
}

/** Búsqueda de unidades ("4B", "L2"): coincide con piso + unidad. */
export function coincideUnidad(
  piso: Pick<Piso, 'etiqueta' | 'nivelOriginal'>,
  unidad: Pick<Unidad, 'etiqueta'>,
  consulta: string,
): boolean {
  const k = claveTexto(consulta);
  if (!k) return false;
  return (
    claveTexto(piso.etiqueta + unidad.etiqueta).includes(k) ||
    claveTexto(String(piso.nivelOriginal) + unidad.etiqueta).includes(k)
  );
}
