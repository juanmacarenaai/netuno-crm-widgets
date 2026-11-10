# Arquitectura

## Idea central

**Un proyecto, un build, una página por widget.** Todos los widgets de Netuno en Zoho CRM se publican juntos
en Catalyst Slate. Cada widget de Zoho (hosting Externo) apunta a su página: `/unidad-comercial.html`,
`/resumen.html`… Todas las páginas son el mismo `index.html` con otro título. `main.tsx` lee el nombre de la
página y carga **solo** el código de ese módulo, en su propio chunk.

```
Zoho CRM ─ widget "Resumen" ─────▶ https://<slate>/resumen.html ─┐
Zoho CRM ─ widget "Facturación" ─▶ https://<slate>/facturacion.html ─┤  mismo build
                                                                   ▼
                     main.tsx → idDesdeUbicacion() → modulos.ts → src/modulos/<id>/index.tsx
```

## Capas

```
src/
├── modulos.ts           Registro único de módulos (solo datos)
├── main.tsx             Arranque: elige el módulo según la página
├── app/                 Envoltura común: proveedores, Lanzador, errores, insignia de versión
├── modulos/<id>/        Un módulo por widget. Solo depende de las capas de abajo
├── shared/              Lo que comparten varios módulos (contexto de Zoho, lógica de cliente…)
├── ui/                  Sistema de diseño Netuno (componentes + tokens en styles/global.css)
├── services/            Única capa que habla con APIs: Netuno, Zoho Desk, Zoho CRM (v8)
├── core/                Configuración por entorno, SDK de Zoho, errores
└── mocks/               SDK simulado para desarrollar sin Zoho (no entra al build)
```

Las dependencias solo van hacia abajo: `modulos → shared/ui → services → core`. Oxlint bloquea los ciclos
(`import/no-cycle`).

## Decisiones

| Decisión                                                                           | Motivo                                                                                                                                |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Páginas por módulo** generadas desde `modulos.ts` (`tooling/paginas-modulos.ts`) | Funciona con cualquier hosting estático y no depende de que Zoho conserve `?query` o `#hash` en la página de índice                   |
| **Slate en modo `static`** y compilación local                                     | El entorno (pruebas/producción) lo decide el script, no el servidor. `.env.local` nunca sale del equipo (solo su valor compilado)     |
| **Entornos en código** (`core/config/entornos.ts`) y no en `.env`                  | Tipados, revisables y en un solo archivo. `.env.local` queda solo para credenciales                                                   |
| Cualquier modo distinto de `produccion` usa **pruebas**                            | Un error de configuración nunca apunta a producción por accidente                                                                     |
| **Contexto de Zoho compartido** (`shared/zoho`)                                    | Cada widget jQuery repetía PageLoad, getRecord y getCurrentUser. Ahora se cargan una vez, en paralelo, y los módulos usan `useZoho()` |
| **TanStack Query** para datos                                                      | Caché, reintentos y estados de carga iguales en todos los módulos                                                                     |
| **CRM API v8** vía conexión (`crmV8`)                                              | Unifica las llamadas que hoy usan v2 y v7. Lectura de registro y usuario sigue con el SDK                                             |
| **SDK de widgets 1.2** en `index.html`                                             | Es la versión con URL de CDN publicada. Cambiar de versión es cambiar esa línea; los tipos están en `core/zoho/tipos.ts`              |
| **TypeScript 7** (estricto)                                                        | Contratos entre módulos y servicios verificados antes de publicar                                                                     |
| Marca de versión `<meta name="netuno-build">` en cada página                       | El Diagnóstico detecta si Zoho o el navegador sirven una copia en caché                                                               |

## Entornos

|           | Pruebas                                          | Producción                      |
| --------- | ------------------------------------------------ | ------------------------------- |
| Comando   | `npm run dev`, `build:pruebas`, `deploy:pruebas` | `build`, `deploy:produccion`    |
| Slate     | Development                                      | Production                      |
| Zoho CRM  | Sandbox Fase3                                    | Organización real               |
| Zoho Desk | 850539393 (entorno de pruebas)                   | Ver pendientes en `entornos.ts` |
| Netuno    | `picq.netuno.net` (QA)                           | `picp.netuno.net`               |
| Insignia  | Ámbar: `v0.1.0 · PRUEBAS`                        | Gris, discreta                  |

## Seguridad

**Estado actual (igual que los widgets jQuery):** `client_id`/`client_secret` de Netuno viajan en el código del
navegador (`VITE_NETUNO_*`). Cualquier usuario con acceso al widget puede verlas. Ya no están en el repositorio
(están en `.env.local`), pero siguen expuestas en el bundle.

**Fase de seguridad (pendiente):** sacar las credenciales del navegador. Las opciones a evaluar son:

1. **Función de Catalyst** (Advanced I/O) como intermediaria de la API de Netuno, con las credenciales en sus
   variables de entorno. Hay que resolver cómo autentica el widget a la función, para que no sea un proxy abierto.
2. **Función de Zoho CRM** (Deluge) invocada con `ZOHO.CRM.FUNCTIONS.execute`. Se autentica con la sesión del
   usuario de CRM y guarda las credenciales en el CRM.

En ambos casos **solo cambia `src/services/netuno.api.ts`**: los módulos no se enteran. Después hay que **rotar**
las credenciales actuales. Lo mismo aplica a los otros secretos de los widgets jQuery (token de PEM,
`ZCFKEY_*`, usuario `dashboard`) cuando se migren sus módulos.
