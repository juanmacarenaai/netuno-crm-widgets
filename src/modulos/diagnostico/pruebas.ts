/**
 * Pruebas del módulo Diagnóstico. Se ejecutan en orden: algunas usan lo que obtuvo una anterior
 * (p. ej. Netuno necesita el documento del registro). Ninguna escribe datos.
 */
import { marcaEnEjecucion, marcaPublicada } from '@/core/actualizacion';
import { aplicacion, credenciales, entorno } from '@/core/config';
import { mensajeDeError } from '@/core/http/errores';
import { hayZoho } from '@/core/zoho/sdk';
import { idDelRegistro, iniciarSesionZoho } from '@/core/zoho/sesion';
import type { DatosPageLoad, Registro } from '@/core/zoho/tipos';
import { crmV8, obtenerOrganizacion, obtenerRegistro, obtenerUsuarioActual } from '@/services/crm.api';
import { deskApi } from '@/services/desk.api';
import { netunoApi } from '@/services/netuno.api';
import { documentoDelRegistro } from '@/shared/lib/cliente';

export type EstadoPrueba = 'ok' | 'aviso' | 'error' | 'omitido';

export interface Resultado {
  estado: EstadoPrueba;
  resumen: string;
  detalle?: unknown;
}

export interface Contexto {
  /** Número de ejecución (cada "Ejecutar de nuevo" abre una ronda). */
  ronda: number;
  pagina?: DatosPageLoad;
  registro?: Registro;
  documento?: string | null;
}

export interface Prueba {
  id: string;
  titulo: string;
  /** Qué valida y por qué importa. */
  descripcion: string;
  ejecutar: (contexto: Contexto) => Promise<Resultado>;
}

const omitida = (motivo: string): Resultado => ({ estado: 'omitido', resumen: motivo });

/** Las dos conexiones de Desk que usan hoy los widgets. Se prueban ambas para resolver cuál corresponde. */
const CONEXIONES_DESK = ['zohodeskdesarrollo', 'zohoouath'];

export const PRUEBAS: Prueba[] = [
  {
    id: 'pagina',
    titulo: 'Página y entorno',
    descripcion: 'El widget debe abrirse dentro de Zoho CRM (en un iframe) y con el entorno esperado.',
    async ejecutar() {
      const enIframe = window.self !== window.top;
      const detalle = {
        url: window.location.href,
        enIframe,
        entorno: entorno.nombre,
        version: aplicacion.version,
        compilado: aplicacion.compilado,
        modo: aplicacion.modo,
      };
      return enIframe
        ? {
            estado: 'ok',
            resumen: `Dentro de Zoho · entorno ${entorno.etiqueta} · v${aplicacion.version}`,
            detalle,
          }
        : {
            estado: 'aviso',
            resumen: 'La página no está dentro de un iframe: ábrela como widget en Zoho CRM.',
            detalle,
          };
    },
  },
  {
    id: 'version',
    titulo: 'Versión publicada (caché)',
    descripcion:
      'Compara la versión en ejecución con la publicada. Si difieren, Zoho o el navegador sirvieron una copia en caché.',
    async ejecutar() {
      const enEjecucion = marcaEnEjecucion();
      if (import.meta.env.DEV) return omitida('En desarrollo no hay versión publicada.');
      const publicada = await marcaPublicada();
      if (!publicada) return { estado: 'aviso', resumen: 'La página publicada no trae la marca de versión.' };
      return publicada === enEjecucion
        ? {
            estado: 'ok',
            resumen: `Al día: compilado ${new Date(aplicacion.compilado).toLocaleString()}`,
            detalle: { publicada },
          }
        : {
            estado: 'aviso',
            resumen: 'Hay una versión más reciente publicada: el widget se recargará solo.',
            detalle: { enEjecucion, publicada },
          };
    },
  },
  {
    id: 'sdk',
    titulo: 'SDK de Zoho',
    descripcion: 'El script ZohoEmbededAppSDK debe cargar desde live.zwidgets.com.',
    async ejecutar() {
      return hayZoho()
        ? { estado: 'ok', resumen: 'window.ZOHO disponible.' }
        : { estado: 'error', resumen: 'No cargó el SDK. Revisa la red o un bloqueo del navegador.' };
    },
  },
  {
    id: 'pageload',
    titulo: 'Contexto del registro (PageLoad)',
    descripcion: 'Zoho debe enviar el módulo y el id del registro donde está el widget.',
    async ejecutar(contexto) {
      if (!hayZoho()) return omitida('Sin SDK.');
      const pagina = await iniciarSesionZoho(10_000);
      contexto.pagina = pagina;
      return { estado: 'ok', resumen: `${pagina.Entity} · ${idDelRegistro(pagina)}`, detalle: pagina };
    },
  },
  {
    id: 'usuario',
    titulo: 'Usuario actual',
    descripcion: 'ZOHO.CRM.CONFIG.getCurrentUser.',
    async ejecutar(contexto) {
      if (!contexto.pagina) return omitida('Sin contexto de Zoho.');
      const usuario = await obtenerUsuarioActual();
      return {
        estado: 'ok',
        resumen: `${usuario.full_name} · ${usuario.email} · ${usuario.role?.name ?? 'sin rol'}`,
        detalle: { id: usuario.id, rol: usuario.role, perfil: usuario.profile },
      };
    },
  },
  {
    id: 'organizacion',
    titulo: 'Organización de CRM',
    descripcion: 'Identifica la organización (sandbox o producción) donde está instalado el widget.',
    async ejecutar(contexto) {
      if (!contexto.pagina) return omitida('Sin contexto de Zoho.');
      const respuesta = await obtenerOrganizacion();
      const org = (respuesta as { org?: Record<string, unknown>[] } | null)?.org?.[0];
      const resumen = org
        ? `${String(org.company_name ?? '—')} · id ${String(org.id ?? '—')}${org.type ? ` · ${String(org.type)}` : ''}`
        : 'Respuesta recibida (ver detalle).';
      return { estado: 'ok', resumen, detalle: respuesta };
    },
  },
  {
    id: 'registro',
    titulo: 'Registro del cliente (SDK)',
    descripcion: 'ZOHO.CRM.API.getRecord y el documento del cliente (cedularif).',
    async ejecutar(contexto) {
      if (!contexto.pagina) return omitida('Sin contexto de Zoho.');
      const registro = await obtenerRegistro(contexto.pagina.Entity, idDelRegistro(contexto.pagina));
      contexto.registro = registro;
      contexto.documento = documentoDelRegistro(registro);
      return contexto.documento
        ? { estado: 'ok', resumen: `Documento: ${contexto.documento}`, detalle: { id: registro.id } }
        : {
            estado: 'aviso',
            resumen: 'El registro no tiene documento de identidad.',
            detalle: { id: registro.id },
          };
    },
  },
  {
    id: 'crm-v8',
    titulo: 'API de CRM v8 (conexión)',
    descripcion: `GET ${entorno.crm.apiBase}/<módulo>/<id> con la conexión "${entorno.conexiones.crm}".`,
    async ejecutar(contexto) {
      if (!contexto.pagina) return omitida('Sin contexto de Zoho.');
      const registro = await crmV8.registro(contexto.pagina.Entity, idDelRegistro(contexto.pagina), ['id']);
      return {
        estado: 'ok',
        resumen: `Conexión "${entorno.conexiones.crm}" responde en v8.`,
        detalle: registro,
      };
    },
  },
  ...CONEXIONES_DESK.map<Prueba>((conexion) => ({
    id: `desk-${conexion}`,
    titulo: `Zoho Desk · conexión "${conexion}"${conexion === entorno.conexiones.desk ? ' (configurada)' : ''}`,
    descripcion: `Organizaciones a las que llega la conexión. Se espera la ${entorno.desk.orgId ?? '(sin configurar)'}.`,
    async ejecutar(contexto) {
      if (!contexto.pagina) return omitida('Sin contexto de Zoho.');
      const organizaciones = await deskApi.organizaciones(conexion);
      const ids = organizaciones.map((o) => String(o.id));
      const detalle = organizaciones.map((o) => ({ id: o.id, nombre: o.companyName ?? o.portalName }));
      if (entorno.desk.orgId && ids.includes(entorno.desk.orgId)) {
        return { estado: 'ok', resumen: `Llega a la organización ${entorno.desk.orgId}.`, detalle };
      }
      return {
        estado: 'aviso',
        resumen: `Responde, pero no incluye la organización ${entorno.desk.orgId ?? '(sin configurar)'}: ${ids.join(', ') || 'ninguna'}.`,
        detalle,
      };
    },
  })),
  {
    id: 'netuno',
    titulo: 'API de Netuno',
    descripcion: `GET https://${entorno.netuno.host}/api/zoho/exp/v1/cuentas con ZOHO.CRM.HTTP.`,
    async ejecutar(contexto) {
      if (!credenciales.netuno.clientId || !credenciales.netuno.clientSecret) {
        return {
          estado: 'error',
          resumen: 'Faltan VITE_NETUNO_CLIENT_ID / VITE_NETUNO_CLIENT_SECRET en .env.local.',
        };
      }
      if (!contexto.documento) return omitida('Sin documento del cliente.');
      const cuentas = await netunoApi.cuentas<unknown[]>(contexto.documento);
      const total = Array.isArray(cuentas) ? cuentas.length : 0;
      return {
        estado: 'ok',
        resumen: `${entorno.netuno.host} respondió: ${total} cuenta(s).`,
        detalle: { total },
      };
    },
  },
];

export interface ResultadoCompleto extends Resultado {
  id: string;
  titulo: string;
  ms: number;
}

/** Ejecuta una prueba midiendo el tiempo y convirtiendo cualquier excepción en un resultado de error. */
export async function ejecutarPrueba(prueba: Prueba, contexto: Contexto): Promise<ResultadoCompleto> {
  const inicio = performance.now();
  let resultado: Resultado;
  try {
    resultado = await prueba.ejecutar(contexto);
  } catch (error) {
    resultado = {
      estado: 'error',
      resumen: mensajeDeError(error),
      detalle: (error as { respuesta?: unknown }).respuesta ?? String(error),
    };
  }
  return { id: prueba.id, titulo: prueba.titulo, ms: Math.round(performance.now() - inicio), ...resultado };
}

/** Informe en texto para compartir con el equipo (sin credenciales). */
export function informe(resultados: ResultadoCompleto[]): string {
  return JSON.stringify(
    {
      fecha: new Date().toISOString(),
      url: window.location.href,
      version: aplicacion.version,
      compilado: aplicacion.compilado,
      entorno: entorno.nombre,
      credencialesNetuno: Boolean(credenciales.netuno.clientId && credenciales.netuno.clientSecret),
      resultados,
    },
    null,
    2,
  );
}
