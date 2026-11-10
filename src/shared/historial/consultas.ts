/** Consultas de cada pestaña de Historial (CRM v8, Zoho Desk y Netuno). */
import { entorno } from '@/core/config';
import { crmV8 } from '@/services/crm.api';
import { deskApi } from '@/services/desk.api';
import { netunoApi } from '@/services/netuno.api';
import { conRegistro } from '@/services/registroConexiones.api';
import type { Cuenta } from '@/shared/cuentas';
import {
  filaAtencion,
  filaComunicacion,
  filaConsumo,
  filaEvento,
  filaPago,
  filaPromocion,
  filaTicket,
  ordenarConsumo,
  ordenarTickets,
  rangoConsumo,
  rangoPagos,
  type FilaHistorial,
  type IdPestana,
} from './lib/historial';

export interface ResultadoPestana {
  filas: FilaHistorial[];
  /** Mensaje de la API cuando no hay datos (Pagos y Promociones lo envían). */
  mensaje?: string;
}

export interface ContextoHistorial {
  registro: Record<string, unknown>;
  documento: string | null;
}

type Datos = Record<string, unknown>;

const lista = (valor: unknown): Datos[] => (Array.isArray(valor) ? (valor as Datos[]) : []);
/** Netuno responde un objeto con `message`/`Message` cuando no hay datos. */
function mensajeDe(valor: unknown): string | undefined {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return undefined;
  const { message, Message } = valor as { message?: unknown; Message?: unknown };
  const m = message ?? Message;
  return m === undefined ? undefined : String(m);
}

async function busquedaCrm(modulo: string, ctx: ContextoHistorial) {
  const criterio = `(Account_Name:equals:${String(ctx.registro.id ?? '')})`;
  return conRegistro(
    {
      metodo: 'GET',
      endpoint: `${entorno.crm.apiBase}/${modulo}/search`,
      parametros: { criteria: criterio },
    },
    { funcionalidad: 'Historial', sesion: String(ctx.registro.id ?? '') },
    () => crmV8.buscar(modulo, criterio),
  );
}

const registroLog = (ctx: ContextoHistorial) => ({
  funcionalidad: 'Historial',
  sesion: String(ctx.registro.id ?? ''),
});
const urlNetuno = (ruta: string) => `https://${entorno.netuno.host}/api/zoho/exp/v1${ruta}`;

async function consumo(ctx: ContextoHistorial): Promise<ResultadoPestana> {
  const documento = ctx.documento ?? '';
  const cuentas = lista(
    await conRegistro(
      { metodo: 'GET', endpoint: urlNetuno('/cuentas'), parametros: { cedularif: documento } },
      registroLog(ctx),
      () => netunoApi.cuentas<Cuenta[]>(documento),
    ),
  ) as Cuenta[];
  const { desde, hasta } = rangoConsumo();
  const contratos = cuentas.flatMap((cuenta) =>
    (cuenta.contratos ?? [])
      .filter((c) => c.nombreServicio === 'Internet' || c.nombreServicio === 'Telefonía')
      .map((contrato) => ({ cuenta, contrato })),
  );
  // Un contrato que falla no impide mostrar los demás (como el widget jQuery)
  const resultados = await Promise.allSettled(
    contratos.map(async ({ cuenta, contrato }) => {
      const servicio = contrato.nombreServicio === 'Internet' ? 'internet' : 'telefonia';
      const respuesta = await conRegistro(
        {
          metodo: 'GET',
          endpoint: urlNetuno(`/contrato/consumo/${servicio}`),
          parametros: { fechaInicial: desde, fechaFinal: hasta, contrato: contrato.idProducto },
        },
        registroLog(ctx),
        () => netunoApi.consumoContrato(servicio, contrato.idProducto, desde, hasta),
      );
      if (mensajeDe(respuesta)) return [];
      const base = {
        cuenta: cuenta.cuenta,
        tipoNegocio: cuenta.descTipoCliente,
        nombreServicio: contrato.nombreServicio,
        contrato: contrato.idProducto,
      };
      return (Array.isArray(respuesta) ? (respuesta as Datos[]) : [respuesta as Datos]).map((item) => ({
        ...item,
        ...base,
      }));
    }),
  );
  const consumos: Datos[] = resultados.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  return { filas: ordenarConsumo(consumos).map(filaConsumo) };
}

/** Consulta de una pestaña. */
export async function consultarPestana(id: IdPestana, ctx: ContextoHistorial): Promise<ResultadoPestana> {
  const documento = ctx.documento ?? '';
  switch (id) {
    case 'atencion':
      return { filas: (await busquedaCrm('Cases', ctx)).map(filaAtencion) };
    case 'cuentas':
      return { filas: (await busquedaCrm('Eventos', ctx)).map(filaEvento) };
    case 'comunicaciones':
      return { filas: (await busquedaCrm('Comunicaciones', ctx)).map(filaComunicacion) };
    case 'tickets': {
      const parametros = {
        limit: 100,
        customField1: `cf_tipo_de_documento_de_identidad:${String(ctx.registro.cf_tipo_documento ?? '')}`,
        customField2: `cf_documento_de_identidad:${String(ctx.registro.cf_documento_de_identidad ?? '')}`,
      };
      const tickets = await conRegistro(
        { metodo: 'GET', endpoint: `${entorno.desk.apiBase}/tickets/search`, parametros },
        registroLog(ctx),
        () => deskApi.buscarTickets(parametros),
      );
      return { filas: ordenarTickets(tickets).map(filaTicket) };
    }
    case 'pagos': {
      const { desde, hasta } = rangoPagos();
      const respuesta = await conRegistro(
        {
          metodo: 'GET',
          endpoint: urlNetuno('/cuenta/notificaciones-pago'),
          parametros: { cedularif: documento, fechaInicial: desde, fechaFinal: hasta },
        },
        registroLog(ctx),
        () => netunoApi.notificacionesPago(documento, desde, hasta),
      );
      return { filas: lista(respuesta).map(filaPago), mensaje: mensajeDe(respuesta) };
    }
    case 'promociones': {
      const respuesta = await conRegistro(
        { metodo: 'GET', endpoint: urlNetuno('/cliente/promociones'), parametros: { cedularif: documento } },
        registroLog(ctx),
        () => netunoApi.promociones(documento),
      );
      return { filas: lista(respuesta).map(filaPromocion), mensaje: mensajeDe(respuesta) };
    }
    case 'consumo':
      return consumo(ctx);
  }
}
