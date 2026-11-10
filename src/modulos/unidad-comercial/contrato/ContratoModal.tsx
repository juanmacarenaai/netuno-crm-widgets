import { useState, type ReactNode } from 'react';
import { CONSULTAS, estaConectado, rutaServicio, type Contrato, type Cuenta } from '@/shared/cuentas';
import { Cargando, MensajeError, Modal, PuntoEstado } from '@/ui';
import { useDatosContrato } from './useConsultas';
import { ConsultaAutofind, ConsultaConsumo, ConsultaOlt, ValoresOpticos } from './Consultas';
import { ConsultaSerial } from './ConsultaSerial';
import { DetalleContrato } from './DetalleContrato';
import { VistaContrato, type VistaDeContrato } from './VistaContrato';

const TITULOS: Record<Exclude<VistaDeContrato, 'contrato'>, string> = {
  detalle: 'Detalle contrato',
  potencia: CONSULTAS.potencia,
  olt: 'Consulta OLT - GPON',
  serial: 'Consulta Serial',
  autofind: 'Consulta Autofind',
  consumo: CONSULTAS.consumo,
};

/** "Ver contrato" y todo lo que se abre desde él. "Regresar" vuelve al contrato; "Cerrar" cierra todo. */
export function ContratoModal({
  cuenta,
  servicio,
  documento,
  onCerrar,
}: {
  cuenta: Cuenta;
  servicio: Contrato;
  documento: string | null;
  onCerrar: () => void;
}) {
  const [vista, setVista] = useState<VistaDeContrato>('contrato');
  const consulta = useDatosContrato(servicio.idProducto);

  const sufijo = vista === 'contrato' ? null : TITULOS[vista];
  const titulo = (
    <>
      <PuntoEstado activo={estaConectado(cuenta.descStatusCuenta)} />
      {cuenta.cuenta}
      <span className="text-gray-300">/</span>
      <PuntoEstado activo={estaConectado(servicio.status)} />
      {servicio.nombreServicio}
      {sufijo && (
        <>
          <span className="text-gray-300">/</span>
          <span className="truncate">{sufijo}</span>
        </>
      )}
    </>
  );

  let contenido: ReactNode;
  if (consulta.isPending) {
    contenido = <Cargando mensaje="Consultando el contrato..." />;
  } else if (consulta.isError) {
    contenido = (
      <MensajeError
        mensaje={`No se pudo consultar el contrato. ${consulta.error.message}`}
        onReintentar={() => void consulta.refetch()}
      />
    );
  } else {
    const props = { cuenta, servicio, documento, nas: consulta.data.nas };
    switch (vista) {
      case 'contrato':
        contenido = (
          <VistaContrato cuenta={cuenta} servicio={servicio} datos={consulta.data} onNavegar={setVista} />
        );
        break;
      case 'detalle':
        contenido = <DetalleContrato cuenta={cuenta} contrato={consulta.data.contrato} />;
        break;
      case 'potencia':
        contenido = <ValoresOpticos {...props} />;
        break;
      case 'olt':
        contenido = <ConsultaOlt {...props} />;
        break;
      case 'serial':
        contenido = <ConsultaSerial servicio={servicio} />;
        break;
      case 'autofind':
        contenido = <ConsultaAutofind {...props} />;
        break;
      case 'consumo':
        contenido = <ConsultaConsumo {...props} />;
        break;
    }
  }

  return (
    <Modal
      abierto
      titulo={titulo}
      etiqueta={rutaServicio(cuenta, servicio, sufijo)}
      onCerrar={onCerrar}
      onRegresar={vista === 'contrato' ? undefined : () => setVista('contrato')}
      ancho={vista === 'olt' || vista === 'autofind' ? 'max-w-6xl' : 'max-w-4xl'}
    >
      {contenido}
    </Modal>
  );
}
