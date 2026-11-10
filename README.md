# Widgets Netuno para Zoho CRM

Todos los widgets de Netuno en Zoho CRM en **un solo proyecto**: una versión, un sistema de diseño, una capa de
servicios y un solo despliegue. Cada widget de Zoho es un **módulo** y apunta a su propia página del mismo build.

React 19 · TypeScript 7 · Vite 8 · Tailwind CSS 4 · TanStack Query 5 · Vitest · Oxlint · Prettier ·
Catalyst Slate

## Inicio rápido

```bash
npm install
cp .env.example .env.local     # completar credenciales de Netuno
npm run dev                    # http://localhost:5173 (SDK de Zoho simulado)
```

## Módulos

Definidos en un solo archivo: [`src/modulos.ts`](src/modulos.ts).

| Módulo                   | Página                   | Estado                                             |
| ------------------------ | ------------------------ | -------------------------------------------------- |
| Unidad Comercial         | `/unidad-comercial.html` | En migración                                       |
| Unidad Comercial Resumen | `/resumen.html`          | En migración                                       |
| Contraseñas              | `/contrasenas.html`      | En migración                                       |
| Facturación              | `/facturacion.html`      | En migración                                       |
| Historial                | `/historial.html`        | En migración                                       |
| Diagnóstico              | `/diagnostico.html`      | Interno: verifica SDK, contexto, conexiones y APIs |

## Comandos principales

| Comando                     | Para qué                                        |
| --------------------------- | ----------------------------------------------- |
| `npm run dev`               | Desarrollo sin Zoho                             |
| `npm run check`             | Tipos + lint + pruebas                          |
| `npm run deploy:pruebas`    | Publica en Slate Development (sandbox Fase3)    |
| `npm run deploy:produccion` | Publica en Slate Production (pide confirmación) |

## Documentación

| Documento                                            | Contenido                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| [docs/catalyst-slate.md](docs/catalyst-slate.md)     | **Paso a paso**: Catalyst Slate + widgets en Zoho CRM      |
| [docs/agregar-modulo.md](docs/agregar-modulo.md)     | Cómo agregar o migrar un módulo, y las reglas del proyecto |
| [docs/arquitectura.md](docs/arquitectura.md)         | Capas, decisiones, entornos y seguridad                    |
| [docs/desarrollo-local.md](docs/desarrollo-local.md) | Desarrollo sin Zoho y dentro de Zoho desde tu equipo       |
| [docs/migracion.md](docs/migracion.md)               | Estado y orden de la migración de los widgets jQuery       |
