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

### OFICINAS: cuánto dura la sesión (v325)

- Normal: `sessionStorage` (`ofi_sesion`). Vive solo en esa pestaña y caduca a
  las 12 horas del inicio de sesión real; recargar no alarga el plazo.
- «Recordar en este computador» (solo admin, casilla del login): ese equipo
  guarda en `localStorage` (`ofi_sesion_recordada`; con `?prueba=1`,
  `ofi_sesion_recordada_prueba`) una sesión de 30 días con una huella SHA-256
  con sal de la clave, nunca la clave. Deja de valer si cambia la clave de
  administrador, si vence, con «Salir», al entrar como admin sin marcar la
  casilla o si en ese equipo entra una oficina o SG-SST. La cabecera lo
  muestra como «ADMIN · 💾» (también se pone al día si otra pestaña la cambia).
  Además:
  - si al abrir no se pudo leer la base (sin internet al despertar el equipo,
    Firestore con error), no se compara ni se borra nada: se pide la clave y la
    próxima apertura con la base vuelve a entrar sola;
  - cambiar la clave de administrador desde ese computador renueva su sesión
    recordada; los demás computadores la pierden;
  - una pestaña que tenía la sesión de una oficina o de SG-SST nunca pasa sola a
    administrador al recargar;
  - entrar así deja «Administrador (sesión recordada)» en el registro de sesiones;
  - la casilla se desmarca al entrar y no se conserva de una recarga a otra.
  Funciones: `_recordarSesionAdminOfi`, `_reanudarSesionRecordadaOfi`,
  `_olvidarSesionRecordadaOfi`, `_infoSesionRecordadaOfi`, `_insigniaAdminOfi`,
  `_pestanaDeOtroRolOfi`. Prueba: «Recordar en este computador» en PRUEBAS.
- Para qué: las tareas programadas de la mañana (revisión de comprobantes y
  pagos del admin) encuentran abierta la sesión del computador de Elkin.
