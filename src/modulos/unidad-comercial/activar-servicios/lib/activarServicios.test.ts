import { describe, expect, it } from 'vitest';
import type { Contrato, Cuenta } from '@/shared/cuentas';
import {
  actualizacionCuenta,
  correoBase64,
  cuerpoActivacion,
  debeActualizarCuenta,
  elegibilidadActivacion,
  FORMULARIO_VACIO,
  hoyIso,
  MENSAJES_ELEGIBILIDAD,
  MENSAJES_FORMULARIO,
  paquetesDesdeRespuesta,
  parametrosConsulta,
  requisitosActivacion,
  resultadoActivacion,
  serviciosAConsultar,
  sexoDesdeCrm,
  tipoSalud,
  validarActivacion,
  type FormularioActivacion,
  type PaqueteActivable,
  type Requisitos,
} from './activarServicios';

const c = (idProducto: string, nombreServicio: string, extra: Partial<Contrato> = {}): Contrato => ({
  idProducto,
  codContrato: `C${idProducto}`,
  nombreServicio,
  status: 'Conectado',
  ...extra,
});
const fibra = c('A-1-100', 'Internet', { tipoRed: 'FTTH', nombrePaquete: 'Fibranet300_300Mb' });
const cuenta = (contratos: Contrato[], extra: Partial<Cuenta> = {}): Cuenta => ({
  cuenta: 9000006,
  codTipoCliente: 1,
  saldo: 0,
  documentoIdentificacion: 'V12345678',
  contratos,
  ...extra,
});

describe('elegibilidadActivacion', () => {
  it('Empresa, Comercio y factura pendiente, en ese orden', () => {
    const conTodo = { codTipoCliente: 2, tipoIdentificacion: 2, saldo: 10 };
    expect(elegibilidadActivacion(cuenta([fibra], conTodo))).toMatchObject({ ok: false, motivo: 'empresa' });
    expect(elegibilidadActivacion(cuenta([fibra], { ...conTodo, codTipoCliente: 1 }))).toMatchObject({
      motivo: 'comercio',
      mensaje: MENSAJES_ELEGIBILIDAD.comercio,
    });
    expect(elegibilidadActivacion(cuenta([fibra], { saldo: '5.2' }))).toMatchObject({ motivo: 'saldo' });
  });

  it('acepta el tipo de cliente como texto', () => {
    expect(elegibilidadActivacion(cuenta([fibra], { codTipoCliente: '2' }))).toMatchObject({
      motivo: 'empresa',
    });
  });

  it('saldo cero, negativo o vacío no bloquea', () => {
    for (const saldo of [0, -3, null, '']) {
      expect(elegibilidadActivacion(cuenta([fibra], { saldo })).ok).toBe(true);
    }
  });

  it('exige Internet FTTH conectado y lo devuelve', () => {
    expect(elegibilidadActivacion(cuenta([fibra]))).toEqual({ ok: true, internet: fibra });
    const sinFibra = [c('1', 'Internet', { tipoRed: 'HFC' }), { ...fibra, status: 'Suspendido' }];
    expect(elegibilidadActivacion(cuenta(sinFibra))).toMatchObject({ motivo: 'sinInternet' });
  });
});

describe('serviciosAConsultar', () => {
  it('sin NetUnoGO, Telefonía ni Salud consulta NetUnoGO, Telefonía y Salud', () => {
    expect(serviciosAConsultar(cuenta([fibra]))).toEqual(['netunogo', 'telefonia', 'salud']);
  });

  it('con NetUnoGO conectado ofrece Premium', () => {
    const go = c('2', 'Streaming', { nombrePaquete: 'NetUnoGO Plus 5' });
    expect(serviciosAConsultar(cuenta([fibra, go]))[0]).toBe('premium');
    const otro = c('3', 'Streaming', { nombrePaquete: 'Streaming Básico' });
    expect(serviciosAConsultar(cuenta([fibra, otro]))[0]).toBe('netunogo');
  });

  it('Telefonía conectada no se ofrece; suspendida sí', () => {
    expect(serviciosAConsultar(cuenta([fibra, c('4', 'Telefonía')]))).not.toContain('telefonia');
    expect(serviciosAConsultar(cuenta([fibra, c('4', 'Telefonía', { status: 'Suspendido' })]))).toContain(
      'telefonia',
    );
  });

  it('Salud hasta 4 contratos conectados', () => {
    const salud = (n: number) => Array.from({ length: n }, (_, i) => c(`S${i}`, 'Salud'));
    expect(serviciosAConsultar(cuenta([fibra, ...salud(4)]))).toContain('salud');
    expect(serviciosAConsultar(cuenta([fibra, ...salud(5)]))).not.toContain('salud');
  });
});

describe('parametrosConsulta', () => {
  const datos = { documento: 'V1', idProducto: 'A-1-100' };
  it('arma los parámetros del widget jQuery', () => {
    expect(parametrosConsulta('premium', datos)).toEqual({
      paquete: '2',
      cedularif: 'V1',
      contrato: 'A-1-100',
      codServicio: '6',
    });
    expect(parametrosConsulta('telefonia', datos)).toMatchObject({ paquete: '1', codServicio: '4' });
    expect(parametrosConsulta('salud', datos)).toEqual({
      paquete: '1',
      cedularif: 'V1',
      contrato: 'A-1-100',
      codServicio: '7',
      solo911: '1',
      tipo: '1',
      codTipoVenta: '2',
    });
  });
});

describe('paquetesDesdeRespuesta', () => {
  it('Premium quita "Paquete Premium " y arma el precio', () => {
    const r = {
      mensualidad: [
        { Codigo: 'P1', Paquete: 'Paquete Premium Cine', Precio: [{ Moneda: '$', Precio: 4.99 }] },
        { Codigo: 'P2', Paquete: 'HBO', Precio: [{ Moneda: '$', Precio: 3 }] },
      ],
    };
    expect(paquetesDesdeRespuesta('premium', r)).toEqual([
      { codigo: 'P1', nombre: 'Cine', precio: '$4.99', servicio: 'premium' },
      { codigo: 'P2', nombre: 'HBO', precio: '$3', servicio: 'premium' },
    ]);
  });

  it('Telefonía siempre muestra $1', () => {
    const r = { mensualidad: [{ Codigo: 4, Paquete: 'Fija', Precio: [{ Moneda: '$', Precio: 9 }] }] };
    expect(paquetesDesdeRespuesta('telefonia', r)).toEqual([
      { codigo: '4', nombre: 'Fija', precio: '$1', servicio: 'telefonia' },
    ]);
  });

  it('Salud usa Moneda y Precio planos ($ y 0 por defecto)', () => {
    const r = {
      mensualidad: [
        { Codigo: 'S1', Paquete: 'Beneficiario Ppal', Moneda: 'Bs ', Precio: ' 3.50 ' },
        { Codigo: 'S2', Paquete: 'Beneficiario Adicional' },
      ],
    };
    expect(paquetesDesdeRespuesta('salud', r).map((p) => p.precio)).toEqual(['Bs3.50', '$0']);
  });

  it('sin mensualidad no hay paquetes', () => {
    expect(paquetesDesdeRespuesta('netunogo', {})).toEqual([]);
    expect(paquetesDesdeRespuesta('salud', null)).toEqual([]);
  });
});

describe('tipoSalud y requisitos', () => {
  it('reconoce titular y adicional sin importar mayúsculas', () => {
    expect(tipoSalud('Salud BENEFICIARIO PPAL')).toBe('titular');
    expect(tipoSalud('Beneficiario adicional')).toBe('adicional');
    expect(tipoSalud('Salud 911')).toBe('otro');
  });

  it('sexo de CRM a F/M', () => {
    expect(sexoDesdeCrm('Femenino')).toBe('F');
    expect(sexoDesdeCrm('Masculino')).toBe('M');
    expect(sexoDesdeCrm(null)).toBeNull();
    expect(sexoDesdeCrm('  ')).toBeNull();
  });

  const paquete = (servicio: PaqueteActivable['servicio'], nombre: string) => ({ servicio, nombre });
  it('NetUnoGO pide correo', () => {
    expect(requisitosActivacion(paquete('netunogo', 'Plus 3'), {})).toEqual({
      correoNetunoGo: true,
      titular: { sexo: false, fechaNacimiento: false },
      beneficiario: false,
    });
  });

  it('Salud titular pide solo lo que falta en CRM', () => {
    const r = requisitosActivacion(paquete('salud', 'Beneficiario Ppal'), { Sexo: 'Femenino' });
    expect(r.titular).toEqual({ sexo: false, fechaNacimiento: true });
    expect(r.beneficiario).toBe(false);
  });

  it('Salud adicional pide el beneficiario', () => {
    const r = requisitosActivacion(paquete('salud', 'Beneficiario Adicional'), {
      Sexo: 'Masculino',
      Fecha_de_nacimiento: '1980-01-01',
    });
    expect(r).toEqual({
      correoNetunoGo: false,
      titular: { sexo: false, fechaNacimiento: false },
      beneficiario: true,
    });
  });

  it('Salud sin titular ni adicional no pide nada', () => {
    expect(requisitosActivacion(paquete('salud', 'Salud 911'), {}).titular).toEqual({
      sexo: false,
      fechaNacimiento: false,
    });
  });
});

const NADA: Requisitos = {
  correoNetunoGo: false,
  titular: { sexo: false, fechaNacimiento: false },
  beneficiario: false,
};
const beneficiarioCompleto: FormularioActivacion['beneficiario'] = {
  nombre: 'Ana',
  apellido: 'Pérez',
  tipoDocumento: 'V',
  nDocumento: '30111222',
  correo: 'ana@example.com',
  nArea: '0414',
  nTelefono: '1234567',
  estadoCivil: 'S',
  cParentesco: '3',
  fNacimiento: '2010-05-04',
  sexo: 'F',
};

describe('validarActivacion', () => {
  const hoy = '2026-11-05';

  it('sin requisitos no hay errores', () => {
    expect(validarActivacion(NADA, FORMULARIO_VACIO, hoy)).toEqual({});
  });

  it('correo de NetUnoGO obligatorio y con formato', () => {
    const req = { ...NADA, correoNetunoGo: true };
    expect(validarActivacion(req, FORMULARIO_VACIO, hoy)).toEqual({ correo: MENSAJES_FORMULARIO.correo });
    expect(validarActivacion(req, { ...FORMULARIO_VACIO, correo: 'a@b' }, hoy)).toEqual({
      correo: MENSAJES_FORMULARIO.correoInvalido,
    });
    expect(validarActivacion(req, { ...FORMULARIO_VACIO, correo: ' a@b.com ' }, hoy)).toEqual({});
  });

  it('titular: sexo y fecha (no futura)', () => {
    const req = { ...NADA, titular: { sexo: true, fechaNacimiento: true } };
    expect(validarActivacion(req, FORMULARIO_VACIO, hoy)).toEqual({
      'titular.sexo': MENSAJES_FORMULARIO.titularSexo,
      'titular.fechaNacimiento': MENSAJES_FORMULARIO.titularFecha,
    });
    const futuro = { ...FORMULARIO_VACIO, titular: { sexo: 'M', fechaNacimiento: '2026-11-06' } };
    expect(validarActivacion(req, futuro, hoy)).toEqual({
      'titular.fechaNacimiento': MENSAJES_FORMULARIO.fechaFutura,
    });
  });

  it('beneficiario: todos los campos a la vez', () => {
    const errores = validarActivacion({ ...NADA, beneficiario: true }, FORMULARIO_VACIO, hoy);
    expect(Object.keys(errores)).toHaveLength(11);
    expect(errores['beneficiario.nDocumento']).toBe(MENSAJES_FORMULARIO.nDocumento);
  });

  it('beneficiario completo es válido; menor sin cédula no pide número', () => {
    const req = { ...NADA, beneficiario: true };
    const f = { ...FORMULARIO_VACIO, beneficiario: beneficiarioCompleto };
    expect(validarActivacion(req, f, hoy)).toEqual({});
    const menor = { ...f, beneficiario: { ...beneficiarioCompleto, tipoDocumento: 'P', nDocumento: '' } };
    expect(validarActivacion(req, menor, hoy)).toEqual({});
  });

  it('celular de 7 dígitos y correo con formato', () => {
    const req = { ...NADA, beneficiario: true };
    const f = {
      ...FORMULARIO_VACIO,
      beneficiario: { ...beneficiarioCompleto, nTelefono: '12345', correo: 'ana' },
    };
    expect(validarActivacion(req, f, hoy)).toEqual({
      'beneficiario.nTelefono': MENSAJES_FORMULARIO.nTelefonoInvalido,
      'beneficiario.correo': MENSAJES_FORMULARIO.correoInvalido,
    });
  });
});

describe('cuerpoActivacion', () => {
  const base = {
    internet: fibra,
    cuenta: cuenta([fibra]),
    registro: { id: 'R1', email: 'cliente@example.com' } as Record<string, unknown>,
    formulario: FORMULARIO_VACIO,
    aliasUsuario: 'asesor',
  };
  const paquete = (
    servicio: PaqueteActivable['servicio'],
    nombre = 'X',
    codigo = 'K1',
  ): PaqueteActivable => ({
    servicio,
    nombre,
    codigo,
    precio: '$1',
  });

  it('Premium: paquete 2, servicio 6 y correo vacío', () => {
    expect(cuerpoActivacion({ ...base, paquete: paquete('premium') })).toEqual({
      cedularif: 'V12345678',
      contrato: 'A-1-100',
      codServicio: 6,
      paquete: 2,
      correo: '',
      idPaquete: 'K1',
      usuarioRef: 'asesor',
    });
  });

  it('NetUnoGO lleva el correo; Telefonía no lleva correo', () => {
    const f = { ...FORMULARIO_VACIO, correo: ' go@example.com ' };
    expect(cuerpoActivacion({ ...base, formulario: f, paquete: paquete('netunogo') })).toMatchObject({
      codServicio: 6,
      paquete: 1,
      correo: 'go@example.com',
    });
    const tlf = cuerpoActivacion({ ...base, paquete: paquete('telefonia') });
    expect(tlf).toMatchObject({ codServicio: 4, paquete: 1 });
    expect(tlf).not.toHaveProperty('correo');
  });

  it('Salud titular: datos de CRM, correo en base64 y sin OTP', () => {
    const cuerpo = cuerpoActivacion({
      ...base,
      registro: { ...base.registro, Sexo: 'Femenino', Fecha_de_nacimiento: '1985-02-03' },
      paquete: paquete('salud', 'Beneficiario Ppal', 'S1'),
    });
    expect(cuerpo).toMatchObject({
      codServicio: 7,
      cedularif: 'V12345678',
      sexoCliente: 'F',
      fNacimientoCliente: '1985-02-03',
      correo: btoa('cliente@example.com'),
      idCuenta: '9000006',
      idContratoFibra: '100',
      idPaquete: 'S1',
      otp: '',
      validarOtp: false,
      usuarioRef: 'asesor',
    });
    expect(cuerpo.asociado).toMatchObject({ nombre: '', cParentesco: null, ocupacion: '' });
  });

  it('Salud titular sin datos en CRM usa los del formulario', () => {
    const f = { ...FORMULARIO_VACIO, titular: { sexo: 'M', fechaNacimiento: '1990-10-10' } };
    expect(
      cuerpoActivacion({ ...base, formulario: f, paquete: paquete('salud', 'Beneficiario Ppal') }),
    ).toMatchObject({ sexoCliente: 'M', fNacimientoCliente: '1990-10-10' });
  });

  it('Salud adicional: beneficiario, parentesco numérico y OTP', () => {
    const f = {
      ...FORMULARIO_VACIO,
      titular: { sexo: 'F', fechaNacimiento: '1980-01-01' },
      beneficiario: beneficiarioCompleto,
    };
    const cuerpo = cuerpoActivacion({
      ...base,
      formulario: f,
      paquete: paquete('salud', 'Beneficiario Adicional'),
    });
    expect(cuerpo.validarOtp).toBe(true);
    expect(cuerpo.asociado).toEqual({
      nombre: 'Ana',
      apellido: 'Pérez',
      tipoDocumento: 'V',
      nDocumento: '30111222',
      correo: 'ana@example.com',
      nArea: '0414',
      nTelefono: '1234567',
      fNacimiento: '2010-05-04',
      sexo: 'F',
      estadoCivil: 'S',
      cParentesco: 3,
      ocupacion: '',
    });
  });

  it('menor sin cédula: documento del titular + "1"', () => {
    const f = {
      ...FORMULARIO_VACIO,
      beneficiario: { ...beneficiarioCompleto, tipoDocumento: 'P', nDocumento: '' },
    };
    const cuerpo = cuerpoActivacion({
      ...base,
      formulario: f,
      paquete: paquete('salud', 'Beneficiario Adicional'),
    });
    expect((cuerpo.asociado as { nDocumento: string }).nDocumento).toBe('V123456781');
  });

  it('Salud sin titular ni adicional va sin datos del titular', () => {
    const cuerpo = cuerpoActivacion({ ...base, paquete: paquete('salud', 'Salud 911') });
    expect(cuerpo).toMatchObject({ sexoCliente: '', fNacimientoCliente: '', correo: '', validarOtp: false });
  });
});

describe('actualización de la cuenta', () => {
  it('solo en Salud titular o adicional', () => {
    expect(debeActualizarCuenta({ servicio: 'salud', nombre: 'Beneficiario Ppal' })).toBe(true);
    expect(debeActualizarCuenta({ servicio: 'salud', nombre: 'Salud 911' })).toBe(false);
    expect(debeActualizarCuenta({ servicio: 'netunogo', nombre: 'Beneficiario Ppal' })).toBe(false);
  });

  it('guarda sexo como texto de CRM y la fecha', () => {
    const f = { ...FORMULARIO_VACIO, titular: { sexo: 'F', fechaNacimiento: '1990-01-02' } };
    expect(
      actualizacionCuenta({
        paquete: { servicio: 'salud', nombre: 'Beneficiario Ppal', codigo: 'S1', precio: '$1' },
        registro: { id: 'R1' },
        formulario: f,
      }),
    ).toEqual({ id: 'R1', Fecha_de_nacimiento: '1990-01-02', Sexo: 'Femenino' });
  });
});

describe('resultadoActivacion', () => {
  const paquete = { nombre: 'NetUnoGO Plus 3' };
  it('éxito con respuesta 0, code 1 o codaprobacion 0 (número o texto)', () => {
    for (const r of [{ respuesta: 0 }, { respuesta: '0' }, { code: 1 }, { codaprobacion: '0' }]) {
      expect(resultadoActivacion(r, paquete, fibra).ok).toBe(true);
    }
  });

  it('texto e historial como en el widget jQuery', () => {
    expect(resultadoActivacion({ respuesta: 0 }, paquete, fibra)).toEqual({
      ok: true,
      texto: '✅ Completado - NetUnoGO Plus 3',
      historial: 'Contrato: A-1-100. Paquete: NetUnoGO Plus 3. Estatus: Exitoso.',
    });
    expect(resultadoActivacion({ respuesta: 1 }, paquete, fibra)).toEqual({
      ok: false,
      texto: '❌ Ha ocurrido un error activando el servicio - NetUnoGO Plus 3',
      historial: 'Contrato: A-1-100. Paquete: NetUnoGO Plus 3. Estatus: Fallido.',
    });
  });

  it('sin campos reconocidos es fallo', () => {
    expect(resultadoActivacion({}, paquete, fibra).ok).toBe(false);
    expect(resultadoActivacion(null, paquete, fibra).ok).toBe(false);
    expect(resultadoActivacion({ respuesta: null }, paquete, fibra).ok).toBe(false);
  });
});

describe('utilidades', () => {
  it('correoBase64 equivale a btoa en ASCII', () => {
    expect(correoBase64('a.b@example.com')).toBe(btoa('a.b@example.com'));
  });

  it('hoyIso usa la fecha local', () => {
    expect(hoyIso(new Date(2026, 0, 9))).toBe('2026-01-09');
  });
});
