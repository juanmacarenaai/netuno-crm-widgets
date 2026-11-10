/** Operaciones de Contraseñas: comandos en Netuno y evento en Zoho CRM. */
import { mensajeDeError } from '@/core/http/errores';
import { insertarRegistro } from '@/services/crm.api';
import { netunoApi } from '@/services/netuno.api';
import { eventoGestion, type DatosEventoGestion } from '@/shared/canal-atencion';
import {
  confirmacionCorreo,
  correoAceptado,
  correoSinConfirmar,
  cuerpoGestion,
  MENSAJE_CORREO_RECHAZADO,
  resultadoGestion,
  wifiAdministrable,
  type ContextoGestion,
  type ResultadoCorreo,
  type ResultadoGestion,
  type TipoGestion,
  type ValoresGestion,
} from './lib/contrasenas';

/** Usuario fijo que espera el cambio de correo de NetUno Go (usuario_correo_streaming del widget jQuery). */
const USUARIO_CORREO_STREAMING = 'zohoadmin';

const sinEnvio = (error: unknown): ResultadoGestion => ({
  tono: 'error',
  mensaje:
    `No se ha logrado enviar el comando. Consulte con el administrador. ${mensajeDeError(error)}`.trim(),
});

/** Portal web, NetUno Go, control parental y WiFi: POST /contrato/contrasena/restablecer. */
export async function enviarGestion(
  tipo: TipoGestion,
  valores: ValoresGestion,
  ctx: ContextoGestion,
): Promise<ResultadoGestion> {
  try {
    const respuesta = await netunoApi.restablecerContrasena(cuerpoGestion(tipo, valores, ctx));
    return resultadoGestion(tipo, respuesta);
  } catch (error) {
    console.error('Error al enviar la gestión de contraseña:', error);
    return sinEnvio(error);
  }
}

/** La ONT del contrato permite cambiar el nombre y la contraseña del WiFi. */
export async function consultarWifi(idProducto: string): Promise<boolean> {
  return wifiAdministrable(await netunoApi.ontWifi(idProducto));
}

/**
 * Cambio de correo de NetUno Go: POST /contrato/correo/streaming y, si se acepta, GET /contrato para confirmar el
 * correo vigente (campo `serial`). `aceptado` indica si la plataforma recibió el cambio (se registra el evento).
 */
export async function cambiarCorreo(
  idProducto: string,
  correoNuevo: string,
): Promise<ResultadoCorreo & { aceptado: boolean }> {
  let respuesta: unknown;
  try {
    respuesta = await netunoApi.cambiarCorreoStreaming(idProducto, {
      correo: correoNuevo,
      usuario: USUARIO_CORREO_STREAMING,
    });
  } catch (error) {
    console.error('Error en el cambio de correo de NetUno Go:', error);
    return { ...sinEnvio(error), aceptado: false };
  }
  if (!correoAceptado(respuesta)) {
    console.warn('Cambio de correo de NetUno Go rechazado:', respuesta);
    return { tono: 'error', mensaje: MENSAJE_CORREO_RECHAZADO, aceptado: false };
  }
  try {
    const contrato = await netunoApi.contratoCorreoStreaming(idProducto);
    return { ...confirmacionCorreo(contrato, correoNuevo, idProducto), aceptado: true };
  } catch (error) {
    console.warn('No se pudo consultar el contrato después del cambio de correo:', error);
    return { ...correoSinConfirmar(idProducto), aceptado: true };
  }
}

/** Evento en CRM ("Registrar canal de atención") después de la gestión. */
export function registrarEvento(datos: DatosEventoGestion) {
  return insertarRegistro('Eventos', eventoGestion(datos));
}
