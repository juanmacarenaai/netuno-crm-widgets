import { useState } from 'react';
import { ClipboardList, Send } from 'lucide-react';
import { mensajeDeError } from '@/core/http/errores';
import { Alerta, Boton, CampoFormulario, CLASE_CONTROL, cn, Modal, SeccionFormulario } from '@/ui';
import { CANALES, CATEGORIAS, UNIDADES_COMERCIALES } from '../catalogos';
import {
  ETIQUETAS,
  OBLIGATORIOS,
  subcategoriasDe,
  TITULOS,
  validarRegistro,
  type CampoRegistro,
  type FormularioRegistro,
  type TipoRegistro,
} from '../lib/registros';

/** "Registrar Atención" / "Registrar Comunicación" (crearRegistro del widget jQuery). */
export function RegistrarModal({
  tipo,
  inicial,
  cuentas,
  onRegistrar,
  onCerrar,
}: {
  tipo: TipoRegistro;
  inicial: FormularioRegistro;
  /** Números de cuenta del cliente en Netuno. */
  cuentas: readonly string[];
  onRegistrar: (formulario: FormularioRegistro) => Promise<unknown>;
  onCerrar: () => void;
}) {
  const [f, setF] = useState<FormularioRegistro>(inicial);
  const [errores, setErrores] = useState<Partial<Record<CampoRegistro, string>>>({});
  const [enviando, setEnviando] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);

  const cambiar = <K extends CampoRegistro>(campo: K, valor: FormularioRegistro[K]) => {
    setF((x) => ({ ...x, [campo]: valor, ...(campo === 'categoria' ? { subcategoria: '' } : {}) }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  };

  const enviar = async () => {
    setFalla(null);
    const encontrados = validarRegistro(tipo, f);
    setErrores(encontrados);
    if (Object.values(encontrados).some(Boolean)) return;
    setEnviando(true);
    try {
      await onRegistrar(f);
    } catch (error) {
      console.error('Error al crear el registro:', error);
      setFalla(`Se generó un error en la creación del registro: ${mensajeDeError(error)}`);
      setEnviando(false);
    }
  };

  const requerido = (campo: CampoRegistro) => OBLIGATORIOS[tipo].includes(campo);
  const clase = (campo: CampoRegistro) => cn(CLASE_CONTROL, errores[campo] && 'border-red-400');
  const props = (campo: CampoRegistro) => ({
    etiqueta: campo === 'detalle' && tipo === 'comunicaciones' ? 'Motivo del mensaje' : ETIQUETAS[campo],
    htmlFor: `reg_${campo}`,
    requerido: requerido(campo),
    error: errores[campo],
  });
  const selector = (
    campo: 'cuenta' | 'categoria' | 'subcategoria' | 'canal',
    opciones: readonly string[],
  ) => (
    <CampoFormulario {...props(campo)}>
      <select
        id={`reg_${campo}`}
        className={clase(campo)}
        value={f[campo]}
        disabled={enviando || (campo === 'subcategoria' && !f.categoria)}
        onChange={(e) => cambiar(campo, e.target.value)}
      >
        <option value="">{opciones.length ? 'Seleccione' : 'Sin opciones'}</option>
        {opciones.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </CampoFormulario>
  );

  return (
    <Modal
      abierto
      titulo={TITULOS[tipo]}
      onCerrar={onCerrar}
      ancho="max-w-3xl"
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton icono={Send} cargando={enviando} onClick={() => void enviar()}>
            {enviando ? 'Registrando...' : 'Registrar'}
          </Boton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <SeccionFormulario titulo={tipo === 'atencion' ? 'Atención' : 'Comunicación'} icono={ClipboardList}>
          <CampoFormulario {...props('negocio')} htmlFor={undefined}>
            <div
              id="reg_negocio"
              role="group"
              aria-label="Unidad comercial"
              className={cn(
                'flex gap-4 rounded-lg border border-gray-300 px-3 py-2',
                errores.negocio && 'border-red-400',
              )}
            >
              {UNIDADES_COMERCIALES.map((u) => (
                <label key={u} className="flex items-center gap-1.5 text-[13px] text-gray-700">
                  <input
                    type="checkbox"
                    checked={f.negocio.includes(u)}
                    disabled={enviando}
                    onChange={(e) =>
                      cambiar(
                        'negocio',
                        e.target.checked ? [...f.negocio, u] : f.negocio.filter((x) => x !== u),
                      )
                    }
                  />
                  {u}
                </label>
              ))}
            </div>
          </CampoFormulario>
          {selector('cuenta', cuentas)}

          <CampoFormulario {...props('fecha')}>
            <input
              id="reg_fecha"
              type={tipo === 'atencion' ? 'datetime-local' : 'date'}
              className={clase('fecha')}
              value={f.fecha}
              disabled={enviando}
              onChange={(e) => cambiar('fecha', e.target.value)}
            />
          </CampoFormulario>
          {tipo === 'atencion' ? (
            <>
              {selector('categoria', CATEGORIAS)}
              {selector('subcategoria', subcategoriasDe(f.categoria))}
            </>
          ) : (
            <CampoFormulario {...props('contacto')}>
              <input
                id="reg_contacto"
                className={clase('contacto')}
                value={f.contacto}
                disabled={enviando}
                onChange={(e) => cambiar('contacto', e.target.value)}
              />
            </CampoFormulario>
          )}
          {selector('canal', CANALES)}
          <CampoFormulario {...props('usuario')}>
            <input
              id="reg_usuario"
              className={clase('usuario')}
              value={f.usuario}
              disabled={enviando}
              onChange={(e) => cambiar('usuario', e.target.value)}
            />
          </CampoFormulario>
          <CampoFormulario {...props('detalle')} completo>
            <textarea
              id="reg_detalle"
              rows={3}
              className={clase('detalle')}
              value={f.detalle}
              disabled={enviando}
              onChange={(e) => cambiar('detalle', e.target.value)}
            />
          </CampoFormulario>
        </SeccionFormulario>
        {falla && <Alerta tono="error">{falla}</Alerta>}
      </div>
    </Modal>
  );
}
