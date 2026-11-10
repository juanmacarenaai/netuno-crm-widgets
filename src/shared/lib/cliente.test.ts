import { describe, expect, it } from 'vitest';
import { aliasDeEmail, armarDocumento, documentoDelRegistro, listaDeDepartamentos } from './cliente';

describe('listaDeDepartamentos', () => {
  it('multiselección, texto o vacío', () => {
    expect(listaDeDepartamentos(['Ventas', 'Servicio al Cliente'])).toEqual([
      'Ventas',
      'Servicio al Cliente',
    ]);
    expect(listaDeDepartamentos('Servicio al Cliente')).toEqual(['Servicio al Cliente']);
    expect(listaDeDepartamentos(null)).toEqual([]);
    expect(listaDeDepartamentos('  ')).toEqual([]);
  });
});

describe('armarDocumento', () => {
  it('agrega el prefijo de los RIF', () => {
    expect(armarDocumento('RIF-J', '123456789')).toBe('J123456789');
    expect(armarDocumento('RIF-V', 6341735)).toBe('V6341735');
    expect(armarDocumento('Gobierno', '200')).toBe('G200');
  });

  it('las cédulas y pasaportes van sin prefijo', () => {
    expect(armarDocumento('Cédula', '6341735')).toBe('6341735');
    expect(armarDocumento('Pasaporte', 'AB123')).toBe('AB123');
    expect(armarDocumento(undefined, '6341735')).toBe('6341735');
  });

  it('sin número no hay documento', () => {
    expect(armarDocumento('Cédula', '')).toBeNull();
    expect(armarDocumento('Cédula', null)).toBeNull();
    expect(armarDocumento('RIF-J', '  ')).toBeNull();
  });
});

describe('documentoDelRegistro', () => {
  it('lee los campos del registro de CRM', () => {
    expect(documentoDelRegistro({ cf_tipo_documento: 'RIF-E', cf_documento_de_identidad: '99' })).toBe('E99');
    expect(documentoDelRegistro({})).toBeNull();
  });
});

describe('aliasDeEmail', () => {
  it('toma la parte antes de la @', () => {
    expect(aliasDeEmail('yosira@macarena.ai')).toBe('yosira');
    expect(aliasDeEmail(undefined)).toBe('');
  });
});
