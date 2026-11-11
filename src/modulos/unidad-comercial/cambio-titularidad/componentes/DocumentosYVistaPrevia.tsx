import { useRef } from 'react';
import { CheckCircle2, Eye, FileText, FolderUp, Send, Upload } from 'lucide-react';
import { Alerta, Boton, cn } from '@/ui';
import type { AccionPrevista, DocumentoRequerido, UnidadComercial } from '../lib/cambioTitularidad';
import { Bloque, ResumenTitulares, type Acordeon, type DatosTitular } from './Piezas';

function FilaDocumento({
  documento,
  archivo,
  subiendo,
  onSubir,
  onQuitar,
}: {
  documento: DocumentoRequerido;
  archivo: string | undefined;
  subiendo: boolean;
  onSubir: (archivo: File) => void;
  onQuitar: () => void;
}) {
  const selector = useRef<HTMLInputElement>(null);
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
        archivo ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200',
      )}
    >
      {archivo ? (
        <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-500" />
      ) : (
        <FileText aria-hidden="true" className="h-5 w-5 shrink-0 text-gray-400" />
      )}
      <div className="min-w-0 flex-1 text-xs">
        <p className="font-bold text-gray-900">
          {documento.etiqueta} <span className="text-red-600">*</span>
        </p>
        <p className={cn('truncate text-[11px]', archivo ? 'font-mono text-emerald-700' : 'text-gray-500')}>
          {archivo ?? documento.ayuda}
        </p>
      </div>
      <input
        ref={selector}
        type="file"
        accept={documento.acepta}
        className="hidden"
        aria-label={documento.etiqueta}
        data-documento={documento.id}
        onChange={(e) => {
          const elegido = e.target.files?.[0];
          if (elegido) onSubir(elegido);
          e.target.value = '';
        }}
      />
      {archivo ? (
        <Boton variante="secundario" tamano="sm" onClick={onQuitar}>
          Quitar
        </Boton>
      ) : (
        <Boton tamano="sm" icono={Upload} cargando={subiendo} onClick={() => selector.current?.click()}>
          Subir
        </Boton>
      )}
    </div>
  );
}

export function DocumentosRequeridos({
  unidad,
  documentos,
  archivos,
  subiendo,
  onSubir,
  onQuitar,
  acordeon,
}: {
  unidad: UnidadComercial;
  documentos: readonly DocumentoRequerido[];
  archivos: Record<string, string>;
  subiendo: string | null;
  onSubir: (id: string, archivo: File) => void;
  onQuitar: (id: string) => void;
  acordeon?: Acordeon;
}) {
  const cargados = documentos.filter((d) => archivos[d.id]).length;
  const completos = cargados === documentos.length;
  return (
    <Bloque
      titulo={`Documentos requeridos · ${unidad}`}
      icono={FolderUp}
      insignia={`${cargados}/${documentos.length}`}
      insigniaLista={completos}
      acordeon={acordeon}
    >
      {documentos.map((d) => (
        <FilaDocumento
          key={d.id}
          documento={d}
          archivo={archivos[d.id]}
          subiendo={subiendo === d.id}
          onSubir={(archivo) => onSubir(d.id, archivo)}
          onQuitar={() => onQuitar(d.id)}
        />
      ))}
    </Bloque>
  );
}

export function VistaPrevia({
  anterior,
  nuevo,
  acciones,
  enviando,
  error,
  onEnviar,
  acordeon,
}: {
  anterior: DatosTitular;
  nuevo: DatosTitular;
  acciones: AccionPrevista[];
  enviando: boolean;
  error: string | null;
  onEnviar: () => void;
  acordeon?: Acordeon;
}) {
  return (
    <Bloque titulo="Vista Previa de Acciones" icono={Eye} acordeon={acordeon}>
      <ResumenTitulares anterior={anterior} nuevo={nuevo} />
      <ol className="flex flex-col gap-2">
        {acciones.map((a, i) => (
          <li
            key={a.titulo}
            className={cn(
              'flex flex-col gap-0.5 rounded-lg border px-4 py-3 text-xs',
              i === 0 ? 'border-sky-200 bg-sky-50' : 'border-gray-200 bg-gray-50',
            )}
          >
            <span className={cn('font-bold', i === 0 ? 'text-accion' : 'text-gray-900')}>{a.titulo}</span>
            <span className={i === 0 ? 'text-sky-800' : 'text-gray-500'}>{a.detalle}</span>
          </li>
        ))}
      </ol>
      <Alerta tono="aviso">
        La ejecución en BOSS depende del servicio de cambio de titularidad de Ingeniería NETUNO (comprometido
        para el 30/11/2026).
      </Alerta>
      {error && <Alerta tono="error">{error}</Alerta>}
      <div className="flex justify-end border-t border-gray-200 pt-4">
        <Boton icono={Send} cargando={enviando} onClick={onEnviar}>
          {enviando ? 'Enviando…' : 'Enviar a aprobación'}
        </Boton>
      </div>
    </Bloque>
  );
}
