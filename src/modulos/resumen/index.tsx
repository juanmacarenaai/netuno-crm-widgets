import { Network, RefreshCw } from 'lucide-react';
import { ListaCuentas, ListaCuentasCargando, TarjetaCuenta, useCuentas } from '@/shared/cuentas';
import { Boton, EncabezadoModulo, MensajeError } from '@/ui';

/**
 * Resumen de Unidad Comercial: las mismas tarjetas de cuenta que el módulo Unidad Comercial
 * (src/shared/cuentas), en una columna y solo de lectura, para la pestaña Resumen del cliente.
 */
export default function Resumen() {
  const cuentas = useCuentas();

  let contenido;
  if (!cuentas.documento) {
    contenido = <MensajeError mensaje="El registro no tiene documento de identidad." />;
  } else if (cuentas.isPending) {
    contenido = <ListaCuentasCargando cantidad={2} columnas={1} conPie={false} />;
  } else if (cuentas.isError) {
    contenido = (
      <MensajeError
        mensaje={`No se lograron cargar los datos. ${cuentas.error.message}`}
        onReintentar={() => void cuentas.refetch()}
      />
    );
  } else {
    contenido = (
      <ListaCuentas
        cuentas={cuentas.data}
        porPagina={2}
        columnas={1}
        tarjeta={(cuenta) => <TarjetaCuenta cuenta={cuenta} serviciosPorPagina={3} />}
      />
    );
  }

  // Mismo encabezado (ícono incluido) que el módulo Unidad Comercial
  return (
    <main className="p-2 sm:p-3">
      <EncabezadoModulo
        titulo="Resumen Unidad Comercial"
        icono={Network}
        descripcion={
          cuentas.data
            ? `${cuentas.data.length} ${cuentas.data.length === 1 ? 'cuenta' : 'cuentas'}`
            : undefined
        }
        acciones={
          <Boton
            tamano="sm"
            variante="secundario"
            icono={RefreshCw}
            iconoGira
            cargando={cuentas.isFetching}
            disabled={!cuentas.documento}
            onClick={() => void cuentas.refetch()}
            aria-label="Refrescar"
            title="Refrescar"
          />
        }
      />
      {contenido}
    </main>
  );
}
