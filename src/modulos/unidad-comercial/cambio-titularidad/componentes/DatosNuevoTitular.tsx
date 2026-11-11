import { useRef } from 'react';
import { FileText, ScanLine, UserRound } from 'lucide-react';
import { Alerta, Boton, CampoFormulario, CLASE_CONTROL, cn } from '@/ui';
import {
  ATRIBUTOS_FISCALES,
  PREFERENCIAS_CONTACTO,
  SEXOS,
  TIPOS_DOCUMENTO,
  type NuevoTitular,
  type UnidadComercial,
} from '../lib/cambioTitularidad';
import { AlertaCargando, Bloque, Subtitulo, type Acordeon } from './Piezas';

/** Estado de una verificación contra un servicio (OCR, duplicados, correo NetunoGo). */
export type Verificacion = 'inicial' | 'verificando' | 'ok' | 'rechazado' | 'error';

export function DatosNuevoTitular({
  unidad,
  titular,
  onCambiar,
  documentoActual,
  ocr,
  onEscanear,
  validacionDocumento,
  onValidarDocumento,
  acordeon,
}: {
  unidad: UnidadComercial;
  titular: NuevoTitular;
  onCambiar: (cambios: Partial<NuevoTitular>) => void;
  documentoActual: string;
  ocr: Verificacion;
  onEscanear: (archivo: File) => void;
  validacionDocumento: Verificacion;
  onValidarDocumento: () => void;
  acordeon?: Acordeon;
}) {
  const empresa = unidad === 'Empresa';
  const archivo = useRef<HTMLInputElement>(null);
  const campo = (nombre: keyof NuevoTitular) => ({
    value: String(titular[nombre] ?? ''),
    onChange: (e: { target: { value: string } }) => onCambiar({ [nombre]: e.target.value }),
  });

  return (
    <Bloque
      titulo={`Datos del Nuevo Titular · ${empresa ? 'Persona Jurídica' : 'Persona Natural'}`}
      icono={UserRound}
      insignia="Formulario de prospecto"
      acordeon={acordeon}
    >
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-netuno-500/50 bg-sky-50 px-4 py-3">
        <FileText aria-hidden="true" className="h-5 w-5 shrink-0 text-accion" />
        <div className="min-w-0 flex-1 text-xs">
          <p className="font-bold text-sky-800">
            {empresa ? 'Foto del RIF' : 'Foto de la cédula'} del nuevo titular
          </p>
          <p className="text-[11px] text-sky-700/80">
            El OCR completa los campos automáticamente, igual que en el registro de prospectos.
          </p>
        </div>
        <input
          ref={archivo}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          aria-label={`Foto ${empresa ? 'del RIF' : 'de la cédula'} del nuevo titular`}
          onChange={(e) => {
            const elegido = e.target.files?.[0];
            if (elegido) onEscanear(elegido);
            e.target.value = '';
          }}
        />
        <Boton
          tamano="sm"
          icono={ScanLine}
          cargando={ocr === 'verificando'}
          onClick={() => archivo.current?.click()}
        >
          {ocr === 'ok' ? 'Volver a escanear' : 'Escanear (OCR)'}
        </Boton>
      </div>
      {ocr === 'ok' && <Alerta tono="exito">OCR procesado. Verifique los datos antes de continuar.</Alerta>}
      {ocr === 'error' && (
        <Alerta tono="error">
          No se pudo leer el documento. Intente con otra foto o complete los datos a mano.
        </Alerta>
      )}

      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[150px_1fr_auto]">
        <CampoFormulario etiqueta="Tipo de documento" htmlFor="tit_tipo_doc" requerido>
          <select
            id="tit_tipo_doc"
            className={CLASE_CONTROL}
            value={titular.tipoDocumento}
            onChange={(e) => onCambiar({ tipoDocumento: e.target.value })}
          >
            {TIPOS_DOCUMENTO[unidad].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </CampoFormulario>
        <CampoFormulario etiqueta={empresa ? 'RIF' : 'Nro. documento'} htmlFor="tit_documento" requerido>
          <input
            id="tit_documento"
            className={cn(CLASE_CONTROL, 'font-mono')}
            placeholder={empresa ? 'J-000000000' : 'V-00000000'}
            value={titular.documento}
            onChange={(e) => onCambiar({ documento: e.target.value })}
          />
        </CampoFormulario>
        <Boton
          // Resaltado mientras falta validar: es el paso que habilita el siguiente bloque
          variante={titular.documento.trim() && validacionDocumento !== 'ok' ? 'primario' : 'secundario'}
          cargando={validacionDocumento === 'verificando'}
          disabled={!titular.documento.trim()}
          onClick={onValidarDocumento}
        >
          {validacionDocumento === 'verificando' ? 'Validando…' : 'Validar duplicados'}
        </Boton>
      </div>
      {validacionDocumento === 'verificando' && (
        <AlertaCargando>Buscando el documento en CRM y en BOSS…</AlertaCargando>
      )}
      {validacionDocumento === 'ok' && (
        <Alerta tono="exito">
          Documento válido: distinto al del titular actual y sin registros duplicados en CRM ni BOSS.
        </Alerta>
      )}
      {validacionDocumento === 'rechazado' && (
        <Alerta tono="error">
          <strong>Documento no válido</strong>
          <br />
          El documento coincide con el del titular actual ({documentoActual || 'sin documento'}) o ya existe
          un cliente activo con ese documento.
        </Alerta>
      )}
      {validacionDocumento === 'error' && (
        <Alerta tono="error">No se pudo validar el documento. Intente de nuevo.</Alerta>
      )}

      {empresa ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoFormulario etiqueta="Razón social" htmlFor="tit_razon" requerido>
            <input id="tit_razon" className={CLASE_CONTROL} {...campo('razonSocial')} />
          </CampoFormulario>
          <CampoFormulario etiqueta="Fecha de constitución" htmlFor="tit_fecha" requerido>
            <input id="tit_fecha" type="date" className={CLASE_CONTROL} {...campo('fecha')} />
          </CampoFormulario>
          <CampoFormulario etiqueta="Representante legal" htmlFor="tit_representante" requerido>
            <input
              id="tit_representante"
              className={CLASE_CONTROL}
              placeholder="Nombre y apellido"
              {...campo('representante')}
            />
          </CampoFormulario>
          <CampoFormulario etiqueta="Cédula del representante" htmlFor="tit_ci_rep" requerido>
            <input
              id="tit_ci_rep"
              className={cn(CLASE_CONTROL, 'font-mono')}
              placeholder="V-00000000"
              {...campo('cedulaRepresentante')}
            />
          </CampoFormulario>
          <CampoFormulario etiqueta="Atributo fiscal" htmlFor="tit_atributo" requerido>
            <select id="tit_atributo" className={CLASE_CONTROL} {...campo('atributoFiscal')}>
              {ATRIBUTOS_FISCALES.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </CampoFormulario>
          <CampoFormulario etiqueta="Contribuyente especial (SENIAT)" requerido>
            <div className="flex gap-2" role="radiogroup" aria-label="Contribuyente especial (SENIAT)">
              {(['Sí', 'No'] as const).map((opcion) => {
                const valor = opcion === 'Sí';
                const marcado = titular.contribuyenteEspecial === valor;
                return (
                  <button
                    key={opcion}
                    type="button"
                    role="radio"
                    aria-checked={marcado}
                    onClick={() => onCambiar({ contribuyenteEspecial: valor })}
                    className={cn(
                      'flex-1 rounded-lg border py-2 text-[13px] font-semibold transition-colors',
                      marcado
                        ? 'border-accion bg-sky-50 text-sky-800'
                        : 'border-gray-300 text-gray-500 hover:bg-gray-50',
                    )}
                  >
                    {opcion}
                  </button>
                );
              })}
            </div>
          </CampoFormulario>
          <CampoFormulario
            etiqueta="Dirección fiscal"
            htmlFor="tit_dir_fiscal"
            requerido
            completo
            ayuda="Puede ser distinta a la dirección de servicio."
          >
            <input
              id="tit_dir_fiscal"
              className={CLASE_CONTROL}
              placeholder="Av., Edif., Piso, Ciudad…"
              {...campo('direccionFiscal')}
            />
          </CampoFormulario>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoFormulario etiqueta="Nombres" htmlFor="tit_nombres" requerido>
            <input id="tit_nombres" className={CLASE_CONTROL} {...campo('nombres')} />
          </CampoFormulario>
          <CampoFormulario etiqueta="Apellidos" htmlFor="tit_apellidos" requerido>
            <input id="tit_apellidos" className={CLASE_CONTROL} {...campo('apellidos')} />
          </CampoFormulario>
          <CampoFormulario etiqueta="Fecha de nacimiento" htmlFor="tit_fecha" requerido>
            <input id="tit_fecha" type="date" className={CLASE_CONTROL} {...campo('fecha')} />
          </CampoFormulario>
          <CampoFormulario
            etiqueta="Sexo"
            htmlFor="tit_sexo"
            requerido
            ayuda="Requerido para el servicio Salud."
          >
            <select id="tit_sexo" className={CLASE_CONTROL} {...campo('sexo')}>
              <option value="">— Seleccione —</option>
              {SEXOS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </CampoFormulario>
        </div>
      )}

      <Subtitulo>Contacto</Subtitulo>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CampoFormulario
          etiqueta="Correo electrónico"
          htmlFor="tit_correo"
          requerido
          ayuda="Recibirá el contrato por Zoho Sign."
        >
          <input
            id="tit_correo"
            type="email"
            className={CLASE_CONTROL}
            placeholder="correo@dominio.com"
            {...campo('correo')}
          />
        </CampoFormulario>
        <CampoFormulario etiqueta="Teléfono / WhatsApp" htmlFor="tit_telefono" requerido>
          <input
            id="tit_telefono"
            type="tel"
            className={cn(CLASE_CONTROL, 'font-mono')}
            placeholder="+58 4XX XXXXXXX"
            {...campo('telefono')}
          />
        </CampoFormulario>
        <CampoFormulario etiqueta="Preferencia de contacto" htmlFor="tit_preferencia">
          <select id="tit_preferencia" className={CLASE_CONTROL} {...campo('preferencia')}>
            {PREFERENCIAS_CONTACTO.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </CampoFormulario>
      </div>
    </Bloque>
  );
}
