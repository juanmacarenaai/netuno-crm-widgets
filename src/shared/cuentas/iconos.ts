import { HeartPulse, Package, Phone, Tv, Wifi, type LucideIcon } from 'lucide-react';

/** Ícono por tipo de servicio (nombreServicio de la API de Netuno). */
const ICONO_SERVICIO: Record<string, LucideIcon> = {
  Internet: Wifi,
  Telefonía: Phone,
  Streaming: Tv,
  Salud: HeartPulse,
  'Televisión por Cable': Tv,
};

export const iconoServicio = (nombreServicio: string): LucideIcon =>
  ICONO_SERVICIO[nombreServicio] ?? Package;
