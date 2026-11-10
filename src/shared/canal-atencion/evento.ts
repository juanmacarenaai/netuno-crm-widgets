/**
 * Registro del módulo Eventos de CRM que guarda "Registrar canal de atención" (RegistrarCanalAtencion del
 * widget jQuery). Cada gestión aporta sus textos (nombre, registro, subtipo, descripción) y su contrato.
 */
import type { Contrato, Cuenta } from '@/shared/cuentas';
import { hoyIso } from '@/shared/lib/fechas';

export interface DatosEventoGestion {
  /** Nombre del evento, p. ej. "Cambio de equipo desde Zoho CRM". */
  nombre: string;
  /** Tipo de registro: "Modificación", "Activación"... */
  registro: string;
  subtipo: string;
  descripcion: string;
  canal: string;
  cuenta: Pick<Cuenta, 'cuenta'>;
  /** Contrato involucrado: da el código y la ciudad del evento. */
  contrato: Partial<Pick<Contrato, 'codContrato' | 'idProducto' | 'ubicacionJSON'>> | null | undefined;
  /** Producto involucrado (nombre del servicio, p. ej. "Internet"). */
  producto?: string | null;
  /** Servicio involucrado (solo activaciones). */
  servicio?: string | null;
  planNuevo?: string | null;
  planAnterior?: string | null;
  /** Registro del cliente en CRM (Accounts). */
  registroCrm: Record<string, unknown> | null | undefined;
  documento: string | null;
  usuario: { id?: string; nombre?: string } | null | undefined;
  fecha?: Date;
}

export function eventoGestion(d: DatosEventoGestion): Record<string, unknown> {
  const r: Record<string, unknown> = d.registroCrm ?? {};
  const fecha = d.fecha ?? new Date();
  return {
    Name: d.nombre,
    Owner: d.usuario?.id,
    Negocio: r.Negocio,
    Cuenta: String(d.cuenta.cuenta),
    Canal: d.canal,
    Contrato: String(d.contrato?.codContrato ?? d.contrato?.idProducto ?? ''),
    Ciudad: d.contrato?.ubicacionJSON?.[0]?.ciudad,
    // Fecha local (con toISOString, después de las 8 p. m. en Venezuela quedaba el día siguiente)
    Fecha: hoyIso(fecha),
    Registro: d.registro,
    Subtipo_de_registro: d.subtipo,
    Usuario: d.usuario?.nombre,
    Descripci_n: d.descripcion,
    Account_Name: r.id,
    Tipo_de_Documento: r.cf_tipo_documento,
    Nro_Documento: d.documento,
    N_mero_de_cliente: r.Nro_de_Cliente,
    Producto: d.producto ?? '',
    Servicio: d.servicio ?? '',
    Plan_nuevo: d.planNuevo ?? '',
    Plan_anterior: d.planAnterior ?? '',
  };
}
