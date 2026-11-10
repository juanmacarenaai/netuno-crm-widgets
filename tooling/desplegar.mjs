#!/usr/bin/env node
/**
 * Despliegue a Catalyst Slate: verifica, compila con el entorno correcto y publica dist/.
 *
 *   npm run deploy:pruebas      → build "pruebas"    → Slate Development
 *   npm run deploy:produccion   → build "produccion" → Slate Production (pide confirmación)
 *
 * Opciones: --sin-verificar (omite typecheck, lint y pruebas; solo para emergencias).
 * Guía completa: docs/catalyst-slate.md
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

const entorno = process.argv[2];
const sinVerificar = process.argv.includes('--sin-verificar');

if (entorno !== 'pruebas' && entorno !== 'produccion') {
  console.error('Uso: node tooling/desplegar.mjs <pruebas|produccion> [--sin-verificar]');
  process.exit(1);
}

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const esProduccion = entorno === 'produccion';

function ejecutar(comando, args) {
  console.log(`\n› ${comando} ${args.join(' ')}`);
  const resultado = spawnSync(comando, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (resultado.status !== 0) {
    console.error(`\n✖ Falló: ${comando} ${args.join(' ')}`);
    process.exit(resultado.status ?? 1);
  }
}

if (!existsSync('catalyst.json')) {
  console.error(
    '✖ Falta catalyst.json: el proyecto aún no está vinculado a Catalyst Slate.\n' +
      '  Sigue los pasos 1 a 4 de docs/catalyst-slate.md (catalyst init + catalyst slate:link).',
  );
  process.exit(1);
}

// `catalyst slate:link` guarda la ruta absoluta de quien vinculó el proyecto (C:\Users\<persona>\...\dist).
// Se ajusta a la carpeta dist/ de este equipo para que cualquiera del equipo pueda desplegar.
const configuracion = JSON.parse(readFileSync('catalyst.json', 'utf8'));
const dist = resolve('dist');
const apps = Array.isArray(configuracion.slate) ? configuracion.slate : [];
if (apps.length === 0) {
  console.error('✖ catalyst.json no tiene la sección "slate". Sigue el paso 4 de docs/catalyst-slate.md.');
  process.exit(1);
}
if (apps.some((app) => app.source !== dist)) {
  for (const app of apps) app.source = dist;
  writeFileSync('catalyst.json', JSON.stringify(configuracion, null, 2) + '\n');
  console.log(`› catalyst.json: carpeta de Slate ajustada a ${dist}`);
}

if (esProduccion) {
  console.log(`\n⚠️  Vas a publicar la versión ${version} en PRODUCCIÓN.`);
  console.log('   Todos los widgets de la organización real se actualizan en cuanto termine.');
  const lector = createInterface({ input: process.stdin, output: process.stdout });
  const respuesta = await lector.question('   Escribe PRODUCCION para continuar: ');
  lector.close();
  if (respuesta.trim() !== 'PRODUCCION') {
    console.log('Despliegue cancelado.');
    process.exit(0);
  }
}

if (!sinVerificar) ejecutar('npm', ['run', 'check']);
ejecutar('npm', ['run', esProduccion ? 'build' : 'build:pruebas']);

// Slate borra los archivos de la versión anterior al publicar, pero los navegadores guardan los HTML un año: una
// página guardada apuntaría a JavaScript inexistente y el widget quedaría en blanco. Por eso se vuelven a subir los
// archivos de las versiones de los últimos DIAS_HISTORIAL días (sus nombres llevan hash: no chocan con los nuevos).
const DIAS_HISTORIAL = 60;
const historial = resolve('.slate-historial', entorno, 'assets');
const assets = join(dist, 'assets');
mkdirSync(historial, { recursive: true });
const vencimiento = Date.now() - DIAS_HISTORIAL * 86_400_000;
let anteriores = 0;
for (const archivo of readdirSync(historial)) {
  const origen = join(historial, archivo);
  if (statSync(origen).mtimeMs < vencimiento) {
    rmSync(origen);
    continue;
  }
  const destino = join(assets, archivo);
  if (!existsSync(destino)) {
    copyFileSync(origen, destino);
    anteriores++;
  }
}
console.log(
  `› Archivos de versiones anteriores incluidos: ${anteriores} (historial de ${DIAS_HISTORIAL} días)`,
);

ejecutar('catalyst', [
  'deploy',
  'slate',
  ...(esProduccion ? ['--production'] : []),
  '-m',
  // Sin espacios: en Windows los argumentos pasan por la consola y un espacio los partiría en dos
  `v${version}-${entorno}`,
]);

// Los archivos de esta versión pasan al historial (los ya guardados conservan su fecha)
for (const archivo of readdirSync(assets)) {
  const destino = join(historial, archivo);
  if (!existsSync(destino)) copyFileSync(join(assets, archivo), destino);
}

console.log(`\n✔ v${version} publicada en ${esProduccion ? 'PRODUCCIÓN' : 'pruebas (Development)'}.`);
console.log('  Abre el widget "Diagnóstico" en Zoho CRM para confirmar la versión publicada.');
