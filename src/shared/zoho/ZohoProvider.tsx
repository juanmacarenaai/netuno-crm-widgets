import { useCallback, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { mensajeDeError } from '@/core/http/errores';
import { idDelRegistro, iniciarSesionZoho } from '@/core/zoho/sesion';
import { obtenerRegistro, obtenerUsuario, obtenerUsuarioActual } from '@/services/crm.api';
import { aliasDeEmail, documentoDelRegistro, listaDeDepartamentos } from '@/shared/lib/cliente';
import { Cargando, MensajeError } from '@/ui';
import { ZohoContext, type SesionZoho, type UsuarioSesion } from './contexto';

const CLAVE_SESION = ['zoho', 'sesion'] as const;

const texto = (valor: unknown): string | null =>
  valor === null || valor === undefined || valor === '' ? null : String(valor);

async function cargarUsuario(): Promise<UsuarioSesion> {
  const actual = await obtenerUsuarioActual();
  // Departamento y Almacén son campos personalizados: si fallan, el widget sigue sin ellos
  const detalle = await obtenerUsuario(actual.id).catch((error: unknown) => {
    console.error('No se pudo consultar Departamento/Almacén del usuario:', error);
    return null;
  });
  const departamentos = listaDeDepartamentos(detalle?.Departamento);
  return {
    id: actual.id,
    nombre: actual.full_name,
    email: actual.email,
    alias: aliasDeEmail(actual.email),
    rol: actual.role?.name ?? null,
    departamento: departamentos.length ? departamentos.join(', ') : null,
    departamentos,
    almacen: texto(detalle?.Almacen),
  };
}

type DatosSesion = Omit<SesionZoho, 'recargarRegistro'>;

/** Espera el PageLoad y carga, en paralelo, el registro y el usuario. */
async function cargarSesion(): Promise<DatosSesion> {
  const pagina = await iniciarSesionZoho();
  const idRegistro = idDelRegistro(pagina);
  const [registro, usuario] = await Promise.all([
    obtenerRegistro(pagina.Entity, idRegistro),
    cargarUsuario(),
  ]);
  return {
    pagina,
    entidad: pagina.Entity,
    idRegistro,
    registro,
    documento: documentoDelRegistro(registro),
    usuario,
  };
}

/**
 * Contexto de Zoho para todos los módulos: cada uno lo recibe listo con `useZoho()`
 * y ninguno repite la carga del registro o del usuario.
 */
export function ZohoProvider({ children }: { children: ReactNode }) {
  const clienteConsultas = useQueryClient();
  const sesion = useQuery({
    queryKey: CLAVE_SESION,
    queryFn: cargarSesion,
    // El contexto no cambia mientras el widget está abierto
    staleTime: Infinity,
    gcTime: Infinity,
    // Ya espera hasta 15 s el PageLoad: reintentar solo cuando el usuario lo pida
    retry: false,
  });

  const recargarRegistro = useCallback(async () => {
    const actual = clienteConsultas.getQueryData<DatosSesion>(CLAVE_SESION);
    if (!actual) return;
    const registro = await obtenerRegistro(actual.entidad, actual.idRegistro);
    clienteConsultas.setQueryData<DatosSesion>(CLAVE_SESION, {
      ...actual,
      registro,
      documento: documentoDelRegistro(registro),
    });
  }, [clienteConsultas]);

  const valor = useMemo<SesionZoho | null>(
    () => (sesion.data ? { ...sesion.data, recargarRegistro } : null),
    [sesion.data, recargarRegistro],
  );

  if (sesion.isPending || (sesion.isError && sesion.isFetching)) {
    return <Cargando mensaje="Conectando con Zoho CRM..." pantallaCompleta />;
  }
  if (sesion.isError || !valor) {
    return (
      <MensajeError
        titulo="No se pudo iniciar el widget"
        mensaje={sesion.isError ? mensajeDeError(sesion.error) : 'Error desconocido.'}
        onReintentar={() => void sesion.refetch()}
        pantallaCompleta
      />
    );
  }

  return <ZohoContext.Provider value={valor}>{children}</ZohoContext.Provider>;
}
