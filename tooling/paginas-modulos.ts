import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import type { DefinicionModulo } from '../src/modulos.ts';

interface Opciones {
  modulos: readonly DefinicionModulo[];
  /** Ruta (desde la raíz del proyecto) del slate-config.toml que se copia a dist/.catalyst/. */
  slateConfig?: string;
  /**
   * Marca `<versión>|<fecha de compilación>` que se inserta como `<meta name="netuno-build">`.
   * El módulo Diagnóstico la compara con la versión en ejecución para detectar copias en caché.
   */
  marcaVersion?: string;
}

const PAGINA_MODULO = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)\.html$/;

function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Copia de index.html para un módulo: solo cambia el título. El módulo se elige por el nombre del archivo. */
export function paginaDeModulo(plantilla: string, modulo: Pick<DefinicionModulo, 'nombre'>): string {
  return plantilla.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>${escaparHtml(modulo.nombre)} · Netuno</title>`,
  );
}

/** `/resumen.html?x=1` → `/index.html?x=1` si `resumen` es un módulo registrado; si no, null. */
export function reescribirRutaDev(url: string, ids: ReadonlySet<string>): string | null {
  const [ruta = '', consulta] = url.split('?');
  const id = PAGINA_MODULO.exec(ruta)?.[1];
  if (!id || !ids.has(id)) return null;
  return consulta ? `/index.html?${consulta}` : '/index.html';
}

/**
 * Una página HTML por módulo a partir de index.html.
 * - Desarrollo: `/<id>.html` se sirve con index.html (la URL del navegador se conserva).
 * - Build: escribe `dist/<id>.html` y copia la configuración de Slate a `dist/.catalyst/`.
 * Todas las páginas comparten el mismo código; cada una descarga solo el chunk de su módulo.
 */
export function paginasModulos({ modulos, slateConfig, marcaVersion }: Opciones): Plugin {
  const ids = new Set(modulos.map((m) => m.id));
  let raiz = process.cwd();
  let salida = resolve(raiz, 'dist');

  return {
    name: 'netuno:paginas-modulos',
    configResolved(config) {
      raiz = config.root;
      salida = resolve(raiz, config.build.outDir);
    },
    transformIndexHtml() {
      if (!marcaVersion) return [];
      return [{ tag: 'meta', attrs: { name: 'netuno-build', content: marcaVersion }, injectTo: 'head' }];
    },
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const nueva = req.url ? reescribirRutaDev(req.url, ids) : null;
        if (nueva) req.url = nueva;
        next();
      });
    },
    writeBundle(opciones) {
      const destino = opciones.dir ?? salida;
      const plantilla = readFileSync(join(destino, 'index.html'), 'utf8');
      for (const modulo of modulos) {
        writeFileSync(join(destino, `${modulo.id}.html`), paginaDeModulo(plantilla, modulo));
      }

      if (slateConfig) {
        const origen = resolve(raiz, slateConfig);
        if (!existsSync(origen)) {
          this.warn(`No se encontró ${slateConfig}: dist/ no se podrá publicar en Slate.`);
          return;
        }
        const archivo = join(destino, '.catalyst', 'slate-config.toml');
        mkdirSync(dirname(archivo), { recursive: true });
        copyFileSync(origen, archivo);
      }
    },
  };
}
