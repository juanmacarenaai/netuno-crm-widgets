import { describe, expect, it } from 'vitest';
import type { Contrato } from '@/shared/cuentas';
import {
  contratosParaCambioEquipo,
  cuerpoCambioEquipo,
  etiquetaContrato,
  eventoCambioEquipo,
  MENSAJES_VALIDACION,
  resultadoCambioEquipo,
  validarCambioEquipo,
} from './cambioEquipo';

const servicio = (id: string, nombreServicio: string, status: string): Contrato => ({
  idProducto: id,
  codContrato: `C${id}`,
  nombreServicio,
  status,
  ubicacionJSON: [{ ciudad: 'Valencia' }],
});

describe('contratosParaCambioEquipo', () => {
  it('deja solo Internet conectado, sin importar mayúsculas ni espacios', () => {
    const contratos = [
      servicio('1', 'Internet', 'Conectado'),
      servicio('2', 'INTERNET ', 'conectado'),
      servicio('3', 'Internet', 'Suspendido'),
      servicio('4', 'Telefonía', 'Conectado'),
      servicio('5', 'Streaming', 'Conectado'),
      { idProducto: '6', nombreServicio: 'Internet', status: null },
    ];
    expect(contratosParaCambioEquipo({ contratos }).map((c) => c.idProducto)).toEqual(['1', '2']);
  });

  it('una cuenta sin contratos no tiene opciones', () => {
    expect(contratosParaCambioEquipo({})).toEqual([]);
  });
});

describe('etiquetaContrato', () => {
  it('muestra código y servicio, o el idProducto si no hay código', () => {
    expect(etiquetaContrato(servicio('9', 'Internet', 'Conectado'))).toBe('C9 - Internet');
    expect(etiquetaContrato({ idProducto: '9', nombreServicio: 'Internet' })).toBe('9 - Internet');
  });
});

describe('validarCambioEquipo', () => {
  it('pide primero el contrato', () => {
    expect(validarCambioEquipo({ idProducto: '', serial: '' })).toEqual({
      contrato: MENSAJES_VALIDACION.contrato,
    });
  });

  it('después el serial (en blanco o solo espacios)', () => {
    expect(validarCambioEquipo({ idProducto: '1', serial: '   ' })).toEqual({
      serial: MENSAJES_VALIDACION.serial,
    });
  });

  it('sin errores cuando están los dos', () => {
    expect(validarCambioEquipo({ idProducto: '1', serial: 'HWTC1234' })).toEqual({});
  });
});

describe('cuerpoCambioEquipo', () => {
  it('envía idProducto como contrato, serial sin espacios y el alias del usuario', () => {
    expect(
      cuerpoCambioEquipo({ idProducto: '55', serial: '  48575443ABCD ', aliasUsuario: 'jperez' }),
    ).toEqual({
      serialEquipoAsignar: '48575443ABCD',
      contrato: '55',
      usuario: 'jperez',
    });
  });
});

describe('resultadoCambioEquipo', () => {
  it('code 0 (número o texto) es éxito con el mensaje de la API', () => {
    expect(resultadoCambioEquipo({ code: 0, message: 'Comando enviado' })).toEqual({
      ok: true,
      mensaje: 'Comando enviado',
    });
    expect(resultadoCambioEquipo({ code: '0', message: 'Ok' }).ok).toBe(true);
  });

  it('otro código es rechazo con el mensaje de la API', () => {
    expect(resultadoCambioEquipo({ code: 1, message: 'Serial no disponible' })).toEqual({
      ok: false,
      mensaje: 'Serial no disponible',
    });
  });

  it('sin código o sin mensaje usa textos por defecto', () => {
    expect(resultadoCambioEquipo({ message: 'x' }).ok).toBe(false);
    expect(resultadoCambioEquipo({ code: '' }).ok).toBe(false);
    expect(resultadoCambioEquipo(null)).toEqual({
      ok: false,
      mensaje: 'La plataforma rechazó el cambio de equipo.',
    });
    expect(resultadoCambioEquipo({ code: 0 }).mensaje).toBe('Comando enviado exitosamente a la plataforma');
  });
});

describe('eventoCambioEquipo', () => {
  it('arma el evento de CRM con los textos del widget jQuery', () => {
    const e = eventoCambioEquipo({
      canal: 'Oficina',
      cuenta: { cuenta: 9000001 },
      contrato: servicio('5', 'Internet', 'Conectado'),
      registro: { id: 'R1', Negocio: 'Hogar', cf_tipo_documento: 'Cédula', Nro_de_Cliente: '77' },
      documento: 'V123',
      usuario: { id: 'U1', nombre: 'Ana Pérez' },
      fecha: new Date('2026-11-05T15:00:00Z'),
    });
    expect(e).toEqual({
      Name: 'Cambio de equipo desde Zoho CRM',
      Owner: 'U1',
      Negocio: 'Hogar',
      Cuenta: '9000001',
      Canal: 'Oficina',
      Contrato: 'C5',
      Ciudad: 'Valencia',
      Fecha: '2026-11-05',
      Registro: 'Modificación',
      Subtipo_de_registro: 'Cambio de equipo',
      Usuario: 'Ana Pérez',
      Descripci_n: 'Comando enviado exitosamente a la plataforma',
      Account_Name: 'R1',
      Tipo_de_Documento: 'Cédula',
      Nro_Documento: 'V123',
      N_mero_de_cliente: '77',
      Producto: 'Internet',
      Servicio: '',
      Plan_nuevo: '',
      Plan_anterior: '',
    });
  });

  it('sin código de contrato usa el idProducto', () => {
    const e = eventoCambioEquipo({
      canal: 'Chat',
      cuenta: { cuenta: '1' },
      contrato: { idProducto: '77', nombreServicio: 'Internet' },
      registro: null,
      documento: null,
      usuario: null,
    });
    expect(e.Contrato).toBe('77');
    expect(e.Ciudad).toBeUndefined();
  });
});
