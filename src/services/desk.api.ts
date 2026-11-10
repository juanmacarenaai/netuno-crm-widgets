/**
 * Zoho Desk a través de la conexión `entorno.conexiones.desk`.
 * La organización y sus IDs (departamentos, productos) cambian por entorno: ver core/config/entornos.ts.
 */
import { entorno } from '@/core/config';
import { invocarConexion } from '@/core/zoho/sdk';
import type { MetodoHttp, PeticionConexion } from '@/core/zoho/tipos';

type Parametros = Record<string, unknown>;

/** Campo de un diseño de tickets de Desk (GET /layouts/{id}). */
export interface CampoDisenoDesk {
  apiName: string;
  i18NLabel?: string;
  displayLabel?: string;
  type: string;
  isMandatory?: boolean;
  allowedValues?: string[] | null;
  defaultValue?: string | null;
}

export interface DisenoTicketsDesk {
  id?: string;
  sections?: { i18NLabel?: string; fields?: CampoDisenoDesk[] }[];
}

interface ListaDesk<T> {
  data?: T[];
}

export interface OrganizacionDesk {
  id: string;
  companyName?: string;
  portalName?: string;
  isDefault?: boolean;
  [clave: string]: unknown;
}

function desk<T>(
  metodo: MetodoHttp,
  ruta: string,
  parametros: Parametros = {},
  {
    conOrganizacion = true,
    cabeceras = {},
  }: { conOrganizacion?: boolean; cabeceras?: Record<string, string> } = {},
  conexion: string = entorno.conexiones.desk,
): Promise<T> {
  const headers: Record<string, string> = { ...cabeceras };
  if (conOrganizacion && entorno.desk.orgId) headers.orgId = entorno.desk.orgId;

  const peticion: PeticionConexion = {
    method: metodo,
    url: `${entorno.desk.apiBase}${ruta}`,
    param_type: metodo === 'GET' ? 1 : 2,
    parameters: parametros,
    headers,
  };
  return invocarConexion<T>(conexion, peticion);
}

const lista = <T>(respuesta: ListaDesk<T> | '' | null | undefined): T[] =>
  respuesta && typeof respuesta === 'object' && Array.isArray(respuesta.data) ? respuesta.data : [];

export const deskApi = {
  /**
   * Organizaciones a las que llega la conexión. No necesita orgId: sirve para verificar
   * que la conexión apunta al Desk correcto (lo usa el módulo Diagnóstico).
   */
  organizaciones: async (conexion?: string) =>
    lista(
      await desk<ListaDesk<OrganizacionDesk>>(
        'GET',
        '/organizations',
        {},
        { conOrganizacion: false },
        conexion,
      ),
    ),

  agentePorEmail: (email: string) =>
    desk<{ id: string }>('GET', `/agents/email/${encodeURIComponent(email)}`),

  equiposDelAgente: async (idAgente: string) =>
    (
      await desk<{ teams?: { id?: string; name: string; departmentId?: string }[] }>(
        'GET',
        `/agents/${idAgente}/teams`,
      )
    ).teams ?? [],

  /** Cuenta de Desk por número de cuenta; si no existe se crea. */
  async cuentaPorNumero(numeroCuenta: string | number, email?: string): Promise<string> {
    const encontradas = lista(
      await desk<ListaDesk<{ id: string }>>('GET', '/accounts/search', {
        limit: '1',
        accountName: String(numeroCuenta),
      }),
    );
    if (encontradas[0]) return encontradas[0].id;
    const nueva = await desk<{ id: string }>('POST', '/accounts', {
      accountName: String(numeroCuenta),
      email,
    });
    return nueva.id;
  },

  /**
   * Contacto de Desk por documento de identidad (registro de Clientes de CRM).
   * Si existe se actualiza (cuenta y teléfonos); si no, se crea.
   */
  async contactoPorDocumento(registro: Record<string, unknown>, idCuenta: string): Promise<string> {
    const telefono = `${String(registro.Codigo_de_Celular ?? '')}-${String(registro.Tel_fono_Celular ?? '')}`;
    const encontrados = lista(
      await desk<ListaDesk<{ id: string }>>('GET', '/contacts/search', {
        limit: '1',
        customField1: `cf_documento_identidad:${String(registro.cf_documento_de_identidad ?? '')}`,
      }),
    );
    if (encontrados[0]) {
      const id = encontrados[0].id;
      await desk('PATCH', `/contacts/${id}`, {
        accountId: idCuenta,
        phone: telefono,
        mobile: registro.Phone,
      });
      return id;
    }
    const nuevo = await desk<{ id: string }>('POST', '/contacts', {
      lastName: registro.Nombres,
      cf: { cf_documento_identidad: registro.cf_documento_de_identidad },
      email: registro.email,
      accountId: idCuenta,
      phone: telefono,
      mobile: registro.Phone,
    });
    return nuevo.id;
  },

  /**
   * Contacto de Desk por documento de identidad, vinculado a la cuenta de Desk sin tocar sus datos
   * (Baja voluntaria, Crear ticket y Troubleshooting del widget jQuery):
   * si no existe se crea; si no tiene cuenta se le asigna; si tiene otra, se le asocia esta.
   */
  async contactoVinculado(
    registro: Record<string, unknown>,
    idCuenta: string,
    { conTelefonos = false }: { conTelefonos?: boolean } = {},
  ): Promise<string> {
    const documento = String(registro.cf_documento_de_identidad ?? '');
    const encontrados = lista(
      await desk<ListaDesk<{ id: string; accountId?: string | null }>>('GET', '/contacts/search', {
        limit: '1',
        customField1: `cf_documento_identidad:${documento}`,
      }),
    );
    const existente = encontrados[0];
    if (!existente) {
      const telefonos = conTelefonos
        ? {
            phone: `${String(registro.Codigo_de_Celular ?? '')}-${String(registro.Tel_fono_Celular ?? '')}`,
            mobile: registro.Phone,
          }
        : {};
      const nuevo = await desk<{ id: string }>('POST', '/contacts', {
        lastName: registro.Nombres,
        cf: { cf_documento_identidad: registro.cf_documento_de_identidad },
        email: registro.email,
        accountId: idCuenta,
        ...telefonos,
      });
      return nuevo.id;
    }
    if (!existente.accountId) {
      await desk('PATCH', `/contacts/${existente.id}`, { accountId: idCuenta });
    } else if (existente.accountId !== idCuenta) {
      await desk('POST', `/contacts/${existente.id}/associateAccounts`, {
        data: [{ id: idCuenta, isAccountTicketsViewable: true }],
      });
    }
    return existente.id;
  },

  /** Búsqueda libre de tickets (parámetros de GET /tickets/search). */
  buscarTickets: async (parametros: Parametros) =>
    lista(await desk<ListaDesk<Record<string, unknown>>>('GET', '/tickets/search', parametros)),

  /** Departamentos habilitados de Desk (Crear ticket). */
  departamentos: async () =>
    lista(
      await desk<ListaDesk<{ id: string; name: string }>>('GET', '/departments', {
        isEnabled: true,
        limit: '20',
      }),
    ),

  /** Diseño (layout) activo de tickets del departamento, con sus secciones y campos. */
  async disenoTickets(departamentoId: string): Promise<DisenoTicketsDesk | null> {
    const disenos = lista(
      await desk<ListaDesk<{ id: string }>>('GET', '/layouts', {
        module: 'tickets',
        departmentId: departamentoId,
        status: 'active',
        from: 0,
        limit: 1,
      }),
    );
    const diseno = disenos[0];
    return diseno ? desk<DisenoTicketsDesk>('GET', `/layouts/${diseno.id}`) : null;
  },

  /** Categoría → subcategorías del diseño activo de tickets del departamento (dependencyMappings). */
  async mapeoCategorias(departamentoId: string): Promise<Record<string, string[]>> {
    const disenos = lista(
      await desk<ListaDesk<{ id: string }>>('GET', '/layouts', {
        module: 'tickets',
        departmentId: departamentoId,
        status: 'active',
        from: 0,
        limit: 1,
      }),
    );
    const diseno = disenos[0];
    if (!diseno) return {};
    const mapeos = lista(
      await desk<ListaDesk<{ parent?: { displayLabel?: string }; mappings?: Record<string, string[]> }>>(
        'GET',
        '/dependencyMappings',
        { layoutId: diseno.id },
      ),
    );
    return mapeos.find((m) => m.parent?.displayLabel === 'Category')?.mappings ?? {};
  },

  /** Subcategorías de una categoría (apply_subCategory del widget jQuery). */
  subcategorias: async (departamentoId: string, categoria: string): Promise<string[]> =>
    (await deskApi.mapeoCategorias(departamentoId))[categoria] ?? [],

  /** Productos de Desk (Internet, Streaming, Telefonía...). */
  productos: async () =>
    lista(await desk<ListaDesk<{ id: string; productName: string }>>('GET', '/products/search', {})),

  ticketsDeCuenta: async (departamentoId: string, categoria: string, numeroCuenta: string | number) =>
    lista(
      await desk<ListaDesk<Record<string, unknown>>>('GET', '/tickets/search', {
        departmentId: departamentoId,
        category: categoria,
        customField1: `cf_numero_de_cuenta:${numeroCuenta}`,
      }),
    ),

  crearTicket: (parametros: Parametros) =>
    desk<Record<string, unknown> & { id: string }>('POST', '/tickets', parametros, {
      cabeceras: { 'Content-Type': 'application/json' },
    }),
};
