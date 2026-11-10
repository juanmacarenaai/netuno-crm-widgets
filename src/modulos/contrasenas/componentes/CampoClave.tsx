import { useState } from 'react';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import { CampoFormulario, CLASE_CONTROL, cn } from '@/ui';
import { requisitosClave } from '../lib/contrasenas';

/** Contraseña nueva con botón para verla y la lista de requisitos que se marca mientras se escribe. */
export function CampoClave({
  id,
  valor,
  onCambiar,
  mostrarErrores,
  deshabilitado,
}: {
  id: string;
  valor: string;
  onCambiar: (valor: string) => void;
  /** Después de intentar enviar, los requisitos que faltan se marcan en rojo. */
  mostrarErrores: boolean;
  deshabilitado?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const requisitos = requisitosClave(valor);
  const incompleta = requisitos.some((r) => !r.cumple);

  return (
    <CampoFormulario etiqueta="Contraseña nueva" htmlFor={id} requerido completo>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          spellCheck={false}
          value={valor}
          disabled={deshabilitado}
          aria-invalid={mostrarErrores && incompleta}
          aria-describedby={`${id}-requisitos`}
          onChange={(e) => onCambiar(e.target.value)}
          className={cn(CLASE_CONTROL, 'pr-10 font-mono', mostrarErrores && incompleta && 'border-red-400')}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={deshabilitado}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-gray-400 hover:text-netuno-800"
          aria-label={visible ? 'Ocultar contraseña' : 'Ver contraseña'}
          aria-pressed={visible}
          title={visible ? 'Ocultar contraseña' : 'Ver contraseña'}
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Eye aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
      </div>
      <ul
        id={`${id}-requisitos`}
        className="grid grid-cols-1 gap-x-4 gap-y-1 pt-1 sm:grid-cols-2"
        aria-label="Requisitos"
      >
        {requisitos.map((r) => {
          const falta = !r.cumple && mostrarErrores;
          return (
            <li
              key={r.id}
              className={cn(
                'flex items-center gap-1.5 text-[11px]',
                r.cumple ? 'text-emerald-700' : falta ? 'font-bold text-red-600' : 'text-gray-500',
              )}
            >
              {r.cumple ? (
                <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <X aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              )}
              <span>
                {r.texto}
                <span className="sr-only">{r.cumple ? ' (cumple)' : ' (falta)'}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </CampoFormulario>
  );
}
