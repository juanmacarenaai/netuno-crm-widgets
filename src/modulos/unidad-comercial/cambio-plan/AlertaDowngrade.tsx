import { Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/ui';
import type { Beneficiario, ReglaDowngrade } from './lib/cambioPlan';

const plural = (n: number, singular: string, pluralTexto: string) =>
  `${n} ${n === 1 ? singular : pluralTexto}`;

/**
 * Alerta del downgrade (modal-clientealertdowngrade del widget jQuery): qué pierde el cliente y,
 * si corresponde, qué beneficiarios de Salud se excluyen.
 */
export function AlertaDowngrade({
  regla,
  nuevo,
  cuenta,
  adicionales,
  excluidos,
  onAlternar,
}: {
  regla: ReglaDowngrade;
  nuevo: string;
  cuenta: string | number;
  adicionales: Beneficiario[];
  /** Contratos elegidos para excluir. */
  excluidos: string[];
  onAlternar: (contrato: string) => void;
}) {
  const pierde =
    (regla.tipo === 'internet' && regla.excluir > 0) ||
    (regla.tipo === 'streaming' && Boolean(regla.pantallasMenos));
  const Icono = pierde ? TriangleAlert : Info;

  let mensaje: string;
  if (regla.tipo === 'streaming') {
    mensaje = regla.pantallasMenos
      ? `Estás por eliminar ${plural(regla.pantallasMenos, 'pantalla', 'pantallas')} de la cuenta.`
      : `¿Quieres cambiar el plan a ${nuevo} de la cuenta ${cuenta}?`;
  } else if (regla.eliminaSalud && adicionales.length) {
    mensaje =
      'Estás por eliminar el servicio Salud de la cuenta: Salud integral (telemedicina, atención médica primaria y traslado en ambulancia).';
  } else if (regla.excluir > 0) {
    mensaje = `Estás por eliminar ${plural(regla.excluir, 'beneficiario', 'beneficiarios')} del servicio de salud integral.`;
  } else {
    mensaje = `¿Quieres actualizar el plan a ${nuevo} de la cuenta ${cuenta}?`;
  }

  return (
    <section
      className={cn(
        'flex animate-aparecer flex-col gap-3 rounded-xl border p-4',
        pierde ? 'border-amber-300 bg-amber-50' : 'border-sky-200 bg-sky-50',
      )}
      aria-label="Alerta de downgrade"
    >
      <h4 className="flex items-center gap-2 text-base font-bold text-gray-800">
        <Icono aria-hidden="true" className={cn('h-5 w-5', pierde ? 'text-amber-600' : 'text-accion')} />
        {pierde ? 'Alerta de downgrade' : 'Confirmar cambio de plan'}
      </h4>
      <p className="text-sm text-gray-700">{mensaje}</p>

      {regla.tipo === 'internet' && regla.excluir > 0 && !regla.elegir && (
        <ul className="flex list-inside list-disc flex-col gap-1 rounded-lg bg-white p-3 text-sm marker:text-amber-500">
          {adicionales.map((b) => (
            <li key={b.contrato}>
              {b.contrato} - {b.nombre}
            </li>
          ))}
        </ul>
      )}

      {regla.elegir && (
        <fieldset className="flex flex-col gap-1.5 rounded-lg bg-white p-3">
          <legend className="mb-1 text-sm font-bold text-gray-800">
            Selecciona los beneficiarios a los que se les eliminará el servicio ({excluidos.length} de{' '}
            {regla.excluir}):
          </legend>
          {adicionales.map((b) => {
            const marcado = excluidos.includes(b.contrato);
            const lleno = !marcado && excluidos.length >= regla.excluir;
            return (
              <label
                key={b.contrato}
                className={cn('flex items-center gap-2 text-sm', lleno ? 'text-gray-400' : 'cursor-pointer')}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  disabled={lleno}
                  onChange={() => onAlternar(b.contrato)}
                />
                {b.contrato} - {b.nombre}
              </label>
            );
          })}
        </fieldset>
      )}

      {regla.aprobacion && (
        <p className="text-xs text-gray-600">
          Este downgrade requiere aprobación: el ticket irá a Servicio al Cliente como «Pendiente por
          aprobación».
        </p>
      )}
      {pierde && (
        <p className="text-sm font-bold text-gray-700">
          Antes de confirmar, asegúrate de que el cliente comprenda los beneficios que perderá.
        </p>
      )}
    </section>
  );
}
