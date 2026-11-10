import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { cn } from './cn';

/**
 * Muestra HTML que devuelve una API (tablas de OLT, Autofind, consumo...) después de limpiarlo.
 * Nunca usar dangerouslySetInnerHTML directamente en un módulo: usar este componente.
 */
export function HtmlSeguro({
  html,
  className,
  sinDatos = 'Sin datos',
}: {
  html: unknown;
  className?: string;
  sinDatos?: string;
}) {
  const limpio = useMemo(
    () => (html ? DOMPurify.sanitize(String(html), { FORBID_TAGS: ['img', 'style', 'form'] }) : ''),
    [html],
  );

  if (!limpio) return <p className="text-sm text-texto-suave">{sinDatos}</p>;

  return (
    <div className={cn('html-api overflow-auto', className)} dangerouslySetInnerHTML={{ __html: limpio }} />
  );
}
