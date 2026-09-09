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
