/**
 * API de Netuno (BOSS / NAS) a través de ZOHO.CRM.HTTP.
 * Reemplaza las variables `url_*` repetidas en cada widget jQuery: un endpoint nuevo se agrega aquí, una sola vez.
 *
 * ⚠️ Las cabeceras client_id / client_secret viajan desde el navegador (igual que hoy).
 * La fase de seguridad cambia SOLO este archivo para pasar por Catalyst. Ver docs/arquitectura.md.
 */
import { credenciales, entorno } from '@/core/config';
import { ApiError, conTimeout } from '@/core/http/errores';
import { httpGet, httpPost } from '@/core/zoho/sdk';

const baseUrl = (host = entorno.netuno.host) => `https://${host}/api/zoho/exp/v1`;

function cabeceras(extra: Record<string, string> = {}): Record<string, string> {
  return {
    client_id: credenciales.netuno.clientId,
    client_secret: credenciales.netuno.clientSecret,
    Accept: '*/*',
    ...extra,
  };
}

function get<T = unknown>(ruta: string, host?: string): Promise<T> {
  return httpGet<T>({ url: `${baseUrl(host)}${ruta}`, headers: cabeceras() });
}

function post<T = unknown>(ruta: string, cuerpo: unknown, host?: string): Promise<T> {
  return httpPost<T>({
    url: `${baseUrl(host)}${ruta}`,
    headers: cabeceras({ 'Content-Type': 'application/json' }),
    body: cuerpo,
  });
}

/**
 * POST con fetch del navegador, sin ZOHO.CRM.HTTP. Solo para la activación de servicios, que el widget jQuery
 * hace así. La API de Netuno permite CORS desde widgets-netuno.onslate.com (verificado con un preflight).
 * No se aborta la petición al vencer el plazo: la activación podría completarse igual en Netuno.
 */
async function postDirecto<T = unknown>(ruta: string, cuerpo: unknown, timeoutMs: number): Promise<T> {
  const peticion = fetch(`${baseUrl()}${ruta}`, {
    method: 'POST',
    headers: cabeceras({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(cuerpo),
  });
  const respuesta = await conTimeout(
    peticion,
    timeoutMs,
    'La API de Netuno no respondió a tiempo. Verifica en Netuno si la operación se aplicó antes de reintentar.',
  );
  if (!respuesta.ok) {
    throw new ApiError(`Error en el servidor: ${respuesta.status} ${respuesta.statusText}`.trim(), {
      codigo: respuesta.status,
    });
  }
  try {
    return (await respuesta.json()) as T;
  } catch (causa) {
    throw new ApiError('Respuesta inválida del servidor.', { causa });
  }
}

const q = encodeURIComponent;

export const netunoApi = {
  // ── Cliente y cuentas (Unidad Comercial, Resumen, Contraseñas, Facturación, Historial) ──
  /** `host`: otro ambiente de Netuno (Facturación usa entornos → netuno.hostFacturacion). */
  cuentas: <T = unknown>(documento: string, host?: string) =>
    get<T>(`/cuentas?cedularif=${q(documento)}`, host),

  // ── Contrato y red (Unidad Comercial) ──
  contrato: <T = unknown>(idProducto: string) => get<T>(`/contrato?contrato=${q(idProducto)}`),
  datosNas: <T = unknown>(idProducto: string) => get<T>(`/contrato/datos-nas?contrato=${q(idProducto)}`),
  valoresOpticos: <T = unknown>(idProducto: string) =>
    get<T>(`/consultar/potencia-nas?contrato=${q(idProducto)}`),
  oltGpon: <T = unknown>(idProducto: string, nodo: string, idOnt: string) =>
    get<T>(`/consultar/olt-nas?contrato=${q(idProducto)}&nodo=${q(nodo)}&idOnt=${q(idOnt)}`),
  autofind: <T = unknown>(idProducto: string, nodo: string) =>
    get<T>(`/consultar/autofind-nas?contrato=${q(idProducto)}&nodo=${q(nodo)}`),
  serialOnt: <T = unknown>(idProducto: string) =>
    get<T>(`/consultar/ont-serial-nas?contrato=${q(idProducto)}`),

  /** Restablece la configuración operativa de la ONT (Troubleshooting). */
  refrescarOnt: <T = unknown>(idProducto: string) =>
    post<T>(`/contrato/refresh?contrato=${q(idProducto)}`, undefined),

  // ── Consumo (Unidad Comercial, Historial). La fecha "MM/AAAA" se envía sin codificar, como en los widgets actuales ──
  consumoInternet: <T = unknown>(idProducto: string, fecha: string) =>
    get<T>(`/contrato/consumo/internet?fechaInicial=${fecha}&fechaFinal=${fecha}&contrato=${q(idProducto)}`),
  consumoTelefonia: <T = unknown>(documento: string) =>
    get<T>(`/cuentas/consumo/telefonia?cedularif=${q(documento)}`),

  // ── Operaciones (Unidad Comercial) ──
  cambioEquipo: <T = unknown>(cuerpo: { serialEquipoAsignar: string; contrato: string; usuario: string }) =>
    post<T>('/contrato/cambio-equipo/sac', cuerpo),
  // orderPaq 1 = upgrade, 2 = downgrade (ver modulos/unidad-comercial/cambio-plan/config.ts)
  paquetesCambioPlan: <T = unknown>(p: {
    cuenta: string | number;
    contrato: string;
    servicio: string | number;
    tipoPaquete: string | number;
    orderPaq: 1 | 2;
  }) =>
    get<T>(
      `/cambio/paquete/consultar?cuenta=${q(String(p.cuenta))}&contrato=${q(p.contrato)}&servicio=${q(String(p.servicio))}&tipoPersona=1&tipoPaquete=${p.tipoPaquete}&orderPaq=${p.orderPaq}`,
    ),
  actualizarCambioPlan: <T = unknown>(cuerpo: unknown) => post<T>('/cambio/paquete/actualizar', cuerpo),
  /** Paquetes que se pueden activar (codServicio 4 = Telefonía, 6 = NetUnoGO/Premium, 7 = Salud). */
  serviciosActivables: <T = unknown>(parametros: Record<string, string>) =>
    get<T>(`/consultar/servicios?${new URLSearchParams(parametros).toString()}`),
  activarServicio: <T = unknown>(cuerpo: unknown) => postDirecto<T>('/activacion/servicios', cuerpo, 120_000),
  /** Indica qué contratos están paquetizados (su baja requiere aprobación). */
  contratosPaquetizados: <T = unknown>(
    contratos: { contrato: string; cuenta: string; codMotDesc: number }[],
  ) => post<T>('/consulta/contrato/paquetizado', contratos),
  /** Desconecta los contratos de inmediato. */
  bajaContratos: <T = unknown>(contratos: { contrato: string; cuenta: string; codMotDesc: number }[]) =>
    post<T>('/contratos/baja', contratos),

  // ── Facturación (host propio: entornos → netuno.hostFacturacion) ──
  movimientos: <T = unknown>(cuenta: string, host?: string) =>
    get<T>(`/movimientos?cuenta=${q(cuenta)}`, host),
  /** Enlace del PDF del estado de cuenta: `{ code: 0, data: url }`. */
  enlaceEstadoCuenta: <T = unknown>(cuenta: string, codAbonado: string, host?: string) =>
    get<T>(`/estado-cuenta/link?cuenta=${q(cuenta)}&codAbonado=${q(codAbonado)}`, host),
  /** Enlace del PDF de un movimiento (factura, nota, recibo): `{ code: 0, data: url }`. */
  enlaceMovimiento: <T = unknown>(cuenta: string, codMovimiento: string, host?: string) =>
    get<T>(`/movimiento/link?cuenta=${q(cuenta)}&codMovimiento=${q(codMovimiento)}`, host),
  cuentaDomiciliada: <T = unknown>(cuenta: string, host?: string) =>
    get<T>(`/cuenta/domiciliada?cuenta=${q(cuenta)}`, host),
  contactoCliente: <T = unknown>(documento: string, host?: string) =>
    get<T>(`/cliente/contacto?cedularif=${q(documento)}`, host),

  // ── Historial (fechas "dd/mm/aaaa" sin codificar, como el widget jQuery) ──
  notificacionesPago: <T = unknown>(documento: string, desde: string, hasta: string) =>
    get<T>(`/cuenta/notificaciones-pago?cedularif=${q(documento)}&fechaInicial=${desde}&fechaFinal=${hasta}`),
  /** Consumo de un contrato en un rango de meses ("MM/AAAA"). */
  consumoContrato: <T = unknown>(
    servicio: 'internet' | 'telefonia',
    idProducto: string,
    desde: string,
    hasta: string,
  ) =>
    get<T>(
      `/contrato/consumo/${servicio}?fechaInicial=${desde}&fechaFinal=${hasta}&contrato=${q(idProducto)}`,
    ),
  promociones: <T = unknown>(documento: string) => get<T>(`/cliente/promociones?cedularif=${q(documento)}`),

  // ── Contraseñas ──
  /** Portal web, NetUno Go, control parental y WiFi (nombre y/o contraseña): ver modulos/contrasenas/lib. */
  restablecerContrasena: <T = unknown>(cuerpo: unknown) =>
    post<T>('/contrato/contrasena/restablecer', cuerpo),
  /** Si la ONT del contrato permite cambiar el WiFi (`{ wifi: true }`). */
  ontWifi: <T = unknown>(idProducto: string) => get<T>(`/ont/wifi?Contrato=${q(idProducto)}`),
  /** Cambio del correo de acceso de NetUno Go (host propio: ver entornos.ts → hostCorreoStreaming). */
  cambiarCorreoStreaming: <T = unknown>(idProducto: string, cuerpo: { correo: string; usuario: string }) =>
    post<T>(
      `/contrato/correo/streaming?contrato=${q(idProducto)}`,
      cuerpo,
      entorno.netuno.hostCorreoStreaming,
    ),
  /** Contrato consultado en el host del cambio de correo: confirma el correo vigente (viene en `serial`). */
  contratoCorreoStreaming: <T = unknown>(idProducto: string) =>
    get<T>(`/contrato?contrato=${q(idProducto)}`, entorno.netuno.hostCorreoStreaming),
};
