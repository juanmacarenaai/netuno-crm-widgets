import { describe, expect, it } from 'vitest';
import { idDesdeUbicacion } from './resolverModulo';

describe('idDesdeUbicacion', () => {
  it('toma el módulo del nombre de la página', () => {
    expect(idDesdeUbicacion('/resumen.html', '')).toBe('resumen');
    expect(idDesdeUbicacion('/widgets/unidad-comercial.html', '?serviceOrigin=https://crm.zoho.com')).toBe(
      'unidad-comercial',
    );
  });

  it('acepta ?modulo= en index.html o en la raíz', () => {
    expect(idDesdeUbicacion('/index.html', '?modulo=historial')).toBe('historial');
    expect(idDesdeUbicacion('/', '?modulo=facturacion&x=1')).toBe('facturacion');
  });

  it('sin módulo devuelve null (Lanzador)', () => {
    expect(idDesdeUbicacion('/', '')).toBeNull();
    expect(idDesdeUbicacion('/index.html', '?serviceOrigin=x')).toBeNull();
    expect(idDesdeUbicacion('/index.html', '?modulo=')).toBeNull();
  });
});
