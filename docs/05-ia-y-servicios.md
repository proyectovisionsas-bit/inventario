## IA (Groq) — solo en OFICINAS

116 menciones en OFICINAS, 12 en INVENTARIO y 10 en TECNICOS (estas dos solo
para el chat de texto). Los usos reales: lectura de comprobantes de pago,
facturas de energía y un chat con contexto del negocio.

| Uso | Modelo | Estado (17 Ago 2026) |
|---|---|---|
| Visión (comprobantes, facturas) | `qwen/qwen3.6-27b` | ✅ **el único con entrada de imágenes en Groq** |
| Texto (chat) | `llama-3.3-70b-versatile` | ✅ activo |

`GROQ_MODELOS_VISION` es la **única** fuente: todas las llamadas la usan, se
intenta el primero y si Groq responde 400/404 pasa al siguiente. En la v235 se
quitaron `llama-4-maverick` (retirado el 9 mar 2026) y `llama-4-scout`
(retirado el 17 jul 2026), que figuraban como respaldos **estando ya muertos**:
cada fallo del primero costaba dos llamadas inútiles. Hoy la lista tiene uno
solo porque no hay alternativa; si Groq publica otra, agregarla ahí.

**Comprobar siempre en <https://console.groq.com/docs/vision> antes de tocar
modelos.** Groq retira modelos cada pocos meses y falla con 404, no con un aviso.

### ⚠️ La clave de Groq está expuesta

`obtenerAPIKey()` la lee de `DB.config.groqApiKey`, es decir de dentro de
`oficinas_sistema/main` — el documento que responde **HTTP 200 a peticiones
anónimas**. Lo mismo con `compsDriveClave` (la de subida a Drive).

A diferencia de las claves de empleados, estas son credenciales de terceros
utilizables desde cualquier parte sin saber nada del negocio. La solución de
fondo es la que ya se usa con WispHub: **proxy por el Worker de Cloudflare**,
con la credencial en el servidor y nunca en el navegador.

### Lo que está bien resuelto

- **Tesseract** (`_leerComprobanteOCR`) lee el comprobante en el propio
  navegador cuando la IA falla: no se depende de un solo proveedor.
- Cupo diario agotado: avisa cuántos se leyeron y cuántos faltan, sin perder nada.
- 401 y 429 tienen mensajes propios y comprensibles.
- El contexto del chat va **acotado** (`slice(0,10)`, `slice(0,5)`), no la base
  entera — pero incluye nombre, cédula y teléfono de algunos clientes y empleados.

## Servicios externos

- **Groq** (`api.groq.com`) — IA para lectura de comprobantes. La clave la pone el usuario.
- **Tesseract.js** — OCR en el navegador.
- **Google Drive** (`googleapis.com/drive/v3`) — respaldos.
- **Google Apps Script** — endpoint `/macros/s/.../exec`.
- **Cloudflare Worker** — `intermediario-wisphub.proyectovisions-a-s.workers.dev`, intermediario hacia WispHub.
- **SheetJS (xlsx)** y **Chart.js** por CDN — exportar a Excel y gráficas.
