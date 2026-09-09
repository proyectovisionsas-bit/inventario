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
