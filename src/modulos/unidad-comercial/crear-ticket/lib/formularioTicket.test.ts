import { describe, expect, it } from 'vitest';
import type { DisenoTicketsDesk } from '@/services/desk.api';
import type { Contrato } from '@/shared/cuentas';
import {
  fechaInstalacion,
  htmlVacio,
  mensajeTicketExistente,
  NINGUNA,
  opcionesSubcategoria,
  parametrosTicket,
  seccionesDelDiseno,
  seccionVisible,
  subProductoDesk,
  valoresAutomaticos,
  valoresIniciales,
  valorVacio,
  type CampoTicket,
  type ContextoTicket,
} from './formularioTicket';
import { archivoDesdeDataUrl, imagenesPegadas, nombreArchivo, subirImagenesPegadas } from './imagenes';

const campo = (api: string, type: string, extra: Record<string, unknown> = {}) => ({
  apiName: api,
  i18NLabel: api,
  type,
  isMandatory: false,
  ...extra,
});

const diseno: DisenoTicketsDesk = {
  sections: [
    {
      i18NLabel: 'Información del ticket',
      fields: [
        campo('departmentId', 'LookUp', { isMandatory: true }),
        campo('accountId', 'LookUp'),
        campo('subject', 'Text'),
        campo('description', 'Textarea'),
        campo('category', 'Picklist', {
          isMandatory: true,
          allowedValues: [NINGUNA, 'Falla', 'Facturación'],
          defaultValue: NINGUNA,
        }),
        campo('subCategory', 'Picklist', { isMandatory: true, allowedValues: [NINGUNA] }),
        campo('channel', 'Picklist', { allowedValues: ['Teléfono', 'Interno'] }),
        campo('raro', 'Signature'),
      ],
    },
    {
      i18NLabel: 'Datos',
      fields: [
        campo('cf_documento_de_identidad', 'Text'),
        campo('cf_alquiler_de_equipo', 'Boolean'),
        campo('cf_etiquetas', 'Multiselect', { allowedValues: ['A', 'B'] }),
        campo('cf_hora', 'DateTime'),
        campo('cf_serial_del_equipo', 'Text'),
      ],
    },
    { i18NLabel: 'RCJ', fields: [campo('cf_nombre_de_persona_contacto', 'Text', { isMandatory: true })] },
    { i18NLabel: 'Información Visita Técnica', fields: [campo('cf_visita', 'Date', { isMandatory: true })] },
  ],
};

describe('seccionesDelDiseno', () => {
  const secciones = seccionesDelDiseno(diseno);

  it('omite el departamento y los tipos no soportados; el asunto es obligatorio', () => {
    const apis = secciones[0]?.campos.map((c) => c.api);
    expect(apis).toEqual(['accountId', 'subject', 'description', 'category', 'subCategory', 'channel']);
    expect(secciones[0]?.campos.find((c) => c.api === 'subject')).toMatchObject({
      etiqueta: 'Asunto',
      obligatorio: true,
    });
  });

  it('marca las secciones ocultas y RCJ', () => {
    expect(secciones.map((s) => [s.nombre, s.oculta, s.soloNoHogar])).toEqual([
      ['Información del ticket', false, false],
      ['Datos', false, false],
      ['RCJ', false, true],
      ['Información Visita Técnica', true, false],
    ]);
    expect(seccionVisible(secciones[2]!, 'Hogar')).toBe(false);
    expect(seccionVisible(secciones[2]!, 'Empresa')).toBe(true);
    expect(seccionVisible(secciones[3]!, 'Empresa')).toBe(false);
  });

  it('sin diseño no hay secciones', () => {
    expect(seccionesDelDiseno(null)).toEqual([]);
  });
});

describe('valores', () => {
  const c = (tipo: CampoTicket['tipo'], extra: Partial<CampoTicket> = {}): CampoTicket => ({
    api: 'x',
    etiqueta: 'X',
    tipo,
    obligatorio: false,
    opciones: [],
    defecto: null,
    ...extra,
  });

  it('valor vacío por tipo; Picklist con valor por defecto o la primera opción', () => {
    expect(valorVacio(c('Boolean'))).toBe(false);
    expect(valorVacio(c('Multiselect'))).toEqual([]);
    expect(valorVacio(c('Text'))).toBe('');
    expect(valorVacio(c('Picklist', { opciones: ['A', 'B'], defecto: 'B' }))).toBe('B');
    expect(valorVacio(c('Picklist', { opciones: ['A', 'B'], defecto: 'Z' }))).toBe('A');
  });

  it('fechaInstalacion y subProductoDesk', () => {
    expect(fechaInstalacion('22/02/2022 10:30')).toBe('2022-02-22');
    expect(fechaInstalacion('2/3/2024')).toBe('2024-03-02');
    expect(fechaInstalacion(null)).toBe('');
    expect(subProductoDesk('FTTO')).toBe('FTTX');
    expect(subProductoDesk('HFC')).toBe('HFC');
    expect(subProductoDesk(undefined)).toBe(NINGUNA);
  });

  const servicio: Contrato = {
    idProducto: 'X-1-500',
    nombreServicio: 'Internet',
    nombrePaquete: 'Fibranet600_600Mb',
    tipoRed: 'FTTH',
    serial: 'SER1',
    nodo: 'NODO1',
    fechaInstalacion: '01/02/2023 08:00',
  };
  const contexto: ContextoTicket = {
    cuenta: { cuenta: '9000001', descTipoCliente: 'Empresa' },
    servicio,
    registro: {
      id: 'R1',
      cf_tipo_documento: 'Cédula',
      cf_documento_de_identidad: '123',
      Nro_de_Cliente: '77',
      email: 'cli@example.com',
      Codigo_de_Celular: '0414',
      Tel_fono_Celular: '1234567',
      contactTechnologyNames: 'Técnico',
    },
    boss: {
      ubicacion: [{ ciudad: 'Valencia', calle: 'Calle 2' }],
      alquilerEquipo: 'SI',
      coordenadasGps: '10,-66',
    },
    departamento: 'Operaciones',
    territorio: 'Región Centro',
    producto: { valor: 'P1', etiqueta: 'Internet' },
    nas: { tarjeta: '3', puerto: '7', ip: '10.0.0.1', idont: '12' },
    potencia: '-19.5',
  };
  const campos = (apis: [string, CampoTicket['tipo']][]) => apis.map(([api, tipo]) => c(tipo, { api }));

  it('solo devuelve campos del diseño; booleanos como booleanos', () => {
    const v = valoresAutomaticos(
      campos([
        ['cf_documento_de_identidad', 'Text'],
        ['cf_ciudad', 'Text'],
        ['cf_calle', 'Text'],
        ['cf_operacion', 'Text'],
        ['cf_id_producto', 'Text'],
        ['cf_sub_producto', 'Picklist'],
        ['cf_serial_del_equipo', 'Text'],
        ['cf_potencia_nas', 'Text'],
        ['cf_correo_electronico_netuno_go', 'Text'],
        ['cf_alquiler_de_equipo', 'Boolean'],
        ['cf_fecha_instalacion', 'Date'],
        ['cf_nombre_de_persona_contacto', 'Text'],
        ['productId', 'LookUp'],
        ['channel', 'Picklist'],
        ['status', 'Picklist'],
      ]),
      contexto,
    );
    expect(v).toEqual({
      cf_documento_de_identidad: '123',
      cf_ciudad: 'Valencia',
      cf_calle: 'Calle 2',
      cf_operacion: 'Región Centro',
      cf_id_producto: '500',
      cf_sub_producto: 'FTTX',
      cf_serial_del_equipo: 'SER1',
      cf_potencia_nas: '-19.5',
      cf_correo_electronico_netuno_go: 'No aplica',
      cf_alquiler_de_equipo: true,
      cf_fecha_instalacion: '2023-02-01',
      cf_nombre_de_persona_contacto: 'Técnico',
      productId: 'P1',
      channel: 'Interno',
      status: 'Nuevo',
    });
  });

  it('fuera de Operaciones/NOC no carga datos técnicos', () => {
    const v = valoresAutomaticos(
      campos([
        ['cf_serial_del_equipo', 'Text'],
        ['cf_id_producto', 'Text'],
      ]),
      {
        ...contexto,
        departamento: 'Servicio al cliente',
      },
    );
    expect(v).toEqual({ cf_id_producto: '500' });
  });

  it('valoresIniciales: cuenta, contacto, correo, teléfono y primera subcategoría', () => {
    const secciones = seccionesDelDiseno({
      sections: [
        {
          fields: [
            campo('departmentId', 'LookUp'),
            campo('accountId', 'LookUp'),
            campo('contactId', 'LookUp'),
            campo('email', 'Email'),
            campo('phone', 'Phone'),
            campo('category', 'Picklist', { allowedValues: ['Falla'] }),
            campo('subCategory', 'Picklist', { allowedValues: [NINGUNA] }),
          ],
        },
      ],
    });
    const v = valoresIniciales(
      secciones,
      { ...contexto, producto: null },
      { cuenta: { valor: 'AC', etiqueta: '9000001' }, contacto: { valor: 'CO', etiqueta: 'Cliente' } },
      { Falla: ['Lentitud', 'Sin servicio'] },
    );
    expect(v).toEqual({
      accountId: 'AC',
      contactId: 'CO',
      email: 'cli@example.com',
      phone: '0414-1234567',
      category: 'Falla',
      subCategory: 'Lentitud',
    });
    expect(opcionesSubcategoria({ Falla: ['L'] }, 'Falla', { opciones: ['X'] })).toEqual(['L']);
    expect(opcionesSubcategoria({}, 'Otra', { opciones: ['X'] })).toEqual(['X']);
  });
});

describe('parametrosTicket', () => {
  const secciones = seccionesDelDiseno(diseno);

  it('exige los obligatorios de las secciones visibles', () => {
    const { errores } = parametrosTicket(
      secciones,
      { category: NINGUNA, subCategory: '', subject: ' ', description: '<div><br></div>' },
      'D1',
      'Empresa',
    );
    expect(Object.keys(errores).sort()).toEqual([
      'category',
      'cf_nombre_de_persona_contacto',
      'subCategory',
      'subject',
    ]);
    expect(errores.subject).toBe('Asunto no puede estar en blanco');
  });

  it('RCJ no se exige a Hogar; las secciones ocultas no se exigen', () => {
    const { errores } = parametrosTicket(
      secciones,
      { category: 'Falla', subCategory: 'Lentitud', subject: 'Sin internet' },
      'D1',
      'Hogar',
    );
    expect(errores).toEqual({});
  });

  it('arma raíz y cf: multiselect con ";", DateTime en ISO, booleanos siempre, vacíos fuera', () => {
    const { parametros } = parametrosTicket(
      secciones,
      {
        accountId: 'AC',
        subject: ' Sin internet ',
        description: '<p>Hola <img src="https://x/y.png"></p>',
        category: 'Falla',
        subCategory: 'Lentitud',
        channel: 'Interno',
        cf_documento_de_identidad: '123',
        cf_alquiler_de_equipo: false,
        cf_etiquetas: ['A', 'B'],
        cf_hora: '2026-11-05T10:30',
        cf_serial_del_equipo: '',
      },
      'D1',
      'Hogar',
    );
    expect(parametros).toEqual({
      departmentId: 'D1',
      accountId: 'AC',
      subject: 'Sin internet',
      description: '<p>Hola <img src="https://x/y.png"></p>',
      category: 'Falla',
      subCategory: 'Lentitud',
      channel: 'Interno',
      cf: {
        cf_documento_de_identidad: '123',
        cf_alquiler_de_equipo: false,
        cf_etiquetas: 'A;B',
        cf_hora: new Date('2026-11-05T10:30').toISOString(),
      },
    });
  });

  it('un booleano obligatorio debe estar marcado (como el widget jQuery)', () => {
    const conCheck = seccionesDelDiseno({
      sections: [
        { fields: [campo('departmentId', 'LookUp'), campo('cf_ok', 'Boolean', { isMandatory: true })] },
      ],
    });
    expect(parametrosTicket(conCheck, { cf_ok: false }, 'D', 'Hogar').errores).toEqual({
      cf_ok: 'cf_ok no puede estar en blanco',
    });
  });

  it('htmlVacio y mensaje de ticket existente', () => {
    expect(htmlVacio('<div><br></div>&nbsp;')).toBe(true);
    expect(htmlVacio('<img src="data:x">')).toBe(false);
    expect(htmlVacio('Hola')).toBe(false);
    expect(mensajeTicketExistente('Open')).toBe('Ya existe un ticket abierto para este cliente.');
    expect(mensajeTicketExistente('On Hold')).toBe('Ya existe un ticket en progreso para este cliente.');
  });
});

describe('imágenes pegadas', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const html = `<div>Texto<img src="${png}" style="width: 400px;" data-pasted="true"><img src="https://ya/subida.png"><img src="${png}"></div>`;

  it('encuentra solo las imágenes en base64', () => {
    expect(imagenesPegadas(html)).toEqual([png, png]);
  });

  it('nombre y archivo desde el data URL', () => {
    expect(nombreArchivo('image/jpeg', 1, 2)).toBe('archivo_1_2.jpeg');
    const archivo = archivoDesdeDataUrl(png, 'a.png');
    expect(archivo.type).toBe('image/png');
    expect(archivo.size).toBe(8);
  });

  it('reemplaza por la URL subida y deja en base64 las que fallan', async () => {
    let n = 0;
    const r = await subirImagenesPegadas(html, () =>
      n++ === 0 ? Promise.resolve('https://cdn/1.png') : Promise.reject(new Error('CORS')),
    );
    expect(r.fallidas).toBe(1);
    expect(r.html).toBe(
      `<div>Texto<img src="https://cdn/1.png" style="width: 400px;" data-pasted="true"><img src="https://ya/subida.png"><img src="${png}"></div>`,
    );
  });

  it('sin imágenes no sube nada', async () => {
    const r = await subirImagenesPegadas('<p>Hola</p>', () => Promise.reject(new Error('no')));
    expect(r).toEqual({ html: '<p>Hola</p>', fallidas: 0 });
  });
});
