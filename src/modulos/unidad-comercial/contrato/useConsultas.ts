/** Consultas de "Ver contrato" con TanStack Query: caché, reintento y estados de carga iguales para todas. */
import { useQuery } from '@tanstack/react-query';
import { netunoApi } from '@/services/netuno.api';
import type { ContratoBoss, DatosContrato, DatosNas } from './tipos';

/** Las consultas técnicas siempre muestran el dato más reciente al abrirse (sin caché "fresca"). */
const SIEMPRE_ACTUALIZAR = { staleTime: 0 } as const;

/**
 * Contrato BOSS + datos NAS de un servicio, en paralelo. Si NAS falla, el contrato se muestra igual
 * y los campos de NAS quedan "Sin datos".
 */
export function useDatosContrato(idProducto: string) {
  return useQuery({
    queryKey: ['netuno', 'contrato', idProducto],
    queryFn: async (): Promise<DatosContrato> => {
      const [contrato, nas] = await Promise.allSettled([
        netunoApi.contrato<ContratoBoss>(idProducto),
        netunoApi.datosNas<DatosNas>(idProducto),
      ]);
      if (contrato.status === 'rejected') throw contrato.reason;
      return {
        contrato: contrato.value ?? {},
        nas: nas.status === 'fulfilled' ? (nas.value ?? {}) : null,
        errorNas: nas.status === 'rejected' ? (nas.reason as Error) : null,
      };
    },
    ...SIEMPRE_ACTUALIZAR,
  });
}

/** OLT y Autofind necesitan el nodo de NAS: se reutiliza el ya cargado o se vuelve a pedir. */
async function nasDe(idProducto: string, nasCargado: DatosNas | null): Promise<DatosNas> {
  return nasCargado ?? (await netunoApi.datosNas<DatosNas>(idProducto)) ?? {};
}

export interface DatosOpticos {
  estatus?: string;
  conexion?: string;
  potencia?: string | number;
  [campo: string]: unknown;
}

export const useValoresOpticos = (idProducto: string) =>
  useQuery({
    queryKey: ['netuno', 'potencia', idProducto],
    queryFn: () => netunoApi.valoresOpticos<DatosOpticos>(idProducto),
    ...SIEMPRE_ACTUALIZAR,
  });

export type DatosOlt = Record<string, unknown> & { consumoSumario?: string };

export const useConsultaOlt = (idProducto: string, nas: DatosNas | null) =>
  useQuery({
    queryKey: ['netuno', 'olt', idProducto],
    queryFn: async () => {
      const datosNas = await nasDe(idProducto, nas);
      return netunoApi.oltGpon<DatosOlt>(
        idProducto,
        String(datosNas.nodo ?? ''),
        String(datosNas.idont ?? ''),
      );
    },
    ...SIEMPRE_ACTUALIZAR,
  });

export interface DatosAutofind {
  serialBuscado?: string;
  equipoEncontrado?: Record<string, unknown> | string;
  listadoAutofind?: string;
}

export const useConsultaAutofind = (idProducto: string, nas: DatosNas | null) =>
  useQuery({
    queryKey: ['netuno', 'autofind', idProducto],
    queryFn: async () => {
      const datosNas = await nasDe(idProducto, nas);
      return netunoApi.autofind<DatosAutofind>(idProducto, String(datosNas.nodo ?? ''));
    },
    ...SIEMPRE_ACTUALIZAR,
  });

export interface DatosSerial {
  payload?: { data?: Record<string, unknown> };
}

export const useConsultaSerial = (idProducto: string) =>
  useQuery({
    queryKey: ['netuno', 'serial', idProducto],
    queryFn: () => netunoApi.serialOnt<DatosSerial>(idProducto),
    ...SIEMPRE_ACTUALIZAR,
  });
