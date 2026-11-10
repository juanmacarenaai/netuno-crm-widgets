import { Construction, type LucideIcon } from 'lucide-react';
import { buscarModulo } from '@/modulos';
import { useZoho } from '@/shared/zoho/contexto';
import { Chip, EncabezadoModulo, Tarjeta } from '@/ui';

/**
 * Pantalla temporal de un módulo registrado cuyo contenido aún se migra desde su widget jQuery.
 * Muestra el contexto que recibió de Zoho: si aparece, la página ya funciona como widget.
 */
export function ModuloEnMigracion({ id, icono }: { id: string; icono: LucideIcon }) {
  const modulo = buscarModulo(id);
  const { entidad, idRegistro, documento, usuario, registro } = useZoho();

  const filas: [string, string][] = [
    ['Registro', `${entidad} · ${idRegistro}`],
    ['Cliente', String(registro.Account_Name ?? registro.Nombres ?? '—')],
    ['Documento', documento ?? 'Sin documento en el registro'],
    ['Usuario', `${usuario.nombre} (${usuario.rol ?? 'sin rol'})`],
    ['Departamento', usuario.departamento ?? '—'],
  ];

  return (
    <main className="mx-auto max-w-3xl p-3 sm:p-4">
      <EncabezadoModulo titulo={modulo?.nombre ?? id} icono={icono} descripcion={modulo?.descripcion} />
      <Tarjeta
        titulo={
          <span className="flex items-center gap-2">
            Módulo en migración <Chip tono="aviso">Pendiente</Chip>
          </span>
        }
        icono={Construction}
      >
        <p className="mb-3 text-sm text-texto-suave">
          Este widget ya está conectado al proyecto unificado. Su contenido se migra desde{' '}
          <code className="rounded bg-gray-100 px-1 text-xs">{modulo?.widgetAnterior ?? '—'}</code>; mientras
          tanto, sigue en uso el widget anterior.
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {filas.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="contents">
              <dt className="font-semibold text-netuno-800">{etiqueta}</dt>
              <dd className="truncate text-gray-700">{valor}</dd>
            </div>
          ))}
        </dl>
      </Tarjeta>
    </main>
  );
}
