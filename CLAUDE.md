# PROYECTOVISION · Sistema interno

Sistema de gestión para un proveedor de internet (ISP). Cuatro páginas HTML
autónomas, sin proceso de compilación: se editan directamente y se publican tal cual.

## Aplicaciones

| Archivo | Para quién | Versión | Tamaño |
|---|---|---|---|
| `index.html` | Portal de entrada, solo enlaces | — | 152 líneas |
| `OFICINAS_PTOVISION.html` | Personal de oficina: caja, cartera, facturas, clientes | `APP_VERSION = 223` | 25.048 líneas, 703 funciones |
| `INVENTARIO_PTOVISION.html` | Bodega: entradas, salidas, traslados, reportes | `APP_VERSION_INV = 83` | 9.623 líneas, 319 funciones |
| `TECNICOS_PTOVISION.html` | Técnicos en campo (PWA, se instala en el celular) | `APP_VERSION_TEC = 74` | 2.279 líneas, 68 funciones |
| `wisphub-explorador.html` | Herramienta aparte para explorar la API de WispHub | — | 18 KB |

## Publicación

GitHub Pages: <https://proyectovisionsas-bit.github.io/inventario/index.html>
Publicar = hacer push a `main`. No hay entorno de pruebas separado.

Cada app compara su constante de versión contra la guardada en Firestore. Si el
navegador tiene una versión vieja, se muestra una pantalla de bloqueo que obliga
a recargar (`#versionBlock`). **Al cambiar código hay que subir la constante de
versión**, o los usuarios seguirán con la copia vieja en caché.

## Datos: Firebase / Firestore

Proyecto `inventario-88a28`. SDK compat 9.23.0 por CDN (un punto usa el modular 10.12.0).

Colecciones:
- `oficinas_sistema` — documento único `main`. **Contiene casi todo el sistema**:
  empleados, oficinas, clientes, órdenes, configuración. 58 referencias en el código.
- `inventario` — datos de bodega. 17 referencias.
- `facturas_servicios` — 2 referencias.

### Cuidado con el documento `oficinas_sistema/main`

Toda la aplicación lee y escribe ese único documento. Dos consecuencias:

1. **Está cerca del límite de Firestore.** Un documento no puede pasar de 1 MiB.
   Vía REST el documento ya devuelve ~4,5 MB de JSON (el formato REST es varias
   veces más verboso que el interno, así que el tamaño real es menor, pero el
   margen se está agotando). Cuando se alcance el límite, **las escrituras
   empezarán a fallar**. Conviene medir el tamaño real y planear la partición.
2. **Cualquier cambio reescribe el documento completo**, con riesgo de que dos
   usuarios se pisen los cambios.

## Autenticación (ver ADVERTENCIA abajo)

No se usa Firebase Auth. El login es propio: el navegador descarga
`oficinas_sistema/main` completo y compara documento y clave en JavaScript
(`empleados.find(e => e.documento === doc && e.tecnicoPass === pass)`).
Las claves se guardan **en texto plano** en el campo `tecnicoPass`.

> **ADVERTENCIA DE SEGURIDAD — sin resolver (verificado el 14 Ago 2026)**
> Las reglas de Firestore permiten **lectura sin autenticar**. Una petición
> anónima a `oficinas_sistema/main` responde HTTP 200 y entrega ~4,5 MB.
> Como la `apiKey` está en el código de un sitio público, cualquier persona en
> internet puede descargar toda la base: empleados, claves en texto plano,
> clientes y facturación. **Falta verificar si también permite escritura.**
> Corregir esto tiene prioridad sobre cualquier función nueva.

## Servicios externos

- **Groq** (`api.groq.com`) — IA para lectura de comprobantes. La clave la pone el usuario.
- **Tesseract.js** — OCR en el navegador.
- **Google Drive** (`googleapis.com/drive/v3`) — respaldos.
- **Google Apps Script** — endpoint `/macros/s/.../exec`.
- **Cloudflare Worker** — `intermediario-wisphub.proyectovisions-a-s.workers.dev`, intermediario hacia WispHub.
- **SheetJS (xlsx)** y **Chart.js** por CDN — exportar a Excel y gráficas.

## Cómo trabajar en este repo

- Los archivos son enormes y tienen líneas de hasta 29.000 caracteres. **No leer
  archivos completos**: usar `Grep` para localizar la función y editar solo esa parte.
- `OFICINAS` y `TECNICOS` escriben en las mismas colecciones. Un cambio en la
  forma de los datos de una **rompe la otra en silencio**. Revisar ambas.
- `APP_VERSION_FECHA` en OFICINAS se usa hoy como historial de cambios, con
  párrafos enteros dentro del código. Ahora que hay git, ese historial va en los
  mensajes de commit; ese campo debería quedar en una línea.
- Los finales de línea están fijados en `.gitattributes` (LF en el repo, CRLF en disco).
