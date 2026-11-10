import { useQuery } from '@tanstack/react-query';
import { useZoho } from '@/shared/zoho/contexto';
import { consultarPestana } from './consultas';
import type { IdPestana } from './lib/historial';

export const claveHistorial = (id: IdPestana, registro: unknown) => ['historial', id, registro] as const;

/** Registros de una pestaña del cliente abierto. Se consulta la primera vez que se pide y queda en caché. */
export function usePestanaHistorial(id: IdPestana) {
  const { registro, documento } = useZoho();
  return useQuery({
    queryKey: claveHistorial(id, registro.id),
    queryFn: () => consultarPestana(id, { registro, documento }),
    staleTime: Infinity,
    retry: false,
  });
}
