/**
 * Configuración de Traslado de servicio: mapa, Weezie, edificios y búsqueda de lugares.
 * Mismos valores que app/maps/maps.config.js de UnidadComercialJS (vía UnidadComercialReact).
 */

export const configMapa = {
  tile: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  selector: {
    zoom: 17,
    centroPorDefecto: [10.4806, -66.9036] as const, // Caracas
  },
} as const;

export interface ConsultaWeezie {
  lat: number;
  lon: number;
  radius: number;
  radiusMdu: number;
}

/**
 * Weezie closures/nearby (cajas NAP y edificios cercanos).
 *   fuente "muestra": respuesta guardada de Guanare (datos/weezie-muestra.json), igual que el widget actual.
 *   fuente "api":     consulta real. PENDIENTE: confirmar credenciales y ambiente (ver
 *                     widgetUnidadComercial/docs/weezie-closures-nearby.md); necesita VITE_ZCFKEY_WEEZIE.
 * consulta: punto donde se enfoca "Abrir mapa" mientras se usa la muestra.
 */
export const configWeezie = {
  fuente: 'muestra' as 'muestra' | 'api',
  url: 'https://picd.netuno.net/api/zoho/exp/v1/weezie/closures/nearby',
  consulta: { lat: 9.042429, lon: -69.755618, radius: 200, radiusMdu: 200 } satisfies ConsultaWeezie,
  zoom: 17,
  timeoutMs: 30_000,
  /** >= alto: verde, >= medio: naranja, 0: rojo. */
  puertos: { alto: 4, medio: 1 },
};

export type Puertos = typeof configWeezie.puertos;

/**
 * Vista de edificio. PENDIENTE DE CONFIRMAR CON EL CLIENTE: qué caja atiende a cada unidad y el significado de
 * bd_adduction_progress (ver la explicación en widgetUnidadComercial/app/maps/maps.config.js).
 */
export const configEdificio = {
  asignacionCaja: 'mas-cercana' as const, // "mas-cercana" | "mismo-piso" | "ninguna" | (piso, pisos) => caja
  preferirConPuertos: false,
  desempate: 'abajo' as const,
  distanciaMaxima: null,
  permitirSinPuertos: false,
  aliasPlantaBaja: ['PB', 'P.B.', 'PLANTA BAJA', '0'],
  ordenPersonalizado: {},
  avanceAcometida: {},
  prefijoObservacion: 'Ubicación en edificio',
  buscadorDesde: 30,
};

/** Búsqueda de lugares con Photon (OpenStreetMap). Google Places no se migró: en el widget actual está desactivado. */
export const configBuscador = {
  photon: { url: 'https://photon.komoot.io/api/', countrycode: 'VE', sesgoEscala: 0.3 },
  limiteLugares: 7,
  limitePuntos: 8,
  sugerencias: 5,
  minCaracteres: 3,
  esperaMs: 350,
  timeoutMs: 8000,
  zoomAlEnfocar: 18,
};

export type ConfigBuscador = typeof configBuscador;

/** Campos de Clientes (Accounts) donde se guarda la solicitud de traslado. */
export const camposTraslado = {
  modulo: 'Accounts',
  /** Multilínea grande: JSON de la solicitud. */
  solicitud: 'Solicitud_Traslado',
  /** Pendiente de confirmación / Aceptado / Rechazado. Lo usan las reglas de flujo de trabajo. */
  estado: 'Estado_Traslado',
} as const;
