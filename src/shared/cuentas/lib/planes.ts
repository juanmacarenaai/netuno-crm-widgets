/**
 * Nombres legibles de los planes.
 * Origen: normalizarPaquete() y planActual() de UnidadComercialReact (lib/cambioPlan.js).
 * Los usan las tarjetas de cuenta y, más adelante, Cambio de plan.
 */
import type { Contrato } from '../tipos';

/** "Fibranet400_400Mb" → "400 Megas"; "...Beneficiario..." → "Beneficiario". Lo que no reconoce queda igual. */
export function normalizarPaquete(paquete: string | null | undefined): string | null | undefined {
  if (typeof paquete !== 'string') return paquete;
  if (/beneficiario/i.test(paquete)) return 'Beneficiario';
  const m = /(\d+)\s*(mb|gb)/i.exec(paquete);
  if (m) return `${m[1]} ${m[2]?.toLowerCase() === 'gb' ? 'Gigas' : 'Megas'}`;
  return paquete;
}

/** "Fibranet600_600Mb" → "600_600Mb"... la parte después del primer guion bajo. */
export const parteDespuesDeGuion = (texto: string | null | undefined) =>
  typeof texto === 'string' && texto.includes('_') ? texto.split('_')[1] : texto;

/** Plan actual del contrato. Con "Gb" se usa el nombre de facturación ("Fibranet 1Gb/500 Megas" → "1Gb/500 Megas"). */
export function planActual(
  contrato: Pick<Contrato, 'nombrePaquete' | 'nombrePaqueteFact'> | null | undefined,
): string | null | undefined {
  if (String(contrato?.nombrePaquete ?? '').includes('Gb')) {
    return String(contrato?.nombrePaqueteFact ?? '')
      .replace(/Fibranet/i, '')
      .trim();
  }
  return normalizarPaquete(parteDespuesDeGuion(contrato?.nombrePaquete));
}
