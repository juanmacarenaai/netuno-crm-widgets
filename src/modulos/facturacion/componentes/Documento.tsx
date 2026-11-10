import { useState, type FormEvent } from 'react';
import { ExternalLink, Eye, FileWarning, Send } from 'lucide-react';
import { mensajeDeError } from '@/core/http/errores';
import type { Cuenta } from '@/shared/cuentas';
import { useZoho } from '@/shared/zoho/contexto';
import { Alerta, Boton, CampoFormulario, CLASE_CONTROL, cn } from '@/ui';
import {
  asuntoInicial,
  contenidoCorreo,
  destinatariosIniciales,
  tipoVisor,
  validarCorreo,
  type DocumentoCorreo,
  type ErroresCorreo,
  type Movimiento,
} from '../lib/facturacion';
import { enviarCorreo, REMITENTE } from '../servicio';

/** PDF del documento dentro del modal, o el motivo por el que se abre aparte. */
export function VisorDocumento({ url, titulo }: { url: string; titulo: string }) {
  const tipo = tipoVisor(url);
  const abrir = (
    <Boton icono={ExternalLink} onClick={() => window.open(url, '_blank', 'noopener')}>
      Abrir documento
    </Boton>
  );
  if (tipo === 'pdf') {
    return (
      <div className="flex flex-col gap-2">
        <object
          data={url}
          type="application/pdf"
          aria-label={titulo}
          className="h-[60vh] min-h-80 w-full rounded-lg border border-gray-200 bg-gray-50"
        >
          <p className="p-6 text-center text-sm text-texto-suave">
            El navegador no puede mostrar el PDF aquí. Usa “Abrir en otra pestaña”.
          </p>
        </object>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 self-end text-xs font-bold text-accion hover:underline"
        >
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" /> Abrir en otra pestaña
        </a>
      </div>
    );
  }
  const mensaje = {
    externo: 'Este documento está en Unidigital y se abre en otra pestaña.',
    inseguro:
      'El enlace del documento no es seguro (http), así que no se puede mostrar dentro del widget. Ábrelo en otra pestaña.',
    invalido: 'El enlace del documento no es válido. Consulte al administrador.',
  }[tipo];
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center">
      <FileWarning aria-hidden="true" className="h-8 w-8 text-gray-400" />
      <p className="max-w-md text-sm text-texto-suave">{mensaje}</p>
      {tipo !== 'invalido' && abrir}
    </div>
  );
}

/** Enviar el estado de cuenta o un documento por correo, con la plantilla del widget jQuery. */
export function EnviarCorreo({
  tipo,
  cuenta,
  movimiento,
  enlace,
}: {
  tipo: DocumentoCorreo;
  cuenta: Cuenta;
  movimiento?: Movimiento;
  enlace: string;
}) {
  const { registro, entidad, idRegistro } = useZoho();
  const iniciales = destinatariosIniciales(registro);
  const [para, setPara] = useState(iniciales.para);
  const [cc, setCc] = useState(iniciales.cc);
  const [asunto, setAsunto] = useState(asuntoInicial(tipo, cuenta, movimiento));
  const [errores, setErrores] = useState<ErroresCorreo>({});
  const [verPrevia, setVerPrevia] = useState(false);
  const [estado, setEstado] = useState<
    { tipo: 'formulario' } | { tipo: 'enviando' } | { tipo: 'resultado'; ok: boolean; mensaje: string }
  >({ tipo: 'formulario' });

  /** Cambia un campo y quita su error. */
  const cambiar = (asignar: (v: string) => void, campo: keyof ErroresCorreo, valor: string) => {
    asignar(valor);
    setErrores((x) => ({ ...x, [campo]: undefined }));
  };

  const cliente = String(registro.Account_Name ?? registro.Nombres ?? '');
  const contenido = contenidoCorreo(tipo, cuenta.descTipoCliente, cliente, enlace);
  const enviando = estado.tipo === 'enviando';

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const encontrados = validarCorreo({ para, cc, asunto });
    setErrores(encontrados);
    if (Object.keys(encontrados).length) return;
    setEstado({ tipo: 'enviando' });
    try {
      const r = await enviarCorreo(entidad, idRegistro, {
        para,
        cc,
        asunto,
        contenido,
        nombreDestinatario: String(registro.Nombres ?? cliente),
      });
      setEstado({ tipo: 'resultado', ...r });
    } catch (error) {
      console.error('Error al enviar el correo:', error);
      setEstado({
        tipo: 'resultado',
        ok: false,
        mensaje: `Error en el envío del correo: ${mensajeDeError(error)}`,
      });
    }
  };

  if (estado.tipo === 'resultado' && estado.ok) {
    return (
      <Alerta tono="exito">
        {estado.mensaje} Destinatario: <strong>{para.trim()}</strong>
        {cc.trim() && ` (copia: ${cc.trim()})`}.
      </Alerta>
    );
  }

  const control = (error?: string) => cn(CLASE_CONTROL, error && 'border-red-400');
  return (
    <form onSubmit={(e) => void enviar(e)} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoFormulario etiqueta="Para" htmlFor="correo-para" requerido error={errores.para}>
          <input
            id="correo-para"
            type="email"
            autoComplete="off"
            value={para}
            disabled={enviando}
            onChange={(e) => cambiar(setPara, 'para', e.target.value)}
            className={control(errores.para)}
          />
        </CampoFormulario>
        <CampoFormulario
          etiqueta="CC"
          htmlFor="correo-cc"
          error={errores.cc}
          ayuda="Varios correos separados por coma."
        >
          <input
            id="correo-cc"
            autoComplete="off"
            value={cc}
            disabled={enviando}
            onChange={(e) => cambiar(setCc, 'cc', e.target.value)}
            className={control(errores.cc)}
          />
        </CampoFormulario>
        <CampoFormulario etiqueta="Asunto" htmlFor="correo-asunto" requerido completo error={errores.asunto}>
          <input
            id="correo-asunto"
            value={asunto}
            disabled={enviando}
            onChange={(e) => cambiar(setAsunto, 'asunto', e.target.value)}
            className={control(errores.asunto)}
          />
        </CampoFormulario>
      </div>
      <p className="text-xs text-texto-suave">
        Se envía desde <strong>{REMITENTE.correo}</strong> con la plantilla de{' '}
        {String(cuenta.descTipoCliente).toUpperCase() === 'EMPRESA' ? 'Empresa' : 'Hogar'}, que incluye el
        enlace del documento.
      </p>
      {verPrevia && (
        <iframe
          title="Vista previa del correo"
          srcDoc={contenido}
          sandbox=""
          className="h-[50vh] w-full rounded-lg border border-gray-200 bg-white"
        />
      )}
      {estado.tipo === 'resultado' && <Alerta tono="error">{estado.mensaje}</Alerta>}
      <div className="flex flex-wrap justify-end gap-2">
        <Boton variante="secundario" icono={Eye} onClick={() => setVerPrevia((v) => !v)} disabled={enviando}>
          {verPrevia ? 'Ocultar vista previa' : 'Vista previa'}
        </Boton>
        <Boton type="submit" icono={Send} cargando={enviando}>
          {enviando ? 'Enviando...' : 'Enviar'}
        </Boton>
      </div>
    </form>
  );
}
