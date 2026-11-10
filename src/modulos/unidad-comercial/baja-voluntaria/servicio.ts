/** Operaciones de Baja voluntaria: Netuno (paquetizados y baja), Zoho Desk (ticket), Catalyst y CRM. */
import { entorno } from '@/core/config';
import { ApiError } from '@/core/http/errores';
import { catalystApi } from '@/services/catalyst.api';
import { insertarRegistro } from '@/services/crm.api';
import { deskApi } from '@/services/desk.api';
import { netunoApi } from '@/services/netuno.api';
import type { Contrato, Cuenta } from '@/shared/cuentas';
import { eventoGestion, type DatosEventoGestion } from '@/shared/canal-atencion';
import {
  contratosDelEvento,
  departamentoBusqueda,
  EVENTO_BAJA,
  ticketBaja,
  TICKET_BAJA,
  type ContratoBajaApi,
  type DatosTicketBaja,
  type Paquetizado,
} from './lib/bajaVoluntaria';

/** Qué contratos conectados están paquetizados (codMotDesc 0, como el widget jQuery). */
export async function consultarPaquetizados(cuenta: string | number, conectados: readonly Contrato[]) {
  const respuesta = await netunoApi.contratosPaquetizados<Paquetizado[]>(
    conectados.map((c) => ({ contrato: c.idProducto, cuenta: String(cuenta), codMotDesc: 0 })),
  );
  return Array.isArray(respuesta) ? respuesta : [];
}

export interface TicketAbierto {
  numero: string;
  url?: string;
}

/** Ticket de baja abierto o en espera del cliente (pendiente de aprobación o desconexión programada). */
export async function buscarTicketAbierto(
  cuenta: Pick<Cuenta, 'cuenta' | 'descTipoCliente'>,
  registro: Record<string, unknown>,
): Promise<TicketAbierto | null> {
  const departamento = departamentoBusqueda(cuenta, entorno.desk.departamentos);
  if (!departamento.id) {
    throw new ApiError(
      `Falta el ID del departamento "${departamento.nombre}" de Zoho Desk para el entorno ${entorno.etiqueta} (src/core/config/entornos.ts).`,
    );
  }
  const tickets = await deskApi.buscarTickets({
    departmentId: departamento.id,
    status: TICKET_BAJA.estadosBusqueda,
    customField1: `cf_documento_de_identidad:${String(registro.cf_documento_de_identidad ?? '')}`,
    accountName: String(cuenta.cuenta),
  });
  const abierto = tickets.find((t) =>
    (TICKET_BAJA.tiposAbiertos as readonly string[]).includes(String(t.statusType)),
  );
  return abierto
    ? { numero: String(abierto.ticketNumber ?? ''), url: abierto.webUrl as string | undefined }
    : null;
}

/** Subcategorías de "Desconexión voluntaria" del diseño de tickets del departamento. */
export const motivosDeBaja = (departamentoId: string) =>
  deskApi.subcategorias(departamentoId, TICKET_BAJA.categoria);

/** Desconecta los contratos en Netuno (noPaquetizado). */
export async function darDeBaja(contratos: ContratoBajaApi[]) {
  await netunoApi.bajaContratos(contratos);
}

export interface ResultadoTicketBaja {
  numero: string;
  url?: string;
}

/**
 * Crea el ticket en Desk: cuenta y contacto (se crean o vinculan si hace falta), agente y equipo del
 * departamento, y territorio de la ciudad (Catalyst). Si el territorio falla, el ticket se crea sin él.
 */
export async function crearTicketBaja(
  datos: Omit<DatosTicketBaja, 'contactoId' | 'cuentaDeskId' | 'agenteId' | 'equipoId' | 'territorio'> & {
    emailUsuario: string;
  },
): Promise<ResultadoTicketBaja> {
  const { emailUsuario, ...resto } = datos;
  const cuentaDeskId = await deskApi.cuentaPorNumero(datos.cuenta.cuenta, String(datos.registro.email ?? ''));
  const contactoId = await deskApi.contactoVinculado(datos.registro, cuentaDeskId);

  const [agente, territorio] = await Promise.all([
    deskApi.agentePorEmail(emailUsuario).catch((error: unknown) => {
      console.error('No se encontró el agente de Desk del usuario:', error);
      return null;
    }),
    catalystApi.nombreTerritorio(String(datos.cuenta.descCiudad ?? '')).catch((error: unknown) => {
      console.error('No se pudo consultar el territorio en Catalyst:', error);
      return '';
    }),
  ]);
  const equipos = agente
    ? await deskApi.equiposDelAgente(agente.id).catch((error: unknown) => {
        console.error('No se pudieron consultar los equipos del agente:', error);
        return [];
      })
    : [];
  const equipoId = equipos.find((e) => e.departmentId === datos.departamentoId)?.id ?? '';

  const ticket = await deskApi.crearTicket(
    ticketBaja({ ...resto, contactoId, cuentaDeskId, agenteId: agente?.id ?? null, equipoId, territorio }),
  );
  return { numero: String(ticket.ticketNumber ?? ''), url: ticket.webUrl as string | undefined };
}

/** Evento en CRM después de una baja inmediata. */
export function registrarEventoBaja({
  elegidos,
  ...datos
}: Pick<DatosEventoGestion, 'canal' | 'cuenta' | 'registroCrm' | 'documento' | 'usuario'> & {
  elegidos: readonly Contrato[];
}) {
  return insertarRegistro(
    'Eventos',
    eventoGestion({
      ...datos,
      nombre: EVENTO_BAJA.nombre,
      registro: EVENTO_BAJA.registro,
      subtipo: EVENTO_BAJA.subtipo,
      descripcion: EVENTO_BAJA.descripcion,
      contrato: { codContrato: contratosDelEvento(elegidos), ubicacionJSON: elegidos[0]?.ubicacionJSON },
      producto: [...new Set(elegidos.map((c) => c.nombreServicio))].join(', '),
    }),
  );
}
