/**
 * Historial del cliente (lo comparten los widgets Historial e Historial Resumen). Origen: widgetHistorialV1.1/app/index.js (showTab, consultas, setDataToSections,
 * dataFilter, applyFilter, loadPage y verRegistro). Cada pestaña convierte sus registros en filas con las
 * celdas de la tabla, los valores de los 4 filtros y los campos del detalle.
 */

export type IdPestana =
  'atencion' | 'tickets' | 'pagos' | 'promociones' | 'cuentas' | 'comunicaciones' | 'consumo';

export interface Pestana {
  id: IdPestana;
  etiqueta: string;
  columnas: readonly string[];
  /** Etiquetas de los 4 filtros (en el mismo orden que `FilaHistorial.filtros`). */
  filtros: readonly string[];
  /** Título del detalle de un registro. */
  tituloDetalle: string;
  /** La pestaña permite registrar (Atención y Comunicaciones, como el widget jQuery). */
  registrar?: string;
}

export const PESTANAS: readonly Pestana[] = [
  {
    id: 'atencion',
    etiqueta: 'Atención',
    columnas: ['Unidad comercial', 'Cuenta', 'Fecha', 'Categoría', 'Subcategoría', 'Canal', 'Usuario'],
    filtros: ['Unidad comercial', 'Cuenta', 'Categoría', 'Canal'],
    tituloDetalle: 'Información del registro',
    registrar: 'Registrar Atención',
  },
  {
    id: 'tickets',
    etiqueta: 'Tickets',
    columnas: ['Unidad comercial', 'Cuenta', 'Fecha', 'Categoría', 'Subcategoría', 'Nro. Ticket', 'Estatus'],
    filtros: ['Unidad comercial', 'Cuenta', 'Servicio', 'Estatus'],
    tituloDetalle: 'Información del ticket',
  },
  {
    id: 'pagos',
    etiqueta: 'Pagos',
    columnas: [
      'Unidad comercial',
      'Nro. transacción',
      'Cuenta',
      'Canal',
      'Monto',
      'Transacción',
      'Fecha',
      'Estatus',
    ],
    filtros: ['Unidad comercial', 'Cuenta', 'Transacción', 'Estatus'],
    tituloDetalle: 'Información de pagos',
  },
  {
    id: 'promociones',
    etiqueta: 'Promociones',
    columnas: [
      'Unidad comercial',
      'Cuenta',
      'Campaña',
      'Descripción',
      'Fecha de inicio',
      'Fecha de fin',
      'Estatus',
    ],
    filtros: ['Unidad comercial', 'Cuenta', 'Campaña', 'Estatus'],
    tituloDetalle: 'Información de la promoción',
  },
  {
    id: 'cuentas',
    etiqueta: 'Cuentas',
    columnas: ['Unidad comercial', 'Cuenta', 'Canal', 'Registro', 'Fecha', 'Usuario'],
    filtros: ['Unidad comercial', 'Cuenta', 'Registro', 'Canal'],
    tituloDetalle: 'Información del registro',
  },
  {
    id: 'comunicaciones',
    etiqueta: 'Comunicaciones',
    columnas: ['Unidad comercial', 'Cuenta', 'Fecha', 'Contacto', 'Usuario', 'Canal'],
    filtros: ['Unidad comercial', 'Cuenta', 'Contacto', 'Canal'],
    tituloDetalle: 'Información del registro',
    registrar: 'Registrar Comunicación',
  },
  {
    id: 'consumo',
    etiqueta: 'Consumo',
    columnas: ['Unidad comercial', 'Cuenta', 'Servicio', 'Fecha de inicio', 'Fecha de fin', 'Consumo'],
    filtros: ['Unidad comercial', 'Cuenta', 'Servicio', 'Contrato'],
    tituloDetalle: 'Información del registro',
  },
];

/** Registros por página (regByPage del widget jQuery). */
export const POR_PAGINA = 7;

// ── Filas ───────────────────────────────────────────────────────────

export interface CampoDetalle {
  etiqueta: string;
  valor: string;
  /** "html": contenido de Desk (descripción, resolución); se muestra saneado. */
  tipo?: 'html';
  /** Enlace del valor (Nro. Ticket → ticket en Desk). */
  url?: string;
}

export interface FilaHistorial {
  clave: string;
  celdas: string[];
  /** Valores de cada filtro (un registro puede tener varios, p. ej. Negocio de selección múltiple). */
  filtros: string[][];
  detalle: CampoDetalle[];
  /** Fecha del registro en milisegundos, para elegir el más reciente (NaN si no tiene). */
  momento: number;
  /** Vista compacta del registro (widget Historial Resumen). */
  resumen: ResumenRegistro;
}

export interface CampoResumen {
  etiqueta: string;
  valor: string;
  url?: string;
}

export interface ResumenRegistro {
  negocio: string;
  cuenta: string;
  /** Fecha como se muestra ("" si el registro no tiene). */
  fecha: string;
  titulo: string;
  subtitulo?: string;
  estado?: string;
  /** Pares etiqueta/valor; los vacíos no se incluyen. */
  campos: CampoResumen[];
  /** Texto libre (observaciones, descripción, comentario), en un bloque aparte. */
  nota?: CampoResumen;
}

type Datos = Record<string, unknown>;

const SIN_INFORMACION = 'Sin información';

/** Texto de un valor; listas separadas por coma; vacío → "". */
export function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (Array.isArray(valor)) return valor.map(texto).filter(Boolean).join(', ');
  if (typeof valor === 'object') return '';
  return String(valor).trim();
}

/** Valores de filtro: cada elemento de una lista o el texto. */
const valores = (valor: unknown): string[] =>
  Array.isArray(valor) ? valor.map(texto).filter(Boolean) : texto(valor) ? [texto(valor)] : [];

const celda = (valor: unknown) => texto(valor) || '-';
const detalle = (etiqueta: string, valor: unknown, extra: Partial<CampoDetalle> = {}): CampoDetalle => ({
  etiqueta,
  valor: texto(valor) || SIN_INFORMACION,
  ...extra,
});

/** "2026-11-05T10:30:00-04:00" → "05/11/2026". */
export function fechaCorta(valor: unknown): string {
  const [a, m, d] = texto(valor).split('T')[0]?.split('-') ?? [];
  return a && m && d ? `${d}/${m}/${a}` : '';
}

/** "2026-11-05T14:30:00-04:00" → "05-11-2026 2:30 pm" (hora local), como el detalle de Atención. */
export function fechaHora(valor: unknown): string {
  const fecha = new Date(texto(valor));
  if (!texto(valor) || Number.isNaN(fecha.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  const horas = fecha.getHours();
  return `${p(fecha.getDate())}-${p(fecha.getMonth() + 1)}-${fecha.getFullYear()} ${horas % 12 || 12}:${p(fecha.getMinutes())} ${horas >= 12 ? 'pm' : 'am'}`;
}

/** Fecha ISO, "AAAA-MM-DD" (local), "dd/mm/aaaa" o "mm/aaaa" → milisegundos (NaN si no se reconoce). */
export function momento(valor: unknown): number {
  const t = texto(valor);
  if (!t) return Number.NaN;
  if (t.includes('/')) return fechaDePeriodo(t).getTime();
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t}T00:00:00` : t).getTime();
}

interface DatosResumen {
  negocio: unknown;
  cuenta: unknown;
  fecha: string;
  titulo: unknown;
  /** Título cuando el registro no trae el campo principal. */
  tituloPorDefecto: string;
  subtitulo?: unknown;
  estado?: unknown;
  campos: ReadonlyArray<readonly [string, unknown] | CampoResumen>;
  nota?: readonly [string, unknown];
}

function resumen(d: DatosResumen): ResumenRegistro {
  const campos = d.campos
    .map((c) => (Array.isArray(c) ? { etiqueta: c[0], valor: texto(c[1]) } : (c as CampoResumen)))
    .filter((c) => c.valor);
  const nota = d.nota && texto(d.nota[1]) ? { etiqueta: d.nota[0], valor: texto(d.nota[1]) } : undefined;
  return {
    negocio: texto(d.negocio),
    cuenta: texto(d.cuenta),
    fecha: d.fecha,
    titulo: texto(d.titulo) || d.tituloPorDefecto,
    ...(texto(d.subtitulo) && { subtitulo: texto(d.subtitulo) }),
    ...(texto(d.estado) && { estado: texto(d.estado) }),
    campos,
    ...(nota && { nota }),
  };
}

/** Une los valores no vacíos ("Falla técnica · Lentitud"). */
const unir = (separador: string, ...partes: unknown[]) => partes.map(texto).filter(Boolean).join(separador);

export function filaAtencion(r: Datos): FilaHistorial {
  return {
    clave: texto(r.id),
    celdas: [r.Negocio, r.Cuenta, fechaCorta(r.Fecha), r.Categoria, r.Subcategoria, r.Canal, r.Usuario].map(
      celda,
    ),
    filtros: [valores(r.Negocio), valores(r.Cuenta), valores(r.Categoria), valores(r.Canal)],
    detalle: [
      detalle('Negocio', r.Negocio),
      detalle('Cuenta', r.Cuenta),
      detalle('Fecha', fechaHora(r.Fecha)),
      detalle('Categoría', r.Categoria),
      detalle('Subcategoría', r.Subcategoria),
      detalle('Canal', r.Canal),
      detalle('Usuario', r.Usuario),
      detalle('Observaciones', r.Observaciones),
      detalle('Id', r.id),
    ],
    momento: momento(r.Fecha),
    resumen: resumen({
      negocio: r.Negocio,
      cuenta: r.Cuenta,
      fecha: fechaHora(r.Fecha),
      titulo: r.Categoria,
      tituloPorDefecto: 'Atención sin categoría',
      subtitulo: r.Subcategoria,
      campos: [
        ['Canal', r.Canal],
        ['Usuario', r.Usuario],
      ],
      nota: ['Observaciones', r.Observaciones],
    }),
  };
}

export function filaTicket(t: Datos): FilaHistorial {
  const cf = (t.cf ?? {}) as Datos;
  const contacto = (t.contact ?? {}) as { account?: { accountName?: unknown } | null };
  const cuenta = texto(contacto.account?.accountName) || texto(cf.cf_numero_de_cuenta);
  const producto = (t.product ?? null) as { productName?: unknown } | null;
  const asignado = (t.assignee ?? null) as { firstName?: unknown; lastName?: unknown } | null;
  const departamento = (t.department ?? null) as { name?: unknown } | null;
  return {
    clave: texto(t.id),
    celdas: [
      cf.cf_tipo_cliente,
      cuenta,
      fechaCorta(t.createdTime),
      t.category,
      t.subCategory,
      t.ticketNumber,
      t.status,
    ].map(celda),
    filtros: [
      valores(cf.cf_tipo_cliente),
      valores(cuenta),
      valores(producto?.productName),
      valores(t.status),
    ],
    detalle: [
      detalle('Nro. Ticket', t.ticketNumber, { url: texto(t.webUrl) || undefined }),
      detalle('Estatus', t.status),
      detalle('Fecha', fechaCorta(t.createdTime)),
      detalle('Departamento', departamento?.name),
      detalle('Asunto', t.subject),
      producto ? detalle('Producto', producto.productName) : detalle('Contratos', cf.cf_contratos),
      detalle('Categoría', t.category),
      detalle('Subcategoría', t.subCategory),
      detalle(
        'Propietario del ticket',
        asignado ? `${texto(asignado.firstName)} ${texto(asignado.lastName)}` : '',
      ),
      detalle('Descripción', t.description, { tipo: 'html' }),
      detalle('Resolución', t.resolution, { tipo: 'html' }),
    ],
    momento: momento(t.createdTime),
    resumen: resumen({
      negocio: cf.cf_tipo_cliente,
      cuenta,
      fecha: fechaCorta(t.createdTime),
      titulo: t.subject,
      tituloPorDefecto: `Ticket ${texto(t.ticketNumber)}`.trim(),
      subtitulo: unir(' · ', t.category, t.subCategory),
      estado: t.status,
      campos: [
        { etiqueta: 'Nro. Ticket', valor: texto(t.ticketNumber), url: texto(t.webUrl) || undefined },
        ['Departamento', departamento?.name],
        ['Propietario', asignado ? unir(' ', asignado.firstName, asignado.lastName) : ''],
        producto ? ['Producto', producto.productName] : ['Contratos', cf.cf_contratos],
      ],
    }),
  };
}

/** Nro. de transacción: texto u objeto con `idTransCompleto`. */
export function numeroTransaccion(valor: unknown): string {
  if (valor && typeof valor === 'object')
    return texto((valor as { idTransCompleto?: unknown }).idTransCompleto);
  return texto(valor);
}

export function filaPago(p: Datos, indice: number): FilaHistorial {
  const nro = numeroTransaccion(p.nroTransaccion);
  return {
    clave: `${nro}-${indice}`,
    celdas: [p.negocio, nro, p.cuenta, p.canal, p.monto, p.medioPago, p.fecha, p.estatusDescripcion].map(
      celda,
    ),
    filtros: [valores(p.negocio), valores(p.cuenta), valores(p.medioPago), valores(p.estatusDescripcion)],
    detalle: [
      detalle('Negocio', p.negocio),
      detalle('Nro. transacción', nro),
      detalle('Cuenta', p.cuenta),
      detalle('Canal', p.canal),
      detalle('Monto', p.monto),
      detalle('Transacción', p.medioPago),
      detalle('Fecha', p.fecha),
      detalle('Estatus', p.estatusDescripcion),
    ],
    momento: momento(p.fecha),
    resumen: resumen({
      negocio: p.negocio,
      cuenta: p.cuenta,
      fecha: texto(p.fecha),
      titulo: p.medioPago,
      tituloPorDefecto: 'Pago',
      subtitulo: nro && `Transacción ${nro}`,
      estado: p.estatusDescripcion,
      campos: [
        ['Monto', p.monto],
        ['Canal', p.canal],
      ],
    }),
  };
}

export function filaPromocion(p: Datos, indice: number): FilaHistorial {
  return {
    clave: `${texto(p.codPromocion)}-${indice}`,
    celdas: [p.negocio, p.cuenta, p.campana, p.descripcion, p.fechaInicio, p.fechaFin, p.estatus].map(celda),
    filtros: [valores(p.negocio), valores(p.cuenta), valores(p.campana), valores(p.estatus)],
    detalle: [
      detalle('Negocio', p.negocio),
      detalle('Cuenta', p.cuenta),
      detalle('Campaña', p.campana),
      detalle('Descripción', p.descripcion),
      detalle('Fecha de inicio', p.fechaInicio),
      detalle('Fecha de fin', p.fechaFin),
      detalle('Estatus', p.estatus),
      detalle('Comentario', p.comentario),
      detalle('Id', p.codPromocion),
    ],
    momento: momento(p.fechaInicio),
    resumen: resumen({
      negocio: p.negocio,
      cuenta: p.cuenta,
      fecha: texto(p.fechaInicio),
      titulo: p.campana,
      tituloPorDefecto: 'Promoción',
      subtitulo: p.descripcion,
      estado: p.estatus,
      campos: [
        ['Inicio', p.fechaInicio],
        ['Fin', p.fechaFin],
      ],
      nota: ['Comentario', p.comentario],
    }),
  };
}

/** Pestaña "Cuentas": módulo Eventos de CRM (gestiones registradas desde Unidad Comercial). */
export function filaEvento(r: Datos): FilaHistorial {
  return {
    clave: texto(r.id),
    celdas: [r.Negocio, r.Cuenta, r.Canal, r.Registro, fechaCorta(r.Fecha), r.Usuario].map(celda),
    filtros: [valores(r.Negocio), valores(r.Cuenta), valores(r.Registro), valores(r.Canal)],
    detalle: [
      detalle('Negocio', r.Negocio),
      detalle('Cuenta', r.Cuenta),
      detalle('Canal', r.Canal),
      detalle('Registro', r.Registro),
      detalle('Subtipo de registro', r.Subtipo_de_registro),
      detalle('Descripción', r.Descripci_n),
      detalle('Fecha', fechaCorta(r.Fecha)),
      detalle('Usuario', r.Usuario),
      detalle('Id', r.id),
    ],
    momento: momento(r.Fecha),
    resumen: resumen({
      negocio: r.Negocio,
      cuenta: r.Cuenta,
      fecha: fechaCorta(r.Fecha),
      titulo: r.Subtipo_de_registro || r.Registro,
      tituloPorDefecto: 'Gestión',
      subtitulo: r.Subtipo_de_registro ? r.Registro : '',
      campos: [
        ['Canal', r.Canal],
        ['Usuario', r.Usuario],
      ],
      nota: ['Descripción', r.Descripci_n],
    }),
  };
}

export function filaComunicacion(r: Datos): FilaHistorial {
  return {
    clave: texto(r.id),
    celdas: [r.Negocio, r.Cuenta, fechaCorta(r.Fecha), r.Contacto, r.Usuario, r.Canal].map(celda),
    filtros: [valores(r.Negocio), valores(r.Cuenta), valores(r.Contacto), valores(r.Canal)],
    detalle: [
      detalle('Negocio', r.Negocio),
      detalle('Cuenta', r.Cuenta),
      detalle('Fecha', fechaCorta(r.Fecha)),
      detalle('Contacto', r.Contacto),
      detalle('Usuario', r.Usuario),
      detalle('Canal', r.Canal),
      detalle('Motivo', r.Motivo_mensaje),
      detalle('Id', r.id),
    ],
    momento: momento(r.Fecha),
    resumen: resumen({
      negocio: r.Negocio,
      cuenta: r.Cuenta,
      fecha: fechaCorta(r.Fecha),
      titulo: r.Motivo_mensaje,
      tituloPorDefecto: 'Comunicación',
      campos: [
        ['Contacto', r.Contacto],
        ['Canal', r.Canal],
        ['Usuario', r.Usuario],
      ],
    }),
  };
}

export function filaConsumo(c: Datos, indice: number): FilaHistorial {
  const consumo = [texto(c.consumoTotal), texto(c.unidadMedida)].filter(Boolean).join(' ');
  return {
    clave: `${texto(c.contrato)}-${texto(c.fechaInicioPeriodo)}-${indice}`,
    celdas: [c.tipoNegocio, c.cuenta, c.nombreServicio, c.fechaInicioPeriodo, c.fechaFinPeriodo, consumo].map(
      celda,
    ),
    filtros: [valores(c.tipoNegocio), valores(c.cuenta), valores(c.nombreServicio), valores(c.contrato)],
    detalle: [
      detalle('Negocio', c.tipoNegocio),
      detalle('Cuenta', c.cuenta),
      detalle('Nombre del servicio', c.nombreServicio),
      detalle('Contrato', c.contrato),
      detalle('Fecha de inicio', c.fechaInicioPeriodo),
      detalle('Fecha de fin', c.fechaFinPeriodo),
      detalle('Unidad de medida', c.unidadMedida),
      detalle('Consumo', c.consumoTotal),
    ],
    momento: momento(c.fechaInicioPeriodo),
    resumen: resumen({
      negocio: c.tipoNegocio,
      cuenta: c.cuenta,
      fecha: texto(c.fechaInicioPeriodo),
      titulo: consumo,
      tituloPorDefecto: 'Sin consumo registrado',
      subtitulo: unir(' · ', c.nombreServicio, texto(c.contrato) && `Contrato ${texto(c.contrato)}`),
      campos: [['Periodo', unir(' al ', c.fechaInicioPeriodo, c.fechaFinPeriodo)]],
    }),
  };
}

/** Tickets con fecha, del más reciente al más antiguo (como el widget jQuery). */
export function ordenarTickets(tickets: readonly Datos[]): Datos[] {
  return tickets
    .filter((t) => t.createdTime)
    .sort((a, b) => new Date(texto(b.createdTime)).getTime() - new Date(texto(a.createdTime)).getTime());
}

// ── Filtros y páginas ───────────────────────────────────────────────

/** Selección de los 4 filtros: "" = Todos. */
export type Seleccion = readonly string[];
export const SIN_FILTROS: Seleccion = ['', '', '', ''];

export function filtrar(filas: readonly FilaHistorial[], seleccion: Seleccion): FilaHistorial[] {
  return filas.filter((f) => seleccion.every((valor, i) => !valor || (f.filtros[i] ?? []).includes(valor)));
}

/**
 * Opciones de cada filtro según las filas que quedan con la selección actual (como dataFilter), más el valor
 * elegido para que siempre se vea.
 */
export function opcionesFiltros(filas: readonly FilaHistorial[], seleccion: Seleccion): string[][] {
  const visibles = filtrar(filas, seleccion);
  return seleccion.map((elegido, i) => {
    const valoresUnicos = new Set<string>();
    for (const f of visibles) for (const v of f.filtros[i] ?? []) valoresUnicos.add(v);
    if (elegido) valoresUnicos.add(elegido);
    return [...valoresUnicos];
  });
}

export const totalPaginas = (cantidad: number) => Math.max(1, Math.ceil(cantidad / POR_PAGINA));

export const pagina = <T>(lista: readonly T[], numero: number): T[] =>
  lista.slice(numero * POR_PAGINA, (numero + 1) * POR_PAGINA);

// ── Último registro (Historial Resumen) ────────────────────────────

/** El registro con la fecha más reciente; con fechas iguales, el primero de la lista. */
export function ultimoRegistro(filas: readonly FilaHistorial[]): FilaHistorial | undefined {
  let ultimo: FilaHistorial | undefined;
  for (const fila of filas) {
    if (!ultimo) ultimo = fila;
    else if (fila.momento > ultimo.momento || (Number.isNaN(ultimo.momento) && !Number.isNaN(fila.momento)))
      ultimo = fila;
  }
  return ultimo;
}

const DIA = 86_400_000;
const inicioDelDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Hoy", "Ayer", "Hace 5 días", "Hace 2 meses", "En 3 días"... ("" sin fecha). */
export function haceCuanto(ms: number, hoy = new Date()): string {
  if (Number.isNaN(ms)) return '';
  const dias = Math.round((inicioDelDia(hoy) - inicioDelDia(new Date(ms))) / DIA);
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias === -1) return 'Mañana';
  if (dias < 0) return `En ${plural(-dias, 'día', 'días')}`;
  if (dias < 31) return `Hace ${plural(dias, 'día', 'días')}`;
  if (dias < 365) return `Hace ${plural(Math.floor(dias / 30), 'mes', 'meses')}`;
  return `Hace ${plural(Math.floor(dias / 365), 'año', 'años')}`;
}

export type TonoEstado = 'exito' | 'aviso' | 'error' | 'neutro';

/** Color del estatus de un ticket, pago o promoción. */
export function tonoEstado(estado: string): TonoEstado {
  const e = estado.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/rechaz|vencid|anulad|cancelad|fallid|inactiv|suspendid/.test(e)) return 'error';
  if (/pendiente|revision|abiert|proceso|espera|nuevo/.test(e)) return 'aviso';
  if (/aplicad|vigente|cerrad|resuelt|activ|aprobad|complet|exitos|pagad/.test(e)) return 'exito';
  return 'neutro';
}

// ── Fechas de consulta ──────────────────────────────────────────────

const dos = (n: number) => String(n).padStart(2, '0');

/** Últimos 3 meses para Pagos: "dd/mm/aaaa". */
export function rangoPagos(hoy = new Date()): { desde: string; hasta: string } {
  const inicio = new Date(hoy);
  inicio.setMonth(inicio.getMonth() - 3);
  const f = (d: Date) => `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
  return { desde: f(inicio), hasta: f(hoy) };
}

/** Últimos 3 meses para Consumo: "MM/aaaa". */
export function rangoConsumo(hoy = new Date()): { desde: string; hasta: string } {
  const inicio = new Date(hoy);
  inicio.setMonth(inicio.getMonth() - 3);
  const f = (d: Date) => `${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
  return { desde: f(inicio), hasta: f(hoy) };
}

/** "dd/mm/aaaa" o "mm/aaaa" (día 1) → fecha. */
export function fechaDePeriodo(valor: unknown): Date {
  const partes = texto(valor).split('/');
  if (partes.length === 3) return new Date(`${partes[2]}-${partes[1]}-${partes[0]}T00:00:00`);
  if (partes.length === 2) return new Date(`${partes[1]}-${partes[0]}-01T00:00:00`);
  return new Date(texto(valor));
}

/** Consumos ordenados por cercanía de su fecha de inicio a hoy (como el widget jQuery). */
export function ordenarConsumo<T extends { fechaInicioPeriodo?: unknown }>(
  lista: readonly T[],
  hoy = new Date(),
): T[] {
  const distancia = (c: T) => Math.abs(fechaDePeriodo(c.fechaInicioPeriodo).getTime() - hoy.getTime());
  return [...lista].sort((a, b) => distancia(a) - distancia(b));
}
