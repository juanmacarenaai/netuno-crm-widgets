import { describe, expect, it } from 'vitest';
import {
  asuntoInicial,
  contactosDeCuenta,
  contenidoCorreo,
  cuerpoEnvioCorreo,
  datosDomiciliacion,
  departamentoFacturacion,
  destinatariosIniciales,
  enlaceDocumento,
  esFactura,
  filaDocumentoDesk,
  filtrarMovimientos,
  formatoMonto,
  isoDeFecha,
  nombreArchivo,
  numero,
  opcionesMovimientos,
  ordenarPorCreacion,
  parametrosHistorico,
  PESTANAS_HISTORICO,
  resultadoEnvioCorreo,
  simboloMoneda,
  SIN_FILTROS_MOVIMIENTOS,
  tipoVisor,
  tituloDocumento,
  totalesMovimientos,
  urlDescarga,
  validarCorreo,
  type Movimiento,
} from './facturacion';

const movimientos: Movimiento[] = [
  {
    id: 1,
    fecha: '05/09/2026',
    descTipoDocumento: 'Factura',
    statusDocumento: 'Pagada',
    descripcion: 'Factura septiembre',
    cargo: 25.5,
    abono: null,
    saldo: 25.5,
    codigoFiscal: '00-0001',
  },
  {
    id: 2,
    fecha: '10/09/2026',
    descTipoDocumento: 'Pago',
    statusDocumento: 'Aplicado',
    descripcion: '4567 - Pago móvil',
    cargo: null,
    abono: 25.5,
    saldo: 0,
  },
  {
    id: 3,
    fecha: '05/10/2026',
    descTipoDocumento: 'Factura',
    statusDocumento: 'Pendiente',
    descripcion: 'Factura octubre',
    cargo: '1.234,50',
    abono: null,
    saldo: 1234.5,
    codigoFiscal: '00-0002',
  },
  {
    id: 4,
    fecha: '12/10/2026',
    descTipoDocumento: 'Nota de Crédito',
    statusDocumento: 'Aplicado',
    descripcion: 'Ajuste',
    cargo: null,
    abono: 10,
    saldo: 1224.5,
  },
];

describe('montos, monedas y fechas', () => {
  it('símbolo de la moneda', () => {
    expect(simboloMoneda({ descMoneda: 'USD' })).toBe('$');
    expect(simboloMoneda({ descMoneda: 'VEF' })).toBe('Bs');
    expect(simboloMoneda({ descMoneda: null, monedaPago: 'Bs' })).toBe('Bs');
  });

  it('números y formato venezolano', () => {
    expect(numero(12.5)).toBe(12.5);
    expect(numero('1.234,56')).toBe(1234.56);
    expect(numero('1234.56')).toBe(1234.56);
    expect(numero('')).toBeNaN();
    expect(formatoMonto(1234.5)).toBe('1.234,50');
    expect(formatoMonto(25)).toBe('25,00');
    expect(formatoMonto(null)).toBe('');
  });

  it('fechas dd/mm/aaaa ↔ ISO', () => {
    expect(isoDeFecha('5/9/2026')).toBe('2026-09-05');
    expect(isoDeFecha('')).toBe('');
  });
});

describe('estado de cuenta', () => {
  it('filtros por rango de fechas, documento y estatus', () => {
    const f = { ...SIN_FILTROS_MOVIMIENTOS, desde: '2026-10-01' };
    expect(filtrarMovimientos(movimientos, f).map((m) => m.id)).toEqual([3, 4]);
    expect(filtrarMovimientos(movimientos, { ...f, documento: 'Factura' }).map((m) => m.id)).toEqual([3]);
    expect(
      filtrarMovimientos(movimientos, { ...SIN_FILTROS_MOVIMIENTOS, hasta: '2026-09-05' }).map((m) => m.id),
    ).toEqual([1]);
    expect(
      filtrarMovimientos(movimientos, { ...SIN_FILTROS_MOVIMIENTOS, estatus: 'Aplicado' }).map((m) => m.id),
    ).toEqual([2, 4]);
  });

  it('opciones en cascada y rango posible', () => {
    const todas = opcionesMovimientos(movimientos, SIN_FILTROS_MOVIMIENTOS);
    expect(todas.documentos).toEqual(['Factura', 'Nota de Crédito', 'Pago']);
    expect(todas.estatus).toEqual(['Aplicado', 'Pagada', 'Pendiente']);
    expect([todas.fechaMinima, todas.fechaMaxima]).toEqual(['2026-09-05', '2026-10-12']);
    const facturas = opcionesMovimientos(movimientos, { ...SIN_FILTROS_MOVIMIENTOS, documento: 'Factura' });
    expect(facturas.estatus).toEqual(['Pagada', 'Pendiente']);
    // El documento elegido sigue en su propia lista
    expect(facturas.documentos).toContain('Factura');
  });

  it('totales de abonos y cargos', () => {
    expect(totalesMovimientos(movimientos)).toEqual({ abonos: 35.5, cargos: 1260 });
    expect(totalesMovimientos([])).toEqual({ abonos: 0, cargos: 0 });
  });

  it('título y nombre del documento', () => {
    expect(tituloDocumento(movimientos[0]!)).toBe('Factura: 00-0001');
    expect(tituloDocumento(movimientos[1]!)).toBe('Recibo: 4567');
    // Sin número al inicio de la descripción no queda "NaN" (error del widget jQuery)
    expect(tituloDocumento({ id: 9, descTipoDocumento: 'Pago', descripcion: 'Pago web' })).toBe('Recibo: 9');
    expect(tituloDocumento(movimientos[3]!)).toBe('Nota de Crédito: 4');
    expect(nombreArchivo(movimientos[3]!)).toBe('Nota de Credito - 4');
    expect(esFactura(movimientos[0]!)).toBe(true);
    expect(esFactura(movimientos[1]!)).toBe(false);
  });
});

describe('documentos', () => {
  it('enlace del PDF', () => {
    expect(enlaceDocumento({ code: 0, data: 'https://x/doc.pdf' })).toEqual({ url: 'https://x/doc.pdf' });
    expect(enlaceDocumento({ code: 0, data: null })).toEqual({
      error: 'Este documento no está disponible en este momento.',
    });
    expect(enlaceDocumento({ code: -1 })).toMatchObject({
      error: expect.stringContaining('no se ha logrado cargar'),
    });
  });

  it('visor según el enlace', () => {
    expect(tipoVisor('https://www.unidigital.global/doc/1')).toBe('externo');
    expect(tipoVisor('http://172.16.47.116/estadoCuenta/1')).toBe('inseguro');
    expect(tipoVisor('https://docs.netuno.net/f.pdf')).toBe('pdf');
    expect(tipoVisor('no es url')).toBe('invalido');
  });

  it('descarga con nombre (attachmentMule)', () => {
    expect(urlDescarga('https://c/attachmentMule', 'https://x/a b.pdf', 'Factura - 1')).toBe(
      'https://c/attachmentMule?url=https%3A%2F%2Fx%2Fa%20b.pdf&name=Factura%20-%201',
    );
  });
});

describe('correo', () => {
  it('destinatarios según el negocio del cliente', () => {
    const r = { email: 'casa@x.com', Correo_electr_nico_5: 'empresa@x.com' };
    expect(destinatariosIniciales({ ...r, Negocio: ['Hogar'] })).toEqual({ para: 'casa@x.com', cc: '' });
    expect(destinatariosIniciales({ ...r, Negocio: ['Empresa'] })).toEqual({ para: 'empresa@x.com', cc: '' });
    expect(destinatariosIniciales({ email: 'casa@x.com', Negocio: ['Empresa'] })).toEqual({
      para: 'casa@x.com',
      cc: '',
    });
    expect(destinatariosIniciales({ ...r, Negocio: ['Hogar', 'Empresa'] })).toEqual({
      para: 'casa@x.com',
      cc: 'empresa@x.com',
    });
    expect(destinatariosIniciales({})).toEqual({ para: '', cc: '' });
  });

  it('asunto', () => {
    expect(asuntoInicial('estadoCuenta', { cuenta: 9001 })).toBe('Estado de cuenta - 9001');
    expect(asuntoInicial('factura', { cuenta: 9001 }, movimientos[0])).toBe('Factura - 00-0001');
  });

  it('validación de destinatario, copia y asunto', () => {
    expect(validarCorreo({ para: 'a@x.com', cc: 'b@x.com; c@y.com', asunto: 'Hola' })).toEqual({});
    const errores = validarCorreo({ para: 'malo', cc: 'b@x.com, nada', asunto: ' ' });
    expect(errores.para).toMatch(/no es válido/);
    expect(errores.cc).toBe('Correo inválido en copia: nada');
    expect(errores.asunto).toMatch(/vacío/);
    expect(validarCorreo({ para: '', cc: '', asunto: 'x' }).para).toMatch(/vacío/);
  });

  it('plantilla con cliente y enlace escapados', () => {
    const html = contenidoCorreo('factura', 'Empresa', 'ACME <C.A.>', 'https://x/f.pdf?a=1&b=2');
    expect(html).toContain('ACME &lt;C.A.&gt;');
    expect(html).toContain('href="https://x/f.pdf?a=1&amp;b=2"');
    expect(html).not.toContain('{{');
    expect(contenidoCorreo('estadoCuenta', 'Hogar', 'Ana', 'https://e')).not.toBe(
      contenidoCorreo('estadoCuenta', 'Empresa', 'Ana', 'https://e'),
    );
  });

  it('cuerpo de send_mail y resultado', () => {
    const cuerpo = cuerpoEnvioCorreo({
      remitente: { nombre: 'Netuno', correo: 'netuno@netuno.net' },
      para: ' a@x.com ',
      nombreDestinatario: 'Ana',
      cc: 'b@x.com, c@x.com',
      asunto: ' Factura - 1 ',
      contenido: '<p>hola</p>',
    });
    expect(cuerpo).toEqual({
      data: [
        {
          from: { user_name: 'Netuno', email: 'netuno@netuno.net' },
          to: [{ user_name: 'Ana', email: 'a@x.com' }],
          cc: [
            { user_name: 'b@x.com', email: 'b@x.com' },
            { user_name: 'c@x.com', email: 'c@x.com' },
          ],
          subject: 'Factura - 1',
          content: '<p>hola</p>',
          mail_format: 'html',
          org_email: true,
        },
      ],
    });
    expect(
      (
        cuerpoEnvioCorreo({
          ...{ remitente: { nombre: 'N', correo: 'n@x.com' } },
          para: 'a@x.com',
          nombreDestinatario: '',
          cc: '',
          asunto: 'x',
          contenido: '',
        }).data as object[]
      )[0],
    ).not.toHaveProperty('cc');
    expect(resultadoEnvioCorreo({ data: [{ code: 'SUCCESS' }] }, 'n@x.com').ok).toBe(true);
    expect(resultadoEnvioCorreo({ data: [{ code: 'NOT_ALLOWED' }] }, 'n@x.com').mensaje).toMatch(/n@x\.com/);
    expect(resultadoEnvioCorreo({ data: [{ code: 'INVALID_DATA', message: 'mal' }] }, 'n').mensaje).toBe(
      'Error en el envío del correo (INVALID_DATA: mal).',
    );
    expect(resultadoEnvioCorreo('', 'n').ok).toBe(false);
  });
});

describe('contactos y domiciliación', () => {
  it('asesores de la cuenta agrupados por área', () => {
    const respuesta = {
      contactoExt: [],
      contactoCuenta: [
        { cuenta: 9001, area: 'Cobranzas', nombreAsesor: 'Ana', cargo: 'Analista', correo: 'ana@n.net' },
        { cuenta: 9001, area: 'Ventas', nombreAsesor: 'Luis', cargo: 'Ejecutivo', correo: 'luis@n.net' },
        { cuenta: 9001, area: 'Cobranzas', nombreAsesor: 'Eva', cargo: 'Jefa', correo: 'eva@n.net' },
        { cuenta: 9002, area: 'Ventas', nombreAsesor: 'Otro', cargo: '', correo: '' },
      ],
    };
    const areas = contactosDeCuenta(respuesta, '9001');
    expect(areas.map((a) => a.area)).toEqual(['Cobranzas', 'Ventas']);
    expect(areas[0]?.contactos.map((c) => c.nombre)).toEqual(['Ana', 'Eva']);
    expect(contactosDeCuenta(null, 1)).toEqual([]);
  });

  it('domiciliación', () => {
    expect(datosDomiciliacion({ code: -1, message: 'Cuenta no domiciliada' })).toEqual({
      domiciliada: false,
      mensaje: 'Cuenta no domiciliada',
    });
    const d = datosDomiciliacion({ nombreTitular: 'Ana', nombreBanco: 'Banco X', desTipoTarjeta: null });
    expect(d.domiciliada).toBe(true);
    if (d.domiciliada) {
      expect(d.campos.find((c) => c.etiqueta === 'Banco')?.valor).toBe('Banco X');
      expect(d.campos.find((c) => c.etiqueta === 'Tipo de tarjeta')?.valor).toBe('Sin datos');
    }
  });
});

describe('histórico de documentos', () => {
  it('seis pestañas con los parámetros del widget jQuery', () => {
    expect(PESTANAS_HISTORICO.map((p) => p.tipoDocumento)).toEqual([
      'Nota de Débito',
      'Nota de Crédito',
      'Cargo variable',
      'Reelaboración de factura',
      'Factura manual',
      'Ajuste de factura',
    ]);
    expect(parametrosHistorico(PESTANAS_HISTORICO[3]!, 'D1', '123')).toEqual({
      departmentId: 'D1',
      category: 'Solicitudes',
      customField1: 'cf_tipo_de_documento:Reelaboración de factura',
      customField2: 'cf_documento_de_identidad:123',
    });
  });

  it('departamento: configurado o buscado por nombre', () => {
    const deptos = [
      { id: 'A', name: 'Servicio al Cliente' },
      { id: 'B', name: 'Cobranzas' },
      { id: 'C', name: 'Administración de Ventas' },
    ];
    expect(departamentoFacturacion('Hogar', deptos, { cob: null, ave: 'X' })).toEqual({
      id: 'B',
      nombre: 'Cobranzas',
    });
    expect(departamentoFacturacion('Empresa', deptos, { cob: null, ave: 'X' })).toEqual({
      id: 'X',
      nombre: 'Administración de Ventas',
    });
    expect(departamentoFacturacion('Empresa', deptos, { cob: null, ave: null })?.id).toBe('C');
    expect(departamentoFacturacion('Hogar', [], { cob: null, ave: null })).toBeNull();
  });

  it('fila del ticket con monto, mes de solicitud y detalle', () => {
    const fila = filaDocumentoDesk(
      {
        id: 'T1',
        ticketNumber: '5501',
        status: 'Por aprobar',
        createdTime: '2026-10-20T14:00:00.000Z',
        webUrl: 'https://desk/T1',
        subject: 'AB CL-1 || CRM || Nota de Débito',
        description: '<b>x</b>',
        cf: {
          cf_numero_de_cuenta: '9001',
          cf_fecha_de_creacion: '2026-10-20',
          cf_monto_total: '29,58',
          cf_moneda_factura: '$',
          cf_tipo_cliente: 'Hogar',
        },
      },
      PESTANAS_HISTORICO[0]!,
    );
    expect(fila.celdas).toEqual(['9001', '20/10/2026', '$ 29,58', '5501', 'Por aprobar']);
    expect(fila.filtros).toEqual([['9001'], ['Por aprobar'], ['10/2026']]);
    expect(fila.detalle[0]).toEqual({ etiqueta: 'Nro. Ticket', valor: '5501', url: 'https://desk/T1' });
    expect(fila.detalle.find((d) => d.etiqueta === 'Descripción')?.tipo).toBe('html');
    expect(fila.resumen.titulo).toBe('Nota de Débito · Ticket 5501');
  });

  it('orden por fecha de creación', () => {
    const orden = ordenarPorCreacion([
      { id: 'a', createdTime: '2026-01-01T00:00:00Z' },
      { id: 'b' },
      { id: 'c', createdTime: '2026-05-01T00:00:00Z' },
    ]);
    expect(orden.map((t) => t.id)).toEqual(['c', 'a', 'b']);
  });
});
