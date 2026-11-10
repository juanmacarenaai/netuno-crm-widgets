/**
 * "Registrar Atención" (módulo Cases) y "Registrar Comunicación" (módulo Comunicaciones).
 * Origen: crearRegistro y crearRegistroCRM de widgetHistorialV1.1/app/index.js.
 */
import { SUBCATEGORIAS, UNIDADES_COMERCIALES } from '../catalogos';

export type TipoRegistro = 'atencion' | 'comunicaciones';

export interface FormularioRegistro {
  negocio: string[];
  cuenta: string;
  /** Atención: "AAAA-MM-DDTHH:MM" (fecha y hora). Comunicación: "AAAA-MM-DD". */
  fecha: string;
  categoria: string;
  subcategoria: string;
  contacto: string;
  canal: string;
  usuario: string;
  /** Observaciones (atención) o motivo del mensaje (comunicación). */
  detalle: string;
}

export type CampoRegistro = keyof FormularioRegistro;

export const TITULOS: Readonly<Record<TipoRegistro, string>> = {
  atencion: 'Crear registro de atención',
  comunicaciones: 'Crear registro de comunicación',
};

/** Campos obligatorios de cada formulario (todos menos observaciones / motivo). */
export const OBLIGATORIOS: Readonly<Record<TipoRegistro, readonly CampoRegistro[]>> = {
  atencion: ['negocio', 'cuenta', 'fecha', 'categoria', 'subcategoria', 'canal', 'usuario'],
  comunicaciones: ['negocio', 'cuenta', 'fecha', 'contacto', 'canal', 'usuario'],
};

export const ETIQUETAS: Readonly<Record<CampoRegistro, string>> = {
  negocio: 'Unidad comercial',
  cuenta: 'Cuenta',
  fecha: 'Fecha',
  categoria: 'Categoría',
  subcategoria: 'Subcategoría',
  contacto: 'Contacto',
  canal: 'Canal',
  usuario: 'Usuario',
  detalle: 'Observaciones',
};

const dos = (n: number) => String(n).padStart(2, '0');

/** Fecha local "AAAA-MM-DD" y hora "HH:MM". */
function partesFecha(fecha: Date) {
  return {
    dia: `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`,
    hora: `${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`,
  };
}

export function formularioInicial(
  tipo: TipoRegistro,
  { negocio, usuario, ahora = new Date() }: { negocio: unknown; usuario: string; ahora?: Date },
): FormularioRegistro {
  const { dia, hora } = partesFecha(ahora);
  const unidades = (Array.isArray(negocio) ? negocio : [negocio]).map(String);
  return {
    // Se preseleccionan las unidades comerciales del cliente (campo Negocio de la cuenta)
    negocio: UNIDADES_COMERCIALES.filter((u) => unidades.includes(u)),
    cuenta: '',
    fecha: tipo === 'atencion' ? `${dia}T${hora}` : dia,
    categoria: '',
    subcategoria: '',
    contacto: '',
    canal: '',
    usuario,
    detalle: '',
  };
}

export const subcategoriasDe = (categoria: string) => SUBCATEGORIAS[categoria] ?? [];

export function validarRegistro(
  tipo: TipoRegistro,
  f: FormularioRegistro,
): Partial<Record<CampoRegistro, string>> {
  const errores: Partial<Record<CampoRegistro, string>> = {};
  for (const campo of OBLIGATORIOS[tipo]) {
    const valor = f[campo];
    const vacio = Array.isArray(valor) ? valor.length === 0 : !valor.trim();
    if (vacio) errores[campo] = `${ETIQUETAS[campo]} no puede estar en blanco`;
  }
  if (tipo === 'atencion' && f.subcategoria && !subcategoriasDe(f.categoria).includes(f.subcategoria)) {
    errores.subcategoria = 'La subcategoría no corresponde a la categoría';
  }
  return errores;
}

/**
 * Registro de CRM. Negocio es una lista de selección múltiple (el widget jQuery enviaba ["Hogar;Empresa"]).
 * "Motivo_mensaje" es el nombre de API supuesto del motivo: el widget jQuery buscaba el campo "Motivo mensaje"
 * por un id que no existía y el envío fallaba (pendiente de confirmar con Netuno).
 */
export function registroCrm(
  tipo: TipoRegistro,
  f: FormularioRegistro,
  { registro, documento }: { registro: Record<string, unknown>; documento: string | null },
): { modulo: string; datos: Record<string, unknown> } {
  const comunes = {
    Negocio: f.negocio,
    Cuenta: f.cuenta,
    Canal: f.canal,
    Usuario: f.usuario.trim(),
    Account_Name: registro.id,
    Tipo_de_Documento: registro.cf_tipo_documento,
    Nro_Documento: documento,
  };
  if (tipo === 'atencion') {
    return {
      modulo: 'Cases',
      datos: {
        ...comunes,
        Name: 'Atencion',
        Fecha: `${f.fecha}:00`,
        Categoria: f.categoria,
        Subcategoria: f.subcategoria,
        ...(f.detalle.trim() ? { Observaciones: f.detalle.trim() } : {}),
      },
    };
  }
  return {
    modulo: 'Comunicaciones',
    datos: {
      ...comunes,
      Name: 'Comunicaciones',
      Fecha: f.fecha,
      Contacto: f.contacto.trim(),
      ...(f.detalle.trim() ? { Motivo_mensaje: f.detalle.trim() } : {}),
    },
  };
}
