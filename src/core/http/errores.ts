/** Error de cualquier llamada externa (SDK de Zoho, Netuno, Desk, CRM). Los módulos solo manejan este tipo. */
export class ApiError extends Error {
  readonly codigo?: string | number;
  readonly respuesta?: unknown;

  constructor(
    mensaje: string,
    opciones: { causa?: unknown; codigo?: string | number; respuesta?: unknown } = {},
  ) {
    super(mensaje, { cause: opciones.causa });
    this.name = 'ApiError';
    this.codigo = opciones.codigo;
    this.respuesta = opciones.respuesta;
  }
}

/** Mensaje legible de cualquier error, para mostrarlo al usuario. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Ocurrió un error inesperado.';
}

/** Rechaza la promesa si no termina en `ms` milisegundos. */
export function conTimeout<T>(
  promesa: Promise<T>,
  ms: number,
  mensaje = 'Tiempo de espera excedido',
): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new ApiError(mensaje, { codigo: 'TIMEOUT' })), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}
