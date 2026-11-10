/**
 * Cuentas y servicios del cliente: lo comparten Unidad Comercial y Resumen.
 *   import { useCuentas, ListaCuentas, TarjetaCuenta } from '@/shared/cuentas';
 */
export type { Contrato, Cuenta, UbicacionContrato } from './tipos';
export { useCuentas, claveCuentas } from './useCuentas';
export { iconoServicio } from './iconos';
export * from './lib/cuentas';
export { normalizarPaquete, parteDespuesDeGuion, planActual } from './lib/planes';
export { TarjetaCuenta, TarjetaCuentaEsqueleto, type TarjetaCuentaProps } from './componentes/TarjetaCuenta';
export { ListaCuentas, ListaCuentasCargando, type ListaCuentasProps } from './componentes/ListaCuentas';
export { ListaServicios, type ListaServiciosProps } from './componentes/ListaServicios';
