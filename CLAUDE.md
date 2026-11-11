# CLAUDE.md

Las instrucciones del proyecto son compartidas con las otras IA del equipo y viven en `AGENTS.md`. No las
dupliques aquí: si una regla cambia, se cambia en `AGENTS.md`.

@AGENTS.md

## Solo para Claude Code

- En Windows, corre `npm run check` y `npm run deploy:pruebas` desde PowerShell con la ruta en `C:\` mayúscula
  (ver "Problemas conocidos" en AGENTS.md).
- Para revisar una pantalla, levanta `npm run dev` y abre `http://localhost:5173/<id>.html`. Los scripts de prueba
  en navegador (puppeteer) van en tu carpeta temporal, no en el repositorio.
