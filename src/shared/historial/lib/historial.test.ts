import { describe, expect, it } from 'vitest';
import {
  fechaCorta,
  fechaDePeriodo,
  fechaHora,
  filaAtencion,
  filaComunicacion,
  filaConsumo,
  filaEvento,
  filaPago,
  filaPromocion,
  filaTicket,
  filtrar,
  numeroTransaccion,
  opcionesFiltros,
  ordenarConsumo,
  ordenarTickets,
  pagina,
  PESTANAS,
  rangoConsumo,
  rangoPagos,
  SIN_FILTROS,
  texto,
  totalPaginas,
} from './historial';

describe('pestañas', () => {
  it('siete pestañas con 4 filtros cada una; registran Atención y Comunicaciones', () => {
    expect(PESTANAS.map((p) => p.etiqueta)).toEqual([
      'Atención',
      'Tickets',
      'Pagos',
      'Promociones',
      'Cuentas',
      'Comunicaciones',
      'Consumo',
    ]);
    expect(PESTANAS.every((p) => p.filtros.length === 4)).toBe(true);
    expect(PESTANAS.filter((p) => p.registrar).map((p) => p.id)).toEqual(['atencion', 'comunicaciones']);
  });
});

describe('textos y fechas', () => {
  it('texto: listas con coma, objetos y vacíos', () => {
    expect(texto(['Hogar', 'Empresa'])).toBe('Hogar, Empresa');
    expect(texto({ a: 1 })).toBe('');
    expect(texto(null)).toBe('');
    expect(texto(12)).toBe('12');
  });

  it('fechaCorta y fechaHora', () => {
    expect(fechaCorta('2026-11-05T10:30:00-04:00')).toBe('05/11/2026');
    expect(fechaCorta('2026-11-05')).toBe('05/11/2026');
    expect(fechaCorta(null)).toBe('');
    expect(fechaHora(new Date(2026, 10, 5, 14, 7).toISOString())).toBe('05-11-2026 2:07 pm');
    expect(fechaHora(new Date(2026, 10, 5, 0, 30).toISOString())).toBe('05-11-2026 12:30 am');
    expect(fechaHora('nada')).toBe('');
  });

  it('rangos de 3 meses para pagos y consumo', () => {
    const hoy = new Date(2026, 10, 5);
    expect(rangoPagos(hoy)).toEqual({ desde: '05/08/2026', hasta: '05/11/2026' });
    expect(rangoConsumo(hoy)).toEqual({ desde: '08/2026', hasta: '11/2026' });
    expect(rangoConsumo(new Date(2026, 1, 10))).toEqual({ desde: '11/2025', hasta: '02/2026' });
  });

  it('fechaDePeriodo y orden del consumo por cercanía a hoy', () => {
    expect(fechaDePeriodo('15/03/2026').getDate()).toBe(15);
    expect(fechaDePeriodo('03/2026').getMonth()).toBe(2);
    const hoy = new Date(2026, 10, 5);
    const orden = ordenarConsumo(
      [
        { fechaInicioPeriodo: '01/08/2026' },
        { fechaInicioPeriodo: '01/11/2026' },
        { fechaInicioPeriodo: '01/10/2026' },
      ],
      hoy,
    );
    expect(orden.map((c) => c.fechaInicioPeriodo)).toEqual(['01/11/2026', '01/10/2026', '01/08/2026']);
  });
});

describe('filas', () => {
  it('atención: Negocio de selección múltiple en celdas y filtros', () => {
    const f = filaAtencion({
      id: 'C1',
      Negocio: ['Hogar', 'Empresa'],
      Cuenta: '900',
      Fecha: '2026-11-04T10:15:00-04:00',
      Categoria: 'Pagos',
      Subcategoria: null,
      Canal: 'Chat',
      Usuario: 'Ana',
    });
    expect(f.celdas).toEqual(['Hogar, Empresa', '900', '04/11/2026', 'Pagos', '-', 'Chat', 'Ana']);
    expect(f.filtros).toEqual([['Hogar', 'Empresa'], ['900'], ['Pagos'], ['Chat']]);
    expect(f.detalle.find((d) => d.etiqueta === 'Observaciones')?.valor).toBe('Sin información');
  });

  it('ticket: cuenta del contacto o del campo, producto o contratos, enlace y HTML', () => {
    const conProducto = filaTicket({
      id: 'T1',
      ticketNumber: '10',
      status: 'Abierto',
      createdTime: '2026-11-04T13:20:00.000Z',
      webUrl: 'https://desk/x',
      product: { productName: 'Internet' },
      contact: { account: { accountName: '900' } },
      assignee: { firstName: 'Carla', lastName: 'S' },
      description: '<b>hola</b>',
      cf: { cf_tipo_cliente: 'Hogar', cf_numero_de_cuenta: '111' },
    });
    expect(conProducto.celdas.slice(0, 3)).toEqual(['Hogar', '900', '04/11/2026']);
    expect(conProducto.filtros[2]).toEqual(['Internet']);
    expect(conProducto.detalle[0]).toEqual({ etiqueta: 'Nro. Ticket', valor: '10', url: 'https://desk/x' });
    expect(conProducto.detalle.find((d) => d.etiqueta === 'Producto')?.valor).toBe('Internet');
    expect(conProducto.detalle.find((d) => d.etiqueta === 'Propietario del ticket')?.valor).toBe('Carla S');
    expect(conProducto.detalle.find((d) => d.etiqueta === 'Descripción')).toMatchObject({
      tipo: 'html',
      valor: '<b>hola</b>',
    });

    const sinProducto = filaTicket({
      id: 'T2',
      contact: { account: null },
      cf: { cf_numero_de_cuenta: '111', cf_contratos: 'Salud: 1' },
    });
    expect(sinProducto.celdas[1]).toBe('111');
    expect(sinProducto.detalle.find((d) => d.etiqueta === 'Contratos')?.valor).toBe('Salud: 1');
    expect(sinProducto.detalle.find((d) => d.etiqueta === 'Propietario del ticket')?.valor).toBe(
      'Sin información',
    );
  });

  it('tickets: sin fecha fuera y del más reciente al más antiguo', () => {
    const orden = ordenarTickets([
      { id: 'a', createdTime: '2026-10-01T00:00:00Z' },
      { id: 'b', createdTime: null },
      { id: 'c', createdTime: '2026-11-01T00:00:00Z' },
    ]);
    expect(orden.map((t) => t.id)).toEqual(['c', 'a']);
  });

  it('pago: número de transacción como texto u objeto', () => {
    expect(numeroTransaccion({ idTransCompleto: 'TRX-1' })).toBe('TRX-1');
    expect(numeroTransaccion('TRX-2')).toBe('TRX-2');
    const f = filaPago(
      {
        negocio: 'Hogar',
        nroTransaccion: { idTransCompleto: 'TRX-1' },
        cuenta: '9',
        canal: 'Web',
        monto: '10',
        medioPago: 'Pago móvil',
        fecha: '01/11/2026',
        estatusDescripcion: 'Aplicado',
      },
      0,
    );
    expect(f.celdas).toEqual(['Hogar', 'TRX-1', '9', 'Web', '10', 'Pago móvil', '01/11/2026', 'Aplicado']);
    expect(f.filtros).toEqual([['Hogar'], ['9'], ['Pago móvil'], ['Aplicado']]);
  });

  it('promoción, evento, comunicación y consumo', () => {
    expect(
      filaPromocion({ negocio: 'Hogar', cuenta: '9', campana: 'X', codPromocion: 5 }, 0).detalle.at(-1),
    ).toEqual({
      etiqueta: 'Id',
      valor: '5',
    });
    expect(
      filaEvento({
        id: 'E',
        Negocio: 'Hogar',
        Cuenta: '9',
        Canal: 'Chat',
        Registro: 'Activación',
        Fecha: '2026-10-28',
      }).celdas,
    ).toEqual(['Hogar', '9', 'Chat', 'Activación', '28/10/2026', '-']);
    expect(
      filaComunicacion({ id: 'M', Contacto: 'María', Motivo_mensaje: 'Pago' }).detalle.find(
        (d) => d.etiqueta === 'Motivo',
      )?.valor,
    ).toBe('Pago');
    const consumo = filaConsumo(
      {
        tipoNegocio: 'Hogar',
        cuenta: '9',
        nombreServicio: 'Internet',
        contrato: 'X-1-5',
        fechaInicioPeriodo: '01/11/2026',
        fechaFinPeriodo: '30/11/2026',
        consumoTotal: 182.4,
        unidadMedida: 'GB',
      },
      0,
    );
    expect(consumo.celdas).toEqual(['Hogar', '9', 'Internet', '01/11/2026', '30/11/2026', '182.4 GB']);
    expect(consumo.filtros[3]).toEqual(['X-1-5']);
  });
});

describe('filtros y páginas', () => {
  const filas = [
    filaAtencion({ id: '1', Negocio: ['Hogar'], Cuenta: 'A', Categoria: 'Pagos', Canal: 'Chat' }),
    filaAtencion({
      id: '2',
      Negocio: ['Hogar', 'Empresa'],
      Cuenta: 'B',
      Categoria: 'Pagos',
      Canal: 'Oficina',
    }),
    filaAtencion({ id: '3', Negocio: ['Empresa'], Cuenta: 'A', Categoria: 'Facturas', Canal: 'Chat' }),
  ];

  it('filtra por cada valor; Negocio múltiple coincide con cualquiera de sus unidades', () => {
    expect(filtrar(filas, SIN_FILTROS)).toHaveLength(3);
    expect(filtrar(filas, ['Empresa', '', '', '']).map((f) => f.clave)).toEqual(['2', '3']);
    expect(filtrar(filas, ['', 'A', '', 'Chat']).map((f) => f.clave)).toEqual(['1', '3']);
  });

  it('opciones en cascada, conservando el valor elegido', () => {
    expect(opcionesFiltros(filas, SIN_FILTROS)).toEqual([
      ['Hogar', 'Empresa'],
      ['A', 'B'],
      ['Pagos', 'Facturas'],
      ['Chat', 'Oficina'],
    ]);
    expect(opcionesFiltros(filas, ['', 'B', '', ''])).toEqual([
      ['Hogar', 'Empresa'],
      ['B'],
      ['Pagos'],
      ['Oficina'],
    ]);
  });

  it('7 registros por página', () => {
    const lista = Array.from({ length: 15 }, (_, i) => i);
    expect(totalPaginas(15)).toBe(3);
    expect(totalPaginas(0)).toBe(1);
    expect(pagina(lista, 2)).toEqual([14]);
  });
});
