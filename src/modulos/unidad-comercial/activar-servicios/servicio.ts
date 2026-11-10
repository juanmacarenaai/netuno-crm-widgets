/** Operaciones de Activar servicios: paquetes y activación en Netuno, cuenta y evento en Zoho CRM. */
import { mensajeDeError } from '@/core/http/errores';
import { actualizarRegistro, insertarRegistro } from '@/services/crm.api';
import { netunoApi } from '@/services/netuno.api';
import type { Contrato, Cuenta } from '@/shared/cuentas';
import { eventoGestion, type DatosEventoGestion } from '@/shared/canal-atencion';
import {
  actualizacionCuenta,
  cuerpoActivacion,
  debeActualizarCuenta,
  EVENTO_ACTIVACION,
  paquetesDesdeRespuesta,
  parametrosConsulta,
  resultadoActivacion,
  SERVICIOS_ACTIVABLES,
  serviciosAConsultar,
  type DatosActivacion,
  type PaqueteActivable,
  type RespuestaActivacion,
  type RespuestaServicios,
  type ResultadoActivacion,
} from './lib/activarServicios';

export interface PaquetesDisponibles {
  paquetes: PaqueteActivable[];
  /** Servicios cuya consulta falló (se muestran los demás). */
  fallidos: string[];
}

/**
 * Consulta en paralelo los paquetes de cada servicio. El widget jQuery las hacía una tras otra y, si una
 * fallaba, no mostraba ninguna; aquí se muestran las que respondieron y se avisa cuáles fallaron.
 */
export async function consultarPaquetes(
  cuenta: Pick<Cuenta, 'contratos' | 'documentoIdentificacion'>,
  internet: Pick<Contrato, 'idProducto'>,
): Promise<PaquetesDisponibles> {
  const tipos = serviciosAConsultar(cuenta);
  const datos = { documento: String(cuenta.documentoIdentificacion ?? ''), idProducto: internet.idProducto };
  const resultados = await Promise.allSettled(
    tipos.map((tipo) => netunoApi.serviciosActivables<RespuestaServicios>(parametrosConsulta(tipo, datos))),
  );

  const paquetes: PaqueteActivable[] = [];
  const fallidos: string[] = [];
  resultados.forEach((resultado, i) => {
    const tipo = tipos[i];
    if (!tipo) return;
    if (resultado.status === 'fulfilled') paquetes.push(...paquetesDesdeRespuesta(tipo, resultado.value));
    else {
      console.error(`Error al consultar los paquetes de ${tipo}:`, resultado.reason);
      fallidos.push(SERVICIOS_ACTIVABLES[tipo].etiqueta);
    }
  });

  const primerError = resultados.find((r) => r.status === 'rejected');
  if (paquetes.length === 0 && fallidos.length === tipos.length && primerError) {
    throw primerError.reason;
  }
  return { paquetes, fallidos };
}

export type ResultadoGestion =
  ({ tipo: 'respuesta'; avisoCuenta?: string } & ResultadoActivacion) | { tipo: 'error'; mensaje: string };

/**
 * Activa el paquete (activarServicio). En Salud titular o adicional, además guarda sexo y fecha de
 * nacimiento del titular en la cuenta de CRM (actualizarCRM_Y_Activar); si eso falla, solo se avisa.
 */
export async function activarPaquete(datos: DatosActivacion): Promise<ResultadoGestion> {
  const actualizacion = debeActualizarCuenta(datos.paquete)
    ? actualizarRegistro('Accounts', actualizacionCuenta(datos))
    : null;

  let resultado: ResultadoGestion;
  try {
    const respuesta = await netunoApi.activarServicio<RespuestaActivacion>(cuerpoActivacion(datos));
    resultado = { tipo: 'respuesta', ...resultadoActivacion(respuesta, datos.paquete, datos.internet) };
  } catch (error) {
    console.error('Error en la activación del servicio:', error);
    resultado = { tipo: 'error', mensaje: mensajeDeError(error) };
  }

  if (actualizacion) {
    try {
      await actualizacion;
    } catch (error) {
      console.error('Error al actualizar la cuenta en CRM:', error);
      const aviso = `No se guardaron el sexo y la fecha de nacimiento del titular en CRM: ${mensajeDeError(error)}`;
      if (resultado.tipo === 'respuesta') resultado = { ...resultado, avisoCuenta: aviso };
    }
  }
  return resultado;
}

/** Evento en CRM ("Registrar canal de atención") después de la activación. */
export function registrarEventoActivacion({
  internet,
  historial,
  ...datos
}: Pick<DatosEventoGestion, 'canal' | 'cuenta' | 'registroCrm' | 'documento' | 'usuario'> & {
  internet: Contrato;
  historial: string;
}) {
  return insertarRegistro(
    'Eventos',
    eventoGestion({
      ...datos,
      nombre: EVENTO_ACTIVACION.nombre,
      registro: EVENTO_ACTIVACION.registro,
      subtipo: EVENTO_ACTIVACION.subtipo,
      descripcion: EVENTO_ACTIVACION.descripcion(historial),
      // Como el widget jQuery: el contrato, producto y servicio son los del Internet FTTH de la cuenta
      contrato: internet,
      producto: internet.nombreServicio,
      servicio: internet.nombrePaquete,
    }),
  );
}
