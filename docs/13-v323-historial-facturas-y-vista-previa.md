# v323 — El historial de facturas dejaba de guardarse en silencio

> Cambios hechos el 3-nov-2026 desde Cowork (no desde Claude Code), ENCIMA de la
> v322 que estaba sin publicar en el PC. La v322 de Code (facturas borradas en
> WispHub / `eliminadaWisphub`) quedó intacta: estos son 84 líneas más, en sitios
> distintos. Respaldo byte a byte de la v322 en
> `..\_RESPALDO_2026-11-03_antes_de_publicar\`.

## El hallazgo

Revisando las cuentas de octubre, el cuadre día a día mostraba días enteros en
**$0** en las cinco oficinas, mientras el panel del mes cuadraba al peso. Medido
contra Firestore, el historial de facturas (`facturas_chunk_<ofi>_<n>`) llevaba
congelado:

| Oficina | Último guardado del historial |
|---|---|
| Florencia (Yescenia) | 14-oct 17:51 |
| El Paujil (Esneider) | 23-oct 08:25 |
| El Doncello (Natalia) | 29-oct 17:03 |
| Cartagena (Thomas) | 31-oct 10:02 |
| Montañita | **21-ago 15:18** |

Al correr las cinco sincronizaciones completas entraron **3.106 facturas** que
nunca se habían guardado. No faltaba plata: cero facturas pagadas de octubre sin
movimiento en caja (El Paujil tenía 16 pagos por $1.090.000 que la propia
sincronización registró).

## Causa raíz

En `_saveReal`, las banderas `_serviciosFactModificados` / `_serviciosFactBorrar`
se borraban **en cuanto las operaciones quedaban preparadas**, antes del
`batch.commit()`. Si fallaba cualquier cosa después (un lote rechazado, la
lectura fresca con `{source:'server'}`, un bache de red — hay 4 errores de ese
tipo registrados el 20-oct en `errores_guardado`), las facturas se quedaban solo
en memoria y **nadie las reintentaba**: al recargar volvía lo viejo de la nube.

## Los cuatro arreglos

1. **Las banderas no se sueltan hasta que la nube confirme.** Se copian a
   `window._factBanderasPend`, el `catch` de `_saveReal` las devuelve, y solo se
   ponen en `null` tras el éxito. Así el siguiente guardado reescribe esos chunks.
2. **Marca propia para las facturas.** `_marcarSync` (que solo concilia CLIENTES)
   ya no se hace pasar por sincronización completa: ahora escribe también
   `ultimoSyncClientes`, y la nueva `_marcarSyncFacturas(o)` se llama en
   `sincronizarTodoWisphub` **antes** del `save()`, de modo que si el guardado
   falla la marca tampoco queda. `_sincHace` lee `ultimoSyncFacturas`.
3. **Aviso visible en el cuadre día a día.** Si `ultimoSyncFacturas` tiene 2 días
   o más (o no existe), sale una tarjeta ámbar diciendo que un día en $0 casi
   siempre es historial sin bajar. Nada avisaba antes: por eso Montañita pasó dos
   meses y medio con el mes entero en cero.
4. **La vista previa dice la verdad.** Contaba clientes nuevos por
   servicio/cédula mientras lo que se aplica es el plan de `conciliarOficina`
   (llave `cuenta:servicio`): de ahí el "30 nuevos → agregados 0". Ahora usa ese
   mismo plan y muestra también cambios de servicio, mudanzas, reactivados,
   retirados y conflictos. Y `nuevosPagos` filtra por `_esBorradoPermanente`,
   que es lo que hace el apply: antes anunciaba "1 pago nuevo" y creaba 0.

## Pendiente

En **modo emergencia** el guardado salta las facturas a propósito y ahí sí
descarta las banderas (`_saveReal`, rama `if(DB.modoEmergencia)`). Hoy está
apagado; si se prende, el historial se vuelve a congelar en silencio. Falta
decidir si esas banderas deben sobrevivir también ahí.

## Validación hecha

`node --check` limpio en los dos bloques inline, y carga real en Chromium
headless desde localhost: v323 arranca sin errores de consola ni de página, con
`_marcarSyncFacturas`, `_sincHace`, `conciliarOficina` y `_esBorradoPermanente`
definidos. Al correr en localhost el archivo no anuncia su versión (guarda de la
v254), así que las oficinas no vieron nada.
