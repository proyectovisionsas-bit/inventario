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

## 9. Etapa 1 — lo que se hizo (publicada el 9 oct 2026)

Hecho el 9 oct 2026 sobre lo publicado en `58fb891`, y **publicado ese mismo día** en el commit `1b2e58f`: OFICINAS v319, INVENTARIO v114, TÉCNICOS v100 y RED v43. Los cuatro documentos de versión de la nube lo confirman desde las 20:36 UTC. Al prepararla no se escribió nada en la base real; las pruebas con datos reales solo leyeron, en `?prueba=1`.

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
- **Versiones.** Se subieron solo en la entrega publicada (`1b2e58f`): INVENTARIO 114, TÉCNICOS 100, OFICINAS 319 y RED 43, con el mismo formato de línea (`const APP_VERSION_INV = 114;`), que las pruebas leen con expresiones regulares.
- **`recarga.js?v=1` en las cuatro apps.** Al cambiar `recarga.js` hay que subir el `?v=` en las cuatro, al mismo número (la prueba 6 lo exige).
- **`oficinas_sistema/app_version_red`** es el documento de versión de RED, `{version, actualizadoEn}`. Lo creó la primera RED publicada con este código (v43): existe desde el 9 oct 2026. Una copia en `?prueba=1` o local nunca lo escribe.
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
2. Que `oficinas_sistema/app_version_red` se cree al abrir la RED publicada (ya existe desde el 9 oct 2026) y que una RED vieja abierta vea el bloqueo y cuente.
3. La recarga en GitHub Pages: que la comprobación (`?nc=`, sin caché) espere mientras Pages todavía sirve la versión vieja y reintente cada minuto; que recargue una vez con la nueva y conserve los parámetros; y que nunca pase de 3 recargas en 10 minutos.
4. TÉCNICOS en un celular, con la PWA instalada: con la ventana de material abierta, la franja y no el bloqueo; al finalizar, el plan queda en la cola; recarga; la versión nueva lo envía con sello `TEC`.
5. El respaldo real desde el administrador (unos 1,1 MB, con datos privados) antes de publicar, como pide el §7.
6. Que dos pantallas que registran a la vez dejen las entradas de las dos en `inventario/historial.logs`, y que la bitácora ya diga el nombre de la bodega.
7. Cuánto suma el sello a `inventario/datos` (unos KB con 30 entradas en `_escrituras`), en el medidor.

## 10. Etapa 6 — lo que se hizo (publicada el 10 oct 2026)

Hecho el 9 y 10 oct 2026 sobre lo publicado en `1b2e58f` (OFICINAS v319, INVENTARIO v114, TÉCNICOS v100, RED v43). **Publicado el 10 oct 2026** como OFICINAS v320, INVENTARIO v115, TÉCNICOS v101 y RED v44, con `pantallas.js?v=1` nuevo (la nota del panel ya lo dice así). Las pruebas no escribieron nada en la base real.

El 10 oct pasó una revisión adversaria (cinco lentes: `pantallas.js`, el freno de OFICINAS, TÉCNICOS, RED y la versión, y las pruebas). Lo que aquí se describe es lo que quedó **después** de sus arreglos y de dos cambios que la sesión principal hizo después (el mínimo de 5 min entre latidos y el apagado del latido de INVENTARIO al cerrar sesión); qué encontró, qué se corrigió y qué no, en «Revisión del 10 oct» y «Lo que quedó sin hacer», al final.

### Qué quedó en cada archivo

| Archivo | Qué cambió |
|---|---|
| `pantallas.js` (nuevo, `?v=1`) | El latido y el panel, una sola copia para las cuatro apps (`PV_PANTALLAS`). No conoce Firebase, `DB`, `USER` ni `TEC`: todo le llega por un adaptador. Si no carga, la app sigue igual, sin latido |
| `INVENTARIO_PTOVISION.html` | Puente `window._fbLatidoInv`, latido desde `enterApp` (y apagado en `doLogout`), tarjeta «📺 Pantallas abiertas» en ⚙️ Configuración, guarda de 24 h (`#capaCaducadaInv`), versión a la vista y oyente de versión con reintento |
| `OFICINAS_PTOVISION.html` | Latido desde `enterApp`, tarjeta en Administración, freno de versión vieja en `_saveReal` (con permiso para lo que ya venía en camino, `_permisoGuardadoOfi`) y en los caminos compartidos, guarda de 24 h (`#capaCaducadaOfi`), versión junto al reloj y oyente con reintento |
| `TECNICOS_PTOVISION.html` | Latido desde `enterApp` (exceptuado del freno de versión, no del modo prueba), franja de más de un día (`#avisoCargaViejaTec`), versión en la entrada y oyente con reintento |
| `RED_PTOVISION.html` | Latido desde `_montarAppRed`, versión a la vista (entrada y cabecera) y oyente de `app_version_red` con reintento |
| `PRUEBAS.html` | 6 pruebas nuevas y el ayudante `pantallasAparte` (154 en total). Ninguna prueba vieja hubo que tocarla |

Las cuatro apps cargan `pantallas.js?v=1` con el comentario «Pantallas abiertas (latido), compartido: editar pantallas.js, no copiarlo aquí». Al cambiar `pantallas.js` hay que subir el `?v=` en las cuatro, al mismo número (la prueba 4 lo exige). `FIRMA_SST.html` no lo carga. `pantallas.js` todavía no se ha publicado nunca (no está en git), así que sale con `?v=1` aunque haya cambiado en la revisión; si alguna vez se publica una versión anterior a estos arreglos, el siguiente cambio sube el `?v=`.

### El documento `oficinas_sistema/sesiones_vivas`

Lo comparten las cuatro apps (regla 7): nadie le cambia la forma por su cuenta.

```
{ sesiones: { "<clave>": { app, v, rol, nombre, sesion, equipo, disp, cargadaMs, ultimoMs, en, vieja, local, visible, recarga, n } } }
```

- **`<clave>`:** `p` + 12 letras o cifras, al azar por cada carga de página, sin puntos. La pestaña (`sesion`) va aparte: al duplicar una pestaña se copia su `sessionStorage`.
- **`app`** `OFI`, `INV`, `TEC` o `RED`; **`v`** la versión cargada; **`rol`**; **`nombre`** (ver «Privacidad»); **`equipo`** el `pv_equipo_id` de la Etapa 1; **`disp`** `celular` o `pc`; **`cargadaMs`** y **`ultimoMs`**, horas del equipo; **`en`** `serverTimestamp()`, la hora del servidor; **`vieja`** si la pantalla ya sabe que hay una versión mayor; **`local`** copia local; **`visible`**; **`recarga`** la fase de `recarga.js`; **`n`** latidos enviados en esta carga.
- La entrada sale de `PV_PANTALLAS.entrada`, con lista blanca: cualquier otra llave se descarta y nunca queda un `undefined`. No tiene campos de primer nivel `tipo`, `firmaRef` ni `clienteCedula`, que entrarían en consultas que ya existen. Nada va en `main` ni en `inventario/datos`: todas las pantallas los escuchan, y cada latido costaría una lectura por pantalla.
- **Se escribe siempre** `set({ sesiones: { [clave]: entrada, [vieja]: deleteField() } }, { merge:true })`. Nunca `update` del mapa (lo reemplaza entero), nunca `set` sin merge, nunca `mergeFields`, nunca un mapa `sesiones` vacío. `pantallas.js` arma el parche con marcas (`{__ts:1}`, `{__del:1}`) y cada app las traduce a `serverTimestamp()` y `deleteField()`.
- **Poda a 24 h, con la hora del servidor.** En el mismo `set merge` del primer latido de cada carga (con una lectura antes) y al abrir el panel, se borran las entradas cuyo `en` es más de 24 h anterior al `en` creíble más nuevo del documento. Nunca contra la hora del equipo: un celular con la hora adelantada tres días borraría a todas las demás. Una entrada sin `en` legible se conserva hasta 48 h. Si quedan más de 400, se van las más viejas. Nunca se borra la propia. Una entrada viva podada por error vuelve en su siguiente latido. Son datos de vigilancia efímeros, no datos del negocio.
- **Hora imposible (revisión del 10 oct).** Las apps escriben `en` con `serverTimestamp()`, pero el documento se escribe desde internet sin autenticación. Antes, una sola entrada con `en` del año 2100 (como número, `{seconds}` o `Timestamp`) pasaba a ser «el más nuevo»: cada carga borraba a todas las demás y el panel las veía todas «sin latido», para siempre, porque esa entrada nunca se podaba. Ahora un `en` más de 24 h por delante de la hora de quien lee (`limiteEn`, `enCreible`) no cuenta: ni como el más nuevo (`enMasNuevo`, `podar`, `resumen`), ni como latido en el panel, y en el tope de 400, si no trae otra hora creíble, es la primera en salir (`momento`). La hora del equipo solo sirve de tope: con el reloj de quien lee atrasado, la poda borra menos o nada, nunca más. La poda del latido nunca borra una entrada por tener la hora imposible; eso lo hace solo el panel (ver abajo).
- **Tamaño:** unos 195 B por entrada. Con la poda quedan las cargas del último día (60 a 150): de 12 a 30 KB.

### El latido

- **Arranca solo con la sesión iniciada:** `enterApp` en INVENTARIO, OFICINAS y TÉCNICOS (al entrar y al reanudar la sesión); arriba de `_montarAppRed` en RED, antes del `return` del técnico. Nunca al cargar ni en un `setInterval` suelto: en PRUEBAS.html nadie inicia sesión.
- **Se apaga al cerrar sesión:** INVENTARIO, OFICINAS y TÉCNICOS llaman `PV_PANTALLAS.detener()` en `doLogout`; al volver a entrar, `enterApp` lo arranca otra vez con la misma clave. INVENTARIO lo hace desde la revisión: antes seguía latiendo en la pantalla de entrada, con rol y nombre vacíos. RED no lo necesita: `salir()` recarga la página.
- **Cadencia:** el primero al iniciar; después cada 5 min con la pestaña a la vista y cada 15 oculta; al volver a la vista, uno inmediato si pasó más de 5 min (así cambiar de pestaña nunca suma más latidos que el ritmo normal: máximo 12 por hora a la vista; después de la revisión se subió de 1 a 5 min por la cuota de Firebase); al volver la señal, otro si el último falló y el último bueno tiene 5 min o más. Los 5 min se cuentan desde el último intento (`minEntreMs` = 300000 en `PV_PANTALLAS.TIEMPOS`; un latido forzado con `latir()` respeta el mismo mínimo). Un solo temporizador. Sin señal no se escribe. Si la nube no responde en 30 s, se suelta.
- **Si la hora del equipo retrocede** (alguien la corrige a mano en Ajustes), ningún turno pasa de 5 o 15 min (`siguiente()` lleva tope) y una diferencia negativa cuenta como «ya pasó el tiempo» (`pasoMinimo`, `alVolverRed`): la pantalla sigue latiendo. Antes, un celular con la hora 2 días adelantada que la corregía quedaba con el turno a 48 h, salía «sin latido» y la poda lo borraba al día siguiente, aunque siguiera abierto.
- **Un latido que falla** (sin señal, cuota, reglas) nunca lanza ni afecta nada: se reintenta en el siguiente turno. Si la pantalla no puede decir quién es, ese latido no sale.
- **Modo prueba:** no lee, no escribe ni lo intenta. Cada app mira `MODO_PRUEBA` (`MODO_PRUEBA_TEC`) ANTES del `set`, para no sumar intentos a `_escriturasBloqueadas`.
- **No pasa por los frenos ni por los contadores:**
  - INVENTARIO usa `setDoc` directo, no `_setDoc`: no cuenta en `_escriturasEnVueloInv` ni se frena por versión vieja.
  - OFICINAS y RED escriben con `db.collection('oficinas_sistema').doc('sesiones_vivas')`, nunca con `db.doc(…)`, que el modo prueba no cubre.
  - En TÉCNICOS, `_protegerRefTec` deja pasar el latido (solo un `set` con `merge:true` sobre `sesiones_vivas`) con la pantalla vieja y sin contarlo en `_escriturasEnVueloTec`. El modo prueba lo bloquea igual que todo lo demás.
  - Justo las pantallas viejas son las que hay que ver, y la recarga automática no debe esperar a un latido sin señal.
- `window.__PV_LATIDO_PRUEBA` (tiempos acelerados del banco de pruebas) solo vale en una copia local.

### El panel «📺 Pantallas abiertas»

- **Dónde:** en OFICINAS, en ⚙️ Administración, entre la tarjeta del mantenimiento y la del buzón. En INVENTARIO, en ⚙️ Configuración, en una tarjeta aparte de la 🛡️ Vigilancia, que se repinta en cada sincronización. Solo el administrador.
- **Bajo pedido:** lee la nube solo al tocar «🔄 Ver pantallas»: una lectura del documento y las cuatro de versión. Sin oyente, por la cuota. Un repintado muestra la última lectura sin volver a leer.
- Arriba: «N pantallas abiertas · M con versión vieja · K sin latido hace más de 15 min» y las versiones publicadas.
- Una fila por pantalla: en **rojo** la de versión vieja (menor que la publicada, o la pantalla ya lo sabía), en **ámbar** la que lleva más de 24 h sin recargar, en **gris** la que no late hace más de 15 min. Las viejas van primero. «Sin latido» se mide contra el latido creíble más nuevo del documento, no con el reloj de quien mira.
- Una entrada con la hora imposible sale «sin latido» y con la etiqueta «⚠️ Hora imposible (más de un día en el futuro)» (`futura:true`); las demás siguen viéndose vivas.
- Al abrirlo poda lo de más de 24 h y quita las de hora imposible, en un solo `set merge` de solo borrados (en modo prueba no). El aviso dice cuántos registros quitó por edad y cuántos por hora imposible; si no hubo de estos, el texto es el de antes.
- **Qué quita por hora imposible** (`PV_PANTALLAS.futuras`, pura): las entradas cuyo `en` pasa de la hora de quien lee + 24 h **y** va más de 24 h por delante del `en` creíble más nuevo, y solo si las entradas con `en` creíble son más que las de hora imposible. Si no (por ejemplo, el reloj de quien abre el panel va días atrasado y todas le parecen del futuro), no se sabe quién está mal y no quita nada. Nunca quita la propia.
- Todo lo que pinta va escapado: el documento se puede escribir desde internet.
- Siempre dice: «Solo aparecen las pantallas con este código (desde OFICINAS v320, INVENTARIO v115, TÉCNICOS v101 y RED v44). Las anteriores no envían latido.»
- Cabe en 375 px.

### OFICINAS ya no guarda con versión vieja

OFICINAS reescribe `oficinas_sistema/main`, donde TÉCNICOS escribe las órdenes: una pantalla vieja las pisaría con su copia.

- **El freno de `_saveReal`.** Con una versión publicada mayor (`_pestanaDesactualizada()`), un guardado **sin permiso** (ver abajo) no escribe y avisa en el indicador: «Hay una versión nueva: esta pantalla ya no guarda. Actualízala.»
  - Cuenta los frenados en `window._guardadosFrenadosVersion` y deja un solo registro `GUARDADO_FRENADO_VERSION` por pestaña (versión, publicada y qué), sin datos de clientes.
  - Va después del freno de mantenimiento y antes de subir `appVersionPublicada` y de `_saveInProgress`.
  - Solo marcas en memoria: no lee la nube y no abre ventanas. Ese aviso del indicador queda tapado por el de versión nueva (`#versionBanner`); por eso los trabajos de abajo avisan con su propia ventana.
- **No deja el guardado como fallido.** `_ultimoGuardadoOk` queda como estaba. Si quedara en `false`, la recarga automática esperaría para siempre justo en las pantallas viejas (riesgo R1). Si ya estaba en `false` por un fallo anterior, decide la Etapa 1: espera el botón.
- **Lo que ya venía en camino sí se guarda (revisión del 10 oct).** Antes, lo que la oficina empezaba con la versión al día y terminaba después de publicada la nueva se perdía: la recarga automática de la Etapa 1 esperaba justo esas cosas (subidas a Drive, la ventana del repetido, la fila, el reintento) y después el freno botaba el resultado, a veces con un «✅ … correctamente» falso. Ahora pasa el freno todo guardado que lleve **permiso**:
  - `_permisoGuardadoOfi()` da `{alDia:true, ms}` si la versión sigue al día y `null` si ya hay una nueva. No tiene efectos.
  - **Trabajos que guardan al final:** lo toman al EMPEZAR y lo pasan a `save({permiso})`: el 📎 (`procesarArchivos`), el cargue por lotes (`guardarComprobantesRegistrados`), los comprobantes de un abono (`subirCompsAbonoExistente`), el abono de un cliente especial (`guardarAbonoEspecial`), Efecty (`guardarReporteEfecty`) y la gestión de una recogida (`_guardarGestionRecogida`). Si empezaron al día, su guardado pasa aunque la versión nueva salga mientras suben los archivos (a Drive; los de la recogida, a Cloudinary) o mientras alguien decide en la ventana del repetido.
  - **La fila:** cada pedido que entra mientras otro guarda lleva su permiso (o el que haya en ese momento) en `window._colaPermiso`; basta que uno de los pedidos fusionados lo tenga, porque el guardado lleva toda la memoria.
  - **El reintento:** si el guardado falla o queda parcial, `_permisoReintento` (el de la salida del mantenimiento, el que trajo, o «al día» si la versión aún lo estaba) viaja en el temporizador de `_programarReintentoGuardado(motivo, permiso)`. Lo llevan los 3 reintentos automáticos (20, 45 y 90 s) y la emergencia por 1 MB. Vence con los 3 reintentos.
  - Lo que **empieza** con el aviso ya puesto recibe `null` y se frena como siempre (también un `save()` pedido después del aviso: L6a, L6b y L2a del banco y la prueba 5 lo exigen). Como el aviso tapa la pantalla, eso es casi solo trabajo de fondo.
- **Si el freno actuó, lo dicen** (comparan `_guardadosFrenadosVersion` antes y después del `save()` y muestran una ventana del navegador, que sale encima del aviso, en vez del mensaje de éxito). Con el permiso, solo pasa si el trabajo empezó con el aviso ya puesto:
  - 📎: «ESTE COMPROBANTE NO QUEDÓ GUARDADO… toca «Actualizar ahora» y vuelve a adjuntarlo a este pago», y no vuelve a abrir la ventana del pago (lo mostraría como guardado);
  - comprobantes de un abono: «LOS COMPROBANTES NO QUEDARON GUARDADOS», en vez de «✅ N comprobante(s) agregado(s) correctamente»;
  - abono de un cliente especial: «EL ABONO NO QUEDÓ GUARDADO»;
  - Efecty: «EL REPORTE EFECTY NO QUEDÓ GUARDADO», en vez de «Reporte Efecty registrado»;
  - cargue por lotes: revisa la versión antes de subir nada y, si el freno actuó, «HAY UNA VERSIÓN NUEVA Y ESTA PANTALLA YA NO GUARDA: LA NUBE NO RECIBIÓ ESTOS COMPROBANTES»;
  - «Pagos sin oficina» (`_asignarPagosSinOficina`): revisa antes de meter y compara después; no lleva permiso porque entre su revisión y el `save()` solo hay `confirm` y `prompt`, que no dejan correr al oyente de versión;
  - la gestión de una recogida lleva el permiso pero **no avisa** si se frenó: cierra la ventana como si hubiera guardado (ver «Lo que quedó sin hacer»).
- **Excepción decidida: la salida del mantenimiento.** El guardado que el mantenimiento dejó en pausa sale al terminar con la marca de un solo uso `window._mantSalidaGuardado`, que `_saveReal` consume al entrar. Al publicar con «termina al publicar», la pantalla vieja ve terminar el mantenimiento justo cuando ya hay versión nueva; frenarlo perdería lo que la oficina escribió antes del aviso. Desde la revisión, si ese guardado falla o queda parcial (`movs_index` ilegible, la recarga de bloques pasa de 60 s, Firebase ocupado), sus reintentos automáticos llevan el permiso `{mant:true}`: antes la marca se gastaba en el primer intento y el reintento que el aviso promete («reintenta sola en 20 s») se frenaba. La marca global no se vuelve a poner: ningún otro guardado puede usarla. Ese guardado no baja la versión publicada que la pantalla ya conoce por el oyente (antes de escribir, sube `DB.config.appVersionPublicada` a `window._mantVersionOficinasNube`; esa línea corre en todo guardado que pasa el freno, ver «Lo que quedó sin hacer»).
- **Los otros caminos que escriben documentos compartidos o de fondo** miran la versión antes de escribir, con el mismo mensaje:
  - contratos: guardar, subir a Drive, firmar, anular, reactivar, quitar, firma de la oficina y los pendientes;
  - casos del ingeniero (`_ingGuardar`, `_ingGuardarMasiva`, `_ingCerrarMasiva`): el caso queda en la cola local de `checklists.js` y la versión nueva lo reenvía;
  - revisión de soportes (`_revEncolarNuevos`, `_revResolver`, el barrido);
  - rastreador (`_escribirRastreoWisp`, además de la guarda al programar);
  - firmas de los bloques (`_sembrarFirmasMovs`);
  - el cargue de comprobantes y «Pagos sin oficina» miran la versión antes de subir o de meter pagos.
- **No se frenan:** la auditoría (`_enviarLogsAuditoria`), las sesiones (`registrarSesion`), los fallos de guardado (`_registrarFalloGuardado`) y el latido.
- `?ignorarVersion` salta el freno y la guarda de 24 h, a propósito: es el mismo escape de `_pestanaDesactualizada`.

### Más de 24 h abierta

- **INVENTARIO y OFICINAS:** si la página lleva más de 24 h cargada (hora del equipo al cargar), sale una capa propia que pide actualizar: «Esta pantalla lleva más de un día abierta. Actualízala para seguir trabajando con los datos al día. (Si pasaron más de 12 horas desde que entraste, te pedirá la clave otra vez.)», con «🔄 Actualizar ahora».
  - Sale solo con la pantalla **quieta**: sin una ventana abierta, sin nadie tecleando, sin nada guardándose, en la fila, por reintentar o sin llegar a la nube, sin el buzón ni la lista «Antes de llamar» abiertos y sin un aviso de versión en marcha. Mientras tanto espera.
  - **No frena el guardado:** si alguien guarda estando caducada (porque estaba escribiendo), ese guardado pasa (es la versión vigente) y la capa sale cuando la pantalla queda quieta.
  - La capa va por debajo del aviso de versión nueva (`#capaCaducadaInv` por debajo de `#versionBlock`; `#capaCaducadaOfi` por debajo del mantenimiento, de `#ovVersionVieja` y de `#versionBanner`), sin la clase `pvRecargaTexto`.
  - El botón recarga conservando `?prueba=1`, `?ignorarVersion` y los demás parámetros, también sin `recarga.js`.
  - Se revisa cada 60 s, al volver a la vista y al enfocar la ventana.
  - En OFICINAS, con la capa puesta, la sincronización rápida, el rastreador, el barrido de la revisión y la siembra de firmas no arrancan vueltas nuevas (`_capaCaducadaPuestaOfi()` en `_programarSyncRapida`, `_programarRevisionHuecos`, `_revProgramarBarrido` y `_sembrarFirmasMovs`). Desde la revisión, L4b del banco provoca de verdad una vuelta de cada uno con la capa puesta; antes su comprobación no podía fallar.
  - Apagada en modo prueba y con `?ignorarVersion`. No va en `_pestanaDesactualizada`: apagaría la sincronización y el rastreador con la pantalla en uso.
- **TÉCNICOS: solo un aviso, sin bloquear,** para no estorbar su cola sin señal.
  - La franja `#avisoCargaViejaTec` va antes de la lista (como `#colaFinTec`): «La app lleva más de un día abierta. Cuando termines lo que estás haciendo y tengas señal, toca «Recargar».», y «Tienes N por enviar: no se pierden.» si hay cola.
  - «Recargar» solo recarga sin nada guardándose ni enviándose, sin una ventana abierta y con señal; si no, dice por qué espera. La señal se comprueba de verdad (la página publicada responde, en 10 s como mucho) solo si `recarga.js` cargó; si no cargó (se abrió con señal débil), la única barrera es `navigator.onLine`, que en un celular con una barra da `true` (ver «Lo que quedó sin hacer»).
  - Se oculta con el aviso de versión nueva. No frena escrituras ni la recarga automática.
- Al recargar una pestaña de más de 12 h se pide la clave otra vez (riesgo R5): la capa lo dice.
- Funciones puras para las pruebas: `_caducadaInv`, `_caducadaOfi` y `_caducadaTec` (más de 24 h; exactamente 24 h todavía no), `_decidirCaducidadInv` y `_decidirCaducadaOfi`.

### La versión a la vista y los oyentes de versión

- **INVENTARIO:** `#invVersionLabel` legible (ya no tenue) y la versión en la entrada (`#invVersionLogin`).
- **OFICINAS:** `#appVersionCab` junto al reloj de la cabecera, y la versión en la entrada (`#appVersionLogin`). Además, `_recargarVistaSilenciosa` ahora cambia solo `#syncText`, y no lo toca si el punto está en error o guardando (`sync-err`, `sync-saving`). Antes reemplazaba todo `#syncStatus` y borraba `#syncDot` y `#appVersionLabel` al primer repintado; desde ahí `showSync` no mostraba nada.
- **TÉCNICOS:** `#hVersion` y la versión en la entrada (`#liVersion`).
- **RED:** antes no se veía en ninguna parte. Ahora va en la entrada (`#versionRedEntrada`) y en la cabecera (`#versionRedApp`).
- **Oyentes con reintento:** si el oyente del documento de versión cae (sin señal largo rato, cuota, reglas), Firestore no lo revive y la pantalla nunca se enteraría de una versión nueva. Ahora las cuatro apps vuelven a suscribirse a los 60 s, con un solo reintento vivo a la vez y sin duplicar el oyente.

### Lo que el latido NO ve

- **Las pantallas anteriores a esta etapa** (OFICINAS hasta v319, INVENTARIO hasta v114, TÉCNICOS hasta v100, RED hasta v43) no envían latido y el panel no las ve. Es lo que más importa: son las sospechosas. El panel lo dice siempre.
- **Cómo se delatan:**
  - Las de la Etapa 1 (v319, v114, v100, v43) sellan sus escrituras a `inventario/datos` con app y versión (`_ultimaEscritura`): la 🛡️ Vigilancia muestra cuál escribió.
  - Las anteriores a la Etapa 1 escriben sin sello, y eso también se anota (`_escrituraSinSelloInv`).
  - `logs_sesiones` dice quién entró, pero no la versión.
- **Al publicar esta etapa,** las pantallas de la Etapa 1 se recargan solas (`recarga.js`) cuando quedan quietas y vuelven con latido. Las anteriores a la Etapa 1 necesitan el botón o cerrar y abrir, como dice el §7.
- **Un celular con la app de fondo** no corre nada: el panel la muestra «sin latido» aunque siga abierta.
- **Si nadie ha latido en horas** (por ejemplo, el administrador abre el panel antes de su primer latido), el latido más nuevo es viejo y las pantallas muertas cerca de esa hora no salen como «sin latido». La columna «hace cuánto», con la hora de quien mira, sí lo deja ver.
- **Un `en` escrito desde internet a menos de 24 h por delante** (por ejemplo, ahora + 23 h) todavía es creíble y cuenta como el más nuevo: mientras tanto el panel ve a todas «sin latido» y la poda quita antes de tiempo las que llevan más de 1 h sin latir. Se cura solo en menos de 2 días (ya no es permanente, como el del año 2100). Lo cierra la autenticación real (`docs/SEGURIDAD-URGENTE.md`).

### Costos (plan gratuito: 20.000 escrituras y 50.000 lecturas al día)

Estimación con los inicios de sesión reales (21 sep–9 oct) y la auditoría de OFICINAS: unas 15 pantallas abiertas a la vez de base y 25 en el peor caso.

| Qué | Al día | % de lo gratis |
|---|---|---|
| Latidos, 15 pantallas de 7:00 a 18:00 (12 por hora cada una) | ~1.980 escrituras | 10 % |
| Latidos, 25 pantallas de 7:00 a 18:00 | ~3.300 escrituras | 17 % |
| Más 3 pestañas que pasan la noche abiertas | +468 escrituras | +2,3 % |
| Peor caso: 25 pantallas las 24 h | 7.200 escrituras | 36 % |
| Una lectura por carga de página (para podar) | 50–150 lecturas | < 0,3 % |
| Panel: 5 lecturas por apertura (el documento y las 4 versiones) | unas decenas | despreciable |

- **Los 12 por hora son un techo, no un promedio** (a la vista; oculta son 4). Lo cambió la sesión principal después de la revisión: con el mínimo de 1 min que tenía antes `minEntreMs`, cada vuelta a la pestaña disparaba un latido. Medido por los revisores con el `pantallas.js` real: una cajera que alterna con WhatsApp Web cada 2 min daba 30 latidos por hora (unas 8.250 escrituras al día con 25 pantallas, el 41 %), y cada 70 s, 51 por hora (unas 14.000, el 70 %). Con el mínimo en 5 min, ir y venir entre pestañas nunca pasa del ritmo normal (lo comprueba la prueba 2). Importa porque si el total del día (latidos más guardados de las cuatro apps) pasa de 20.000, Firestore rechaza **todas** las escrituras hasta la medianoche del Pacífico, también los guardados de caja y de bodega.
- Cada carga de página (abrir, F5, la recarga automática) empieza con un latido inmediato y una lectura (la de la tabla): recargar mucho sí suma.
- La poda no suma escrituras: va en el mismo `set merge` del latido. Solo el panel escribe una vez cuando hay algo que podar o una entrada con hora imposible que quitar (las dos cosas en el mismo `set merge`).
- Ninguna pantalla escucha el documento: si todas lo escucharan, con 15 pantallas serían unas 29.700 lecturas al día (59 %), y con 25 se pasaría del límite.
- **Lo que ya se gasta hoy no se pudo medir:** está en la consola de Firebase, en «Uso». Las lecturas ya llegaron a 44.000 de 50.000 el 10 sep. Conviene mirarlo la primera semana.

### Privacidad

`oficinas_sistema` se lee sin autenticación desde internet.

- **Qué nombre lleva cada latido:**
  - INVENTARIO: el nombre de la bodega o «Admin».
  - OFICINAS: el de la oficina, «Admin» o «SG-SST».
  - TÉCNICOS: solo el primer nombre del técnico.
  - RED: la sede y el primer nombre («DONCELLO · Ana»), «Admin» o la bodega.
- **Nunca** una cédula (`TEC.documento`, `USER.doc` de RED), un teléfono, un correo ni un nombre completo. Del navegador solo «celular» o «pc».
- `entrada()` además quita del nombre los correos y los tramos de 5 o más cifras.
- **Límite:** `entrada()` no distingue un nombre completo del nombre de una sede. Por eso TÉCNICOS y RED entregan el primer nombre ya sacado; quien agregue otra app debe hacer lo mismo (o usar la llave `persona`, que lo garantiza).
- **Límite que el primer nombre no cierra (encontrado en la revisión, sin corregir):** el latido lleva `sesion` y `equipo`, los mismos identificadores (`_sesionTec`, `pv_equipo_id`) que el sello de la Etapa 1 en `inventario/datos` (`_ultimaEscritura`, `_escrituras`), y el sello de TÉCNICOS (`_selloEscrituraTec`) guarda en `quien` el nombre **completo** del técnico. Los dos documentos se leen sin autenticación: uniendo por `sesion` o por `equipo` (que dura días en el celular), cualquiera sabe, con nombre y apellidos, cuándo tiene un técnico la app abierta y a la vista, con qué celular y su último latido. Antes solo estaba la hora de entrada en `logs_sesiones`. La forma de `sesiones_vivas` no hay que tocarla para cerrarlo: lo más simple es que el sello de TÉCNICOS guarde solo el primer nombre o el rol (y lo mismo `plan.tecNombre`, que lo alimenta desde la cola); la otra opción, quitar `sesion` y `equipo` del latido de TÉCNICOS, pierde la correlación con la 🛡️ Vigilancia. Decisión de Elkin.

### Riesgo anotado: RED trabaja con datos viejos

RED carga `main` e INVENTARIO una sola vez y no escucha sus documentos `red_*`. Una pestaña de RED abierta mucho tiempo puede pisar datos con su copia vieja: plantillas, permisos o la red de la sede. RED no lleva guarda de 24 h, porque el §5 solo la pide para INVENTARIO, OFICINAS y un aviso en TÉCNICOS. Queda para una etapa futura: escuchar los `red_*` o pedir recargar como en las otras dos.

### Pruebas

**`PRUEBAS.html`: 154 pruebas** (35 de INVENTARIO, 86 de OFICINAS, 32 de RED y 1 de Firma). Las seis nuevas:

| # | Grupo | Prueba |
|---|---|---|
| 1 | inv | El latido dice qué pantalla es sin datos personales |
| 2 | inv | La poda usa la hora del servidor y nunca borra a otros por un reloj mal puesto |
| 3 | inv | El panel marca las pantallas viejas, las de más de 24 h y las que no laten |
| 4 | red | Ninguna app late en modo prueba y el latido arranca solo tras iniciar sesión |
| 5 | ofi | OFICINAS ya no guarda con versión vieja (y el guardado del mantenimiento sí sale) |
| 6 | ofi | Más de 24 h: INVENTARIO y OFICINAS piden actualizar con la pantalla quieta; TÉCNICOS solo avisa |

- **1 a 3** usan el `PV_PANTALLAS` del marco de INVENTARIO para lo puro. Lo que corre en el tiempo (el latido, el panel, un reloj adelantado o que retrocede) va en una copia aparte de `pantallas.js` (`pantallasAparte`): navegador falso, temporizadores que no corren solos y otra `Date`.
- **La 1** exige los tiempos nuevos: `TIEMPOS` = `{visibleMs:300000, ocultaMs:900000, minEntreMs:300000, edad24Ms:86400000, sinLatidoMs:960000, tope:400}`, congelado.
- **Casos que pidieron los revisores** (agregados después de la revisión, sin escribir en la nube ni sumar a `_escriturasBloqueadas`):
  - en la 2: un `en` del año 2100 (número, `{seconds}` o `Timestamp`) no hace podar a las demás, ni en `podar` ni en el primer latido de una carga con esa entrada en la nube; con el tope de 400 es la primera en salir; y con el reloj de quien poda 3 días atrasado, poda menos, nunca más;
  - en la 2: la hora del equipo va 2 días adelantada y retrocede entre ocultar y volver (con los tiempos de verdad): oculta, el turno queda en 15 min como mucho; al volver, el latido sale en 5 min o menos (sale enseguida) y el siguiente en 5; si retrocede otra vez, un latido forzado igual sale;
  - en la 2: cambiar de pestaña no suma latidos: al volver a la vista a los 2 min espera su turno (3 min más); a los 6 min late enseguida;
  - en la 3: con un `en` del año 2100 el panel no queda ciego (las 5 que laten siguen vivas, el más nuevo sigue siendo el creíble), su fila dice «Hora imposible», `futuras` la quita (nunca la propia, y nada si el reloj de quien lee va días atrasado), al abrir el panel sale junto con las de más de 24 h en un solo `set merge` y el aviso lo dice; en modo prueba no quita nada.
- **4** va en el grupo de RED, al final, para que estén abiertos los marcos de INVENTARIO, OFICINAS y RED. TÉCNICOS se lee como texto.
- **5** infla `appVersionPublicada` solo en memoria y restaura todo. Los intentos del guardado de la excepción (bloqueados por el modo prueba) se cuentan aparte y se quitan, como en la 5368. Desde la revisión, además quita `#ovVersionVieja` en el `finally` si no estaba al empezar, y lo comprueba: si el tic de 30 s de `_verificarVersionVieja` caía durante el guardado de la excepción, la capa quedaba puesta y la 6 fallaba (en un 3 a 15 % de las corridas, según el revisor).
- **6** simula la hora de carga (25 h). Pone y quita la capa a mano: en modo prueba la revisión real siempre da «apagada». Toma la pantalla como quieta con `_ultimaTeclaApp` en 0, porque la prueba 5826 teclea en un campo poco antes y OFICINAS cuenta 45 s como «escribiendo». Luego lo restaura.
- **Ninguna prueba vieja hubo que adaptarla:** `#syncStatus`, la versión en la cabecera, la del celular y los textos que buscan la 4744, la 7087 y la 2627 siguen pasando.

**Corrido el 10 oct 2026** sobre la base SIMULADA del banco, sin servidor (Playwright sirve los archivos del repo desde el disco), con las apps de la copia de trabajo, antes y después de la revisión (la segunda vez con `pantallas.js`, OFICINAS, INVENTARIO y `PRUEBAS.html` ya corregidos):
- `PRUEBAS.html` completo: 153 de 154 bien, las dos veces. Falla solo «Rastreador v314: la ficha de una factura REAL de WispHub», que necesita WispHub de verdad. Con el `PRUEBAS.html` de `1b2e58f` falla igual.
- Ninguna escritura en la base simulada; ningún error de JavaScript. Los 5 intentos bloqueados que quedan en el marco de OFICINAS son de pruebas anteriores (salen igual con el `PRUEBAS.html` de `1b2e58f`). Los de INVENTARIO y RED, en 0.
- **Copias dañadas, después de la revisión:** se hicieron 5 copias de `pantallas.js`, cada una sin un arreglo: `enCreible` que acepta cualquier `en` (sin la regla de la hora imposible), `siguiente()` sin tope, `pasoMinimo` sin la diferencia negativa, los tres arreglos del reloj juntos, y `minEntreMs` de vuelta a 60 s. Las 5 fallan: la primera en la 2 y la 3; las tres del reloj, en la 2; la de 60 s en la 1 (los tiempos) y en la 2 (cambiar de pestaña).
- **Copias dañadas, antes de la revisión:** las 6 pruebas detectan las 35 de `pantallas.js` (sin modo prueba, poda con la hora del equipo, sin lista blanca, panel sin escapar, sin tope, latido sin poda, sin reintento al volver la señal, un carácter bidireccional en el fuente, entre otras). También detectan 24 de las apps: sin freno en `_saveReal`, freno que deja el guardado fallido, excepción del mantenimiento perdida, `_ingGuardar` sin guarda, latido sin modo prueba o por `_setDoc`, latido arrancado al cargar, capa por encima del aviso de versión, TÉCNICOS sin la excepción del latido o con el nombre completo, RED con la cédula o sin merge, entre otras.

**El banco simulado, antes de la revisión** (`_PRUEBAS_SIMULADAS_2026-10-09/trabajo/etapa6_resultados/`, 10 oct 2026, 11:23–11:33):

| Qué | Resultado |
|---|---|
| `inv/etapa6.js` (nuevo) | 10 de 10: L1 latidos de seis pantallas, L2a pantalla vieja que late con `vieja:true`, L2b el código anterior no late, L3 panel, L4a–c más de 24 h en las tres apps, L5 reloj adelantado, L6a–b freno de OFICINAS y la excepción del mantenimiento |
| `inv/pantallas_unit.js` (nuevo) | 174 bien |
| `recarga_unit.js` | 167 bien |
| `repro.js` | 21 de 21 |
| `escenarios2.js` | 20 de 20 |
| `etapa1.js` | 16 de 16 |
| `revision_oct.js` | 5 pasan y 6 fallan a propósito: R2–R5, R7 y R7b son de las Etapas 2 a 5 |

**Después de la revisión** solo se volvió a correr lo que tocaron los arreglos:

| Qué | Resultado |
|---|---|
| `inv/pantallas_unit.js` | 216 bien (antes 174; vuelto a correr al cerrar este documento). De las 42 comprobaciones nuevas (hora imposible y reloj que retrocede), 30 fallan con el `pantallas.js` anterior |
| `inv/etapa6.js` L3 y L5 | pasan (panel y reloj adelantado 3 días) |
| `inv/etapa6.js` L4b, reescrita | pasa en 11 s. Con la capa puesta provoca una vuelta de la sincronización rápida, el rastreador, el barrido y la siembra, y exige que no escriban `main`, `movs_*`, `rastreo_*` ni `revision_soportes`; una contraprueba quita la capa un instante para que la sonda no pueda quedar ciega. Detecta 5 copias de OFICINAS dañadas en memoria (sin cada guarda, M1–M5) |
| `inv/etapa6.js` L6a y L6b | pasan (freno y excepción del mantenimiento), también después de todos los cambios |
| R1–R3 del permiso (copia en el scratchpad de la sesión, no en el banco) | R1: la salida del mantenimiento falla una vez y el reintento de 20 s pasa el freno. R2: un 📎 empezado al día llega a la nube aunque la versión nueva salga mientras sube; uno empezado con el aviso se frena y lo dice. R3: lo que entró a la fila antes del aviso llega; lo pedido después se frena |

**No se volvió a correr después de la revisión:** L1, L2a, L2b, L4a y L4c de `etapa6.js`, `recarga_unit.js`, `repro.js`, `escenarios2.js`, `etapa1.js`, `revision_oct.js` ni las 24 copias dañadas de las apps. Los escenarios que abren TÉCNICOS se dejaron fuera; TÉCNICOS y RED no se tocaron en la revisión (sí el `pantallas.js` que cargan).

### Revisión del 10 oct

Seis hallazgos confirmados (dos revisores de acuerdo en cada uno) y seis dudosos (uno de dos). Tres más se refutaron; los tres decían lo mismo: que las pruebas 1 y 4 llaman al escritor real del latido de INVENTARIO y, si su guarda de modo prueba se rompiera, dejarían en la base real una entrada que nunca se poda.

| Hallazgo | Gravedad | Qué se hizo |
|---|---|---|
| Un guardado frenado al salir la versión nueva se perdía en la recarga automática, sin aviso o con un «✅ … correctamente» falso (📎, la fila, comprobantes de un abono) | alta | Permiso tomado al empezar, que heredan la fila y el reintento, y avisos donde se frena (arriba, «Lo que ya venía en camino») |
| La excepción del mantenimiento valía para un solo intento: si fallaba, el reintento prometido se frenaba | baja | El reintento hereda `{mant:true}` |
| Si la hora del equipo se corrige hacia atrás, el turno se iba a días y la pantalla salía del panel | baja | Tope en `siguiente()` y diferencia negativa como «ya pasó» |
| Un solo `en` del futuro escrito desde internet borraba a todas las demás en cada carga y dejaba el panel ciego para siempre | baja | Regla de la hora imposible y `futuras` en el panel |
| La prueba 5 podía dejar `#ovVersionVieja` puesto y hacer fallar la 6 | baja | La 5 la quita y lo comprueba |
| La comprobación de L4b no podía fallar | baja | L4b reescrita, con contraprueba |
| (dudoso, dos veces) Volver a la pestaña disparaba un latido por minuto: hasta 30 a 60 por hora, no 12 | media | `minEntreMs` de 1 a 5 min (la sesión principal, después de la revisión) |
| (dudoso) `?ignorarVersion` puede llevar a `main` una versión publicada errada | baja | Sin hacer |
| (dudoso) «Buscando factura #N...» queda pegado en el indicador | baja | Sin hacer |
| (dudoso) El latido de TÉCNICOS se une al nombre completo por `sesion` y `equipo` | baja | Sin hacer (anotado en «Privacidad») |
| (dudoso) «Recargar» de TÉCNICOS recarga sin comprobar la señal si `recarga.js` no cargó | baja | Sin hacer |

### Lo que quedó sin hacer

Lo que los correctores dejaron sin hacer y sigue siendo cierto, y los dudosos que no se corrigieron, con su riesgo:

1. **El permiso de OFICINAS no vence.** Un trabajo que empezó con la versión al día pasa el freno cuando termine, aunque sea mucho después (por ejemplo, alguien que deja abierta la ventana del repetido). Esa pantalla vieja escribe `main` y sus bloques una vez más con su código viejo; las órdenes de TÉCNICOS siguen protegidas por la fusión de órdenes que corre en cada intento de escritura (v277). Los revisores proponían una ventana de 2 min desde que la pantalla supo de la versión nueva; no se hizo porque dejaría pasar el `save()` que L6a, L6b, L2a y la prueba 5 exigen frenar.
2. **La gestión de una recogida no avisa si se frenó:** lleva el permiso, pero si empezó con el aviso ya puesto, cierra la ventana como si hubiera guardado.
3. **Lo que se frena sin un trabajo que avise** (un guardado de fondo pedido después del aviso) se pierde con solo el aviso del indicador, que queda tapado por `#versionBanner`. No se hizo el «plan B» de los revisores: decirlo dentro de `#versionBanner`/`#ovVersionVieja`, anotarlo en `sessionStorage` para repetirlo al volver a entrar y darle un motivo propio en `_ocupadoRecargaOfi`. Con el permiso, eso es casi solo trabajo de fondo.
4. **Otros caminos que suben archivos** (`heGuardar`, `_subirSoportePrest`, `guardarAbono` de préstamos) no pasan por `_saveReal`: este freno no los toca.
5. **`_ocupadoRecargaOfi`** sigue diciendo «una oficina no cargó completa» cuando un guardado quedó parcial por un índice ilegible o una espera larga (texto de la Etapa 1). Con el reintento heredado, solo sale si fallan los 3 reintentos.
6. **(dudoso) `?ignorarVersion` puede dejar una versión errada en `main`.** La línea que sube `DB.config.appVersionPublicada` a `window._mantVersionOficinasNube` corre en todo guardado que pasa el freno, no solo en el de la salida del mantenimiento. Si `app_version` queda con una versión que no existe (999: una copia abierta desde un nombre de equipo que `_esEntornoLocal` no reconoce, o cualquiera desde internet), todas las oficinas quedan tapadas; el administrador entra con `?ignorarVersion` y cada guardado suyo escribe 999 en `main`. Al corregir `app_version`, ninguna oficina guarda hasta que alguien corrija también `main`. Arreglo propuesto: subirla solo cuando el guardado sale del mantenimiento, o nunca con `?ignorarVersion`.
7. **(dudoso) «Buscando factura #N...» queda pegado.** `recuperarFacturaPorNumero` pone `showSync('saving', …)` y en varias salidas (no existe, no está pagada, vale 0, falla la consulta, cancelar) no lo quita. Como `_recargarVistaSilenciosa` ya no toca el texto con el punto en `sync-saving`, queda parpadeando hasta el siguiente guardado. Arreglo propuesto: saltar solo con `sync-err`, o con `sync-saving` y `_saveInProgress`; o `showSync('ok', …)` en esas salidas.
8. **(dudoso) Privacidad de TÉCNICOS:** la unión por `sesion` y `equipo` con el nombre completo del sello (ver «Privacidad»). Decisión de Elkin.
9. **(dudoso) «Recargar» de TÉCNICOS sin `recarga.js`:** si `recarga.js` no cargó al abrir (señal débil), el botón solo mira `navigator.onLine`. Con una barra sin datos recarga, la página no carga (no hay service worker) y el técnico queda en «sin conexión» hasta que vuelva el internet; la cola no se pierde (está en el celular), pero no puede ver órdenes ni finalizar. Arreglo propuesto: el mismo `fetch` de la página con `cache:'no-store'`, tope de 10 s y `APP_VERSION_TEC` en el texto, antes de `location.replace`.
10. **`pantallas.js`:** un `en` a menos de 24 h por delante todavía cuenta (ver «Lo que el latido NO ve»); el panel podría quitar entradas vivas si el reloj de quien lo abre va más de un día atrasado y además quedan más registros viejos sin podar que pantallas vivas (vuelven en su siguiente latido, de 5 a 15 min); las claves que no tienen la forma `p` + 12 no se tratan como basura (cambiaría qué se conserva y rompería pruebas que usan claves cortas); y `en` numérico se sigue aceptando fuera de la copia local (un `timestampValue` escrito por REST llega como `Timestamp` de verdad, así que no cerraría nada).
11. **Pruebas que faltan:** en el banco, las copias dañadas de `apps_mut.js` sin cada guarda de la capa (la contraprueba de L4b y M1–M5 lo cubren en parte) y pasar R1–R3 del permiso al banco como L6c–L6e; en `PRUEBAS.html`, una revisión por texto de que las cuatro funciones llaman `_capaCaducadaPuestaOfi()` y de `_permisoReintento` y `save({permiso`.
12. **`recarga.js` en modo prueba:** si el tic de 30 s cae durante el guardado de la excepción de la prueba 5, el `PV_RECARGA` del marco de OFICINAS queda con `objetivo` = la versión inflada. Su fase sigue en «prueba» y ninguna prueba lo mira, así que no afecta; `recarga.js` no tiene cómo reiniciarse desde fuera.

### Pendiente

1. **Correr `PRUEBAS.html` en el navegador contra la base real** (en `?prueba=1`) antes de publicar. Aquí se corrió solo sobre la simulada.
2. **Al publicar,** subir las cuatro versiones (OFICINAS 320, INVENTARIO 115, TÉCNICOS 101, RED 44) con el formato de siempre, porque la nota del panel ya las nombra. Después, comprobar en la nube real:
   - que se cree `oficinas_sistema/sesiones_vivas` y que `en` llegue como `Timestamp`;
   - que el `set merge` con `deleteField()` borre solo esas claves (el simulador lo hace, pero no se comprobó en Firestore);
   - que el panel marque bien una pantalla vieja;
   - mirar el gasto la primera semana (con el mínimo de 5 min, unas 12 escrituras por hora por pantalla a la vista como mucho).
3. **Decidir con Elkin** los puntos 1, 3, 6, 8 y 9 de «Lo que quedó sin hacer»: el permiso sin vencimiento, el aviso de lo frenado en el fondo, `?ignorarVersion` y `appVersionPublicada`, la privacidad de TÉCNICOS y el «Recargar» sin `recarga.js`.
4. **`_sgEscribir` y las firmas SG-SST no tienen el freno de versión:** el §2.2 del plan no las incluía. `_sgEscribir` además sigue guardando el nombre completo en `actualizadoPor` (ver `docs/07-sgsst.md`).
5. **RED:** el riesgo de datos viejos (arriba). Además, ya anotados y sin tocar: `anotarEstadosVistos` guarda la sede entera, `#versionBlock` aparece aunque se use `?ignorarVersion` y `borrarPlantilla` no tiene `try/catch`.
6. **INVENTARIO:** si `startFirebase` corre dos veces, los oyentes de `oficinas_sistema/mantenimiento` y `oficinas_sistema/app_version` se duplican. Ya pasaba antes de esta etapa.
7. **La 6b** (reglas de Firestore que rechacen versiones viejas) sigue opcional y con Elkin: el latido no la reemplaza, solo deja ver las pantallas.

Resuelto en la revisión: INVENTARIO ya no sigue latiendo después de cerrar sesión (`PV_PANTALLAS.detener()` en su `doLogout`).
