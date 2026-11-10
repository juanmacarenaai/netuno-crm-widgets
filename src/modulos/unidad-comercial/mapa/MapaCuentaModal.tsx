import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { netunoApi } from '@/services/netuno.api';
import { estaConectado, type Cuenta } from '@/shared/cuentas';
import { Boton, cn, Modal, PuntoEstado } from '@/ui';
import { describirMotivo } from '../lib/coordenadas';
import { destruirMapaLeaflet } from '../lib/leaflet';
import { colorServicio, obtenerPuntosCuenta, type ContratoBossMapa, type PuntoMapa } from '../lib/mapa';

// Mismos valores que app/maps/maps.config.js
const VISTA_INICIAL = { centro: [10.05, -67.9] as L.LatLngTuple, zoom: 11 };
const ZOOM_AL_ENFOCAR = 17;
const MAX_CONSULTAS_SIMULTANEAS = 4;
const TILES = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
};

function escaparHtml(valor: unknown): string {
  return String(valor ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

function contenidoPopup(p: PuntoMapa): string {
  return (
    `<strong>${escaparHtml(p.servicio)}</strong><br>${p.paquete ? `${escaparHtml(p.paquete)}<br>` : ''}` +
    `Contrato: ${escaparHtml(p.codContrato || p.idProducto || '-')}<br>` +
    `${p.estado ? `Estado: ${escaparHtml(p.estado)}<br>` : ''}` +
    `<span style="color:#666;font-size:11px">${escaparHtml(p.direccionTexto)}</span>`
  );
}

function ItemPanel({
  punto,
  activo = false,
  onClick,
}: {
  punto: PuntoMapa;
  activo?: boolean;
  onClick?: () => void;
}) {
  const conGeo = punto.geo.ok && punto.lat !== null && punto.lon !== null;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={!conGeo}
        className={cn(
          'w-full rounded border p-2 text-left text-xs transition',
          activo ? 'border-netuno-link bg-sky-50' : 'border-gray-200 bg-white',
          conGeo ? 'hover:border-netuno-link' : 'cursor-default',
        )}
      >
        <span className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: colorServicio(punto.servicio) }}
          />
          <strong className="text-sm">{punto.servicio}</strong>
          <span className="ml-auto" title={punto.estado ?? undefined}>
            <PuntoEstado activo={estaConectado(punto.estado)} />
          </span>
        </span>
        <span className="block text-texto">{punto.paquete || 'Sin plan'}</span>
        <span className="block text-texto-suave">
          Contrato: {punto.codContrato || punto.idProducto || '-'}
        </span>
        <span className="block text-texto-suave">{punto.direccionTexto}</span>
        {conGeo ? (
          <span className="block font-mono text-texto-suave">
            {punto.lat?.toFixed(6)}, {punto.lon?.toFixed(6)}
          </span>
        ) : (
          <>
            <span className="block font-semibold text-desconectado">
              {punto.error || describirMotivo(punto.geo)}
            </span>
            {punto.geo.crudo != null && (
              <span className="block font-mono break-all text-texto-suave" title="Valor recibido de la API">
                {String(punto.geo.crudo)}
              </span>
            )}
          </>
        )}
      </button>
    </li>
  );
}

interface Estado {
  cargando: boolean;
  error: Error | null;
  total: number;
}

/**
 * Mapa con todos los servicios de una cuenta (una consulta de contrato por servicio).
 * Con `idProductoFoco` enfoca ese servicio al terminar. Se carga en su propio chunk (Leaflet pesa ~150 KB).
 */
export default function MapaCuentaModal({
  cuenta,
  idProductoFoco,
  onCerrar,
}: {
  cuenta: Cuenta;
  idProductoFoco?: string;
  onCerrar: () => void;
}) {
  const nodoMapa = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capa = useRef<L.LayerGroup | null>(null);
  const marcadores = useRef<Record<string, L.CircleMarker>>({});
  const [puntos, setPuntos] = useState<PuntoMapa[]>([]);
  const [estado, setEstado] = useState<Estado>({
    cargando: true,
    error: null,
    total: cuenta.contratos?.length ?? 0,
  });
  const [activo, setActivo] = useState<string | null>(null);
  const [ronda, setRonda] = useState(0);

  // Montaje del mapa (una vez)
  useEffect(() => {
    if (!nodoMapa.current) return;
    const instancia = L.map(nodoMapa.current, {
      center: VISTA_INICIAL.centro,
      zoom: VISTA_INICIAL.zoom,
      scrollWheelZoom: true,
    });
    L.tileLayer(TILES.url, {
      subdomains: ['a', 'b', 'c'],
      attribution: TILES.attribution,
      maxZoom: TILES.maxZoom,
    }).addTo(instancia);
    capa.current = L.layerGroup().addTo(instancia);
    mapa.current = instancia;
    // El modal termina de medir su tamaño después del primer render
    const temporizador = setTimeout(() => instancia.invalidateSize(), 50);
    return () => {
      clearTimeout(temporizador);
      destruirMapaLeaflet(instancia);
      mapa.current = null;
    };
  }, []);

  const enfocar = useCallback((id: string) => {
    const marcador = marcadores.current[id];
    if (!marcador || !mapa.current) return;
    mapa.current.setView(marcador.getLatLng(), ZOOM_AL_ENFOCAR);
    marcador.openPopup();
    setActivo(id);
  }, []);

  // Marcadores cada vez que cambian los puntos (se dibujan a medida que llegan)
  useEffect(() => {
    const grupo = capa.current;
    const instancia = mapa.current;
    if (!grupo || !instancia) return;
    grupo.clearLayers();
    marcadores.current = {};

    const conGeo = puntos.filter(
      (p): p is PuntoMapa & { lat: number; lon: number } => p.geo.ok && p.lat !== null && p.lon !== null,
    );
    for (const p of conGeo) {
      const marcador = L.circleMarker([p.lat, p.lon], {
        radius: 9,
        color: '#ffffff',
        weight: 2,
        fillColor: colorServicio(p.servicio),
        fillOpacity: 0.95,
      }).bindPopup(contenidoPopup(p));
      marcador.on('click', () => setActivo(p.id));
      marcador.addTo(grupo);
      marcadores.current[p.id] = marcador;
    }

    const [unico] = conGeo;
    if (conGeo.length === 1 && unico) {
      instancia.setView([unico.lat, unico.lon], ZOOM_AL_ENFOCAR - 2);
    } else if (conGeo.length > 1) {
      instancia.fitBounds(L.latLngBounds(conGeo.map((p) => [p.lat, p.lon] as L.LatLngTuple)), {
        padding: [40, 40],
        maxZoom: ZOOM_AL_ENFOCAR,
      });
    }
  }, [puntos]);

  // Consulta los contratos; `vigente` descarta los resultados de una ronda reemplazada por "Refrescar" o al cerrar
  useEffect(() => {
    let vigente = true;
    void obtenerPuntosCuenta(cuenta, (id) => netunoApi.contrato<ContratoBossMapa>(id), {
      limite: MAX_CONSULTAS_SIMULTANEAS,
      alProgresar: ({ puntos: parciales }) => {
        if (vigente) setPuntos(parciales);
      },
    }).then(
      (resultado) => {
        if (!vigente) return;
        setPuntos(resultado.puntos);
        setEstado({ cargando: false, error: null, total: resultado.puntos.length });
        if (idProductoFoco) {
          const objetivo = resultado.puntos.find(
            (p) =>
              p.geo.ok &&
              (p.idProducto === idProductoFoco || String(p.codContrato) === String(idProductoFoco)),
          );
          if (objetivo) setTimeout(() => enfocar(objetivo.id), 120);
        }
      },
      (error: unknown) => {
        if (vigente)
          setEstado({
            cargando: false,
            error: error instanceof Error ? error : new Error(String(error)),
            total: 0,
          });
      },
    );
    return () => {
      vigente = false;
    };
    // `ronda` no se lee dentro del efecto a propósito: cambiarla es lo que vuelve a consultar ("Refrescar")
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [cuenta, idProductoFoco, enfocar, ronda]);

  const refrescar = () => {
    setPuntos([]);
    setActivo(null);
    setEstado({ cargando: true, error: null, total: cuenta.contratos?.length ?? 0 });
    setRonda((n) => n + 1);
  };

  const conGeo = puntos.filter((p) => p.geo.ok);
  const sinGeo = puntos.filter((p) => !p.geo.ok);
  const titulo = cuenta.descTipoCliente
    ? `${cuenta.descTipoCliente} ${cuenta.cuenta}`
    : String(cuenta.cuenta);

  return (
    <Modal
      abierto
      titulo={`Mapa de ubicaciones - ${titulo}`}
      onCerrar={onCerrar}
      ancho="max-w-6xl"
      pie={
        <Boton variante="secundario" onClick={refrescar} disabled={estado.cargando}>
          Refrescar
        </Boton>
      }
    >
      {estado.cargando && (
        <p className="mb-2 rounded bg-sky-50 px-3 py-1.5 text-xs text-sky-800" role="status">
          Cargando ubicaciones ({puntos.length} de {estado.total})... Una consulta por contrato.
        </p>
      )}
      {estado.error && (
        <p className="mb-2 rounded bg-red-50 px-3 py-1.5 text-xs text-red-800" role="alert">
          No se pudo cargar el mapa: {estado.error.message}
        </p>
      )}

      <div className="flex flex-col gap-3 md:flex-row">
        <div ref={nodoMapa} className="h-[420px] flex-1 rounded border border-gray-200 md:h-[520px]" />

        <aside className="flex flex-col gap-2 md:max-h-[520px] md:w-80 md:overflow-y-auto">
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800">
              {conGeo.length} en el mapa
            </span>
            {sinGeo.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                {sinGeo.length} sin geolocalizar
              </span>
            )}
          </div>

          {!estado.cargando && puntos.length === 0 && (
            <p className="text-sm text-texto-suave">Este cliente no tiene servicios asociados.</p>
          )}
          {!estado.cargando && puntos.length > 0 && conGeo.length === 0 && (
            <p className="text-sm text-texto-suave">
              Ningún servicio de esta cuenta tiene coordenadas registradas.
            </p>
          )}

          <ul className="flex flex-col gap-1.5">
            {conGeo.map((p) => (
              <ItemPanel key={p.id} punto={p} activo={activo === p.id} onClick={() => enfocar(p.id)} />
            ))}
          </ul>

          {sinGeo.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-texto-suave">
                Ver sin geolocalizar ({sinGeo.length})
              </summary>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {sinGeo.map((p) => (
                  <ItemPanel key={p.id} punto={p} />
                ))}
              </ul>
            </details>
          )}
        </aside>
      </div>
    </Modal>
  );
}
