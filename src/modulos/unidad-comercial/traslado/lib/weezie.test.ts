import { describe, expect, it } from 'vitest';
import muestra from '../datos/weezie-muestra.json';
import { normalizarWeezie, resumenWeezie } from './weezie';

const consulta = { lat: 9.042429, lon: -69.755618, radius: 200, radiusMdu: 200 };
const r = normalizarWeezie(muestra, consulta);
const punto = (id: string) => r.puntos.find((p) => p.id === id);

describe('normalizarWeezie con la muestra de Guanare', () => {
  it('5 NAP y 6 edificios sin duplicados', () => {
    expect(r.resumen).toEqual({ naps: 5, edificios: 6 });
    expect(new Set(r.puntos.map((p) => p.id)).size).toBe(r.puntos.length);
    expect(r.zonaEstimada?.etiqueta).toBe('PTGCNTYYYY3A / 03A (Zona PON Construida)');
  });

  it('NAP: categoría por puertos libres y zona estimada', () => {
    expect(punto('nap-2023')).toMatchObject({
      tipo: 'nap',
      categoria: 'nap-con-puertos',
      puertosLibres: 8,
      seleccionable: true,
      enZonaEstimada: true,
      grupo: 'same_area',
    });
    expect(punto('nap-2043')).toMatchObject({ categoria: 'nap-pocos-puertos', puertosLibres: 2 });
    expect(punto('nap-2042')).toMatchObject({
      categoria: 'nap-pocos-puertos',
      puertosLibres: 1,
      grupo: 'other_area',
      enZonaEstimada: false,
    });
  });

  it('edificio: puertos sumados de sus cajas, distancia calculada y MDU original', () => {
    const e = punto('mdu-18158');
    expect(e).toMatchObject({
      tipo: 'edificio',
      etiqueta: 'RES. (C) TERCERO',
      puertosLibres: 40,
      categoria: 'edificio',
    });
    expect(e?.distancia).toBeGreaterThan(0);
    expect(e?.mdu?.mdu_plant?.floors).toHaveLength(9);
    expect(punto('mdu-18191')).toMatchObject({
      categoria: 'edificio-sin-puertos',
      seleccionable: false,
      grupo: 'outside_area',
    });
  });

  it('nombre de edificio sin espacios repetidos y filas de la ficha', () => {
    expect(punto('mdu-18178')?.etiqueta).toBe('(EC) C.C. CUARTO');
    expect(Object.fromEntries(punto('mdu-18158')?.filas ?? [])).toMatchObject({
      Pisos: 9,
      Unidades: 45,
      'Cajas de piso': '5 (40 puertos libres)',
    });
  });

  it('resumen para la leyenda', () => {
    expect(resumenWeezie(r)).toBe(
      'Zona estimada: PTGCNTYYYY3A / 03A (Zona PON Construida) · 5 NAP · 6 edificios',
    );
    expect(resumenWeezie({ zonaEstimada: null, resumen: { naps: 0, edificios: 0 } })).toBe(
      'Sin zona estimada · 0 NAP · 0 edificios',
    );
  });

  it('respuesta vacía, formato anterior de same_area y puntos sin coordenadas', () => {
    expect(normalizarWeezie(null, consulta).puntos).toEqual([]);
    const anterior = normalizarWeezie(
      {
        data: {
          same_area: [
            {
              anz_id: 1,
              anz_label: 'Z',
              closures: [
                { id: 9, label: 'N9', available_ports: 0, coordinates: { lat: 9, lon: -69 } },
                { id: 10, label: 'N10' },
              ],
            },
          ],
        },
      },
      consulta,
    );
    expect(anterior.puntos.map((p) => [p.id, p.categoria])).toEqual([['nap-9', 'nap-sin-puertos']]);
  });
});
