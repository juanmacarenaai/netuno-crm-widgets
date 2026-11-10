import { describe, expect, it } from 'vitest';
import {
  estadoCompromiso,
  estadoUltimoPago,
  fechaDe,
  fechaLegible,
  nombreMoneda,
  serviciosDeCuenta,
} from './facturacion';

const hoy = new Date(2026, 10, 6, 15, 0);

describe('tarjeta de la cuenta', () => {
  it('moneda con nombre', () => {
    expect(nombreMoneda({ descMoneda: 'USD' })).toBe('Dólares ($)');
    expect(nombreMoneda({ descMoneda: 'VEF', monedaPago: 'Bs' })).toBe('Bolívares (Bs)');
    expect(nombreMoneda({ descMoneda: 'EUR' })).toBe('EUR');
    expect(nombreMoneda({})).toBe('Sin moneda');
  });

  it('fechas dd/mm/aaaa, aaaa-mm-dd e ISO', () => {
    expect(fechaDe('5/11/2026')).toEqual(new Date(2026, 10, 5));
    expect(fechaDe('2026-11-05T10:00:00-04:00')).toEqual(new Date(2026, 10, 5));
    expect(fechaDe(null)).toBeNull();
    expect(fechaLegible('2026-11-05')).toBe('05/11/2026');
    expect(fechaLegible('pronto')).toBe('pronto');
  });

  it('compromiso de pago: vencido, próximo, vigente o sin compromiso', () => {
    expect(estadoCompromiso('01/11/2026', hoy)).toEqual({
      tono: 'vencido',
      fecha: '01/11/2026',
      detalle: 'Venció hace 5 días',
    });
    expect(estadoCompromiso('05/11/2026', hoy).detalle).toBe('Venció ayer');
    expect(estadoCompromiso('06/11/2026', hoy)).toMatchObject({ tono: 'proximo', detalle: 'Vence hoy' });
    expect(estadoCompromiso('07/11/2026', hoy).detalle).toBe('Vence mañana');
    expect(estadoCompromiso('11/11/2026', hoy)).toMatchObject({
      tono: 'proximo',
      detalle: 'Vence en 5 días',
    });
    expect(estadoCompromiso('30/11/2026', hoy)).toMatchObject({ tono: 'vigente', detalle: 'Faltan 24 días' });
    expect(estadoCompromiso(null, hoy)).toEqual({
      tono: 'sin',
      fecha: '',
      detalle: 'Sin compromiso de pago',
    });
  });

  it('último pago con hace cuánto', () => {
    expect(estadoUltimoPago('10/10/2026', hoy)).toEqual({
      tono: 'vigente',
      fecha: '10/10/2026',
      detalle: 'Hace 27 días',
    });
    expect(estadoUltimoPago('05/11/2026', hoy).detalle).toBe('Ayer');
    expect(estadoUltimoPago(undefined, hoy)).toEqual({
      tono: 'sin',
      fecha: '',
      detalle: 'Sin pagos registrados',
    });
  });

  it('servicios desde los contratos o desde el resumen', () => {
    expect(
      serviciosDeCuenta({
        contratos: [
          {
            idProducto: '1',
            nombreServicio: 'Internet',
            nombrePaquete: 'Fibranet400_400Mb',
            status: 'Conectado',
          },
          {
            idProducto: '2',
            nombreServicio: 'Streaming',
            nombrePaquete: 'NetUnoGO Plus 5',
            status: 'Desconectado',
          },
        ],
      }),
    ).toEqual([
      { clave: '1', nombre: '400 Megas', servicio: 'Internet', conectado: true },
      { clave: '2', nombre: 'NetUnoGO Plus 5', servicio: 'Streaming', conectado: false },
    ]);
    expect(
      serviciosDeCuenta({ contratos: [], resumenServicios: 'Fibranet400_400Mb, Telefonía' }).map(
        (s) => s.nombre,
      ),
    ).toEqual(['Fibranet400_400Mb', 'Telefonía']);
    expect(serviciosDeCuenta({ resumenServicios: null })).toEqual([]);
  });
});
