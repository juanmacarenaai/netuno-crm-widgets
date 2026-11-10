import { describe, expect, it } from 'vitest';
import { normalizarPaquete, planActual, type Contrato, type Cuenta } from '@/shared/cuentas';
import {
  alternarServicio,
  beneficiariosAdicionales,
  combinarPaquetes,
  cuerpoActualizarPlan,
  elegibilidadCambioPlan,
  eventoCambioPlan,
  opcionPaquete,
  parametrosConsulta,
  puedeCambiarPlanEsteMes,
  reglaDowngrade,
  requiereAprobacion,
  resultadoActualizarPlan,
  serviciosElegibles,
  ticketDowngrade,
  ticketDowngradeExistente,
  type Beneficiario,
  type RespuestaActualizar,
} from './cambioPlan';

const internet = (id: string, nombrePaquete: string, extra: Partial<Contrato> = {}): Contrato => ({
  idProducto: id,
  codContrato: `C${id}`,
  cuenta: 1632236,
  nombreServicio: 'Internet',
  status: 'Conectado',
  tipoRed: 'FTTH',
  nombrePaquete,
  nombrePaqueteFact: `Fibranet ${nombrePaquete}`,
  ubicacionJSON: [{ ciudad: 'Caracas' }],
  ...extra,
});
const netunogo = (id: string, plan: string, correo: string): Contrato => ({
  idProducto: id,
  codContrato: `C${id}`,
  cuenta: 1632236,
  nombreServicio: 'Streaming',
  status: 'Conectado',
  nombrePaquete: plan,
  serial: correo,
});
const salud = (id: string, paquete: string, nombre: string | null): Contrato => ({
  idProducto: id,
  codContrato: `C${id}`,
  cuenta: 1632236,
  nombreServicio: 'Salud',
  status: 'Conectado',
  nombrePaquete: paquete,
  NombreAseg: nombre,
});
const cuentaBase = (contratos: Contrato[], extra: Partial<Cuenta> = {}): Cuenta => ({
  cuenta: '1632236',
  descTipoCliente: 'Hogar',
  codTipoCliente: 1,
  descStatusCuenta: 'Conectado',
  saldo: -1.02,
  descCiudad: 'Caracas',
  nodoNas: 'N1',
  documentoIdentificacion: 'V123',
  contratos,
  ...extra,
});

describe('puedeCambiarPlanEsteMes', () => {
  const ahora = new Date(2026, 9, 23, 10, 0); // 23-oct-2026 10:00 hora local

  it('permite el cambio si nunca cambió de plan', () => {
    expect(puedeCambiarPlanEsteMes(null, ahora)).toBe(true);
    expect(puedeCambiarPlanEsteMes(undefined, ahora)).toBe(true);
    expect(puedeCambiarPlanEsteMes('', ahora)).toBe(true);
  });

  it('bloquea si ya cambió en el mismo mes', () => {
    expect(puedeCambiarPlanEsteMes('2026-10-01T09:00:00', ahora)).toBe(false);
    expect(puedeCambiarPlanEsteMes('2026-10-01', ahora)).toBe(false);
  });

  it('permite si el último cambio fue otro mes o año', () => {
    expect(puedeCambiarPlanEsteMes('2026-09-30T23:00:00', ahora)).toBe(true);
    expect(puedeCambiarPlanEsteMes('2025-10-15T09:00:00', ahora)).toBe(true);
  });

  it('una fecha "AAAA-MM-DD" del día 1 no retrocede al mes anterior', () => {
    expect(puedeCambiarPlanEsteMes('2026-10-01', new Date(2026, 9, 1, 8, 0))).toBe(false);
  });

  it('el último día del mes de noche sigue siendo el mismo mes', () => {
    expect(puedeCambiarPlanEsteMes('2026-10-05T10:00:00', new Date(2026, 9, 31, 22, 0))).toBe(false);
  });

  it('una fecha ilegible no bloquea el cambio, igual que app/index.js', () => {
    expect(puedeCambiarPlanEsteMes('no-es-fecha', ahora)).toBe(true);
  });
});

describe('nombres de planes', () => {
  it.each([
    ['400Mb', '400 Megas'],
    ['10Gb', '10 Gigas'],
    ['600 mb', '600 Megas'],
    ['Beneficiario Adicional', 'Beneficiario'],
    ['NetUnoGO Plus 5', 'NetUnoGO Plus 5'],
    [null, null],
  ])('normalizarPaquete(%s) = %s', (entrada, salida) => expect(normalizarPaquete(entrada)).toBe(salida));

  it('plan actual del contrato', () => {
    expect(planActual({ nombrePaquete: 'Fibranet400_400Mb' })).toBe('400 Megas');
    expect(
      planActual({ nombrePaquete: 'Fibranet1Gb_500Mb', nombrePaqueteFact: 'Fibranet 1Gb/500 Megas' }),
    ).toBe('1Gb/500 Megas');
    expect(planActual({ nombrePaquete: 'NetUnoGO Plus 5' })).toBe('NetUnoGO Plus 5');
  });
});

describe('elegibilidad', () => {
  const contratos = [internet('1', 'Fibranet600_600Mb'), netunogo('2', 'NetUnoGO Plus 5', 'A@B.COM')];

  it('cuenta Hogar conectada, sin deuda y con servicios elegibles', () => {
    expect(elegibilidadCambioPlan(cuentaBase(contratos)).ok).toBe(true);
    expect(elegibilidadCambioPlan(cuentaBase(contratos, { saldo: 0 })).ok).toBe(true);
    expect(elegibilidadCambioPlan(cuentaBase(contratos, { saldo: '' })).ok).toBe(true);
  });

  it('cada causa con su mensaje', () => {
    expect(elegibilidadCambioPlan(cuentaBase(contratos, { codTipoCliente: 2 })).motivo).toBe('empresa');
    expect(elegibilidadCambioPlan(cuentaBase(contratos, { descStatusCuenta: 'Suspendido' })).motivo).toBe(
      'desconectada',
    );
    expect(elegibilidadCambioPlan(cuentaBase(contratos, { saldo: 56 })).mensaje).toMatch(/saldo 56/);
    expect(elegibilidadCambioPlan(cuentaBase(contratos, { saldo: null })).motivo).toBe('saldo');
    expect(elegibilidadCambioPlan(cuentaBase([internet('1', 'X', { tipoRed: 'HFC' })])).motivo).toBe(
      'sin-servicios',
    );
  });

  it('servicios elegibles: Internet FTTH y NetUnoGO conectados, en ese orden', () => {
    const s = serviciosElegibles(
      cuentaBase([
        netunogo('2', 'NetUnoGO Plus 5', 'A@B.COM'),
        internet('1', 'Fibranet600_600Mb'),
        netunogo('3', 'Hot Pack', 'x'),
        internet('4', 'Fibranet800_800Mb', { status: 'Suspendido' }),
      ]),
    );
    expect(s.map((x) => [x.servicio, x.plan, x.detalle])).toEqual([
      ['Internet', '600 Megas', 'Fibranet Fibranet600_600Mb'],
      ['Streaming', 'NetUnoGO Plus 5', 'a@b.com'],
    ]);
  });
});

describe('selección del plan a cambiar (dependencyServicesCP)', () => {
  const servicios = [
    { servicio: 'Internet', plan: '600 Megas', detalle: 'f600' },
    { servicio: 'Internet', plan: '800 Megas', detalle: 'f800' },
    { servicio: 'Streaming', plan: 'NetUnoGO Plus 5', detalle: 'a@b.com' },
    { servicio: 'Streaming', plan: 'Hot Pack', detalle: 'a@b.com' },
    { servicio: 'Streaming', plan: 'Otro', detalle: 'c@d.com' },
  ];

  it('Internet deja un solo servicio marcado', () => {
    let r = alternarServicio(servicios, [false, false, true, true, true], 0);
    expect(r.marcados).toEqual([true, false, false, false, false]);
    r = alternarServicio(servicios, r.marcados, 1);
    expect(r.marcados).toEqual([false, true, false, false, false]);
    expect(alternarServicio(servicios, r.marcados, 1).marcados).toEqual([false, false, false, false, false]);
  });

  it('NetUnoGO arrastra los Streaming del mismo correo y desmarca el resto', () => {
    const r = alternarServicio(servicios, [true, false, false, false, true], 2);
    expect(r.marcados).toEqual([false, false, true, true, false]);
    expect(r.arrastrados).toEqual([false, false, false, true, false]);
    expect(alternarServicio(servicios, r.marcados, 2).marcados).toEqual([false, false, false, false, false]);
  });
});

describe('paquetes', () => {
  it('parámetros de consulta por servicio y tipo', () => {
    expect(parametrosConsulta({ servicio: 'Internet', cuenta: 1, codContrato: 'C1' }, 'U')).toEqual({
      cuenta: 1,
      contrato: 'C1',
      servicio: 2,
      tipoPaquete: 1,
      orderPaq: 1,
    });
    expect(parametrosConsulta({ servicio: 'Streaming', cuenta: 1, codContrato: 'C2' }, 'D')).toEqual({
      cuenta: 1,
      contrato: 'C2',
      servicio: 6,
      tipoPaquete: 2,
      orderPaq: 2,
    });
    expect(parametrosConsulta({ servicio: 'Salud', cuenta: 1, codContrato: 'C3' }, 'U')).toBeNull();
  });

  it('Internet: total de conceptos (redondeado) y resumen sin repetidos', () => {
    const o = opcionPaquete(
      {
        Codigo: 77,
        Paquete: 'Fibranet800_800Mb',
        Precio: [{ precio: '20.1' }, { precio: 0.2 }],
        ComboDetalle: [
          { NbrFacturacion: 'Internet' },
          { NbrFacturacion: 'Salud' },
          { NbrFacturacion: 'Internet' },
        ],
      },
      'U',
      'Internet',
    );
    expect(o).toEqual({
      codigo: '77',
      nombre: '800 Megas',
      precio: '$20.3',
      resumen: 'Internet | Salud',
      tipoCambio: 'U',
    });
  });

  it('Streaming: primer precio con su moneda', () => {
    expect(
      opcionPaquete(
        {
          Codigo: 9,
          Paquete: 'NetUnoGO Plus 3',
          Precio: [{ Moneda: '$', Precio: 8 }],
          NbrFacturacion: '3 pantallas',
        },
        'D',
        'Streaming',
      ),
    ).toEqual({
      codigo: '9',
      nombre: 'NetUnoGO Plus 3',
      precio: '$8',
      resumen: '3 pantallas',
      tipoCambio: 'D',
    });
  });

  it('combina upgrades y downgrades y detecta un cambio este mes', () => {
    const ahora = new Date(2026, 9, 30);
    const up = { ultFechaCambPaq: null, mensualidad: [{ Codigo: 1, Paquete: 'A_800Mb', Precio: [] }] };
    const down = {
      ultFechaCambPaq: '2026-09-15T10:00:00',
      mensualidad: [{ Codigo: 2, Paquete: 'A_400Mb', Precio: [] }],
    };
    const r = combinarPaquetes(up, down, 'Internet', ahora);
    expect(r.opciones.map((o) => [o.nombre, o.tipoCambio])).toEqual([
      ['800 Megas', 'U'],
      ['400 Megas', 'D'],
    ]);
    expect(r.cambioEsteMes).toBe(false);
    expect(
      combinarPaquetes(up, { ...down, ultFechaCambPaq: '2026-10-02T10:00:00' }, 'Internet', ahora)
        .cambioEsteMes,
    ).toBe(true);
    expect(combinarPaquetes(null, undefined, 'Internet', ahora)).toEqual({
      opciones: [],
      cambioEsteMes: false,
    });
  });
});

describe('reglas de downgrade', () => {
  const adicionales = (n: number) => Array.from({ length: n }, (_, i) => ({ contrato: `S${i}` }));
  const regla = (nuevo: string, anterior: string, n: number) =>
    reglaDowngrade({ servicio: 'Internet', nuevo, anterior, adicionales: adicionales(n) });

  // Cada rama del switch de continueCambioPlanSelect: [nuevo, anterior, adicionales, excluir esperado, aprobación]
  it.each([
    ['400 Megas', '600 Megas', 2, 1, false],
    ['400 Megas', '600 Megas', 1, 0, false],
    ['400 Megas', '500 Megas', 1, 0, false],
    ['400 Megas', '800 Megas', 4, 3, true],
    ['400 Megas', '800 Megas', 3, 2, true],
    ['400 Megas', '1Gb/500 Megas', 2, 1, true],
    ['400 Megas', '1Gb/500 Megas', 1, 0, true],
    ['500 Megas', '800 Megas', 4, 3, false],
    ['500 Megas', '800 Megas', 3, 2, false],
    ['500 Megas', '800 Megas', 1, 0, false],
    ['500 Megas', '1Gb/500 Megas', 2, 1, true],
    ['500 Megas', '600 Megas', 2, 1, false],
    ['600 Megas', '800 Megas', 4, 2, false],
    ['600 Megas', '1Gb/500 Megas', 3, 1, false],
    ['600 Megas', '800 Megas', 2, 0, false],
    ['800 Megas', '1Gb/500 Megas', 4, 0, false],
  ] as const)(
    '%s desde %s con %i adicionales: excluir %i, aprobación %s',
    (nuevo, anterior, n, excluir, aprobacion) => {
      expect(regla(nuevo, anterior, n)).toMatchObject({ excluir, aprobacion });
    },
  );

  it('100 Megas: elimina Salud, excluye todos sin elegir y va a aprobación', () => {
    expect(regla('100 Megas', '400 Megas', 3)).toMatchObject({
      eliminaSalud: true,
      excluir: 3,
      elegir: false,
      aprobacion: true,
    });
    expect(regla('100 Megas', '400 Megas', 0)).toMatchObject({ excluir: 0, elegir: false, aprobacion: true });
  });

  it('elegir solo cuando se excluye una parte', () => {
    expect(regla('400 Megas', '800 Megas', 4).elegir).toBe(true);
    expect(regla('400 Megas', '600 Megas', 1).elegir).toBe(false);
  });

  it('Streaming: pantallas que se pierden', () => {
    expect(
      reglaDowngrade({ servicio: 'Streaming', nuevo: 'NetUnoGO Plus 3', anterior: 'NetUnoGO Plus 5' }),
    ).toMatchObject({ pantallasMenos: 2, aprobacion: false, excluir: 0 });
    expect(
      reglaDowngrade({ servicio: 'Streaming', nuevo: 'NetUnoGO Basico', anterior: 'NetUnoGO Plus 4' })
        .pantallasMenos,
    ).toBeNull();
  });

  it('aprobación desde cualquier plan solo para 100 Megas', () => {
    expect(requiereAprobacion('100 Megas', 'lo que sea')).toBe(true);
    expect(requiereAprobacion('400 Megas', '600 Megas')).toBe(false);
  });

  it('beneficiarios adicionales conectados', () => {
    const cuenta = cuentaBase([
      salud('10', 'Beneficiario Ppal', 'Ana'),
      salud('11', 'Beneficiario Adicional', ' Luis Perez '),
      salud('12', 'Beneficiario Adicional', null),
      { ...salud('13', 'Beneficiario Adicional', 'X'), status: 'Suspendido' },
    ]);
    expect(beneficiariosAdicionales(cuenta)).toEqual([
      { contrato: '11', cuenta: '1632236', nombre: 'Luis Perez' },
      { contrato: '12', cuenta: '1632236', nombre: 'Sin Nombre' },
    ]);
  });
});

describe('ticket de downgrade', () => {
  const registro = {
    id: 'R1',
    cf_documento_de_identidad: '123',
    cf_tipo_documento: 'Cédula',
    Account_Name: 'Ana Pérez',
    email: 'a@b.com',
    Segmentaci_n: 'Masivo',
    Clase_de_cliente: 'Residencial',
  };
  const usuario = { id: 'U1', nombre: 'Agente', email: 'agente@netuno.net' };
  const desk = { departamentos: { atc: 'ATC', ave: 'AVE' }, productos: { Internet: 'PI', Streaming: null } };
  const servicioElegido = { servicio: 'Internet', plan: '800 Megas', cuenta: 1632236, codContrato: 'C1' };
  const adicionales: Beneficiario[] = [
    { contrato: '11', cuenta: '1632236', nombre: 'Luis' },
    { contrato: '12', cuenta: '1632236', nombre: 'Rosa' },
  ];
  const opcion = { codigo: '400', nombre: '400 Megas' };

  it('con aprobación: Servicio al Cliente, "Pendiente por aprobación" y beneficiarios excluidos', () => {
    const excluidos = adicionales.slice(1);
    const { parametros, departamento } = ticketDowngrade({
      seleccion: { servicioElegido, opcion, excluidos, adicionales, regla: { aprobacion: true } },
      cuenta: cuentaBase([]),
      registro,
      usuario,
      contactoId: 'K1',
      desk,
    });
    const cf = parametros.cf as Record<string, string | null>;
    expect(departamento).toBe('Servicio al Cliente');
    expect(parametros).toMatchObject({
      departmentId: 'ATC',
      status: 'Pendiente por aprobación',
      productId: 'PI',
      contactId: 'K1',
      subject: 'Downgrade|Doc.Identidad: 123|CRM|Cuenta: 1632236',
    });
    expect(cf.cf_downgrade_salud).toBe(
      JSON.stringify([{ contrato: '12', cuenta: '1632236', codMotDesc: 18 }]),
    );
    expect(cf.cf_contratos).toBe('Salud: 12');
    expect(JSON.parse(cf.cf_downgrade_plan ?? '')).toEqual({
      cedularif: '123',
      cuenta: 1632236,
      contrato: 'C1',
      servicio: '2',
      codPaquete: '400',
      usuarioCambPaq: 'agente',
    });
    expect(parametros.description).toBe(
      'Downgrade:<br>Doc.Identidad: 123<br>Nombre: Ana Pérez<br>Paquete Nuevo: 400 Megas<br>Paquete Anterior: 800 Megas<br>Beneficiarios Asociados: Luis - 11 - 1632236 , Rosa - 12 - 1632236<br>Contrato(s)Beneficiarios a Excluir: 12',
    );
  });

  it('sin aprobación ni beneficiarios; Streaming sin producto configurado', () => {
    const { parametros } = ticketDowngrade({
      seleccion: {
        servicioElegido: { ...servicioElegido, servicio: 'Streaming' },
        opcion,
        excluidos: [],
        adicionales: [],
        regla: { aprobacion: false },
      },
      cuenta: cuentaBase([]),
      registro,
      usuario,
      contactoId: 'K1',
      desk,
    });
    const cf = parametros.cf as Record<string, string | null>;
    expect(parametros).toMatchObject({ departmentId: 'AVE', status: 'Downgrade programado' });
    expect(parametros.productId).toBeUndefined();
    expect(cf.cf_downgrade_salud).toBeNull();
    expect(JSON.parse(cf.cf_downgrade_plan ?? '').servicio).toBe('6');
  });

  it('detecta un downgrade ya programado', () => {
    expect(
      ticketDowngradeExistente([
        { status: 'Abierto', subCategory: 'Cambio de plan - Downgrade' },
        { status: 'Downgrade programado', subCategory: 'Cambio de plan - Downgrade', ticketNumber: '9' },
      ])?.ticketNumber,
    ).toBe('9');
    expect(ticketDowngradeExistente([])).toBeNull();
  });
});

describe('upgrade y evento', () => {
  const servicioElegido = {
    servicio: 'Internet',
    plan: '600 Megas',
    cuenta: 1632236,
    codContrato: 'C1',
    contrato: { ubicacionJSON: [{ ciudad: 'Caracas' }] },
  };
  const opcion = { codigo: '800', nombre: '800 Megas' };

  it('cuerpo de /cambio/paquete/actualizar', () => {
    expect(
      cuerpoActualizarPlan({
        cuenta: cuentaBase([]),
        servicioElegido,
        opcion,
        usuario: { email: 'agente@x.com' },
      }),
    ).toEqual({
      cedularif: 'V123',
      cuenta: 1632236,
      contrato: 'C1',
      servicio: 2,
      codPaquete: '800',
      usuarioCambPaq: 'agente',
    });
  });

  it.each<[RespuestaActualizar | null, string]>([
    [{ codigo: 0 }, 'ok'],
    [{ code: 0 }, 'ok'],
    [{ codigo: 2, mensaje: 'En proceso' }, 'aviso'],
    [{ status: 412 }, 'periodo'],
    [{ descripcion: 'Falló' }, 'error'],
    [null, 'error'],
  ])('resultado %j → %s', (datos, estado) => {
    expect(resultadoActualizarPlan(datos, opcion, servicioElegido).estado).toBe(estado);
  });

  it('evento con plan nuevo y anterior', () => {
    const e = eventoCambioPlan({
      canal: 'Chat',
      cuenta: cuentaBase([]),
      servicioElegido,
      opcion,
      historial: 'Contrato: C1. Exitoso.',
      registro: { id: 'R1', Negocio: 'Hogar', cf_tipo_documento: 'Cédula', Nro_de_Cliente: '77' },
      documento: '123',
      usuario: { id: 'U1', nombre: 'Agente' },
      fecha: new Date(Date.UTC(2026, 9, 30, 12)),
    });
    expect(e).toMatchObject({
      Canal: 'Chat',
      Cuenta: '1632236',
      Contrato: 'C1',
      Ciudad: 'Caracas',
      Fecha: '2026-10-30',
      Registro: 'Modificación',
      Subtipo_de_registro: 'Cambio de plan (upgrade)',
      Plan_nuevo: '800 Megas',
      Plan_anterior: '600 Megas',
      Producto: 'Internet',
      Account_Name: 'R1',
      Nro_Documento: '123',
      Owner: 'U1',
    });
    expect(e.Descripci_n).toBe('Resultado de cambio de plan. Datos enviados: Contrato: C1. Exitoso.');
  });
});
