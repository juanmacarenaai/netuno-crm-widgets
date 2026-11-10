import { useState } from 'react';
import { CheckCircle2, ClipboardCheck } from 'lucide-react';
import { mensajeDeError } from '@/core/http/errores';
import { Boton } from '@/ui';

/** Canales del "Registrar canal de atención" (popupRegistrarCanalAtencion del widget jQuery). */
const CANALES_ATENCION = ['Oficina', 'Telefónico', 'Chat', 'Correo'] as const;

type Estado =
  { tipo: 'pendiente' } | { tipo: 'registrando' } | { tipo: 'ok' } | { tipo: 'error'; texto: string };

/**
 * Guarda la gestión en el módulo Eventos de CRM. Lo usan Cambio de plan y, más adelante, Activar servicios.
 * `registrar(canal)` hace el registro; `onTerminar` se llama al registrar u omitir.
 */
export function RegistrarCanalAtencion({
  registrar,
  onTerminar,
}: {
  registrar: (canal: string) => Promise<unknown>;
  onTerminar?: (resultado: 'registrado' | 'omitido') => void;
}) {
  const [canal, setCanal] = useState<string>(CANALES_ATENCION[0]);
  const [estado, setEstado] = useState<Estado>({ tipo: 'pendiente' });

  const enviar = async () => {
    setEstado({ tipo: 'registrando' });
    try {
      await registrar(canal);
      setEstado({ tipo: 'ok' });
      onTerminar?.('registrado');
    } catch (error) {
      console.error('Error al registrar la gestión:', error);
      setEstado({ tipo: 'error', texto: `Registro de gestión no exitoso: ${mensajeDeError(error)}` });
    }
  };

  if (estado.tipo === 'ok') {
    return (
      <p
        role="status"
        className="flex animate-aparecer items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700"
      >
        <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
        Registro de gestión exitoso.
      </p>
    );
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-tarjeta"
      aria-label="Registrar canal de atención"
    >
      <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800">
        <ClipboardCheck aria-hidden="true" className="h-4 w-4 text-accion" />
        Registrar canal de atención
      </h4>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-bold text-gray-600">
          Canal
          <select
            value={canal}
            onChange={(evento) => setCanal(evento.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-[13px] font-normal focus:border-accion focus:outline-none"
          >
            {CANALES_ATENCION.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <Boton icono={ClipboardCheck} cargando={estado.tipo === 'registrando'} onClick={() => void enviar()}>
          {estado.tipo === 'registrando' ? 'Registrando...' : 'Registrar'}
        </Boton>
        <Boton
          variante="secundario"
          onClick={() => onTerminar?.('omitido')}
          disabled={estado.tipo === 'registrando'}
        >
          Omitir
        </Boton>
      </div>
      {estado.tipo === 'error' && (
        <p role="alert" className="text-xs font-bold text-red-600">
          {estado.texto}
        </p>
      )}
    </section>
  );
}
