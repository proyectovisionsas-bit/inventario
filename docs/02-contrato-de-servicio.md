## Flujo del contrato de servicio

| Dónde | Qué puede hacer |
|---|---|
| OFICINAS · ficha del cliente | 📄 Contratos: ver, reimprimir, firmar, PDF |
| OFICINAS · barra de clientes | ⚙️ Condiciones: precios de esa oficina |
| TECNICOS · orden con cliente | 📄 Contrato: generar, firmar y compartir en el sitio |

Un contrato = **un documento** `oficinas_sistema/contrato_<id>` con
`tipo:'contrato'`. Se buscan con una sola condición de igualdad sobre
`clienteCedula`, así que Firestore no pide índice compuesto y los demás
documentos de la colección (incluido `main`) ni se descargan. La firma va
dentro del documento (~4 KB); el documento completo ronda los 6 KB de 1024.

**No hizo falta cambiar las reglas de Firestore**: `match /oficinas_sistema/{docId}`
ya cubre cualquier documento de esa colección.

### Compartir el PDF

`PV_CONTRATO.compartirPDF(data)` devuelve `'archivo'`, `'descarga'` o `'cancelado'`.

- **Celular** (TECNICOS es una PWA en Android): `navigator.share` adjunta el PDF
  de verdad; WhatsApp recibe el archivo, no un enlace.
- **Computador**: el navegador no permite adjuntar, así que se descarga y se
  avisa al usuario. No es un fallo: es el límite de la plataforma.

`jsPDF` y `html2canvas` se cargan **solo al pedir un PDF**, no en cada arranque.

## `contrato.js` — código compartido entre apps

Es el primer archivo que **comparten** dos aplicaciones. Contiene el generador del
contrato de servicio y el logo institucional:

```
PV_CONTRATO.generarHTML(data)        -> HTML del contrato
PV_CONTRATO.abrirParaImprimir(data)  -> lo abre en pestaña nueva para imprimir
PV_CONTRATO.generarPDF(data)         -> Blob del PDF
PV_CONTRATO.compartirPDF(data)       -> 'archivo' | 'descarga' | 'cancelado'
PV_CONTRATO.puedeCompartirArchivos() -> true si el equipo puede adjuntar
PV_CONTRATO.firma.{iniciar,limpiar,vacia,obtener}
PV_LOGO                              -> logo en base64 (8.491 caracteres)
```

Se carga con `<script src="contrato.js?v=2"></script>`. En OFICINAS,
`_generarPDFContrato` es solo un delegado y `LOGO_PV` referencia a `PV_LOGO`,
así que el base64 existe **una sola vez** en todo el proyecto.

**Reglas al tocarlo:**
- **Nunca copiar su contenido dentro de un HTML.** El motivo de que exista es
  evitar lo que pasó con el módulo RRHH: dos copias que divergen en silencio.
- Al cambiarlo, **subir el `?v=N`** en las etiquetas `<script>` de todas las apps
  que lo cargan, o los navegadores servirán la copia vieja en caché.
- No debe depender de `DB`, `USER` ni de nada propio de una app: recibe `data` y
  devuelve HTML. Esa pureza es lo que permite usarlo desde TECNICOS.

## Condiciones del contrato por oficina

Los valores del contrato **cambian según la oficina** (hay 4: YESCENIA, ESNEIDER,
NATALIA, THOMAS). Cada una guarda los suyos en `oficina.contratoConfig`, y el
formulario de contrato llega prellenado.

`CONTRATO_CAMPOS` en OFICINAS es la única fuente de verdad: relaciona cada valor
guardado con su campo del formulario (`ctr_*`) y su valor por defecto. **Para
agregar un campo nuevo basta con añadir una fila ahí** — el modal de
configuración y el prellenado se generan de esa lista.

- `_aplicarConfigContrato(oid)` corre al abrir el modal de contrato y **solo
  llena lo que esté vacío o en cero**: nunca pisa lo que el asesor ya escribió.
- Editan el admin (cualquier oficina) y el rol `oficina` (solo la suya).

### ⚠️ Hay DOS listas de clientes — no confundirlas

| | Dónde | Cuántos | Para qué |
|---|---|---|---|
| **Comercial** | `oficinas_sistema/clientes_<ofiId>_<i>`, cargados en `oficina.clientes` por `_cargarClientesChunks` | **2.711** | la que ve el módulo de clientes de OFICINAS y la que usa el contrato |
| Técnica | `inventario/clientes_<i>` | 3.672 | equipos, ONU, señal |

La comercial es mucho más completa. Cobertura medida:

| Campo | Comercial | Técnica |
|---|---|---|
| nombre, direccion, telefono, plan, fechaInstalacion, estado | 100% | 87–100% |
| **tarifaMensual** | **100%** | 0% |
| **cedula** | **99%** | 73% |
| **barrio** | **99%** | 44% |
| email | — | 100% |

El correo solo está en la técnica; la tarifa y la cédula, solo completas en la
comercial. El contrato usa la **comercial**.

El contrato pide nombres y apellidos por separado y el cliente los tiene en un
solo campo `nombre`. `_partirNombre` asume dos apellidos (lo habitual en
Colombia), pero con tres palabras o partículas ("DE LA") se equivoca: es una
**propuesta editable**, nunca se guarda partida.
