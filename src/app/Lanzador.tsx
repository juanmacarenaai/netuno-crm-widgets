import { ExternalLink, LayoutGrid } from 'lucide-react';
import { aplicacion, entorno } from '@/core/config';
import { MODULOS, type EstadoModulo } from '@/modulos';
import { Chip, EncabezadoModulo, type TonoChip } from '@/ui';

const ESTADOS: Record<EstadoModulo, { texto: string; tono: TonoChip }> = {
  activo: { texto: 'Activo', tono: 'exito' },
  'en-migracion': { texto: 'En migración', tono: 'aviso' },
  interno: { texto: 'Interno', tono: 'info' },
};

/**
 * Página raíz (index.html): lista los módulos y la página que debe usar cada widget en Zoho CRM.
 * No necesita Zoho: sirve para revisar una publicación desde el navegador.
 */
export function Lanzador() {
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <EncabezadoModulo
        titulo="Widgets Netuno para Zoho CRM"
        icono={LayoutGrid}
        descripcion={`Versión ${aplicacion.version} · Entorno: ${entorno.etiqueta} · Compilado: ${new Date(aplicacion.compilado).toLocaleString()}`}
      />
      <p className="mb-4 text-sm text-texto-suave">
        Cada módulo es un widget. En Zoho CRM, el widget usa hosting <strong>Externo</strong> y la página de
        índice indicada abajo.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {MODULOS.map((modulo) => {
          const estado = ESTADOS[modulo.estado];
          return (
            <li key={modulo.id}>
              <a
                href={`./${modulo.id}.html`}
                className="group flex h-full flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-tarjeta transition hover:shadow-tarjeta-hover"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-netuno-800">{modulo.nombre}</span>
                  <Chip tono={estado.tono}>{estado.texto}</Chip>
                </div>
                <p className="text-sm text-texto-suave">{modulo.descripcion}</p>
                <code className="mt-auto flex items-center gap-1 text-xs text-accion">
                  /{modulo.id}.html
                  <ExternalLink
                    aria-hidden="true"
                    className="h-3 w-3 opacity-0 transition group-hover:opacity-100"
                  />
                </code>
              </a>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
