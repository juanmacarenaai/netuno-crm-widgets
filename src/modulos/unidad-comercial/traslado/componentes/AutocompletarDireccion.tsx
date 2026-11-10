import { Combobox, type SeccionCombobox } from '@/ui';
import { configBuscador } from '../config';
import type { Lugar, Vista } from '../lib/lugares';
import { useBuscarLugares } from '../useBuscarLugares';
import { seccionCoordenadas, seccionLugares } from './seccionesBusqueda';

/** "Dirección nueva": texto libre con sugerencias de lugares y coordenadas (iniciarAutocompletarDireccionTraslado). */
export function AutocompletarDireccion({
  id,
  valor,
  onCambiar,
  obtenerVista,
  onElegirLugar,
  onElegirCoordenadas,
}: {
  id: string;
  valor: string;
  onCambiar: (valor: string) => void;
  obtenerVista: () => Vista | null;
  onElegirLugar: (lugar: Lugar) => void;
  onElegirCoordenadas: (lat: number, lon: number) => void;
}) {
  const consulta = valor.trim();
  const coordenadas = seccionCoordenadas(consulta, { soloLugares: true, onElegir: onElegirCoordenadas });
  const busqueda = useBuscarLugares(consulta, obtenerVista, { activo: !coordenadas });

  let secciones: SeccionCombobox[] = [];
  if (coordenadas) secciones = [coordenadas];
  else if (consulta.length >= configBuscador.minCaracteres) {
    secciones = [seccionLugares(busqueda, consulta, onElegirLugar)];
  }

  return (
    <Combobox
      id={id}
      valor={valor}
      onCambiar={onCambiar}
      secciones={secciones}
      placeholder="Av., Edif., Piso, Apto., Urb., Ciudad..."
      etiqueta="Dirección nueva"
    />
  );
}
