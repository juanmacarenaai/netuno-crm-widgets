import { lazy, Suspense, useState } from 'react';
import {
  Clock,
  FileText,
  MapPin,
  Network,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Ticket,
  Wrench,
} from 'lucide-react';
import {
  ListaCuentas,
  ListaCuentasCargando,
  puedeAdministrarCuenta,
  TarjetaCuenta,
  tieneTroubleshooting,
  useCuentas,
  type Contrato,
  type Cuenta,
} from '@/shared/cuentas';
import { useZoho } from '@/shared/zoho/contexto';
import { Boton, Cargando, EncabezadoModulo, MensajeError, Modal, useAvisos } from '@/ui';
import { AdministrarCuenta } from './administracion/AdministrarCuenta';
import { ContratoModal } from './contrato/ContratoModal';

// Leaflet solo se descarga cuando se abre un mapa
const MapaCuentaModal = lazy(() => import('./mapa/MapaCuentaModal'));
const CrearTicketModal = lazy(() => import('./crear-ticket/CrearTicketModal'));
const TroubleshootingModal = lazy(() => import('./troubleshooting/TroubleshootingModal'));

const hora = (milisegundos: number) =>
  new Date(milisegundos).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

export default function UnidadComercial() {
  const { usuario, registro } = useZoho();
  const cuentas = useCuentas();
  const { avisar } = useAvisos();

  const [contrato, setContrato] = useState<{ cuenta: Cuenta; servicio: Contrato } | null>(null);
  const [mapa, setMapa] = useState<{ cuenta: Cuenta; idProducto?: string } | null>(null);
  const [administrando, setAdministrando] = useState<Cuenta | null>(null);
  const [ticket, setTicket] = useState<{ cuenta: Cuenta; servicio: Contrato } | null>(null);
  const [troubleshooting, setTroubleshooting] = useState<{ cuenta: Cuenta; servicio: Contrato } | null>(null);
  const [sinAcceso, setSinAcceso] = useState(false);

  const refrescar = async () => {
    const resultado = await cuentas.refetch();
    if (resultado.isError) {
      avisar({
        tipo: 'error',
        titulo: 'No se pudieron actualizar los datos',
        texto: resultado.error.message,
      });
    } else {
      avisar({
        tipo: 'exito',
        titulo: 'Datos actualizados',
        texto: `${resultado.data?.length ?? 0} cuenta(s) consultadas en Netuno.`,
      });
    }
  };

  const administrar = (cuenta: Cuenta) => {
    if (puedeAdministrarCuenta(cuenta, usuario.departamentos)) setAdministrando(cuenta);
    else setSinAcceso(true);
  };

  if (administrando) {
    return (
      <AdministrarCuenta
        cuenta={administrando}
        onVolver={() => setAdministrando(null)}
        onCompletado={() => void cuentas.refetch()}
      />
    );
  }

  let contenido;
  if (!cuentas.documento) {
    contenido = (
      <MensajeError mensaje="El registro no tiene documento de identidad: no se pueden consultar sus cuentas en Netuno." />
    );
  } else if (cuentas.isPending) {
    contenido = <ListaCuentasCargando />;
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
        tarjeta={(cuenta) => (
          <TarjetaCuenta
            cuenta={cuenta}
            accionesServicio={(servicio) => (
              <>
                <Boton tamano="sm" icono={FileText} onClick={() => setContrato({ cuenta, servicio })}>
                  Ver Contrato
                </Boton>
                <Boton
                  tamano="sm"
                  variante="secundario"
                  icono={MapPin}
                  onClick={() => setMapa({ cuenta, idProducto: servicio.idProducto })}
                  title="Ver ubicación del servicio"
                >
                  Ver mapa
                </Boton>
                {tieneTroubleshooting(servicio.nombreServicio) && (
                  <Boton
                    tamano="sm"
                    variante="secundario"
                    icono={Wrench}
                    onClick={() => setTroubleshooting({ cuenta, servicio })}
                    title="Diagnóstico guiado de la falla"
                  >
                    Troubleshooting
                  </Boton>
                )}
                <Boton
                  tamano="sm"
                  variante="secundario"
                  icono={Ticket}
                  onClick={() => setTicket({ cuenta, servicio })}
                  title="Crear un ticket en Zoho Desk para este servicio"
                >
                  Crear Ticket
                </Boton>
              </>
            )}
            pie={
              <>
                <Boton
                  tamano="sm"
                  variante="secundario"
                  icono={MapPin}
                  onClick={() => setMapa({ cuenta })}
                  title="Ver ubicaciones de los servicios"
                >
                  Ver mapa
                </Boton>
                <Boton tamano="sm" icono={Settings2} onClick={() => administrar(cuenta)}>
                  Administrar cuenta
                </Boton>
              </>
            }
          />
        )}
      />
    );
  }

  const total = cuentas.data?.length;
  const cliente = String(registro.Account_Name ?? registro.Nombres ?? 'Cliente');

  return (
    <main className="mx-auto max-w-7xl p-3 sm:p-4">
      <EncabezadoModulo
        titulo="Servicios de Unidad Comercial"
        icono={Network}
        descripcion={[
          cliente,
          cuentas.documento,
          total !== undefined && `${total} ${total === 1 ? 'cuenta' : 'cuentas'}`,
        ]
          .filter(Boolean)
          .join(' · ')}
        acciones={
          <>
            {cuentas.dataUpdatedAt > 0 && (
              <span className="hidden items-center gap-1 text-xs text-texto-suave sm:inline-flex">
                <Clock aria-hidden="true" className="h-3.5 w-3.5" /> Actualizado {hora(cuentas.dataUpdatedAt)}
              </span>
            )}
            <Boton
              tamano="sm"
              icono={RefreshCw}
              iconoGira
              cargando={cuentas.isFetching}
              disabled={!cuentas.documento}
              onClick={() => void refrescar()}
              aria-label="Refrescar"
            >
              <span className="max-sm:sr-only">{cuentas.isFetching ? 'Actualizando...' : 'Refrescar'}</span>
            </Boton>
          </>
        }
      />

      {contenido}

      {contrato && (
        <ContratoModal
          key={contrato.servicio.idProducto}
          cuenta={contrato.cuenta}
          servicio={contrato.servicio}
          documento={cuentas.documento}
          onCerrar={() => setContrato(null)}
        />
      )}

      {mapa && (
        <Suspense
          fallback={
            <Modal abierto titulo="Mapa de ubicaciones" onCerrar={() => setMapa(null)}>
              <Cargando mensaje="Cargando el mapa..." />
            </Modal>
          }
        >
          <MapaCuentaModal
            cuenta={mapa.cuenta}
            idProductoFoco={mapa.idProducto}
            onCerrar={() => setMapa(null)}
          />
        </Suspense>
      )}

      {troubleshooting && (
        <Suspense
          fallback={
            <Modal abierto titulo="Troubleshooting" onCerrar={() => setTroubleshooting(null)}>
              <Cargando mensaje="Cargando..." />
            </Modal>
          }
        >
          <TroubleshootingModal
            key={troubleshooting.servicio.idProducto}
            cuenta={troubleshooting.cuenta}
            servicio={troubleshooting.servicio}
            onCerrar={() => setTroubleshooting(null)}
            onCrearTicket={() => {
              setTicket(troubleshooting);
              setTroubleshooting(null);
            }}
          />
        </Suspense>
      )}

      {ticket && (
        <Suspense
          fallback={
            <Modal abierto titulo="Crear Ticket" onCerrar={() => setTicket(null)}>
              <Cargando mensaje="Cargando..." />
            </Modal>
          }
        >
          <CrearTicketModal
            key={ticket.servicio.idProducto}
            cuenta={ticket.cuenta}
            servicio={ticket.servicio}
            onCerrar={() => setTicket(null)}
          />
        </Suspense>
      )}

      <Modal
        abierto={sinAcceso}
        titulo="Sin acceso"
        onCerrar={() => setSinAcceso(false)}
        ancho="max-w-md"
        pie={<Boton onClick={() => setSinAcceso(false)}>Continuar</Boton>}
      >
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <ShieldAlert aria-hidden="true" className="h-6 w-6" />
          </span>
          <p className="text-sm text-gray-700">
            <strong className="block text-gray-900">Tu perfil no tiene permisos para esta gestión.</strong>
            Contacta a tu supervisor directo.
          </p>
        </div>
      </Modal>
    </main>
  );
}
