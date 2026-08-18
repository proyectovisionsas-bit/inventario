# PROYECTOVISION · Sistema interno

Sistema de gestión para un proveedor de internet (ISP). Cuatro páginas HTML
autónomas, sin proceso de compilación: se editan directamente y se publican tal cual.

## Aplicaciones

| Archivo | Para quién | Versión | Tamaño |
|---|---|---|---|
| `index.html` | Portal de entrada, solo enlaces | — | 152 líneas |
| `OFICINAS_PTOVISION.html` | Personal de oficina: caja, cartera, facturas, clientes | `APP_VERSION = 229` | ~23.900 líneas |
| `INVENTARIO_PTOVISION.html` | Bodega: entradas, salidas, traslados, reportes | `APP_VERSION_INV = 86` | ~9.000 líneas |
| `TECNICOS_PTOVISION.html` | Técnicos en campo (PWA, se instala en el celular) | `APP_VERSION_TEC = 76` | ~2.400 líneas |
| `contrato.js` | Contrato de servicio: **compartido** por OFICINAS y TECNICOS | `?v=2` | ~550 líneas |
| `wisphub-explorador.html` | Herramienta aparte para explorar la API de WispHub | — | 18 KB |

## Flujo del contrato de servicio

| Dónde | Qué puede hacer |
|---|---|
| OFICINAS · ficha del cliente | 📄 Contratos: ver, reimprimir, firmar, PDF |
| OFICINAS · barra de clientes | ⚙️ Condiciones: precios de esa oficina |
| TECNICOS · orden con cliente | 📄 Contrato: generar, firmar y compartir en el sitio |

Un contrato = **un documento** `oficinas_sistema/contrato_<id>` con
`tipo:'contrato'`. Se buscan con una sola condición de igualdad sobre
`clienteCedula`, así que Firestore no pide índice compuesto y los demás
documentos de la colección (incluido `main`) ni se descargan. La firma va
dentro del documento (~4 KB); el documento completo ronda los 6 KB de 1024.

**No hizo falta cambiar las reglas de Firestore**: `match /oficinas_sistema/{docId}`
ya cubre cualquier documento de esa colección.

### Compartir el PDF

`PV_CONTRATO.compartirPDF(data)` devuelve `'archivo'`, `'descarga'` o `'cancelado'`.

- **Celular** (TECNICOS es una PWA en Android): `navigator.share` adjunta el PDF
  de verdad; WhatsApp recibe el archivo, no un enlace.
- **Computador**: el navegador no permite adjuntar, así que se descarga y se
  avisa al usuario. No es un fallo: es el límite de la plataforma.

`jsPDF` y `html2canvas` se cargan **solo al pedir un PDF**, no en cada arranque.

## `contrato.js` — código compartido entre apps

Es el primer archivo que **comparten** dos aplicaciones. Contiene el generador del
contrato de servicio y el logo institucional:

```
PV_CONTRATO.generarHTML(data)        -> HTML del contrato
PV_CONTRATO.abrirParaImprimir(data)  -> lo abre en pestaña nueva para imprimir
PV_CONTRATO.generarPDF(data)         -> Blob del PDF
PV_CONTRATO.compartirPDF(data)       -> 'archivo' | 'descarga' | 'cancelado'
PV_CONTRATO.puedeCompartirArchivos() -> true si el equipo puede adjuntar
PV_CONTRATO.firma.{iniciar,limpiar,vacia,obtener}
PV_LOGO                              -> logo en base64 (8.491 caracteres)
```

Se carga con `<script src="contrato.js?v=2"></script>`. En OFICINAS,
`_generarPDFContrato` es solo un delegado y `LOGO_PV` referencia a `PV_LOGO`,
así que el base64 existe **una sola vez** en todo el proyecto.

**Reglas al tocarlo:**
- **Nunca copiar su contenido dentro de un HTML.** El motivo de que exista es
  evitar lo que pasó con el módulo RRHH: dos copias que divergen en silencio.
- Al cambiarlo, **subir el `?v=N`** en las etiquetas `<script>` de todas las apps
  que lo cargan, o los navegadores servirán la copia vieja en caché.
- No debe depender de `DB`, `USER` ni de nada propio de una app: recibe `data` y
  devuelve HTML. Esa pureza es lo que permite usarlo desde TECNICOS.

## Condiciones del contrato por oficina

Los valores del contrato **cambian según la oficina** (hay 4: YESCENIA, ESNEIDER,
NATALIA, THOMAS). Cada una guarda los suyos en `oficina.contratoConfig`, y el
formulario de contrato llega prellenado.

`CONTRATO_CAMPOS` en OFICINAS es la única fuente de verdad: relaciona cada valor
guardado con su campo del formulario (`ctr_*`) y su valor por defecto. **Para
agregar un campo nuevo basta con añadir una fila ahí** — el modal de
configuración y el prellenado se generan de esa lista.

- `_aplicarConfigContrato(oid)` corre al abrir el modal de contrato y **solo
  llena lo que esté vacío o en cero**: nunca pisa lo que el asesor ya escribió.
- Editan el admin (cualquier oficina) y el rol `oficina` (solo la suya).

### ⚠️ Hay DOS listas de clientes — no confundirlas

| | Dónde | Cuántos | Para qué |
|---|---|---|---|
| **Comercial** | `oficinas_sistema/clientes_<ofiId>_<i>`, cargados en `oficina.clientes` por `_cargarClientesChunks` | **2.711** | la que ve el módulo de clientes de OFICINAS y la que usa el contrato |
| Técnica | `inventario/clientes_<i>` | 3.672 | equipos, ONU, señal |

La comercial es mucho más completa. Cobertura medida:

| Campo | Comercial | Técnica |
|---|---|---|
| nombre, direccion, telefono, plan, fechaInstalacion, estado | 100% | 87–100% |
| **tarifaMensual** | **100%** | 0% |
| **cedula** | **99%** | 73% |
| **barrio** | **99%** | 44% |
| email | — | 100% |

El correo solo está en la técnica; la tarifa y la cédula, solo completas en la
comercial. El contrato usa la **comercial**.

El contrato pide nombres y apellidos por separado y el cliente los tiene en un
solo campo `nombre`. `_partirNombre` asume dos apellidos (lo habitual en
Colombia), pero con tres palabras o partículas ("DE LA") se equivoca: es una
**propuesta editable**, nunca se guarda partida.

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

> **ADVERTENCIA DE SEGURIDAD — sin resolver (verificado el 17 Ago 2026)**
> Las reglas son `allow read, write: if true;` en las tres colecciones.
> Comprobado: una petición anónima a `oficinas_sistema/main` responde HTTP 200
> y entrega ~4,5 MB. La `apiKey` está en el código de un sitio público, así que
> cualquier persona en internet puede **leer** toda la base (empleados, claves
> en texto plano, clientes, facturación) y **escribir o borrar** en ella.
>
> Cerrar las reglas exige primero poner autenticación real: hoy nadie se
> autentica ante Firebase, así que `if request.auth != null` tumbaría las tres
> apps de inmediato. El plan acordado es migración progresiva — los dos métodos
> conviviendo, cada empleado migrándose al entrar — y cerrar las reglas al final.

## WispHub (facturación) — solo en OFICINAS

702 menciones en OFICINAS, **cero** en INVENTARIO y TECNICOS. 32 funciones.
Todas las llamadas pasan por un Worker de Cloudflare
(`intermediario-wisphub.proyectovisions-a-s.workers.dev`) con la cuenta en la
cabecera `X-Cuenta`; la clave nunca está en el navegador.

- `_fetchWispJson` — 4 intentos con espera creciente, trata el 404 aparte.
- `_wisphubTraerPaginado` — 300 por página, en lotes de 6 en paralelo.
  **Lanza error si una página falla**, nunca la omite. Topes: 50 páginas para
  clientes (15.000) y 200 para facturas (60.000). Si el total los supera,
  **avisa** que los datos quedaron incompletos (antes truncaba en silencio).
- `_filtrarPorZonaOficina` — reparte los clientes de una cuenta entre oficinas
  por zona. Normaliza agresivamente, incluido el **U+007F que WispHub añade al
  final** de los nombres de zona. Sin zonas configuradas trae todo; si además la
  cuenta es compartida, ahora avisa antes de mezclar carteras.
- Pagos: `_aplicarPagosWisphubEnMemoria` no los duplica — compara contra
  `movimiento.facturaWisphub` usando `String(f.id_factura).trim()` en ambos lados.

Estado de las cuentas (medido el 17 Ago 2026): las 4 oficinas tienen cuenta,
3 cuentas distintas, ESNEIDER y NATALIA comparten una **y ambas tienen zonas**.
Ninguna oficina en riesgo de mezclar carteras.

### La sincronización automática (una sola)

`_programarSyncRapida` → `sincronizarRapidaPagos`, que `enterApp` arranca:
corre 9 s después de abrir y **cada 12 minutos**, trayendo los **pagos de los
últimos 4 días**. Es lo que el usuario ve al entrar ("varios pagos se registraron").

Consulta por `?fecha_pago=<día>`, **no** por fecha de emisión: una factura de
hace un año pagada hoy entra igual. Esa es la razón de que baste con 4 días.
Además:

- salta las facturas ya aplicadas (`movimiento.facturaWisphub`) → es idempotente;
- si un día falla lo anota en `DB.config._diasSyncPend[cuenta]` y lo reintenta
  en la siguiente pasada → se cura sola tras un corte de red;
- pagina con un bucle sin tope, así que **no** le aplica el truncamiento.

**El historial de facturas (`DB.facturasHistorial`, la cartera) NO lo toca**:
eso solo lo actualiza `_aplicarFacturasWisphub`, desde los botones manuales.
En esta empresa se sincroniza a diario, y por eso alcanza.

En la v234 se eliminó una segunda sincronización automática que llevaba tiempo
desactivada (`iniciarAutoSyncWisphub`, `_autoSyncWisphubTick`,
`_mostrarNotifSync`, `_mostrarNotifFacturas`): traía el histórico COMPLETO de
facturas cada 15 minutos y por oficina. Si alguna vez hace falta refrescar la
cartera sola, hacerla **incremental** como la de pagos — no revivir aquella.

**No confundir con el mensaje "Sincronizando con la nube, no cierres la
ventana"**: ese es el guardado en Firestore, no WispHub.

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

### Conflictos en `cuadrillas` y `bodegas` — resuelto en v88

En estas dos colecciones un conflicto no es cosmético: es material que aparece o
desaparece. Antes había dos reglas fijas, y ninguna era correcta en ambos sentidos:

- el **listener** hacía `Object.assign(DB, entrante)` → la nube pisaba una edición
  local todavía sin guardar;
- **`_fusionarListasInv`** se quedaba con la copia local → revertía el descuento
  que un técnico acababa de hacer, dejando el material en `recuperados` **y** en
  la cuadrilla. Contado dos veces.

Ahora la pregunta no es quién llegó último sino **quién tocó el registro**.
`_guardarBaseStockInv` guarda el contenido de cada registro tal como estaba en la
última sincronía (mismo momento en que se toma la foto de ids: tras guardar, al
arrancar y al recibir snapshot). `_sesionTocoInv(col, item)` compara contra esa
base y responde si esta sesión lo modificó.

- **No lo tocó** → entra lo de la nube (en el listener y en la fusión).
- **Sí lo tocó** → se conserva lo local.
- **Sin base o registro desconocido** → gana lo local, igual que antes. Si algún
  camino se escapa, degrada al comportamiento anterior en vez de perder datos.

Aplica **solo** a `COLS_STOCK_INV = ['cuadrillas','bodegas']`; el resto de
colecciones conserva su regla. Las decisiones ajenas (`pendiente` →
`confirmado`/`integrado`) se siguen respetando por delante de todo esto.

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

## Limpiezas hechas (rama `limpieza-rrhh`, 17 Ago 2026)

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
