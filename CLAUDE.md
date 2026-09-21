# PROYECTOVISION · Sistema interno

Sistema de gestión para un proveedor de internet (ISP). Páginas HTML autónomas,
sin proceso de compilación: se editan directamente y se publican tal cual.

## Reglas de trabajo (no negociables)

1. **Ediciones quirúrgicas.** Localizar la función con `Grep` y cambiar solo eso.
   Nunca reescribir un archivo completo ni reformatear lo que no se tocó.
2. **Entregar siempre el archivo completo** cuando se entregue código al usuario.
3. **Validar antes de decir que está listo**: `node .claude/validar.mjs <archivo>`.
   Si falla, no se entrega.
4. **Subir la constante de versión en cada entrega publicada** (ver la tabla).
   Sin eso, los navegadores siguen con la copia vieja en caché.
5. **Nunca borrar datos.** Lo que sobra se archiva a un documento aparte, se
   vuelve a leer para confirmar, y solo entonces se saca de la base.
6. **Mensajes de error en español**, dirigidos a quien va a leerlos: personal de
   oficina y técnicos de campo, no programadores.
7. **OFICINAS y TECNICOS escriben en las mismas colecciones.** Un cambio en la
   forma de los datos de una rompe la otra en silencio. Revisar ambas.
8. Antes de un cambio grande, usar **modo plan** (Shift+Tab) y aprobarlo primero.

## Aplicaciones

| Archivo | Para quién | Versión | Tamaño |
|---|---|---|---|
| `index.html` | Portal de entrada, solo enlaces | — | 170 líneas |
| `OFICINAS_PTOVISION.html` | Oficina: caja, cartera, facturas, clientes, RRHH, SG-SST | `APP_VERSION = 312` | 37.013 líneas · 2,7 MB |
| `INVENTARIO_PTOVISION.html` | Bodega: entradas, salidas, traslados, reportes | `APP_VERSION_INV = 111` | 11.311 líneas · 782 KB |
| `RED_PTOVISION.html` | Red y nodos | `APP_VERSION_RED = 41` | 9.404 líneas · 573 KB |
| `TECNICOS_PTOVISION.html` | Técnicos en campo (PWA, se instala en el celular) | `APP_VERSION_TEC = 97` | 3.402 líneas · 222 KB |
| `PRUEBAS.html` | Banco de pruebas (112 pruebas) | — | 5.204 líneas |
| `FIRMA_SST.html` | Firma desde el celular (SG-SST): página pública, sin login, lee un solo documento por token | — | 187 líneas |
| `contrato.js` | Contrato de servicio: **compartido** OFICINAS ↔ TECNICOS | `?v=6` | 956 líneas |
| `ia.js` | Llamadas a Groq: compartido por OFICINAS, INVENTARIO y TECNICOS | `?v=5` | 388 líneas |
| `checklists.js` | «Antes de llamar al ingeniero»: listas, motor y pantalla, **compartido** OFICINAS ↔ TECNICOS | `?v=1` | 1.413 líneas · 232 KB |
| `wisphub-explorador.html` | Herramienta aparte para explorar la API de WispHub | — | 391 líneas |

Las cifras de esta tabla se actualizan con `/revisar`. Si no cuadran con lo que
hay en disco, la tabla está vieja: manda el archivo.

## Publicación

GitHub Pages: <https://proyectovisionsas-bit.github.io/inventario/index.html>
Publicar = hacer push a `main`. No hay entorno de pruebas separado.

Cada app compara su constante de versión contra la guardada en Firestore. Si el
navegador tiene una versión vieja, se muestra una pantalla de bloqueo que obliga
a recargar (`#versionBlock`). **Al cambiar código hay que subir la constante de
versión**, o los usuarios seguirán con la copia vieja en caché.

## Comandos y herramientas de este repo

| Qué | Cómo |
|---|---|
| Validar sintaxis | `node .claude/validar.mjs [archivo]` — revisa cada bloque `<script>` propio |
| Correr las pruebas | abrir `PRUEBAS.html` en el navegador |
| Servidor local | `npx http-server -p 8791 -c-1` (está en `.claude/launch.json`) |
| Antes de publicar | `/revisar` |
| Publicar | `/publicar` |
| Auditar un cambio | subagente `revisor` |

## Cómo trabajar en este repo

- Los archivos son enormes y tienen líneas de hasta 29.000 caracteres. **No leer
  archivos completos**: usar `Grep` para localizar la función y editar solo esa parte.
- `OFICINAS` y `TECNICOS` escriben en las mismas colecciones. Un cambio en la
  forma de los datos de una **rompe la otra en silencio**. Revisar ambas.
- `APP_VERSION_FECHA` en OFICINAS es una línea corta; el historial de cambios va
  en los mensajes de commit.
- El módulo SG-SST vive en documentos `sgsst_*` propios (ver `docs/07-sgsst.md`):
  nada suyo va en `oficinas_sistema/main`. Sus funciones empiezan por `_sg`/`sg…SG`.
- Los finales de línea están fijados en `.gitattributes` (LF en el repo, CRLF en disco).

## Detalle por tema

Lo que sigue son las notas de arquitectura y los problemas ya resueltos. No se
cargan enteras: se leen cuando se toca ese tema.

- @docs/01-firestore-limites.md — el límite de 1 MiB por documento y el archivador
- @docs/02-contrato-de-servicio.md — contrato de servicio, `contrato.js`, condiciones por oficina
- @docs/03-datos-y-acceso.md — Firebase/Firestore y autenticación
- @docs/04-wisphub.md — sincronización con WispHub
- @docs/05-ia-y-servicios.md — Groq, OCR y servicios externos
- @docs/06-material-ordenes-y-limpiezas.md — bodega ↔ cuadrilla, estados de órdenes, limpiezas
- @docs/07-sgsst.md — SG-SST: documentos `sgsst_*`, firma desde el celular (`FIRMA_SST.html`), cálculos legales
- @docs/08-modo-mantenimiento.md — modo mantenimiento: documento `mantenimiento`, qué ve cada rol, cómo termina al publicar
- @docs/09-antes-de-llamar-al-ingeniero.md — listas de validación antes de escalar (`checklists.js`), documentos `esc_*` y `fallas_masivas`, cómo corregir un paso
- @docs/10-prestamos.md — préstamos: una cuenta por persona, `resumenPrestamo`/`estadoDe`, caja con reverso, tope y atraso, conciliación

## Pendientes conocidos

- **La clave de Groq está expuesta** en `oficinas_sistema/main`, que responde
  HTTP 200 a peticiones anónimas. Igual `compsDriveClave`. La salida es el
  Worker de Cloudflare que ya existe para WispHub. Ver `docs/05-ia-y-servicios.md`.
- `APP_VERSION_FECHA` quedó en una línea corta desde la v302 (12-09-2026); el
  historial anterior está en los mensajes de commit.
- **Tres documentos de Firestore van al 76–80% del límite** y nunca se partieron.
- **`ORDEN_ESTADOS` está duplicado** en OFICINAS y TECNICOS, sincronizado a mano.
  Es candidato natural a un `estados.js` compartido, como `contrato.js`.
- **`descargarDiagramaSVG`** en INVENTARIO quedó sin quien la llame.
