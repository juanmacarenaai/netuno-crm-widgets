import { describe, expect, it } from 'vitest';
import { ESTADO_POTENCIA, evaluarPotencia } from './potencia';

describe('evaluarPotencia', () => {
  it('GPON (31): óptima dentro de [-28, -3], incluyendo los bordes', () => {
    expect(evaluarPotencia('31', -20)).toBe(ESTADO_POTENCIA.OPTIMA);
    expect(evaluarPotencia('31', -28)).toBe(ESTADO_POTENCIA.OPTIMA);
    expect(evaluarPotencia('31', -3)).toBe(ESTADO_POTENCIA.OPTIMA);
  });

  it('GPON (31): fuera de rango por debajo y por encima', () => {
    expect(evaluarPotencia('31', -28.1)).toBe(ESTADO_POTENCIA.FUERA_DE_RANGO);
    expect(evaluarPotencia('31', -2)).toBe(ESTADO_POTENCIA.FUERA_DE_RANGO);
  });

  it('tecnologías 3 y 21 usan [-7, 7]', () => {
    expect(evaluarPotencia('3', 0)).toBe(ESTADO_POTENCIA.OPTIMA);
    expect(evaluarPotencia(21, 7.5)).toBe(ESTADO_POTENCIA.FUERA_DE_RANGO);
  });

  it('acepta la potencia como texto, igual que app/index.js', () => {
    expect(evaluarPotencia('31', '-19.5')).toBe(ESTADO_POTENCIA.OPTIMA);
  });

  it('sin referencia si la tecnología no tiene rango', () => {
    expect(evaluarPotencia('99', -20)).toBe(ESTADO_POTENCIA.SIN_REFERENCIA);
    expect(evaluarPotencia(undefined, -20)).toBe(ESTADO_POTENCIA.SIN_REFERENCIA);
  });

  it('sin referencia si la potencia no es numérica (antes se marcaba como óptima)', () => {
    expect(evaluarPotencia('31', 'N/A')).toBe(ESTADO_POTENCIA.SIN_REFERENCIA);
    expect(evaluarPotencia('31', '')).toBe(ESTADO_POTENCIA.SIN_REFERENCIA);
    expect(evaluarPotencia('31', null)).toBe(ESTADO_POTENCIA.SIN_REFERENCIA);
    expect(evaluarPotencia('31', undefined)).toBe(ESTADO_POTENCIA.SIN_REFERENCIA);
  });
});
