/**
 * SDK de Zoho simulado para `npm run dev` en el navegador (fuera del CRM).
 * Solo se carga en desarrollo y fuera de un iframe (ver main.tsx). Nunca entra al build.
 */
import type { PeticionConexion, ZohoSdk } from '@/core/zoho/tipos';
import {
  detalleUsuarioDemo,
  organizacionCrmDemo,
  registroDemo,
  respuestaCrmDemo,
  respuestaDeskDemo,
  respuestaNetunoDemo,
  usuarioDemo,
} from './datosDemo';

const RETARDO_MS = 350;
const responder = <T>(valor: T): Promise<T> =>
  new Promise((resolver) => setTimeout(() => resolver(valor), RETARDO_MS));

type Manejador = (datos: never) => void;
const manejadores: Record<string, Manejador> = {};

// ZOHO.CRM.HTTP devuelve el cuerpo como texto
function http(url: string, cuerpo?: unknown): Promise<string> {
  const respuesta = respuestaNetunoDemo(url, cuerpo);
  if (respuesta === null) console.warn('[zohoMock] Sin datos de prueba para', url);
  return responder(JSON.stringify(respuesta ?? { status_code: 404 }));
}

function conexion(peticion: PeticionConexion) {
  const { url, method } = peticion;
  const ok = (statusMessage: unknown) => responder({ code: 'SUCCESS', details: { statusMessage } });
  if (url.includes('/crm/v8/')) {
    if (method !== 'GET')
      console.info('[zohoMock] CRM', method, url, JSON.stringify(peticion.parameters).slice(0, 600));
    const crm = respuestaCrmDemo(url, peticion.parameters);
    return crm === null ? responder({ code: 'SUCCESS', details: { statusMessage: '' } }) : ok(crm);
  }
  const desk = respuestaDeskDemo(method, url, (peticion.parameters ?? {}) as Record<string, unknown>);
  if (desk !== null) {
    if (method !== 'GET') {
      console.info('[zohoMock] Zoho Desk', method, url, JSON.stringify(peticion.parameters).slice(0, 1500));
    }
    return ok(desk);
  }
  console.warn('[zohoMock] Sin datos de prueba para la conexión', method, url);
  return ok({});
}

const zohoSimulado: ZohoSdk = {
  embeddedApp: {
    on: (evento: string, manejador: Manejador) => {
      manejadores[evento] = manejador;
    },
    init: () => {
      setTimeout(() => manejadores.PageLoad?.({ Entity: 'Accounts', EntityId: registroDemo.id } as never), 0);
      return Promise.resolve();
    },
  },
  CRM: {
    CONFIG: {
      getCurrentUser: () => responder({ users: [usuarioDemo] }),
      getOrgInfo: () => responder(organizacionCrmDemo),
    },
    API: {
      getRecord: () => responder({ data: [{ ...registroDemo }] }),
      getUser: () => responder({ users: [{ ...usuarioDemo, ...detalleUsuarioDemo }] }),
      insertRecord: (peticion) => {
        console.info('[zohoMock] insertRecord', peticion.Entity, peticion.APIData);
        return responder({
          data: [
            { code: 'SUCCESS', status: 'success', message: 'record added', details: { id: 'nuevo-demo' } },
          ],
        });
      },
      updateRecord: (peticion) => {
        // La cuenta simulada guarda los cambios (p. ej. sexo y fecha de nacimiento al activar Salud)
        if (peticion.Entity === 'Accounts') Object.assign(registroDemo, peticion.APIData);
        console.info(
          '[zohoMock] updateRecord',
          peticion.Entity,
          JSON.stringify(peticion.APIData),
          peticion.Trigger,
        );
        return responder({
          data: [{ code: 'SUCCESS', status: 'success', message: 'record updated', details: {} }],
        });
      },
    },
    HTTP: {
      get: ({ url }) => http(url),
      post: ({ url, body }) => {
        console.info('[zohoMock] POST', url, body);
        return http(url, body);
      },
    },
    CONNECTION: {
      invoke: (_nombre, peticion) => conexion(peticion),
    },
  },
};

window.ZOHO = zohoSimulado;

// La activación de servicios llama a la API de Netuno con fetch (sin ZOHO.CRM.HTTP): también se simula
const fetchOriginal = window.fetch.bind(window);
window.fetch = (entrada, opciones) => {
  const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  // Catalyst: subida de imágenes de Crear ticket
  if (url.includes('catalystserverless.com') && url.includes('/tools/uploadFile')) {
    console.info('[zohoMock] fetch Catalyst uploadFile');
    return responder(new Response(JSON.stringify({ url: `https://archivos.demo/imagen-${Date.now()}.png` })));
  }
  if (!url.includes('/api/zoho/exp/v1/')) return fetchOriginal(entrada, opciones);
  const cuerpo = typeof opciones?.body === 'string' ? (JSON.parse(opciones.body) as unknown) : undefined;
  console.info('[zohoMock] fetch', opciones?.method ?? 'GET', url, JSON.stringify(cuerpo));
  const respuesta = respuestaNetunoDemo(url, cuerpo);
  return responder(
    new Response(JSON.stringify(respuesta ?? { status_code: 404 }), {
      status: respuesta === null ? 404 : 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
};

console.warn('⚠️ SDK de Zoho no detectado: se usa el SDK simulado con datos de prueba (src/mocks).');
