import { describe, expect, it } from 'vitest';
import type { Contrato } from '@/shared/cuentas';
import {
  armarSolicitud,
  contratoReferencia,
  contratosParaTraslado,
  coordenadasPegadas,
  datosDesdeContratoBoss,
  direccionActual,
  estadoSegunCanal,
  fechaMinima,
  leerCoordenadas,
  observacionesConUnidad,
  politicaWifi,
  puedeConfirmar,
  resultadoDesdePunto,
  simularCobertura,
  textoResultado,
  tipoViviendaTrasPunto,
} from './traslado';

const internet: Contrato = {
  idProducto: '1',
  codContrato: 'A1',
  nombreServicio: 'Internet',
  nombrePaquete: 'Fibra 500',
};
const tv: Contrato = { idProducto: '2', codContrato: 'A2', nombreServicio: 'Streaming' };

describe('politicaWifi', () => {
  it('sin datos para valores vacíos', () => {
    expect(politicaWifi(undefined)).toBe('Sin datos');
    expect(politicaWifi(null)).toBe('Sin datos');
    expect(politicaWifi('  ')).toBe('Sin datos');
  });

  it('reconoce las variantes afirmativas y negativas', () => {
    expect(politicaWifi('Sí')).toBe('Con WiFi');
    expect(politicaWifi(' ACTIVO ')).toBe('Con WiFi');
    expect(politicaWifi(1)).toBe('Con WiFi');
    expect(politicaWifi('no')).toBe('Sin WiFi');
    expect(politicaWifi(false)).toBe('Sin WiFi');
  });

  it('devuelve el valor original si no lo reconoce', () => {
    expect(politicaWifi('Dual band')).toBe('Dual band');
  });
});

describe('contratos', () => {
  it('Hogar: todos; Empresa: solo Internet', () => {
    expect(contratosParaTraslado({ descTipoCliente: 'Hogar', contratos: [tv, internet] })).toHaveLength(2);
    expect(contratosParaTraslado({ descTipoCliente: 'Empresa', contratos: [tv, internet] })).toEqual([
      internet,
    ]);
    expect(contratosParaTraslado({})).toEqual([]);
  });

  it('referencia: Internet o el primero', () => {
    expect(contratoReferencia([tv, internet])).toBe(internet);
    expect(contratoReferencia([tv])).toBe(tv);
    expect(contratoReferencia([])).toBeNull();
  });

  it('dirección actual desde la cuenta', () => {
    expect(
      direccionActual({
        ubicacionJSON: [{ direccion: 'Av. Principal, ', ciudad: 'Caracas', estado: 'Miranda' }],
      }),
    ).toBe('Av. Principal, Caracas, Miranda');
    expect(direccionActual({ direccionA: 'Calle 1' })).toBe('Calle 1');
    expect(direccionActual(null)).toBe('Sin datos');
  });

  it('política y GPS desde el contrato BOSS', () => {
    expect(datosDesdeContratoBoss({ wifiActivo: 'Sí', coordenadasGps: '10.5, -66.9' })).toEqual({
      politica: 'Con WiFi',
      gpsTexto: 'GPS: 10.5, -66.9',
      gpsActual: { lat: 10.5, lon: -66.9 },
    });
    expect(datosDesdeContratoBoss({})).toEqual({ politica: 'Sin datos', gpsTexto: '', gpsActual: null });
  });
});

describe('coordenadas', () => {
  it('valida latitud y longitud escritas', () => {
    expect(leerCoordenadas('10.4806', '-66.9036')).toEqual({ ok: true, lat: 10.4806, lon: -66.9036 });
    expect(leerCoordenadas('', '')).toMatchObject({ ok: false, vacio: true });
    expect(leerCoordenadas('40.7', '-74')).toMatchObject({
      mensaje: expect.stringMatching(/fuera de Venezuela/),
    });
    expect(leerCoordenadas('abc', '1')).toMatchObject({ mensaje: expect.stringMatching(/no válidas/) });
  });

  it('pegar "lat, lon" completo', () => {
    expect(coordenadasPegadas('10.4806, -66.9036')).toEqual({ lat: 10.4806, lon: -66.9036 });
    expect(coordenadasPegadas('10.4806')).toBeNull();
  });

  it('fecha mínima de activación: hoy', () => {
    expect(fechaMinima(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('confirmación y cobertura', () => {
  const base = {
    direccionNueva: 'Av. 1',
    fechaActivacion: '2026-11-01',
    canalAtencion: 'Oficina',
    correoCliente: '',
  };

  it('habilita según dirección, fecha y correo fuera de Oficina', () => {
    expect(puedeConfirmar(base).ok).toBe(true);
    expect(puedeConfirmar({ ...base, direccionNueva: ' ' }).ok).toBe(false);
    expect(puedeConfirmar({ ...base, fechaActivacion: '' }).ok).toBe(false);
    expect(puedeConfirmar({ ...base, canalAtencion: 'Chat' }).motivo).toMatch(/correo/);
    expect(puedeConfirmar({ ...base, canalAtencion: 'Chat', correoCliente: 'a@b.com' }).ok).toBe(true);
  });

  it('cobertura simulada por el último dígito de la longitud', () => {
    expect(simularCobertura(10.48, -66.9, '-66.9031').zona).toBe('Roja');
    expect(simularCobertura(10.48, -66.9, '-66.9032').zona).toBe('Naranja');
    expect(simularCobertura(10.48, -66.9, '-66.9035')).toEqual(simularCobertura(10.48, -66.9, '-66.9035'));
  });

  it('resultado desde NAP, edificio y unidad', () => {
    expect(resultadoDesdePunto({ tipo: 'nap', etiqueta: 'N1', puertosLibres: 8 }, 4)).toEqual({
      zona: 'Verde',
      detalle: 'NAP asignada: N1 · 8 puertos libres',
    });
    expect(resultadoDesdePunto({ tipo: 'nap', etiqueta: 'N1', puertosLibres: 1 }, 4)).toEqual({
      zona: 'Naranja',
      detalle: 'Cobertura limitada · NAP: N1 · 1 puerto libre',
    });
    expect(
      resultadoDesdePunto(
        {
          tipo: 'edificio',
          etiqueta: 'E',
          puertosLibres: 40,
          unidad: { caja: { etiqueta: 'FB', libres: 2 } },
        },
        4,
      ),
    ).toEqual({ zona: 'Naranja', detalle: 'Edificio: E · Caja de piso FB · 2 puertos libres' });
  });

  it('texto del resultado con la dirección (salvo zona Roja)', () => {
    expect(textoResultado({ zona: 'Verde', nap: 'NAP-001-A' }, 'Av. 1')).toBe(
      'Zona Verde · NAP asignada: NAP-001-A · Av. 1',
    );
    expect(textoResultado({ zona: 'Roja' }, 'Av. 1')).toBe(
      'Zona Roja · Sin cobertura disponible en esta ubicación',
    );
  });

  it('estado guardado según el canal', () => {
    expect(estadoSegunCanal('Oficina').estado).toBe('Aceptado');
    expect(estadoSegunCanal('Chat').estado).toBe('Pendiente de confirmación');
  });
});

describe('observaciones y tipo de vivienda', () => {
  const prefijo = 'Ubicación en edificio';

  it('agrega, reemplaza y quita solo la línea automática', () => {
    let obs = observacionesConUnidad('Nota del asesor', `${prefijo}: A · Piso 1`, prefijo);
    expect(obs).toBe(`Nota del asesor\n${prefijo}: A · Piso 1`);
    obs = observacionesConUnidad(obs, `${prefijo}: B · Piso 2`, prefijo);
    expect(obs).toBe(`Nota del asesor\n${prefijo}: B · Piso 2`);
    expect(observacionesConUnidad(obs, null, prefijo)).toBe('Nota del asesor');
    expect(observacionesConUnidad('', null, prefijo)).toBe('');
  });

  it('edificio sugiere Apartamento y vuelve a Casa solo si lo puso el widget', () => {
    const edificio = { tipo: 'edificio' as const };
    expect(tipoViviendaTrasPunto({ valor: 'Casa', automatico: false }, edificio)).toEqual({
      valor: 'Apartamento',
      automatico: true,
    });
    expect(tipoViviendaTrasPunto({ valor: 'Local Comercial', automatico: false }, edificio)).toEqual({
      valor: 'Local Comercial',
      automatico: false,
    });
    expect(tipoViviendaTrasPunto({ valor: 'Apartamento', automatico: true }, null)).toEqual({
      valor: 'Casa',
      automatico: false,
    });
    expect(tipoViviendaTrasPunto({ valor: 'Oficina', automatico: false }, null)).toEqual({
      valor: 'Oficina',
      automatico: false,
    });
  });
});

describe('armarSolicitud', () => {
  const fecha = new Date(Date.UTC(2026, 9, 28, 13, 5, 9));
  const base = {
    cuenta: { cuenta: '9000001', descTipoCliente: 'Hogar' },
    contrato: null,
    formulario: {
      politica: 'Con WiFi',
      direccionActual: 'Calle 1',
      direccionNueva: ' Av. 2 ',
      tipoVivienda: 'Casa',
      fechaActivacion: '2026-11-01',
      canalAtencion: 'Oficina',
      observaciones: '',
    },
    coordenadas: { lat: 10.5, lon: -66.9 },
    resultado: { zona: 'Verde' as const, nap: 'NAP-001-A' },
    punto: null,
    cliente: { id: 'C1', documento: 'V1', email: ' a@b.com ' },
    agente: { nombre: 'Ana', id: 'U1', idDesk: 'D1' },
    gpsActual: { lat: 10.4, lon: -66.8 },
    fecha,
  };

  it('Hogar sin punto de Weezie', () => {
    expect(armarSolicitud(base)).toEqual({
      idSolicitud: 'TRS-9000001-20261028130509',
      idCliente: 'C1',
      documento: 'V1',
      fechaSolicitud: '2026-10-28T13:05:09.000Z',
      agente: 'Ana',
      idAgenteCRM: 'U1',
      idAgenteDesk: 'D1',
      cuenta: '9000001',
      tipoCliente: 'Hogar',
      contratos: 'Todos',
      politica: 'Con WiFi',
      direccionActual: 'Calle 1',
      gpsActual: { lat: 10.4, lon: -66.8 },
      direccionNueva: 'Av. 2',
      tipoVivienda: 'Casa',
      fechaActivacion: '2026-11-01',
      canalAtencion: 'Oficina',
      correoCliente: 'a@b.com',
      gpsNuevo: { lat: 10.5, lon: -66.9 },
      cobertura: { origen: 'Simulada', zona: 'Verde', nap: 'NAP-001-A', detalle: null },
      puntoRed: null,
      unidadEdificio: null,
      observaciones: null,
      red: null,
    });
  });

  it('Empresa con contrato, edificio y unidad', () => {
    const punto = {
      tipo: 'edificio' as const,
      id: 'mdu-1',
      idWeezie: 1,
      zonaPon: { id: 125, etiqueta: 'Z', tipo: 'macpl' },
      etiqueta: 'E · Piso 4 · Unidad B',
      zonaEtiqueta: 'Z',
      puertosLibres: 40,
      distancia: 17.4,
      lat: 9,
      lon: -69,
      unidad: {
        edificio: 'E',
        piso: 'Piso 4',
        nivel: '4',
        unidad: 'B',
        caja: { etiqueta: 'FB', piso: 'Piso 4', libres: 8, total: 8 },
        lat: 9,
        lon: -69,
        texto: '',
        ids: { piso: 1309, unidad: 4930, caja: 2037, cierreCaja: 2037 },
      },
    };
    const s = armarSolicitud({
      ...base,
      contrato: internet,
      punto,
      resultado: { zona: 'Verde', detalle: 'x' },
    });
    expect(s.contratos).toEqual([
      { idProducto: '1', codContrato: 'A1', servicio: 'Internet', paquete: 'Fibra 500' },
    ]);
    expect(s.cobertura.origen).toBe('Weezie');
    expect(s.puntoRed).toEqual({
      tipo: 'edificio',
      id: 'mdu-1',
      nombre: 'E',
      zona: 'Z',
      puertosLibres: 40,
      distanciaMetros: 17,
      lat: 9,
      lon: -69,
    });
    expect(s.unidadEdificio).toEqual({
      piso: 'Piso 4',
      unidad: 'B',
      cajaPiso: 'FB',
      pisoCaja: 'Piso 4',
      puertosLibresCaja: 8,
      puertosTotalesCaja: 8,
    });
    expect(s.cobertura.nap).toBe('FB');
    expect(s.red).toEqual({
      fuente: 'Weezie',
      idZonaPon: 125,
      zonaPon: 'Z',
      idOlt: null,
      olt: null,
      idNap: 2037,
      nap: 'FB',
      idEdificio: 1,
      edificio: 'E',
      idPiso: 1309,
      piso: 'Piso 4',
      idCajaPiso: 2037,
      cajaPiso: 'FB',
      idApartamento: 4930,
      apartamento: 'B',
    });
  });

  it('Hogar con NAP de Weezie: zona PON y NAP; sin edificio ni apartamento', () => {
    const s = armarSolicitud({
      ...base,
      resultado: { zona: 'Verde', detalle: 'NAP asignada: PTGCNT-01A-A · 8 puertos libres' },
      punto: {
        tipo: 'nap',
        id: 'nap-2024',
        idWeezie: 2024,
        zonaPon: { id: 124, etiqueta: 'PTGCNTYYYY1A / 01A (Zona PON Propuesta)', tipo: 'macpl' },
        etiqueta: 'PTGCNT-01A-A',
        puertosLibres: 8,
        lat: 9.04,
        lon: -69.75,
      },
    });
    expect(s.cobertura.nap).toBe('PTGCNT-01A-A');
    expect(s.red).toMatchObject({
      idZonaPon: 124,
      zonaPon: 'PTGCNTYYYY1A / 01A (Zona PON Propuesta)',
      idNap: 2024,
      nap: 'PTGCNT-01A-A',
      idEdificio: null,
      idApartamento: null,
      idOlt: null,
    });
  });
});
