import { CampoFormulario, CLASE_CONTROL, cn } from '@/ui';
import type { CampoTicket, OpcionLookup, ValorCampo } from '../lib/formularioTicket';
import { EditorDescripcion } from './EditorDescripcion';

const TIPO_INPUT: Partial<Record<CampoTicket['tipo'], string>> = {
  Phone: 'tel',
  Email: 'email',
  Number: 'number',
  Decimal: 'number',
  Percent: 'number',
  Currency: 'number',
  URL: 'url',
  Date: 'date',
  DateTime: 'datetime-local',
};

/** Un campo del diseño de Desk según su tipo (los mismos tipos que arma el widget jQuery). */
export function CampoDinamico({
  campo,
  valor,
  onCambiar,
  error,
  opciones,
  fijo,
  deshabilitado,
}: {
  campo: CampoTicket;
  valor: ValorCampo | undefined;
  onCambiar: (valor: ValorCampo) => void;
  error?: string;
  /** Opciones de LookUp o de la subcategoría (si no, las del diseño). */
  opciones?: readonly OpcionLookup[];
  /** Valor fijo (canal y estado): se muestra sin poder cambiarlo. */
  fijo?: boolean;
  deshabilitado?: boolean;
}) {
  const id = `ct_${campo.api}`;
  const clase = cn(CLASE_CONTROL, error && 'border-red-400');
  const completo = campo.api === 'subject' || campo.api === 'description' || campo.tipo === 'Textarea';
  const texto = typeof valor === 'string' ? valor : '';
  let control;

  if (campo.api === 'description') {
    control = (
      <EditorDescripcion id={id} onCambiar={onCambiar} error={Boolean(error)} deshabilitado={deshabilitado} />
    );
  } else if (campo.tipo === 'LookUp' || campo.tipo === 'Picklist') {
    const lista = opciones ?? campo.opciones.map((o) => ({ valor: o, etiqueta: o }));
    control = (
      <select
        id={id}
        className={clase}
        value={texto}
        disabled={deshabilitado || fijo || (campo.tipo === 'LookUp' && lista.length === 0)}
        onChange={(e) => onCambiar(e.target.value)}
      >
        {(lista.length === 0 || !lista.some((o) => o.valor === texto)) && (
          <option value="">{lista.length === 0 ? 'Sin opciones' : 'Seleccione'}</option>
        )}
        {lista.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
    );
  } else if (campo.tipo === 'Multiselect') {
    const marcados = Array.isArray(valor) ? valor : [];
    control = (
      <fieldset
        id={id}
        className={cn(
          'flex flex-wrap gap-x-4 gap-y-1.5 rounded-lg border border-gray-300 px-3 py-2',
          error && 'border-red-400',
        )}
      >
        <legend className="sr-only">{campo.etiqueta}</legend>
        {campo.opciones.map((o) => (
          <label key={o} className="flex items-center gap-1.5 text-[13px] text-gray-700">
            <input
              type="checkbox"
              checked={marcados.includes(o)}
              disabled={deshabilitado}
              onChange={(e) =>
                onCambiar(e.target.checked ? [...marcados, o] : marcados.filter((x) => x !== o))
              }
            />
            {o}
          </label>
        ))}
      </fieldset>
    );
  } else if (campo.tipo === 'Boolean') {
    control = (
      <label className="flex items-center gap-2 text-[13px] text-gray-700">
        <input
          id={id}
          type="checkbox"
          className="h-4 w-4"
          checked={valor === true}
          disabled={deshabilitado}
          onChange={(e) => onCambiar(e.target.checked)}
        />
        {valor === true ? 'Sí' : 'No'}
      </label>
    );
  } else if (campo.tipo === 'Textarea') {
    control = (
      <textarea
        id={id}
        rows={3}
        className={clase}
        value={texto}
        disabled={deshabilitado}
        onChange={(e) => onCambiar(e.target.value)}
      />
    );
  } else {
    control = (
      <input
        id={id}
        type={TIPO_INPUT[campo.tipo] ?? 'text'}
        step={campo.tipo === 'Number' ? 1 : campo.tipo === 'Text' ? undefined : 'any'}
        className={clase}
        value={texto}
        disabled={deshabilitado}
        onChange={(e) => onCambiar(e.target.value)}
      />
    );
  }

  return (
    <CampoFormulario
      etiqueta={campo.etiqueta}
      htmlFor={campo.tipo === 'Multiselect' ? undefined : id}
      requerido={campo.obligatorio}
      lectura={fijo}
      completo={completo}
      error={error}
      ayuda={campo.api === 'description' ? 'Puedes pegar imágenes (Ctrl+V).' : undefined}
    >
      {control}
    </CampoFormulario>
  );
}
