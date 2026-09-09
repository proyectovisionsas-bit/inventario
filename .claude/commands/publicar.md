---
description: Valida, hace commit y publica en GitHub Pages
argument-hint: "[qué cambió, en una frase]"
allowed-tools: Bash, Read, Grep, Edit
---

Publicá los cambios pendientes. Publicar = push a `main`; no hay entorno de pruebas.

Estado: !`git status --short`

Descripción del cambio: $ARGUMENTS

Pasos, sin saltarte ninguno:

1. Corré `node .claude/validar.mjs`. **Si falla, no publicás.**
2. Comprobá que la constante de versión de cada app modificada subió. Si no,
   subila vos y decilo.
3. Mostrame **qué archivos vas a subir y en una línea qué cambia cada uno**, y
   esperá mi confirmación. No hagas `git add`, `commit` ni `push` antes de que
   yo diga que sí.
4. Con mi confirmación: `git add` solo de esos archivos, commit con el mensaje
   en el estilo del repo — `OFICINAS v289: <qué cambió, en minúsculas, sin
   tildes>` — y `git push origin main`.
5. Recordame que los navegadores con la versión vieja verán la pantalla de
   bloqueo hasta que recarguen.

Si hay archivos modificados que NO son parte de este cambio, nombralos y dejalos
por fuera del commit.
