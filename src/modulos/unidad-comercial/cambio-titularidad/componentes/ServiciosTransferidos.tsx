import type { ReactNode } from 'react';
import { Layers, Plus, X } from 'lucide-react';
import { nombreServicioLegible, type Contrato } from '@/shared/cuentas';
import { Alerta, Boton, CampoFormulario, CLASE_CONTROL, cn } from '@/ui';
import {
  MAX_BENEFICIARIOS,
  PARENTESCOS,
  type Beneficiario,
  type ContratoTransferible,
  type UnidadComercial,
} from '../lib/cambioTitularidad';
import { AlertaCargando, Bloque, Lectura, Subtitulo, type Acordeon } from './Piezas';
import type { Verificacion } from './DatosNuevoTitular';

function Opcional({
  titulo,
  nota,
  activo,
  onActivo,
  children,
}: {
  titulo: string;
  nota: string;
  activo: boolean;
  onActivo: (valor: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4',
        activo ? 'border-netuno-500/40 bg-white' : 'border-gray-200 bg-gray-50',
      )}
    >
      <label className="flex cursor-pointer flex-wrap items-center gap-2.5 text-[13px] font-bold text-gray-900">
        <input
          type="checkbox"
          checked={activo}
          onChange={(e) => onActivo(e.target.checked)}
          className="h-4 w-4 accent-accion"
        />
        {titulo}
        <span className="ml-auto text-[11px] font-semibold text-gray-500">{nota}</span>
      </label>
      {activo && children}
    </div>
  );
}

const COLUMNAS_SALUD = 'sm:grid-cols-[1.4fr_1fr_1fr_0.8fr_1fr_auto]';

export function ServiciosTransferidos({
  unidad,
  contratos,
  streaming,
  salud,
  conNetunoGo,
  onNetunoGo,
  correoNetunoGo,
  onCorreoNetunoGo,
  validacionCorreo,
  onValidarCorreo,
  conSalud,
  onSalud,
  titularSalud,
  beneficiarios,
  onAgregarBeneficiario,
  onCambiarBeneficiario,
  onQuitarBeneficiario,
  acordeon,
}: {
  unidad: UnidadComercial;
  contratos: ContratoTransferible[];
  streaming: Contrato | null;
  salud: Contrato | null;
  conNetunoGo: boolean;
  onNetunoGo: (valor: boolean) => void;
  correoNetunoGo: string;
  onCorreoNetunoGo: (valor: string) => void;
  validacionCorreo: Verificacion;
  onValidarCorreo: () => void;
  conSalud: boolean;
  onSalud: (valor: boolean) => void;
  titularSalud: { nombre: string; documento: string; fecha: string; sexo: string };
  beneficiarios: Beneficiario[];
  onAgregarBeneficiario: () => void;
  onCambiarBeneficiario: (id: string, cambios: Partial<Beneficiario>) => void;
  onQuitarBeneficiario: (id: string) => void;
  acordeon?: Acordeon;
}) {
  const empresa = unidad === 'Empresa';
  return (
    <Bloque titulo="Servicios Transferidos" icono={Layers} acordeon={acordeon}>
      <Alerta>
        Se heredan del contrato actual en <b>solo lectura</b>: dirección, geolocalización, serial ONT y plan
        {empresa ? ', e IP fijas' : ''}. Sin visita técnica y sin costo de instalación.
      </Alerta>

      {contratos.map((c) => (
        <div key={c.idProducto} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CampoFormulario etiqueta={`Dirección de servicio · ${c.codigo}`} lectura>
            <Lectura>
              {c.direccion}
              {c.gps && (
                <span className="mt-0.5 block font-mono text-[10.5px] text-gray-400">GPS: {c.gps}</span>
              )}
            </Lectura>
          </CampoFormulario>
          <div className="grid grid-cols-2 gap-3">
            <CampoFormulario etiqueta="Plan" lectura>
              <Lectura>{c.plan}</Lectura>
            </CampoFormulario>
            <CampoFormulario etiqueta={c.servicio === 'Internet' ? 'Serial ONT' : 'Servicio'} lectura>
              <Lectura vacio={c.servicio === 'Internet' && !c.serial}>
                <span className={c.serial ? 'font-mono' : undefined}>{c.serial ?? c.servicio}</span>
              </Lectura>
            </CampoFormulario>
            {empresa && (
              <CampoFormulario etiqueta="IP fija" lectura>
                <Lectura>Se conservan</Lectura>
              </CampoFormulario>
            )}
          </div>
        </div>
      ))}

      {(streaming || salud) && <Subtitulo>Servicios opcionales del nuevo titular</Subtitulo>}

      {streaming && (
        <Opcional
          titulo={`Streaming · ${nombreServicioLegible(streaming) || 'NetunoGo'}`}
          nota="Requiere correo nuevo y único"
          activo={conNetunoGo}
          onActivo={onNetunoGo}
        >
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto]">
            <CampoFormulario etiqueta="Nuevo correo NetunoGo" htmlFor="tit_correo_go" requerido>
              <input
                id="tit_correo_go"
                type="email"
                className={CLASE_CONTROL}
                placeholder="usuario NetunoGo del nuevo titular"
                value={correoNetunoGo}
                onChange={(e) => onCorreoNetunoGo(e.target.value)}
              />
            </CampoFormulario>
            <Boton
              variante={correoNetunoGo.trim() && validacionCorreo !== 'ok' ? 'primario' : 'secundario'}
              cargando={validacionCorreo === 'verificando'}
              disabled={!correoNetunoGo.trim()}
              onClick={onValidarCorreo}
            >
              {validacionCorreo === 'verificando' ? 'Validando…' : 'Validar unicidad'}
            </Boton>
          </div>
          {validacionCorreo === 'verificando' && (
            <AlertaCargando>Verificando el correo en NetunoGo…</AlertaCargando>
          )}
          {validacionCorreo === 'ok' && (
            <Alerta tono="exito">Correo disponible. Se usará como usuario de NetunoGo.</Alerta>
          )}
          {validacionCorreo === 'rechazado' && (
            <Alerta tono="error">
              El correo no es válido o ya está asociado a otro contrato NetunoGo (incluido el del titular
              actual).
            </Alerta>
          )}
          {validacionCorreo === 'error' && (
            <Alerta tono="error">No se pudo validar el correo. Intente de nuevo.</Alerta>
          )}
        </Opcional>
      )}

      {salud && (
        <Opcional
          titulo="Salud · Beneficiarios"
          nota={`Hasta ${MAX_BENEFICIARIOS + 1} personas incluido el titular · ${1 + beneficiarios.length}/${MAX_BENEFICIARIOS + 1}`}
          activo={conSalud}
          onActivo={onSalud}
        >
          <div className="flex flex-col gap-2">
            <div
              className={cn(
                'hidden gap-2 px-1 text-[10.5px] font-bold tracking-wide text-gray-500 uppercase sm:grid',
                COLUMNAS_SALUD,
              )}
            >
              <span>Nombre completo</span>
              <span>Documento</span>
              <span>Fecha nac.</span>
              <span>Sexo</span>
              <span>Parentesco</span>
              <span className="w-7" />
            </div>
            <div className={cn('grid grid-cols-2 items-center gap-2', COLUMNAS_SALUD)}>
              <Lectura vacio={!titularSalud.nombre}>{titularSalud.nombre || 'Nuevo titular'}</Lectura>
              <Lectura vacio={!titularSalud.documento}>
                <span className="font-mono">{titularSalud.documento || '—'}</span>
              </Lectura>
              <Lectura vacio={!titularSalud.fecha}>
                {titularSalud.fecha ? titularSalud.fecha.split('-').reverse().join('/') : '—'}
              </Lectura>
              <Lectura vacio={!titularSalud.sexo}>{titularSalud.sexo || '—'}</Lectura>
              <span className="w-max rounded bg-netuno-oscuro px-2 py-1 text-[11px] font-bold text-white">
                Titular
              </span>
              <span className="hidden w-7 sm:block" />
            </div>
            {beneficiarios.map((b, i) => (
              <div
                key={b.id}
                className={cn(
                  'grid animate-aparecer grid-cols-2 items-center gap-2 border-t border-gray-100 pt-2 sm:border-0 sm:pt-0',
                  COLUMNAS_SALUD,
                )}
              >
                <input
                  aria-label={`Nombre del beneficiario ${i + 1}`}
                  className={CLASE_CONTROL}
                  placeholder="Nombre y apellido"
                  value={b.nombre}
                  onChange={(e) => onCambiarBeneficiario(b.id, { nombre: e.target.value })}
                />
                <input
                  aria-label={`Documento del beneficiario ${i + 1}`}
                  className={cn(CLASE_CONTROL, 'font-mono')}
                  placeholder="V- / Partida"
                  value={b.documento}
                  onChange={(e) => onCambiarBeneficiario(b.id, { documento: e.target.value })}
                />
                <input
                  aria-label={`Fecha de nacimiento del beneficiario ${i + 1}`}
                  type="date"
                  className={CLASE_CONTROL}
                  value={b.fechaNacimiento}
                  onChange={(e) => onCambiarBeneficiario(b.id, { fechaNacimiento: e.target.value })}
                />
                <select
                  aria-label={`Sexo del beneficiario ${i + 1}`}
                  className={CLASE_CONTROL}
                  value={b.sexo}
                  onChange={(e) => onCambiarBeneficiario(b.id, { sexo: e.target.value })}
                >
                  <option value="">—</option>
                  <option value="F">F</option>
                  <option value="M">M</option>
                </select>
                <select
                  aria-label={`Parentesco del beneficiario ${i + 1}`}
                  className={CLASE_CONTROL}
                  value={b.parentesco}
                  onChange={(e) => onCambiarBeneficiario(b.id, { parentesco: e.target.value })}
                >
                  {PARENTESCOS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onQuitarBeneficiario(b.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-red-400 transition hover:bg-red-50 hover:text-red-600"
                  aria-label={`Quitar beneficiario ${i + 1}`}
                  title="Quitar beneficiario"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div>
              <Boton
                variante="secundario"
                tamano="sm"
                icono={Plus}
                disabled={beneficiarios.length >= MAX_BENEFICIARIOS}
                onClick={onAgregarBeneficiario}
              >
                Agregar beneficiario
              </Boton>
            </div>
          </div>
        </Opcional>
      )}
    </Bloque>
  );
}
