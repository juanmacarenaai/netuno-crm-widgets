import { useState } from 'react';
import { FileText, FolderClock, ReceiptText, RefreshCw, Users } from 'lucide-react';
import { entorno } from '@/core/config';
import { ListaCuentas, ListaCuentasCargando, TarjetaCuenta, useCuentas, type Cuenta } from '@/shared/cuentas';
import { Boton, EncabezadoModulo, MensajeError } from '@/ui';
import { ContactosModal, DomiciliacionModal, HistoricoModal } from './componentes/ConsultasCuenta';
import { DatosCuenta } from './componentes/DatosCuenta';
import { EstadoCuentaModal } from './componentes/EstadoCuentaModal';

type Accion = 'estado' | 'contactos' | 'domiciliacion' | 'historico';

/**
 * Facturación (reemplaza a widgetFacturacionV1.2). Entrega 1: estado de cuenta con filtros y totales, documentos
 * (ver, descargar y enviar por correo), información de pago, contactos, domiciliación e histórico de documentos.
 * Las gestiones de documento (cargo variable, factura manual, reelaboración, notas) llegan en la entrega 2.
 */
export default function Facturacion() {
  const cuentas = useCuentas({ host: entorno.netuno.hostFacturacion });
  const [abierta, setAbierta] = useState<{ accion: Accion; cuenta: Cuenta } | null>(null);
  const abrir = (accion: Accion, cuenta: Cuenta) => setAbierta({ accion, cuenta });
  const cerrar = () => setAbierta(null);

  let contenido;
  if (!cuentas.documento) {
    contenido = <MensajeError mensaje="El registro no tiene documento de identidad." />;
  } else if (cuentas.isPending) {
    contenido = <ListaCuentasCargando cantidad={2} />;
  } else if (cuentas.isError) {
    contenido = (
      <MensajeError
        mensaje={`No se lograron cargar los datos. ${cuentas.error.message}`}
        onReintentar={() => void cuentas.refetch()}
      />
    );
  } else {
    contenido = (
      <ListaCuentas
        cuentas={cuentas.data}
        porPagina={4}
        columnas={2}
        tarjeta={(cuenta) => (
          <TarjetaCuenta
            cuenta={cuenta}
            cuerpo={<DatosCuenta cuenta={cuenta} onVerDomiciliacion={() => abrir('domiciliacion', cuenta)} />}
            pie={
              <>
                {/* Consultas secundarias livianas; "Estado de cuenta" es la acción principal */}
                <Boton
                  tamano="sm"
                  variante="fantasma"
                  icono={FolderClock}
                  onClick={() => abrir('historico', cuenta)}
                >
                  Histórico
                </Boton>
                <Boton
                  tamano="sm"
                  variante="fantasma"
                  icono={Users}
                  onClick={() => abrir('contactos', cuenta)}
                >
                  Contactos
                </Boton>
                <Boton tamano="sm" icono={FileText} onClick={() => abrir('estado', cuenta)}>
                  Estado de cuenta
                </Boton>
              </>
            }
          />
        )}
      />
    );
  }

  return (
    <main className="p-3 sm:p-4">
      <EncabezadoModulo
        titulo="Facturación"
        icono={ReceiptText}
        descripcion={
          cuentas.data
            ? `${cuentas.data.length} ${cuentas.data.length === 1 ? 'cuenta' : 'cuentas'}`
            : 'Estado de cuenta, documentos y pagos'
        }
        acciones={
          <Boton
            tamano="sm"
            variante="secundario"
            icono={RefreshCw}
            iconoGira
            cargando={cuentas.isFetching}
            disabled={!cuentas.documento}
            onClick={() => void cuentas.refetch()}
            aria-label="Refrescar"
            title="Refrescar"
          />
        }
      />
      {contenido}
      {abierta?.accion === 'estado' && <EstadoCuentaModal cuenta={abierta.cuenta} onCerrar={cerrar} />}
      {abierta?.accion === 'contactos' && <ContactosModal cuenta={abierta.cuenta} onCerrar={cerrar} />}
      {abierta?.accion === 'domiciliacion' && (
        <DomiciliacionModal cuenta={abierta.cuenta} onCerrar={cerrar} />
      )}
      {abierta?.accion === 'historico' && <HistoricoModal cuenta={abierta.cuenta} onCerrar={cerrar} />}
    </main>
  );
}
