/**
 * Cambio de titularidad (pestaña de Administrar cuenta): reglas y datos del flujo, según el diseño de la PM
 * (prototipo "CRM NETUNO Ventas" en Figma, ClientesView.tsx). Ver docs/cambio-titularidad.md.
 *
 * Lógica pura: sin React ni llamadas a servicios (esos están en ../servicio.ts).
 */
import {
  estadoSaldo,
  estaConectado,
  nombreServicioLegible,
  numeroContrato,
  SIN_DATOS,
} from '@/shared/cuentas';
import type { Contrato, Cuenta, UbicacionContrato } from '@/shared/cuentas';
import { correoValido } from '@/shared/lib/correo';

export type UnidadComercial = 'Hogar' | 'Empresa';

export const unidadDeCuenta = (cuenta: Pick<Cuenta, 'descTipoCliente'>): UnidadComercial =>
  cuenta.descTipoCliente === 'Empresa' ? 'Empresa' : 'Hogar';

// ── Registro de la solicitud ────────────────────────────────────────────────────────────────────

export const MOTIVOS_TITULARIDAD = [
  'Venta de inmueble',
  'Alquiler',
  'Herencia',
  'Cesión empresarial',
  'Cambio de razón social',
  'Otro',
] as const;

export const CANALES_ORIGEN = ['SAC Oficina', 'SAC Telefónico', 'BRUNO', 'Ejecutivo de cuenta'] as const;

export const motivoInicial = (unidad: UnidadComercial) =>
  unidad === 'Empresa' ? 'Cambio de razón social' : 'Venta de inmueble';

export const AYUDA_CONTRATOS: Record<UnidadComercial, string> = {
  Hogar: 'Seleccione el contrato o los contratos que pasan al nuevo titular.',
  Empresa:
    'En Empresa puede transferir todos o una parte de los contratos; los no seleccionados permanecen con el titular actual.',
};

/** Servicios que no se transfieren como contrato: se vuelven a activar con los datos del nuevo titular. */
const SERVICIOS_OPCIONALES = ['Streaming', 'Salud'];

export interface ContratoTransferible {
  idProducto: string;
  /** Código visible del contrato (codContrato o el número del idProducto). */
  codigo: string;
  servicio: string;
  plan: string;
  serial: string | null;
  direccion: string;
  gps: string | null;
  status: string;
  /** Solo se transfieren contratos Conectado. */
  disponible: boolean;
}

function texto(valor: unknown): string | null {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;
  const t = String(valor).trim();
  return t === '' || t === SIN_DATOS ? null : t;
}

/** Dirección del contrato desde ubicacionJSON (texto libre o sus partes). */
export function direccionContrato(contrato: Pick<Contrato, 'ubicacionJSON'>): string {
  const u: UbicacionContrato = contrato.ubicacionJSON?.[0] ?? {};
  const libre = texto(u.direccion);
  if (libre) return libre;
  const partes = [u.urbanizacion, u.avCalle, u.calle, u.edificioCasa, u.ciudad, u.estado]
    .map(texto)
    .filter(Boolean);
  return partes.length ? partes.join(', ') : 'Sin dirección registrada';
}

/** Contratos de la cuenta que pueden pasar al nuevo titular (Internet, Telefonía...). */
export function contratosTransferibles(cuenta: Pick<Cuenta, 'contratos'>): ContratoTransferible[] {
  return (cuenta.contratos ?? [])
    .filter((c) => !SERVICIOS_OPCIONALES.includes(c.nombreServicio))
    .map((c) => {
      const numero = numeroContrato(c.idProducto);
      return {
        idProducto: c.idProducto,
        codigo: c.codContrato ?? (numero === SIN_DATOS ? c.idProducto : numero),
        servicio: c.nombreServicio,
        plan: texto(c.nombrePaqueteFact) ?? (nombreServicioLegible(c) || c.nombreServicio),
        serial: c.nombreServicio === 'Internet' ? texto(c.serial) : null,
        direccion: direccionContrato(c),
        gps: texto(c.coordenadasGps),
        status: c.status ?? SIN_DATOS,
        disponible: estaConectado(c.status),
      };
    });
}

/** Streaming y Salud conectados de la cuenta: se ofrecen como servicios opcionales del nuevo titular. */
export function serviciosOpcionales(cuenta: Pick<Cuenta, 'contratos'>): {
  streaming: Contrato | null;
  salud: Contrato | null;
} {
  const conectados = (cuenta.contratos ?? []).filter((c) => estaConectado(c.status));
  return {
    streaming: conectados.find((c) => c.nombreServicio === 'Streaming') ?? null,
    salud: conectados.find((c) => c.nombreServicio === 'Salud') ?? null,
  };
}

/** Requisito para iniciar: cliente Conectado y saldo cero (la deuda nunca se transfiere). */
export type Elegibilidad =
  { estado: 'apto' } | { estado: 'saldo'; monto: string } | { estado: 'inactivo'; estatus: string };

export function elegibilidadTitularidad(
  cuenta: Pick<Cuenta, 'descStatusCuenta' | 'saldo' | 'descMoneda' | 'monedaPago'>,
): Elegibilidad {
  if (!estaConectado(cuenta.descStatusCuenta)) {
    return { estado: 'inactivo', estatus: cuenta.descStatusCuenta ?? SIN_DATOS };
  }
  const saldo = estadoSaldo(cuenta);
  if (saldo.tipo === 'pendiente') return { estado: 'saldo', monto: saldo.monto };
  return { estado: 'apto' };
}

// ── Datos del nuevo titular ─────────────────────────────────────────────────────────────────────

export const TIPOS_DOCUMENTO: Record<UnidadComercial, readonly string[]> = {
  Hogar: ['Cédula V', 'Cédula E', 'Pasaporte'],
  Empresa: ['RIF-J', 'RIF-G', 'RIF-V'],
};

export const ATRIBUTOS_FISCALES = ['Normal', 'Exonerado IVA', 'Exterior'] as const;
export const PREFERENCIAS_CONTACTO = ['WhatsApp', 'Email', 'Llamada', 'SMS'] as const;
export const SEXOS = ['Femenino', 'Masculino'] as const;

export interface NuevoTitular {
  tipoDocumento: string;
  documento: string;
  // Persona natural
  nombres: string;
  apellidos: string;
  sexo: string;
  // Persona jurídica
  razonSocial: string;
  representante: string;
  cedulaRepresentante: string;
  atributoFiscal: string;
  /** null = sin responder. */
  contribuyenteEspecial: boolean | null;
  direccionFiscal: string;
  /** Nacimiento (natural) o constitución (jurídica), AAAA-MM-DD. */
  fecha: string;
  // Contacto
  correo: string;
  telefono: string;
  preferencia: string;
}

export function nuevoTitularVacio(unidad: UnidadComercial): NuevoTitular {
  return {
    tipoDocumento: TIPOS_DOCUMENTO[unidad][0] ?? '',
    documento: '',
    nombres: '',
    apellidos: '',
    sexo: '',
    razonSocial: '',
    representante: '',
    cedulaRepresentante: '',
    atributoFiscal: 'Normal',
    contribuyenteEspecial: null,
    direccionFiscal: '',
    fecha: '',
    correo: '',
    telefono: '',
    preferencia: 'WhatsApp',
  };
}

export function nombreNuevoTitular(titular: NuevoTitular, unidad: UnidadComercial): string {
  return unidad === 'Empresa'
    ? titular.razonSocial.trim()
    : `${titular.nombres.trim()} ${titular.apellidos.trim()}`.trim();
}

export const soloDigitos = (valor: string) => valor.replace(/\D/g, '');

/** El documento del nuevo titular no puede ser el del titular actual. */
export function documentoDistinto(documento: string, documentoActual: string | null | undefined): boolean {
  const nuevo = soloDigitos(documento);
  return nuevo.length > 0 && nuevo !== soloDigitos(documentoActual ?? '');
}

type CampoTitular = keyof NuevoTitular;

const REQUERIDOS: Record<UnidadComercial, readonly [CampoTitular, string][]> = {
  Hogar: [
    ['documento', 'Nro. documento'],
    ['nombres', 'Nombres'],
    ['apellidos', 'Apellidos'],
    ['fecha', 'Fecha de nacimiento'],
    ['sexo', 'Sexo'],
    ['correo', 'Correo electrónico'],
    ['telefono', 'Teléfono / WhatsApp'],
  ],
  Empresa: [
    ['documento', 'RIF'],
    ['razonSocial', 'Razón social'],
    ['fecha', 'Fecha de constitución'],
    ['representante', 'Representante legal'],
    ['cedulaRepresentante', 'Cédula del representante'],
    ['contribuyenteEspecial', 'Contribuyente especial'],
    ['direccionFiscal', 'Dirección fiscal'],
    ['correo', 'Correo electrónico'],
    ['telefono', 'Teléfono / WhatsApp'],
  ],
};

/** Etiquetas de los campos obligatorios que faltan o no son válidos. */
export function faltantesNuevoTitular(titular: NuevoTitular, unidad: UnidadComercial): string[] {
  const faltan = REQUERIDOS[unidad]
    .filter(([campo]) => {
      const valor = titular[campo];
      return valor === null || (typeof valor === 'string' && valor.trim() === '');
    })
    .map(([, etiqueta]) => etiqueta);
  if (titular.correo.trim() && !correoValido(titular.correo)) faltan.push('Correo electrónico válido');
  return faltan;
}

// ── Servicios opcionales ────────────────────────────────────────────────────────────────────────

/** Salud: hasta 4 personas incluido el titular. */
export const MAX_BENEFICIARIOS = 3;
export const PARENTESCOS = ['Cónyuge', 'Hijo(a)', 'Padre/Madre', 'Otro'] as const;

export interface Beneficiario {
  id: string;
  nombre: string;
  documento: string;
  fechaNacimiento: string;
  sexo: string;
  parentesco: string;
}

export const beneficiarioVacio = (id: string): Beneficiario => ({
  id,
  nombre: '',
  documento: '',
  fechaNacimiento: '',
  sexo: '',
  parentesco: 'Hijo(a)',
});

export const beneficiariosCompletos = (lista: readonly Beneficiario[]) =>
  lista.every((b) => b.nombre.trim() !== '' && b.documento.trim() !== '');

/** El correo de NetunoGo del nuevo titular debe ser nuevo: distinto al del titular actual. */
export function correoNetunoGoAceptable(
  correo: string,
  correosActuales: readonly (string | null | undefined)[],
) {
  const nuevo = correo.trim().toLowerCase();
  return correoValido(nuevo) && !correosActuales.some((c) => (c ?? '').trim().toLowerCase() === nuevo);
}

// ── Documentos ──────────────────────────────────────────────────────────────────────────────────

export interface DocumentoRequerido {
  id: string;
  etiqueta: string;
  ayuda: string;
  /** Tipos de archivo que acepta el selector. */
  acepta: string;
}

const IMAGEN_O_PDF = 'image/jpeg,image/png,application/pdf';

export const DOCUMENTOS_REQUERIDOS: Record<UnidadComercial, readonly DocumentoRequerido[]> = {
  Hogar: [
    {
      id: 'ci_nuevo',
      etiqueta: 'Cédula del nuevo titular',
      ayuda: 'Ambas caras · JPG/PDF',
      acepta: IMAGEN_O_PDF,
    },
    {
      id: 'cesion',
      etiqueta: 'Carta de cesión / autorización o poder',
      ayuda: 'Firmada por el titular anterior',
      acepta: IMAGEN_O_PDF,
    },
  ],
  Empresa: [
    { id: 'rif_nuevo', etiqueta: 'RIF vigente del nuevo titular', ayuda: 'PDF', acepta: 'application/pdf' },
    {
      id: 'rif_ambos',
      etiqueta: 'Copia del RIF actual y del nuevo',
      ayuda: 'PDF',
      acepta: 'application/pdf',
    },
    {
      id: 'registro',
      etiqueta: 'Acta constitutiva / registro mercantil / acta de cesión',
      ayuda: 'PDF',
      acepta: 'application/pdf',
    },
    { id: 'ci_rep', etiqueta: 'Cédula del representante legal', ayuda: 'JPG/PDF', acepta: IMAGEN_O_PDF },
  ],
};

// ── Facturación y seguimiento ───────────────────────────────────────────────────────────────────

/** El nuevo titular factura desde el día 1 del mes siguiente, sin prorrateo (dd/mm/aaaa). */
export function inicioFacturacion(hoy: Date = new Date()): string {
  const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${fecha.getFullYear()}`;
}

export type EstadoSolicitud =
  'validacion' | 'aprobacion' | 'firma' | 'ejecucion' | 'completada' | 'rechazada';

export const ETIQUETA_ESTADO: Record<EstadoSolicitud, string> = {
  validacion: 'En validación',
  aprobacion: 'Pendiente de aprobación',
  firma: 'Pendiente de firma',
  ejecucion: 'En ejecución',
  completada: 'Completada',
  rechazada: 'Rechazada',
};

/** Etapas del seguimiento (el rechazo corta el flujo en la etapa donde ocurre). */
export const ETAPAS_SOLICITUD = [
  'Registrada',
  'Aprobación',
  'Firma',
  'Ejecución en BOSS',
  'Completada',
] as const;

export function indiceEtapa(estado: EstadoSolicitud): number {
  const indices: Record<EstadoSolicitud, number> = {
    validacion: 0,
    aprobacion: 1,
    firma: 2,
    ejecucion: 3,
    completada: 5,
    rechazada: 1,
  };
  return indices[estado];
}

export function pasosEjecucion(unidad: UnidadComercial): string[] {
  return [
    'Crear cliente y cuenta del nuevo titular en BOSS',
    `Migrar servicios (mismo serial ONT${unidad === 'Empresa' ? ' y mismas IP fijas' : ''})`,
    'Desconectar al titular anterior · motivo: Cambio de titularidad',
    'Activar NetunoGo y Salud con los datos nuevos',
  ];
}

export interface AccionPrevista {
  titulo: string;
  detalle: string;
}

/** "Vista previa de acciones" antes de enviar a aprobación. */
export function accionesPrevistas(datos: {
  unidad: UnidadComercial;
  documentos: number;
  correo: string;
  nuevoTitular: string;
  titularActual: string;
  contratos: number;
  facturacion: string;
}): AccionPrevista[] {
  const ip = datos.unidad === 'Empresa' ? ' e IP fijas' : '';
  return [
    {
      titulo: '1 · Aprobación del Supervisor comercial / Administración de Ventas',
      detalle: `La solicitud se envía a la bandeja de aprobación con ${datos.documentos} documentos adjuntos.`,
    },
    {
      titulo: '2 · Contrato del nuevo titular por Zoho Sign',
      detalle: `Firma remota en ${datos.correo}. Mismas condiciones del servicio · Costo de instalación US$ 0,00.`,
    },
    {
      titulo: '3 · Ejecución en BOSS al firmar (Mulesoft)',
      detalle: `Cuenta nueva para ${datos.nuevoTitular} · Migración de ${datos.contratos} contrato(s) con el mismo serial ONT${ip} · ${datos.titularActual} → Desconectado por cambio de titularidad.`,
    },
    {
      titulo: `4 · Facturación desde el ${datos.facturacion}`,
      detalle: 'Día 1 del mes siguiente, sin prorrateo. Histórico y pagos permanecen en el titular anterior.',
    },
    {
      titulo: '5 · Registro en la Cronología de ambos clientes',
      detalle:
        'Solicitud, contrato firmado y documentos, con referencia cruzada "Proviene de" / "Transferido a".',
    },
  ];
}
