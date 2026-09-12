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
| `sgsst_config` | vigencia activa y fechas SGRL por vigencia, empresa, responsable SST, ARL, SMMLV por año, periodicidades, cargos con alturas, perfil por cargo, matriz de EPP, tallas, textos que se firman, catálogo de temas, contratistas (`personas`), resumen del semáforo por persona (`resumen`) | < 100 KB |
| `sgsst_estandares_<año>` | los 60 ítems calificados de esa vigencia (`items`, llave `i1_1_1`), plan de mejoramiento por ítem, adjuntos, ítems adicionales | < 200 KB |
| `sgsst_archivo_v1` | copia de los 21 ítems y las fichas del módulo viejo (v185). Se conserva; no se borra | pequeño |
| `sgsst_ficha_<pid>` | hoja de vida SST de una persona: afiliaciones, exámenes (solo aptitud, nunca diagnóstico), alturas, inducción, tallas, documentos, retiro, capacitaciones recibidas, actas de EPP firmadas, dotación forzada | uno por persona, < 50 KB |
| `sgsst_capacitaciones_<año>` | plan anual (`plan`) y sesiones (`sesiones`) con sus asistentes y el estado de cada firma (sin el trazo) | < 600 KB; si crece, partir por semestre |
| `sgsst_firma_<token>` | **una firma**: lo mínimo que lee la página pública `FIRMA_SST.html`. Al firmar recibe trazo (≤ 20 KB), hora del servidor, dispositivo, respuestas y hash SHA-256 | pequeño |
| `sgsst_dotacion_<año>` | actas de entrega de dotación/EPP (`entregas`) e inspecciones de EPP (`inspecciones`) | < 400 KB |
| `sgsst_eventos_<año>` | incidentes, accidentes y enfermedad laboral (`eventos`) con investigación, y ausencias por causa médica (`ausencias`) | pequeño |
| `sgsst_comites` | COPASST/Vigía, Convivencia (quejas), brigada (simulacros, inspecciones), alta dirección, psicosocial | < 300 KB |
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
