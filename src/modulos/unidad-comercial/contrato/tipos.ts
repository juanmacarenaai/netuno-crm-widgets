/** Respuestas de la API de Netuno que usa "Ver contrato". Solo los campos que se muestran. */
import type { UbicacionContrato } from '@/shared/cuentas';

type Texto = string | null | undefined;

/** GET /contrato?contrato=<idProducto> (BOSS). */
export interface ContratoBoss {
  idProducto?: Texto;
  status?: Texto;
  nombreServicio?: Texto;
  nombrePaquete?: Texto;
  tipoRed?: Texto;
  tecnologia?: Texto;
  listaPrecio?: Texto;
  wifiActivo?: Texto;
  alquilerEquipo?: Texto;
  routerActivo?: Texto;
  modelo?: Texto;
  serial?: Texto;
  nodo?: Texto;
  coordenadasGps?: unknown;
  direccionA?: Texto;
  direccionB?: Texto;
  fechaFirma?: Texto;
  fechaInstalacion?: Texto;
  fechaConexion?: Texto;
  fechaDesconexion?: Texto;
  fechaBaja?: Texto;
  fechaHard?: Texto;
  fecha_vencimiento?: Texto;
  nro_tlf?: Texto;
  vendedor?: Texto;
  unidadVendedor?: Texto;
  ciudadVendedor?: Texto;
  etiqueta?: Texto;
  ubicacion?: UbicacionContrato[];
  [campo: string]: unknown;
}

/** GET /contrato/datos-nas?contrato=<idProducto>. */
export interface DatosNas {
  nodo?: Texto;
  tarjeta?: Texto;
  puerto?: Texto;
  ip?: Texto;
  idont?: Texto;
  vlanGpon?: Texto;
  genportGpon?: Texto;
  [campo: string]: unknown;
}

export interface DatosContrato {
  contrato: ContratoBoss;
  /** null si la consulta de NAS falló (el contrato se muestra igual). */
  nas: DatosNas | null;
  errorNas: Error | null;
}
