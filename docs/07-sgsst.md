## SG-SST (Seguridad y Salud en el Trabajo)

Módulo de OFICINAS para el rol `sgsst` y el administrador. Se rehízo entre las
versiones 297 y 302 (sep 2026) siguiendo la Res. 0312/2019 (60 estándares
mínimos), el Decreto 1072/2015 y las normas de 2025-2026 (Res. 1843/2025,
Res. 3461/2025, Ley 2460/2025, Circular 0027/2026). El plan completo está en la
carpeta del SG-SST de OneDrive (`PLAN SG-SST - FASE 0.md`).

### Regla de oro: nada nuevo en `oficinas_sistema/main`

Todo lo del módulo vive en **documentos propios** de la colección
`oficinas_sistema`, se lee cuando se abre la pestaña y se escribe por campos con
`set(..., {merge:true})` (`_sgEscribir`). `main` no crece con el SG-SST. Las
funciones del módulo empiezan por `_sg` (internas) o `sg…SG` (botones).

| Documento | Qué guarda | Tamaño esperado |
|---|---|---|
| `sgsst_config` | vigencia activa y fechas SGRL por vigencia, empresa, responsable SST, ARL, SMMLV por año, periodicidades, cargos con alturas, perfil por cargo, matriz de EPP, tallas, textos que se firman, catálogo de temas, contratistas (`personas`), resumen del semáforo por persona (`resumen`). Desde la v315, en `vigencias[año]` van también `regimen`, `exigibles`, `alcance` y `regimenHistorial` (ver «Régimen de 21 o 60 estándares») | < 100 KB |
| `sgsst_estandares_<año>` | los 60 ítems calificados de esa vigencia (`items`, llave `i1_1_1`), plan de mejoramiento por ítem, adjuntos, ítems adicionales (desde la v315 se archivan con `archivada:true`, nunca se borran) y el resumen `puntaje` (desde la v315 con `regimen`, `exigibles`, `obtenidoExigible`, `pctExigible`) | < 200 KB |
| `sgsst_archivo_v1` | copia de los 21 ítems y las fichas del módulo viejo (v185). Se conserva; no se borra | pequeño |
| `sgsst_ficha_<pid>` | hoja de vida SST de una persona: afiliaciones, exámenes (solo aptitud, nunca diagnóstico), alturas, inducción, tallas, documentos, retiro, capacitaciones recibidas, actas de EPP firmadas, dotación forzada | uno por persona, < 50 KB |
| `sgsst_capacitaciones_<año>` | plan anual (`plan`) y sesiones (`sesiones`) con sus asistentes y el estado de cada firma (sin el trazo) | < 600 KB; si crece, partir por semestre |
| `sgsst_firma_<token>` | **una firma**: lo mínimo que lee la página pública `FIRMA_SST.html`. Al firmar recibe trazo (≤ 20 KB), hora del servidor, dispositivo, respuestas y hash SHA-256 | pequeño |
| `sgsst_dotacion_<año>` | actas de entrega de dotación/EPP (`entregas`) e inspecciones de EPP (`inspecciones`) | < 400 KB |
| `sgsst_eventos_<año>` | incidentes, accidentes y enfermedad laboral (`eventos`) con investigación, y ausencias por causa médica (`ausencias`) | pequeño |
| `sgsst_comites` | COPASST/Vigía, Convivencia (quejas), brigada (simulacros, inspecciones), alta dirección, psicosocial. Desde la v315, `psicosocial.aplicaciones` es un mapa por id con cada aplicación de la batería (solo el informe consolidado por grupos, nunca datos por persona; ver «Riesgo psicosocial») | < 300 KB |
| `sgsst_documentos` | políticas y documentos del sistema, perfiles de cargo, matriz IPEVR (`ipevr.filas`) | < 500 KB |
| `sgsst_plan_trabajo_<año>` | plan anual de trabajo SST-FT-97 (`actividades` por id, meses programados y ejecutados) | pequeño |

`pid` es el id del empleado de RRHH (o el id del contratista creado en SST),
pasado por `_sgPid` (solo letras, números, `.`, `-`, `_`).

`_sgAvisoTamano` avisa en consola cuando un documento pasa de 700 KB.

### Lo que el módulo NUNCA hace

- No cambia campos de `rrhh_empleados` ni de `ordenesTrabajo`.
- El rol `sgsst` no recibe el salario: `_sgPersonasRRHH` lo omite y la dotación
  de ley se decide con `_sgSalarioHasta2Smmlv`, que solo devuelve `si/no/sin`.
- No guarda diagnósticos médicos (solo concepto de aptitud y recomendaciones).
- No mete fotos ni archivos dentro de los documentos `sgsst_*`: los adjuntos van
  por `_subirDocfile` (≤ 650 KB) o enlace de Drive, igual que el resto de la app.
- No borra: todo se archiva (`archivada`/`archivado`/`estado:'archivada'`).
  Desde la v315 eso incluye los ítems adicionales (`archivarAdicionalSG`) y
  las aplicaciones de la batería psicosocial (`sgArchivarPsicoSG`).
- No guarda nada por persona de la batería de riesgo psicosocial: ni nombres,
  ni cédulas, ni `pid`, ni puntajes ni cuestionarios (Res. 2764/2022, art. 5).
  Nada psicosocial entra a `sgsst_ficha_<pid>`.
- Lo nuevo desde la v315 guarda en `registradoPor`, `archivadoPor` y `por` el
  rol (`USER.role`), nunca el nombre: la colección se lee sin autenticación
  desde internet.

### Firma desde el celular (Ley 527/1999)

`FIRMA_SST.html` es una página pública, sin login y sin `main`. Recibe
`?t=<token>`, lee **solo** `sgsst_firma_<token>` y, si está `pendiente` y no ha
vencido (7 días por defecto), muestra empresa, título, resumen, declaración,
preguntas de evaluación (sin la respuesta correcta) y un lienzo para firmar con
el dedo. Confirma los 4 últimos dígitos de la cédula (`personaDocUltimos4`) y
escribe `estado:'firmado'`, `firma.trazo`, `firmadoEn` (serverTimestamp),
`userAgent`, `respuestas` y `hash` = SHA-256 de
`token|personaNombre|titulo|fecha|declaracion|trazo`. Un documento firmado,
vencido, rechazado o reemplazado no se vuelve a firmar (`_sgPuedeFirmar`, misma
función en las dos páginas). Con `?prueba=1` no escribe.

OFICINAS crea el documento con `_sgCrearFirma(tipo, ref, persona, datos)` y lo
reconcilia con `_sgConsolidarFirma(doc)`: copia estado, hora y hash a la sesión
de capacitación o al acta de EPP y a la hoja de vida; el trazo se queda en el
documento de firma y el PDF lo lee de ahí. Mientras la ventana de firmas está
abierta hay **un solo** oyente (`where('firmaRef','==', '<año>|<id>')`), que se
apaga al cerrar (`_sgDejarFirmas`). `refId` de un acta de EPP empieza por `dot:`.

Las utilidades de trazo (`_sgSimplificarTrazo`, `_sgTrazoCompacto`,
`_sgTrazoATexto`) y el SHA-256 en JS puro (`_sgSha256JS`, para cuando no hay
`crypto.subtle`) están duplicadas en `FIRMA_SST.html`: si cambian en una página,
cambian en la otra. `PRUEBAS.html` lo comprueba.

**Advertencia aceptada:** con las reglas de Firestore abiertas, la única barrera
es el token (32 caracteres aleatorios). El diseño queda listo para la regla
futura "solo se escribe un `sgsst_firma_*` si su `estado` es `pendiente` y solo
los campos de firma".

### Cálculos que la ley fija (y las pruebas cubren)

- Puntaje de la autoevaluación: `_sgCalcular` (art. 27 y 28 de la Res. 0312).
  Desde la v315 acepta régimen y exigibles (`_sgCalcular(items, '21',
  exigibles)`, `_sgCalcularVig(v)`); sin ellos calcula igual que siempre.
- Capítulo de la Res. 0312 que le toca a la empresa: `_sgCapituloSugerido`
  (arts. 3, 9, 15 y 16: 7, 21 o 60 estándares).
- Periodicidad de la batería de riesgo psicosocial: `_sgPsicoPeriodicidadMeses`
  (Res. 2764/2022, art. 3: cada año si alto o muy alto; si no, entre 12 y 24
  meses) y su semáforo `_sgPsicoEstado`.
- Vencimientos por persona: `_sgResumenPersona` (examen por cargo, alturas,
  inducción, afiliaciones, retiro a 5 días hábiles con `_sgSumarDiasHabiles`).
- Dotación de ley: `_sgElegibleDotacion` (más de 3 meses y hasta 2 SMMLV),
  períodos `_sgPeriodoDe` (30-abr, 31-ago, 20-dic). Nunca "compensar en dinero".
- Reposición de EPP: `_sgReposiciones` (vida útil de la matriz por perfil).
- Plazos de un accidente: `_sgPlazosEvento` (FURAT 2 días hábiles, investigación
  15 días, Ministerio si es grave o mortal).
- Indicadores: `_sgIndicadores` (art. 30 de la Res. 0312 + índices del SST-FT-30).
- Quejas de convivencia: `_sgDiasQueja` (65 días). Comités: `_sgSugerirComites`.
- Plan de trabajo: `_sgCumplimientoPT`. Alertas del Panel: `_sgAlertas`.

### Cierre del módulo viejo (v185)

`sgMigrarV1` copió `DB.sgsst_items` y `DB.sgsst_fichas` a `sgsst_archivo_v1` y
creó las vigencias 2025 y 2026. El botón **🧹 Sacar los datos viejos de main**
(⚙️ Configuración, solo admin, v302) comprueba que el archivo exista y tenga al
menos lo mismo que `main`, crea la hoja de vida de quien tenía datos viejos, y
solo entonces quita los dos campos de `main` (`FieldValue.delete`) y marca
`config.sgsstLimpiado`. Desde ahí `save()` ya no los vuelve a escribir. Hay que
pulsarlo **después** de publicar v302 y de que todas las sesiones abiertas se
hayan actualizado.

### Formatos de la empresa que se reproducen

SST-FT-27 (asistencia), SST-FT-26 (evaluación), SST-FT-24/28 (plan y control de
capacitaciones), SST-FT-63 (entrega de EPP), SST-FT-64 (inspección de EPP),
SST-FT-34 (reporte de eventos), SST-FT-30 (indicadores), SST-FT-97 (plan de
trabajo), SST-FT-33 (matriz IPEVR, importable) y la tabla oficial de estándares
mínimos (Excel y PDF). Los PDF salen de jsPDF + autotable, cargados bajo demanda;
el QR de la sesión usa `qrcode-generator` desde cdnjs, también bajo demanda.

### Régimen de 21 o 60 estándares por vigencia (v315)

**Base legal.** Res. 0312/2019: art. 3 → 7 estándares (hasta 10
trabajadores, riesgo I, II o III); art. 9 → 21 estándares (11 a 50
trabajadores, riesgo I, II o III); arts. 15 y 16 → 60 estándares (más de 50
trabajadores, o riesgo IV o V). Art. 27: cada ítem vale su máximo si cumple o
cero; «no aplica» con justificación vale el máximo; **en los ítems que no
aplican a la empresa por su capítulo se otorga el porcentaje máximo en la
columna No Aplica**; el total va sobre 100. Art. 28: menos de 60 crítico (plan
inmediato, informe a la ARL en 3 meses); 60 a 85 moderadamente aceptable (ARL
en 6 meses); más de 85 aceptable.

**Decisión del dueño (26 sep 2026), manda.** La clase de riesgo que decide el
capítulo es la de la **actividad económica principal** de la empresa según su
afiliación a la ARL (Decreto 768 de 2022; Decreto-ley 1295 de 1994, art. 25),
no la de cada trabajador ni de cada centro de trabajo. Que haya técnicos
afiliados en clase V no cambia el capítulo. Por eso el módulo pide la «clase de
riesgo de la actividad económica principal» y el dato de técnicos en clase V es
solo una nota informativa (`alcance.notaCentros`). La frase vieja de la
bienvenida («la empresa tiene técnicos en clase de riesgo V… le aplican los
60») se quitó: la matriz de 60 es la tabla oficial completa; cuántos se exigen
(7, 21 o 60) depende del número de trabajadores y de esa clase de riesgo, y se
fija por vigencia.

**Dónde se guarda.** En `sgsst_config.vigencias[<año>]`, con merge, junto a
`plazoCircular`, `cierrePlataforma` y `registradaEn`, que ya vivían ahí:

| Campo | Qué es |
|---|---|
| `regimen` | `'21'` o `'60'`. Ausente = `'60'` (lo de siempre) |
| `exigibles` | los códigos exigibles con los que se fijó: copia de `SGSST_ITEMS_21` en ese momento, o `null` en régimen 60 (= todos; Firestore no admite `undefined`). Así el puntaje de esa vigencia se reproduce aunque la constante cambie después |
| `alcance` | `trabajadores`, `claseRiesgoPrincipal` (`'I'`…`'V'`), `actividadPrincipal`, `fuente` (certificado ARL o carta del asesor, y fecha), `fechaCertificado`, `notaCentros`, `capituloSugerido` (`'7'`, `'21'`, `'60'` o `'sin_datos'`) |
| `regimenHistorial` | MAPA por id con `de`, `a`, `motivo`, `por` (rol), `en` y `alcance`. Nunca un array: `set merge` reemplaza los arrays enteros y dos sesiones se pisarían. Solo crece |

`sgsst_estandares_<año>.puntaje` (lo escribe `_sgResumenPuntaje` desde
`_sgGuardarItem`, `sgCerrarVigencia`, `sgNuevaVigencia` y `sgImportarOficial`)
lleva además `regimen`, `exigibles` (cantidad), `obtenidoExigible` y
`pctExigible`. Nadie lo lee para pintar. **Los 60 ítems guardados en `items`
no se tocan por el régimen**: cambiar de 21 a 60 o al revés no borra ni
reescribe ninguna calificación.

**La constante `SGSST_ITEMS_21`** (junto a `SGSST_MAPA_V1`) es la única lista
de los 21 códigos del art. 9 sobre la tabla de 60:
`1.1.1, 1.1.3, 1.1.4, 1.1.6, 1.1.8, 1.2.1, 2.1.1, 2.4.1, 2.5.1, 3.1.1, 3.1.2,
3.1.4, 3.1.6, 3.2.1, 3.2.2, 4.1.2, 4.2.5, 4.2.6, 5.1.1, 5.1.2, 6.1.3`. Suman
37,75 (PLANEAR 9,5 · HACER 27 · VERIFICAR 1,25 · ACTUAR 0); los otros 39 suman
62,25. La migración vieja `SGSST_MAPA_V1` usó además 1.1.7 y 4.1.1: quedan
como no exigibles y su calificación heredada se conserva como voluntaria. Si la
plataforma SGRL habilita otros ítems, se ajusta esa constante y nada más (el
comentario que la acompaña explica cómo, con la captura de SGRL); las vigencias
ya fijadas siguen con su propia copia en `exigibles`. `SGSST_REGIMENES` tiene el
nombre y la descripción de cada régimen para pantalla. Helpers:
`_sgRegimenDe(anio)` (`'21'` o `'60'`), `_sgExigiblesDe(anio)` (el array
guardado, `SGSST_ITEMS_21` si falta, `null` en 60) y
`_sgExigible(codigo, regimen, exigibles)`.

**Cómo se calcula (art. 27).** `_sgCalcular(items, regimen, exigibles)`: sin
los dos parámetros extra, o con `'60'`, devuelve exactamente lo de siempre (la
prueba de la tabla oficial del Ministerio sigue igual). Con `'21'`, cada ítem
no exigible suma su valor completo (`def.v`) sin mirar lo guardado y no cuenta
en `calificados`, `faltan`, `noCumplen`, `sinJustificar` ni `parciales`;
devuelve además `regimen`, `exigibles`, `noExigibles`, `puntosExigibles`
(37,75), `puntosNoExigibles` (62,25), `obtenidoExigible`, `pctExigible`,
`voluntarios` (no exigibles calificados por control interno) y, en
`porCiclo[c]`, `exigible` y `obtenidoExigible`. `porGrupo` y `porEstandar`
siguen sumando lo obtenido, incluido lo que entra por ley. No muta `items`.
Es la misma lectura de la herramienta de autoevaluación de la ARL: con 21
estándares e incumpliendo solo 6.1.3 da 98,75; todo sin cumplir da 62,25
(moderadamente aceptable). `_sgCalcularVig(v)` aplica el régimen de la vigencia
y reemplaza todas las llamadas `_sgCalcular(v.items)`; lo mismo
`_sgFilasPlanVig(v)` con `_sgFilasPlan(v)`.

**Qué pasa con los 39.** En ✅ Estándares el filtro `window._sg.filtros.exigibles`
(`'si'` por defecto en régimen 21, `'todos'`, `'no'`; el select solo se ve en
21) los deja plegados en un `<details>` «39 ítems no exigibles en este
régimen». Cuando se ven, van atenuados, con la etiqueta «➖ No exigible · suma
{v} por ley (art. 27)» y el select habilitado para control interno:
`sgCalificar` avisa que calificarlos no cambia el puntaje oficial. Calificar
«no aplica» un ítem que SÍ se exige pide confirmación antes de la
justificación: sin una razón legal es una manifestación falsa en un documento
público. El contador dice «21 exigibles · n calificados · 39 no exigibles
(suman 62,25 por ley) · puntaje oficial X · cumplimiento de lo exigible Y %».
El Panel (`_sgCuerpoPanel`) mantiene el oficial «X /100 · RANGO» y, en 21,
añade el cumplimiento de lo exigible (indicador interno, no es la calificación
de estándares mínimos) y el bloque «💬 Explícame este puntaje», que separa lo
que entra por ley, lo que cumple, lo que falta y los tres exigibles de mayor
valor sin cumplir; los conteos y los vencimientos cuentan solo exigibles.
`SGSST_GUIA_60` guarda por código (los 21 por ahora) qué pide el ítem y qué
sirve como evidencia; se pinta en `modalItemSG` («Qué pide» / «Sirve como
evidencia», con la etiqueta «Exigible en su régimen» o «No exigible (suma por
ley)») y en cada fila como «❔ ¿Qué pide?» plegado.

**Exportes.** `_sgFilasOficiales(v, regimen, exigibles)`: sin parámetros
extra, idéntica (60 filas × 11 columnas, mismos textos). Con `'21'`, las filas
no exigibles llevan `''` en Cumple, `''` en No cumple, `'X'` en No aplica y la
justificación «No aplica: empresa de 11 a 50 trabajadores clasificada en riesgo
I, II o III (arts. 9 y 27, Res. 0312 de 2019)», aunque en `items` estén sin
calificar o calificadas por control interno; las exigibles conservan lo
guardado; el puntaje de cada grupo sale de `c.porGrupo`; la fila TOTALES no
cambia. `_sgFilasPlan(v, regimen, exigibles)`: en 21 entran los exigibles que
no cumplen o están en «no aplica» sin justificar, y cualquier ítem, exigible o
no, que ya tenga `plan` (p. ej. 7.1.2 con las acciones derivadas de
`_sgAccionesDerivadasSG`). `_sgEncabezadoExport(anio)` añade la línea
«Régimen: 21 estándares (art. 9, Res. 0312/2019) · Trabajadores: n · Clase de
riesgo de la actividad principal: X» (o «60 estándares (art. 16)»). El PDF
añade en 21 «Régimen: 21 estándares (art. 9) · Cumplimiento de lo exigible:
Y % (indicador interno)»; la hoja «Ciclos» del Excel no cambia.

**Cómo se fija.** 🗓️ Vigencias muestra la columna «Régimen» (21 / 60 y fecha
en que se fijó) y el botón «⚖️ Régimen» → `modalRegimenSG(anio)` (solo
`_sgPuede()`). El asistente explica los tres capítulos y la regla de la
actividad económica principal, y pregunta: cuántas personas trabajan para la
empresa (planta, contratistas por prestación de servicios y personal en
misión; prellenado con las personas activas de `_sgTodasPersonas`), en qué
clase de riesgo está la actividad económica principal en la afiliación a la
ARL (certificado de afiliación o planilla PILA), la actividad principal, la
nota de trabajadores en otra clase y de dónde sale el dato.
`_sgCapituloSugerido(trabajadores, clase)` → `'sin_datos'` si falta algo;
`'60'` si clase IV o V o más de 50; `'7'` hasta 10; `'21'` de 11 a 50. Solo con
sugerido `'21'` se puede escoger 21 (o 60); con `'60'` o `'sin_datos'` la
opción 21 queda deshabilitada (documento público firmado, arts. 15 y 16); con
`'7'` el módulo aún no maneja ese capítulo, se consulta con la ARL y mientras
tanto queda en 60. `sgGuardarRegimenSG(anio)` valida (trabajadores > 0, clase,
fuente), escribe con `_sgEscribir('sgsst_config', { vigencias:{ [anio]:{…} } })`,
suma una entrada al historial con `por: USER.role`, mezcla en `window._sg.config`
con `_sgMezclar` y deja log `SGSST_REGIMEN`; si esa vigencia está cargada y
abierta, también reescribe su resumen `puntaje` con el régimen nuevo, para que
el documento no siga diciendo el total anterior. `sgNuevaVigencia` hereda
régimen y alcance de la activa (historial `motivo:'heredado de <año>'`); los
exigibles salen de la constante `SGSST_ITEMS_21` vigente, no de la copia de la
activa. `sgImportarOficial` pasa lo parseado por
`_sgDetectarRegimenImportado(items)`: si todos los no exigibles vienen «no
aplica» y al menos un exigible trae otra calificación, el archivo parece de una
empresa de 21 y pregunta antes de guardar (historial `motivo:'importado del
Excel oficial'`); si no se confirma 21, no escribe régimen (la vigencia sigue
«sin confirmar» y calcula con 60). Antes de decidir si la vigencia existe
relee `sgsst_config` (`_sgRefrescarConfig`), y sobre una que ya existe relee
además su documento en la nube (`_sgLeer`); no incluye la clave `adicionales`,
no fuerza `cerrada:true` ni `creadoEn`, y solo escribe los ítems que el
archivo TRAE (los que no vienen conservan su calificación y su marca «va en
parte»): de cada uno `calificacion` y `actualizadoEn`, `trabajo` vacío salvo
en no_cumple, y `justificacion` solo en no_aplica, conservando la propia si el
ítem ya tenía una (`_sgItemsImportados(items, yaExiste, prevItems)`). El
`puntaje` que escribe se calcula sobre lo que quedará en el documento
(`_sgItemsTrasImportar(prevItems, importados)`: lo guardado con lo importado
encima), no sobre los 60 en blanco. El confirm dice cuántos ítems no vienen en
el archivo. Como el `set merge` reemplaza arrays enteros, escribir los 60
ítems vacíos habría borrado el plan, los adjuntos, el responsable, la fecha
objetivo y la evidencia de todos.

**Bloqueo en vigencia cerrada o registrada.** `_sgRegimenBloqueado(anio)` →
`{bloqueado, motivo}`: no se cambia el régimen de una vigencia cerrada
(`cerrada===true`) ni de una ya registrada en SGRL (`registradaEn` no vacío).
El modal muestra el régimen actual y el motivo, sin botón de guardar; antes
de pintarlo carga la vigencia si no estaba en memoria (`_sgCargarVigencia`).
El candado definitivo está en `sgGuardarRegimenSG`: relee el documento de la
vigencia en la nube (`_sgLeer`) y refresca `cerrada` en memoria, y relee
`sgsst_config` (`_sgRefrescarConfig`: fusiona la nube sobre la memoria con
`_sgMezclar` y toma `exigibles` tal cual, porque un `null` no pisa un arreglo)
para que `registradaEn`, el régimen y el alcance fijados desde otra pantalla
cuenten; todo antes de decidir. Si no puede leer alguno de los dos, avisa y
no guarda (una vigencia cerrada o registrada en la nube pero no en memoria ya
no cambia de régimen ni se queda con un `puntaje` calculado con el otro
régimen). El importador respeta el mismo bloqueo: importa las calificaciones
(el aviso lo dice), pero si la vigencia está cerrada o registrada y ya tiene
régimen fijado, no lo cambia; si la nube falla, el aviso sale en español
(`_sgTraducirError`); si está
bloqueada pero aún no tiene régimen, sí pregunta (fijarlo por primera vez
desde el documento oficial no es cambiarlo, y `registradaEn` no se puede
borrar). Tampoco ofrece 21 si el alcance registrado dice `capituloSugerido`
'7' o '60' (misma regla que `sgGuardarRegimenSG`): avisa que hay que corregir
el alcance primero. Si la vigencia ya es 21 no vuelve a preguntar ni escribe
historial, y calcula con los exigibles guardados en ella (`_sgExigiblesDe`).

**En pantalla.** El subtítulo de `renderSGSST` dice «Res. 0312 de 2019 · 21
estándares (art. 9)» o «60 estándares (art. 16)», con el chip «⚖️ Régimen» que
abre el asistente; si la vigencia no tiene `regimen` fijado, el chip sale en
ámbar «Régimen sin confirmar: se calcula con 60». La pestaña cuenta
«Estándares (n/21)» o «(n/60)». Al publicar la v315 ninguna vigencia de la
nube tiene régimen: todo sigue calculando con 60 hasta que se fije.

**Ítems adicionales: se archivan.** `eliminarAdicionalSG` ya no existe.
`archivarAdicionalSG(id)` pide motivo (mínimo 5 caracteres), marca
`archivada:true`, `archivadoEn`, `archivadoPor` (rol) y `motivoArchivo`,
conserva los adjuntos y no llama `_borrarDocfile`; guarda con
`_sgGuardarAdicionales` y deja log `SGSST_ADICIONAL_ARCHIVADO`. La memoria
solo cambia cuando la nube confirma: `_sgGuardarAdicionales` asigna
`v.adicionales` después del `_sgEscribir`, y tanto archivar como editar
(`guardarAdicionalSG`) trabajan sobre una copia del ítem, así un guardado
fallido no deja el ítem archivado ni editado en pantalla mientras el aviso
dice «No se guardó». Los documentos de un ítem archivado son solo lectura:
`_sgAdjuntosDe('adicional', id)` devuelve `soloLectura:true` y el modal de
adjuntos no ofrece cargar ni borrar (igual que una aplicación archivada de la
batería; el aviso es genérico: «Este registro está archivado…»). La tarjeta
muestra solo los vivos, con «🗄️ Archivar» en vez de 🗑️, y un `<details>`
«Archivados (n)» con su motivo. Su ayuda dice cuándo crear uno (exigencias
propias del ISP, de un cliente, de la ARL o de una certificación que no están
en la Res. 0312), que no suma en la autoevaluación y que se archiva, no se
borra.

### Riesgo psicosocial: batería e ítem anexo (v315)

**Base legal.** Res. 2764/2022: art. 3 (evaluación anual si el nivel de riesgo
de la Forma A o de la Forma B es alto o muy alto; si no, como mínimo cada 2
años), art. 4 (solo instrumentos oficiales sin modificar), art. 5 (el empleador
solo conserva informes consolidados por grupos; nunca instrumentos ni
resultados individuales). Res. 2646/2008: art. 3 lit. p (la aplica un psicólogo
con posgrado en SST o salud ocupacional y licencia vigente), art. 11 (reserva y
consentimiento informado). Ley 2460/2025, art. 9 (bienestar y salud mental
articulados con la ARL). En la tabla de 60 no hay un ítem «batería»: su
evidencia respalda 4.1.2, 3.1.1, 3.1.2 y 1.1.8.

**Estructura de `aplicaciones`.** En `sgsst_comites.psicosocial` (el documento
se crea con la primera escritura), `aplicaciones` es un MAPA por id
`{ [id]: aplicacion }`, por la misma razón que `regimenHistorial`: un array se
pisaría entre sesiones. Cada aplicación lleva:

| Grupo | Campos |
|---|---|
| identidad | `id` (`'ps'` + hora en base 36 + sufijo), `fecha`, `modalidad` (`'presencial'`, `'virtual_ministerio'`, `'virtual_otra'`) |
| quién la aplicó | `aplicador` con `nombre`, `licencia`, `posgrado`, `entidad`; `arlAcompana` |
| cobertura | `totalTrabajadores`, `evaluadosA`, `evaluadosB` |
| resultado por grupos | `nivelA`, `nivelB`, `nivelExtralaboral`, `nivelEstres`, `nivelMax`, `anualObligatoria`, `reservados` |
| garantías | `consentimiento`, `reservaExperto`, `custodia` (`'ips'`, `'interno'`, `'psicologo_externo'`) |
| informe y plan | `fechaInforme`, `dominiosPrioritarios`, `planIntervencion`, `adjuntos` |
| rastro | `registradoPor` (rol), `registradoEn`, `archivada`, `archivadoEn`, `archivadoPor` (rol), `motivoArchivo` |

Los niveles salen de `SGSST_PSICO_NIVELES` (`sin_riesgo`, `bajo`, `medio`,
`alto`, `muy_alto`; `''` = sin dato) y `_sgPsicoNivelMax(app)` toma el mayor
en ese orden. Los campos viejos (`ultimaBateria`, `resultado`, `acciones`,
`proxima`) se siguen escribiendo con la última aplicación viva
(`_sgPsicoCamposViejos`), así una sesión v314 sigue leyendo lo suyo;
`adjuntos` sigue siendo la lista general vieja (`_sgAdjuntosDe('psico','x')`)
y no se recalcula desde la aplicación: el informe de cada aplicación va en
`aplicaciones[id].adjuntos`. `_sgPsicoUltima(ps)` devuelve la última viva y,
si no hay aplicaciones pero sí `ultimaBateria`, la trata como `legacy` (con
los `adjuntos` generales, que cuentan como informe consolidado).
`_sgPsicoVivas(ps)` son las no archivadas, de la más reciente a la más vieja.
`_sgPsicoResumenTexto(app)` arma «Nivel máximo: alto · Forma A: reservado
(menos de 5) · Forma B: alto · …» para `resultado` y para pantalla.

**Regla de los 5 evaluados (privacidad).** Un nivel por grupo solo se guarda
si ese grupo tiene 5 o más evaluados: si `evaluadosA < 5`, `nivelA` queda
`''` y `'A'` entra en `reservados`; igual `nivelB` con `evaluadosB`;
`nivelExtralaboral` y `nivelEstres` solo si `evaluadosA + evaluadosB >= 5` (si
no, `'extra'` y `'estres'` en `reservados`). `nivelMax` y `anualObligatoria`
se calculan ANTES de reservar y siempre se guardan: es lo único que necesita
la periodicidad. Lo hace `_sgPsicoRegistroDe(form, base)`, que arma la
aplicación desde un objeto plano con lista blanca (números con `Number`,
booleanos con `!!`; cualquier otra llave, como `pid`, `documento`, `persona` o
`puntaje`, se descarta) y no lee el DOM: el modal recoge los inputs y se los
pasa. `anualObligatoria` = Forma A o Forma B en alto o muy alto (Res. 2764,
art. 3: son las formas A y B las que mandan).

**Periodicidad 12/24.** `_sgPsicoPeriodicidadMeses(app, cfg)`: 12 meses si
`anualObligatoria` o `nivelMax` alto/muy alto; si no,
`periodicidades.psicosocialMeses` acotado entre 12 y 24; sin aplicación, el
valor de configuración tal cual (su etiqueta en ⚙️ Configuración: «Batería
psicosocial cuando aún no hay nivel registrado (meses, entre 12 y 24)»).
`_sgPsicoEstado(ps, hoy, cfg)` → `{ estado, vence, meses, app, faltantes }`
con `_sgVenceDesde` (`'ok'`, `'pronto'`, `'vencido'`, `'sin'`); `faltantes`
lista lo que le falta a la última aplicación: aplicador con licencia,
consentimiento informado, compromiso de reserva del experto, informe
consolidado (fecha o adjunto), plan de intervención, nivel de riesgo.

**Qué nunca se guarda.** Nada por persona: ni nombres, ni cédulas, ni `pid`,
ni puntajes ni cuestionarios; nada psicosocial entra a `sgsst_ficha_<pid>`.
Los adjuntos de una aplicación (`_sgAdjuntosDe('psico', id)`; `'x'` sigue
siendo la lista general vieja) son el informe consolidado por grupos, y antes
de subir uno hay que marcar la casilla «Este archivo es el informe consolidado
por grupos y NO contiene resultados por persona». Si `window._sg.com` no ha
cargado, `_sgAdjuntosDe` devuelve `null` y el modal pide intentar en un
momento. `registradoPor` y `archivadoPor` guardan el rol. El modal lo dice
arriba: esta base es visible desde internet.

**Guardar y archivar.** `modalPsicosocialSG(id)` registra una aplicación con
los campos de la tabla y su ayuda (qué es la batería, quién puede aplicarla,
cada cuánto, qué guarda la empresa); «editar» crea una aplicación NUEVA a
partir de la anterior y archiva la anterior con
`motivoArchivo:'Corregida por una aplicación nueva'`.
`sgGuardarPsicosocialSG(idAnterior)` valida fecha y nombre del aplicador,
escribe con `_sgEscribir('sgsst_comites', { psicosocial:{ aplicaciones, ultimaBateria, resultado, acciones, proxima } })`,
actualiza `window._sg.com` y deja log `SGSST_PSICOSOCIAL_APLICACION`.
`sgArchivarPsicoSG(id)` pide motivo (mínimo 5 caracteres), marca
`archivada:true`, `archivadoEn`, `archivadoPor` (rol) y `motivoArchivo`,
recalcula los campos viejos con la nueva última viva y deja log
`SGSST_PSICOSOCIAL_ARCHIVADA`. `_sgCargarComites` trae el default
`psicosocial.aplicaciones:{}`.

**Corregir con un grupo reservado.** La aplicación nueva nace de
`_sgPsicoRegistroDe(datos)` y, si corrige otra, pasa por
`_sgPsicoHeredarReservado(app, datos, anterior)`: un grupo que quedó reservado
en la anterior (menos de 5 evaluados) ya no tiene nivel guardado y su select
llega vacío. Si se deja vacío, se heredan de la anterior el nivel máximo
(cuando es mayor que el recalculado) y la evaluación anual, vengan del grupo
que vengan: con lo que se guarda no se puede saber si el máximo lo puso el
grupo reservado o un grupo visible que empató con él, así que un empate (A
oculto «alto» y B visible «alto») corregido bajando B sigue «alto» y anual,
como promete la nota del modal; para recalcular hay que escribir el nivel de
cada grupo reservado, y entonces se recalcula puro. El modal lo avisa bajo
los niveles. Sin esto,
corregir solo la licencia habría bajado una batería «muy alto» a «bajo» y
quitado la evaluación anual (Res. 2764/2022, art. 3).

**Adjuntos compartidos.** La corrección copia las entradas de adjuntos (mismo
`docId`) a la aplicación nueva, así que la viva y la archivada apuntan al mismo
`docfile_<id>`. `_sgAdjuntosDe('psico', id)` devuelve `soloLectura:true` para
una archivada (el modal solo deja abrir: es historial) y `compartido(docId)`
(`_sgPsicoDocIdCompartido`); `eliminarAdjuntoSGSST` quita la entrada de la
lista, pero solo llama `_borrarDocfile` cuando ninguna otra aplicación ni la
lista general usan ese archivo. Mira la memoria (`window._sg.com`), no la nube.

**Fila anexa PS.** En ✅ Estándares, después de la tabla (y del bloque de no
exigibles) y antes de los adicionales: cabecera «ANEXO · Riesgo psicosocial
(Res. 2646/2008 · Res. 2764/2022 · Ley 2460/2025) — no suma en la
autoevaluación oficial; su evidencia respalda 4.1.2, 3.1.1, 3.1.2 y 1.1.8» y
UNA fila virtual con código `PS`: no es un ítem de la matriz, no va en `items`
y no tiene select de calificación. Muestra el semáforo y el texto de
`_sgPsicoEstado` («🟢 Vigente hasta …», «🟡 Por vencer», «🔴 Vencida», «⚪ Sin
aplicar»), nivel máximo, aplicador, faltantes en rojo y los botones ✏️
(`modalPsicosocialSG()`), 📎 (adjuntos de la última aplicación, o `'x'` si no
hay) y 📋 → `modalPlanSG('4.1.2')`. Si `window._sg.com` aún no cargó, dice
«leyendo…» sin lanzar error. Fondo lila suave y cabe a 375 px con el bloque
`@media (max-width:900px)` que ya existe.

**Chips de evidencia, alertas y tarjeta.** `_sgEvidenciaItem` añade en 4.1.2,
3.1.1, 3.1.2 y 1.1.8 el chip «🧠 Batería psicosocial: aplicada dd/mm/aaaa ·
nivel X · próxima dd/mm/aaaa» (estado ok/pronto/vencido/sin, con `ir` a la
tarjeta de comités; «🧠 Batería psicosocial: leyendo…» si `sg.com` no cargó).
`_sgAlertas` usa `_sgPsicoEstado`: «sin registrar», «vencida el …» o «vence el
… (anual porque el nivel es alto)», solo mientras no esté vigente; si
`anualObligatoria`, alerta azul «Riesgo
psicosocial alto o muy alto: evaluación anual y vigilancia epidemiológica con
la ARL (Res. 2764/2022, art. 3)»; si hay `faltantes`, alerta ámbar «A la
batería le falta: …». Cada una con clave propia para que no se dupliquen. La
tarjeta de psicosocial en comités (`_sgCuerpoDireccion`) muestra semáforo,
nivel máximo, aplicador (nombre y licencia), cobertura (evaluados / total),
próxima aplicación con su motivo (12 o 24 meses), faltantes en rojo, los
botones «✏️ Registrar aplicación», «📎 Informe consolidado» y «📋 Plan →
4.1.2», y la tabla de aplicaciones vivas con «🗄️ Archivar» y, plegadas, las
archivadas con su motivo. Excel: hoja nueva «Anexo psicosocial» (fecha,
aplicador, licencia, modalidad, cobertura, nivel máximo, niveles por grupo o
«reservado», próxima, plan). PDF: párrafo «Anexo · Riesgo psicosocial: …» bajo
la tabla, sin tocar `_sgFilasOficiales`.

**Registro de auditoría nuevo (v315):** `SGSST_REGIMEN`,
`SGSST_PSICOSOCIAL_APLICACION`, `SGSST_PSICOSOCIAL_ARCHIVADA`,
`SGSST_ADICIONAL_ARCHIVADO`. Los existentes no cambian.

**Pendiente de la fase de seguridad.** `_sgEscribir` sigue guardando
`actualizadoPor` con el nombre completo (`USER.nombre`, y solo si falta, el
rol) en cada documento `sgsst_*`, en una colección que se lee sin autenticación
desde internet. Lo nuevo de la v315 ya guarda solo el rol; ese campo se cambia
a rol cuando entre la autenticación real (`docs/SEGURIDAD-URGENTE.md`).
