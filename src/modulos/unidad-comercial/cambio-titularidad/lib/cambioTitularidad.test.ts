import { describe, expect, it } from 'vitest';
import type { Contrato, Cuenta } from '@/shared/cuentas';
import {
  accionesPrevistas,
  beneficiariosCompletos,
  contratosTransferibles,
  correoNetunoGoAceptable,
  direccionContrato,
  documentoDistinto,
  DOCUMENTOS_REQUERIDOS,
  elegibilidadTitularidad,
  faltantesNuevoTitular,
  indiceEtapa,
  inicioFacturacion,
  motivoInicial,
  nombreNuevoTitular,
  nuevoTitularVacio,
  pasosEjecucion,
  serviciosOpcionales,
  unidadDeCuenta,
} from './cambioTitularidad';

const contrato = (idProducto: string, nombreServicio: string, extra: Partial<Contrato> = {}): Contrato => ({
  idProducto,
  nombreServicio,
  status: 'Conectado',
  ...extra,
});

const cuenta = (extra: Partial<Cuenta> = {}): Cuenta => ({
  cuenta: '9000001',
  descTipoCliente: 'Hogar',
  descStatusCuenta: 'Conectado',
  saldo: 0,
  descMoneda: 'USD',
  contratos: [
    contrato('P-1-5000001', 'Internet', {
      codContrato: 'C-5000001',
      nombrePaqueteFact: 'Fibranet 400/400 Mb',
      serial: 'VSOL00A5E8FD',
      ubicacionJSON: [{ direccion: 'Urb. La Viña, Calle 12' }],
      coordenadasGps: '10.16, -67.99',
    }),
    contrato('5000002', 'Telefonía', { nombrePaquete: 'Telefonía', status: 'Suspendido' }),
    contrato('5000003', 'Streaming', { nombrePaquete: 'NetUnoGO Plus 3', serial: 'actual@example.com' }),
    contrato('5000004', 'Salud', { nombrePaquete: 'Beneficiario Ppal' }),
  ],
  ...extra,
});

describe('unidad comercial', () => {
  it('Empresa o Hogar (por defecto)', () => {
    expect(unidadDeCuenta({ descTipoCliente: 'Empresa' })).toBe('Empresa');
    expect(unidadDeCuenta({ descTipoCliente: 'Hogar' })).toBe('Hogar');
    expect(unidadDeCuenta({ descTipoCliente: null })).toBe('Hogar');
  });

  it('motivo inicial según la unidad', () => {
    expect(motivoInicial('Hogar')).toBe('Venta de inmueble');
    expect(motivoInicial('Empresa')).toBe('Cambio de razón social');
  });

  it('documentos requeridos: 2 en Hogar y 4 en Empresa', () => {
    expect(DOCUMENTOS_REQUERIDOS.Hogar.map((d) => d.id)).toEqual(['ci_nuevo', 'cesion']);
    expect(DOCUMENTOS_REQUERIDOS.Empresa).toHaveLength(4);
  });
});

describe('contratos', () => {
  it('transfiere todo menos Streaming y Salud; solo los Conectado están disponibles', () => {
    const lista = contratosTransferibles(cuenta());
    expect(lista.map((c) => [c.codigo, c.servicio, c.disponible])).toEqual([
      ['C-5000001', 'Internet', true],
      ['5000002', 'Telefonía', false],
    ]);
    expect(lista[0]).toMatchObject({
      plan: 'Fibranet 400/400 Mb',
      serial: 'VSOL00A5E8FD',
      direccion: 'Urb. La Viña, Calle 12',
      gps: '10.16, -67.99',
    });
    expect(lista[1]?.serial).toBeNull();
  });

  it('dirección desde las partes de ubicacionJSON', () => {
    expect(
      direccionContrato({
        ubicacionJSON: [{ urbanizacion: 'El Bosque', calle: 'Calle 5', ciudad: 'Maracay' }],
      }),
    ).toBe('El Bosque, Calle 5, Maracay');
    expect(direccionContrato({})).toBe('Sin dirección registrada');
  });

  it('servicios opcionales: Streaming y Salud conectados', () => {
    const { streaming, salud } = serviciosOpcionales(cuenta());
    expect(streaming?.idProducto).toBe('5000003');
    expect(salud?.idProducto).toBe('5000004');
    expect(serviciosOpcionales(cuenta({ contratos: [] }))).toEqual({ streaming: null, salud: null });
  });
});

describe('elegibilidad', () => {
  it('apto con saldo cero o a favor', () => {
    expect(elegibilidadTitularidad(cuenta())).toEqual({ estado: 'apto' });
    expect(elegibilidadTitularidad(cuenta({ saldo: -3 }))).toEqual({ estado: 'apto' });
  });

  it('bloqueado con deuda pendiente', () => {
    expect(elegibilidadTitularidad(cuenta({ saldo: 25 }))).toEqual({ estado: 'saldo', monto: '$ 25' });
  });

  it('bloqueado si la cuenta no está Conectado', () => {
    expect(elegibilidadTitularidad(cuenta({ descStatusCuenta: 'Suspendido', saldo: 25 }))).toEqual({
      estado: 'inactivo',
      estatus: 'Suspendido',
    });
  });
});

describe('nuevo titular', () => {
  it('documento distinto al del titular actual (compara solo dígitos)', () => {
    expect(documentoDistinto('V-18456789', 'V18456789')).toBe(false);
    expect(documentoDistinto('V-18456789', 'V7494754')).toBe(true);
    expect(documentoDistinto('', 'V7494754')).toBe(false);
    expect(documentoDistinto('E-123', null)).toBe(true);
  });

  it('nombre: nombres y apellidos o razón social', () => {
    const natural = { ...nuevoTitularVacio('Hogar'), nombres: 'María ', apellidos: ' Pérez' };
    expect(nombreNuevoTitular(natural, 'Hogar')).toBe('María Pérez');
    const juridica = { ...nuevoTitularVacio('Empresa'), razonSocial: 'COSTA AZUL C.A' };
    expect(nombreNuevoTitular(juridica, 'Empresa')).toBe('COSTA AZUL C.A');
  });

  it('tipo de documento inicial según la unidad', () => {
    expect(nuevoTitularVacio('Hogar').tipoDocumento).toBe('Cédula V');
    expect(nuevoTitularVacio('Empresa').tipoDocumento).toBe('RIF-J');
  });

  it('faltantes de persona natural', () => {
    const titular = { ...nuevoTitularVacio('Hogar'), documento: 'V-1', nombres: 'María', correo: 'malo' };
    expect(faltantesNuevoTitular(titular, 'Hogar')).toEqual([
      'Apellidos',
      'Fecha de nacimiento',
      'Sexo',
      'Teléfono / WhatsApp',
      'Correo electrónico válido',
    ]);
  });

  it('persona jurídica: contribuyente especial sin responder cuenta como faltante', () => {
    const titular = {
      ...nuevoTitularVacio('Empresa'),
      documento: 'J-1',
      razonSocial: 'X',
      fecha: '2019-05-14',
      representante: 'Ana',
      cedulaRepresentante: 'V-2',
      direccionFiscal: 'Av. 1',
      correo: 'a@b.com',
      telefono: '+58',
    };
    expect(faltantesNuevoTitular(titular, 'Empresa')).toEqual(['Contribuyente especial']);
    expect(faltantesNuevoTitular({ ...titular, contribuyenteEspecial: false }, 'Empresa')).toEqual([]);
  });
});

describe('servicios opcionales', () => {
  it('correo NetunoGo: válido y distinto a los actuales', () => {
    expect(correoNetunoGoAceptable('nuevo@example.com', ['actual@example.com'])).toBe(true);
    expect(correoNetunoGoAceptable('Actual@Example.com', ['actual@example.com'])).toBe(false);
    expect(correoNetunoGoAceptable('sin-arroba', [])).toBe(false);
  });

  it('beneficiarios completos con nombre y documento', () => {
    const b = {
      id: '1',
      nombre: 'Luis',
      documento: 'V-3',
      fechaNacimiento: '',
      sexo: '',
      parentesco: 'Hijo(a)',
    };
    expect(beneficiariosCompletos([])).toBe(true);
    expect(beneficiariosCompletos([b])).toBe(true);
    expect(beneficiariosCompletos([{ ...b, documento: ' ' }])).toBe(false);
  });
});

describe('facturación y seguimiento', () => {
  it('factura desde el día 1 del mes siguiente', () => {
    expect(inicioFacturacion(new Date(2026, 10, 10))).toBe('01/12/2026');
    expect(inicioFacturacion(new Date(2026, 11, 31))).toBe('01/01/2027');
  });

  it('etapas del seguimiento', () => {
    expect(indiceEtapa('aprobacion')).toBe(1);
    expect(indiceEtapa('completada')).toBe(5);
  });

  it('Empresa conserva las IP fijas en la ejecución', () => {
    expect(pasosEjecucion('Empresa')[1]).toContain('IP fijas');
    expect(pasosEjecucion('Hogar')[1]).not.toContain('IP fijas');
  });

  it('vista previa: 5 acciones con los datos de la solicitud', () => {
    const acciones = accionesPrevistas({
      unidad: 'Hogar',
      documentos: 2,
      correo: 'maria@example.com',
      nuevoTitular: 'María Pérez',
      titularActual: 'Antonio Bustillo',
      contratos: 1,
      facturacion: '01/12/2026',
    });
    expect(acciones).toHaveLength(5);
    expect(acciones[0]?.detalle).toContain('2 documentos');
    expect(acciones[1]?.detalle).toContain('maria@example.com');
    expect(acciones[2]?.detalle).toContain('Antonio Bustillo → Desconectado');
    expect(acciones[3]?.titulo).toBe('4 · Facturación desde el 01/12/2026');
  });
});
