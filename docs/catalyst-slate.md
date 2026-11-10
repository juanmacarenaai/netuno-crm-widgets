# Publicar en Catalyst Slate y conectar con Zoho CRM

> ✅ **Probado el 2026-11-05: funciona.** El widget "Unidad Comercial" del sandbox (Fase3), con hosting
> **Externo** y URL `https://widgets-netuno.onslate.com/unidad-comercial.html`, muestra el módulo con el contexto
> real de Zoho: registro, documento, usuario y departamento.
>
> - **Para el equipo (dato engañoso):** Slate responde `X-Frame-Options: DENY` y Zoho aun así muestra el widget.
>   La prueba real en Zoho manda; no descartes un hosting solo por esa cabecera.
> - **Propagación:** después de `deploy:pruebas`, Slate tarda de 30 segundos a 1 minuto en servir la versión
>   nueva. Durante ese tiempo sigue respondiendo la anterior.
> - **Caché (resuelto en la app):** Slate envía `cache-control: public, max-age=31536000` (un año) también en los
>   HTML, y no se puede cambiar. Desde la v0.2.1, cada página compara su versión con la publicada al abrirse
>   (`src/core/actualizacion.ts`). Si hay una más nueva, se recarga sola con `?nv=<versión>`. Quien haya abierto
>   la v0.1.0 o la v0.2.0 (sin esta función) necesita **una** recarga forzada (Ctrl + F5) para quedar al día.
> - **Plan B:** si la caché impide actualizar, `npm run empaquetar:pruebas` genera un zip para hosting **Zoho**
>   en `paquetes/`. Es el mismo zip para todos los widgets.
> - **En Zoho, hosting Externo:** no hay campo "Página de índice". En **URL de base** va la URL completa de la
>   página, por ejemplo `https://widgets-netuno.onslate.com/diagnostico.html`.

Guía paso a paso para publicar los widgets en **Catalyst Slate** (hosting externo) y usarlos desde Zoho CRM.
Se hace una sola vez; después, cada versión se publica con un comando (paso 9).

```
npm run deploy:pruebas     →  Slate Development  →  widgets del sandbox (Fase3)
npm run deploy:produccion  →  Slate Production   →  widgets de la organización real
                                    │
                    cada widget apunta a su página: /<módulo>.html
```

**Cómo funciona.** El proyecto se compila en tu equipo con el entorno elegido y Slate publica la carpeta `dist/`
tal cual (`framework = "static"`). Slate no compila nada en el servidor, así que el entorno (hosts, IDs de Desk)
siempre es el que eligió el script. La configuración está en [`catalyst/slate-config.toml`](../catalyst/slate-config.toml)
y el build la copia a `dist/.catalyst/`, que es donde la busca `catalyst deploy slate`.

---

## Paso 0 · Requisitos

| Requisito                                                               | Cómo verificarlo                                                                                    |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Node.js 20.19 o superior (recomendado 22 LTS)                           | `node --version`                                                                                    |
| Catalyst CLI                                                            | `catalyst --version` (si falta: `npm install -g zcatalyst-cli`, en una terminal como administrador) |
| Acceso a la organización de Catalyst de **Netuno**                      | Paso 1                                                                                              |
| Perfil con permisos de desarrollador en Zoho CRM (sandbox y producción) | Configuración → Centro de desarrolladores visible                                                   |
| `.env.local` con las credenciales de Netuno                             | `cp .env.example .env.local` y completar                                                            |

## Paso 1 · Iniciar sesión con la cuenta de Netuno

La CLI guarda **una** sesión por equipo. Revisa con qué cuenta está iniciada:

```bash
catalyst whoami
```

Si no es la cuenta con acceso a la organización de Catalyst de Netuno (la de los proyectos `crm`, `desk`,
`connectionlog`…, id `884905664`), cambia de sesión:

```bash
catalyst logout
catalyst login          # centro de datos: US (Netuno usa crm.zoho.com)
```

El inicio de sesión se completa en el navegador.

## Paso 2 · Crear el proyecto en la consola

1. Entra a [console.catalyst.zoho.com](https://console.catalyst.zoho.com) y elige la organización de Netuno.
2. **Create Project** → nombre: `netuno-crm-widgets`.

> Es un proyecto aparte de `crm`: el frontend se despliega sin tocar las funciones que ya existen.

## Paso 3 · Compilar y vincular la carpeta con el proyecto

Desde la carpeta `netuno-crm-widgets/`:

```bash
npm install
npm run build:pruebas        # crea dist/ (debe existir antes de vincular)
catalyst init
```

En `catalyst init`:

| Pregunta                                    | Respuesta                                                 |
| ------------------------------------------- | --------------------------------------------------------- |
| _Select a default Catalyst portal_          | La organización de Netuno                                 |
| _Select a default Catalyst project_         | `netuno-crm-widgets` (o `CRM`, el proyecto que se use)    |
| _Which are the features you want to setup?_ | **Ninguna**: presiona Enter sin marcar nada (es opcional) |

Crea `.catalystrc` en la raíz del proyecto.

> ⚠️ **No marques "Slate" en `catalyst init`.** Por ese camino la CLI pregunta un framework, descarga una app de
> ejemplo en una carpeta nueva y publica esa carpeta en lugar de `dist/`. Si ya lo marcaste y ves
> _"Slate Setup · Select a framework to start with"_, cancela con **Ctrl + C**. El `.catalystrc` ya quedó creado,
> así que sigue directo con el paso 4.

## Paso 4 · Vincular Slate

```bash
catalyst slate:link --framework static --name widgets
```

| Pregunta                                               | Respuesta         |
| ------------------------------------------------------ | ----------------- |
| _Please provide the source path of your slate service_ | `dist`            |
| _Provide your Deployment Name_                         | `default` (Enter) |

Puede aparecer el aviso _"Unable to find the package.json file at the given source path"_. Es normal porque
`dist/` no tiene `package.json`. Al terminar, `catalyst.json` incluye la sección `slate`.

> `catalyst.json` y `.catalystrc` se versionan con el proyecto. Si alguien del equipo clona el repositorio,
> solo necesita los pasos 1 y 3 (`npm install`, `npm run build:pruebas`). No hace falta volver a vincular.

## Paso 5 · Primer despliegue (Development)

```bash
npm run deploy:pruebas
```

El comando ejecuta las verificaciones (tipos, lint y pruebas), compila en modo **pruebas** y publica con
`catalyst deploy slate`. Al final, la CLI muestra el enlace al despliegue en la consola.

En la consola: **Slate → widgets → Access URL**. Es una dirección del tipo `https://<subdominio>.onslate.com`.
Ábrela en el navegador: debes ver la página de inicio con la lista de módulos y **Entorno: Pruebas**.

## Paso 6 · Prueba de concepto con el widget Diagnóstico ⚠️

La documentación de Slate no aclara tres puntos. Este paso los comprueba antes de migrar cualquier módulo:

- si permite que Zoho muestre las páginas dentro de un iframe;
- si sirve varias páginas HTML;
- cuánto tiempo guarda en caché los HTML.

### 6.1 Crear el widget en el sandbox (Fase3)

**Configuración → Centro de desarrolladores → Widgets → Crear widget nuevo**

| Campo       | Valor                                                                            |
| ----------- | -------------------------------------------------------------------------------- |
| Nombre      | `Diagnóstico Widgets`                                                            |
| Tipo        | Lista relacionada                                                                |
| Hosting     | **Externo**                                                                      |
| URL de base | URL completa de la página: `https://widgets-netuno.onslate.com/diagnostico.html` |

### 6.2 Mostrarlo en Cuentas

Agrega el widget como lista relacionada en el diseño de **Cuentas** (Clientes). Hazlo solo para tu perfil o
en un diseño de pruebas. Abre una cuenta de prueba y entra a la lista relacionada.

### 6.3 Revisar los resultados

| Prueba                          | Qué esperar                         | Si falla                                                                                                                   |
| ------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Página y entorno                | ✅ Dentro de Zoho · entorno Pruebas | Widget en blanco o "rechazó la conexión": Slate impide mostrarse en iframe. Usar el plan B (abajo).                        |
| SDK de Zoho                     | ✅                                  | Red o bloqueo de `live.zwidgets.com` en el equipo.                                                                         |
| Contexto (PageLoad)             | ✅ `Accounts · <id>`                | Revisar que el widget sea de tipo **Lista relacionada** en Cuentas.                                                        |
| Usuario, Organización, Registro | ✅                                  | Anota el **id de la organización**: identifica al sandbox.                                                                 |
| API de CRM v8                   | ✅                                  | La conexión `crmapirequest` necesita el alcance de módulos de CRM.                                                         |
| Zoho Desk · las dos conexiones  | ✅ en al menos una                  | La conexión que llegue a `850539393` es la de pruebas. Corrígela en `src/core/config/entornos.ts` si no es la configurada. |
| API de Netuno                   | ✅ N cuenta(s)                      | Credenciales de `.env.local` o host `picq` no disponible.                                                                  |

Usa **Copiar informe** y guarda el resultado: es la evidencia de la prueba de concepto.

### 6.4 Comprobar la caché

1. Sube la versión y publica de nuevo:
   ```bash
   npm version patch --no-git-tag-version
   npm run deploy:pruebas
   ```
2. Recarga la página de la cuenta en Zoho CRM.
3. En Diagnóstico, **Versión publicada (caché)** debe decir "Al día" con la versión nueva. La insignia de la
   esquina inferior izquierda también debe mostrarla.

Si sigue la versión anterior, espera unos minutos y recarga. Si no cambia, desactiva la caché del despliegue
en la consola (**Slate → widgets → Configuration**). Los archivos de `assets/` llevan un hash en el nombre, así
que desactivar la caché solo afecta a los HTML.

### 6.5 Widget en blanco después de publicar (caché de un año)

Slate sirve los HTML con `cache-control: max-age=31536000` y **borra los archivos de la versión anterior** al
publicar. Un navegador que guardó el HTML de una versión anterior pedía JavaScript que ya no existía y el widget
quedaba en blanco (visto el 2026-11-06 con Contraseñas). Desde la v0.13.3 hay tres protecciones:

1. `npm run deploy:*` vuelve a subir los archivos de las versiones de los últimos 60 días
   (`.slate-historial/<entorno>/assets`, fuera de git). Si se publica desde otro equipo sin ese historial, se
   puede reconstruir descargando de Slate los archivos que usa la versión publicada.
2. Guardia en línea en `index.html`: si un archivo de `assets/` no carga o el widget no arranca en 20 s, recarga
   una vez con `?nv=<marca>&nr=1` (una URL que el navegador no tiene guardada).
3. `vite:preloadError` en `src/main.tsx`: si falla la descarga del código de un módulo, la misma recarga.

Un HTML guardado **antes** de la v0.13.3 no tiene la guardia: si un widget queda en blanco, recarga la página con
**Ctrl + Shift + R**; si sigue en blanco, cambia la URL del widget en Zoho agregando `?v=2` al final.

### Plan B: si Slate no se puede mostrar en un iframe

La alternativa es **Catalyst Web Client Hosting**, en el mismo proyecto. También sirve archivos estáticos y queda en el
dominio `*.catalystserverless.com`, junto a las funciones de Catalyst. El código no cambia: solo cambia dónde se
publica `dist/` y la URL base de los widgets. Si llega a hacer falta, se documenta aquí y se ajusta
`tooling/desplegar.mjs`.

## Paso 7 · Widgets de los módulos

Cuando el Diagnóstico pase, crea un widget por módulo con la **misma URL base**:

| Widget                   | Página de índice          | Reemplaza a                                       |
| ------------------------ | ------------------------- | ------------------------------------------------- |
| Unidad Comercial         | `/unidad-comercial.html`  | `UnidadComercialJS.zip`                           |
| Unidad Comercial Resumen | `/resumen.html`           | widget Resumen                                    |
| Contraseñas              | `/contrasenas.html`       | widget Contraseñas                                |
| Facturación              | `/facturacion.html`       | `widgetFacturacionV1.2`                           |
| Historial                | `/historial.html`         | `widgetHistorialV1.1`                             |
| Historial Resumen        | `/historial-resumen.html` | recuadro "Historial (Último registro)" del Canvas |

Mientras un módulo esté **en migración**, su página muestra el contexto que recibe de Zoho y un aviso. Créalo
con el sufijo "(Nuevo)", pruébalo en el sandbox y no lo pongas en el diseño de los usuarios. Cuando el módulo
pase a `activo` (ver [migracion.md](migracion.md)), cambia el widget anterior por el nuevo en el diseño.

> Desde aquí, **cada `npm run deploy:pruebas` actualiza todos los widgets del sandbox a la vez.**

## Paso 8 · Producción

1. Completa los datos marcados como pendientes en `ENTORNOS.produccion` (`src/core/config/entornos.ts`). El
   Diagnóstico los muestra en "Por confirmar".
2. En la consola de Catalyst: **Settings → Environments**. Entra al entorno de **Production** y habilítalo si
   está desactivado. La CLI exige haberlo abierto en la consola antes del primer despliegue a producción.
3. Publica. El comando pide escribir `PRODUCCION` para confirmar:
   ```bash
   npm run deploy:produccion
   ```
4. **Recomendado: dominio propio**, por ejemplo `widgets.netuno.net`. Se configura en **Slate → widgets →
   Custom Domains**, con dos registros CNAME y SSL gratuito. Así la URL base de los widgets no cambia nunca,
   aunque mañana se cambie de hosting.
5. En la organización de producción de Zoho CRM, crea los widgets (pasos 6 y 7) con la URL de producción.

> **Sandbox → producción en Zoho:** si se despliegan cambios del sandbox a producción desde Zoho, revisa que la
> URL base de cada widget apunte a la URL de **producción** y no a la de Development.

## Paso 9 · Ciclo de cada versión

```bash
npm version minor --no-git-tag-version   # o patch para correcciones
npm run deploy:pruebas                   # 1. publicar en Development
#                                           2. probar en el sandbox (Fase3), incluido Diagnóstico
npm run deploy:produccion                # 3. publicar en Production
```

- **Volver atrás:** la consola de Slate conserva cada despliegue. También se puede volver a la versión
  anterior del código y ejecutar `npm run deploy:produccion`.
- **Emergencias:** `node tooling/desplegar.mjs pruebas --sin-verificar` omite las verificaciones. No usarlo en
  producción.

## Pendiente para más adelante

- **Despliegue desde GitHub:** cuando exista el repositorio, se puede automatizar el paso 9 con GitHub Actions
  ejecutando el mismo `tooling/desplegar.mjs`. La integración con Git que ofrece Slate compila en el servidor:
  para usarla habría que pasar el entorno de otra forma. Se evaluará en su momento.
- **Credenciales:** ver [arquitectura.md → Seguridad](arquitectura.md#seguridad).
