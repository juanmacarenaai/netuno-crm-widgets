import { useQuery } from '@tanstack/react-query';
import { netunoApi } from '@/services/netuno.api';
import { useZoho } from '@/shared/zoho/contexto';
import type { Cuenta } from './tipos';

/** Clave de la consulta de cuentas. Con `host` (otro ambiente de Netuno) la caché es aparte. */
export const claveCuentas = (documento: string | null, host?: string) =>
  host ? (['netuno', 'cuentas', documento, host] as const) : (['netuno', 'cuentas', documento] as const);

/**
 * Cuentas del cliente en Netuno (GET /cuentas por documento). La comparten Unidad Comercial, Resumen, Contraseñas
 * y Facturación (esta última con `host`: entornos → netuno.hostFacturacion).
 * Sin documento en el registro no se consulta (`documento` es null en el resultado).
 */
export function useCuentas({ host }: { host?: string } = {}) {
  const { documento } = useZoho();
  const consulta = useQuery({
    queryKey: claveCuentas(documento, host),
    queryFn: async () => {
      const respuesta = await netunoApi.cuentas<Cuenta[]>(documento ?? '', host);
      return Array.isArray(respuesta) ? respuesta : [];
    },
    enabled: Boolean(documento),
  });
  return { ...consulta, documento };
}
