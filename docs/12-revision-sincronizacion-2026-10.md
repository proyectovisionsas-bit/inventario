# Revisión de sincronización — 9 oct 2026

**Versiones revisadas:** INVENTARIO v113 · TÉCNICOS v99 · OFICINAS v318 (lo publicado, commit `58fb891`).

**Para Claude Code.** Elkin te va a pedir algo como: *"Lee docs/12-revision-sincronizacion-2026-10.md y haz la Etapa 1"*.
Haz **una etapa por vez**, con sus pruebas, y para al terminar cada una para que Elkin la revise.
**No publiques** (no hagas push) hasta que Elkin escriba «publica».

**Validado con ChatGPT (9 oct 2026).** Coincide con el diagnóstico. Sus aportes ya están dentro de las etapas, marcados «(ChatGPT)», y el resumen está en §8. **Orden recomendado: 1 → 6 → 2 → 3 → 4 → 5**; las Etapas 7 y 8 van después, con plan aparte.

---

## 1. Qué reporta Elkin

1. Una bodega pide borrar un artículo, el admin aprueba, y el artículo no se borra, o se borra y después vuelve.
2. El técnico instala, el equipo sale de la cuadrilla y después vuelve a aparecer en la cuadrilla aunque ya figura instalado.

## 2. Reglas de esta tarea (además de las de CLAUDE.md)

- **No quitar nada que hoy funciona.** Antes de tocar una función, lee su bloque de comentarios: casi todas traen el porqué de un arreglo anterior.
- **No tocar** la separación reportar/aprobar (el técnico reporta, la bodega confirma), la confirmación por unidad de la v112 (`_planConsumoInv`, `_aplicarUnidadesInv`, `_partirItemsInv`) ni el envío idempotente de TÉCNICOS v98 (`_aplicarFinalizacionTec` y su cola).
- **Cada arreglo con su prueba:** una prueba que falla con v113 y pasa con el arreglo (ya están escritas, ver §6).
- **Antes de dar una etapa por lista:** `node .claude/validar.mjs <archivo>`, las 21 de `repro.js`, las 20 de `escenarios2.js` y `PRUEBAS.html` completo. Nada puede empeorar.
- **Nunca borrar datos.** Lo que sobre se archiva.
- **Subir versión** (`APP_VERSION_INV` → 114, y `APP_VERSION_TEC` → 100 si se toca TÉCNICOS; `APP_VERSION` de OFICINAS → 319 y `APP_VERSION_RED` → 43 si se tocan) solo en la entrega que se vaya a publicar.
- Mensajes en español, para personal de bodega y oficina.

---

## 3. Qué se encontró en los datos reales

Revisión **solo lectura** del 9 oct 2026, con INVENTARIO abierto en `?prueba=1` (escrituras bloqueadas, 0 escrituras intentadas).

| Hallazgo | Detalle |
|---|---|
| Borrados que "vuelven" | 34 solicitudes de borrado: 28 aprobadas y 6 pendientes. Ninguna aprobada tiene de vuelta el **mismo** artículo (mismo id), pero en 7 hay hoy **otra fila con el mismo nombre**. DONCELLO pidió borrar las mismas filas vacías varias veces (19-sep, 22-sep, 6-oct y 9-oct): se recrean con cada devolución, y muchas tienen el nombre escrito distinto (`TV BOX TV98 PRO` / `TV BOX  TV98 PRO` / `TV BOX TV 98 PRO`, `ONT EG8141A5` / `ONU EG8141A5` / `EG8141A5`). |
| Solicitudes repetidas | Las 6 pendientes son 3 pares: los mismos 3 artículos pedidos el 6-oct y otra vez el 9-oct. |
| Equipo instalado que sigue en la cuadrilla | 4 consumos **confirmados** cuyo serial sigue en una cuadrilla: 15-sep ×2 (PAUJIL), 30-sep (FLORENCIA) y 5-oct (PAUJIL). Los dos últimos son **posteriores** a la v112. Con el código actual, la confirmación de esos mismos registros **sí** saca el serial (se probó la función real sobre los registros reales), así que algo lo volvió a meter después. |
| Seriales en dos sitios | 38 seriales figuran en dos o más sitios (bodegas y cuadrillas). 4 filas de cuadrilla tienen una cantidad distinta al número de seriales. |
| Registro de actividad inútil | En la nube solo quedaban **6** entradas, y todas dicen usuario **"Sistema"**. Por eso no se puede saber quién volvió a meter esos seriales. |

## 4. Fallas confirmadas con pruebas simuladas

Las pruebas usan las apps reales en Chromium contra un Firestore simulado y compartido, con datos inventados. Ver §6.

| Prueba | Qué pasa con v113 | Resultado |
|---|---|---|
| R1 | El admin aprueba borrar y la bodega tiene la pantalla abierta, sin tocar ese artículo | ✅ el artículo no vuelve |
| **R2** | El admin aprueba borrar, pero la pantalla de la bodega había cambiado **cualquier dato de ese artículo** (p. ej. la observación) | ❌ **el artículo vuelve** |
| **R3** | El guardado de la aprobación falla 4 veces (sin internet) | ❌ la pantalla del admin dice "aprobada" y sin el artículo; la nube sigue "pendiente" y con el artículo, y **al volver la señal no se reenvía** |
| **R4** | La bodega pide dos veces borrar el mismo artículo | ❌ quedan **2 solicitudes pendientes** |
| **R5** | Se integra un equipo devuelto cuyo nombre tiene otro espaciado | ❌ se crea **otra fila** |
| R6 | Se aprueba borrar una fila vacía y luego se integra una devolución del mismo equipo | informativo: la fila se recrea con id nuevo; para la bodega, "volvió" |
| **R7 / R7b** | "Corregir Cantidades" está abierta cuando llega una sincronización (p. ej. otra pantalla confirma un consumo) | ❌ **la corrección del admin se pierde en silencio** (el equipo instalado no vuelve) |
| R8 | La bodega confirma y el admin guarda varias veces con la cuadrilla en su pantalla | ✅ el descuento se mantiene |
| **R9** | Una bodega registra actividad | ❌ queda como **"Sistema"** |
| **R10** | Dos pantallas registran actividad a la vez | ❌ **se pierden las entradas de una** |

Las 21 pruebas de `repro.js` (v112/v98) siguen pasando con v113.

## 5. Causas y arreglos, por etapas

Cada etapa es independiente y se puede publicar sola. **El orden importa:** la Etapa 1 da el rastro para entender lo que vuelva a pasar.

### Etapa 1 — Rastro confiable y vigilancia (riesgo bajo) · pruebas R9, R10

**Causa C6:**
- `logMsg` (INVENTARIO, línea ~526) lee `window.USER`, pero `USER` está declarado con `let` (línea ~452), así que `window.USER` siempre es `undefined` y todo queda como "Sistema".
- `logs` está en `HISTORIAL_FIELDS` (línea ~10610) pero **no** en `COLS_HIST_INV` (línea ~11354): se escribe el arreglo completo y gana el último que guarda.

**Arreglo:**
1. `logMsg` usa `USER` (no `window.USER`). Cada entrada lleva: un `id` único (hora + sufijo aleatorio), `app:'INV'`, `version:APP_VERSION_INV`, el usuario, un id de sesión fijo por pestaña (`sessionStorage`) y **(ChatGPT)** un id de equipo: uno aleatorio que se guarda una vez en `localStorage` de ese navegador.
2. Fusionar `logs` por `id`, como las demás listas del historial. La forma más chica es agregar `'logs'` a `COLS_HIST_INV`; las entradas viejas sin `id` se conservan tal cual. Mantener el tope de 200, ordenadas por `t`.
   - **(ChatGPT) Mejor aún, cada evento también como documento propio**, que ninguna pantalla reescribe: una colección nueva (p. ej. `inventario_actividad`) con un documento por evento: `{id, app, version, usuario, rol, sesion, equipo, accion, msg, t: serverTimestamp(), tCliente}` y, si el evento mueve stock, `antes` y `despues` (cantidad y seriales).
   - El panel de actividad lee de ahí los últimos 200. Se sigue escribiendo también el arreglo `logs` (con la fusión por `id`), para que nada que lo lea deje de funcionar; en el panel se ve como «registro anterior».
   - **Antes de hacerlo, revisa si las reglas de Firestore permiten esa colección.** Si no, no cambies las reglas sin Elkin: quédate solo con la fusión por `id`.
3. **Sello de escritura.** En `_fbSaveCore` y en las transacciones de `_fbTransaccionInv`, escribir junto con lo demás un campo chico `_ultimaEscritura:{app, version, quien, sesion, ms, campos:[...]}`. Opcional: una lista `_escrituras` con las últimas 30.
   - Si la nube trae menos de lo esperado, esto dice qué pantalla y qué versión lo escribió.
   - Lo mismo en las transacciones de TÉCNICOS que tocan `inventario/datos` (devolución, dañados, consumos, bandeja).
   - **(ChatGPT)** Agregar al sello `equipo` y `en: serverTimestamp()` (hora del servidor). La Etapa 6b lo usa.
4. **(ChatGPT) Respaldo de datos.** Si INVENTARIO ya tiene cómo descargar `inventario/datos` e `inventario/historial`, úsalo; si no, un botón de admin «⬇️ Descargar respaldo» que solo lee y baja un JSON con fecha y hora. Elkin descarga uno antes de cada publicación y antes de corregir datos (Etapa 5).
5. **(ChatGPT) Medidor de tamaño.** En el panel de admin, el tamaño aproximado de `inventario/datos` (bytes del JSON en UTF-8): amarillo desde 900 KB, rojo desde 980 KB. Si pasa de 1 MiB, Firestore rechaza el guardado y nadie puede guardar.
6. **(ChatGPT) Chequeo de inventario, solo lectura.** Contar y listar, sin corregir nada:
   - seriales en dos o más sitios;
   - seriales en una bodega o cuadrilla que ya tienen un consumo confirmado (instalados);
   - cantidades negativas;
   - filas con seriales cuya cantidad no coincide con el número de seriales.

   Si la 🩺 Auditoría ya lo hace, solo agregar lo que falte y el contador en el panel de admin. Ideal: cuando el número sube entre una sincronización y la siguiente, mostrar el `_ultimaEscritura` de esa escritura. Así se sabe qué pantalla y qué versión lo causó.
7. **Recarga automática al publicar (pedido de Elkin).** Hoy, cuando una versión nueva se anuncia, las pantallas abiertas muestran «¡Hay una versión nueva!» y dejan de guardar, pero esperan a que alguien toque el botón. El anuncio está en `inventario/app_version`, `oficinas_sistema/app_version` y `oficinas_sistema/app_version_tecnicos`. Hacer que se recarguen solas, en INVENTARIO, OFICINAS y TÉCNICOS:
   - al salir el aviso, cuenta regresiva visible de 30 s («Se actualizará sola en…») con el botón «Actualizar ahora»; al terminar, la misma recarga que ya hace el botón (`?nv=` + hora);
   - solo con internet: sin señal, esperar al evento `online`. Si no, la página queda en blanco, sobre todo en el celular del técnico;
   - esperar a que termine cualquier guardado o transacción en curso;
   - TÉCNICOS: si el aviso sale con un formulario a medias (una instalación), no perder lo escrito. Dejar terminarlo para que quede en la cola del celular, como hoy pasa con lo pendiente, y recargar al enviarlo; la versión nueva lo sube. Verificar que eso funcione con el bloqueo activo; si no, guardar el borrador antes de recargar;
   - antes de recargar, bajar la página sin caché y confirmar que ya trae la versión nueva, porque GitHub Pages tarda unos minutos. Si todavía no la trae, reintentar cada 60 s. Máximo 3 recargas automáticas en 10 minutos (contador en `sessionStorage`); después, solo el botón;
   - un retraso al azar de 0 a 20 s, para que no recarguen todas al mismo segundo;
   - RED no tiene aviso de versión nueva: agregarle el mismo mecanismo, con su propio documento de versión.

   Solo funciona en pantallas que ya tengan este código: la primera vez, las pantallas con las versiones de hoy todavía necesitan el botón.
   Prueba: dos pantallas abiertas y una versión mayor anunciada en el Firestore simulado. La que no tiene nada pendiente se recarga sola; la que tiene un guardado en curso espera a que termine; sin red, espera a que vuelva.

### Etapa 2 — Una aprobación es definitiva (riesgo medio) · pruebas R2, R3, R4

**Causa C1 (R2):**
- En `_fusionF3Lista` (línea ~7871), "una fila quitada en un lado y cambiada en el otro se conserva".
- Para un borrado que **aprobó el admin** eso está mal: cualquier cambio de la otra pantalla (una observación, una línea de `historial`, o lo que `fixDB` agregue) resucita el artículo.

**Arreglo C1:** **lápida por fila.**
1. Al borrar una fila de `materiales` por decisión del admin, se registra una lápida:
   - dónde: `approveDelete` (línea ~7376); `delMat` cuando lo hace el admin (línea ~7148); "Corregir Cantidades" cuando quita filas en 0.
   - forma: `{col:'bodegas'|'cuadrillas', id:<registro>, fila:<id de la fila>, en:<ms>}`. Puede ir en `DB._tumbas` con el campo `fila`, o en una lista aparte.
   - **(ChatGPT) Estas lápidas no se podan a los 15 días / 800**, como las de registros: una pestaña abierta más tiempo resucitaría la fila. Guardarlas al menos 180 días (son chicas). Si el tamaño aprieta, que vivan en `inventario/historial` y se lean dentro de la misma transacción.
2. `_fusionF3Lista` (o su llamador) recibe las lápidas: una fila con lápida **no vuelve**, aunque el otro lado la haya cambiado.
3. Aplica en las dos fusiones: la del oyente (`_protegerSnapshotInv`) y la del guardado (`_fusionarListasInv`).
4. Sin lápida, la regla actual se queda igual: es la que protege lo que una pantalla todavía no subió.
5. **(ChatGPT)** Si al aprobar ya no existe la bodega o el artículo, hoy queda `estado:'aprobada'` sin haber borrado nada. Dejar `estado:'aprobada'` (para no romper filtros ni otras apps) y agregar `resultado:'sin_cambios'`; en pantalla, «cerrada sin cambios».

**Causa C2 (R3):**
- `_reimponerDecisionesInv` (línea ~11540) vuelve a poner la decisión en pantalla, pero su resultado no cuenta como "en vuelo", así que no dispara ningún reenvío.
- `_fbSaveCore` (línea ~11046) reintenta 3 veces y se rinde.

**Arreglo C2:**
1. Si `_reimponerDecisionesInv` repuso algo, contarlo como preservado para que se programe el reenvío.
2. Mientras haya decisiones sin confirmar en la nube:
   - reintentar el guardado al volver la conexión (`window.addEventListener('online', …)`) y cada 60 s;
   - mostrar un aviso visible: «N decisión(es) por subir — no cierres esta pantalla».
3. Reintentar no duplica nada: la decisión es el estado del registro, no un registro nuevo.
4. **(ChatGPT)** Hasta que la nube confirme, la solicitud se muestra «⏳ por subir» y no «aprobada». Retomar las decisiones pendientes también al abrir la app, no solo con `online`.

**Causa C3 (R4):** `delMat` y la solicitud de edición no revisan si ya hay una pendiente para el mismo `materialId`.
**Arreglo C3:** si ya hay una pendiente, avisar («Ya hay una solicitud pendiente para este artículo desde el …») y no crear otra.
- **(ChatGPT)** Revisarlo también contra los datos frescos de la nube al guardar, por si dos pantallas la piden a la vez.
- Al aprobar o rechazar una, cerrar con ella las demás pendientes del mismo artículo (`resultado:'duplicada'`).

### Etapa 3 — Nombres y filas repetidas (riesgo medio) · prueba R5

**Causa C4:** el nombre se compara exacto (`m.nombre===r.nom && m.tipo===r.tipo`). Pasa en:
- `integrarRecuperado` (línea ~7535);
- la entrega a cuadrilla, en `saveEntregaLogic` (~8694, `x.nombre===it.nom`);
- la devolución de cuadrilla (~8363);
- traslados, retiro desde la ficha del cliente y cambio de equipo.

Un espacio de más crea otra fila. La bodega pide borrarla cuando queda vacía, y la siguiente devolución la vuelve a crear.

**Arreglo:**
1. **Una clave de comparación** `_claveArticuloInv(nombre, tipo)`, usada en todos los sitios de arriba. **Solo se usa para comparar**: el nombre se guarda como se escribió, igual que `_snNormal` con los seriales.
   - mayúsculas, sin tildes, espacios colapsados, sin espacios al inicio ni al final;
   - **no** unir prefijos distintos (`ONT` / `ONU` / sin prefijo) de forma automática: pueden ser equipos distintos. Eso lo decide una persona (punto 2).
   - **(ChatGPT)** la clave solo sirve para encontrar candidatos; la identidad es el `id` de la fila. Nunca unir filas con `tipo` o `unidad` distintos.
2. **Herramienta de admin «🧩 Unificar artículos repetidos»**, por bodega y cuadrilla:
   - propone grupos con la misma clave o casi la misma;
   - muestra una vista previa;
   - al aceptar, suma cantidades y seriales en una fila (conserva su `id`), archiva las demás en `archivo_…` y deja rastro en la bitácora.
3. **Filas en 0 y sin seriales:** en la vista de bodega se ocultan por defecto (casilla «ver vacías»), en vez de que la bodega tenga que pedir borrarlas.

### Etapa 4 — Ventanas con datos viejos (riesgo medio) · pruebas R7, R7b

**Causa C5:**
- `modalCorregirCantCuad` (línea ~8394) guarda **referencias** a las filas (`mats`, `m`) al abrirse.
- Si llega una sincronización mientras la ventana está abierta, esas filas ya no son las de `DB` (el oyente pone objetos nuevos), y la corrección se aplica sobre objetos sueltos: se pierde sin aviso.
- Además aplica valores **absolutos** (cantidad y lista de seriales marcada al abrir). Si la fila sí fuera la misma, devolvería seriales que otra pantalla ya sacó.

**Arreglo:**
1. Guardar **ids**, no referencias. Al guardar, buscar la cuadrilla y la fila **por id en `DB` actual**.
2. Si la fila cambió desde que se abrió la ventana (comparar con una foto de cantidad y seriales tomada al abrir), avisar y recargar la ventana, en lugar de aplicar.
3. Seriales: aplicar solo los que el admin **desmarcó** (quitar). No volver a poner los que ya no están.
4. Revisar el mismo patrón (cierre que captura `m` / `b` / `cu` y aplica valores absolutos) en las demás ventanas que mueven stock: editar artículo, entregar, trasladar, vender, cambio de equipo y retiro en la ficha del cliente, devolución. Escribir una prueba por cada una que se corrija.

### Etapa 5 — «Un serial, un sitio» al escribir (riesgo medio)

1. En las transacciones que **agregan** seriales a una bodega o cuadrilla (entrega, traslado, devolución, integrar, corrección), verificar **con los datos frescos** que el serial no esté en otro sitio ni en un consumo confirmado.
   - Si está en otro sitio, bloquear con un mensaje claro.
   - Excepción: los flujos que **mueven** el equipo (retiro de cliente, devolución), que lo sacan del otro sitio.
   - Reusar `_dondeEstaSN` (línea ~651) y `_sacarSNDeDondeEste` (~1771).
2. TÉCNICOS, devolución (línea ~2016): compara seriales letra por letra (`snesF.includes(sn)`). Usar `_snClaveTec`, como el resto de la app.
3. **Corregir lo que ya quedó mal** (los 38 seriales en dos sitios y los 4 equipos instalados que siguen en una cuadrilla) con la 🩺 Auditoría, **caso por caso y con aprobación de Elkin**. Nada automático.
   - **(ChatGPT)** Antes, un respaldo (Etapa 1) y una ficha por caso: serial, dónde figura, el consumo confirmado (fecha, técnico, cliente) y dónde está el equipo según la bodega.
   - Cada corrección queda en la bitácora con su motivo.
   - No adivinar culpables: con los registros viejos no se puede saber quién volvió a meter esos seriales.

### Etapa 6 — Pantallas viejas (riesgo bajo) · hacerla justo después de la 1

- INVENTARIO y TÉCNICOS ya no escriben si hay una versión publicada mayor (desde v112 / v98). **Las versiones anteriores no tienen ese freno**: una pestaña vieja abierta por días puede reescribir. Para verlas:
  - cada pantalla deja un **latido** cada 5 min en un documento propio (`oficinas_sistema/sesiones_vivas`, mapa por sesión con app, versión, usuario y último latido, podado a 24 h);
  - el admin ve en un panel qué pantallas siguen con versión vieja.
- Verificar que OFICINAS y RED tengan el mismo freno si escriben en documentos compartidos.
- **(ChatGPT)** Una pantalla vieja abierta por días es la principal sospecha de los 4 equipos instalados que volvieron a la cuadrilla. Además del latido:
  - mostrar la versión en cada pantalla, si no se ve ya;
  - INVENTARIO y OFICINAS: si la pestaña lleva más de 24 h sin recargar, pedir recargar antes de la siguiente escritura. En TÉCNICOS solo un aviso, sin bloquear, para no estorbar su cola sin señal.

**6b (opcional, después y con Elkin): reglas de Firestore que rechacen versiones viejas.**
- El sello `_ultimaEscritura` (Etapa 1) lleva `en: serverTimestamp()` y `version`.
- La regla de `inventario/datos` e `inventario/historial` exige `request.resource.data._ultimaEscritura.en == request.time` y `version >= <mínima>`. Una versión vieja no pone ese sello con la hora del servidor, así que su escritura se rechaza.
- Cubrir todas las escrituras: transacciones de TÉCNICOS, y OFICINAS o RED si escriben ahí.
- Probarlo antes con el emulador de Firestore. Tener a mano las reglas actuales para volver atrás. Desplegar solo con el OK de Elkin: si la regla queda mal, nadie puede guardar.

### Etapa 7 — Partir el documento (siguiente proyecto, con plan aparte)

`inventario/datos` está cerca del 80 % de 1 MiB, y que todo viva en un documento es lo que produce los choques. **(ChatGPT)** recomienda no dejarlo para mucho después. Modelo propuesto:
- consumibles: un documento por sitio y material (cantidad + revisión);
- equipos con serial: **un documento por serial**, con su estado (`en_bodega` → `en_cuadrilla` → `instalado`, y devuelto, dañado o baja) y su ubicación. Instalar cambia el estado del equipo: ya no depende de sacar el serial de una lista;
- libro de movimientos: un documento por operación, que no se reescribe;
- solicitudes y bitácora: un documento cada una;
- cada operación con un `operationId` fijo en todos sus reintentos. `increment()` solo **no** basta: no evita descontar dos veces.

Migración, sin dos fuentes editables a la vez:
1. respaldo;
2. armar el modelo nuevo en paralelo, solo lectura;
3. comparar automáticamente (seriales por sitio, cantidades, consumos pendientes y confirmados, solicitudes abiertas) hasta que no haya diferencias;
4. piloto con una bodega o cuadrilla;
5. cambio para todas, con el documento viejo solo de lectura.

Cambia la forma de los datos en tres apps. No se hace sin un plan aprobado por Elkin.

**Mejora menor:** `saveEntregaLogic` crea las filas de cuadrilla sin `categoria`, y `fixDB` se la agrega en cada pantalla. Eso marca la cuadrilla como "tocada" y genera reenvíos de más. Poner `categoria` al crear la fila.

### Etapa 8 — A futuro: identidad real (decisión de Elkin)

**(ChatGPT)** Sin login real, la bitácora puede decir «Admin» sin que se pueda probar quién fue, y cualquier pantalla, vieja o nueva, puede escribir el stock. La garantía fuerte es:
- Firebase Authentication, un usuario por persona;
- una Cloud Function para las operaciones críticas (aprobar, confirmar consumo, corregir). Valida y escribe stock + movimiento + bitácora en una sola transacción;
- reglas que no dejan escribir el stock directo desde las pantallas.

Las apps pueden seguir en GitHub Pages. Puede tener costo en Google Cloud: medirlo antes contra el presupuesto. App Check ayuda, pero no reemplaza el login.

---

## 6. Cómo probar

Banco de pruebas en `C:\Users\elkdn\proyectos\_PRUEBAS_SIMULADAS_2026-10-09`. Complementa al del 24-sep, que tiene todo lo demás.

| Archivo | Para qué |
|---|---|
| `fs_compartido.js` | Firestore simulado actualizado: ahora tiene `collection`, `query`, `where` y `getDocs`, que pide INVENTARIO v113. **Reemplaza** al del 24-sep. |
| `inv/revision_oct.js` | Las pruebas R1 a R10 (y R7b). |
| `inv/revision_oct_resultado.json` | El resultado con v113. |

**Cómo correrlas:**
1. Copia esos archivos sobre la carpeta `archivos` del 24-sep, y ajusta las rutas `/home/claude/repo` y `/home/claude/work` a las de este computador.
2. Levanta el servidor local con `npx http-server -p 8791 -c-1`.
3. Corre `node inv/revision_oct.js` (todas) o `node inv/revision_oct.js R2 R3` (solo esas).

Una etapa está lista cuando sus R pasan y nada de lo anterior empeora.

**(ChatGPT) Agregar a las pruebas:**
- **Invariantes** al final de cada escenario (los del chequeo de la Etapa 1): ningún serial en dos sitios; ninguno en una bodega o cuadrilla si tiene consumo confirmado; ninguna cantidad negativa; en filas con seriales, cantidad = número de seriales.
- **Prueba de estrés** (`inv/estres.js`, nueva): 3 o 4 pantallas hacen al azar entregas, consumos, confirmaciones, devoluciones, correcciones y aprobaciones, con cortes de red y recargas, durante cientos de operaciones. Al final se revisan los invariantes. Con semilla fija, para poder repetir una falla.
- **El mismo envío dos veces** (consumo, aprobación, devolución): un solo efecto.
- El emulador oficial de Firestore, solo para probar las reglas de la 6b. Para lo demás sigue este banco simulado, que ya reproduce las fallas con las apps reales.

## 7. Al publicar (cuando Elkin diga «publica»)

1. Respaldo para poder volver exactamente a lo publicado (como el del 24-sep), y **respaldo de datos** con el botón de la Etapa 1.
2. Subir versiones. Publicar fuera de horario.
3. Abrir una vez cada app actualizada desde la página publicada: eso anuncia la versión nueva. Desde la entrega de la Etapa 1, las pantallas abiertas se recargan solas. **Esta primera vez** hay que pedir a cada sede tocar «Actualizar» (o cerrar y abrir INVENTARIO y OFICINAS), y a los técnicos cerrar y volver a abrir TÉCNICOS.
4. Probar un caso real de punta a punta:
   - aprobar un borrado;
   - confirmar una instalación;
   - ver en la bitácora quién hizo cada cosa.

## 8. Opinión de ChatGPT (9 oct 2026)

Se le pasaron el contexto, las fallas R2–R10, los 4 casos reales y extractos del código, sin claves ni direcciones. Usó el modo «Pensar». La conversación completa está en la cuenta de ChatGPT de Elkin: «Diagnóstico y plan de corrección».

**En qué coincide (valida el diagnóstico):**
- Las mismas causas:
  - R2 viene de la regla «fila quitada en un lado y cambiada en el otro se conserva»;
  - R3, de mostrar la decisión antes de que la nube la confirme;
  - R7, de las referencias viejas;
  - R9 y R10, de `window.USER` y del arreglo `logs` que se escribe completo.
- Primero el rastro (R9, R10) y después tocar la fusión.
- Lápidas para los borrados aprobados, una sola solicitud pendiente por artículo, clave normalizada solo para buscar, ventanas que guardan ids y detectan cambios.
- Con los registros actuales no se puede saber quién volvió a meter los 4 seriales. Se corrigen con respaldo y rastro, sin adivinar.

**Qué agrega (ya está dentro de las etapas, marcado «(ChatGPT)»):**
1. Lápidas de borrado que no venzan a los 15 días (Etapa 2).
2. «⏳ por subir» en vez de «aprobada» hasta que la nube confirme, y `resultado:'sin_cambios'` cuando no había qué borrar (Etapa 2).
3. Bitácora en documentos sueltos que nadie reescribe, con equipo, sesión, versión y hora del servidor (Etapa 1).
4. Respaldo de datos, medidor de tamaño y chequeo de invariantes (Etapa 1).
5. Las pantallas viejas son la principal sospecha de los 4 equipos: la Etapa 6 va justo después de la 1, y la 6b propone reglas que rechacen versiones viejas.
6. Pruebas de invariantes y de estrés (§6).

**Cuál es para ChatGPT la solución de fondo (Etapas 7 y 8):**
- No seguir puliendo la fusión de arreglos como si fuera la solución. Dejarla para nombres y observaciones, y sacar de ella lo que cambia existencias y ubicación: stock, seriales y aprobaciones.
- Partir el documento: stock por sitio y material, un documento por serial con su estado, libro de movimientos y `operationId` en cada operación.
- Login real (Firebase Authentication) y una Cloud Function para las operaciones críticas. Sin eso no hay garantía fuerte de quién cambió qué.

**Dónde no lo seguimos al pie de la letra, y por qué:**
- Propone quitar la regla «gana esta sesión». No se quita de toda la fusión de una vez: se mantiene para los campos descriptivos y el stock se va sacando etapa por etapa. Quitarla de golpe rompería flujos que hoy funcionan.
- Partir el documento va después de las Etapas 1–6, que es también el orden de su tabla final. Primero se paran las fallas confirmadas y se vigila el tamaño. Luego se parte con plan propio, en paralelo y con piloto.
- El emulador de Firestore solo se usa para las reglas (6b). El banco simulado ya reproduce las fallas con las apps reales.

**Orden final: 1 → 6 → 2 → 3 → 4 → 5; después 7 y 8, cada una con su plan.**

## 9. Etapa 1 — lo que se hizo (sin publicar)

Hecho el 9 oct 2026 sobre lo publicado en `58fb891`. **No se publicó, no se hizo commit y no se subió ninguna versión**: las cuatro apps siguen diciendo INVENTARIO v113, TÉCNICOS v99, OFICINAS v318 y RED v42. Nada se escribió en la base real; las pruebas con datos reales solo leyeron, en `?prueba=1`.

### Qué quedó en cada archivo

| Archivo | Qué cambió |
|---|---|
| `recarga.js` (nuevo, `?v=1`) | La recarga automática, una sola copia para las cuatro apps (punto 7) |
| `INVENTARIO_PTOVISION.html` | Registro con quién, pestaña y navegador (1), fusión del registro por id (2), sello de escritura (3), respaldo (4), medidor (5), chequeo y tarjeta 🛡️ Vigilancia (6), recarga (7) |
| `TECNICOS_PTOVISION.html` | Sello `TEC` en sus 7 escrituras a `inventario/datos` (3), recarga con franja (7) |
| `OFICINAS_PTOVISION.html` | Recarga desde `#versionBanner` y `#ovVersionVieja` (7) |
| `RED_PTOVISION.html` | Aviso de versión propio (`app_version_red`), guardas de versión vieja y recarga (7) |
| `PRUEBAS.html` | 6 pruebas nuevas, la 4744 corregida, la 2627 y la del celular ajustadas (148 en total) |

**1 y 2 · El registro de actividad (R9, R10).**
- `logMsg` usa `USER` por su nombre. Cada entrada sale de `_entradaLogInv`: `{id, msg, usuario, rol, fecha, hora, t, fechaMs, app:'INV', version, sesion, equipo}`. `usuario` es el nombre de la bodega, `Admin` o `Sistema`. Nunca la cédula.
- Identidad: `localStorage['pv_equipo_id']` (`eq_` + 10, compartido por las apps del mismo navegador) y `sessionStorage['inv_sesion_id']` (`se_` + 10, uno por pestaña; en TÉCNICOS `tec_sesion_id`). Duplicar una pestaña copia su sesión: se acepta.
- La importación de Excel ya pasa por `logMsg` (antes agregaba sin usuario y recortaba a 60).
- `_fusionarLogsInv(local, nube)` une por id al guardar (dentro de la transacción de `_fbSaveCore`, y también en el camino de modo prueba) y al recibir `inventario/historial`. Lo viejo sin id se conserva sin repetirse. Quedan las 200 más nuevas.
- `registradoPor` y `creadoPor` también dejaron de leer `window.USER`. Los tres oyentes del módulo que todavía lo leen **no se tocaron**: si se tocan, empiezan a repintar con cada sincronización.

**3 · El sello.** Cada escritura a `inventario/datos` lleva `_ultimaEscritura = {app, version, quien, rol, sesion, equipo, ms, campos, en: serverTimestamp()}` y `_escrituras` (las 30 últimas, la más nueva primero, **sin** `en`). En `inventario/historial` va solo `_ultimaEscritura`.
- INVENTARIO sella en sus 3 transacciones con `_conSelloInv`, siempre en un objeto aparte: lo que se devuelve a quien llamó no cambia.
- TÉCNICOS sella sus 7 `tx.update(refI` con `_conSelloTec`, con `quien = TEC.nombre`. El sello se arma dentro de la transacción, nunca en el plan que queda en el celular.
- El sello nunca entra a `DB`: se saca al cargar y en el oyente (`_sacarSelloInv`) y queda en `window._ultimaEscrituraNube` y `window._escriturasNube`. `_armarCopiaInv` no lo copia y `_camposCambiadosInv` no lo mira.
- Diferencia con lo planeado: `_actualizarInventarioSinLeer` de TÉCNICOS sí lee `inventario/datos` desde la v71, así que también lleva `_escrituras`.

**4 a 6 · Vigilancia, solo lectura.** La tarjeta 🛡️ Vigilancia sale al administrador en ⚙️ Configuración y arriba de 🩺 Auditoría:
- **Medidor:** `_nivelPesoInv`, «inventario/datos: X KB de 1.024 KB (Y %)». Amarillo desde 900 KB y rojo desde 980 KB. El sello también se cuenta.
- **Chequeo:** `_chequeoInventarioInv`, con «Ver detalle» (hasta 50 por categoría).
- **Alzas:** si un conteo sube entre una sincronización y la siguiente, se anota en memoria (`window._alzasChequeoInv`) con el sello de quién escribió. No escribe nada.
- **Respaldo:** «⬇️ Descargar respaldo» lee `inventario/datos` e `inventario/historial` frescos con `_fbLeerDocInv` y baja `respaldo_inventario_AAAA-MM-DD_HH-MM.json`. Si la lectura falla, avisa y no baja nada.

**7 · Recarga automática.** La cuenta sale del oyente de versión de cada app (`anunciada`). En OFICINAS sale de `iniciarEscuchaVersion` y de `_verificarVersionVieja`, nunca de `_pestanaDesactualizada` ni del mantenimiento. Qué espera cada app:

| App | Espera (`op.ocupado`) | Además |
|---|---|---|
| INVENTARIO | guardado en curso o en cola, escrituras en vuelo (`_escriturasEnVueloInv`), `#saveOverlay` | — |
| TÉCNICOS | `_guardandoTec`, `_enviandoFinTec`, escrituras en vuelo (`_escriturasEnVueloTec`) | con una ventana abierta, franja `#versionFranjaTec` en vez del bloqueo; lo finalizado queda en la cola del celular («Quedó guardada en el celular. La app se va a actualizar y la enviará sola.»); devolución, gasto y bandeja no cierran ni escriben con la versión vieja |
| OFICINAS | guardado, cola, reintento, `_ultimoGuardadoOk===false`, subidas a Drive (`_subidasDriveEnCurso`), WispHub, cargas | antes de recargar envía la auditoría; con la ventana del comprobante repetido abierta no recarga |
| RED | `guardarRed` en curso (`_guardandoRed`), `#cargando` | antes de recargar suelta su candado |

### Decisiones

- **El registro no lleva lápidas ni se archiva.** `logs` NO entró a `COLS_HIST_INV`. Ahí, cada entrada que el tope de 200 corta dejaría una lápida en `inventario/datos._tumbas`, que puede empujar fuera las de borrados reales. Además, lo local sin subir gastaría el freno de reenvíos de las listas de stock. Por lo mismo se quitó `logs` de `_REGLAS_ARCHIVO_INV`: con ids y fusión sin lápidas, lo archivado volvería desde la nube y el archivo se reescribiría en cada guardado. El tope de 200 ya acota la lista. `logs` sigue en `_CAMPOS_HIST_INV`, que solo sirve para medir el peso de cada documento.
- **`inventario_actividad` da 403** (comprobado el 9 oct 2026): las reglas no dejan leer esa colección. Las reglas no se cambian sin Elkin, así que por ahora solo hay fusión por id. **Decisión pendiente para Elkin:** si quiere un documento por evento que ninguna pantalla reescriba, la alternativa que no toca las reglas es `inventario/actividad_<id>`, dentro de la colección que ya está abierta (como `inventario/archivo_*`).
- **Versiones sin subir.** Se suben solo en la entrega que se publica: INVENTARIO 114, TÉCNICOS 100, OFICINAS 319 y RED 43, con el mismo formato de línea (`const APP_VERSION_INV = 114;`), que las pruebas leen con expresiones regulares.
- **`recarga.js?v=1` en las cuatro apps.** Al cambiar `recarga.js` hay que subir el `?v=` en las cuatro, al mismo número (la prueba 6 lo exige).
- **`oficinas_sistema/app_version_red`** es el documento de versión de RED, `{version, actualizadoEn}`. Todavía no existe en la nube: lo crea la primera RED publicada con este código (v43). Una copia en `?prueba=1` o local nunca lo escribe.
- **El botón «🔄 Actualizar ahora»** recarga sin mirar la página publicada ni el tope y conserva `?prueba=1`, `?ignorarVersion` y los demás parámetros. Antes los perdía.
- **OFICINAS espera para siempre** si un guardado quedó sin llegar a la nube y ya no tiene reintento (`_ultimoGuardadoOk===false`): queda solo el botón. Es a propósito, para no perder lo no guardado. Lo decide Elkin.

### Encontrado al escribir las pruebas

**El respaldo del botón fallaba en INVENTARIO, OFICINAS (dos botones) y TÉCNICOS. Ya se corrigió.** Usaban `new URL(location.href)` dentro de un `onclick` escrito en el HTML. Ahí `URL` no es la clase sino `document.URL`, un texto, así que lanzaba «URL is not a constructor» (comprobado en el navegador): sin `recarga.js` (sin señal al abrir), el botón no hacía nada. Ahora los cinco `onclick` usan `new window.URL(location.href)`, como ya hacía RED (líneas del 9 oct 2026: INVENTARIO 283, TÉCNICOS 134, OFICINAS 487 y 17274, RED 753). Revisado en node con las mismas expresiones de la prueba 6: los cinco botones tienen el respaldo, ninguno usa `new URL(` y las cuatro apps cargan `recarga.js?v=1`. La P7i del banco lo prueba en el navegador (abajo). **La prueba 6 ya no debe marcar esto: si sale en rojo por el botón, es una regresión, no una falla conocida.**

Corregido en la revisión adversaria (9 oct 2026):
- **TÉCNICOS con la franja.** Reagendar, cancelar, traslado, nota y la recogida de emergencia ya no cierran la ventana con la versión vieja: avisan y no escriben, igual que devolución, gasto olvidado y bandeja. La franja trae su botón «Actualizar ahora».
- **`recarga.js`, dos detalles.** Al volver de `antesDeRecargar` mira otra vez guardado, formulario y señal; si algo empezó en esos segundos, quita la marca de la recarga y vuelve a esperar. Si 30 s después de pedir la recarga la página sigue viva, dice «Si la página no se actualiza, toca «Actualizar ahora»» y el botón vuelve a funcionar. Con prueba en `inv/recarga_unit.js` (casos M, M2 y M3; 167 bien).

Otros riesgos anotados, sin corregir:
- **Contrato a medio firmar en TÉCNICOS.** Si la versión nueva sale con la ventana del contrato abierta, el contrato no se puede guardar con la versión vieja: hay que actualizar y volver a firmar. Antes pasaba lo mismo (el bloqueo tapaba la ventana). Publicar fuera de horario lo evita.
- **Hora del equipo mal puesta.** El registro se ordena por la hora de cada pantalla: una entrada de un equipo con la hora muy adelantada queda arriba y otra con la hora atrasada puede salir del tope de 200.
- **OFICINAS, mantenimiento.** `_activarMantenimiento` sigue con `versionAlActivar.red:null`: un mantenimiento «termina al publicar» en RED solo cuando se publica OFICINAS.
- **La primera vez.** Las pantallas v113, v99, v318 y v42 que sigan abiertas no tienen este código. Escriben `logs` entero hasta que recarguen y necesitan el botón, como dice el §7.

### Pruebas

**`PRUEBAS.html`: 148 pruebas** (32 de INVENTARIO, 84 de OFICINAS, 31 de RED y 1 de Firma). Las seis nuevas:

| # | Grupo | Prueba |
|---|---|---|
| 1 | inv | Cada entrada del registro dice quién, desde qué pantalla y con qué versión (R9) |
| 2 | inv | Dos pantallas que registran a la vez no pierden entradas (R10) |
| 3 | inv | El sello de escritura dice quién escribió y no provoca escrituras de más |
| 4 | inv | El medidor y el respaldo solo leen (no dispara la descarga) |
| 5 | inv | El chequeo cuenta bien y no corrige nada |
| 6 | red | La recarga automática espera lo que debe y nunca recarga una prueba |

- La 6 va en el grupo de RED, al final, para que estén abiertos los marcos de INVENTARIO, OFICINAS y RED. Evalúa `recarga.js` aparte, con un navegador falso que nunca navega. TÉCNICOS se lee como texto, no se abre.
- Se corrigió la 4744: decía `inv.indexOf("window.USER")<0 === false`, que por la precedencia EXIGÍA que existiera `window.USER`. Ahora comprueba lo que quería: que el bloque de mantenimiento de INVENTARIO reconoce la sesión por `USER` y no por `window.USER`.
- La 2627 describe RED con `vieja:'_pantallaViejaRed'`.
- La del celular de INVENTARIO recorre también ⚙️ Configuración y 🩺 Auditoría.

**Corrido el 9 oct 2026**, sin abrir TÉCNICOS ni OFICINAS:
- **INVENTARIO completo en `?prueba=1`:** 31 bien y 1 aviso (la 547, seriales repetidos reales). Ninguna escritura intentada; el marco siguió en `?prueba=1` y la recarga, quieta en «prueba».
- **La 6 con el marco de RED**, corrida ANTES de arreglar el botón: fallaron el respaldo del botón (arriba, ya corregido) y «no hay marco de OFICINAS», que no se abrió para no bajar sus datos. No se volvió a correr en el navegador después del arreglo. Con el código de hoy, la única falla esperada en esa corrida parcial es «no hay marco de OFICINAS».
- **En node:** la 2627 pasa, y la 6 detecta las 11 copias dañadas que se probaron (sin modo prueba, URL que pierde parámetros, sin esperar el guardado, tope sin podar, TÉCNICOS sin guarda, RED que escribe antes de mirar, OFICINAS que dispara desde `_pestanaDesactualizada`, entre otras).

Fuera de `PRUEBAS.html`, cada parte se probó por su lado:

| Qué | Dónde | Resultado |
|---|---|---|
| `recarga.js` | `inv/recarga_unit.js` | 160 bien |
| Funciones puras de INVENTARIO | node | bien |
| TÉCNICOS (sello, franja, recarga con DOM falso) | 3 pruebas en node | bien |
| OFICINAS (funciones reales extraídas, con el `recarga.js` real) | node | 27 de 27 |
| RED sobre el Firestore simulado | Chrome | 23 bien |

**El banco simulado de la §5.2**, corrido el 9 oct 2026 entre las 12:10 y las 12:17, con el botón ya corregido y con `fs_compartido.js` endurecido para que rechace `serverTimestamp` dentro de un arreglo. Las salidas están en `_PRUEBAS_SIMULADAS_2026-10-09/trabajo/etapa1_resultados/vuelta1_*.txt`:

| Qué | Resultado |
|---|---|
| `etapa1.js` | 16 pasan, 0 fallan: R9b, R10b, SELLO_INV, SELLO_TEC, CHEQUEO y P7a a P7k. La P7i (el botón sin `recarga.js`) fallaba antes del arreglo con «URL is not a constructor» y ahora pasa. La P7j es informativa |
| `recarga_unit.js` | 160 bien, 0 mal |
| `repro.js` | 21 de 21 |
| `escenarios2.js` | 20 de 20 |
| `revision_oct.js` | 5 pasan y 6 fallan. Pasan R9 y R10 (las de esta etapa), R1 y R8, que ya pasaban, y R6, que es informativa. Fallan R2, R3, R4, R5, R7 y R7b: son las fallas del §4, que corrigen las Etapas 2, 3 y 4. Se esperaba que siguieran fallando |

La P7j muestra el riesgo anotado arriba en «TÉCNICOS con la franja»: con la franja a la vista, el técnico llenó «No se pudo» (reagendar) y tocó Guardar. La ventana se cerró, salió el aviso de versión nueva y la orden siguió igual en la nube: no se escribió nada y lo que el técnico escribió se perdió.

**Falta correr** `PRUEBAS.html` completo con el marco de OFICINAS abierto (en `?prueba=1`): las 84 de OFICINAS, entre ellas la 4744 corregida y la 2627 ajustada, y la parte de la prueba 6 que mira ese marco.

**Con los datos reales (solo lectura, 9 oct 2026):**
- Medidor: `inventario/datos` en 711 KB (69 %).
- Chequeo: 11 seriales en dos sitios + 25 repetidos en un mismo sitio = 36, la cifra de la prueba 547.
- Instalados que siguen: 14. Son 3 en cuadrillas, los mismos que la Auditoría, y 11 en bodegas, que la Auditoría no mira.
- Negativos: 0.
- Cantidad distinta: 25 filas. La Auditoría da 30 porque cuenta también los rellenos N/A y S/N.

### Lo que falta probar en la nube real (al publicar)

1. Que Firestore acepte el sello: `serverTimestamp()` en el mapa `_ultimaEscritura.en` y `_escrituras` sin él. El simulador devuelve un número y la nube un Timestamp; `_msDeMarcaPV` lee los dos. Un guardado de bodega y una finalización de TÉCNICOS deben dejar el sello con la app, la versión y el nombre.
2. Que `oficinas_sistema/app_version_red` se cree al abrir la RED publicada (hoy da 404; las reglas de la colección dejan escribir) y que una RED vieja abierta vea el bloqueo y cuente.
3. La recarga en GitHub Pages: que la comprobación (`?nc=`, sin caché) espere mientras Pages todavía sirve la versión vieja y reintente cada minuto; que recargue una vez con la nueva y conserve los parámetros; y que nunca pase de 3 recargas en 10 minutos.
4. TÉCNICOS en un celular, con la PWA instalada: con la ventana de material abierta, la franja y no el bloqueo; al finalizar, el plan queda en la cola; recarga; la versión nueva lo envía con sello `TEC`.
5. El respaldo real desde el administrador (unos 1,1 MB, con datos privados) antes de publicar, como pide el §7.
6. Que dos pantallas que registran a la vez dejen las entradas de las dos en `inventario/historial.logs`, y que la bitácora ya diga el nombre de la bodega.
7. Cuánto suma el sello a `inventario/datos` (unos KB con 30 entradas en `_escrituras`), en el medidor.
