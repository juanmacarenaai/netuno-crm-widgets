/**
 * Sistema de diseño Netuno. Los módulos importan sus componentes SOLO desde aquí:
 *   import { Boton, Tarjeta, Chip } from '@/ui';
 * Si un módulo necesita un componente que podría servir a otro, se crea aquí y no dentro del módulo.
 */
export { Boton, type BotonProps } from './Boton';
export { Tarjeta, type TarjetaProps } from './Tarjeta';
export { Chip, PuntoEstado, type ChipProps, type TonoChip } from './Chip';
export { Cargando, MensajeError, EstadoVacio, Esqueleto } from './Estados';
export { Modal, type ModalProps } from './Modal';
export { Paginador, type PaginadorProps } from './Paginador';
export { HtmlSeguro } from './HtmlSeguro';
export { Campo, ListaCampos, BotonEnlace } from './Campo';
export { Pasos } from './Pasos';
export { CampoFormulario, CLASE_CONTROL, CLASE_LECTURA, SeccionFormulario } from './Formulario';
export { Alerta, type TonoAlerta } from './Alerta';
export { TarjetaSeleccionable } from './TarjetaSeleccionable';
export {
  Combobox,
  type ComboboxProps,
  type IconoOpcion,
  type OpcionCombobox,
  type SeccionCombobox,
} from './Combobox';
export { EncabezadoModulo, type EncabezadoModuloProps } from './EncabezadoModulo';
export { AvisosProvider } from './avisos/AvisosProvider';
export { useAvisos, type Aviso, type TipoAviso } from './avisos/contexto';
export { cn } from './cn';
