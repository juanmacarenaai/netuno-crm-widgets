import { describe, expect, it } from 'vitest';
import { sentenciaReporte } from '@/services/soporte.api';
import {
  coberturaDelServicio,
  datosTicketPadre,
  diagnosticoLos,
  estadoPotencia,
  fechaHoraReporte,
  hayPosibleEventoMasivo,
  ipAsignada,
  reporteFalla,
  textoValorOptico,
  ticketHijoMasivo,
} from './troubleshooting';

const boss = {
  idProducto: 'X-1-500',
  codContrato: '500',
  nombreServicio: 'Internet',
  nombrePaquete: 'Fibranet600_600Mb',
  tipoRed: 'FTTH',
  serial: 'SER1',
  alquilerEquipo: 'NO',
  fechaInstalacion: '02/03/2024 10:00',
  ubicacion: [{ estado: 'Lara', ciudad: 'Barquisimeto', municipio: '', calle: 'Calle 5' }],
};

describe('evento masivo', () => {
  it('cobertura: red FTTX, "-" en los datos vacíos y el nodo de la cuenta', () => {
    expect(coberturaDelServicio(boss, { descNodo: 'N1' })).toEqual({
      serviceType: 'Internet',
      networkType: 'FTTX',
      location: {
        state: 'Lara',
        city: 'Barquisimeto',
        municipality: '-',
        parish: '-',
        urbanization: '-',
        avenueStreet: '-',
        street: 'Calle 5',
        building: '-',
        node: 'N1',
      },
    });
    expect(coberturaDelServicio({ tipoRed: null }, {}).networkType).toBe('Sin datos');
  });

  it('ticket hijo con los datos del padre, del contrato y de NAS', () => {
    const t = ticketHijoMasivo({
      padre: {
        id: 'P1',
        departmentId: 'D1',
        category: 'Falla',
        subCategory: 'Sin servicio',
        description: 'Corte',
      },
      boss,
      cuenta: { descTipoCliente: 'Hogar' },
      registro: { Nro_de_Cliente: '77', email: 'c@x.com', Codigo_de_Celular: '0414', Tel_fono_Celular: '1' },
      contactoId: 'CO',
      cuentaDeskId: 'AC',
      productoInternet: 'PI',
      nas: { tarjeta: '3', ip: null },
      potencia: '-20',
      territorio: 'Región',
    });
    expect(t).toMatchObject({
      subject: 'AB77 || CRM || Asociado a Evento Masivo',
      departmentId: 'D1',
      contactId: 'CO',
      accountId: 'AC',
      productId: 'PI',
      status: 'Evento masivo',
      category: 'Falla',
      subCategory: 'Sin servicio',
      description: 'Corte',
      phone: '0414-1',
    });
    expect(t.cf).toMatchObject({
      cf_ticket_padre_relacionado: 'P1',
      cf_id_producto: '500',
      cf_contrato_completo: 'X-1-500',
      cf_sub_producto: 'FTTX',
      cf_fecha_instalacion: '2024-03-02',
      cf_alquiler_de_equipo: false,
      cf_numero_de_tarjeta: '3',
      cf_puerto: null,
      cf_direccion_ip: 'Sin datos',
      cf_potencia_nas: '-20',
      cf_operacion: 'Región',
      cf_nombre_de_persona_contacto: '',
    });
  });

  it('datos del ticket padre: fechas, afectación y tiempo total', () => {
    const datos = datosTicketPadre({
      department: { name: 'NOC' },
      createdTime: '2026-11-05T13:10:00.000Z',
      cf: {
        cf_afectacion_de_servicio: false,
        cf_fecha_y_hora_inicio_afectacion: '2026-11-05T13:00:00.000Z',
        cf_fecha_y_hora_fin_afectacion: '2026-11-05T14:30:00.000Z',
      },
    });
    const valor = (etiqueta: string) => datos.find((d) => d.etiqueta === etiqueta)?.valor;
    expect(valor('Departamento')).toBe('NOC');
    expect(valor('Fecha')).toBe('05/11/2026');
    expect(valor('Afectación del servicio')).toBe('No');
    expect(valor('Tiempo total')).toBe('90 min');
    expect(valor('Fecha y hora de inicio')).toMatch(/^05\/11\/2026 /);
    expect(valor('Nodo')).toBe('Sin datos');
    expect(datosTicketPadre({}).find((d) => d.etiqueta === 'Tiempo total')?.valor).toBe('Sin datos');
  });

  it('posible evento masivo solo con code 1001', () => {
    expect(hayPosibleEventoMasivo({ code: 1001 })).toBe(true);
    expect(hayPosibleEventoMasivo({ code: '1001' })).toBe(true);
    expect(hayPosibleEventoMasivo({ code: 1002 })).toBe(false);
    expect(hayPosibleEventoMasivo({})).toBe(false);
    expect(hayPosibleEventoMasivo(null)).toBe(false);
  });
});

describe('reporte de falla (node-red)', () => {
  it('arma el reporte con los datos de la cuenta y del contrato', () => {
    const r = reporteFalla(
      { cuenta: 9000001, descNodo: 'N1', codNodo: 101, descCiudad: 'Caracas' },
      { codContrato: '500' },
      new Date(2026, 10, 5, 9, 7, 3),
    );
    expect(r).toEqual({
      fechaHora: '2026-11-05T09:07:03',
      nroCuenta: '9000001',
      codNodo: '101',
      nodoCatastro: 'N1',
      nodoNas: 'N1',
      cuentaValida: '9000001',
      nroContrato: '500',
      ciudad: 'Caracas',
      ordinal: 'false',
      reporteFallasId: 'Sin conexión',
      reporteFallasName: 'Sin conexión a internet',
    });
    expect(fechaHoraReporte(new Date(2026, 0, 2, 3, 4, 5))).toBe('2026-01-02T03:04:05');
  });

  it('sentencia INSERT con valores entre comillas y escapados', () => {
    const sentencia = sentenciaReporte({
      ...reporteFalla(
        { cuenta: 1, descNodo: 'N"1', codNodo: 2, descCiudad: 'C' },
        { codContrato: '9' },
        new Date(2026, 0, 1),
      ),
    });
    expect(sentencia).toContain(
      'INSERT INTO eventos (fechaHora,timeStamp,sessionId,channelType,nroCuenta,codNodo,nodoCatastro,nodoNas,cuentaValida,nroContrato,ciudad,mensaje,ordinal,reporteFallasId,reporteFallasName)',
    );
    expect(sentencia).toContain(
      'VALUES("2026-01-01T00:00:00","No apica","No apica","CRM","1","2","N\\"1","N\\"1","1","9","C","No apica","false","Sin conexión","Sin conexión a internet")',
    );
  });
});

describe('valores ópticos', () => {
  it('estatus 1/0 y valores faltantes', () => {
    expect(textoValorOptico('estatus', { estatus: '1' })).toBe('Conectado');
    expect(textoValorOptico('estatus', { estatus: '0' })).toBe('Desconectado');
    expect(textoValorOptico('potencia', { potencia: '-19.5' })).toBe('-19.5');
    expect(textoValorOptico('conexion', {})).toBe('Sin datos');
    expect(textoValorOptico('conexion', null)).toBe('Sin datos');
  });

  it('IP asignada y potencia según la tecnología', () => {
    expect(ipAsignada({ conexion: 'IP Asignada' })).toBe(true);
    expect(ipAsignada({ conexion: 'Sin IP' })).toBe(false);
    expect(estadoPotencia('31', { potencia: '-19.5' })).toBe('ok');
    expect(estadoPotencia('31', { potencia: '-31' })).toBe('falla');
    expect(estadoPotencia('99', { potencia: '-19' })).toBe('neutro');
  });

  it('diagnóstico de LOS', () => {
    expect(diagnosticoLos('31', { potencia: -35 })).toEqual({
      estado: 'falla',
      mensaje: 'Sin potencia óptica. Requiere visita técnica.',
    });
    expect(diagnosticoLos('31', { potencia: -20 }).mensaje).toBe('Valores óptimos. ¿Desea crear el ticket?');
    expect(diagnosticoLos(null, { potencia: -20 }).mensaje).toBe(
      'No se logró obtener los datos de valores. ¿Desea crear el ticket?',
    );
  });
});
