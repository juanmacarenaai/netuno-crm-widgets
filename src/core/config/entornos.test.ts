import { describe, expect, it } from 'vitest';
import { ENTORNOS, nombreEntorno } from './entornos';

describe('nombreEntorno', () => {
  it('usa producción solo con el modo "produccion"', () => {
    expect(nombreEntorno('produccion')).toBe('produccion');
    expect(nombreEntorno('pruebas')).toBe('pruebas');
    expect(nombreEntorno('development')).toBe('pruebas');
    expect(nombreEntorno('production')).toBe('pruebas');
  });

  it('respeta VITE_ENTORNO si es válido', () => {
    expect(nombreEntorno('pruebas', 'produccion')).toBe('produccion');
    expect(nombreEntorno('produccion', 'pruebas')).toBe('pruebas');
    expect(nombreEntorno('produccion', 'qa')).toBe('produccion');
    expect(nombreEntorno('development', '')).toBe('pruebas');
  });
});

describe('ENTORNOS', () => {
  it('cada entorno se identifica con su propia clave', () => {
    for (const [clave, entorno] of Object.entries(ENTORNOS)) expect(entorno.nombre).toBe(clave);
  });

  it('pruebas apunta al Desk de pruebas y a Netuno QA', () => {
    expect(ENTORNOS.pruebas.desk.orgId).toBe('850539393');
    expect(ENTORNOS.pruebas.netuno.host).toBe('picq.netuno.net');
  });

  it('todas las APIs de CRM usan la versión 8', () => {
    for (const entorno of Object.values(ENTORNOS)) expect(entorno.crm.apiBase).toMatch(/\/crm\/v8$/);
  });
});
