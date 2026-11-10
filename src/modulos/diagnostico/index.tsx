import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Loader2,
  MinusCircle,
  RotateCw,
  Settings2,
  Stethoscope,
  XCircle,
} from 'lucide-react';
import { entorno } from '@/core/config';
import { Boton, Chip, cn, EncabezadoModulo, Modal, Tarjeta, useAvisos, type TonoChip } from '@/ui';
import {
  ejecutarPrueba,
  informe,
  PRUEBAS,
  type Contexto,
  type EstadoPrueba,
  type ResultadoCompleto,
} from './pruebas';

const ESTADOS: Record<
  EstadoPrueba,
  { Icono: typeof CheckCircle2; color: string; tono: TonoChip; texto: string }
> = {
  ok: { Icono: CheckCircle2, color: 'text-emerald-600', tono: 'exito', texto: 'Correcto' },
  aviso: { Icono: AlertTriangle, color: 'text-amber-600', tono: 'aviso', texto: 'Revisar' },
  error: { Icono: XCircle, color: 'text-red-600', tono: 'error', texto: 'Error' },
  omitido: { Icono: MinusCircle, color: 'text-gray-400', tono: 'neutro', texto: 'Omitido' },
};

function FilaPrueba({
  titulo,
  descripcion,
  resultado,
}: {
  titulo: string;
  descripcion: string;
  resultado?: ResultadoCompleto;
}) {
  const estilo = resultado ? ESTADOS[resultado.estado] : null;
  const Icono = estilo?.Icono ?? Loader2;
  return (
    <li className="flex gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0">
      <Icono
        aria-hidden="true"
        className={cn('mt-0.5 h-5 w-5 shrink-0', estilo?.color ?? 'animate-spin text-netuno-500')}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="font-semibold text-netuno-800">{titulo}</p>
          {resultado && <span className="text-xs text-gray-400 tabular-nums">{resultado.ms} ms</span>}
        </div>
        <p className="text-xs text-texto-suave">{descripcion}</p>
        {resultado && <p className="mt-1 text-sm break-words text-gray-800">{resultado.resumen}</p>}
        {resultado?.detalle !== undefined && (
          <details className="mt-1">
            <summary className="cursor-pointer text-xs font-semibold text-accion">Ver detalle</summary>
            <pre className="mt-1 max-h-60 overflow-auto rounded-lg bg-gray-50 p-2 text-[11px] text-gray-700">
              {JSON.stringify(resultado.detalle, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </li>
  );
}

export default function Diagnostico() {
  const { avisar } = useAvisos();
  const [resultados, setResultados] = useState<ResultadoCompleto[]>([]);
  const [ejecutando, setEjecutando] = useState(true);
  const [textoInforme, setTextoInforme] = useState<string | null>(null);
  // Cada clic en "Ejecutar de nuevo" abre una ronda nueva; la anterior deja de mostrar resultados
  const [ronda, setRonda] = useState(0);

  // Corre las pruebas en orden; los resultados aparecen a medida que terminan
  useEffect(() => {
    let vigente = true;
    const contexto: Contexto = { ronda };
    (async () => {
      for (const prueba of PRUEBAS) {
        const resultado = await ejecutarPrueba(prueba, contexto);
        if (!vigente) return;
        setResultados((actuales) => [...actuales, resultado]);
      }
      setEjecutando(false);
    })();
    return () => {
      vigente = false;
    };
  }, [ronda]);

  const ejecutar = () => {
    setEjecutando(true);
    setResultados([]);
    setRonda((n) => n + 1);
  };

  const copiar = async () => {
    const texto = informe(resultados);
    try {
      await navigator.clipboard.writeText(texto);
      avisar({ tipo: 'exito', titulo: 'Informe copiado', texto: 'Pégalo en el chat del equipo.' });
    } catch {
      // Zoho puede bloquear el portapapeles dentro del iframe: se muestra para copiarlo a mano
      setTextoInforme(texto);
    }
  };

  const conteo = (estado: EstadoPrueba) => resultados.filter((r) => r.estado === estado).length;

  return (
    <main className="mx-auto max-w-4xl p-3 sm:p-4">
      <EncabezadoModulo
        titulo="Diagnóstico de widgets"
        icono={Stethoscope}
        descripcion="Verifica, desde Zoho CRM, todo lo que necesitan los módulos para funcionar."
        acciones={
          <>
            <Boton
              variante="secundario"
              tamano="sm"
              icono={ClipboardCopy}
              onClick={copiar}
              disabled={ejecutando}
            >
              Copiar informe
            </Boton>
            <Boton tamano="sm" icono={RotateCw} iconoGira cargando={ejecutando} onClick={ejecutar}>
              Ejecutar de nuevo
            </Boton>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap gap-2">
        {(['ok', 'aviso', 'error', 'omitido'] as const).map((estado) => (
          <Chip key={estado} tono={ESTADOS[estado].tono}>
            {ESTADOS[estado].texto}: {conteo(estado)}
          </Chip>
        ))}
      </div>

      <Tarjeta sinRelleno className="mb-4">
        <ul>
          {PRUEBAS.map((prueba) => {
            const resultado = resultados.find((r) => r.id === prueba.id);
            if (!resultado && !ejecutando) return null;
            return (
              <FilaPrueba
                key={prueba.id}
                titulo={prueba.titulo}
                descripcion={prueba.descripcion}
                resultado={resultado}
              />
            );
          })}
        </ul>
      </Tarjeta>

      <Tarjeta titulo={`Configuración del entorno: ${entorno.etiqueta}`} icono={Settings2}>
        <p className="mb-2 text-xs text-texto-suave">
          Se edita en <code className="rounded bg-gray-100 px-1">src/core/config/entornos.ts</code>.
        </p>
        <pre className="max-h-72 overflow-auto rounded-lg bg-gray-50 p-3 text-[11px] text-gray-700">
          {JSON.stringify({ ...entorno, pendientes: undefined }, null, 2)}
        </pre>
        {entorno.pendientes.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="mb-1 text-sm font-semibold text-amber-800">Por confirmar</p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-amber-900">
              {entorno.pendientes.map((pendiente) => (
                <li key={pendiente}>{pendiente}</li>
              ))}
            </ul>
          </div>
        )}
      </Tarjeta>

      <Modal
        abierto={textoInforme !== null}
        titulo="Informe del diagnóstico"
        subtitulo="El navegador no permitió copiarlo automáticamente: selecciónalo y cópialo."
        onCerrar={() => setTextoInforme(null)}
      >
        <textarea
          readOnly
          value={textoInforme ?? ''}
          onFocus={(evento) => evento.currentTarget.select()}
          className="h-80 w-full rounded-lg border border-gray-200 p-2 font-mono text-[11px]"
        />
      </Modal>
    </main>
  );
}
