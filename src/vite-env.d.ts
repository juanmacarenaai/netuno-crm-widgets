/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NETUNO_CLIENT_ID?: string;
  readonly VITE_NETUNO_CLIENT_SECRET?: string;
  /** Clave de Weezie (solo con Traslado en modo "api"). */
  readonly VITE_ZCFKEY_WEEZIE?: string;
  /** Clave de las funciones de Catalyst (territorios, fallas masivas, archivos). */
  readonly VITE_ZCFKEY_CATALYST?: string;
  /** Clave del registro de conexiones de Catalyst (Historial). */
  readonly VITE_ZCFKEY_CONNECTIONLOG?: string;
  /** Reporte de fallas de Troubleshooting (node-red). */
  readonly VITE_PEM_USUARIO?: string;
  readonly VITE_PEM_CLAVE?: string;
  readonly VITE_PEM_TOKEN?: string;
  /** Fuerza el entorno ("pruebas" | "produccion") sin importar el modo del build. */
  readonly VITE_ENTORNO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Versión de package.json, inyectada por vite.config.ts. */
declare const __APP_VERSION__: string;
/** Fecha y hora (ISO) del build, inyectada por vite.config.ts. */
declare const __BUILD_TIME__: string;

interface Window {
  /** 'listo' cuando el código del widget arrancó (lo revisa la guardia de caché de index.html). */
  netunoArranco?: 'listo';
}
