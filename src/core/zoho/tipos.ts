/**
 * Tipos del SDK de widgets de Zoho CRM (ZohoEmbededAppSDK 1.2) que usa el proyecto.
 * Referencia: https://help.zwidgets.com/help/latest/index.html
 * Si se usa un método nuevo del SDK, se declara aquí primero.
 */

export interface DatosPageLoad {
  /** Módulo de CRM donde está el widget (p. ej. "Accounts"). */
  Entity: string;
  /** Id del registro. En algunas ubicaciones llega como lista. */
  EntityId: string | string[];
  [clave: string]: unknown;
}

export type Registro = Record<string, unknown> & { id: string };

export interface UsuarioCrm {
  id: string;
  full_name: string;
  email: string;
  role?: { id: string; name: string };
  profile?: { id: string; name: string };
  [clave: string]: unknown;
}

export interface PeticionHttp {
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  body?: unknown;
}

export type MetodoHttp = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface PeticionConexion {
  url: string;
  method: MetodoHttp;
  /** 1 = parámetros en la URL, 2 = en el cuerpo. */
  param_type?: 1 | 2;
  parameters?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface RespuestaConexion {
  code?: string;
  details?: { statusMessage?: unknown; [clave: string]: unknown };
  [clave: string]: unknown;
}

export interface RespuestaRegistros<T = Registro> {
  data?: T[];
  info?: Record<string, unknown>;
}

export interface ResultadoEscritura {
  code?: string;
  message?: string;
  status?: string;
  details?: Record<string, unknown>;
}

export interface ZohoSdk {
  embeddedApp: {
    on(evento: 'PageLoad', manejador: (datos: DatosPageLoad) => void): void;
    on(evento: string, manejador: (datos: unknown) => void): void;
    init(): Promise<unknown>;
  };
  CRM: {
    CONFIG: {
      getCurrentUser(): Promise<{ users?: UsuarioCrm[] }>;
      getOrgInfo?(): Promise<unknown>;
    };
    API: {
      getRecord(peticion: { Entity: string; RecordID: string }): Promise<RespuestaRegistros>;
      getUser(peticion: { ID: string }): Promise<{ users?: Registro[] }>;
      insertRecord(peticion: {
        Entity: string;
        APIData: Record<string, unknown>;
        Trigger?: string[];
      }): Promise<{ data?: ResultadoEscritura[] }>;
      updateRecord(peticion: {
        Entity: string;
        APIData: Record<string, unknown>;
        Trigger?: string[];
      }): Promise<{ data?: ResultadoEscritura[] }>;
    };
    HTTP: {
      get(peticion: PeticionHttp): Promise<string>;
      post(peticion: PeticionHttp): Promise<string>;
    };
    CONNECTION: {
      invoke(conexion: string, peticion: PeticionConexion): Promise<RespuestaConexion>;
    };
    FUNCTIONS?: {
      execute(nombre: string, datos: { arguments: string }): Promise<unknown>;
    };
  };
}

declare global {
  interface Window {
    ZOHO?: ZohoSdk;
  }
}
