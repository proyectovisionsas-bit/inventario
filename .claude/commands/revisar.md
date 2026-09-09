---
description: Revisa que un cambio esté listo para publicar (sintaxis, versión, apps hermanas)
argument-hint: "[archivo o descripción del cambio]"
allowed-tools: Bash, Read, Grep, Glob, Edit
---

Revisá que lo que está sin publicar esté listo. NO publiques nada: esto solo revisa.

Estado actual del repo:

- Cambios sin commit: !`git status --short`
- Resumen: !`git diff --stat`

Cambio a revisar: $ARGUMENTS

Hacé esto, en orden, y reportá cada punto con ✅ o ❌:

1. **Sintaxis.** Corré `node .claude/validar.mjs`. Si falla, parás acá y decís dónde.
2. **Versión subida.** Para cada app modificada, comprobá que su constante subió
   respecto a `git show HEAD:<archivo>`: `APP_VERSION` en OFICINAS,
   `APP_VERSION_INV`, `APP_VERSION_TEC`, `APP_VERSION_RED`. Si tocaste
   `contrato.js` o `ia.js`, el `?v=` debe subir en TODOS los HTML que los cargan.
3. **La app hermana.** Si el cambio toca datos que comparten OFICINAS y TECNICOS
   (órdenes, clientes, cuadrillas, consumos, contratos), buscá en la otra app si
   lee o escribe ese mismo campo. Un cambio de forma rompe la otra en silencio.
4. **Fechas.** Si el cambio guarda una fecha nueva, confirmá que también guarda
   su marca numérica `...Ms`. Un texto `DD/MM/AAAA` se lee mal y ya rompió el
   archivador durante meses.
5. **Nada se borra.** Si el cambio saca registros de la base, confirmá que antes
   escribe el archivo y lo vuelve a leer para verificar.
6. **La tabla de CLAUDE.md.** Comparala contra el disco (versiones y líneas de
   cada archivo). Si no cuadra, corregila — es lo único que edito aquí.

Terminá con una línea: **LISTO PARA PUBLICAR** o **NO PUBLICAR TODAVÍA: <razón>**.
