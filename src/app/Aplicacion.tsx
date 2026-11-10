import { Suspense, type ComponentType } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { DefinicionModulo } from '@/modulos';
import { ZohoProvider } from '@/shared/zoho/ZohoProvider';
import { AvisosProvider, Cargando } from '@/ui';
import { clienteConsultas } from './consultas';
import { InsigniaEntorno } from './InsigniaEntorno';
import { LimiteError } from './LimiteError';

/**
 * Envuelve el módulo de la página con lo que comparten todos los widgets:
 * caché de datos, avisos, contexto de Zoho, manejo de errores y la insignia de versión.
 * `Pagina` es el componente del módulo, cargado de forma diferida (ver main.tsx).
 */
export function Aplicacion({ modulo, Pagina }: { modulo: DefinicionModulo; Pagina: ComponentType }) {
  const contenido = (
    <LimiteError>
      <Suspense fallback={<Cargando mensaje={`Cargando ${modulo.nombre}...`} pantallaCompleta />}>
        <Pagina />
      </Suspense>
    </LimiteError>
  );

  return (
    <QueryClientProvider client={clienteConsultas}>
      <AvisosProvider>
        {modulo.requiereContexto === false ? contenido : <ZohoProvider>{contenido}</ZohoProvider>}
        <InsigniaEntorno />
      </AvisosProvider>
    </QueryClientProvider>
  );
}
