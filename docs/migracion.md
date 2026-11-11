# Migración de los widgets jQuery

Cada widget jQuery se migra como un módulo de este proyecto. Mientras tanto, el widget anterior sigue en uso.

## Estado

| Módulo              | Widget anterior                               | Tamaño original | Base disponible                                                          | Estado                                                                                          |
| ------------------- | --------------------------------------------- | --------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `diagnostico`       | —                                             | —               | —                                                                        | ✅ Listo (herramienta interna)                                                                  |
| `resumen`           | `widgetUnidadComercialResumen`                | ~640 líneas     | Tarjetas de cuenta de `UnidadComercialReact`                             | ✅ v0.2.0: usa `src/shared/cuentas`                                                             |
| `unidad-comercial`  | `widgetUnidadComercial` (`UnidadComercialJS`) | ~11.400 líneas  | `UnidadComercialReact`: fases 0-2, traslado y cambio de plan ya en React | 🔶 v0.14.0: todas las gestiones (falta validar en Fase3; Cambio de titularidad en demostración) |
| `contrasenas`       | `Netuno-Zoho-CRM-widgetContrasenas`           | ~1.300 líneas   | Tarjetas de `src/shared/cuentas`                                         | 🔶 v0.12.0: completo (falta validar en Fase3)                                                   |
| `historial`         | `widgetHistorialV1.1`                         | ~4.000 líneas   | —                                                                        | 🔶 v0.10.0: completo (falta validar en Fase3)                                                   |
| `historial-resumen` | — (recuadro del Canvas)                       | —               | `src/shared/historial`                                                   | 🔶 v0.11.0: nuevo (falta validar en Fase3)                                                      |
| `facturacion`       | `widgetFacturacionV1.2`                       | ~10.800 líneas  | Tarjetas de `src/shared/cuentas`, tabla de `src/shared/historial`        | 🔶 v0.13.0: entrega 1 (consulta y documentos); entrega 2 pendiente                              |

### Unidad Comercial: entregas

| Entrega                 | Contenido                                                                                                                                                                                                                                                                                                                         | Estado     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1. Consulta             | Tarjetas de cuenta (compartidas con Resumen), servicios, Ver contrato y detalle, valores ópticos, OLT, serial ONT, autofind, consumo (Internet y Telefonía), mapa de la cuenta, Administrar cuenta (con permisos)                                                                                                                 | ✅ v0.2.0  |
| 2. Cambio de plan       | Elegibilidad, upgrade (Netuno) con registro del canal de atención (Eventos de CRM), downgrade con ticket en Zoho Desk, exclusión de beneficiarios de Salud y aprobación según las reglas de `cambio-plan/config.ts`                                                                                                               | ✅ v0.3.0  |
| 3. Traslado de servicio | Formulario, autocompletado de dirección (Photon), selector de ubicación con capas de Weezie (NAP y edificios), vista de edificio con unidades y cajas de piso, solicitud guardada en el cliente (`Solicitud_Traslado`, `Estado_Traslado`)                                                                                         | ✅ v0.4.0  |
| 4.1 Cambio de equipo    | Contratos de Internet conectados, serial nuevo, confirmación, comando en Netuno (`/contrato/cambio-equipo/sac`) y registro del canal de atención                                                                                                                                                                                  | ✅ v0.5.0  |
| 4.2 Activar servicios   | Elegibilidad, paquetes de NetUnoGO o Premium, Telefonía y Salud, correo de NetUnoGO, datos del titular y del beneficiario de Salud, activación en Netuno, sexo y fecha de nacimiento en la cuenta de CRM, registro del canal de atención                                                                                          | ✅ v0.6.0  |
| 4.3 Baja voluntaria     | Elegibilidad, servicios con dependencias (Internet, NetUnoGO, Salud principal), paquetizados, ticket abierto, retención, devolución del equipo, ticket en Zoho Desk (territorio de Catalyst), desconexión inmediata en Netuno y registro del canal                                                                                | ✅ v0.7.0  |
| 4.4 Crear ticket        | Botón por servicio: departamentos de Desk, formulario armado con el diseño activo de tickets (todos los tipos de campo), datos del cliente y del servicio precargados (CRM, BOSS, NAS, potencia, territorio), cuenta y contacto de Desk, producto, categoría y subcategoría, imágenes pegadas, ticket existente                   | ✅ v0.8.0  |
| 4.5 Troubleshooting     | Evento masivo (Catalyst) con ticket hijo y ticket padre, posible evento masivo del nodo, diagnóstico guiado (sin conexión por luces POWER/LOS/PON, intermitencia, lentitud), reporte de fallas a node-red, valores ópticos e IP, restablecer la ONT con registro del canal, asistencia remota (Zoho Assist) y paso a Crear ticket | ✅ v0.9.0  |
| Cambio de titularidad   | Nuevo, desde el diseño de la PM (ver `docs/cambio-titularidad.md`): visual completa en modo demostración; servicios pendientes                                                                                                                                                                                                    | 🔶 v0.14.0 |

Comportamientos iguales a `UnidadComercialReact` (y sus diferencias intencionales con el widget jQuery,
documentadas en `widgetUnidadComercial/docs/migracion-react.md`). Las pruebas de la lógica se portaron a
TypeScript sin cambios de resultado (107 de la entrega 1, 54 de Cambio de plan y 58 de Traslado). Diferencias
nuevas:

- El consumo de telefonía compara el número de cuenta como texto, porque la API puede enviarlo como número.
- Downgrade: si falta el ID del departamento de Desk del entorno, se avisa **antes** de crear la cuenta, el
  contacto o el ticket en Desk.
- Traslado: el agente de Desk (`idAgenteDesk`) se consulta con la cabecera `orgId`; el widget jQuery enviaba
  `ordgId` (con error de escritura). Si Desk no responde se guarda `null`, igual que antes.
- Traslado: las búsquedas de lugares iguales se reutilizan durante un minuto (TanStack Query) en lugar de
  repetirse a Photon.
- Traslado (v0.15.0, pedido de IT para la gestión de fallas masivas): `Solicitud_Traslado` agrega el objeto `red`
  con **todos los IDs de Weezie** de la ubicación elegida en el mapa: `idZonaPon`, `idOlt`, `idNap`, `idEdificio`,
  `idPiso`, `idCajaPiso` e `idApartamento`, cada uno con su etiqueta. Así, al registrar una falla masiva se revisa si
  el ID afectado está entre los de la ubicación del cliente. Los campos anteriores (`cobertura`, `puntoRed`,
  `unidadEdificio`) se conservan sin cambios por si la regla o la función de CRM que crea el ticket los lee.
  - **Casa** (NAP elegida): zona PON y NAP; edificio, piso, caja y apartamento quedan en `null`.
  - **Edificio**: la NAP es el cierre (`cl_id`) de la caja de piso que atiende la unidad; en Weezie suele coincidir
    con el ID de la caja (`fbox_id`). Por confirmar con IT.
  - **`idOlt` queda en `null`:** Weezie `closures/nearby` no trae la OLT. Pendiente de que IT indique de dónde sale.
  - Sin punto de Weezie (pin movido a mano o coordenadas escritas), `red` es `null`.
  - `cobertura.nap` ahora se llena también con la NAP o la caja de piso elegida (antes solo con la cobertura
    simulada).

Cambio de equipo (origen: `showTab` → `cambioEquipo` y `continueFuncionality` → `button_modal_cambioEquipo`):

- Se pide **confirmación** antes de enviar el comando, mostrando el equipo actual y el nuevo.
- Si la plataforma rechaza el serial, el formulario conserva los datos para corregirlos (el widget jQuery los
  borraba y ocultaba el botón).
- El evento de CRM guarda en `Contrato` el **código de contrato** (como Cambio de plan); el widget jQuery enviaba
  el `idProducto`. `Producto` lleva el servicio ("Internet"); antes dependía de una variable global.
- **Acta PDF de solicitud de equipo no migrada:** el código existe en el widget jQuery (`button_modal_cambioEquipo_2`,
  `pdf_call` con pdfMake en Catalyst), pero el botón no está en ningún HTML, así que hoy nadie la usa. Se
  agrega si Netuno lo pide.
- **Cambio de titularidad no existe en el widget jQuery** (la pestaña solo muestra "(pendiente)"): no hay nada que
  migrar. Se construyó desde el diseño de la PM en v0.14.0 (ver `docs/cambio-titularidad.md`).

Activar servicios (origen: `showTab` → `activarServicios`, `activarServicios`, `continueActivarServicio`,
`validarDatosActivacion`, `actualizarCRM_Y_Activar`, `activarServicio`):

- Mismas reglas: Empresa, Comercio y factura pendiente bloquean; se ofrece Premium si ya tiene NetUnoGO (si no,
  NetUnoGO), Telefonía si no la tiene y Salud mientras tenga menos de 5 contratos; un paquete por activación;
  Telefonía muestra $1; el correo del titular de Salud va en base64; la activación se envía con `fetch` directo
  (la API de Netuno permite CORS desde `widgets-netuno.onslate.com`), igual que el widget jQuery.
- **Sin Internet FTTH conectado** se muestra "Debes tener activo el servicio de Internet Fibra." (el widget jQuery
  fallaba sin aviso y dejaba la ventana de progreso abierta).
- Los paquetes se consultan en paralelo; si un servicio falla se muestran los demás y se avisa cuál falló (el
  widget jQuery no mostraba ninguno).
- **Salud titular:** el widget jQuery validaba campos que no existían, así que se podía activar sin sexo ni fecha
  de nacimiento del titular. Ahora se exigen cuando faltan en CRM.
- Validaciones nuevas: formato de correo, celular de 7 dígitos (solo números) y fechas de nacimiento no futuras.
  Los mensajes del titular dicen "del titular" (antes "del beneficiario").
- Si la plataforma rechaza la activación se ofrece igualmente registrar el canal (como el widget jQuery, que
  guarda "Estatus: Fallido" en la descripción). Si la API no responde, no se ofrece.
- La activación no tiene reintento automático ni se aborta al vencer el plazo (2 minutos): podría completarse
  en Netuno igual, y un segundo intento la duplicaría.
- Por confirmar con Netuno: `validarOtp: true` en Salud adicional se envía con `otp` vacío (igual que el widget
  jQuery, que no tiene pantalla de OTP).

Baja voluntaria (origen: `showTab` → `bajaVoluntaria`, `activeClick`/`dependencyServices`, `continueFuncionality` →
`button_modal_bajaVoluntaria`, `bajaContratos`, `noPaquetizado`, `crearTicketAutomaticoBaja`):

- Mismas reglas de elegibilidad, dependencias, retención, devolución del equipo, estado del ticket
  (Cerrado / Pendiente por aprobación / Desconexión programada) y baja inmediata con confirmación.
- **Motivo de desconexión:** Netuno recibe siempre `codMotDesc: 18`, porque en el widget jQuery todas las
  subcategorías de "Desconexión voluntaria" tienen ese valor. El ticket lleva la subcategoría elegida.
- El motivo es obligatorio y empieza vacío (el widget jQuery tomaba la primera subcategoría sin validar).
- La fecha de desconexión no puede ser anterior a hoy, y "hoy" es la fecha local (el widget jQuery usaba la de
  UTC, que después de las 8 p. m. ya es el día siguiente).
- El orden de los contratos para Netuno es el mismo, pero se conservan todos (el widget jQuery guardaba solo el
  último Internet, NetUnoGO o Salud principal si había varios).
- Si la baja en Netuno falla, **no** se crea el ticket (el widget jQuery lo creaba igual). Si la baja funciona y
  el ticket falla, se avisa que los servicios ya se desconectaron y se permite registrar el canal.
- Si el territorio de Catalyst no responde, el ticket se crea sin "Operación" (antes no se creaba).
- Se envía la cabecera `orgId` a Desk (el widget jQuery enviaba `ordgId` al buscar y crear tickets).
- El contacto de Desk se vincula a la cuenta sin modificar sus datos (`deskApi.contactoVinculado`, la misma
  lógica que usarán Crear ticket y Troubleshooting).
- Pendiente: ID del departamento **Ventas** en el Desk de pruebas (retención de clientes Empresa). En
  producción es `976322000000498241`.

Crear ticket (origen: `crearTicket(event)`, `crearTicketZoho`, `registrarTicket`, `apply_subCategory`):

- El formulario se arma con el diseño activo de tickets del departamento, igual que el widget jQuery: mismos
  tipos de campo, secciones ocultas, "RCJ" solo para clientes que no son Hogar, canal "Interno" y estado
  "Nuevo" fijos, y los mismos datos precargados.
- Los obligatorios de las secciones ocultas no se exigen (el widget jQuery los exigía sin mostrarlos, y el
  ticket no se podía crear).
- **Alquiler de equipo** se precarga marcado cuando el contrato dice "SI" (el widget jQuery asignaba `value` a la
  casilla, así que siempre se enviaba sin marcar).
- Las consultas (contrato, cuenta y contacto, producto, subcategorías, territorio, NAS y potencia) van en
  paralelo; si alguna opcional falla, se avisa y el formulario se puede completar a mano. Sin diseño o sin
  cuenta/contacto de Desk no se continúa.
- No hay la espera fija de 5 segundos antes de mostrar el resultado.
- **Imágenes pegadas:** se suben a la función `uploadFile` de Catalyst con `fetch`, como el widget jQuery. Esa
  función **no responde cabeceras CORS** a ningún origen (verificado con un preflight), así que desde el
  navegador la subida probablemente falla en los dos widgets y la imagen viaja en base64 dentro de la
  descripción. El widget nuevo lo avisa. Para arreglarlo hay que habilitar CORS en Catalyst para
  `widgets-netuno.onslate.com` (pendiente de Netuno).

Troubleshooting (origen: `Troubleshooting`, `buscarTEM`, `crearTicketAutomatico`, `verTicketPadre`, `buscarPEM`,
`tipoFallaCliente`, `validarPotencia`, `ipAsignada`):

- Mismo árbol de decisión y mismos textos. Las ~12 ventanas superpuestas del widget jQuery se reemplazan por
  pasos dentro de una sola ventana, con la lista de verificaciones a la izquierda.
- Sin las esperas fijas de 5 segundos (antes del PEM y al crear el ticket hijo).
- Si Catalyst (TEM o PEM) no responde, se avisa y se sigue con el diagnóstico (el widget jQuery se quedaba
  esperando).
- Ticket hijo del evento masivo: se busca en el departamento del ticket padre (el widget jQuery leía
  `result.departmentId` de una lista, que siempre era `undefined`). **Alquiler de equipo** se envía según el
  contrato (el widget jQuery asignaba en vez de comparar y siempre enviaba `true`). "Afectación del servicio" del
  ticket padre muestra el valor real (antes siempre "Si").
- "Restablecer configuración": el registro del canal solo se ofrece si el comando se envió bien.
- Asistencia remota: se envían `customer_email` y `type` a Zoho Assist como parámetros (el widget jQuery los
  ponía en `parameters`, que `ZOHO.CRM.HTTP` ignora).
- **Por confirmar con Netuno:**
  - El reporte a node-red envía "Sin conexión" también para intermitencia y lentitud (así lo hace el widget
    jQuery; alimenta el cálculo de posibles eventos masivos, por eso no se cambió).
  - El token de Zoho Assist se pide a `studio.aivo.co/api/macarena/accesToken` y node-red usa usuario, clave y
    token fijos (ahora en `.env.local`, siguen dentro del código del navegador).

### Historial

Origen: `widgetHistorialV1.1/app/index.js` (`showTab`, `consultas`, `setDataToSections`, `dataFilter`, `applyFilter`,
`verRegistro`, `crearRegistro`, `registrarLog`). Mismas 7 pestañas, columnas, consultas y detalle:

| Pestaña        | Fuente                                                                          |
| -------------- | ------------------------------------------------------------------------------- |
| Atención       | CRM `Cases` del cliente (API v8). Se puede registrar una atención               |
| Tickets        | Desk, por tipo y número de documento (100 más recientes)                        |
| Pagos          | Netuno `notificaciones-pago`, últimos 3 meses                                   |
| Promociones    | Netuno `cliente/promociones`                                                    |
| Cuentas        | CRM `Eventos` del cliente (gestiones de Unidad Comercial)                       |
| Comunicaciones | CRM `Comunicaciones` del cliente. Se puede registrar una comunicación           |
| Consumo        | Netuno, consumo de los últimos 3 meses de cada contrato de Internet y Telefonía |

Diferencias intencionales:

- **Filtros en todas las pestañas** (el widget jQuery solo llenaba los de Atención) y en cascada; un filtro sin
  valores no se muestra. Consumo filtra por contrato en lugar de "Estatus" (el consumo no tiene estatus).
- La columna "Consumo" muestra el total con su unidad (el widget jQuery mostraba la unidad en "Consumo" y el
  total en "Consolidado").
- La descripción y la resolución de los tickets (HTML de Desk) se muestran saneadas.
- **Registrar Comunicación no funcionaba** en el widget jQuery: buscaba el campo "Motivo mensaje" por un id que no
  existía y el envío fallaba. Aquí se envía como `Motivo_mensaje` (**nombre de API por confirmar con Netuno**).
- Negocio se envía como lista (`["Hogar","Empresa"]`); el widget jQuery enviaba `["Hogar;Empresa"]`.
- La fecha de la atención es la local (el widget jQuery mezclaba la fecha UTC con la hora local).
- Los campos obligatorios se validan antes de enviar; sin la espera fija de 5 segundos.
- Sin el límite de 3 actualizaciones por sesión.
- **Registro de conexiones** (Catalyst `connectionlog`): se conserva para cada consulta (`services/registroConexiones.api.ts`,
  clave `VITE_ZCFKEY_CONNECTIONLOG`), pero **sin las cabeceras**: el widget jQuery guardaba `client_id` y
  `client_secret` de Netuno en el log.
- Desk sale del entorno (pruebas: `850539393`). El widget jQuery del sandbox usaba la organización `789982514` con la
  conexión de desarrollo; confirmar cuál corresponde en producción.

### Facturación

Origen: `widgetFacturacionV1.2/app/index.js`, copia de trabajo de la rama `facturacionFase2` (con cambios sin commit).

| Entrega                    | Contenido                                                                                                                                                                                                                                               | Estado     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| F1. Consulta y documentos  | Tarjetas con los datos de facturación, estado de cuenta (filtros, totales, páginas), detalle del documento con visor PDF, descargar y enviar por correo (estado de cuenta y documentos), contactos, domiciliación e histórico de documentos (Zoho Desk) | ✅ v0.13.0 |
| F2. Gestiones de documento | Cargo variable (concepto o materiales), factura manual, reelaboración, nota de débito y nota de crédito (validación en Netuno), todas con ticket en Zoho Desk                                                                                           | ⏳         |

Decisiones del usuario (2026-11-06): Desk de pruebas (`850539393`), Netuno **desarrollo** (`picd`,
`entornos.ts → netuno.hostFacturacion`; producción: `picp`), correo desde `netuno@netuno.net`, y quedan fuera
"Crear ticket" y "Ajuste de factura" (sus botones estaban comentados en el widget jQuery; la pestaña "Documentos no
fiscales" del histórico sigue mostrando los ajustes registrados).

Mejoras y diferencias intencionales (F1):

- **Tarjeta legible (v0.13.1):** primero los pagos, en dos recuadros (último pago con "hace N días"; compromiso de
  pago en ámbar si vence en 5 días o menos y en rojo si venció); los servicios como chips con su nombre legible
  ("400 Megas") a partir de los contratos (el texto `resumenServicios` traía nombres de paquete cortados); moneda con
  nombre ("Dólares ($)"), domiciliación (el chip "Domiciliada · Ver datos" abre sus datos), facturador y nodo en una
  línea secundaria. Acciones con jerarquía: "Estado de cuenta" como principal; Histórico y Contactos, livianas.
- **Estado de cuenta:** filtros en cascada (rango de fechas con calendario nativo, documento y estatus, sin flatpickr),
  totales de abonos y cargos de lo filtrado, saldo de la cuenta, columna "Documento", montos en formato venezolano con
  la moneda de la cuenta (el widget jQuery decía "$" siempre) y 10 movimientos por página.
- Corregido: al filtrar o cambiar de página **se perdía la columna "Ticket"** y los montos quedaban corridos.
- Corregido: un recibo sin número al inicio de la descripción mostraba "Recibo: NaN".
- **Documento:** visor PDF dentro del modal con enlace de respaldo; los de Unidigital y los enlaces http (Netuno
  desarrollo devuelve `http://172.16…`) se abren en otra pestaña porque no se pueden incrustar. Descarga por la
  función `attachmentMule` de Catalyst con un iframe oculto (el widget jQuery cambiaba la página completa).
- **Correo:** las 4 plantillas HTML del widget jQuery (`lib/plantillasCorreo.ts`, generado), vista previa, validación
  de destinatario y CC (varios correos), nombre del cliente escapado y resultado visible (`NOT_ALLOWED` explica que el
  remitente no está habilitado). La plantilla Hogar/Empresa sale del tipo de la cuenta (antes, del primer negocio del
  registro). El asunto de un documento usa su número fiscal (antes, el id interno del movimiento). Se envía por la API
  v8 de CRM desde el módulo del registro.
- **Histórico:** misma tabla de Historial (filtros por cuenta, estatus y mes, detalle con HTML saneado y enlace al
  ticket), cada pestaña se consulta al abrirla. Se quitó la columna "Fecha de aprobación", que repetía la fecha de
  solicitud. El departamento (Cobranzas / Administración de Ventas) se busca por nombre en Desk cuando no está
  configurado (`entornos.ts → desk.departamentos.cob`).
- Registro de conexiones de cada consulta a Netuno, sin cabeceras.

Pendientes de Facturación:

- Netuno desarrollo no tiene movimientos en las cuentas consultadas y su enlace del estado de cuenta es una IP interna
  (`http://172.16.47.116/…`): Catalyst no puede descargarlo y el navegador no lo muestra; en producción los enlaces
  deberían ser públicos (confirmar).
- Producción: organización de Desk y departamentos de Facturación (el widget jQuery usaba `789982514`).

### Contraseñas

Origen: `Netuno-Zoho-CRM-widgetContrasenas/app/index.js`, copia de trabajo de la rama `nuevaFuncionalidad` (incluye
el cambio de correo de NetUno Go, sin commit). Mismas gestiones, cuerpos y textos del evento en CRM:

| Gestión                          | Petición                                                                        | `servicio` |
| -------------------------------- | ------------------------------------------------------------------------------- | ---------- |
| Portal Web interno               | `POST /contrato/contrasena/restablecer` con el correo del cliente               | 3          |
| NetUno Go: contraseña            | Igual, con el correo de acceso (serial del contrato)                            | 1          |
| NetUno Go: control parental      | Igual                                                                           | 2          |
| NetUno Go: cambio de correo      | `POST /contrato/correo/streaming` y `GET /contrato` para confirmarlo            | —          |
| WiFi: nombre, contraseña o ambos | `POST /contrato/contrasena/restablecer` con el contrato; antes, `GET /ont/wifi` | 4          |

Título del widget: **"Gestión de Correo y Contraseña"** (v0.13.2). Las acciones de cada servicio van en columna, una
línea por acción con ícono, nombre y descripción, todas del mismo ancho. Cada servicio muestra su **número de contrato** (`codContrato`, o `idProducto` si
falta) aun cerrado, para guiar al cliente (v0.15.1; opción `mostrarContrato` de `TarjetaCuenta`, apagada en los demás
widgets).

**Solo se muestran los contratos Streaming (NetUno Go)**, como el widget publicado (`dist/widgetContrasenas.zip`).
Las gestiones del WiFi (rama `nuevaFuncionalidad`) están hechas y probadas, pero apagadas:
`contrasenas/lib/contrasenas.ts → GESTION_WIFI_ACTIVA = false`.

Diferencias intencionales:

- Con el WiFi activo, Internet sin WiFi administrable se muestra con un aviso (el widget jQuery lo ocultaba). La ONT se valida al
  desplegar el servicio, no al cargar cada cuenta.
- **Requisitos de la contraseña** visibles mientras se escribe. Se unifican la validación del widget jQuery (sin
  "123", "abc" ni "password") y las reglas que informa la API en el código -2 (8 a 15 caracteres, una mayúscula, un
  número y un carácter especial, sin comillas ni tildes). El widget jQuery pedía otra cosa en su mensaje y en su
  expresión regular.
- Ver la contraseña con un botón (antes, al pasar el cursor). El nombre de la red admite hasta 32 caracteres (límite
  del SSID).
- "Registrar canal de atención" solo aparece si la plataforma aceptó la gestión (el widget jQuery lo abría también
  después de un error) y se puede omitir, como en Unidad Comercial. Tras un error, "Intentar de nuevo" conserva lo
  escrito.
- La fecha del evento es la local (con `toISOString`, después de las 8 p. m. quedaba el día siguiente). Este ajuste
  en `src/shared/canal-atencion` aplica también a las gestiones de Unidad Comercial.
- **Ambientes de Netuno:** restablecer y `ont/wifi` usan el host del entorno (pruebas: QA `picq`). El widget jQuery
  del sandbox enviaba los restablecimientos a **producción** (`picp`) y la consulta de WiFi a desarrollo (`picd`).

Pendientes con Netuno:

- **`/contrato/correo/streaming` solo existe en desarrollo (`picd`)**: QA y producción responden 404 (verificado el
  2026-11-06). Pruebas lo envía a `picd` (`entornos.ts → netuno.hostCorreoStreaming`), aunque las cuentas vienen de
  QA; hay que confirmar que los contratos existen en `picd`. Producción queda apuntando a `picp` hasta que lo publiquen.
- En el cambio de nombre del WiFi, el campo `correo` lleva el serial de la ONT (igual que el widget jQuery):
  confirmar que es lo que espera la API.

### Historial Resumen

Reemplaza el recuadro "Historial (Último registro)" de la pestaña principal del cliente (Canvas), que no tenía
widget detrás y mostraba "-" en todos los campos. Rediseñado (sin visual de la PM):

- Las mismas 7 pestañas y consultas que Historial: la lógica vive en `src/shared/historial` (filas, consultas y
  `usePestanaHistorial`), así un cambio llega a los dos widgets.
- Cada pestaña muestra **el registro más reciente por fecha** (`ultimoRegistro`), con unidad comercial, cuenta,
  fecha ("Hace 2 días"), título, estatus con color, campos clave y la nota (observaciones, descripción o
  comentario). Cada fila trae su `resumen` y su `momento` (fecha en milisegundos) desde `lib/historial.ts`.
- Atención: sin "Asunto" (los registros de `Cases` no tienen ese campo); el título es la categoría.
- Sin "Ver detalle": el resumen basta y un widget no puede cambiar de pestaña en el Canvas. En Tickets, el número
  abre el ticket en Desk.
- Cada pestaña se consulta al abrirla (no se cargan las 7 al entrar a la ficha).

Pendientes de Traslado (igual que en el widget actual):

- **Weezie usa la muestra de Guanare** (`traslado/config.ts → configWeezie.fuente = 'muestra'`). Para la consulta
  real hacen falta credenciales y ambiente confirmados, y `VITE_ZCFKEY_WEEZIE` en `.env.local`.
- Sin NAP ni edificio elegido en el mapa, la **cobertura es simulada** (por el último dígito de la longitud).
- Reglas de asignación de cajas de piso y significado de `bd_adduction_progress`: por confirmar con Netuno
  (`configEdificio`).

## Orden recomendado

1. **Prueba de concepto en Slate** con Diagnóstico ([catalyst-slate.md, paso 6](catalyst-slate.md#paso-6--prueba-de-concepto-con-el-widget-diagnóstico-️)).
   Sin esto no se migra nada.
2. **Resumen + Unidad Comercial (solo lectura).** Comparten cuentas y servicios. Se crea
   `src/shared/cuentas/` con la lógica y las tarjetas de `UnidadComercialReact`, pasadas a TypeScript, y los dos
   módulos la usan. Esto resuelve el problema original: un cambio en las tarjetas llega a los dos widgets.
3. **Contraseñas.** Es pequeño, y su rediseño ya imita el estilo nuevo.
4. **Unidad Comercial: operaciones.** Se trae lo ya migrado (traslado, cambio de plan) y se sigue el plan de
   `widgetUnidadComercial/docs/migracion-react.md` (fase 3).
5. **Historial** y **Facturación.** Antes hay que confirmar con sus autores las organizaciones y departamentos
   de Desk (usan `789982514`).

## Checklist por módulo ("terminado")

- [ ] Todas las funciones del widget anterior inventariadas en este documento, con su origen en el `index.js`.
- [ ] Endpoints agregados a `src/services/` (no URLs sueltas en el módulo).
- [ ] Lógica en `lib/` con pruebas; si se compara con el original, anotar los casos.
- [ ] Datos de prueba en `src/mocks/datosDemo.ts`; el módulo funciona con `npm run dev`.
- [ ] `npm run check` en verde.
- [ ] Probado en el sandbox (Fase3) con datos reales.
- [ ] Diferencias intencionales con el widget anterior documentadas.
- [ ] Un ciclo con usuarios piloto.
- [ ] `estado: 'activo'` en `src/modulos.ts`, widget nuevo en el diseño y widget anterior retirado.

## Hallazgos a resolver durante la migración

- **Organizaciones de Desk mezcladas:** Unidad Comercial `927422496`/`850539393`, Contraseñas `850539393`,
  Facturación e Historial `789982514`. Las conexiones también varían (`zohoouath`, `zohodeskdesarrollo`).
  Todo se centraliza en `src/core/config/entornos.ts`.
- **Versiones de la API de CRM:** Historial usa v2, Facturación v2 y v7. En los módulos nuevos todo pasa a v8 (`crmV8`).
- **Contraseñas** llama a `picd` (desarrollo) para WiFi y correo de streaming, aunque el resto usa `picp`.
  Hay que confirmar qué host corresponde en cada entorno.
- **Facturación** carga `lib/zoho-sdk.js`, que no está en su carpeta.
- **Secretos en el código:** credenciales de Netuno (en los 5 widgets), `ZCFKEY_CatalystConnectionLog`, token de
  PEM y usuario `dashboard`. Ver [arquitectura.md → Seguridad](arquitectura.md#seguridad).
- **Registro de conexiones** (`connectionlog` en Catalyst): Resumen, Facturación e Historial lo usan. Si se
  conserva, va como un servicio compartido en `src/services/`.
