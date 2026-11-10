import {
  etiquetaContrato,
  fechaVencimiento,
  SIN_FECHA,
  telefonoIpAsignado,
  valorOSinDatos,
  type Cuenta,
} from '@/shared/cuentas';
import { ListaCampos } from '@/ui';
import type { ContratoBoss } from './tipos';

/** Contenido de #popupVerdetalleContrato. Usa el contrato BOSS ya cargado (no hace otra consulta). */
export function DetalleContrato({ cuenta, contrato }: { cuenta: Cuenta; contrato: ContratoBoss }) {
  const fecha = (valor: unknown) => valorOSinDatos(valor, SIN_FECHA);
  const u = contrato.ubicacion?.[0] ?? {};

  const izquierda: Array<[string, unknown]> = [
    ['Fecha de contratación', fecha(contrato.fechaFirma)],
    ['Fecha de instalación', fecha(contrato.fechaInstalacion)],
    ['Fecha de ultima conexión', fecha(contrato.fechaConexion)],
    ['Fecha de ultima desconexión', fecha(contrato.fechaDesconexion)],
    ['Fecha de baja voluntaria', fecha(contrato.fechaBaja)],
    ['Fecha hard', fecha(contrato.fechaHard)],
    ['Fecha de vencimiento contrato', fechaVencimiento(cuenta, contrato)],
    ['Número telefonia IP asignado', telefonoIpAsignado(contrato)],
    ['Vendedor', valorOSinDatos(contrato.vendedor)],
    ['Unidad', valorOSinDatos(contrato.unidadVendedor)],
    ['Ciudad vendedor', valorOSinDatos(contrato.ciudadVendedor)],
  ];

  const derecha: Array<[string, unknown]> = [
    ['Etiqueta', etiquetaContrato(contrato.etiqueta)],
    ['Estado', valorOSinDatos(u.estado)],
    ['Ciudad', valorOSinDatos(u.ciudad)],
    ['Municipio', valorOSinDatos(u.municipio)],
    ['Parroquia', valorOSinDatos(u.parroquia)],
    ['Urbanización', valorOSinDatos(u.urbanizacion)],
    ['Avenida', valorOSinDatos(u.avCalle)],
    ['Calle', valorOSinDatos(u.calle)],
    ['Edificio', valorOSinDatos(u.edificioCasa)],
  ];

  return (
    <div className="grid grid-cols-1 gap-x-10 gap-y-1.5 sm:grid-cols-2">
      <ListaCampos campos={izquierda} />
      <ListaCampos campos={derecha} alinearDerecha />
    </div>
  );
}
