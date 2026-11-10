/**
 * Consultas y operaciones de Facturación: Netuno (entornos → netuno.hostFacturacion), Zoho Desk (histórico de
 * documentos), correo por CRM (send_mail) y descargas por Catalyst. Cada consulta a Netuno queda en el registro de
 * conexiones, como en el widget jQuery (sin cabeceras).
 */
import { entorno } from '@/core/config';
import { crmV8 } from '@/services/crm.api';
import { deskApi } from '@/services/desk.api';
import { netunoApi } from '@/services/netuno.api';
import { conRegistro } from '@/services/registroConexiones.api';
import type { Cuenta } from '@/shared/cuentas';
import type { FilaHistorial } from '@/shared/historial';
import {
  contactosDeCuenta,
  cuerpoEnvioCorreo,
  datosDomiciliacion,
  departamentoFacturacion,
  enlaceDocumento,
  filaDocumentoDesk,
  ordenarPorCreacion,
  parametrosHistorico,
  resultadoEnvioCorreo,
  type ContactoArea,
  type Domiciliacion,
  type Movimiento,
  type PestanaHistorico,
  type Remitente,
  type ResultadoEnlace,
} from './lib/facturacion';

/** Remitente de los correos de Facturación (el mismo del widget jQuery). */
export const REMITENTE: Remitente = { nombre: 'Netuno', correo: 'netuno@netuno.net' };

const host = () => entorno.netuno.hostFacturacion;
const urlNetuno = (ruta: string) => `https://${host()}/api/zoho/exp/v1${ruta}`;
const contexto = (sesion: string) => ({ funcionalidad: 'Facturación', sesion });

/** GET a Netuno con registro de la conexión. */
function consultar<T>(
  ruta: string,
  parametros: Record<string, unknown>,
  sesion: string,
  consulta: () => Promise<T>,
) {
  return conRegistro({ metodo: 'GET', endpoint: urlNetuno(ruta), parametros }, contexto(sesion), consulta);
}

export async function consultarMovimientos(cuenta: Cuenta, sesion: string): Promise<Movimiento[]> {
  const id = String(cuenta.cuenta);
  const respuesta = await consultar('/movimientos', { cuenta: id }, sesion, () =>
    netunoApi.movimientos<unknown>(id, host()),
  );
  return Array.isArray(respuesta) ? (respuesta as Movimiento[]) : [];
}

export async function enlaceEstadoCuenta(cuenta: Cuenta, sesion: string): Promise<ResultadoEnlace> {
  const id = String(cuenta.cuenta);
  const abonado = String(cuenta.codAbonado ?? '');
  return enlaceDocumento(
    await consultar('/estado-cuenta/link', { cuenta: id, codAbonado: abonado }, sesion, () =>
      netunoApi.enlaceEstadoCuenta(id, abonado, host()),
    ),
  );
}

export async function enlaceMovimiento(
  cuenta: Cuenta,
  movimiento: Movimiento,
  sesion: string,
): Promise<ResultadoEnlace> {
  const id = String(cuenta.cuenta);
  const codMovimiento = String(movimiento.id);
  return enlaceDocumento(
    await consultar('/movimiento/link', { cuenta: id, codMovimiento }, sesion, () =>
      netunoApi.enlaceMovimiento(id, codMovimiento, host()),
    ),
  );
}

export async function consultarDomiciliacion(cuenta: Cuenta, sesion: string): Promise<Domiciliacion> {
  const id = String(cuenta.cuenta);
  return datosDomiciliacion(
    await consultar('/cuenta/domiciliada', { cuenta: id }, sesion, () =>
      netunoApi.cuentaDomiciliada(id, host()),
    ),
  );
}

export async function consultarContactos(
  documento: string,
  cuenta: Cuenta,
  sesion: string,
): Promise<ContactoArea[]> {
  return contactosDeCuenta(
    await consultar('/cliente/contacto', { cedularif: documento }, sesion, () =>
      netunoApi.contactoCliente(documento, host()),
    ),
    cuenta.cuenta,
  );
}

// ── Histórico de documentos (Zoho Desk) ─────────────────────────────

let departamentos: Promise<{ id: string; name: string }[]> | null = null;

/** Departamento de Desk de la cuenta (los departamentos se consultan una vez por sesión). */
export async function departamentoDeCuenta(cuenta: Cuenta) {
  departamentos ??= deskApi.departamentos().catch((error: unknown) => {
    departamentos = null;
    throw error;
  });
  const encontrado = departamentoFacturacion(
    cuenta.descTipoCliente,
    await departamentos,
    entorno.desk.departamentos,
  );
  if (!encontrado) {
    const nombre =
      String(cuenta.descTipoCliente).toUpperCase() === 'EMPRESA' ? 'Administración de Ventas' : 'Cobranzas';
    throw new Error(`No se encontró el departamento "${nombre}" en Zoho Desk.`);
  }
  return encontrado;
}

const POR_PAGINA_DESK = 100;
const MAXIMO_PAGINAS = 10;

/** Tickets de una pestaña del histórico, todas las páginas (como searchTicketZoho). */
export async function consultarHistorico(
  pestana: PestanaHistorico,
  cuenta: Cuenta,
  documentoSinPrefijo: string,
): Promise<FilaHistorial[]> {
  const { id } = await departamentoDeCuenta(cuenta);
  const parametros = parametrosHistorico(pestana, id, documentoSinPrefijo);
  const tickets: Record<string, unknown>[] = [];
  for (let pagina = 0; pagina < MAXIMO_PAGINAS; pagina++) {
    const lote = await deskApi.buscarTickets({
      ...parametros,
      from: pagina * POR_PAGINA_DESK,
      limit: POR_PAGINA_DESK,
    });
    tickets.push(...lote);
    if (lote.length < POR_PAGINA_DESK) break;
  }
  return ordenarPorCreacion(tickets).map((t) => filaDocumentoDesk(t, pestana));
}

// ── Correo y descargas ──────────────────────────────────────────────

/** Envía el correo con la plantilla desde el registro del cliente (POST /{módulo}/{id}/actions/send_mail). */
export async function enviarCorreo(
  modulo: string,
  idRegistro: string,
  datos: Omit<Parameters<typeof cuerpoEnvioCorreo>[0], 'remitente'>,
): Promise<{ ok: boolean; mensaje: string }> {
  const respuesta = await crmV8.post(
    `/${modulo}/${idRegistro}/actions/send_mail`,
    cuerpoEnvioCorreo({ ...datos, remitente: REMITENTE }),
  );
  return resultadoEnvioCorreo(respuesta, REMITENTE.correo);
}

/**
 * Descarga sin salir del widget: un iframe oculto carga la URL de descarga (el widget jQuery cambiaba la página
 * completa con `window.location.href`).
 */
export function descargarArchivo(url: string) {
  const marco = document.createElement('iframe');
  marco.style.display = 'none';
  marco.src = url;
  document.body.append(marco);
  window.setTimeout(() => marco.remove(), 60_000);
}
