/**
 * Rangos de potencia óptica (dBm) por código de tecnología.
 * Origen: validarPotencia() de app/index.js (la misma tabla aparecía 5 veces).
 */
export const RANGOS_POTENCIA: Readonly<Record<string, readonly [number, number]>> = {
  31: [-28, -3],
  3: [-7, 7],
  21: [-7, 7],
};

export const ESTADO_POTENCIA = {
  OPTIMA: 'optima',
  FUERA_DE_RANGO: 'fuera_de_rango',
  SIN_REFERENCIA: 'sin_referencia',
} as const;

export type EstadoPotencia = (typeof ESTADO_POTENCIA)[keyof typeof ESTADO_POTENCIA];

export function evaluarPotencia(codTecnologia: unknown, potencia: unknown): EstadoPotencia {
  const rango = RANGOS_POTENCIA[String(codTecnologia)];
  if (!rango) return ESTADO_POTENCIA.SIN_REFERENCIA;

  // Diferencia intencional con app/index.js: allí un valor no numérico terminaba como "óptimo"
  const valor = Number(potencia);
  if (potencia === null || potencia === undefined || potencia === '' || Number.isNaN(valor)) {
    return ESTADO_POTENCIA.SIN_REFERENCIA;
  }

  const [minimo, maximo] = rango;
  return valor < minimo || valor > maximo ? ESTADO_POTENCIA.FUERA_DE_RANGO : ESTADO_POTENCIA.OPTIMA;
}
