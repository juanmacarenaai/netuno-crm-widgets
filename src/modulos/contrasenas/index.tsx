import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Globe, LockKeyhole, RefreshCw, RotateCcw } from 'lucide-react';
import {
  claveCuentas,
  ListaCuentas,
  ListaCuentasCargando,
  TarjetaCuenta,
  useCuentas,
  type Contrato,
  type Cuenta,
} from '@/shared/cuentas';
import { useZoho } from '@/shared/zoho/contexto';
import { Boton, EncabezadoModulo, MensajeError } from '@/ui';
import { AccionesServicio, type AccionContrasena } from './componentes/AccionesServicio';
import { CorreoModal, GestionModal } from './componentes/Modales';
import {
  conCorreoActualizado,
  cuentaYContratoDelEvento,
  eventoCambioCorreo,
  GESTIONES,
  REGISTRO_EVENTO,
  serviciosConContrasena,
  type TextosEvento,
  type TipoGestion,
  type ValoresGestion,
} from './lib/contrasenas';
import { cambiarCorreo, enviarGestion, registrarEvento } from './servicio';

/** Portal Web interno: la contraseña del portal se restablece con el correo del cliente en CRM. */
function PortalWeb({ correo, onRestablecer }: { correo: string; onRestablecer: () => void }) {
  return (
    <section
      aria-label="Portal Web interno"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-tarjeta"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-accion">
          <Globe aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0 leading-tight">
          <h2 className="text-sm font-bold text-gray-900">Portal Web interno</h2>
          <p className="truncate text-xs text-texto-suave" title={correo}>
            {correo || 'El cliente no tiene correo electrónico en CRM'}
          </p>
        </div>
      </div>
      <Boton
        icono={RotateCcw}
        onClick={onRestablecer}
        disabled={!correo}
        title={
          correo
            ? 'Restablecer la contraseña del portal web'
            : 'El cliente no tiene correo electrónico en CRM'
        }
      >
        Restablecer
      </Boton>
    </section>
  );
}

interface AccionAbierta {
  tipo: AccionContrasena;
  /** Servicio de la gestión (null en el portal web). */
  contrato: Contrato | null;
}

/**
 * Contraseñas (reemplaza a Netuno-Zoho-CRM-widgetContrasenas): portal web interno, NetUno Go (contraseña, control
 * parental y correo de acceso). El WiFi de Internet está hecho pero apagado (lib: GESTION_WIFI_ACTIVA).
 * Cada gestión termina con "Registrar canal de atención" (módulo Eventos de CRM).
 */
export default function Contrasenas() {
  const { registro, documento, usuario } = useZoho();
  const cuentas = useCuentas();
  const clienteConsultas = useQueryClient();
  const [accion, setAccion] = useState<AccionAbierta | null>(null);
  const correoCliente = String(registro.email ?? registro.Email ?? '').trim();

  const contexto = (contrato: Contrato | null) => ({
    documento: documento ?? '',
    usuario: usuario.nombre,
    correoCliente,
    contrato,
  });

  const registrarCon = (textos: TextosEvento, contrato: Contrato | null) => (canal: string) => {
    const destino = cuentaYContratoDelEvento(cuentas.data ?? [], contrato);
    if (!destino) {
      return Promise.reject(new Error('El cliente no tiene cuentas en Netuno para asociar la gestión.'));
    }
    return registrarEvento({
      ...textos,
      registro: REGISTRO_EVENTO,
      canal,
      cuenta: destino.cuenta,
      contrato: destino.contrato,
      registroCrm: registro,
      documento,
      usuario,
    });
  };

  const enviarCorreo = async (contrato: Contrato, correoNuevo: string) => {
    const resultado = await cambiarCorreo(contrato.idProducto, correoNuevo);
    const vigente = resultado.correoVigente;
    // Refleja el correo vigente en la tarjeta (actualizarCorreoEnVista del widget jQuery)
    if (vigente) {
      clienteConsultas.setQueryData<Cuenta[]>(claveCuentas(documento), (previas) =>
        previas ? conCorreoActualizado(previas, contrato.idProducto, vigente) : previas,
      );
    }
    return resultado;
  };

  let contenido;
  if (!documento) {
    contenido = <MensajeError mensaje="El registro no tiene documento de identidad." />;
  } else if (cuentas.isPending) {
    contenido = <ListaCuentasCargando cantidad={2} conPie={false} />;
  } else if (cuentas.isError) {
    contenido = (
      <MensajeError
        mensaje={`No se lograron cargar los datos. ${cuentas.error.message}`}
        onReintentar={() => void cuentas.refetch()}
      />
    );
  } else {
    contenido = (
      <>
        <PortalWeb
          correo={correoCliente}
          onRestablecer={() => setAccion({ tipo: 'portal', contrato: null })}
        />
        <ListaCuentas
          cuentas={cuentas.data}
          porPagina={4}
          columnas={2}
          tarjeta={(cuenta) => (
            <TarjetaCuenta
              cuenta={{ ...cuenta, contratos: serviciosConContrasena(cuenta) }}
              mensajeSinServicios="La cuenta no tiene servicios de NetUno Go."
              mostrarContrato
              accionesServicio={(servicio) => (
                <AccionesServicio
                  contrato={servicio}
                  onAccion={(tipo) => setAccion({ tipo, contrato: servicio })}
                />
              )}
            />
          )}
        />
      </>
    );
  }

  const cerrar = () => setAccion(null);
  let modal = null;
  if (accion?.tipo === 'correo' && accion.contrato) {
    const contrato = accion.contrato;
    modal = (
      <CorreoModal
        contrato={contrato}
        enviar={(nuevo) => enviarCorreo(contrato, nuevo)}
        registrar={(anterior, nuevo, canal) =>
          registrarCon(eventoCambioCorreo(anterior, nuevo, contrato.idProducto), contrato)(canal)
        }
        onCerrar={cerrar}
      />
    );
  } else if (accion && accion.tipo !== 'correo') {
    const tipo: TipoGestion = accion.tipo;
    modal = (
      <GestionModal
        tipo={tipo}
        contrato={accion.contrato}
        enviar={(valores: ValoresGestion) => enviarGestion(tipo, valores, contexto(accion.contrato))}
        registrar={registrarCon(GESTIONES[tipo].evento, accion.contrato)}
        onCerrar={cerrar}
      />
    );
  }

  return (
    <main className="p-3 sm:p-4">
      <EncabezadoModulo
        titulo="Gestión de Correo y Contraseña"
        icono={LockKeyhole}
        descripcion={
          cuentas.data
            ? `${cuentas.data.length} ${cuentas.data.length === 1 ? 'cuenta' : 'cuentas'}`
            : 'Portal web y NetUno Go'
        }
        acciones={
          <Boton
            tamano="sm"
            variante="secundario"
            icono={RefreshCw}
            iconoGira
            cargando={cuentas.isFetching}
            disabled={!documento}
            onClick={() => {
              void cuentas.refetch();
              void clienteConsultas.invalidateQueries({ queryKey: ['netuno', 'ont-wifi'] });
            }}
            aria-label="Refrescar"
            title="Refrescar"
          />
        }
      />
      {contenido}
      {modal}
    </main>
  );
}
