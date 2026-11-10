# Desarrollo local

## En el navegador, sin Zoho (lo habitual)

```bash
npm install
cp .env.example .env.local    # credenciales de Netuno
npm run dev
```

- `http://localhost:5173/` → Lanzador con todos los módulos.
- `http://localhost:5173/<id>.html` → un módulo, por ejemplo `/resumen.html` o `/diagnostico.html`.

Fuera de un iframe, `main.tsx` carga el **SDK simulado** (`src/mocks/zohoMock.ts`). Responde PageLoad, usuario,
registro, conexiones y la API de Netuno con datos ficticios de `src/mocks/datosDemo.ts`. Si un módulo pide un
endpoint sin datos de prueba, la consola muestra `[zohoMock] Sin datos de prueba para ...`.

## Dentro de Zoho CRM, desde tu equipo (opcional)

Sirve para probar con datos reales sin publicar en Slate. Zoho exige HTTPS:

1. Crea la carpeta `certificados/` (ignorada por Git) con `cert.pem` y `key.pem`. Puedes generarlos con
   [mkcert](https://github.com/FiloSottile/mkcert) (`mkcert -key-file key.pem -cert-file cert.pem 127.0.0.1`) o
   reutilizar los de cualquier widget ZET (por ejemplo `../widgetUnidadComercial/cert.pem` y `key.pem`).
2. `npm run dev:zoho` → `https://127.0.0.1:5173`.
3. Abre `https://127.0.0.1:5173` una vez en el navegador y acepta el certificado si lo pide.
4. En el sandbox, crea un widget de pruebas con hosting **Externo**, URL base `https://127.0.0.1:5173` y página
   `/diagnostico.html` (o la del módulo que estés trabajando).

Dentro del iframe se usa el SDK real (no el simulado). Los cambios se recargan solos.

## Comandos

| Comando                                                | Para qué                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `npm run dev`                                          | Servidor de desarrollo con SDK simulado                                        |
| `npm run dev:zoho`                                     | Servidor en `127.0.0.1` (HTTPS si hay certificados) para probar dentro de Zoho |
| `npm run check`                                        | Tipos + lint + pruebas (lo mismo que exige el despliegue)                      |
| `npm run test:watch`                                   | Pruebas en modo observación                                                    |
| `npm run format`                                       | Formatea todo el código con Prettier                                           |
| `npm run build:pruebas` / `npm run build`              | Build de pruebas / de producción en `dist/`                                    |
| `npm run preview`                                      | Sirve `dist/` para revisarlo                                                   |
| `npm run deploy:pruebas` / `npm run deploy:produccion` | Ver [catalyst-slate.md](catalyst-slate.md)                                     |

## Editor

Recomendado: VS Code con las extensiones **oxc** (lint), **Prettier** y **Tailwind CSS IntelliSense**. El
proyecto trae `.editorconfig` y `.prettierrc.json`, así que todos formatean igual.
