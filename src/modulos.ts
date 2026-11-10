/**
 * REGISTRO ÚNICO DE MÓDULOS
 * ─────────────────────────
 * Cada módulo es un widget de Zoho CRM. El build genera una página por módulo
 * (`dist/<id>.html`) y en Zoho cada widget apunta a la suya.
 *
 * Para agregar un módulo (guía completa en docs/agregar-modulo.md):
 *   1. Crear `src/modulos/<id>/index.tsx` con un `export default` (el componente de la página).
 *   2. Agregar su entrada en MODULOS.
 *   3. En Zoho CRM, crear el widget con hosting Externo e índice `/<id>.html`.
 *
 * Este archivo solo contiene datos (sin imports): lo leen la app y vite.config.ts.
 */

export type EstadoModulo =
  /** En uso: reemplaza al widget anterior. */
  | 'activo'
  /** Registrado, pero su contenido aún se migra desde el widget jQuery. */
  | 'en-migracion'
  /** Herramienta del equipo (no se instala para los usuarios finales). */
  | 'interno';

export interface DefinicionModulo {
  /** kebab-case. Es el nombre de la página: `<id>.html`. No cambiarlo una vez publicado. */
  readonly id: string;
  /** Nombre visible (título de la pestaña y del widget en Zoho). */
  readonly nombre: string;
  readonly descripcion: string;
  readonly estado: EstadoModulo;
  /** Carpeta del widget jQuery que este módulo reemplaza (en CRM/). */
  readonly widgetAnterior?: string;
  /**
   * `true` (por defecto): la app espera el contexto de Zoho (PageLoad y usuario) antes de mostrar el módulo.
   * `false`: el módulo arranca sin esperar (p. ej. Diagnóstico, que justamente revisa ese contexto).
   */
  readonly requiereContexto?: boolean;
}

export const MODULOS = [
  {
    id: 'unidad-comercial',
    nombre: 'Unidad Comercial',
    descripcion: 'Cuentas, servicios, contratos y gestiones del cliente.',
    estado: 'en-migracion',
    widgetAnterior: 'widgetUnidadComercial',
  },
  {
    id: 'resumen',
    nombre: 'Unidad Comercial Resumen',
    descripcion: 'Vista compacta de las cuentas y servicios para la pestaña Resumen.',
    estado: 'en-migracion',
    widgetAnterior: 'widgetUnidadComercialResumen',
  },
  {
    id: 'contrasenas',
    nombre: 'Gestión de Correo y Contraseña',
    descripcion: 'Restablecer contraseñas del portal, WiFi y correo de streaming.',
    estado: 'en-migracion',
    widgetAnterior: 'Netuno-Zoho-CRM-widgetContrasenas',
  },
  {
    id: 'facturacion',
    nombre: 'Facturación',
    descripcion: 'Estado de cuenta, movimientos, documentos y domiciliación.',
    estado: 'en-migracion',
    widgetAnterior: 'widgetFacturacionV1.2',
  },
  {
    id: 'historial',
    nombre: 'Historial',
    descripcion: 'Atenciones, tickets, pagos, promociones y comunicaciones del cliente.',
    estado: 'en-migracion',
    widgetAnterior: 'widgetHistorialV1.1',
  },
  {
    id: 'historial-resumen',
    nombre: 'Historial Resumen',
    descripcion: 'Último registro de cada sección del historial, para la pestaña principal del cliente.',
    estado: 'en-migracion',
  },
  {
    id: 'diagnostico',
    nombre: 'Diagnóstico',
    descripcion: 'Verifica el SDK, el contexto, las conexiones y las APIs desde Zoho CRM.',
    estado: 'interno',
    requiereContexto: false,
  },
] as const satisfies readonly DefinicionModulo[];

export type IdModulo = (typeof MODULOS)[number]['id'];

export function buscarModulo(id: string): DefinicionModulo | undefined {
  return MODULOS.find((modulo) => modulo.id === id);
}
