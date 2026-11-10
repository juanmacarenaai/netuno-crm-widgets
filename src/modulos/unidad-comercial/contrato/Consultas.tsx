import { useQuery } from '@tanstack/react-query';
import { netunoApi } from '@/services/netuno.api';
import { textoEstadoOptico, valorOSinDatos, type Contrato, type Cuenta } from '@/shared/cuentas';
import { HtmlSeguro, ListaCampos } from '@/ui';
import senalNegativa from '../assets/SenalNegativa.jpg';
import senalPositiva from '../assets/SenalPositiva.jpg';
import {
  consumoInternet,
  consumoTelefonia,
  mensajeSinConsumo,
  periodoActual,
  type Bolsa,
  type ConsumoInternetApi,
  type ConsumoTelefoniaApi,
} from '../lib/consumo';
import { ESTADO_POTENCIA, evaluarPotencia } from '../lib/potencia';
import { useConsultaAutofind, useConsultaOlt, useValoresOpticos } from './useConsultas';
import { Resultado } from './Resultado';
import type { DatosNas } from './tipos';

export interface PropsConsulta {
  cuenta: Cuenta;
  servicio: Contrato;
  documento: string | null;
  nas: DatosNas | null;
}

const PENDIENTE = 'Se migra en una próxima entrega';

/** Valores de Potencia (#popupVerValoresOpticos). */
export function ValoresOpticos({ servicio, nas }: PropsConsulta) {
  const consulta = useValoresOpticos(servicio.idProducto);

  return (
    <Resultado consulta={consulta}>
      {(datos) => {
        const evaluacion = evaluarPotencia(servicio.codTecnologia, datos?.potencia);
        return (
          <div className="flex flex-col items-center gap-4">
            <ListaCampos
              campos={[
                ['Estatus', textoEstadoOptico(datos, 'estatus')],
                ['Conexión', textoEstadoOptico(datos, 'conexion')],
                ['IP', valorOSinDatos(nas?.ip)],
                ['Potencia', textoEstadoOptico(datos, 'potencia')],
              ]}
            />
            {evaluacion !== ESTADO_POTENCIA.SIN_REFERENCIA && (
              <img
                src={evaluacion === ESTADO_POTENCIA.OPTIMA ? senalPositiva : senalNegativa}
                alt={evaluacion === ESTADO_POTENCIA.OPTIMA ? 'Señal dentro de rango' : 'Señal fuera de rango'}
                className="h-48 w-60 object-contain"
              />
            )}
            {evaluacion === ESTADO_POTENCIA.FUERA_DE_RANGO && (
              <button
                type="button"
                disabled
                title={PENDIENTE}
                className="cursor-not-allowed rounded bg-gray-300 px-4 py-1.5 text-xs font-semibold text-white"
              >
                Troubleshooting
              </button>
            )}
          </div>
        );
      }}
    </Resultado>
  );
}

/** Consulta OLT - GPON (#popupVerConsultaOLT). */
export function ConsultaOlt({ servicio, nas }: PropsConsulta) {
  const consulta = useConsultaOlt(servicio.idProducto, nas);
  return (
    <Resultado consulta={consulta}>
      {(olt) => (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="shrink-0 lg:w-72">
            <ListaCampos
              campos={[
                ['Id', valorOSinDatos(olt?.id)],
                ['Estado', valorOSinDatos(olt?.state)],
                ['Tiempo online', valorOSinDatos(olt?.upTime)],
                ['Tiempo offline', valorOSinDatos(olt?.downTime)],
                ['Causa offline', valorOSinDatos(olt?.downCause)],
                ['Tipo', valorOSinDatos(olt?.type)],
                ['Distancia', valorOSinDatos(olt?.distance)],
                ['Serial', valorOSinDatos(olt?.sn)],
                ['Potencia', valorOSinDatos(olt?.['rx/txPower'])],
              ]}
            />
          </div>
          <HtmlSeguro html={olt?.consumoSumario} className="min-h-40 flex-1" />
        </div>
      )}
    </Resultado>
  );
}

/** Consulta Autofind (#popupVerAutofind). */
export function ConsultaAutofind({ servicio, nas }: PropsConsulta) {
  const consulta = useConsultaAutofind(servicio.idProducto, nas);
  return (
    <Resultado consulta={consulta}>
      {(datos) => {
        const equipo =
          datos?.equipoEncontrado && typeof datos.equipoEncontrado === 'object' ? datos.equipoEncontrado : {};
        const e = (clave: string) => valorOSinDatos(equipo[clave]);
        return (
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="shrink-0 lg:w-72">
              <ListaCampos
                campos={[
                  ['Serial buscado', valorOSinDatos(datos?.serialBuscado)],
                  ['Número', e('Number')],
                  ['F/S/P', e('F/S/P')],
                  ['Ont SN', e('Ont SN')],
                  ['Password', e('Password')],
                  ['Loid', e('Loid')],
                  ['Checkcode', e('Checkcode')],
                  ['VendorID', e('VendorID')],
                  ['Ont Version', e('Ont Version')],
                  ['Ont SoftwareVersion', e('Ont SoftwareVersion')],
                ]}
              />
            </div>
            <div className="flex flex-1 flex-col gap-3">
              <ListaCampos
                campos={[
                  ['Ont EquipmentID', e('Ont EquipmentID')],
                  ['Ont Customized Info', e('Ont Customized Info')],
                  ['Ont autofind time', e('Ont autofind time')],
                ]}
              />
              <HtmlSeguro html={datos?.listadoAutofind} className="min-h-40" />
            </div>
          </div>
        );
      }}
    </Resultado>
  );
}

function TablaBolsa({ titulo, bolsa }: { titulo: string; bolsa: Bolsa }) {
  const columnas = ['total', 'usado', 'restante'] as const;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <strong>{titulo}:</strong>
      <table className="border-collapse border border-netuno-oscuro text-center text-xs">
        <thead>
          <tr>
            {['Total', 'Usado', 'Restante'].map((c) => (
              <th key={c} className="border border-dotted border-texto px-2 py-0.5">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {columnas.map((c) => (
              <td key={c} className="border border-dotted border-texto px-2 py-0.5">
                {String(bolsa[c])}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Internet responde una lista; Telefonía, un objeto por documento; ambos { message } si no hay datos. */
type RespuestaConsumo = ConsumoInternetApi[] | ConsumoTelefoniaApi | { message: string };

/** Consulta Consumo (#popupVerConsumo). Internet por contrato y mes en curso; Telefonía por documento. */
export function ConsultaConsumo({ cuenta, servicio, documento }: PropsConsulta) {
  const esInternet = servicio.nombreServicio === 'Internet';
  const periodo = periodoActual();

  const consulta = useQuery({
    queryKey: ['netuno', 'consumo', esInternet ? servicio.idProducto : documento, periodo.fecha],
    queryFn: (): Promise<RespuestaConsumo> =>
      esInternet
        ? netunoApi.consumoInternet<RespuestaConsumo>(servicio.idProducto, periodo.fecha)
        : netunoApi.consumoTelefonia<RespuestaConsumo>(documento ?? ''),
    staleTime: 0,
  });

  return (
    <Resultado consulta={consulta}>
      {(respuesta) => {
        const mensaje = mensajeSinConsumo(respuesta);
        if (mensaje) return <p className="p-4 text-center text-texto-suave">{mensaje}</p>;
        if (esInternet) {
          return (
            <ListaCampos
              campos={consumoInternet(respuesta as ConsumoInternetApi[], servicio.idProducto, periodo)}
            />
          );
        }
        const telefonia = consumoTelefonia(
          respuesta as ConsumoTelefoniaApi,
          cuenta.cuenta,
          servicio.idProducto,
        );
        return (
          <div className="flex flex-col gap-3">
            <ListaCampos campos={telefonia.campos} />
            <TablaBolsa titulo="Servicio internacional" bolsa={telefonia.internacional} />
            <TablaBolsa titulo="Servicio nacional" bolsa={telefonia.nacional} />
          </div>
        );
      }}
    </Resultado>
  );
}
