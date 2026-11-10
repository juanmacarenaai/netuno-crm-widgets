import { QueryClient } from '@tanstack/react-query';

/**
 * Caché de datos de TanStack Query, compartida por el módulo de la página.
 * Ver docs/agregar-modulo.md → "Consultar datos".
 */
export const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      // Los datos de un cliente cambian poco mientras se atiende: 1 minuto sin volver a consultar
      staleTime: 60_000,
      // Un reintento: las APIs de Netuno a veces fallan por tiempo de espera
      retry: 1,
      // El widget vive en un iframe: volver a la pestaña no debe disparar consultas
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});
