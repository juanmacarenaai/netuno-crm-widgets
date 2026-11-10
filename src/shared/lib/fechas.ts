/** Fecha local de hoy en "AAAA-MM-DD" (valor de un input type="date"). */
export function hoyIso(fecha = new Date()): string {
  const d = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${d(fecha.getMonth() + 1)}-${d(fecha.getDate())}`;
}
