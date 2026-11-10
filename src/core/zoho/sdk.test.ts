import { describe, expect, it } from 'vitest';
import { ApiError } from '@/core/http/errores';
import { extraerMensajeConexion, parsearRespuesta } from './sdk';

describe('parsearRespuesta', () => {
  it('convierte el texto en JSON', () => {
    expect(parsearRespuesta('{"cuentas":[1]}')).toEqual({ cuentas: [1] });
    expect(parsearRespuesta([1, 2])).toEqual([1, 2]);
  });

  it('lanza ApiError con el status_code de Netuno', () => {
    expect(() => parsearRespuesta('{"status_code":404}')).toThrow(ApiError);
    try {
      parsearRespuesta('{"status_code":412}');
    } catch (error) {
      expect((error as ApiError).codigo).toBe(412);
    }
  });

  it('lanza ApiError si el texto no es JSON', () => {
    expect(() => parsearRespuesta('<html>')).toThrow('Respuesta inválida del servidor.');
  });
});

describe('extraerMensajeConexion', () => {
  it('devuelve statusMessage', () => {
    expect(extraerMensajeConexion({ details: { statusMessage: { data: [] } } })).toEqual({ data: [] });
  });

  it('lanza ApiError con los errores de Desk y de CRM', () => {
    expect(() =>
      extraerMensajeConexion({
        details: { statusMessage: { errorCode: 'UNAUTHORIZED', message: 'Sin permiso' } },
      }),
    ).toThrow('Sin permiso');
    expect(() =>
      extraerMensajeConexion({
        details: { statusMessage: { code: 'INVALID_URL_PATTERN', status: 'error', message: 'URL inválida' } },
      }),
    ).toThrow('URL inválida');
  });

  it('lanza ApiError si la respuesta no trae statusMessage', () => {
    expect(() => extraerMensajeConexion({ code: 'SUCCESS' })).toThrow('Respuesta inesperada de la conexión.');
    expect(() => extraerMensajeConexion(null)).toThrow(ApiError);
  });
});
