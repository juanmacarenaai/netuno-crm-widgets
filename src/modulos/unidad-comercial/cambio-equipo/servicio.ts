/** Operaciones de Cambio de equipo: comando en Netuno y evento en Zoho CRM. */
import { insertarRegistro } from '@/services/crm.api';
import { netunoApi } from '@/services/netuno.api';
import {
  cuerpoCambioEquipo,
  eventoCambioEquipo,
  resultadoCambioEquipo,
  type RespuestaCambioEquipo,
  type ResultadoCambioEquipo,
} from './lib/cambioEquipo';

/** POST /contrato/cambio-equipo/sac: Netuno envía el comando a la plataforma. */
export async function cambiarEquipo(
  datos: Parameters<typeof cuerpoCambioEquipo>[0],
): Promise<ResultadoCambioEquipo> {
  const respuesta = await netunoApi.cambioEquipo<RespuestaCambioEquipo>(cuerpoCambioEquipo(datos));
  return resultadoCambioEquipo(respuesta);
}

/** Evento en CRM ("Registrar canal de atención") después de un cambio exitoso. */
export function registrarEventoCambioEquipo(datos: Parameters<typeof eventoCambioEquipo>[0]) {
  return insertarRegistro('Eventos', eventoCambioEquipo(datos));
}
