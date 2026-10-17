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

> **Hecha el 13 oct 2026, sin publicar** (INVENTARIO sigue en 116 y TÉCNICOS en 101; al publicar, 117 y 102 juntos). Además de los tres puntos, cada botón y cada lista actúan sobre su propia fila (el «Pendiente» 1 de la Etapa 2) y TÉCNICOS devuelve de la fila que escogió el técnico. R5 pasa. Lo que quedó, lo que se apartó del plan y lo que falta decidir con Elkin: ver §12.

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

> **Adelantado en la Etapa 2 (11 oct 2026):** los pasos 1 y 2 ya están hechos para «Corregir Cantidades» (la revisión adversaria lo pidió para que su lápida no borrara material), y R7 y R7b pasan. Queda el paso 4: las demás ventanas. Ver §11.

> **Hecha el 15 oct 2026, sin publicar** (INVENTARIO sigue en 117; al publicar, 118 solo: TÉCNICOS no cambia). El paso 4 se hizo en todas las ventanas que mueven stock o escriben en una cuadrilla, un técnico o un cliente. Además, las filas en 0 de las cuadrillas ya no se quitan y ↩️ Devolver va en un solo paso contra la nube. Lo que quedó, lo que se apartó del plan y lo que falta decidir con Elkin: ver §13.

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

## 11. Etapa 2 — lo que se hizo (publicada el 11 oct 2026)

Hecho el 10 y 11 oct 2026 sobre lo publicado en `1b8a06b` (OFICINAS v320, INVENTARIO v115, TÉCNICOS v101, RED v44), a pedido de Elkin: «publica etapa 6, apenas termines inicia etapa 2». **No está publicado** y la versión no se subió: al publicar, INVENTARIO pasa a 116 (la línea de siempre). Las pruebas no escribieron nada en la base real.

Las tres partes del §5 (C1, C2 y C3) se hicieron por separado, en ese orden, sobre el mismo archivo. Después, el mismo 11 oct, una revisión adversaria en dos pasadas encontró fallas y se corrigieron (ver «Revisión adversaria», más abajo). Lo que sigue es lo que quedó al final, ya con esos arreglos.

### Qué quedó en cada archivo

| Archivo | Qué cambió |
|---|---|
| `INVENTARIO_PTOVISION.html` | Lápidas por fila y «cerrada sin cambios» (C1), decisiones con su efecto, reintentos y «⏳ por subir» (C2), una sola solicitud pendiente por artículo (C3). Tres bloques comentados «Etapa 2 (docs/12, C1/C2/C3)» en el script clásico, después de `_fusion3RegistroInv`, y uno de C2 junto a `_fbSaveCore`. Los arreglos de la revisión llevan el comentario «Revisión del 11 oct 2026» o «Segunda revisión del 11 oct 2026». De paso, la ventana «Corregir Cantidades» ya no trabaja con datos viejos (parte de la Etapa 4: pasan R7 y R7b) |
| `PRUEBAS.html` | 7 pruebas nuevas (4 de la etapa y 3 de la revisión), el ayudante `e2FotoLS`/`e2RestaurarLS` y 3 pruebas viejas adaptadas (161 en total) |
| TÉCNICOS, OFICINAS, RED | Sin cambios. No leen `deleteRequests`, `editRequests`, `transfers` ni `inventario/historial`; de `inventario/datos` solo leen `bodegas` y `cuadrillas`. Un campo nuevo de primer nivel en `inventario/datos` no les cambia nada |

### Lápidas por fila (`inventario/datos._tumbasFila`) · C1, prueba R2

**Por qué no en `_tumbas`.** `_tumbaInv` compara solo `col` e `id`: una lápida `{col:'bodegas', id:<bodega>, fila:…}` dentro de `_tumbas` se tomaría por el borrado de la bodega entera, también en las pantallas v112 a v115 que sigan abiertas. Además `_tumbas` se poda a los 15 días y 800 entradas: una pestaña abierta más tiempo resucitaría la fila. Por eso es un campo propio de primer nivel: viaja en el mismo `tx.update` que la fila quitada (borrado y lápida atómicos) y llega en el mismo snapshot que bodegas y cuadrillas.

**Forma:** `{col:'bodegas'|'cuadrillas', id, fila, nom, tipo, en, ult?, por, origen:'aprobacion'|'directo'|'corregir', req, cant, snes, snesN, rep, anulada:null|{motivo, en}}`.
- `por` es el rol (`USER.role`), nunca un nombre: la base se lee sin autenticación.
- `cant` y `snes` son la cantidad y los seriales al borrar (en «Corregir», los de antes de corregir); los seriales van normalizados con `_snNormal`, sin rellenos, máximo 60.
- `ult` solo aparece si se juntaron dos borrados de la misma fila: es la hora del último (ver «Unión»).
- Ningún campo queda `undefined` ni lleva `serverTimestamp()` (va dentro de un arreglo).
- `_tumbasFila` no se crea si no hay lápidas en ningún lado, para no provocar escrituras de más.

**Unión** (`_unirTumbasFilaInv`, pura): una por `col|id|fila|nombre|tipo`.
- `en` es el menor. Los datos (cantidad, seriales, solicitud, origen) son los del borrado más reciente, y su hora queda en `ult`.
- Una anulación cubre los borrados hasta el suyo, no los que vengan después: si la fila se vuelve a borrar después de anularse, ese borrado nuevo vale. Antes la anulación vieja se lo tragaba por 180 días: la fila no salía y, tras recargar, la solicitud quedaba «aprobada» con el artículo en la bodega.
- Si varias anulaciones cubren el último borrado, gana la primera por hora.
- `_crearTumbaFilaInv` pone el borrado nuevo después del `ult` anterior aunque el reloj del equipo vaya atrás.
- El orden es fijo: unir dos veces da lo mismo, en cualquier orden, y un guardado no reescribe la lista sin motivo (3.008 comprobaciones en `fix2_union_prop.js`).

**Poda** (`_podarTumbasFilaInv`, pura): fuera las de más de 180 días (contados desde el último borrado) y las de registros que ya no existen; tope de 2.000 (las más nuevas). Una colección que no llegó, o llegó vacía, no se poda por existencia: una carga a medias no borra lápidas. La poda de `_tumbas` (15 días / 800) no cambió.

**La regla** (`_aplicarTumbasFilaInv`, pura, devuelve copias): la fila con lápida sale **aunque la otra pantalla le haya cambiado cualquier otro dato** (observaciones, historial, foto, la `categoria` que pone `fixDB`). Eso es R2. Sin lápida, la regla de siempre se queda igual: «una fila quitada en un lado y cambiada en el otro se conserva», que es la que protege lo que una pantalla todavía no subió.

**Excepción: entró material.** Si la fila tiene más cantidad que `cant`, o un serial (normalizado, sin rellenos) que no estaba en `snes`, le entró material mientras se borraba:
- la fila se conserva y la lápida queda anulada con `motivo:'entró material después del borrado'`;
- queda una línea en el registro de actividad («El artículo "X" volvió a BODEGA porque le entró material mientras se borraba»), una sola vez por borrado, y un recuadro en la tarjeta 🛡️ Vigilancia (las anuladas de los últimos 30 días);
- la anulación viaja por la unión: una vez anulada, la lápida no vuelve a quitar la fila aunque después baje el stock (solo un borrado nuevo la vuelve a quitar).

**Contra qué se mide** (`_entroMaterialFilaInv`). Las demás pantallas abiertas tienen la fila con la cantidad de antes del borrado, y una pantalla atrasada (sin señal, o con la pestaña suspendida) puede tener más. Eso no es material que entró. Medirlo contra la lápida anulaba el borrado con un aviso falso, una escritura de más por pantalla y, si esa pantalla había tocado la fila, la devolvía con stock viejo. Por eso:
- **Lo que viene de la nube** (lo que trae un snapshot), las transacciones y la carga inicial: contra la lápida, como siempre.
- **La memoria de la pantalla que recibe** (oyente, `_aplicarNubeParcialInv` y guardado), con una lápida que **ya está en la nube** (`_enNubeTFInv`: la que trajo el snapshot tal cual, la recién leída o la de la última bajada, `window._tfNubeInv`): cuenta solo lo que esa pantalla le metió por encima de su base (`window._baseStockInv`, lo último que vio de la nube). Es decir, más cantidad que el mayor entre la lápida y la base, o un serial que no está ni en la lápida ni en la base.
- **La memoria, con una lápida que solo tiene esta pantalla o el navegador** (la de otra pestaña, la de «Corregir»): contra la lápida. Esa lápida puede ser más vieja que la base, y contra la base el material que entró después no se veía: la fila se quitaba sin aviso (segunda pasada de la revisión).
- **Al recibir, primero se deciden las anulaciones de las dos pasadas** (la memoria y lo que entra), sin quitar nada, y después se quita. Antes la pasada sobre la memoria podía quitar una fila cuya lápida la otra pasada anulaba; la fusión fina tomaba esa falta como un borrado propio, la fila se perdía y quedaba el aviso de que volvió.

**Cuándo una fila coincide** (`_filaCoincideLapidaInv`): mismo registro y mismo id de fila. Si en ese registro hay más de una fila con ese id (pasa en los datos reales: un grupo de 3 en una bodega y 5 grupos en cuadrillas), además el nombre (mayúsculas, sin tildes, espacios colapsados) y el tipo. Una anulada nunca coincide.

**Dónde se crean:**
- `approveDelete` aprobada: `origen:'aprobacion'`, `req` = id de la solicitud;
- `delMat` del admin (borrado directo): `origen:'directo'`;
- «Corregir Cantidades» de cuadrilla: una por cada fila que quita por quedar en 0 y sin seriales (`origen:'corregir'`). Lleva la cantidad y los seriales que la fila tenía **antes** de corregir (`_antesCorregirTFInv`), no 0: con 0, las demás pantallas abiertas y la nube (hasta que llega el guardado del admin) tenían más y la anulaban con un aviso falso de «le entró material». Una fila que ya estaba en 0 lleva `cant:0` y sin seriales: solo vale mientras siga vacía.

**La ventana «Corregir Cantidades»** (`modalCorregirCantCuad`) ya no corrige objetos viejos (R7 y R7b, de la Etapa 4, pasan ahora):
- al abrirla guarda una foto de cada fila (id, nombre, tipo, cantidad y seriales);
- al confirmar trabaja sobre la cuadrilla de AHORA en `DB`. Si la cuadrilla ya no está, se cancela con aviso;
- cada fila que el admin cambió se busca con `_filaCorrVivaInv`: la misma fila, o la de igual id, nombre y tipo, y solo si conserva la cantidad y los seriales que mostraba la ventana. Si no, se cancela todo: «"X" cambió en la cuadrilla mientras tenías la ventana abierta (entró o salió material). No se corrigió nada. Vuelve a abrir la ventana.»;
- una fila en 0 que el admin no tocó solo se quita, y solo deja lápida, si en `DB` sigue en 0 y sin seriales;
- las filas que el admin no tocó no se comparan: si cambian, la corrección de las demás sigue.

**Con ids repetidos sale solo la fila pedida.** `approveDelete` y `delMat` quitaban todas las filas que compartían el id. Ahora quitan solo la que coincide con la lápida. `approveDelete` busca su fila por id y, si el id se repite, por nombre y tipo (`_filaDeSolicitudInv`); si ninguna coincide, se trata como «ya no existe» y no borra a la vecina. Si con ese id queda UNA sola fila y no se llama como dice la solicitud, pregunta antes de borrarla (ver «La fila hermana», en C3). La lápida lleva `rep:true` cuando el id estaba repetido: así, si la vecina queda sola con ese id, la lápida sigue comparando el nombre y no se la lleva.

**Restaurar anula la lápida en el mismo momento** (`motivo:'restaurada'`): «rechazar y restaurar» de `approveDelete` y la fila de origen que `procTrans` vuelve a crear con su id viejo al rechazar una transferencia. Si no, la fila restaurada se iría con la lápida.

**Por dónde pasan, para que la fila nunca vuelva:**
- **Guardado:** al final de `_fusionarConNubeInv(fd, fh)` (dentro de la transacción y en el modo prueba): une las lápidas de aquí, las recién leídas y las del navegador, poda y quita las filas con lápida de todas las bodegas y cuadrillas, midiendo la memoria contra la base de antes de leer (ver «Contra qué se mide»). Después reabre las ediciones que cerró un borrado anulado (ver C3). `_camposCambiadosInv` escribe `bodegas`/`cuadrillas` y `_tumbasFila` juntos. Lo leído nunca se toca (sus registros se reemplazan por copias). Si Firebase repite la transacción, da lo mismo.
- **Oyente:** antes de proteger, guarda aparte lo que trajo la nube tal cual (para saber qué lápidas ya están allá) y une las que llegan con las de aquí (si no, el `Object.assign` tiraría las que aún no suben). Después decide las anulaciones de las dos pasadas y quita las filas con lápida de lo de aquí y de lo que llega, también de registros que la pantalla no tocó; después de la fusión fina, otra pasada. La base sigue saliendo de la nube cruda: si la nube todavía tiene la fila, la pantalla queda «tocada» y reenvía el borrado, con el mismo freno de 3 reenvíos en 10 minutos (`_tumbasFilaTrasSnapshotInv`). Nunca en modo prueba ni con una versión vieja.
- **`_aplicarNubeParcialInv`:** igual, por `_protegerSnapshotInv`.
- **Carga inicial:** primero la foto de la base y después las lápidas (las de la nube y las del navegador que todavía valen, ver abajo), para que la pantalla sepa que tiene un borrado por subir. Las de la nube quedan también en `window._tfNubeInv`.
- **Transacciones** (`_fbTransaccionInv`, `_fbTransaccionInvMulti`): lo que se va a escribir en bodegas y cuadrillas sale sin las filas con lápida según lo recién leído (`_cambiosSinFilasConLapidaInv`), en un objeto aparte; `cambios` vuelve intacto y cada escritura sigue llevando el sello de la Etapa 1.

**En el navegador:** cada lápida creada o anulada aquí queda además en `localStorage['inv_tumbas_fila']` (se lee, se une y se escribe: nunca se pisa lo de otra pestaña). Si el guardado falla y la pantalla se recarga, el borrado no se pierde. Pero lo del navegador no manda sobre la nube:
- sale cuando la nube ya la contiene (con su anulación, si la tiene) o a los **30 días**, igual que las decisiones (antes, 180);
- **al cargar**, la lápida de una aprobación que solo tiene el navegador vale solo si su solicitud está «aprobada» en la nube, o «pendiente» y este navegador tiene la decisión de aprobarla con su efecto (`_lapidaLSValeInv`). Si otro equipo la rechazó, la cerró o ya no está, sale del navegador sin quitar nada. Antes borraba el artículo igual y lo subía sin aviso, aunque la nube dijera «rechazada». Las de un borrado directo, las de «Corregir» y las anuladas no dependen de una solicitud y valen siempre;
- **al primer snapshot**, si la regla de «Después de recargar» (C2) da «gana la nube» o «no se puede repetir» para un borrado, su lápida activa que la nube no tiene sale de la memoria y del navegador, y la fila vuelve desde la base, en su mismo sitio, sin dejar la pantalla «tocada» (`_soltarLapidaDeDecisionInv`). Cubre el caso en que la rechazan entre la carga y el primer snapshot;
- **en `?prueba=1`** las lápidas van en otra clave, `inv_tumbas_fila_prueba`. Antes iban en la de verdad, y la siguiente carga normal de ese navegador borraba de verdad lo que se había «probado».

**Tamaño estimado** (no medido): unas 1,7 lápidas por día, unas 310 en 180 días, unos 23 KB.

### «Cerrada sin cambios» · C1.5

Si al aprobar ya no existe la bodega, el artículo o la venta (`approveDelete` sin bodega o sin artículo, `approveEdit` sin bodega, sin artículo o sin datos, `approveDeleteVenta` sin venta), la solicitud queda con el estado decidido (para no romper filtros ni otras apps), más `resultado:'sin_cambios'`, `decididaMs`, la decisión protegida (`_marcarDecisionInv`) y su línea en el registro (`_cerrarSinCambiosInv`). Antes quedaba «aprobada» sin haber hecho nada y sin protección: un snapshot la podía devolver a pendiente. En pantalla dice «cerrada sin cambios».

### Una decisión no se pierde · C2, prueba R3

**Cada decisión guarda su efecto.** `localStorage['inv_decisiones']` pasa de `{estado, ts}` a `{estado, resultado, ts, carga, efecto}`. `carga` es el id de esta carga de la página (`window._cargaDecInv`). `efecto`:
- borrar: `{tipo:'borrar', col, id, fila, nom, tipoFila, lapida}`;
- editar: `{tipo:'editar', bodegaId, materialId, nom, tipoFila, datos, cantAntes}`, con nombre, tipo y cantidad de **antes** de editar;
- un rechazo que no tocó nada: `{tipo:'ninguno'}`;
- `null`: lo que no se puede repetir sin riesgo (transferencias, ventas aprobadas, entradas viejas `{estado, ts}`); «rechazar y restaurar» lleva `{tipo:'restaurar'}`, que tampoco se repite.

Se escribe leyendo, uniendo y escribiendo: queda lo de esta pantalla y, del navegador, lo que otra pestaña dejó y esta no soltó. Las solicitudes que se cierran junto con otra (C3) guardan en el efecto sus campos `duplicadaDe` y `cerradaPor`, que vuelven con ellas tras recargar.

**`?prueba=1` no deja nada que la pantalla de verdad ejecute.** Antes, lo decidido en el modo prueba quedaba en `inv_decisiones` como cualquier decisión, y la siguiente carga normal de ese navegador lo tomaba como «de una carga anterior» y lo repetía de verdad (borrar, editar), aunque el modo prueba avisa que nada se guarda. Bastaba con abrir INVENTARIO, sin iniciar sesión. Ahora:
- en el modo prueba no se cargan las del navegador (son de una pantalla de verdad: PRUEBAS.html comparte el origen), pero se conservan al escribir;
- lo que se decide en prueba se guarda con `prueba:true` y nunca pisa ni quita una decisión de verdad;
- la carga normal ignora lo marcado `prueba:true`, y un guardado normal lo quita del navegador después de una hora;
- las lápidas del modo prueba van en su propia clave (ver «En el navegador», en C1).

**Dentro de la misma carga se reintenta hasta que la nube la tenga.** Mientras haya decisiones de esta carga sin confirmar, o el guardado vaya fallando:
- después de los 3 reintentos de siempre (3, 6 y 9 s) ya no se rinde: cada 15 s durante 2 minutos y después cada 60 s (`_programarReintentoDecInv`, un solo temporizador);
- al volver la señal (evento `online`), un intento inmediato, solo si hay algo por subir (si no, no retrasa la recarga automática); sin señal (`navigator.onLine===false`) el turno no intenta y espera;
- nunca en modo prueba (ni lo intenta: no suma a `_escriturasBloqueadas`), nunca con una versión vieja, y con un error de tamaño no insiste;
- es otro temporizador: no gasta el freno de reenvíos (`_reenviosInv`);
- reintentar no duplica nada: la decisión es el estado del registro.
- Además, lo que `_reimponerDecisionesInv` vuelve a poner sobre un snapshot cuenta como preservado: eso programa el reenvío (antes se ignoraba y, si nadie más escribía, la decisión se quedaba solo en esta pantalla).

**Confirmación:** al terminar bien `_fbSaveCore` (después del commit, nunca en modo prueba), una decisión queda confirmada si lo escrito trae el registro con ese estado o si el registro ya no está (archivado o con lápida); se quita del mapa y se repintan la franja y la pestaña si están a la vista. La confirmación por snapshot (la nube la trae igual) sigue valiendo.

**Después de recargar** (decisión de una carga anterior), al primer snapshot del historial (`_reglaDecisionAnteriorInv`, pura):

| Qué trae la nube | Qué se hace |
|---|---|
| ya la decidió (otra pantalla) | gana la nube; la entrada se suelta. Si era un borrado, también sale su lápida y la fila vuelve (ver «En el navegador», en C1): antes se soltaba solo el estado y el artículo se borraba igual |
| sigue «pendiente» y el efecto se puede repetir: borrar (la lápida), editar (los datos sobre la misma fila), `ninguno`, o un resultado sin efecto («sin cambios», «duplicada», «artículo borrado») | se repiten el efecto y el estado (y `decididaMs` si falta), la entrada pasa a esta carga, queda una línea en el registro («Se volvió a aplicar…») y se reenvía |
| sigue «pendiente» y no se puede repetir (transferencias, ventas, «restaurar», entradas viejas `{estado, ts}`, o un borrado que ya no se cumple: ver abajo) | **no se impone**: se suelta (un borrado, con su lápida) y la pestaña de Solicitudes o de Transferencias avisa «N decisión(es) de antes no llegaron a la nube: vuelve a decidirlas.» (la bodega solo ve las suyas) |
| ya no tiene el registro (archivado o borrado) | se suelta: no hay nada que subir |

Una edición solo se repite si la fila existe, coincide por id, nombre y tipo, y conserva la cantidad que tenía al aprobar (`cantAntes`): si cambió, se pide volver a decidirla, con el mismo criterio que el aviso «la cantidad cambió» al aprobar.

Un borrado se repite uniendo la lápida del efecto con las que ya conocen la pantalla y el navegador (`_reaplicarBorrarDecInv`). Si el resultado queda anulado, o la fila sigue porque le entró material, no se anota «Se volvió a aplicar»: se pide volver a decidirlo. Antes, una lápida vieja anulada de la misma fila hacía que la decisión quedara «aprobada» con el artículo en la bodega.

**En pantalla.**
- Una decisión de esta pantalla que la nube aún no confirma sale «⏳ por subir» en vez de «aprobada», «rechazada» o «aceptada»: en el historial de Solicitudes (borrados y ediciones) y en Transferencias. «Por subir» es solo pantalla: nunca entra al registro (el archivador, el vigilante y las otras pantallas lo tomarían por un estado).
- La franja `#decisionesPorSubirInv` va arriba del contenido, sin posición fija (abajo están `#syncStatus` y `#mantBanner`) y sin `pvRecargaTexto`, para admin y bodega: «⏳ N decisión(es) por subir — no cierres esta pantalla. Se reintenta sola.» Desaparece al confirmarse y cabe en 375 px.
- `_ocupadoRecargaInv` no cambió (la prueba de la recarga exige su nombre) y la recarga automática no espera las decisiones: con el efecto guardado, recargar ya no deja una decisión a medias.

### Una sola solicitud pendiente por artículo · C3, prueba R4

**Al crear (bodega).** `delMat` y `modalEditMat` miran si ya hay otra solicitud **pendiente** de la misma clase (borrado o edición) para el mismo `bodegaId` + `materialId` (las de venta no cuentan). Si en la bodega queda al menos una fila con ese id, además el nombre (`_comparaNombreSolInv`; ver «La fila hermana»). Si la hay: «Ya hay una solicitud pendiente para este artículo desde el <fecha>. Espera a que el administrador la decida.» y no se crea otra.
- Se mira al abrir la ventana **y otra vez dentro del Guardar**, justo antes de agregarla: `closeModal` no limpia el botón, así que la ventana vieja sigue armada, y un snapshot puede traer la de otra pantalla mientras la ventana está abierta.
- En el Guardar también se mira que el artículo siga en la bodega, y la solicitud se arma con la fila de ahora (`_filaVigenteInv`): la misma fila, o la de igual id, nombre y tipo. Si no está, no se arma y el aviso pide volver a abrir la ventana («…ya no está… No se envió la solicitud»). Antes, si la pedida ya no estaba, tomaba otra fila con el mismo id (la primera, o la única que quedaba) y la solicitud salía con el nombre, la cantidad y los seriales de OTRO artículo; al aprobarla, se borraba ese. En editar, si con la ventana abierta cambiaron los seriales de la fila, también se cancela.
- Las solicitudes nuevas (borrado, edición y venta) llevan `fechaMs` y un id con 4 caracteres al azar: dos pantallas en el mismo milisegundo no chocan.

**Al guardar** (al final de `_fusionarConNubeInv`, con el historial recién leído; dentro de la transacción y en el modo prueba): una pendiente de aquí que la nube no tiene, cuando la nube **ya trae** otra pendiente del mismo artículo y clase, se cierra: `estado:'rechazada'`, `resultado:'duplicada'`, `duplicadaDe` (la de la nube; si hay varias, la más antigua) y `decididaMs`, con su línea en el registro. Gana siempre la que ya estaba en la nube, aunque la de aquí sea más vieja: así todas las pantallas deciden igual. Si Firebase repite la transacción, primero se deshace lo cerrado en el intento anterior (`window._dupCerradasTxInv`) y se vuelve a decidir contra lo recién leído; si la de la nube ya se decidió, el cierre se deshace. Después del commit se avisa a quien la pidió, con un aviso que no frena la pantalla.

**Al decidir una** (`approveDelete` aprobar o rechazar, también en sus ramas «sin cambios», y `approveEdit`): las demás pendientes de la misma clase y artículo se cierran con el **mismo estado**, `resultado:'duplicada'`, `duplicadaDe` y `decididaMs`, protegidas como cualquier decisión. Aprobar el borrado cierra además las ediciones pendientes de ese artículo: `estado:'rechazada'`, `resultado:'articulo_borrado'` y `cerradaPor` (el id de la solicitud de borrado). El aviso del admin y el registro lo dicen. Una edición cerrada así no se aplicó, y su etiqueta lo dice.

**La edición se reabre si el borrado no se cumplió.** Que el borrado quede se decide después, en el guardado, contra la nube. Si su lápida se anula porque le entró material, el artículo sigue, y las ediciones que ese borrado cerró vuelven a pendiente (`_reabrirEdicionesDeAnuladasInv`, en el guardado, después de fusionar con lo recién leído):
- no cambia los objetos leídos: pone una copia con `estado:'pendiente'`, `resultado` y `cerradaPor` en blanco y `decididaMs` en `null`;
- suelta la decisión de esa edición y deja una sola línea en el registro («…vuelve a quedar pendiente: el borrado que la cerró se anuló porque al artículo le entró material»);
- no se reabre si ya hay otra edición pendiente del mismo artículo, ni si la lápida se anuló porque la fila se restauró (ahí el borrado sí ocurrió).

**La fila hermana** (segunda pasada de la revisión). En los datos reales hay filas distintas que comparten el id. Si la bodega tenía CABLE y CONECTOR con el mismo id, había una solicitud pendiente de CABLE y el admin borró CABLE directo, quedaba una sola fila con ese id y la pendiente de CABLE se tomaba por la de CONECTOR: bloqueaba pedir CONECTOR, cerraba la de CONECTOR como «duplicada» y, al aprobarla, borraba CONECTOR (el aviso solo decía que la cantidad había cambiado). Ahora:
- dos solicitudes del mismo id son del mismo artículo solo si además tienen el mismo nombre, siempre que en la bodega quede al menos una fila con ese id (`_comparaNombreSolInv`, antes `_idRepetidoEnBodegaInv`, que pedía más de una). Vale al crear, al guardar contra la nube, al decidir y al reabrir ediciones;
- `approveDelete` y `approveEdit` miran si la fila es la que nombra la solicitud (`_filaEsDeSolicitudInv`: el nombre y, en los borrados, el tipo). Si no, preguntan con los dos nombres: «La solicitud era para "CABLE" y en BOD con ese código solo queda "CONECTOR", con 30 und. ¿Borrar "CONECTOR" COMPLETO?». Puede ser otro artículo o el mismo con otro nombre;
- si la respuesta es no, la solicitud queda «cerrada sin cambios» y el aviso dice que CONECTOR sigue;
- si es sí, no se hace la segunda pregunta de la cantidad. El registro y el aviso nombran la fila que de verdad se tocó («la solicitud decía "CABLE"»), y al borrar se cierran también las pendientes de esa fila (borrados como «duplicada», ediciones como «artículo borrado» con `cerradaPor`);
- al rechazar, si con ese código queda otra fila, el aviso la nombra.

**`decididaMs` en todas las decisiones** (borrados, ediciones, ventas y traslados). `_fechaDeRegistroInv` lo mira primero: el archivador cuenta sus 30 días desde que se decidió, así una solicitud que estuvo mucho tiempo pendiente no se archiva en el mismo guardado en que se decide. De paso se corrigió la vista del archivo histórico, que con una marca numérica mostraba sus 10 primeros dígitos en vez de la fecha.

**En pantalla:** «duplicada», «cerrada sin cambios» y «artículo borrado», con una explicación al pasar el mouse (por ejemplo, que una «duplicada» no cambió nada).

### Qué cambia en los datos

- `inventario/datos`: el campo nuevo `_tumbasFila` (cada lápida puede llevar `ult`).
- `inventario/historial`, solicitudes: `resultado` (`'sin_cambios'`, `'duplicada'`, `'articulo_borrado'`), `decididaMs`, `duplicadaDe`, y en las ediciones cerradas por un borrado, `cerradaPor`; las nuevas, `fechaMs`. Traslados: `decididaMs`.
- El navegador: `inv_tumbas_fila` (nuevo; en `?prueba=1`, `inv_tumbas_fila_prueba`) e `inv_decisiones` con la forma nueva (lo decidido en prueba, con `prueba:true`). Las entradas viejas `{estado, ts}` siguen funcionando dentro de la misma carga.
- Nada guarda nombres de personas: en las lápidas va el rol.
- `AVISOS_PENDIENTES.gs` cuenta solo `estado==='pendiente'`: una repetida cerrada cambia de estado y deja de contar (pero ver «Pendiente»: lee el documento equivocado).

### Lo que se apartó de la especificación

1. **La lápida lleva tres campos más:** `snesN` (cuántos seriales reales tenía: con más de 60 la lista va recortada y se compara la cantidad), `rep` (el id estaba repetido; ver arriba) y `ult` (la hora del último borrado; ver «Unión»).
2. **El paso de las lápidas en el guardado va al final de `_fusionarConNubeInv`,** no dentro de `_fbSaveCore`: así queda después de la fusión en los dos caminos (la transacción y el modo prueba) y también cuando una prueba llama la fusión directo. Lo mismo el cierre de repetidas (C3).
3. **Los rechazos llevan efecto `{tipo:'ninguno'}`, no `null`,** para que tras recargar se repongan con solo el estado. «Rechazar y restaurar» lleva `{tipo:'restaurar'}`, que no se repite (mete material). «Duplicada» y «artículo borrado» se reponen sin efecto, igual que «sin cambios». Una entrada con la forma de la especificación (`efecto:null`) se comporta como dice la especificación.
4. **Una edición solo se repite tras recargar si la fila conserva su cantidad** (`cantAntes`); sin `cantAntes` se repite. Si el efecto de una edición pasa de 20.000 caracteres (fotos incrustadas), se guarda sin los datos y no se repite.
5. **Con un error de cuota (`resource-exhausted`) se sigue reintentando cada 60 s,** a 2 lecturas por intento: la especificación solo pide parar con el error de tamaño.
6. **Al aprobar una edición, las demás ediciones pendientes del artículo quedan «aprobada · duplicada» aunque traigan datos distintos** (como pide la especificación); sus datos no se aplican. El mapa proponía cerrarlas como «rechazada» cuando traen otros datos: decisión de Elkin.
7. **La rama «sin datos» de `approveEdit` no cierra las demás ediciones:** pueden traer datos válidos.
8. **Una edición cerrada como «artículo borrado» guarda `cerradaPor`,** el id de la solicitud de borrado que la cerró. La especificación no define ese campo; hace falta para reabrirla si el borrado no se cumple.
9. **La lápida de «Corregir Cantidades» lleva la cantidad y los seriales de antes de corregir,** no `cant:0` como dice la especificación (salvo si la fila ya estaba en 0).
10. **En el navegador las lápidas duran 30 días, no 180,** y la de una aprobación solo se aplica si la nube no decidió otra cosa. En la nube siguen siendo 180.
11. **«Entró material» no siempre se mide contra la lápida:** en la memoria de quien recibe, con una lápida que ya está en la nube, se mide contra su base (ver «Contra qué se mide»).

### Riesgos que quedan

- **Dos pestañas del mismo navegador.** Una pestaña que se abre mientras otra tiene una decisión sin subir la trata como «de antes». Borrar y editar se repiten sin daño; una transferencia o una venta pide «vuelve a decidirla», y si la persona la decide otra vez y la otra pestaña sube la suya, el material entraría dos veces. Antes se perdía. No hay forma de saber si la otra pestaña sigue viva.
- **La franja aparece alrededor de un segundo en cada decisión,** mientras sale el guardado, aunque todo vaya bien.
- **Pantallas v112–v115 abiertas** no conocen `_tumbasFila`: su fusión fina todavía puede devolver la fila y escribir una copia vieja de la lista. Las pantallas nuevas la vuelven a unir, quitan la fila y la reenvían. Por eso, al publicar, recargar todas las pantallas de bodega (ver «Pendiente»).
- Ya existían y no se tocaron: `importData` reasigna `DB` (`window.DB` queda viejo) y traería el `_tumbasFila` del respaldo; el oyente de datos sigue sin repintar por `window.USER`.
- Lo que la revisión adversaria dejó, a propósito o porque quedó en duda, está en la sección siguiente.

### Revisión adversaria (11 oct 2026)

Antes de publicar se buscaron fallas a propósito, en dos pasadas. Cada hallazgo lo revisaron dos verificadores por separado, con las funciones reales sacadas del archivo y sin red. Las reproducciones quedaron en el scratchpad de la sesión (`rev_c1`, `rev_c2`, `rev_c3`, `rev_l3`, `rev_l4`, `verif_*`, `fix2_*.js`).

**Primera pasada: 19 hallazgos.** 10 confirmados (los dos verificadores dijeron que sí), 3 dudosos (uno sí y uno no) y 6 refutados. Los 10 confirmados se corrigieron; algunos eran la misma falla vista desde dos lados:

| Falla | Arreglo (arriba) |
|---|---|
| Con la lápida de «Corregir» (cant 0), o con una pantalla atrasada, las demás pantallas anulaban la lápida con un aviso falso de «entró material» y una escritura de más cada una; si habían tocado la fila, la devolvían (3 hallazgos, uno grave) | «Contra qué se mide» y la lápida de «Corregir» con lo de antes |
| Una lápida del navegador borraba el artículo aunque otro equipo hubiera rechazado la solicitud, también tras recargar (2) | «En el navegador»: `_lapidaLSValeInv`, `_soltarLapidaDeDecisionInv`, 30 días |
| Lo decidido en `?prueba=1` se ejecutaba de verdad en la siguiente carga normal del mismo navegador (grave) | Clave aparte y `prueba:true` (C2) |
| Volver a borrar una fila cuya lápida se anuló: el borrado nuevo nacía anulado (2) | La unión con `ult` |
| El Guardar de una ventana vieja, con ids repetidos, armaba la solicitud sobre otro artículo | `_filaVigenteInv` estricta (C3) |
| Aprobar un borrado cerraba las ediciones aunque después el borrado se anulara | `cerradaPor` y la reapertura (C3) |

Los 6 refutados no cambiaron nada: material que entra después de bajar y volver a subir, el tamaño con 2.000 lápidas (dos veces), repetidas que se reponen tras recargar, lo cerrado sin aplicar que el archivo muestra «aprobada», y la prueba adaptada del registro.

**Dudosos de la primera pasada:**
- **La fila hermana:** se corrigió en la segunda pasada (ver C3).
- **Una venta eliminada vuelve** si llega un snapshot del historial antes del primer guardado (la venta no tiene lápida hasta la fusión) y el material devuelto queda contado dos veces. Se dejó: ya pasaba igual en la v115 y la Etapa 2 no toca las ventas. Arreglo posible, en otra etapa: dejar la lápida de la venta en el acto y que el oyente quite de lo que entra lo que tiene lápida propia. *(Resuelto en la Etapa 4b, sin publicar, con una pieza más: el oyente de `inventario/datos` tiraba la lápida. Ver §14.)*
- **«Rechazar y restaurar»** (y rechazar un traslado) deja la anulación de la lápida en el navegador; si la pantalla se recarga antes de guardar, la anulación sube aunque la restauración no se repita. Se dejó: no mueve material y no se encontró un caso con daño concreto.

**Segunda pasada** (sobre lo ya corregido): **5 hallazgos, 2 confirmados y 3 dudosos.**
- Confirmados y corregidos:
  - «Corregir» con la ventana abierta: si entraba material antes de confirmar, la lápida armada con los datos de la ventana borraba la fila con lo que entró, también seriales, sin aviso. Ahora la ventana trabaja sobre `DB` (ver C1).
  - Una lápida que dejó otra pestaña del mismo navegador, armada con datos atrasados, se medía contra la base y borraba la fila con el material que entró; en el oyente, además, la otra pasada la anulaba y quedaba un aviso falso de que volvió. Ahora la base vale solo con lápidas de la nube, y las dos pasadas deciden antes de quitar.
- Dudosos, sin corregir (en «Pendiente»):
  - Una pantalla atrasada mete material a una fila cuya lápida tiene más cantidad que su base: no se detecta y lo que metió se pierde. Igual que antes de los arreglos.
  - Tras recargar, las ediciones se vuelven a cerrar como «artículo borrado» aunque el borrado que las cerró no se repita (la nube lo rechazó): el artículo sigue y la edición queda cerrada.
  - La reapertura puede revivir una edición después de que el admin ya decidió a mano otra edición del mismo artículo.

**Lo que se dejó a propósito:**
- Una lápida que solo tienen esta pantalla o el navegador se mide contra la lápida. Si una pestaña atrasada del mismo navegador tiene más, la anula con un aviso de que volvió y conserva la fila: es el lado que no pierde material.
- Una pantalla atrasada que de verdad le metió material a la fila la conserva con toda su cantidad: puede contar dos veces lo que se entregó mientras tanto.
- Si se vuelve a borrar desde un equipo con el reloj atrasado que no conoce la lápida anterior, la anulación vieja cubre el borrado nuevo y la fila se conserva.
- Con varias filas con el mismo id, `approveEdit` sigue aplicando a la primera (Etapa 3), pero pregunta si no se llama como la solicitud. Al rechazar un borrado cuya fila ya no está pero queda la hermana, no se ofrece restaurar.
- Después de cambiarle el nombre a un artículo, la bodega puede pedir otra solicitud con el nombre nuevo aunque haya una pendiente con el viejo. No se pierde nada: al aprobar la vieja se pregunta.
- «Corregir» no compara las filas que el admin no tocó. Si se prefiere cancelar ante cualquier cambio en la cuadrilla, es una línea.
- En `?prueba=1` la franja «N decisión(es) por subir» no se quita: la prueba R3 la exige dentro del marco de prueba.

### Pruebas

**`PRUEBAS.html`: 161 pruebas** (42 de INVENTARIO, 86 de OFICINAS, 32 de RED y 1 de Firma). Las siete nuevas van en el grupo de INVENTARIO, al final; las tres de la revisión (5 a 7), justo después de la 4:

| # | Prueba | Qué comprueba |
|---|---|---|
| 1 | Una fila cuyo borrado aprobó el admin no vuelve, aunque esta pantalla la haya cambiado (R2) | Las funciones puras con datos inventados (la regla, ids repetidos y `rep`, material o serial que entra, la anulada que no vuelve a quitar, la unión, la poda, que no mutan); por el oyente y por el guardado, también si la transacción se repite; `_tumbas` nunca recibe lápidas de fila; `approveDelete` con ids repetidos, `delMat` del admin, la transacción sin la fila y «rechazar y restaurar»; por texto, dónde se crean y por dónde pasan |
| 2 | Aprobar cuando ya no existe el artículo deja «cerrada sin cambios» | Las seis ramas: estado, `sin_cambios`, `decididaMs` (y el archivador), la decisión protegida, el registro, los avisos, ninguna lápida; decidir otra vez no hace nada |
| 3 | Una decisión que la nube no confirmó se ve «por subir», se reintenta y, tras recargar, no queda a medias (R3) | El mapa nuevo y leer-unir-escribir; «⏳ por subir» y la franja; en modo prueba el reintento ni se programa y el evento `online` no guarda; 15 s / 60 s; lo repuesto cuenta como preservado; tras recargar, borrar y editar se repiten, la edición con la cantidad cambiada no, la transferencia y la entrada vieja no se imponen y avisan, gana la nube; por texto, el reintento y la confirmación tras el commit |
| 4 | Una sola solicitud pendiente por artículo (R4) | Con `USER` de bodega y de admin y las ventanas sustituidas: el segundo `delMat` bloqueado al abrir, en el Guardar viejo, con un snapshot y con el artículo que desaparece; lo que no bloquea; lo mismo en editar; la regla del guardado (gana la nube, repetible, se deshace); al decidir se cierran las demás |
| 5 | Las demás pantallas no deshacen un borrado: «Corregir», una pantalla atrasada y volver a borrar (revisión del 11 oct) · 12 comprobaciones | La ventana REAL de «Corregir» deja la lápida con la cantidad de antes; otra pantalla, haya tocado la fila o no, no la anula, no registra «volvió» y no reenvía; una pantalla atrasada (10 contra 7) no anula ni por el oyente ni al guardar, y con 13 o un serial nuevo sí; volver a borrar vale (también al guardar contra otra pantalla, con el reloj atrasado y tras recargar), y si después entró material se pide volver a decidir; la unión con `ult`; la anulación se anota una vez; la lápida que solo tiene el navegador, contra la lápida; las dos pasadas deciden igual; «Corregir» sobre la cuadrilla de ahora, se cancela si la fila cambió, y una fila en 0 que recibió material se queda |
| 6 | Lo que quedó en el navegador no manda sobre la nube: una solicitud rechazada en otro equipo y lo decidido en `?prueba=1` · 7 | La lápida cuya solicitud otro equipo rechazó no borra al cargar (también con sesión de bodega) y sale del navegador; si la rechazan entre la carga y el primer snapshot, la fila vuelve a su sitio sin quedar «tocada»; los 30 días; en `?prueba=1` las lápidas van solo a `inv_tumbas_fila_prueba` y las decisiones con `prueba:true`, sin pisar una de verdad; por texto, el filtro de la carga normal |
| 7 | Cada solicitud sobre su propia fila: ids repetidos, la fila hermana y la edición cerrada por un borrado que no se cumplió · 7 | El Guardar de una ventana vieja (borrar y editar) con ids repetidos no arma la solicitud y avisa; los seriales cambiados cancelan; la edición cerrada lleva `cerradaPor` y vuelve a pendiente si la lápida se anula por material (copia, suelta la decisión, una línea), y no si hay otra pendiente o la fila se restauró; la fila hermana: pedir CONECTOR no se bloquea ni se cierra como duplicada, aprobar el borrado y la edición de CABLE pregunta con los dos nombres, «no» deja «sin cambios» y «sí» hace una sola pregunta, nombra a CONECTOR y cierra sus pendientes |

- Todas usan ids inventados que empiezan por `E2P`, sustituyen `alert`, `confirm`, `_fbSave`, las ventanas y los repintados, y lo devuelven todo en un `finally`: `DB` (también `_tumbasFila` y `_tumbas`), `USER`, las decisiones (`_decisionesMiasInv`, `_soltadasDecInv`, `_decisionesNoLlegaronInv`), `_dupCerradasTxInv`, `_tfAnotadasInv`, la franja y la caja de la ventana de prueba; las tres de la revisión, además, `_reabiertasTFInv`, `_tfNubeInv`, `_baseStockInv`, `_idsRemotosInv`, `_modoPruebaInv` y `TempLists`. El ayudante `e2RestaurarLS` deja el navegador como estaba (`inv_decisiones`, `inv_tumbas_fila`, `inv_tumbas_fila_prueba`, `pv_equipo_id`, `inv_sesion_id`): quita solo lo de la prueba y, si nadie más escribió mientras tanto, deja el texto exacto de antes. Si una prueba quitó una lápida ajena (al podar), la devuelve. Exigen que `_escriturasBloqueadas` no crezca.
- **Pruebas viejas adaptadas** (cambiaban de significado con el diseño nuevo):
  - «Una decisión tomada no se deshace sola»: sigue exigiendo lo de siempre dentro de la misma carga (al instante, a los 10 min y a los 3 días, y se suelta al confirmarse) y ahora, además, la regla de recargar: un rechazo se repone, una entrada vieja `{estado, ts}` ya no se impone y se pide volver a decidirla. Antes, los «3 días» valían también tras recargar. Ahora devuelve el navegador y el registro.
  - «Una aprobación no se deshace sola al llegar un snapshot»: llama `_fusionarConNubeInv` con bodegas inventadas, que poda en memoria las lápidas de las bodegas reales (y deja `_tumbas` podado): ahora devuelve `_tumbasFila` y `_tumbas`. Si no, la prueba «un guardado ya no reescribe todo el documento» los mostraría en ámbar.
  - «Etapa 1 · Cada entrada del registro dice quién…»: exigía que solo `logMsg` hiciera `logs.unshift(`. C1 y C2 agregan dos entradas sin `save()`, porque corren dentro del guardado o del oyente (la lápida anulada porque entró material y la decisión repetida tras recargar), las dos hechas con `_entradaLogInv`. Ahora se permiten esas; una entrada armada a mano sigue fallando (se comprobó con una copia dañada).

**Corrido el 11 oct 2026, con el archivo final** (después de las dos correcciones), sobre la base SIMULADA del banco, sin servidor (Playwright sirve los archivos del repo desde el disco), con el arnés de la Etapa 6:
- `PRUEBAS.html` completo (INVENTARIO, OFICINAS y RED; Firma no se abre): 160 corridas de 161, **159 bien**. Falla solo «Rastreador v314: la ficha de una factura REAL de WispHub», que necesita WispHub de verdad, igual que en la Etapa 6 y que antes de la revisión.
- Ninguna escritura en la base simulada, ningún error de JavaScript, el navegador vacío al terminar (`inv_decisiones`, `inv_tumbas_fila` e `inv_tumbas_fila_prueba` en null). Intentos bloqueados: INVENTARIO 0, RED 0 y OFICINAS 5, los mismos de antes (pruebas anteriores).
- Con lápidas y decisiones ajenas sembradas antes en el navegador (de bodega y de cuadrilla, de verdad y de prueba), las 7 de la Etapa 2 pasan y lo sembrado queda idéntico, byte a byte. Esa corrida encontró un punto frágil de la prueba 5 (medía «la nube va atrás» con todas las lápidas del navegador): ahora cuenta solo las suyas.
- Con una comparación del marco antes y después de cada prueba (`DB`, `USER`, las decisiones, las funciones sustituidas, la franja, la base, el navegador), las cuatro primeras y la de las decisiones lo dejan **igual**.
- **Copias dañadas:** 18 copias de INVENTARIO, cada una sin un arreglo; las 18 fallan en alguna de las cuatro primeras (o en la de las decisiones): sin la excepción del material, sin el paso del guardado, sin el del oyente, borrar por id solo, sin `rep`, la lápida también en `_tumbas`, restaurar sin anular, «sin cambios» sin protección o sin `decididaMs`, decisiones de antes impuestas sin más, lo repuesto sin contar como preservado, el reintento en modo prueba, sin «por subir», la edición sin `cantAntes`, el Guardar sin volver a mirar, sin el cierre al guardar, sin el cierre al decidir y la regla «gana la más vieja» en vez de «gana la de la nube». La primera corrida dejó pasar «la lápida también en `_tumbas`»: la prueba 1 lo miraba solo al guardar y ahora también después de aprobar y borrar.
- **Las tres de la revisión, contra copias de antes:** con la copia de antes de los arreglos fallan las tres. Ahí no fallan solo tres comprobaciones, y es por diseño: dos cubren fallas que metió el primer arreglo (la lápida que solo tiene el navegador y las dos pasadas) y la otra es una salvaguarda de la reapertura, que antes no existía. Con la copia de antes de la segunda corrección fallan las 4 comprobaciones de esa corrección (lápidas y «Corregir») y las 3 de la fila hermana. Además, 26 mutantes del archivo final: se detectan 25; el que queda es equivalente (quita una guarda que la siguiente repite).
- `node .claude/validar.mjs` sobre INVENTARIO y PRUEBAS: sintaxis correcta. Los dos en CRLF, sin LF sueltos. `APP_VERSION_INV` sigue en 115.

**Lo que corrieron las partes C1, C2 y C3** (en el scratchpad de la sesión, con las funciones reales sacadas del archivo, sin red, antes de la revisión): C1 49/49 funciones puras, 18/18 con dos pantallas y la nube compartida, 5/5 sin escrituras de más; C2 51/51 y 17/17 de flujo, y 18/18 en el banco (R3b recargando la pantalla del admin, R3b de transferencia, R3c con `setOffline`, `?prueba=1`); C3 62/62 y 3/3 en el banco (R4b dos pantallas a la vez, R4c, R4d).

**Reproducciones de la revisión** (scratchpad, funciones reales, sin red): todas dan ahora el resultado correcto, sin anulaciones falsas en ninguna pantalla. Las de la segunda corrección (`rev_l4/hermana2.js`, 18 comprobaciones; `corregir_real.js`, 9, con la ventana real; `dos_pasadas.js`, 4) fallan con la copia de antes. `fix2_union_prop.js`: 3.008 comprobaciones de la unión.

**El banco** (`_PRUEBAS_SIMULADAS_2026-10-09/trabajo`, base simulada y compartida, las apps reales en Chromium; salidas en `etapa2_resultados/`):
- `inv/etapa2.js` con el archivo final: **25 pasan, 0 fallan** (330 s). Son los 15 de la etapa y 10 de la revisión: «Corregir» con otra pantalla abierta (F1); la pantalla atrasada y las dos pasadas (F2); la lápida de una solicitud que otro equipo rechazó, también en la carrera con el primer snapshot (F3); `?prueba=1` y después la app normal en el mismo navegador (F4); volver a borrar, con y sin recarga (F5, F5b); reabrir la edición (F6); la ventana vieja con ids repetidos (F7); la fila hermana (F8) y la ventana de «Corregir» (F9).
- Contraprueba: con la copia de antes de los arreglos (`--antes`) los 10 nuevos fallan. Con la de antes de la segunda corrección fallan 3, justo F2 (las dos pasadas), F8 y F9.
- El banco ganó opciones: `--antes` y `--html=RUTA` (sirven otra copia de INVENTARIO), una pantalla con `?prueba=1`, y responder «no» a un diálogo.
- `inv/revision_oct.js` con el archivo final: **10 pasan, 1 falla:** R5, de la Etapa 3, la esperada. R7 y R7b pasan ahora, por la ventana de «Corregir».
- **Corrida completa con el archivo final** (11 oct, 3:28 a 3:48 a. m.): `pantallas_unit` 216/216, `recarga_unit` 167/167, `revision_oct` 10 bien y 1 mal (R5, de la Etapa 3), `repro` 21/21, `escenarios2` 20/20, `etapa1` 16/16, `etapa6` 13/13 y `etapa2` 25/25. Salidas en el scratchpad de la sesión (`etapa2/banco_final/`).

**`PRUEBAS.html` en el navegador contra la base real** (`?prueba=1`, 11 oct, 3:30 a. m., con el archivo final): **159 bien y 2 por revisar**, las dos «Estado real» de siempre (36 seriales en dos sitios; servicios de proveedores sin costo). La de la ficha real de WispHub pasa aquí. Después se miró la nube por REST (solo lectura): `inventario/datos`, `inventario/historial`, `oficinas_sistema/main` y `logs_auditoria` conservan su última escritura de la tarde del 10 oct, de pantallas reales. La única escritura de la madrugada en `sesiones_vivas` es el latido de una pantalla real de OFICINAS v320 abierta desde el 10 oct (oculta, cada 15 min), no de las pruebas.

### Pendiente

1. **Etapa 3: los botones ✏️ y ✕ de cada fila pasan solo el id.** Con ids repetidos, `delMat` y `modalEditMat` toman la primera fila con ese id, y `approveEdit` también aplica a la primera (desde la revisión, pregunta si no se llama como la solicitud). Por eso la comparación por nombre de las solicitudes repetidas (`_mismoArticuloSolInv`) solo distinguirá filas vecinas cuando cada botón tome su propia fila. Las lápidas ya distinguen por nombre y tipo. **Resuelto en la Etapa 3** (sin publicar): cada botón pasa la llave de su fila y `approveEdit` aplica a la fila de la solicitud. Ver §12, «La llave de cada fila».
2. **`AVISOS_PENDIENTES.gs` lee las solicitudes del documento equivocado:** las busca en `inventario/datos` y viven en `inventario/historial`. Sin corregir.
3. **Publicada el 11 oct 2026** (Elkin: «Publica y después continua con la etapa 3»; commit `ac4fc2f`, INVENTARIO 116). Respaldo en `_RESPALDO_2026-10-11_antes_de_publicar`. Mantenimiento solo de INVENTARIO de 11:15 a 11:32; push 11:16, Pages con el archivo nuevo desde las 11:17 (huellas iguales a las del disco, dos veces), versión anunciada 11:31, prueba de humo en `?prueba=1` sin errores. Al publicar no había pantallas de bodega abiertas; solo un celular del admin con la v115, en reposo, que se recarga solo al despertar. **Falta:** comprobar en la nube real, con la primera aprobación de verdad, que deja `_tumbasFila` en `inventario/datos` junto con la fila quitada, en la misma escritura, y que una decisión hecha sin señal sube sola al volver.
4. **Decidir con Elkin** el punto 6 de «Lo que se apartó de la especificación» (ediciones repetidas con datos distintos).
5. **Decidir con Elkin los dudosos que quedaron** (ver «Revisión adversaria»): los 3 de la segunda pasada (la pantalla atrasada contra una lápida con más cantidad, las ediciones que se vuelven a cerrar tras recargar y la reapertura después de otra decisión a mano) y la venta que vuelve con un snapshot, que ya pasaba en la v115. *(La venta: resuelta en la Etapa 4b, sin publicar; ver §14.)*
6. **Etapa 4:** de las ventanas con datos viejos solo se arregló «Corregir Cantidades». Editar, entregar, trasladar, vender y devolver no se revisaron. *(Resuelto en la Etapa 4: ver §13.)*

## 12. Etapa 3 — lo que se hizo (publicada el 13 oct 2026)

Especificada el 11 oct 2026 y construida y revisada el 13 oct, sobre lo publicado en `ac4fc2f` (INVENTARIO v116, TÉCNICOS v101, OFICINAS v320, RED v44), a pedido de Elkin: «Publica y después continua con la etapa 3». **No está publicada** y las versiones no se subieron: al publicar, INVENTARIO pasa a 117 y TÉCNICOS a 102, **juntos**. Las pruebas no escribieron nada en la base real.

Elkin todavía no respondió las decisiones que se le mostraron el 11 oct: se construyó lo recomendado (ver «Decisiones de Elkin pendientes»).

**Cómo se hizo.** Primero se midieron los datos reales (solo lectura) y se escribió una especificación, que revisó una crítica adversaria. Después, unas piezas comunes (C0) y cuatro partes, cada una en su copia del archivo: C1 la clave del artículo, C2 cada botón y cada lista sobre su fila, C3 «🧩 Unificar» y C4 «Ver vacías». Se juntaron sin ningún conflicto: cada función tenía un solo dueño. Después vinieron dos revisiones adversarias y sus arreglos (ver «Revisión adversaria»). Lo que sigue es lo que quedó al final, ya con esos arreglos.

**Lo que dijeron los datos (11 oct, solo lectura):**
- Ningún par de filas se diferencia solo por espacios, mayúsculas o tildes (187 nombres, 187 claves). R5 era un riesgo, todavía no un daño.
- Los repetidos de verdad: 4 grupos con el nombre idéntico en EL PAUJIL y DONCELLO (3 los creó «📦 + Material», que nunca comparaba) y 20 grupos que solo cambian el prefijo ONT, ONU o sin prefijo (el Catálogo ya agrupa la mayoría).
- 6 ids de fila repetidos en 23 filas de artículos distintos (LA MONTAÑITA y 4 cuadrillas). Por eso, en LA MONTAÑITA, entregar «grampas plásticas» sacaba conectores.
- 85 filas en 0 y sin seriales (48 en bodegas y 37 en cuadrillas). EL PAUJIL tiene 27 de 70.
- 11 cuadrillas tienen el mismo equipo como nuevo y como usado: ahí fallaba la devolución de TÉCNICOS.
- 53 recuperados pendientes: 27 entran a su fila exacta y unos 26 crearían una fila nueva. Entre ellos, 10 u 11 «srv-profile_200» en DONCELLO, que vienen de fichas de clientes mal cargadas.

### Qué quedó en cada archivo

| Archivo | Qué cambió |
|---|---|
| `INVENTARIO_PTOVISION.html` (de 14.540 a 16.089 líneas) | La clave del artículo en todos los sitios que buscan o crean una fila por nombre (C1); cada botón, lista, solicitud, serial y la fusión fina sobre su propia fila (C2); «🧩 Unificar artículos repetidos» y el 🧹 (C3); «Ver vacías» en Bodegas (C4). Las piezas comunes van en el bloque «Etapa 3 (docs/12, C0)», justo después de `_fusion3RegistroInv`. Debajo, un bloque por parte, cada uno con su ancla «Etapa 3 · Cn: funciones nuevas (debajo)». Las funciones de siempre que cambiaron llevan el comentario «Etapa 3 (Cn)»; los arreglos de las revisiones, «Revisión de la Etapa 3» o «Segunda revisión de la Etapa 3» |
| `TECNICOS_PTOVISION.html` (4.205 líneas) | Solo la devolución de material (C2-T): `_filaDevolucionTec` (nueva), `_confirmarDevolverMaterial`, `_onMatSelChange` y `_agregarMaterial`. Los consumos no cambian |
| `PRUEBAS.html` (10.693 líneas) | 10 pruebas nuevas en el grupo de INVENTARIO (171 en total) y una prueba vieja adaptada: la del panel de la Etapa 6 |
| Banco (`_PRUEBAS_SIMULADAS_2026-10-09/trabajo`) | `inv/etapa3.js`, nuevo: 39 escenarios y las opciones `--v116`, `--html=`, `--tec=` y `--reloj=`. `inv/unit_v112.js` extrae además `_nomFilaInv` e `_idsRepetidosF3` |
| OFICINAS, RED | Sin cambios. De `inventario/datos` solo leen `bodegas` (id, nombre, clave): no buscan ni crean filas de artículo |

### La clave de un artículo · prueba R5

`_claveArticuloInv(nombre, tipo)` es el nombre en mayúsculas, sin tildes y sin espacios de más (`_nomFilaInv`), más el tipo. **Solo sirve para comparar.** El nombre se guarda como se escribió, igual que `_snNormal` con los seriales.
- Nunca cruza el tipo: nuevo y usado nunca se juntan.
- ONT, ONU y sin prefijo no se juntan solos («ONT X» no es «ONU X»). Eso lo decide una persona, con el Catálogo y 🧩.
- Un espacio que falta («CONTROL TVBOX» y «CONTROL TV BOX») tampoco se junta solo. El interruptor `_CLAVE_SIN_ESPACIOS_INV` está en `false` (decisión 1 de Elkin, pendiente). Mientras tanto, `_claveSueltaInv` (el nombre sin ningún espacio) solo sirve para **proponer**: sale como «parecido» en la ventana de Recuperados y como grupo sin marcar en 🧩.
- Unidades (`_unidadClaveInv`, `_unidadCompatibleInv`): «Und», «unidad», «UND.», «u»… son la misma. Metros y bolsas no se juntan con unidades.

**¿A qué fila entra algo que llega por nombre?** Lo decide `_filaParaEntrarInv(reg, nombre, tipo, unidad)`, pura. Devuelve `{fila, por:'exacto'|'clave'|null, cercanas}`:
1. nombre y tipo exactos, lo de siempre. Con una sola fila así no mira la unidad, porque TÉCNICOS manda siempre «unidad» en retiros y recogidas. Con varias, primero la de unidad compatible (revisión: «CABLE DROP» en m y en Und);
2. la clave, con unidad compatible;
3. si no hay: ninguna fila. `cercanas` (mismo tipo, unidad compatible y la misma clave sin espacios o la misma referencia del Catálogo) solo sirve para preguntar.
- Nunca entra material a una fila vaciada por 🧩: va a su destino vivo (`_destinoUnificadaInv`, que sigue la cadena hasta 5 pasos y no cruza el tipo). Si no hay destino vivo, es como si no hubiera fila.

**Dónde se usa.** Antes cada sitio comparaba `m.nombre===N && m.tipo===T`, o en minúsculas:
- `integrarRecuperado` (ver abajo). Su aviso v82 de la cuadrilla compara con `_nomClaveInv`;
- `saveEntregaLogic`, para la fila de destino en la cuadrilla. La fila nueva lleva un id que no choca y la `categoria` de la fila de origen. Es la «mejora menor» de la Etapa 7: `fixDB` ya no marca la cuadrilla como tocada;
- `modalDevolverMat` (sobre la bodega que capturó la ventana, no una fresca: eso es de la Etapa 4), `procTrans` al aceptar (ya no busca por `it.id`, que es el id de una fila de otra bodega) y al rechazar, `modalTraslado`, `deleteCliente` y `modalRetiroParcial` (a bodega y a cuadrilla);
- `saveBodegaImport`: exacto, o la clave con unidad compatible. Un «cable» en m ya no se suma a un «CABLE» en Und: se crea aparte;
- `_devolverVentaABodega`, con el tipo de la venta: antes un «usado» volvía a la fila «nuevo». Una venta vieja sin tipo sigue la regla de antes, pero nunca entra a una vaciada;
- «📦 + Material» (`_existenteAlAgregarInv`), el hallazgo «Artículo duplicado en la bodega» de la 🩺 Auditoría, los grupos de 🧩 y las listas temporales (`_claveListaInv`).

**Ids nuevos.** `_idFilaInv(reg)` da 13 cifras de la hora más 6 letras o cifras al azar (19 caracteres) y nunca repite un id del registro. Antes la entrega usaba `Date.now()+random*100`: al crear 5 filas juntas chocaban más o menos 1 de cada 10 veces.

**`_normNom`** tenía `/s+/`: cambiaba cada «s» por un espacio. Ahora es `/\s+/`. Solo la usa `_veredictoSN`.

**TÉCNICOS no cambia en los consumos.** `_nomTec` y `_filasDeItemTec` ya ignoran mayúsculas y espacios de más, igual que `_normConsumo`. Una prueba gemela lo asegura.

### Integrar un recuperado y «¿A qué artículo entra?»

- **El ✅ pasa también el id** del recuperado: `integrarRecuperado(idx, rid)`, con el segundo parámetro opcional. La posición es la de la lista general, el oyente no repinta Recuperados y el archivador saca del principio los integrados viejos: la posición se corría y el ✅ de X integraba otro, hasta de otra bodega. Si `rid` no coincide con esa posición, se busca por id. Si ya no está: «Ese recuperado ya no está en la lista (se integró en otra pantalla o se archivó). Te muestro la lista de ahora.». Con un solo argumento, como siempre.
- **Con fila** (exacta o por la clave): se integra ahí, en el acto y sin preguntar. Es el camino de R5: «TV BOX  TV98 PRO» entra a «TV BOX TV98 PRO». Si los nombres no son iguales, el registro dice `Integrado "X" en "Y"`.
- **Sin fila** (decisión 5): ya no se crea la fila sola. Primero se lee el Catálogo y se vuelve a mirar (`_integrarRecuperadoSinFilaInv`): si la bodega entró directo a Recuperados, `CATALOGO` seguía vacío y no había «parecidos». Después sale la ventana `_preguntarDestinoRecuperadoInv`: «"X" (usado, 1 und, con seriales) no coincide con ningún artículo de BODEGA. Escoge a cuál entra o créalo como artículo nuevo.». La lista trae primero los parecidos, después las demás filas del mismo tipo y de unidad compatible, y al final «➕ Crear "X" como artículo nuevo». Nunca filas del otro tipo.
- **Al Guardar** se vuelve a buscar el recuperado por id (si ya se integró en otra pantalla, se avisa) y la fila elegida por su llave. Si la fila cambió: «"Y" cambió mientras tenías la ventana abierta. No se integró nada. Vuelve a intentarlo.».
- **«Crear» también se vuelve a mirar** (revisión). Si mientras tanto otra pantalla creó esa fila, se pregunta: «Mientras tenías la ventana abierta apareció "Y"… ¿Integrar "X" ahí en vez de crear otro artículo igual?». Si la respuesta es no, no se integra nada.
- La entrada en sí está en `_integrarRecuperadoEnInv(r, b, fila)`: los seriales que ya están en otro sitio (aviso v99), sumar o crear, el kardex, el registro y el guardado. Cancelar la ventana no mueve ningún serial.
- En `?prueba=1` funciona igual, en memoria y sin escribir.

### «📦 + Material» con un nombre que ya existe · decisión 6

Antes de crear la fila se mira si el artículo ya existe (`_existenteAlAgregarInv`), aunque esté vacío y escondido:
- **Con unidad compatible:** «Ya existe "Y" (usado, 0 und, vacía y oculta) en BODEGA. ¿Sumar estas 5 und ahí, como 📥 Reabastecer, en vez de crear otro artículo igual?».
  - Sí → `_sumarAlAgregarInv`: seriales revisados, fotos, kardex y lote con el nombre de Y. El stock mínimo, la categoría y las observaciones de Y no cambian; si se escribió otro valor, el aviso lo dice.
  - No → «¿Crear de todas formas otro "X" separado? Quedarían dos filas con el mismo nombre.». Si también dice que no, no se hace nada y la ventana sigue abierta.
- **En otra unidad** no se ofrece sumar: «Ya existe "Y" pero en m. ¿Crear "X" en Und como otro artículo?».
- La fila nueva lleva `_idFilaInv`.

### La llave de cada fila (el «Pendiente» 1 de la Etapa 2)

Los botones de la fila pasaban solo la bodega y el id. Con ids repetidos, cada función tomaba la **primera** fila con ese id. Ahora:
- **La fila pinta su llave** en el `<tr>` (`_attrsLlaveFilaInv`): `data-fila`, `data-nom`, `data-tipo`, `data-pos` y, solo si el id se repite, `data-rep="1"`. Todo escapado: un nombre con comillas o `<` no rompe nada.
- **Cada botón la pasa** como tercer argumento, `_llaveFilaInv(this)`: ✏️ `modalEditMat`, 📥 `modalRestock`, ➕ SN `modalAddSN`, 📋 `modalHistorial` y ✕ `delMat`. Sirve también en la vista por referencia.
- **`_filaDeLlaveInv(reg, id, llave)` la resuelve.** Id único: esa fila, aunque otra pantalla la haya renombrado. Id repetido: la de igual nombre y tipo; entre gemelas idénticas, la de la posición. Si no hay ninguna, `undefined`, y no se toca la vecina. Sin llave (las llamadas viejas, las pruebas y el banco), la primera con ese id, como siempre.
- **`rep`** (revisión). La llave dice si el id estaba repetido cuando se tomó (`_idRepetidoFilaInv`). Si ahora queda **una sola** fila con ese id, solo vale si tiene el mismo nombre y tipo. Antes, si la fila escogida se quitaba al llegar a 0 y quedaba sola la hermana (otro artículo con el mismo código), se descontaba la hermana sin aviso.
- **Si la fila ya no está:** «⚠️ Ese artículo cambió en la bodega mientras mirabas la lista (otra pantalla lo modificó o lo borró). Te muestro la lista de ahora.», y no se toca nada. Antes la función fallaba con `m` sin definir.

**Función por función:**
- `delMat`: lo de la Etapa 2 (lápida «directo» del admin, una sola solicitud por artículo), sobre la fila correcta. La solicitud de la bodega sale con el nombre, la cantidad, el tipo y los seriales de esa fila.
- `modalEditMat`: el admin aplica sobre la fila de **ahora** (`_filaVigenteInv`), no sobre el objeto de cuando abrió la ventana: con un snapshot de por medio, el cambio se perdía. Si con la ventana abierta entró o salió material: «"X" cambió mientras tenías la ventana abierta (entró o salió material). No se guardó nada. Vuelve a abrir la ventana.». Las fotos que se suben después van a la fila de ese momento. La solicitud de edición de la bodega lleva un campo nuevo, `materialTipo`.
- `modalRestock` y `modalAddSN`: en el Guardar, la fila de ahora.
- `modalHistorial`: el kardex de la fila del botón. Las entregas y los traslados, solo de esa bodega y, si el id se repite, solo los de ese artículo. Antes el 📋 de CONECTOR mostraba las entregas de CABLE.
- `registrarMovimiento(bId, mId, tipo, cant, detalle, fila)`: el 6.º argumento, opcional, es la fila tocada. El kardex va a ella y no a la primera con ese id.
- **Una fila vaciada por 🧩** lleva la etiqueta «🧩 Unificado en "P" el dd/mm/aaaa» y solo 📋 (más ✕ para el admin). ✏️, 📥 y ➕ SN dicen «Este artículo se unificó en "P".» y piden hacerlo en "P" («Edita "P".», «Reabastece "P".», «Agrega los seriales a "P".»), también si 🧩 la unificó con la ventana abierta (revisión). Si le volvió a entrar material, la etiqueta dice «🧩 Unificado en "P", pero le entraron N después: el administrador lo pasa a "P" con 🧩». Si entró un serial sin cantidad, dice «1 serial(es) (sin cantidad)» (revisión: antes decía «le entraron 0»).

**Solicitudes.**
- `_filaDeSolicitudInv`: el tipo que se compara es `materialTipo` si viene; si no, `req.tipo`, salvo que diga `'edicion'` o `'venta'`. Eso es la clase de solicitud: en las ediciones nunca coincidía y la búsqueda caía a «solo nombre». **D4:** con varias filas con ese id y una solicitud que trae el tipo, nunca se toma la del otro tipo por el nombre solo. No hay fila y la solicitud se cierra sin cambios.
- `approveEdit` aplica a la fila de la solicitud, no a la primera. Si hay varias con ese código y ninguna se llama así: «cerrada sin cambios» y «Con ese código hay N artículos en BODEGA y ninguno se llama "X" (tipo): no se tocó nada.». Si es una vaciada: «"X" se unificó en "P" el …: pide la edición sobre "P".».
- `approveDelete` anota el kardex en la fila que se borra. «Rechazar y restaurar» devuelve la fila con su id solo si ninguna fila de la bodega lo usa; si lo usa una hermana, con un id nuevo y sin anular lápidas. Borrar una vaciada se permite, y el aviso lo dice.

### Listas que eligen un artículo y guardan después

- **Por id** (entrega `#eMat`, traslado `#tMat`, cambio de equipo `#cbMat` y `#cbMatCuad`): cada opción lleva la llave de su fila. Las cajas de seriales (`showESNBox`, `showTransferSNBox`, `window._loadCbSNs`) muestran los de **esa** fila, y el Guardar descuenta de ella. `sendTransLogic` y la transacción de `saveEntregaLogic` resuelven cada renglón una sola vez, y validan y descuentan sobre la misma fila.
- **Por posición** (venta `#vMat`, equipo a cliente `#aeMat`, dotación `#dMat`, instalación `#iMat`): `_filaElegidaInv(reg, idx, llave)` toma la fila de esa posición si sigue siendo la de la llave; si no, la de la llave; si tampoco está, ninguna.
- **Antes de descontar nada** (lo que recomendaba la especificación), cada renglón se compara con su fila (`_problemasElegidasInv`). Si una fila ya no está, no alcanza el stock o un serial marcado ya no está en ella, no se descuenta **nada**: «❌ No se guardó …: el stock cambió mientras la preparabas. • … No se descontó nada. Cierra, vuelve a abrir y ármala de nuevo.». Antes un serial que no estaba se ignoraba y la cantidad bajaba igual (la fila quedaba descuadrada); en equipo a cliente se omitía cada equipo por separado.
- Las listas temporales agrupan por id más la clave del artículo (`_claveListaInv`). Por id solo, dos artículos con el mismo código se sumaban en un renglón.
- **Cada renglón guarda su llave** (`id`, `nom`, `tipo`, `pos`) y, desde la revisión, `rep`: `addEItem`, `addTransItem`, `addDotItem`, `addIItem` y `confirmSnInst`, `addAeItem`. Así `rep` viaja en entregas, traslados, instalaciones y dotaciones. Solo lo lee INVENTARIO. Un traslado pendiente de antes no lo trae y se comporta como antes.
- La instalación sigue quitando después las filas en 0: eso es de la Etapa 4.

### Seriales entre filas hermanas

- `_dondeEstaSN(sn, excepto)`: si `excepto` es una fila (objeto), deja fuera solo esa; si es un texto, todas las de ese id, como siempre. `_revisarSNs(lista, m)` pasa la fila: un serial que ya estaba en la hermana ahora sí sale ocupado.
- `_sacarSNDeDondeEste` saca el serial de la fila de ese id **que lo tiene**. Antes, de la primera con ese id: si estaba en la hermana, no salía y quedaba en dos sitios.

### La fusión fina con ids repetidos

`_idsRepetidosF3(...listas)` junta los ids que se repiten en cualquiera de las tres listas: la base, esta pantalla y la nube. `_fusionF3Lista` se los pasa a `_indiceF3(lista, rep)`, que a esos ids les agrega nombre y tipo en la llave. Así cada hermana se empareja consigo misma aunque otra pantalla haya quitado una fila de antes.
- Arregla el artículo que quedaba duplicado (CONECTOR 7 y 6) y el cambio que caía en el vecino (GRAPA de 4 a 2). La cuadrilla #3 de EL PAUJIL tenía esa forma.
- Con ids únicos no cambia nada.
- Borde conocido: si aquí se renombra una hermana mientras la nube le cambia otro campo a esa misma, queda dos veces.

### La devolución de TÉCNICOS 102 (C2-T)

Hasta la v101, la transacción buscaba la fila por nombre y unidad, y si no, solo por nombre. Con el mismo equipo nuevo y usado en la cuadrilla, devolver el nuevo podía descontar del usado, o decir «ya no están a tu nombre». Ahora decide `_filaDevolucionTec(mats, mat)`, pura:
1. por el id de la fila escogida. Si hay una sola fila con ese id, del mismo tipo y de unidad compatible, esa, aunque la bodega la haya renombrado. Si hay varias, la de igual nombre y tipo;
2. si no, igual nombre, tipo y unidad;
3. si no, igual nombre y tipo.

**Nunca la del otro tipo.**
- **Revisión:** `_confirmarDevolverMaterial` anota `mat.idRepetido`: si el id se repetía en la cuadrilla que se vio al abrir la ventana. Si se repetía, la única fila de la nube con ese id solo vale si tiene el mismo nombre. Si no, era la hermana (VERDES en vez de AZULES) y sale «Ya no tienes "X" (tipo) asignado. Actualiza la pantalla.», como en la v101. La unidad se compara por familias (Und = unidad = vacío; m = mts = metros), para no tomar metros por unidades.
- El recuperado y el dañado llevan el nombre y la unidad de la fila de la nube, no los de la pantalla: con un nombre viejo, la bodega no encontraría la fila al integrar.
- `_onMatSelChange` y `_agregarMaterial` miran «ya agregado» y «seriales ya usados» por nombre **y tipo**: antes sumaban nuevo y usado.
- No se tocan `_aplicarFinalizacionTec`, la cola, `_reservasTec`, `_disponiblesTec`, `_nomTec`, `_filasDeItemTec` ni el modo prueba. Un celular con la v101 sigue como hoy hasta que actualice.

### 🧩 Unificar artículos repetidos (solo el administrador)

**Dónde está.** El botón «🧩 Unificar artículos repetidos (N)» va en la cabecera de 🩺 Auditoría; N son los grupos que la ventana trae marcados. También se abre con «👁️ Ver» en la 🛡️ Vigilancia. La ventana es `modalUnificarInv`. El hallazgo «Artículo duplicado en la bodega» de la Auditoría usa la clave, salta las vaciadas y termina «Conviene unificarlas con 🧩 (arriba).». Con m contra Und dice que se revise con ✏️, porque 🧩 no junta unidades distintas.

**Qué propone** (`_gruposUnificablesInv`, pura). Dentro de cada bodega o cuadrilla, del mismo tipo y de unidad compatible, nunca con filas vaciadas:
1. la misma clave → «se escriben igual», marcado. En cuadrillas, sin marcar (decisión 7 de la tabla de «Decisiones de Elkin pendientes»);
2. la misma referencia del Catálogo → sin marcar;
3. solo cambia un espacio → sin marcar;
4. una vaciada que volvió a tener material y tiene destino vivo → marcado, con la que queda fija en el destino.

La que queda es, por defecto, la de más cantidad; si empatan, la de más seriales; si siguen empatadas, la primera. Se puede escoger otra.

**La ventana.** Por grupo: motivo, tipo y unidad; una tabla con la que queda, el nombre exacto (los espacios de más se ven como `·`), cantidad, seriales, mínimo, categoría, observación y el final del código; la línea «Queda "P" con N und y M serial(es)». Avisos: cantidad distinta de los seriales, un serial en dos filas (queda una vez), Und y unidad, categoría distinta, mínimo distinto (queda el mayor), observaciones distintas («puede ser otra variante»). Los bloqueos salen en rojo y el grupo no se puede marcar. Al abrir se guarda una foto de cada fila. En `?prueba=1` la vista previa funciona, pero no se unifica nada. Cabe en 375 px.

**Lo que bloquea un grupo** (`_bloqueosGrupoInv`, pura). Se mira en la vista previa y otra vez dentro de la transacción, con lo recién leído:
- una solicitud de borrado o edición pendiente de una de sus filas;
- un traslado pendiente con una de sus filas en la bodega de origen;
- en cuadrillas, un consumo pendiente sin serial con el nombre de una absorbida (la confirmación de la v112 busca por nombre y encontraría la vaciada en 0);
- una fila que comparte su código con otra fila del mismo sitio;
- tipos distintos, unidades incompatibles, una cantidad que no es un número o es negativa, o una fila ya vaciada como la que queda.

Los recuperados pendientes no bloquean: al integrar, siguen la marca hasta la que quedó.

**Vaciar y apuntar** (`_planUnificarInv`, pura). Unificar **mueve** material; un borrado no. Con la lápida de la Etapa 2, una pantalla atrasada que le metió material a la fila absorbida la devolvería con todo lo que tenía, y eso ya estaba sumado en la que queda: contado dos veces. Por eso:
- la que queda (P) recibe la suma, la unión de los seriales (por `_snNormal`), las fotos, el stock mínimo mayor, una línea de kardex «🧩 Unificada: entró N …» y `unificadas:[{op, fila, nom, tipo, cant, snesN, en}]` (las de menos de 30 días);
- cada absorbida (A), tenga material o ya esté vacía, **no sale**. Queda en su lugar, en 0, sin seriales ni fotos, con `stockMin:0` (si no, saldría para siempre como «stock bajo») y con la marca `unificadaEn:{op, fila, nom, tipo, en, por:'admin'}`;
- **unificar no deja lápidas.** Las vaciadas se quitan después con el 🧹 (abajo);
- si una absorbida con el mismo nombre exacto iba antes que P, P pasa a ese lugar. TÉCNICOS v101 toma la primera fila con ese nombre al devolver.

**La repetición en las demás pantallas** (`_reaplicarUnificacionesInv`, pura). Corre al principio de `_fusion3RegistroInv`, sin cambiar su firma, así que cubre el guardado y el oyente. Por cada entrada de `P.unificadas` de la nube que la base de esta pantalla todavía no tiene, repite la unificación sobre su base y su memoria. La fusión fina da entonces P = nube + (memoria − base): lo que una pantalla atrasada metió en A entra a P, y lo que sacó de A sale de P, seriales incluidos. Sin marcas en la nube devuelve lo mismo que recibió, y nunca cambia lo que recibe.
- **D2** (el hueco del §6.2 de la especificación): si A está en la base y ya **no** en la memoria (esta pantalla la quitó al dejarla en 0: devolución, instalación o «Corregir»), cuenta como vacía. Antes la repetición no corría y ese material quedaba contado dos veces en P.
- **Segunda revisión:** P y A se buscan con `rep` cuando su id se repite en cualquiera de los tres lados (`_llavesUnifInv`). Antes, si en la memoria quedaba una sola fila con el código de A y era la hermana, se tomaba por A: la hermana quedaba vaciada y su material pasaba a P (P en 15 en vez de 5). Cuándo se repite lo decide una sola función, `_unifRepetibleInv`.
- **Las lápidas de A en el oyente** (revisión). `_tfSaltarPorUnificarInv` deja fuera, solo en la pasada sobre la memoria, la lápida de una absorbida que la nube lista en `P.unificadas` y que esta pantalla todavía no vio. Antes, esa pasada medía el material que la pantalla atrasada le había metido a A y anulaba la lápida con un aviso falso de «volvió…» (el guardado no lo hacía). Segunda revisión: solo la lápida de **esa** fila (código, nombre y tipo; no la de una hermana con el mismo código, que sí debe aplicarse), y solo si la repetición de verdad va a correr: lo dice `_unifRepetibleInv`, y la P de la memoria no puede tener una lápida viva.

**Unificar** (`unificarMarcadosInv`, que llama a `_unificarMarcadosCoreInv`):
1. **Se niega antes de nada** (`_unifNoSePuedeInv`) si no es el admin, en modo prueba, con una versión vieja, sin la conexión lista, sin internet o con otra unificación en curso.
2. **Pantallas abiertas.** Lee el panel de la Etapa 6 (`PV_PANTALLAS.leerPanel`), solo desde este botón. **D3:** con una llamada normal; antes iba con `.call` para que no la contara la prueba de la Etapa 6, que ahora se adaptó. Se niega si no pudo leer el panel, si trae `versionesError` o (**D1**) si no trae la versión publicada de INVENTARIO: sin ella ninguna pantalla sale «vieja». El aviso: «…no se pudo leer la versión publicada del inventario. Inténtalo de nuevo.».
   - **Regla de «vieja»:** una INVENTARIO es vieja si el panel la marca, o si su versión es menor que la mayor entre la publicada y la de esta pantalla. Así también cubre un anuncio de versión que no llegó a la nube.
   - Si hay alguna vieja **con latido**, se niega y las nombra por versión, equipo y dispositivo, sin nombres de personas: «⛔ Hay N pantalla(s) de Inventario con versión vieja abiertas…». Las que no laten solo se avisan al final.
3. **Archivo primero** (regla 5 de CLAUDE.md): una entrada por grupo en `inventario/archivo_unificaciones_<año>`: `{id:op, en, fechaMs, por:'admin', col, registroId, registroNombre, tipo, unidad, queda, absorbidas, resultado, estado:'preparada'}`. Las filas van completas, salvo las fotos, que van como `fotosN`. Se escribe y se **relee**. Si no están todas: «❌ No se pudo guardar el archivo: no se unificó nada.».
4. **Una sola transacción** para todos los grupos (`_fbTransaccionInvMulti`), sobre lo recién leído. Cada fila tiene que seguir como en la foto de la ventana (`_filaCorrVivaInv`); los bloqueos se miran otra vez y el plan se arma de nuevo. Si algo cambió: «"X" cambió mientras tenías la ventana abierta (entró o salió material). No se unificó nada. Vuelve a abrir la ventana.».
5. **Después del commit:** la memoria (`_aplicarNubeParcialInv`), un `logMsg` por grupo («🧩 Unificado en BODEGA X: "P" (usado) recibió N und y M serial(es) de "A" → quedó con T und y S seriales.») y el archivo en «hecha». Si la transacción falla, el archivo queda «cancelada» con su motivo, y la base, como estaba.
- **La reposición del archivo** (revisión). El archivo se reescribe entero, así que otra pantalla que unificaba al mismo tiempo podía pisar la entrada después de la relectura. Ahora `_marcarArchivoUnifInv` recibe las entradas y, si falta alguna, la vuelve a agregar ya con su estado. El aviso final lo dice. Queda un hueco más chico: dos pantallas que marcan «hecha» exactamente a la vez todavía pueden pisarse.

**🧹 Quitar las vaciadas** (`quitarVaciadasUnificadasInv`, botón «🧹 Quitar N filas ya unificadas» en la misma ventana):
- solo las que llevan más de 7 días vaciadas, en 0 y sin seriales, y sin una solicitud de borrado o edición pendiente (esas se saltan y se avisa: se quitan cuando se decida);
- antes relee el archivo **del año de su marca** (una unificación del 28 de diciembre se quita en enero) y exige la entrada de esa `op` con esa fila, en cualquier estado;
- en la transacción, cada una tiene que seguir en 0, sin seriales y con la misma `op`. Sale con la lápida `origen:'unificar'` (`cant:0`, más `op` y `aFila`). A las que quedaron se les podan las `unificadas` de más de 30 días;
- una solicitud que llegó después de abrir la ventana la frena la transacción, y el aviso la nombra (revisión);
- si después le entra material a una fila ya quitada, la lápida se anula y la fila vuelve solo con lo nuevo. El aviso dice «…porque le entró material después de unificarse».
- **D5 — los puentes** (dudoso 1 de la primera pasada). El 🧹 solo quita una vaciada de la **misma clave** que la fila que quedó (`_vaciadaQuitableInv`): la clave de su marca y, si el destino sigue vivo, también la del destino (el admin pudo renombrarlo después). Esas las sigue encontrando `_filaParaEntrarInv` por la clave.
  - Las de un grupo por Catálogo o por un espacio («ONU X» → «EG8145») no se quitan **nunca**. Sin ellas, nada lleva el nombre viejo a la que quedó, y los sitios que no preguntan (devolución, traslado, retiro, venta borrada…) crearían la fila otra vez. Se quedan en 0, escondidas y con su marca.
  - La ventana, la pregunta y el aviso final dicen cuántas se dejan y por qué (`_textoPuentesUnifInv`): «Se dejan N fila(s) en 0 como puente para su nombre viejo…».
  - La transacción lo vuelve a mirar sobre lo recién leído: si en la nube ya es puente (renombraron la que quedó), no se quita.

**🛡️ Vigilancia** (`_cajaUnificacionesVigInv`): «🧩 N unificación(es) en los últimos 30 días · M fila(s) vaciadas por quitar», sin contar los puentes, con «👁️ Ver». En ámbar, las vaciadas que volvieron a tener material («pásalas con 🧩») y las que ya no tienen destino («revisa a mano»). `verArchivoHistoricoInv` muestra «🧩 Unificaciones · año» de los tres últimos años.

### «Ver vacías» y la lectura del Catálogo

- En 🏭 Bodegas, con la casilla «Ver vacías (N)» apagada (lo de siempre al entrar), no se pintan las filas que `_filaOcultableInv` da por escondibles: en 0, sin seriales reales y sin stock mínimo (ni el de la fila ni el de su referencia del Catálogo), o vaciadas por 🧩. Las negativas, las de 0 con seriales, las de stock mínimo y las vaciadas que volvieron a tener material se ven siempre. Con el filtro «Stock: En cero» se ven aunque la casilla esté apagada.
- **Solo cambia lo que se muestra.** El total «uds» de cada bodega, el Excel, la Auditoría, el chequeo, el Dashboard, los reportes, la búsqueda global, Garantía, los selectores, las cuadrillas y el «Inventario global» siguen con todas las filas.
- Debajo de la tabla: «🙈 k artículo(s) vacío(s) oculto(s).», o «Sin artículos con stock (k vacío(s) oculto(s)).» en lugar de la tabla. Con una búsqueda: «🙈 k artículo(s) en 0 coinciden con la búsqueda: marca «Ver vacías» para verlos.». Si no, buscar un artículo en 0 daba «Nada coincide aquí» y la bodega lo creaba otra vez.
- La preferencia es de cada bodega (y del admin) en su navegador: `localStorage['inv_ver_vacias:admin']` o `['inv_ver_vacias:bod_<id>']`. Nunca va a la base. Si el navegador no deja guardar, la casilla funciona igual en esa pestaña. «✕ Limpiar» no la toca.
- **La lectura del Catálogo** es un extra de C4, no estaba en la especificación. En la vista clásica nadie leía el Catálogo y, sin él, se escondía una fila en 0 cuyo mínimo está solo en su referencia. `_catalogoParaVaciasInv` lo lee una vez (solo lectura) y repinta si Bodegas sigue en pantalla. De paso, el filtro «⚠️ Bajo mínimo» de esa vista ve el mínimo de la referencia. Revisión: una sola lectura por sesión (`_catVaciasLeidoInv`); sin ese freno, si la condición cambiara, la pestaña se colgaba repintando. Si la lectura falla, el Catálogo queda vacío y no se vuelve a pedir (ver «Riesgos que quedan»).

### Qué cambia en los datos y quién se entera

| Dónde | Qué | ¿Lo lee otra app? |
|---|---|---|
| filas de `bodegas` y `cuadrillas` | `unificadaEn` en las vaciadas (con `stockMin:0`) y `unificadas` en la que queda; las filas nuevas, con ids de 19 caracteres; `categoria` en las filas que crea la entrega | TÉCNICOS solo lee cuadrillas: ignora los campos nuevos, sus transacciones los conservan (reescriben el arreglo fresco) y no ve las vaciadas (filtra `cantidad>0`). OFICINAS y RED no leen filas |
| `inventario/datos._tumbasFila` | lápidas `origen:'unificar'` con `op` y `aFila`, solo las del 🧹 | solo INVENTARIO. Una pantalla v116 las trata como cualquier lápida |
| renglones de entregas, traslados, instalaciones y dotaciones | `pos` y `rep` | solo INVENTARIO |
| `inventario/historial.editRequests` | `materialTipo` en las nuevas | solo INVENTARIO. `AVISOS_PENDIENTES.gs` cuenta pendientes: no cambia |
| `inventario/archivo_unificaciones_<año>` | documento nuevo, con el mismo formato que los `archivo_*` | nadie más |
| navegador | `inv_ver_vacias:admin` o `inv_ver_vacias:bod_<id>` | — |

- Nada guarda nombres de personas: `por:'admin'`, y el kardex dice `usuario:'Admin'`, como siempre.
- Tamaño: unificar casi no cambia `inventario/datos`; las vaciadas quedan en 0 con su marca.

### Lo que se apartó de la especificación

1. **D2.** El §6.2 decía «si falta alguna de las cuatro filas, no se repite». Ahora una A que falta en la memoria cuenta como vacía. C3 lo había propuesto; se decidió hacerlo antes de la revisión.
2. **D1 y la regla de «vieja».** El §6.6 pedía negarse con un error o con `versionesError`. Ahora también sin la versión publicada de INVENTARIO, y «vieja» se compara además con la versión de esta pantalla.
3. **D3.** `leerPanel` se llama de forma normal, y la prueba de la Etapa 6 se adaptó (ver «Pruebas»). C3 lo había llamado con `.call` para que esa prueba no lo contara.
4. **D4.** `_filaDeSolicitudInv` ya no cae a «solo nombre» cuando la solicitud trae el tipo. El §5.3 lo dejaba como estaba.
5. **D5.** El §6.7 quitaba todas las vaciadas de más de 7 días. Ahora solo las de la misma clave; las demás quedan como puente. Dos cosas no se ajustaron: el mensaje de 🧩 sigue diciendo «(k ya estaban vacías: quedan escondidas y se quitan con 🧹 a los 7 días)», que no vale para un grupo por Catálogo o por un espacio; y la 🛡️ ya no cuenta los puentes entre las «vaciadas por quitar».
6. **`rep` en la llave.** La C0 decía «id único → esa fila, aunque la hayan renombrado». Si la llave se tomó con el id repetido, ahora tienen que coincidir también el nombre y el tipo.
7. **La unidad entre filas exactas.** El paso 1 de `_filaParaEntrarInv` no miraba la unidad. Con dos filas exactas, ahora prefiere la de unidad compatible.
8. **«Crear» se vuelve a mirar al Guardar** en «¿A qué artículo entra?».
9. **TÉCNICOS.** La fila única por id tiene que ser, además del mismo tipo, de la misma familia de unidad y, con `idRepetido`, del mismo nombre.
10. **El archivo.** `_marcarArchivoUnifInv` repone la entrada que otra pantalla pisó. La especificación solo pedía un `console.warn` si fallaba.
11. **El extra de C4:** `_catalogoParaVaciasInv` (ver «Ver vacías»). Si no se quiere, se quita una línea en `_listadoBodegasHTML` y la función.
12. **El banco.** En U7 los «8 días» se logran echando atrás la marca y moviendo su entrada al archivo de ese año, no moviendo el reloj de la pantalla. En U9, la INVENTARIO v115 es un latido inyectado en `sesiones_vivas`. La parte de la v116 de U6 va dentro de U6.

### Decisiones de Elkin pendientes

El 11 oct se le mostraron 9 decisiones. No ha respondido. Se construyó lo recomendado, y cada una se cambia en una línea o una casilla:

| # | Lo que se le preguntó | Lo construido por defecto |
|---|---|---|
| 1 | ¿«CONTROL TVBOX» y «CONTROL TV BOX» son el mismo artículo? Se recomendó que sí | **No por defecto**: la app pregunta. La ventana de Recuperados los pone primero como «parecido» y 🧩 los propone sin marcar («solo cambia un espacio»). Si Elkin dice que sí: `_CLAVE_SIN_ESPACIOS_INV=true` |
| 2 | ONT, ONU o sin prefijo: que la app no los junte sola | Así: salen como «parecidos» y en 🧩 sin marcar |
| 3 | «Und» y «unidad» son la misma unidad; metros y bolsas nunca se juntan con unidades | Así (`_UNIDADES_UND_INV`). Un nombre exacto entra a su fila aunque diga otra unidad, porque TÉCNICOS manda siempre «unidad» |
| 4 | Nuevo y usado nunca se juntan, y lo que devuelve un técnico entra como usado | Así |
| 5 | Una devolución con un nombre raro («srv-profile_200»): la bodega escoge a qué artículo va | Así: la ventana «¿A qué artículo entra?» |
| 6 | «📦 + Material» con un nombre que ya existe pregunta «¿sumar ahí?» | Así |
| 7 | 🧩 solo para el administrador: suma, archiva, no borra; empezar por las bodegas | Así. En cuadrillas, los grupos salen sin marcar |
| 8 | Filas vacías escondidas solo en Bodegas, con «Ver vacías» | Así |
| 9 | Esta etapa cambia también TÉCNICOS; los técnicos tendrán que actualizar | Así: TÉCNICOS 102 junto con INVENTARIO 117 |

- Los demás puntos del §11 de la especificación no se le preguntaron aparte y se construyeron como se recomendaba: no cambiar el código de los 17 artículos que comparten código con otro; cancelar todo y avisar si una lista cambió entre escoger y guardar; un botón de una fila que cambió avisa y no hace nada; y una vaciada que vuelve a tener material se muestra y 🧩 la propone.
- **Sigue sin respuesta la de la Etapa 2:** si de dos solicitudes de editar el mismo artículo con datos distintos se aprueba una, hoy la otra queda «aprobada · duplicada». Se le recomendó «rechazada». No se cambió (§11, «Pendiente» 4).

### Riesgos que quedan

- **Una pantalla v116 abierta** con cambios sin guardar en una absorbida: lo que le **metió** queda en A, se ve y 🧩 lo propone otra vez (caso 4); lo que le **sacó** se cuenta dos veces. Por eso 🧩 se niega con pantallas viejas que laten, y se usa fuera de horario.
- **Cuadrillas:** `renderCuads` y «Corregir Cantidades» no cambiaron. Una vaciada se ve en 👷 como una fila más en 0, sin la etiqueta, y «Corregir» deja subirle la cantidad (termina en el caso 4).
- **Un consumo hecho sin señal** antes de unificar una cuadrilla, que llega después con el nombre de una absorbida y sin serial: la bodega lo verá «no alcanza» y quedará pendiente. No se pierde ni se cuenta dos veces. Por eso, en cuadrillas, los grupos salen sin marcar y hay que avisar antes a los técnicos.
- **Ya pasaba:** dos pantallas que crean a la vez la misma fila nueva dejan dos filas (se arregla con 🧩); dos pantallas que integran el mismo recuperado a la vez lo suman dos veces.
- **Un Catálogo que no se pudo leer** esconde, hasta recargar, las filas en 0 cuyo mínimo está solo en su referencia (dudoso 3 de la primera pasada). Hoy no afecta a ninguna fila: ninguna referencia tiene mínimo. En la v116 la vista por referencia ya perdía ese aviso igual.
- **«Los dos quedaron igual»:** si dos pantallas sacan la misma cantidad de la misma fila, la fusión cuenta una sola salida (dudoso 5). Ya pasaba desde la v112; la etapa no lo empeora.
- **Si la nube renombra P** después de unificar y el id de P se repite, la búsqueda con `rep` no la encuentra y la repetición no corre. La fusión sigue entonces como antes de la Etapa 3.
- **Las dudas abiertas del §12 de la especificación** siguen como estaban:
  - un retiro de TÉCNICOS dice siempre «unidad»: si su nombre solo coincide por la clave con una fila en metros, sale la ventana (hoy no hay ningún caso);
  - un Excel de bodega sin unidad toma «Und» y ya no se suma a una fila en m;
  - las ventas no guardan el id de la fila, y devolverlas busca por nombre;
  - TÉCNICOS 102 con una fila que se vació con la ventana abierta responde «Solo tienes 0…». No pierde nada;
  - la Auditoría («Material contado DOS veces», «dañado que sigue a nombre del técnico») no sigue `unificadaEn`;
  - la búsqueda global muestra las vaciadas con su nombre viejo.
- Lo que la revisión adversaria dejó, a propósito o porque quedó en duda, está en la sección siguiente.

### Revisión adversaria (13 oct 2026)

Antes de mostrarla se buscaron fallas a propósito, en dos pasadas. Cada hallazgo lo revisaron dos escépticos por separado, con las funciones reales sacadas del archivo y con el banco. Las reproducciones quedaron en el scratchpad de la sesión (`etapa3/rev`, `rev2`, `fix_rev`, `fix_hermana`, `d5_res`, `verif_*`). Las copias de antes de cada pasada: `etapa3/pre_rev` y `etapa3/pre_rev2`.

**Primera pasada: 22 hallazgos**, con seis lentes: la clave, las filas, 🧩, la pantalla, las etapas anteriores y las pruebas. **16 confirmados** (los dos escépticos dijeron que sí), **6 dudosos** (uno sí y uno no) y **0 refutados**. Los 16 se corrigieron, cada uno con su prueba. Algunos eran la misma falla vista desde dos lados:

| Falla | Arreglo (arriba) |
|---|---|
| Cuando la fila escogida se quitaba y su hermana quedaba sola con el código, los botones, las listas (instalación, dotación, equipo a cliente, cambio de equipo), `_filaDeLlaveInv` y `_filaElegidaInv` actuaban sobre la hermana (3 hallazgos) | `rep` en la llave y en los renglones (ver «La llave de cada fila») |
| TÉCNICOS 102 devolvía de la hermana; la v101 se negaba (2) | `idRepetido` y la familia de unidad (C2-T) |
| «¿A qué artículo entra?» con «crear» no volvía a mirar al Guardar y dejaba dos filas | «Crear» también se vuelve a mirar |
| Con dos filas del mismo nombre en unidades distintas, lo que llegaba entraba a la primera | El paso 1 prefiere la de unidad compatible |
| ➕ SN y ✏️ del admin no miraban en el Guardar si 🧩 había vaciado la fila: el material entraba a la vaciada | Los dos lo miran |
| 🧩 no se negaba si la versión publicada no llegaba o estaba atrasada (U9 y el anuncio fallido) | D1 y la regla de «vieja» |
| El archivo de unificaciones se reescribe entero: dos unificaciones a la vez perdían la entrada de una | La reposición en `_marcarArchivoUnifInv` |
| Una vaciada quitada con otra lápida («Corregir», ✕, una aprobación) daba un aviso falso de «volvió» en el oyente | `_tfSaltarPorUnificarInv` |
| La etiqueta de una vaciada en 0 con un serial decía «le entraron 0» | La etiqueta cuenta los seriales |
| La prueba «primero el archivo…» y U7 fallaban solas del 1 al 8 de enero | Cada entrada se siembra en el archivo del año de su marca (PRUEBAS); `envejecer8` y `--reloj` (banco) |
| El panel inventado de la prueba de 🧩 no tenía la versión publicada: no veía U9 | La prueba usa el `leerPanel` de verdad, sobre una copia aparte de `pantallas.js` |
| Ninguna prueba cubría que el 🧹 se frenara por una solicitud que llegó después | El aviso la nombra; prueba y RV-FREN |
| La lectura del Catálogo en la vista clásica no tenía prueba, y sin freno la pestaña se colgaba | `_catVaciasLeidoInv`; prueba y RV-CAT |

Junto con eso se hicieron los cuatro puntos decididos antes de la revisión, que venían de la construcción: D1 (U9 fallaba en el banco), D2 (el hueco que señaló C3), D3 (el `.call` de C3) y D4 (la búsqueda «solo nombre» que señaló C2).

**Dudosos de la primera pasada:**
1. **Después del 🧹, lo que llegaba con el nombre de una absorbida** de un grupo por Catálogo o por un espacio volvía a crear la fila: la unificación se deshacía sola. Se decidió y se hizo **D5**, los puentes.
2. **El hueco del §6.2, del lado de la que queda:** si una pantalla atrasada deja P en 0 y la quita (instalación, devolución, «Corregir»), la repetición no corre y la fusión conserva la P de la nube, con la suma. Sin corregir: es el problema general de quitar filas en 0 sin lápida (la regla «quitada en un lado y cambiada en el otro se conserva»), y ya pasaba igual en la v116 con cualquier cambio de la nube sobre esa fila. Pasa a la Etapa 4.
3. **Un Catálogo que no se pudo leer:** ver «Riesgos que quedan».
4. **🧩 con una INVENTARIO v116 viva** si la versión publicada sigue en 116 (la 117 no la anunció). Lo cubre la regla de «vieja»: una INVENTARIO menor que esta pantalla cuenta como vieja.
5. **«Los dos quedaron igual»:** ver «Riesgos que quedan». Ya pasaba desde la v112 (commit `c46c128`).
6. **La prueba de la Etapa 6 no ve una lectura del panel hecha con un alias.** Con D3 la prueba exige además quién llama a `_unificarMarcadosCoreInv`. El alias sigue sin verse, igual que en lo publicado.

**Segunda pasada** (solo sobre los arreglos de la primera y D5): **6 hallazgos, 4 confirmados, 2 dudosos y 0 refutados.** Los 4 confirmados se corrigieron:

| Falla | Arreglo |
|---|---|
| `_tfSaltarPorUnificarInv` saltaba la lápida solo por el código: también la de la hermana que tuvo ese código. El oyente anulaba su borrado aprobado con un falso «volvió…» | El salto lleva el código, el nombre y el tipo de la absorbida |
| La lápida de A se saltaba aunque la repetición no fuera a correr (a la memoria le faltaba P): anulación falsa, y A volvía con material que ya estaba en P | Salta solo si `_unifRepetibleInv` dice que la repetición corre y la P de la memoria no tiene una lápida viva |
| D2 buscaba A y P por id sin `rep`: si el código de A lo tenía una hermana, la vaciaba dentro de P (P en 15 en vez de 5) | `_llavesUnifInv`, con los ids repetidos de los tres lados |
| `PRUEBAS.html` quedaba en rojo: la comprobación del hallazgo 11 esperaba lo de antes de D5, y D5 no tenía ninguna prueba | El escenario del hallazgo 11 usa vaciadas de la misma clave; una comprobación nueva de D5 en PRUEBAS y el escenario SR-D5 en el banco |

**Dudosos de la segunda pasada:**
- **D5 en cadena — corregido.** «ONU X» se unificó por Catálogo en «EG8145», y después «EG8145» se unificó en «eg8145» (la misma clave). El 🧹 quitaba «EG8145», porque es de la misma clave, y el puente «ONU X» quedaba sin destino: lo que llegara como «ONU X» volvía a crear la fila. Ahora `_vaciadaQuitableInv` no deja quitar una vaciada por la que pasa otra (`_vaciadasQuePasanPorInv`, el mismo camino que `_destinoUnificadaInv`): es un eslabón vivo. La transacción del 🧹 lo vuelve a mirar sobre lo leído, y el aviso y la ventana lo explican aparte («Se dejan N fila(s) en 0 porque otra fila unificada pasa por cada una…»). Si toda la cadena es de la misma clave, el primer 🧹 quita solo la primera y el segundo la siguiente. Prueba en `PRUEBAS.html` (dentro de «primero el archivo…») y escenario SR-CADENA en el banco; los dos fallan con la copia de antes (`etapa3/pre_cadena`).
- **D5 en cuadrillas, sin corregir.** Instalar, devolver o «Corregir» quitan las filas en 0 de la cuadrilla, también los puentes. La siguiente entrega con el nombre viejo vuelve a crear la fila. Es la poda de filas en 0 de la Etapa 4.

### Pruebas

**`PRUEBAS.html`: 171 pruebas** (52 de INVENTARIO, 86 de OFICINAS, 32 de RED y 1 de Firma). Las 10 nuevas van en el grupo de INVENTARIO, después de las de la Etapa 2:

| # | Prueba | Qué comprueba |
|---|---|---|
| 1 | Un nombre con otro espaciado, mayúsculas o tildes entra a su fila; otro tipo u otra unidad no (R5) | `_claveArticuloInv`, `_claveSueltaInv`, `_unidadCompatibleInv`; `_filaParaEntrarInv` (exacto primero, la clave, nunca otro tipo, una vaciada va a su destino también en cadena, `cercanas`); `_normNom`; `_idFilaInv` (10.000 seguidos sin repetir y un choque forzado); la gemela de los consumos de TÉCNICOS, leída como texto. Revisión: dos filas exactas en m y en Und |
| 2 | Lo que llega por nombre entra a su fila en todos los caminos, y la fila nueva lleva un código que no choca | `integrarRecuperado` (por la clave sin preguntar; la ventana; escoger, crear, cancelar; ya integrado; `rid` con la lista corrida), `procTrans`, `_devolverVentaABodega`, `saveBodegaImport`, «📦 + Material», `saveEntregaLogic` con una transacción falsa; `modalRetiroParcial` y `modalDevolverMat` corridos. Revisión: «crear» con la fila aparecida; `rep` al rechazar un traslado y en la entrega |
| 3 | Cada botón actúa sobre SU fila aunque comparta el código con otras (pendiente 1 de la Etapa 2) | La llave y su escape; los cinco botones de la 2.ª hermana, con un clic real; ✕, ✏️, 📥, ➕ SN y 📋 sobre la fila correcta; `approveEdit` y `approveDelete`; seriales entre hermanas. Revisión: con solo la hermana, los cinco botones avisan y nada cambia; ➕ SN y ✏️ sobre una fila unificada con la ventana abierta; la etiqueta con un serial; D4 |
| 4 | Lo que se escoge en una lista es lo que se descuenta | Entrega y traslado de la 2.ª hermana; venta, dotación, instalación y equipo a cliente con un snapshot que corre la lista; un serial que ya no está → nada; cambio de equipo. Revisión: los renglones guardan `rep`, y no se descuenta nada si quedó sola la hermana |
| 5 | La fusión con códigos repetidos ya no duplica un artículo ni le pasa el cambio al vecino | Los casos A a E del mapa de la fusión; con ids únicos, igual que antes |
| 6 | TÉCNICOS (leído como texto): devolver material toma la fila elegida, nunca la del otro tipo | `_filaDevolucionTec`, extraída y corrida. Revisión: `idRepetido` (VERDES y AZULES), la familia de unidad, y `_confirmarDevolverMaterial` corrido con la hermana sola en la nube: no escribe y avisa |
| 7 | 🧩 Unificar: la que queda suma cantidades y seriales; las demás se vacían y apuntan a ella, y nada se cuenta dos veces | Grupos, bloqueos, el plan (`stockMin` 0, ninguna lápida, P adelante), `_destinoUnificadaInv`, ningún «stock bajo» de una vaciada, la repetición (metió, sacó, sin tocar, A ya quitada, no cambia lo que recibe), la lápida «unificar». Revisión: D2 (P = 8 + (5 − 8) = 5) y el oyente real con una pantalla atrasada (17, sin anulación ni «volvió») |
| 8 | 🧩 Segunda revisión: la hermana que comparte el código no se toca, y el oyente da lo mismo que el guardado | Los tres hallazgos de la segunda pasada, por el oyente (`_unirTumbasFilaEnEntranteInv` y `_protegerSnapshotInv`) y por el guardado (`_fusionarConNubeInv`), y `_tfSaltarPorUnificarInv` y `_reaplicarUnificacionesInv` por separado: P=8 con el borrado de la hermana sin anular; 5 conectores sin anular la lápida de «Corregir»; P=5 (antes 15) |
| 9 | 🧩 Unificar: primero el archivo, después la transacción; si algo cambió o hay algo pendiente no se unifica nada | El orden (preparada → relectura → transacción → hecha), el fallo de cada paso, un bloqueo que aparece después, el modo prueba, el registro y la 🛡️, el 🧹. Revisión: el `leerPanel` de verdad, D1, D3, la pantalla anterior con el anuncio atrasado, el archivo pisado (al marcar «hecha» y «cancelada»), el hallazgo 11 y D5 (el puente no se quita; después del 🧹, «ONU VIEJA Q» sigue entrando a ONT Q y no se crea ninguna fila) |
| 10 | «Ver vacías»: las filas en 0 sin seriales se esconden solo en la pantalla de Bodegas | `_filaOcultableInv`; la casilla; «En cero»; el mínimo de la fila o de su referencia; la búsqueda; la preferencia por bodega; los totales iguales. Revisión: una sola lectura del Catálogo por sesión |

- Todas usan ids inventados que empiezan por `E3P`. Sustituyen `alert`, `confirm`, las ventanas, `_fbSave`, las transacciones y el archivo, y lo devuelven todo en un `finally`, también el navegador (con `e2FotoLS` y `e2RestaurarLS`) y la clave `inv_ver_vacias:*`. Exigen que `_escriturasBloqueadas` no crezca.
- **Prueba vieja adaptada:** «Etapa 6 · El panel marca las pantallas viejas…» contaba `leerPanel(` y exigía que solo estuviera en `verPantallasInv`. Con D3 también lo lee `_unificarMarcadosCoreInv`. Ahora acepta las dos, y exige que a `_unificarMarcadosCoreInv` solo la llame `unificarMarcadosInv`, y a esta solo su botón. La intención sigue: el panel solo lo lee un botón, nunca al pintar.
- La prueba del celular (375 px) recorre Bodegas y Auditoría: la casilla, el botón y la ventana caben.

**Corrido el 13 oct 2026, con el archivo final**, sobre la base SIMULADA del banco, sin servidor, con el arnés de la Etapa 2 (`correr_e2.js`):
- `PRUEBAS.html` completo (INVENTARIO, OFICINAS y RED; Firma no se abre): 170 corridas de 171, **169 bien**. Falla solo «Rastreador v314: la ficha de una factura REAL de WispHub», que necesita WispHub de verdad, como en las etapas anteriores. 0 errores de página, 0 escrituras en la base simulada y el navegador limpio. El grupo de INVENTARIO: 52 de 52.
- **Contrapruebas:** con INVENTARIO y TÉCNICOS de antes de la primera revisión (`pre_rev`), el grupo da 43 de 51: fallan las 8 pruebas «Etapa 3 ·» que ganaron comprobaciones en esa revisión (todas menos la de la fusión), cada una solo en sus comprobaciones nuevas. Con la copia de antes de la segunda (`pre_rev2`) falla solo la prueba nueva de la segunda revisión (sus 6 comprobaciones). Sin D5 falla solo la comprobación de D5. Cuatro copias con un arreglo quitado cada una (los tres de la segunda pasada y el aviso del hallazgo 11) fallan cada una en su comprobación.
- **Con el reloj movido** (en la primera revisión), «primero el archivo…» pasa el 1, 2, 3, 4, 5, 7, 8, 9, 15 y 20 de enero de 2027, el 31 de diciembre de 2026 y el 1 de marzo de 2027. Las demás pruebas «Etapa 3 ·» y la del panel de la Etapa 6 pasan el 2, el 5 y el 8 de enero.

**El banco** (`inv/etapa3.js`, base simulada y compartida, las apps reales en Chromium; TÉCNICOS solo se abre ahí):

| Grupo | Escenarios |
|---|---|
| R5 y las filas | R5b, R5c, R5d, E3-1 a E3-4 y E3-T |
| 🧩 Unificar | U1 a U11 |
| «Ver vacías» | V1 y V2 |
| Primera revisión | RV-REP, RV-CREAR, RV-UNID, RV-VAC, RV-U9b, RV-ARCH, RV-VOLVIO, RV-D2, RV-D4, RV-ETIQ, RV-FREN, RV-CAT y RV-TEC |
| Segunda revisión | SR-D5, SR-HERM, SR-SINP, SR-D2H y SR-CADENA |

- Con el archivo final: **39 pasan, 0 fallan** (220 s, 0 errores de JavaScript). SR-CADENA falla con `pre_cadena` (13 comprobaciones).
- **Contrapruebas:** con `--v116` (lo publicado) fallan los 21 primeros, cada uno por lo esperado. Con `pre_rev` fallan los 13 RV y U9. Con `pre_rev2` fallan SR-HERM, SR-SINP y SR-D2H (10 comprobaciones). SR-D5 pasa con `pre_rev2` porque esa copia ya tenía D5; falla con una copia sin D5 y con `pre_rev` (13 comprobaciones cada una).
- **`--reloj=AAAA-MM-DD`** mueve el reloj de Node, de la nube simulada y de las pantallas, en hora de Colombia. Con él se vio que U7, RV-ARCH y RV-FREN fallaban solos del 1 al 8 de enero: la marca envejecida caía en el año anterior, pero su entrada seguía en el archivo del año en curso. Ahora `envejecer8` lleva la entrada al archivo del año de la marca. Los tres pasan el 2, 5 y 8 de enero, el 8 de enero a las 23:30, el 9 de enero y el 15 de marzo de 2027. U* y RV* con el 5 de enero: 24 de 24.
- **Las demás suites:** con el archivo final, `etapa2` 25/25 y `revision_oct` **11/11**: R5 pasa por primera vez, y R6 sigue informativa (ahora sale la ventana y, sin respuesta, no se integra nada). `pantallas_unit` 216/216, `recarga_unit` 167/167, `etapa1` 16/16 y `etapa6` 13/13 en la segunda pasada, antes de sus arreglos, que solo actúan cuando la nube trae unificaciones. `repro` 21/21, `escenarios2` 20/20 y `unit_v112` 50/50 en la construcción y en la primera revisión.

**Comprobaciones propias** (scratchpad, funciones reales sacadas del archivo, sin red): `d5_res/d5_unit.js` 12/12 y `d5_res/c1/e5_d5.js`; `fix_rev/unit.js` 29/29; `verif_rev2fix/salto_unit.js` 7/7 y `d2_hermana.js` 6/6; `fix_hermana/prueba.js` 16/16, para TÉCNICOS. Las reproducciones de los revisores de la segunda pasada dan lo mismo que la copia que arregló el revisor.

**Validación:** `node .claude/validar.mjs` da sintaxis correcta en INVENTARIO (4 bloques), TÉCNICOS (2) y PRUEBAS (1). Los tres en CRLF, sin LF ni CR sueltos. `APP_VERSION_INV` sigue en 116 y `APP_VERSION_TEC` en 101.

**Corrida final, 13 oct 2026 (5:10 a 5:42 p. m.), con el archivo final** (ya con el arreglo de la cadena):
- **El banco completo**, en orden: `pantallas_unit` 216/216, `recarga_unit` 167/167, `unit_v112` 50/50, `revision_oct` **11/11** (R5 pasa), `repro` 21/21, `escenarios2` 20/20, `etapa1` 16/16, `etapa6` 13/13, `etapa2` 25/25 y `etapa3` **39/39**. Contraprueba: `etapa3 --v116` (lo publicado) **0 de 39**. Salidas en el scratchpad de la sesión (`etapa3/banco_final2/`).
- **`PRUEBAS.html` en el navegador contra la base real** (`?prueba=1`): **169 bien y 2 por revisar**, las dos «Estado real» de siempre (36 seriales en dos sitios; servicios de proveedores sin costo). La de la ficha real de WispHub pasa aquí. Después se miró la nube por REST (solo lectura): las escrituras de esa tarde en `inventario/datos` son de una bodega con la v116 publicada, y las de `main` y `logs_auditoria`, de una oficina con OFICINAS v320 enlazando comprobantes. Ninguna de las pruebas. En `inventario/datos` todavía no hay `_tumbasFila`: desde que se publicó la v116 nadie ha aprobado un borrado (sigue pendiente la comprobación de la §11).

### Pendiente

1. **Hecho el 13 oct 2026 (ver «Corrida final» abajo):** la corrida completa del banco con el archivo final, y `PRUEBAS.html` en el navegador contra la base real en `?prueba=1`.
2. **Decidir con Elkin:** las 9 decisiones y la de la Etapa 2 (ver «Decisiones de Elkin pendientes»).
3. **Etapa 4:**
   - quitar filas en 0 sin lápida (`modalDevolverMat`, `saveInstLogic`, «Corregir Cantidades»). Deja abierto el hueco del lado de la que queda: si una pantalla atrasada la quita, la fusión conserva la de la nube con la suma. SR-SINP solo exige que no se cuente dos veces y deja el valor exacto como información. También se lleva los puentes de D5 en las cuadrillas;
   - `modalDevolverMat` captura la fila al abrir la ventana y tiene un `return alert` dentro del `forEach`;
   - en cuadrillas, la etiqueta 🧩 y que «Corregir» no le suba la cantidad a una vaciada (duda 3 de la especificación).
   - **Resuelto en la Etapa 4** (sin publicar), los tres puntos: las filas en 0 de las cuadrillas ya no se quitan, tampoco los puentes, y W6 exige el valor exacto (1); ↩️ Devolver trabaja sobre lo recién leído, todo o nada, sin el `return alert` dentro del `forEach`; en 👷 Cuadrillas y en «Corregir» una vaciada lleva su etiqueta 🧩, y «Corregir» no deja cambiarla. Ver §13.
4. **Etapa 5:** seriales comparados letra por letra al escribir. En TÉCNICOS, `snesF.includes(sn)` de la devolución. En INVENTARIO, los `includes` al sumar seriales en `procTrans`, `_integrarRecuperadoEnInv` y `_devolverVentaABodega`.
5. **Las fichas de clientes con equipos mal cargados** («srv-profile_200» ×400, «CONECTORES MECANICO» ×1.401): cada retiro de esos clientes manda a la bodega un «equipo» que no existe. Limpiarlas en otra tarea. Mientras tanto, que DONCELLO revise los 10 u 11 «srv-profile_200» pendientes antes de integrarlos (ahora la ventana pregunta a qué artículo van).
6. **El archivo de unificaciones:** dos pantallas que marcan «hecha» exactamente a la vez todavía pueden pisarse. El arreglo completo es una transacción sobre `archivo_unificaciones_<año>`.
7. **Detalles:** el mensaje de 🧩 «…se quitan con 🧹 a los 7 días» no vale para los puentes. En el banco, la clave del archivo se calcula una sola vez: una corrida que cruce la medianoche del 31 de diciembre fallaría en falso en U1, U4 y U9.
8. **Publicada el 13 oct 2026** (Elkin: «me parece bien asi como lo manejaste, publica»: aprobó las 9 decisiones tal como se construyeron, y la de la Etapa 2 queda como está, «aprobada · duplicada»). Commit `fc8ce5c`, INVENTARIO 117 y TÉCNICOS 102. Respaldo en `_RESPALDO_2026-10-13_antes_de_publicar`. Mantenimiento solo de INVENTARIO y TÉCNICOS de 7:25 a 7:28 p. m.; push 7:27, Pages con los dos archivos nuevos a las 7:28 (huellas iguales a las del disco, dos veces), versiones anunciadas 7:28, prueba de humo de INVENTARIO en `?prueba=1` sin errores (TÉCNICOS no se abre en el navegador: se comprobó por su huella y su versión publicada). Al publicar no había técnicos ni bodegas conectados; solo una OFICINAS y una INVENTARIO 116 de admin, ocultas, que se recargan solas al volver. Lo que se planeó para este paso:
   - INVENTARIO 117 y TÉCNICOS 102 **juntos**, fuera de horario, con el respaldo de datos de la Etapa 1 antes;
   - recargar todas las pantallas de bodega: una v116 no tiene la fusión nueva ni la repetición;
   - los técnicos verán «actualizar». Hasta que actualicen, su devolución sigue como en la v101;
   - **🧩 se usa después**, cuando «📺 Pantallas abiertas» no muestre ninguna INVENTARIO menor a 117, caso por caso con Elkin y empezando por las bodegas. Antes, revisar con las bodegas los tres Patch Cord de DONCELLO (las observaciones dicen colores distintos: mejor cambiarles el nombre que juntarlos), los módulos SFP «…243SI» y «…243S» de FLORENCIA, y la OLT de FLORENCIA, cuyas dos filas tienen los mismos 2 equipos;
   - probar un caso real: integrar un recuperado escrito con otro espaciado, tocar un botón de una fila con el código repetido y que un técnico devuelva un equipo que tiene como nuevo y como usado.

## 13. Etapa 4 — lo que se hizo (publicada el 16 oct 2026)

Especificada, construida y revisada el 14 y 15 oct 2026, sobre lo publicado en `fc8ce5c` (OFICINAS v320, INVENTARIO v117, TÉCNICOS v102, RED v44), a pedido de Elkin: «continuemos». **No está publicada** y la versión no se subió: al publicar, INVENTARIO pasa a 118, **solo**. TÉCNICOS, OFICINAS y RED no cambian. Las pruebas no escribieron nada en la base real: solo se leyó, con GET y sin copiar datos personales.

Elkin todavía no respondió las 15 decisiones de la especificación: se construyó lo recomendado (ver «Decisiones de Elkin pendientes»).

**Cómo se hizo.** Primero se midieron los datos reales (solo lectura) y se armaron cuatro mapas: las ventanas, las podas de filas en 0, las pruebas y el cruce con las otras apps. Con eso se escribió una especificación, que revisó una crítica adversaria (H1 a H16). Después vinieron las piezas comunes (C0) y cinco partes en paralelo, cada una en su copia: C1 ↩️ Devolver, C2 las filas en 0 y 👷 Cuadrillas, C3 la ficha del cliente, C4 cuadrilla, técnico y dotación, y C5 herramientas y solicitudes. Se juntaron sin ningún conflicto: cada función tenía un solo dueño. Al final, dos revisiones adversarias y sus arreglos (ver «Revisión adversaria»). Lo que sigue es lo que quedó, ya con esos arreglos. La especificación, los mapas y las copias de cada paso están en el scratchpad de la sesión (`etapa4/`).

**Lo que dijeron los datos (14 oct, solo lectura; la base del 13 oct):**
- `inventario/datos` pesa 512,5 KB, el 50 % de 1 MiB. No hay `_tumbasFila` ni filas vaciadas por 🧩: 🧩 todavía no se usa.
- El 13 oct hubo 30 escrituras en `inventario/datos` en 6,8 h (17 de INVENTARIO y 13 de TÉCNICOS). Cada una pone objetos nuevos en `DB` en todas las pantallas. Una ventana abierta 2 minutos recibe un cambio de otra pantalla 1 de cada 3 veces en la hora pico, y 1 de cada 7 en promedio.
- Las 6 cuadrillas tienen 126 filas: 37 en 0 sin seriales y 1 en 0 con serial («TV BOX  TL618», CUADRILLA A CARTAGENA DEL CHAIRA). La siguiente devolución o instalación desde INVENTARIO en esa cuadrilla la habría borrado con su serial.
- Sin podar, las cuadrillas sumarían de 16 a 26 filas en 0 al mes (2–3 KB), con techo: una fila en 0 se reutiliza cuando el artículo vuelve.
- 38 clientes usaron ➕ Equipos y 9 tienen traslado. 8 clientes tienen dos equipos con el mismo nombre y tipo: un equipo no se puede buscar solo por su nombre. No hay ventas abiertas.

### Qué quedó en cada archivo

| Archivo | Qué cambió |
|---|---|
| `INVENTARIO_PTOVISION.html` (de 16.089 a 16.928 líneas) | La regla de la etapa en todas las ventanas que mueven stock o escriben en una cuadrilla, un técnico o un cliente: ↩️ Devolver en una transacción (C1); las filas en 0 que se quedan y «Ver vacías» en 👷 Cuadrillas y en «Corregir» (C2); la ficha del cliente (C3); cuadrilla, técnico y dotación (C4); 🔧, aprobar una edición, ✏️ del admin, ventas y traslados (C5). Las piezas comunes van en el bloque «Etapa 4 (docs/12, C0)», justo antes del de «Etapa 2 (docs/12, C1)». Debajo, un bloque por parte, cada uno con su ancla «Etapa 4 · Cn: funciones nuevas (debajo)». Las funciones de siempre que cambiaron llevan el comentario «Etapa 4 (Cn)»; los arreglos de las revisiones, «Revisión de la Etapa 4» o «Revisión 2 de la Etapa 4». También se puso al día el comentario de 🧩 de la Etapa 3 (su cabecera y la del 🧹): las cuadrillas ya no pierden sus puentes |
| `PRUEBAS.html` (de 10.693 a 12.278 líneas) | 7 pruebas nuevas en el grupo de INVENTARIO (178 en total) y 5 viejas adaptadas |
| Banco (`_PRUEBAS_SIMULADAS_2026-10-09/trabajo`) | `inv/etapa4.js`, nuevo (2.405 líneas): 70 escenarios, con `--v117`, `--html=`, `--tec=`, `--reloj=` y los grupos `'W*'`, `'RV*'` y `'R2*'`. `inv/etapa2.js`: `inv117()` y F1 rehecha. `inv/etapa3.js`: `inv117()`, la opción `sinPantallas`, la espera `listadoQuieto` y 8 escenarios adaptados |
| TÉCNICOS, OFICINAS, RED | Sin cambios. TÉCNICOS ya dejaba las filas en 0 y las escondía (filtra `cantidad>0`). OFICINAS y RED solo leen `inventario/*`: las bodegas por id y nombre, y OFICINAS los bloques de clientes para mostrarlos |

### La regla de la etapa y las piezas comunes (C0)

Cada escritura en `inventario/datos` o en un bloque de clientes pone **objetos nuevos** en `DB`, venga de otra bodega, del admin o del celular de un técnico, aunque haya tocado otra cuadrilla: el oyente hace `Object.assign` con copias, y los clientes entran con `DB.clientes = all`. Una ventana que guardó al abrirse la cuadrilla, la fila, el técnico o el cliente escribía después sobre objetos sueltos: lo escrito se perdía sin aviso, o quedaba a medias (el stock se movía y el cliente no).

La regla, en todas las ventanas:
1. **Llaves, no referencias.** Al abrir se guardan ids, la llave de la fila de la Etapa 3 (con `rep`), la huella de un equipo o de un elemento de dotación, y lo que la ventana muestra.
2. **Lo de ahora.** Al guardar, todo se busca por su llave en la `DB` de ahora, o en lo recién leído dentro de una transacción.
3. **Cambios, no valores de antes.** Se aplica lo que la persona tocó, o la diferencia, no los valores que se vieron al abrir.
4. **Todo o nada.** Si lo que mostraba la ventana ya no está o cambió, no se guarda nada y se avisa en español. Primero se valida todo, después se escribe.

Además, **ninguna operación quita filas por quedar en 0** (ver «Las filas en 0 que se quedan»).

C0 son dos funciones y las anclas. `_msgVentanaViejaInv(que, porque)` arma el aviso de siempre: «⚠️ X cambió mientras tenías la ventana abierta (porque). No se guardó nada. Vuelve a abrir la ventana para trabajar con lo de ahora.». `_avisoVentanaViejaInv(que, porque, tab)` cierra la ventana, repinta la pestaña y avisa, sin tocar datos. Las cinco anclas van en INVENTARIO, en PRUEBAS y en el banco.

### ↩️ Devolver material de cuadrilla (C1)

**Antes**, la ventana guardaba al abrirse la cuadrilla, sus filas y la bodega, y descontaba y sumaba sobre esos objetos. Con cualquier escritura de otra pantalla de por medio (basta el consumo de un técnico) no se movía nada, pero el registro decía «Devolución: N uds» y el kardex anotaba una entrada que no ocurrió. Si solo una de las dos partes seguía viva, el material quedaba contado dos veces. Además:
- el aviso de los seriales iba dentro del `forEach`: devolvía los demás renglones y cerraba; al repetir, el cable salía dos veces;
- una cantidad mayor que la disponible se saltaba callada;
- dos pantallas podían devolver el mismo serial, y quedaba dos veces en la bodega;
- quitaba todas las filas en 0 de la cuadrilla, también una con serial y los puentes de 🧩.

**Ahora** (`modalDevolverMat`):
- **Al abrir, la foto:** la llave de cada fila (`_llaveDeFilaInv`), lo que se ve y la bodega de la cuadrilla. Si la cuadrilla ya no está, aviso y la lista de ahora. Todo va escapado con `_catEsc`, y una vaciada que volvió a tener material lleva su etiqueta 🧩. Los ids de los campos (`dev_<idx>`, `.devSN_<idx>`) y `updateDevSNs` no cambian.
- **Al Guardar, primero lo escrito contra la foto**, sin tocar nada. Una cantidad no válida, mayor que lo disponible o con los seriales marcados que no cuadran sale en **un solo** aviso («⚠️ No se devolvió nada. Corrige esto y vuelve a guardar: …»), y la ventana sigue abierta.
- **Sin señal no se devuelve:** «📴 Sin internet no se puede devolver material: se guarda en un solo paso contra la nube…», con la ventana abierta. Antes parecía guardar y a veces se perdía.
- **Una transacción** (`_fbTransaccionInv`, como la Entrega) relee la nube. `_planDevolucionInv(datos, pedido)` valida **todo** sobre lo recién leído: la cuadrilla, su bodega, cada fila por su llave (`_filaElegidaInv`, con `rep`), las cantidades sumadas por fila y cada serial. Si algo no está o no alcanza, no devuelve nada: «❌ No se devolvió nada: la cuadrilla cambió mientras tenías la ventana abierta. • …». Si todo cuadra, baja la cuadrilla y sube la bodega en la fila que da `_filaParaEntrarInv` (con el nombre de la fila de ahora, como TÉCNICOS 102) o en una fila nueva. El kardex se escribe dentro de la misma transacción (`_lineaKardexInv`, el formato de `registrarMovimiento`). La transacción escribe solo `bodegas` y `cuadrillas`.
- **Después del commit,** la memoria se pone al día con `_aplicarNubeParcialInv`, como un snapshot: no pisa lo que la pantalla tenga sin guardar. Recién ahí va el registro («Devolución: N uds de "cuadrilla" → "bodega"»). Si el registro fallara, la ventana se cierra igual: otro Guardar devolvería dos veces.
- **Un doble clic** mientras corre la transacción no hace nada (`window._devolviendoInv`, dentro de `try…finally`).
- **Un aviso de más, no pedido:** si la ventana no mostró seriales en una fila y ahora tiene, «"X": ahora tiene seriales en la cuadrilla (otra pantalla los agregó): hay que marcar cuáles devuelves.».
- Una fila que 🧩 unificó con la ventana abierta: «"X": Este artículo se unificó en "P". Devuélvelo desde "P".», y nada (duda 1 de la especificación).
- `_errorNubeTxtInv(e)` pasa a español el error de la nube: modo prueba, sin conexión, el choque con otra pantalla. Si no, el mensaje tal cual.

**La respuesta perdida: el devId (primera revisión).** Si el commit entra y la respuesta se pierde, Firestore repite la transacción, o la persona vuelve a pulsar Guardar. Antes el cable salía dos veces, o un serial decía «ya no está» y el aviso «No se devolvió nada» cuando sí se había devuelto. Ahora:
- cada ventana crea un `devId` al abrirse (`dev` + la hora en base 36 + 4 letras o cifras al azar), el mismo en todos sus Guardar;
- cada línea de kardex de la devolución lleva `ref: devId`;
- si la bodega recién leída ya tiene una línea con ese `ref` (`_devolucionYaEnBodegaInv`), `_planDevolucionInv` da `yaHecha` y la transacción no escribe nada. La memoria toma lo leído y queda un solo registro;
- con un error del que no se sabe si el commit llegó (`_errorNubeInciertoInv`), ya no sale «No se devolvió nada» sino «⚠️ No se pudo confirmar si la devolución quedó guardada… vuelve a pulsar Guardar cuando haya señal. Si ya había quedado guardada, no se devuelve dos veces.», con la ventana abierta;
- la marca vive en el kardex, que guarda 50 líneas por fila. Cubre el reintento en el acto y el siguiente Guardar de la misma ventana, no una repetición días después. La forma de las cuadrillas no cambia.

Lo que dice cada aviso después de un «no se pudo confirmar» se afinó en la segunda revisión (ver «Segunda revisión»).

### Las filas en 0 que se quedan (C2)

**Por qué la opción a.** Hasta la v117, tres sitios quitaban **todas** las filas en 0 de la cuadrilla, no solo las que tocaban: ↩️ Devolver, la instalación (`saveInstLogic`) y «Corregir Cantidades», esta con lápida `'corregir'`. Si una operación bajaba una fila a 0 y la quitaba en el mismo paso, y otra pantalla le había cambiado algo a esa fila, la regla de la fusión («quitada en un lado y cambiada en el otro se conserva») dejaba la fila de la nube **con la cantidad de antes**: lo devuelto o instalado volvía a la cuadrilla. Medido con las funciones reales (mapa de podas):

| Caso | Correcto | v117 | (b) quitar con lápida | (a) dejar en 0 |
|---|---|---|---|---|
| Saco 2 de una fila que tenía 2; en la nube entró 1 | 1 | 3 | 3 | 1 |
| Igual, pero la nube solo cambió la categoría | 0 | 2 | 0 | 0 |
| «Corregir» 5 → 0; entran 2 antes del guardado | 2 | 7 | 7 y «volvió…» | 2 |
| Instalé las 2; una pantalla atrasada tocó la fila y guarda después | 0 | 2 (lo instalado vuelve) | depende | 0 |
| SR-SINP: una pantalla atrasada instala los 3 de P y usa 1 de A; en la nube 🧩 dejó P en 5 | 1 | 5 | 5 | 1 |

Con la fila en 0, la fusión fina hace `max(0, nube + (aquí − base))` y el número sale exacto en todos los casos. Ya lo hacían TÉCNICOS (que las esconde) y la confirmación de consumos. La opción (b) no sirve: la lápida se anula cuando entra material (regla de la Etapa 2), queda la fila de la nube como hoy y sale un aviso falso «volvió…».

Efectos:
- Los puentes y eslabones de 🧩 (D5) ya no se pierden en las cuadrillas: solo los quita el 🧹 de la Etapa 3, con sus reglas. Era el dudoso «D5 en cuadrillas» de la Etapa 3.
- Se cierra el hueco del lado de la que queda (dudoso 2 de la Etapa 3): con P en 0 en la memoria, `_unifRepetibleInv` la encuentra, la repetición corre y la fusión da lo exacto (W6 exige 1). D2 se queda, porque una pantalla v117 sigue podando hasta recargarse.
- Los códigos de las filas ya no cambian con cada entrega: la fila en 0 se reutiliza cuando vuelve el artículo.
- Costo: 2–3 KB al mes en `inventario/datos`, con techo.

**Qué cambió:**
- `saveInstLogic` ya no filtra `cantidad > 0`.
- «Corregir Cantidades» (`modalCorregirCantCuad`) ya no quita filas ni deja lápidas `'corregir'`. Las que ya existen, o las que suba una pantalla v117, siguen valiendo; `_antesCorregirTFInv` se queda (Etapa 2). El pie de la ventana dice: «Un artículo que dejes en **0** se queda en la lista en 0 (se esconde con «Ver vacías»)…».
- ↩️ Devolver no quita nada (arriba).

**«Corregir» y las vaciadas.** Una fila vaciada por 🧩 sale con su etiqueta y con sus casillas deshabilitadas. Si se le fuerza un valor, o si 🧩 la vació con la ventana abierta: «⚠️ "X": Este artículo se unificó en "P". Corrige "P". No se corrigió nada.», y nada. Antes «Corregir» dejaba subirle la cantidad (el riesgo «Cuadrillas» de la Etapa 3). Una fila escondida o unificada que el admin no tocó ya no pasa por la validación de la ventana (ver «Lo que se apartó…»).

**«Ver vacías» en 👷 Cuadrillas y en «Corregir».** Es la decisión 2, y cambia la decisión 8 de la Etapa 3, que las escondía solo en Bodegas:
- La cabecera de 👷 lleva la casilla «Ver vacías (N)». Apagada (lo de siempre al entrar), no se pintan las filas que `_filaOcultableInv` da por escondibles: en 0 y sin seriales reales, o vaciadas por 🧩 en 0. Debajo de cada tabla va la nota de Bodegas («🙈 k artículo(s) vacío(s) oculto(s).»), o «Sin artículos con stock (k vacío(s) oculto(s)).» en lugar de la tabla.
- Las negativas, las de 0 con seriales y las vaciadas que volvieron a tener material se ven siempre. El total «uds» suma todas.
- La preferencia es de cada bodega (y del admin), con su propia clave: `localStorage['inv_ver_vacias_cuad:admin']` o `['inv_ver_vacias_cuad:bod_<id>']`. Nunca va a la base. Si el navegador no deja guardar, vale para esa pestaña. Al cambiarla, la cuadrilla que se estaba mirando sigue abierta.
- En «Corregir», las mismas filas se esconden según la preferencia de 👷. La casilla «Ver vacías (k)» de la ventana las muestra y esconde sin repintar ni guardar. Los ids `corr_<idx>` siguen siendo la posición.
- De paso, 👷 escapa los nombres, tipos, unidades y seriales (antes iban sin escapar, y la base se escribe desde internet), y cada nombre lleva su etiqueta 🧩.
- Funciones nuevas: `_claveVerVaciasCuadInv`, `_verVaciasCuadInv`, `_alternarVerVaciasCuadInv`, `_tablaMaterialCuadInv` y `_corrVerVaciasInv`.

**TL618.** La fila en 0 con serial se queda y se ve siempre, porque tiene un serial. La 🩺 Auditoría la sigue mostrando, y corregirla es de la Etapa 5. Ojo: mientras siga así, «Corregir» de **cualquier** otra fila de esa cuadrilla avisa «deja como máximo 0 serial(es) marcados o sube la cantidad», porque la validación de siempre mira todas las filas visibles. El admin tiene que resolverla primero: subirla a 1 o desmarcar el serial (dudoso 1 de la primera revisión).

### La ficha del cliente: el cliente de AHORA (C3)

Las seis ventanas (➕ Equipos, 🚚 Traslado, 🔄 Cambio de equipo, ↩️ Retiro parcial, 🔴 Retiro del cliente y ✏️ Editar) guardaban al abrirse el cliente, y el equipo por su posición. Los clientes no tienen fusión: el bloque que cambia entra entero. Con un bloque nuevo de por medio, el equipo salía del stock y no llegaba al cliente, o entraba a la bodega y seguía en el cliente (contado dos veces). El retiro del cliente lo metía dos veces.

**La huella.** Los equipos no tienen id. `_huellaEqCliInv(eq)` es el nombre (la clave), el tipo, la cantidad y los seriales ordenados. `_clienteVivoInv(id)` da el cliente de ahora (sin id, ninguno). `_eqClienteVivoInv(cl, pos, huella)` da el equipo de esa posición si tiene la huella; si no, el primero con ella.

**Ventana por ventana.** En todas, primero se resuelven el cliente y el equipo de ahora y se valida todo, también la bodega o la cuadrilla de destino (antes daba `TypeError` si ya no estaba). Después se escribe. Si algo no cuadra, nada:
- **↩️ Retiro parcial y 🔄 Cambio de equipo:** si ese equipo cambió, «⚠️ "X" en la ficha de "Y" cambió mientras tenías la ventana abierta (otra pantalla lo movió). No se guardó nada…». El retiro quita el equipo por objeto (`splice(indexOf(eqV))`), ya no por la posición de cuando se abrió. En el cambio, tampoco se anota `equiposDanados`.
- **➕ Equipos:** como solo agrega, se anota en el cliente de ahora aunque sus equipos hayan cambiado.
- **🚚 Traslado:** si se marcó algún «📦 Se retira» y los equipos activos cambiaron, aviso y nada. Sin retiros se aplica igual. La cuadrilla instaladora solo se escribe si se cambió en la ventana.
- **🔴 Retiro del cliente:** «⚠️ Ese cliente ya lo retiraron en otra pantalla. No se hizo nada.». Si sus equipos activos cambiaron, aviso y nada: nunca dos ONU en la bodega.
- **✏️ Editar cliente:** se escribe solo cada campo que cambió en la ventana (la foto es `TempLists.cliAbrir`). Los equipos: si no se tocaron, quedan los de ahora (una ONU que otra pantalla retiró no vuelve); si se tocaron y además cambiaron en otro lado, aviso y nada. **Cambio visible:** un cliente sin fecha de instalación ya no queda con la fecha de hoy si no se toca ese campo.
- Un cliente que ya no está: «⚠️ Ese cliente ya no está (otra pantalla lo retiró). No se guardó nada.», sin `TypeError`.
- El nombre del cliente solo va en los avisos de pantalla, nunca a un campo nuevo.

**Los botones de una lista vieja.** Cada fila de «Equipos Activos» lleva su huella (`data-eqh`), y 🔄 y ↩️ la pasan como tercer argumento (`_huellaEqDeBotonInv(this)`). El botón de un equipo que ya no está avisa «⚠️ Ese equipo cambió en la ficha del cliente… Te muestro la lista de ahora.». El de uno que cambió de posición abre **ese** equipo; antes abría otro, o nada. Con dos argumentos, como siempre.

**Los gemelos (primera revisión).** Dos equipos sin serial con el mismo nombre, tipo y cantidad tienen la misma huella. ↩️ o 🔄 sobre uno que otra pantalla ya retiró actuaba sobre el otro: entraba dos veces a la bodega y el cliente quedaba sin él. Ahora la ventana cuenta al abrir cuántos tienen esa huella (`_cuantosHuellaCliInv`), y `_eqClienteVivoInv` recibe ese número como 4.º argumento: si al guardar hay menos, aviso y nada, aunque la posición coincida. Con un botón de una lista vieja, `_huellaEqDeBotonInv` anota cuántas filas de esa lista tenían la huella (`window._botonEqInv`), y `_nHuellaBotonInv` lo toma una sola vez, solo para esa huella y solo durante 2 s. Límite: si otra pantalla movió el **otro** gemelo, esta también avisa, porque no hay forma de saber cuál se movió.

**Confirmar un consumo** (`_confirmarConsumoElegidos`; no se tocan `_planConsumoInv`, `_aplicarUnidadesInv` ni `_partirItemsInv`):
- **W22, la ficha de ahora.** La ficha se buscaba antes de la transacción y se anotaba después, sobre ese objeto. Si en ese segundo llegaba el bloque de clientes, el material no quedaba en la ficha, pero el consumo ya decía `materialAplicadoCliente:true` y «🔄 Sincronizar material con clientes» no lo repetía. Ahora, después del commit, la ficha se vuelve a buscar y se anota en ella. Si el cliente se retiró mientras tanto: «⚠️ El cliente "X" se retiró del inventario mientras se confirmaba: el material no quedó anotado en su ficha.», y el registro ya no dice «anotado en ficha» cuando no se anotó. Queda un hueco justo después del commit (ver «Pendiente»).
- **W25, el serial escogido.** Si la bodega escogió un serial en `.ccEscoger` y, con la ventana abierta, otra pantalla lo movió, antes se confirmaba igual: el consumo decía que el equipo quedó instalado y el serial seguía en otro sitio. Ahora una guarda dentro de la transacción, antes de `_aplicarUnidadesInv`, lo mira sobre lo recién leído: «Mientras revisabas, la cuadrilla cambió… • El serial S que escogiste ya no está en la cuadrilla. Vuelve a abrir el consumo.». No se confirma nada y el consumo sigue pendiente.

### Cuadrilla, técnico y dotación (C4)

✏️ Editar cuadrilla, ✏️ Editar técnico, 📦 Directo y 🗑️ de la dotación guardaban al abrirse la cuadrilla y el técnico. Cualquier escritura de otra pantalla los dejaba sueltos y lo escrito se perdía sin aviso. Eso incluía la bodega de la cuadrilla (de ella dependen las devoluciones) y la cédula del técnico (con ella TÉCNICOS encuentra su cuadrilla). Quitar de la dotación iba por posición: con la lista corrida se quitaba **otro** elemento.
- Al abrir se guarda lo que muestran los campos (`_camposVentanaInv`). Al guardar, la cuadrilla y el técnico se buscan por id en la `DB` de ahora (`_cuadrillaDeAhoraInv`, `_tecnicoDeAhoraInv`), y se escribe **solo lo que la persona cambió** (`_camposTocadosInv`): un campo que otra pantalla cambió mientras tanto se conserva. Sin cambios, solo se cierra la ventana, sin guardar ni registrar. Un nombre vacío no se escribe, como siempre.
- 📦 Directo agrega a la dotación del técnico de ahora.
- **🗑️ de la dotación, por huella.** `_huellaDotInv(d)` junta el id, el nombre, la cantidad, el tipo, la unidad, la categoría, la fecha, si es directo y los seriales. El id solo no basta, porque `addDotItem` copia el de la fila. 👁️ pinta la huella en cada fila (`data-dot`) y 🗑️ la pasa como 4.º argumento: `delTecDotItem(cId, tId, idx, el)`. Si ese elemento ya no está: «⚠️ Ese elemento de la dotación cambió (otra pantalla lo modificó). Te muestro la dotación de ahora.». Sin el 4.º argumento, por posición, como siempre.
- Una cuadrilla o un técnico que ya no están: aviso y nada, también al abrir (antes `TypeError`). Todo va escapado con `_catEsc`.
- **🎒 Dotar** (`saveDotacionLogic`): si la cuadrilla o el técnico ya no están, «⚠️ La cuadrilla o el técnico ya no están (otra pantalla los quitó mientras armabas la dotación). No se descontó nada.». Antes descontaba el primer renglón y fallaba.
- Cambios visibles menores: un receptor vacío ya no se muestra como «undefined», y una bodega que no está en la lista ya no se cambia sola por la primera al guardar otro campo.

### 🔧 Seriales en dos sitios (C5)

`window._snReps` guardaba **referencias** a los registros y las filas. Con un snapshot de por medio, los botones no cambiaban nada (o una parte), y aun así el registro decía «dejado solo en…» y el aviso «✅ Resueltos n de m». Es la herramienta que va a usar la Etapa 5.
- `modalSerialesRepetidos` guarda además, por sitio, `col`, `regId` y la llave de la fila.
- `_sitiosSNVivosInv(k, sitios)` vuelve a recorrer las bodegas y cuadrillas de ahora y compara la firma de cada sitio (`_firmaSitioSNInv`: registro, código, nombre y tipo). Si son los mismos, devuelve los de ahora; si no, `null`.
- `_dejarSNSoloEn`: si el serial cambió de sitio, «⚠️ El serial S cambió de sitio mientras tenías la ventana abierta (otra pantalla lo movió). No se cambió nada. Te muestro la lista de ahora.», sin registro. Si no, `_aplicarSNSoloEn` (sin cambios) sobre lo de ahora, con registro y guardado solo si de verdad cambió algo.
- `_resolverSNConPrueba` cuenta lo resuelto de verdad: «✅ Resueltos n de m.» y, si hubo, «⚠️ k cambiaron mientras tenías la ventana abierta y no se tocaron.». Con 0: «No se cambió nada…». Nunca «✅» sin cambio.
- Hacerlo en una transacción y comparar los seriales normalizados al escribir queda para la Etapa 5.

### Aprobar una edición: solo lo que la bodega cambió (C5)

`approveEdit` hacía `Object.assign(m, req.datos)`: todo en absoluto, también la lista de seriales que armó la bodega al pedir. Un serial que entró después se perdía y uno que salió volvía, y quedaba en dos sitios. Avisaba si había cambiado la cantidad, no si habían cambiado los seriales.

**Lo que mostraba el formulario.** `modalEditMat` toma, después de abrir la ventana, lo que muestran sus campos (`_vAbrir`), con la misma lectura que el Guardar. Hace falta porque los `<select>` no muestran todos los valores de la base: una fila con unidad «mts» sale como «Unidad» y un tipo vacío como «Nuevo» (crítica H5). La solicitud de la bodega guarda eso en `datosAntes.form`, más los códigos de las fotos (`fotosRef`), con `_datosAntesFormInv`. `nombre`, `cantidad`, `unidad` y `snes` de `datosAntes` siguen igual. La lista de cambios y la salida «sin cambios» comparan contra `_vAbrir`.

**`_planEdicionInv(m, req)`**, pura, decide qué se aplica sobre la fila de ahora:
- nombre, tipo, unidad, mínimo, categoría y observación: con `form` (las solicitudes desde la 118), solo los que la bodega cambió en el formulario; sin `form` (las de antes), los que difieren de los de ahora, como siempre;
- cantidad: si la bodega no la cambió, no se toca. Si la cambió, se aplica **el ajuste** sobre la de ahora: `max(0, hoy + (pedida − antes))`. Desde la v77 todas las solicitudes traen `datosAntes.cantidad`, así que esto vale también para las pendientes de antes;
- seriales: se quitan los que la bodega quitó y se agregan los que agregó, comparados con `_snNormal`, sobre los de ahora;
- fotos: por diferencia (`fotosRef`). Las incrustadas solo pueden disminuir, y una que otra pantalla quitó no vuelve;
- `aplicado` lleva solo lo que cambia, sin `undefined`.

**`yaContadas` (primera revisión).** Si la bodega pidió 3 → 2 quitando E2, y E2 ya había salido en una entrega (la fila ya estaba en 2), el ajuste se aplicaba otra vez: quedaba 1 con 2 seriales. Ahora los seriales se calculan primero, y las unidades del ajuste que ellos prueban ya movidas no se ajustan otra vez. `yaContadas` es el mínimo entre los seriales quitados que ya no estaban, el ajuste y lo que la cantidad de verdad bajó desde la solicitud (y lo mismo al subir). Un serial quitado sin su unidad no descuenta nada. Caso A: 2 [E1, E3]. Caso B (subir, con E4 ya adentro): 4.

**`approveEdit`**, camino normal:
- la pregunta de la v77 sale solo si la bodega pidió otra cantidad y la de ahora no es la de la solicitud: «⚠️ OJO: la cantidad de "X" CAMBIÓ… • La bodega pidió: B (ajuste de ±d) • Ahora en bodega hay: H • Ya contado en «ahora»: N (…) • Si apruebas quedará: F (se aplica el ajuste, no el número) ¿Aplicar?». «Cancelar» la deja pendiente;
- aplica `Object.assign(m, plan.aplicado)`. El efecto de la Etapa 2 lleva lo que de verdad se aplicó, para repetir lo mismo tras recargar;
- el aviso final agrega los seriales (`_textoSerialesEdicionInv`): «se quitaron…», «se agregaron…», «no hubo que mover ninguno» y, si cambiaron desde la solicitud, que se aplicó solo lo que pidió la bodega;
- el camino «otra fila» (la pregunta de la fila hermana) sigue como siempre, en absoluto (duda 11).

**Repetir tras recargar (primera revisión).** Si la aprobación no llegó a la nube, `_reaplicarEditarDecInv` la repite al recargar. Con el efecto nuevo, que lleva solo lo que cambia, «ya aplicada» se miraba en todas las filas de ese código. Si una hermana ya tenía esos valores (el mismo mínimo, por ejemplo), la edición se daba por hecha sin hacerse. Ahora se mira solo en las filas de ese código con el nombre y el tipo finales. Esa función es de la Etapa 2 y la especificación decía que nadie la tocara (ver «Lo que se apartó…»).

### ✏️ del administrador: solo lo que él cambió (C5)

En la rama del admin de `modalEditMat`, cada campo se escribe en la fila de ahora **solo si el formulario cambió** respecto a `_vAbrir`. Los seriales, solo si hay marcados para quitar o nuevos. Las fotos marcadas se quitan por su valor, no por su posición. Así no se pisa una observación o una foto que otra pantalla puso mientras tanto, y la unidad «mts» ya no pasa sola a «Unidad» al guardar otra cosa (W23). Sin `_vAbrir`, lo de antes. La foto de cantidad y seriales, la vaciada, el kardex, el registro y las fotos nuevas no cambian.

### 🗑️ de Ventas por su código (C5)

El botón pasaba solo la posición en la lista, y el archivador saca las ventas viejas del principio: con la lista vieja se borraba otra venta. Ahora pasa también el código: `solicitarEliminarVenta(idx, vid)`. Si en esa posición no está esa venta, se busca por su código. Si ya no está: «Esa venta ya no está en la lista (se archivó o la borró otra pantalla). Te muestro la lista de ahora.». Con un solo argumento, como siempre.

### Un traslado que ya se decidió (C5)

`procTrans` sobre un traslado que ya no está, o que ya no está pendiente, no hacía nada ni decía nada. Ahora: «ℹ️ Ese traslado ya se decidió (o ya no está). Te muestro la lista de ahora.». No dice «en otra pantalla», porque un doble clic sobre una decisión de esta misma pantalla, todavía «⏳ por subir», también llega ahí. No pasa a transacción: aceptar el mismo traslado en dos pantallas a la vez sigue siendo posible (Etapa 7, decisión 11), porque una transacción cambiaría la decisión sin señal de la Etapa 2.

### Segunda revisión: los avisos de ↩️ Devolver, ➕ Equipos y la venta que vuelve

**↩️ Devolver: lo que dice cada aviso** (los dos confirmados de la segunda pasada):
1. El aviso «Lo que cambiaste después… NO se devolvió» era falso cuando lo que quedó guardado era justo lo cambiado. Ejemplo: 10 no entra; se cambia a 12 y ese commit entra con la respuesta perdida. La nube tenía 12 y el aviso decía que no.
2. Si el commit entraba y el último reintento chocaba (`failed-precondition`: «the stored version does not match the required base version»), salía «❌ No se devolvió nada», en inglés, cuando sí se había devuelto. Y el Guardar siguiente, con una ONU agregada, se cerraba sin avisar que la ONU no salió.

El arreglo:
- Con el devId, solo un commit de la ventana puede entrar, y todo intento posterior lee `yaHecha`. El que entró es el **último intento que planeó escribir** antes del primer `yaHecha`.
- Cada Guardar lleva `escribioEste`. Cada intento que planea escribir lo marca y anota lo que mandaba en `foto.envioEscrito`. Reemplaza a `envioIncierto`, que guardaba lo del primer Guardar con error.
- `yaHecha` en un Guardar que planeó escribir: fue su propio commit (el SDK repitió tras perder la respuesta). Es un guardado normal, sin aviso.
- `yaHecha` en un Guardar que no planeó escribir: lo guardó uno anterior. **Siempre** se avisa «✅ Esa devolución ya había quedado guardada (N uds)…», aunque el anterior no se hubiera dado por incierto. «Lo que cambiaste después en la ventana NO se devolvió» sale solo si lo de este Guardar no es lo que entró.
- `_errorNubeInciertoInv` cuenta como «no se sabe» todos los errores que reintenta el SDK 10.12: además de los de red, `failed-precondition`, `already-exists` y `unauthenticated`, y los textos «stored version» y «base version». Modo prueba, pantalla vieja, `permission-denied` e `invalid-argument` siguen siendo «seguro que no».
- `_errorNubeTxtInv` da el choque en español: «🔄 Otra pantalla estaba guardando en la nube al mismo tiempo y no se alcanzó a confirmar. Inténtalo de nuevo en un momento.».
- Después de un «no se pudo confirmar», los avisos de lo escrito mal, de sin internet y de fallo seguro dicen «Este Guardar no devolvió nada (el anterior sigue sin confirmar)» en vez de «No se devolvió nada». En una ventana sin dudas, los textos de siempre.
- Límite que no se cubrió: un commit que la nube aplicara **después** de que el Guardar siguiente ya releyó. Con Firestore es prácticamente imposible: el commit se aplica antes de responder.

**➕ Equipos: un 2.º Guardar ya no repite.** Era el dudoso 3 de la primera pasada. Se investigó y se arregló ahora.
- **Reproducido** con la app real, igual en la copia de trabajo y en la v117 publicada. El Guardar de `modalAgregarEquipoCliente` trabaja primero en la memoria (baja la fila, quita los seriales, agrega al historial y a los equipos del cliente, deja el registro) y después llama `_fbSaveImmediate()` con `.then` y sin `.catch`.
- Si el guardado falla, `_fbSaveCore` programa el reintento con la memoria ya cambiada, esconde el velo y relanza el error: el `.then` no corre. La ventana queda abierta, sin aviso (en el primer fallo solo sale el indicador chico «Error al guardar») y con «Uncaught (in promise)». Nada se deshace, y el 2.º Guardar repite todo sobre la memoria ya descontada.
- **Medido** con 10 de cable sobre 100, donde debe quedar bodega 90 y cliente 10:
  - sin señal, y el 2.º Guardar con señal: 80 y 20, con 2 historiales y 2 registros (AE-1);
  - dos Guardar sin señal y Cancelar: el reintento automático sube igual 80 y 20 (AE-1b);
  - el commit entra y la respuesta es «Connection failed.»: 80 y 20 (AE-2);
  - con serial, la ONU no se duplica, pero el 2.º Guardar decía el falso «No se descontó nada… ármala de nuevo» (AE-3);
  - **sin ningún fallo:** si al pulsar Guardar hay otro guardado en curso (el diferido de 400 ms), el Guardar queda en cola sin el velo y un 2.º clic da 80 y 20 (AE-4).
  - La 🩺 Auditoría no lo ve: es un descuadre callado.
- **El arreglo:** la marca `_aeHecho`, una por ventana. Se pone después de descontar y agregar, y el callback no hace nada si ya está. Los avisos que no tocan nada (sin equipos, sin nota, cliente o stock que cambió) no la ponen, así que se puede corregir y volver a guardar. Y el `.catch`: cierra la ventana, repinta Clientes y avisa «⚠️ Los equipos quedaron anotados en esta pantalla, pero todavía no llegaron a la nube… La app sigue intentando subirlos sola: no cierres esta pestaña y NO los vuelvas a agregar.». En modo prueba o con pantalla vieja: «⚠️ Los equipos no se guardaron.». No hace falta llamar `save()`: `_fbSaveCore` ya dejó los reintentos programados. La forma de los datos no cambia.
- **Por qué ahora:** el daño es real y callado (material descontado dos veces y un equipo contado doble en el cliente). Se dispara con un gesto normal, volver a pulsar Guardar con el internet lento de las oficinas. La etapa ya era dueña de ese callback, y son unas 12 líneas.
- Las demás ventanas de la ficha no tienen el patrón: traslado, cambio, retiro parcial y retiro del cliente cierran en el mismo paso (`save(); closeModal();`), y ✏️/➕ Cliente y ➕ Instalación tienen un `.catch` que cierra. ↩️ Devolver está hecho al revés: escribe la memoria solo después del commit. Confirmar un consumo, al repetir, dice que ya está confirmado.
- **Queda para después** (ver «Pendiente»): el patrón de AE-4 en ➕ Instalación y en ➕ Agregar cliente nuevo, la Entrega con la respuesta perdida y `sincronizarInstalacionAUnCliente` sin `.catch`.

**La venta que vuelve: confirmada, se deja para después.** En la primera revisión, SR-D5 (de la Etapa 3) falló a veces en el banco: en 1 de 2 corridas completas y en 4 de 7 corridas solas. Se investigó con las apps reales: no es del banco ni de la Etapa 4.
- **Reproducido** de forma determinista con 11 escenarios `DEP-*`: unas compuertas detienen la lectura o la escritura del guardado mientras el oyente sigue recibiendo. 9 fallan con el repo y los mismos 9 con la v117 publicada; los 2 que pasan son controles. DEP-ECO calca SR-D5: la venta sigue en la nube y el material ya volvió a la bodega. Si se borra otra vez, se devuelve dos veces.
- **Causa:** la lápida de un registro entero (`_tumbas`) nace solo al guardar, en `_fusionarListasInv` («estaba en la foto de la nube y aquí ya no»). Entre el borrado y esa fusión pasan al menos 400 ms, más la cola si hay un guardado en curso. Si en ese rato llega un snapshot, `_protegerSnapshotInv` no protege el borrado (solo las creaciones de esta pantalla). El oyente del historial pone la lista de la nube y toma su foto, y la venta vuelve: el guardado siguiente ya no ve el borrado.
- **Segundo hueco:** el oyente de `inventario/datos` hace `Object.assign(window.DB, entrante)` y reemplaza `DB._tumbas` por la lista de la nube. Cualquier snapshot de datos borra la lápida local (DEP-V2b).
- **Misma clase** (borrar un registro entero sin lápida inmediata):
  - mueven material `solicitarEliminarVenta` y `approveDeleteVenta`; en la segunda, la solicitud queda «aprobada», la venta sigue y el material ya se devolvió;
  - el registro reaparece en la nube con `eliminarCuarto`, `eliminarCuadrilla`, `delEntrega`, `delInst` y `delBodega` (con sus cuadrillas);
  - `_archivarInv` tiene la misma ventana, pero se cura solo.
  - No afecta a las filas (`_tumbasFila` nace en el acto), a las decisiones ni a nada que vaya por transacción.
- Confirma el dudoso de la Etapa 2 (§11, «Una venta eliminada vuelve…»), con la pieza que faltaba en aquella nota: la unión en el oyente de `inventario/datos`.
- **El arreglo está probado en una copia, no en el repo** (`rev2/venta/propuesta_lapida.diff`, unas 30 líneas). Son tres piezas, y las tres hacen falta:
  1. `window._lapidaRegistroInv(col, id)` pone la lápida en `DB._tumbas` en el momento del borrado, con la forma de siempre;
  2. `window._unirTumbasEnEntranteInv(entrante)` une a lo que llega de `inventario/datos` las lápidas de esta pantalla que la nube todavía no trae (sin esta, falla DEP-V2b);
  3. `_protegerSnapshotInv` saca de lo que entra lo que tiene lápida de registro, como ya hace el guardado (sin esta, la venta reaparece en pantalla y un segundo borrado devuelve el material dos veces).

  Con la copia: DEP 11/11, PRUEBAS (grupo inv) 59/59, `etapa2` 25/25, `etapa3` 39/39, `etapa4` 61/61, `revision_oct` 11/11 y SR-D5 6/6.
- **Por qué después:** no viene de la Etapa 4 ni la empeora: está igual en la v117 y en la v115. La especificación congela `_protegerSnapshotInv` y la fusión (§0) y lo deja para otra etapa (§13.9). Meterlo ahora pediría otra revisión adversaria sobre el núcleo de la sincronización. Y en producción casi no se usa: el 15 oct (solo lectura) había 0 ventas en `inventario/historial` y 3 cuartos, y ningún borrado de venta, cuarto, entrega o cuadrilla en los últimos 130 registros. Puede ir como etapa corta justo después de publicar la v118, o ya, si Elkin lo pide.
- SR-D5 no se estabilizó en el banco: después de los arreglos pasó las 7 veces que se corrió.

**Aprobar una edición con el serial ya salido y otro equipo entrado (dudoso): sin corregir.** La bodega pide 3 → 2 quitando E2. Antes de aprobar, E2 sale en una entrega (3 → 2) y entra E5 (2 → 3). La cantidad de ahora es la de la solicitud: no sale la pregunta, `yaContadas` da 0 (la cantidad no bajó) y la fila queda con 2 unidades y 3 seriales [E1, E3, E5]. Debía quedar en 3. Un revisor lo dio por falla y el otro no: desde las cantidades no se puede saber si E2 salió con su unidad. La 🩺 Auditoría lo muestra como «cantidad distinta a los seriales». Queda para decidir (ver «Pendiente»).

### Qué cambia en los datos y quién se entera

| Dónde | Qué | ¿Lo lee otra app? |
|---|---|---|
| filas de `cuadrillas` | las que quedan en 0 al devolver, instalar o «Corregir» **se quedan** (antes se quitaban). Ningún campo nuevo | TÉCNICOS las esconde (filtra `cantidad>0`), no crea filas y reescribe el arreglo fresco conservando lo que no conoce. OFICINAS y RED no leen filas |
| `inventario/datos._tumbasFila` | «Corregir» ya no crea lápidas `'corregir'`. Las que hay siguen valiendo | solo INVENTARIO |
| kardex de las filas de bodega | la devolución escribe su línea dentro de la transacción, con el formato de siempre más `ref` (el devId de la ventana, unos 15 caracteres) | solo INVENTARIO |
| `inventario/datos.consumosPendientes` | misma forma. Un consumo cuyo serial escogido ya no está en la cuadrilla queda pendiente, en vez de confirmarse | TÉCNICOS lo sigue viendo pendiente y lo reserva, como cualquier consumo sin confirmar. OFICINAS y RED no los leen |
| `inventario/historial.editRequests` | `datosAntes` de las nuevas gana `form` (lo que mostraba el formulario) y `fotosRef` | solo INVENTARIO. `AVISOS_PENDIENTES.gs` cuenta pendientes: no cambia |
| `inventario/clientes_*` | misma forma. Las ventanas escriben en el cliente de ahora | OFICINAS y TÉCNICOS leen igual |
| navegador | `inv_ver_vacias_cuad:admin` o `inv_ver_vacias_cuad:bod_<id>`. El efecto de una edición aprobada (en `inv_decisiones`) lleva solo lo que de verdad se aplicó | — |

- Nada guarda nombres de personas nuevos. El kardex de la devolución dice «Admin» o el nombre de la bodega, como siempre, y el nombre del cliente solo va en los avisos de pantalla.
- Tamaño: 2–3 KB al mes por las filas en 0, con techo. La devolución pasa de un guardado general a una transacción sobre `inventario/datos`; el registro sigue yendo por el guardado general.

### Lo que se apartó de la especificación

1. **↩️ Devolver, un aviso de más** (C1): «"X": ahora tiene seriales en la cuadrilla (otra pantalla los agregó): hay que marcar cuáles devuelves.». Se quita con una línea.
2. **↩️ Devolver, el devId** (primera revisión): el kardex lleva `ref`, que el §11 de la especificación no tenía, y hay avisos nuevos («no se pudo confirmar», «ya había quedado guardada», «Este Guardar no devolvió nada…»). `_errorNubeTxtInv` reconoce además los códigos de Firestore y «Connection failed.»; antes ese mensaje salía en inglés.
3. **«Corregir»** (C2): una fila escondida o unificada que el admin no tocó ya no pasa por la validación. Sin esto, una fila en 0 con «N/A» como serial, o una unificada con seriales, bloqueaba con un aviso sobre algo que no se ve o no se puede cambiar. Las visibles se validan como siempre: de ahí lo de TL618.
4. **👷 Cuadrillas** (C2): además de lo pedido, escapa el nombre, la especialidad y el receptor de la cuadrilla, y el nombre, el cargo y la cédula del técnico.
5. **El aviso de la lista de equipos** (C3) dice «La lista de equipos de "X" cambió…». Con `_msgVentanaViejaInv`, el «Los equipos de "X"» de la especificación daba «Los equipos … cambió». Es una línea en `_avisoEquiposCliInv`.
6. **🚚 Traslado** (C3): la cuadrilla instaladora solo se escribe si se cambió en la ventana. Y el registro de confirmar un consumo ya no dice «anotado en ficha de X» cuando no se anotó.
7. **Los gemelos** (primera revisión): `_eqClienteVivoInv` ganó un 4.º parámetro opcional, y `_huellaEqDeBotonInv` anota `window._botonEqInv`. La firma de los modales y los `onclick` no cambiaron.
8. **➕ Equipos** (segunda revisión): la especificación solo pedía el cliente de ahora en el callback. Se agregaron `_aeHecho` y el `.catch`.
9. **C4:** un receptor vacío ya no se muestra como «undefined», y una bodega que no está en la lista no se cambia sola por la primera. W13d (🎒 Dotar con el técnico quitado) es un escenario de más.
10. **Fotos incrustadas** (C5): `_planEdicionInv` conserva las entradas de `fotos` que no empiezan por `data:` (el formulario no las mostraba y no se podían marcar). La intersección literal de la especificación las habría quitado.
11. **`yaContadas`** (primera revisión): la especificación aplicaba siempre el ajuste completo.
12. **`_reaplicarEditarDecInv`** (primera revisión): la especificación decía que nadie la tocara. Se le agregó el filtro por nombre y tipo, en vez de agregar nombre y tipo al efecto, porque `PRUEBAS.html` compara el efecto al pie de la letra (`{"observaciones":"nota nueva"}`, `{"cantidad":7}`).
13. **Funciones de más**, todas bajo su ancla:
    - C3: `_equiposActivosCliInv`, `_repintarClientesInv`, `_avisoClienteNoEstaInv`, `_avisoEqClienteInv`, `_avisoEquiposCliInv`, `_avisoEqBotonViejoInv`, `_equiposFormClienteInv` y `_camposFormClienteInv`;
    - C4: `_cuadrillaDeAhoraInv`, `_tecnicoDeAhoraInv`, `_dotDeAhoraInv`, `_huellaDotDeBotonInv`, `_camposVentanaInv`, `_camposTocadosInv` y `_avisoNoEstaCuadTecInv`;
    - C5: `_firmaSitioSNInv`, `_datosAntesFormInv` y `_textoSerialesEdicionInv`.
14. **El comentario de 🧩 de la Etapa 3** se puso al día: no tenía dueño en la especificación.
15. **El banco:** los cuatro `.js` locales (`ia.js`, `buzon.js`, `recarga.js`, `pantallas.js`) se sirven siempre desde la copia de trabajo, también con `--v117`; no cambian en esta etapa. `etapa3.js` ganó `sinPantallas` (una pantalla sin latido) y `listadoQuieto`. U6(c), U11(a) y RV-ETIQ abren la v116 después del 🧩.

### Decisiones de Elkin pendientes

La especificación le planteó 15 decisiones. No ha respondido. Se construyó lo recomendado, y cada una se cambia en pocas líneas:

| # | Lo que se le pregunta | Lo construido por defecto |
|---|---|---|
| 1 | Cuando un artículo de una cuadrilla queda en 0 al devolver, instalar o corregir, ¿se borra la fila o se queda en 0? | Se queda en 0 (opción a) |
| 2 | ¿Esconder esos artículos en 👷 Cuadrillas y en «Corregir» con «Ver vacías», como en Bodegas? | Sí. **Cambia lo que decidió en la Etapa 3** (decisión 8: «escondidas solo en Bodegas»): ahora también en 👷 Cuadrillas y en «Corregir» |
| 3 | «Corregir» no borra los artículos en 0 y no deja cambiar uno unificado con 🧩 | Así. La alternativa (seguir borrando, menos los puentes) deja el caso de 7 donde debían ser 2 |
| 4 | ¿Un botón para limpiar los artículos en 0 de las cuadrillas? | No por ahora. Un artículo mal creado («srv-profile_2» en Cartagena del Chairá) se queda en 0, escondido |
| 5 | ↩️ Devolver: todo o nada, en un solo paso contra la nube; sin señal no se devuelve | Así |
| 6 | Las ventanas de la ficha del cliente con el cliente de ahora; si ese equipo o ese cliente cambió, nada y aviso | Así. De paso, la fecha de instalación vacía ya no se llena sola |
| 7 | Al aprobar una edición, solo lo que la bodega cambió: los seriales por diferencia y la cantidad como ajuste | Así, con la pregunta que muestra cuánto quedaría |
| 8 | ✏️ del administrador: solo lo que él cambió | Así. De paso, la unidad «mts» ya no pasa sola a «Unidad» |
| 9 | 🔧 Seriales en dos sitios: arreglarla ya, porque la usará la Etapa 5 | Así |
| 10 | Editar cuadrilla, editar técnico, dotación directa y quitar de dotación; borrar una venta por su código | Así |
| 11 | Aceptar el mismo traslado en dos pantallas a la vez | Solo el aviso «ese traslado ya se decidió». El arreglo completo, con la Etapa 7 |
| 12 | Que dos pantallas de bodega no se pisen la lista completa de clientes | Aparte, en una etapa corta después de esta |
| 13 | Que las listas se actualicen solas cuando otra pantalla cambia algo | Después (una franja «Hay cambios — Actualizar»). Una ventana abierta no frena la actualización automática de versión |
| 14 | Confirmar el material de un técnico: si el serial escogido ya no está en la cuadrilla, no confirmar y avisar | Así |
| 15 | Para saber: se adaptan unas 10 pruebas viejas; Técnicos no tiene que actualizar | Así: 5 de `PRUEBAS.html` y 8 escenarios del banco |

Además, quedan para decidir con él cuatro puntos de la revisión: la edición con el serial ya salido y otro entrado, el texto del kardex de una edición aprobada, cuándo hacer lo de la venta que vuelve, y si «Corregir» debe validar solo las filas tocadas (TL618).

### Riesgos que quedan

- **Una pantalla v117 abierta** sigue podando las filas en 0 y devolviendo en memoria hasta recargarse. No empeora nada respecto a hoy; por eso D2 se queda. Al publicar hay que recargar todas las pantallas de bodega.
- **Sin señal no se devuelve material** (decisión 5), y en `?prueba=1` la devolución ya no corre en memoria: sale «🧪 Modo prueba: aquí no se guarda nada.», igual que la Entrega (duda 5).
- **TL618** bloquea «Corregir» en esa cuadrilla hasta resolverla (arriba).
- **Las filas en 0 crecen** 2–3 KB al mes, con techo, y no hay botón para limpiarlas (decisión 4).
- **La instalación desde INVENTARIO sigue en memoria,** sin transacción. Con la fila en 0 ya no devuelve material, pero si dos pantallas instalan lo mismo a la vez, la resta tiene piso en 0, como antes. No se usa desde mayo (duda 6).
- **Las ventanas del cliente guardan con `save()`.** En los 400 ms del guardado diferido, un bloque de clientes que llegue se lleva el cambio del cliente, y el stock ya se movió (duda 12). Es la lista completa de clientes (decisión 12), lo mismo que W22 justo después del commit.
- **Una respuesta perdida en una ventana que guarda primero en la memoria** (➕ Equipos y las demás): si otra pantalla cambia esa misma fila antes de que esta relea la nube, la fusión suma los dos cambios. Ya pasaba.
- **Los gemelos:** si otra pantalla movió el otro gemelo, esta también avisa y hay que volver a abrir.
- **El devId** dura lo que las 50 líneas del kardex de la fila.
- **`_reaplicarEditarDecInv`** repite lo aplicado como valores fijos: si otra pantalla movió seriales entre la aprobación y la recarga, los pisaría. Su guarda sigue siendo `cantAntes`. Es como antes, pero con menos datos.
- **La fusión de `dotacion`** empareja por posición los elementos con el código repetido (`_indiceF3`). Con la huella, 🗑️ escoge bien, pero la fusión fina no cambió.
- **Las dudas de la especificación (§13)**, construidas como allí dice:
  - devolver una fila que 🧩 unificó con la ventana abierta no devuelve nada (duda 1);
  - la cantidad de una edición se aplica como ajuste, no como número fijo; la pregunta muestra las dos cifras (duda 2);
  - retirar un cliente al que otra pantalla le cambió los equipos se cancela entero (duda 3);
  - una fila gemela en 0 en TÉCNICOS podría hacer decir «Solo tienes 0…» al devolver; hoy no hay gemelas exactas (duda 7);
  - «Ver vacías» de «Corregir» no guarda la preferencia (duda 8);
  - devolver desde INVENTARIO un serial que un técnico ya reportó instalado: el consumo queda pendiente, sin pérdida (duda 10, Etapa 5);
  - el camino «otra fila» de `approveEdit` sigue en absoluto, también los seriales (duda 11).

### Revisión adversaria (14 y 15 oct 2026)

Antes de mostrarla se buscaron fallas a propósito, en dos pasadas. Cada hallazgo lo revisaron dos escépticos por separado, con las funciones reales sacadas del archivo y con el banco. Las reproducciones quedaron en el scratchpad de la sesión (`etapa4/rev`, `fix_rev`, `banco_rev`, `pruebas_fix` y `rev2`). Las copias de antes de cada pasada: `etapa4/pre_rev` y `etapa4/pre_rev2`, con los diffs de los arreglos de la primera en `pre_rev2/arreglos_*.diff`.

**Primera pasada: 13 hallazgos**, con seis lentes: la devolución, las filas en 0, la ficha del cliente, C4 y C5, las etapas anteriores y las pruebas. **7 confirmados** (los dos escépticos dijeron que sí), **6 dudosos** (uno sí y uno no) y **0 refutados**. Los 7 se corrigieron, cada uno con su prueba:

| Falla | Arreglo (arriba) |
|---|---|
| ↩️ Devolver con la respuesta del commit perdida: el cable se devolvía dos veces (Firestore repite la transacción, o la persona vuelve a guardar), o decía «No se devolvió nada» cuando sí (2 hallazgos) | El devId en el kardex (`ref`), `yaHecha`, `_errorNubeInciertoInv` y el aviso «No se pudo confirmar…» |
| Dos equipos gemelos en la ficha del cliente: ↩️ o 🔄 sobre uno que otra pantalla ya retiró actuaba sobre el otro | `_cuantosHuellaCliInv`, el 4.º parámetro de `_eqClienteVivoInv` y `_nHuellaBotonInv` |
| Aprobar una edición ajustaba la cantidad dos veces si el serial pedido ya se había movido | `yaContadas` en `_planEdicionInv`, la línea «Ya contado en «ahora»» y el texto de los seriales |
| Tras recargar, una edición aprobada que no llegó a la nube se daba por hecha si una hermana con el mismo código ya tenía esos valores | `_reaplicarEditarDecInv` mira solo las filas con el nombre y el tipo finales |
| Ninguna prueba detectaba que la devolución escribiera campos de más en `inventario/datos` | PRUEBAS exige que la transacción devuelva solo `bodegas` y `cuadrillas`; el banco mira la escritura misma (`llavesDevolucion`) en W1 y RV-DEV-R |
| `verBodegas` del banco era inestable: el repintado al llegar el Catálogo cerraba lo desplegado (RV-VAC, E3-2) | `listadoQuieto` en `etapa3.js` y `etapa4.js` |

**Dudosos de la primera pasada:**
1. **TL618:** la fila en 0 con serial se queda y la bodega no puede hacer nada con ella; solo el admin, con «Corregir». Sin corregir: es de la Etapa 5. Además, bloquea «Corregir» de las demás filas de esa cuadrilla (ver «Las filas en 0 que se quedan»).
2. **W22 justo después del commit:** el material no llega a la ficha, el consumo queda marcado como aplicado y «🔄 Sincronizar» no lo repone. Sin corregir: es la lista completa de clientes (decisión 12). Va a «Pendiente».
3. **➕ Equipos:** si el guardado inmediato falla, la ventana queda abierta sin aviso y un 2.º Guardar descuenta y agrega otra vez (ya pasaba en la v117). Se investigó y se corrigió en la segunda pasada.
4. **El kardex de una edición aprobada** (dos hallazgos) copia «cantidad: A→B» de la solicitud aunque se aplique otro movimiento: dice «10→8» y se aplicó 12 → 10. Sin corregir: la cantidad y el `stockResultante` de esa línea son los reales; solo el texto del detalle repite lo que pidió la bodega.
5. **U6(c), U11(a) y RV-ETIQ fallaban por el número de versión:** 🧩 se niega por la pantalla v116 que late. Corregido en el banco: la v116 se abre después del 🧩, y en U11(a) también sin latido. U3v116 sigue igual: es solo informativo, y su texto («la salida se pierde») no vale con la 117, porque ahí 🧩 se niega.

**Segunda pasada** (sobre los arreglos de la primera): **3 hallazgos, 2 confirmados, 1 dudoso y 0 refutados**, más dos investigaciones aparte (➕ Equipos y la venta que vuelve). Todo está en «Segunda revisión», arriba:

| Hallazgo | Qué se hizo |
|---|---|
| ↩️ Devolver: el aviso «Lo que cambiaste después… NO se devolvió» era falso cuando lo guardado era justo lo cambiado (confirmado) | `escribioEste` y `foto.envioEscrito` |
| ↩️ Devolver: tras un commit que sí entró, un fallo final `failed-precondition` decía «❌ No se devolvió nada» y el Guardar siguiente con cambios se cerraba sin aviso (confirmado) | `_errorNubeInciertoInv` con todos los errores que reintenta el SDK, el choque en español y el aviso que ya no depende de un incierto anterior |
| Aprobar una edición: si el serial pedido ya salió y entró otro equipo a la fila, sigue ajustando dos veces (2 unidades con 3 seriales) y sin preguntar (dudoso) | Sin corregir: queda para decidir |
| Investigación: ➕ Equipos | Arreglado ahora (`_aeHecho` y el `.catch`) |
| Investigación: la venta que vuelve (SR-D5) | Confirmada; el arreglo está probado en una copia y queda para después de publicar |

### Pruebas

**`PRUEBAS.html`: 178 pruebas** (59 de INVENTARIO, 86 de OFICINAS, 32 de RED y 1 de Firma). Las 7 nuevas van en el grupo de INVENTARIO, después de las de la Etapa 3, cada una bajo el ancla de su parte:

| # | Prueba | Qué comprueba |
|---|---|---|
| 1 | ↩️ Devolver material: sobre la cuadrilla y la bodega de AHORA, todo o nada y en un solo paso contra la nube (C1) | Con `e4Snap` y una «nube» que tiene 55 de cable frente a 50 en pantalla (crítica H7): la cuadrilla queda en 45 (lo leído menos lo devuelto), la bodega sube, el serial pasa, una sola transacción, un solo «Devolución:» y el kardex coherente. Un renglón sin su serial o con cantidad de más: nada, y la ventana abierta. El serial ya instalado en la nube: nada y aviso. La fila en 0 con serial y el puente siguen. Dos clics, una transacción. Modo prueba, sin conexión, cuadrilla que ya no está. `_planDevolucionInv` y `_errorNubeTxtInv`, puras. Revisión: el `ref` en cada línea, la respuesta perdida (45/110, sin aviso, un registro), «No se pudo confirmar…» y el 2.º Guardar «ya había quedado guardada», y que solo se escriban `bodegas` y `cuadrillas`. Revisión 2 (parte 6c): un corredor que imita el SDK web (hasta 5 intentos: entra, se pierde la respuesta, falla o choca), los dos hallazgos, el choque puro y `_errorNubeInciertoInv`/`_errorNubeTxtInv` con cada código |
| 2 | Una fila en 0 ya no se borra sola: instalación y «Corregir» (C2) | `saveInstLogic` y la ventana real de «Corregir», con `e4Snap` de por medio: siguen la fila en 0, la de 0 con serial, el puente y el eslabón, sin lápidas. Por texto, ninguna de las dos poda. La fusión pura da P = 1 (y 5 si P se quita: por eso se deja D2) |
| 3 | 👷 Cuadrillas y «Corregir»: «Ver vacías», la etiqueta 🧩 y la unificada que no se corrige (C2) | La casilla y su N, lo escondido y lo visible, la nota, «Sin artículos con stock», la etiqueta, el escape de `<` y `"`, el total igual, la cuadrilla que sigue abierta al cambiar la casilla, la preferencia por rol y bodega (también sin poder guardar). En «Corregir»: la vaciada deshabilitada; forzarle un valor, o que 🧩 la vacíe con la ventana abierta, da aviso y nada; la casilla muestra y esconde sin repintar |
| 4 | Las ventanas de la ficha del cliente guardan en el cliente de AHORA (C3) | Las seis ventanas con `e4Snap('clientes')` y otro cliente cambiado; ese equipo cambiado: nada y aviso; la lista corrida (H8); el cliente ya retirado; los botones de una lista vieja (H2) y las llamadas con 2 argumentos; W22 y W25 con transacciones falsas; los literales que buscan otras pruebas. Revisión: los gemelos y sus funciones puras. Revisión 2 (parte 3b): ➕ Equipos con `_fbSaveImmediate` que falla, o que queda en cola: dos Guardar descuentan y agregan una sola vez, la ventana se cierra con «quedaron anotados…», no sale el falso «No se descontó nada», y en modo prueba sale «Los equipos no se guardaron» |
| 5 | Editar cuadrilla, técnico y dotación (C4) | Las cuatro ventanas con `e4Snap('cuadrillas')` de por medio: solo los campos cambiados, lo de la otra pantalla se conserva, sin cambios no hay escritura, cuadrilla o técnico quitados dan aviso. 🗑️ de la dotación por huella, con la lista corrida hacia adelante y hacia atrás y con un código repetido. `saveDotacionLogic` sin técnico no descuenta nada |
| 6 | 🔧 Seriales en dos sitios resuelve sobre lo de AHORA (C5) | Con `e4Snap('bodegas','cuadrillas')`: el serial queda en un sitio y la otra fila baja 1, con registro. Con el serial movido: aviso, sin registro ni «✅» |
| 7 | Aprobar una edición; ✏️ del admin; la venta por su código; el traslado ya decidido (C5) | `_planEdicionInv` pura (W8, W8b, el ajuste, una solicitud vieja sin `form`, «mts» y el tipo vacío, las fotos, sin `undefined`); `datosAntes.form` desde la ventana real de la bodega; `approveEdit` con la pregunta nueva y el camino «otra fila»; ✏️ del admin (W23, la foto por valor); ventas con la lista vieja (clic real); `procTrans`. Revisión: los casos A y B de `yaContadas` (puros y con `approveEdit`) y la hermana del mismo código tras recargar |

- Todas usan ids inventados que empiezan por `E4P` y reemplazan los objetos de `DB` con `e4Snap`, como hace el oyente. Las de la Etapa 3 que «simulaban un snapshot» cambiando `materiales` dentro del mismo objeto no veían estas fallas. Sustituyen `alert`, `confirm`, las ventanas, `_fbSave`, `_fbSaveImmediate`, las transacciones y los repintados, y lo devuelven todo en un `finally`, también la clave `inv_ver_vacias_cuad:*`. Exigen que `_escriturasBloqueadas` no crezca.
- **Pruebas viejas adaptadas** (cambiaban de sentido con las filas en 0 que se quedan):
  - «Etapa 3 · Lo que llega por nombre…» (C1): la devolución corre con una transacción falsa sobre copias. La cuadrilla queda `CONECTOR  APC=3,HERRAMIENTA E3=0`; antes la HERRAMIENTA se quitaba. Desde la revisión exige además que la transacción devuelva solo `bodegas` y `cuadrillas`.
  - «Etapa 2 · Una fila cuyo borrado aprobó el admin no vuelve…» (C2): exige por texto que `modalCorregirCantCuad` ya no cree lápidas y que `_antesCorregirTFInv` siga.
  - «Etapa 2 · Las demás pantallas no deshacen un borrado…» (C2): «Corregir» deja x1 en 0 sin lápida. «Otra» y «otraToco» arman la lápida que sube una pantalla v117, con la cantidad de antes (`_nuevaTumbaFilaInv(…, {cant:3, snes:[]}, …)`, crítica H1), y sus comprobaciones no cambian. «Vivo» da `x1=2,y1=0`.
  - «En el celular (375 px) ninguna pestaña de Inventario…» (C2): recorre también `cuads`.
  - «Etapa 3 · Lo que se escoge…»: solo un comentario.

**El banco** (`inv/etapa4.js`, base simulada y compartida, las apps reales en Chromium; TÉCNICOS solo se abre ahí). **W** = falla con la v117 publicada y pasa con la 118; **G** = guarda que pasa con las dos; **RV** y **R2** fallan con la copia de antes de cada revisión:

| Grupo | Escenarios |
|---|---|
| C1 ↩️ Devolver | W1, W1b, W1c, W1d, W1e, W1f, W2, W2b, W3, W4, W6b, W14, W15, W15d y G1 |
| C2 Filas en 0 y 👷 | W3b, W4b, W4c, W6, W15b, W15c, W16, W17 y G2-INST |
| C3 Ficha del cliente | W5, W5b, W5c, W5d, W9, W10, W11, W12, W18, W19, W22, W25 y G2-AE |
| C4 Cuadrilla, técnico y dotación | W13, W13b, W13c, W13d y G2-DOT |
| C5 Herramientas y solicitudes | W7, W7b, W8, W8b, W21, W23, W20b, G2-VENTA y G3 |
| Primera revisión | RV-GEM-R, RV-GEM-H, RV-GEM-R0, RV-GEM-CB, RV-GEM-L, RV-DEV-R, RV-DEV-G, RV-ED-A, RV-ED-B y RV-HERM |
| Segunda revisión | R2-DEV-1 a R2-DEV-4, y R2-AE-1, R2-AE-1b, R2-AE-2, R2-AE-3 y R2-AE-4 |

- **Adaptados en las otras suites:**
  - `etapa2.js` F1: (1) con la de ahora, «Corregir» 3 → 0 deja la fila en 0 en las dos pantallas, sin lápida ni «volvió»; (2a) y (2b), lo de antes con un admin v117.
  - `etapa3.js`: E3-4 y RV-REP(b) siguen probando lo de antes con una pantalla v117 que poda (pasa durante la transición), más una variante con la de ahora (E3-4(b), RV-REP(c)). U11(b) sube la vaciada con `tocarNube`. RV-VOLVIO, SR-SINP y SR-D2H hacen el «Corregir» con un admin v117 (SR-D2H sin latido). En la primera revisión, U6(c), U11(a) y RV-ETIQ, y la espera `listadoQuieto`.

**Corrido el 15 oct 2026, con el archivo final** (después de la segunda revisión), sobre la base SIMULADA del banco:
- `PRUEBAS.html` completo, sin servidor, con el arnés de la Etapa 2 (`correr_e2.js`; INVENTARIO, OFICINAS, RED y Firma): 178 corridas, **177 bien**. Falla solo «Rastreador v314: la ficha de una factura REAL de WispHub», que necesita WispHub de verdad, como en las etapas anteriores. 0 errores de página y 0 escrituras en la base simulada; OFICINAS con sus 5 intentos bloqueados de siempre. El grupo de INVENTARIO: 59 de 59.
- **Contrapruebas de `PRUEBAS.html`:**
  - al cerrar la primera revisión, con la copia de antes de ella (`pre_rev`), el grupo daba 56 de 59: fallaban las 3 pruebas que ganaron filas en esa revisión, y dentro de ellas solo las filas nuevas (5 de ↩️ Devolver, 2 de la ficha del cliente y 3 de aprobar una edición);
  - con la copia de antes de la segunda (`pre_rev2`), 57 de 59: fallan solo las 5 filas nuevas (4 de ↩️ Devolver y 1 de ➕ Equipos), con los 5 «Uncaught (in promise)» de la falla vieja;
  - en la construcción, cada parte comprobó que sus pruebas nuevas fallan con la v117;
  - una copia que escribe el plan entero en la devolución la atrapan ↩️ Devolver y «Lo que llega por nombre…»;
  - en la construcción, 32 copias dañadas (6 de C1, 6 de C2, 7 de C3, 7 de C4 y 6 de C5): cada una la atrapa alguna prueba «Etapa 4 ·» y su W del banco.
- **El banco:** `etapa4` **70 de 70** (440 s), `etapa3` **39 de 39** las 7 veces que se corrió (cinco seguidas y dos más, SR-D5 incluido), `etapa2` 25/25 y `revision_oct` 11/11 (R7 y R7b pasan con la ventana de «Corregir» de ahora).
- **Contrapruebas del banco:**
  - con `--v117`, cada parte comprobó sus escenarios antes de juntarlos: fallan sus 45 W y pasan sus 6 G;
  - los 10 RV fallan con `pre_rev`. Con `--v117` pasa RV-HERM, y RV-ED-A y RV-ED-B fallan solo por los textos y el formato nuevos (la cantidad ya salía bien en la v117);
  - los 9 R2 fallan con `pre_rev2`, y los 5 R2-AE fallan con una copia sin `if(_aeHecho) return;`;
  - una copia que escribe el plan entero en la devolución la atrapan W1 y RV-DEV-R.
- **Comprobaciones propias** (scratchpad, con las funciones reales sacadas del archivo o las apps reales, sin red): `fix_rev/unit_fix.js` 39/39; `rev2/arreglos/dev_avisos.js`, `rev2/verif_avisos/caso3.js` y `rev2/corr2/extra.js` (los avisos de ↩️); `rev2/equipos/etapa4_ae.js` (AE-0 a AE-5, AE-X-RP1 y AE-X-INST1 pasan; AE-X-INST4 y AE-X-CLI4 fallan, como se espera: son el patrón que queda para después); `rev2/venta/dep.js` (los 11 DEP-*).
- **Validación:** `node .claude/validar.mjs` da sintaxis correcta en INVENTARIO (4 bloques) y PRUEBAS (1). Los dos en CRLF, sin LF sueltos (16.928 y 12.278 líneas). `inv/etapa4.js` va en LF, como el resto del banco, y pasa `node --check`. `APP_VERSION_INV` sigue en 117 y `APP_VERSION_TEC` en 102.

**Corrida final, 15 oct 2026 (11:44 a. m. a 12:24 p. m.), con el archivo final** (ya con la segunda pasada):
- **El banco completo**, en orden: `pantallas_unit` 216/216, `recarga_unit` 167/167, `unit_v112` 50/50, `revision_oct` 11/11, `repro` 21/21, `escenarios2` 20/20, `etapa1` 16/16, `etapa6` 13/13, `etapa2` 25/25, `etapa3` **39/39** y `etapa4` **70/70**. Contraprueba: `etapa4 --v117` (lo publicado) da 7 bien y 63 mal. Los 7 que pasan son los 6 G, que deben pasar con las dos versiones, y RV-HERM, que prueba una falla que metió la primera construcción de esta etapa y la v117 no tenía. Salidas en el scratchpad de la sesión (`etapa4/banco_final/`).
- **`PRUEBAS.html` en el navegador contra la base real** (`?prueba=1`): **176 bien y 2 por revisar** de 178, las dos «Estado real» de siempre (36 seriales en dos sitios; servicios de proveedores sin costo). Después se miró la nube por REST (solo lectura): las escrituras de ese rato son de pantallas reales (una bodega con INVENTARIO v117 en `inventario/datos`; oficinas con OFICINAS v320 sincronizando WispHub en `main` y `logs_auditoria`). Ninguna de las pruebas.

### Pendiente

1. **La corrida final** con el archivo final (arriba).
2. **Decidir con Elkin:** las 15 decisiones y lo que dejó la revisión (ver «Decisiones de Elkin pendientes»).
3. **La lista completa de clientes que se pisa entre pantallas** (decisión 12): gana la última que guarda, y un bloque que llega en los 400 ms del guardado diferido se lleva el cambio de una ventana del cliente (duda 12). Etapa propia, corta, después de esta. Ahí entra **W22 justo después del commit**, que no se arregló: el consumo queda `materialAplicadoCliente:true` en la nube y, si el bloque de clientes llega antes del guardado, el material no queda en la ficha y «🔄 Sincronizar material con clientes» no lo repite.
4. **La franja «Hay cambios — Actualizar»** (decisión 13): las listas no se repintan solas. Después de esta etapa ningún botón actúa sobre datos viejos, aunque la lista lo esté.
5. **El traslado aceptado dos veces** en dos pantallas a la vez: el material entra dos veces. Va con la Etapa 7 (decisión 11); hoy solo sale el aviso «ya se decidió».
6. **La Entrega con la respuesta perdida** (`saveEntregaLogic` con `_fbTransaccionInvMulti`, desde la v74): dice «❌ No se registró la entrega», la ventana sigue abierta y un 2.º Guardar entrega dos veces. Necesita una marca fija por entrega, como el devId (por ejemplo su `entregas[].id`, creado fuera de la transacción).
7. **El patrón de AE-4 en ➕ Instalación y ➕ Agregar cliente nuevo** (AE-X-INST4 y AE-X-CLI4; también en la v117): con otro guardado en curso, `_ejecutarSaveInv(true)` deja el Guardar en cola sin el velo y un 2.º clic repite (2 instalaciones, la cuadrilla en 30 en vez de 40; 2 clientes iguales). Se arregla mejor en un solo sitio: que el guardado en cola muestre el velo. Ojo: si la cola la armó un guardado de fondo, `_fbSaveCore` se traga el error y el `.then` cierra la ventana aunque haya fallado. Toca todas las ventanas que guardan con `_fbSaveImmediate`: necesita su propia revisión. También `sincronizarInstalacionAUnCliente`, sin `.catch` (leído, no probado): otro clic en «➕ Crear en Clientes» crea el cliente otra vez.
8. **La venta que vuelve** (ver «Segunda revisión»): etapa corta justo después de publicar la v118, con el arreglo ya probado (`rev2/venta/propuesta_lapida.diff`), o ya, si Elkin lo pide (cuesta otra revisión). Al hacerla, llevar los 11 DEP-* al banco y dos filas a `PRUEBAS.html` («lo que entra con lápida de registro no vuelve» y «la lápida de aquí sobrevive al snapshot de datos»). Mientras tanto, estabilizar SR-D5: esperar a que la pantalla del admin quede quieta (sin escrituras nuevas durante 1,5 s) antes de borrar la venta.
   - **Resuelto en la Etapa 4b** (sin publicar): las tres piezas, en la venta y en los demás borrados de un registro entero, más los arreglos de dos revisiones (la unión del oyente solo con las lápidas de esta pantalla, y una cuadrilla o bodega a la que otra pantalla le movió material no se borra: se avisa «NO SE BORRÓ»). Los 11 DEP-* ya están en el banco, con 3 DEPX-* y 9 escenarios de la primera revisión, y `PRUEBAS.html` tiene una prueba nueva que cubre las dos filas y el rescate. Ver §14.
9. **Aprobar una edición con el serial ya salido y otro entrado** (dudoso de la segunda pasada): una salida es preguntar también cuando los seriales cambiaron desde la solicitud. Y **el texto del kardex** de una edición aprobada, que repite lo que pidió la bodega.
10. **Etapa 5:** TL618 y los seriales en dos sitios (y, si se quiere, que «Corregir» valide solo las filas tocadas); devolver desde INVENTARIO un serial que un técnico ya reportó instalado (duda 10); el serial devuelto que ya está en otro sitio; los seriales comparados letra por letra al escribir; TÉCNICOS que no vuelve a contar lo ya reportado al devolver.
11. **Detalles:** U3v116 (informativo) dice algo que con la 117 no pasa; la fusión de `dotacion` con el código repetido; `_reaplicarEditarDecInv` con valores fijos; el camino «otra fila» de `approveEdit` en absoluto (duda 11); las ediciones de cuartos de equipos que se pierden (#34 del mapa de ventanas, otra etapa).
12. **Publicada el 16 oct 2026** (Elkin: «publica y continua»; commit `8e38448`, INVENTARIO 118). Respaldo en `_RESPALDO_2026-10-16_antes_de_publicar` (código, inventario/datos, historial y los cinco bloques de clientes). Antes, el banco de los escenarios que abren pantallas viejas con la 118: etapa3 39/39, etapa2 F1 bien y etapa4 70/70. Mantenimiento solo de INVENTARIO de 6:50 a 6:53 p. m.; push 6:51, Pages con los dos archivos nuevos a las 6:52 (huellas iguales a las del disco, dos veces; PRUEBAS.html se volvió a sacar del commit porque un agente lo había dejado en LF), versión anunciada 6:53, prueba de humo en `?prueba=1` sin errores. Al publicar quedaban dos INVENTARIO 117 de bodega ocultas, que se recargan solas. De paso: las 9 lápidas por fila que hay en la nube (un «Corregir» del admin del 14 oct en una cuadrilla) están bien, ninguna anulada y ninguna fila volvió (la comprobación pendiente de la §11). Lo que se planeó para este paso:
    - INVENTARIO 118 **solo**, fuera de horario, con el respaldo de datos de la Etapa 1 antes;
    - TÉCNICOS no cambia: no hay que pedir a los técnicos que actualicen;
    - recargar todas las pantallas de bodega: una v117 abierta sigue podando y devolviendo en memoria hasta recargarse (no empeora nada);
    - probar un caso real: devolver material de una cuadrilla con otra pantalla abierta; ver que el artículo que queda en 0 sigue, escondido, en 👷; aprobar una edición con seriales; confirmar un consumo escogiendo el serial; agregar un equipo a un cliente.

## 14. Etapa 4b — un registro borrado no vuelve (publicada el 17 oct 2026)

Hecha el 16 oct 2026, después de publicar la Etapa 4, sobre lo publicado en `8e38448` (OFICINAS v320, INVENTARIO v118, TÉCNICOS v102, RED v44). Es el «Pendiente» 8 de la §13 (Elkin: «publica y continua»). **No está publicada** y la versión no se subió: al publicar, INVENTARIO pasa a 119, **solo**. TÉCNICOS, OFICINAS y RED no cambian. Las pruebas no escribieron nada en la base real: solo se leyó `inventario/datos._tumbas`, con GET y sin copiar datos personales (332 lápidas, en orden y lejos del tope de 800).

Se partió del arreglo que la investigación de la §13 ya había probado en una copia (`etapa4/rev2/venta/`), aplicado por contenido porque la v118 cambió las líneas. Después hubo dos revisiones adversarias, cada una con sus arreglos (ver «Primera revisión adversaria» y «Segunda revisión adversaria»). Lo que sigue es lo que quedó, ya con esos arreglos. Las copias de antes están en el scratchpad de la sesión: `etapa4b/pre` (la v118 publicada) y `etapa4b/pre_rev2` (antes de la segunda revisión).

### Qué quedó en cada archivo

| Archivo | Qué cambió |
|---|---|
| `INVENTARIO_PTOVISION.html` | Las tres piezas, junto a `_fusionarConNubeInv`; la llamada en los 8 sitios que borran un registro entero; el filtro al principio de `_protegerSnapshotInv`; la unión en el oyente de `inventario/datos`; la lista de lápidas por subir y el rescate por material, de las dos revisiones; y en `_fbSaveCore`, el tercer parámetro de `_fusionarConNubeInv` y el aviso después del commit. Contra lo publicado, 220 líneas agregadas y 13 quitadas (git); cada parte lleva el comentario «docs/12 §14» |
| `PRUEBAS.html` | 1 prueba nueva, con 16 condiciones (179 en total: 60 de INVENTARIO, 86 de OFICINAS, 32 de RED y 1 de Firma). Ninguna vieja cambió. 333 líneas agregadas (git) |
| banco, `inv/etapa4.js` | La sección «Etapa 4b»: los 14 escenarios DEP (11 DEP-* y 3 DEPX-*), el ayudante `primerGuardadoDep`, la subsección «Revisión de la Etapa 4b», con 9 escenarios (TP-TOPE, TP-ROTA, 6 FX-* y LEN-RACE), y la subsección «Revisión 2 de la Etapa 4b», con 13 más (2 LP-*, 5 RS-* y 6 C3-*) y 3 informativos que no cuentan (INFO-*). El banco pasa de 70 a 106 escenarios |
| TÉCNICOS, OFICINAS, RED | Sin cambios. No leen `_tumbas` |

### El problema

El admin borra una venta de 50 m de CABLE DROP: la venta sale de la lista y los 50 m vuelven a BODEGA NATALIA (1000 → 1050). Si antes de que el guardado lea la nube llega un snapshot (el eco del primer guardado general de la sesión, que es lo que vio SR-D5, u otra pantalla que escribe), la venta vuelve a la memoria y a la pantalla. El guardado sube la bodega con 1050 y la venta sigue en la nube. Si se borra otra vez, los 50 m vuelven otra vez: 1100. El material queda contado dos veces, sin ningún aviso.

Lo mismo con los demás registros enteros: un cuarto, una cuadrilla, una entrega, una instalación o una bodega con sus cuadrillas borrados vuelven a la nube. Ya pasaba en la v115, la v117 y la v118. En producción casi no se usa (15 oct: 0 ventas en `inventario/historial`, 3 cuartos, y ningún borrado de esos en los últimos 130 registros), pero si las ventas se vuelven a usar, el descuadre es callado.

### La causa

- La lápida de un registro entero (`inventario/datos._tumbas`) nacía solo al guardar, en `_fusionarListasInv` («estaba en la foto de la nube y aquí ya no»). Entre el borrado y esa fusión pasan al menos los 400 ms del guardado diferido, más la cola si hay otro guardado en curso.
- Si en ese rato llegaba un snapshot, `_protegerSnapshotInv` no protegía el borrado: solo protege lo que esta pantalla creó. El oyente ponía la lista de la nube y tomaba su foto. El registro volvía y el guardado siguiente ya no veía el borrado.
- **Segundo hueco:** el oyente de `inventario/datos` hace `Object.assign(window.DB, entrante)`, que reemplaza `DB._tumbas` por la lista de la nube. Aunque la lápida se pusiera en el acto, cualquier snapshot de datos la tiraba (DEP-V2b).

### Las tres piezas, y por qué hacen falta las tres

1. **La lápida en el acto.** `window._lapidaRegistroInv(col, id, reg)` pone `{col, id, en}` en `DB._tumbas` en el momento del borrado, con la forma que ya pone el guardado. No repite una que ya está y arma un arreglo nuevo: no toca el que vino de la nube.
2. **El oyente no la tira.** `window._unirTumbasEnEntranteInv(entrante)` corre en el oyente de `inventario/datos` justo después de `_unirTumbasFilaEnEntranteInv`, antes de `_protegerSnapshotInv` y del `Object.assign`. Une a lo que entra las lápidas que **esta pantalla puso** y la nube todavía no trae (la lista `_lapPorSubirInv`, ver «Las lápidas por subir»), en una lista nueva y podada. Si no falta ninguna, no hace nada.
3. **Lo que tiene lápida no vuelve.** Lo primero que hace ahora `_protegerSnapshotInv` es sacar de cada lista que entra lo que tiene lápida de registro, en una lista nueva. Así ese registro tampoco pasa por las decisiones, las lápidas por fila ni la comparación. Vale para los dos oyentes y para `_aplicarNubeParcialInv` (lo que devuelven las transacciones).

Sin la 1, no hay nada que proteger hasta que se guarda. Sin la 2, un snapshot de `inventario/datos` borra la lápida de la memoria (DEP-V2b, y los borrados de cuadrillas, instalaciones, bodegas y equipos dañados). Sin la 3, la venta reaparece en pantalla y un segundo borrado devuelve el material dos veces (DEP-REBORRAR da 1100).

- La pieza 3 va al principio de la función, y no dentro del bucle de comparación como decía la propuesta: lo que llegó de la nube no se cambia, y una bodega borrada no llega a las lápidas por fila, que podían anular la lápida de una de sus filas y dar un falso «volvió».
- El guardado sigue poniendo su lápida («estaba en la foto y aquí ya no»): queda de red. El comentario de la fusión v74 lo dice.

### Qué borrados cubre

| Botón o función | Lápida de |
|---|---|
| `solicitarEliminarVenta` y `approveDeleteVenta` | la venta. Son los que mueven material |
| `eliminarCuarto` | el cuarto de equipos |
| `eliminarCuadrilla` | la cuadrilla (le pasa el registro, porque ya lo quitó de `DB`) |
| `delEntrega` | la entrega |
| `delInst` | la instalación |
| `delBodega` | la bodega y cada una de sus cuadrillas, antes de filtrarlas |
| `eliminarTodosClientes` | cada equipo dañado, antes de vaciar `DB.equiposDanados`. No estaba en la propuesta: es una lista de `inventario/datos` con la misma carrera |

Quedan fuera, a propósito:
- `_archivarInv`: tiene la misma ventana, pero se cura solo, porque el archivo no repite un id.
- Los clientes: viven en sus propios bloques, sin `_tumbas`. Es la lista completa de clientes (§13, «Pendiente» 3; ver el dudoso de `deleteCliente`, abajo).
- El «borrado total» y restaurar un respaldo (`_ejecutarImport`): reemplazan la base entera.

La Etapa 4 no agregó borrados de registros enteros en las listas de `inventario/datos` ni de `inventario/historial`.

### Las lápidas por subir (primera revisión)

La primera versión de la pieza 2 unía todas las lápidas de la memoria que la nube no traía. Eso incluía las que la nube ya había soltado por el tope de 800: volvían al final de la lista y el corte, que va por posición, se llevaba las más nuevas (TP-TOPE y TP-ROTA, ver «Primera revisión adversaria»).

- `_lapPorSubirInv` es una lista en memoria (un `Map` col│id → {col, id}) con las lápidas que **esta pantalla** puso con `_lapidaRegistroInv`.
- `_unirTumbasEnEntranteInv` une a lo que entra solo las de esa lista que la nube no trae.
- Una lápida sale de la lista cuando la nube ya la trae (ya subió) o cuando ya no está en `DB._tumbas` (se podó o se soltó).
- Así, lo que la nube soltó por el tope no vuelve, la memoria queda igual que la nube y un guardado que no borra nada no reescribe `_tumbas`.
- `window._lapidasPorSubirInv()` deja leer la lista, sin cambiarla, para `PRUEBAS.html`.

### Una cuadrilla o bodega con material nuevo no se borra (el rescate)

Con la lápida en el acto, el borrado de una cuadrilla o una bodega se cumplía siempre. También cuando, entre el clic y el guardado, otra pantalla le entregó, devolvió o trasladó material. Antes el snapshot deshacía el borrado y el registro volvía con su material. Con la lápida, ese material se iba con el registro, sin rastro, y la entrega quedaba a una cuadrilla que no existe (LEN-RACE: CABLE DROP 3000 → 2970). El rescate lo evita. Es de la primera revisión, con tres arreglos de la segunda.

Solo vale para cuadrillas y bodegas (`_COLS_FINAS_INV`): a una venta, un cuarto, una entrega o una instalación no les entra material de otra pantalla.

**Al hacer clic.** `_lapidaRegistroInv` anota en `_copiaAlBorrarInv` (otra lista en memoria) dos firmas del material, hechas con `_firmaMaterialInv`:
- la de la base: lo que tenía la nube en la última sincronía;
- la de la pantalla: lo que había en la memoria al hacer clic, con lo propio aún sin subir.

Hacen falta las dos. Con solo la de la base, lo que esta misma pantalla iba subiendo (un guardado en vuelo) contaba como cambio de otra pantalla (FX-PROPIO). De una cuadrilla anota también su bodega (`bod`), para nombrarla en el aviso de su bodega. `eliminarCuadrilla` le pasa el registro, porque ya lo quitó de `DB`.

**La firma** es de lo que hay, no de cómo está repartido en filas (segunda revisión). Lleva:
- la suma de las cantidades, redondeada;
- los seriales, normalizados con `_snNormal`, sin repetir y sin los de relleno;
- en una cuadrilla, su bodega.

Unificar filas con 🧩 (también con claves distintas, como «TV BOX» y «TVBOX»), renombrar una fila, cambiarle el tipo o el orden no la cambian. Escribir un serial Huawei en el otro formato tampoco. Entregar, devolver, trasladar, confirmar un consumo, corregir una cantidad, cambiar una ONU por otra (otro serial, misma cantidad) o pasar la cuadrilla a otra bodega sí la cambian. Solo se le escapa que en ese rato entre y salga exactamente la misma cantidad, sin ningún serial. El nombre de la cuadrilla no cuenta: si otra pantalla solo lo cambió, se borra sin aviso (FX-CUAD-CTRL).

**Al guardar.** `_rescatesAlBorrarInv(frescoDatos, enGuardado)` corre al principio de `_fusionarConNubeInv`, con lo recién leído:
- Si la nube ya trae la lápida, o ya no trae el registro, el borrado quedó: la copia del clic se descarta.
- Si la nube lo trae sin lápida y con una firma distinta de las dos, **no se borra**. `_fusionarListasInv` (parámetro `rescatados`) lo vuelve a meter con lo de la nube. Su lápida sale de `DB._tumbas` y de las dos listas. Queda una línea en el registro (`DB.logs`, con `_entradaLogInv`), que sale con ese mismo guardado.

**Si la transacción se repite** (segunda revisión). Firebase repite la transacción del guardado si alguien escribe en medio. Por eso `_fbSaveCore` llama `_fusionarConNubeInv` con un tercer parámetro, `enGuardado`, en la transacción y en el modo prueba:
- Lo rescatado queda en `_rescIntentoInv`, también en memoria, con lo necesario para deshacerlo: la lápida, las dos entradas de las listas y la línea del registro.
- El intento siguiente empieza con `_deshacerRescatesInv`: vuelve a poner la lápida y las dos entradas, sin pisar un borrado nuevo del mismo registro, y quita la línea. Después decide otra vez, con la copia del clic y la nube de ese momento.
- Si en la repetición la nube ya trae la lápida (otra pantalla la borró), queda borrada, sin aviso y sin línea (LP-REINT, C3-REINT-POR). Si la repetición fue por otra escritura, el rescate se mantiene, con un solo aviso y una sola línea (C3-REINT-AJENO). Si el material entra justo después de la primera lectura, la repetición lo ve y rescata (RS-REINT). Un snapshot que llega entre dos intentos tampoco lo deja callado.
- Si el guardado falla, el guardado siguiente hace lo mismo: deshace lo del intento que no se confirmó y vuelve a decidir. El aviso de ese intento no sale.

**El aviso.** Después del commit, `_fbSaveCore` llama `window._rescatesTrasGuardarInv(dbCopy)`, en la transacción y en el modo prueba. Solo avisa de lo que quedó escrito: el registro está en lo que se escribió y sin lápida. Devuelve cuántos avisó y vacía `_rescIntentoInv`, así que llamarla otra vez no repite el aviso. A los 600 ms, fuera de la transacción, `_avisarRescatesInv` repinta la pestaña abierta y muestra «⚠️ NO SE BORRÓ», una línea por registro y «Revísalo y, si todavía hay que borrarlo, vuelve a borrarlo.». Si alguien llama `_fusionarConNubeInv` sin `enGuardado` (como el paso 8 de la prueba de `PRUEBAS.html`), no hay nada que se repita: lo decidido es final y el aviso sale igual, a los 600 ms.

Las líneas del aviso y del registro dicen:
- de una cuadrilla: «No se borró la cuadrilla "X": mientras se borraba, otra pantalla le entregó o le quitó material (o la pasó a otra bodega)»;
- de una bodega: «No se borró la bodega "X": mientras se borraba, otra pantalla le metió o le sacó material»;
- de una bodega que se queda por su cuadrilla: «No se borró la bodega "X": su cuadrilla "Y" sigue».

**Una bodega con sus cuadrillas.** `delBodega` pone lápida a la bodega y a cada una de sus cuadrillas. Al guardar:
- **(a)** Si se queda una cuadrilla que esta pantalla borraba junto con su bodega, la bodega también se queda, para no dejar una cuadrilla sin bodega. Solo mira las cuadrillas que esta pantalla borraba: una que otra pantalla mete en la bodega mientras se borra no la salva (dudoso 2 de la segunda revisión).
- **(b)** Una bodega que se queda por material nuevo no salva a sus cuadrillas sin cambios: esas se borran. Desde la segunda revisión, el aviso y la línea lo dicen, también de las que la nube ya no tiene: «…; su cuadrilla "CUADRILLA DEPB" SÍ se borró, con el material que tenía», o «sus cuadrillas "X" y "Y" SÍ se borraron, con el material que tenían». Esta regla queda para que Elkin la confirme (ver «Decisión abierta para Elkin»).
- **(c)** Una cuadrilla que otra pantalla pasó a otra bodega se queda, y la bodega vieja se borra.

### Qué cambia en los datos y quién se entera

Nada nuevo. `_tumbas` lleva la misma forma `{col, id, en}`, con los mismos topes (15 días y 800); la diferencia es que la lápida llega a la nube en el primer guardado y no se pierde en el camino. La línea del rescate va en `logs` con `_entradaLogInv`, como cualquier otra.

- Las tres listas nuevas, `_lapPorSubirInv`, `_copiaAlBorrarInv` y `_rescIntentoInv`, viven solo en la memoria de la pantalla: nunca van a `DB` ni a la nube, y al recargar se pierden, igual que un borrado sin guardar.
- TÉCNICOS, OFICINAS y RED no leen `_tumbas`: no se enteran.
- Una INVENTARIO v118 abierta convive: recibe la lápida y suelta el registro, como con cualquier borrado de otra pantalla (LEN-MIX: la venta no vuelve y el material se devuelve una vez). Sus propios borrados siguen con la carrera hasta que se recargue.

### Riesgos y límites

- **Recrear con el mismo id dentro de 15 días:** el registro se esconde en el acto (antes lo quitaba el guardado). Todos los sitios tocados crean ids nuevos (`Date.now()` o `uid`).
- **Si el guardado falla,** el borrado se queda solo en esa pantalla, igual que la devolución del material. Recargar antes de guardar pierde los dos juntos, como hoy.
- **Dos pantallas que borran la misma venta a la vez** devuelven el material dos veces. Es otro problema, como el traslado aceptado dos veces (§13, «Pendiente» 5).
- **OFICINAS** tiene una forma parecida en `_protegerLocalesEnSnapshot` (alrededor de la línea 2240): protege lo creado, no lo borrado. No se revisó.
- **El rescate no se mira en el oyente** (era opcional): desde el snapshot hasta que termina el guardado, unos segundos, la cuadrilla o bodega rescatada no se ve, y reaparece con el aviso. El material no se pierde.
- **La firma no ve** que en ese rato entre y salga exactamente la misma cantidad sin ningún serial.
- **El confirm de `delBodega`** no nombra las cuadrillas que se borran con la bodega (ya era así).
- Los dudosos de las dos revisiones (abajo), sin corregir.

### Primera revisión adversaria (16 oct 2026)

Antes de mostrarla se buscaron fallas a propósito, en una pasada, con cuatro lentes: las tres piezas, los sitios que borran un registro entero, las etapas anteriores y las pruebas. Cada hallazgo lo revisaron dos escépticos por separado, con las apps reales en el banco. Las reproducciones quedaron en el scratchpad de la sesión (`etapa4b/rev`, `verif_*`, `fix_rev` y `tumbasnube`).

**5 hallazgos: 3 confirmados** (los dos escépticos dijeron que sí), **2 dudosos** (uno sí y uno no) y **0 refutados**. Los 3 confirmados se corrigieron:

| Falla | Gravedad | Arreglo |
|---|---|---|
| La unión del oyente volvía a meter las lápidas que la nube soltó por el tope de 800. Iban al final de la lista y el corte, que va por posición, se llevaba las más nuevas. Con la nube al tope, una pantalla con el arreglo que guardaba cualquier cosa devolvía las 400 viejas, el tope se llevaba la lápida de una venta recién borrada y una pantalla atrasada devolvía la venta (TP-TOPE). Y cada guardado, aunque no borrara nada, reescribía `_tumbas` (TP-ROTA: 20 de 20) | media | `_lapPorSubirInv` (ver «Las lápidas por subir») |
| Borrar una cuadrilla o una bodega se llevaba en silencio el material que otra pantalla le metió entre el clic y el guardado (LEN-RACE) | baja | El rescate por material (ver «el rescate») |
| DEP-INST, DEPX-CUAD, DEPX-BOD y DEPX-DAN no probaban la pieza 2: la nube simulada no tenía `_tumbas` (producción sí), y sin esa lista el `Object.assign` no pisa la de la pantalla | baja | En el banco, `primerGuardadoDep`: un primer guardado antes del borrado, que exige que la nube ya tenga su `_tumbas` |

**Dudosos, sin corregir:**
1. **Retirar un cliente con equipos** (`deleteCliente`, gravedad media). La ONU vuelve a la bodega y el cliente sale, en memoria y sin lápida. Si un bloque de clientes llega en los 400 ms del guardado diferido (otra pantalla edita otro cliente), el cliente vuelve con la ONU y queda así en la nube: la ONU cuenta dos veces (SIT-RET y SIT-RET2, igual con la v118 y con esta). Es la lista completa de clientes (§13, decisión 12 y «Pendiente» 3) y va con esa etapa.
2. **«Eliminar todos los clientes»** (baja). La guarda de los bloques de clientes no deja guardar 0 clientes, así que los clientes siguen en la nube, pero el aviso dice «eliminados correctamente». Los equipos dañados, también los pendientes de TÉCNICOS, sí se van, ahora con su lápida en el acto (SIT-CLI). El guardado ya los borraba antes; la lápida solo cierra el hueco del snapshot. Queda para decidir con Elkin.

### Segunda revisión adversaria (16 oct 2026)

Después de los arreglos de la primera, otra pasada sobre lo nuevo, con dos lentes: las lápidas (el rescate cuando la transacción se repite) y el rescate por material. Igual que en la primera, cada hallazgo lo revisaron dos escépticos por separado, con las apps reales en el banco. Las reproducciones quedaron en `etapa4b/rev2` y los arreglos se probaron en `etapa4b/corr3`. Sus escenarios ya están en el banco (ver «El banco»).

**5 hallazgos: 3 confirmados y 2 dudosos.** Los 3 confirmados se corrigieron, solo en `INVENTARIO_PTOVISION.html`:

| Falla | Gravedad | Arreglo |
|---|---|---|
| Si la transacción del guardado se repetía y en la repetición la cuadrilla quedaba borrada (otra pantalla le puso su lápida), igual salían el aviso «NO SE BORRÓ» y la línea en el registro de la nube (LP-REINT) | baja | `_rescIntentoInv`, `_deshacerRescatesInv`, `_rescatesTrasGuardarInv` y el parámetro `enGuardado`: lo rescatado se deshace si el intento no se confirma, y el aviso sale después del commit (ver «Si la transacción se repite») |
| Unificar filas con 🧩 entre el clic y el guardado rescataba la cuadrilla sin que entrara ni saliera material: la firma era fila por fila (RS-UNIF: 10 + 5 → 15 + 0, con un aviso de una entrega que no ocurrió). Igual al renombrar una fila o cambiarle el tipo | baja | La firma por contenido: el total, los seriales y la bodega (ver «La firma») |
| Cuando la bodega se quedaba y sus cuadrillas sí se borraban, el aviso no decía que esas cuadrillas, con su material, ya no estaban (RS-REGLAB) | baja | El aviso y la línea nombran las cuadrillas que sí se borraron (regla (b)) |

**Dudosos, sin corregir.** Quedan como pendientes (ver «Pendiente», 3). En el banco están como informativos (ℹ): muestran el caso y nunca fallan (ver «El banco»).
1. **Lo que entró por un snapshot antes del clic, sin que la lista se repintara, se borra** (media). La firma «de la pantalla» sale de la memoria, no de lo que se ve. Los oyentes no repintan las listas, y el confirm de `delBodega` no dice nada del material. Si un snapshot metió material antes del clic y la lista seguía mostrando lo de antes, ese material se borra sin aviso. INFO-RS-NOREP-BOD: la pantalla muestra BODEGA DEP con 100 m; otra pantalla le devolvió 10 m y le entregó 20 m a su cuadrilla; al borrar, CABLE DROP queda en 2980 y no en 3010 (se pierden también los 30 m que no se veían). INFO-RS-NOREP-CUAD: la pantalla muestra 10 m y la cuadrilla ya tenía 40; al borrarla, CABLE DROP baja de 3010 a 2970: se van los 40 m, también los 30 que no se veían. Tiene que ver con que las listas no se repintan solas (§13, «Pendiente» 4).
2. **Una cuadrilla que otra pantalla mete (o crea) en la bodega mientras se borra queda apuntando a una bodega borrada** (baja). Pasa entre el clic y el guardado. La regla (a) no la cubre, porque esta pantalla no la borraba. INFO-RS-HUERF: otra pantalla pasa CUADRILLA A CARTAGENA (con 7 m) a BODEGA DEP mientras se borra; la bodega se borra y la cuadrilla queda en la nube con `bodegaId` de una bodega que ya no existe.

### Decisión abierta para Elkin

**¿Una bodega que se queda debe quedarse también con sus cuadrillas?** Hoy rige la regla (b): si la bodega se queda porque otra pantalla le metió o le sacó material, sus cuadrillas sin cambios **sí** se borran, con el material que tenían. El aviso y la línea del registro lo dicen («…; su cuadrilla "CUADRILLA DEPB" SÍ se borró, con el material que tenía»).

La otra opción: que la bodega que se queda arrastre a sus cuadrillas, y no se borre ninguna. Es más prudente con el material, pero deshace un borrado que la persona sí pidió. Si Elkin la escoge, hay que cambiar `_rescatesAlBorrarInv` y, en el banco, FX-BOD y RS-REGLAB, que hoy piden la regla (b).

### Pruebas

**`PRUEBAS.html`:** una prueba nueva en el grupo de INVENTARIO, después de la última «Etapa 4 ·»: «Etapa 4 · Un registro borrado no vuelve con un snapshot (venta, cuarto, cuadrilla, entrega, instalación, bodega)». Usa ids inventados (`E4L…`), sustituye `_fbSave`, `alert`, `confirm`, `prompt`, los repintados y `fixDB`, y lo devuelve todo en un `finally`, también el navegador (`e2FotoLS`/`e2RestaurarLS`). Los oyentes no se pueden llamar desde afuera: la prueba sigue sus pasos en el mismo orden y comprueba por texto que la app los da en ese orden. Tiene 16 condiciones: 13 de la primera construcción y la primera revisión, y 3 del paso 9, de la segunda revisión. Comprueba:
- `_lapidaRegistroInv` y `_unirTumbasEnEntranteInv`: la forma, sin repetir, siempre una lista nueva, la de la nube intacta, la poda a 15 días y `null`. Desde la primera revisión, las lápidas se ponen con `_lapidaRegistroInv`; una que la nube soltó por el tope (`TOPE`) no vuelve; y las que la nube ya trae salen de `_lapidasPorSubirInv`;
- la venta borrada con el eco del primer guardado en vuelo: llegan el snapshot de datos (sin la lápida) y el de historial (todavía con la venta); la venta no vuelve; borrarla otra vez dice «Esa venta ya no está en la lista…» y CABLE queda en 1050, con una sola lápida. `approveDeleteVenta` igual, y la solicitud sigue aprobada;
- por el oyente de historial, el cuarto y la entrega; por el de datos, la cuadrilla, la instalación y la bodega con su cuadrilla; lo nuevo de otra pantalla sí entra. `_aplicarNubeParcialInv`, por los dos lados;
- el rescate al guardar (paso 8, de la primera revisión). `_rescatesAlBorrarInv` vive dentro del `<script type="module">`, así que se ejerce como corre al guardar: `_fusionarConNubeInv(nube, historial)` y después `_fotoIdsRemotosInv(nube, historial)`. Se borran tres cuadrillas con `eliminarCuadrilla`. C1: otra pantalla le entregó conectores (de 5 a 8) y no se borra; vuelve con 8, sin lápida, fuera de las pendientes, con una línea en el registro y un solo aviso «NO SE BORRÓ» diferido que la nombra. C2: la nube la trae igual a la base; se borra. C3: esta pantalla la había puesto en 7 sin subir y la nube trae 7; se borra. Si el guardado se repite con la misma nube, no avisa otra vez. Al volver a borrar C1, se borra con una sola lápida;
- el camino del guardado (paso 9, de la segunda revisión). Cada intento hace lo mismo que la transacción: `_fusionarConNubeInv(nube, historial, true)` y después `_fotoIdsRemotosInv`. El commit se imita con `window._armarCopiaInv().dbCopy` y luego `window._rescatesTrasGuardarInv(copia)`. Mientras dura el paso, `setTimeout` está sustituido para atrapar y contar los avisos diferidos. Cuatro ramas:
  - **a)** Otra pantalla le entregó 3 conectores a C1 después del clic. C1 se rescata en el acto, con lo de la nube, sin lápida y con su línea, y no sale ningún aviso, ni inmediato ni diferido. La transacción se repite con una nube que ya trae la lápida de C1 (otra pantalla también la borró): C1 queda borrada, con una sola lápida, y su línea sale del registro (`_deshacerRescatesInv`). `_rescatesTrasGuardarInv` da 0 y no avisa;
  - **b)** Otra rama, con la misma nube: se borran C1 y C2 y la transacción se repite con lo mismo. C1 se vuelve a rescatar con UNA sola línea y C2, igual a la base, se borra. `_rescatesTrasGuardarInv` da 1 y sale un solo «NO SE BORRÓ», diferido, que nombra solo a C1. Llamarla otra vez da 0 y no repite el aviso;
  - **c)** Entre el intento y el commit llega un snapshot que ya trae la lápida (pasa en el modo prueba, donde el guardado espera a `prepareDbCopy`). Lo escrito ya no lleva a C1: `_rescatesTrasGuardarInv` da 0, sin aviso. Esta rama es la única que comprueba que solo se avisa de lo que quedó escrito;
  - **d)** La firma por contenido. `_firmaMaterialInv` no está en `window`, así que se comprueba por su efecto. C1 tiene dos filas de CABLE DROP (10 + 5) y una ONU con dos seriales. La cuadrilla se borra (no la rescatan) si otra pantalla renombra una fila y le cambia el tipo, unifica dejando una fila en 0 o quitándola, cambia el orden o escribe los seriales Huawei en el otro formato (`485754431234ABCD`, `hwtc-5678-ef01`). Se queda (la rescatan) si entrega (10 → 13), cambia un serial con la misma cantidad o pasa la cuadrilla a otra bodega;
- por texto, la lápida de cada equipo dañado en `eliminarTodosClientes` (no se corre: borra clientes y pide la clave);
- que `_escriturasBloqueadas` no crezca.

Contrapruebas:
- Con la copia de antes (`etapa4b/pre`), en su primera forma (12 condiciones), fallaba en 11: la venta vuelve y borrarla otra vez deja CABLE en 1100. También fallaba con 8 copias dañadas del arreglo (sin la unión; sin el filtro o con uno que cambia lo que llega; una unión o una lápida que cambia la lista que ya existe; sin la lápida de la venta, de las cuadrillas de la bodega o de los equipos dañados).
- Con la unión de la primera construcción (`fix_rev/INV_unionVieja.html`) falla en la unión: `TOPE` vuelve.
- Con una sola firma (`fix_rev/INV_unaFirma.html`) falla en el rescate: C3 se queda.
- Sin el rescate (`rev/tres_piezas/INV_pend.html`) falla en el rescate: C1 se borra con su material y sin aviso.
- Con la copia de antes de la segunda revisión (`pre_rev2`) falla en las 3 condiciones del paso 9, y solo en esas: no existe `_rescatesTrasGuardarInv`, el primer intento ya deja programado el aviso, la línea sigue aunque la repetición traiga la lápida y la firma rescata al renombrar, al unificar y con el otro formato del serial.
- Con 7 copias dañadas del arreglo de la segunda revisión, cada una falla en su condición: avisar en el acto, no deshacer el intento, no quitar la línea, no vaciar la lista tras el commit, avisar sin mirar lo escrito (lo ve la rama c), firmar con el nombre de la fila y firmar los seriales sin normalizar. Están en `etapa4b/pruebas_4c/mut`.

El paso 8 llama `_fusionarConNubeInv` sin `enGuardado` (lo decidido es final) y el paso 9 con `enGuardado` (el de la transacción que se repite y el aviso después del commit). La limpieza del `finally` vacía sin aviso lo que un intento haya rescatado sin commit (`_rescatesTrasGuardarInv(null)`) y devuelve el `setTimeout` original. Corrida sola, deja la página igual que antes: `DB`, `USER`, las listas en memoria, las funciones sustituidas, las lápidas por subir, `setTimeout` y el navegador.

Otra prueba que ya existía, «Etapa 4 · Aprobar una edición aplica solo lo que la bodega cambió…», deja dos lápidas por subir (`ventas│E4P_V1` y `ventas│E4P_V0`) en la lista en memoria. Pasa igual con la copia de antes. La limpieza de la prueba de la 4b las borra después, sin efecto en el resultado (ver «Pendiente»).

**El banco** (`inv/etapa4.js`, sección «Etapa 4b»). Se escoge con `'DEP*'`, con `'TP*' 'FX*' LEN-RACE` y con `'LP*' 'RS*' 'C3*'`. Los informativos, con `'INFO*'`.
- **DEP:** los 11 DEP-* de la investigación y 3 DEPX-* para los sitios que DEP-* no cubría (DEPX-CUAD, DEPX-BOD y DEPX-DAN, este con un equipo dañado). Lo que antes eran avisos ℹ «¿volvió?» ahora son comprobaciones: primero que el registro sigue en la nube, después que el snapshot llegó a la pantalla (por una marca suya) y solo entonces que el registro no volvió a la memoria. Al final, que no está en la nube, que tiene su lápida y, en las ventas, CABLE DROP en 1050. DEP-REBORRAR vuelve a abrir 💰 Ventas, porque los oyentes no repintan (leen `window.USER`, y `USER` es un `let`). DEP-CTRL y DEP-V2 son controles: pasan con las dos copias. Con la copia de antes pasan 2 de 14 (solo los dos controles); DEP-V1 y DEP-REBORRAR terminan con CABLE DROP en 1100. Con dos copias sin la unión, o con la unión después del `Object.assign`, fallan DEP-INST, DEPX-CUAD, DEPX-BOD y DEPX-DAN, en «ese snapshot NO devolvió el registro a la memoria».
- **«Revisión de la Etapa 4b»,** los 9 de la primera revisión:
  - TP-TOPE y TP-ROTA: tras el snapshot, la memoria de cada pantalla queda igual que la nube y cada guardado llega a escribir. En TP-TOPE, las 399 lápidas nuevas y la de la venta siguen en la nube y VTP1 no vuelve. En TP-ROTA, ningún guardado reescribe `_tumbas`.
  - FX-CUAD (la cuadrilla se queda con 30 m, sin lápida y con el total igual, con una línea en el registro y un solo aviso; volver a borrarla la borra con una sola lápida), FX-BOD, FX-BODCUAD, FX-MOVIDA, y los controles FX-CUAD-CTRL y FX-PROPIO, que se borran sin aviso ni línea.
  - FX-BOD se cambió después de la segunda revisión. Antes pedía que el aviso **no** nombrara la cuadrilla, justo lo que la segunda revisión corrigió. Ahora pide un solo aviso que diga «No se borró la bodega "BODEGA DEP"» y «su cuadrilla "CUADRILLA DEPB" SÍ se borró, con el material que tenía», y una sola línea «No se borró» en el registro de la nube, que también nombra esa cuadrilla.
  - LEN-RACE dejó de ser informativo. Es el mismo caso que FX-CUAD, pero con la nube **sin** su lista `_tumbas`, como la deja la semilla. Pide la cuadrilla con sus 30 m y sin lápida, el total de CABLE DROP igual, la entrega registrada, una línea en el registro y un solo aviso.

Los 9 de la primera revisión, corridos antes de la segunda revisión:

| Copia | Resultado |
|---|---|
| el repo de ese momento | 9 de 9 |
| la unión de la primera construcción (`fix_rev/INV_unionVieja.html`), TP-* | 0 de 2: 400 y 50 lápidas viejas vuelven a la memoria; en TP-ROTA los 20 guardados reescriben `_tumbas`; en TP-TOPE la nube pierde la lápida de la venta y VTP1 vuelve |
| sin el rescate (`banco4b/INV_sinRescate.html` y `rev/tres_piezas/INV_pend.html`), FX-* y LEN-RACE | 2 de 7 en las dos: pasan solo los controles (CABLE DROP en 2970 y 2980, la lápida puesta, sin aviso) |
| una sola firma (`fix_rev/INV_unaFirma.html`), FX-PROPIO | 0 de 1: sale «NO SE BORRÓ» y la cuadrilla no se borra |
| la v118 publicada (`pre`) | 2 de 9: pasan solo TP-TOPE y TP-ROTA (esa falla la trajo la primera versión del arreglo, no la v118). Los controles fallan por la falla que arregla la 4b: el snapshot devuelve la cuadrilla |

**«Revisión 2 de la Etapa 4b»,** después de LEN-RACE. Son los 13 escenarios de la segunda revisión, ya en el banco. Antes vivían en el scratchpad (`etapa4b/rev2/lapidas`, `rev2/rescate` y `corr3/c3`), y al pasarlos se endurecieron sus comprobaciones:
- **LP-REINT:** el admin borra una cuadrilla vacía; otra pantalla le entrega 30 m antes de que su guardado lea; el guardado la rescata y su escritura queda detenida; en ese rato otra pantalla la borra. La transacción se repite y la cuadrilla queda borrada: ningún aviso mientras el commit espera, ni después, y ninguna línea «No se borró».
- **LP-DOS:** dos pantallas borran a la vez (A una venta, B una cuadrilla). En la nube quedan las dos lápidas y CABLE DROP en 1050, y los 6 guardados siguientes escriben sin reescribir `_tumbas`.
- **RS-UNIF, C3-UNIF-CLAVE y C3-RENOMBRA:** entre el clic y el guardado, otra pantalla unifica dos filas con 🧩 (CABLE DROP 10 + 5; o «TV BOX» 5 y «TVBOX» 3), o renombra una fila y la pasa a usado. No entró ni salió material: la cuadrilla se borra como siempre. Comprueban que la nube ya tenía ese cambio antes de la lectura, y piden una lápida, ningún aviso, ninguna línea «No se borró» y que la pantalla ya no tenga la cuadrilla.
- **RS-REGLAB:** la regla (b). Se borra BODEGA DEP (100 m) con su cuadrilla (25 m) y otra pantalla le devuelve 10 m a la bodega. Pide el texto exacto del aviso y de la línea, la bodega con 110 m y sin lápida, la cuadrilla con una lápida y CABLE DROP en t0 + 10 − 25.
- **RS-REINT:** la transacción ya leyó (sin cambios) y su escritura se detiene; otra pantalla le entrega 30 m a la cuadrilla; el commit choca y se repite. En la repetición la cuadrilla no se borra: 30 m, sin lápida, el total igual, la entrega registrada, la cuadrilla otra vez en memoria, un solo aviso y una sola línea.
- **C3-REINT-AJENO:** el primer intento rescata la cuadrilla y su commit se detiene; un técnico escribe otra cosa en `inventario/datos`; la transacción se repite y el rescate se mantiene: 30 m, un aviso y una línea.
- **C3-REINT-POR:** se borra una bodega vacía con su cuadrilla; otra pantalla le entrega 20 m a la cuadrilla; el primer intento rescata las dos y su commit se detiene; otra pantalla borra la cuadrilla con su lápida. En la repetición la cuadrilla y la bodega quedan borradas, sin aviso y sin línea.
- **RS-DOS:** dos admins (A y B) borran la misma cuadrilla, con sus guardados detenidos; otra pantalla le entrega 30 m. La cuadrilla sigue, con 30 m y sin lápida; B también avisa, cada pantalla una sola vez, y quedan 2 líneas en el registro.
- **RS-TEC:** el técnico devuelve 10 m desde TÉCNICOS (abierto solo en el Chromium del banco, con la nube simulada) mientras se borra la cuadrilla. El snapshot llega; la cuadrilla no se borra (40 m, sin lápida); el recuperado queda apuntando a ella; un aviso con su nombre y una línea.
- **C3-POR-HERMANA:** una bodega con dos cuadrillas vacías; se borra la bodega y otra pantalla le entrega 20 m a una. Esa cuadrilla (CUADRILLA DEPB, con 20 m) y la bodega se quedan; la otra se borra. Un solo aviso, que lo dice, el total igual y la memoria correcta.
- **C3-SERIAL:** se borran dos cuadrillas con una ONU cada una. Otra pantalla le cambia la ONU a la primera (otro serial, misma cantidad) y a la segunda le reescribe el mismo serial en el otro formato. La primera se queda, con la ONU nueva en la nube; la segunda se borra con su lápida. Un solo aviso, una sola línea y la memoria correcta.

Los dos dudosos de la segunda revisión van como **informativos**: INFO-RS-NOREP-BOD, INFO-RS-NOREP-CUAD e INFO-RS-HUERF (ver «Segunda revisión adversaria»). Se registran con `escenarioInfo`, no corren con «todos» ni con un patrón que no empiece por INFO, sus comprobaciones dudosas salen con ℹ («se cumple» o «NO se cumple (dudoso, sin arreglar)») y nunca hacen fallar. No cuentan en el total ni en el código de salida: el resumen dice «(+ N informativos ℹ, que no cuentan)». Con el repo, los tres muestran que los dos dudosos siguen sin arreglar.

FX-BOD y los 13 de la segunda revisión, contra cada copia:

| Copia | Resultado |
|---|---|
| el repo | 14 de 14 (135 s) |
| antes de la segunda revisión (`pre_rev2`) | 5 de 14. Fallan FX-BOD, LP-REINT, RS-UNIF, RS-REGLAB, C3-REINT-POR, C3-POR-HERMANA, C3-UNIF-CLAVE, C3-RENOMBRA y C3-SERIAL. Pasan los 5 controles: LP-DOS, RS-REINT, RS-DOS, RS-TEC y C3-REINT-AJENO |
| la v118 publicada (`pre`) | 1 de 14. Fallan todos menos LP-REINT, también los 5 controles |

Cada escenario nuevo falla con al menos una de las dos copias. LP-REINT pasa con la v118: allí el snapshot devuelve la cuadrilla a la memoria y la otra pantalla la borra igual, así que no hay aviso que sobre. Solo falla con `pre_rev2`.

Siguen fuera del banco LEN-MIX (`etapa4b/rev/lente_etapas/escenarios_len.js`) y SIT-RET, SIT-RET2 y SIT-CLI (`rev/sitios/esc_sitios.js`, los dudosos de la primera revisión).

**Corridas:**
- Antes de la segunda revisión: `etapa4` completo **93 de 93** (los 84 de antes y los 9 nuevos, 613 s, 0 errores de JavaScript); `PRUEBAS.html` completo: 178 corridas (Firma no se abre), 177 bien; falla solo «Rastreador v314: la ficha de una factura REAL de WispHub…», que lee una factura que la WispHub simulada no tiene, como siempre. 0 errores de página y 0 escrituras en la base simulada. Con la primera construcción, además, `etapa2` 25/25 y `revision_oct` 11/11.
- Con la INVENTARIO de después de la segunda revisión, antes de poner al día el banco y `PRUEBAS.html`: `etapa4` 92 de 93 (607 s; fallaba FX-BOD, que pedía lo que la segunda revisión corrigió; ya se cambió); `etapa3` **39 de 39**, SR-D5 incluido; `etapa2` **25 de 25**; `PRUEBAS.html`, grupo de INVENTARIO, **60 de 60**, 0 errores de página y 0 escrituras.
- Con el banco al día (INVENTARIO sin cambios): `etapa4` completo **106 de 106**, dos veces (736 s y 734 s), 0 errores de JavaScript y 0 excepciones. Los 3 INFO-* no corren con «todos». INVENTARIO (v118) y TÉCNICOS (v102) tenían el mismo md5 antes y después.
- Con `PRUEBAS.html` al día (INVENTARIO sin cambios): completo, 178 corridas de 179 (Firma no se abre), **177 bien**; falla solo «Rastreador v314…», como siempre. 0 errores de página y 0 escrituras en la base simulada. La prueba de la 4b, sola, pasa y deja la página igual que antes.
- **Corrida final, 16 y 17 oct 2026 (11:55 p. m. a 12:44 a. m.), con los archivos finales.** El banco completo, en orden: `pantallas_unit` 216/216, `recarga_unit` 167/167, `unit_v112` 50/50, `revision_oct` 11/11, `repro` 21/21, `escenarios2` 20/20, `etapa1` 16/16, `etapa6` 13/13, `etapa2` 25/25, `etapa3` 39/39 y `etapa4` **106/106**. Contraprueba con la v118 publicada (`--html=` la copia `etapa4b/pre`): 76 bien y 30 mal. Pasan todos los de la Etapa 4 (ya publicada), los controles (DEP-CTRL, DEP-V2), los que prueban fallas que solo tuvo la primera corrección de esta entrega (TP-TOPE, TP-ROTA, LP-REINT) y DEP-ECO, que es una carrera y no siempre se da con la v118 (DEP-V1 sí la atrapa siempre). **`PRUEBAS.html` en el navegador contra la base real** (`?prueba=1`): **177 bien y 2 por revisar** de 179, las dos «Estado real» de siempre (los seriales en dos sitios bajaron de 36 a 33). Después se miró la nube por REST (solo lectura): la última escritura en `inventario/datos`, `main` y `logs_auditoria` es de la tarde del 16 oct, de pantallas reales. Ninguna de las pruebas.

**Validación:** `node .claude/validar.mjs` da sintaxis correcta en INVENTARIO (4 bloques) y PRUEBAS (1). Los dos en CRLF, sin LF ni CR sueltos. `inv/etapa4.js` va en LF, como el resto del banco, pasa `node --check` y tiene 3646 líneas. `APP_VERSION_INV` sigue en 118.

### Pendiente

1. **Hecho:** la corrida final con los archivos finales (ver «Corridas»).
2. **En el banco:** llevar LEN-MIX.
3. **Los dos dudosos de la segunda revisión, sin arreglar** (ver «Segunda revisión adversaria»):
   - lo que entró por un snapshot antes del clic, sin que la lista se repintara, se borra sin aviso (INFO-RS-NOREP-BOD e INFO-RS-NOREP-CUAD);
   - una cuadrilla que otra pantalla mete en la bodega mientras se borra queda apuntando a una bodega borrada (INFO-RS-HUERF).

   Si se arreglan, esos tres pasan de informativos a escenarios que cuentan.
4. **Decidir con Elkin:**
   - si una bodega que se queda arrastra también a sus cuadrillas (regla (b); ver «Decisión abierta para Elkin»). Cambiaría `_rescatesAlBorrarInv`, FX-BOD y RS-REGLAB;
   - si se arreglan los dos dudosos de la segunda revisión (punto 3);
   - los dos dudosos de la primera revisión: el aviso de «Eliminar todos los clientes» y el retiro de un cliente con equipos, que va con la etapa de la lista completa de clientes.
5. **En `PRUEBAS.html`:** revisar la prueba «Etapa 4 · Aprobar una edición aplica solo lo que la bodega cambió…», que deja dos lápidas por subir en memoria (ver «Pruebas»). No cambia ningún resultado.
6. **OFICINAS:** revisar si en `_protegerLocalesEnSnapshot` un borrado también vuelve con un snapshot.
7. **Al publicar** (cuando Elkin diga «publica»):
   - INVENTARIO 119 **solo**, fuera de horario, con el respaldo de datos de la Etapa 1 antes;
   - TÉCNICOS, OFICINAS y RED no cambian: no hay que pedir a los técnicos que actualicen;
   - recargar las pantallas de bodega: una v118 abierta convive, pero sus propios borrados siguen con la carrera hasta recargarse;
   - probar un caso real: borrar una cuadrilla vacía de prueba con otra pantalla abierta, ver que no vuelve y que su lápida queda en `_tumbas`.
