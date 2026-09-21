# Préstamos: una cuenta por persona (OFICINAS v312 · 22 Sep 2026)

Pedido de Elkin: ver en UNA cuenta cuánto debe cada persona, que la plata prestada o
abonada quede en el registro diario de la caja y que nada se pueda borrar. Sus respuestas:

| Respuesta de Elkin | Dónde quedó |
|---|---|
| Hasta $1.000.000 sin aprobación | `excedeTope`: acumulado por persona en 30 días, en cualquier oficina, más las autorizaciones vivas |
| El préstamo en efectivo sale de la caja y va al registro diario | fuente `caja` → egreso `pr_…` en la caja de quien entrega (`_crearMovPrestamo`) |
| Solo el admin condona y deshace uniones | `condonarSaldo`, `deshacerUnion` y toda anulación empiezan con `_prestSoloAdmin()` |
| Autorización firmada, cédula y pagaré: opcionales | soportes `pagare` y `autorizacion_nomina` (`adjuntarSoportePrestamo`); no bloquean ni cuentan como «faltantes». La cédula va solo como número (campo opcional); por privacidad no se sube su foto (§12) |
| La oficina puede sumar | «➕ Sumar a lo que debe» = línea `desembolso` en `cuentaPrincipal` |
| Prestarle a un atrasado pide autorización | `razonesAprobacionPrestamo` → solicitud `aprobar_prestamo`, razón `atrasado` |
| NADA SE BORRA | toda corrección es una línea o un campo nuevo con motivo, quién y cuándo |

Código: `OFICINAS_PTOVISION.html`, de `// MÓDULO PRÉSTAMOS — v312` (~22151) a
`// v312: FIN DEL MÓDULO PRÉSTAMOS` (~24280): primero el núcleo puro (sin DOM, corre en
node), después acciones y pantallas. Fuera del bloque hay unas 70 líneas marcadas `v312`.

## 1. Modelo, tipos de línea y «nada se borra»

Los 20 préstamos viejos no se reescribieron: `monto` sigue siendo la primera entrega y
`abonos[]` queda igual; lo nuevo se agrega cuando alguien actúa. Uno de v312 (inventado):

```
{ id:"p_1790000000000_k3f9", tipo:"empleado", beneficiario:"PEDRO GÓMEZ",
  personaId:"emp_1777839459781.0015", personaIdMs, empleadoId:"1777839459781.0015",
  oid:"ofi_x", oidMs, oidInicial:"ofi_x", monto:600000, saldoPendiente:400000 /*v311*/,
  fecha:"2026-09-22", fechaMs, cuotas:6, cuotaValor:100000, cuotasMs, estado:"activo",
  estadoMs, estadoPor, fuenteInicial:"caja", movIdInicial:"pr_ofi_x_p_…_ini", movRefInicial:"",
  abonos:[{ id:"a_…", valor:100000, fecha, fechaMs, forma:"Efectivo", destino:"caja", oid:"ofi_z",
    movId:"pr_ofi_z_p_…_a_…", movRef:"", revMovId:"", por, creadoMs, editadoMs, anulado:false }],
  lineas:[{ id:"l_…", tipo:"desembolso", valor:300000, fuente:"caja", oid, movId, … }],
  correcciones:[{ id:"c_…", campo:"oid", de:"", a:"ofi_x", por, ms, motivo }],
  soportes:[{ id:"s_…", tipo:"pagare", fileId, url, anulado:false }] }
```

- El `oid` de cada línea y abono es la oficina donde salió o entró la plata; `p.oid` es la
  dueña de la cuenta. `movId` = movimiento propio; `movRef` = uno que ya existía. Nunca los dos.
- `fecha` (texto) se muestra; `fechaMs` (`_msDeFecha`, mediodía local) solo ordena. Nada
  guarda `undefined` (`_prestSinUndef`) ni hace `filter` sobre `DB.prestamos`. Corregir es
  anular (`anulado:true` + `anuladoPor/Ms/Motivo`) o agregar otra línea; lo anulado no suma.

| `lineas[].tipo` | Efecto | Qué es |
|---|---|---|
| `desembolso` | + | Capital nuevo («Sumar»). Cuenta en «Prestado». |
| `traslado_entrada` / `traslado_salida` | + / − | Unión (`unionId`, `pidOrigen` / `pidDestino`). No es capital. |
| `condonacion` | − | Saldo perdonado. Solo admin. |
| `ajuste` | ± | `pagado_fuera` (−), `reabrir` (valor 0) u `otro` (con `signo`). Solo admin. |
| `anulacion` | 0 | Marca del préstamo anulado, con motivo. |

## 2. resumenPrestamo y estadoDe: la única fuente

`resumenPrestamo(p)` → `{capital, abonado, condonado, trasEnt, trasSal, ajuste, saldo}`;
saldo = capital + trasEnt + ajuste − abonado − condonado − trasSal. La usan todas las
pantallas, la IA y las validaciones. Nunca `monto − abonos` ni `saldoPendiente`.

`estadoDe(p)`: `anulado` → `por_conciliar` («pagado» sin `estadoMs` y con saldo: los 4 del
10-jun; deja de serlo con un ajuste `reabrir`) → `fusionado` (traslado de salida vivo) →
`activo` si saldo > 0, si no `pagado`. El campo `estado` se escribe al final de cada acción
(`_prestFin` = `_aplicarEstado` + `_sellar`) solo para v311 y la fusión; ninguna pantalla lo lee.

Por persona (`_datosPersona`, `deudaDePersona`, `personasConPrestamos`): deuda = Σ saldos
de los no anulados − los por conciliar. «Debe hoy» = max(0, deuda); deuda < 0 es «saldo a
favor» (solo admin, y es hallazgo). «Prestado» = Σ capital.

## 3. Persona y personaId

`personaIdDe(p)`, sin memo: 1) `p.personaId`; 2) `emp_` + `empleadoId`; 3) empleado con el
mismo nombre normalizado en `rrhh_empleados`, si es único; 4) `ter_<cédula>`; 5) `nom_<slug>`.

- Los ids de empleado llevan decimales (`1777839459781.0015`): siempre `String(e.id)`,
  nunca `parseInt`/`Number`, y nunca como nombre de campo en Firestore.
- «¿Es la misma persona?» (`candidatosMismaPersona`): mismo nombre con otro id, misma cédula
  o nombre parecido ≥ 0,85 (`_similitudPersona`, Levenshtein por palabra). «Sí» toma el id
  existente; «No» crea otro (`nuevoPersonaIdDistinto`) y guarda `personaDistintaDe`. Un
  empleado escogido de la lista conserva su `emp_<id>` aunque conteste «No» (si no, su deuda
  quedaría repartida y el tope y el atraso se calcularían sobre otra cuenta).
- Tercero con nombre de empleado activo: la oficina escoge el empleado o va a aprobación
  (razón `identidad`). El admin corrige con `fijarPersonaPrestamo` (Conciliar 6).

## 4. Tope y atraso (constantes en DB.config)

| Clave de `DB.config` | Por defecto | Se lee con |
|---|---|---|
| `prestTopeOficina` | 1000000 | `PREST_TOPE_OFICINA()` |
| `prestVentanaTopeDias` | 30 | `PREST_VENTANA_TOPE()` |
| `prestDiasAtraso` | 35 | `PREST_DIAS_ATRASO()` |
| `prestAtrasoDesde` | `'2026-09-22'` | `PREST_ATRASO_DESDE()` |

Fijas en código: `PREST_VENCE_AUT_DIAS = 7`, `PREST_MAX_SOPORTE_MB = 8`. Sin pantalla: en la
consola del admin (`DB.config.prestTopeOficina=1500000; save()`), con una sola sesión abierta.

- **Tope** (`excedeTope`): pide aprobación si las entregas vivas a la persona en 30 días (en
  cualquier oficina) + las solicitudes `aprobar_prestamo` pendientes o aprobadas sin usar ni
  vencer + el valor nuevo pasan del tope. Partir la plata no lo evita. Al admin no se aplica.
- **Atraso** (`esAtrasada`): el reloj arranca en la primera entrega de la deuda vigente (un
  «Sumar» no lo reinicia), nunca antes de `prestAtrasoDesde`. Pasados 35 días, atrasada si
  lo abonado en los últimos 35 < min(cuota, deuda); cuota = Σ `cuotaValor` (o
  capital/cuotas); sin cuotas, si no abonó nada. Un abono de $1.000 no la limpia.
- Primer ATRASADO posible: 27-oct-2026. Al 21-sep, 3 personas con saldo nunca han abonado y
  2 no tienen cuotas: revisar Conciliar 9 antes de esa fecha.

## 5. Flujos de oficina y admin

| Acción | Oficina | Admin |
|---|---|---|
| Nuevo / Sumar (`modalNuevoPrestamo`, `guardarPrestamo`) | hoy y fuente `caja`; tope, atraso, identidad dudosa u otro día → solicitud, no sale plata | oficina («Sin oficina» solo con `admin_fuera`), fecha, fuente `caja`/`banco`/`ya_salio`/`admin_fuera`; «Préstamo aparte» con motivo |
| Abono (`modalAbonarPrestamo`, `guardarAbono`) | cualquier persona con saldo; `caja` o `banco`; hoy | además `admin_mano`, `nomina` (quincena), `ya_entro`; oficina y fecha |
| Anular abono, línea o préstamo | pide la anulación y dice si fue un error | `anularAbono`, `anularLinea`, `anularPrestamo`: motivo + «¿Fue un error (la plata NO se movió)?» (Aceptar → reverso). La oficina y el admin ven la misma pregunta, en el sentido de Aceptar |
| Reasignar, condonar, ajustar, forma | — | `reasignarAbono` (caja intacta; se niega si el abono ya se reversó), `condonarSaldo`, `ajustePrestamo`, `corregirFormaAbono` |
| Unir / deshacer | — | `unirPrestamos` (misma persona y oficina, sin hallazgos) / `deshacerUnion` (se niega si algo queda < 0) |
| Soportes | adjunta | adjunta y retira (`retirarSoporte` oculta, no borra) |

- Un abono va a UN préstamo y no pasa de su saldo (`validarAbonoPrestamo`). Los ids nacen
  al abrir el modal (con autorización, `p_sol_<sid>`): doble clic o dos pestañas no duplican.
- Extracto (`extractoPersona`): todas las filas de la persona, anuladas tachadas, «Ver
  detalle» con traslados, imprimir y «Copiar para WhatsApp» (sin cédula ni anuladas).
  Orden: por día y, dentro del día, primero lo que se presta (cargos), luego `fechaMs` y
  `creadoMs`. Así un abono nunca sale antes de su préstamo ni deja un saldo corrido negativo
  (los abonos viejos no tienen `creadoMs`; un reloj atrasado tampoco lo desordena).
- Un abono reasignado (`reasignadoDe`, `movRef` al `pr_…` original) sí se puede reversar al
  anularlo después, o al anular el préstamo destino con reverso (`_prestMovRevAbono`): se
  reversa el movimiento original, una sola vez. Un enlace «Ya entró» nunca se reversa.
- `eliminarPrestamo`/`eliminarAbono` anulan (admin) o piden anular. «Marcar pagado» no existe.

## 6. Solicitudes nuevas

| `tipo` | La oficina la crea con | Al aprobar (`aprobarSolicitud`) |
|---|---|---|
| `aprobar_prestamo` | el modal de préstamo | fija `pidDestino` (sumar o aparte), `decididoMs`, `venceMs` (+7 días). No toca préstamos ni caja. Una por una |
| `anular_abono`, `anular_linea` | «📩 Anular» en Ver préstamo | `anularAbono` / `anularLinea` con `s.motivo` y `s.reversar` |
| `anular_prestamo` (y la vieja `eliminar_prestamo`) | «📩 Pedir anulación» | deshace solo SU unión si es origen y anula solo ese préstamo; nunca redirige |
| `abono_nomina` | «🧾 Pedir descuento de nómina» | `registrarAbonoNomina` (abono `a_sol_<sid>`; uno por préstamo y quincena) |

- Si falla una condición, queda PENDIENTE con `nota` (`_solNota`). En lote se salta
  `aprobar_prestamo`; las demás pasan si traen `reversar`. Rechazo en lote: un solo motivo.
- Tarjeta «🤝 Autorizaciones»: vivas con «Entregar», pendientes, vencidas y rechazadas. Al
  entregar se revisa persona, valor, vigencia y uso (`usadaPid`); `_aligerarSolicitudes` no
  archiva una viva. Con una pendiente, la oficina no le entrega directo a esa persona.
  La marca `usadaPid` se pone sobre la solicitud que está en `DB.solicitudes` después de
  subir los soportes (un snapshot en medio reemplaza los objetos).

## 7. Caja

- Id `pr_<oid>_<pid>_<ítem>` (`ini` = entrega inicial), nunca repetido; caja = `item.oid`.
  Concepto `Préstamo`/`Abono préstamo`, `origen:'prestamo'`, `esPrestamo`, `prestamoId`,
  `lineaId`, `bloqueadoEdicion`; fecha de la línea.
- Reverso (`_reversarMovPrestamo`): `<original>_rev`, tipo contrario, misma caja, fecha de
  hoy, `esReverso`, hereda la marca; el original no se toca y el ítem guarda `revMovId`.
- Enlazar (`ya_salio`, `ya_entro`, Conciliar 5): el movimiento recibe `esPrestamo`,
  `prestamoId`, `lineaId`, `reclasificadoPor/Ms` sin cambiar valor, fecha ni concepto.
  Nunca se enlaza un Pago Admin (`esPagoAdmin`/`pagoAdminId`: se corrige desde Pagos Admin)
  ni un pago de WispHub (`_esPagoWisphub`); `_prestCandidatosMov` y `_prestValidarMovRef` los
  sacan, y el validador corta con la carga incompleta. Candidatos (máx. 40): primero el mismo
  valor, luego los que dicen préstamo/adelanto/debe, luego la fecha más cercana.
- Varios movimientos para un mismo ítem (solo egresos: el `ini` o un desembolso), p. ej. 3
  egresos de $50.000 dentro de un préstamo de $450.000: en Conciliar 5 cada enlace parcial
  queda como corrección `campo:'movRefParcial'` (`a` = movimiento, `valor`, `oid`) y el
  ítem muestra «(falta $X)» hasta completar. La deuda no cambia; no se puede pasar de lo que
  falta ni reusar un movimiento (`_prestRefsParciales`, `_prestMovRefUsado`). Al estar en
  `correcciones`, los enlaces de dos sesiones se unen al fusionar. Los abonos siguen exigiendo
  el mismo valor. El movimiento de Conciliar 5 ya no viene preescogido.
- Bloqueo (`MSG_MOV_PRESTAMO`): la fila muestra «🤝 Préstamo» en vez de ✏️/🗑️ (el 📎
  sigue); cortan editar/borrar del registro, gestión, borrado en lote y `aprobarSolicitud`
  (`editar_mov`/`eliminar_mov`, también de v311). «🔍 Revisar duplicados» no los agrupa
  (`modalDetectarDuplicados` y el grupo de `_fusionarDuplicados` filtran `esMovPrestamo`) y
  `_eliminarDuplicado` se niega con `MSG_MOV_PRESTAMO`.
- Comprobantes: egreso de préstamo, reversos y lo que registró el admin (`creadoPor:'admin'`)
  no van a «faltantes». Un abono por banco que la oficina guarda sin archivo queda SIN
  comprobante: sale en «faltantes» y bloquea como cualquier transferencia hasta que suba el
  real con el 📎 del registro. Solo si Drive falla (o en modo prueba con archivo) lleva uno
  PENDIENTE, que no bloquea. «Comprobante pendiente» en Ver préstamo se lee del movimiento.
- `creadoPor` del movimiento es el autor del ítem (`item.por`; en `ini`, `p.creadoPor`),
  también cuando lo repone el reparador desde otra sesión.
- Carga incompleta (`_prestCargaIncompleta`): si la plata mueve caja, corta antes de tocar
  `DB.prestamos`.
- Reparador `_repararMovsPrestamo()`: al final de `_cargarMovimientosChunks` con carga
  completa (si repone algo, guarda en silencio 2 s después) y con «🔧 Reponer…» (Conciliar
  2). Solo oficinas completas y ids que coinciden; log `PRESTAMO_MOV_RECREADO`. No repone lo
  de otra sesión de hace menos de 10 minutos (el documento principal llega antes que los
  bloques de movimientos); un reverso reciente solo lo repone el admin.
- `revisarPrestamos`: el movimiento propio de un ítem anulado «sin reverso» (la plata sí se
  movió) no es huérfano; sí lo son el de un abono reasignado y luego anulado sin reverso, y
  el de un ítem enlazado y luego anulado.

## 8. Reportes: _movOperativo

`_movOperativo(m) = !esEntregaJefe(m) && !esMovPrestamo(m)`. Un préstamo no es gasto ni
ingreso; su neto (abonos − entregas) sí cuenta en la caja y en «Queda disponible» (tablero,
PDF, Excel y Reportes por oficina, donde también cuadra «En banco»).
Excluyen préstamos (sitios del parche):

- `renderDash`/`renderDashCharts` (ingresos, gastos con `mesEgrPrest`, formas de pago,
  conceptos, resumen por oficina, dona) y `renderRegistro` (gasto real del día con
  `prestEgrHoy`, aviso «🤝 Préstamos del día»).
- `renderReportes` (ingresos, egresos, balance, gastos, ganancia, mes anterior, conceptos,
  origen, cajitas), `_analizarCajaMes`, `_datosReporteExport`, PDF y Excel (`_movsCaja`
  completo para caja y detalle, `movs` operativo, fila «Préstamos (abonos − entregas)»).
- IA (`_construirContextoNegocio`): sin préstamos en totales y conceptos, más
  `prestamosCajaMes` y un resumen con `resumenPrestamo`/`estadoDe` y `prestamosPorPersona`.

Cuentan TODO a propósito (flujo de caja): tarjetas por forma de pago, tendencia, caja y
cuadre del registro, `verMovimientosMes`, gestión e importación, totales por día y
bolsillo, `getMesMovs` y `_cuentaEnCaja`. Las etiquetas «entregado»/«abonos recibidos» del
día y `prestamosCajaMes` de la IA no cuentan un reverso como entrega o abono: lo restan de lo
que revierte (las cuentas de gasto y disponible no cambian). En el resumen de la IA, un
préstamo por conciliar lleva `sal:0` y su saldo en `pc`. Todo sitio nuevo que sume egresos
como gasto usa `_movOperativo`.

## 9. Fusión entre sesiones

- `_fusionarConNube` (al guardar, siempre) y `_protegerLocalesEnSnapshot` (al recibir;
  reenvía solo si `_canonPrest`, que ignora `saldoPendiente`, difiere; freno de 3 reenvíos)
  llaman `_fusionPrestamoPura(loc, rem, tocoLocal)`. Si falla, sigue la regla general.
- Cabecera: gana `_tsRegistro`; estado: el `estadoMs` mayor (v311 sin él pierde); campo por
  campo: `oid/oidMs`, `personaId/personaIdMs`, `cedula/cedulaMs`, `cuotas+cuotaValor/cuotasMs`.
- `abonos`, `lineas`, `soportes`, `correcciones` (y dentro, `correcciones`, `comprobantes`)
  se unen por id: solo crecen. La misma línea en dos copias: gana `editadoMs`; la anulación
  manda salvo `reactivadaMs` posterior. v312 no crea lápidas de préstamos.
- Campos de cabecera que se escriben una sola vez y no tienen sello propio (`movIdInicial`,
  `movRefInicial`, `revMovIdInicial`, `revMsInicial`, `oidInicial`): si la copia ganadora
  los trae vacíos, gana el lleno de la otra (una copia vieja no borra un reverso ni un enlace).

## 10. Transición: publicar con el modo mantenimiento

No hay interruptor ni guarda de versión. v311 no entiende `lineas` ni el estado derivado
(su abono calcula `monto − abonos`, «Marcar pagado» no deja rastro y su `eliminarPrestamo`
filtra la lista). Por eso, fuera de horario: 1) activar el mantenimiento para OFICINAS
(`docs/08-modo-mantenimiento.md`), así el `_saveReal` de v311 deja de escribir; 2) publicar
v312 (las sesiones viejas ven «hay versión nueva»); 3) terminar el mantenimiento, entrar
como admin (corre el reparador), abrir «🧮 Conciliar préstamos», hacer el paso 0 y «Unir».

## 11. Paso 0: conciliación del 22-sep-2026

«🧮 Conciliar préstamos» (solo admin, `modalConciliarPrestamos`); todo deja línea o fila en
`correcciones[]` y log. Partida (21-sep): 20 préstamos, 12 activos, deuda $208.550.000.

| Qué | Dónde | Cómo |
|---|---|---|
| 4 «pagados» sin abonos y con saldo (fechaPago 10-jun): $1.950.000 | Sección 1 | «Condonado», «Pagado por fuera» o «Sigue debiendo → reabrir», con motivo |
| 4 préstamos sin oficina | Sección 3 | `asignarOidPrestamo` (antes de unir) |
| 3 abonos de nómina guardados como Efectivo | Sección 4 | «Pasar a Descuento Nómina» (`corregirFormaAbono`; nunca pasaron por caja) |
| 4 egresos de $50.000 «Préstamo <nombre>» (05, 15 y 26-ago, 07-sep) y 1 INGRESO de $50.000 por banco (10-ago) | Sección 5: los 3 de agosto se enlazan en parcial al «Préstamo inicial» de $450.000 del 31-ago («préstamos en oficina y transferencia en el mes de agosto»), que queda con «falta $300.000»; el del 07-sep, según decida Elkin | NO con «Ya salió» ni «Sumar»: eso sube la deuda y cuenta dos veces lo ya prestado. El ingreso, con «Ya entró» si es un abono |
| Egreso de $500.000 del 27-jun igual a un préstamo | Sección 5 | enlazar a «Préstamo inicial» (`enlazarMovExistente`) |
| Registro de prueba («Fkoapdsk…») | Ver préstamo → «🚫 Anular préstamo» | motivo «registro de prueba», sin reversos |
| 3 personas con 2+ activos en la misma oficina | Sección 7 | «Unir…» cuando no tengan hallazgos (antes, secciones 1 y 3) |

Al enlazar, la app dice cuánto bajan gastos o ingresos del mes ($750.000 de gastos de junio,
agosto y septiembre en total; queda en `PRESTAMO_MOV_ENLAZADO`). Las secciones 9 a 12 son
listas: atrasados, posibles préstamos por fuera o dobles, terceros sin soporte y nómina del mes.

## 12. Soportes y privacidad

- Pagaré y autorización de nómina son opcionales (`_PREST_TIPOS_SOPORTE`): `subirArchivoDrive(file, oid,
  'PREST_<pid>_<tipo>')`, máximo 8 MB; se guardan como los comprobantes (`fileId` + `url`);
  si falla, «¿Guardar sin soporte?». En prueba no sube.
- La FOTO de la cédula no se sube (decisión de privacidad: `main` se lee sin autenticar y con
  el `fileId` basta para abrir el archivo si se comparte con enlace). El tipo `cedula` no es
  válido y no está en ningún formulario. El NÚMERO de cédula del tercero sigue siendo un
  campo opcional; nunca va en WhatsApp ni en las solicitudes. Las reglas de Firebase están
  abiertas (`docs/SEGURIDAD-URGENTE.md`) y este repositorio es público: aquí no van nombres ni cédulas.

## 13. Leer los préstamos por REST (1 lectura)

`main` pesa unos 3,3 MB en REST; con máscara baja solo `prestamos` (~43 KB), 1 lectura:

```bash
curl -s "https://firestore.googleapis.com/v1/projects/inventario-88a28/databases/(default)/documents/oficinas_sistema/main?mask.fieldPaths=prestamos" \
 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const P=v=>v==null?v:'stringValue'in v?v.stringValue:'integerValue'in v?+v.integerValue:'doubleValue'in v?+v.doubleValue:'booleanValue'in v?v.booleanValue:'arrayValue'in v?(v.arrayValue.values||[]).map(P):'mapValue'in v?F(v.mapValue.fields||{}):null;function F(f){const o={};for(const k in f)o[k]=P(f[k]);return o;}for(const p of F(JSON.parse(s).fields||{}).prestamos||[]){const ab=(p.abonos||[]).filter(a=>a&&!a.anulado).reduce((t,a)=>t+(+a.valor||0),0);console.log(p.id,p.oid||'-',p.estado,p.monto,'abonado',ab,'lineas',(p.lineas||[]).length);}})"
```

El saldo exacto sale de `resumenPrestamo(p)`; en la consola de OFICINAS:
`personasConPrestamos()`, `revisarPrestamos()`, `extractoPersona('<personaId>', true)`. Los
movimientos viven en `movs_<oid>_<n>` (1 lectura por bloque): buscar `esPrestamo`.

**Pruebas.** El núcleo (de `// v312: NÚCLEO PURO` a `// v312: ACCIONES Y PANTALLAS`) corre
en `vm` de node con las definiciones reales de `_normalizarNombre`, `_levenshtein`, `_canon`,
`_tsRegistro`, `esEntregaJefe`, `now` y `fmtShort`: pasan 152 casos del núcleo, 74 de
acciones (con «Revisar duplicados») y 35 de pantallas con DOM falso, y las 6 pruebas v312 de
`PRUEBAS.html` en node. En la app, `?prueba=1` no sube nada (aviso 🧪).

## 14. Pendientes

Del ensamblaje (no se hizo o quedó simple): deshacer una unión en parte (hoy se niega y
aconseja «Reasignar abono»); aviso «ese día ya tuvo cuadre»; al entregar una autorización
con `fechaSolicitada` queda la fecha de hoy; un abono enlazado («Ya entró») exige el mismo
valor (el enlace parcial es solo para egresos); un enlace parcial no se deshace (se anula
el ítem); hallazgos de saldo
negativo y abono tras anular llevan a «Ver préstamo»; posibles dobles solo 120 días y 60
filas; bloques de `PRUEBAS.html` y revisión a 375 px; `AVISOS_PENDIENTES.gs` sin tocar
(tipos nuevos con nombre crudo, sin aviso de autorizaciones vencidas); pantalla para las
constantes; enlazar este documento desde `CLAUDE.md` y quitar «(pendiente)» del módulo.

Para después:
- Plan de cuotas con calendario (hoy solo `cuotas` y `cuotaValor`) y paz y salvo
  imprimible cuando la deuda llega a 0.
- Nómina ligada: que el descuento de RRHH cree el abono `nomina` (hoy se anota a mano).
- Juez y parte: responsables por oficina (`DB.config.prestResponsables`) cuyos préstamos
  y descuentos vayan siempre a solicitud.
- Reporte mensual de cartera: saldo inicial + entregas − abonos − condonaciones ± ajustes
  = saldo final, cuadrado contra los movimientos `esPrestamo` de caja y banco, con
  condonaciones y «pagado por fuera» como pérdida de cartera del mes.
