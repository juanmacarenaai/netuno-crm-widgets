/**
 * Consulta de consumo del mes en curso (Internet y Telefonía).
 * Origen: verConsultaConsumo en verContrato() de app/index.js.
 */
import { SIN_DATOS } from '@/shared/cuentas';

export interface Periodo {
  /** "MM/AAAA", como lo pide la API. */
  fecha: string;
  inicio: string;
  fin: string;
}

export function periodoActual(ahora: Date = new Date()): Periodo {
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const anio = ahora.getFullYear();
  return {
    fecha: `${mes}/${anio}`,
    inicio: `01/${mes}/${anio}`,
    fin: new Date(anio, ahora.getMonth() + 1, 0).toLocaleDateString('es-ES'),
  };
}

/** La API responde { message } cuando no hay datos que mostrar. */
export function mensajeSinConsumo(respuesta: unknown): string | null {
  if (respuesta && typeof respuesta === 'object' && !Array.isArray(respuesta) && 'message' in respuesta) {
    return String((respuesta as { message: unknown }).message);
  }
  if (respuesta == null || (Array.isArray(respuesta) && respuesta.length === 0)) {
    return 'No hay datos de consumo para el período actual.';
  }
  return null;
}

export interface ConsumoInternetApi {
  unidadMedida?: string;
  consumoTotal?: number | string;
  fechaInicioPeriodo?: string;
  fechaFinPeriodo?: string;
  ciudad?: string;
  mac?: string;
  serial?: string;
  paquete?: string;
}

type Campos = Array<[string, unknown]>;

export function consumoInternet(
  respuesta: ConsumoInternetApi[],
  idProducto: string,
  periodo: Pick<Periodo, 'inicio' | 'fin'>,
): Campos {
  const datos = respuesta[0] ?? {};
  return [
    ['Contrato', idProducto],
    ['Unidad Medida', datos.unidadMedida ?? SIN_DATOS],
    ['Consumo Total', datos.consumoTotal ?? SIN_DATOS],
    ['Fecha Inicio', datos.fechaInicioPeriodo ?? periodo.inicio],
    ['Fecha Fin', datos.fechaFinPeriodo ?? periodo.fin],
    ['Ciudad', datos.ciudad ?? SIN_DATOS],
    ['MAC', datos.mac ?? SIN_DATOS],
    ['Serial', datos.serial ?? SIN_DATOS],
    ['Paquete', datos.paquete ?? SIN_DATOS],
  ];
}

interface BolsaApi {
  total?: number | string;
  usado?: number | string;
  restante?: number | string;
}

export interface ConsumoTelefoniaApi {
  fechaInicio?: string;
  fechaFin?: string;
  consumo?: Array<{
    cuenta?: string | number;
    nroTlf?: string;
    idAccountPO?: string;
    servicioNacional?: BolsaApi;
    servicioInternacional?: BolsaApi;
  }>;
}

export interface Bolsa {
  total: number | string;
  usado: number | string;
  restante: number | string;
}

const bolsa = (servicio: BolsaApi | undefined): Bolsa => ({
  total: servicio?.total ?? SIN_DATOS,
  usado: servicio?.usado ?? SIN_DATOS,
  restante: servicio?.restante ?? SIN_DATOS,
});

/** La respuesta de telefonía es por documento: se filtra la línea de la cuenta consultada. */
export function consumoTelefonia(
  respuesta: ConsumoTelefoniaApi,
  numeroCuenta: string | number,
  idProducto: string,
): { campos: Campos; internacional: Bolsa; nacional: Bolsa } {
  // Se comparan como texto: la cuenta puede llegar como número o como texto según el endpoint
  const linea = (respuesta.consumo ?? []).find((item) => String(item.cuenta) === String(numeroCuenta));
  return {
    campos: [
      ['Contrato', idProducto],
      ['Fecha Inicio', respuesta.fechaInicio ?? SIN_DATOS],
      ['Fecha Fin', respuesta.fechaFin ?? SIN_DATOS],
      ['Número de teléfono', linea?.nroTlf || SIN_DATOS],
      ['Id', linea?.idAccountPO || SIN_DATOS],
    ],
    internacional: bolsa(linea?.servicioInternacional),
    nacional: bolsa(linea?.servicioNacional),
  };
}
