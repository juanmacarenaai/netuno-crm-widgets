import { describe, expect, it } from 'vitest';
import { formularioInicial, registroCrm, subcategoriasDe, validarRegistro } from './registros';

describe('registros de CRM', () => {
  const ahora = new Date(2026, 10, 5, 9, 4);
  const registro = { id: 'R1', cf_tipo_documento: 'Cédula' };

  it('formulario inicial: unidades del cliente, fecha según el tipo y usuario', () => {
    expect(
      formularioInicial('atencion', { negocio: ['Hogar', 'Otro'], usuario: 'Ana', ahora }),
    ).toMatchObject({
      negocio: ['Hogar'],
      fecha: '2026-11-05T09:04',
      usuario: 'Ana',
    });
    expect(formularioInicial('comunicaciones', { negocio: 'Empresa', usuario: 'Ana', ahora })).toMatchObject({
      negocio: ['Empresa'],
      fecha: '2026-11-05',
    });
  });

  it('validación: obligatorios y subcategoría de la categoría', () => {
    const vacio = formularioInicial('atencion', { negocio: [], usuario: '', ahora });
    expect(Object.keys(validarRegistro('atencion', vacio)).sort()).toEqual([
      'canal',
      'categoria',
      'cuenta',
      'negocio',
      'subcategoria',
      'usuario',
    ]);
    const categoria = 'Gestión de pagos';
    const lleno = {
      ...vacio,
      negocio: ['Hogar'],
      cuenta: '9',
      categoria,
      subcategoria: subcategoriasDe(categoria)[0] ?? '',
      canal: 'Chat',
      usuario: 'Ana',
    };
    expect(validarRegistro('atencion', lleno)).toEqual({});
    expect(validarRegistro('atencion', { ...lleno, subcategoria: 'Factura' }).subcategoria).toBeDefined();
    const comunicacion = formularioInicial('comunicaciones', { negocio: ['Hogar'], usuario: 'Ana', ahora });
    expect(Object.keys(validarRegistro('comunicaciones', comunicacion)).sort()).toEqual([
      'canal',
      'contacto',
      'cuenta',
    ]);
  });

  it('atención → Cases con Negocio como lista y fecha con segundos', () => {
    const f = {
      ...formularioInicial('atencion', { negocio: ['Hogar', 'Empresa'], usuario: 'Ana', ahora }),
      cuenta: '9',
      categoria: 'Gestión de pagos',
      subcategoria: 'Diferencia en pago',
      canal: 'Chat',
      detalle: ' Nota ',
    };
    expect(registroCrm('atencion', f, { registro, documento: 'V123' })).toEqual({
      modulo: 'Cases',
      datos: {
        Negocio: ['Hogar', 'Empresa'],
        Cuenta: '9',
        Canal: 'Chat',
        Usuario: 'Ana',
        Account_Name: 'R1',
        Tipo_de_Documento: 'Cédula',
        Nro_Documento: 'V123',
        Name: 'Atencion',
        Fecha: '2026-11-05T09:04:00',
        Categoria: 'Gestión de pagos',
        Subcategoria: 'Diferencia en pago',
        Observaciones: 'Nota',
      },
    });
  });

  it('comunicación → Comunicaciones con contacto y motivo (si hay)', () => {
    const f = {
      ...formularioInicial('comunicaciones', { negocio: ['Hogar'], usuario: 'Ana', ahora }),
      cuenta: '9',
      contacto: ' María ',
      canal: 'Oficina',
    };
    const { modulo, datos } = registroCrm('comunicaciones', f, { registro, documento: '123' });
    expect(modulo).toBe('Comunicaciones');
    expect(datos).toMatchObject({ Name: 'Comunicaciones', Fecha: '2026-11-05', Contacto: 'María' });
    expect(datos).not.toHaveProperty('Motivo_mensaje');
    expect(
      registroCrm('comunicaciones', { ...f, detalle: 'Pago' }, { registro, documento: '123' }).datos
        .Motivo_mensaje,
    ).toBe('Pago');
  });
});
