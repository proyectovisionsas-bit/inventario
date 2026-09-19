# Antes de llamar al ingeniero (OFICINAS v311, TECNICOS v97, `checklists.js?v=1` · 19 Sep 2026)

Pedido de Elkin (19 Sep 2026): hay un solo ingeniero y lo llaman por todo. Debe
ser la ÚLTIMA instancia: antes, la oficina o el técnico recorren una lista corta
por servicio, anotan 6 a 9 datos de verdad (potencia, bombillos, ping…) y la app
dice de quién es el caso: cartera, comercial, técnico, la persona que autoriza
módems o, ahora sí, el ingeniero (y arma la ficha de WhatsApp). Sus respuestas:

| Respuesta de Elkin | Dónde quedó |
|---|---|
| TV de cuatro formas: TV Box, app en el Smart TV, app en el celular y RF por la misma fibra | `servicios.tv.variantes`: `tvbox`, `app_tv`, `app_movil`, `rf` |
| Módems de varias marcas | los pasos hablan de bombillos (POWER, PON, LOS), no de un modelo |
| La oficina SÍ valida en Winbox, solo mirando | pasos `f_o_sesion`, `f_o_cortados`, `f_o_ping` y sus pares `r_o_*` |
| Una persona por sede autoriza módems nuevos | salida `autorizador`; caso `caso_modem_no_aparece` con `primeroA:'autorizador'` |
| Un solo ingeniero; un grupo de WhatsApp por sede | `wa.me/?text=` sin número: la persona escoge el grupo. El teléfono del ingeniero no se guarda en ninguna parte |
| Sin piloto por etapas: sale para todos a la vez | fibra, radio, TV e instalación, en las dos apps |

## Arquitectura

`checklists.js` (raíz del repo, 1.396 líneas) es UNA sola copia para las dos
apps, igual que `contrato.js`. Expone `window.PV_CHECK` y tiene tres partes:

1. **Datos**, entre `// <<DATOS>>` y `// <</DATOS>>` (líneas 46–269):
   `PV_CHECK_DATOS` = `version`, `servicios` (`fibra`, `radio`, `tv`, `instalacion`;
   cada uno con `sintomas`, `variantes`, `oficina[]`, `tecnico[]`), `comun`
   (`oficina`, `tecnicoInicio`, `tecnicoFin`), `casos` (los 23 «cuándo sí»:
   `{id, texto, via: llamada|mensaje, servicios[], roles[], primeroA}`), `nunca`,
   `motivosNoPude`, `causasResuelto` (20), `reglasGenerales`. Hoy: 95 pasos y 329
   guías `siMal`, 48 de ellas con `si`.
2. **Motor sin pantalla** (también corre en node): `pasos`, `semaforo`, `evaluar`,
   `textoWhatsApp`, `resumenOrden`, `registro`, `docMes`, `resumenMes`,
   `tablaMesHTML`, `masivaNueva`, `masivasVigentes`, `textoMasiva`, `franjaHTML`.
3. **Pantalla propia**: `abrir(op)`, `abrirMasiva(op)`, `cerrar()`, `pendientes()`,
   `reenviarPendientes(guardar)`, `claveBorrador(op)`. Es la capa `#pvCheckCapa`,
   pegada a `<body>` con z-index 99990 (debajo de mantenimiento y de «hay versión
   nueva»). Como no vive en `#appContent` ni en `#list`, no se borra cuando otra
   sesión guarda. **El botón Atrás del celular la cierra** (el borrador queda): al
   abrir deja UNA entrada `history.pushState({pvck:1},'')` con un solo listener de
   `popstate`; la ✕ y `cerrar()` la devuelven con `history.back()`. Las apps no usan
   historial. Tras recargar con la capa abierta, el primer Atrás no hace nada.

`checklists.js` no conoce Firebase. Cada app le pasa un objeto `op`: quién es
(`app`, `rol`, `quien`, `oficinaId`, `municipio`, `municipios`), la `precarga` del
cliente, funciones (`masivas`, `guardar`, `guardarMasiva`, `cerrarMasiva`,
`crearOrden`, `alCerrar`, `aviso`) y `modoPrueba`, `oscuro`. El pegamento:

| | OFICINAS v311 (módulo en ~línea 28968) | TECNICOS v97 (módulo en ~línea 2454) |
|---|---|---|
| Entradas | menú Comercial → `renderIngeniero()`; botón rojo de `modalVerCliente` → `ingAbrirDesdeCliente(oid,cid)`; `ingAbrir()`, `ingAbrirMasiva()` | botón ancho `#ingBtnTec` → `ingAbrirTec()` (con varias oficinas toma la de su orden activa más reciente; sin órdenes, `TEC.oficinas[0]`); «🛑 Antes de llamar» en la orden → `ingAbrirDesdeOrden(id)`, solo en los tipos de `_ING_TIPOS_TEC` |
| Arma `op` | `_ingOp(oid, precarga)` con `_ingPrecargaDe(o,c)`; `op.masivas` devuelve `_ingVigentes()` | `_ingOpTec(oficinaId, precarga)` |
| Guarda | `_ingGuardar`, `_ingGuardarMasiva`, `_ingCerrarMasiva` (permiso: `_ingPuedeCerrarMasiva`) | `_ingGuardarTec`, `_ingGuardarMasivaTec`, `_ingCerrarMasivaTec` (permiso: `_ingPuedeCerrarMasivaTec`) |
| Al terminar | `_ingCrearOrden(resumen, servicio, valId)` abre `_formOrden` ya escrito; `guardarNuevaOrden` le pone `servicio` y `valId` a la orden | `_ingAlCerrarTec(estado, ordenId)` propone la nota en `modalNota` si salió `resuelto` o `pendiente`; solo «Guardar nota» escribe |
| Franja | `iniciarEscuchaFallasMasivas()` desde `enterApp`; `#ingFranja` encima de `#appContent`. El tic de 5 min vuelve a suscribir si el listener se cayó; `doLogout` reinicia `window._ing` y esconde la franja | `iniciarEscuchaFallasMasivasTec()` / `detenerEscuchaFallasMasivasTec()` (en `doLogout`); `#ingFranjaTec` dentro de `#ingBarraTec` |
| Reenvío | `PV_CHECK.reenviarPendientes(_ingGuardar)` a los 8 s de entrar y con «Reintentar» (`ingReintentar`) | `PV_CHECK.reenviarPendientes(_ingGuardarTec)` a los 8 s de entrar |
| Quita un aviso de falla masiva | `_ingPuedeCerrarMasiva`: el admin, cualquiera; una oficina, solo los que ELLA reportó (`porApp:'oficinas'` y su mismo nombre) | `_ingPuedeCerrarMasivaTec`: solo el técnico que lo reportó (`porApp:'tecnicos'` y su nombre, recortado con `masivaNueva` igual que al guardar). No hay admin en esta app: el admin quita desde OFICINAS |
| Casos del mes | `ingCargarMes()` → `resumenMes` → `tablaMesHTML` (admin: todas; oficina: la suya). «Mes anterior» sale deshabilitado antes de septiembre de 2026 («sin datos: las listas empezaron en septiembre de 2026») y un `mesSel='anterior'` se trata como `'actual'`: no gasta lecturas ni rotula septiembre como agosto. `_ingMesHay` no lleva fecha fija: lo deduce de `PV_CHECK.docMes` | no tiene |
| Contratos (arreglo de lecturas que viajó en la v97) | no cambia | ya no se releen en cada snapshot de `main`: hay caché (`window._contratosTec`) y se relee al entrar a la pestaña (`setTab` la vacía), tras crear o firmar, o con el botón «🔄 Actualizar» (`_renderContratosTec(true)`). Si la lectura FALLA la caché queda en `null`, no en `[]` (`[]` valía como caché y no se reintentaba), y `_contratosTecFallo` cambia el texto vacío a «No se pudieron cargar los contratos. Toca 🔄 Actualizar.» |

- El municipio sale de la oficina: `ciudad` y, si falta, `nombre` (`_ingMunicipioDe`,
  `_ingCiudadOfiTec`). Las dos apps deben derivarlo igual o la franja no coincide.
- La precarga de OFICINAS calcula «orden abierta» y «visitas de 30 días» solo por
  `clienteId`: las órdenes hechas a mano con «Nueva orden» no cuentan. `o.servicio`
  solo existe en las órdenes nacidas de una validación (v311 en adelante).
- Finales de línea: TECNICOS es todo LF; OFICINAS mezcla 226 CRLF con ~34.300 LF y
  el tool Edit lo convierte TODO a LF. Editar con scripts de reemplazo exacto.

## El contrato de un PASO

Cada paso es UN renglón JSON dentro del bloque de datos:

```
{ "id": "f_o_potencias",             // único en TODO el archivo; letras, números y _; no empieza por número
  "bloque": "Plataforma de la OLT",  // título del grupo en pantalla
  "titulo": "…", "ayuda": "…",       // la acción, y el «¿Cómo se hace?» desplegable (ahí va el «bien = …»)
  "obligatorio": true,               // sin responderlo no deja pasar al ingeniero (evaluar().puedeEscalar)
  "sintomas": [], "variantes": [],   // vacío = aplica siempre; si no, solo con esos ids del servicio
  "campos": [ { "id": "f_o_potencias_onu", "etiqueta": "…", "tipo": "numero|opcion|sino|texto",
                "opciones": [ { "v": "los", "t": "LOS en rojo", "color": "verde|amarillo|rojo|" } ],
                "unidad": "dBm", "semaforo": "rx_onu|rx_olt|senal_radio|wifi|perdidos|ccq|",
                "sinDato": "No reporta" } ],   // botón alterno, solo en tipo numero; "" = sin botón
  "siMal": [ { "cuando": "…", "hacer": "…",
               "salida": "cartera|comercial|masiva|autorizador|tecnico|ingeniero_llamada|ingeniero_mensaje|resuelve|",
               "si": { "campo": "f_o_bombillos_luces", "v": ["los"] } } ],   // opcional: ver «Agregar una guía con si»
  "seguridad": false,                // true solo en c_t_alturas: «No pude: condición insegura» no penaliza
  "posicion": "" }                   // informativo; el orden real es el del arreglo
```

- `pasos()` arma la lista: oficina = `comun.oficina` + `servicio.oficina`; técnico =
  `comun.tecnicoInicio` + `servicio.tecnico` + `comun.tecnicoFin`; luego filtra
  por síntoma y variante. Prefijos de id: `c_o_`, `c_t_`, `f_o_`, `f_t_`, `r_o_`,
  `r_t_`, `t_o_`, `t_t_`, `i_t_`; el id de un campo empieza por el de su paso.
- Se responde Bien / Con problema / No pude (+ motivo). Un dato en rojo deja el
  paso en «Con problema»; esa marca automática (`e.auto`) se quita sola si el rojo
  desaparece: teclear «-21» cifra a cifra no marca nada. La respuesta manual, no.
- Con problema, rojo o amarillo se MUESTRAN todas las guías `siMal` del paso. La
  SUGERENCIA solo la mueven las que traen `si` y cuyo campo coincide (`guiaCoincide`):
  `si:{campo,v:[códigos]}` para un campo de un toque, o `si:{campo,color:['rojo',
  'amarillo']}` para un número con semáforo (o una opción, por su color). Sin `si`
  la guía solo se muestra. Si ninguna coincide la sugerencia sale neutra; si
  coinciden varias gana la primera de: `cartera`, `comercial`, `masiva`,
  `ingeniero_llamada`, `autorizador`, `tecnico`, `ingeniero_mensaje`, `resuelve`.
  La llamada va antes que técnico porque sus guías solo existen sobre opciones que
  hablan de VARIOS clientes (puerto caído, torre vacía, casi nadie conectado, la
  plataforma no carga). Al técnico, ya en sitio, nunca se le da `tecnico`.

### Agregar una guía con `si`

1. Escoger un campo del MISMO paso que distinga el caso: `opcion` (hoy casi todas
   son así; `sino` también vale, pero no tiene color) o un `numero` con semáforo. Si falta la opción, agregarla con
   color (un `v` nuevo = subir `version`): las guías solo cuentan con el paso en
   problema, rojo o amarillo.
2. Escribir la guía, al FINAL de `siMal`, con su `salida` y `"si": { "campo": "<id
   del campo>", "v": ["cod1", "cod2"] }`. Se compara el CÓDIGO (`opciones[].v`; en
   `sino`, `si`/`no`), no el texto. En un `numero` se usa `"si": { "campo": "…",
   "color": ["rojo", "amarillo"] }`; con `"sinDato": false` el botón alterno («No
   reporta», «Sin luz») NO cuenta (así está la potencia de `f_o_potencias`: el rojo
   con número sugiere técnico y «No reporta» no mueve nada). Una etiqueta equivocada
   es peor que ninguna: nunca etiquetar por color una guía de llamada o de masiva.
3. Si `campo` o un código no existen, la guía nunca coincide y nadie avisa. Probar
   en node: sobre `e=PV_CHECK.nuevoEstado({rol:'oficina'})` (o `'tecnico'`) poner
   `e.servicio` y `e.datos[campo]`; `PV_CHECK.evaluar(e).sugerencia.salida` debe dar
   la salida con ese código y `''` con cualquier otro.

### Agregar o corregir un paso

1. Editar SOLO dentro de `// <<DATOS>>`. El motor no depende de ids concretos.
2. Corregir redacción (`titulo`, `ayuda`, `cuando`, `hacer`, `t`) no cambia ids. Si
   se agrega, quita o renombra un id (paso, campo, opción `v`, caso, motivo, causa):
   subir `PV_CHECK_DATOS.version`. Eso descarta los borradores viejos y queda como
   `v` en cada registro. Los ids viejos ya guardados no se borran.
3. CADA cambio de `checklists.js`, aunque sea una coma, exige todo esto junto:
   - subir el `?v=` de `<script src="checklists.js?v=N">` en LOS DOS HTML
     (OFICINAS línea 16, TECNICOS línea 83), con el mismo número;
   - subir `APP_VERSION` (OFICINAS) y `APP_VERSION_TEC` (TECNICOS): sin eso las
     sesiones abiertas siguen con la lista vieja;
   - publicar TECNICOS fuera de jornada: al subir su versión todos los técnicos
     ven «actualizar» y deben recargar. Por eso las correcciones se AGRUPAN.
4. `node --check checklists.js`, `node .claude/validar.mjs` y las pruebas de abajo.

## Semáforos y umbrales (`PV_CHECK.semaforo(tipo, valor)`)

| `semaforo` | Verde | Amarillo | Rojo |
|---|---|---|---|
| `rx_onu` potencia que recibe el módem | −10 a −25 | −25 a −27, o −8 a −10 | peor que −27, o más fuerte que −8 (saturado) |
| `rx_olt` potencia que recibe la OLT | −26 o mejor | −26 a −28 | peor que −28 |
| `senal_radio` señal de la antena | −45 a −65 | −65 a −72, o −40 a −45 | peor que −72, o más fuerte que −40 |
| `wifi` donde se queja el cliente | mejor que −65 | −65 a −75 | peor que −75 |
| `perdidos` paquetes perdidos | 0 | 1 (repetir) | 2 o más |
| `ccq` calidad del enlace de radio, % | 90 o más | 70 a 89 | menos de 70 |

La app pone el signo menos sola y acepta coma decimal. El botón alterno (`sinDato`)
cuenta ROJO en `rx_onu`, `senal_radio` y `perdidos`, y amarillo en los demás. Los
umbrales viven en la función `semaforo`, no en los datos: el renglón de la OLT se
ajusta ahí cuando el ingeniero confirme los módulos de cada sede.

## Las salidas (campo `sal` del registro)

| `sal` | Cómo se llega |
|---|---|
| `resuelto` | «Quedó resuelto» + una causa de `causasResuelto` (queda en `causa`) |
| `orden` | solo OFICINAS: «Crear orden al técnico»; llama `op.crearOrden(resumen160, servicio, id)` y en el mismo clic guarda el caso. La pantalla final dice que la orden quedó escrita, pero la oficina todavía debe pulsar «Crear orden» en el formulario que se abre. Ese formulario (lleva `#fo_valid`) NO se cierra con un clic fuera, y Cancelar y la ✕ piden confirmar: el caso ya quedó guardado y no se puede retomar. Si igual salen sin crearla, el caso sigue contando como «orden» en «Casos del mes» |
| `pendiente` | «Queda pendiente otra visita» |
| `ingeniero` | respondió los obligatorios, escogió un caso que aplica a su servicio y rol (queda en `caso`) y tocó «Abrir WhatsApp» o «Copiar texto». Primero sale WhatsApp y después se guarda: si no, el celular bloquea la ventana |
| `masiva_conocida` | «Este cliente es de esa falla»: el id de la falla queda en `caso` |

## Dónde se guarda y cuánto cuesta

- **Cada caso** → `oficinas_sistema/esc_AAAA_MM_<oficinaId>` (`PV_CHECK.docMes`, en
  hora local): `set({ items:{ [id]: json }, actualizadoMs }, { merge:true })`.
  `json` es UN TEXTO con el registro: `{id, v, app, rol, serv, sint, vari, of, mun,
  porId, porNombre, sw, ord, iniMs, finMs, sal, caso, causa, h, t, pr[], np{}, d{}}`
  (`sw` servicio en WispHub; `ord` id de la orden con tope de 32: los reales
  miden 23 y entran COMPLETOS, se cruza por igualdad, y `_ingAlCerrarTec` de
  TECNICOS compara también a 32; `h`/`t` pasos hechos/total; `pr` pasos con
  problema; `np` motivo de cada «No pude»; `d` los datos medidos). Por qué un
  texto: como mapa serían unos 40 campos por caso, Firestore indexa cada uno y
  el tope de 40.000 entradas de índice por documento se reventaría hacia los 500
  casos. Un caso pesa 0,8 a 1 KB: caben unos 1.000 por oficina y por mes; si el
  `set` falla por tamaño («exceeds the maximum», «too large», `INVALID_ARGUMENT`)
  se reintenta UNA vez en `<docId>_b`. Costo: **1 escritura, 0 lecturas**; nadie
  escucha ese documento.
- **Fallas masivas** → `oficinas_sistema/fallas_masivas` = `{ activas:{ [id]: m } }`
  con merge. Es el ÚNICO listener nuevo (`onSnapshot` en las dos apps): 1 lectura
  por sesión al entrar + 1 por cambio en cada sesión abierta. Reportar o quitar =
  1 escritura.
- **Casos del mes** (OFICINAS): no lee nada hasta pulsar «Cargar»; son 2 lecturas
  por oficina visible (el documento del mes y su `_b`). No se actualiza solo.
- **En el navegador** (`localStorage`): la cola `pv_check_pend` = `[{docId, id,
  json, ms}]`, máximo 200, y el borrador, que caduca a las 12 horas o al cambiar
  `datos.version` y se borra al cerrar el caso. El caso entra a la cola ANTES de
  subir y sale cuando el servidor confirma; si ni a la cola entra, la capa avisa.
- **El borrador es por persona**: `pv_check_borrador_<app>_<quien>` (`op.quien.id`
  o, si falta, el nombre; solo `[A-Za-z0-9_]`, 24 letras), para que en un equipo
  compartido nadie retome ni borre el caso de otro. No se escribe a mano:
  `PV_CHECK.claveBorrador({app:'oficinas', quien:{id:'u_ana'}})` da
  `pv_check_borrador_oficinas_u_ana`. El texto libre entra al borrador ya filtrado.
- **`reenviarPendientes(guardar, topeMs?)`** lleva bandera (una segunda llamada
  recibe la MISMA promesa: nada sube dos veces) y tope de 20 s por registro (con
  mala señal Firestore ni resuelve ni rechaza): al vencer sigue sin borrar nada.
- **`main` no se toca** (va al 76 % de 1 MiB): solo `servicio` y `valId` en la
  orden que nace de una validación, y la nota del técnico si él la confirma.
- Con `window._mantBloqueando` los `guardar` rechazan con `'mantenimiento'` y el
  caso espera en la cola. Con `?prueba=1`, `_ingGuardar` también rechaza y no hay
  reenvío: ahí las escrituras «responden bien» sin escribir y la cola real de ese
  navegador se vaciaría sin subir nada.
- Siempre `db.collection('oficinas_sistema').doc(id)`, nunca `db.doc('ruta')`. Sin
  campos de primer nivel `tipo`, `clienteCedula` ni `firmaRef`: hay consultas
  sobre toda la colección por esos campos.

## Qué NO se guarda, y por qué

Las reglas de Firebase están abiertas (`docs/SEGURIDAD-URGENTE.md`): cualquiera
puede leer y cambiar esos documentos. Por eso ni en la nube ni en la ficha van
nombre completo (solo el primero, y solo en la ficha), cédula, dirección,
teléfono, IP, usuario PPPoE, claves, serial, MAC ni fotos. Las fotos (máximo 2)
van por el chat; las claves se dictan por llamada. Un campo `texto` pasa por un
filtro que tapa IP, MAC y números de 7 o más cifras; aun así, no crear campos que
inviten a escribir datos del cliente. `registro()` y `masivaNueva()` ya limpian:
el pegamento NO les agrega campos. Por lo mismo, ni las listas ni el teléfono del
ingeniero viven en la nube.

## La falla masiva

Botón rojo «🚨 Reportar falla masiva o apagón», siempre a la vista; lo único
obligatorio es el servicio («Todos los servicios» guarda `'todo'`). `masivaNueva`
arma `{id, tipo: masiva|apagon, municipio, servicio, comun, afectados, desdeMs,
hayLuz, mensajeCliente, porApp, porNombre, creadaMs, venceMs, cerradaMs,
cerradaPor}`. Primero abre WhatsApp (`textoMasiva`), después guarda.

- **Vence sola a las 6 horas.** `masivasVigentes(mapa, ahora, municipios)` deja las
  no cerradas, no vencidas y del municipio (sin tildes ni mayúsculas); con la
  lista vacía muestra todas. Se repinta cada 5 minutos. Como la nube no es de
  fiar (reglas abiertas), ahí mismo se acota: nunca más de 6 h desde `creadaMs`
  diga lo que diga `venceMs`, fuera las creadas más de 1 h en el futuro, máximo 8
  (las más nuevas) y textos recortados (municipio 40, `comun` 80, mensaje 200).
  Devuelve COPIAS limpias; un aviso sin `id` toma la clave del mapa.
- **Solo informa, nunca bloquea.** Roja = falla, ámbar = apagón («por apagón no
  hace falta llamar»). Oficina y técnico ven las de su municipio, también dentro
  de la capa; el admin, todas. Al reportar sí se ofrecen todos los municipios: una
  oficina puede reportar una falla de otro municipio que luego ni ve ni quita.
- Quitar el aviso = `{ activas:{ [id]:{ cerradaMs, cerradaPor } } }` con merge. Lo
  quita quien lo reportó o el admin (tabla de arriba, fila «Quita un aviso»); a los
  demás el enlace «Ya se arregló» les responde con un aviso, y vence solo a las 6 h.
- Los avisos viejos se quedan en `activas` (no se borran datos): a unos 15 campos
  por aviso, el tope de índices llegaría hacia los 2.500 avisos.

## Cómo se prueba

- **`PRUEBAS.html`** trae tres pruebas: las listas cumplen el contrato (con las
  funciones puras: semáforos en los bordes, filtros, registro sin datos personales
  ni `undefined`, `docMes` al filo del mes, vencimiento a las 6 h, HTML escapado);
  OFICINAS abre, precarga y en modo prueba no sube nada; TECNICOS leído como
  texto. Motor y capa se prueban además en node, con DOM e historial simulados.
  El borrador se busca con `PV_CHECK.claveBorrador(op)`; con `#fo_valid` en
  pantalla, Cancelar y la ✕ se detienen en un `confirm()` (`closeModal()` no).
- **OFICINAS con `?prueba=1`**: todo el recorrido sin subir nada (menú, buscador,
  ficha del cliente, orden con «🛑 validada», franja, «Casos del mes», celular a
  375 px). La capa avisa «Modo prueba: no se sube a la nube».
- **TECNICOS no tiene modo prueba.** NUNCA abrir la copia local con la versión
  nueva: registra la versión en la nube y bloquea a los técnicos. Se prueba
  inyectando el código sobre la publicada o, ya publicada, con un técnico de prueba.
- Sin señal (modo avión): el caso queda en `pv_check_pend` y sube solo a los 8 s
  de volver a entrar (`PV_CHECK.pendientes()` → 0). Sin `checklists.js` (bloquearlo
  en la pestaña de red): las dos apps dan un aviso claro y nada revienta.

## Leer los casos por REST (cada GET es 1 lectura)

El `<oficinaId>` sale de `DB.oficinas.map(o=>o.id+' '+o.nombre)` en la consola de
OFICINAS. No listar la colección entera: cobra una lectura por documento.

```bash
curl -s "https://firestore.googleapis.com/v1/projects/inventario-88a28/databases/(default)/documents/oficinas_sistema/esc_2026_09_<oficinaId>" \
 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const it=((JSON.parse(s).fields||{}).items||{mapValue:{}}).mapValue.fields||{};for(const k in it){const r=JSON.parse(it[k].stringValue);console.log(new Date(r.finMs).toLocaleString('es-CO'),r.porNombre,r.serv,r.sal,r.caso,r.h+'/'+r.t,JSON.stringify(r.np),JSON.stringify(r.d));}})"
```

Repetir con `_b` si el mes se llenó; las fallas, con `oficinas_sistema/fallas_masivas`.
Si no imprime nada, el documento no existe (nadie cerró un caso ese mes).

## Ideas para después

- **Más guías etiquetadas.** De 244 guías con salida, 70 traen `si` (el resto solo se
  muestran): las que faltan dependen de algo que ningún campo recoge (p. ej.
  «está en la lista de cortados Y debe»: el campo solo dice sí/no). Darles su
  opción es cambiar las listas (nuevo `v` = subir `version`).
- **Causa real anotada por el ingeniero** al cerrar un caso escalado; **fotos a
  Drive** (nunca a Firestore); **enlace con RED** para la potencia esperada de
  cada NAP o puerto.
- **Service worker** para abrir sin señal: hoy la lista sirve si la app ya estaba
  abierta, pero no abre desde cero.
- **Usuario de Winbox de solo lectura REAL** para las oficinas: el grupo `read` de
  fábrica de Mikrotik permite `reboot`, `sensitive` (ver claves) y `sniff`. Crear
  un grupo propio solo con `read`, `winbox` y `test` (el ping lo necesita).
- Pendientes menores: limpiar avisos viejos de `fallas_masivas`; enlazar este
  documento desde `CLAUDE.md` y anotar ahí `checklists.js` con su `?v=`; nombrar
  `claveBorrador` y `topeMs` en la cabecera de `checklists.js`; la guía de «torre
  lenta» de `r_o_lento_wifi` no lleva `si` (falta la opción «3 o más de la torre»).
