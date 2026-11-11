# Guía para agentes de IA

Instrucciones para cualquier asistente de IA (Claude, Codex, Cursor, Copilot, Gemini…) que trabaje en este
proyecto. Es la **fuente única**: `CLAUDE.md` solo la importa. Si una regla cambia, se cambia aquí.

Si eres una persona del equipo: este archivo resume cómo trabajamos. El detalle está en [`docs/`](docs/).

---

## 1. Qué es este proyecto

Todos los widgets de **Netuno** (ISP) en **Zoho CRM** unificados en un solo proyecto: una versión, un sistema de
diseño, una capa de servicios y un solo despliegue. Reemplaza a los widgets jQuery anteriores (cada uno con su
propio repositorio).

- **Stack:** React 19 · TypeScript 7 (estricto) · Vite 8 · Tailwind CSS 4 · TanStack Query 5 · Vitest · Oxlint ·
  Prettier.
- **Hosting:** Catalyst Slate (modo `static`; se compila en local y se publica `dist/`).
- **Un widget de Zoho = un módulo = una página** (`/<id>.html`) del mismo build. El registro único de módulos es
  [`src/modulos.ts`](src/modulos.ts).
- **Idioma:** todo en español: textos visibles, nombres de código, comentarios, documentación y respuestas a la
  persona.

## 2. Lee esto antes de cambiar algo

En este orden, según lo que vayas a tocar:

| Documento                                            | Cuándo                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| [docs/arquitectura.md](docs/arquitectura.md)         | Siempre: capas, decisiones, entornos y seguridad                     |
| [docs/agregar-modulo.md](docs/agregar-modulo.md)     | Siempre: estructura de un módulo y **reglas del proyecto**           |
| [docs/migracion.md](docs/migracion.md)               | Antes de tocar un módulo: estado, decisiones y pendientes            |
| [docs/desarrollo-local.md](docs/desarrollo-local.md) | Para correr el proyecto sin Zoho o dentro de Zoho                    |
| [docs/catalyst-slate.md](docs/catalyst-slate.md)     | Antes de publicar (incluye el problema de caché de Slate)            |
| `docs/<gestión>.md` y `docs/diseno/`                 | Gestiones grandes con análisis propio (p. ej. Cambio de titularidad) |

Lee también el código del módulo y sus pruebas (`lib/*.test.ts`) antes de proponer cambios. Muchas decisiones que
parecen raras están explicadas en comentarios o en `docs/migracion.md`.

## 3. Comandos

```bash
npm install
cp .env.example .env.local     # credenciales: pídelas al equipo, nunca las inventes ni las subas
npm run dev                    # http://localhost:5173 con el SDK de Zoho simulado
```

| Comando                          | Para qué                                                                |
| -------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                    | Lanzador en `/` y cada módulo en `/<id>.html`, con datos de prueba      |
| `npm run check`                  | Tipos + lint + pruebas. **Obligatorio antes de dar algo por terminado** |
| `npm run test:watch`             | Pruebas en modo observación                                             |
| `npx prettier --write <archivo>` | Formatear lo que tocaste                                                |
| `npm run deploy:pruebas`         | Publica en Slate Development (sandbox **Fase3**). Corre `check` antes   |
| `npm run deploy:produccion`      | **Prohibido para agentes.** Lo ejecuta una persona del equipo           |

## 4. Dónde va cada cosa

```
src/
├── modulos.ts             Registro único de módulos (id, nombre, estado)
├── modulos/<id>/          Un módulo por widget: index.tsx, componentes/, hooks/, lib/ (+ .test.ts)
│   └── unidad-comercial/<gestión>/   Gestiones de "Administrar cuenta": cambio-plan, traslado, ...
├── shared/                Lo que usan 2+ módulos (cuentas, historial, canal-atencion, zoho, lib)
├── ui/                    Sistema de diseño: Boton, Alerta, CampoFormulario, Modal, Chip, Pasos, cn...
├── services/              ÚNICA capa que habla con APIs (Netuno, Desk, CRM v8, Catalyst, soporte)
├── core/config/entornos.ts   IDs, hosts y conexiones de pruebas y producción
├── mocks/                 SDK simulado y datos de prueba (datosDemo.ts); no entra al build
└── styles/global.css      Tokens de color y sombra
```

| Si necesitas…                                            | Va en…                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Un widget nuevo                                          | `src/modulos/<id>/` + entrada en `src/modulos.ts` (ver agregar-modulo)                           |
| Una gestión nueva de Unidad Comercial                    | `src/modulos/unidad-comercial/<gestión>/` + `OPCIONES` en `administracion/AdministrarCuenta.tsx` |
| Lógica sin interfaz (cálculos, validaciones, armar JSON) | `lib/` del módulo, con su `.test.ts`                                                             |
| Un endpoint nuevo                                        | `src/services/*.api.ts` (una sola vez, para todos)                                               |
| Un ID, host u organización                               | `src/core/config/entornos.ts`                                                                    |
| Un componente visual reutilizable                        | `src/ui/` y exportarlo en `src/ui/index.ts`                                                      |
| Código que ya usa otro módulo                            | Moverlo a `src/shared/` (un módulo nunca importa de otro)                                        |
| Datos para probar sin Zoho                               | `src/mocks/datosDemo.ts`                                                                         |

## 5. Paso a paso de cualquier cambio

1. **Entender el pedido.** Si falta un dato que solo sabe Netuno o IT (un endpoint, un ID, una regla de negocio),
   pregunta. No inventes endpoints, campos de CRM ni credenciales.
2. **Ubicar** el módulo y leer su código, sus pruebas y su sección en `docs/migracion.md`.
3. **Implementar** respetando las reglas (sección 6) y los criterios de UX (sección 7). Reutiliza `@/ui` y
   `@/shared` antes de crear algo nuevo.
4. **Datos de prueba:** si el cambio necesita datos nuevos, agrégalos a `src/mocks/datosDemo.ts` con la misma forma
   que la respuesta real (datos ficticios).
5. **Pruebas:** toda lógica nueva en `lib/` lleva su prueba en Vitest.
6. **Verificar:** `npm run check` debe pasar completo. Formatea con Prettier lo que tocaste.
7. **Probar en el navegador** con `npm run dev` (`http://localhost:5173/<id>.html`): el flujo completo, sin errores
   en consola, en pantalla ancha y a ~400 px de ancho (sin scroll horizontal).
8. **Versión:** sube `version` en `package.json` (semver). Ajuste o corrección → parche (`0.15.0 → 0.15.1`).
   Gestión o funcionalidad nueva → menor (`0.15.1 → 0.16.0`). La versión se ve en la insignia del widget.
9. **Documentar** en `docs/migracion.md` (estado del módulo, decisión tomada y por qué, pendientes). Si la gestión
   es grande, en su propio `docs/<gestión>.md`.
10. **Publicar en pruebas** solo si la persona lo autorizó: `npm run deploy:pruebas`. Luego confirma que la página
    publicada trae la versión nueva en `<meta name="netuno-build" content="<versión>|<fecha>">` (Slate tarda
    30–60 s en propagar).
11. **Informar** a la persona: qué cambió, cómo probarlo en el sandbox Fase3 (dónde hacer clic), qué quedó
    pendiente y qué hay que confirmar con Netuno/IT. Si ve la versión anterior: **Ctrl+Shift+R**.

Trabajamos **paso a paso**: una entrega por versión, validada por la persona en Fase3 antes de seguir con la
siguiente.

## 6. Reglas del proyecto

Detalle y motivos en [docs/agregar-modulo.md → Reglas del proyecto](docs/agregar-modulo.md#reglas-del-proyecto).

- Los módulos **nunca** llaman a `ZOHO.*` ni a `fetch` directo: usan `src/services/*`.
- Componentes visuales desde `@/ui`. Colores y sombras solo con los tokens de `src/styles/global.css`.
- HTML que llega de una API, solo con `<HtmlSeguro>`.
- Un módulo **no importa** de otro módulo. Lo compartido va a `src/shared/`.
- Las dependencias solo bajan: `modulos → shared/ui → services → core` (Oxlint bloquea ciclos).
- IDs, hosts y conexiones solo en `src/core/config/entornos.ts`. Cualquier modo distinto de `produccion` usa
  **pruebas**.
- El `id` de un módulo publicado **no se cambia** (los widgets de Zoho apuntan a `<id>.html`).
- Los campos que se guardan en CRM (p. ej. JSON en campos multilínea) **no se renombran ni se eliminan** sin
  confirmar que ninguna regla, función o integración de CRM/Desk los lee. Se agregan campos nuevos; los viejos se
  conservan.
- TypeScript estricto, sin `any`. Si desactivas una regla de Oxlint, que sea en una línea y con el motivo.
- Sin dependencias nuevas sin acordarlo con la persona.

## 7. Criterios de UX acordados

Son decisiones que el equipo ya tomó. Aplícalas en todos los módulos:

- **Sin mensajes de "pendiente" mientras el formulario está vacío.** Nada de alertas tipo "Seleccione al menos…" o
  "Faltan datos…" antes de que la persona interactúe. Usa señales visuales: botón deshabilitado, el siguiente paso
  resaltado, error junto al campo solo después de intentar enviar.
- **Mostrar siempre los datos con los que el asesor guía al cliente** (número de cuenta, número de contrato, plan,
  correo de acceso), aun con las secciones cerradas.
- **Textos para el asesor de Netuno:** claros, cortos y en español. Nada de textos de demostración en la versión
  real.
- **Responsive:** debe verse bien dentro del widget de Zoho y a ~400 px de ancho.
- **Estados completos:** carga (esqueletos o `Loader2`), error con "Reintentar" y vacío con un mensaje útil.
- **Diseños de la PM:** cuando hay prototipo (Figma Make), se respeta la visual. Las diferencias intencionales se
  anotan en el `docs/` de la gestión, y las capturas van en `docs/diseno/<gestión>/`.
- **Servicios que aún no existen:** se simulan en el `servicio.ts` de la gestión con una bandera (p. ej.
  `SERVICIOS_SIMULADOS = true`), un aviso visible de "Vista de demostración" y un comentario en cada función que
  diga qué servicio real la reemplazará. Ejemplo: `unidad-comercial/cambio-titularidad/servicio.ts`.

## 8. Entornos, despliegue y seguridad

|          | Pruebas                                          | Producción                     |
| -------- | ------------------------------------------------ | ------------------------------ |
| Comando  | `deploy:pruebas`                                 | `deploy:produccion` (personas) |
| Slate    | Development (https://widgets-netuno.onslate.com) | Production                     |
| Zoho CRM | Sandbox **Fase3**                                | Organización real              |
| Netuno   | `picq` (QA); algunos servicios en `picd`         | `picp`                         |

- **Agentes: nunca `deploy:produccion`, aunque parezca la conclusión natural.** `deploy:pruebas` solo con permiso
  de la persona.
- **Catalyst:** el proyecto vive en la organización de Netuno **884905664** (ver `.catalystrc`). Antes de
  desplegar, confirma que la CLI de Catalyst está logueada en esa organización. Nunca crees ni despliegues en otra.
- `catalyst.json` guarda una ruta absoluta del equipo de quien vinculó el proyecto; `tooling/desplegar.mjs` la
  corrige sola en cada equipo.
- **Secretos:** solo en `.env.local` (no se versiona). Nunca los escribas en código, documentación, commits ni
  mensajes. Hoy las variables `VITE_*` quedan dentro del bundle; sacarlas es la **fase de seguridad pendiente**
  (ver arquitectura.md).
- Slate borra los archivos de la versión anterior y guarda los HTML en caché: `desplegar.mjs` vuelve a subir los
  de los últimos 60 días desde `.slate-historial/` (ver catalyst-slate.md §6.5). No lo saltes.

## 9. Problemas conocidos

- **Windows: todas las pruebas fallan con `Cannot read properties of undefined (reading 'config')`.** Pasa si la
  terminal está en `c:\...` con la unidad en minúscula (se cargan dos copias de Vitest). Ejecuta desde
  `C:\...` (en PowerShell: `Set-Location 'C:\ruta\al\proyecto'`). Aplica también a `deploy:pruebas`, que corre
  `check`.
- **Widget en blanco o versión vieja en Zoho:** caché del navegador o de Slate → Ctrl+Shift+R. El widget interno
  **Diagnóstico** (`/diagnostico.html`) muestra la versión publicada y el estado del SDK, las conexiones y las APIs.
- **El endpoint de cambio de correo de NetUno Go solo existe en `picd`** (ver `entornos.ts`).
- En pruebas de navegador automatizadas, los textos con clase `uppercase` salen en mayúsculas en `innerText`.

## 10. Git y colaboración

- Rama principal: `main`. Haz commit o push **solo cuando la persona lo pida**. Para cambios grandes, una rama por
  entrega.
- Mensajes de commit en español, en imperativo y con la versión cuando aplique (p. ej.
  `v0.15.1: Contraseñas muestra el número de contrato`).
- Nunca subas `.env.local`, `certificados/`, `dist/`, `paquetes/` ni `.slate-historial/` (ya están en
  `.gitignore`).
- No incluyas datos personales de clientes reales en pruebas, mocks, capturas ni documentación.
