/**
 * Traslado de servicio: reglas del formulario, cobertura y solicitud.
 * Origen: funciones *Traslado de app/index.js (UnidadComercialJS), vía UnidadComercialReact (lib/traslado.js).
 */
import type { Contrato, Cuenta } from '@/shared/cuentas';
import { formatearGps, parsearCoordenadas } from '../../lib/coordenadas';
import type { PuntoRed } from './weezie';

export const TIPOS_VIVIENDA = ['Casa', 'Apartamento', 'Local Comercial', 'Oficina', 'Quinta'] as const;
export const CANALES_TRASLADO = ['Oficina', 'Telefónico', 'Chat', 'Correo Electrónico'] as const;
export const ZONAS = { VERDE: 'Verde', NARANJA: 'Naranja', ROJA: 'Roja' } as const;

export type Zona = (typeof ZONAS)[keyof typeof ZONAS];

/** Origen: politicaWifi() en app/index.js. */
export function politicaWifi(wifiActivo: unknown): string {
  if (wifiActivo === undefined || wifiActivo === null || String(wifiActivo).trim() === '') return 'Sin datos';
  const valor = String(wifiActivo).trim().toLowerCase();
  if (['si', 'sí', 's', 'true', '1', 'activo', 'con wifi'].includes(valor)) return 'Con WiFi';
  if (['no', 'n', 'false', '0', 'inactivo', 'sin wifi'].includes(valor)) return 'Sin WiFi';
  return String(wifiActivo);
}

export const esEmpresa = (cuenta: Pick<Cuenta, 'descTipoCliente'> | null | undefined) =>
  cuenta?.descTipoCliente?.toLowerCase() === 'empresa';

/** Hogar: todos los contratos de la cuenta. Empresa: solo los de Internet. */
export function contratosParaTraslado(cuenta: Partial<Cuenta> | null | undefined): Contrato[] {
  const empresa = esEmpresa(cuenta);
  return (cuenta?.contratos ?? []).filter((c) => !empresa || c.nombreServicio?.toLowerCase() === 'internet');
}

/** Hogar: política y dirección salen del contrato de Internet (o el primero si no hay). */
export function contratoReferencia(contratos: readonly Contrato[]): Contrato | null {
  return contratos.find((c) => c.nombreServicio?.toLowerCase() === 'internet') ?? contratos[0] ?? null;
}

export const etiquetaContrato = (c: Contrato) =>
  `CTR-${c.codContrato} · ${c.nombrePaqueteFact || c.nombrePaquete || c.nombreServicio}`;

/** Dirección legible desde la cuenta, sin esperar a la API. */
export function direccionActual(contrato: Partial<Contrato> | null | undefined): string {
  const ubicacion = contrato?.ubicacionJSON?.[0] ?? {};
  const base = String(ubicacion.direccion || contrato?.ubicacion || contrato?.direccionA || '')
    .trim()
    .replace(/[\s,]+$/, '');
  return [base, ubicacion.ciudad, ubicacion.estado].filter(Boolean).join(', ') || 'Sin datos';
}

export interface DatosBoss {
  politica: string;
  gpsTexto: string;
  gpsActual: { lat: number; lon: number } | null;
}

/** Política, GPS mostrado y GPS de referencia (para el mapa) desde el contrato BOSS. */
export function datosDesdeContratoBoss(
  detalle: { wifiActivo?: unknown; coordenadasGps?: unknown } | null | undefined,
): DatosBoss {
  const geo = parsearCoordenadas(detalle?.coordenadasGps);
  return {
    politica: politicaWifi(detalle?.wifiActivo),
    gpsTexto: formatearGps(detalle?.coordenadasGps),
    gpsActual: geo.ok && geo.lat !== null && geo.lon !== null ? { lat: geo.lat, lon: geo.lon } : null,
  };
}

export type CoordenadasLeidas =
  { ok: true; lat: number; lon: number } | { ok: false; vacio?: boolean; mensaje: string };

export function leerCoordenadas(latTexto: unknown, lonTexto: unknown): CoordenadasLeidas {
  const lat = String(latTexto ?? '').trim();
  const lon = String(lonTexto ?? '').trim();
  if (!lat || !lon) return { ok: false, vacio: !lat && !lon, mensaje: 'Ingrese la latitud y la longitud.' };

  const geo = parsearCoordenadas(`${lat},${lon}`);
  if (geo.ok && geo.lat !== null && geo.lon !== null) return { ok: true, lat: geo.lat, lon: geo.lon };
  if (geo.motivo === 'fuera_del_pais') {
    return { ok: false, mensaje: 'Las coordenadas están fuera de Venezuela. Verifique latitud y longitud.' };
  }
  return { ok: false, mensaje: 'Coordenadas no válidas. Ejemplo: 10.4806 y -66.9036.' };
}

/** Pegar "lat, lon" completo (p. ej. desde BRUNO) reparte el valor en ambos campos; null = pegado normal. */
export function coordenadasPegadas(texto: unknown): { lat: number; lon: number } | null {
  const geo = parsearCoordenadas(texto ?? '');
  return geo.ok && geo.lat !== null && geo.lon !== null ? { lat: geo.lat, lon: geo.lon } : null;
}

export const fijarCoordenada = (n: number) => Number(n).toFixed(6);

export function fechaMinima(hoy: Date = new Date()): string {
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
}

/**
 * "Confirmar Ubicación" se habilita con dirección nueva, fecha de activación y, si el canal no es Oficina,
 * con correo del cliente.
 */
export function puedeConfirmar({
  direccionNueva,
  fechaActivacion,
  canalAtencion,
  correoCliente,
}: {
  direccionNueva: unknown;
  fechaActivacion: unknown;
  canalAtencion: string;
  correoCliente: unknown;
}): { ok: boolean; motivo: string | null } {
  if (!String(direccionNueva ?? '').trim()) return { ok: false, motivo: 'Complete la dirección nueva.' };
  if (!fechaActivacion) return { ok: false, motivo: 'Indique la fecha de activación.' };
  if (canalAtencion !== 'Oficina' && !String(correoCliente ?? '').trim()) {
    return { ok: false, motivo: 'El cliente no tiene correo electrónico registrado.' };
  }
  return { ok: true, motivo: null };
}

export interface ResultadoCobertura {
  zona: Zona;
  nap?: string;
  detalle?: string;
}

/** DEMO: longitud terminada en 1 → Roja, en 2 → Naranja, otro dígito → Verde (NAP estable por coordenadas). */
export function simularCobertura(lat: number, lon: number, longitudEscrita: unknown): ResultadoCobertura {
  const ultimo = String(longitudEscrita ?? '')
    .replace(/\D/g, '')
    .slice(-1);
  const zona = ultimo === '1' ? ZONAS.ROJA : ultimo === '2' ? ZONAS.NARANJA : ZONAS.VERDE;
  const semilla = Math.abs(Math.round(lat * 1e5) * 31 + Math.round(lon * 1e5));
  const nap = `NAP-${String((semilla % 200) + 1).padStart(3, '0')}-${'ABCD'[semilla % 4]}`;
  return { zona, nap };
}

/** Resultado real con la NAP o edificio de Weezie elegido; con unidad cuentan los puertos de su caja. */
export function resultadoDesdePunto(
  punto: Pick<PuntoRed, 'tipo' | 'etiqueta' | 'puertosLibres'> & {
    unidad?: { caja: { etiqueta: string; libres: number } | null };
  },
  puertosAlto: number,
): ResultadoCobertura {
  const caja = punto.unidad?.caja;
  const libres = caja ? caja.libres : punto.puertosLibres;
  const zona = libres >= puertosAlto ? ZONAS.VERDE : ZONAS.NARANJA;
  const puertos = `${libres} ${libres === 1 ? 'puerto libre' : 'puertos libres'}`;
  let detalle: string;
  if (caja) detalle = `Edificio: ${punto.etiqueta} · Caja de piso ${caja.etiqueta} · ${puertos}`;
  else if (punto.tipo === 'edificio') detalle = `Edificio: ${punto.etiqueta} · ${puertos} en cajas de piso`;
  else
    detalle = `${zona === ZONAS.VERDE ? 'NAP asignada' : 'Cobertura limitada · NAP'}: ${punto.etiqueta} · ${puertos}`;
  return { zona, detalle };
}

export function textoResultado({ zona, nap, detalle }: ResultadoCobertura, direccionNueva: unknown): string {
  const porZona: Record<Zona, string> = {
    Verde: `NAP asignada: ${nap}`,
    Naranja: `Cobertura limitada · NAP sugerida: ${nap}`,
    Roja: 'Sin cobertura disponible en esta ubicación',
  };
  const partes = [`Zona ${zona}`, detalle || porZona[zona]];
  const direccion = String(direccionNueva ?? '').trim();
  if (direccion && zona !== ZONAS.ROJA) partes.push(direccion);
  return partes.join(' · ');
}

/** Línea automática en Observaciones: solo se reemplaza o quita la que empieza con el prefijo. */
export function observacionesConUnidad(
  observaciones: unknown,
  texto: string | null,
  prefijo: string,
): string {
  const lineas = String(observaciones ?? '')
    .split('\n')
    .filter((l) => !l.startsWith(`${prefijo}:`));
  if (texto) lineas.push(texto);
  return lineas.join('\n').replace(/^\n+|\n+$/g, '');
}

export interface TipoVivienda {
  valor: string;
  /** El valor lo puso el widget (al elegir un edificio), no el asesor. */
  automatico: boolean;
}

/**
 * Al elegir un edificio se sugiere "Apartamento". Si luego se elige otra cosa, vuelve a "Casa" solo si el valor
 * lo había puesto el widget.
 */
export function tipoViviendaTrasPunto(
  { valor, automatico }: TipoVivienda,
  punto: Pick<PuntoRed, 'tipo'> | null,
): TipoVivienda {
  if (punto?.tipo === 'edificio') {
    if (valor === 'Casa' || automatico) return { valor: 'Apartamento', automatico: true };
    return { valor, automatico };
  }
  if (automatico) return { valor: 'Casa', automatico: false };
  return { valor, automatico };
}

/**
 * En Oficina el cliente confirma en persona: "Aceptado" (la regla de flujo crea el ticket en Desk sin correo).
 * En otros canales: "Pendiente de confirmación" (la regla envía el correo).
 */
export function estadoSegunCanal(canalAtencion: string): { estado: string; mensaje: string } {
  const enOficina = canalAtencion === 'Oficina';
  return {
    estado: enOficina ? 'Aceptado' : 'Pendiente de confirmación',
    mensaje: enOficina
      ? 'Solicitud de traslado guardada y confirmada en oficina. Se creará el ticket en Zoho Desk.'
      : 'Solicitud de traslado guardada. Se envió el correo de confirmación al cliente.',
  };
}

export function idSolicitud(cuenta: unknown, fecha: Date = new Date()): string {
  return `TRS-${cuenta ?? '0'}-${fecha.toISOString().replace(/\D/g, '').slice(0, 14)}`;
}

export interface FormularioSolicitud {
  politica: string;
  direccionActual: string;
  direccionNueva: string;
  tipoVivienda: string;
  fechaActivacion: string;
  canalAtencion: string;
  observaciones: string;
}

/** Objeto que se guarda como JSON en el cliente (misma forma que armarSolicitudTraslado). */
export function armarSolicitud({
  cuenta,
  contrato,
  formulario,
  coordenadas,
  resultado,
  punto,
  cliente,
  agente,
  gpsActual,
  fecha = new Date(),
}: {
  cuenta: Pick<Cuenta, 'cuenta' | 'descTipoCliente'> | null;
  contrato: Contrato | null;
  formulario: FormularioSolicitud;
  coordenadas: { lat: number; lon: number };
  resultado: ResultadoCobertura;
  punto:
    (Partial<PuntoRed> & Pick<PuntoRed, 'tipo' | 'id' | 'etiqueta' | 'puertosLibres' | 'lat' | 'lon'>) | null;
  cliente: { id?: string | null; documento?: string | null; email?: unknown } | null;
  agente: { nombre?: string | null; id?: string | null; idDesk?: string | null } | null;
  gpsActual: { lat: number; lon: number } | null;
  fecha?: Date;
}) {
  const unidad = punto?.unidad;
  const numeroCuenta = cuenta?.cuenta ?? null;
  const t = (v: unknown) => String(v ?? '').trim();

  return {
    idSolicitud: idSolicitud(numeroCuenta, fecha),
    idCliente: cliente?.id ?? null,
    documento: cliente?.documento ?? null,
    fechaSolicitud: fecha.toISOString(),
    agente: agente?.nombre ?? null,
    idAgenteCRM: agente?.id ?? null,
    idAgenteDesk: agente?.idDesk ?? null,
    cuenta: numeroCuenta,
    tipoCliente: cuenta?.descTipoCliente ?? null,
    // Hogar: se trasladan todos los contratos. Empresa: el contrato elegido
    contratos: contrato
      ? [
          {
            idProducto: contrato.idProducto,
            codContrato: contrato.codContrato,
            servicio: contrato.nombreServicio,
            paquete: contrato.nombrePaqueteFact || contrato.nombrePaquete || null,
          },
        ]
      : 'Todos',
    politica: t(formulario.politica) || null,
    direccionActual: t(formulario.direccionActual) || null,
    gpsActual: gpsActual ?? null,
    direccionNueva: t(formulario.direccionNueva),
    tipoVivienda: t(formulario.tipoVivienda),
    fechaActivacion: t(formulario.fechaActivacion),
    canalAtencion: t(formulario.canalAtencion),
    correoCliente: t(cliente?.email) || null,
    gpsNuevo: { lat: coordenadas.lat, lon: coordenadas.lon },
    cobertura: {
      origen: punto ? 'Weezie' : 'Simulada',
      zona: resultado.zona,
      nap: resultado.nap ?? null,
      detalle: resultado.detalle ?? null,
    },
    // NAP o edificio de Weezie elegido en el mapa (null si se movió el pin a mano o se escribieron coordenadas)
    puntoRed: punto
      ? {
          tipo: punto.tipo,
          id: punto.id,
          nombre: unidad ? unidad.edificio : punto.etiqueta,
          zona: punto.zonaEtiqueta ?? null,
          puertosLibres: punto.puertosLibres,
          distanciaMetros: punto.distancia != null ? Math.round(punto.distancia) : null,
          lat: punto.lat,
          lon: punto.lon,
        }
      : null,
    unidadEdificio: unidad
      ? {
          piso: unidad.piso,
          unidad: unidad.unidad,
          cajaPiso: unidad.caja?.etiqueta ?? null,
          pisoCaja: unidad.caja?.piso ?? null,
          puertosLibresCaja: unidad.caja?.libres ?? null,
          puertosTotalesCaja: unidad.caja?.total ?? null,
        }
      : null,
    observaciones: t(formulario.observaciones) || null,
  };
}
