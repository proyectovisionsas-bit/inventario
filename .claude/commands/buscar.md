---
description: Encuentra una función o texto en los archivos grandes sin leerlos enteros
argument-hint: "<nombre de función, texto o síntoma>"
allowed-tools: Grep, Glob, Read, Bash
---

Buscá `$ARGUMENTS` en este proyecto.

Los archivos son enormes (OFICINAS tiene 29.000 líneas y una sola de 28.000
caracteres): **no abras un archivo completo**. Usá `Grep` para localizar y leé
solo el rango de líneas que haga falta.

Reportame:

1. En qué archivo y en qué línea está definido.
2. Quién lo llama (buscá el nombre en los otros archivos también: `contrato.js`
   e `ia.js` son compartidos, y OFICINAS y TECNICOS se pisan datos).
3. Si aparece definido **dos veces** en el mismo archivo, avisame fuerte: en
   JavaScript la última definición pisa a la anterior en silencio, y eso ya pasó
   antes en este repo (módulo de RRHH duplicado, ~38 KB de código muerto).
4. Si no lo llama nadie, decilo.
