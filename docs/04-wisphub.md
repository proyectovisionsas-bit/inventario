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

### Volumen real y filtros de la API (medido el 17 Ago 2026)

Los topes de paginación **no son un problema**, contra lo que se advirtió antes.
Se aplican **por cuenta**, y estas son las cifras reales:

| Cuenta | Oficinas | Facturas | Clientes |
|---|---|---|---|
| #1 | YESCENIA | 940 | 793 |
| #2 | ESNEIDER + NATALIA | 3.799 | 2.348 |
| #3 | THOMAS | 1.077 | 743 |

La cuenta mayor usa **3.799 de 60.000** facturas (6%) y **2.348 de 15.000**
clientes (16%). WispHub no acumula el histórico completo, así que la
estimación de "32.500 facturas al año" que motivó la alarma era falsa.
El aviso de truncamiento de la v231 se queda como red de seguridad: no cuesta
nada y solo aparecería si la situación cambiara mucho.

**Filtros de fecha que acepta `/api/facturas/`** (probados contra la API real):

| Filtro | ¿Funciona? |
|---|---|
| `fecha_emision=YYYY-MM-DD` | sí, fecha exacta |
| `fecha_vencimiento=YYYY-MM-DD` | sí, fecha exacta |
| `fecha_pago=YYYY-MM-DD` | sí, fecha exacta |
| `fecha_emision__gte=...` (rangos) | **no, lo ignora** |

Solo fecha exacta: **no hay rangos**. Si algún día se hace el refresco
automático de cartera, hay que ir día por día como ya hace
`_wisphubTraerDiaPagos`, no con un rango.

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

## Una factura de WispHub, un solo pago (OFICINAS v310, 17 Sep 2026)

Elkin: "está duplicando pagos, trae pagos hechos en WispHub y los refleja 2
veces en el registro diario". En la nube había 6 facturas con 2 y 3 copias
idénticas (NATALIA, ESNEIDER), todas desde el 15 de septiembre.

**Causa.** La sincronización rápida corre cada 12 minutos en cada pantalla
abierta (la del administrador sincroniza todas las oficinas). Dos sesiones que
sincronizan la misma oficina con segundos de diferencia creaban el mismo pago
con ids distintos (`uid()`), y la fusión entre sesiones de la v296/v305
(`_fusionarMovsAlCargar`), que compara por id, conservaba las dos "creaciones
en vuelo". Antes de la v305 el mismo choque terminaba en pisada, por eso no se
veía. La búsqueda `existe` por número de factura solo mira la memoria de la
pestaña; nunca hubo comparación por factura entre sesiones.

**Arreglo, dos capas.**

1. `_idMovWisphub(oid, numero)` → `wh_<oficina>_<factura>`. Los tres lugares
   que crean pagos de WispHub (`_aplicarPagosWisphub`,
   `_aplicarPagosWisphubEnMemoria`, `registrarPagosFaltantes`) lo usan. Dos
   sesiones producen el MISMO registro y la fusión por id ya lo junta. Lleva la
   oficina porque el número de factura es la secuencia de cada cuenta WispHub y
   una cuenta compartida puede llevar la misma factura a dos oficinas.
2. Red de seguridad determinista, `_unirMovsPorFactura(oid, lista)` (pura):
   agrupa por factura los ingresos con `origen:'cierre_wisphub'` de la misma
   oficina; sobrevive el id lexicográficamente menor (depende solo de los ids,
   así todas las sesiones eligen igual y no hay ping-pong); las demás se
   absorben (`_absorberMov`: comprobantes, marcas, edición del admin; si
   CUALQUIER copia estaba anulada la unida queda anulada, con `_anuladoEnCopia`:
   un pago reversado nunca vuelve a contar solo) y quedan en `_unidoDe`. La
   superviviente es un CLON: la lista que llega de la nube no se muta, así la
   base (`_guardarBaseMovs`) sigue retratando la nube y la copia unida cuenta
   como "tocada" hasta que se guarda. Si alguna copia con la
   misma factura NO cumple la clave (origen distinto, egreso), el grupo es
   "dudoso" y no se toca. Se aplica en la carga sin base, en la fusión (la
   creación local cuya factura ya está en la nube se vierte ahí; un id ya unido
   que la nube vuelva a traer se vierte en la superviviente vía
   `_redirMovsUnidos`; si la superviviente ya se borró, con lápida o en otra
   sesión, la copia tampoco revive) y en el paso 0 de `_saveReal`, antes de
   firmar los bloques. Al borrar un pago, la lápida cubre también sus
   `_unidoDe`. Si al unir la oficina queda con un bloque menos que la nube,
   `_encogeExplicado` deja pasar GUARDA 2 (el encogimiento está explicado por
   `_quitadosPorUnion`, que se reinicia al confirmar el guardado) y los
   bloques sobrantes se escriben VACÍOS en el mismo lote, porque el cargador
   también lee más allá del índice y los sumaría. Una factura repetida con una copia que no viene de
   WispHub ("dudosa") no se toca y se avisa una vez en consola. `_aplicarUnionesFactura` deja registro `DUPLICADO_FACTURA_UNIDO`
   (una vez por copia, con `creadoMs` sacado del uid), mueve `_compImgCache` y
   re-apunta las solicitudes pendientes.

Además: la sincronización rápida aplica sobre la oficina viva (`oVivo`; un
snapshot podía reemplazar el objeto mientras se esperaba a WispHub y el pago
caía en una lista huérfana: log `creados:1` sin movimiento), y salta oficinas
con carga incompleta; `eliminarMovimiento` y `_eliminarDuplicado` dejan lápida;
`registrarLog` anota `pestana` (sessionStorage) y `version` para distinguir
dos pestañas o un F5 de la misma persona.

**Limpieza de lo que ya estaba.** No hace falta borrar a mano: la primera
sesión v310 une las copias al cargar y su primer guardado reescribe una vez el
bloque afectado. NO usar "borrar selección por fecha" sobre una copia: anota
`facturaWisphub` en `borradosPermanentes` y `_aplicarBorradosPermanentes`
quitaría también la copia buena.

**Lo que sigue igual.** Admin y oficinas siguen consultando WispHub por la
misma oficina cada 12 minutos (lectura duplicada de la API, sin candado entre
sesiones); el pago nuevo tarda en llegar a la nube mientras se concilian
clientes (`diferirGuardado`); `modalDetectarDuplicados` agrupa por fecha y valor
(falsos positivos) y su "Fusionar" exige exactamente 2.
