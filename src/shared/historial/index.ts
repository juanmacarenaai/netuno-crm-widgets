/**
 * Historial del cliente: lo comparten el widget Historial (tablas completas) e Historial Resumen
 * (último registro de cada pestaña, en la pestaña principal).
 *   import { PESTANAS, usePestanaHistorial } from '@/shared/historial';
 */
export * from './lib/historial';
export { consultarPestana, type ContextoHistorial, type ResultadoPestana } from './consultas';
export { claveHistorial, usePestanaHistorial } from './usePestanaHistorial';
export { TablaHistorial, type PestanaTabla } from './componentes/TablaHistorial';
