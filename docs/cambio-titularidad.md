# Cambio de titularidad

Gestión de **Administrar cuenta** (Unidad Comercial) que transfiere uno o varios contratos de un cliente a un
nuevo titular. No existía en el widget jQuery: se construye desde el diseño de la PM.

- **Código:** `src/modulos/unidad-comercial/cambio-titularidad/`
- **Estado (v0.15.3):** la visual está completa y funciona en **modo demostración**. Los servicios todavía no están
  conectados (ver [Servicios](#servicios)).

## Origen: prototipo de la PM

- Prototipo: <https://shiny-proof-76728071.figma.site/> ("CRM NETUNO Ventas", hecho en Figma Make).
- Ruta dentro del prototipo: **Clientes → ANTONIO JOSE BUSTILLO → Unidad Comercial (ícono de la barra lateral) →
  Administrar cuenta → Cambio titularidad**.
- El código del prototipo está en `ClientesView.tsx`: el componente del flujo, los datos de documentos por unidad
  comercial, los motivos, los canales y la Cronología.
- Capturas de referencia (tomadas el 2026-11-10) en [`docs/diseno/cambio-titularidad/`](diseno/cambio-titularidad):

| Captura                                                                                  | Contenido                                              |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [0-ubicacion](diseno/cambio-titularidad/0-ubicacion.png)                                 | Dónde está la pestaña dentro de Administrar cuenta     |
| [1-registro](diseno/cambio-titularidad/1-registro.png)                                   | Registro de solicitud con el saldo verificado          |
| [2-nuevo-titular](diseno/cambio-titularidad/2-nuevo-titular.png)                         | Datos del nuevo titular (persona natural)              |
| [3-servicios](diseno/cambio-titularidad/3-servicios.png)                                 | Servicios transferidos, NetunoGo y Salud               |
| [4-documentos-y-vista-previa](diseno/cambio-titularidad/4-documentos-y-vista-previa.png) | Documentos requeridos y vista previa de acciones       |
| [5-aprobacion](diseno/cambio-titularidad/5-aprobacion.png)                               | Seguimiento: pendiente de aprobación                   |
| [6-firma](diseno/cambio-titularidad/6-firma.png)                                         | Seguimiento: contrato enviado por Zoho Sign            |
| [7-completada](diseno/cambio-titularidad/7-completada.png)                               | Seguimiento: completada                                |
| [8-cronologia](diseno/cambio-titularidad/8-cronologia.png)                               | Cronología del cliente con los eventos de la solicitud |

## Flujo

### A. Formulario del asesor

Los cinco pasos forman un **acordeón** (v0.15.3) para evitar el scroll largo:

- Hay un solo paso abierto a la vez. Los siguientes se ven cerrados, con candado, hasta completar el anterior.
- Cada paso termina con **Continuar**, que se habilita cuando el paso está completo, cierra ese paso y abre el
  siguiente.
- Un paso cerrado muestra en su cabecera un check verde y un resumen de lo que se llenó (contratos y motivo,
  nombre y documento del nuevo titular, servicios, documentos cargados). Se puede reabrir con un clic.
- Si un cambio deshace un paso (por ejemplo, se desmarca el contrato), los siguientes vuelven a bloquearse. Lo
  que ya se había llenado se conserva.

1. **Registro de solicitud**
   - Contratos a transferir. Entran todos los de la cuenta **excepto Streaming y Salud**, y solo los Conectado se
     pueden marcar. En Empresa se puede transferir una parte de los contratos.
   - Motivo: Venta de inmueble, Alquiler, Herencia, Cesión empresarial, Cambio de razón social u Otro.
   - Canal de origen: SAC Oficina, SAC Telefónico, BRUNO o Ejecutivo de cuenta.
   - Observaciones.
   - Al marcar el primer contrato se verifica el saldo. El flujo se **bloquea** si la cuenta tiene deuda
     (no se aplican condonaciones ni notas de crédito) o si no está Conectado. La deuda nunca pasa al nuevo titular.
2. **Datos del nuevo titular** ("formulario de prospecto")
   - OCR de la foto de la cédula o del RIF, que completa los campos.
   - Tipo de documento y número, con **Validar duplicados**: el documento debe ser distinto al del titular actual
     y no pertenecer a otro cliente activo en CRM ni en BOSS.
   - Persona natural (Hogar): nombres, apellidos, fecha de nacimiento y sexo (lo exige Salud).
   - Persona jurídica (Empresa): razón social, fecha de constitución, representante legal y su cédula, atributo
     fiscal (Normal, Exonerado IVA o Exterior), contribuyente especial SENIAT (sí/no) y dirección fiscal.
   - Contacto: correo (recibe el contrato por Zoho Sign), teléfono o WhatsApp y preferencia de contacto.
3. **Servicios transferidos**
   - Se heredan en solo lectura la dirección, el GPS, el plan, el serial ONT y, en Empresa, las IP fijas.
   - No hay visita técnica ni costo de instalación.
   - Opcionales: **NetunoGo**, con un correo nuevo y único (Validar unicidad), y **Salud**, con hasta 3
     beneficiarios más el titular (nombre, documento, fecha de nacimiento, sexo y parentesco). Solo se ofrecen si
     la cuenta tiene esos servicios conectados.
4. **Documentos requeridos** según la unidad comercial:
   - **Hogar:** cédula del nuevo titular (ambas caras, JPG o PDF) y carta de cesión, autorización o poder
     firmada por el titular anterior.
   - **Empresa:** RIF vigente del nuevo titular, copia del RIF actual y del nuevo, acta constitutiva, registro
     mercantil o acta de cesión, y cédula del representante legal.
5. **Vista previa de acciones** con las tarjetas titular anterior → nuevo titular, los 5 pasos que siguen y el
   botón **Enviar a aprobación**.

### B. Seguimiento de la solicitud

Estados: En validación → Pendiente de aprobación → Pendiente de firma → En ejecución → Completada (o Rechazada).

| Estado     | Qué pasa                                                                                                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Validación | Se repiten las validaciones: saldo cero, documento sin duplicados, correo NetunoGo único y documentos completos                                                                                                                                                    |
| Aprobación | La solicitud llega a la bandeja del Supervisor comercial / Administración de Ventas. Si la aprueba, se genera el contrato del nuevo titular                                                                                                                        |
| Firma      | El contrato se envía por **Zoho Sign** al correo del nuevo titular. Hay un recordatorio a las 48 h y la solicitud vence si no se firma. La cuenta en BOSS se crea **solo después** de la firma                                                                     |
| Ejecución  | En **BOSS** (Mulesoft): crear el cliente y la cuenta nuevos; migrar los servicios con el mismo serial ONT (y las mismas IP fijas en Empresa); desconectar al titular anterior con el motivo "Cambio de titularidad"; activar NetunoGo y Salud con los datos nuevos |
| Error BOSS | La solicitud sigue En ejecución y el titular anterior **no** se desconecta. Se alerta al agente, al supervisor y a TI, y la ejecución se puede reintentar                                                                                                          |
| Completada | Nuevo cliente con la referencia "Proviene de cambio de titularidad". El titular anterior queda **Desconectado por cambio de titularidad** (no cuenta como baja). La facturación del nuevo titular empieza el día 1 del mes siguiente, sin prorrateo                |
| Rechazada  | Por documentación inválida o por firma vencida: el titular anterior conserva sus servicios                                                                                                                                                                         |

- La solicitud, el contrato firmado y los documentos quedan en la **Cronología de ambos clientes**, con referencia
  cruzada "Proviene de" / "Transferido a".
- El histórico y los pagos permanecen en el titular anterior.

## Implementación

| Archivo                                  | Contenido                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `lib/cambioTitularidad.ts` (+ pruebas)   | Reglas puras: contratos transferibles, elegibilidad, campos obligatorios, documentos, facturación y acciones  |
| `servicio.ts`                            | Servicios **simulados** (`SERVICIOS_SIMULADOS = true`); cada función documenta qué servicio real la reemplaza |
| `CambioTitularidad.tsx`                  | Estado del flujo, bloques progresivos y seguimiento                                                           |
| `componentes/RegistroSolicitud.tsx`      | Bloque 1 y mensajes de saldo                                                                                  |
| `componentes/DatosNuevoTitular.tsx`      | Bloque 2 (OCR, duplicados, persona natural o jurídica y contacto)                                             |
| `componentes/ServiciosTransferidos.tsx`  | Bloque 3 (datos heredados, NetunoGo y Salud)                                                                  |
| `componentes/DocumentosYVistaPrevia.tsx` | Bloques 4 y 5                                                                                                 |
| `componentes/Seguimiento.tsx`            | Estados, firma, ejecución, resultado e historial de la solicitud                                              |
| `componentes/Piezas.tsx`                 | Bloque con cabecera oscura, tarjetas titular anterior → nuevo, alerta de carga                                |

Diferencias con el prototipo:

- **Contratos reales:** los datos salen de `/cuentas` (Netuno), no de una lista fija. Los contratos que no están
  Conectado se muestran deshabilitados con su estado.
- **Selectores de archivo reales:** el OCR y los documentos abren el selector de archivos. En demostración el OCR
  devuelve datos de prueba y el documento queda con el nombre del archivo elegido.
- **Modo demostración visible:**
  - Un aviso arriba indica que no se registra nada en CRM, Desk ni BOSS.
  - Los botones "Simular…" del prototipo se agruparon en un recuadro morado de demostración (aprobar o rechazar,
    firma o firma vencida, error de BOSS).
  - Ese recuadro desaparece cuando `SERVICIOS_SIMULADOS` pasa a `false`.
- **Pasos del seguimiento:** se agregó un indicador de etapas (Registrada → Aprobación → Firma → Ejecución en BOSS →
  Completada).
- **Historial de la solicitud:** se muestra dentro de la gestión, porque Unidad Comercial no tiene la pestaña
  Cronología del prototipo. Dónde se registra cada evento se define junto con los servicios.
- **Sin avisos de "pendiente" (v0.14.1, a pedido del usuario):** el prototipo mostraba avisos ámbar desde el
  inicio ("Seleccione al menos un contrato…", "Complete los datos obligatorios…", "Valide el correo NetunoGo…",
  "No se puede continuar sin todos los documentos…"). Se quitaron: el paso siguiente se habilita cuando el anterior
  está completo, y el botón de validación pendiente ("Validar duplicados", "Validar unicidad") se resalta como botón
  principal. Se conservan los mensajes de resultado (saldo verificado, bloqueos, documento o correo rechazado) y
  el contador de documentos (0/2 → 2/2).

## Servicios

Todos están pendientes. Netuno los irá entregando y se conectan uno a uno en `servicio.ts`.

| Función de `servicio.ts` | Qué hace                                                               | Servicio real                                                                                         | Estado                                                |
| ------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `verificarSaldo`         | Saldo cero, cuenta Conectado y sin otro cambio de titularidad en curso | Saldo en BOSS (Mulesoft) y solicitudes en curso                                                       | 🔶 Usa estado y saldo de `/cuentas`; falta "en curso" |
| `leerDocumentoOcr`       | Lee la cédula o el RIF y completa los campos                           | OCR del registro de prospectos (por confirmar)                                                        | ⏳ Simulado                                           |
| `validarDocumentoNuevo`  | Documento distinto al actual y sin cliente activo                      | Búsqueda en CRM + `/cuentas?cedularif` de Netuno                                                      | ⏳ Simulado (solo compara con el titular actual)      |
| `validarCorreoNetunoGo`  | Correo nuevo y no asociado a otro contrato NetunoGo                    | Endpoint de Netuno (por confirmar)                                                                    | ⏳ Simulado (solo compara con los correos actuales)   |
| `subirDocumento`         | Guarda cada documento requerido                                        | Por definir: adjuntos de CRM, WorkDrive o Catalyst (`uploadFile` tiene el problema de CORS)           | ⏳ Simulado                                           |
| `enviarSolicitud`        | Registra la solicitud y la envía a aprobación                          | Por definir: ticket de Desk "Por aprobar" o registro de CRM con proceso de aprobación                 | ⏳ Simulado                                           |
| (estado de la solicitud) | Aprobación, Zoho Sign y ejecución en BOSS                              | Lectura del estado; el servicio de BOSS de Ingeniería NETUNO está comprometido para el **30/11/2026** | ⏳ En demostración lo cambian los controles           |

Al conectar un servicio:

1. Reemplazar el cuerpo de la función en `servicio.ts`, conservando su firma.
2. Actualizar esta tabla.
3. Cuando estén todos, poner `SERVICIOS_SIMULADOS = false`. Desaparecen el aviso y los controles de demostración y
   se apagan los avances automáticos del seguimiento.
4. Llamar a `onCompletado` al terminar la ejecución real, para refrescar las cuentas.

## Pruebas

- Unitarias: `lib/cambioTitularidad.test.ts`.
- Datos simulados (`src/mocks/datosDemo.ts`):
  - **9000001** (Hogar con NetunoGo): flujo completo.
  - **9000004** (Hogar con Salud): beneficiarios.
  - **9000005** (Empresa, saldo cero, 2 Internet y troncal SIP): persona jurídica.
  - **9000002** (deuda): bloqueo por saldo.
