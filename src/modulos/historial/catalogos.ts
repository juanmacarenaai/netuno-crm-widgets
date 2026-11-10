/**
 * Opciones de "Registrar Atención" y "Registrar Comunicación".
 * Origen: widgetHistorialV1.1/app/arreglos.json (generado; "Ninguna" se reemplaza por "Seleccione").
 */

export const UNIDADES_COMERCIALES = ['Hogar', 'Empresa'] as const;

export const CANALES = ['Oficina', 'Telefónico', 'Chat'] as const;

/** Categoría → subcategorías de una atención (Cases). */
export const SUBCATEGORIAS: Readonly<Record<string, readonly string[]>> = {
  'Gestión de domicilios': [
    'Ingreso de domiciliación',
    'Revisión de domiciliación',
    'Retiro de domiciliación',
  ],
  'Envío de documento': ['Factura', 'Pago', 'Notas de débito', 'Contrato'],
  'Gestión de facturas': ['Creación N/C', 'Creación N/D', 'Ingreso cargo variable', 'Ingreso de factura'],
  'Gestión de pagos': [
    'Confirmación de pagos aplicados',
    'Error en notificación de pagos',
    'Diferencia en pago',
    'Aviso de Suspensión Soft',
  ],
  'Desconexión voluntaria': [
    'Cierre de negocio',
    'Competencia - Mejor oferta',
    'Económico',
    'Insatisfacción con el servicio',
    'Mudanza zona sin servicio',
    'Viaje',
    'Retención exitosa',
    'Retención venta',
  ],
  Solicitudes: [
    'Actualización de datos',
    'Cambio de titularidad - Razón social',
    'Cambio de equipo',
    'Configuración de equipo',
    'Mudanza externa',
    'Solicitud de reembolso',
  ],
  'Inconveniente resuelto': [
    'Servicio de internet',
    'Servicio de NetUno Go',
    'Suspendido administrativamente',
    'Servicio de telefonía',
  ],
  'Solicitud de información': [
    'Cambio de plan',
    'Factura',
    'Internet',
    'NetUno Go',
    'Telefonía',
    'Recaudos baja del servicio',
    'Recaudos cambio de titularidad',
    'Reconexión hard',
    'Traslado',
    'Medios de pagos',
    'Salud Integral',
  ],
  'Servicio Netuno Go': [],
  'Portal Web': [
    'Cambio de dirección de correo',
    'Cliente con contratos en Hogar y Empresa',
    'Inconvenientes con el registro en portal web',
    'Inconvenientes con la contraseña del portal web',
    'Inconveniente con la notificación de pago',
  ],
  Seguimiento: [
    'Orden de servicio técnico',
    'Pendiente por instalación',
    'Traslado externo',
    'Notificación de pago',
    'Pendiente por cambio de ONT',
  ],
  'Contacto sin interacción': ['Sin respuesta del cliente', 'No contesta'],
  'Zona no disponible': ['Interesado en servicio para Hogar', 'Interesado en servicio para Empresa'],
};

export const CATEGORIAS: readonly string[] = Object.keys(SUBCATEGORIAS);
