import { describe, expect, it } from 'vitest';
import type { Contrato, Cuenta } from '@/shared/cuentas';
import {
  alternarBaja,
  camposBaja,
  contratosDelEvento,
  contratosParaBaja,
  decidirBaja,
  departamentoBusqueda,
  departamentoTicket,
  elegibilidadBaja,
  equipoSinRetencion,
  formularioInicial,
  internetConDependencias,
  MENSAJES_BAJA,
  MOTIVO_DESCONEXION,
  nombreAsegurado,
  nombreTerritorio,
  seleccionVacia,
  serviciosBaja,
  subProducto,
  textoResultadoBaja,
  ticketBaja,
  tipoDeContrato,
  tituloPaquete,
  validarBaja,
  type EscenarioBaja,
  type ServicioBaja,
} from './bajaVoluntaria';

const c = (idProducto: string, nombreServicio: string, extra: Partial<Contrato> = {}): Contrato => ({
  idProducto,
  codContrato: `${idProducto.split('-').pop() ?? idProducto}`,
  nombreServicio,
  status: 'Conectado',
  ...extra,
});
const cuenta = (contratos: Contrato[], extra: Partial<Cuenta> = {}): Cuenta => ({
  cuenta: '9000001',
  descStatusCuenta: 'Conectado',
  descTipoCliente: 'Hogar',
  descCiudad: 'Caracas',
  saldo: 0,
  contratos,
  ...extra,
});

describe('elegibilidadBaja', () => {
  const internet = c('A-1-1', 'Internet');

  it('cuenta conectada, con contratos conectados y saldo al día', () => {
    expect(elegibilidadBaja(cuenta([internet, c('A-1-2', 'Salud', { status: 'Suspendido' })]), {})).toEqual({
      ok: true,
      conectados: [internet],
    });
    expect(elegibilidadBaja(cuenta([internet], { saldo: -5 }), {}).ok).toBe(true);
  });

  it('saldo pendiente o saldo vacío no cumplen', () => {
    expect(elegibilidadBaja(cuenta([internet], { saldo: 10 }), {})).toEqual({
      ok: false,
      mensaje: MENSAJES_BAJA.saldo,
    });
    expect(elegibilidadBaja(cuenta([internet], { saldo: null }), {})).toEqual({
      ok: false,
      mensaje: MENSAJES_BAJA.criterios,
    });
  });

  it('cuenta desconectada o sin contratos conectados', () => {
    expect(elegibilidadBaja(cuenta([internet], { descStatusCuenta: 'Suspendido' }), {}).ok).toBe(false);
    expect(elegibilidadBaja(cuenta([{ ...internet, status: 'Cortado' }]), {}).ok).toBe(false);
  });

  it('Carrier, Carrier Nacional e ISPS conectados pasan aunque tengan saldo', () => {
    for (const clase of ['Carrier', 'Carrier Nacional', 'ISPS']) {
      expect(elegibilidadBaja(cuenta([internet], { saldo: 99 }), { Clase_de_cliente: clase }).ok).toBe(true);
    }
    expect(
      elegibilidadBaja(cuenta([internet], { saldo: 99, descStatusCuenta: 'Suspendido' }), {
        Clase_de_cliente: 'ISPS',
      }).ok,
    ).toBe(false);
  });
});

describe('tarjetas', () => {
  it('tituloPaquete: parte después del guion bajo y beneficiarios', () => {
    expect(tituloPaquete('Fibranet600_600Mb')).toBe('600 Megas');
    expect(tituloPaquete('Fibranet1Gb_1Gb')).toBe('1 Gigas');
    expect(tituloPaquete('Salud Beneficiario Ppal')).toBe('Beneficiario Principal');
    expect(tituloPaquete('Beneficiario Adicional')).toBe('Beneficiario Adicional');
    expect(tituloPaquete('NetUnoGO Plus 5')).toBe('NetUnoGO Plus 5');
    expect(tituloPaquete(null)).toBe('');
  });

  it('nombreAsegurado: nombre y primer apellido capitalizados', () => {
    expect(nombreAsegurado('ANA')).toBe('Ana');
    expect(nombreAsegurado('ana perez')).toBe('Ana Perez');
    expect(nombreAsegurado('ANA MARIA PEREZ GOMEZ')).toBe('Ana Perez');
    expect(nombreAsegurado('  ')).toBe('');
    expect(nombreAsegurado(null)).toBe('');
  });

  it('detalle por servicio y aprobación según paquetizado', () => {
    const servicios = serviciosBaja(
      [
        c('1', 'Internet', { nombrePaquete: 'Fibranet600_600Mb' }),
        c('2', 'Streaming', { nombrePaquete: 'NetUnoGO Plus 5', serial: 'CLIENTE@EXAMPLE.COM' }),
        c('3', 'Telefonía', { telefonogpo: '02125550000' }),
        c('4', 'Salud', { nombrePaquete: 'Beneficiario Ppal', NombreAseg: 'LUIS PEREZ' }),
        c('5', 'Televisión por Cable', { nombrePaquete: 'Básico' }),
      ],
      [
        { contrato: '1', esPaquetizado: false },
        { contrato: '2', esPaquetizado: true },
        { contrato: '3', esPaquetizado: 0 },
      ],
    );
    expect(servicios.map((s) => [s.titulo, s.detalle, s.aprobacion])).toEqual([
      ['600 Megas', 'Fibranet600_600Mb', false],
      ['NetUnoGO Plus 5', 'Cliente@example.com', true],
      ['', '02125550000', false],
      ['Beneficiario Principal', 'Luis Perez', true],
      ['Televisión por Cable', 'Básico', true],
    ]);
  });
});

describe('alternarBaja', () => {
  const s = (servicio: string, titulo: string, detalle = ''): ServicioBaja => ({
    contrato: c(`${servicio}-${titulo}`, servicio),
    servicio,
    titulo,
    detalle,
    aprobacion: false,
  });
  const servicios = [
    s('Internet', '600 Megas'),
    s('Internet', '800 Megas'),
    s('Telefonía', ''),
    s('Streaming', 'NetUnoGO Plus 5', 'a@x.com'),
    s('Streaming', 'Premium Cine', 'a@x.com'),
    s('Streaming', 'Premium Deportes', 'b@x.com'),
    s('Salud', 'Beneficiario Principal'),
    s('Salud', 'Beneficiario Adicional'),
  ];
  const vacia = seleccionVacia(servicios.length);
  const con = { internetConDependencias: true };

  it('Internet arrastra y bloquea todo lo demás, y desmarca el otro Internet', () => {
    const r = alternarBaja(servicios, alternarBaja(servicios, vacia, 1, con), 0, con);
    expect(r.marcados).toEqual([true, false, true, true, true, true, true, true]);
    expect(r.bloqueados).toEqual([false, false, true, true, true, true, true, true]);
    const fuera = alternarBaja(servicios, r, 0, con);
    expect(fuera).toEqual(vacia);
  });

  it('un servicio bloqueado no se puede desmarcar solo', () => {
    const r = alternarBaja(servicios, vacia, 0, con);
    expect(alternarBaja(servicios, r, 2, con)).toBe(r);
  });

  it('sin dependencias (Empresa o clases especiales) Internet se marca solo', () => {
    const r = alternarBaja(servicios, vacia, 0, { internetConDependencias: false });
    expect(r.marcados).toEqual([true, false, false, false, false, false, false, false]);
  });

  it('NetUnoGO arrastra los paquetes de su correo y desmarca lo demás', () => {
    const conTelefonia = alternarBaja(servicios, vacia, 2, con);
    const r = alternarBaja(servicios, conTelefonia, 3, con);
    expect(r.marcados).toEqual([false, false, false, true, true, false, false, false]);
    expect(r.bloqueados[4]).toBe(true);
  });

  it('Beneficiario Principal arrastra a los adicionales', () => {
    const r = alternarBaja(servicios, vacia, 6, con);
    expect(r.marcados.slice(6)).toEqual([true, true]);
    expect(r.bloqueados[7]).toBe(true);
    expect(alternarBaja(servicios, r, 6, con).marcados.slice(6)).toEqual([false, false]);
  });

  it('internetConDependencias según clase y negocio', () => {
    expect(internetConDependencias({})).toBe(true);
    expect(internetConDependencias({ Negocio: 'Empresa' })).toBe(false);
    expect(internetConDependencias({ Clase_de_cliente: 'Carrier Nacional' })).toBe(false);
  });
});

describe('retención, equipo y departamento', () => {
  it('equipo alquilado pregunta por la devolución; propio o sin Internet no', () => {
    const hogar = { descTipoCliente: 'Hogar' };
    expect(
      equipoSinRetencion(hogar, [
        c('1', 'Telefonía'),
        c('2', 'Internet', { alquilerEquipo: 'SI', serial: 'S1' }),
      ]),
    ).toEqual({
      pregunta: true,
      serial: 'S1',
    });
    expect(equipoSinRetencion(hogar, [c('2', 'Internet', { alquilerEquipo: 'NO' })])).toEqual({
      pregunta: false,
      equipo: 'Equipo propio',
    });
    expect(equipoSinRetencion(hogar, [c('1', 'Telefonía')])).toEqual({
      pregunta: false,
      equipo: 'No aplica',
    });
    expect(
      equipoSinRetencion({ descTipoCliente: 'Empresa' }, [c('2', 'Internet', { alquilerEquipo: 'SI' })]),
    ).toEqual({ pregunta: false, equipo: 'No aplica' });
  });

  const d = { atc: 'ATC', ave: 'AVE', ve: 'VE' };
  it('Hogar → Servicio al cliente; Empresa → Administración de ventas, o Ventas si retuvo', () => {
    expect(departamentoBusqueda({ descTipoCliente: 'Hogar' }, d)).toEqual({
      id: 'ATC',
      nombre: 'Servicio al cliente',
    });
    expect(departamentoBusqueda({ descTipoCliente: 'Empresa' }, d).id).toBe('AVE');
    expect(departamentoTicket({ descTipoCliente: 'Empresa' }, { retencion: true }, d)).toEqual({
      id: 'VE',
      nombre: 'Ventas',
    });
    expect(departamentoTicket({ descTipoCliente: 'Empresa' }, { retencion: false }, d).id).toBe('AVE');
    expect(departamentoTicket({ descTipoCliente: 'Hogar' }, { retencion: true }, d).id).toBe('ATC');
  });
});

describe('formulario', () => {
  const hoy = '2026-11-05';
  const retencion: EscenarioBaja = { retencion: true, equipo: 'No aplica' };
  const alquilado: EscenarioBaja = { retencion: false, equipo: 'Sin equipo propio', serial: 'S1' };
  const propio: EscenarioBaja = { retencion: false, equipo: 'Equipo propio' };

  it('campos según el escenario', () => {
    expect(camposBaja(retencion)).toEqual({
      estrategia: true,
      serial: false,
      fecha: false,
      comentarios: false,
    });
    expect(camposBaja(alquilado)).toEqual({
      estrategia: false,
      serial: true,
      fecha: false,
      comentarios: true,
    });
    expect(camposBaja(propio)).toEqual({ estrategia: false, serial: false, fecha: true, comentarios: true });
    expect(camposBaja({ retencion: false, equipo: 'No aplica' }).fecha).toBe(true);
  });

  it('formulario inicial: serial precargado y fecha de hoy', () => {
    expect(formularioInicial(alquilado, hoy)).toMatchObject({ serial: 'S1', fecha: hoy });
  });

  it('valida obligatorios con los mensajes del widget jQuery', () => {
    expect(validarBaja(retencion, formularioInicial(retencion, hoy), hoy)).toEqual({
      motivo: 'La intención de la desconexión no puede estar en blanco',
      estrategia: 'Estrategia de retención aplicada no puede estar en blanco',
    });
    expect(validarBaja(alquilado, { ...formularioInicial(alquilado, hoy), serial: ' ' }, hoy)).toEqual({
      motivo: 'Motivo de baja no puede estar en blanco',
      serial: 'Serial del equipo no puede estar en blanco',
    });
    const f = { ...formularioInicial(propio, hoy), motivo: 'Mudanza' };
    expect(validarBaja(propio, f, hoy)).toEqual({});
    expect(validarBaja(propio, { ...f, fecha: '2026-11-04' }, hoy).fecha).toContain('anterior a hoy');
    expect(validarBaja(propio, { ...f, fecha: '' }, hoy).fecha).toBe(
      'Fecha de desconexion no puede estar en blanco',
    );
  });
});

describe('contratosParaBaja, tipo y subproducto', () => {
  const internet = c('A-1-10', 'Internet', { tipoRed: 'FTTH' });
  const netunogo = c('A-1-11', 'Streaming', { nombrePaquete: 'NetUnoGO Plus 5' });
  const premium = c('A-1-12', 'Streaming', { nombrePaquete: 'Premium Cine' });
  const saludPpal = c('A-1-13', 'Salud', { nombrePaqueteFact: 'Salud Beneficiario Principal' });
  const adicional = c('A-1-14', 'Salud', { nombrePaqueteFact: 'Salud Beneficiario Adicional' });
  const tlf = c('A-1-15', 'Telefonía');

  it('ordena asociados, Salud principal, NetUnoGO e Internet al final', () => {
    const orden = contratosParaBaja([internet, netunogo, premium, saludPpal, adicional, tlf], 9000001);
    expect(orden.map((x) => x.contrato)).toEqual([
      'A-1-12',
      'A-1-14',
      'A-1-15',
      'A-1-13',
      'A-1-11',
      'A-1-10',
    ]);
    expect(orden[0]).toEqual({ contrato: 'A-1-12', cuenta: '9000001', codMotDesc: MOTIVO_DESCONEXION });
  });

  it('sin Internet, NetUnoGO va al final', () => {
    expect(contratosParaBaja([netunogo, premium], '1').map((x) => x.contrato)).toEqual(['A-1-12', 'A-1-11']);
  });

  it('tipo de contrato y subproducto según el primero', () => {
    expect(tipoDeContrato([internet])).toBe('Principal');
    expect(tipoDeContrato([premium, internet])).toBe('Secundario');
    expect(tipoDeContrato([tlf])).toBe('Principal');
    expect(tipoDeContrato([])).toBeNull();
    expect(subProducto([internet])).toBe('FTTX');
    expect(subProducto([c('x', 'Internet', { tipoRed: 'HFC' })])).toBe('HFC');
    expect(subProducto([tlf])).toBe('--Ninguna--');
  });
});

describe('decidirBaja', () => {
  const hoy = '2026-11-05';
  const base = { empresa: false, contieneAprobacion: false, incluyeInternet: false, fecha: hoy, hoy };
  const sinRet = (equipo: EscenarioBaja['equipo']): EscenarioBaja => ({ retencion: false, equipo });
  const ret: EscenarioBaja = { retencion: true, equipo: 'No aplica' };

  it('Empresa: retención cerrada; si no, pendiente por aprobación', () => {
    expect(decidirBaja({ ...base, empresa: true, escenario: ret })).toEqual({
      estado: 'Cerrado',
      bajaInmediata: false,
      aprobacion: false,
    });
    expect(decidirBaja({ ...base, empresa: true, escenario: sinRet('No aplica') })).toEqual({
      estado: 'Pendiente por aprobación',
      bajaInmediata: false,
      aprobacion: true,
    });
  });

  it('Hogar sin Internet: paquetizado pide aprobación; si no, programa o desconecta', () => {
    expect(decidirBaja({ ...base, escenario: sinRet('No aplica'), contieneAprobacion: true }).estado).toBe(
      'Pendiente por aprobación',
    );
    expect(decidirBaja({ ...base, escenario: ret, contieneAprobacion: true }).estado).toBe('Cerrado');
    expect(decidirBaja({ ...base, escenario: sinRet('No aplica'), fecha: '2026-11-20' }).estado).toBe(
      'Desconexión programada',
    );
    expect(decidirBaja({ ...base, escenario: sinRet('No aplica') })).toEqual({
      estado: 'Cerrado',
      bajaInmediata: true,
      aprobacion: false,
    });
  });

  it('Hogar con Internet: no pide aprobación aunque haya paquetizados', () => {
    const conInternet = { ...base, incluyeInternet: true, contieneAprobacion: true };
    expect(decidirBaja({ ...conInternet, escenario: sinRet('Equipo propio') }).bajaInmediata).toBe(true);
    expect(
      decidirBaja({ ...conInternet, escenario: sinRet('Equipo propio'), fecha: '2026-12-01' }).estado,
    ).toBe('Desconexión programada');
    expect(decidirBaja({ ...conInternet, escenario: sinRet('Sin equipo propio'), fecha: null })).toEqual({
      estado: 'Cerrado',
      bajaInmediata: true,
      aprobacion: false,
    });
    expect(decidirBaja({ ...conInternet, escenario: ret }).estado).toBe('Cerrado');
  });

  it('textos del resultado', () => {
    expect(textoResultadoBaja(true, true)).toBe('Se ha registrado el resultado exitosamente. ¡Buen trabajo!');
    expect(textoResultadoBaja(false, true)).toBe('Se ha solicitado la aprobación para la Baja Voluntaria');
    expect(textoResultadoBaja(false, false)).toBe('Se ha procesado con éxito la Baja Voluntaria');
  });
});

describe('ticketBaja', () => {
  const registro = {
    id: 'R1',
    Nro_de_Cliente: '77',
    email: 'cli@example.com',
    Codigo_de_Celular: '0414',
    Tel_fono_Celular: '1234567',
    cf_tipo_documento: 'Cédula',
    cf_documento_de_identidad: '123',
    Clase_de_cliente: 'Residencial',
    contactTechnologyNames: 'Tec',
  };
  const base = {
    cuenta: { cuenta: '9000001', descTipoCliente: 'Hogar', descCiudad: 'Caracas' },
    registro,
    elegidos: [c('A-1-10', 'Internet', { tipoRed: 'FTTH' }), c('A-1-15', 'Telefonía')],
    departamentoId: 'ATC',
    contactoId: 'CO',
    cuentaDeskId: 'AC',
    agenteId: 'AG',
    equipoId: 'EQ',
    territorio: 'Región',
    hoy: '2026-11-05',
  };

  it('sin retención con equipo alquilado', () => {
    const t = ticketBaja({
      ...base,
      escenario: { retencion: false, equipo: 'Sin equipo propio' },
      formulario: {
        motivo: 'Mudanza',
        estrategia: '',
        serial: ' S1 ',
        fecha: '2026-11-05',
        comentarios: ' nota ',
      },
      decision: { estado: 'Cerrado', bajaInmediata: true, aprobacion: false },
    });
    expect(t).toMatchObject({
      subject: 'AB77 || CRM || Desconexión voluntaria',
      departmentId: 'ATC',
      contactId: 'CO',
      accountId: 'AC',
      assigneeId: 'AG',
      teamId: 'EQ',
      status: 'Cerrado',
      category: 'Desconexión voluntaria',
      subCategory: 'Mudanza',
      description: 'nota',
      email: 'cli@example.com',
      phone: '0414-1234567',
    });
    expect(t.cf).toMatchObject({
      cf_lista_de_seleccion_1: 'Baja ingresada',
      cf_contratos: 'Internet: A-1-10;Telefonía: A-1-15',
      cf_tipo_de_contrato: 'Principal',
      cf_sub_producto: 'FTTX',
      cf_fecha_de_desconexion: '2026-11-05',
      cf_alquiler_de_equipo: true,
      cf_serial_del_equipo: 'S1',
      cf_recepcion_de_equipo: true,
      cf_retencion: false,
      cf_estrategia_de_retencion: '',
      cf_operacion: 'Región',
      cf_nombre_de_persona_contacto: '',
    });
  });

  it('retención en Empresa: estrategia como descripción y contacto técnico', () => {
    const t = ticketBaja({
      ...base,
      agenteId: null,
      cuenta: { ...base.cuenta, descTipoCliente: 'Empresa' },
      escenario: { retencion: true, equipo: 'No aplica' },
      formulario: {
        motivo: 'Costo',
        estrategia: 'Descuento 3 meses',
        serial: '',
        fecha: '2026-11-30',
        comentarios: '',
      },
      decision: { estado: 'Cerrado', bajaInmediata: false, aprobacion: false },
    });
    expect(t).not.toHaveProperty('assigneeId');
    expect(t.subject).toBe('AB77 || CRM || Retención');
    expect(t.description).toBe('Descuento 3 meses');
    expect(t.cf).toMatchObject({
      cf_lista_de_seleccion_1: 'Retención exitosa',
      cf_retencion: true,
      cf_estrategia_de_retencion: 'Descuento 3 meses',
      cf_fecha_de_desconexion: '2026-11-05',
      cf_alquiler_de_equipo: false,
      cf_nombre_de_persona_contacto: 'Tec',
    });
  });
});

describe('utilidades', () => {
  it('nombreTerritorio prefiere el padre', () => {
    expect(nombreTerritorio({ data: { parent: { name: 'Región' }, territory: { name: 'Caracas' } } })).toBe(
      'Región',
    );
    expect(nombreTerritorio({ data: { territory: { name: 'Caracas' } } })).toBe('Caracas');
    expect(nombreTerritorio(null)).toBe('');
  });

  it('contratosDelEvento: los números de cada contrato, uno por línea', () => {
    expect(contratosDelEvento([{ codContrato: 'C-5000001' }, { codContrato: '123' }, {}])).toBe(
      '5000001\n123',
    );
  });
});
