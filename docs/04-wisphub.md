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

## Pagos de facturas viejas: el rastreador rehecho (OFICINAS v314, 24 Sep 2026)

Elkin: "cuando pagan una factura muy vieja no la sincroniza, es más no muestra
el ingreso en el día".

**Por qué pasa.** WispHub no devuelve en sus listados las facturas emitidas
fuera de su ventana (unos dos meses) ni las de servicios archivados, **ni
siquiera filtrando por `fecha_pago`** (comprobado el 20 ago 2026 con la #13313).
La sincronización rápida pregunta por fecha de pago, así que un pago de una
factura vieja nunca le llega. Solo la ficha directa `/api/facturas/<n>/` la
entrega. Eso lo resolvía el rastreador de la v248, pero medido con los datos
reales del 23 sep tenía cuatro fallas:

1. **Cola vieja.** Se armaba una sola vez, cuando estaba vacía. Como las
   facturas sin pagar vuelven siempre a la cola, nunca se vaciaba y no se volvió
   a armar: lo que salió del listado después jamás entró. El barrido manual
   conocía 366 pendientes viejas de Cartagena que el rastreador no vigilaba,
   107 de Florencia, 90 de Paujil y 41 de Montañita.
2. **Sin rescate.** Filtraba solo por zona. El que paga una factura vieja suele
   ser un retirado, y WispHub le quita la zona al retirado: se botaba callado.
3. **Oficina huérfana.** Aplicaba sobre la oficina tomada al empezar; si
   mientras revisaba otra pantalla recargaba, el pago quedaba en una copia que
   nadie guardaba.
4. **Trabajo repetido.** Todas las pantallas hacían la misma revisión: Paujil
   llevaba 352.009 consultas para vigilar 258 facturas.

**Cómo quedó** (`_revisarHuecosWisphub`, cada 20 min, `_programarRevisionHuecos`):

- **Un turno por cuenta** (`oficinas_sistema/rastreo_turnos`, transacción, 25
  min, se renueva cada vuelta). Solo una pantalla revisa cada cuenta; si se
  cierra, otra lo toma al vencerse. Una versión más nueva le gana el turno a una
  vieja. Una pantalla con movimientos o clientes a medio cargar
  (`_datosListosRastreo`) ni lo pide, y si una vuelta termina sin poder aplicar,
  lo suelta (`_soltarTurnoRastreo`). En modo prueba no se escribe el turno.
- **Estado propio por cuenta** (`oficinas_sistema/rastreo_wisp_<cuenta>`), en
  rangos compactos ("1-5,9,12-40"): `resueltos` (solo crece), `pend` (viejas
  sin pagar), `urgentes`, `descubrir`, `sinAsignar`, `cursor`, `listadoN`,
  `rangoMin/Max`, `maxExiste`. Se escribe en transacción que une con lo de la
  nube (`_fusionarRastreo`, pura). Con los datos reales pesa entre 1 y 6 KB por
  cuenta. **Nada de esto va en el documento principal.**
- **La cola de cada vuelta** (`_planVueltaRastreo`, pura): urgentes → lo que se
  salió del listado o es oculta nueva (todo número ≤ máximo que no esté en el
  listado ni en ninguna lista) → 30 "sin oficina" a re-verificar → pendientes
  viejas por turno fijo (`_turnoRastreo`: cada número cae en uno de 3 turnos, así
  cada una se mira una vez por hora aunque la lista crezca) → 400 nunca
  revisadas, de la más nueva a la más vieja. La primera vez siembra `descubrir`
  con todo lo desconocido (Paujil ≈ 81.000 números: unos días de fondo;
  Cartagena ≈ 25 vueltas; Florencia 7; Montañita 2). Semilla: la caché del
  barrido manual ('no' → resueltos; 'ok' → resuelto SOLO si ese pago ya está en
  la nube según `_baseMovs`, urgente si solo está en memoria y revisar si no está
  en ninguna caja; 'pend' → pend; 'asig' → urgentes) y la cola vieja
  `config._huecosWisp` (se sigue leyendo, ya no se escribe).
- **Listado recortado:** si llega menos del 90 % de la vuelta anterior no se usa
  para buscar desaparecidas en esa vuelta, pero queda como referencia: si la baja
  era real (la ventana soltó un lote), la vuelta siguiente las mira. Si no llega,
  igual se vigila lo conocido. En mantenimiento no escribe su estado.
- **Hacia arriba:** después del último número conocido, hasta 12 inexistentes
  seguidos (ocultas nuevas).
- **Ficha** (`_fichaFacturaWisp`): solo se acepta si trae el mismo número que se
  pidió; una respuesta rara es "fallo" (se reintenta), nunca "no existe". Un 404
  por encima del máximo tampoco es "no existe".
- **Reparto** (`_repartoRastreo`, síncrono, sobre las oficinas **vivas**): lo que
  ya está en la caja de cualquier oficina de la cuenta no se repite; mismas
  reglas que la sincronización (`_filtrarPorZonaOficina` +
  `_rescatarFacturasDeMisClientes`, guardando y restaurando
  `window._sinAsignarWisp`). Si alguna oficina o los clientes no terminaron de
  cargar, no se decide nada: todo queda urgente para la vuelta siguiente.
- **Prudencia:** no entra solo a la caja lo que reclaman dos oficinas, lo que no
  reclama ninguna, lo que no trae `fecha_pago` y lo pagado hace más de
  `RASTREO_DIAS_AUTO` (35) días. Eso queda en **"Pagos sin oficina"**.
- **Primero la nube, después "resuelto":** se guarda (`save`) y solo si el
  movimiento quedó en `_baseMovs` (lo que la nube tiene) la factura pasa a
  resueltas; si no, queda urgente y se vuelve a mirar sin duplicar.
- **Avisos:** toast con oficina, valor y, si el pago quedó en un día anterior, su
  fecha. Auditoría: `PAGOS_OCULTOS`, `PAGOS_TARDIOS`, `PAGOS_SIN_OFICINA`,
  `PAGOS_SIN_OFICINA_METIDOS`, `PAGOS_SIN_OFICINA_DESCARTADOS`.

**"Pagos sin oficina" (solo admin).** Franja en el Dashboard y botón en el
Registro (`modalPagosSinAsignar`). Agrupado por cuenta, motivo y la oficina que
WispHub sugiere (ya escogida en el selector del grupo); si se escoge otra, avisa
antes. Se marcan y se meten a la caja de una oficina de esa cuenta (con su fecha
real de pago; si WispHub no la trae, la escribe quien los mete, nunca la de
emisión; sin repetir lo que ya esté en alguna caja; lo que esté en "borrados para
siempre" no entra) o se descartan con motivo. Si mientras tanto se abrió otra
ventana, la lista no se le pinta encima. La lista guarda solo lo mínimo de cada factura
(`_stubFacturaWisp`, zona vacía = `null` para que el rescate la siga viendo "sin
zona"); máximo 500 por cuenta, lo que no cabe vuelve a vigilarse.

**Lo que las sincronizaciones le entregan al rastreador**
(`_rastreoEntregarUrgentes`): la rápida y la completa le pasan lo pagado que
ninguna oficina de la cuenta reclama (`_pagadasSinDueno`) en vez de botarlo; la
completa, además, lo recuperado que no tomó nadie, que antes quedaba `'libre'`
(definitivo: ni la otra oficina lo recibía) y ahora queda `'asig'`.

**Otros arreglos de la misma versión**

- `_soltarSync` olvida el "⛔ Cancelar": antes la bandera quedaba en true hasta
  abrir otra sincronización y la automática fallaba callada hasta recargar.
- `_valorCobradoWH` reemplaza `total_cobrado || total` en todos los caminos: un
  cobro de 0 (saldo a favor) ya no se vuelve el total de la factura.
- La sincronización rápida pide los días en hora de Colombia (`_diaLocalISO`).
- `_pestanaDesactualizada()`: si ya hay otra versión publicada, la pantalla no
  corre la sincronización automática ni el rastreador (`?ignorarVersion` la deja).
- Sincronización completa: tras confirmar se aplica sobre la oficina **viva**; los
  "conocidos" del barrido son solo de las oficinas de la **misma cuenta** (los
  números son la secuencia de cada cuenta); se salta lo que el rastreador ya dejó
  resuelto.
- Conciliación automática de clientes: no corre con los clientes a medio cargar,
  usa las oficinas vivas y actualiza estados con la lista completa de la cuenta
  (como la manual desde la v214).
- `_acotarGapsFacturas` conserva primero 'ok', 'pend' y 'asig'.

**Pruebas:** cinco nuevas en PRUEBAS.html (una lee una ficha real de WispHub, solo
lectura). Fuera del repo se corrieron 76 escenarios con las funciones reales y
WispHub/Firestore simulados, y la app completa en Chromium (32 comprobaciones,
cero errores de JavaScript, en admin, oficina y modo prueba). La revisión
independiente (subagente) encontró seis fallas antes de publicar, todas
corregidas y con prueba: la referencia del 90 % que podía dejar ciego al
rastreador, pagos de una oficina metidos en otra desde el modal, el turno retenido
por una pantalla a medio cargar, la fecha de emisión en pagos sin fecha de pago,
los 'ok' de la caché aceptados sin estar en la nube y el modal pintado encima de
otra ventana.

**Las otras apps (antes de publicar, 24 Sep 2026).** Inventario, Técnicos, Red y
Firma SST no cambian en esta versión, pero comparten la base con OFICINAS, así que
también se probaron sobre una base Firestore simulada y COMPARTIDA (lo que una app
escribe, la otra lo lee), con datos inventados:

- La tanda completa de `PRUEBAS.html` (Inventario 19, Red 29, Firma 1, OFICINAS
  64 + 5 nuevas) con OFICINAS v313 y con v314: ninguna empeora, cero errores de
  JavaScript y cero escrituras (el modo prueba de las apps bloquea todo).
- Una trayectoria de punta a punta con escrituras reales en la simulación:
  OFICINAS v314 crea una orden de instalación → TÉCNICOS la acepta y la finaliza
  con una ONU → OFICINAS guarda con una copia VIEJA en memoria mientras el
  rastreador mete un pago de factura vieja (la orden sigue finalizada: la fusión
  de la v220 funciona con la v314) → INVENTARIO confirma el consumo (la cuadrilla
  baja a 2 ONU sin el serial instalado y la ONU queda en la ficha del cliente) →
  RED, OFICINAS y TÉCNICOS recargan y ven todo. 22 comprobaciones, cero errores;
  ninguna app anunció versión desde la prueba.
- Riesgo que ya existía (no es de esta versión): TÉCNICOS no tiene modo prueba.
  `PRUEBAS.html` lo abre con `?prueba=1` creyendo que no escribe, pero a los 600 ms
  escribe `app_version_tecnicos` si su versión es MAYOR que la de la nube (sin
  guarda de localhost). Con la versión publicada no pasa nada; probar en local una
  TÉCNICOS nueva con PRUEBAS bloquearía a todos los técnicos. Pendiente: darle la
  misma guarda que OFICINAS (`_esEntornoLocal`) y un modo prueba de verdad.
- Otro que ya existía: la prueba «Un comprobante viejo subido hoy se anota…»
  falla igual con v313 y v314. Es el Apps Script `REVISION_SOPORTES.gs`:
  `REV_debeContinuar(48,35,true,0)` da `false` y la prueba espera `true` (con
  Gemini saturado la noche se acaba en vez de esperar y volver). Revisar si la
  copia del repositorio es la que está publicada en Apps Script.

## Consulta de clientes de otras oficinas (OFICINAS v317, 30 Sep 2026)

Elkin: "que las oficinas puedan consultar información de clientes de las otras
oficinas […] escribe el nombre del cliente y si el cliente existe en alguna de
las otras oficinas se lo muestra, con toda la información, al día, debe,
cuánto, todo (sin que esto altere o modifique valores de su propia oficina)".

**Decisiones de Elkin (30 sep 2026).**

- Cada oficina busca en las otras; el administrador, en las cinco. La propia
  no sale: esa se consulta en Clientes, y si se pide su ficha la app lo dice
  («Esa es tu oficina: búscalo en Clientes»). SG-SST no ve la pestaña
  (`setupNav` ya la oculta).
- Cada ficha abierta deja un registro `CONSULTA_OTRA_OFICINA` **sin datos del
  cliente**: «YESCENIA consultó un cliente de THOMAS», o «Administrador
  consultó un cliente de …». Buscar no deja registro. Ni nombre ni cédula,
  porque `logs_auditoria` se lee sin autenticación desde internet.

**Dónde está.** Pestaña «🔎 Otras oficinas» en el grupo 🛒 Comercial
(`data-tab="consulta_clientes"`, `renderConsultaClientes`), registrada en los
dos mapas `renders`: el de `navigate` y el de `_recargarVistaSilenciosa`. Un
snapshot la vuelve a pintar sin perder lo escrito (`window._consQ`).

- **Buscador** (`consBuscarInput`, espera 250 ms): nombre sin tildes y con las
  palabras en cualquier orden (`_normalizarNombre`), cédula o teléfono con o
  sin puntos, espacios o guiones (solo dígitos; basta una parte), servicio o
  IP. Un teléfono copiado de WhatsApp, con `+57` o con paréntesis, también
  sirve (para el teléfono se quita el 57 si quedan 12 cifras). El servicio o
  la IP exactos van primero: una IP corta (terminada en `.1`) está dentro de
  muchas otras. Mínimo 3 caracteres; muestra 20 y dice cuántos hay en total.
  Una cédula que está en dos oficinas sale dos veces, cada una con su
  oficina (hoy hay 20 casos). Incluye los retirados; la ficha lo dice
  («Retirado en WispHub»).
- **Ficha** (`modalConsultaCliente`): ventana nueva de solo lectura. **No se
  reutiliza `modalVerCliente`**, porque sus botones escriben (comisión, crear
  orden, editar, «Antes de llamar al ingeniero»). Arriba y grande: «✅ Al
  día», «🔴 Debe N factura(s) · $X · mora de D días» o «⚪ Sin cartera
  registrada», con «Cartera actualizada el …» y la tabla de pendientes
  (número, emisión, vencimiento, valor). Después, los datos del cliente, el
  alta en WispHub, los últimos 5 pagos y las órdenes abiertas. El pie solo
  tiene «Cerrar».

**De dónde sale cada dato.** No se lee nada nuevo de la nube: una sesión de
oficina ya tiene en memoria los clientes, los movimientos y la cartera de las
cinco oficinas (`_cargarClientesChunks` y `_cargarMovimientosChunks` no
filtran por rol).

| Dato | Fuente | Cómo se une |
|---|---|---|
| Cliente | `o.clientes`, la lista comercial (4.233 clientes) | id de oficina + id de cliente |
| Al día, debe, cuánto, mora | `DB.facturasHistorial`, la cartera (3.416 servicios, global, llave `<oficinaId>::<id_servicio>`) | `o.id + '::' +` la parte final de `c.llaveWisphub`; sin llave, los servicios de esa oficina con la misma cédula en dígitos (puede haber varios); con llave y sin ese servicio en la cartera, «Sin cartera registrada»: no se toma otro servicio de la misma cédula |
| Últimos pagos | la caja de esa oficina | `_indicePagosPorCedula(o)`: cédula en dígitos → ingresos de WispHub no anulados (`cedulaWisphub`) |
| Alta en WispHub | instalación y primer pago | `_altaWisphubDe` |
| Órdenes abiertas | `DB.ordenesTrabajo` | cédula o `clienteId`, como `modalVerCliente`; sin `finalizada` ni `cancelada`, máximo 6 |

- Unir por `c.servicioWisphub` no sirve: casi nunca coincide. Por
  `llaveWisphub` coincide con todo el historial de cada oficina (medido).
- `c.estadoPago` no se usa: lo escribe `_actualizarPagosClientes`, que no
  acierta (ver «Fallas viejas encontradas de paso»).
- La mora se calcula en la consulta (`_consEstadoCuenta`): días desde el
  vencimiento más antiguo de las pendientes ya vencidas. El `diasMora`
  guardado no se usa: vale 0.
- La cartera **envejece**: solo la ponen al día los botones manuales y el
  Excel, no la sincronización rápida (ver «La sincronización automática»).
  Medido: `actualizadoEn` con mediana de 8 días y máximo de 104. Por eso la
  ficha dice la fecha y trae el botón de verificar.
- Los pagos registrados a mano no traen cédula y no salen; los de WispHub la
  traen en el 94–100 %.
- Si los clientes (`_clientesCargadosOk`) o los movimientos de esa oficina
  (`_cargaCompletaPorOficina`, `_cargaMovsIncompleta`) no terminaron de
  cargar, la pantalla lo dice y no fuerza una recarga.

**Por qué es pura.** El primer `save()` de cada sesión reescribe los clientes
de TODAS las oficinas comparando una firma (`_sigClientes`, en `_saveReal`), y
`oficinas_sistema/main` se arma con todas las claves de `DB`. Si la consulta
tocara una sola propiedad de un cliente ajeno, la oficina que consulta la
subiría a la nube en su siguiente guardado, sin aviso. Por eso:

- no asigna ni agrega nada a clientes, movimientos, servicios de la cartera,
  órdenes u oficinas, y nunca ordena un arreglo de `DB` en su sitio
  (`.slice()` antes);
- no crea claves en `DB`: la caché de búsqueda vive en
  `window._consultaIdx[<oficina>]` y vale mientras `o.clientes` sea el mismo
  arreglo con la misma cantidad (como `_revParesCache` de la v313); al
  reutilizarla rehace la entrada de cada cliente cuyo nombre, cédula,
  teléfono, servicio o IP cambió en su sitio (editar un cliente o la
  sincronización no cambian el arreglo);
- entrega copias para pintar, y todo dato de la base pasa por `esc2`;
- busca la oficina por id en cada pintado, porque el snapshot de `main`
  reemplaza los objetos oficina, y nunca pasa un id vacío a `getOficina`
  (caería en la oficina propia);
- no muestra ni copia `password`, `zonasWisphub`, `contratoConfig` ni
  `responsable` de la oficina;
- no llama:
  - guardado y recargas: `save`, `_saveReal`, `_fusionarConNube`, `load`,
    `_cargarClientesChunks`, `_cargarMovimientosChunks`,
    `_cargarFacturasChunks`;
  - WispHub: ningún `sincronizar*` ni `_conciliar*`, `conciliarOficina`,
    `aplicarConciliacion`, `_actualizarEstadosClientesWisphub`,
    `_aplicarPagosWisphub*`, `registrarPagosFaltantes`,
    `_aplicarFacturasWisphub`, `_wisphubTraer*`, ni el candado
    `_tomarSync`/`_soltarSync`;
  - cartera y recogidas: `_actualizarPagosClientes`, `_generarRecogidasAuto`;
  - pantallas que escriben: `modalVerCliente`, `modalEditarCliente`,
    `ordenDesdeCliente`, `ingAbrirDesdeCliente`, `modalContratosCliente`,
    `solicitarEditarCliente`, `eliminarCliente`, `accionComision`.

La única escritura es el registro de auditoría (`registrarLog`), y se envía en
el acto con `_enviarLogsAuditoria` (`arrayUnion` con `merge:true` sobre
`logs_auditoria`, igual que al activar el mantenimiento): no espera al
siguiente guardado, así que cerrar la pestaña justo después no lo pierde. Se
lleva también los registros de la sesión que aún no estaban en la nube. La
forma de los datos no cambia, así que TÉCNICOS no se entera.

**«🔄 Verificar en WispHub ahora».** Sale solo si hay facturas pendientes y la
oficina tiene cuenta (`o.cuentaWisphub`). `consVerificarWisphub` pide, una por
una y hasta 12, la ficha de cada pendiente con `_fichaFacturaWisp(cuenta,
numero)`: un solo GET a `/api/facturas/<n>/` por el Worker, el mismo que usa
el rastreador de la v314. Con `_mapearEstadoFacturaWisphub` dice «✅ ya está
pagada (fecha de pago)», «❌ está anulada en WispHub», «⏳ sigue pendiente»,
«❔ no existe en WispHub» o «⚠️ no se pudo consultar». **No escribe nada**: la
caja y la cartera se ponen al día con la sincronización de esa oficina, y la
ventana lo dice.

- Confirma si una pendiente ya se pagó; no descubre facturas emitidas después
  de la última sincronización de la cartera.
- No toma el candado de sincronización: no frena la automática ni le borra el
  «⛔ Cancelar» a otra. Si hay una cancelándose (`window._syncCancelarWisp`),
  no llama y pide intentar en un momento.
- Un segundo clic en la misma ficha mientras corre no hace nada
  (`window._consVerificando`). En la ficha de otro cliente avisa «Hay otra
  verificación de WispHub en curso» en vez de quedarse callado
  (`window._consVerificandoDe` dice de qué ficha es), y la verificación de la
  ficha anterior deja de consultar cuando se abre otra. La marca se renueva
  antes de cada consulta: solo si UNA consulta pasa de 120 s otro clic toma el
  relevo, y la vuelta vieja (`window._consVerificandoRun` ya no es la suya)
  deja de consultar y de pintar, y no suelta la marca de la nueva.
- `/api/facturas/?cliente=…` y `/api/clientes/?cedula=…` no se usan: nunca se
  comprobaron (la API solo tiene probados los filtros de fecha exacta).

**Funciones nuevas** (bloque «v317 · CONSULTA DE CLIENTES DE OTRAS OFICINAS»):

| Función | Qué hace |
|---|---|
| `_consDig(s)` | solo los dígitos |
| `_consOficinasBuscables()` | admin: todas; oficina: las demás; otro rol: ninguna |
| `_consIndice(o)` | índice de búsqueda de una oficina, en caché en `window._consultaIdx`; al reutilizarla rehace lo editado en su sitio (`_consEntradaIdx`, `_consCrudoIdx`, `_consMismoCrudo`) |
| `_consPartes(q)` | lo buscado, ya partido: dígitos (`dig`; `digTel` sin el 57 del país para el teléfono) o palabras sin tildes |
| `_consBuscar(q, ofis, max)` | `{lista, total}` con copias y el motivo (`por`: nombre, cédula, teléfono, servicio o IP); primero la cédula, el teléfono, el servicio o la IP exactos y los nombres que empiezan igual |
| `_consFechaISO(s)` | AAAA-MM-DD desde AAAA-MM-DD o DD/MM/AAAA, con o sin hora; `''` si no se puede |
| `_consServiciosDe(o, c)` | servicios de la cartera del cliente (por llave; por cédula solo si el cliente no tiene llave) |
| `_consEstadoCuenta(servicios, hoyISO)` | sin cartera, al día, pendientes, monto, mora y fecha de la cartera |
| `_consPagosDe(o, c, n)` | `{lista, incompleto}`: últimos `n` pagos (5), del más reciente al más viejo, como copias |
| `_consOrdenesDe(o, c)` | órdenes abiertas del cliente, como copias |
| `_consFicha(oid, cid, hoyISO)` | todo junto en un objeto de solo datos, o `ok:false` con el error en español |
| `renderConsultaClientes`, `consBuscarInput`, `_consResultadosHTML` | la pestaña y la lista de resultados |
| `modalConsultaCliente`, `_consFichaHTML` | la ficha |
| `consVerificarWisphub` | el botón de WispHub |

**Pruebas.** Tres nuevas en `PRUEBAS.html` (137 en total), sin escribir nada:

1. Búsqueda, con oficinas y clientes inventados: sin tildes, cédula con y sin
   puntos (la repetida sale en las dos oficinas), teléfono, servicio, IP,
   mínimo 3, tope de 20 con el total, la oficina propia nunca sale, el admin
   ve todas, SG-SST ninguna, la caché se reutiliza o se rehace, un teléfono
   con +57 o paréntesis, la IP exacta primero entre 26 que la contienen, y
   un cliente editado en su sitio se encuentra por el dato nuevo.
2. Ficha, con una cartera inventada: al día, debe, suma de pendientes, mora de
   51 días contada desde el vencimiento más antiguo (AAAA-MM-DD y DD/MM/AAAA),
   respaldo por cédula (solo sin llave: con llave y sin cartera propia dice
   sin cartera), sin cartera, los 5 pagos más recientes como copias y
   el aviso de la oficina propia.
3. Con los datos reales: buscar y abrir una ficha deja idénticos los clientes,
   movimientos y cartera de todas las oficinas, las claves de `DB` y
   `_sigClientes`; `save` y `_saveReal` no se llaman; `registrarLog` y
   `_enviarLogsAuditoria` se llaman una vez, sin nombre ni cédula; la ficha no
   trae botones que escriban y su pie solo tiene «Cerrar».

La prueba del celular (375 px) también recorre `consulta_clientes`.

### Fallas viejas encontradas de paso

Ninguna se corrigió en la v317; quedan para decidir con Elkin.

- **`diasMora` vale 0 en los 3.416 servicios.** `_aplicarFacturasWisphub`
  guarda `fecha_vencimiento` tal como llega de la API (AAAA-MM-DD) y
  `_parseFechaWisphub` solo lee DD/MM/AAAA: no encuentra el vencimiento y la
  mora queda en 0. La consulta no lo usa: `_consFechaISO` lee los dos formatos
  y `_consEstadoCuenta` cuenta la mora el día de la consulta.
- **`modalDetalleFactura` siempre dice «Servicio no encontrado».** La lista de
  Facturas le pasa `s.servicioId||s.cedula` y busca
  `DB.facturasHistorial[servKey]`, pero todas las llaves son
  `<oficinaId>::<id_servicio>`.
- **`_actualizarPagosClientes` no acierta.** Busca primero
  `hist[cli.servicioWisphub]`, que nunca coincide, y después la cédula como
  texto exacto; deja a ESNEIDER sin `estadoPago`. Además escribe
  `cli.estadoPago` en todos los clientes de la oficina: por eso la consulta no
  la llama ni se fía de `c.estadoPago`.
- **Bloques huérfanos en la nube, que la app no lee:**
  `clientes_mojfloeutby1_3` y `_4` (701 clientes viejos),
  `facturas_chunk_mojfkt04b73d_2` y `_3`, y 25 `facturas_hist_*` de mayo. Si se
  limpian: archivar, volver a leer para confirmar y solo entonces quitar
  (regla 5 de `CLAUDE.md`).
- **Cifras viejas en `docs/02-contrato-de-servicio.md`:** dice 2.711 clientes
  en la lista comercial; medido para la v317, son 4.233. Igual con
  `oficinas_sistema/main`: `CLAUDE.md` y `docs/01` lo dan al 76 %, y al
  preparar la v317 se midió en 53 %.
