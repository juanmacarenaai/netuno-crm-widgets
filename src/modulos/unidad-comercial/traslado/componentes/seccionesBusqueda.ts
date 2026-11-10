/** Secciones del Combobox para coordenadas, lugares (Photon) y NAP/edificios (como maps.buscador.js). */
import type { SeccionCombobox } from '@/ui';
import { parsearCoordenadas } from '../../lib/coordenadas';
import { formatoMetros, subtituloPunto, type Lugar } from '../lib/lugares';
import type { PuntoRed } from '../lib/weezie';
import { tituloLugares } from '../servicios';
import type { EstadoBusqueda } from '../useBuscarLugares';

export function seccionCoordenadas(
  consulta: string,
  { soloLugares, onElegir }: { soloLugares: boolean; onElegir: (lat: number, lon: number) => void },
): SeccionCombobox | null {
  const geo = parsearCoordenadas(consulta);
  if (!geo.ok || geo.lat === null || geo.lon === null) return null;
  const { lat, lon } = geo;
  return {
    titulo: 'Coordenadas',
    items: [
      {
        id: 'coordenadas',
        titulo: `${soloLugares ? 'Usar' : 'Ir a'} ${lat.toFixed(6)}, ${lon.toFixed(6)}`,
        subtitulo: soloLugares ? 'Completa latitud y longitud' : 'Coloca el pin en esas coordenadas',
        icono: 'coordenadas',
        onElegir: () => onElegir(lat, lon),
      },
    ],
  };
}

export function seccionLugares(
  busqueda: { estado: EstadoBusqueda; lugares: Lugar[] },
  consulta: string,
  onElegir: (lugar: Lugar) => void,
): SeccionCombobox {
  const mensajes: Partial<Record<EstadoBusqueda, string>> = {
    buscando: 'Buscando lugares...',
    error: 'No se pudo buscar lugares en este momento',
    listo: `Sin lugares para «${consulta}»`,
  };
  return {
    titulo: tituloLugares,
    mensaje: mensajes[busqueda.estado],
    items: busqueda.lugares.map((l) => ({
      id: l.id,
      titulo: l.nombre,
      subtitulo: [l.tipo, l.detalle, formatoMetros(l.distancia)].filter(Boolean).join(' · '),
      icono: l.esArea ? 'zona' : 'lugar',
      onElegir: () => onElegir(l),
    })),
  };
}

export function seccionPuntos(
  titulo: string,
  resultados: Array<{ p: PuntoRed; indice: number }>,
  onElegir: (indice: number) => void,
): SeccionCombobox {
  return {
    titulo,
    items: resultados.map(({ p, indice }) => ({
      id: p.id,
      titulo: p.etiqueta,
      subtitulo: subtituloPunto(p),
      icono: { forma: p.forma, color: p.color },
      atenuado: !p.seleccionable,
      onElegir: () => onElegir(indice),
    })),
  };
}
