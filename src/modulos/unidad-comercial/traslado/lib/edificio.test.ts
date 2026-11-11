import { describe, expect, it } from 'vitest';
import muestra from '../datos/weezie-muestra.json';
import {
  coincideUnidad,
  interpretarNivel,
  motivoNoElegible,
  normalizarEdificio,
  opcionesEdificio,
  puedeElegirUnidad,
  seleccionUnidad,
  type OpcionesEdificio,
  type Piso,
} from './edificio';
import type { FloorApi, FloorboxApi, MduApi } from './tipos';
import { normalizarWeezie } from './weezie';

const edificios = normalizarWeezie(muestra, { lat: 9.042429, lon: -69.755618 }).puntos.filter(
  (p) => p.tipo === 'edificio',
);
const deMuestra = (nombre: string) =>
  normalizarEdificio(edificios.find((p) => p.etiqueta.includes(nombre))?.mdu);

const piso = (nivel: string, unidades: Array<string | null>, cajas: FloorboxApi[] = []): FloorApi => ({
  floor_id: nivel,
  floor_level: nivel,
  fractions: unidades.map((u, i) => ({ fraction_id: `${nivel}-${i}`, fraction_label: u })),
  floorboxes: cajas,
});
const fb = (id: number, libres: number, activa = true): FloorboxApi => ({
  fbox_id: id,
  fbox_label: `FB-${id}`,
  fbx_active: activa,
  available_ports: libres,
  occupied_ports: 8 - libres,
});
const sintetico = (floors: FloorApi[], extra: Partial<NonNullable<MduApi['mdu_plant']>> = {}): MduApi => ({
  mdu_id: 1,
  coordinates: { lat: 9, lon: -69 },
  mdu_plant: { building_label: '  Torre   Prueba ', floors, ...extra },
});

describe('interpretarNivel', () => {
  it.each([
    ['P.B.', 0, 'P.B.'],
    ['PB', 0, 'P.B.'],
    ['Planta Baja', 0, 'P.B.'],
    ['0', 0, 'P.B.'],
    ['-1', -1, 'Sótano 1'],
    ['S2', -2, 'Sótano 2'],
    ['Sótano 3', -3, 'Sótano 3'],
    ['8', 8, 'Piso 8'],
    ['Piso 12', 12, 'Piso 12'],
    ['Mezzanina', 0.5, 'Mezzanina'],
  ])('%s → %s', (nivel, orden, texto) => {
    expect(interpretarNivel(nivel)).toMatchObject({ orden, texto });
  });

  it('PH y azotea arriba de todo; nivel desconocido sin orden', () => {
    expect(interpretarNivel('PH').orden).toBe(Infinity);
    expect(interpretarNivel('Azotea verde').tipo).toBe('superior');
    expect(interpretarNivel('Ala norte').orden).toBeNull();
  });
});

describe('normalizarEdificio con la muestra', () => {
  it('RES. (C) TERCERO: pisos ordenados y totales', () => {
    const m = deMuestra('TERCERO');
    expect(m.pisos.map((p) => p.etiqueta)).toEqual([
      'P.B.',
      'Piso 1',
      'Piso 2',
      'Piso 3',
      'Piso 4',
      'Piso 5',
      'Piso 6',
      'Piso 7',
      'Piso 8',
    ]);
    expect(m.totales).toEqual({ pisos: 9, unidades: 45, cajas: 5, libres: 40 });
  });

  it('caja más cercana con desempate hacia abajo', () => {
    const m = deMuestra('TERCERO');
    const caja = (et: string) => m.pisos.find((p) => p.etiqueta === et)?.caja?.etiqueta;
    expect([caja('Piso 1'), caja('Piso 2'), caja('Piso 3'), caja('Piso 7'), caja('Piso 8')]).toEqual([
      'PTGCNT-03A-B',
      'PTGCNT-03A-C',
      'PTGCNT-03A-C',
      'PTGCNT-03A-E',
      'PTGCNT-03A-F',
    ]);
  });

  it('TORRE CENTRAL: sótano abajo, "0" es P.B. y cajas sin puertos', () => {
    const m = deMuestra('TORRE CENTRAL');
    expect(m.pisos.map((p) => p.etiqueta)).toEqual(['Sótano 1', 'P.B.', 'Piso 1', 'Piso 2']);
    expect(m.pisos.every((p) => p.estado === 'sin-puertos')).toBe(true);
  });
});

describe('normalizarEdificio con casos límite', () => {
  it('sin pisos ni datos', () => {
    const m = normalizarEdificio({ mdu_id: 9, coordinates: { lat: 1, lon: 2 } });
    expect(m.nombre).toBe('Edificio 9');
    expect(m.advertencias[0]).toMatch(/no trae pisos/);
    expect(normalizarEdificio(null).pisos).toEqual([]);
  });

  it('nivel desconocido arriba con advertencia y PH sobre todo', () => {
    const m = normalizarEdificio(
      sintetico([piso('PH', ['A']), piso('Ala Norte', ['X']), piso('2', ['A']), piso('P.B.', ['L1'])]),
    );
    expect(m.nombre).toBe('Torre Prueba');
    expect(m.pisos.map((p) => p.nivelOriginal)).toEqual(['P.B.', '2', 'Ala Norte', 'PH']);
    expect(m.advertencias.some((a) => a.includes('Ala Norte'))).toBe(true);
  });

  it('cajas inactivas no se asignan; pocos puertos es "media"', () => {
    expect(normalizarEdificio(sintetico([piso('1', ['A'], [fb(1, 8, false)])])).pisos[0]?.estado).toBe(
      'sin-caja',
    );
    const m = normalizarEdificio(
      sintetico([piso('1', ['A'], [fb(1, 2), fb(2, 6)]), piso('2', ['A'], [fb(3, 1)])]),
    );
    expect([m.pisos[0]?.caja?.etiqueta, m.pisos[0]?.estado, m.pisos[1]?.estado]).toEqual([
      'FB-2',
      'alta',
      'media',
    ]);
  });

  it('reglas configurables de asignación', () => {
    const pisos = [
      piso('1', ['A'], [fb(1, 0)]),
      piso('2', ['A']),
      piso('3', ['A'], [fb(3, 8)]),
      piso('4', ['A']),
      piso('5', ['A']),
      piso('6', ['A']),
    ];
    const cajas = (o: Partial<OpcionesEdificio>) =>
      normalizarEdificio(sintetico(pisos), opcionesEdificio({ ...opcionesEdificio(), ...o }))
        .pisos.map((p) => p.caja?.etiqueta ?? '-')
        .join(' ');
    expect(cajas({})).toBe('FB-1 FB-1 FB-3 FB-3 FB-3 FB-3');
    expect(cajas({ desempate: 'arriba' })).toBe('FB-1 FB-3 FB-3 FB-3 FB-3 FB-3');
    expect(cajas({ preferirConPuertos: true })).toBe('FB-3 FB-3 FB-3 FB-3 FB-3 FB-3');
    expect(cajas({ distanciaMaxima: 1 })).toBe('FB-1 FB-1 FB-3 FB-3 - -');
    expect(cajas({ asignacionCaja: 'mismo-piso' })).toBe('FB-1 - FB-3 - - -');
    expect(cajas({ asignacionCaja: 'ninguna' })).toBe('- - - - - -');
  });

  it('etiquetas vacías y acometida traducida', () => {
    const m = normalizarEdificio(
      sintetico([piso('1', ['', null])], { bd_adduction_progress: 'E' }),
      opcionesEdificio({ avanceAcometida: { E: 'Ejecutada' } }),
    );
    expect(m.pisos[0]?.unidades.map((u) => u.etiqueta)).toEqual(['?', '?']);
    expect(m.acometida).toEqual({ codigo: 'E', texto: 'Ejecutada' });
  });
});

describe('selección de unidades', () => {
  const m = deMuestra('TERCERO');
  const p4 = m.pisos.find((p) => p.etiqueta === 'Piso 4') as Piso;
  const unidadB = p4.unidades[1] ?? { id: '', etiqueta: '', idWeezie: null };

  it('texto de la selección para Observaciones', () => {
    const s = seleccionUnidad(m, p4, unidadB);
    expect(s.texto).toBe(
      'Ubicación en edificio: RES. (C) TERCERO · Piso 4 · Unidad B · Caja de piso PTGCNT-03A-D (8 de 8 puertos libres)',
    );
    expect(s).toMatchObject({
      piso: 'Piso 4',
      unidad: 'B',
      caja: { etiqueta: 'PTGCNT-03A-D', libres: 8, total: 8, piso: 'Piso 4' },
    });
  });

  it('IDs de Weezie del piso, la unidad y la caja de piso', () => {
    const s = seleccionUnidad(m, p4, unidadB);
    expect(s.ids.piso).toBe(p4.idWeezie);
    expect(s.ids.unidad).toBe(unidadB.idWeezie);
    expect(s.ids.caja).toBe(p4.caja?.idWeezie);
    expect(s.ids.cierreCaja).toBe(p4.caja?.idCierre);
    expect(Object.values(s.ids).every((id) => typeof id === 'number')).toBe(true);
  });

  it('elegibilidad y motivos', () => {
    expect(puedeElegirUnidad(p4)).toBe(true);
    expect(puedeElegirUnidad(p4, { soloConsulta: true })).toBe(false);
    expect(puedeElegirUnidad({ estado: 'sin-puertos' })).toBe(false);
    expect(puedeElegirUnidad({ estado: 'sin-puertos' }, { permitirSinPuertos: true })).toBe(true);
    expect(motivoNoElegible({ estado: 'sin-caja' })).toMatch(/Ninguna caja/);
    expect(motivoNoElegible(p4, true)).toMatch(/solo consulta/);
  });

  it('búsqueda "4B" y "pb l2"', () => {
    const pb = m.pisos[0] as Piso;
    expect(coincideUnidad(p4, { etiqueta: 'B' }, '4B')).toBe(true);
    expect(coincideUnidad(p4, { etiqueta: 'C' }, '4B')).toBe(false);
    expect(coincideUnidad(pb, { etiqueta: 'L2' }, 'pb l2')).toBe(true);
    expect(coincideUnidad(p4, { etiqueta: 'B' }, '')).toBe(false);
  });
});
