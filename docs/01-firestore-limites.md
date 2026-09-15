## Tamaño de los documentos de Firestore (medido el 17 Ago 2026)

El límite es **1 MiB por documento**; al alcanzarlo **fallan todas las escrituras
a ese documento**, no se degrada. Tamaños reales calculados con las reglas de
Google (cadena = bytes UTF-8 + 1, entero = 8, mapa = clave + valor, doc + 32):

| Documento | Tamaño | % |
|---|---|---|
| `inventario/datos` | 818 KB | **79,9%** |
| `oficinas_sistema/main` | 782 KB | **76,4%** |
| `inventario/clientes` (heredado) | 750 KB | 73,2% |
| `inventario/clientes_0..5` | 150–508 KB | 15–50% |
| `oficinas_sistema/clientes_<ofi>_<i>` | 101–289 KB | 10–28% |

**Los fragmentos de clientes están holgados**: la partición funcionó. El riesgo
está en los tres documentos que nunca se partieron.

Qué los llena: en `inventario/datos`, `consumosPendientes` (396 KB, 651
registros — de los cuales **solo 12 siguen pendientes**) e `instalaciones`
(187 KB). En `oficinas_sistema/main`, `recogidas` (384 KB, 921 registros, 837
realmente pendientes) y `ordenesTrabajo` (160 KB, 266 ya terminadas).

### El archivador existe y estaba roto por las fechas

`aligerarBaseInventario` (botón de admin) y `aligerarBaseAhora` en OFICINAS
mueven a un documento aparte lo resuelto y antiguo, sin borrar nada.
Las reglas (`_REGLAS_ARCHIVO_INV`) eran correctas, pero **no podía leer las
fechas**: TECNICOS guarda unas como ISO y otras con `toLocaleDateString()`,
que en Colombia da `DD/MM/AAAA`. `new Date()` espera `MM/DD`, así que
`17/8/2026` daba Invalid Date (registro invisible para siempre) y `5/8/2026`
se leía como 8 de mayo (antigüedad mal calculada).

Corregido en la v89 con `_msDeFechaInv`, que resuelve `DD/MM/AAAA` a mano
**antes** de `Date.parse`. Efecto medido: los registros archivables pasaron de
**1 a 458** (216 KB). OFICINAS no tenía el problema porque usa marcas de tiempo
numéricas (`creada: Date.now()`).

### Fechas: guardar SIEMPRE una marca numérica (v91 / v78)

Las dos apps guardaban las fechas con `toLocaleDateString()`, que en Colombia
da `DD/MM/AAAA`. `new Date()` espera `MM/DD`, así que fallaba de dos formas:
`17/8/2026` daba fecha inválida y `5/8/2026` se leía como **8 de mayo**. Eso
tuvo roto el archivador de bodega durante meses sin que nadie lo notara.

Ahora se guardan **las dos**: el texto (que bodega muestra en pantalla, sin
cambio visible) y una marca numérica — `fechaMs`, `confirmadoMs`,
`rechazadoMs`. `_fechaDeRegistroInv` prefiere la numérica; el texto queda de
respaldo para los registros antiguos, y para esos está `_msDeFechaInv`.

**Al guardar una fecha nueva en cualquier app, añadir siempre su `...Ms`.**
Un número no admite interpretación; un texto sí.

### El archivado corre solo (v90)

OFICINAS ya lo hacía: `_aligerarSolicitudes` y `_aligerarOrdenes` corren dentro
de su guardado desde la v170, precisamente tras chocar con el límite de 1 MB.
INVENTARIO se había quedado solo con el botón manual — de ahí la acumulación.

Ahora `_aligerarAutoInv()` corre en `_fbSaveCore`, antes de armar `dbCopy`.
Es barato: `_calcularAligerado()` es puro en memoria y devuelve vacío casi
siempre, así que un guardado normal no paga nada; solo hay E/S cuando hay
historial viejo, y una vez movido no se repite.

**La propiedad de seguridad**, heredada del diseño original: escribe el archivo,
lo vuelve a **leer para confirmar**, y solo entonces saca los registros de la
base. Si la escritura falla, o si la verificación vuelve vacía, **no se quita
nada**. Verificado con ambos fallos simulados.

El botón manual sigue existiendo y ahora comparte el mismo núcleo
(`_archivarInv`) en lugar de duplicar la lógica.

## Guardado de movimientos por bloques (OFICINAS v304, 14 Sep 2026)

Los movimientos de cada oficina viven en bloques de 400 (`movs_<ofi>_<i>`),
de 170 a 335 KB cada uno (medido el 14 Sep 2026: NATALIA 15 bloques,
ESNEIDER 9, YESCENIA 7, THOMAS 7, MONTAÑITA 1). Hasta la v303, **cualquier
cambio en una oficina reenviaba todos sus bloques** — adjuntar un comprobante
en NATALIA subía 3,6 MB. Con internet lento el lote se caía y salía
"NO SE PUDO GUARDAR EN LA NUBE — Firebase rechazó el guardado".

Desde la v304 cada bloque tiene una **firma** (`_firmaBloqueMovs`: cantidad +
hash del JSON con claves ordenadas, porque la nube devuelve las claves en
cualquier orden). Se anota al cargar cada bloque (`_anotarFirmaBloqueMovs`) y
se confirma tras cada guardado exitoso. `_bloquesQueCambian` decide qué
reenviar: solo los bloques cuya firma cambió, salvo que cambie la cantidad de
bloques respecto al índice (entonces van todos, porque cada bloque lleva
`totalPartes`). Un comprobante nuevo toca un solo bloque (~300 KB).

Otras tres piezas de la misma versión:

- `_recortarTextosLargos`: un texto de comprobante con una imagen pegada
  (`data:image/...`) o de más de 1.500 caracteres se recorta a 200. Se
  encontró uno del 22 Ago 2026 con 70 KB de imagen dentro de `descripcionIA`
  (alguien pegó la "dirección de imagen" en el campo de descripción). Uno
  grande dejaría el bloque sobre 1 MB y esa oficina no volvería a guardar.
- `_traducirErrorGuardado`: un solo traductor de errores a español. Antes
  "bloque sobre 1 MB", "dato con formato inválido", "reglas de Firebase",
  "Firebase ocupado" y "copia de prueba" caían en el aviso genérico.
- `_registrarFalloGuardado` + `_programarReintentoGuardado`: el motivo de cada
  fallo queda en `oficinas_sistema/errores_guardado` (últimos 150) y en
  `localStorage.fallosGuardadoOfi` (últimos 20), con oficina, versión, peso del
  lote y mensaje. Si el motivo es pasajero, la app reintenta sola a los 20, 45
  y 90 segundos; el aviso completo sale en el primer fallo y en el definitivo.

## Comprobantes "duplicados" que no lo son (OFICINAS v305, 14 Sep 2026)

Hay dos controles y dan avisos distintos:

| Aviso | Control | Qué compara |
|---|---|---|
| COMPROBANTE YA USADO | `_buscarHashDuplicadoGlobal` | SHA-256 de los bytes originales de la imagen |
| COMPROBANTE YA REGISTRADO | `_buscarReferenciaDuplicada` | referencia leída por la IA + mismo valor |

**La huella no da falsos positivos**: se calcula sobre el archivo original en
los tres caminos (📎, cargue por lotes); la versión reducida solo viaja a la
IA. Los cuatro bloqueos del 14 Sep en THOMAS eran imágenes ya subidas y
guardadas el 12 Sep en los mismos pagos. Desde la v305 el aviso dice cuándo
se subió y si ya está en la nube, y si la huella está en el mismo pago al que
se adjunta, avisa que ya está adjunta en vez de bloquear.

**La referencia sí daba falsos positivos.** Medido sobre 1.846 referencias:
las de Bancolombia que lee la IA tienen la forma `0000XXXX00` (las 314
terminan en 00, van de 300 a 99.900: solo 999 posibles, 55 ya repetidas entre
clientes). Dos pagos de clientes distintos tenían `M1234567890`, que es el
ejemplo del mensaje a la IA, y tres la cuenta de la empresa con un dígito mal
leído. `_refDebilParaBloquear` descarta para bloquear: menos de 6 cifras
significativas, secuencias, un solo carácter, celulares, fechas, el propio
valor y la cuenta de la empresa exacta o a un dígito. Siguen bloqueando las
de Nequi (`M` + 8 cifras) y los códigos largos de PSE y Bre-B.

La misma versión corrige cuatro formas de perder un cargue por lotes
(`guardarComprobantesRegistrados`): no arranca si la oficina no cargó
completa; si Drive no recibe la imagen, el pago queda pendiente de soporte;
enlaza con `_movDestino` sobre la memoria actual (un cambio de otra sesión
durante las subidas dejaba los comprobantes en una copia vieja); y si la nube
no recibe el guardado (`window._ultimoGuardadoOk`), no dice "Procesado".

Los abonos de clientes especiales (`_handleAbonoCompFiles`) y los PDF sueltos
del 📎 también calculan huella (`hashArchivo`), y `_buscarHashDuplicadoGlobal`
recorre `DB.abonosEspeciales`: el mismo archivo no se usa en dos pagos, sea
de caja o de abono.

## Cada sesión baja solo los bloques que cambiaron (OFICINAS v305)

Hasta la v304, cada guardado de movimientos de cualquier sesión cambiaba
`_selloMovs` y todas las sesiones abiertas volvían a bajar los 40 bloques
(8,5 MB). Con el internet de las oficinas eso dejaba cargas incompletas.

1. **Quien guarda** escribe en `movs_index`, con `set(..., {merge:true})`,
   `firmas.<oficina>.<i>` de cada bloque que reescribe, **en el mismo lote**
   que el bloque (`_repartirFirmasMovsEnLotes`). Si el lote falla, no queda ni
   el bloque ni la firma. En el modo documento por documento, la firma de un
   bloque que falló se quita (`_quitarFirmasFallidas`).
2. **Quien recarga** guarda copia de cada bloque que baja
   (`window._cacheBloquesMovs`), con la firma calculada del contenido y nunca
   copiada del índice. Reutiliza la copia si la firma del índice coincide
   (`_planLecturaBloques`). Baja todo si no hay copia, cambió la cantidad de
   bloques, hay bloques fuera del índice, el índice no trae firmas o pasaron
   15 minutos desde la última carga completa.
3. **Antes de reescribir un bloque**, quien guarda lo relee y lo compara con
   lo que cargó. Si otra sesión lo cambió, recarga completo y fusiona antes
   de escribir, así una copia vieja nunca pisa un cambio ajeno.

Una sesión v304 o anterior escribe el índice sin merge y borra todas las
firmas: las demás vuelven a bajar todo, como antes. Nada se rompe en la
transición.

Endurecido tras la revisión del agente `revisor`:

- **Guardado durante una recarga.** La carga publica
  `window._cargaMovsEnCurso` y el guardado la espera, hasta 60 s. Si no
  termina, ese guardado no reescribe movimientos. Las firmas leídas pasan a
  `_sigMovsBloque` solo cuando la carga aplica a memoria. Si un guardado
  confirma a mitad de la carga (`_genConfirmMovs`), lo leído no se aplica y
  la carga se repite.
- **Lo que no se pudo verificar no se escribe.** Un bloque ilegible cuenta
  como cambiado. Si la recarga no termina, esa oficina no se reescribe. Si
  `movs_index` no se puede leer, no se escriben movimientos ni el índice,
  que antes quedaba en cero.
- **Varias cargas a la vez.** Cada carga lleva número (`_seqCargaMovs`) y
  una más vieja nunca se aplica encima de una más nueva. El guardado espera
  todas las cargas vivas (`_cargasMovsVivas`), también las que arranquen
  mientras espera.
- **Guardado parcial por no poder verificar** (índice ilegible, carga de más
  de un minuto, recarga incompleta): se reintenta solo
  (`_parcialReintentable`), como dice el aviso.
- **Documento por documento**, cada bloque va con su firma en un lote de dos
  escrituras: entran los dos o ninguno.
- **Abonos.** Varias selecciones de archivos se encadenan, y un segundo clic
  en registrar mientras se calcula la huella no hace nada.
- **Siembra.** Tras una carga completa, `_sembrarFirmasMovs` pone las firmas
  que faltan. Cada una sale de una transacción que lee el bloque, nunca de
  la memoria.
- La copia que deja un guardado no cuenta como carga completa; la siguiente
  recarga busca bloques fuera del índice.

Firebase entrega las claves de los mapas en otro orden en cada lectura. Por
eso toda comparación de bloques usa `_jsonEstable` (claves ordenadas); un
`JSON.stringify` directo da distinto aunque el contenido sea el mismo.

Medido con los datos reales el 14 Sep 2026 en `PRUEBAS.html`: carga completa
40 bloques bajados; recarga sin cambios 0 bajados y 40 tomados de la copia;
con un bloque cambiado, 1 bajado y 39 de la copia, con los movimientos
idénticos. La consola de cada sesión lo resume en la línea
"📦 Bloques de movimientos".

## Un campo `undefined` tumba el lote entero (OFICINAS v306, 15 Sep 2026)

Firebase rechaza un `WriteBatch` completo si cualquier campo de cualquier
documento vale `undefined` ("Unsupported field value: undefined"). El 15 Sep
2026 eso dejó a NATALIA y ESNEIDER sin poder guardar desde las 8:54, y
`errores_guardado` lo registró. El documento principal no fallaba porque se
arma con `JSON.parse(JSON.stringify(...))`, que quita los `undefined`; los
bloques pasaban por `sanitizarFirebase`, que no los quitaba.

Desde la v306 `sanitizarFirebase` omite los campos `undefined` o de tipo
función y anota dónde estaban. La lista sale en la consola y en
`errores_guardado`, con el título "Campos vacíos quitados", una vez cada 30
minutos. Un origen encontrado: `_aplicarPagosWisphubEnMemoria` copiaba
`f.tipo` sin revisar.

**Al crear un registro nuevo, nunca asignar un valor que pueda ser
`undefined`**: usar `null` o `''`.

## Subir un comprobante que la app ve repetido (OFICINAS v307, 15 Sep 2026)

Pedido de Elkin. Donde antes había un aviso que solo bloqueaba, ahora sale
la ventana `_pedirMotivoDuplicado`. Muestra el pago contra el que choca y
pide escribir por qué no es el mismo comprobante (mínimo 15 letras). Las
opciones son "No subir", "Subir de todas formas" y, en el cargue por lotes,
"No subir ninguno de los repetidos".

Lo que se sube así:

- lleva `duplicadoAceptado: [{tipo, motivo, por, fecha, fechaMs,
  movimientoAnterior, oficinaAnterior, pagoAnterior, ...}]` en el
  comprobante, con `tipo` `huella` (mismo archivo) o `referencia` (misma
  referencia y valor);
- crea una alerta `tipo:'duplicado'` en `DB.alertasComprobantes`, que el
  panel del administrador muestra en su propio recuadro morado;
- queda en el registro de auditoría como `COMPROBANTE_DUPLICADO_ACEPTADO`;
- en la lista de comprobantes del pago lleva la etiqueta "Subido aunque
  parecía repetido", con el motivo al pasar el mouse.

Cubre los cinco lugares donde había bloqueo: adjuntar imágenes o PDF
(`procesarArchivos`), la referencia leída por la IA
(`_leerComprobantesAlSubir`), el cargue por lotes al elegir
(`_cargarComprobantesIA`) y al registrar (`guardarComprobantesRegistrados`),
y los abonos de clientes especiales. Elegir dos veces el mismo archivo en la
misma selección sigue bloqueado.

Una huella repetida es el mismo archivo byte por byte. El caso legítimo es
una transferencia que pagó dos facturas. Si el pago quedó registrado dos
veces (como la factura #103566 del 14 Sep 2026), lo correcto es borrar el
repetido, no subir el comprobante dos veces. La ventana lo dice.

## Leer los fallos de guardado

Para saber por qué falló un guardado en una oficina, leer `errores_guardado`
por REST (la colección es pública) en vez de pedir la consola:

```bash
curl -s "https://firestore.googleapis.com/v1/projects/inventario-88a28/databases/(default)/documents/oficinas_sistema/errores_guardado"
```
