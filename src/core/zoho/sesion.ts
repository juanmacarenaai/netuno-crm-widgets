import { tiempos } from '@/core/config';
import { ApiError } from '@/core/http/errores';
import type { DatosPageLoad } from './tipos';

let sesion: Promise<DatosPageLoad> | null = null;

/**
 * Inicia el SDK y espera el primer PageLoad (Entity y EntityId del registro).
 * Se ejecuta una sola vez por página: las llamadas siguientes reciben la misma promesa.
 */
export function iniciarSesionZoho(timeoutMs: number = tiempos.pageLoadMs): Promise<DatosPageLoad> {
  if (sesion) return sesion;

  sesion = new Promise<DatosPageLoad>((resolver, rechazar) => {
    const zoho = window.ZOHO;
    if (!zoho) {
      rechazar(
        new ApiError('No se encontró el SDK de Zoho. Abra el widget desde Zoho CRM.', { codigo: 'SIN_SDK' }),
      );
      return;
    }

    const espera = setTimeout(() => {
      rechazar(
        new ApiError('No se recibió el contexto de Zoho CRM. Abra el widget desde un registro en Zoho CRM.', {
          codigo: 'SIN_PAGELOAD',
        }),
      );
    }, timeoutMs);

    zoho.embeddedApp.on('PageLoad', (datos) => {
      clearTimeout(espera);
      resolver(datos);
    });
    zoho.embeddedApp.init().catch((causa: unknown) => {
      clearTimeout(espera);
      rechazar(new ApiError('No se pudo iniciar el SDK de Zoho.', { causa, codigo: 'INIT' }));
    });
  });

  // Si falla, el siguiente intento ("Reintentar") vuelve a esperar en lugar de reutilizar el error
  sesion.catch(() => {
    sesion = null;
  });

  return sesion;
}

/** EntityId puede llegar como lista en algunas ubicaciones del widget. */
export function idDelRegistro(datos: DatosPageLoad): string {
  const id = Array.isArray(datos.EntityId) ? datos.EntityId[0] : datos.EntityId;
  if (!id) throw new ApiError('El contexto de Zoho no trae el id del registro.', { codigo: 'SIN_REGISTRO' });
  return String(id);
}
