/**
 * Reglas de presentación de cuentas y servicios. Las comparten Unidad Comercial y Resumen.
 * Origen: lib/cuentas.js de UnidadComercialReact (setDataToSections, setDataToSectionsServices,
 * verContrato y administrarCuenta en app/index.js).
 */
import type { Contrato, Cuenta } from '../tipos';
import { planActual } from './planes';

export const SIN_DATOS = 'Sin datos';
export const SIN_FECHA = 'Sin fecha';
export const NO_APLICA = 'No aplica';

export const CUENTAS_POR_PAGINA = 4;
export const SERVICIOS_POR_PAGINA = 4;

/** Igual que los widgets jQuery: solo null/undefined se reemplazan; "" se muestra tal cual. */
export function valorOSinDatos<T>(valor: T | null | undefined, alterno: string = SIN_DATOS): T | string {
  return valor ?? alterno;
}

export const estaConectado = (status: unknown): boolean => status === 'Conectado';

export function tipoCliente(cuenta: Pick<Cuenta, 'descTipoCliente'> | null | undefined): string {
  return String(cuenta?.descTipoCliente ?? '').toUpperCase();
}

export function ubicacionCuenta(cuenta: Cuenta): string {
  return `${cuenta.descCiudad} - Municipio ${cuenta.codMunicipioFact}. Urb ${cuenta.descUrbFact}`;
}

const SIMBOLOS_MONEDA: Record<string, string> = { USD: '$', VEF: 'Bs' };

function simboloMoneda(cuenta: Pick<Cuenta, 'descMoneda' | 'monedaPago'>): string {
  const moneda = cuenta.descMoneda ?? cuenta.monedaPago ?? '';
  return SIMBOLOS_MONEDA[moneda] || moneda;
}

export function saldoCuenta(cuenta: Pick<Cuenta, 'saldo' | 'descMoneda' | 'monedaPago'>): string {
  return `${simboloMoneda(cuenta)} ${cuenta.saldo}`;
}

export type TipoSaldo = 'a-favor' | 'al-dia' | 'pendiente' | 'sin-datos';

/** Saldo con su significado: negativo = a favor del cliente, positivo = deuda pendiente. */
export function estadoSaldo(cuenta: Pick<Cuenta, 'saldo' | 'descMoneda' | 'monedaPago'>): {
  tipo: TipoSaldo;
  etiqueta: string;
  monto: string;
} {
  const simbolo = simboloMoneda(cuenta);
  const valor = Number(cuenta.saldo);
  if (!Number.isFinite(valor) || cuenta.saldo === null || cuenta.saldo === '') {
    return { tipo: 'sin-datos', etiqueta: 'Saldo', monto: saldoCuenta(cuenta) };
  }
  if (valor < 0)
    return { tipo: 'a-favor', etiqueta: 'Saldo a favor', monto: `${simbolo} ${Math.abs(valor)}` };
  if (valor === 0) return { tipo: 'al-dia', etiqueta: 'Al día', monto: `${simbolo} 0` };
  return { tipo: 'pendiente', etiqueta: 'Pendiente', monto: `${simbolo} ${valor}` };
}

/** Nombre para mostrar: Internet con el plan legible ("600 Megas"); el resto, su paquete. */
export function nombreServicioLegible(
  servicio: Pick<Contrato, 'nombreServicio' | 'nombrePaquete' | 'nombrePaqueteFact'>,
): string {
  if (servicio.nombreServicio === 'Internet') return planActual(servicio) || servicio.nombrePaquete || '';
  return servicio.nombrePaquete ?? '';
}

/** "9000001 / Internet / Valores de Potencia" (el estado se dibuja aparte con PuntoEstado). */
export function rutaServicio(
  cuenta: Pick<Cuenta, 'cuenta'>,
  servicio: Pick<Contrato, 'nombreServicio'>,
  sufijo?: string | null,
): string {
  const ruta = `${cuenta.cuenta} / ${servicio.nombreServicio}`;
  return sufijo ? `${ruta} / ${sufijo}` : ruta;
}

/** El idProducto de BOSS trae prefijos: "X-Y-12345" → "12345". */
export function numeroContrato(idProducto: string | null | undefined): string {
  return idProducto?.split('-').slice(2).join('-') || SIN_DATOS;
}

/** Botones de consulta de "Ver contrato" según el servicio. */
export const CONSULTAS = {
  potencia: 'Valores de Potencia',
  olt: 'Consulta OLT',
  serial: 'Consulta Serial ONT',
  autofind: 'Consulta Autofind',
  consumo: 'Consulta Consumo',
} as const;

export type Consulta = keyof typeof CONSULTAS;

export function consultasDisponibles(nombreServicio: string): Consulta[] {
  if (nombreServicio === 'Internet') return ['potencia', 'olt', 'serial', 'autofind', 'consumo'];
  if (nombreServicio === 'Telefonía') return ['consumo'];
  return [];
}

/** En los widgets jQuery el detalle del contrato solo se abre para Internet. */
export const tieneDetalleContrato = (nombreServicio: string) => nombreServicio === 'Internet';
export const tieneTroubleshooting = (nombreServicio: string) => nombreServicio === 'Internet';

/** "Dirección completa" se muestra recortada hasta el primer punto (comportamiento conservado). */
export function direccionCorta(direccion: string | null | undefined): string {
  return direccion ? (direccion.split('.')[0] ?? '') : SIN_DATOS;
}

export function etiquetaContrato(etiqueta: string | null | undefined): string {
  return etiqueta == null || etiqueta.trim() === '' ? SIN_DATOS : etiqueta;
}

export function fechaVencimiento(
  cuenta: Pick<Cuenta, 'descTipoCliente'>,
  contrato: { fecha_vencimiento?: string | null },
): string {
  return cuenta.descTipoCliente === 'Empresa'
    ? String(valorOSinDatos(contrato.fecha_vencimiento, SIN_FECHA))
    : NO_APLICA;
}

export function telefonoIpAsignado(contrato: {
  nombreServicio?: string | null;
  nro_tlf?: string | null;
}): string {
  return contrato.nombreServicio === 'Telefonía' || contrato.nombreServicio === 'Internet'
    ? String(valorOSinDatos(contrato.nro_tlf))
    : NO_APLICA;
}

/** Valores ópticos: la API devuelve "1"/"0" para estatus y conexión. */
export function textoEstadoOptico(datos: Record<string, unknown> | null | undefined, clave: string): string {
  if (!datos || !(clave in datos)) return SIN_DATOS;
  const valor = datos[clave];
  if (valor === '1') return 'Conectado';
  if (valor === '0') return 'Desconectado';
  return String(valor);
}

/**
 * Departamentos que pueden abrir "Administrar cuenta". El campo Departamento del usuario puede
 * llegar como texto o como lista (multiselección): con texto se busca por inclusión, con lista por elemento.
 */
export function puedeAdministrarCuenta(
  cuenta: Pick<Cuenta, 'descTipoCliente'>,
  departamento: string | readonly string[] | null | undefined,
): boolean {
  if (!departamento || departamento.length === 0) return false;
  const permitidos =
    cuenta.descTipoCliente === 'Hogar'
      ? ['Servicio al Cliente']
      : ['Ventas', 'Administración de Ventas', 'Servicio al Cliente'];
  return permitidos.some((valor) => departamento.includes(valor));
}
