/**
 * Configuración por entorno: TODO lo que cambia entre pruebas y producción vive aquí.
 *
 * - "pruebas":    sandbox de Zoho CRM (Fase3) + Zoho Desk "Modo de entorno de pruebas" + Netuno QA.
 *                 Lo usan `npm run dev`, `npm run build:pruebas` y el entorno Development de Slate.
 * - "produccion": organización real. Lo usa `npm run build` y el entorno Production de Slate.
 *
 * Solo datos públicos (hosts, IDs, nombres de conexiones). Las credenciales van en .env.local.
 * Los valores sin confirmar se listan en `pendientes` y se muestran en el módulo Diagnóstico.
 */

export type NombreEntorno = 'pruebas' | 'produccion';

export interface ConfiguracionEntorno {
  readonly nombre: NombreEntorno;
  readonly etiqueta: string;
  readonly netuno: {
    /** Host de la API de Netuno (BOSS / NAS). */
    readonly host: string;
    /**
     * Host del cambio de correo de NetUno Go (Contraseñas): POST /contrato/correo/streaming y la consulta del
     * contrato que lo confirma. Al 2026-11-06 ese endpoint solo existe en desarrollo (picd).
     */
    readonly hostCorreoStreaming: string;
    /** Host de Netuno del módulo Facturación (cuentas, movimientos, documentos, domiciliación y contactos). */
    readonly hostFacturacion: string;
  };
  /** Nombres de las conexiones configuradas en Zoho CRM (Configuración → Conexiones). */
  readonly conexiones: {
    readonly crm: string;
    readonly desk: string;
  };
  readonly crm: {
    /** API REST de Zoho CRM. Se usa la versión 8 a través de la conexión `conexiones.crm`. */
    readonly apiBase: string;
  };
  /** Funciones de Catalyst del proyecto "crm" (territorios, fallas masivas, archivos). Clave: VITE_ZCFKEY_CATALYST. */
  readonly catalyst: {
    readonly funciones: string;
    /** Registro de conexiones (proyecto "connectionlog"). Clave: VITE_ZCFKEY_CONNECTIONLOG. */
    readonly registroConexiones: string;
    /** Descarga de documentos con nombre (función attachmentMule del proyecto "desk"). Sin clave. */
    readonly descargaAdjuntos: string;
  };
  /** Reporte de fallas de Troubleshooting (insumo de los posibles eventos masivos). */
  readonly pem: {
    readonly registro: string;
  };
  /** Asistencia remota (Zoho Assist) de Troubleshooting: token (Aivo) y creación de la sesión. */
  readonly asistenciaRemota: {
    readonly token: string;
    readonly sesion: string;
  };
  readonly desk: {
    readonly apiBase: string;
    readonly orgId: string | null;
    readonly departamentos: {
      /** Servicio al Cliente */
      readonly atc: string | null;
      /** Administración de Ventas */
      readonly ave: string | null;
      /** Ventas (retención de clientes Empresa en Baja voluntaria) */
      readonly ve: string | null;
      /**
       * Cobranzas (tickets de Facturación de clientes Hogar). Con null se busca por nombre entre los
       * departamentos de Desk; lo mismo hace Facturación con Administración de Ventas (Empresa).
       */
      readonly cob: string | null;
    };
    readonly productos: {
      readonly internet: string | null;
      readonly streaming: string | null;
    };
  };
  /** Datos por confirmar con el negocio o con Zoho. Se muestran en el módulo Diagnóstico. */
  readonly pendientes: readonly string[];
}

export const ENTORNOS: Readonly<Record<NombreEntorno, ConfiguracionEntorno>> = {
  pruebas: {
    nombre: 'pruebas',
    etiqueta: 'Pruebas',
    // Facturación consulta Netuno desarrollo (decisión del 2026-11-06)
    netuno: {
      host: 'picq.netuno.net',
      hostCorreoStreaming: 'picd.netuno.net',
      hostFacturacion: 'picd.netuno.net',
    },
    conexiones: {
      crm: 'crmapirequest',
      // Contraseñas e Historial (widgets del sandbox) usan "zohodeskdesarrollo"; Unidad Comercial usa "zohoouath"
      desk: 'zohodeskdesarrollo',
    },
    crm: { apiBase: 'https://www.zohoapis.com/crm/v8' },
    catalyst: {
      funciones: 'https://crm-884905664.development.catalystserverless.com/server',
      registroConexiones: 'https://connectionlog-884905664.catalystserverless.com/server/ConectionLog/AddLog',
      descargaAdjuntos: 'https://desk-884905664.catalystserverless.com/server/functions/attachmentMule',
    },
    // Troubleshooting: reporte de fallas para el cálculo de posibles eventos masivos (node-red de Macarena)
    pem: { registro: 'https://nodered.macarena.ai/api/netunoFallasMasivasDes' },
    asistenciaRemota: {
      token: 'https://studio.aivo.co/api/macarena/accesToken',
      sesion: 'https://assist.zoho.com/api/v2/session',
    },
    desk: {
      apiBase: 'https://desk.zoho.com/api/v1',
      // Zoho Desk → Configuración → API → Detalles de API (Modo de entorno de pruebas)
      orgId: '850539393',
      departamentos: { atc: '1330306000000513713', ave: '1330306000000257029', ve: null, cob: null },
      productos: { internet: '1330306001181442238', streaming: null },
    },
    pendientes: [
      'Conexión de Desk: se usa "zohodeskdesarrollo"; Unidad Comercial usaba "zohoouath". Diagnóstico prueba ambas.',
      'Producto "Streaming" de Zoho Desk en el entorno de pruebas.',
      'Departamento "Ventas" de Zoho Desk en el entorno de pruebas (Baja voluntaria con retención de clientes Empresa).',
      'Cambio de correo de NetUno Go (Contraseñas): se envía a Netuno desarrollo (picd), único ambiente con /contrato/correo/streaming; las cuentas vienen de QA (picq).',
    ],
  },
  produccion: {
    nombre: 'produccion',
    etiqueta: 'Producción',
    netuno: {
      host: 'picp.netuno.net',
      hostCorreoStreaming: 'picp.netuno.net',
      hostFacturacion: 'picp.netuno.net',
    },
    conexiones: { crm: 'crmapirequest', desk: 'zohoouath' },
    crm: { apiBase: 'https://www.zohoapis.com/crm/v8' },
    // El widget jQuery de producción también usa el entorno Development de Catalyst
    catalyst: {
      funciones: 'https://crm-884905664.development.catalystserverless.com/server',
      registroConexiones: 'https://connectionlog-884905664.catalystserverless.com/server/ConectionLog/AddLog',
      descargaAdjuntos: 'https://desk-884905664.catalystserverless.com/server/functions/attachmentMule',
    },
    // Troubleshooting: reporte de fallas para el cálculo de posibles eventos masivos (node-red de Macarena)
    pem: { registro: 'https://nodered.macarena.ai/api/netunoFallasMasivasDes' },
    asistenciaRemota: {
      token: 'https://studio.aivo.co/api/macarena/accesToken',
      sesion: 'https://assist.zoho.com/api/v2/session',
    },
    desk: {
      apiBase: 'https://desk.zoho.com/api/v1',
      orgId: '927422496',
      departamentos: {
        atc: '976322000000513713',
        ave: '976322000000257029',
        ve: '976322000000498241',
        cob: null,
      },
      productos: { internet: null, streaming: '976322000742477239' },
    },
    pendientes: [
      'Organización de Desk: 927422496 (Unidad Comercial) o 789982514 (Facturación e Historial).',
      'Producto "Internet" de Zoho Desk (976322001149945001 o 976322000742477121).',
      'Departamentos de Desk propios de Facturación (779379000000302636, 779379000000513713, 779379000000006907).',
      'Funciones de Catalyst: el widget actual de producción llama al entorno Development (crm-884905664.development).',
      'Cambio de correo de NetUno Go: Netuno debe publicar /contrato/correo/streaming en producción (hoy responde 404; solo existe en picd).',
    ],
  },
};

/**
 * Entorno según el modo de Vite. `forzado` (VITE_ENTORNO) tiene prioridad si es válido.
 * Cualquier modo distinto de "produccion" (incluido el servidor de desarrollo) usa "pruebas":
 * así un error de configuración nunca apunta a producción por accidente.
 */
export function nombreEntorno(modo: string, forzado?: string): NombreEntorno {
  if (forzado === 'pruebas' || forzado === 'produccion') return forzado;
  return modo === 'produccion' ? 'produccion' : 'pruebas';
}
