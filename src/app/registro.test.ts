import { describe, expect, it } from 'vitest';
import { MODULOS } from '@/modulos';
import { paginasDeModulos, rutaDeModulo } from './cargadores';

// Protege el registro único: si alguien agrega un módulo a medias, esta prueba lo detecta.
describe('registro de módulos (src/modulos.ts)', () => {
  const ids = MODULOS.map((m) => m.id);

  it('los ids son únicos y en kebab-case', () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('"index" está reservado para el Lanzador', () => {
    expect(ids).not.toContain('index');
  });

  it('cada módulo registrado tiene su carpeta src/modulos/<id>/index.tsx', () => {
    for (const id of ids)
      expect(Object.keys(paginasDeModulos), `Falta src/modulos/${id}/index.tsx`).toContain(rutaDeModulo(id));
  });

  it('cada carpeta de src/modulos está registrada', () => {
    const carpetas = Object.keys(paginasDeModulos).map((ruta) => ruta.split('/')[2]);
    for (const carpeta of carpetas) expect(ids, `Registra "${carpeta}" en src/modulos.ts`).toContain(carpeta);
  });
});
