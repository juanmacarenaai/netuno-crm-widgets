import { describe, expect, it } from 'vitest';
import { describirMotivo, formatearGps, metrosEntre, MOTIVOS, parsearCoordenadas } from './coordenadas';

describe('metrosEntre', () => {
  it('distancia haversine en metros', () => {
    expect(metrosEntre({ lat: 10.5, lon: -66.9 }, { lat: 10.5, lon: -66.9 })).toBe(0);
    // 0,001° de latitud ≈ 111 m
    expect(metrosEntre({ lat: 10.5, lon: -66.9 }, { lat: 10.501, lon: -66.9 })).toBeCloseTo(111.2, 0);
  });
});

// Casos de la tabla de widgetUnidadComercial/app/maps/README.md
describe('parsearCoordenadas', () => {
  it.each([
    '10.1234,-67.1234',
    '10.1234, -67.1234',
    '10.1234;-67.1234',
    '10.1234 -67.1234',
    '10.1234|-67.1234',
  ])('decimal lat,lon: %s', (valor) => {
    expect(parsearCoordenadas(valor)).toMatchObject({
      ok: true,
      lat: 10.1234,
      lon: -67.1234,
      orden: 'lat_lon',
    });
  });

  it('detecta el orden invertido lon,lat', () => {
    expect(parsearCoordenadas('-67.1234,10.1234')).toMatchObject({
      ok: true,
      lat: 10.1234,
      lon: -67.1234,
      orden: 'lon_lat',
    });
  });

  it.each(['10.1234 N, 67.1234 W', '10.1234 N 67.1234 O', 'N10.1234 W67.1234'])(
    'hemisferios: %s',
    (valor) => {
      expect(parsearCoordenadas(valor)).toMatchObject({ ok: true, lat: 10.1234, lon: -67.1234 });
    },
  );

  it('un hemisferio sur explícito no se corrige hacia Venezuela', () => {
    expect(parsearCoordenadas('10.1234S, 67.1234W')).toMatchObject({ ok: false, motivo: MOTIVOS.FUERA_PAIS });
  });

  it('grados, minutos y segundos', () => {
    const geo = parsearCoordenadas('10°07\'24"N 67°07\'24"W');
    expect(geo).toMatchObject({ ok: true, origen: 'gms' });
    expect(geo.lat).toBeCloseTo(10.1233, 3);
    expect(geo.lon).toBeCloseTo(-67.1233, 3);
  });

  it.each(['GPS: 10.1234 -67.1234', 'Caracas 10.1234 -67.1234 Venezuela'])(
    'ignora prefijos y prosa: %s',
    (valor) => {
      expect(parsearCoordenadas(valor)).toMatchObject({ ok: true, lat: 10.1234, lon: -67.1234 });
    },
  );

  it('longitud positiva sin letra', () => {
    expect(parsearCoordenadas('utm 10.1234 67.1234')).toMatchObject({
      ok: true,
      lon: -67.1234,
      orden: 'lon_sin_signo',
    });
  });

  it('ignora números extra', () => {
    expect(parsearCoordenadas('10.4806, -66.9036, Contrato 555')).toMatchObject({
      ok: true,
      lat: 10.4806,
      lon: -66.9036,
    });
  });

  it.each([
    [{ lat: 10.5, lon: -66.9 }, 'objeto'],
    [{ lat: '10.5', lng: '-66.9' }, 'objeto'],
    [{ latitude: 10.5, longitude: -66.9 }, 'objeto'],
    [{ y: 10.5, x: -66.9 }, 'objeto'],
    [{ type: 'Point', coordinates: [-66.9, 10.5] }, 'geojson'],
  ])('objetos: %j', (valor, origen) => {
    expect(parsearCoordenadas(valor)).toMatchObject({ ok: true, lat: 10.5, lon: -66.9, origen });
  });

  it.each(['', 'Sin datos', 'N/A', '0,0', '-'])('sin dato: "%s"', (valor) => {
    expect(parsearCoordenadas(valor)).toMatchObject({ ok: false, motivo: MOTIVOS.VACIO });
  });

  it('null y undefined son coordenada nula', () => {
    expect(parsearCoordenadas(null).motivo).toBe(MOTIVOS.NULO);
    expect(parsearCoordenadas(undefined).motivo).toBe(MOTIVOS.NULO);
  });

  it('fuera del país y formato no reconocible', () => {
    expect(parsearCoordenadas('40.7128,-74.0060').motivo).toBe(MOTIVOS.FUERA_PAIS);
    expect(parsearCoordenadas('abc').motivo).toBe(MOTIVOS.FORMATO);
    expect(parsearCoordenadas('95 200').motivo).toBe(MOTIVOS.RANGO);
    // La coma se lee como decimal: "95,200" es un solo número
    expect(parsearCoordenadas('95,200').motivo).toBe(MOTIVOS.FORMATO);
  });
});

describe('describirMotivo y formatearGps', () => {
  it('describe el motivo para el panel del mapa', () => {
    expect(describirMotivo(parsearCoordenadas(''))).toBe('sin geolocalizacion');
    expect(describirMotivo(parsearCoordenadas('40.7,-74.0'))).toBe('coordenadas fuera del area de operacion');
    expect(describirMotivo(parsearCoordenadas('abc'))).toBe('formato no reconocido');
    expect(describirMotivo(parsearCoordenadas('10.5,-66.9'))).toBe('');
  });

  it('formatea para mostrar', () => {
    expect(formatearGps('10.5, -66.9')).toBe('GPS: 10.5, -66.9');
    expect(formatearGps('texto raro')).toBe('GPS: texto raro');
    expect(formatearGps('Sin datos')).toBe('');
    expect(formatearGps(null)).toBe('');
  });
});
