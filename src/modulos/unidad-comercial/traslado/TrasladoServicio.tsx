import { createElement, lazy, Suspense, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Crosshair,
  FileText,
  Globe,
  MapPin,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { mensajeDeError } from '@/core/http/errores';
import { actualizarRegistro } from '@/services/crm.api';
import { netunoApi } from '@/services/netuno.api';
import type { Cuenta } from '@/shared/cuentas';
import { useZoho } from '@/shared/zoho/contexto';
import { useAgenteDesk } from '@/shared/zoho/useAgenteDesk';
import {
  Boton,
  CampoFormulario,
  Cargando,
  CLASE_CONTROL,
  CLASE_LECTURA,
  cn,
  Modal,
  SeccionFormulario,
  useAvisos,
} from '@/ui';
import { AutocompletarDireccion } from './componentes/AutocompletarDireccion';
import type { CargarCapas, InicialSelector } from './componentes/SelectorUbicacion';
import { camposTraslado, configEdificio, configMapa, configWeezie, type ConsultaWeezie } from './config';
import type { Lugar, Vista } from './lib/lugares';
import {
  armarSolicitud,
  CANALES_TRASLADO,
  contratoReferencia,
  contratosParaTraslado,
  coordenadasPegadas,
  datosDesdeContratoBoss,
  direccionActual,
  esEmpresa,
  estadoSegunCanal,
  etiquetaContrato,
  fechaMinima,
  fijarCoordenada,
  leerCoordenadas,
  observacionesConUnidad,
  puedeConfirmar,
  resultadoDesdePunto,
  simularCobertura,
  textoResultado,
  TIPOS_VIVIENDA,
  tipoViviendaTrasPunto,
  ZONAS,
  type ResultadoCobertura,
  type TipoVivienda,
  type Zona,
} from './lib/traslado';
import { CATEGORIAS, resumenWeezie, type PuntoRed } from './lib/weezie';
import { consultaPorDefecto, consultarWeezie, weezieUsaMuestra } from './servicios';

// Leaflet solo se descarga cuando se abre el mapa
const SelectorUbicacion = lazy(() => import('./componentes/SelectorUbicacion'));

const ESTILO_ZONA: Record<Zona, string> = {
  Verde: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Naranja: 'border-orange-200 bg-orange-50 text-orange-700',
  Roja: 'border-red-200 bg-red-50 text-red-700',
};
const ICONO_ZONA: Record<Zona, LucideIcon> = { Verde: CheckCircle2, Naranja: TriangleAlert, Roja: XCircle };

interface Formulario {
  contratoId: string;
  observaciones: string;
  direccionNueva: string;
  vivienda: TipoVivienda;
  fechaActivacion: string;
  canalAtencion: string;
  latitud: string;
  longitud: string;
}

const FORMULARIO_INICIAL: Formulario = {
  contratoId: 'Seleccione',
  observaciones: '',
  direccionNueva: '',
  vivienda: { valor: 'Casa', automatico: false },
  fechaActivacion: '',
  canalAtencion: 'Oficina',
  latitud: '',
  longitud: '',
};

interface Proceso {
  estado: 'inactivo' | 'validando' | 'guardando';
  resultado: ResultadoCobertura | null;
  guardado: { tipo: 'ok' | 'error' | 'proceso'; texto: string } | null;
}

const SIN_PROCESO: Proceso = { estado: 'inactivo', resultado: null, guardado: null };

/**
 * Traslado de servicio (pestaña de Administrar cuenta). Guarda la solicitud como JSON en el cliente
 * (Solicitud_Traslado) y su estado (Estado_Traslado); las reglas de flujo de trabajo de CRM hacen el resto.
 */
export function TrasladoServicio({ cuenta }: { cuenta: Cuenta }) {
  const { usuario, registro, documento } = useZoho();
  const agenteDesk = useAgenteDesk();
  const { avisar } = useAvisos();
  const empresa = esEmpresa(cuenta);
  const contratos = useMemo(() => contratosParaTraslado(cuenta), [cuenta]);
  const correo = String(registro.email ?? '').trim();

  const [f, setF] = useState<Formulario>(FORMULARIO_INICIAL);
  const [punto, setPunto] = useState<PuntoRed | null>(null); // NAP o edificio de Weezie elegido en el mapa
  const coordsDesdeDireccion = useRef(false);
  const [ayudaDireccion, setAyudaDireccion] = useState('');
  const [errores, setErrores] = useState({ contrato: '', geo: '' });
  const [proceso, setProceso] = useState<Proceso>(SIN_PROCESO);
  const [selector, setSelector] = useState<{ inicial: InicialSelector; cargarCapas: CargarCapas } | null>(
    null,
  );

  const cambiar = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) =>
    setF((anterior) => ({ ...anterior, [campo]: valor }));
  const limpiarResultado = () => setProceso((p) => (p.estado === 'inactivo' ? SIN_PROCESO : p));

  // Contrato del que se heredan política, dirección y GPS. Hogar: el de Internet (o el primero)
  const contratoDetalle = empresa
    ? (contratos.find((c) => String(c.idProducto) === f.contratoId) ?? null)
    : contratoReferencia(contratos);
  const idDetalle = contratoDetalle?.idProducto ?? null;

  // Política y GPS vienen del contrato en BOSS. Si falla, el formulario sigue con "Sin datos"
  const boss = useQuery({
    queryKey: ['netuno', 'contrato-traslado', idDetalle],
    queryFn: async () => datosDesdeContratoBoss(await netunoApi.contrato(idDetalle ?? '')),
    enabled: idDetalle !== null,
    retry: false,
  });
  const detalle = {
    consultando: idDetalle !== null && boss.isPending,
    direccion: contratoDetalle ? direccionActual(contratoDetalle) : '', // desde la cuenta, sin esperar a la API
    politica: boss.data?.politica ?? (boss.isError ? 'Sin datos' : ''),
    gpsTexto: boss.data?.gpsTexto ?? '',
    gpsActual: boss.data?.gpsActual ?? null,
  };

  const prefijo = configEdificio.prefijoObservacion;

  // nuevoPunto: NAP o edificio de Weezie (null si se movió el pin a mano o se pegaron o escribieron coordenadas)
  const asignarCoordenadas = (lat: number, lon: number, nuevoPunto: PuntoRed | null = null) => {
    setF((anterior) => ({
      ...anterior,
      latitud: fijarCoordenada(lat),
      longitud: fijarCoordenada(lon),
      observaciones: observacionesConUnidad(
        anterior.observaciones,
        nuevoPunto?.unidad?.texto ?? null,
        prefijo,
      ),
      vivienda: tipoViviendaTrasPunto(anterior.vivienda, nuevoPunto),
    }));
    setPunto(nuevoPunto);
    coordsDesdeDireccion.current = false;
    setErrores((e) => ({ ...e, geo: '' }));
    limpiarResultado();
  };

  // Al escribir coordenadas a mano deja de valer el punto elegido (y la unidad del edificio)
  const editarCoordenada = (campo: 'latitud' | 'longitud', valor: string) => {
    setF((anterior) => ({
      ...anterior,
      [campo]: valor,
      observaciones: observacionesConUnidad(anterior.observaciones, null, prefijo),
      vivienda: tipoViviendaTrasPunto(anterior.vivienda, null),
    }));
    setPunto(null);
    coordsDesdeDireccion.current = false;
    limpiarResultado();
  };

  const pegarCoordenadas = (e: ClipboardEvent<HTMLInputElement>) => {
    const geo = coordenadasPegadas(e.clipboardData?.getData('text'));
    if (!geo) return; // un solo número u otro texto: pegado normal
    e.preventDefault();
    asignarCoordenadas(geo.lat, geo.lon);
  };

  // Autocompletado de "Dirección nueva": zona → solo texto; lugar puntual → también coordenadas
  const elegirLugar = (lugar: Lugar) => {
    cambiar('direccionNueva', [lugar.nombre, lugar.detalle].filter(Boolean).join(', '));
    if (lugar.esArea) {
      if (coordsDesdeDireccion.current) {
        editarCoordenada('latitud', '');
        cambiar('longitud', '');
      }
      setAyudaDireccion(
        `${lugar.tipo} seleccionado: complete calle, edificio o casa y marque el punto exacto en el mapa.`,
      );
    } else {
      asignarCoordenadas(lugar.lat, lugar.lon);
      coordsDesdeDireccion.current = true;
      setAyudaDireccion(
        `Coordenadas tomadas de «${lugar.nombre}» (${lugar.tipo}). Complete piso, apto. o casa y verifique en el mapa.`,
      );
    }
  };

  // Prioriza lugares cerca de las coordenadas escritas o, si no hay, de la dirección actual
  const vistaDireccion = (): Vista | null => {
    const escritas = leerCoordenadas(f.latitud, f.longitud);
    const base = escritas.ok ? escritas : detalle.gpsActual;
    return base ? { lat: base.lat, lon: base.lon, zoom: 12 } : null;
  };

  // Capas de Weezie. Con la muestra no se vuelve a consultar al buscar un lugar (siempre es la misma zona)
  const capasWeezie =
    (consulta: Pick<ConsultaWeezie, 'lat' | 'lon'>): CargarCapas =>
    async (nuevoPunto) => {
      if (nuevoPunto && weezieUsaMuestra()) return null;
      const r = await consultarWeezie(nuevoPunto ?? consulta);
      return {
        puntos: r.puntos,
        categorias: CATEGORIAS,
        circulo: { lat: r.consulta.lat, lon: r.consulta.lon, metros: r.consulta.radius ?? 0 },
        resumen: resumenWeezie(r),
      };
    };

  const referencia = detalle.gpsActual ? { ...detalle.gpsActual, etiqueta: 'Dirección actual' } : null;

  // "Abrir mapa": se enfoca en el punto consultado a Weezie y muestra NAP y edificios
  const abrirMapa = () => {
    setErrores((e) => ({ ...e, geo: '' }));
    const consulta = consultaPorDefecto();
    setSelector({
      inicial: { lat: consulta.lat, lon: consulta.lon, zoom: configWeezie.zoom, preseleccionar: false },
      cargarCapas: capasWeezie(consulta),
    });
  };

  // "Ubicar en mapa": valida las coordenadas escritas y las muestra en el mapa
  const ubicarEnMapa = () => {
    const escritas = leerCoordenadas(f.latitud, f.longitud);
    if (!escritas.ok) return setErrores((e) => ({ ...e, geo: escritas.mensaje }));
    setErrores((e) => ({ ...e, geo: '' }));
    setSelector({
      inicial: { lat: escritas.lat, lon: escritas.lon, zoom: configMapa.selector.zoom, preseleccionar: true },
      cargarCapas: capasWeezie(escritas),
    });
  };

  const habilitado = puedeConfirmar({ ...f, correoCliente: correo });

  /**
   * "Confirmar Ubicación": valida la cobertura y, si hay (Verde o Naranja), guarda la solicitud en el cliente.
   * DEMO: sin NAP/edificio elegido en el mapa el resultado es simulado (pendiente la consulta real de cobertura).
   */
  const confirmar = () => {
    if (empresa && f.contratoId === 'Seleccione') {
      return setErrores((e) => ({ ...e, contrato: 'Debe seleccionar el contrato' }));
    }
    const escritas = leerCoordenadas(f.latitud, f.longitud);
    if (!escritas.ok) return setErrores((e) => ({ ...e, geo: escritas.mensaje }));
    setErrores({ contrato: '', geo: '' });
    setProceso({ estado: 'validando', resultado: null, guardado: null });

    setTimeout(async () => {
      const resultado = punto
        ? resultadoDesdePunto(punto, configWeezie.puertos.alto)
        : simularCobertura(escritas.lat, escritas.lon, f.longitud.trim());
      if (resultado.zona === ZONAS.ROJA) return setProceso({ estado: 'inactivo', resultado, guardado: null });

      setProceso({
        estado: 'guardando',
        resultado,
        guardado: { tipo: 'proceso', texto: 'Guardando solicitud en Zoho CRM...' },
      });
      const solicitud = armarSolicitud({
        cuenta,
        contrato: empresa ? contratoDetalle : null,
        formulario: {
          politica: detalle.politica,
          direccionActual: detalle.direccion,
          direccionNueva: f.direccionNueva,
          tipoVivienda: f.vivienda.valor,
          fechaActivacion: f.fechaActivacion,
          canalAtencion: f.canalAtencion,
          observaciones: f.observaciones,
        },
        coordenadas: escritas,
        resultado,
        punto,
        cliente: { id: registro.id, documento, email: correo },
        agente: { nombre: usuario.nombre, id: usuario.id, idDesk: agenteDesk?.id ?? null },
        gpsActual: detalle.gpsActual,
      });
      const { estado, mensaje } = estadoSegunCanal(f.canalAtencion);
      try {
        await actualizarRegistro(
          camposTraslado.modulo,
          {
            id: registro.id,
            [camposTraslado.solicitud]: JSON.stringify(solicitud),
            [camposTraslado.estado]: estado,
          },
          { disparadores: ['workflow'] },
        );
        setProceso({ estado: 'inactivo', resultado, guardado: { tipo: 'ok', texto: mensaje } });
        avisar({ tipo: 'exito', titulo: 'Solicitud de traslado guardada', texto: mensaje });
      } catch (error) {
        console.error('Error al guardar la solicitud de traslado:', error);
        setProceso({
          estado: 'inactivo',
          resultado,
          guardado: {
            tipo: 'error',
            texto: `No se pudo guardar la solicitud en Zoho CRM: ${mensajeDeError(error)}`,
          },
        });
      }
    }, 900);
  };

  const ocupado = proceso.estado !== 'inactivo';
  const textoBoton = {
    inactivo: 'Confirmar Ubicación',
    validando: 'Validando ubicación...',
    guardando: 'Guardando solicitud...',
  }[proceso.estado];
  const remoto = f.canalAtencion !== 'Oficina';

  return (
    <div className="flex flex-col gap-5">
      <SeccionFormulario
        titulo="Registro de Solicitud"
        icono={FileText}
        insignia={String(cuenta.descTipoCliente ?? '').toUpperCase()}
      >
        <CampoFormulario
          etiqueta="Nro. Contrato"
          htmlFor="ts_contrato"
          requerido={empresa}
          lectura={!empresa}
          error={errores.contrato}
        >
          {empresa ? (
            <select
              id="ts_contrato"
              className={CLASE_CONTROL}
              value={f.contratoId}
              onChange={(e) => {
                cambiar('contratoId', e.target.value);
                setErrores((x) => ({ ...x, contrato: '' }));
              }}
            >
              <option value="Seleccione">— Seleccione un contrato —</option>
              {contratos.map((c) => (
                <option key={c.idProducto} value={String(c.idProducto)}>
                  {etiquetaContrato(c)}
                </option>
              ))}
            </select>
          ) : (
            <select id="ts_contrato" className={cn(CLASE_CONTROL, 'bg-gray-100')} disabled value="Todos">
              <option value="Todos">Todos los contratos</option>
            </select>
          )}
        </CampoFormulario>

        <CampoFormulario etiqueta="Política" htmlFor="ts_politica" lectura>
          <input
            id="ts_politica"
            readOnly
            className={CLASE_LECTURA}
            value={detalle.politica}
            placeholder={detalle.consultando ? 'Consultando...' : 'Se hereda del contrato seleccionado'}
          />
        </CampoFormulario>

        <CampoFormulario etiqueta="Dirección Actual">
          <div className={cn(CLASE_LECTURA, 'min-h-20')}>
            {detalle.direccion || (
              <span className="text-gray-400">Se completa al seleccionar el contrato</span>
            )}
            {detalle.gpsTexto && (
              <div className="mt-1 font-mono text-[11px] text-gray-400">{detalle.gpsTexto}</div>
            )}
          </div>
        </CampoFormulario>

        <CampoFormulario etiqueta="Observaciones" htmlFor="ts_observaciones">
          <textarea
            id="ts_observaciones"
            className={cn(CLASE_CONTROL, 'min-h-20')}
            value={f.observaciones}
            placeholder="Notas adicionales sobre la solicitud..."
            onChange={(e) => cambiar('observaciones', e.target.value)}
          />
        </CampoFormulario>
      </SeccionFormulario>

      <SeccionFormulario titulo="Nueva Ubicación del Servicio" icono={MapPin}>
        <CampoFormulario
          etiqueta="Dirección nueva"
          htmlFor="ts_direccionNueva"
          requerido
          completo
          ayuda={ayudaDireccion}
        >
          <AutocompletarDireccion
            id="ts_direccionNueva"
            valor={f.direccionNueva}
            onCambiar={(v) => {
              cambiar('direccionNueva', v);
              limpiarResultado();
            }}
            obtenerVista={vistaDireccion}
            onElegirLugar={elegirLugar}
            onElegirCoordenadas={(lat, lon) => {
              asignarCoordenadas(lat, lon);
              setAyudaDireccion('Latitud y longitud completadas con las coordenadas escritas.');
            }}
          />
        </CampoFormulario>

        <CampoFormulario etiqueta="Tipo de vivienda" htmlFor="ts_tipoVivienda">
          <select
            id="ts_tipoVivienda"
            className={CLASE_CONTROL}
            value={f.vivienda.valor}
            onChange={(e) => cambiar('vivienda', { valor: e.target.value, automatico: false })}
          >
            {TIPOS_VIVIENDA.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </CampoFormulario>

        <CampoFormulario
          etiqueta="Fecha de Activación"
          htmlFor="ts_fechaActivacion"
          requerido
          ayuda="Fecha en la que el cliente desea el servicio en la nueva dirección."
        >
          <input
            id="ts_fechaActivacion"
            type="date"
            className={CLASE_CONTROL}
            min={fechaMinima()}
            value={f.fechaActivacion}
            onChange={(e) => cambiar('fechaActivacion', e.target.value)}
          />
        </CampoFormulario>

        <CampoFormulario etiqueta="Canal de atención" htmlFor="ts_canalAtencion">
          <select
            id="ts_canalAtencion"
            className={CLASE_CONTROL}
            value={f.canalAtencion}
            onChange={(e) => cambiar('canalAtencion', e.target.value)}
          >
            {CANALES_TRASLADO.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </CampoFormulario>

        {remoto && (
          <CampoFormulario
            etiqueta="Correo electrónico"
            htmlFor="ts_correoCliente"
            lectura
            error={
              correo
                ? ''
                : 'El cliente no tiene correo electrónico registrado. Actualícelo en la ficha del cliente.'
            }
          >
            <input
              id="ts_correoCliente"
              readOnly
              className={CLASE_LECTURA}
              value={correo}
              placeholder="Sin correo registrado en el cliente"
            />
          </CampoFormulario>
        )}

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-bold text-gray-700">
              Geolocalización referencial <span className="text-red-600">*</span>
            </span>
            <Boton icono={MapPin} onClick={abrirMapa}>
              Abrir mapa
            </Boton>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-1 flex-col gap-1 text-[11px] text-gray-500">
              Latitud
              <input
                id="ts_latitud"
                inputMode="decimal"
                placeholder="10.4806"
                className={cn(CLASE_CONTROL, 'font-mono')}
                value={f.latitud}
                onPaste={pegarCoordenadas}
                onChange={(e) => editarCoordenada('latitud', e.target.value)}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-[11px] text-gray-500">
              Longitud
              <input
                id="ts_longitud"
                inputMode="decimal"
                placeholder="-66.9036"
                className={cn(CLASE_CONTROL, 'font-mono')}
                value={f.longitud}
                onPaste={pegarCoordenadas}
                onChange={(e) => editarCoordenada('longitud', e.target.value)}
              />
            </label>
            <Boton variante="secundario" icono={Crosshair} onClick={ubicarEnMapa}>
              Ubicar en mapa
            </Boton>
          </div>
          {errores.geo && (
            <span role="alert" className="text-xs font-bold text-red-600">
              {errores.geo}
            </span>
          )}
          <span className="text-[11px] text-gray-400">
            Pegue las coordenadas enviadas por el cliente (p. ej. vía BRUNO) o mueva el pin en el mapa con el
            cliente en oficina.
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <button
            type="button"
            onClick={confirmar}
            disabled={!habilitado.ok || ocupado}
            title={habilitado.motivo ?? undefined}
            aria-busy={ocupado || undefined}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-ts-cabecera px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-netuno-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Globe aria-hidden="true" className={cn('h-4 w-4', ocupado && 'animate-spin')} /> {textoBoton}
          </button>
          {proceso.resultado && (
            <div
              role="status"
              className={cn(
                'flex animate-aparecer items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-bold',
                ESTILO_ZONA[proceso.resultado.zona],
              )}
            >
              {createElement(ICONO_ZONA[proceso.resultado.zona], {
                'aria-hidden': true,
                className: 'h-4 w-4 shrink-0',
              })}
              <span>{textoResultado(proceso.resultado, f.direccionNueva)}</span>
            </div>
          )}
          {proceso.guardado && (
            <span
              className={cn(
                'text-xs',
                proceso.guardado.tipo === 'ok' && 'font-bold text-emerald-700',
                proceso.guardado.tipo === 'error' && 'font-bold text-red-600',
                proceso.guardado.tipo === 'proceso' && 'text-gray-500',
              )}
            >
              {proceso.guardado.texto}
            </span>
          )}
        </div>
      </SeccionFormulario>

      {selector && (
        <Suspense
          fallback={
            <Modal abierto titulo="Seleccionar ubicación" onCerrar={() => setSelector(null)}>
              <Cargando mensaje="Cargando el mapa..." />
            </Modal>
          }
        >
          <SelectorUbicacion
            inicial={selector.inicial}
            referencia={referencia}
            cargarCapas={selector.cargarCapas}
            onCerrar={() => setSelector(null)}
            onConfirmar={(lat, lon, p) => {
              setSelector(null);
              asignarCoordenadas(lat, lon, p);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
