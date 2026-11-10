/// <reference types="vitest/config" />
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { MODULOS } from './src/modulos.ts';
import { paginasModulos } from './tooling/paginas-modulos.ts';

const raiz = (ruta: string) => fileURLToPath(new URL(ruta, import.meta.url));
const { version } = JSON.parse(readFileSync(raiz('./package.json'), 'utf8')) as { version: string };
const compilado = new Date().toISOString();

// Opcional: certificados para probar dentro de Zoho CRM desde el equipo (npm run dev:zoho).
// Ver docs/desarrollo-local.md. Si no existen, el servidor de desarrollo usa http.
const certificado = raiz('./certificados/cert.pem');
const llave = raiz('./certificados/key.pem');
const https =
  existsSync(certificado) && existsSync(llave)
    ? { cert: readFileSync(certificado), key: readFileSync(llave) }
    : undefined;

export default defineConfig({
  // Rutas relativas: la misma build funciona en cualquier dominio (Slate, dominio propio, local)
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    paginasModulos({
      modulos: MODULOS,
      slateConfig: 'catalyst/slate-config.toml',
      marcaVersion: `${version}|${compilado}`,
    }),
  ],
  resolve: {
    alias: { '@': raiz('./src') },
  },
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_TIME__: JSON.stringify(compilado),
  },
  server: {
    port: 5173,
    https,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  test: {
    include: ['src/**/*.test.ts', 'tooling/**/*.test.ts'],
  },
});
