# PROYECTOVISION · Sistema interno

Sistema de gestión para un proveedor de internet (ISP). Cuatro páginas HTML
autónomas, sin proceso de compilación: se editan directamente y se publican tal cual.

## Aplicaciones

| Archivo | Para quién | Versión | Tamaño |
|---|---|---|---|
| `index.html` | Portal de entrada, solo enlaces | — | 152 líneas |
| `OFICINAS_PTOVISION.html` | Personal de oficina: caja, cartera, facturas, clientes | `APP_VERSION = 223` | 24.444 líneas, 674 funciones |
| `INVENTARIO_PTOVISION.html` | Bodega: entradas, salidas, traslados, reportes | `APP_VERSION_INV = 83` | 9.415 líneas, 318 funciones |
| `TECNICOS_PTOVISION.html` | Técnicos en campo (PWA, se instala en el celular) | `APP_VERSION_TEC = 74` | 2.279 líneas, 68 funciones |
| `wisphub-explorador.html` | Herramienta aparte para explorar la API de WispHub | — | 18 KB |

## `contrato.js` — código compartido entre apps

Es el primer archivo que **comparten** dos aplicaciones. Contiene el generador del
contrato de servicio y el logo institucional:

```
PV_CONTRATO.generarHTML(data)       -> devuelve el HTML del contrato
PV_CONTRATO.abrirParaImprimir(data) -> lo abre en pestaña nueva para imprimir
PV_LOGO                             -> logo en base64 (8.491 caracteres)
```

Se carga con `<script src="contrato.js?v=1"></script>`. En OFICINAS,
`_generarPDFContrato` es solo un delegado y `LOGO_PV` referencia a `PV_LOGO`,
así que el base64 existe **una sola vez** en todo el proyecto.

**Reglas al tocarlo:**
- **Nunca copiar su contenido dentro de un HTML.** El motivo de que exista es
  evitar lo que pasó con el módulo RRHH: dos copias que divergen en silencio.
- Al cambiarlo, **subir el `?v=N`** en las etiquetas `<script>` de todas las apps
  que lo cargan, o los navegadores servirán la copia vieja en caché.
- No debe depender de `DB`, `USER` ni de nada propio de una app: recibe `data` y
  devuelve HTML. Esa pureza es lo que permite usarlo desde TECNICOS.

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

## Flujo de material: bodega → cuadrilla → cliente

El técnico **nunca descuenta stock**. Reporta a `consumosPendientes` con
`estado:'pendiente'` y la bodega confirma. `confirmarConsumo` valida existencias
antes de descontar y bloquea si no alcanzan. Esa separación entre *reportar* y
*aprobar* es correcta y no debe eliminarse.

Las operaciones críticas van por transacción, envueltas en `_fbTransaccionInv`
(lee fresco → aplica → escribe atómico, con reintento de Firestore):
`confirmarConsumo`, `rechazarConsumo`, `saveEntregaLogic`, `_cuartosTx`.
Buscar `runTransaction` a secas engaña: casi todas pasan por el envoltorio.

TECNICOS escribe `cuadrillas` (stock de la cuadrilla) en dos flujos:
`tx.update(refI, { recuperados: recs, cuadrillas: cuads })` y el equivalente con
`equiposDanados`.

### ⚠️ Límite conocido de la fusión (sin resolver)

`_ejecutarSaveInv` sobreescribe el documento, pero antes llama a
`_fusionarConNubeInv` para incorporar lo de otras sesiones. En
`_fusionarListasInv`, un registro que existe en **ambos** lados se resuelve así:

```javascript
if(loc.estado==='pendiente' && item.estado && item.estado!=='pendiente') Object.assign(loc, item);
return; // demás conflictos: gana esta sesión
```

Una cuadrilla **no tiene campo `estado`**, así que la excepción nunca aplica y
siempre gana la copia local. Si un técnico descuenta material de su cuadrilla y
esta sesión guarda antes de que el listener refresque esa cuadrilla, el descuento
se revierte: el material queda en `recuperados` (camino a la bodega) **y** en el
stock de la cuadrilla. Contado dos veces — la misma clase de bug que arregló la v71.

La ventana es corta (hay 6 listeners en tiempo real), pero es sistemática.

**Por qué no se ha arreglado:** INVENTARIO también modifica `cuadrillas` y
`bodegas` fuera de transacción (`delMat`, `modalSendTrans`, `eliminarCuadrilla`,
`modalNewCuad`, `delBodega`), así que "gana la nube" descartaría el trabajo de la
bodega. La solución correcta es sellar esos registros con marca de tiempo en
**ambas** apps y que gane el más reciente — pero sellar solo algunos caminos crea
un bug peor. Requiere prueba con dos sesiones concurrentes antes de publicar.

## Contrato de estados de una orden (OFICINAS ↔ TECNICOS)

Las dos apps definen **cada una su propio** `ORDEN_ESTADOS`. Deben mantenerse
sincronizadas a mano: si se agrega un estado en una, hay que agregarlo en la otra.

| Estado | Significado |
|---|---|
| `pendiente` | recién creada, el técnico aún no la toma |
| `aceptada` | el técnico la tomó |
| `proceso` | trabajo en curso |
| `reagendar` | no se pudo; vuelve a `aceptada` |
| `finalizada` | terminal |
| `cancelada` | terminal; la escriben **ambas** apps |

Las dos resuelven con `ORDEN_ESTADOS[o.estado] || ORDEN_ESTADOS.pendiente`. Ese
respaldo evita que un estado desconocido rompa la pantalla, pero **lo disfraza de
`pendiente`** — con su botón de avance. Un estado que se escriba y no esté en el
mapa se ve como pendiente y se puede reactivar por error.

Al cancelar, ambas apps guardan los mismos campos: `motivoCancelacion`,
`canceladaPor`, `canceladaEn`. (Ojo: `fechaCancelacion` es otra cosa — pertenece
a los **clientes** que cancelan el servicio, no a las órdenes.)

TECNICOS itera el mapa en 0 sitios; OFICINAS lo recorre en 1 (arma el desplegable
de filtro por estado), así que agregar un estado allí **sí** cambia esa lista.

## Limpiezas hechas (rama `limpieza-rrhh`, 14 Ago 2026)

Se eliminó código duplicado que no se ejecutaba. En ambos casos había dos
definiciones con el mismo nombre, y en JavaScript **la última pisa a la
anterior en silencio** — la copia vieja quedaba inalcanzable.

- **OFICINAS**: el módulo de RRHH estaba dos veces (~38 KB, 28 funciones
  muertas). Se conservó `iniciales()`, que vivía en el bloque viejo pero la
  usa el render de avatares de otro módulo.
- **INVENTARIO**: `modalDiagramaCompleto` estaba dos veces (~11,5 KB).

**Función huérfana sin resolver:** `descargarDiagramaSVG` en INVENTARIO sigue
definida pero **nadie la llama**. Su único invocador estaba dentro de la copia
muerta del modal de diagrama. Es decir: el modal viejo permitía descargar el
diagrama como imagen y el nuevo no. Se dejó en el archivo por si conviene
volver a conectarla.

## Cómo trabajar en este repo

- Los archivos son enormes y tienen líneas de hasta 29.000 caracteres. **No leer
  archivos completos**: usar `Grep` para localizar la función y editar solo esa parte.
- `OFICINAS` y `TECNICOS` escriben en las mismas colecciones. Un cambio en la
  forma de los datos de una **rompe la otra en silencio**. Revisar ambas.
- `APP_VERSION_FECHA` en OFICINAS se usa hoy como historial de cambios, con
  párrafos enteros dentro del código. Ahora que hay git, ese historial va en los
  mensajes de commit; ese campo debería quedar en una línea.
- Los finales de línea están fijados en `.gitattributes` (LF en el repo, CRLF en disco).
