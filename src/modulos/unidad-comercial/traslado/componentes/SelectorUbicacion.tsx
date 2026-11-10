import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Boton, cn, Combobox, Modal, type SeccionCombobox } from '@/ui';
import { destruirMapaLeaflet } from '../../lib/leaflet';
import { configBuscador, configMapa } from '../config';
import type { SeleccionUnidad } from '../lib/edificio';
import { buscarPuntos, sugerenciasPuntos, type Lugar, type Vista } from '../lib/lugares';
import { fijarCoordenada } from '../lib/traslado';
import type { Categoria, PuntoRed } from '../lib/weezie';
import { useBuscarLugares } from '../useBuscarLugares';
import { seccionCoordenadas, seccionLugares, seccionPuntos } from './seccionesBusqueda';
import { VistaEdificio } from './VistaEdificio';
import './selector.css';

const PIN_SVG =
  '<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M15 0C6.7 0 0 6.7 0 15c0 11.2 15 27 15 27s15-15.8 15-27C30 6.7 23.3 0 15 0z" fill="#e53935"/>' +
  '<circle cx="15" cy="15" r="6" fill="#ffffff"/></svg>';

const escapar = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

const BOTON_FICHA = 'mt-2 block w-full rounded px-2 py-1.5 text-xs font-bold text-white';

/** Ficha (popup) de una NAP o edificio con sus acciones; los clics se atienden por delegación. */
function htmlFicha(p: PuntoRed, indice: number): string {
  const filas = p.filas.map(([k, v]) => `<tr><th>${escapar(k)}</th><td>${escapar(v)}</td></tr>`).join('');
  let acciones = p.seleccionable
    ? `<button type="button" data-accion="usar" data-indice="${indice}" class="${BOTON_FICHA} bg-accion hover:bg-sky-600">${escapar(p.textoBoton)}</button>`
    : `<div class="mt-2 rounded bg-gray-100 px-2 py-1.5 text-center text-xs text-gray-600">${escapar(p.motivoNoSeleccionable)}</div>`;
  if (p.mdu) {
    acciones =
      `<button type="button" data-accion="edificio" data-indice="${indice}" class="${BOTON_FICHA} bg-[#546e7a] hover:bg-[#455a64]">` +
      `${p.seleccionable ? 'Ver edificio y elegir unidad' : 'Ver edificio'}</button>${acciones}`;
  }
  return (
    `<div class="selector-ficha min-w-56"><strong class="text-sm">${escapar(p.etiqueta)}</strong>` +
    `<div class="text-[11px] text-gray-500">${escapar(p.subtitulo)}</div><table>${filas}</table>${acciones}</div>`
  );
}

function BotonFiltro({
  activo,
  color,
  forma,
  children,
  onClick,
}: {
  activo: boolean;
  color?: string;
  forma?: Categoria['forma'];
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition',
        activo
          ? 'border-accion bg-sky-50 font-bold text-gray-800'
          : 'border-gray-300 bg-white text-gray-500 hover:border-gray-400',
      )}
    >
      {color && (
        <i
          className={cn(
            'h-2.5 w-2.5',
            forma === 'cuadro' ? 'rounded-sm' : 'rounded-full',
            !activo && 'opacity-50',
          )}
          style={{ background: color }}
        />
      )}
      {children}
    </button>
  );
}

/** Capas de infraestructura que dibuja el selector. */
export interface Capas {
  puntos: PuntoRed[];
  categorias: readonly Categoria[];
  circulo?: { lat: number; lon: number; metros: number };
  resumen: string;
}

/** Carga las capas (sin punto: las iniciales). null = sin cambios. */
export type CargarCapas = (punto?: { lat: number; lon: number }) => Promise<Capas | null>;

export interface InicialSelector {
  lat: number;
  lon: number;
  zoom: number;
  /** Las coordenadas iniciales ya cuentan como elegidas ("Ubicar en mapa"). */
  preseleccionar: boolean;
}

type EstadoCapas = Capas & { estado: 'cargando' | 'listo' | 'error' | 'sin-capas' };

type PuntoElegido = PuntoRed & { unidad?: SeleccionUnidad };

/**
 * Selector de ubicación (Maps.selector en UnidadComercialJS). Se carga en su propio chunk junto con Leaflet.
 * onConfirmar(lat, lon, punto): punto es la NAP o el edificio de Weezie elegido, o null si se movió el pin a mano.
 */
export default function SelectorUbicacion({
  inicial,
  referencia,
  cargarCapas,
  onConfirmar,
  onCerrar,
}: {
  inicial: InicialSelector;
  referencia: { lat: number; lon: number; etiqueta?: string } | null;
  cargarCapas?: CargarCapas;
  onConfirmar: (lat: number, lon: number, punto: PuntoElegido | null) => void;
  onCerrar: () => void;
}) {
  const nodoMapa = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const capaPuntos = useRef<L.LayerGroup | null>(null);
  const capaCirculo = useRef<L.LayerGroup | null>(null);
  const marcadores = useRef<Array<L.Marker | L.CircleMarker>>([]);
  // Valores con los que se abrió: el mapa se monta una sola vez con ellos
  const apertura = useRef({ inicial, referencia, cargarCapas });

  const [coords, setCoords] = useState(
    inicial.preseleccionar ? { lat: inicial.lat, lon: inicial.lon } : null,
  );
  const [seleccion, setSeleccion] = useState<PuntoElegido | null>(null);
  const [capas, setCapas] = useState<EstadoCapas>({
    estado: cargarCapas ? 'cargando' : 'sin-capas',
    puntos: [],
    categorias: [],
    resumen: '',
  });
  // { idCategoria: true } = visible. Vacío al abrir: todas las capas apagadas
  const [filtros, setFiltros] = useState<Record<string, boolean>>({});
  const [aviso, setAviso] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [edificio, setEdificio] = useState<PuntoRed | null>(null);

  const elegirCoords = useCallback((lat: number, lon: number, punto: PuntoElegido | null = null) => {
    setCoords({ lat, lon });
    setSeleccion(punto);
    setAviso('');
  }, []);

  // Mapa, pin y referencia (una vez)
  useEffect(() => {
    const { inicial: i, referencia: ref } = apertura.current;
    if (!nodoMapa.current) return;
    const instancia = L.map(nodoMapa.current, { zoomControl: true }).setView([i.lat, i.lon], i.zoom);
    const { tile } = configMapa;
    L.tileLayer(tile.url, {
      subdomains: [...tile.subdomains],
      attribution: tile.attribution,
      maxZoom: tile.maxZoom,
    }).addTo(instancia);

    if (ref) {
      L.circleMarker([ref.lat, ref.lon], {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: '#546e7a',
        fillOpacity: 0.9,
      })
        .addTo(instancia)
        .bindTooltip(ref.etiqueta || 'Referencia');
    }

    const marcadorPin = L.marker([i.lat, i.lon], {
      draggable: true,
      icon: L.divIcon({ className: 'selector-pin', html: PIN_SVG, iconSize: [30, 42], iconAnchor: [15, 42] }),
    }).addTo(instancia);
    instancia.on('click', (e: L.LeafletMouseEvent) => {
      marcadorPin.setLatLng(e.latlng);
      elegirCoords(e.latlng.lat, e.latlng.lng);
    });
    marcadorPin.on('dragend', () => {
      const ll = marcadorPin.getLatLng();
      elegirCoords(ll.lat, ll.lng);
    });

    capaPuntos.current = L.layerGroup().addTo(instancia);
    capaCirculo.current = L.layerGroup().addTo(instancia);
    mapa.current = instancia;
    pin.current = marcadorPin;
    const temporizador = setTimeout(() => instancia.invalidateSize(), 50);
    return () => {
      clearTimeout(temporizador);
      destruirMapaLeaflet(instancia);
      mapa.current = null;
    };
  }, [elegirCoords]);

  const aplicarCapas = useCallback((r: Capas | null) => {
    if (r === null) return; // sin cambios
    setCapas({ estado: 'listo', ...r });
  }, []);

  // Capas al abrir
  useEffect(() => {
    const cargar = apertura.current.cargarCapas;
    if (!cargar) return undefined;
    const carga = { vigente: true };
    cargar()
      .then((r) => {
        if (carga.vigente) aplicarCapas(r);
      })
      .catch((error: unknown) => {
        console.error('No se pudieron cargar las capas:', error);
        if (carga.vigente)
          setCapas((c) => ({
            ...c,
            estado: 'error',
            resumen: 'No se pudo consultar la cobertura de la zona.',
          }));
      });
    return () => {
      carga.vigente = false;
    };
  }, [aplicarCapas]);

  // Dibuja los puntos y el círculo de la consulta cuando cambian las capas
  useEffect(() => {
    const grupo = capaPuntos.current;
    const circulo = capaCirculo.current;
    if (!mapa.current || !grupo || !circulo) return;
    grupo.clearLayers();
    circulo.clearLayers();
    marcadores.current = capas.puntos.map((p, i) => {
      // bubblingMouseEvents: false → el clic abre la ficha y no mueve el pin
      const capa =
        p.forma === 'cuadro'
          ? L.marker([p.lat, p.lon], {
              icon: L.divIcon({
                className: 'selector-cuadro',
                html: `<span style="background:${p.color}"></span>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              }),
              bubblingMouseEvents: false,
            })
          : L.circleMarker([p.lat, p.lon], {
              radius: 8,
              color: '#ffffff',
              weight: 2,
              fillColor: p.color,
              fillOpacity: 0.95,
              bubblingMouseEvents: false,
            });
      return capa.bindPopup(htmlFicha(p, i), { maxWidth: 300 }).bindTooltip(p.titulo);
    });
    if (capas.circulo) {
      const { lat, lon, metros } = capas.circulo;
      L.circle([lat, lon], {
        radius: metros,
        color: '#1a73e8',
        weight: 1.5,
        fillColor: '#1a73e8',
        fillOpacity: 0.06,
        dashArray: '6 6',
        interactive: false,
      }).addTo(circulo);
    }
  }, [capas]);

  // Filtros: los puntos sin categoría siempre se ven
  useEffect(() => {
    const grupo = capaPuntos.current;
    if (!grupo) return;
    marcadores.current.forEach((m, i) => {
      const p = capas.puntos[i];
      const visible = !p?.categoria || Boolean(filtros[p.categoria]);
      if (visible && !grupo.hasLayer(m)) grupo.addLayer(m);
      if (!visible && grupo.hasLayer(m)) {
        if (m.isPopupOpen()) m.closePopup();
        grupo.removeLayer(m);
      }
    });
  }, [filtros, capas]);

  const ponerPin = (lat: number, lon: number) => pin.current?.setLatLng([lat, lon]);

  const elegirPunto = useCallback(
    (p: PuntoRed | undefined) => {
      if (!p?.seleccionable) return;
      mapa.current?.closePopup();
      pin.current?.setLatLng([p.lat, p.lon]);
      elegirCoords(p.lat, p.lon, p);
    },
    [elegirCoords],
  );

  // Botones de las fichas. En captura porque Leaflet detiene la propagación de los clics en sus popups
  useEffect(() => {
    const nodo = nodoMapa.current;
    if (!nodo) return;
    const alClic = (e: MouseEvent) => {
      const boton = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('[data-accion]');
      if (!boton) return;
      e.stopPropagation();
      const punto = capas.puntos[Number(boton.dataset.indice)];
      if (boton.dataset.accion === 'edificio') setEdificio(punto ?? null);
      else elegirPunto(punto);
    };
    nodo.addEventListener('click', alClic, true);
    return () => nodo.removeEventListener('click', alClic, true);
  }, [capas, elegirPunto]);

  const vista = (): Vista | null => {
    if (!mapa.current) return null;
    const c = mapa.current.getCenter();
    return { lat: c.lat, lon: c.lng, zoom: mapa.current.getZoom() };
  };

  const irA = (lat: number, lon: number, zoom?: number) => {
    const instancia = mapa.current;
    if (!instancia) return;
    instancia.closePopup();
    ponerPin(lat, lon);
    instancia.setView([lat, lon], zoom || Math.max(instancia.getZoom(), inicial.zoom));
    elegirCoords(lat, lon);
  };

  const abrirFicha = (indice: number) => {
    const p = capas.puntos[indice];
    if (p?.categoria && !filtros[p.categoria]) setFiltros((f) => ({ ...f, [p.categoria]: true }));
    // Después de que el filtro vuelva a agregar el marcador
    setTimeout(() => {
      const m = marcadores.current[indice];
      const instancia = mapa.current;
      if (!m || !instancia) return;
      // Sin animación: así Leaflet puede desplazar el mapa para que la ficha se vea completa
      instancia.setView(m.getLatLng(), Math.max(instancia.getZoom(), configBuscador.zoomAlEnfocar), {
        animate: false,
      });
      m.openPopup();
    }, 0);
  };

  // Zona (estado, ciudad, sector): se encuadra sin mover el pin. Lugar puntual: pin y nueva consulta de capas
  const elegirLugar = (lugar: Lugar) => {
    const instancia = mapa.current;
    if (!instancia) return;
    if (lugar.esArea) {
      instancia.closePopup();
      if (lugar.extent) {
        const z = lugar.extent;
        instancia.fitBounds(
          [
            [z.sur, z.oeste],
            [z.norte, z.este],
          ],
          { padding: [20, 20], maxZoom: 17 },
        );
      } else {
        instancia.setView([lugar.lat, lugar.lon], lugar.zoom);
      }
      setAviso(`${lugar.tipo}: ${lugar.nombre} · acerque el mapa y haga clic en la dirección exacta`);
      return;
    }
    irA(lugar.lat, lugar.lon, lugar.zoom);
    cargarCapas?.({ lat: lugar.lat, lon: lugar.lon })
      .then(aplicarCapas)
      .catch((e: unknown) => console.error('No se pudieron cargar las capas:', e));
  };

  // Buscador: vacío → sugerencias; coordenadas → "Ir a"; texto → infraestructura + lugares.
  // irA, elegirLugar, abrirFicha y vista leen las referencias de Leaflet, pero solo se ejecutan al elegir una
  // opción o al buscar (nunca al dibujar). La regla no puede deducirlo porque pasan por funciones auxiliares.
  /* oxlint-disable react/refs */
  const consulta = busqueda.trim();
  const secCoordenadas = seccionCoordenadas(consulta, {
    soloLugares: false,
    onElegir: (lat, lon) => irA(lat, lon),
  });
  const lugares = useBuscarLugares(consulta, vista, { activo: Boolean(consulta) && !secCoordenadas });
  const { limitePuntos, sugerencias, minCaracteres } = configBuscador;
  let secciones: SeccionCombobox[];
  if (!consulta) {
    const cercanos = sugerenciasPuntos(capas.puntos, sugerencias);
    secciones = cercanos.length
      ? [seccionPuntos('Más cercanos con puertos disponibles', cercanos, abrirFicha)]
      : [
          {
            titulo: 'Buscar',
            items: [],
            mensaje: 'Escriba una NAP, un edificio, una dirección o coordenadas',
          },
        ];
  } else if (secCoordenadas) {
    secciones = [secCoordenadas];
  } else {
    const encontrados = buscarPuntos(capas.puntos, consulta, limitePuntos);
    secciones = [seccionPuntos('Infraestructura Netuno', encontrados, abrirFicha)];
    if (consulta.length >= minCaracteres) secciones.push(seccionLugares(lugares, consulta, elegirLugar));
    else if (!encontrados.length) {
      secciones.push({
        titulo: 'Sin resultados',
        items: [],
        mensaje: `Escriba al menos ${minCaracteres} caracteres para buscar lugares`,
      });
    }
  }

  /* oxlint-enable react/refs */

  const conteo = capas.puntos.reduce<Record<string, number>>(
    (acc, p) => ({ ...acc, [p.categoria]: (acc[p.categoria] ?? 0) + 1 }),
    {},
  );
  const todas = capas.categorias.length > 0 && capas.categorias.every((c) => filtros[c.id]);
  const alguna = capas.categorias.some((c) => filtros[c.id]);

  return (
    <Modal
      abierto
      titulo="Seleccionar ubicación"
      subtitulo="Haga clic en el mapa o arrastre el pin hasta la nueva dirección del cliente."
      onCerrar={onCerrar}
      ancho="max-w-5xl"
      pie={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="text-[13px]">
            <div>
              Coordenadas:{' '}
              <span className="font-mono">
                {coords
                  ? `${fijarCoordenada(coords.lat)}, ${fijarCoordenada(coords.lon)}`
                  : 'Haga clic en el mapa o arrastre el pin'}
              </span>
            </div>
            {(aviso || seleccion) && (
              <div className={cn('text-xs', aviso ? 'text-accion' : 'font-bold text-gray-700')}>
                {aviso || `Seleccionado: ${seleccion?.etiqueta}`}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Boton variante="secundario" onClick={onCerrar}>
              Cancelar
            </Boton>
            <Boton
              disabled={!coords}
              onClick={() => coords && onConfirmar(coords.lat, coords.lon, seleccion)}
            >
              Usar esta ubicación
            </Boton>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <Combobox
          valor={busqueda}
          onCambiar={setBusqueda}
          secciones={secciones}
          etiqueta="Buscar NAP, edificio, dirección o coordenadas"
          placeholder="Buscar NAP, edificio, dirección o coordenadas..."
          conLimpiar
        />
        <div ref={nodoMapa} className="h-[52vh] min-h-72 rounded border border-gray-200" />

        {capas.estado !== 'sin-capas' && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Mostrar en el mapa">
              {capas.categorias.length > 0 && (
                <BotonFiltro
                  activo={todas}
                  onClick={() => setFiltros(Object.fromEntries(capas.categorias.map((c) => [c.id, !todas])))}
                >
                  Todos
                </BotonFiltro>
              )}
              {capas.categorias.map((c) => (
                <BotonFiltro
                  key={c.id}
                  activo={Boolean(filtros[c.id])}
                  color={c.color}
                  forma={c.forma}
                  onClick={() => setFiltros((f) => ({ ...f, [c.id]: !f[c.id] }))}
                >
                  {c.etiqueta} ({conteo[c.id] ?? 0})
                </BotonFiltro>
              ))}
              {capas.categorias.length > 0 && !alguna && (
                <span className="text-xs text-accion italic">Active una capa para verla en el mapa</span>
              )}
            </div>
            <span className="text-xs font-bold text-gray-700">
              {capas.estado === 'cargando' ? 'Consultando cobertura...' : capas.resumen}
            </span>
          </div>
        )}
      </div>

      {edificio && (
        <VistaEdificio
          mdu={edificio.mdu}
          subtitulo={[edificio.grupoEtiqueta, edificio.zonaEtiqueta].filter(Boolean).join(' · ')}
          soloConsulta={!edificio.seleccionable}
          onCerrar={() => setEdificio(null)}
          onElegir={(unidad) => {
            const conUnidad: PuntoElegido = {
              ...edificio,
              unidad,
              etiqueta: `${edificio.etiqueta} · ${unidad.piso} · Unidad ${unidad.unidad}`,
            };
            setEdificio(null);
            mapa.current?.closePopup();
            ponerPin(edificio.lat, edificio.lon);
            elegirCoords(edificio.lat, edificio.lon, conUnidad);
          }}
        />
      )}
    </Modal>
  );
}
