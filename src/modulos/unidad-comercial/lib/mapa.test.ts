import { describe, expect, it, vi } from 'vitest';
import type { Contrato } from '@/shared/cuentas';
import { armarPunto, colorServicio, componerDireccion, conLimite, obtenerPuntosCuenta } from './mapa';

const contrato = (idProducto: string, nombreServicio = 'Internet'): Contrato => ({
  idProducto,
  codContrato: `C-${idProducto}`,
  nombreServicio,
  nombrePaquete: 'Plan',
  status: 'Conectado',
});

describe('armarPunto', () => {
  it('toma coordenadas y dirección del contrato BOSS', () => {
    const punto = armarPunto('9000001', contrato('5000001'), {
      coordenadasGps: '10.5,-66.9',
      ubicacion: [{ estado: 'Distrito Capital', ciudad: 'Caracas', calle: ' ' }],
    });
    expect(punto).toMatchObject({ id: '9000001|5000001|Internet', lat: 10.5, lon: -66.9, error: null });
    expect(punto.direccionTexto).toBe('Distrito Capital, Caracas');
  });

  it('sin BOSS usa ubicacionJSON del contrato', () => {
    const punto = armarPunto('1', { ...contrato('2'), ubicacionJSON: [{ ciudad: 'Valencia' }] }, null);
    expect(punto.direccionTexto).toBe('Valencia');
    expect(punto.geo.ok).toBe(false);
  });

  it('con error no tiene coordenadas', () => {
    const punto = armarPunto('1', contrato('2'), null, 'Tiempo de espera excedido');
    expect(punto).toMatchObject({ lat: null, lon: null, error: 'Tiempo de espera excedido' });
  });
});

describe('utilidades', () => {
  it('dirección vacía', () => {
    expect(componerDireccion({ estado: null, ciudad: null })).toBe('Sin direccion registrada');
  });

  it('color por servicio con respaldo', () => {
    expect(colorServicio('Internet')).toBe('#1e88e5');
    expect(colorServicio('Otro')).toBe('#546e7a');
  });

  it('conLimite respeta el máximo de tareas simultáneas y conserva el orden', async () => {
    let activas = 0;
    let maximo = 0;
    const tarea = (valor: number) => async () => {
      activas++;
      maximo = Math.max(maximo, activas);
      await new Promise((r) => setTimeout(r, 5));
      activas--;
      if (valor === 3) throw new Error('falla');
      return valor;
    };
    const resultados = await conLimite([1, 2, 3, 4, 5, 6].map(tarea), 2);
    expect(maximo).toBe(2);
    expect(resultados.slice(0, 2)).toEqual([1, 2]);
    expect((resultados[2] as { error: Error }).error.message).toBe('falla');
    expect(resultados[5]).toBe(6);
  });
});

describe('obtenerPuntosCuenta', () => {
  it('incluye los servicios cuya consulta falla y reporta progreso', async () => {
    const consultar = vi.fn(async (id: string) => {
      if (id === '2') throw new Error('Error del servidor: 500');
      return { coordenadasGps: '10.5,-66.9' };
    });
    const alProgresar = vi.fn();
    const cuenta = {
      cuenta: 9000001,
      descTipoCliente: 'Hogar',
      contratos: [contrato('1'), contrato('2'), { nombreServicio: 'Salud' } as Contrato],
    };

    const r = await obtenerPuntosCuenta(cuenta, consultar, { alProgresar });

    expect(r.titulo).toBe('Hogar 9000001');
    expect(r.puntos).toHaveLength(3);
    expect(r.puntos.filter((p) => p.geo.ok)).toHaveLength(1);
    expect(
      r.puntos
        .map((p) => p.error)
        .filter(Boolean)
        .sort(),
    ).toEqual(['Contrato sin identificador', 'Error del servidor: 500']);
    expect(consultar).toHaveBeenCalledTimes(2);
    expect(alProgresar).toHaveBeenCalledTimes(3);
  });

  it('cuenta sin contratos', async () => {
    const r = await obtenerPuntosCuenta({ cuenta: '1' }, vi.fn());
    expect(r).toEqual({ cuenta: '1', titulo: '1', puntos: [] });
  });
});
