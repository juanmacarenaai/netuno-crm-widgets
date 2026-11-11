import { FileText } from 'lucide-react';
import { Alerta, CampoFormulario, CLASE_CONTROL, cn } from '@/ui';
import {
  AYUDA_CONTRATOS,
  CANALES_ORIGEN,
  MOTIVOS_TITULARIDAD,
  type ContratoTransferible,
  type Elegibilidad,
  type UnidadComercial,
} from '../lib/cambioTitularidad';
import { AlertaCargando, Bloque, type Acordeon } from './Piezas';

export type EstadoSaldo = { estado: 'sin-verificar' } | { estado: 'verificando' } | Elegibilidad;

function ContratoOpcion({
  contrato,
  marcado,
  onAlternar,
}: {
  contrato: ContratoTransferible;
  marcado: boolean;
  onAlternar: () => void;
}) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
        !contrato.disponible && 'cursor-not-allowed opacity-60',
        contrato.disponible && 'cursor-pointer',
        marcado ? 'border-netuno-500 bg-sky-50' : 'border-gray-200 hover:bg-gray-50',
      )}
    >
      <input
        type="checkbox"
        checked={marcado}
        disabled={!contrato.disponible}
        onChange={onAlternar}
        className="mt-0.5 h-4 w-4 accent-accion"
      />
      <span className="min-w-0 flex-1 text-xs">
        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
          <span className="font-bold text-gray-900">
            {contrato.codigo} · {contrato.plan}
          </span>
          {contrato.serial && (
            <span className="font-mono text-[10.5px] text-gray-500">ONT {contrato.serial}</span>
          )}
        </span>
        <span className="block text-gray-500">
          {contrato.servicio} · {contrato.direccion}
          {!contrato.disponible && (
            <span className="ml-1.5 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">
              {contrato.status} · no transferible
            </span>
          )}
        </span>
      </span>
    </label>
  );
}

function MensajeSaldo({ saldo }: { saldo: EstadoSaldo }) {
  switch (saldo.estado) {
    case 'sin-verificar':
      // Sin contratos marcados no se muestra nada: el siguiente bloque aparece al elegir uno
      return null;
    case 'verificando':
      return (
        <AlertaCargando>Consultando saldo del titular actual en BOSS y solicitudes en curso…</AlertaCargando>
      );
    case 'apto':
      return (
        <Alerta tono="exito">
          <strong>Saldo cero verificado · Apto para cambio de titularidad</strong>
          <br />
          Sin deuda pendiente ni otro cambio de titularidad en curso. La deuda nunca se transfiere al nuevo
          titular.
        </Alerta>
      );
    case 'saldo':
      return (
        <Alerta tono="error">
          <strong>Bloqueado · El titular actual tiene saldo pendiente</strong>
          <br />
          Saldo en BOSS: <b>{saldo.monto}</b>. Debe regularizarse antes de iniciar el cambio de titularidad
          (no se aplican condonaciones ni notas de crédito en este flujo).
        </Alerta>
      );
    case 'inactivo':
      return (
        <Alerta tono="error">
          <strong>Bloqueado · El titular actual no tiene servicios activos</strong>
          <br />
          Estatus de la cuenta: <b>{saldo.estatus}</b>. Solo se pueden transferir contratos activos
          (Conectado) con saldo cero.
        </Alerta>
      );
  }
}

export function RegistroSolicitud({
  unidad,
  contratos,
  seleccion,
  onAlternar,
  motivo,
  onMotivo,
  canal,
  onCanal,
  observaciones,
  onObservaciones,
  saldo,
  acordeon,
}: {
  unidad: UnidadComercial;
  contratos: ContratoTransferible[];
  seleccion: readonly string[];
  onAlternar: (idProducto: string) => void;
  motivo: string;
  onMotivo: (valor: string) => void;
  canal: string;
  onCanal: (valor: string) => void;
  observaciones: string;
  onObservaciones: (valor: string) => void;
  saldo: EstadoSaldo;
  acordeon?: Acordeon;
}) {
  return (
    <Bloque
      titulo="Registro de Solicitud"
      icono={FileText}
      insignia={unidad.toUpperCase()}
      acordeon={acordeon}
    >
      <CampoFormulario etiqueta="Contratos a transferir" requerido ayuda={AYUDA_CONTRATOS[unidad]}>
        {contratos.length === 0 ? (
          <Alerta tono="aviso">La cuenta no tiene contratos que se puedan transferir.</Alerta>
        ) : (
          <div className="flex flex-col gap-2">
            {contratos.map((c) => (
              <ContratoOpcion
                key={c.idProducto}
                contrato={c}
                marcado={seleccion.includes(c.idProducto)}
                onAlternar={() => onAlternar(c.idProducto)}
              />
            ))}
          </div>
        )}
      </CampoFormulario>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoFormulario etiqueta="Motivo del cambio" htmlFor="tit_motivo" requerido>
          <select
            id="tit_motivo"
            className={CLASE_CONTROL}
            value={motivo}
            onChange={(e) => onMotivo(e.target.value)}
          >
            {MOTIVOS_TITULARIDAD.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </CampoFormulario>
        <CampoFormulario etiqueta="Canal de origen" htmlFor="tit_canal" requerido>
          <select
            id="tit_canal"
            className={CLASE_CONTROL}
            value={canal}
            onChange={(e) => onCanal(e.target.value)}
          >
            {CANALES_ORIGEN.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </CampoFormulario>
      </div>

      <CampoFormulario etiqueta="Observaciones" htmlFor="tit_observaciones">
        <textarea
          id="tit_observaciones"
          rows={2}
          className={cn(CLASE_CONTROL, 'resize-none')}
          placeholder="Notas del agente…"
          value={observaciones}
          onChange={(e) => onObservaciones(e.target.value)}
        />
      </CampoFormulario>

      <MensajeSaldo saldo={saldo} />
    </Bloque>
  );
}
