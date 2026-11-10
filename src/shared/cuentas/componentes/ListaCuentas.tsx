import { useState, type ReactNode } from 'react';
import { dividirEnBloques } from '@/shared/lib/paginacion';
import { cn, EstadoVacio, Paginador } from '@/ui';
import { CUENTAS_POR_PAGINA } from '../lib/cuentas';
import type { Cuenta } from '../tipos';
import { TarjetaCuentaEsqueleto } from './TarjetaCuenta';

const COLUMNAS = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
} as const;

export interface ListaCuentasProps {
  cuentas: Cuenta[];
  /** Dibuja la tarjeta de cada cuenta (cada módulo decide sus acciones). */
  tarjeta: (cuenta: Cuenta) => ReactNode;
  porPagina?: number;
  columnas?: keyof typeof COLUMNAS;
}

/** Cuentas del cliente paginadas. */
export function ListaCuentas({
  cuentas,
  tarjeta,
  porPagina = CUENTAS_POR_PAGINA,
  columnas = 2,
}: ListaCuentasProps) {
  const [pagina, setPagina] = useState(0);
  const paginas = dividirEnBloques(cuentas, porPagina);
  const visibles = paginas[Math.min(pagina, paginas.length - 1)] ?? [];

  if (cuentas.length === 0) {
    return <EstadoVacio mensaje="No se encontraron cuentas en Netuno para el documento de este cliente." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div key={pagina} className={cn('grid animate-aparecer gap-4', COLUMNAS[columnas])}>
        {visibles.map((cuenta) => (
          <div key={String(cuenta.cuenta)}>{tarjeta(cuenta)}</div>
        ))}
      </div>
      <div className="flex justify-center">
        <Paginador
          totalPaginas={paginas.length}
          pagina={pagina}
          onCambiar={setPagina}
          etiqueta="Páginas de cuentas"
        />
      </div>
    </div>
  );
}

/** Mientras se consultan las cuentas. */
export function ListaCuentasCargando({
  cantidad = 4,
  columnas = 2,
  conPie = true,
}: {
  cantidad?: number;
  columnas?: keyof typeof COLUMNAS;
  conPie?: boolean;
}) {
  return (
    <div
      className={cn('grid gap-4', COLUMNAS[columnas])}
      role="status"
      aria-label="Cargando las cuentas del cliente"
    >
      {Array.from({ length: cantidad }, (_, i) => (
        <TarjetaCuentaEsqueleto key={i} conPie={conPie} />
      ))}
    </div>
  );
}
