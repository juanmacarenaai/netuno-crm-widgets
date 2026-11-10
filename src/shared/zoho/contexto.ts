import { createContext, useContext } from 'react';
import type { DatosPageLoad, Registro } from '@/core/zoho/tipos';

export interface UsuarioSesion {
  id: string;
  nombre: string;
  email: string;
  /** Parte del email antes de la @ (la API de Netuno lo recibe como "usuario"). */
  alias: string;
  rol: string | null;
  /** Departamentos para mostrar, separados por coma ("Ventas, Servicio al Cliente"). */
  departamento: string | null;
  /** Departamentos del usuario (campo de multiselección en CRM). Para reglas de permisos. */
  departamentos: string[];
  /** Campo personalizado del usuario en CRM. */
  almacen: string | null;
}

export interface SesionZoho {
  /** Datos crudos del evento PageLoad. */
  pagina: DatosPageLoad;
  /** Módulo de CRM del registro (p. ej. "Accounts"). */
  entidad: string;
  idRegistro: string;
  /** Registro completo de CRM donde está el widget. */
  registro: Registro;
  /** Documento del cliente con prefijo (cedularif), o null si el registro no lo tiene. */
  documento: string | null;
  usuario: UsuarioSesion;
  /** Vuelve a leer el registro de CRM (p. ej. después de actualizarlo). */
  recargarRegistro: () => Promise<void>;
}

export const ZohoContext = createContext<SesionZoho | null>(null);

/** Contexto de Zoho del widget: registro, documento del cliente y usuario. */
export function useZoho(): SesionZoho {
  const sesion = useContext(ZohoContext);
  if (!sesion) {
    throw new Error(
      'useZoho se usó fuera de ZohoProvider. Revisa `requiereContexto` del módulo en src/modulos.ts.',
    );
  }
  return sesion;
}
