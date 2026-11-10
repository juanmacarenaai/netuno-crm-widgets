/**
 * Baja voluntaria (pestaña de Administrar cuenta). Origen en el widget jQuery (UnidadComercialJS/app/index.js):
 * showTab → bajaVoluntaria (elegibilidad y tarjetas), activeClick/dependencyServices (selección),
 * continueFuncionality → button_modal_bajaVoluntaria (ticket abierto, retención, equipo, formulario),
 * bajaContratos (orden y estado del ticket), noPaquetizado (baja inmediata) y crearTicketAutomaticoBaja.
 */
import type { Contrato, Cuenta } from '@/shared/cuentas';

export const MENSAJES_BAJA = {
  criterios: 'Los datos no cumplen con los criterios de validación. Verifica las reglas del negocio.',
  saldo: 'Cliente cuenta con factura pendiente por cancelar.',
  sinSeleccion: 'No se han seleccionado servicios para la baja voluntaria.',
  noCumple: 'No se cumple con los criterios para la solicitud.',
  ticketAbierto: 'Este cliente ya cuenta con un ticket abierto',
  inmediata: 'Los servicios se desconectarán de forma inmediata al continuar.',
  retencion: '¿Lograste retener al cliente?',
  devolucion: '¿El cliente ha devuelto el equipo?',
} as const;

/** Clases de cliente que pueden dar de baja aunque tengan saldo, y sin dependencias al elegir Internet. */
export const CLASES_ESPECIALES = ['Carrier', 'Carrier Nacional', 'ISPS'] as const;

/** Categoría de Desk de los tickets de baja y estados que cuentan como "ticket abierto". */
export const TICKET_BAJA = {
  categoria: 'Desconexión voluntaria',
  estadosBusqueda: 'Pendiente por aprobación,Desconexión programada',
  tiposAbiertos: ['Open', 'On Hold'],
} as const;

/**
 * Código de motivo de desconexión que se envía a Netuno. En el widget jQuery todas las subcategorías de
 * "Desconexión voluntaria" tienen el valor 18 (apply_subCategory), así que siempre se envía 18.
 */
export const MOTIVO_DESCONEXION = 18;

const minusculas = (valor: unknown) =>
  String(valor ?? '')
    .trim()
    .toLowerCase();

// ── Elegibilidad ────────────────────────────────────────────────────

export type ElegibilidadBaja = { ok: true; conectados: Contrato[] } | { ok: false; mensaje: string };

export function elegibilidadBaja(
  cuenta: Pick<Cuenta, 'descStatusCuenta' | 'saldo' | 'contratos'>,
  registro: Record<string, unknown>,
): ElegibilidadBaja {
  const conectada = cuenta.descStatusCuenta === 'Conectado';
  const conectados = (cuenta.contratos ?? []).filter((c) => minusculas(c.status) === 'conectado');
  // `saldo == 0 || Number(saldo) < 0` del widget jQuery (null no cuenta como 0; "" sí)
  const saldo = cuenta.saldo;
  const saldoAlDia = (saldo !== null && saldo !== undefined && Number(saldo) === 0) || Number(saldo) < 0;
  const especial = (CLASES_ESPECIALES as readonly string[]).includes(String(registro.Clase_de_cliente ?? ''));

  if ((conectada && conectados.length > 0 && saldoAlDia) || (especial && conectada)) {
    return { ok: true, conectados };
  }
  return { ok: false, mensaje: Number(saldo) > 0 ? MENSAJES_BAJA.saldo : MENSAJES_BAJA.criterios };
}

// ── Tarjetas ────────────────────────────────────────────────────────

export interface ServicioBaja {
  contrato: Contrato;
  /** Nombre del servicio: "Internet", "Streaming", "Salud"... */
  servicio: string;
  /** Título de la tarjeta: "600 Megas", "Beneficiario Principal", "NetUnoGO Plus 5"... */
  titulo: string;
  /** Dato que identifica el servicio: plan, correo de NetUnoGO, asegurado, teléfono. */
  detalle: string;
  /** Contrato paquetizado (o sin respuesta): su baja requiere aprobación. */
  aprobacion: boolean;
}

const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();

/** normalizarPaquete de la pestaña de baja (distingue Beneficiario Principal y Adicional). */
export function tituloPaquete(nombrePaquete: unknown): string {
  if (typeof nombrePaquete !== 'string') return '';
  const paquete = nombrePaquete.includes('_') ? (nombrePaquete.split('_')[1] ?? '') : nombrePaquete;
  if (/beneficiario ppal/i.test(paquete)) return 'Beneficiario Principal';
  if (/beneficiario/i.test(paquete)) return 'Beneficiario Adicional';
  const m = /(\d+)\s*(mb|gb)/i.exec(paquete);
  if (m) return `${m[1]} ${m[2]?.toLowerCase() === 'gb' ? 'Gigas' : 'Megas'}`;
  return paquete;
}

/** Nombre y primer apellido del asegurado ("ANA MARIA PEREZ" → "Ana Perez"). */
export function nombreAsegurado(nombreCompleto: unknown): string {
  if (typeof nombreCompleto !== 'string' || !nombreCompleto.trim()) return '';
  const partes = nombreCompleto.trim().split(/\s+/).map(capitalizar);
  if (partes.length === 1) return partes[0] ?? '';
  // Con tres o más palabras se toma la tercera como apellido (tolera nombres compuestos)
  return `${partes[0]} ${partes.length === 2 ? partes[1] : partes[2]}`;
}

export interface Paquetizado {
  contrato?: string;
  esPaquetizado?: unknown;
}

export function serviciosBaja(
  conectados: readonly Contrato[],
  paquetizados: readonly Paquetizado[] | null | undefined,
): ServicioBaja[] {
  return conectados.map((contrato) => {
    const servicio = contrato.nombreServicio;
    let titulo = tituloPaquete(contrato.nombrePaquete);
    let detalle = '';
    if (servicio === 'Salud') detalle = nombreAsegurado(contrato.NombreAseg);
    else if (servicio === 'Internet') detalle = String(contrato.nombrePaquete ?? '');
    else if (servicio === 'Streaming') detalle = capitalizar(String(contrato.serial ?? ''));
    else if (servicio === 'Telefonía') detalle = String(contrato.telefonogpo ?? '');
    else if (servicio === 'Televisión por Cable') {
      titulo = servicio;
      detalle = String(contrato.nombrePaquete ?? '');
    }
    const p = (paquetizados ?? []).find((x) => x.contrato === contrato.idProducto);
    // `esPaquetizado == false` del widget jQuery: sin respuesta se pide aprobación
    const aprobacion = !(p?.esPaquetizado === false || p?.esPaquetizado === 0);
    return { contrato, servicio, titulo, detalle, aprobacion };
  });
}

// ── Selección (dependencyServices) ──────────────────────────────────

export interface SeleccionBaja {
  marcados: boolean[];
  /** Marcados por arrastre: no se pueden desmarcar solos. */
  bloqueados: boolean[];
}

export const seleccionVacia = (cantidad: number): SeleccionBaja => ({
  marcados: Array<boolean>(cantidad).fill(false),
  bloqueados: Array<boolean>(cantidad).fill(false),
});

/**
 * Marca o desmarca un servicio con sus dependencias:
 * - Internet (salvo Empresa y clases especiales): arrastra todos los demás servicios y desmarca otros Internet.
 * - NetUnoGO: arrastra los paquetes de Streaming del mismo correo y desmarca todo lo demás.
 * - Salud "Beneficiario Principal": arrastra los beneficiarios adicionales.
 */
export function alternarBaja(
  servicios: readonly ServicioBaja[],
  seleccion: SeleccionBaja,
  indice: number,
  { internetConDependencias }: { internetConDependencias: boolean },
): SeleccionBaja {
  const s = servicios[indice];
  if (!s || seleccion.bloqueados[indice]) return seleccion;
  const marcar = !seleccion.marcados[indice];
  const marcados = [...seleccion.marcados];
  const bloqueados = [...seleccion.bloqueados];
  marcados[indice] = marcar;

  const fijar = (j: number, valor: boolean, arrastrado: boolean) => {
    marcados[j] = valor;
    bloqueados[j] = arrastrado && valor;
  };

  servicios.forEach((o, j) => {
    if (j === indice) return;
    if (s.servicio === 'Internet' && internetConDependencias) {
      if (o.servicio !== 'Internet') fijar(j, marcar, true);
      else fijar(j, false, false);
    } else if (s.servicio === 'Streaming' && s.titulo.includes('NetUnoGO')) {
      const paqueteDelMismoCorreo =
        o.servicio === 'Streaming' && o.detalle === s.detalle && !o.titulo.includes('NetUnoGO');
      if (paqueteDelMismoCorreo) fijar(j, marcar, true);
      else fijar(j, false, false);
    } else if (s.servicio === 'Salud' && s.titulo.includes('Beneficiario Principal')) {
      if (o.servicio === 'Salud' && o.titulo.includes('Beneficiario Adicional')) fijar(j, marcar, true);
    }
  });
  return { marcados, bloqueados };
}

export const internetConDependencias = (registro: Record<string, unknown>) =>
  !(CLASES_ESPECIALES as readonly string[]).includes(String(registro.Clase_de_cliente ?? '')) &&
  registro.Negocio !== 'Empresa';

// ── Retención y equipo ──────────────────────────────────────────────

export type EquipoBaja = 'No aplica' | 'Equipo propio' | 'Sin equipo propio';

export interface EscenarioBaja {
  retencion: boolean;
  equipo: EquipoBaja;
  /** Serial del equipo alquilado (se precarga en el formulario). */
  serial?: string;
}

export const esEmpresa = (cuenta: Pick<Cuenta, 'descTipoCliente'>) => cuenta.descTipoCliente === 'Empresa';

/**
 * Sin retención, en Hogar: el primer Internet elegido define el equipo. Alquilado ("SI") → hay que preguntar
 * si lo devolvió; propio → "Equipo propio". Sin Internet o en Empresa → "No aplica".
 */
export function equipoSinRetencion(
  cuenta: Pick<Cuenta, 'descTipoCliente'>,
  elegidos: readonly Contrato[],
): { pregunta: true; serial: string } | { pregunta: false; equipo: EquipoBaja } {
  if (esEmpresa(cuenta)) return { pregunta: false, equipo: 'No aplica' };
  const internet = elegidos.find((c) => c.nombreServicio === 'Internet');
  if (!internet) return { pregunta: false, equipo: 'No aplica' };
  if (internet.alquilerEquipo === 'SI') return { pregunta: true, serial: String(internet.serial ?? '') };
  return { pregunta: false, equipo: 'Equipo propio' };
}

export interface DepartamentosBaja {
  atc: string | null;
  ave: string | null;
  ve: string | null;
}

/** Departamento donde se busca un ticket abierto: Hogar → Servicio al cliente; Empresa → Administración de ventas. */
export function departamentoBusqueda(cuenta: Pick<Cuenta, 'descTipoCliente'>, d: DepartamentosBaja) {
  return cuenta.descTipoCliente === 'Hogar'
    ? { id: d.atc, nombre: 'Servicio al cliente' }
    : { id: d.ave, nombre: 'Administración de ventas' };
}

/** Departamento del ticket: como la búsqueda, salvo Empresa con retención → Ventas. */
export function departamentoTicket(
  cuenta: Pick<Cuenta, 'descTipoCliente'>,
  escenario: Pick<EscenarioBaja, 'retencion'>,
  d: DepartamentosBaja,
) {
  if (esEmpresa(cuenta) && escenario.retencion) return { id: d.ve, nombre: 'Ventas' };
  return departamentoBusqueda(cuenta, d);
}

// ── Formulario ──────────────────────────────────────────────────────

export interface FormularioBaja {
  /** Subcategoría de Desk: "Motivo de baja" o "Intención de desconexión". */
  motivo: string;
  estrategia: string;
  serial: string;
  /** "AAAA-MM-DD" */
  fecha: string;
  comentarios: string;
}

export type CampoBaja = keyof FormularioBaja;

/** Campos que se muestran según el escenario. */
export function camposBaja(e: EscenarioBaja) {
  return {
    estrategia: e.retencion,
    serial: !e.retencion && e.equipo === 'Sin equipo propio',
    fecha: !e.retencion && e.equipo !== 'Sin equipo propio',
    comentarios: !e.retencion,
  };
}

export function formularioInicial(e: EscenarioBaja, hoy: string): FormularioBaja {
  return { motivo: '', estrategia: '', serial: e.serial ?? '', fecha: hoy, comentarios: '' };
}

export function validarBaja(
  e: EscenarioBaja,
  f: FormularioBaja,
  hoy: string,
): Partial<Record<CampoBaja, string>> {
  const campos = camposBaja(e);
  const errores: Partial<Record<CampoBaja, string>> = {};
  if (!f.motivo.trim()) {
    errores.motivo = e.retencion
      ? 'La intención de la desconexión no puede estar en blanco'
      : 'Motivo de baja no puede estar en blanco';
  }
  if (campos.estrategia && !f.estrategia.trim()) {
    errores.estrategia = 'Estrategia de retención aplicada no puede estar en blanco';
  }
  if (campos.serial && !f.serial.trim()) errores.serial = 'Serial del equipo no puede estar en blanco';
  if (campos.fecha) {
    if (!f.fecha) errores.fecha = 'Fecha de desconexion no puede estar en blanco';
    else if (f.fecha < hoy) errores.fecha = 'La fecha de desconexión no puede ser anterior a hoy';
  }
  return errores;
}

// ── Contratos y estado del ticket (bajaContratos) ───────────────────

export interface ContratoBajaApi {
  contrato: string;
  cuenta: string;
  codMotDesc: number;
}

const esNetUnoGo = (c: Contrato) =>
  c.nombreServicio === 'Streaming' && String(c.nombrePaquete ?? '').includes('NetUnoGO');
const esSaludPrincipal = (c: Contrato) =>
  c.nombreServicio === 'Salud' && String(c.nombrePaqueteFact ?? '').includes('Beneficiario Principal');

/**
 * Orden en que Netuno da de baja: primero los asociados, después Salud principal, NetUnoGO (si va con Internet)
 * e Internet al final. El widget jQuery conservaba solo el último de cada tipo; aquí se conservan todos.
 */
export function contratosParaBaja(elegidos: readonly Contrato[], cuenta: string | number): ContratoBajaApi[] {
  const normales: Contrato[] = [];
  const salud: Contrato[] = [];
  const streaming: Contrato[] = [];
  const internet: Contrato[] = [];
  for (const c of elegidos) {
    if (c.nombreServicio === 'Internet') internet.push(c);
    else if (esNetUnoGo(c)) streaming.push(c);
    else if (esSaludPrincipal(c)) salud.push(c);
    else normales.push(c);
  }
  const orden = internet.length
    ? [...normales, ...salud, ...streaming, ...internet]
    : [...normales, ...salud, ...streaming];
  return orden.map((c) => ({
    contrato: c.idProducto,
    cuenta: String(cuenta),
    codMotDesc: MOTIVO_DESCONEXION,
  }));
}

/** "Principal" si el primer contrato elegido es un servicio principal; si no, "Secundario". */
export function tipoDeContrato(elegidos: readonly Contrato[]): 'Principal' | 'Secundario' | null {
  const c = elegidos[0];
  if (!c) return null;
  const principal =
    c.nombreServicio === 'Internet' ||
    esNetUnoGo(c) ||
    esSaludPrincipal(c) ||
    c.nombreServicio === 'Telefonía' ||
    c.nombreServicio === 'Televisión por Cable';
  return principal ? 'Principal' : 'Secundario';
}

/** Subproducto de Desk del primer contrato: FTTH/FTTO → "FTTX". */
export function subProducto(elegidos: readonly Contrato[]): string {
  const red = elegidos[0]?.tipoRed;
  if (red === 'FTTH' || red === 'FTTO') return 'FTTX';
  return red ?? '--Ninguna--';
}

export type EstadoTicketBaja = 'Cerrado' | 'Pendiente por aprobación' | 'Desconexión programada';

export interface DecisionBaja {
  estado: EstadoTicketBaja;
  /** Se desconecta en Netuno antes de crear el ticket. */
  bajaInmediata: boolean;
  /** Para el texto del resultado: la baja queda pendiente de aprobación. */
  aprobacion: boolean;
}

export function decidirBaja({
  empresa,
  escenario,
  contieneAprobacion,
  incluyeInternet,
  fecha,
  hoy,
}: {
  empresa: boolean;
  escenario: EscenarioBaja;
  /** Algún contrato elegido está paquetizado. */
  contieneAprobacion: boolean;
  incluyeInternet: boolean;
  /** Fecha de desconexión del formulario (si se mostró). */
  fecha: string | null;
  hoy: string;
}): DecisionBaja {
  const r = (estado: EstadoTicketBaja, bajaInmediata = false, aprobacion = false): DecisionBaja => ({
    estado,
    bajaInmediata,
    aprobacion,
  });
  const futura = Boolean(fecha && fecha > hoy);
  const programadaOInmediata = () => (futura ? r('Desconexión programada') : r('Cerrado', true));

  if (empresa) return escenario.retencion ? r('Cerrado') : r('Pendiente por aprobación', false, true);
  if (!incluyeInternet) {
    if (escenario.retencion) return r('Cerrado', false, contieneAprobacion);
    if (contieneAprobacion) return r('Pendiente por aprobación', false, true);
    return programadaOInmediata();
  }
  if (escenario.equipo === 'Equipo propio') return programadaOInmediata();
  if (escenario.retencion) return r('Cerrado');
  return programadaOInmediata();
}

export function textoResultadoBaja(retencion: boolean, aprobacion: boolean): string {
  if (retencion) return 'Se ha registrado el resultado exitosamente. ¡Buen trabajo!';
  return aprobacion
    ? 'Se ha solicitado la aprobación para la Baja Voluntaria'
    : 'Se ha procesado con éxito la Baja Voluntaria';
}

// ── Ticket de Desk ──────────────────────────────────────────────────

/** Opción del campo "Contratos" del ticket: "Internet: X-Y-123". */
export const etiquetaContratoBaja = (c: Pick<Contrato, 'nombreServicio' | 'idProducto'>) =>
  `${c.nombreServicio}: ${c.idProducto}`;

export interface DatosTicketBaja {
  cuenta: Pick<Cuenta, 'cuenta' | 'descTipoCliente' | 'descCiudad'>;
  registro: Record<string, unknown>;
  elegidos: readonly Contrato[];
  escenario: EscenarioBaja;
  formulario: FormularioBaja;
  decision: DecisionBaja;
  departamentoId: string;
  contactoId: string;
  cuentaDeskId: string;
  agenteId: string | null;
  equipoId: string;
  territorio: string;
  hoy: string;
}

export function ticketBaja(d: DatosTicketBaja): Record<string, unknown> {
  const { registro: r, escenario: e, formulario: f, cuenta } = d;
  const campos = camposBaja(e);
  const empresa = esEmpresa(cuenta);
  const alquiler = e.equipo === 'Sin equipo propio';
  return {
    subject: `AB${String(r.Nro_de_Cliente ?? '')} || CRM || ${e.retencion ? 'Retención' : 'Desconexión voluntaria'}`,
    departmentId: d.departamentoId,
    contactId: d.contactoId,
    accountId: d.cuentaDeskId,
    ...(d.agenteId ? { assigneeId: d.agenteId } : {}),
    teamId: d.equipoId,
    status: d.decision.estado,
    category: TICKET_BAJA.categoria,
    subCategory: f.motivo,
    description: (
      (campos.comentarios ? f.comentarios : '') ||
      (campos.estrategia ? f.estrategia : '') ||
      '-'
    ).trim(),
    email: r.email,
    phone: `${String(r.Codigo_de_Celular ?? '')}-${String(r.Tel_fono_Celular ?? '')}`,
    cf: {
      cf_tipo_de_documento_de_identidad: r.cf_tipo_documento,
      cf_documento_de_identidad: r.cf_documento_de_identidad,
      cf_clase_de_cliente: r.Clase_de_cliente,
      cf_segmentacion: r.Segmentaci_n,
      cf_direccion_1: r.Direcci_n_Corta,
      cf_lista_de_seleccion_1: e.retencion ? 'Retención exitosa' : 'Baja ingresada',
      cf_tipo_cliente: cuenta.descTipoCliente,
      cf_numero_de_cuenta: cuenta.cuenta,
      cf_id_cliente_crm: r.id,
      cf_nombre_de_persona_contacto: empresa ? r.contactTechnologyNames : '',
      cf_numero_de_telefono_persona_contacto: empresa ? r.contactTechnologyPhone : '',
      cf_correo_electronico_persona_contacto: empresa ? r.contactTechnologyEmail : '',
      cf_ciudad: cuenta.descCiudad,
      cf_contratos: d.elegidos.map(etiquetaContratoBaja).join(';'),
      cf_tipo_de_contrato: tipoDeContrato(d.elegidos),
      cf_sub_producto: subProducto(d.elegidos),
      cf_fecha_de_desconexion: campos.fecha && f.fecha ? f.fecha : d.hoy,
      cf_alquiler_de_equipo: alquiler,
      cf_serial_del_equipo: alquiler ? f.serial.trim() : '',
      cf_recepcion_de_equipo: alquiler,
      cf_retencion: e.retencion,
      cf_estrategia_de_retencion: e.retencion ? f.estrategia.trim() : '',
      cf_operacion: d.territorio,
    },
  };
}

export { nombreTerritorio } from '@/services/catalyst.api';

// ── Evento de CRM ───────────────────────────────────────────────────

export const EVENTO_BAJA = {
  nombre: 'Desconexión de servicios',
  registro: 'Desactivación',
  subtipo: 'Desactivación de servicio',
  descripcion: 'Se han desconectado los servicios asociados al cliente',
} as const;

/** Campo Contrato del evento: los números de cada contrato dado de baja, uno por línea. */
export function contratosDelEvento(elegidos: readonly Pick<Contrato, 'codContrato'>[]): string {
  return elegidos
    .map((c) => (String(c.codContrato ?? '').match(/\d+/g) ?? []).join('\n'))
    .filter(Boolean)
    .join('\n');
}
