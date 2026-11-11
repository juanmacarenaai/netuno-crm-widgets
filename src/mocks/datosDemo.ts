/**
 * Datos ficticios con la forma de las respuestas reales. No corresponden a clientes reales.
 * Al migrar un módulo, agrega aquí las respuestas de sus endpoints (ver docs/agregar-modulo.md).
 * Origen: src/mocks/datosDemo.js de UnidadComercialReact.
 */
import type { Registro, UsuarioCrm } from '@/core/zoho/tipos';
import type { Contrato, Cuenta } from '@/shared/cuentas';

export const usuarioDemo: UsuarioCrm = {
  id: 'usuario-demo',
  full_name: 'Desarrollador Local',
  email: 'dev.local@example.com',
  role: { id: 'rol-demo', name: 'Administrador' },
};

export const detalleUsuarioDemo = { Departamento: ['Servicio al Cliente', 'Ventas'], Almacen: 'ALM-DEMO' };

export const registroDemo: Registro = {
  id: '1000000000000001',
  Account_Name: 'Cliente Demo',
  Nombres: 'Cliente Demo',
  cf_tipo_documento: 'Cédula',
  cf_documento_de_identidad: '00000000',
  email: 'cliente.demo@example.com',
  Codigo_de_Celular: '0414',
  Tel_fono_Celular: '0000000',
  Nro_de_Cliente: 'CL-0001',
};

export const organizacionCrmDemo = {
  org: [{ id: 'org-demo', company_name: 'Netuno (simulado)', zgid: 'zgid-demo', type: 'sandbox' }],
};

export const organizacionesDeskDemo = {
  data: [{ id: '850539393', companyName: 'Netuno (Desk de pruebas, simulado)', isDefault: true }],
};

// ── Cuentas y contratos ─────────────────────────────────────────────

interface ExtraContrato {
  nombrePaquete?: string;
  coordenadasGps?: string;
  potencia?: string;
  /** status_code que devuelve la API para este contrato (simula fallas). */
  error?: number;
  campos?: Partial<Contrato>;
}

/** idProducto → datos para el contrato BOSS */
const CONTRATOS: Record<string, ExtraContrato & { nombreServicio: string; status: string }> = {};

const ubicacionDemo = (ciudad: string) => [
  {
    direccion: `Av. Principal de ${ciudad}, Edif. Demo, Piso 2, Apto 2-A`,
    ciudad,
    estado: 'Distrito Capital',
  },
];

function contrato(
  idProducto: string,
  nombreServicio: string,
  status: string,
  extra: ExtraContrato = {},
): Contrato {
  CONTRATOS[idProducto] = { nombreServicio, status, ...extra };
  return {
    idProducto,
    codContrato: `C-${idProducto}`,
    nombreServicio,
    nombrePaquete: extra.nombrePaquete ?? 'Paquete Demo',
    status,
    // El serial del equipo llega en /cuentas (Cambio de equipo lo muestra como "Equipo actual")
    // NetUno Go (Streaming): el serial es el correo de acceso (Contraseñas)
    serial:
      nombreServicio === 'Internet'
        ? `48575443DE${idProducto.slice(-6)}`
        : nombreServicio === 'Streaming'
          ? `netunogo.${idProducto}@example.com`
          : undefined,
    codTecnologia: '31',
    ubicacionJSON: ubicacionDemo('Caracas'),
    ...extra.campos,
  };
}

function cuenta(
  numero: string,
  tipo: 'Hogar' | 'Empresa',
  status: string,
  ciudad: string,
  contratos: Contrato[],
  extra: Partial<Cuenta> = {},
): Cuenta {
  return {
    cuenta: numero,
    descTipoCliente: tipo,
    descStatusCuenta: status,
    descCiudad: ciudad,
    codMunicipioFact: 'Libertador',
    descUrbFact: 'Centro',
    saldo: 25.5,
    descMoneda: 'USD',
    redes_compartidas: 'No',
    codTipoCliente: tipo === 'Empresa' ? 2 : 1,
    documentoIdentificacion: 'V00000000',
    nodoNas: 'NAS-DEMO-01',
    descNodo: 'NODO-DEMO-01',
    codNodo: '101',
    // Facturación
    codAbonado: `A-${numero}`,
    descEmpresa: tipo === 'Empresa' ? 'NETUNO EMPRESAS, C.A.' : 'NETUNO, C.A.',
    domiciliada: false,
    resumenServicios: contratos.map((c) => c.nombreServicio).join(', ') || null,
    ultimaFechaPago: '10/10/2026',
    fCompromisoPago: null,
    contratos,
    ...extra,
  };
}

/** GET /cuentas?cedularif=... devuelve una lista de cuentas. */
export const cuentasDemo: Cuenta[] = [
  cuenta(
    '9000001',
    'Hogar',
    'Conectado',
    'Caracas',
    [
      contrato('5000001', 'Internet', 'Conectado', {
        nombrePaquete: 'Fibranet400_400Mb',
        coordenadasGps: '10.4806, -66.9036',
        // Baja voluntaria: equipo alquilado (pregunta si lo devolvió)
        campos: { alquilerEquipo: 'SI' },
      }),
      contrato('5000002', 'Telefonía', 'Conectado', {
        nombrePaquete: 'Telefonía',
        coordenadasGps: '10.4810, -66.9040',
      }),
      contrato('5000003', 'Streaming', 'Conectado', {
        nombrePaquete: 'NetUnoGO Plus 5',
        coordenadasGps: 'Sin datos',
      }),
    ],
    { saldo: -1.8, domiciliada: true, fCompromisoPago: '15/11/2026' },
  ),
  cuenta(
    '9000002',
    'Empresa',
    'Conectado',
    'Valencia',
    [
      contrato('5000011', 'Internet', 'Conectado', {
        nombrePaquete: 'Fibranet10Gb_10Gb',
        coordenadasGps: '10.1620, -68.0077',
        potencia: '-31.2',
        campos: { nombrePaqueteFact: 'Fibranet 10Gb/10Gb' },
      }),
      contrato('5000012', 'Internet', 'Conectado', {
        nombrePaquete: 'Fibranet500_500Mb',
        coordenadasGps: '-68.0100, 10.1650',
      }),
      contrato('5000013', 'Telefonía', 'Suspendido', { nombrePaquete: 'Troncal SIP' }),
      contrato('5000014', 'Salud', 'Conectado', {
        nombrePaquete: 'Salud Familiar',
        coordenadasGps: '10.1700, -68.0000',
      }),
      contrato('5000015', 'Internet', 'Desconectado', { nombrePaquete: 'Fibranet300_300Mb', error: 500 }),
      contrato('5000016', 'Streaming', 'Conectado', {
        nombrePaquete: 'Streaming Básico',
        coordenadasGps: '40.7128,-74.0060',
      }),
    ],
    { saldo: 1200, descMoneda: 'VEF', fCompromisoPago: '08/11/2026' },
  ),
  cuenta(
    '9000003',
    'Hogar',
    'Desconectado',
    'Maracaibo',
    [
      contrato('5000021', 'Internet', 'Desconectado', {
        nombrePaquete: 'Fibranet100_100Mb',
        coordenadasGps: '10.6427, -71.6125',
      }),
    ],
    { saldo: 0, ultimaFechaPago: null },
  ),
  cuenta(
    '9000004',
    'Hogar',
    'Conectado',
    'Barquisimeto',
    [
      // Cambio de plan: dos Internet FTTH (el de 800 ya cambió este mes), Salud con 3 adicionales y NetUnoGO
      contrato('5000031', 'Internet', 'Conectado', {
        nombrePaquete: 'Fibranet600_600Mb',
        coordenadasGps: '10.0647, -69.3570',
        campos: { tipoRed: 'FTTH', nombrePaqueteFact: 'Fibranet 600/600 Megas', cuenta: 9000004 },
      }),
      contrato('5000032', 'Internet', 'Conectado', {
        nombrePaquete: 'Fibranet800_800Mb',
        coordenadasGps: '10.0650, -69.3575',
        campos: { tipoRed: 'FTTH', nombrePaqueteFact: 'Fibranet 800/800 Megas', cuenta: 9000004 },
      }),
      contrato('5000033', 'Salud', 'Conectado', {
        nombrePaquete: 'Beneficiario Ppal',
        campos: { NombreAseg: 'Titular Demo', cuenta: 9000004 },
      }),
      contrato('5000034', 'Salud', 'Conectado', {
        nombrePaquete: 'Beneficiario Adicional',
        campos: { NombreAseg: 'Ana Demo', cuenta: 9000004 },
      }),
      contrato('5000035', 'Salud', 'Conectado', {
        nombrePaquete: 'Beneficiario Adicional',
        campos: { NombreAseg: 'Luis Demo', cuenta: 9000004 },
      }),
      contrato('5000036', 'Salud', 'Conectado', {
        nombrePaquete: 'Beneficiario Adicional',
        campos: { NombreAseg: null, cuenta: 9000004 },
      }),
      contrato('5000037', 'Streaming', 'Conectado', {
        nombrePaquete: 'NetUnoGO Plus 5',
        campos: { serial: 'Cliente.Demo@Example.com', cuenta: 9000004 },
      }),
    ],
    // Troubleshooting: el nodo tiene un posible evento masivo
    { saldo: -1.02, descNodo: 'NODO-PEM', fCompromisoPago: '01/11/2026' },
  ),
  // Cambio de titularidad (Empresa): saldo cero, dos enlaces de Internet y una troncal SIP
  cuenta(
    '9000005',
    'Empresa',
    'Conectado',
    'Maracay',
    [
      contrato('5000051', 'Internet', 'Conectado', {
        nombrePaquete: 'Fibranet1Gb_1Gb',
        coordenadasGps: '10.2469, -67.5958',
        campos: { nombrePaqueteFact: 'Fibranet 1000/1000 Mb', cuenta: 9000005 },
      }),
      contrato('5000052', 'Internet', 'Conectado', {
        nombrePaquete: 'Fibranet500_500Mb',
        coordenadasGps: '10.2480, -67.5960',
        campos: { nombrePaqueteFact: 'Fibranet 500/500 Mb', cuenta: 9000005 },
      }),
      contrato('5000053', 'Telefonía', 'Conectado', { nombrePaquete: 'Troncal SIP' }),
    ],
    { saldo: 0 },
  ),
  // Activar servicios: solo Internet FTTH (idProducto con prefijos, como en BOSS) → NetUnoGO, Telefonía y Salud
  cuenta(
    '9000006',
    'Hogar',
    'Conectado',
    'Mérida',
    [
      contrato('P-1-5000041', 'Internet', 'Conectado', {
        nombrePaquete: 'Fibranet300_300Mb',
        coordenadasGps: '8.5897, -71.1561',
        campos: { tipoRed: 'FTTH', codContrato: 'C-5000041', cuenta: 9000006, alquilerEquipo: 'NO' },
      }),
    ],
    // Troubleshooting: el nodo está dentro de un evento masivo confirmado
    { saldo: 0, descNodo: 'NODO-MASIVO' },
  ),
];

/** Correos de NetUno Go cambiados en esta sesión (POST /contrato/correo/streaming). */
const correosNetunoGo: Record<string, string> = {};

function contratoBoss(idProducto: string) {
  const c = CONTRATOS[idProducto];
  if (!c) return { status_code: 404 };
  return {
    idProducto: `BOSS-01-${idProducto}`,
    status: c.status,
    nombreServicio: c.nombreServicio,
    nombrePaquete: c.nombrePaquete ?? 'Paquete Demo',
    tipoRed: 'FTTH',
    tecnologia: 'GPON',
    listaPrecio: 'Residencial 2026',
    alquilerEquipo: 'Sí',
    nodo: 'NAS-DEMO-01',
    wifiActivo: 'Sí',
    routerActivo: 'Sí',
    modelo: 'HG8145V5',
    serial:
      c.nombreServicio === 'Streaming'
        ? (correosNetunoGo[idProducto] ?? `netunogo.${idProducto}@example.com`)
        : '48575443DEMO0001',
    coordenadasGps: c.coordenadasGps ?? null,
    direccionA: 'Av. Principal de Demo, Edif. Ejemplo. Piso 3, Apto 3-B',
    direccionB: null,
    fechaFirma: '2024-03-15',
    fechaInstalacion: '2024-03-20',
    fechaConexion: '2024-03-21',
    fechaDesconexion: null,
    fechaBaja: null,
    fechaHard: null,
    fecha_vencimiento: '2027-03-15',
    nro_tlf: c.nombreServicio === 'Telefonía' ? '02120000000' : null,
    vendedor: 'Vendedor Demo',
    unidadVendedor: 'Ventas Residenciales',
    ciudadVendedor: 'Caracas',
    etiqueta: ' ',
    ubicacion: [
      {
        estado: 'Distrito Capital',
        ciudad: 'Caracas',
        municipio: 'Libertador',
        parroquia: 'Catedral',
        urbanizacion: 'Centro',
        avCalle: 'Av. Principal',
        calle: 'Calle 1',
        edificioCasa: 'Edif. Ejemplo',
      },
    ],
  };
}

const NAS = {
  nodo: 'OLT-DEMO-01',
  tarjeta: '3',
  puerto: '7',
  ip: '10.20.30.40',
  idont: '12',
  vlanGpon: '100',
  genportGpon: '2001',
};

// Incluye un <img onerror> para comprobar que HtmlSeguro lo elimina
const TABLA_HTML = `<table><tr><th>Puerto</th><th>Estado</th><th>Rx</th></tr>
<tr><td>0/3/7</td><td>online</td><td>-19.5</td></tr><tr><td>0/3/8</td><td>offline</td><td>-</td></tr></table>
<img src=x onerror="alert('no deberia ejecutarse')">`;

/** Respuesta simulada de la API de Netuno según la ruta, o null si no hay datos para esa ruta. */
export function respuestaNetunoDemo(url: string, cuerpo?: unknown): unknown {
  const direccion = new URL(url);
  const ruta = direccion.pathname;
  const id = direccion.searchParams.get('contrato') ?? '';
  const datos = CONTRATOS[id];

  if (ruta.endsWith('/cuentas')) return cuentasDemo;
  if (datos?.error) return { status_code: datos.error };

  if (ruta.endsWith('/contrato')) return contratoBoss(id);
  if (ruta.endsWith('/contrato/datos-nas')) return NAS;
  if (ruta.endsWith('/consultar/potencia-nas')) {
    return { estatus: '1', conexion: 'IP Asignada', potencia: datos?.potencia ?? '-19.5' };
  }
  if (ruta.endsWith('/consultar/olt-nas')) {
    return {
      id: '12',
      state: 'online',
      upTime: '12d 4h',
      downTime: '-',
      downCause: 'dying-gasp',
      type: 'HG8145V5',
      distance: '1250 m',
      sn: '48575443DEMO0001',
      'rx/txPower': '-19.5/2.1',
      consumoSumario: TABLA_HTML,
    };
  }
  if (ruta.endsWith('/consultar/autofind-nas')) {
    return {
      serialBuscado: '48575443DEMO0001',
      equipoEncontrado: {
        Number: '1',
        'F/S/P': '0/3/7',
        'Ont SN': '48575443DEMO0001',
        VendorID: 'HWTC',
        'Ont autofind time': '2026-10-20 09:15',
      },
      listadoAutofind: TABLA_HTML,
    };
  }
  if (ruta.endsWith('/consultar/ont-serial-nas')) {
    return {
      payload: {
        data: {
          infoOnt: {
            estado: 'online',
            modelo: 'HG8145V5',
            detalle: {
              firmware: 'V5R020C10S115',
              memoria: '45%',
              cpu: '12%',
              temperatura: '48 C',
              uptime: '12d',
            },
          },
          infoOptical: { rx: '-19.5 dBm', tx: '2.1 dBm', voltaje: '3.3 V' },
          infoWan: { ip: '10.20.30.40', mascara: '255.255.255.0' },
        },
      },
    };
  }
  if (ruta.endsWith('/contrato/consumo/internet') || ruta.endsWith('/contrato/consumo/telefonia')) {
    // Un registro por mes del rango ("MM/AAAA"); Unidad Comercial pide un solo mes
    const internet = ruta.endsWith('/internet');
    const [mesInicial = 1, anioInicial = 2026] = (direccion.searchParams.get('fechaInicial') ?? '')
      .split('/')
      .map(Number);
    const [mesFinal = mesInicial, anioFinal = anioInicial] = (direccion.searchParams.get('fechaFinal') ?? '')
      .split('/')
      .map(Number);
    const meses: { mes: number; anio: number }[] = [];
    for (
      let a = anioInicial, m = mesInicial;
      a < anioFinal || (a === anioFinal && m <= mesFinal);
      m === 12 ? ((m = 1), a++) : m++
    ) {
      meses.push({ mes: m, anio: a });
    }
    return meses.map(({ mes, anio }, i) => ({
      unidadMedida: internet ? 'GB' : 'min',
      consumoTotal: internet ? Number((182.4 - i * 21.3).toFixed(1)) : 42 + i * 7,
      fechaInicioPeriodo: `01/${String(mes).padStart(2, '0')}/${anio}`,
      fechaFinPeriodo: `28/${String(mes).padStart(2, '0')}/${anio}`,
      ciudad: 'Caracas',
      mac: 'AA:BB:CC:00:11:22',
      serial: '48575443DEMO0001',
      paquete: 'Fibranet400_400Mb',
    }));
  }
  // Historial
  if (ruta.endsWith('/cuenta/notificaciones-pago')) return pagosDemo;
  if (ruta.endsWith('/cliente/promociones')) return promocionesDemo;
  if (ruta.endsWith('/ConectionLog/AddLog')) return { estado: 'registrado' };
  if (ruta.endsWith('/cuentas/consumo/telefonia')) {
    return {
      fechaInicio: '01/11/2026',
      fechaFin: '30/11/2026',
      consumo: [
        {
          cuenta: '9000001',
          nroTlf: '02120000000',
          idAccountPO: 'PO-1',
          servicioNacional: { total: 300, usado: 42, restante: 258 },
          servicioInternacional: { total: 60, usado: 0, restante: 60 },
        },
      ],
    };
  }
  if (ruta.endsWith('/cambio/paquete/consultar')) return paquetesDemo(direccion.searchParams);
  if (ruta.endsWith('/contrato/cambio-equipo/sac')) return cambioEquipoDemo(cuerpo);
  if (ruta.endsWith('/consultar/servicios')) return serviciosDemo(direccion.searchParams);
  if (ruta.endsWith('/activacion/servicios')) return activacionDemo(cuerpo);
  // Baja voluntaria: Telefonía y Salud adicional están paquetizados (requieren aprobación)
  if (ruta.endsWith('/consulta/contrato/paquetizado')) {
    return (cuerpo as { contrato: string }[]).map(({ contrato: idContrato }) => ({
      contrato: idContrato,
      esPaquetizado: ['Telefonía', 'Salud'].includes(CONTRATOS[idContrato]?.nombreServicio ?? ''),
    }));
  }
  if (ruta.endsWith('/contratos/baja')) return { codigo: 0, mensaje: 'Contratos dados de baja' };
  // Facturación (consulta a Netuno desarrollo; el mock responde igual en cualquier host)
  if (ruta.endsWith('/movimientos')) return movimientosDemo(direccion.searchParams.get('cuenta') ?? '');
  if (ruta.endsWith('/estado-cuenta/link')) {
    // La cuenta 9000002 devuelve un enlace http (como Netuno desarrollo: no se puede incrustar)
    return direccion.searchParams.get('cuenta') === '9000002'
      ? {
          code: 0,
          message: 'Ok',
          data: 'http://172.16.47.116/estadoCuenta/detalle/viewestadocuentapdf/1/9000002',
        }
      : { code: 0, message: 'Ok', data: PDF_DEMO };
  }
  if (ruta.endsWith('/movimiento/link')) {
    const movimiento = direccion.searchParams.get('codMovimiento');
    if (movimiento === '700003')
      return { code: 0, message: 'Ok', data: 'https://www.unidigital.global/documento/demo' };
    if (movimiento === '700004') return { code: 0, message: 'Ok', data: null };
    return { code: 0, message: 'Ok', data: PDF_DEMO };
  }
  if (ruta.endsWith('/cuenta/domiciliada')) {
    return direccion.searchParams.get('cuenta') === '9000001'
      ? {
          nombreTitular: 'Cliente Demo',
          desTipoDocumento: 'Cédula',
          nroDocumento: '00000000',
          fechaVencimiento: '08/2029',
          nombreBanco: 'Banco Demo Universal',
          desTipoTarjeta: 'Crédito',
        }
      : { code: -1, message: 'Cuenta no domiciliada' };
  }
  if (ruta.endsWith('/cliente/contacto')) return contactosDemo;
  // Contraseñas: la ONT del contrato 5000011 no tiene WiFi administrable
  if (ruta.endsWith('/ont/wifi')) {
    const contratoWifi = direccion.searchParams.get('Contrato') ?? '';
    return CONTRATOS[contratoWifi]?.nombreServicio === 'Internet' && contratoWifi !== '5000011'
      ? { wifi: true, modelo: 'HG8145V5' }
      : { code: -99, description: 'informacion no encontrada' };
  }
  // "Rechazo" en la contraseña → -2; "Falla" en el nombre de la red → -4
  if (ruta.endsWith('/contrato/contrasena/restablecer')) {
    const { contrasena, ssid } = (cuerpo ?? {}) as { contrasena?: string | null; ssid?: string | null };
    if (contrasena?.includes('Rechazo')) return { code: -2, message: 'Clave inválida' };
    if (ssid?.includes('Falla')) return { code: -4, message: 'Formato incorrecto' };
    return { code: 0, message: 'Exitoso.' };
  }
  // Un correo con "rechazo" no se acepta; "sinconfirmar" se acepta pero el contrato no cambia
  if (ruta.endsWith('/contrato/correo/streaming')) {
    const { correo = '' } = (cuerpo ?? {}) as { correo?: string };
    if (correo.includes('rechazo')) return { code: -1, message: 'Correo no permitido' };
    if (!correo.includes('sinconfirmar')) correosNetunoGo[id] = correo;
    return { code: 0, message: 'Correo actualizado', data: { contrato: id } };
  }
  // Troubleshooting
  if (ruta.endsWith('/contrato/refresh')) return { codigo: 0, mensaje: 'Comando enviado' };
  if (ruta.endsWith('/massive_failure/searchByCoverage')) {
    const nodo = (cuerpo as { location?: { node?: string } } | undefined)?.location?.node;
    return { data: nodo === 'NODO-MASIVO' ? [ticketPadreDemo] : [] };
  }
  if (ruta.endsWith('/possibleMassiveFailure/affectedNode')) {
    return direccion.searchParams.get('nasNode') === 'NODO-PEM' ? { code: 1001 } : { code: 1002 };
  }
  if (ruta.endsWith('/api/netunoFallasMasivasDes')) return { estado: 'registrado' };
  if (ruta.endsWith('/api/macarena/accesToken')) return { response: 'token-demo' };
  if (ruta.endsWith('/api/v2/session')) {
    return { representation: { technician_url: 'https://assist.zoho.com/demo/sesion-tecnico' } };
  }
  // Catalyst (funciones del proyecto "crm")
  if (ruta.endsWith('/tools/territories')) {
    return {
      data: {
        territory: { name: direccion.searchParams.get('territoryName') },
        parent: { name: 'Región Demo' },
      },
    };
  }
  if (ruta.endsWith('/cambio/paquete/actualizar'))
    return { codigo: 0, mensaje: 'Cambio de paquete aplicado' };
  return null;
}

// ── Facturación ─────────────────────────────────────────────────────

/** PDF mínimo de una página para el visor (generado; solo en desarrollo local). */
const PDF_DEMO =
  'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA1OSA+PgpzdHJlYW0KQlQgL0YxIDIyIFRmIDcyIDcyMCBUZCAoRG9jdW1lbnRvIGRlIHBydWViYSAtIE5ldHVubykgVGogRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8IC9UeXBlIC9Gb250IC9TdWJ0eXBlIC9UeXBlMSAvQmFzZUZvbnQgL0hlbHZldGljYSA+PgplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjQxIDAwMDAwIG4gCjAwMDAwMDAzNTAgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA2IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgo0MjAKJSVFT0YK';

/** GET /movimientos: 12 movimientos (paginación y filtros) y ninguno para la cuenta 9000003. */
function movimientosDemo(numeroCuenta: string) {
  if (numeroCuenta === '9000003') return [];
  const base = [
    ['05/08/2026', 'Factura', 'Pagada', 'Mensualidad agosto', 25.5, null, 'F-0815'],
    ['10/08/2026', 'Pago', 'Aplicado', '88112 - Pago móvil', null, 25.5, null],
    ['05/09/2026', 'Factura', 'Pagada', 'Mensualidad septiembre', 25.5, null, 'F-0907'],
    ['12/09/2026', 'Pago', 'Aplicado', '88544 - Banca en línea', null, 25.5, null],
    ['20/09/2026', 'Nota de Débito', 'Emitida', 'Reconexión', 4.64, null, 'ND-0031'],
    ['05/10/2026', 'Factura', 'Pendiente', 'Mensualidad octubre', 25.5, null, 'F-1004'],
    ['08/10/2026', 'Nota de Crédito', 'Aplicada', 'Ajuste por falla', null, 3.2, 'NC-0012'],
    ['15/10/2026', 'Pago', 'Aplicado', 'Pago web', null, 22.3, null],
    ['22/10/2026', 'Cargo variable', 'Emitido', 'Cambio de equipo', 18, null, 'CV-0005'],
    ['30/10/2026', 'Pago', 'Rechazado', '89001 - Tarjeta de débito', null, 18, null],
    ['05/11/2026', 'Factura', 'Pendiente', 'Mensualidad noviembre', 25.5, null, 'F-1102'],
    ['06/11/2026', 'Pago', 'En revisión', '89120 - Transferencia', null, 25.5, null],
  ] as const;
  let saldo = 0;
  return base.map(([fecha, tipo, estatus, descripcion, cargo, abono, fiscal], i) => {
    saldo = Number((saldo + (cargo ?? 0) - (abono ?? 0)).toFixed(2));
    return {
      id: 700000 + i,
      fecha,
      descTipoDocumento: tipo,
      statusDocumento: estatus,
      descripcion,
      numTicket: tipo === 'Nota de Débito' ? '5501' : null,
      cargo,
      abono,
      saldo,
      codigoFiscal: fiscal,
    };
  });
}

const contactosDemo = {
  contactoExt: [],
  contactoCuenta: [
    ['9000001', 'Cobranzas', 'Ana Pérez', 'Analista de cobranzas', 'ana.perez@netuno.net'],
    ['9000001', 'Cobranzas', 'Eva Rodríguez', 'Coordinadora', 'eva.rodriguez@netuno.net'],
    ['9000001', 'Ventas', 'Luis Gómez', 'Ejecutivo de cuenta', 'luis.gomez@netuno.net'],
    ['9000002', 'Administración de ventas', 'Carla Díaz', 'Analista', 'carla.diaz@netuno.net'],
  ].map(([cuentaContacto, area, nombreAsesor, cargo, correo]) => ({
    cuenta: Number(cuentaContacto),
    area,
    nombreAsesor,
    cargo,
    correo,
  })),
};

/** Tickets del histórico de documentos (GET /tickets/search con cf_tipo_de_documento). */
function historicoDemo(tipoDocumento: string) {
  if (tipoDocumento === 'Factura manual') return [];
  return Array.from({ length: tipoDocumento === 'Nota de Débito' ? 9 : 2 }, (_, i) => {
    const fecha = `2026-${String(10 - (i % 3)).padStart(2, '0')}-${String(20 - i).padStart(2, '0')}`;
    const monto = 25.5 + i;
    return {
      id: `H-${tipoDocumento}-${i}`,
      ticketNumber: String(5501 + i),
      status: ['Por aprobar', 'Aprobado', 'Cerrado'][i % 3],
      createdTime: `${fecha}T14:00:00.000Z`,
      subject: `ABCL-0001 || CRM || ${tipoDocumento}`,
      category: 'Gestión de facturas',
      subCategory: tipoDocumento,
      description: `<p>Solicitud de ${tipoDocumento.toLowerCase()} desde CRM.</p><script>alert(1)</script>`,
      resolution: i % 3 === 2 ? 'Documento emitido' : null,
      webUrl: `https://desk.zoho.com/support/demo/ShowHomePage.do#Cases/dv/H-${i}`,
      department: { name: 'Cobranzas' },
      assignee: i % 2 ? { firstName: 'Carla', lastName: 'Cobranzas' } : null,
      product: null,
      cf: {
        cf_numero_de_cuenta: i % 4 === 3 ? '9000004' : '9000001',
        cf_fecha_de_creacion: fecha,
        cf_monto_total: monto.toFixed(2).replace('.', ','),
        cf_moneda_factura: '$',
        cf_monto_sin_iva: (monto / 1.16).toFixed(2).replace('.', ','),
        cf_porcentaje_iva: '16',
        cf_concepto: 'Reconexión',
        cf_tipo_cliente: 'Hogar',
        cf_contratos: 'Internet: 5000001',
      },
    };
  });
}

// ── Historial ───────────────────────────────────────────────────────

const pagosDemo = [
  ['Hogar', 'TRX-88112', '9000001', 'Banca en línea', '25.50', 'Pago móvil', '02/11/2026', 'Aplicado'],
  ['Hogar', 'TRX-87001', '9000004', 'Oficina', '16.38', 'Tarjeta de débito', '15/10/2026', 'Aplicado'],
  ['Hogar', 'TRX-86540', '9000001', 'Banca en línea', '25.50', 'Transferencia', '03/10/2026', 'Rechazado'],
  ['Empresa', 'TRX-85002', '9000002', 'Oficina', '1200.00', 'Transferencia', '20/09/2026', 'En revisión'],
].map(([negocio, id, numeroCuenta, canal, monto, medioPago, fecha, estatusDescripcion], i) => ({
  negocio,
  // El API envía el número como texto u objeto
  nroTransaccion: i === 1 ? { idTransCompleto: id } : id,
  cuenta: numeroCuenta,
  canal,
  monto,
  medioPago,
  fecha,
  estatusDescripcion,
}));

const promocionesDemo = [
  {
    negocio: 'Hogar',
    cuenta: '9000001',
    campana: 'Navidad 2026',
    descripcion: '20% de descuento en el upgrade a 800 Megas',
    fechaInicio: '01/11/2026',
    fechaFin: '31/12/2026',
    estatus: 'Vigente',
    comentario: 'Aplica a clientes al día',
    codPromocion: 501,
  },
  {
    negocio: 'Hogar',
    cuenta: '9000004',
    campana: 'NetUnoGO gratis',
    descripcion: 'Un mes de NetUnoGO Plus 3 sin costo',
    fechaInicio: '01/08/2026',
    fechaFin: '31/08/2026',
    estatus: 'Vencida',
    comentario: null,
    codPromocion: 377,
  },
];

const casosDemo = [
  [
    'C1',
    ['Hogar'],
    '9000001',
    '2026-11-04T10:15:00-04:00',
    'Gestión de pagos',
    'Confirmación de pagos aplicados',
    'Telefónico',
    'Ana Asesor',
    'Cliente confirma pago de octubre',
  ],
  [
    'C2',
    ['Hogar'],
    '9000004',
    '2026-10-28T15:40:00-04:00',
    'Solicitud de información',
    'Planes',
    'Chat',
    'Luis Asesor',
    null,
  ],
  [
    'C3',
    ['Hogar', 'Empresa'],
    '9000002',
    '2026-10-12T09:05:00-04:00',
    'Envío de documento',
    'Factura',
    'Oficina',
    'Ana Asesor',
    'Se envió la factura por correo',
  ],
].map(([id, Negocio, Cuenta, Fecha, Categoria, Subcategoria, Canal, Usuario, Observaciones]) => ({
  id,
  Negocio,
  Cuenta,
  Fecha,
  Categoria,
  Subcategoria,
  Canal,
  Usuario,
  Observaciones,
}));

const eventosDemo = Array.from({ length: 9 }, (_, i) => ({
  id: `E${i + 1}`,
  Negocio: 'Hogar',
  Cuenta: i % 3 === 0 ? '9000004' : '9000001',
  Canal: ['Oficina', 'Telefónico', 'Chat'][i % 3],
  Registro: ['Modificación', 'Activación', 'Desactivación'][i % 3],
  Subtipo_de_registro: ['Cambio de plan (upgrade)', 'Activación de servicio', 'Desactivación de servicio'][
    i % 3
  ],
  Descripci_n: `Gestión de prueba ${i + 1}`,
  Fecha: `2026-10-${String(28 - i * 2).padStart(2, '0')}`,
  Usuario: 'Desarrollador Local',
}));

const comunicacionesDemo = [
  {
    id: 'M1',
    Negocio: ['Hogar'],
    Cuenta: '9000001',
    Fecha: '2026-11-03',
    Contacto: 'María Demo',
    Usuario: 'Ana Asesor',
    Canal: 'Telefónico',
    Motivo_mensaje: 'Recordatorio de pago',
  },
];

/** Búsquedas de la API v8 de CRM (Historial): Cases, Eventos y Comunicaciones del cliente. */
export function respuestaCrmDemo(url: string, cuerpo?: unknown): unknown {
  const ruta = new URL(url).pathname;
  // Facturación: envío de correo (un asunto con "NOALLOWED" simula un remitente no habilitado)
  if (ruta.endsWith('/actions/send_mail')) {
    const asunto = String(
      (cuerpo as { data?: { subject?: string }[] } | undefined)?.data?.[0]?.subject ?? '',
    );
    return asunto.includes('NOALLOWED')
      ? { data: [{ code: 'NOT_ALLOWED', status: 'error', message: 'from address not allowed' }] }
      : { data: [{ code: 'SUCCESS', status: 'success', message: 'Your mail has been sent successfully.' }] };
  }
  if (ruta.endsWith('/Cases/search')) return { data: casosDemo };
  if (ruta.endsWith('/Eventos/search')) return { data: eventosDemo };
  if (ruta.endsWith('/Comunicaciones/search')) return { data: comunicacionesDemo };
  if (ruta.endsWith('/search')) return null;
  return { data: [{ id: registroDemo.id }] };
}

/** Tickets del cliente en Desk (Historial busca por tipo y número de documento). */
const ticketsHistorialDemo = [
  {
    id: 'T1',
    ticketNumber: '10234',
    status: 'Abierto',
    createdTime: '2026-11-04T13:20:00.000Z',
    subject: 'Cliente reporta lentitud en la noche',
    category: 'Falla técnica',
    subCategory: 'Lentitud',
    description:
      '<div>Velocidad por debajo de lo contratado.<br><b>Prueba:</b> 120 Mbps</div><script>alert(1)</script>',
    resolution: null,
    webUrl: 'https://desk.zoho.com/support/demo/ShowHomePage.do#Cases/dv/T1',
    department: { name: 'Operaciones' },
    assignee: { firstName: 'Carla', lastName: 'Soporte' },
    product: { productName: 'Internet' },
    contact: { account: { accountName: '9000001' } },
    cf: { cf_tipo_cliente: 'Hogar', cf_numero_de_cuenta: '9000001' },
  },
  {
    id: 'T2',
    ticketNumber: '10111',
    status: 'Pendiente por aprobación',
    createdTime: '2026-10-20T16:00:00.000Z',
    subject: 'AB CL-0001 || CRM || Desconexión voluntaria',
    category: 'Desconexión voluntaria',
    subCategory: 'Mudanza',
    description: 'Se muda fuera de la zona',
    resolution: 'En espera de aprobación',
    webUrl: 'https://desk.zoho.com/support/demo/ShowHomePage.do#Cases/dv/T2',
    department: { name: 'Servicio al cliente' },
    assignee: null,
    product: null,
    contact: { account: null },
    cf: { cf_tipo_cliente: 'Hogar', cf_numero_de_cuenta: '9000004', cf_contratos: 'Salud: 5000033' },
  },
  { id: 'T3', ticketNumber: '9000', status: 'Cerrado', createdTime: null, cf: {} },
];

// ── Troubleshooting ─────────────────────────────────────────────────

/** Ticket padre de un evento masivo (lo que devuelve Catalyst searchByCoverage). */
const ticketPadreDemo = {
  id: 'ticket-padre-demo',
  ticketNumber: '9001',
  departmentId: 'departamento-operaciones',
  department: { name: 'Operaciones' },
  status: 'Evento masivo',
  createdTime: '2026-11-05T13:10:00.000Z',
  subject: 'Corte de fibra troncal en el nodo NODO-MASIVO',
  description: 'Corte de fibra por obra civil. Cuadrilla en sitio.',
  category: 'Falla técnica',
  subCategory: 'Sin servicio',
  webUrl: 'https://desk.zoho.com/support/demo/ShowHomePage.do#Cases/dv/ticket-padre-demo',
  cf: {
    cf_afectacion_de_servicio: true,
    cf_creador_ticket: 'NOC Demo',
    cf_fecha_y_hora_inicio_afectacion: '2026-11-05T13:00:00.000Z',
    cf_fecha_y_hora_fin_afectacion: '2026-11-05T16:30:00.000Z',
    cf_cobertura_de_afectacion: 'Nodo',
    cf_tipo_de_servicio: 'Internet',
    cf_sub_producto: 'FTTX',
    cf_nodo: 'NODO-MASIVO',
    cf_avance_del_ticket: 'Cuadrilla trabajando en el empalme',
  },
};

// ── Cambio de equipo ────────────────────────────────────────────────

/** Un serial que empieza con "X" simula el rechazo de la plataforma. */
function cambioEquipoDemo(cuerpo: unknown) {
  const serial = String((cuerpo as { serialEquipoAsignar?: unknown } | undefined)?.serialEquipoAsignar ?? '');
  return serial.toUpperCase().startsWith('X')
    ? { code: 1, message: `El equipo ${serial} no está disponible en el inventario.` }
    : { code: 0, message: 'Comando enviado exitosamente a la plataforma' };
}

// ── Activar servicios ───────────────────────────────────────────────

const lista = (moneda: string, precio: number) => [{ Moneda: moneda, Precio: precio }];

/** codServicio 6 = NetUnoGO (paquete 1) o Premium (paquete 2), 4 = Telefonía, 7 = Salud. */
function serviciosDemo(p: URLSearchParams) {
  const codServicio = p.get('codServicio');
  if (codServicio === '6' && p.get('paquete') === '2') {
    return {
      mensualidad: [
        { Codigo: 'PR1', Paquete: 'Paquete Premium Cine', Precio: lista('$', 4.99) },
        { Codigo: 'PR2', Paquete: 'Paquete Premium Deportes', Precio: lista('$', 6.5) },
      ],
    };
  }
  if (codServicio === '6') {
    return { mensualidad: [{ Codigo: 'NG3', Paquete: 'NetUnoGO Plus 3', Precio: lista('$', 7.99) }] };
  }
  if (codServicio === '4') {
    return { mensualidad: [{ Codigo: 'TF1', Paquete: 'Telefonía Fija Ilimitada', Precio: lista('$', 3) }] };
  }
  if (codServicio === '7') {
    return {
      mensualidad: [
        { Codigo: 'SA1', Paquete: 'Salud Beneficiario Ppal', Moneda: '$', Precio: '3.50' },
        { Codigo: 'SA2', Paquete: 'Salud Beneficiario Adicional', Moneda: '$', Precio: '2.10' },
      ],
    };
  }
  return { mensualidad: [] };
}

/** El paquete Premium "Deportes" (PR2) simula un rechazo; Salud responde con `codaprobacion`. */
function activacionDemo(cuerpo: unknown) {
  const c = (cuerpo ?? {}) as { idPaquete?: string; codServicio?: number };
  if (c.idPaquete === 'PR2') return { respuesta: 1, descripcion: 'Paquete no disponible para la cuenta' };
  if (c.codServicio === 7) return { codaprobacion: 0, mensaje: 'Afiliación registrada' };
  return { respuesta: 0, mensaje: 'Servicio activado' };
}

// ── Cambio de plan ──────────────────────────────────────────────────

const internetDemo = (codigo: string, paquete: string, precios: string[], combo: string[]) => ({
  Codigo: codigo,
  Paquete: paquete,
  Precio: precios.map((precio) => ({ precio })),
  ComboDetalle: combo.map((NbrFacturacion) => ({ NbrFacturacion })),
});

/**
 * servicio 2 = Internet, 6 = Streaming; orderPaq 1 = upgrade, 2 = downgrade.
 * El contrato C-5000032 (800 Megas) ya tuvo un cambio este mes.
 */
function paquetesDemo(p: URLSearchParams) {
  const hoy = new Date();
  const ultFechaCambPaq =
    p.get('contrato') === 'C-5000032'
      ? `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01T10:00:00`
      : null;
  const upgrade = p.get('orderPaq') === '1';
  if (p.get('servicio') === '2') {
    return {
      ultFechaCambPaq,
      mensualidad: upgrade
        ? [
            internetDemo(
              '800',
              'Fibranet800_800Mb',
              ['24.99', '3.5'],
              ['Fibranet 800/800 Megas', 'Salud Integral'],
            ),
          ]
        : [
            internetDemo(
              '400',
              'Fibranet400_400Mb',
              ['16.38', '2.1'],
              ['Fibranet 400/400 Megas', 'Salud Integral'],
            ),
            internetDemo('100', 'Fibranet100_100Mb', ['9.99'], ['Fibranet 100/100 Megas']),
          ],
    };
  }
  return {
    ultFechaCambPaq,
    mensualidad: upgrade
      ? []
      : [
          {
            Codigo: '903',
            Paquete: 'NetUnoGO Plus 3',
            Precio: [{ Moneda: '$', Precio: 7.99 }],
            NbrFacturacion: 'NetUnoGO 3 pantallas simultáneas',
          },
        ],
  };
}

const campoDesk = (
  apiName: string,
  i18NLabel: string,
  type: string,
  extra: { isMandatory?: boolean; allowedValues?: string[]; defaultValue?: string } = {},
) => ({ apiName, i18NLabel, type, isMandatory: false, ...extra });

/** Diseño de tickets de Desk (GET /layouts/{id}) con todos los tipos de campo que maneja Crear ticket. */
const disenoTicketsDemo = {
  id: 'diseno-demo',
  sections: [
    {
      i18NLabel: 'Información del ticket',
      fields: [
        campoDesk('departmentId', 'Departamento', 'LookUp', { isMandatory: true }),
        campoDesk('contactId', 'Nombre de contacto', 'LookUp', { isMandatory: true }),
        campoDesk('accountId', 'Nombre de cuenta', 'LookUp'),
        campoDesk('email', 'Correo electrónico', 'Email'),
        campoDesk('phone', 'Teléfono', 'Phone'),
        campoDesk('subject', 'Asunto', 'Text'),
        campoDesk('description', 'Descripción', 'Textarea'),
        campoDesk('status', 'Estado', 'Picklist', { allowedValues: ['Nuevo', 'Abierto', 'Cerrado'] }),
        campoDesk('channel', 'Canal', 'Picklist', { allowedValues: ['Teléfono', 'Correo', 'Interno'] }),
        campoDesk('productId', 'Producto', 'LookUp'),
        campoDesk('category', 'Categoría', 'Picklist', {
          isMandatory: true,
          allowedValues: ['--Ninguna--', 'Falla técnica', 'Facturación', 'Desconexión voluntaria'],
          defaultValue: '--Ninguna--',
        }),
        campoDesk('subCategory', 'Subcategoría', 'Picklist', {
          isMandatory: true,
          allowedValues: ['--Ninguna--'],
        }),
        campoDesk('priority', 'Prioridad', 'Picklist', {
          isMandatory: true,
          allowedValues: ['--Ninguna--', 'Alta', 'Media', 'Baja'],
        }),
      ],
    },
    {
      i18NLabel: 'Información del cliente',
      fields: [
        campoDesk('cf_tipo_de_documento_de_identidad', 'Tipo de documento', 'Text'),
        campoDesk('cf_documento_de_identidad', 'Documento de identidad', 'Text'),
        campoDesk('cf_numero_de_cuenta', 'Número de cuenta', 'Text'),
        campoDesk('cf_tipo_cliente', 'Tipo de cliente', 'Picklist', { allowedValues: ['Hogar', 'Empresa'] }),
        campoDesk('cf_nro_de_cliente', 'Nro. de cliente', 'Text'),
        campoDesk('cf_ciudad', 'Ciudad', 'Text'),
        campoDesk('cf_calle', 'Calle', 'Text'),
        campoDesk('cf_operacion', 'Operación', 'Text'),
        campoDesk('cf_id_cliente_crm', 'ID cliente CRM', 'Text'),
      ],
    },
    {
      i18NLabel: 'Información técnica',
      fields: [
        campoDesk('cf_id_producto', 'Contrato', 'Text'),
        campoDesk('cf_nombre_del_plan', 'Plan', 'Text'),
        campoDesk('cf_sub_producto', 'Subproducto', 'Picklist', {
          allowedValues: ['--Ninguna--', 'FTTX', 'HFC'],
        }),
        campoDesk('cf_serial_del_equipo', 'Serial del equipo', 'Text'),
        campoDesk('cf_potencia_nas', 'Potencia', 'Text'),
        campoDesk('cf_direccion_ip', 'Dirección IP', 'Text'),
        campoDesk('cf_alquiler_de_equipo', 'Alquiler de equipo', 'Boolean'),
        campoDesk('cf_fecha_instalacion', 'Fecha de instalación', 'Date'),
        campoDesk('cf_etiquetas', 'Etiquetas', 'Multiselect', {
          allowedValues: ['Urgente', 'Reincidente', 'VIP'],
        }),
        campoDesk('cf_cantidad_de_equipos', 'Cantidad de equipos', 'Number'),
      ],
    },
    { i18NLabel: 'RCJ', fields: [campoDesk('cf_nombre_de_persona_contacto', 'Persona de contacto', 'Text')] },
    {
      i18NLabel: 'Información Visita Técnica',
      fields: [campoDesk('cf_fecha_visita', 'Fecha de la visita', 'DateTime', { isMandatory: true })],
    },
  ],
};

/** Zoho Desk simulado: respuesta (statusMessage) según método y URL, o null si no hay datos. */
export function respuestaDeskDemo(
  metodo: string,
  url: string,
  parametros: Record<string, unknown> = {},
): unknown {
  const ruta = new URL(url).pathname;
  if (ruta.endsWith('/organizations')) return organizacionesDeskDemo;
  if (ruta.includes('/agents/email/')) return { id: 'agente-demo' };
  if (ruta.endsWith('/teams')) {
    return { teams: [{ id: 'equipo-demo', name: 'Equipo Demo', departmentId: '1330306000000513713' }] };
  }
  if (ruta.endsWith('/accounts/search')) return { data: [] };
  if (ruta.endsWith('/accounts') && metodo === 'POST') return { id: 'desk-cuenta-demo' };
  if (ruta.endsWith('/contacts/search')) return { data: [{ id: 'desk-contacto-demo' }] };
  if (ruta.includes('/contacts/') && metodo === 'PATCH') return { id: 'desk-contacto-demo' };
  if (ruta.endsWith('/associateAccounts')) return { data: [] };
  if (ruta.endsWith('/layouts')) return { data: [{ id: 'diseno-demo' }] };
  if (ruta.includes('/layouts/')) return disenoTicketsDemo;
  if (ruta.endsWith('/departments')) {
    return {
      data: [
        { id: '1330306000000513713', name: 'Servicio al cliente' },
        { id: '1330306000000257029', name: 'Administración de ventas' },
        { id: 'departamento-cobranzas', name: 'Cobranzas' },
        { id: 'departamento-operaciones', name: 'Operaciones' },
      ],
    };
  }
  if (ruta.endsWith('/products/search')) {
    return {
      data: [
        { id: 'producto-internet', productName: 'Internet' },
        { id: 'producto-streaming', productName: 'Streaming' },
        { id: 'producto-telefonia', productName: 'Telefonía' },
      ],
    };
  }
  // Crear ticket: la cuenta 9000001 ya tiene un ticket abierto de Facturación
  if (ruta.endsWith('/tickets/search') && parametros.category === 'Facturación') {
    return parametros.accountName === '9000001'
      ? {
          data: [
            {
              ticketNumber: '10222',
              statusType: 'Open',
              webUrl: 'https://desk.zoho.com/support/demo/ShowHomePage.do#Cases/dv/desk-ticket-10222',
            },
          ],
        }
      : { data: [] };
  }
  if (ruta.endsWith('/dependencyMappings')) {
    return {
      data: [
        {
          parent: { displayLabel: 'Category' },
          mappings: {
            'Desconexión voluntaria': [
              'Cambio de proveedor',
              'Mudanza',
              'Costo del servicio',
              'Fallas del servicio',
            ],
            'Falla técnica': ['Sin servicio', 'Lentitud', 'Intermitencia'],
            Facturación: ['Cobro indebido', 'Pago no reflejado'],
          },
        },
      ],
    };
  }
  // Facturación: histórico de documentos (solo la primera página)
  if (
    ruta.endsWith('/tickets/search') &&
    String(parametros.customField1 ?? '').startsWith('cf_tipo_de_documento:')
  ) {
    // Solo responde con el departamento correcto: Cobranzas (buscado por nombre) o Administración de ventas
    if (!['departamento-cobranzas', '1330306000000257029'].includes(String(parametros.departmentId)))
      return '';
    if (Number(parametros.from ?? 0) > 0) return { data: [] };
    const tickets = historicoDemo(String(parametros.customField1).split(':')[1] ?? '');
    return tickets.length ? { data: tickets } : '';
  }
  // Historial: tickets del cliente por documento
  if (ruta.endsWith('/tickets/search') && parametros.customField2) return { data: ticketsHistorialDemo };
  // Baja voluntaria: la cuenta 9000004 ya tiene un ticket pendiente de aprobación
  if (
    ruta.endsWith('/tickets/search') &&
    String(parametros.status ?? '').includes('Pendiente por aprobación')
  ) {
    return parametros.accountName === '9000004'
      ? {
          data: [
            {
              ticketNumber: '10111',
              statusType: 'On Hold',
              webUrl: 'https://desk.zoho.com/support/demo/ShowHomePage.do#Cases/dv/desk-ticket-10111',
            },
          ],
        }
      : { data: [] };
  }
  if (ruta.endsWith('/tickets/search')) return { data: [] };
  if (ruta.endsWith('/tickets') && metodo === 'POST') {
    return {
      id: 'desk-ticket-demo',
      ticketNumber: '10234',
      webUrl: 'https://desk.zoho.com/support/demo/ShowHomePage.do#Cases/dv/desk-ticket-demo',
    };
  }
  return null;
}
