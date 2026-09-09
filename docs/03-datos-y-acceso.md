## Datos: Firebase / Firestore

Proyecto `inventario-88a28`. SDK compat 9.23.0 por CDN (un punto usa el modular 10.12.0).

Colecciones:
- `oficinas_sistema` — documento único `main`. **Contiene casi todo el sistema**:
  empleados, oficinas, clientes, órdenes, configuración. 58 referencias en el código.
- `inventario` — datos de bodega. 17 referencias.
- `facturas_servicios` — 2 referencias.

### Cuidado con el documento `oficinas_sistema/main`

Toda la aplicación lee y escribe ese único documento. Dos consecuencias:

1. **Está cerca del límite de Firestore.** Un documento no puede pasar de 1 MiB.
   Vía REST el documento ya devuelve ~4,5 MB de JSON (el formato REST es varias
   veces más verboso que el interno, así que el tamaño real es menor, pero el
   margen se está agotando). Cuando se alcance el límite, **las escrituras
   empezarán a fallar**. Conviene medir el tamaño real y planear la partición.
2. **Cualquier cambio reescribe el documento completo**, con riesgo de que dos
   usuarios se pisen los cambios.

## Autenticación (ver ADVERTENCIA abajo)

No se usa Firebase Auth. El login es propio: el navegador descarga
`oficinas_sistema/main` completo y compara documento y clave en JavaScript
(`empleados.find(e => e.documento === doc && e.tecnicoPass === pass)`).
Las claves se guardan **en texto plano** en el campo `tecnicoPass`.

> **ADVERTENCIA DE SEGURIDAD — sin resolver (verificado el 17 Ago 2026)**
> Las reglas son `allow read, write: if true;` en las tres colecciones.
> Comprobado: una petición anónima a `oficinas_sistema/main` responde HTTP 200
> y entrega ~4,5 MB. La `apiKey` está en el código de un sitio público, así que
> cualquier persona en internet puede **leer** toda la base (empleados, claves
> en texto plano, clientes, facturación) y **escribir o borrar** en ella.
>
> Cerrar las reglas exige primero poner autenticación real: hoy nadie se
> autentica ante Firebase, así que `if request.auth != null` tumbaría las tres
> apps de inmediato. El plan acordado es migración progresiva — los dos métodos
> conviviendo, cada empleado migrándose al entrar — y cerrar las reglas al final.
