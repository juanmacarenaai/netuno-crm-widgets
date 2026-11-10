import { describe, expect, it } from 'vitest';
import type { Contrato, Cuenta } from '@/shared/cuentas';
import {
  claveValida,
  conCorreoActualizado,
  confirmacionCorreo,
  correoAceptado,
  correoValido,
  cuentaYContratoDelEvento,
  cuerpoGestion,
  errorCorreoNuevo,
  errorNombreRed,
  eventoCambioCorreo,
  GESTION_WIFI_ACTIVA,
  GESTIONES,
  MENSAJE_CLAVE_INVALIDA,
  requisitosClave,
  resultadoGestion,
  serviciosConContrasena,
  wifiAdministrable,
} from './contrasenas';

const contrato = (idProducto: string, nombreServicio: string, extra: Partial<Contrato> = {}): Contrato => ({
  idProducto,
  nombreServicio,
  ...extra,
});

describe('servicios con contraseña', () => {
  it('solo NetUno Go (Streaming), en cualquier posición; Internet solo con el WiFi activo', () => {
    const cuenta: Cuenta = {
      cuenta: '1',
      contratos: [
        contrato('1', 'Telefonía'),
        contrato('2', 'Internet'),
        contrato('3', 'Salud'),
        contrato('4', 'Streaming'),
        contrato('5', ' streaming '),
      ],
    };
    expect(GESTION_WIFI_ACTIVA).toBe(false);
    expect(serviciosConContrasena(cuenta).map((c) => c.idProducto)).toEqual(['4', '5']);
    expect(serviciosConContrasena(cuenta, true).map((c) => c.idProducto)).toEqual(['2', '4', '5']);
    expect(serviciosConContrasena({ cuenta: '2' })).toEqual([]);
  });

  it('WiFi administrable solo con wifi === true', () => {
    expect(wifiAdministrable({ wifi: true })).toBe(true);
    expect(wifiAdministrable({ wifi: 'true' })).toBe(false);
    expect(wifiAdministrable({ code: -99, description: 'informacion no encontrada' })).toBe(false);
    expect(wifiAdministrable(null)).toBe(false);
  });
});

describe('validaciones', () => {
  it('contraseña: requisitos de la API y del widget jQuery', () => {
    expect(claveValida('Netuno*2026')).toBe(true);
    expect(claveValida('Net_Uno-77')).toBe(true);
    const fallas = (clave: string) =>
      requisitosClave(clave)
        .filter((r) => !r.cumple)
        .map((r) => r.id);
    expect(fallas('')).toEqual(['longitud', 'mayuscula', 'numero', 'especial', 'caracteres', 'secuencias']);
    expect(fallas('Ab*1')).toEqual(['longitud']);
    expect(fallas('Netuno*2026Largo99')).toEqual(['longitud']);
    expect(fallas('netuno*2026')).toEqual(['mayuscula']);
    expect(fallas('Netuno*Clave')).toEqual(['numero']);
    expect(fallas('Netuno2026x')).toEqual(['especial']);
    expect(fallas('Netuño*2026')).toEqual(['caracteres']);
    expect(fallas('Net uno*2026')).toEqual(['caracteres']);
    expect(fallas('Net"uno*2026')).toEqual(['caracteres']);
    expect(fallas('Netuno*1234')).toEqual(['secuencias']);
    expect(fallas('Abc*2026xy')).toEqual(['secuencias']);
    expect(fallas('Password*26')).toEqual(['secuencias']);
  });

  it('nombre de la red: letras, números y guion bajo', () => {
    expect(errorNombreRed('Casa_Netuno5G')).toBeNull();
    expect(errorNombreRed('')).toBe('Debe ingresar el nombre.');
    expect(errorNombreRed('Casa Netuno')).toMatch(/espacios/);
    expect(errorNombreRed('Casa-Netuno')).toMatch(/caracteres especiales/);
    expect(errorNombreRed('A'.repeat(33))).toMatch(/32/);
  });

  it('correo nuevo: formato y distinto al anterior', () => {
    expect(correoValido('usuario@dominio.com')).toBe(true);
    expect(correoValido('a.b+c@sub.dominio.co')).toBe(true);
    expect(correoValido('usuario@dominio')).toBe(false);
    expect(correoValido('.usuario@dominio.com')).toBe(false);
    expect(correoValido('usu..ario@dominio.com')).toBe(false);
    expect(correoValido('a@b@c.com')).toBe(false);
    expect(errorCorreoNuevo('', 'x@y.com')).toBe('Debe ingresar el correo nuevo.');
    expect(errorCorreoNuevo('malo', 'x@y.com')).toMatch(/formato/);
    expect(errorCorreoNuevo(' X@Y.com ', 'x@y.com')).toMatch(/distinto/);
    expect(errorCorreoNuevo('nuevo@y.com', 'x@y.com')).toBeNull();
  });
});

describe('cuerpo de la gestión (POST /contrato/contrasena/restablecer)', () => {
  const ctx = {
    documento: 'V12345678',
    usuario: 'Ana Asesor',
    correoCliente: 'cliente@crm.com',
    contrato: { idProducto: '11-1-500', serial: 'netunogo@cliente.com' },
  };

  it('portal web: servicio 3 con el correo del cliente', () => {
    expect(cuerpoGestion('portal', { clave: 'Clave*2026' }, { ...ctx, contrato: null })).toEqual({
      cedularif: 'V12345678',
      servicio: 3,
      correo: 'cliente@crm.com',
      ssid: null,
      contrasena: 'Clave*2026',
      usuarioZoho: 'Ana Asesor',
    });
  });

  it('NetUno Go y control parental: correo del contrato, sin contrato en el cuerpo', () => {
    expect(cuerpoGestion('netunogo', { clave: 'C' }, ctx)).toEqual({
      cedularif: 'V12345678',
      servicio: 1,
      correo: 'netunogo@cliente.com',
      ssid: null,
      contrasena: 'C',
      usuarioZoho: 'Ana Asesor',
    });
    expect(cuerpoGestion('parental', { clave: 'C' }, ctx)).toMatchObject({ servicio: 2 });
  });

  it('WiFi: servicio 4 con el contrato; correo como el widget jQuery', () => {
    expect(cuerpoGestion('wifi-clave', { clave: 'C' }, ctx)).toEqual({
      cedularif: 'V12345678',
      servicio: 4,
      correo: 'cliente@crm.com',
      contrasena: 'C',
      usuarioZoho: 'Ana Asesor',
      ssid: null,
      contrato: '11-1-500',
    });
    expect(cuerpoGestion('wifi-nombre', { nombre: 'Casa' }, ctx)).toMatchObject({
      correo: 'netunogo@cliente.com',
      contrasena: null,
      ssid: 'Casa',
      contrato: '11-1-500',
    });
    expect(cuerpoGestion('wifi-ambos', { clave: 'C', nombre: 'Casa' }, ctx)).toMatchObject({
      contrasena: 'C',
      ssid: 'Casa',
      contrato: '11-1-500',
    });
  });
});

describe('respuesta de la API', () => {
  it('código 0 = éxito con el mensaje de cada gestión', () => {
    expect(resultadoGestion('portal', { code: 0 })).toEqual({
      tono: 'exito',
      mensaje: GESTIONES.portal.exito,
    });
    expect(resultadoGestion('wifi-nombre', { code: '0' }).mensaje).toBe(
      'Cambio de nombre realizado con éxito.',
    );
    expect(resultadoGestion('wifi-ambos', { code: 0 }).mensaje).toBe(
      'Contraseña reiniciada y nombre cambiado.',
    );
  });

  it('"Exitoso." vale solo para portal, NetUno Go y control parental', () => {
    expect(resultadoGestion('netunogo', { message: 'Exitoso.' }).tono).toBe('exito');
    expect(resultadoGestion('wifi-clave', { message: 'Exitoso.' }).tono).toBe('error');
  });

  it('-2, -4 y otros códigos', () => {
    expect(resultadoGestion('wifi-clave', { code: -2 }).mensaje).toBe(MENSAJE_CLAVE_INVALIDA);
    expect(resultadoGestion('portal', { code: -4 }).mensaje).toBe('Formato de clave incorrecto.');
    expect(resultadoGestion('wifi-nombre', { code: -4 }).mensaje).toBe('Formato del nombre incorrecto.');
    expect(resultadoGestion('wifi-nombre', { code: -2 }).mensaje).toMatch(/\(código -2\)$/);
    expect(resultadoGestion('portal', { code: -9 }).mensaje).toMatch(
      /Consulte con el administrador\. \(código -9\)$/,
    );
    expect(resultadoGestion('portal', 'texto').mensaje).toBe(
      'No se ha logrado enviar el comando. Consulte con el administrador.',
    );
  });
});

describe('cambio de correo de NetUno Go', () => {
  it('aceptado solo con code 0', () => {
    expect(correoAceptado({ code: 0, message: 'ok', data: { contrato: '1' } })).toBe(true);
    expect(correoAceptado({ code: -1 })).toBe(false);
    expect(correoAceptado(null)).toBe(false);
  });

  it('confirma con el serial del contrato', () => {
    expect(confirmacionCorreo({ serial: 'Nuevo@x.com ' }, 'nuevo@x.com', '7')).toEqual({
      tono: 'exito',
      mensaje: 'Correo de NetUno Go actualizado: Nuevo@x.com',
      correoVigente: 'Nuevo@x.com',
    });
    expect(confirmacionCorreo({ serial: 'viejo@x.com' }, 'nuevo@x.com', '7')).toMatchObject({
      tono: 'aviso',
      correoVigente: 'viejo@x.com',
    });
    expect(confirmacionCorreo({}, 'nuevo@x.com', '7')).toMatchObject({ tono: 'aviso' });
    expect(confirmacionCorreo({}, 'nuevo@x.com', '7')).not.toHaveProperty('correoVigente');
  });

  it('actualiza el serial en las cuentas sin mutarlas', () => {
    const cuentas: Cuenta[] = [
      { cuenta: '1', contratos: [contrato('A', 'Streaming', { serial: 'v@x.com' })] },
      { cuenta: '2', contratos: [contrato('B', 'Internet')] },
    ];
    const nuevas = conCorreoActualizado(cuentas, 'A', 'n@x.com');
    expect(nuevas[0]?.contratos?.[0]?.serial).toBe('n@x.com');
    expect(cuentas[0]?.contratos?.[0]?.serial).toBe('v@x.com');
    expect(nuevas[1]).toBe(cuentas[1]);
  });

  it('textos del evento', () => {
    expect(eventoCambioCorreo('v@x.com', 'n@x.com', '11-1-7')).toEqual({
      nombre: 'Modificación (Correo de acceso a Netuno GO)',
      subtipo: 'Correo de Netuno Go',
      descripcion: 'Se ha cambiado el correo de acceso a Netuno GO de v@x.com a n@x.com (contrato 11-1-7)',
    });
  });
});

describe('cuenta y contrato del evento', () => {
  const cuentas: Cuenta[] = [
    { cuenta: '9001', contratos: [contrato('11-1-100', 'Internet', { codContrato: 'C-100' })] },
    { cuenta: '9002', contratos: [contrato('11-1-200', 'Streaming')] },
  ];

  it('el contrato de la gestión con su cuenta; sin codContrato, el idProducto sin prefijo', () => {
    expect(cuentaYContratoDelEvento(cuentas, cuentas[1]?.contratos?.[0])).toEqual({
      cuenta: { cuenta: '9002' },
      contrato: { codContrato: '200', ubicacionJSON: undefined },
    });
    expect(cuentaYContratoDelEvento(cuentas, contrato('500', 'Internet'))?.contrato?.codContrato).toBe('500');
  });

  it('portal web: primer contrato de la primera cuenta; sin cuentas, null', () => {
    expect(cuentaYContratoDelEvento(cuentas, null)).toMatchObject({
      cuenta: { cuenta: '9001' },
      contrato: { codContrato: 'C-100' },
    });
    expect(cuentaYContratoDelEvento([], null)).toBeNull();
  });
});
