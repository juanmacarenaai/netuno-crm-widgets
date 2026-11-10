import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/** "Etiqueta: valor" (fichas de contrato, consultas...). */
export function Campo({
  etiqueta,
  children,
  alinearDerecha = false,
}: {
  etiqueta: string;
  children: ReactNode;
  alinearDerecha?: boolean;
}) {
  return (
    <p className={cn('flex gap-1 text-sm', alinearDerecha && 'sm:justify-end')}>
      <strong className="shrink-0">{etiqueta}:</strong>
      <span className="break-all text-texto-suave">{children}</span>
    </p>
  );
}

/** Lista de pares [etiqueta, valor]. */
export function ListaCampos({
  campos,
  alinearDerecha,
}: {
  campos: ReadonlyArray<readonly [string, unknown]>;
  alinearDerecha?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {campos.map(([etiqueta, valor]) => (
        <Campo key={etiqueta} etiqueta={etiqueta} alinearDerecha={alinearDerecha}>
          {String(valor)}
        </Campo>
      ))}
    </div>
  );
}

/** Botón con aspecto de enlace (abre un detalle sin salir de la vista). */
export function BotonEnlace({
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn('font-bold text-netuno-link underline hover:text-sky-600', className)}
      {...props}
    />
  );
}
