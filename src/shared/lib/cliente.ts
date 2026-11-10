/**
 * Datos del cliente comunes a todos los módulos.
 * Origen: el PageLoad de cada widget jQuery (cf_tipo_documento + cf_documento_de_identidad).
 */

/** Prefijo del documento según `cf_tipo_documento`. */
export const PREFIJOS_DOCUMENTO: Readonly<Record<string, string>> = {
  Cédula: '',
  'Cédula Extranjera': '',
  Pasaporte: '',
  'RIF-V': 'V',
  'RIF-J': 'J',
  'RIF-E': 'E',
  Gobierno: 'G',
};

/** Documento tal como lo espera la API de Netuno (`cedularif`). */
export function armarDocumento(tipoDocumento: unknown, numero: unknown): string | null {
  const limpio = String(numero ?? '').trim();
  if (!limpio || limpio === 'null' || limpio === 'undefined') return null;
  return (PREFIJOS_DOCUMENTO[String(tipoDocumento ?? '')] ?? '') + limpio;
}

/** Documento a partir del registro de CRM de la cuenta. */
export function documentoDelRegistro(registro: Record<string, unknown>): string | null {
  return armarDocumento(registro.cf_tipo_documento, registro.cf_documento_de_identidad);
}

/** Alias del usuario (antes de la @). La API de Netuno lo recibe como "usuario". */
export function aliasDeEmail(email: unknown): string {
  return String(email ?? '').split('@')[0] ?? '';
}

/** El campo Departamento del usuario llega como lista (multiselección) o como texto. */
export function listaDeDepartamentos(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.map(String).filter(Boolean);
  if (valor === null || valor === undefined || String(valor).trim() === '') return [];
  return [String(valor)];
}
