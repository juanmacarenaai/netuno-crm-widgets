import { describe, expect, it } from 'vitest';
import { normalizarPaquete, planActual } from './planes';

describe('normalizarPaquete', () => {
  it('Megas y Gigas', () => {
    expect(normalizarPaquete('400Mb')).toBe('400 Megas');
    expect(normalizarPaquete('Fibranet10Gb_10Gb')).toBe('10 Gigas');
  });

  it('beneficiarios de Salud', () => {
    expect(normalizarPaquete('Beneficiario Adicional')).toBe('Beneficiario');
  });

  it('lo que no reconoce queda igual', () => {
    expect(normalizarPaquete('Telefonía')).toBe('Telefonía');
    expect(normalizarPaquete(undefined)).toBeUndefined();
    expect(normalizarPaquete(null)).toBeNull();
  });
});

describe('planActual', () => {
  it('toma la parte después del guion bajo', () => {
    expect(planActual({ nombrePaquete: 'Fibranet600_600Mb' })).toBe('600 Megas');
  });

  it('con Gb usa el nombre de facturación sin "Fibranet"', () => {
    expect(
      planActual({ nombrePaquete: 'Fibranet1Gb_500Mb', nombrePaqueteFact: 'Fibranet 1Gb/500 Megas' }),
    ).toBe('1Gb/500 Megas');
  });

  it('sin contrato no hay plan', () => {
    expect(planActual(null)).toBeUndefined();
  });
});
