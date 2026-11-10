/** Registro de atenciones (Cases) y comunicaciones en CRM. Las consultas están en @/shared/historial. */
import { insertarRegistro } from '@/services/crm.api';
import type { ContextoHistorial } from '@/shared/historial';
import { registroCrm, type FormularioRegistro, type TipoRegistro } from './lib/registros';

/** Registra una atención (Cases) o una comunicación en CRM. */
export function registrar(tipo: TipoRegistro, formulario: FormularioRegistro, ctx: ContextoHistorial) {
  const { modulo, datos } = registroCrm(tipo, formulario, ctx);
  return insertarRegistro(modulo, datos);
}
