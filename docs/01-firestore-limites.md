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
