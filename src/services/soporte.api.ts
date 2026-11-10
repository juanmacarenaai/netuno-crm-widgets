/**
 * Servicios externos de Troubleshooting, vía ZOHO.CRM.HTTP (el servidor de Zoho hace la petición):
 * - Reporte de fallas a node-red: alimenta el cálculo de posibles eventos masivos (PEM).
 * - Asistencia remota: token (Aivo) y sesión de Zoho Assist.
 * ⚠️ Credenciales en el navegador, igual que en el widget jQuery (fase de seguridad pendiente).
 */
import { credenciales, entorno } from '@/core/config';
import { ApiError } from '@/core/http/errores';
import { httpPost } from '@/core/zoho/sdk';

/** Datos de un reporte de falla (tabla "eventos" de node-red). */
export interface ReporteFalla {
  fechaHora: string;
  nroCuenta: string;
  codNodo: string;
  nodoCatastro: string;
  nodoNas: string;
  cuentaValida: string;
  nroContrato: string;
  ciudad: string;
  ordinal: string;
  reporteFallasId: string;
  reporteFallasName: string;
}

/** Valor entre comillas para la sentencia de node-red (se escapan comillas y barras). */
const comillas = (valor: string) => `"${valor.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Sentencia INSERT que espera node-red (la misma que arma el widget jQuery). */
export function sentenciaReporte(r: ReporteFalla): string {
  const columnas = [
    ['fechaHora', r.fechaHora],
    ['timeStamp', 'No apica'],
    ['sessionId', 'No apica'],
    ['channelType', 'CRM'],
    ['nroCuenta', r.nroCuenta],
    ['codNodo', r.codNodo],
    ['nodoCatastro', r.nodoCatastro],
    ['nodoNas', r.nodoNas],
    ['cuentaValida', r.cuentaValida],
    ['nroContrato', r.nroContrato],
    ['ciudad', r.ciudad],
    ['mensaje', 'No apica'],
    ['ordinal', r.ordinal],
    ['reporteFallasId', r.reporteFallasId],
    ['reporteFallasName', r.reporteFallasName],
  ] as const;
  return `INSERT INTO eventos (${columnas.map(([c]) => c).join(',')})\n                 VALUES(${columnas
    .map(([, v]) => comillas(v))
    .join(',')})`;
}

export const soporteApi = {
  async registrarReporteFalla(reporte: ReporteFalla): Promise<void> {
    const { usuario, clave, token } = credenciales.pem;
    if (!usuario || !clave) throw new ApiError('Faltan VITE_PEM_USUARIO / VITE_PEM_CLAVE en .env.local.');
    await httpPost({
      url: entorno.pem.registro,
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${btoa(`${usuario}:${clave}`)}` },
      body: JSON.stringify({ topic: sentenciaReporte(reporte), authorization: token }),
    });
  },

  /** Crea una sesión de Zoho Assist para el correo del cliente y devuelve la URL del técnico. */
  async asistenciaRemota(correoCliente: string): Promise<string> {
    const { response: token } = await httpPost<{ response?: string }>({
      url: entorno.asistenciaRemota.token,
    });
    if (!token) throw new ApiError('No se obtuvo el token de Zoho Assist.');
    const sesion = await httpPost<{ representation?: { technician_url?: string } }>({
      url: entorno.asistenciaRemota.sesion,
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      params: { customer_email: correoCliente, type: 'rs' },
    });
    const url = sesion.representation?.technician_url;
    if (!url) throw new ApiError('Zoho Assist no devolvió la URL de la sesión.');
    return url;
  },
};
