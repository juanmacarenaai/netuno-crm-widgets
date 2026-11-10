import { describe, expect, it } from 'vitest';
import { consumoInternet, consumoTelefonia, mensajeSinConsumo, periodoActual } from './consumo';

describe('periodoActual', () => {
  it('mes en curso con primer y último día', () => {
    expect(periodoActual(new Date(2026, 9, 23))).toEqual({
      fecha: '10/2026',
      inicio: '01/10/2026',
      fin: '31/10/2026',
    });
    expect(periodoActual(new Date(2028, 1, 10))).toEqual({
      fecha: '02/2028',
      inicio: '01/02/2028',
      fin: '29/2/2028',
    });
  });
});

describe('mensajeSinConsumo', () => {
  it('usa el mensaje de la API', () => {
    expect(mensajeSinConsumo({ message: 'No existe consumo' })).toBe('No existe consumo');
  });

  it('lista vacía o nula tiene mensaje propio', () => {
    expect(mensajeSinConsumo([])).toMatch(/No hay datos/);
    expect(mensajeSinConsumo(null)).toMatch(/No hay datos/);
  });

  it('con datos no hay mensaje', () => {
    expect(mensajeSinConsumo([{ consumoTotal: 10 }])).toBeNull();
    expect(mensajeSinConsumo({ consumo: [] })).toBeNull();
  });
});

describe('consumoInternet', () => {
  const periodo = { inicio: '01/10/2026', fin: '31/10/2026' };

  it('toma el primer registro', () => {
    const campos = Object.fromEntries(
      consumoInternet([{ unidadMedida: 'GB', consumoTotal: 120 }], '5000001', periodo),
    );
    expect(campos).toMatchObject({
      Contrato: '5000001',
      'Unidad Medida': 'GB',
      'Consumo Total': 120,
      MAC: 'Sin datos',
    });
  });

  it('las fechas del período son el respaldo', () => {
    const campos = Object.fromEntries(consumoInternet([{}], '5000001', periodo));
    expect(campos['Fecha Inicio']).toBe('01/10/2026');
    expect(campos['Fecha Fin']).toBe('31/10/2026');
  });
});

describe('consumoTelefonia', () => {
  const respuesta = {
    fechaInicio: '01/10/2026',
    consumo: [
      {
        cuenta: '111',
        nroTlf: '02120000000',
        idAccountPO: 'PO1',
        servicioNacional: { total: 100, usado: 0, restante: 100 },
      },
      { cuenta: '222', nroTlf: '02129999999' },
    ],
  };

  it('filtra la línea de la cuenta', () => {
    const r = consumoTelefonia(respuesta, '111', '5000009');
    const campos = Object.fromEntries(r.campos);
    expect(campos['Número de teléfono']).toBe('02120000000');
    expect(campos.Id).toBe('PO1');
    expect(campos['Fecha Fin']).toBe('Sin datos');
    expect(r.nacional).toEqual({ total: 100, usado: 0, restante: 100 });
    expect(r.internacional).toEqual({ total: 'Sin datos', usado: 'Sin datos', restante: 'Sin datos' });
  });

  it('el número de cuenta puede llegar como número', () => {
    expect(Object.fromEntries(consumoTelefonia(respuesta, 111, '1').campos).Id).toBe('PO1');
  });

  it('cuenta sin línea', () => {
    const r = consumoTelefonia({}, '333', '5000009');
    expect(Object.fromEntries(r.campos)['Número de teléfono']).toBe('Sin datos');
  });
});
