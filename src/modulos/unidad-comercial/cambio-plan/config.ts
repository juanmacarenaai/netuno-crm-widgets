/**
 * Reglas de Cambio de plan. Se dedujeron de continueCambioPlanSelect() del widget jQuery (UnidadComercialJS)
 * y se ajustan aquí sin tocar el código.
 */

/** Parámetros de la consulta de paquetes (/cambio/paquete/consultar) por servicio. */
export const SERVICIOS_CAMBIO_PLAN: Readonly<Record<string, { servicio: number; tipoPaquete: number }>> = {
  Internet: { servicio: 2, tipoPaquete: 1 },
  Streaming: { servicio: 6, tipoPaquete: 2 },
};

/** orderPaq de la consulta: 1 = upgrade, 2 = downgrade. */
export const TIPOS_CAMBIO = {
  U: { orderPaq: 1, etiqueta: 'Upgrade' },
  D: { orderPaq: 2, etiqueta: 'Downgrade' },
} as const;

export type TipoCambio = keyof typeof TIPOS_CAMBIO;

/**
 * Downgrade de Internet: beneficiarios adicionales de Salud que admite cada plan.
 * Se excluyen los que sobran (adicionales - permitidos). 0 = se elimina Salud.
 * Un plan que no está en la tabla no exige excluir beneficiarios.
 */
export const BENEFICIARIOS_PERMITIDOS: Readonly<Record<string, number>> = {
  '100 Megas': 0,
  '400 Megas': 1,
  '500 Megas': 1,
  '600 Megas': 2,
};

/**
 * Downgrades de Internet que van a Servicio al Cliente como "Pendiente por aprobación".
 * anterior: planes de origen (sin anterior = desde cualquier plan).
 */
export const DOWNGRADES_CON_APROBACION: ReadonlyArray<{ nuevo: string; anterior?: readonly string[] }> = [
  { nuevo: '100 Megas' },
  { nuevo: '400 Megas', anterior: ['800 Megas', '1Gb/500 Megas'] },
  { nuevo: '500 Megas', anterior: ['1Gb/500 Megas'] },
];

/** Ticket de downgrade en Zoho Desk. */
export const TICKET_DOWNGRADE = {
  canal: 'Interno',
  categoria: 'Solicitudes',
  subcategoria: 'Cambio de plan - Downgrade',
  prioridad: 'Baja',
  estadoProgramado: 'Downgrade programado',
  estadoAprobacion: 'Pendiente por aprobación',
  departamentoProgramado: { clave: 'ave', nombre: 'Administración de Ventas' },
  departamentoAprobacion: { clave: 'atc', nombre: 'Servicio al Cliente' },
  /** codMotDesc de los contratos de Salud que se excluyen. */
  motivoBajaSalud: 18,
} as const;
