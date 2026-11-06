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
| `OFICINAS_PTOVISION.html` | Oficina: caja, cartera, facturas, clientes, RRHH, SG-SST | `APP_VERSION = 325` | 40.630 líneas · 3,1 MB |
| `INVENTARIO_PTOVISION.html` | Bodega: entradas, salidas, traslados, reportes | `APP_VERSION_INV = 122` | 25.875 líneas · 2,0 MB |
| `RED_PTOVISION.html` | Red y nodos | `APP_VERSION_RED = 44` | 9.759 líneas · 607 KB |
| `TECNICOS_PTOVISION.html` | Técnicos en campo (PWA, se instala en el celular) | `APP_VERSION_TEC = 103` | 4.290 líneas · 304 KB |
| `PRUEBAS.html` | Banco de pruebas (231 pruebas) | — | 21.798 líneas |
| `FIRMA_SST.html` | Firma desde el celular (SG-SST): página pública, sin login, lee un solo documento por token | — | 187 líneas |
| `contrato.js` | Contrato de servicio: **compartido** OFICINAS ↔ TECNICOS | `?v=6` | 956 líneas |
| `ia.js` | Llamadas a Groq: compartido por OFICINAS, INVENTARIO y TECNICOS | `?v=5` | 388 líneas |
| `checklists.js` | «Antes de llamar al ingeniero»: listas, motor y pantalla, **compartido** OFICINAS ↔ TECNICOS | `?v=1` | 1.413 líneas · 232 KB |
| `buzon.js` | Buzón de sugerencias: envío, «Mis ideas», muro con votos y tablero del admin, **compartido** por las cuatro apps | `?v=1` | 1.372 líneas · 90 KB |
| `recarga.js` | Recarga automática al publicar (cuenta de 30 s, solo con internet y sin guardados en curso), **compartido** por las cuatro apps | `?v=1` | 652 líneas · 34 KB |
| `pantallas.js` | Pantallas abiertas: latido de cada pantalla en `oficinas_sistema/sesiones_vivas` y panel del admin con las que siguen en versión vieja, **compartido** por las cuatro apps | `?v=1` | 925 líneas · 57 KB |
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

- @docs/01-firestore-limites.md — el límite de 1 MiB por documento, el archivador y los archivos por partes (desde OFICINAS 321 e INVENTARIO 121)
- @docs/02-contrato-de-servicio.md — contrato de servicio, `contrato.js`, condiciones por oficina
- @docs/03-datos-y-acceso.md — Firebase/Firestore y autenticación; cuánto dura la sesión de OFICINAS y «Recordar en este computador» (v325)
- @docs/04-wisphub.md — sincronización con WispHub
- @docs/05-ia-y-servicios.md — Groq, OCR y servicios externos
- @docs/06-material-ordenes-y-limpiezas.md — bodega ↔ cuadrilla, estados de órdenes, limpiezas
- @docs/07-sgsst.md — SG-SST: documentos `sgsst_*`, firma desde el celular (`FIRMA_SST.html`), cálculos legales
- @docs/08-modo-mantenimiento.md — modo mantenimiento: documento `mantenimiento`, qué ve cada rol, cómo termina al publicar
- @docs/09-antes-de-llamar-al-ingeniero.md — listas de validación antes de escalar (`checklists.js`), documentos `esc_*` y `fallas_masivas`, cómo corregir un paso
- @docs/10-prestamos.md — préstamos: una cuenta por persona, `resumenPrestamo`/`estadoDe`, caja con reverso, tope y atraso, conciliación
- @docs/11-buzon.md — buzón de sugerencias (`buzon.js`): documentos `buzon_<id>`, contrato `op` de cada app, privacidad, tablero del admin
- 🔴 Hay un pendiente de seguridad crítico cuyo detalle NO vive en este repositorio (es público). Ver «Pendientes conocidos».
- @docs/12-revision-sincronizacion-2026-10.md — revisión de sincronización por etapas (borrados que vuelven, equipo instalado que vuelve); Etapas 1, 6, 2, 3, 4, 4b, 5, 7 · F0 y 7 · E7-F2 hechas (F0: archivos por partes y la 📤 Entrega sin duplicar; E7-F2, INVENTARIO 122: el libro de movimientos, el registro largo y la lista de instalados, que se encienden desde el panel 🎛️): rastro, sello, vigilancia, recarga automática, pantallas abiertas, aprobaciones definitivas (lápidas por fila), nombres y filas repetidas (🧩 Unificar), ventanas con datos viejos, registros borrados que no vuelven y un serial, un sitio (🩺 Casos de seriales)

## Pendientes conocidos

- 🔴 **PENDIENTE DE SEGURIDAD CRÍTICO — el detalle NO se escribe aquí.**
  Este repositorio es **público** (GitHub Pages lo sirve y `raw.githubusercontent`
  lo entrega sin autenticar), así que describirlo aquí equivale a publicarlo. El
  documento con el hallazgo, su alcance y el orden de los pasos lo tiene **Elkin
  fuera del repositorio**.
  Antes de tocar el **login**, las **reglas de Firestore**, el **Worker de
  WispHub** o cualquier **clave de servicio**: pregúntale a Elkin y pídele ese
  documento. No lo copies de vuelta a este repo ni resumas su contenido aquí, ni
  en los `docs/`, ni en los comentarios del código.
  Dos advertencias para quien vaya a arreglarlo: el login de hoy **no usa
  autenticación de Firebase**, así que cerrar reglas sin reemplazarlo primero deja
  a las cinco oficinas sin entrar; y el arreglo se prueba con **una sola oficina**
  antes de soltarlo a todas.
- `APP_VERSION_FECHA` quedó en una línea corta desde la v302 (12-09-2026); el
  historial anterior está en los mensajes de commit.
- **Tamaños medidos el 21 oct 2026:** `inventario/datos` 57 %, `oficinas_sistema/main` 52 %, `inventario/clientes_4` 66 %. Los archivos de lo viejo ya van por partes (docs/01); la parte 1 de `ordenes_archivo_2026` quedó en 90 % y ya no se escribe. Vigilar con `vigilar_f0.cjs` (docs/12 §16).
- **`ORDEN_ESTADOS` está duplicado** en OFICINAS y TECNICOS, sincronizado a mano.
  Es candidato natural a un `estados.js` compartido, como `contrato.js`.
- **La revisión nocturna de soportes se para sola cuando Gemini se congestiona.**
  Corregido el 09-09-2026 en `REVISION_SOPORTES.gs` (espera 15 min en vez de
  terminar la noche, tres intentos con espera creciente, tope de noches
  saturadas de 3 a 8, y la cola pasa de 60 a 21 días para no llegar al 1 MiB).
  **El `.gs` hay que volver a pegarlo en el Apps Script del Drive**, y después
  ejecutar `probarConfiguracion()` e `instalarRevisionNocturna()`.
- **`descargarDiagramaSVG`** en INVENTARIO quedó sin quien la llame.
