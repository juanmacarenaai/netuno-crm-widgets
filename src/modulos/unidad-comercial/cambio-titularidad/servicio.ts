/**
 * Servicios del Cambio de titularidad.
 *
 * ⚠ AÚN NO CONECTADOS: mientras Netuno entrega los servicios, cada función responde con datos de demostración
 * para poder validar la visual en Zoho. Al conectar uno, se reemplaza su cuerpo y se actualiza
 * docs/cambio-titularidad.md (tabla "Servicios"). Cuando estén todos, SERVICIOS_SIMULADOS pasa a false.
 */
import type { Cuenta } from '@/shared/cuentas';
import {
  elegibilidadTitularidad,
  correoNetunoGoAceptable,
  documentoDistinto,
  type Beneficiario,
  type Elegibilidad,
  type EstadoSolicitud,
  type NuevoTitular,
  type UnidadComercial,
} from './lib/cambioTitularidad';

/** true: la vista muestra el aviso de demostración y los controles para recorrer los estados. */
export const SERVICIOS_SIMULADOS = true;

const demora = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

/**
 * Saldo del titular actual y solicitudes en curso.
 * Real (pendiente): saldo en BOSS vía Mulesoft + "sin otro cambio de titularidad en curso".
 * Hoy: se evalúa con los datos de la cuenta que ya trae /cuentas (estado y saldo).
 */
export async function verificarSaldo(cuenta: Cuenta): Promise<Elegibilidad> {
  await demora(700);
  return elegibilidadTitularidad(cuenta);
}

/**
 * OCR de la cédula o el RIF del nuevo titular ("igual que en el registro de prospectos").
 * Real (pendiente): servicio de OCR de Prospectos.
 */
export async function leerDocumentoOcr(
  unidad: UnidadComercial,
  _archivo: File,
): Promise<Partial<NuevoTitular>> {
  await demora(1200);
  return unidad === 'Empresa'
    ? {
        tipoDocumento: 'RIF-J',
        documento: 'J-412345678',
        razonSocial: 'INVERSIONES COSTA AZUL 2026 C.A',
        fecha: '2019-05-14',
      }
    : {
        tipoDocumento: 'Cédula V',
        documento: 'V-18456789',
        nombres: 'MARÍA ALEJANDRA',
        apellidos: 'PÉREZ ROJAS',
        fecha: '1988-09-21',
        sexo: 'Femenino',
      };
}

/**
 * Documento del nuevo titular: distinto al actual y sin cliente activo con ese documento en CRM ni BOSS.
 * Real (pendiente): búsqueda en CRM (Clientes) + Netuno /cuentas?cedularif.
 */
export async function validarDocumentoNuevo(
  documento: string,
  documentoActual: string | null,
): Promise<boolean> {
  await demora(900);
  return documentoDistinto(documento, documentoActual);
}

/**
 * Correo de NetunoGo del nuevo titular: válido y no asociado a otro contrato NetunoGo.
 * Real (pendiente): endpoint de Netuno que confirme que el correo no está en uso.
 */
export async function validarCorreoNetunoGo(correo: string, correosActuales: string[]): Promise<boolean> {
  await demora(800);
  return correoNetunoGoAceptable(correo, correosActuales);
}

/**
 * Documento requerido de la unidad comercial.
 * Real (pendiente): por definir (adjuntos de CRM, WorkDrive o Catalyst).
 */
export async function subirDocumento(_idDocumento: string, archivo: File): Promise<{ nombre: string }> {
  await demora(600);
  return { nombre: archivo.name };
}

export interface SolicitudTitularidad {
  cuenta: string;
  unidad: UnidadComercial;
  contratos: string[];
  motivo: string;
  canal: string;
  observaciones: string;
  nuevoTitular: NuevoTitular;
  netunoGo: { correo: string } | null;
  salud: { beneficiarios: Beneficiario[] } | null;
  documentos: Record<string, string>;
  agente: string;
}

/**
 * Registra la solicitud y la envía a aprobación (Supervisor comercial / Administración de Ventas).
 * Real (pendiente): dónde vive la solicitud (ticket de Desk "Por aprobar" o registro de CRM con aprobación).
 */
export async function enviarSolicitud(_solicitud: SolicitudTitularidad): Promise<{ numero: string }> {
  await demora(1400);
  return { numero: `TIT-${Math.floor(100_000 + Math.random() * 900_000)}` };
}

export interface ResultadoTitularidad {
  nuevoCliente: string;
  cuentaBoss: string;
}

/**
 * Estado de la solicitud (aprobación, Zoho Sign y ejecución en BOSS).
 * Real (pendiente): lectura del estado; la ejecución en BOSS depende del servicio de Ingeniería NETUNO
 * comprometido para el 30/11/2026. En demostración el estado lo cambian los controles de la vista.
 */
export function resultadoDemostracion(): ResultadoTitularidad {
  return {
    nuevoCliente: String(1_500_000 + Math.floor(Math.random() * 99_999)),
    cuentaBoss: String(9_100_000 + Math.floor(Math.random() * 99_999)),
  };
}

export type { EstadoSolicitud };
