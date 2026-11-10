import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText, Send } from 'lucide-react';
import { mensajeDeError } from '@/core/http/errores';
import type { Contrato, Cuenta } from '@/shared/cuentas';
import { useZoho } from '@/shared/zoho/contexto';
import {
  Alerta,
  Boton,
  CampoFormulario,
  Cargando,
  CLASE_CONTROL,
  Modal,
  PuntoEstado,
  SeccionFormulario,
  useAvisos,
} from '@/ui';
import { CampoDinamico } from './componentes/CampoDinamico';
import {
  opcionesSubcategoria,
  parametrosTicket,
  seccionVisible,
  VALORES_FIJOS,
  type ValorCampo,
  type Valores,
} from './lib/formularioTicket';
import {
  departamentosDesk,
  enviarTicket,
  prepararFormulario,
  type FormularioPreparado,
  type ResultadoTicket,
} from './servicio';

interface Props {
  cuenta: Cuenta;
  servicio: Contrato;
  onCerrar: () => void;
}

function FormularioTicket({
  preparado,
  departamento,
  cuenta,
  registro,
  onResultado,
}: {
  preparado: FormularioPreparado;
  departamento: { id: string; nombre: string };
  cuenta: Cuenta;
  registro: Record<string, unknown>;
  onResultado: (r: ResultadoTicket) => void;
}) {
  const { avisar } = useAvisos();
  const [valores, setValores] = useState<Valores>(preparado.valores);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);

  const cambiar = (api: string, valor: ValorCampo) => {
    setValores((v) => {
      const nuevo = { ...v, [api]: valor };
      // Al cambiar la categoría, la subcategoría pasa a la primera de la nueva (apply_subCategory)
      if (api === 'category' && 'subCategory' in v) {
        nuevo.subCategory = preparado.categorias[String(valor)]?.[0] ?? '';
      }
      return nuevo;
    });
    setErrores((e) => ({ ...e, [api]: '' }));
  };

  const crear = async () => {
    setFalla(null);
    const { errores: encontrados, parametros } = parametrosTicket(
      preparado.secciones,
      valores,
      departamento.id,
      valores.cf_tipo_cliente ?? cuenta.descTipoCliente,
    );
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) {
      const primero = Object.keys(encontrados)[0];
      document.getElementById(`ct_${primero}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setEnviando(true);
    try {
      const r = await enviarTicket({ parametros, cuenta, registro });
      if (r.tipo === 'creado')
        avisar({ tipo: 'exito', titulo: 'Ticket creado', texto: `Ticket #${r.numero}` });
      onResultado(r);
    } catch (error) {
      console.error('Error al crear el ticket:', error);
      setFalla(`Se generó un error en la creación del ticket: ${mensajeDeError(error)}`);
    } finally {
      setEnviando(false);
    }
  };

  const tipoCliente = valores.cf_tipo_cliente ?? cuenta.descTipoCliente;
  const visibles = preparado.secciones.filter((s) => seccionVisible(s, tipoCliente) && s.campos.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {preparado.avisos.length > 0 && (
        <Alerta tono="aviso">
          Algunos datos no se cargaron solos; complétalos si hace falta.
          <ul className="mt-1 list-disc pl-4 text-xs">
            {preparado.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Alerta>
      )}
      {visibles.map((seccion, i) => (
        <SeccionFormulario
          key={`${seccion.nombre}-${i}`}
          titulo={seccion.nombre || 'Información del ticket'}
          icono={FileText}
        >
          {seccion.campos.map((campo) => (
            <CampoDinamico
              key={campo.api}
              campo={campo}
              valor={valores[campo.api]}
              error={errores[campo.api] || undefined}
              deshabilitado={enviando}
              fijo={campo.api in VALORES_FIJOS}
              opciones={
                campo.tipo === 'LookUp'
                  ? (preparado.lookups[campo.api] ?? [])
                  : campo.api === 'subCategory'
                    ? opcionesSubcategoria(preparado.categorias, valores.category, campo).map((o) => ({
                        valor: o,
                        etiqueta: o,
                      }))
                    : undefined
              }
              onCambiar={(valor) => cambiar(campo.api, valor)}
            />
          ))}
        </SeccionFormulario>
      ))}
      {Object.values(errores).some(Boolean) && (
        <p role="alert" className="text-xs font-bold text-red-600">
          Completa los campos obligatorios marcados.
        </p>
      )}
      {falla && <Alerta tono="error">{falla}</Alerta>}
      <div className="flex justify-end">
        <Boton icono={Send} cargando={enviando} onClick={() => void crear()}>
          {enviando ? 'Creando ticket...' : 'Crear ticket'}
        </Boton>
      </div>
    </div>
  );
}

/**
 * Crear ticket en Zoho Desk para un servicio: se elige el departamento y el formulario se arma con el diseño
 * activo de tickets de ese departamento, con los datos del cliente y del servicio ya cargados.
 */
export default function CrearTicketModal({ cuenta, servicio, onCerrar }: Props) {
  const { registro } = useZoho();
  const [departamento, setDepartamento] = useState<{ id: string; nombre: string } | null>(null);
  const [resultado, setResultado] = useState<ResultadoTicket | null>(null);

  const departamentos = useQuery({
    queryKey: ['desk', 'departamentos'],
    queryFn: departamentosDesk,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const formulario = useQuery({
    queryKey: ['crear-ticket', 'formulario', servicio.idProducto, departamento?.id],
    queryFn: () =>
      prepararFormulario({
        departamento: departamento ?? { id: '', nombre: '' },
        cuenta,
        servicio,
        registro,
      }),
    enabled: departamento !== null,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  const subtitulo = (
    <span className="flex flex-wrap items-center gap-1.5 text-xs">
      <PuntoEstado activo={cuenta.descStatusCuenta === 'Conectado'} />
      Cuenta {cuenta.cuenta}
      <span className="opacity-40">/</span>
      <PuntoEstado activo={servicio.status === 'Conectado'} />
      {servicio.nombreServicio}
      <span className="opacity-40">/</span>
      Crear Ticket
    </span>
  );

  let contenido;
  if (resultado) {
    contenido = (
      <div className="flex flex-col gap-4">
        <Alerta tono={resultado.tipo === 'creado' ? 'exito' : 'aviso'}>
          <strong className="block">
            {resultado.tipo === 'creado' ? 'El ticket se ha creado exitosamente.' : resultado.mensaje}
          </strong>
          Departamento: {departamento?.nombre}
          <br />
          Ticket: #{resultado.numero}{' '}
          {resultado.url && (
            <a
              href={resultado.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-bold text-accion underline"
            >
              Ver ticket <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            </a>
          )}
        </Alerta>
        {resultado.tipo === 'creado' && resultado.imagenesFallidas > 0 && (
          <Alerta tono="aviso">
            {resultado.imagenesFallidas} imagen(es) no se pudieron subir a Catalyst: se enviaron dentro de la
            descripción.
          </Alerta>
        )}
      </div>
    );
  } else {
    contenido = (
      <div className="flex flex-col gap-4">
        <CampoFormulario etiqueta="Departamento" htmlFor="ct_departamento" requerido>
          <select
            id="ct_departamento"
            className={CLASE_CONTROL}
            value={departamento?.id ?? ''}
            disabled={departamentos.isPending || formulario.isFetching}
            onChange={(e) => {
              const elegido = departamentos.data?.find((d) => d.id === e.target.value);
              setDepartamento(elegido ? { id: elegido.id, nombre: elegido.name } : null);
            }}
          >
            <option value="">{departamentos.isPending ? 'Cargando departamentos...' : 'Seleccione'}</option>
            {(departamentos.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </CampoFormulario>
        {departamentos.isError && (
          <Alerta tono="error">
            No se cargaron los departamentos de Zoho Desk: {departamentos.error.message}
          </Alerta>
        )}
        {departamento && formulario.isPending && (
          <Cargando mensaje="Cargando el diseño del ticket y los datos del cliente..." />
        )}
        {formulario.isError && (
          <Alerta tono="error">
            {formulario.error.message}{' '}
            <button
              type="button"
              className="font-bold text-accion underline"
              onClick={() => void formulario.refetch()}
            >
              Reintentar
            </button>
          </Alerta>
        )}
        {departamento && formulario.data && (
          <FormularioTicket
            key={departamento.id}
            preparado={formulario.data}
            departamento={departamento}
            cuenta={cuenta}
            registro={registro}
            onResultado={setResultado}
          />
        )}
      </div>
    );
  }

  return (
    <Modal
      abierto
      titulo="Crear Ticket"
      subtitulo={subtitulo}
      onCerrar={onCerrar}
      ancho="max-w-4xl"
      pie={resultado ? <Boton onClick={onCerrar}>Cerrar</Boton> : undefined}
    >
      {contenido}
    </Modal>
  );
}
