import { useMemo, useState } from 'react';
import { Check, RotateCcw, Router } from 'lucide-react';
import { mensajeDeError } from '@/core/http/errores';
import type { Cuenta } from '@/shared/cuentas';
import { useZoho } from '@/shared/zoho/contexto';
import {
  Alerta,
  Boton,
  CampoFormulario,
  CLASE_CONTROL,
  CLASE_LECTURA,
  cn,
  Modal,
  SeccionFormulario,
  useAvisos,
} from '@/ui';
import { RegistrarCanalAtencion } from '@/shared/canal-atencion';
import {
  contratosParaCambioEquipo,
  etiquetaContrato,
  validarCambioEquipo,
  type ErroresCambioEquipo,
  type ResultadoCambioEquipo,
} from './lib/cambioEquipo';
import { cambiarEquipo, registrarEventoCambioEquipo } from './servicio';

type Fase = 'formulario' | 'confirmar' | 'enviando' | 'resultado';

/**
 * Cambio de equipo (pestaña de Administrar cuenta). Asigna un equipo nuevo a un servicio de Internet
 * conectado: Netuno envía el comando a la plataforma y, si responde bien, se registra el canal de atención.
 */
export function CambioEquipo({ cuenta, onCompletado }: { cuenta: Cuenta; onCompletado?: () => void }) {
  const { usuario, registro, documento } = useZoho();
  const { avisar } = useAvisos();
  const contratos = useMemo(() => contratosParaCambioEquipo(cuenta), [cuenta]);

  const [idProducto, setIdProducto] = useState('');
  const [serial, setSerial] = useState('');
  const [errores, setErrores] = useState<ErroresCambioEquipo>({});
  const [fase, setFase] = useState<Fase>('formulario');
  const [resultado, setResultado] = useState<ResultadoCambioEquipo | null>(null);

  const contrato = contratos.find((c) => c.idProducto === idProducto) ?? null;
  const bloqueado = fase === 'enviando' || fase === 'resultado';

  const revisar = () => {
    const encontrados = validarCambioEquipo({ idProducto, serial });
    setErrores(encontrados);
    if (!encontrados.contrato && !encontrados.serial) setFase('confirmar');
  };

  const enviar = async () => {
    setFase('enviando');
    let r: ResultadoCambioEquipo;
    try {
      r = await cambiarEquipo({ idProducto, serial, aliasUsuario: usuario.alias });
    } catch (error) {
      console.error('Error en el cambio de equipo:', error);
      r = { ok: false, mensaje: `No se pudo enviar el cambio de equipo: ${mensajeDeError(error)}` };
    }
    setResultado(r);
    setFase('resultado');
    if (r.ok) avisar({ tipo: 'exito', titulo: 'Equipo cambiado', texto: r.mensaje });
    else avisar({ tipo: 'error', titulo: 'No se completó el cambio de equipo', texto: r.mensaje });
  };

  const nuevo = () => {
    setIdProducto('');
    setSerial('');
    setErrores({});
    setResultado(null);
    setFase('formulario');
  };

  const registrarEvento = (canal: string) => {
    if (!contrato) return Promise.resolve();
    return registrarEventoCambioEquipo({ canal, cuenta, contrato, registro, documento, usuario });
  };

  if (contratos.length === 0) {
    return (
      <Alerta tono="aviso">
        <strong>No es posible cambiar el equipo.</strong>
        <br />
        La cuenta no tiene servicios de Internet conectados.
      </Alerta>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <SeccionFormulario
        titulo="Equipo a asignar"
        icono={Router}
        insignia={String(cuenta.descTipoCliente ?? '').toUpperCase() || undefined}
      >
        <CampoFormulario etiqueta="Nro. Contrato" htmlFor="ce_contrato" requerido error={errores.contrato}>
          <select
            id="ce_contrato"
            className={CLASE_CONTROL}
            value={idProducto}
            disabled={bloqueado}
            onChange={(e) => {
              setIdProducto(e.target.value);
              setErrores((x) => ({ ...x, contrato: undefined }));
            }}
          >
            <option value="">— Seleccione un contrato —</option>
            {contratos.map((c) => (
              <option key={c.idProducto} value={c.idProducto}>
                {etiquetaContrato(c)}
              </option>
            ))}
          </select>
        </CampoFormulario>

        <CampoFormulario etiqueta="Equipo actual" lectura>
          <div className={CLASE_LECTURA}>
            {contrato ? (
              <span className="font-mono">{contrato.serial || 'Sin serial registrado'}</span>
            ) : (
              <span className="text-gray-400">Se muestra al seleccionar el contrato</span>
            )}
          </div>
        </CampoFormulario>

        <CampoFormulario
          etiqueta="Serial de equipo"
          htmlFor="ce_serial"
          requerido
          completo
          error={errores.serial}
          ayuda="Serial del equipo nuevo que se asigna al contrato."
        >
          <input
            id="ce_serial"
            className={cn(CLASE_CONTROL, 'font-mono')}
            value={serial}
            disabled={bloqueado}
            autoComplete="off"
            spellCheck={false}
            placeholder="Ej.: 48575443A1B2C3D4"
            onChange={(e) => {
              setSerial(e.target.value);
              setErrores((x) => ({ ...x, serial: undefined }));
            }}
            onBlur={() => setSerial((s) => s.trim())}
          />
        </CampoFormulario>
      </SeccionFormulario>

      {fase === 'resultado' && resultado && (
        <Alerta tono={resultado.ok ? 'exito' : 'error'}>
          <strong>{resultado.ok ? 'Cambio de equipo enviado.' : 'El cambio de equipo no se realizó.'}</strong>
          <br />
          {resultado.mensaje}
        </Alerta>
      )}

      {fase === 'resultado' && resultado?.ok && (
        <RegistrarCanalAtencion registrar={registrarEvento} onTerminar={() => onCompletado?.()} />
      )}

      <div className="flex justify-end gap-2">
        {fase === 'resultado' ? (
          <>
            {!resultado?.ok && (
              <Boton variante="secundario" onClick={() => setFase('formulario')}>
                Corregir datos
              </Boton>
            )}
            <Boton variante="secundario" icono={RotateCcw} onClick={nuevo}>
              Nuevo cambio de equipo
            </Boton>
          </>
        ) : (
          <Boton icono={Router} cargando={fase === 'enviando'} onClick={revisar}>
            {fase === 'enviando' ? 'Enviando a la plataforma...' : 'Cambiar equipo'}
          </Boton>
        )}
      </div>

      <Modal
        abierto={fase === 'confirmar'}
        titulo="Confirmar cambio de equipo"
        onCerrar={() => setFase('formulario')}
        ancho="max-w-md"
        pie={
          <>
            <Boton variante="secundario" onClick={() => setFase('formulario')}>
              Cancelar
            </Boton>
            <Boton icono={Check} onClick={() => void enviar()}>
              Confirmar
            </Boton>
          </>
        }
      >
        <p className="text-sm text-gray-700">Se enviará el comando a la plataforma con estos datos:</p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="font-bold text-gray-500">Cuenta</dt>
          <dd>{cuenta.cuenta}</dd>
          <dt className="font-bold text-gray-500">Contrato</dt>
          <dd>{contrato ? etiquetaContrato(contrato) : '—'}</dd>
          <dt className="font-bold text-gray-500">Equipo actual</dt>
          <dd className="font-mono">{contrato?.serial || '—'}</dd>
          <dt className="font-bold text-gray-500">Equipo nuevo</dt>
          <dd className="font-mono font-bold text-netuno-800">{serial.trim()}</dd>
        </dl>
      </Modal>
    </div>
  );
}
