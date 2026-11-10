import { Mail, ShieldPlus, UserRound } from 'lucide-react';
import { CampoFormulario, CLASE_CONTROL, cn, SeccionFormulario } from '@/ui';
import {
  CODIGOS_CELULAR,
  ESTADOS_CIVILES,
  PARENTESCOS,
  SEXOS,
  SIN_DOCUMENTO,
  TIPOS_DOCUMENTO,
  type CampoError,
  type DatosBeneficiario,
  type ErroresActivacion,
  type FormularioActivacion as Formulario,
  type Requisitos,
} from './lib/activarServicios';

interface Opcion {
  readonly valor: string;
  readonly etiqueta: string;
}

function Selector({
  id,
  valor,
  opciones,
  onCambiar,
  error,
  disabled,
}: {
  id: string;
  valor: string;
  opciones: readonly Opcion[];
  onCambiar: (valor: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      className={cn(CLASE_CONTROL, error && 'border-red-400')}
      value={valor}
      disabled={disabled}
      aria-invalid={Boolean(error)}
      onChange={(e) => onCambiar(e.target.value)}
    >
      <option value="">Seleccione</option>
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.etiqueta}
        </option>
      ))}
    </select>
  );
}

const CODIGOS: readonly Opcion[] = CODIGOS_CELULAR.map((c) => ({ valor: c, etiqueta: c.slice(1) }));

/**
 * Datos que pide la confirmación según el paquete: correo de NetUnoGO, datos del titular de la póliza de
 * Salud que faltan en CRM y, en Salud adicional, el formulario del beneficiario (generarHTMLBeneficiario).
 */
export function FormularioActivacion({
  requisitos,
  formulario: f,
  errores,
  hoy,
  disabled,
  onCambiar,
}: {
  requisitos: Requisitos;
  formulario: Formulario;
  errores: ErroresActivacion;
  /** "AAAA-MM-DD": límite de las fechas de nacimiento. */
  hoy: string;
  disabled?: boolean;
  /** Nuevo formulario y campo editado (para limpiar su error). */
  onCambiar: (formulario: Formulario, campo: CampoError) => void;
}) {
  const pideTitular = requisitos.titular.sexo || requisitos.titular.fechaNacimiento;
  const b = f.beneficiario;
  const beneficiario = (campo: keyof DatosBeneficiario) => (valor: string) =>
    onCambiar({ ...f, beneficiario: { ...b, [campo]: valor } }, `beneficiario.${campo}`);
  const control = (campo: CampoError) => cn(CLASE_CONTROL, errores[campo] && 'border-red-400');
  const texto = (campo: keyof DatosBeneficiario, extra: Record<string, unknown> = {}) => ({
    id: `as_b_${campo}`,
    className: control(`beneficiario.${campo}`),
    value: b[campo],
    disabled,
    'aria-invalid': Boolean(errores[`beneficiario.${campo}`]),
    onChange: (e: { target: { value: string } }) => beneficiario(campo)(e.target.value),
    ...extra,
  });

  return (
    <div className="flex flex-col gap-5">
      {requisitos.correoNetunoGo && (
        <SeccionFormulario titulo="Acceso a NetUno GO" icono={Mail}>
          <CampoFormulario
            etiqueta="Correo electrónico"
            htmlFor="as_correo"
            requerido
            completo
            error={errores.correo}
            ayuda="Correo que se usará para acceder a NetUno GO. Recuerda que este correo electrónico debe ser único."
          >
            <input
              id="as_correo"
              type="email"
              autoComplete="off"
              className={control('correo')}
              value={f.correo}
              disabled={disabled}
              aria-invalid={Boolean(errores.correo)}
              onChange={(e) => onCambiar({ ...f, correo: e.target.value }, 'correo')}
            />
          </CampoFormulario>
        </SeccionFormulario>
      )}

      {pideTitular && (
        <SeccionFormulario titulo="Titular de la póliza" icono={UserRound} insignia="Falta en CRM">
          {requisitos.titular.sexo && (
            <CampoFormulario etiqueta="Sexo" htmlFor="as_t_sexo" requerido error={errores['titular.sexo']}>
              <Selector
                id="as_t_sexo"
                valor={f.titular.sexo}
                opciones={SEXOS}
                disabled={disabled}
                error={errores['titular.sexo']}
                onCambiar={(sexo) => onCambiar({ ...f, titular: { ...f.titular, sexo } }, 'titular.sexo')}
              />
            </CampoFormulario>
          )}
          {requisitos.titular.fechaNacimiento && (
            <CampoFormulario
              etiqueta="Fecha de nacimiento"
              htmlFor="as_t_fecha"
              requerido
              error={errores['titular.fechaNacimiento']}
            >
              <input
                id="as_t_fecha"
                type="date"
                min="1900-01-01"
                max={hoy}
                className={control('titular.fechaNacimiento')}
                value={f.titular.fechaNacimiento}
                disabled={disabled}
                onChange={(e) =>
                  onCambiar(
                    { ...f, titular: { ...f.titular, fechaNacimiento: e.target.value } },
                    'titular.fechaNacimiento',
                  )
                }
              />
            </CampoFormulario>
          )}
          <p className="text-[11px] text-gray-500 sm:col-span-2">
            Se guardan en la cuenta del cliente en CRM al activar el servicio.
          </p>
        </SeccionFormulario>
      )}

      {requisitos.beneficiario && (
        <SeccionFormulario titulo="Datos del beneficiario" icono={ShieldPlus}>
          <CampoFormulario
            etiqueta="Nombre"
            htmlFor="as_b_nombre"
            requerido
            error={errores['beneficiario.nombre']}
          >
            <input {...texto('nombre', { autoComplete: 'off' })} />
          </CampoFormulario>
          <CampoFormulario
            etiqueta="Apellido"
            htmlFor="as_b_apellido"
            requerido
            error={errores['beneficiario.apellido']}
          >
            <input {...texto('apellido', { autoComplete: 'off' })} />
          </CampoFormulario>

          <CampoFormulario
            etiqueta="Tipo de documento"
            htmlFor="as_b_tipoDocumento"
            requerido
            error={errores['beneficiario.tipoDocumento']}
          >
            <Selector
              id="as_b_tipoDocumento"
              valor={b.tipoDocumento}
              opciones={TIPOS_DOCUMENTO}
              disabled={disabled}
              error={errores['beneficiario.tipoDocumento']}
              onCambiar={(tipoDocumento) =>
                onCambiar(
                  {
                    ...f,
                    beneficiario: {
                      ...b,
                      tipoDocumento,
                      // Menor sin cédula: no se pide el número (se envía el del titular + "1")
                      nDocumento: tipoDocumento === SIN_DOCUMENTO ? '' : b.nDocumento,
                    },
                  },
                  'beneficiario.tipoDocumento',
                )
              }
            />
          </CampoFormulario>
          {b.tipoDocumento === SIN_DOCUMENTO ? (
            <CampoFormulario etiqueta="Nro. documento">
              <p className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-[13px] text-gray-500">
                No aplica: se usa el documento del titular.
              </p>
            </CampoFormulario>
          ) : (
            <CampoFormulario
              etiqueta="Nro. documento"
              htmlFor="as_b_nDocumento"
              requerido
              error={errores['beneficiario.nDocumento']}
            >
              <input {...texto('nDocumento', { autoComplete: 'off', inputMode: 'numeric' })} />
            </CampoFormulario>
          )}

          <CampoFormulario
            etiqueta="Correo electrónico"
            htmlFor="as_b_correo"
            requerido
            error={errores['beneficiario.correo']}
          >
            <input {...texto('correo', { type: 'email', autoComplete: 'off' })} />
          </CampoFormulario>
          <CampoFormulario
            etiqueta="Celular"
            htmlFor="as_b_nTelefono"
            requerido
            error={errores['beneficiario.nArea'] ?? errores['beneficiario.nTelefono']}
          >
            <div className="flex gap-2">
              <div className="w-28 shrink-0">
                <Selector
                  id="as_b_nArea"
                  valor={b.nArea}
                  opciones={CODIGOS}
                  disabled={disabled}
                  error={errores['beneficiario.nArea']}
                  onCambiar={beneficiario('nArea')}
                />
              </div>
              <input
                {...texto('nTelefono', {
                  inputMode: 'numeric',
                  maxLength: 7,
                  placeholder: '1234567',
                  autoComplete: 'off',
                })}
                onChange={(e) => beneficiario('nTelefono')(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </CampoFormulario>

          <CampoFormulario
            etiqueta="Estado civil"
            htmlFor="as_b_estadoCivil"
            requerido
            error={errores['beneficiario.estadoCivil']}
          >
            <Selector
              id="as_b_estadoCivil"
              valor={b.estadoCivil}
              opciones={ESTADOS_CIVILES}
              disabled={disabled}
              error={errores['beneficiario.estadoCivil']}
              onCambiar={beneficiario('estadoCivil')}
            />
          </CampoFormulario>
          <CampoFormulario
            etiqueta="Parentesco"
            htmlFor="as_b_cParentesco"
            requerido
            error={errores['beneficiario.cParentesco']}
          >
            <Selector
              id="as_b_cParentesco"
              valor={b.cParentesco}
              opciones={PARENTESCOS}
              disabled={disabled}
              error={errores['beneficiario.cParentesco']}
              onCambiar={beneficiario('cParentesco')}
            />
          </CampoFormulario>

          <CampoFormulario etiqueta="Sexo" htmlFor="as_b_sexo" requerido error={errores['beneficiario.sexo']}>
            <Selector
              id="as_b_sexo"
              valor={b.sexo}
              opciones={SEXOS}
              disabled={disabled}
              error={errores['beneficiario.sexo']}
              onCambiar={beneficiario('sexo')}
            />
          </CampoFormulario>
          <CampoFormulario
            etiqueta="Fecha de nacimiento"
            htmlFor="as_b_fNacimiento"
            requerido
            error={errores['beneficiario.fNacimiento']}
          >
            <input {...texto('fNacimiento', { type: 'date', min: '1900-01-01', max: hoy })} />
          </CampoFormulario>
        </SeccionFormulario>
      )}
    </div>
  );
}
