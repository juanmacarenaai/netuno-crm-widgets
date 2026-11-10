import { createContext, useContext } from 'react';

export type TipoAviso = 'exito' | 'error' | 'aviso' | 'info';

export interface Aviso {
  tipo?: TipoAviso;
  titulo?: string;
  texto?: string;
  /** Milisegundos antes de cerrarse solo. */
  duracion?: number;
}

export interface ContextoAvisos {
  avisar: (aviso: Aviso) => void;
}

export const AvisosContext = createContext<ContextoAvisos | null>(null);

/** Avisos flotantes breves ("Datos actualizados", "Ticket creado"...). */
export function useAvisos(): ContextoAvisos {
  // Sin proveedor (p. ej. en pruebas aisladas) los avisos se ignoran
  return useContext(AvisosContext) ?? { avisar: () => {} };
}
