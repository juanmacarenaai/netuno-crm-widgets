/**
 * Puntos del mapa de una cuenta: un punto por servicio, con coordenadas y dirección del contrato BOSS.
 * Origen: app/maps/maps.data.js (UnidadComercialJS), vía UnidadComercialReact.
 */
import type { Contrato, Cuenta, UbicacionContrato } from '@/shared/cuentas';
import { MOTIVOS, parsearCoordenadas, type Geo } from './coordenadas';

export const COLOR_POR_SERVICIO: Readonly<Record<string, string>> = {
  Internet: '#1e88e5',
  Streaming: '#8e24aa',
  Salud: '#e53935',
  Telefonía: '#43a047',
  'Televisión por Cable': '#f9a825',
  default: '#546e7a',
};

export const colorServicio = (nombre: string): string =>
  COLOR_POR_SERVICIO[nombre] ?? COLOR_POR_SERVICIO.default ?? '#546e7a';

/** Lo que el mapa usa del contrato BOSS (GET /contrato). */
export interface ContratoBossMapa {
  coordenadasGps?: unknown;
  ubicacion?: UbicacionContrato[];
  serial?: string | null;
  etiqueta?: string | null;
}

function texto(valor: unknown, alterno: string): string;
function texto(valor: unknown, alterno: null): string | null;
function texto(valor: unknown, alterno: string | null): string | null {
  if (valor === null || valor === undefined) return alterno;
  const t = String(valor).trim();
  return t === '' ? alterno : t;
}

export interface Direccion {
  estado: string | null;
  ciudad: string | null;
  municipio: string | null;
  parroquia: string | null;
  urbanizacion: string | null;
  avenida: string | null;
  calle: string | null;
  edificio: string | null;
}

export function direccionDesde(
  boss: ContratoBossMapa | null,
  contrato: Pick<Contrato, 'ubicacionJSON'> | null,
): Direccion {
  const u: UbicacionContrato = boss?.ubicacion?.[0] ?? contrato?.ubicacionJSON?.[0] ?? {};
  return {
    estado: texto(u.estado, null),
    ciudad: texto(u.ciudad, null),
    municipio: texto(u.municipio, null),
    parroquia: texto(u.parroquia, null),
    urbanizacion: texto(u.urbanizacion, null),
    avenida: texto(u.avCalle, null),
    calle: texto(u.calle, null),
    edificio: texto(u.edificioCasa, null),
  };
}

export function componerDireccion(direccion: Partial<Direccion>): string {
  return Object.values(direccion).filter(Boolean).join(', ') || 'Sin direccion registrada';
}

export interface PuntoMapa {
  id: string;
  cuenta: string;
  idProducto: string | null;
  codContrato: string | null;
  servicio: string;
  paquete: string | null;
  estado: string | null;
  serial: string | null;
  etiqueta: string | null;
  lat: number | null;
  lon: number | null;
  geo: Geo;
  direccion: Direccion;
  direccionTexto: string;
  error: string | null;
}

export function armarPunto(
  numeroCuenta: string,
  contrato: Partial<Contrato>,
  boss: ContratoBossMapa | null,
  error: string | null = null,
): PuntoMapa {
  const geo: Geo = error
    ? { ok: false, motivo: MOTIVOS.FORMATO, lat: null, lon: null, orden: null, origen: null, crudo: null }
    : parsearCoordenadas(boss ? boss.coordenadasGps : null);
  const direccion = direccionDesde(boss, contrato);
  const idProducto = texto(contrato.idProducto, null);
  const servicio = texto(contrato.nombreServicio, 'Sin servicio');

  return {
    id: `${numeroCuenta}|${idProducto}|${servicio}`,
    cuenta: numeroCuenta,
    idProducto,
    codContrato: texto(contrato.codContrato, null),
    servicio,
    paquete: texto(contrato.nombrePaquete, null),
    estado: texto(contrato.status, null),
    serial: texto(boss?.serial || contrato.serial, null),
    etiqueta: texto(boss?.etiqueta || contrato.etiqueta, null),
    lat: geo.lat,
    lon: geo.lon,
    geo,
    direccion,
    direccionTexto: componerDireccion(direccion),
    error,
  };
}

/** Ejecuta `tareas` (funciones que devuelven promesas) con un máximo de `limite` a la vez. */
export async function conLimite<T>(
  tareas: Array<() => Promise<T>>,
  limite: number,
): Promise<Array<T | { error: unknown }>> {
  const resultados = new Array<T | { error: unknown }>(tareas.length);
  let siguiente = 0;

  async function trabajador() {
    while (siguiente < tareas.length) {
      const i = siguiente++;
      const tarea = tareas[i];
      if (!tarea) continue;
      try {
        resultados[i] = await tarea();
      } catch (error) {
        resultados[i] = { error };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limite, tareas.length) }, trabajador));
  return resultados;
}

/**
 * A diferencia de maps.data.js, los servicios cuya consulta falla también se devuelven
 * (allí se descartaban y no aparecían ni en "sin geolocalizar").
 */
export async function obtenerPuntosCuenta(
  cuenta: Pick<Cuenta, 'cuenta' | 'descTipoCliente' | 'contratos'>,
  consultarContrato: (idProducto: string) => Promise<ContratoBossMapa | null>,
  {
    limite = 4,
    alProgresar,
  }: { limite?: number; alProgresar?: (progreso: { puntos: PuntoMapa[]; total: number }) => void } = {},
): Promise<{ cuenta: string; titulo: string; puntos: PuntoMapa[] }> {
  const numeroCuenta = String(cuenta.cuenta);
  const contratos: Array<Partial<Contrato>> = Array.isArray(cuenta.contratos) ? cuenta.contratos : [];
  const puntos: PuntoMapa[] = [];

  const tareas = contratos.map((contrato) => async () => {
    const idProducto = texto(contrato.idProducto, null);
    let punto: PuntoMapa;
    if (!idProducto) {
      punto = armarPunto(numeroCuenta, contrato, null, 'Contrato sin identificador');
    } else {
      try {
        punto = armarPunto(numeroCuenta, contrato, await consultarContrato(idProducto));
      } catch (error) {
        punto = armarPunto(
          numeroCuenta,
          contrato,
          null,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
    puntos.push(punto);
    alProgresar?.({ puntos: puntos.slice(), total: contratos.length });
    return punto;
  });

  await conLimite(tareas, limite);

  return {
    cuenta: numeroCuenta,
    titulo: cuenta.descTipoCliente ? `${cuenta.descTipoCliente} ${cuenta.cuenta}` : numeroCuenta,
    puntos,
  };
}
