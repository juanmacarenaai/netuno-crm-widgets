import { useRef, type ClipboardEvent } from 'react';
import { cn } from '@/ui';

/**
 * Descripción del ticket con imágenes pegadas (campo "description" del widget jQuery: div contenteditable).
 * No es controlado: React no reescribe el HTML (perdería el cursor); cada cambio se informa con `onCambiar`.
 */
export function EditorDescripcion({
  id,
  onCambiar,
  error,
  deshabilitado,
}: {
  id: string;
  onCambiar: (html: string) => void;
  error?: boolean;
  deshabilitado?: boolean;
}) {
  const editor = useRef<HTMLDivElement>(null);

  const informar = () => onCambiar(editor.current?.innerHTML ?? '');

  const pegar = (evento: ClipboardEvent<HTMLDivElement>) => {
    const imagenes = [...evento.clipboardData.items].filter((item) => item.type.startsWith('image/'));
    if (imagenes.length === 0) return;
    evento.preventDefault();
    for (const item of imagenes) {
      const archivo = item.getAsFile();
      if (!archivo) continue;
      const lector = new FileReader();
      lector.onload = () => {
        const destino = editor.current;
        if (!destino || typeof lector.result !== 'string') return;
        const imagen = document.createElement('img');
        imagen.src = lector.result;
        imagen.style.width = '400px';
        imagen.style.maxWidth = '100%';
        imagen.setAttribute('data-pasted', 'true');
        destino.appendChild(imagen);
        informar();
      };
      lector.readAsDataURL(archivo);
    }
  };

  return (
    <div
      id={id}
      ref={editor}
      role="textbox"
      aria-multiline="true"
      aria-invalid={error}
      contentEditable={!deshabilitado}
      suppressContentEditableWarning
      onInput={informar}
      onPaste={pegar}
      className={cn(
        'min-h-32 w-full overflow-auto rounded-lg border border-gray-300 bg-white px-3 py-2 text-[13px] transition focus:border-accion focus:ring-2 focus:ring-accion/20 focus:outline-none [&_img]:my-2 [&_img]:rounded',
        error && 'border-red-400',
        deshabilitado && 'bg-gray-50 text-gray-500',
      )}
    />
  );
}
