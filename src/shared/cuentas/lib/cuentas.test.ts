import { describe, expect, it } from 'vitest';
import type { Cuenta } from '../tipos';
import {
  consultasDisponibles,
  direccionCorta,
  estadoSaldo,
  etiquetaContrato,
  fechaVencimiento,
  nombreServicioLegible,
  numeroContrato,
  puedeAdministrarCuenta,
  rutaServicio,
  saldoCuenta,
  telefonoIpAsignado,
  textoEstadoOptico,
  tipoCliente,
  ubicacionCuenta,
  valorOSinDatos,
} from './cuentas';

const cuenta: Cuenta = {
  cuenta: '9000001',
  descTipoCliente: 'Hogar',
  descStatusCuenta: 'Conectado',
  descCiudad: 'Caracas',
  codMunicipioFact: 'Libertador',
  descUrbFact: 'Centro',
  saldo: 12.5,
  descMoneda: 'USD',
};

describe('cuentas', () => {
  it('tipo de cliente en mayúsculas', () => {
    expect(tipoCliente(cuenta)).toBe('HOGAR');
    expect(tipoCliente({})).toBe('');
  });

  it('ubicación como en la tarjeta del widget jQuery', () => {
    expect(ubicacionCuenta(cuenta)).toBe('Caracas - Municipio Libertador. Urb Centro');
  });

  it('saldo con símbolo de moneda', () => {
    expect(saldoCuenta(cuenta)).toBe('$ 12.5');
    expect(saldoCuenta({ saldo: 3, monedaPago: 'VEF' })).toBe('Bs 3');
    expect(saldoCuenta({ saldo: 3, descMoneda: 'EUR' })).toBe('EUR 3');
    expect(saldoCuenta({ saldo: 3 })).toBe(' 3');
  });

  it('ruta de cuenta y servicio', () => {
    const servicio = { nombreServicio: 'Internet' };
    expect(rutaServicio(cuenta, servicio)).toBe('9000001 / Internet');
    expect(rutaServicio(cuenta, servicio, 'Consulta OLT')).toBe('9000001 / Internet / Consulta OLT');
  });

  it('número de contrato sin los prefijos de BOSS', () => {
    expect(numeroContrato('AB-12-5000001')).toBe('5000001');
    expect(numeroContrato('AB-12-50-01')).toBe('50-01');
    expect(numeroContrato('5000001')).toBe('Sin datos');
    expect(numeroContrato(undefined)).toBe('Sin datos');
  });

  it('valorOSinDatos solo reemplaza null/undefined', () => {
    expect(valorOSinDatos(null)).toBe('Sin datos');
    expect(valorOSinDatos(undefined, 'Sin fecha')).toBe('Sin fecha');
    expect(valorOSinDatos('')).toBe('');
    expect(valorOSinDatos(0)).toBe(0);
  });
});

describe('contrato', () => {
  it('consultas por tipo de servicio', () => {
    expect(consultasDisponibles('Internet')).toEqual(['potencia', 'olt', 'serial', 'autofind', 'consumo']);
    expect(consultasDisponibles('Telefonía')).toEqual(['consumo']);
    expect(consultasDisponibles('Streaming')).toEqual([]);
  });

  it('dirección corta hasta el primer punto', () => {
    expect(direccionCorta('Caracas. Av. Principal')).toBe('Caracas');
    expect(direccionCorta(null)).toBe('Sin datos');
  });

  it('etiqueta vacía es Sin datos', () => {
    expect(etiquetaContrato('  ')).toBe('Sin datos');
    expect(etiquetaContrato(null)).toBe('Sin datos');
    expect(etiquetaContrato('VIP')).toBe('VIP');
  });

  it('vencimiento solo aplica a Empresa', () => {
    expect(fechaVencimiento({ descTipoCliente: 'Empresa' }, { fecha_vencimiento: '2027-01-01' })).toBe(
      '2027-01-01',
    );
    expect(fechaVencimiento({ descTipoCliente: 'Empresa' }, {})).toBe('Sin fecha');
    expect(fechaVencimiento({ descTipoCliente: 'Hogar' }, { fecha_vencimiento: '2027-01-01' })).toBe(
      'No aplica',
    );
  });

  it('teléfono IP solo para Internet y Telefonía', () => {
    expect(telefonoIpAsignado({ nombreServicio: 'Internet', nro_tlf: '0212' })).toBe('0212');
    expect(telefonoIpAsignado({ nombreServicio: 'Telefonía' })).toBe('Sin datos');
    expect(telefonoIpAsignado({ nombreServicio: 'Streaming', nro_tlf: '0212' })).toBe('No aplica');
  });

  it('estado óptico traduce "1"/"0"', () => {
    expect(textoEstadoOptico({ estatus: '1' }, 'estatus')).toBe('Conectado');
    expect(textoEstadoOptico({ estatus: '0' }, 'estatus')).toBe('Desconectado');
    expect(textoEstadoOptico({ conexion: 'IP Asignada' }, 'conexion')).toBe('IP Asignada');
    expect(textoEstadoOptico({}, 'potencia')).toBe('Sin datos');
    expect(textoEstadoOptico(null, 'potencia')).toBe('Sin datos');
  });
});

describe('puedeAdministrarCuenta', () => {
  it('Hogar solo para Servicio al Cliente', () => {
    expect(puedeAdministrarCuenta({ descTipoCliente: 'Hogar' }, 'Servicio al Cliente')).toBe(true);
    expect(puedeAdministrarCuenta({ descTipoCliente: 'Hogar' }, 'Ventas')).toBe(false);
  });

  it('Empresa también para Ventas y Administración de Ventas', () => {
    expect(puedeAdministrarCuenta({ descTipoCliente: 'Empresa' }, 'Ventas')).toBe(true);
    expect(puedeAdministrarCuenta({ descTipoCliente: 'Empresa' }, 'Administración de Ventas')).toBe(true);
    expect(puedeAdministrarCuenta({ descTipoCliente: 'Empresa' }, 'Tecnología')).toBe(false);
  });

  it('acepta el departamento como lista (multiselección)', () => {
    expect(puedeAdministrarCuenta({ descTipoCliente: 'Hogar' }, ['Ventas', 'Servicio al Cliente'])).toBe(
      true,
    );
    expect(puedeAdministrarCuenta({ descTipoCliente: 'Hogar' }, ['Administración de Ventas'])).toBe(false);
  });

  it('sin departamento no hay acceso', () => {
    expect(puedeAdministrarCuenta({ descTipoCliente: 'Hogar' }, null)).toBe(false);
    expect(puedeAdministrarCuenta({ descTipoCliente: 'Hogar' }, [])).toBe(false);
  });
});

describe('presentación de saldo y servicios', () => {
  it('estado del saldo', () => {
    expect(estadoSaldo({ saldo: -1.02, descMoneda: 'USD' })).toEqual({
      tipo: 'a-favor',
      etiqueta: 'Saldo a favor',
      monto: '$ 1.02',
    });
    expect(estadoSaldo({ saldo: 0, descMoneda: 'USD' })).toEqual({
      tipo: 'al-dia',
      etiqueta: 'Al día',
      monto: '$ 0',
    });
    expect(estadoSaldo({ saldo: 1200, descMoneda: 'VEF' })).toEqual({
      tipo: 'pendiente',
      etiqueta: 'Pendiente',
      monto: 'Bs 1200',
    });
    expect(estadoSaldo({ saldo: null }).tipo).toBe('sin-datos');
  });

  it('nombre legible del servicio', () => {
    expect(nombreServicioLegible({ nombreServicio: 'Internet', nombrePaquete: 'Fibranet600_600Mb' })).toBe(
      '600 Megas',
    );
    expect(
      nombreServicioLegible({
        nombreServicio: 'Internet',
        nombrePaquete: 'Fibra 1 Gbps',
        nombrePaqueteFact: 'Fibra 1 Gbps',
      }),
    ).toBe('Fibra 1 Gbps');
    expect(nombreServicioLegible({ nombreServicio: 'Salud', nombrePaquete: 'Beneficiario Adicional' })).toBe(
      'Beneficiario Adicional',
    );
  });
});
