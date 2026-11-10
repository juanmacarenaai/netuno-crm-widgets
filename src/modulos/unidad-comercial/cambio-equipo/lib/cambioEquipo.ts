/**
 * Cambio de equipo (pestaña "Cambio de equipo" de Administrar cuenta en el widget jQuery:
 * showTab → cambioEquipo y continueFuncionality → button_modal_cambioEquipo).
 */
import type { Registro } from '@/core/zoho/tipos';
import type { Contrato, Cuenta } from '@/shared/cuentas';
import { eventoGestion, type DatosEventoGestion } from '@/shared/canal-atencion';

/** Textos del evento de CRM que se guarda al registrar el canal de atención. */
export const EVENTO_CAMBIO_EQUIPO = {
  nombre: 'Cambio de equipo desde Zoho CRM',
  registro: 'Modificación',
  subtipo: 'Cambio de equipo',
  descripcion: 'Comando enviado exitosamente a la plataforma',
} as const;

export const MENSAJES_VALIDACION = {
  contrato: 'Debe seleccionar el contrato',
  serial: 'Serial de equipo no puede estar en blanco',
} as const;

const texto = (valor: unknown) =>
  String(valor ?? '')
    .trim()
    .toLowerCase();

/** Solo los servicios de Internet conectados admiten cambio de equipo. */
export function contratosParaCambioEquipo(cuenta: Pick<Cuenta, 'contratos'>): Contrato[] {
  return (cuenta.contratos ?? []).filter(
    (c) => texto(c.status) === 'conectado' && texto(c.nombreServicio) === 'internet',
  );
}

/** Texto de la opción del contrato: "C-123 - Internet". */
export const etiquetaContrato = (c: Pick<Contrato, 'codContrato' | 'idProducto' | 'nombreServicio'>) =>
  `${c.codContrato ?? c.idProducto} - ${c.nombreServicio}`;

export interface ErroresCambioEquipo {
  contrato?: string;
  serial?: string;
}

/** Igual que el widget jQuery: primero el contrato y después el serial (se muestra un error a la vez). */
export function validarCambioEquipo(datos: { idProducto: string; serial: string }): ErroresCambioEquipo {
  if (!datos.idProducto) return { contrato: MENSAJES_VALIDACION.contrato };
  if (!datos.serial.trim()) return { serial: MENSAJES_VALIDACION.serial };
  return {};
}

/** Cuerpo de POST /contrato/cambio-equipo/sac. `contrato` es el idProducto; `usuario`, el email sin dominio. */
export function cuerpoCambioEquipo(datos: { idProducto: string; serial: string; aliasUsuario: string }) {
  return {
    serialEquipoAsignar: datos.serial.trim(),
    contrato: datos.idProducto,
    usuario: datos.aliasUsuario,
  };
}

export interface RespuestaCambioEquipo {
  code?: number | string;
  message?: string;
  [campo: string]: unknown;
}

export interface ResultadoCambioEquipo {
  ok: boolean;
  mensaje: string;
}

/** La API responde `code: 0` cuando envió el comando a la plataforma; cualquier otro código es un rechazo. */
export function resultadoCambioEquipo(
  respuesta: RespuestaCambioEquipo | null | undefined,
): ResultadoCambioEquipo {
  const codigo = respuesta?.code;
  const ok = codigo !== undefined && codigo !== null && codigo !== '' && Number(codigo) === 0;
  const mensaje =
    String(respuesta?.message ?? '').trim() ||
    (ok ? EVENTO_CAMBIO_EQUIPO.descripcion : 'La plataforma rechazó el cambio de equipo.');
  return { ok, mensaje };
}

/** Registro del módulo Eventos de CRM (RegistrarCanalAtencion del widget jQuery). */
export function eventoCambioEquipo({
  contrato,
  registro,
  ...datos
}: Pick<DatosEventoGestion, 'canal' | 'cuenta' | 'documento' | 'usuario' | 'fecha'> & {
  contrato: Pick<Contrato, 'codContrato' | 'idProducto' | 'nombreServicio' | 'ubicacionJSON'>;
  registro: Registro | null | undefined;
}): Record<string, unknown> {
  // El widget jQuery enviaba el idProducto (valor del select) en Contrato; aquí va el código, como en las
  // demás gestiones y como el widget jQuery ya lo usaba para buscar la ciudad
  return eventoGestion({
    ...datos,
    nombre: EVENTO_CAMBIO_EQUIPO.nombre,
    registro: EVENTO_CAMBIO_EQUIPO.registro,
    subtipo: EVENTO_CAMBIO_EQUIPO.subtipo,
    descripcion: EVENTO_CAMBIO_EQUIPO.descripcion,
    contrato,
    producto: contrato.nombreServicio,
    registroCrm: registro,
  });
}
