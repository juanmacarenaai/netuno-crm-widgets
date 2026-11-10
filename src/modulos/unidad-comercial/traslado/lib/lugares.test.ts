import { describe, expect, it } from 'vitest';
import {
  buscarPuntos,
  clasificarPhoton,
  formatoMetros,
  lugaresDesdePhoton,
  subtituloPunto,
  sugerenciasPuntos,
  urlPhoton,
  type PropiedadesPhoton,
} from './lugares';

const cfg = {
  photon: { url: 'https://photon.komoot.io/api/', countrycode: 'VE', sesgoEscala: 0.3 },
  limiteLugares: 7,
};

describe('Photon', () => {
  it('clasifica estados, ciudades, calles y comercios', () => {
    expect(clasificarPhoton({ type: 'state' })).toMatchObject({ tipo: 'Estado', esArea: true });
    expect(clasificarPhoton({ type: 'city', osm_value: 'village' }).tipo).toBe('Pueblo');
    expect(clasificarPhoton({ type: 'county', name: 'Distrito Capital' }).tipo).toBe('Distrito');
    expect(clasificarPhoton({ type: 'street', osm_value: 'primary' })).toMatchObject({
      tipo: 'Avenida',
      esArea: false,
    });
    expect(clasificarPhoton({ type: 'house', osm_value: 'mall' }).tipo).toBe('Centro comercial');
    expect(clasificarPhoton({ type: 'house', osm_key: 'building' }).tipo).toBe('Edificio');
  });

  it('URL con sesgo hacia el mapa visible', () => {
    expect(urlPhoton('las mercedes', null, cfg)).toBe(
      'https://photon.komoot.io/api/?q=las%20mercedes&limit=7&countrycode=VE',
    );
    expect(urlPhoton('x', { lat: 10.123456, lon: -66.9, zoom: 25 }, cfg)).toContain(
      '&lat=10.12346&lon=-66.90000&zoom=18&location_bias_scale=0.3',
    );
  });

  it('convierte el GeoJSON, arma la jerarquía y une tramos repetidos', () => {
    const f = (props: PropiedadesPhoton, coords: [number, number] = [-66.9, 10.5]) => ({
      properties: props,
      geometry: { coordinates: coords },
    });
    const lugares = lugaresDesdePhoton(
      {
        features: [
          f({
            osm_type: 'W',
            osm_id: 1,
            type: 'street',
            osm_key: 'highway',
            name: 'Calle 5',
            city: 'Caracas',
            state: 'Distrito Capital',
          }),
          f({
            osm_type: 'W',
            osm_id: 2,
            type: 'street',
            osm_key: 'highway',
            name: 'Calle 5',
            city: 'Caracas',
            state: 'Distrito Capital',
          }),
          f({
            osm_type: 'R',
            osm_id: 3,
            type: 'state',
            name: 'Miranda',
            country: 'Venezuela',
            extent: [-67, 11, -66, 10],
          }),
          { properties: { type: 'house' } },
        ],
      },
      { lat: 10.5, lon: -66.9 },
    );
    expect(lugares).toHaveLength(2);
    expect(lugares[0]).toMatchObject({
      nombre: 'Calle 5',
      detalle: 'Caracas, Distrito Capital',
      tipo: 'Calle',
      zoom: 17,
      distancia: 0,
    });
    expect(lugares[1]).toMatchObject({
      nombre: 'Miranda',
      detalle: 'Venezuela',
      esArea: true,
      distancia: null,
      extent: { oeste: -67, norte: 11, este: -66, sur: 10 },
    });
  });
});

describe('buscador de NAP y edificios', () => {
  const puntos = [
    {
      tipo: 'nap' as const,
      etiqueta: 'PTGCNT-03A-X',
      puertosLibres: 2,
      seleccionable: true,
      distancia: 50,
      enZonaEstimada: true,
      grupoEtiqueta: 'Misma zona',
    },
    {
      tipo: 'edificio' as const,
      etiqueta: 'RES. (C) TERCERO',
      puertosLibres: 40,
      seleccionable: true,
      distancia: 17,
      enZonaEstimada: true,
      grupoEtiqueta: 'Misma zona',
    },
    {
      tipo: 'edificio' as const,
      etiqueta: 'TORRE CENTRAL GUANARE',
      puertosLibres: 0,
      seleccionable: false,
      distancia: 90,
      enZonaEstimada: false,
      grupoEtiqueta: 'Fuera de zona',
    },
    {
      tipo: 'nap' as const,
      etiqueta: 'PTGCNT-01A-X',
      puertosLibres: 1,
      seleccionable: true,
      distancia: 80,
      enZonaEstimada: false,
      grupoEtiqueta: 'Otra zona',
    },
  ];

  it('sugerencias: más cercanos con puertos, con su índice en el mapa', () => {
    expect(sugerenciasPuntos(puntos, 2).map((r) => r.indice)).toEqual([1, 0]);
  });

  it('busca por nombre, zona o tipo, sin acentos', () => {
    expect(buscarPuntos(puntos, 'ptgcnt', 8).map((r) => r.indice)).toEqual([0, 3]);
    expect(buscarPuntos(puntos, 'edificio', 8).map((r) => r.indice)).toEqual([1, 2]);
    expect(buscarPuntos(puntos, 'torre guanare', 8).map((r) => r.indice)).toEqual([2]);
  });

  it('subtítulo y distancias', () => {
    expect(subtituloPunto(puntos[0] ?? puntos[1]!)).toBe(
      'NAP · 2 puertos libres · 50 m · Misma zona (estimada)',
    );
    expect(subtituloPunto(puntos[2] ?? puntos[1]!)).toBe('Edificio · Sin puertos · 90 m · Fuera de zona');
    expect([formatoMetros(999), formatoMetros(1500), formatoMetros(250000), formatoMetros(null)]).toEqual([
      '999 m',
      '1.5 km',
      '250 km',
      null,
    ]);
  });
});
