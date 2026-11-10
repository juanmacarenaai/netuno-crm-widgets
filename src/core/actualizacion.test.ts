import { describe, expect, it } from 'vitest';
import { marcaDelHtml, urlDeRecuperacion, urlParaActualizar } from './actualizacion';

describe('marcaDelHtml', () => {
  it('lee la marca de la página publicada', () => {
    expect(marcaDelHtml('<head><meta name="netuno-build" content="0.2.0|2026-11-05T18:22:43Z"></head>')).toBe(
      '0.2.0|2026-11-05T18:22:43Z',
    );
    expect(marcaDelHtml('<head></head>')).toBeNull();
  });
});

describe('urlParaActualizar', () => {
  const zoho =
    'https://widgets-netuno.onslate.com/resumen.html?serviceOrigin=https%3A%2F%2Fcrm.zoho.com&frameorigin=x';

  it('no recarga si ya corre la versión publicada o si no se pudo leer', () => {
    expect(urlParaActualizar(zoho, '0.2.0|a', '0.2.0|a')).toBeNull();
    expect(urlParaActualizar(zoho, '0.2.0|a', null)).toBeNull();
  });

  it('recarga con ?nv conservando los parámetros de Zoho', () => {
    const destino = urlParaActualizar(zoho, '0.1.0|a', '0.2.0|b');
    expect(destino).not.toBeNull();
    const url = new URL(destino ?? '');
    expect(url.pathname).toBe('/resumen.html');
    expect(url.searchParams.get('serviceOrigin')).toBe('https://crm.zoho.com');
    expect(url.searchParams.get('frameorigin')).toBe('x');
    expect(url.searchParams.get('nv')).toBe('0.2.0|b');
  });

  it('no entra en bucle si la URL ya pidió esa versión', () => {
    const yaPedida = urlParaActualizar(zoho, '0.1.0|a', '0.2.0|b') ?? '';
    expect(urlParaActualizar(yaPedida, '0.1.0|a', '0.2.0|b')).toBeNull();
  });
});

describe('recuperación de una descarga fallida', () => {
  it('recarga una sola vez con una URL nueva y conserva los parámetros de Zoho', () => {
    const url =
      'https://w.onslate.com/contrasenas.html?serviceOrigin=https%3A%2F%2Fcrm.zoho.com&frameorigin=x';
    const destino = urlDeRecuperacion(url, 1234);
    expect(destino).not.toBeNull();
    const nueva = new URL(destino ?? '');
    expect(nueva.searchParams.get('nv')).toBe('1234');
    expect(nueva.searchParams.get('nr')).toBe('1');
    expect(nueva.searchParams.get('serviceOrigin')).toBe('https://crm.zoho.com');
    expect(urlDeRecuperacion(destino ?? '', 5678)).toBeNull();
  });
});
