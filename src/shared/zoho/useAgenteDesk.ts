import { useQuery } from '@tanstack/react-query';
import { deskApi } from '@/services/desk.api';
import { useZoho } from './contexto';

/**
 * Agente de Zoho Desk del usuario actual (por su email). No bloquea: si Desk no responde, devuelve null
 * y el widget sigue funcionando (igual que app/index.js).
 */
export function useAgenteDesk(): { id: string } | null {
  const { usuario } = useZoho();
  const consulta = useQuery({
    queryKey: ['desk', 'agente', usuario.email],
    queryFn: () => deskApi.agentePorEmail(usuario.email),
    staleTime: Infinity,
    retry: false,
  });
  return consulta.data ?? null;
}
