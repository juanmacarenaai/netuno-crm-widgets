import { useState, type FormEvent, type ReactNode } from 'react';
import { Mail, RotateCcw, Send } from 'lucide-react';
import { RegistrarCanalAtencion } from '@/shared/canal-atencion';
import type { Contrato } from '@/shared/cuentas';
import { Alerta, Boton, CampoFormulario, Chip, CLASE_CONTROL, CLASE_LECTURA, cn, Modal } from '@/ui';
import {
  claveValida,
  errorCorreoNuevo,
  errorNombreRed,
  GESTIONES,
  type ResultadoCorreo,
  type ResultadoGestion,
  type TipoGestion,
  type ValoresGestion,
} from '../lib/contrasenas';
import { CampoClave } from './CampoClave';

type Fase<R> = { tipo: 'formulario' } | { tipo: 'enviando' } | { tipo: 'resultado'; resultado: R };

/** Resultado de la gestión y, si la plataforma la recibió, "Registrar canal de atención". */
function PasoResultado({
  resultado,
  registrar,
  onCerrar,
}: {
  resultado: ResultadoGestion;
  registrar?: (canal: string) => Promise<unknown>;
  onCerrar: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Alerta tono={resultado.tono}>{resultado.mensaje}</Alerta>
      {registrar && (
        <RegistrarCanalAtencion
          registrar={registrar}
          onTerminar={(r) => {
            if (r === 'omitido') onCerrar();
          }}
        />
      )}
    </div>
  );
}

/** Título con la insignia del servicio y el contrato (si la gestión es de un servicio). */
function Encabezado({ insignia, contrato }: { insignia: string; contrato: Contrato | null }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-texto-suave">
      <Chip tono="info">{insignia}</Chip>
      {contrato && (
        <span>
          Contrato{' '}
          <strong className="text-gray-700 tabular-nums">
            {contrato.codContrato ?? contrato.idProducto}
          </strong>
          {contrato.nombrePaquete && ` · ${contrato.nombrePaquete}`}
        </span>
      )}
    </div>
  );
}

function Pie({
  fase,
  formulario,
  textoEnviar,
  onCerrar,
  onReintentar,
}: {
  fase: Fase<ResultadoGestion>;
  formulario: string;
  textoEnviar: string;
  onCerrar: () => void;
  onReintentar: () => void;
}): ReactNode {
  if (fase.tipo === 'resultado') {
    return (
      <>
        {fase.resultado.tono === 'error' && (
          <Boton variante="secundario" icono={RotateCcw} onClick={onReintentar}>
            Intentar de nuevo
          </Boton>
        )}
        <Boton onClick={onCerrar}>Cerrar</Boton>
      </>
    );
  }
  const enviando = fase.tipo === 'enviando';
  return (
    <>
      <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
        Cancelar
      </Boton>
      <Boton type="submit" form={formulario} icono={Send} cargando={enviando}>
        {enviando ? 'Procesando...' : textoEnviar}
      </Boton>
    </>
  );
}

// ── Contraseña / nombre de la red ───────────────────────────────────

/** Portal web, NetUno Go, control parental y WiFi (nombre, contraseña o ambos). */
export function GestionModal({
  tipo,
  contrato,
  enviar,
  registrar,
  onCerrar,
}: {
  tipo: TipoGestion;
  contrato: Contrato | null;
  enviar: (valores: ValoresGestion) => Promise<ResultadoGestion>;
  registrar: (canal: string) => Promise<unknown>;
  onCerrar: () => void;
}) {
  const definicion = GESTIONES[tipo];
  const [nombre, setNombre] = useState('');
  const [clave, setClave] = useState('');
  const [intentado, setIntentado] = useState(false);
  const [fase, setFase] = useState<Fase<ResultadoGestion>>({ tipo: 'formulario' });
  const enviando = fase.tipo === 'enviando';
  const formulario = `gestion-${tipo}`;

  const errorNombre = definicion.pideNombre && intentado ? errorNombreRed(nombre) : null;

  const enviarFormulario = async (e: FormEvent) => {
    e.preventDefault();
    setIntentado(true);
    if (definicion.pideNombre && errorNombreRed(nombre)) return;
    if (definicion.pideClave && !claveValida(clave)) return;
    setFase({ tipo: 'enviando' });
    const resultado = await enviar({
      ...(definicion.pideClave && { clave }),
      ...(definicion.pideNombre && { nombre }),
    });
    setFase({ tipo: 'resultado', resultado });
  };

  return (
    <Modal
      abierto
      titulo={definicion.titulo}
      onCerrar={enviando ? undefined : onCerrar}
      ancho="max-w-lg"
      pie={
        <Pie
          fase={fase}
          formulario={formulario}
          textoEnviar={definicion.pideNombre && !definicion.pideClave ? 'Cambiar' : 'Restablecer'}
          onCerrar={onCerrar}
          onReintentar={() => setFase({ tipo: 'formulario' })}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <Encabezado insignia={definicion.insignia} contrato={contrato} />
        {fase.tipo === 'resultado' ? (
          <PasoResultado
            resultado={fase.resultado}
            registrar={fase.resultado.tono === 'exito' ? registrar : undefined}
            onCerrar={onCerrar}
          />
        ) : (
          <form
            id={formulario}
            onSubmit={(e) => void enviarFormulario(e)}
            className="flex flex-col gap-4"
            noValidate
          >
            {definicion.pideNombre && (
              <CampoFormulario
                etiqueta="Nombre nuevo de la red"
                htmlFor={`${formulario}-nombre`}
                requerido
                error={errorNombre ?? undefined}
                ayuda="Solo letras, números y guion bajo (_), sin espacios."
              >
                <input
                  id={`${formulario}-nombre`}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={32}
                  value={nombre}
                  disabled={enviando}
                  aria-invalid={Boolean(errorNombre)}
                  onChange={(e) => setNombre(e.target.value)}
                  className={cn(CLASE_CONTROL, errorNombre && 'border-red-400')}
                />
              </CampoFormulario>
            )}
            {definicion.pideClave && (
              <CampoClave
                id={`${formulario}-clave`}
                valor={clave}
                onCambiar={setClave}
                mostrarErrores={intentado}
                deshabilitado={enviando}
              />
            )}
          </form>
        )}
      </div>
    </Modal>
  );
}

// ── Correo de NetUno Go ─────────────────────────────────────────────

export function CorreoModal({
  contrato,
  enviar,
  registrar,
  onCerrar,
}: {
  contrato: Contrato;
  enviar: (correoNuevo: string) => Promise<ResultadoCorreo & { aceptado: boolean }>;
  /** Registra el evento con el correo anterior y el nuevo. */
  registrar: (anterior: string, nuevo: string, canal: string) => Promise<unknown>;
  onCerrar: () => void;
}) {
  const anterior = String(contrato.serial ?? '');
  const [nuevo, setNuevo] = useState('');
  const [intentado, setIntentado] = useState(false);
  const [fase, setFase] = useState<Fase<ResultadoCorreo & { aceptado: boolean }>>({ tipo: 'formulario' });
  const enviando = fase.tipo === 'enviando';
  const error = intentado ? errorCorreoNuevo(nuevo, anterior) : null;
  const formulario = 'gestion-correo';

  const enviarFormulario = async (e: FormEvent) => {
    e.preventDefault();
    setIntentado(true);
    if (errorCorreoNuevo(nuevo, anterior)) return;
    setFase({ tipo: 'enviando' });
    setFase({ tipo: 'resultado', resultado: await enviar(nuevo.trim()) });
  };

  return (
    <Modal
      abierto
      titulo="Cambio de correo"
      onCerrar={enviando ? undefined : onCerrar}
      ancho="max-w-lg"
      pie={
        <Pie
          fase={fase}
          formulario={formulario}
          textoEnviar="Cambiar"
          onCerrar={onCerrar}
          onReintentar={() => setFase({ tipo: 'formulario' })}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <Encabezado insignia="NetUno Go" contrato={contrato} />
        {fase.tipo === 'resultado' ? (
          <PasoResultado
            resultado={fase.resultado}
            registrar={
              fase.resultado.aceptado ? (canal) => registrar(anterior, nuevo.trim(), canal) : undefined
            }
            onCerrar={onCerrar}
          />
        ) : (
          <form
            id={formulario}
            onSubmit={(e) => void enviarFormulario(e)}
            className="flex flex-col gap-4"
            noValidate
          >
            <CampoFormulario etiqueta="Correo anterior" lectura>
              <p className={cn(CLASE_LECTURA, 'flex items-center gap-2 break-all')}>
                <Mail aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-400" />
                {anterior || 'Sin correo registrado'}
              </p>
            </CampoFormulario>
            <CampoFormulario
              etiqueta="Correo nuevo"
              htmlFor={`${formulario}-nuevo`}
              requerido
              error={error ?? undefined}
            >
              <input
                id={`${formulario}-nuevo`}
                type="email"
                inputMode="email"
                autoComplete="off"
                spellCheck={false}
                maxLength={254}
                placeholder="usuario@dominio.com"
                value={nuevo}
                disabled={enviando}
                aria-invalid={Boolean(error)}
                onChange={(e) => setNuevo(e.target.value)}
                className={cn(CLASE_CONTROL, error && 'border-red-400')}
              />
            </CampoFormulario>
          </form>
        )}
      </div>
    </Modal>
  );
}
