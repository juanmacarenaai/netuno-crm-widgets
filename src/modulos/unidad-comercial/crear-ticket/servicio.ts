/** Operaciones de Crear ticket: diseño y datos de Zoho Desk, Netuno y Catalyst, y creación del ticket. */
import { ApiError, mensajeDeError } from '@/core/http/errores';
import { catalystApi } from '@/services/catalyst.api';
import { deskApi } from '@/services/desk.api';
import { netunoApi } from '@/services/netuno.api';
import type { Contrato, Cuenta } from '@/shared/cuentas';
import type { ContratoBoss, DatosNas } from '../contrato/tipos';
import {
  DEPARTAMENTOS_TECNICOS,
  mensajeTicketExistente,
  seccionesDelDiseno,
  TIPOS_ABIERTOS,
  valoresIniciales,
  type OpcionLookup,
  type SeccionTicket,
  type Valores,
} from './lib/formularioTicket';
import { subirImagenesPegadas } from './lib/imagenes';

export const departamentosDesk = () => deskApi.departamentos();

export interface FormularioPreparado {
  secciones: SeccionTicket[];
  valores: Valores;
  /** Opciones de los campos de búsqueda (cuenta, contacto, producto). */
  lookups: Record<string, OpcionLookup[]>;
  /** Categoría → subcategorías. */
  categorias: Record<string, string[]>;
  /** Datos que no se pudieron cargar (el formulario se puede completar a mano). */
  avisos: string[];
}

/** Producto de Desk cuyo nombre coincide con un dato del servicio (normalmente el nombre del servicio). */
async function productoDelServicio(servicio: Contrato): Promise<OpcionLookup | null> {
  const valores = Object.values(servicio);
  const producto = (await deskApi.productos()).find((p) => valores.includes(p.productName));
  return producto ? { valor: producto.id, etiqueta: producto.productName } : null;
}

/**
 * Prepara el formulario del departamento: diseño de tickets, contrato de BOSS, cuenta y contacto de Desk
 * (se crean o vinculan), producto, subcategorías, territorio y, en Operaciones/NOC con Internet, NAS y potencia.
 * Solo se consulta lo que el diseño necesita. Sin diseño o sin cuenta/contacto no se puede continuar.
 */
export async function prepararFormulario({
  departamento,
  cuenta,
  servicio,
  registro,
}: {
  departamento: { id: string; nombre: string };
  cuenta: Cuenta;
  servicio: Contrato;
  registro: Record<string, unknown>;
}): Promise<FormularioPreparado> {
  const diseno = await deskApi.disenoTickets(departamento.id);
  const secciones = seccionesDelDiseno(diseno);
  if (!diseno || secciones.length === 0) {
    throw new ApiError(
      `El departamento "${departamento.nombre}" no tiene un diseño activo de tickets en Zoho Desk.`,
    );
  }
  const apis = new Set(secciones.flatMap((s) => s.campos.map((c) => c.api)));
  const avisos: string[] = [];
  const opcional = <T>(promesa: Promise<T>, alterno: T, aviso: string): Promise<T> =>
    promesa.catch((error: unknown) => {
      console.error(aviso, error);
      avisos.push(`${aviso}: ${mensajeDeError(error)}`);
      return alterno;
    });
  const tecnico =
    (DEPARTAMENTOS_TECNICOS as readonly string[]).includes(departamento.nombre) &&
    servicio.nombreServicio === 'Internet';

  const cuentaYContacto = async () => {
    const idCuenta = await deskApi.cuentaPorNumero(cuenta.cuenta, String(registro.email ?? ''));
    const idContacto = await deskApi.contactoVinculado(registro, idCuenta, { conTelefonos: true });
    return {
      cuenta: { valor: idCuenta, etiqueta: String(cuenta.cuenta) },
      contacto: { valor: idContacto, etiqueta: String(registro.Nombres ?? registro.Account_Name ?? '') },
    };
  };

  const [boss, desk, producto, categorias, nas, potencia] = await Promise.all([
    opcional(
      netunoApi.contrato<ContratoBoss>(servicio.idProducto),
      null,
      'No se consultó el contrato en Netuno',
    ),
    apis.has('accountId') || apis.has('contactId') ? cuentaYContacto() : Promise.resolve(null),
    apis.has('productId')
      ? opcional(productoDelServicio(servicio), null, 'No se consultaron los productos de Zoho Desk')
      : Promise.resolve(null),
    apis.has('category')
      ? opcional(
          deskApi.mapeoCategorias(departamento.id),
          {} as Record<string, string[]>,
          'No se cargaron las subcategorías de Zoho Desk',
        )
      : Promise.resolve({} as Record<string, string[]>),
    tecnico
      ? opcional(
          netunoApi.datosNas<DatosNas>(servicio.idProducto),
          null,
          'No se consultaron los datos de NAS',
        )
      : Promise.resolve(null),
    tecnico
      ? opcional(
          netunoApi.valoresOpticos<{ potencia?: unknown }>(servicio.idProducto),
          null,
          'No se consultó la potencia',
        )
      : Promise.resolve(null),
  ]);

  const ciudad = boss?.ubicacion?.[0]?.ciudad;
  const territorio =
    apis.has('cf_operacion') && ciudad
      ? await opcional(
          catalystApi.nombreTerritorio(String(ciudad)),
          '',
          'No se consultó el territorio en Catalyst',
        )
      : '';

  const valores = valoresIniciales(
    secciones,
    {
      cuenta,
      servicio,
      registro,
      boss,
      departamento: departamento.nombre,
      territorio,
      producto,
      nas,
      potencia: potencia?.potencia,
    },
    { cuenta: desk?.cuenta ?? null, contacto: desk?.contacto ?? null },
    categorias,
  );
  return {
    secciones,
    valores,
    lookups: {
      accountId: desk ? [desk.cuenta] : [],
      contactId: desk ? [desk.contacto] : [],
      productId: producto ? [producto] : [],
    },
    categorias,
    avisos,
  };
}

export type ResultadoTicket =
  | { tipo: 'creado'; numero: string; url?: string; imagenesFallidas: number }
  | { tipo: 'existente'; numero: string; url?: string; mensaje: string };

/**
 * Crea el ticket (crearTicketZoho): si el cliente ya tiene un ticket abierto o en espera de la misma
 * categoría en el departamento, lo devuelve; si no, sube las imágenes pegadas y crea el ticket.
 */
export async function enviarTicket({
  parametros,
  cuenta,
  registro,
}: {
  parametros: Record<string, unknown>;
  cuenta: Pick<Cuenta, 'cuenta'>;
  registro: Record<string, unknown>;
}): Promise<ResultadoTicket> {
  const cf = (parametros.cf ?? {}) as Record<string, unknown>;
  const documento = cf.cf_documento_de_identidad ?? registro.cf_documento_de_identidad ?? '';
  const tickets = await deskApi.buscarTickets({
    departmentId: parametros.departmentId,
    ...(parametros.category ? { category: parametros.category } : {}),
    customField1: `cf_documento_de_identidad:${String(documento)}`,
    accountName: String(cuenta.cuenta),
  });
  const abierto = tickets.find((t) => (TIPOS_ABIERTOS as readonly string[]).includes(String(t.statusType)));
  if (abierto) {
    return {
      tipo: 'existente',
      numero: String(abierto.ticketNumber ?? ''),
      url: abierto.webUrl as string | undefined,
      mensaje: mensajeTicketExistente(abierto.statusType),
    };
  }

  let finales = parametros;
  let imagenesFallidas = 0;
  if (typeof parametros.description === 'string') {
    const subida = await subirImagenesPegadas(parametros.description, (archivo) =>
      catalystApi.subirArchivo(archivo),
    );
    finales = { ...parametros, description: subida.html };
    imagenesFallidas = subida.fallidas;
  }
  const ticket = await deskApi.crearTicket(finales);
  return {
    tipo: 'creado',
    numero: String(ticket.ticketNumber ?? ''),
    url: ticket.webUrl as string | undefined,
    imagenesFallidas,
  };
}
