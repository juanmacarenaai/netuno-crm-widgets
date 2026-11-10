import { createElement, useState } from 'react';
import { BarChart3, Cpu, Gauge, ScanSearch, Server } from 'lucide-react';
import {
  CONSULTAS,
  consultasDisponibles,
  direccionCorta,
  numeroContrato,
  SIN_DATOS,
  tieneDetalleContrato,
  valorOSinDatos,
  type Consulta,
  type Contrato,
  type Cuenta,
} from '@/shared/cuentas';
import { BotonEnlace, Campo, Modal } from '@/ui';
import type { DatosContrato } from './tipos';

const BOTON_CONSULTA =
  'inline-flex items-center gap-1.5 rounded-lg bg-netuno-link px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-500 active:scale-[0.98]';
const ICONO_CONSULTA: Record<Consulta, typeof Gauge> = {
  potencia: Gauge,
  olt: Server,
  serial: Cpu,
  autofind: ScanSearch,
  consumo: BarChart3,
};

export type VistaDeContrato = 'contrato' | 'detalle' | Consulta;

/** Contenido de #popupVerContrato del widget jQuery. */
export function VistaContrato({
  cuenta,
  servicio,
  datos,
  onNavegar,
}: {
  cuenta: Cuenta;
  servicio: Contrato;
  datos: DatosContrato;
  onNavegar: (vista: VistaDeContrato) => void;
}) {
  const [direccionAbierta, setDireccionAbierta] = useState<string | null>(null);
  const { contrato, nas, errorNas } = datos;
  const n = nas ?? {};
  const v = (valor: unknown) => String(valorOSinDatos(valor));
  const esStreaming = contrato.nombreServicio === 'Streaming';
  const consultas = consultasDisponibles(servicio.nombreServicio);

  const localidad = (direccion: string | null | undefined) => (
    <BotonEnlace title="Ver dirección completa" onClick={() => setDireccionAbierta(direccion ?? SIN_DATOS)}>
      {direccionCorta(direccion)}
    </BotonEnlace>
  );

  return (
    <div className="flex flex-col gap-4">
      {errorNas && (
        <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No se pudieron consultar los datos de NAS: {errorNas.message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-x-10 gap-y-1.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Campo etiqueta="Número de contrato">
            {tieneDetalleContrato(servicio.nombreServicio) ? (
              <BotonEnlace title="Ver detalles de contrato" onClick={() => onNavegar('detalle')}>
                {numeroContrato(contrato.idProducto)}
              </BotonEnlace>
            ) : (
              numeroContrato(contrato.idProducto)
            )}
          </Campo>
          <Campo etiqueta="Estado">{v(contrato.status)}</Campo>
          <Campo etiqueta="Nombre del plan">{v(contrato.nombrePaquete)}</Campo>
          <Campo etiqueta="Tipo de red">{v(contrato.tipoRed)}</Campo>
          <Campo etiqueta="Tecnología">{v(contrato.tecnologia)}</Campo>
          <Campo etiqueta="Redes compartidas">{v(cuenta.redes_compartidas)}</Campo>
          <Campo etiqueta="Lista de precio">{v(contrato.listaPrecio)}</Campo>
          <Campo etiqueta="WIFI">{v(contrato.wifiActivo)}</Campo>
          <Campo etiqueta="Alquiler equipo">{v(contrato.alquilerEquipo)}</Campo>
          {/* Mismo cruce de etiquetas que el widget jQuery: "Nodo BOSS" muestra el nodo de NAS y viceversa */}
          <Campo etiqueta="Nodo BOSS">{v(n.nodo)}</Campo>
          <Campo etiqueta="Nodo NAS">{v(contrato.nodo)}</Campo>
          <Campo etiqueta="Geolocalización">{v(contrato.coordenadasGps)}</Campo>
        </div>

        <div className="flex flex-col gap-1.5">
          <Campo etiqueta="Router" alinearDerecha>
            {v(contrato.routerActivo)}
          </Campo>
          <Campo etiqueta="Modelo" alinearDerecha>
            {v(contrato.modelo)}
          </Campo>
          <Campo etiqueta={esStreaming ? 'Correo' : 'Serial de equipo'} alinearDerecha>
            {contrato.serial ?? ''}
          </Campo>
          <Campo etiqueta="Número de tarjeta" alinearDerecha>
            {v(n.tarjeta)}
          </Campo>
          <Campo etiqueta="Puerto" alinearDerecha>
            {v(n.puerto)}
          </Campo>
          <Campo etiqueta="IP" alinearDerecha>
            {v(n.ip)}
          </Campo>
          <Campo etiqueta="Id ONT" alinearDerecha>
            {v(n.idont)}
          </Campo>
          <Campo etiqueta="VLAN - GPON" alinearDerecha>
            {v(n.vlanGpon)}
          </Campo>
          <Campo etiqueta="GENPORT - GPON" alinearDerecha>
            {v(n.genportGpon)}
          </Campo>
          <Campo etiqueta="Localidad origen" alinearDerecha>
            {localidad(contrato.direccionA)}
          </Campo>
          <Campo etiqueta="Localidad destino" alinearDerecha>
            {localidad(contrato.direccionB)}
          </Campo>
        </div>
      </div>

      {consultas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {consultas.map((consulta) => (
            <button
              key={consulta}
              type="button"
              className={BOTON_CONSULTA}
              onClick={() => onNavegar(consulta)}
            >
              {createElement(ICONO_CONSULTA[consulta], { 'aria-hidden': true, className: 'h-3.5 w-3.5' })}
              {CONSULTAS[consulta]}
            </button>
          ))}
        </div>
      )}

      <Modal
        abierto={direccionAbierta !== null}
        titulo="Dirección completa"
        onCerrar={() => setDireccionAbierta(null)}
        ancho="max-w-md"
      >
        <p className="text-sm">{direccionAbierta}</p>
      </Modal>
    </div>
  );
}
