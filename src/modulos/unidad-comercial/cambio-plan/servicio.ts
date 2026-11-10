/** Operaciones de Cambio de plan que combinan Netuno, Zoho Desk y Zoho CRM. */
import { entorno } from '@/core/config';
import { ApiError } from '@/core/http/errores';
import { insertarRegistro } from '@/services/crm.api';
import { deskApi } from '@/services/desk.api';
import { netunoApi } from '@/services/netuno.api';
import type { Cuenta } from '@/shared/cuentas';
import { TICKET_DOWNGRADE } from './config';
import {
  combinarPaquetes,
  cuerpoActualizarPlan,
  eventoCambioPlan,
  parametrosConsulta,
  resultadoActualizarPlan,
  ticketDowngrade,
  ticketDowngradeExistente,
  type OpcionPlan,
  type RespuestaActualizar,
  type RespuestaPaquetes,
  type ResultadoUpgrade,
  type SeleccionDowngrade,
  type ServicioElegible,
  type TicketDesk,
  type UsuarioTicket,
} from './lib/cambioPlan';

/** Upgrades y downgrades disponibles para el servicio elegido (continueCambioPlan). */
export async function consultarPaquetes(servicioElegido: ServicioElegible) {
  const up = parametrosConsulta(servicioElegido, 'U');
  const down = parametrosConsulta(servicioElegido, 'D');
  if (!up || !down) throw new ApiError(`El servicio ${servicioElegido.servicio} no admite cambio de plan.`);
  const [respuestaUp, respuestaDown] = await Promise.all([
    netunoApi.paquetesCambioPlan<RespuestaPaquetes>(up),
    netunoApi.paquetesCambioPlan<RespuestaPaquetes>(down),
  ]);
  return combinarPaquetes(respuestaUp, respuestaDown, servicioElegido.servicio);
}

/** Upgrade: se aplica de inmediato en Netuno (activarCambioPlan). */
export async function aplicarUpgrade(datos: {
  cuenta: Cuenta;
  servicioElegido: ServicioElegible;
  opcion: OpcionPlan;
  usuario: UsuarioTicket;
}): Promise<ResultadoUpgrade> {
  const respuesta = await netunoApi.actualizarCambioPlan<RespuestaActualizar>(cuerpoActualizarPlan(datos));
  return resultadoActualizarPlan(respuesta, datos.opcion, datos.servicioElegido);
}

export interface ResultadoTicket {
  estado: 'creado' | 'existente';
  numero?: string;
  url?: string;
  departamento: string;
  estadoTicket?: string;
}

/** Downgrade: ticket en Zoho Desk (crearTicketZohoCambioPlan). Si ya hay uno programado, lo devuelve. */
export async function crearTicketDowngrade({
  seleccion,
  cuenta,
  registro,
  usuario,
}: {
  seleccion: SeleccionDowngrade;
  cuenta: Cuenta;
  registro: Record<string, unknown>;
  usuario: UsuarioTicket;
}): Promise<ResultadoTicket> {
  const desk = {
    departamentos: entorno.desk.departamentos,
    productos: { Internet: entorno.desk.productos.internet, Streaming: entorno.desk.productos.streaming },
  };
  const numeroCuenta = seleccion.servicioElegido.cuenta;

  // Se valida antes de tocar Desk: sin departamento el ticket quedaría mal enrutado
  const { departamentoId: departamentoPrevisto, departamento: nombrePrevisto } = ticketDowngrade({
    seleccion,
    cuenta,
    registro,
    usuario,
    contactoId: '',
    desk,
  });
  if (!departamentoPrevisto) {
    throw new ApiError(
      `Falta el ID del departamento "${nombrePrevisto}" de Zoho Desk para el entorno ${entorno.etiqueta} (src/core/config/entornos.ts).`,
    );
  }

  const idCuenta = await deskApi.cuentaPorNumero(numeroCuenta, String(registro.email ?? ''));
  const contactoId = await deskApi.contactoPorDocumento(registro, idCuenta);
  const { parametros, departamento, departamentoId } = ticketDowngrade({
    seleccion,
    cuenta,
    registro,
    usuario,
    contactoId,
    desk,
  });

  const existentes = (await deskApi.ticketsDeCuenta(
    departamentoId ?? '',
    TICKET_DOWNGRADE.categoria,
    numeroCuenta,
  )) as TicketDesk[];
  const existente = ticketDowngradeExistente(existentes);
  if (existente) {
    return {
      estado: 'existente',
      numero: existente.ticketNumber,
      url: existente.webUrl,
      departamento,
      estadoTicket: existente.status,
    };
  }

  const ticket = (await deskApi.crearTicket(parametros)) as TicketDesk;
  return { estado: 'creado', numero: ticket.ticketNumber, url: ticket.webUrl, departamento };
}

/** Evento en CRM ("Registrar canal de atención") después de un upgrade. */
export function registrarEventoCambioPlan(datos: Parameters<typeof eventoCambioPlan>[0]) {
  return insertarRegistro('Eventos', eventoCambioPlan(datos));
}
