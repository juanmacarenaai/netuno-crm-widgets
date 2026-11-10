import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { configBuscador } from './config';
import type { Lugar, Vista } from './lib/lugares';
import { buscarLugares } from './servicios';

export type EstadoBusqueda = 'inactivo' | 'buscando' | 'listo' | 'error';

/** El texto se toma después de `esperaMs` sin teclear (uso justo del servicio público de Photon). */
function useConEspera(texto: string, esperaMs: number): string {
  const [valor, setValor] = useState(texto);
  useEffect(() => {
    const espera = setTimeout(() => setValor(texto), esperaMs);
    return () => clearTimeout(espera);
  }, [texto, esperaMs]);
  return valor;
}

/**
 * Lugares en Photon con espera entre teclas. TanStack Query cancela la búsqueda anterior y guarda en caché las
 * ya hechas. `obtenerVista` se lee al buscar (prioriza lo cercano) y no reinicia la búsqueda.
 */
export function useBuscarLugares(
  texto: string,
  obtenerVista: () => Vista | null,
  { activo = true }: { activo?: boolean } = {},
): { estado: EstadoBusqueda; lugares: Lugar[] } {
  const consulta = texto.trim();
  const habilitado = activo && consulta.length >= configBuscador.minCaracteres;
  const conEspera = useConEspera(consulta, configBuscador.esperaMs);
  const lista = conEspera === consulta;

  const busqueda = useQuery({
    queryKey: ['photon', conEspera],
    queryFn: ({ signal }) => buscarLugares(conEspera, obtenerVista(), signal),
    enabled: habilitado && lista,
    // La clave es solo el texto: un minuto de caché evita repetir la misma búsqueda sin quedarse con
    // resultados de otra zona del mapa por mucho tiempo
    staleTime: 60_000,
    retry: false,
  });

  if (!habilitado) return { estado: 'inactivo', lugares: [] };
  if (!lista || busqueda.isPending) return { estado: 'buscando', lugares: [] };
  if (busqueda.isError) return { estado: 'error', lugares: [] };
  return { estado: 'listo', lugares: busqueda.data };
}
