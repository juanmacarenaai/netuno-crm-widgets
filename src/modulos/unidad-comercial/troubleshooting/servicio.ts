/** Operaciones de Troubleshooting: Catalyst (TEM y PEM), Zoho Desk, Netuno, node-red y Zoho CRM. */
import { entorno } from '@/core/config';
import { mensajeDeError } from '@/core/http/errores';
import { catalystApi } from '@/services/catalyst.api';
import { insertarRegistro } from '@/services/crm.api';
import { deskApi } from '@/services/desk.api';
import { netunoApi } from '@/services/netuno.api';
import { soporteApi } from '@/services/soporte.api';
import type { Contrato, Cuenta } from '@/shared/cuentas';
import { eventoGestion, type DatosEventoGestion } from '@/shared/canal-atencion';
import {
  coberturaDelServicio,
  EVENTO_REFRESCAMIENTO,
  hayPosibleEventoMasivo,
  reporteFalla,
  TICKET_HIJO,
  ticketHijoMasivo,
  type ContratoBossTs,
  type EstadoPaso,
  type TicketPadre,
  type ValoresOpticos,
} from './lib/troubleshooting';

export interface TicketHijo {
  numero: string;
  url?: string;
  /** Se creó ahora (si no, ya existía). */
  creado: boolean;
}

export interface Diagnostico {
  /** Verificación de evento masivo confirmado. */
  tem: EstadoPaso;
  /** Verificación de posible evento masivo del nodo. */
  pem: EstadoPaso;
  masivo: { padre: TicketPadre; hijo: TicketHijo } | null;
  posibleMasivo: boolean;
  /** Verificaciones que no se pudieron hacer (se sigue con el diagnóstico). */
  avisos: string[];
}

interface Datos {
  cuenta: Cuenta;
  servicio: Contrato;
  registro: Record<string, unknown>;
}

/** Ticket hijo del cliente en el evento masivo: el abierto que ya exista o uno nuevo (crearTicketAutomatico). */
async function ticketDelEventoMasivo(
  { cuenta, servicio, registro }: Datos,
  padre: TicketPadre,
  boss: ContratoBossTs,
): Promise<TicketHijo> {
  const existentes = await deskApi.buscarTickets({
    ...(padre.departmentId ? { departmentId: padre.departmentId } : {}),
    status: TICKET_HIJO.estado,
    customField1: `cf_documento_de_identidad:${String(registro.cf_documento_de_identidad ?? '')}`,
    accountName: String(cuenta.cuenta),
  });
  const abierto = existentes.find((t) =>
    (TICKET_HIJO.tiposAbiertos as readonly string[]).includes(String(t.statusType)),
  );
  if (abierto) {
    return {
      numero: String(abierto.ticketNumber ?? ''),
      url: abierto.webUrl as string | undefined,
      creado: false,
    };
  }

  const cuentaDeskId = await deskApi.cuentaPorNumero(cuenta.cuenta, String(registro.email ?? ''));
  const contactoId = await deskApi.contactoVinculado(registro, cuentaDeskId);
  const ciudad = String(boss.ubicacion?.[0]?.ciudad ?? '');
  const [nas, potencia, territorio] = await Promise.all([
    netunoApi.datosNas<Record<string, unknown>>(servicio.idProducto).catch(() => null),
    netunoApi.valoresOpticos<ValoresOpticos>(servicio.idProducto).catch(() => null),
    ciudad ? catalystApi.nombreTerritorio(ciudad).catch(() => '') : Promise.resolve(''),
  ]);
  const ticket = await deskApi.crearTicket(
    ticketHijoMasivo({
      padre,
      boss,
      cuenta,
      registro,
      contactoId,
      cuentaDeskId,
      productoInternet: entorno.desk.productos.internet,
      nas,
      potencia: potencia?.potencia,
      territorio,
    }),
  );
  return {
    numero: String(ticket.ticketNumber ?? ''),
    url: ticket.webUrl as string | undefined,
    creado: true,
  };
}

/**
 * Primeras verificaciones (buscarTEM y buscarPEM): evento masivo confirmado (con su ticket hijo) y posible
 * evento masivo del nodo. Si una verificación no responde, se avisa y se sigue (el widget jQuery se quedaba
 * esperando). Si el ticket hijo no se puede crear, falla todo el diagnóstico (se puede reintentar).
 */
export async function diagnosticoInicial(datos: Datos): Promise<Diagnostico> {
  const avisos: string[] = [];
  let tem: EstadoPaso = 'neutro';

  const boss = await netunoApi.contrato<ContratoBossTs>(datos.servicio.idProducto).catch((error: unknown) => {
    avisos.push(`No se consultó el contrato en Netuno: ${mensajeDeError(error)}`);
    return null;
  });
  if (boss) {
    let padres: TicketPadre[] = [];
    try {
      padres =
        (await catalystApi.eventosMasivosPorCobertura<TicketPadre>(coberturaDelServicio(boss, datos.cuenta)))
          .data ?? [];
      tem = 'ok';
    } catch (error) {
      console.error('Error al buscar eventos masivos:', error);
      avisos.push(`No se pudo verificar si hay un evento masivo: ${mensajeDeError(error)}`);
    }
    const padre = padres[0];
    if (padre) {
      const hijo = await ticketDelEventoMasivo(datos, padre, boss);
      return { tem: 'falla', pem: 'neutro', masivo: { padre, hijo }, posibleMasivo: false, avisos };
    }
  }

  let pem: EstadoPaso = 'neutro';
  try {
    const respuesta = await catalystApi.posibleEventoMasivo(String(datos.cuenta.descNodo ?? ''));
    if (hayPosibleEventoMasivo(respuesta))
      return { tem, pem: 'falla', masivo: null, posibleMasivo: true, avisos };
    pem = 'ok';
  } catch (error) {
    console.error('Error al buscar un posible evento masivo:', error);
    avisos.push(`No se pudo verificar si hay un posible evento masivo: ${mensajeDeError(error)}`);
  }
  return { tem, pem, masivo: null, posibleMasivo: false, avisos };
}

/** Reporte de la falla a node-red (no bloquea: si falla, solo se registra en la consola). */
export function reportarFalla(cuenta: Cuenta, servicio: Contrato) {
  soporteApi
    .registrarReporteFalla(reporteFalla(cuenta, servicio))
    .catch((error: unknown) => console.error('No se registró el reporte de falla en node-red:', error));
}

export const consultarValoresOpticos = (servicio: Contrato) =>
  netunoApi.valoresOpticos<ValoresOpticos>(servicio.idProducto);

export const refrescarOnt = (servicio: Contrato) => netunoApi.refrescarOnt(servicio.idProducto);

export const asistenciaRemota = (correoCliente: string) => soporteApi.asistenciaRemota(correoCliente);

/** Evento en CRM después de restablecer la configuración de la ONT. */
export function registrarEventoRefrescamiento({
  servicio,
  ...datos
}: Pick<DatosEventoGestion, 'canal' | 'cuenta' | 'registroCrm' | 'documento' | 'usuario'> & {
  servicio: Contrato;
}) {
  return insertarRegistro(
    'Eventos',
    eventoGestion({
      ...datos,
      nombre: EVENTO_REFRESCAMIENTO.nombre,
      registro: EVENTO_REFRESCAMIENTO.registro,
      subtipo: EVENTO_REFRESCAMIENTO.subtipo,
      descripcion: EVENTO_REFRESCAMIENTO.descripcion,
      contrato: servicio,
      producto: servicio.nombreServicio,
    }),
  );
}
