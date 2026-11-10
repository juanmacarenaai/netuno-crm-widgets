# Agregar o migrar un módulo

Un **módulo** es un widget de Zoho CRM. Todos viven en este proyecto, comparten versión, estilos y servicios, y
se publican juntos. Esta guía es para quien agrega un módulo nuevo o migra uno de los widgets jQuery.

## 1. Crear la carpeta del módulo

```
src/modulos/<id>/
├── index.tsx          ← obligatorio: export default del componente de la página
├── componentes/       ← componentes propios del módulo
├── hooks/             ← consultas del módulo (useQuery)
└── lib/               ← lógica pura del módulo, cada archivo con su .test.ts
```

`<id>` va en kebab-case (`estado-de-cuenta`) y es el nombre de la página publicada: `<id>.html`. **No se cambia
una vez publicado**, porque los widgets de Zoho apuntan a esa página.

## 2. Registrarlo en `src/modulos.ts`

```ts
{
  id: 'estado-de-cuenta',
  nombre: 'Estado de cuenta',
  descripcion: 'Movimientos y documentos de la cuenta.',
  estado: 'en-migracion',               // 'activo' cuando reemplace al widget anterior
  widgetAnterior: 'widgetFacturacionV1.2', // si migra uno existente
},
```

Con esto el build genera `dist/estado-de-cuenta.html`, el Lanzador lo lista y las pruebas de `src/app/registro.test.ts`
verifican que la carpeta exista. Nada más que tocar.

## 3. Escribir la página

```tsx
// src/modulos/estado-de-cuenta/index.tsx
import { ReceiptText, RotateCw } from 'lucide-react';
import { useZoho } from '@/shared/zoho/contexto';
import { Boton, EncabezadoModulo, MensajeError, Tarjeta } from '@/ui';
import { useCuentas } from './hooks/useCuentas';

export default function EstadoDeCuenta() {
  const { documento } = useZoho(); // registro, documento, usuario: ya cargados
  const cuentas = useCuentas(documento);

  return (
    <main className="mx-auto max-w-5xl p-3 sm:p-4">
      <EncabezadoModulo
        titulo="Estado de cuenta"
        icono={ReceiptText}
        acciones={
          <Boton
            variante="secundario"
            tamano="sm"
            icono={RotateCw}
            iconoGira
            cargando={cuentas.isFetching}
            onClick={() => cuentas.refetch()}
          >
            Refrescar
          </Boton>
        }
      />
      {cuentas.isError ? (
        <MensajeError mensaje={cuentas.error.message} onReintentar={() => cuentas.refetch()} />
      ) : (
        <Tarjeta titulo="Cuentas">{/* cuentas.data */}</Tarjeta>
      )}
    </main>
  );
}
```

### Consultar datos

Las consultas usan **TanStack Query**. Así obtienen caché, reintento, estado de carga y deduplicación sin
código propio:

```ts
// src/modulos/estado-de-cuenta/hooks/useCuentas.ts
import { useQuery } from '@tanstack/react-query';
import { netunoApi } from '@/services/netuno.api';

interface Cuenta {
  cuenta: string;
  saldo: number;
  // ...los campos que use el módulo
}

export function useCuentas(documento: string | null) {
  return useQuery({
    queryKey: ['netuno', 'cuentas', documento],
    queryFn: () => netunoApi.cuentas<Cuenta[]>(documento ?? ''),
    enabled: Boolean(documento), // sin documento no se consulta
  });
}
```

Si dos módulos necesitan la misma consulta (por ejemplo cuentas), el hook va en `src/shared/` y no se
repite.

Para operaciones que escriben datos, usa `useMutation` y confirma con `useAvisos().avisar(...)`.

### Un endpoint nuevo

Se agrega **una sola vez** en `src/services/` (`netuno.api.ts`, `desk.api.ts` o `crm.api.ts`) y queda
disponible para todos los módulos. Las llamadas a CRM nuevas usan `crmV8` (API v8 por conexión).

## 4. Datos de prueba

Agrega a `src/mocks/datosDemo.ts` (en `respuestaNetunoDemo`) las respuestas de los endpoints que usa el módulo.
Usa datos ficticios con la misma forma que las respuestas reales. Así el módulo se desarrolla sin Zoho:

```bash
npm run dev
# http://localhost:5173/estado-de-cuenta.html
```

## 5. Antes de publicar

```bash
npm run check     # tipos + lint + pruebas
```

Después: `npm run deploy:pruebas`, crear el widget en el sandbox con la página `/<id>.html` (ver
[catalyst-slate.md, paso 7](catalyst-slate.md#paso-7--widgets-de-los-módulos)) y completar el checklist de
[migracion.md](migracion.md).

---

## Reglas del proyecto

Existen para que todos los widgets se vean y se comporten igual, sin importar quién los escriba.

| Regla                                                                                                 | Por qué                                                                                       |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Los módulos **nunca** llaman a `ZOHO.*`: usan `src/services/*`                                        | Un solo lugar para timeouts, errores y la futura migración de credenciales                    |
| Componentes visuales desde `@/ui`. Si falta uno que sirva a otro módulo, se crea en `src/ui/`         | Mismo estilo en todos los widgets                                                             |
| Colores y sombras solo con los tokens de `src/styles/global.css` (`bg-netuno-500`, `shadow-tarjeta`…) | Un cambio de marca se hace en un solo archivo                                                 |
| HTML que llega de una API, solo con `<HtmlSeguro>`                                                    | Evita inyección de scripts                                                                    |
| Un módulo **no importa** archivos de otro módulo. Lo compartido se mueve a `src/shared/`              | Ejemplo: Resumen y Unidad Comercial comparten las tarjetas de cuenta en `src/shared/cuentas/` |
| La lógica sin interfaz va en `lib/` con su prueba                                                     | Se prueba sin navegador ni Zoho                                                               |
| IDs, hosts y conexiones solo en `src/core/config/entornos.ts`                                         | Pruebas y producción sin tocar código de los módulos                                          |
| Los textos visibles van en español y los nombres de código también                                    | Consistencia con el resto del proyecto                                                        |
