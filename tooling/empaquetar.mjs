#!/usr/bin/env node
/**
 * Empaqueta dist/ como .zip para subirlo a un widget de Zoho CRM con hosting "Zoho".
 *
 *   npm run empaquetar:pruebas      → paquetes/netuno-crm-widgets-v<versión>-pruebas.zip
 *   npm run empaquetar:produccion   → paquetes/netuno-crm-widgets-v<versión>-produccion.zip
 *
 * Mismo formato que `zet pack`: los archivos van dentro de app/ y Zoho la usa como raíz,
 * así que la página de índice del widget es /<módulo>.html (p. ej. /diagnostico.html).
 * El MISMO zip sirve para todos los widgets: solo cambia la página de índice de cada uno.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { zipSync } from 'fflate';

const entorno = process.argv[2];
if (entorno !== 'pruebas' && entorno !== 'produccion') {
  console.error('Uso: node tooling/empaquetar.mjs <pruebas|produccion>');
  process.exit(1);
}

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

const build = spawnSync('npm', ['run', entorno === 'produccion' ? 'build' : 'build:pruebas'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (build.status !== 0) process.exit(build.status ?? 1);

/** Archivos de dist/ (sin .catalyst/, que es solo para Slate). */
function archivos(carpeta) {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    if (nombre === '.catalyst') return [];
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

const contenido = {};
for (const ruta of archivos('dist')) {
  contenido[`app/${relative('dist', ruta).split(sep).join('/')}`] = readFileSync(ruta);
}

mkdirSync('paquetes', { recursive: true });
const destino = join('paquetes', `netuno-crm-widgets-v${version}-${entorno}.zip`);
writeFileSync(destino, zipSync(contenido, { level: 9 }));

const paginas = Object.keys(contenido).filter((nombre) => /^app\/[^/]+\.html$/.test(nombre));
console.log(`\n✔ ${destino} (${Object.keys(contenido).length} archivos)`);
console.log('  Páginas de índice disponibles para los widgets:');
for (const pagina of paginas) console.log(`    /${pagina.slice('app/'.length)}`);
