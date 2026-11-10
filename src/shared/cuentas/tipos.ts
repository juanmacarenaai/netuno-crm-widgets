/**
 * Forma de la respuesta de GET /cuentas?cedularif=... (API de Netuno).
 * Solo se declaran los campos que usa el proyecto; el resto llega igual y se conserva.
 */

export interface UbicacionContrato {
  estado?: string | null;
  ciudad?: string | null;
  municipio?: string | null;
  parroquia?: string | null;
  urbanizacion?: string | null;
  avCalle?: string | null;
  calle?: string | null;
  edificioCasa?: string | null;
  [campo: string]: unknown;
}

/** Un servicio (contrato) de una cuenta: Internet, Telefonía, Streaming, Salud... */
export interface Contrato {
  idProducto: string;
  codContrato?: string;
  nombreServicio: string;
  nombrePaquete?: string | null;
  /** Nombre de facturación, p. ej. "Fibranet 600/600 Megas". */
  nombrePaqueteFact?: string | null;
  status?: string | null;
  /** Código de tecnología (31 = GPON). Define el rango de potencia óptica. */
  codTecnologia?: string | number | null;
  tipoRed?: string | null;
  serial?: string | null;
  etiqueta?: string | null;
  ubicacionJSON?: UbicacionContrato[];
  /** Número de cuenta del contrato (algunos endpoints lo repiten aquí). */
  cuenta?: string | number;
  /** Salud: nombre del asegurado (beneficiario). */
  NombreAseg?: string | null;
  [campo: string]: unknown;
}

export interface Cuenta {
  cuenta: string | number;
  /** "Hogar" | "Empresa" */
  descTipoCliente?: string | null;
  descStatusCuenta?: string | null;
  descCiudad?: string | null;
  codMunicipioFact?: string | null;
  descUrbFact?: string | null;
  saldo?: number | string | null;
  descMoneda?: string | null;
  monedaPago?: string | null;
  redes_compartidas?: string | null;
  /** 1 = Hogar, 2 = Empresa */
  codTipoCliente?: number | string | null;
  /** Documento con prefijo, como lo espera la API de cambio de plan (cedularif). */
  documentoIdentificacion?: string | null;
  nodoNas?: string | null;
  /** Nodo de la cuenta (Troubleshooting: evento masivo y posible evento masivo). */
  descNodo?: string | null;
  codNodo?: string | number | null;
  contratos?: Contrato[];
  // Facturación
  /** Código de abonado (enlace del estado de cuenta). */
  codAbonado?: string | number | null;
  /** Empresa que factura, p. ej. "NETUNO, C.A." */
  descEmpresa?: string | null;
  domiciliada?: boolean | null;
  /** Servicios de la cuenta en texto, p. ej. "Internet, Telefonía". */
  resumenServicios?: string | null;
  ultimaFechaPago?: string | null;
  fCompromisoPago?: string | null;
  [campo: string]: unknown;
}
