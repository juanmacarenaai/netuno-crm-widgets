import type { Map as MapaLeaflet } from 'leaflet';

/**
 * Leaflet 1.9.4: remove() no cancela el temporizador de la animación de zoom (250 ms). Si el mapa se cierra a
 * mitad de un zoom, ese temporizador falla con "Cannot read properties of undefined (reading '_leaflet_pos')".
 * Con _animatingZoom en false el temporizador ya no hace nada. Misma corrección que UnidadComercialJS.
 */
export function destruirMapaLeaflet(mapa: MapaLeaflet): void {
  mapa.off();
  (mapa as MapaLeaflet & { _animatingZoom: boolean })._animatingZoom = false;
  mapa.remove();
}
