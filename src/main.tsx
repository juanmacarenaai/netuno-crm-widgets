import { lazy, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { Aplicacion } from './app/Aplicacion';
import { cargadorDe } from './app/cargadores';
import { Lanzador } from './app/Lanzador';
import { idDesdeUbicacion } from './app/resolverModulo';
import { actualizarSiHayVersionNueva, recuperarDescargaFallida } from './core/actualizacion';
import { aplicacion, entorno } from './core/config';
import { buscarModulo } from './modulos';
import { MensajeError } from './ui';

/** Qué dibujar según la página: Lanzador (index.html), el módulo pedido o un error. */
function contenidoDeLaPagina(id: string | null): ReactNode {
  if (id === null) return <Lanzador />;

  const modulo = buscarModulo(id);
  if (!modulo) {
    return (
      <MensajeError
        titulo="Módulo desconocido"
        mensaje={`No existe el módulo "${id}". Revisa la página de índice del widget en Zoho CRM.`}
        pantallaCompleta
      />
    );
  }

  const cargar = cargadorDe(id);
  if (!cargar) {
    return (
      <MensajeError mensaje={`El módulo "${id}" no tiene src/modulos/${id}/index.tsx.`} pantallaCompleta />
    );
  }

  // Cada página descarga solo el código de su módulo
  return <Aplicacion modulo={modulo} Pagina={lazy(cargar)} />;
}

// El código cargó: la guardia del HTML (index.html) ya no debe recargar
window.netunoArranco = 'listo';
// Un módulo que no se pudo descargar (p. ej. de una versión anterior que ya no está publicada)
window.addEventListener('vite:preloadError', (evento) => {
  evento.preventDefault();
  recuperarDescargaFallida();
});

async function arrancar() {
  // Fuera de Zoho CRM (npm run dev en el navegador) se usa un SDK simulado con datos de prueba.
  // Zoho siempre muestra el widget dentro de un iframe; el simulador nunca entra al build.
  if (import.meta.env.DEV && window.self === window.top) {
    await import('./mocks/zohoMock');
  }

  const id = idDesdeUbicacion(window.location.pathname, window.location.search);

  console.info(
    `%cWidgets Netuno%c v${aplicacion.version} · ${entorno.etiqueta} · módulo: ${id ?? '(lanzador)'}`,
    'font-weight:bold;color:#29B6F6',
    '',
  );

  const raiz = document.getElementById('root');
  if (!raiz) throw new Error('No existe #root en index.html');

  createRoot(raiz).render(<StrictMode>{contenidoDeLaPagina(id)}</StrictMode>);

  // En segundo plano: si hay una versión publicada más reciente que la de la caché del navegador, recarga
  void actualizarSiHayVersionNueva();
}

void arrancar();
