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

**Desde la v112** lo tocado en los dos lados ya no se decide por cuadrilla
entera sino fila por fila y campo por campo (`_fusion3RegistroInv`, ver la
sección de la v112 más abajo).

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

## El equipo instalado ya no sigue en la cuadrilla (INVENTARIO v112 · TÉCNICOS v98 · 24 Sep 2026)

Elkin: "no descuenta" y "los equipos se instalan y siguen apareciendo". La
revisión del 23 sep 2026 encontró seis causas (I-1 a I-6). Cada una tiene una
prueba que falla con v111/v97 y pasa con v112/v98.

### El serial (I-2)

- **Antes:** el serial se comparaba letra por letra. Si llegaba en minúsculas,
  con espacios o en el otro formato de Huawei, no se encontraba. La confirmación
  descontaba una unidad de otra fila, así que quedaban filas en 0 con un serial
  adentro, que TÉCNICOS oculta.
- **Ahora:** hay una sola clave para decir si dos seriales son el mismo:
  `_snNormal` en INVENTARIO y `_snClaveTec` en TÉCNICOS.
  - Mayúsculas, sin espacios, guiones, puntos ni dos puntos.
  - `HWTC` + 8 hexadecimales pasa a `48575443` + los mismos 8. Vale para
    cualquier fabricante: 4 letras + 8 hexadecimales.
- **Solo es la clave para comparar:** el serial se guarda y se muestra como se
  escribió.
- **Dónde se usa:** "un serial, un sitio", los seriales repetidos, el rastro, la
  garantía y la Auditoría.
- **Las dos apps deben dar lo mismo.** `PRUEBAS.html` lo comprueba corriendo la
  función de TÉCNICOS contra la de INVENTARIO. Si se cambia una, se cambia la otra.

### Confirmar por unidad (I-1)

- **La lógica es pura.** `_planConsumoInv(cuad, consumo)` parte el consumo en
  unidades:
  - **Con serial:** se busca por su serial en TODA la cuadrilla, aunque la fila
    se llame distinto.
  - **Sin serial:** se mide con la suma de las filas del material, primero las de
    su mismo tipo.
  - Cada unidad aparta lo que usa antes de medir la siguiente. Un serial repetido
    en el mismo reporte no cuenta dos veces.
- **Quién la usa:**
  - la tarjeta de «Material por confirmar»;
  - la ventana `confirmarConsumo`, con una casilla por unidad (#ccConfirmar).
    Si el técnico no dijo el serial, la bodega lo escoge (`.ccEscoger`);
  - la transacción `_confirmarConsumoElegidos`, que vuelve a medir sobre los datos
    frescos.
- **Descuento:** `_aplicarUnidadesInv`. El serial sale de SU fila y esa misma fila
  baja 1, sin quedar por debajo de 0. Un serial que no está en la cuadrilla NO se
  descuenta de otra fila.
- **Lo que no se confirma:** `_partirItemsInv` lo separa y queda como un consumo
  pendiente APARTE.
  - Id `<id>_r<n>`, `parteDe`, `partidoMs`/`partidoFecha`, y una `nota` con el
    motivo.
  - Misma orden, misma cuadrilla y misma fecha del reporte.
  - El original queda confirmado. Sus `items` son lo confirmado; lo que reportó el
    técnico queda en `itemsReportados`, y `restoPendienteId` apunta al resto.
- **Rechazar:** `rechazarConsumo` avisa si el consumo trae un serial que SIGUE en
  la cuadrilla. Rechazar no la toca, y si ese equipo quedó instalado, seguiría
  apareciendo. Queda anotado en `rechazadoConEquipoEnCuadrilla`.

### Pantallas que se pisan (I-3) y el guardado general (I-5)

**Fusión fina.** `_fusion3RegistroInv(base, local, nube)` compara las tres
versiones campo por campo y fila por fila. Las filas se emparejan por `id`; las
viejas sin id, por nombre + tipo.

| Qué pasó | Qué queda |
|---|---|
| Esta pantalla no lo tocó | lo de la nube |
| Solo lo tocó esta pantalla | lo de aquí |
| `cantidad` tocada en los dos lados | se suman los dos cambios, nunca menos de 0 |
| `snes` tocados en los dos lados | lo que alguien quitó sale, lo que alguien agregó entra |
| Una fila quitada en un lado y cambiada en el otro | se conserva |
| Cualquier otro campo tocado en los dos lados | lo de aquí, como antes |

- **Dónde corre:** en `_protegerSnapshotInv` (el oyente) y en
  `_fusionarListasInv` (el guardado). Solo para `_COLS_FINAS_INV`
  (cuadrillas y bodegas) y solo cuando hay base.
- **Sin base,** gana lo local, igual que desde la v88.
- **Transacciones de confirmar, rechazar, entregar y cuartos:** lo que devuelven
  entra por `_aplicarNubeParcialInv`, igual que un snapshot, en vez de
  `DB.cuadrillas = …`. Un cambio de esta pantalla sin guardar en OTRA cuadrilla ya
  no se pierde.

**Guardado por transacción** (`_fbSaveCore`):

1. Antes y por fuera de la transacción: archivar (`_aligerarAutoInv`) y achicar
   las fotos grandes (`_comprimirFotosGrandesInv`). Las dos hacen E/S y trabajan
   sobre la memoria.
2. Dentro de la transacción:
   - leer `inventario/datos` y `inventario/historial` frescos;
   - fusionar;
   - dejar como base lo que se acaba de leer (`_fotoIdsRemotosInv(fd, fh)`), para
     que un reintento no confunda lo ajeno con lo propio;
   - escribir SOLO los campos de primer nivel que cambiaron
     (`_camposCambiadosInv`).

Si alguien escribe en medio, Firebase repite la transacción con los datos
nuevos. Un guardado que solo agrega una línea al registro ya no reescribe los
~800 KB. Con `?prueba=1` se sigue el camino de antes, con las escrituras
bloqueadas.

### Finalizar en un solo paso (I-4, V-2): TÉCNICOS v98

- **Antes:** finalizar eran dos escrituras, primero la orden y después el
  inventario. Si la segunda fallaba, la orden quedaba finalizada y el consumo
  nunca llegaba a la bodega.
- **Ahora:** `_aplicarFinalizacionTec(plan)` es UNA transacción sobre
  `oficinas_sistema/main` e `inventario/datos`. Lee los dos documentos antes de
  escribir. La usan tres flujos:
  - material o instalación (`_finalizarConMaterial`);
  - cambio de equipo (`_finalizarCambioEquipo`);
  - recogida (`confirmarFinalizarRecogida`, salvo en `MODO_EMERGENCIA`).
- **El plan:** `{id, ordenId, que, orden:{campos}, inv:{consumosPendientes,
  instalaciones, recuperados, equiposDanados}}`.
  - Se arma una vez, con ids fijos: hora + un sufijo aleatorio.
  - Reintentar nunca duplica, porque solo se agrega un registro si su id no está.
  - El nombre de la bodega que falte se completa con los datos frescos.
- **Sin señal:**
  - Antes de intentarlo, el plan se guarda en el celular, en
    `localStorage['tec_finalizaciones_pend']`. Con `?prueba=1` va en otra clave,
    `…_prueba`, que no toca la cola real.
  - `_enviarPendientesTec` lo reintenta al volver internet, cada minuto y 3 s
    después de entrar.
  - La orden sale «📤 Por enviar», sin botón de finalizar, y arriba de la lista
    hay una franja con «Reintentar».
- **Orden cancelada o ya cerrada:** la orden guarda `finPlanId` (la parte corta
  del id del plan). El plan se descarta, con aviso, en tres casos:
  - la orden está cancelada;
  - ya la finalizó OTRO plan;
  - ya estaba finalizada sin marca pero con material, cambio o equipos
    recuperados.

  El reintento del mismo plan no vuelve a escribir la orden, así no pisa lo que
  la oficina hizo después, como `retiroAplicado`. El traslado que luego registra
  su material sí pasa.
- **Pantallas atrasadas:** `avanzar`, reagendar y traslado tampoco mueven una
  orden cancelada o ya finalizada (`_verificarOrdenVivaTec`).
- **Disponible = lo que tiene la cuadrilla menos lo ya reportado y sin
  confirmar,** sea en la nube o en la cola del celular (`_reservasTec`,
  `_disponiblesTec`). Los seriales ya reportados no salen para escoger, tampoco
  al devolver material.
- **Sin señal no es "sin cuadrilla":** si la lectura falla,
  `_buscarCuadrillaDelTecnico` devuelve `{error}` y la ventana dice que no hay
  señal, con «Reintentar».

### Auditoría y revisiones nuevas (I-6)

- **`_audDias`:** acepta el registro (y usa `fechaMs`, `confirmadoMs`…) o un texto
  DD/MM/AAAA.
- **Consumos sin confirmar:**
  - solo cuenta los que están en estado `pendiente`;
  - usa los campos que escribe TÉCNICOS (`cuadrillaNombre`, `tecnicoNombre`,
    `destinoDetalle`);
  - compara la cédula solo por sus dígitos.
- **Sección nueva, «Equipo instalado que sigue en una cuadrilla»:** un serial de
  un consumo CONFIRMADO que todavía figura en una cuadrilla. No sale si después
  hubo una entrega con ese serial.
- **Botón nuevo, «🔎 Órdenes sin consumo»** (`revisarOrdenesSinConsumo`): cruza las
  órdenes finalizadas con material de los últimos 60 días con los consumos, los de
  la base y los archivados de este año y el anterior. Solo lee.

### Protecciones (W-6, V-5)

**INVENTARIO:**

- Si la nube tiene una versión mayor (`_versionViejaInv`), la pantalla no guarda
  ni hace transacciones. `?ignorarVersion` lo salta.
- Una copia local (`_esEntornoLocalInv`: localhost, la red de la casa o
  `file://`) no anuncia su versión.

**TÉCNICOS:**

- `?prueba=1` es un modo prueba de verdad (`MODO_PRUEBA_TEC`):
  - `_instalarGuardasTec` cubre en un solo punto las escrituras de
    `db.collection(…).doc(…)`, `db.runTransaction` y `db.batch`;
  - las transacciones leen de verdad y no escriben;
  - las listas de «Antes de llamar» no vacían su cola.
- Con una versión publicada mayor, la pantalla no escribe y lo finalizado espera
  en el celular.
- Una copia local no anuncia su versión.

### Qué cambia en los datos

Solo campos chicos:

- **Consumos:** `parteDe`, `partidoMs`, `partidoFecha`, `nota`,
  `itemsReportados`, `restoPendienteId`, `rechazadoConEquipoEnCuadrilla`.
- **Órdenes:** `finPlanId` (unos 20 caracteres).

OFICINAS y RED no leen `consumosPendientes`. La fusión de órdenes de OFICINAS
v314 conserva `finPlanId`.

### Pruebas (24 sep 2026, base simulada y compartida, datos inventados)

- **Funciones puras:** 50 comprobaciones con el código exacto
  (`unit_v112.js`).
- **Reproducción:** 21 escenarios con las apps reales en Chromium. Los 21 fallan
  con v111/v97 y pasan con v112/v98.
- **Comportamiento nuevo:** 20 escenarios, entre ellos:
  - la cola sin señal que sobrevive a una recarga;
  - dos bodegas confirmando el mismo consumo;
  - la entrega con cambios sin guardar;
  - el archivado junto con la transacción;
  - la respuesta que se pierde.
- **`PRUEBAS.html` completo:** 125 pruebas, ninguna empeora. Hay 7 nuevas;
  2 miran los datos reales sin escribir.
- **Trayectoria de punta a punta:** OFICINAS v314 → TÉCNICOS → OFICINAS →
  INVENTARIO → RED. 22 comprobaciones.
- **Revisión independiente:** encontró 5 puntos: 4 corregidos con su prueba y
  1 operativo (ver abajo). En la segunda pasada salieron 3 detalles menores,
  también corregidos.

### Al publicar

1. Publicar INVENTARIO v112 y TÉCNICOS v98 **juntos**, fuera de horario.
2. **Cerrar o recargar todas las pestañas de bodega.** Una pestaña v111 que quede
   abierta sigue guardando a la manera vieja detrás del aviso de versión: reescribe
   el documento completo y puede deshacer un descuento.
3. Los técnicos verán «actualizar». Hasta que actualicen, finalizan como antes,
   en dos pasos.
4. Probar un caso real de punta a punta:
   - el técnico finaliza con una ONU;
   - la bodega confirma;
   - la Auditoría ya no lo muestra.

### Pendiente

- **Corregir lo que ya quedó mal, caso por caso y con aprobación:** la Auditoría
  ya lista los equipos instalados que siguen en una cuadrilla y las órdenes sin
  consumo.
- **INVENTARIO reescribe los clientes por firma, sin fusión:** es parecido a W-3
  en OFICINAS.
