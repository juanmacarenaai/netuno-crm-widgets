import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, CirclePlus, RotateCcw } from 'lucide-react';
import type { Cuenta } from '@/shared/cuentas';
import { useZoho } from '@/shared/zoho/contexto';
import { Alerta, Boton, Cargando, Pasos, TarjetaSeleccionable, useAvisos } from '@/ui';
import { RegistrarCanalAtencion } from '@/shared/canal-atencion';
import { FormularioActivacion } from './FormularioActivacion';
import {
  elegibilidadActivacion,
  FORMULARIO_VACIO,
  hoyIso,
  MENSAJE_ERROR_CONEXION,
  requisitosActivacion,
  SERVICIOS_ACTIVABLES,
  validarActivacion,
  type CampoError,
  type ErroresActivacion,
  type FormularioActivacion as Formulario,
  type PaqueteActivable,
} from './lib/activarServicios';
import {
  activarPaquete,
  consultarPaquetes,
  registrarEventoActivacion,
  type ResultadoGestion,
} from './servicio';

type Paso = 'elegir' | 'confirmar' | 'resultado';
const PASOS = ['Servicio', 'Confirmar', 'Resultado'] as const;
const INDICE_PASO: Record<Paso, number> = { elegir: 0, confirmar: 1, resultado: 2 };

const clavePaquete = (p: PaqueteActivable) => `${p.servicio}-${p.codigo}`;

/**
 * Activar servicios (pestaña de Administrar cuenta): NetUnoGO o Premium, Telefonía y Salud sobre el
 * Internet FTTH de la cuenta. Se activa un paquete a la vez, como en el widget jQuery.
 */
export function ActivarServicios({ cuenta, onCompletado }: { cuenta: Cuenta; onCompletado?: () => void }) {
  const { usuario, registro, documento, recargarRegistro } = useZoho();
  const { avisar } = useAvisos();
  const elegibilidad = useMemo(() => elegibilidadActivacion(cuenta), [cuenta]);
  const internet = elegibilidad.ok ? elegibilidad.internet : null;

  const consulta = useQuery({
    queryKey: ['activar-servicios', 'paquetes', String(cuenta.cuenta), internet?.idProducto],
    queryFn: () => consultarPaquetes(cuenta, internet ?? { idProducto: '' }),
    enabled: internet !== null,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  const [paso, setPaso] = useState<Paso>('elegir');
  const [elegido, setElegido] = useState<PaqueteActivable | null>(null);
  const [formulario, setFormulario] = useState<Formulario>(FORMULARIO_VACIO);
  const [errores, setErrores] = useState<ErroresActivacion>({});
  const [activando, setActivando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoGestion | null>(null);

  const hoy = hoyIso();
  const requisitos = elegido ? requisitosActivacion(elegido, registro) : null;

  const cambiar = (nuevo: Formulario, campo: CampoError) => {
    setFormulario(nuevo);
    setErrores((x) => ({ ...x, [campo]: undefined }));
  };

  const reiniciar = () => {
    setPaso('elegir');
    setElegido(null);
    setFormulario(FORMULARIO_VACIO);
    setErrores({});
    setResultado(null);
    void consulta.refetch();
  };

  const confirmar = async () => {
    if (!elegido || !internet || !requisitos) return;
    const encontrados = validarActivacion(requisitos, formulario, hoy);
    setErrores(encontrados);
    if (Object.values(encontrados).some(Boolean)) return;

    setActivando(true);
    const r = await activarPaquete({
      paquete: elegido,
      internet,
      cuenta,
      registro,
      formulario,
      aliasUsuario: usuario.alias,
    });
    // Sexo y fecha de nacimiento del titular quedaron en CRM: se recarga el registro antes de mostrar el
    // resultado para que la próxima activación de Salud no los vuelva a pedir
    if (requisitos.titular.sexo || requisitos.titular.fechaNacimiento) {
      await recargarRegistro().catch((error: unknown) =>
        console.error('Error al recargar el registro:', error),
      );
    }
    setActivando(false);
    setResultado(r);
    setPaso('resultado');

    if (r.tipo === 'respuesta' && r.ok) {
      avisar({ tipo: 'exito', titulo: 'Servicio activado', texto: elegido.nombre });
    } else {
      avisar({
        tipo: 'error',
        titulo: 'No se completó la activación',
        texto: r.tipo === 'error' ? r.mensaje : r.texto,
      });
    }
  };

  const registrarEvento = (canal: string) => {
    if (!internet || resultado?.tipo !== 'respuesta') return Promise.resolve();
    return registrarEventoActivacion({
      canal,
      cuenta,
      internet,
      historial: resultado.historial,
      registroCrm: registro,
      documento,
      usuario,
    });
  };

  if (!elegibilidad.ok) {
    return (
      <Alerta tono="aviso">
        <strong>No es posible activar servicios.</strong>
        <br />
        {elegibilidad.mensaje}
      </Alerta>
    );
  }

  const pasos = <Pasos pasos={PASOS} actual={INDICE_PASO[paso]} />;

  /* ---------- Paso 1: servicio ---------- */
  if (paso === 'elegir' || !elegido || !requisitos) {
    const disponibles = consulta.data?.paquetes ?? [];
    return (
      <div className="flex flex-col gap-4">
        {pasos}
        {consulta.isPending && <Cargando mensaje="Consultando los servicios disponibles..." />}
        {consulta.isError && (
          <Alerta tono="error">
            No se pudieron consultar los servicios disponibles. {consulta.error.message}{' '}
            <button
              type="button"
              className="font-bold text-accion underline"
              onClick={() => void consulta.refetch()}
            >
              Reintentar
            </button>
          </Alerta>
        )}
        {consulta.data && consulta.data.fallidos.length > 0 && (
          <Alerta tono="aviso">
            No se pudieron consultar los paquetes de: {consulta.data.fallidos.join(', ')}.
          </Alerta>
        )}
        {consulta.data && disponibles.length === 0 && (
          <Alerta>No hay servicios disponibles para activar en esta cuenta.</Alerta>
        )}
        {disponibles.length > 0 && (
          <>
            <p className="text-sm font-bold text-gray-700">Elige el servicio a activar:</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {disponibles.map((p) => (
                <TarjetaSeleccionable
                  key={clavePaquete(p)}
                  titulo={p.nombre}
                  marcada={elegido !== null && clavePaquete(elegido) === clavePaquete(p)}
                  onClick={() => setElegido((x) => (x && clavePaquete(x) === clavePaquete(p) ? null : p))}
                  insignia={
                    <span className="w-fit rounded bg-netuno-500/10 px-1.5 py-0.5 text-[10px] font-bold text-netuno-800 uppercase">
                      {SERVICIOS_ACTIVABLES[p.servicio].etiqueta}
                    </span>
                  }
                >
                  <span className="text-sm font-bold text-gray-500">TOTAL mensual: {p.precio}</span>
                </TarjetaSeleccionable>
              ))}
            </div>
          </>
        )}
        <div className="flex justify-end">
          <Boton
            icono={ArrowRight}
            disabled={!elegido}
            onClick={() => {
              setErrores({});
              setPaso('confirmar');
            }}
          >
            Continuar
          </Boton>
        </div>
      </div>
    );
  }

  /* ---------- Paso 2: confirmación ---------- */
  if (paso === 'confirmar') {
    return (
      <div className="flex flex-col gap-4">
        {pasos}
        <div className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-4 shadow-tarjeta">
          <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
            Paquete o servicio seleccionado
          </p>
          <p className="text-base font-bold text-netuno-800">{elegido.nombre}</p>
          <p className="text-sm text-gray-600">
            {SERVICIOS_ACTIVABLES[elegido.servicio].etiqueta} ·{' '}
            <strong className="text-gray-900">{elegido.precio} / mes</strong>
          </p>
          <p className="text-xs text-gray-500">
            Se asocia al contrato de Internet {internet?.codContrato ?? internet?.idProducto}.
          </p>
        </div>

        <FormularioActivacion
          requisitos={requisitos}
          formulario={formulario}
          errores={errores}
          hoy={hoy}
          disabled={activando}
          onCambiar={cambiar}
        />

        {Object.values(errores).some(Boolean) && (
          <p role="alert" className="text-xs font-bold text-red-600">
            Revisa los campos marcados para continuar.
          </p>
        )}

        <div className="flex justify-between gap-2">
          <Boton
            variante="secundario"
            icono={ArrowLeft}
            onClick={() => setPaso('elegir')}
            disabled={activando}
          >
            Regresar
          </Boton>
          <Boton icono={Check} cargando={activando} onClick={() => void confirmar()}>
            {activando ? 'Activando...' : 'Confirmar'}
          </Boton>
        </div>
      </div>
    );
  }

  /* ---------- Paso 3: resultado ---------- */
  return (
    <div className="flex flex-col gap-4">
      {pasos}
      {resultado?.tipo === 'respuesta' && (
        <Alerta tono={resultado.ok ? 'exito' : 'error'}>
          <strong>Resultado de activación:</strong>
          <br />
          {resultado.texto}
        </Alerta>
      )}
      {resultado?.tipo === 'error' && (
        <Alerta tono="error">
          <strong>{MENSAJE_ERROR_CONEXION}</strong>
          <br />
          {resultado.mensaje}
        </Alerta>
      )}
      {resultado?.tipo === 'respuesta' && resultado.avisoCuenta && (
        <Alerta tono="aviso">{resultado.avisoCuenta}</Alerta>
      )}

      {resultado?.tipo === 'respuesta' && (
        <RegistrarCanalAtencion registrar={registrarEvento} onTerminar={() => onCompletado?.()} />
      )}

      <div className="flex justify-end">
        <Boton
          variante="secundario"
          icono={resultado?.tipo === 'error' ? RotateCcw : CirclePlus}
          onClick={reiniciar}
        >
          Activar otro servicio
        </Boton>
      </div>
    </div>
  );
}
