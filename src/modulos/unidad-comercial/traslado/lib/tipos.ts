/** Tipos de la respuesta de Weezie closures/nearby y de la unidad elegida en un edificio. */

type Numero = number | string | null | undefined;

export interface CoordenadasApi {
  lat: number;
  lon: number;
}

export interface ClosureApi {
  id: number | string;
  label: string;
  available_ports?: Numero;
  occupied_ports?: Numero;
  free_port?: Numero;
  distance?: Numero;
  coordinates?: CoordenadasApi | null;
}

export interface FloorboxApi {
  fbox_id?: number | string;
  cl_id?: number | string;
  fbox_label?: string | null;
  cl_label?: string | null;
  fbx_active?: boolean | null;
  available_ports?: Numero;
  occupied_ports?: Numero;
}

export interface FloorApi {
  floor_id?: number | string;
  floor_level?: string | number | null;
  fractions?: Array<{ fraction_id?: number | string; fraction_label?: string | number | null }>;
  floorboxes?: FloorboxApi[];
}

export interface MduApi {
  mdu_id: number | string;
  coordinates?: CoordenadasApi | null;
  mdu_plant?: {
    building_label?: string | null;
    bd_adduction_progress?: string | null;
    coordinates?: CoordenadasApi | null;
    floors?: FloorApi[];
  } | null;
}

export interface ZonaApi {
  anz_id?: number | string;
  anz_label?: string;
  closures?: ClosureApi[];
  mdus?: MduApi[];
}

/** Unidad elegida en la vista de edificio (misma forma que en UnidadComercialJS). */
export interface SeleccionUnidad {
  edificio: string;
  piso: string;
  nivel: string | number | null | undefined;
  unidad: string;
  caja: { etiqueta: string; libres: number; total: number; piso: string | undefined } | null;
  lat: number;
  lon: number;
  /** Línea para Observaciones. */
  texto: string;
}
