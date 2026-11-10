import { describe, expect, it } from 'vitest';
import { paginaDeModulo, reescribirRutaDev } from './paginas-modulos';

describe('paginaDeModulo', () => {
  it('cambia solo el título', () => {
    const plantilla = '<html><head><title>Netuno</title></head><body><div id="root"></div></body></html>';
    expect(paginaDeModulo(plantilla, { nombre: 'Facturación' })).toBe(
      '<html><head><title>Facturación · Netuno</title></head><body><div id="root"></div></body></html>',
    );
  });

  it('escapa el nombre', () => {
    expect(paginaDeModulo('<title>x</title>', { nombre: 'A & <B>' })).toBe(
      '<title>A &#38; &#60;B&#62; · Netuno</title>',
    );
  });
});

describe('reescribirRutaDev', () => {
  const ids = new Set(['resumen', 'unidad-comercial']);

  it('sirve index.html para un módulo registrado y conserva la consulta', () => {
    expect(reescribirRutaDev('/resumen.html', ids)).toBe('/index.html');
    expect(reescribirRutaDev('/unidad-comercial.html?serviceOrigin=x', ids)).toBe(
      '/index.html?serviceOrigin=x',
    );
  });

  it('no toca otras rutas', () => {
    expect(reescribirRutaDev('/index.html', ids)).toBeNull();
    expect(reescribirRutaDev('/otro.html', ids)).toBeNull();
    expect(reescribirRutaDev('/assets/resumen.html', ids)).toBeNull();
    expect(reescribirRutaDev('/src/main.tsx', ids)).toBeNull();
  });
});
