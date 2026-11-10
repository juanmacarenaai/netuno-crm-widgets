import { describe, expect, it } from 'vitest';
import {
  filaAtencion,
  filaComunicacion,
  filaConsumo,
  filaEvento,
  filaPago,
  filaPromocion,
  filaTicket,
  haceCuanto,
  momento,
  tonoEstado,
  ultimoRegistro,
} from './historial';

describe('momento', () => {
  it('reconoce ISO, fecha sola (local), dd/mm/aaaa y mm/aaaa', () => {
    expect(momento('2026-11-04T10:15:00-04:00')).toBe(Date.parse('2026-11-04T10:15:00-04:00'));
    expect(momento('2026-10-28')).toBe(new Date(2026, 9, 28).getTime());
    expect(momento('02/11/2026')).toBe(new Date(2026, 10, 2).getTime());
    expect(momento('09/2026')).toBe(new Date(2026, 8, 1).getTime());
    expect(momento('')).toBeNaN();
    expect(momento(null)).toBeNaN();
  });
});

describe('ultimoRegistro', () => {
  const atencion = (id: string, Fecha: string | null) => filaAtencion({ id, Fecha });

  it('elige la fecha más reciente sin importar el orden de la lista', () => {
    const filas = [
      atencion('A', '2026-10-01T09:00:00-04:00'),
      atencion('B', '2026-11-04T10:15:00-04:00'),
      atencion('C', '2026-10-20T09:00:00-04:00'),
    ];
    expect(ultimoRegistro(filas)?.clave).toBe('B');
  });

  it('con fechas iguales gana el primero; sin fecha pierde; lista vacía → undefined', () => {
    const misma = '2026-11-04T10:15:00-04:00';
    expect(ultimoRegistro([atencion('A', misma), atencion('B', misma)])?.clave).toBe('A');
    expect(ultimoRegistro([atencion('A', null), atencion('B', misma)])?.clave).toBe('B');
    expect(ultimoRegistro([atencion('A', null)])?.clave).toBe('A');
    expect(ultimoRegistro([])).toBeUndefined();
  });
});

describe('haceCuanto', () => {
  const hoy = new Date(2026, 10, 6, 15, 0);
  const dia = (d: number, m = 10, a = 2026) => new Date(a, m, d, 9).getTime();

  it('días, meses y años por fecha de calendario', () => {
    expect(haceCuanto(dia(6), hoy)).toBe('Hoy');
    expect(haceCuanto(dia(5), hoy)).toBe('Ayer');
    expect(haceCuanto(dia(7), hoy)).toBe('Mañana');
    expect(haceCuanto(dia(10), hoy)).toBe('En 4 días');
    expect(haceCuanto(dia(1), hoy)).toBe('Hace 5 días');
    expect(haceCuanto(dia(6, 9), hoy)).toBe('Hace 1 mes');
    expect(haceCuanto(dia(1, 7), hoy)).toBe('Hace 3 meses');
    expect(haceCuanto(dia(1, 0, 2024), hoy)).toBe('Hace 2 años');
    expect(haceCuanto(Number.NaN, hoy)).toBe('');
  });
});

describe('tonoEstado', () => {
  it('colorea según el estatus', () => {
    expect(tonoEstado('Aplicado')).toBe('exito');
    expect(tonoEstado('Vigente')).toBe('exito');
    expect(tonoEstado('Cerrado')).toBe('exito');
    expect(tonoEstado('En revisión')).toBe('aviso');
    expect(tonoEstado('Pendiente por aprobación')).toBe('aviso');
    expect(tonoEstado('Abierto')).toBe('aviso');
    expect(tonoEstado('Rechazado')).toBe('error');
    expect(tonoEstado('Vencida')).toBe('error');
    expect(tonoEstado('Inactivo')).toBe('error');
    expect(tonoEstado('Otro')).toBe('neutro');
  });
});

describe('resumen de cada pestaña', () => {
  it('Atención: categoría como título, sin "Asunto", observaciones aparte', () => {
    const { resumen } = filaAtencion({
      id: 'C1',
      Negocio: ['Hogar'],
      Cuenta: '9000001',
      Fecha: '2026-11-04T10:15:00-04:00',
      Categoria: 'Gestión de pagos',
      Subcategoria: 'Confirmación de pagos aplicados',
      Canal: 'Telefónico',
      Usuario: 'Ana Asesor',
      Observaciones: 'Cliente confirma pago',
    });
    expect(resumen).toMatchObject({
      negocio: 'Hogar',
      cuenta: '9000001',
      titulo: 'Gestión de pagos',
      subtitulo: 'Confirmación de pagos aplicados',
      campos: [
        { etiqueta: 'Canal', valor: 'Telefónico' },
        { etiqueta: 'Usuario', valor: 'Ana Asesor' },
      ],
      nota: { etiqueta: 'Observaciones', valor: 'Cliente confirma pago' },
    });
    expect(resumen.fecha).toMatch(/^04-11-2026 /);
    expect(JSON.stringify(resumen)).not.toContain('Asunto');
  });

  it('omite los campos vacíos y usa un título por defecto', () => {
    const { resumen } = filaAtencion({ id: 'C2', Canal: 'Chat' });
    expect(resumen.titulo).toBe('Atención sin categoría');
    expect(resumen.campos).toEqual([{ etiqueta: 'Canal', valor: 'Chat' }]);
    expect(resumen).not.toHaveProperty('nota');
    expect(resumen).not.toHaveProperty('subtitulo');
  });

  it('Tickets: asunto, categorías, estatus y enlace al ticket', () => {
    const { resumen, momento: m } = filaTicket({
      id: 'T1',
      ticketNumber: '10234',
      status: 'Abierto',
      createdTime: '2026-11-04T13:20:00.000Z',
      subject: 'Lentitud en la noche',
      category: 'Falla técnica',
      subCategory: 'Lentitud',
      webUrl: 'https://desk/T1',
      department: { name: 'Operaciones' },
      assignee: { firstName: 'Carla', lastName: 'Soporte' },
      product: null,
      cf: { cf_tipo_cliente: 'Hogar', cf_numero_de_cuenta: '9000001', cf_contratos: 'Internet: 1' },
    });
    expect(m).toBe(Date.parse('2026-11-04T13:20:00.000Z'));
    expect(resumen).toMatchObject({
      titulo: 'Lentitud en la noche',
      subtitulo: 'Falla técnica · Lentitud',
      estado: 'Abierto',
      fecha: '04/11/2026',
      campos: [
        { etiqueta: 'Nro. Ticket', valor: '10234', url: 'https://desk/T1' },
        { etiqueta: 'Departamento', valor: 'Operaciones' },
        { etiqueta: 'Propietario', valor: 'Carla Soporte' },
        { etiqueta: 'Contratos', valor: 'Internet: 1' },
      ],
    });
    expect(filaTicket({ id: 'T2', ticketNumber: '9' }).resumen.titulo).toBe('Ticket 9');
  });

  it('Pagos, Promociones, Cuentas, Comunicaciones y Consumo', () => {
    expect(
      filaPago(
        {
          negocio: 'Hogar',
          nroTransaccion: { idTransCompleto: 'TRX-1' },
          cuenta: '9000004',
          canal: 'Oficina',
          monto: '16.38',
          medioPago: 'Tarjeta de débito',
          fecha: '15/10/2026',
          estatusDescripcion: 'Aplicado',
        },
        0,
      ).resumen,
    ).toMatchObject({
      titulo: 'Tarjeta de débito',
      subtitulo: 'Transacción TRX-1',
      estado: 'Aplicado',
      fecha: '15/10/2026',
      campos: [
        { etiqueta: 'Monto', valor: '16.38' },
        { etiqueta: 'Canal', valor: 'Oficina' },
      ],
    });

    expect(
      filaPromocion(
        { campana: 'Navidad', descripcion: '20%', fechaInicio: '01/11/2026', fechaFin: '31/12/2026' },
        0,
      ).resumen,
    ).toMatchObject({ titulo: 'Navidad', subtitulo: '20%', fecha: '01/11/2026' });

    expect(
      filaEvento({
        id: 'E1',
        Registro: 'Modificación',
        Subtipo_de_registro: 'Cambio de plan',
        Descripci_n: 'x',
      }).resumen,
    ).toMatchObject({ titulo: 'Cambio de plan', subtitulo: 'Modificación', nota: { valor: 'x' } });
    expect(filaEvento({ id: 'E2', Registro: 'Activación' }).resumen).toMatchObject({ titulo: 'Activación' });
    expect(filaEvento({ id: 'E2', Registro: 'Activación' }).resumen).not.toHaveProperty('subtitulo');

    expect(
      filaComunicacion({ id: 'M1', Motivo_mensaje: 'Recordatorio', Contacto: 'María', Fecha: '2026-11-03' })
        .resumen,
    ).toMatchObject({ titulo: 'Recordatorio', fecha: '03/11/2026', campos: [{ etiqueta: 'Contacto' }] });

    expect(
      filaConsumo(
        {
          consumoTotal: 182.4,
          unidadMedida: 'GB',
          fechaInicioPeriodo: '01/10/2026',
          fechaFinPeriodo: '31/10/2026',
          nombreServicio: 'Internet',
          contrato: 5000001,
          tipoNegocio: 'Hogar',
          cuenta: '9000001',
        },
        0,
      ).resumen,
    ).toMatchObject({
      titulo: '182.4 GB',
      subtitulo: 'Internet · Contrato 5000001',
      campos: [{ etiqueta: 'Periodo', valor: '01/10/2026 al 31/10/2026' }],
    });
  });
});
