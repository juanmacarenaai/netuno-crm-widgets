import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Cargando, MensajeError } from '@/ui';

/** Carga, error o contenido de una consulta. */
export function Resultado<T>({
  consulta,
  children,
}: {
  consulta: UseQueryResult<T>;
  children: (datos: T) => ReactNode;
}) {
  if (consulta.isPending) return <Cargando mensaje="Consultando..." />;
  if (consulta.isError) {
    return (
      <MensajeError
        mensaje={`No se pudo completar la consulta. ${consulta.error.message}`}
        onReintentar={() => void consulta.refetch()}
      />
    );
  }
  return <>{children(consulta.data)}</>;
}
