import { ENTORNOS, nombreEntorno, type ConfiguracionEntorno } from './entornos';

export type { ConfiguracionEntorno, NombreEntorno } from './entornos';

/** Configuración del entorno activo (pruebas o producción). */
export const entorno: ConfiguracionEntorno =
  ENTORNOS[nombreEntorno(import.meta.env.MODE, import.meta.env.VITE_ENTORNO)];

/**
 * Credenciales leídas de .env.local.
 * ⚠️ Viajan dentro del código del navegador (igual que en los widgets jQuery). Ver docs/arquitectura.md → Seguridad.
 */
export const credenciales = {
  netuno: {
    clientId: import.meta.env.VITE_NETUNO_CLIENT_ID ?? '',
    clientSecret: import.meta.env.VITE_NETUNO_CLIENT_SECRET ?? '',
  },
  /** Solo si Traslado usa Weezie en modo "api" (modulos/unidad-comercial/traslado/config.ts). */
  weezie: {
    zcfkey: import.meta.env.VITE_ZCFKEY_WEEZIE ?? '',
  },
  /** Funciones de Catalyst del proyecto "crm" (cabecera ZCFKEY; en el widget jQuery, ZCFKEY_Consulta_PEM). */
  catalyst: {
    zcfkey: import.meta.env.VITE_ZCFKEY_CATALYST ?? '',
    /** Registro de conexiones (en el widget jQuery, ZCFKEY_CatalystConnectionLog). Sin clave no se registra. */
    zcfkeyRegistro: import.meta.env.VITE_ZCFKEY_CONNECTIONLOG ?? '',
  },
  /** Reporte de fallas de Troubleshooting (node-red): usuario y clave Basic, y token del cuerpo. */
  pem: {
    usuario: import.meta.env.VITE_PEM_USUARIO ?? '',
    clave: import.meta.env.VITE_PEM_CLAVE ?? '',
    token: import.meta.env.VITE_PEM_TOKEN ?? '',
  },
} as const;

export const aplicacion = {
  version: __APP_VERSION__,
  compilado: __BUILD_TIME__,
  modo: import.meta.env.MODE,
} as const;

export const tiempos = {
  /** Límite de una petición a una API. */
  peticionMs: 30_000,
  /** Límite de espera del evento PageLoad de Zoho. */
  pageLoadMs: 15_000,
} as const;

const faltantes = Object.entries({
  VITE_NETUNO_CLIENT_ID: credenciales.netuno.clientId,
  VITE_NETUNO_CLIENT_SECRET: credenciales.netuno.clientSecret,
})
  .filter(([, valor]) => !valor)
  .map(([nombre]) => nombre);

if (faltantes.length > 0 && import.meta.env.MODE !== 'test') {
  console.warn(`⚠️ Variables de entorno faltantes: ${faltantes.join(', ')}. Revisa .env.example`);
}
