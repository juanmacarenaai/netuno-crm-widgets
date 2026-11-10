/** Correos electrónicos: validación (Contraseñas, Facturación). */

/** Validación de correo del widget jQuery de Contraseñas (validarCorreo): parte local y dominio. */
export function correoValido(correo: string): boolean {
  const valor = correo.trim();
  if (valor.length === 0 || valor.length > 254) return false;
  const partes = valor.split('@');
  if (partes.length !== 2) return false;
  const [local = '', dominio = ''] = partes;
  if (!/^[A-Za-z0-9._%+-]{1,64}$/.test(local)) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  return /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/.test(dominio);
}

/** "a@x.com; b@y.com, c@z.com" → ["a@x.com", "b@y.com", "c@z.com"] (separados por coma, punto y coma o espacios). */
export function listaCorreos(texto: string): string[] {
  return texto
    .split(/[;,\s]+/)
    .map((c) => c.trim())
    .filter(Boolean);
}
