// ════════════════════════════════════════════════════════════════════
// IA (GROQ) · PROYECTOVISION — código compartido
//
// Lo cargan OFICINAS, TECNICOS e INVENTARIO con <script src="ia.js"></script>.
// UNA sola copia: antes había SIETE llamadas a Groq repartidas por las tres
// apps, cada una con su propio manejo de errores y de distinta calidad. Solo
// una (la carga de comprobantes por lote) sabía esperar cuando Groq pide
// esperar; ninguna tenía tiempo límite, así que si Groq no respondía la app
// se quedaba girando para siempre. Ahora todas pasan por aquí.
//
// API:
//   PV_IA.texto({...})    -> pregunta de texto; devuelve la respuesta como cadena
//   PV_IA.vision({...})   -> lee imágenes; devuelve la respuesta como cadena
//   PV_IA.json({...})     -> igual que los anteriores pero devuelve el objeto ya
//                            interpretado (pide a Groq que responda en JSON)
//   PV_IA.MODELOS_TEXTO  -> lista de modelos de texto (el 1o, y respaldos)
//   PV_IA.MODELOS_VISION  -> lista de modelos que leen imágenes
//   PV_IA.mensajeDeError(e) -> texto claro y en español para mostrarle al usuario
//
// Parámetros que aceptan texto/vision/json:
//   apiKey      (obligatorio) la clave de Groq
//   messages    (obligatorio) los mensajes, formato de Groq
//   temperature, maxTokens    valores por defecto razonables si no se pasan
//   timeoutMs   cuánto esperar antes de rendirse (por defecto 90 segundos)
//   reintentos  cuántas veces reintentar si Groq pide esperar (por defecto 2)
//   alEsperar   función opcional (segundos, intento, total) para avisar en
//               pantalla mientras se espera
//
// Los errores que lanza llevan una etiqueta en e.tipo para que quien llama
// decida qué mensaje mostrar:
//   'clave'          la clave es inválida o falta
//   'limite'         Groq pide esperar y ya se reintentó lo permitido
//   'limite_diario'  se agotó la cuota del DÍA (esperar no sirve)
//   'grande'         la consulta lleva demasiada información
//   'tiempo'         Groq no respondió a tiempo
//   'red'            no hubo conexión
//   'modelo'         Groq retiró el modelo y no queda ninguno de respaldo
//   'http'           cualquier otro error del servidor
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var URL_GROQ = 'https://api.groq.com/openai/v1/chat/completions';

  // ── Modelos ────────────────────────────────────────────────────────
  // Groq retira modelos cada pocos meses. Ya pasó con llama-4-maverick,
  // llama-4-scout y, el 18 ago 2026, con llama-3.3-70b-versatile: el
  // asistente dejó de responder de un día para otro con un HTTP 404.
  // Por eso TEXTO también lleva lista de respaldo, no solo VISION: si el
  // primero desaparece, se pasa solo al siguiente en vez de caerse.
  // Comprobado contra la API de Groq (GET /openai/v1/models) el 18 ago 2026.
  // Para actualizar: cambiar AQUÍ y las tres apps quedan al día.
  var MODELOS_TEXTO = ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b'];
  var MODELOS_VISION = ['qwen/qwen3.6-27b'];
  var MODELO_TEXTO = MODELOS_TEXTO[0];   // el vigente, por comodidad

  // Cuál de cada lista está funcionando ahora. Si Groq retira el primero, se
  // pasa al siguiente y se recuerda, para no repetir el fallo en cada llamada.
  var idxRecordado = { vision: 0, texto: 0 };

  function fallo(tipo, mensaje, extra) {
    var e = new Error(mensaje);
    e.tipo = tipo;
    if (extra) e.detalle = String(extra).substring(0, 300);
    return e;
  }

  // Cuántos segundos pide esperar Groq: primero la cabecera oficial, y si no
  // viene, el texto del error ("try again in 4.5s").
  function segundosDeEspera(respuesta, textoError) {
    var seg = parseInt(respuesta.headers.get('retry-after') || '0', 10);
    if (!seg) {
      var m = String(textoError).match(/try again in\s+([\d.]+)\s*(ms|s|m)/i);
      if (m) {
        var n = parseFloat(m[1]);
        seg = /^m$/i.test(m[2]) ? n * 60 : (/^ms$/i.test(m[2]) ? Math.ceil(n / 1000) : n);
      }
    }
    // Nunca menos de 1s ni más de 75s: por encima de eso conviene rendirse
    // y devolverle el control a la persona.
    return Math.min(Math.max(Math.ceil(seg || 60), 1), 75);
  }

  function esLimiteDelDia(txt) {
    return /per day|requests per day|tokens per day|\bRPD\b|\bTPD\b/i.test(String(txt));
  }

  function esConsultaMuyGrande(estado, txt) {
    if (estado === 413) return true;
    var t = String(txt).toLowerCase();
    return t.indexOf('context') >= 0 || t.indexOf('too large') >= 0 ||
           t.indexOf('reduce the length') >= 0;
  }

  // Un envío, con tiempo límite. Sin esto, un fetch puede quedarse esperando
  // indefinidamente y la app se queda girando sin que el usuario pueda hacer nada.
  function enviar(cuerpo, apiKey, timeoutMs) {
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var reloj = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs) : null;
    return fetch(URL_GROQ, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: cuerpo,
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (reloj) clearTimeout(reloj);
      return r;
    }, function (e) {
      if (reloj) clearTimeout(reloj);
      if (e && (e.name === 'AbortError' || /abort/i.test(String(e.message)))) {
        throw fallo('tiempo', 'La IA no respondió en ' + Math.round(timeoutMs / 1000) +
                              ' segundos. Revisa tu conexión y vuelve a intentarlo.');
      }
      throw fallo('red', 'No se pudo conectar con la IA. Revisa tu conexión a internet.', e && e.message);
    });
  }

  function esperar(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  // ── El núcleo: una llamada con reintentos y respaldo de modelo ──────
  async function llamar(op) {
    op = op || {};
    var apiKey = op.apiKey || '';
    if (!apiKey) throw fallo('clave', 'Falta la clave de la IA. Configúrala con el botón ⚙️.');
    if (!op.messages || !op.messages.length) throw fallo('http', 'No hay nada que preguntarle a la IA.');

    var modelos = op.modelos && op.modelos.length ? op.modelos.slice() : [op.modelo || MODELO_TEXTO];
    // Con qué llave recordar el modelo que funciona ('vision' o 'texto').
    var memoria = op.memoria || null;
    var i = memoria ? Math.min(idxRecordado[memoria] || 0, modelos.length - 1) : 0;
    var timeoutMs = op.timeoutMs || 90000;
    var maxReintentos = (op.reintentos === undefined) ? 2 : op.reintentos;

    // Los modelos de Groq de 2026 RAZONAN antes de contestar, y ese razonamiento
    // gasta tokens del mismo presupuesto que la respuesta. Medido el 18 ago 2026:
    // qwen3.6-27b con 200 tokens devuelve la respuesta VACIA porque el
    // razonamiento se los comio entero. Por eso hay un suelo: sin el, un
    // comprobante podia salir sin datos sin ninguna explicacion.
    var tokens = Math.max(op.maxTokens || 1000, 1200);

    var cuerpoCon = function (modelo) {
      var b = {
        model: modelo,
        messages: op.messages,
        temperature: (op.temperature === undefined) ? 0.2 : op.temperature,
        max_tokens: tokens,
        // Que el razonamiento NO venga mezclado en la respuesta. Sin esto,
        // qwen devuelve un bloque <think>...</think> pegado al texto y el
        // asistente se lo mostraba tal cual a la persona.
        reasoning_format: 'hidden'
      };
      if (op.json) b.response_format = { type: 'json_object' };
      return JSON.stringify(b);
    };

    var respuesta = await enviar(cuerpoCon(modelos[i]), apiKey, timeoutMs);
    var intentos = 0;

    while (true) {
      // ── Groq pide esperar ──
      if (respuesta.status === 429) {
        var txt429 = '';
        try { txt429 = await respuesta.clone().text(); } catch (e) {}
        if (esLimiteDelDia(txt429)) {
          throw fallo('limite_diario',
            'Se agotó la cuota de IA del día. Se reinicia en unas horas, no en minutos.', txt429);
        }
        if (intentos >= maxReintentos) {
          throw fallo('limite',
            'La IA está recibiendo demasiadas peticiones. Espera un momento y vuelve a intentarlo.', txt429);
        }
        intentos++;
        var seg = segundosDeEspera(respuesta, txt429);
        if (typeof op.alEsperar === 'function') {
          try { op.alEsperar(seg, intentos, maxReintentos); } catch (e) {}
        }
        await esperar(seg * 1000);
        respuesta = await enviar(cuerpoCon(modelos[i]), apiKey, timeoutMs);
        continue;
      }

      // ── Groq retiró el modelo: pasar al siguiente de la lista ──
      if ((respuesta.status === 404 || respuesta.status === 400) && i < modelos.length - 1) {
        i++;
        if (memoria) idxRecordado[memoria] = i;
        respuesta = await enviar(cuerpoCon(modelos[i]), apiKey, timeoutMs);
        continue;
      }

      break;
    }

    if (respuesta.status === 401 || respuesta.status === 403) {
      throw fallo('clave', 'La clave de la IA no es válida. Configúrala de nuevo con el botón ⚙️.');
    }

    if (!respuesta.ok) {
      var txt = '';
      try { txt = await respuesta.text(); } catch (e) {}
      if (esConsultaMuyGrande(respuesta.status, txt)) {
        throw fallo('grande',
          'La consulta lleva demasiada información. Acótala a una oficina, un periodo o un cliente.', txt);
      }
      if (respuesta.status === 404 || respuesta.status === 400) {
        throw fallo('modelo',
          'El modelo de IA ya no está disponible en Groq. Hay que actualizar la lista en ia.js.', txt);
      }
      throw fallo('http', 'La IA devolvió un error (' + respuesta.status + ').', txt);
    }

    var datos = await respuesta.json();
    var eleccion = datos && datos.choices && datos.choices[0];
    var contenido = eleccion && eleccion.message && eleccion.message.content;

    // Red de seguridad: si algún modelo ignora reasoning_format y cuela su
    // razonamiento en la respuesta, se quita aquí en vez de enseñárselo a nadie.
    contenido = String(contenido || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    if (!contenido) {
      // Distinguir "se quedó sin tokens pensando" de "no contestó nada":
      // el primero se arregla pidiendo menos datos, el segundo reintentando.
      if (eleccion && eleccion.finish_reason === 'length') {
        throw fallo('grande',
          'La IA gastó todo su margen razonando y no alcanzó a responder. Acota la consulta a una oficina, un periodo o un cliente.');
      }
      throw fallo('http', 'La IA respondió vacío. Vuelve a intentarlo.');
    }
    if (memoria) idxRecordado[memoria] = i;
    return contenido;
  }

  // ── Envoltorios ────────────────────────────────────────────────────
  function texto(op) {
    op = Object.assign({}, op);
    if (!op.modelo) op.modelos = op.modelos || MODELOS_TEXTO;
    op.memoria = op.memoria || 'texto';
    if (op.temperature === undefined) op.temperature = 0.4;
    if (!op.maxTokens) op.maxTokens = 800;
    return llamar(op);
  }

  function vision(op) {
    op = Object.assign({}, op);
    op.modelos = op.modelos || MODELOS_VISION;
    op.memoria = op.memoria || 'vision';
    if (op.temperature === undefined) op.temperature = 0.1;
    if (!op.maxTokens) op.maxTokens = 1500;
    return llamar(op);
  }

  // Pide la respuesta en JSON y la interpreta. Algunos modelos añaden texto
  // alrededor del JSON aunque se les pida lo contrario, así que si el análisis
  // directo falla se rescata el primer bloque {...} de la respuesta.
  async function json(op) {
    op = Object.assign({}, op, { json: true });
    var crudo = (op.modelos || op.imagenes) ? await vision(op) : await texto(op);
    try {
      return JSON.parse(crudo);
    } catch (e) {
      var m = String(crudo).match(/\{[\s\S]*\}/);
      if (m) {
        try { return JSON.parse(m[0]); } catch (e2) {}
      }
      throw fallo('http', 'La IA no respondió en el formato esperado. Vuelve a intentarlo.', crudo);
    }
  }

  // Mensaje listo para mostrarle a la persona, sin jerga.
  function mensajeDeError(e) {
    if (!e) return '⚠️ Ocurrió un error con la IA.';
    switch (e.tipo) {
      case 'clave':         return '⚠️ ' + e.message;
      case 'limite':        return '⏳ ' + e.message;
      case 'limite_diario': return '⛔ ' + e.message;
      case 'grande':        return '⚠️ ' + e.message;
      case 'tiempo':        return '⏱️ ' + e.message;
      case 'red':           return '📡 ' + e.message;
      case 'modelo':        return '⚠️ ' + e.message;
      default:              return '⚠️ ' + (e.message || 'Error con la IA.');
    }
  }

  // Envío en crudo: devuelve la respuesta tal cual, pero CON tiempo límite.
  // Es para quien necesita mirar el código de estado por su cuenta —hoy solo
  // la carga de comprobantes por lote, que al recibir un 413 parte el lote en
  // dos y reintenta. Esa lógica ya funciona bien y no se toca; lo único que le
  // faltaba era no quedarse esperando para siempre.
  function enviarCrudo(cuerpo, apiKey, timeoutMs) {
    return enviar(cuerpo, apiKey, timeoutMs || 90000);
  }

  window.PV_IA = {
    MODELO_TEXTO: MODELO_TEXTO,
    MODELOS_TEXTO: MODELOS_TEXTO,
    MODELOS_VISION: MODELOS_VISION,
    texto: texto,
    vision: vision,
    json: json,
    llamar: llamar,
    enviarCrudo: enviarCrudo,
    mensajeDeError: mensajeDeError
  };
})();
