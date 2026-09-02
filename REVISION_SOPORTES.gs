/**
 * ════════════════════════════════════════════════════════════════════════════
 * REVISIÓN DE SOPORTES · PROYECTOVISION
 * Segundo par de ojos sobre los comprobantes, corriendo de noche.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * QUÉ HACE
 * Cada noche toma los comprobantes que las oficinas subieron durante el día,
 * los vuelve a leer DE CERO —sin saber qué valor se registró ni qué justificó
 * nadie— y compara lo que dice el papel contra lo que quedó en el sistema.
 * Lo que no cuadra queda anotado para que lo revise el administrador.
 *
 * POR QUÉ HACE FALTA, SI YA HAY UNA IA AL SUBIR
 * La revisión de hoy ocurre en el momento de subir y la resuelve la misma
 * persona que sube: si el valor leído no coincide, sale un "¿seguro?" y quien
 * contesta es quien está cargando. Sirve contra errores honestos; no contra
 * nadie que quiera pasarse de listo.
 * Y hay un hueco medido: de 2.416 comprobantes, 696 son PDF y NINGUNO pasó
 * por la IA — solo se les calculó la huella. Desde el 1 de agosto son 424 sin
 * ninguna lectura. Este script los cubre.
 *
 * POR QUÉ GEMINI Y NO LA IA QUE YA ESTÁ
 * Porque Gemini lee PDF directamente. Los modelos de visión de Groq solo
 * aceptan imágenes, así que justo lo que falta —los PDF— no lo podrían
 * revisar. Ese, y no la marca, es el motivo.
 *
 * QUÉ NO HACE
 * NO toca la subida de comprobantes. Este archivo no define doPost ni doGet,
 * así que el programa que ya guarda los soportes en Drive sigue igual. Y NO
 * corrige ni borra nada: solo anota lo que encuentra.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PARA PONERLO A ANDAR (una sola vez)
 *
 *  1. En el proyecto de Apps Script: Archivo → + → Script, y pega esto.
 *     NO borres el archivo que ya está: este va aparte.
 *
 *  2. Configuración → Propiedades del script → agregar dos:
 *        GEMINI_KEY     la clave de aistudio.google.com
 *        FIREBASE_KEY   AIzaSyDxDOjSzmsSNnULxmzyH2JM80u8AMFpO9w
 *     (La de Firebase ya es pública; la de Gemini NO, y por eso va aquí y
 *      nunca dentro de la app.)
 *
 *  3. Arriba, elige la función  probarConfiguracion  y dale ▶ Ejecutar.
 *     Te va a pedir permisos la primera vez: acéptalos. Debe decir TODO BIEN.
 *
 *  4. Elige  instalarRevisionNocturna  y dale ▶ una sola vez.
 *     Desde ahí corre solo, todas las noches a la 1 a. m.
 *
 * ACTUALIZADO EL 2 SEP 2026: se agregó el chequeo de la fecha de SUBIDA (un
 * comprobante viejo subido hoy ahora se anota, aunque el movimiento se haya
 * registrado con la fecha vieja). Si ya lo tenías andando, basta con
 * reemplazar TODO el contenido del archivo por este y guardar: el
 * programador nocturno sigue igual, no hay que instalar nada de nuevo.
 *
 * Y MÁS TARDE ESE MISMO DÍA: Gemini respondió 503 ("saturado, vuelve luego")
 * en plena prueba de Elkin. Antes, esa saturación a la 1 a. m. marcaba el
 * soporte como error PARA SIEMPRE sin haberlo leído. Ahora un error
 * pasajero (429/5xx) reintenta a los 10 segundos y, si persiste, APLAZA el
 * soporte para la noche siguiente (hasta 3 noches); tres saturaciones
 * seguidas cortan la corrida para no quemar tiempo contra un servicio caído.
 *
 * Y LA TERCERA DEL DÍA, pedida por Elkin: la corrida ya no se conforma con
 * una tanda fija de 35. Trabaja mirando el reloj (4,5 minutos, porque Apps
 * Script corta a los 6), guarda, y si quedó cola SE PROGRAMA SOLA para dos
 * minutos después, hasta vaciarla. El disparador de la 1 a. m. no cambia, y
 * un solo ▶ manual de revisarSoportesPendientes también encadena el resto.
 * ════════════════════════════════════════════════════════════════════════════
 */

// ── Ajustes que se pueden cambiar sin tocar el resto ────────────────────────
var REV_PROYECTO   = 'inventario-88a28';        // proyecto de Firebase
var REV_DOC        = 'revision_soportes';       // donde vive la cola y el resultado
var REV_COLECCION  = 'oficinas_sistema';
// Comprobado contra la lista real de modelos el 27 ago 2026. Se eligió éste
// porque respetó al pie de la letra el "devuelve 0 si no se ve": 3.7-flash
// contestaba null en ese caso. Google retira modelos cada tanto (2.0-flash ya
// no existe), así que si un día empieza a fallar con "404", entra a
// aistudio.google.com, mira qué modelos hay y cambia solo esta línea.
var REV_MODELO     = 'gemini-3.6-flash';        // rápido y barato; lee imagen y PDF
var REV_POR_TANDA  = 100;                       // tope de seguridad por corrida; el reloj es el que manda
var REV_TOPE_MS    = 270000;                    // 4,5 min de trabajo: Apps Script corta a los 6, mejor parar antes con todo guardado
var REV_MAX_CADENA = 10;                        // continuaciones por noche (10 × ~40 soportes alcanza de sobra)
var REV_PAUSA_MS   = 1200;                      // respiro entre llamadas, para no chocar con el límite

function REV_prop(nombre){
  var v = PropertiesService.getScriptProperties().getProperty(nombre);
  if(!v) throw new Error('Falta la propiedad "'+nombre+'". Ponla en Configuración → Propiedades del script.');
  return v;
}

// ════════════════════════════════════════════════════════════════════════════
// FIRESTORE POR REST
// La base tiene lectura y escritura abiertas, así que basta la clave del
// proyecto. Firestore devuelve los valores envueltos por tipo
// ({"stringValue":"x"}), así que hay que traducir en los dos sentidos.
// ════════════════════════════════════════════════════════════════════════════
function REV_urlDoc(){
  return 'https://firestore.googleapis.com/v1/projects/'+REV_PROYECTO
       + '/databases/(default)/documents/'+REV_COLECCION+'/'+REV_DOC
       + '?key='+encodeURIComponent(REV_prop('FIREBASE_KEY'));
}

/* De la forma de Firestore a un objeto normal. */
function REV_aPlano(v){
  if(v === null || v === undefined) return null;
  if('nullValue'    in v) return null;
  if('stringValue'  in v) return v.stringValue;
  if('booleanValue' in v) return v.booleanValue;
  if('integerValue' in v) return Number(v.integerValue);
  if('doubleValue'  in v) return Number(v.doubleValue);
  if('timestampValue' in v) return v.timestampValue;
  if('arrayValue'   in v) return ((v.arrayValue.values)||[]).map(REV_aPlano);
  if('mapValue'     in v){
    var o = {}, campos = v.mapValue.fields || {};
    for(var k in campos) o[k] = REV_aPlano(campos[k]);
    return o;
  }
  return null;
}
/* Y de vuelta. */
function REV_aFirestore(x){
  if(x === null || x === undefined) return {nullValue:null};
  if(typeof x === 'string')  return {stringValue:x};
  if(typeof x === 'boolean') return {booleanValue:x};
  if(typeof x === 'number')  return (x % 1 === 0) ? {integerValue:String(x)} : {doubleValue:x};
  if(Object.prototype.toString.call(x) === '[object Array]')
    return {arrayValue:{values:x.map(REV_aFirestore)}};
  var campos = {};
  for(var k in x) campos[k] = REV_aFirestore(x[k]);
  return {mapValue:{fields:campos}};
}

function REV_leerDoc(){
  var r = UrlFetchApp.fetch(REV_urlDoc(), {muteHttpExceptions:true});
  if(r.getResponseCode() === 404) return {cola:[], resultados:[]};   // aún no existe
  if(r.getResponseCode() !== 200)
    throw new Error('No se pudo leer la base ('+r.getResponseCode()+'): '+r.getContentText().slice(0,300));
  var d = JSON.parse(r.getContentText());
  var plano = REV_aPlano({mapValue:{fields:(d.fields||{})}}) || {};
  if(!plano.cola)       plano.cola = [];
  if(!plano.resultados) plano.resultados = [];
  return plano;
}

function REV_guardarDoc(obj){
  var campos = {};
  for(var k in obj) campos[k] = REV_aFirestore(obj[k]);
  var r = UrlFetchApp.fetch(REV_urlDoc(), {
    method:'patch', contentType:'application/json',
    payload: JSON.stringify({fields:campos}), muteHttpExceptions:true
  });
  if(r.getResponseCode() !== 200)
    throw new Error('No se pudo guardar ('+r.getResponseCode()+'): '+r.getContentText().slice(0,300));
}

// ════════════════════════════════════════════════════════════════════════════
// EL ARCHIVO EN DRIVE
// ════════════════════════════════════════════════════════════════════════════
/* El id del archivo puede venir suelto o dentro de la dirección. */
function REV_idDeArchivo(item){
  if(item.fileId) return item.fileId;
  var m = String(item.url||'').match(/[?&]id=([\w-]+)/);
  if(m) return m[1];
  m = String(item.url||'').match(/\/d\/([\w-]+)/);
  return m ? m[1] : '';
}

// ════════════════════════════════════════════════════════════════════════════
// LA LECTURA CON GEMINI
// Se le pide SOLO lo que dice el papel. No se le cuenta qué valor se registró,
// para que no se deje llevar: si supiera la respuesta, tendería a confirmarla.
// La comparación se hace después, aquí en el script.
// ════════════════════════════════════════════════════════════════════════════
var REV_INSTRUCCION =
  'Eres un auditor de comprobantes de pago colombianos. Lee ÚNICAMENTE lo que ' +
  'aparece en el documento adjunto y responde en JSON, sin texto alrededor.\n\n' +
  'Devuelve exactamente estas claves:\n' +
  '  "es_comprobante": true o false (¿es un comprobante de pago o transferencia?)\n' +
  '  "valor": el monto principal como número entero, sin puntos ni símbolos. 0 si no se ve.\n' +
  '  "fecha": la fecha de la transacción en formato AAAA-MM-DD. "" si no se ve.\n' +
  '  "destinatario": a nombre de quién se hizo el pago. "" si no se ve.\n' +
  '  "cuenta_destino": el número de cuenta destino, solo dígitos. "" si no se ve.\n' +
  '  "referencia": el número de aprobación, referencia o comprobante. "" si no se ve.\n' +
  '  "entidad": el banco o medio (Bancolombia, Nequi, Efecty...). "" si no se ve.\n' +
  '  "legible": true si se lee bien, false si está borroso o cortado.\n' +
  '  "nota": una frase corta en español si algo te parece raro; "" si todo normal.\n\n' +
  'Reglas: NO adivines. Si un dato no está visible, devuélvelo vacío o en 0. ' +
  'Si el documento tiene varios pagos, usa el TOTAL y dilo en "nota".';

function REV_preguntarGemini(blob, mime){
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/'
          + REV_MODELO + ':generateContent?key=' + encodeURIComponent(REV_prop('GEMINI_KEY'));
  var cuerpo = {
    contents: [{ parts: [
      { text: REV_INSTRUCCION },
      { inline_data: { mime_type: mime, data: Utilities.base64Encode(blob.getBytes()) } }
    ]}],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' }
  };
  var r = UrlFetchApp.fetch(url, {
    method:'post', contentType:'application/json',
    payload: JSON.stringify(cuerpo), muteHttpExceptions:true
  });
  if(r.getResponseCode() !== 200){
    var eG = new Error('Gemini respondió '+r.getResponseCode()+': '+r.getContentText().slice(0,200));
    eG.pasajero = REV_esPasajero(r.getResponseCode());
    throw eG;
  }
  var d = JSON.parse(r.getContentText());
  var txt = '';
  try{ txt = d.candidates[0].content.parts[0].text; }
  catch(e){ throw new Error('Gemini devolvió algo inesperado.'); }
  // Según el modelo, un dato ausente vuelve como 0 o como null. Se normaliza
  // aquí para que la comparación no tenga que preocuparse por eso.
  try{
    var o = JSON.parse(txt);
    if(o.valor === null || o.valor === undefined) o.valor = 0;
    ['fecha','destinatario','cuenta_destino','referencia','entidad','nota'].forEach(function(k){
      if(o[k] === null || o[k] === undefined) o[k] = '';
    });
    return o;
  }
  catch(e){
    var m = txt.match(/\{[\s\S]*\}/);          // por si envuelve el JSON en texto
    if(m) return JSON.parse(m[0]);
    throw new Error('No se entendió la respuesta de Gemini: '+txt.slice(0,150));
  }
}

/* Un 429 o un 5xx no es culpa de nadie: es Gemini saturado o caído, y pasa a
   ratos (Elkin lo vio el 2 sep 2026: 503 "high demand"). Ese error es
   PASAJERO: mañana el mismo archivo se lee bien. Un 400 o 404 sí es de
   verdad y reintentar no lo arregla. */
function REV_esPasajero(codigo){
  return codigo === 429 || codigo >= 500;
}

/* Un respiro y un segundo intento antes de rendirse esta noche. */
function REV_preguntarGeminiConCalma(blob, mime){
  try{ return REV_preguntarGemini(blob, mime); }
  catch(e){
    if(!e || !e.pasajero) throw e;
    Utilities.sleep(10000);
    return REV_preguntarGemini(blob, mime);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// LA COMPARACIÓN
// Devuelve la lista de reparos. Vacía = todo cuadra.
// ════════════════════════════════════════════════════════════════════════════
// Las mismas cuentas que ya valida la app (CUENTAS_OFICIAL_PV en OFICINAS):
// la cuenta de ahorros y la llave de Bancolombia/Nequi de PROYECTOVISION.
// Si abren otra cuenta, hay que agregarla AQUÍ y allá.
var REV_CUENTAS_PV = ['46600004696', '0046922142'];
var REV_TOLERANCIA = 1000;              // pesos de diferencia que se dejan pasar

function REV_soloDigitos(s){ return String(s||'').replace(/\D/g,''); }
function REV_esProyectovision(nombre){
  var n = String(nombre||'').toLowerCase().replace(/[^a-z]/g,'');
  return n.indexOf('proyectovision') >= 0 || n.indexOf('proyectovison') >= 0
      || n.indexOf('provectovision') >= 0;   // el OCR confunde y/v
}
function REV_diasEntre(a, b){
  if(!a || !b) return null;
  var d1 = new Date(a+'T12:00:00'), d2 = new Date(b+'T12:00:00');
  if(isNaN(d1) || isNaN(d2)) return null;
  return Math.round(Math.abs(d1-d2)/86400000);
}

function REV_comparar(item, leido){
  var reparos = [];

  if(leido.es_comprobante === false)
    reparos.push({gravedad:'alta', que:'El archivo no parece un comprobante de pago.'});

  if(leido.legible === false)
    reparos.push({gravedad:'media', que:'El comprobante está borroso o cortado; no se puede verificar bien.'});

  // El valor. Un pago combinado reparte un comprobante entre varios movimientos,
  // así que ahí el total leído SÍ debe ser mayor: no es un reparo.
  var vLeido = Number(leido.valor||0);
  var vReg   = Number(item.valorRegistrado||0);
  if(vLeido > 0 && vReg > 0 && !item.esPagoCombinado){
    var dif = Math.abs(vLeido - vReg);
    if(dif > REV_TOLERANCIA){
      reparos.push({gravedad:'alta',
        que:'El comprobante dice $'+vLeido.toLocaleString('es-CO')
           +' y se registró $'+vReg.toLocaleString('es-CO')
           +' (diferencia de $'+dif.toLocaleString('es-CO')+').'});
    }
  }

  // La fecha. Se permite holgura: se paga un día y se registra al siguiente.
  var d = REV_diasEntre(leido.fecha, String(item.fechaRegistrada||'').slice(0,10));
  if(d !== null && d > 5){
    reparos.push({gravedad: d > 30 ? 'alta' : 'media',
      que:'El comprobante es del '+leido.fecha+' y el movimiento quedó el '
         + String(item.fechaRegistrada||'').slice(0,10)+' ('+d+' días de diferencia).'});
  }

  // La fecha contra el día de SUBIDA (pedido de Elkin, 2 sep 2026). El chequeo
  // de arriba compara contra la fecha del MOVIMIENTO, y esa la escribe quien
  // registra: si pone la fecha vieja del papel, todo cuadra. El caso real fue
  // un comprobante del 10 de agosto subido el 1 de septiembre sin que nadie
  // se enterara. La holgura es de 3 días: pagar viernes y subir lunes pasa;
  // tres semanas no. Y un papel con fecha POSTERIOR a su subida también se
  // anota: o la fecha se leyó mal o el papel no es de ese pago.
  var fSubida = String(item.subidoEn || item.creadoEn || '').slice(0,10);
  if(leido.fecha && fSubida){
    var dPapel = new Date(leido.fecha+'T12:00:00'), dSubida = new Date(fSubida+'T12:00:00');
    if(!isNaN(dPapel) && !isNaN(dSubida)){
      var atraso = Math.round((dSubida - dPapel)/86400000);   // positivo = papel viejo
      if(atraso > 3){
        reparos.push({gravedad: atraso > 15 ? 'alta' : 'media',
          que:'El comprobante es del '+leido.fecha+' pero se subió el '+fSubida
             +': '+atraso+' días después.'});
      } else if(atraso < -1){
        reparos.push({gravedad:'media',
          que:'El comprobante tiene fecha del '+leido.fecha+', POSTERIOR al día en que'
             +' se subió ('+fSubida+'). O la fecha se leyó mal o el papel no'
             +' corresponde a este pago.'});
      }
    }
  }

  // A quién se le pagó. Solo aplica a los INGRESOS: la plata que entra tiene
  // que llegar a una cuenta de la empresa. En los egresos el destinatario es
  // el proveedor, y eso no se puede validar contra una lista.
  if(item.tipo === 'ingreso'){
    var ctaOk = REV_CUENTAS_PV.length === 0 || REV_CUENTAS_PV.some(function(c){
      var leida = REV_soloDigitos(leido.cuenta_destino);
      return leida && (leida.indexOf(c) >= 0 || c.indexOf(leida) >= 0);
    });
    var nomOk = REV_esProyectovision(leido.destinatario);
    var hayDato = REV_soloDigitos(leido.cuenta_destino) || String(leido.destinatario||'').trim();
    if(hayDato && !ctaOk && !nomOk){
      reparos.push({gravedad:'alta',
        que:'El pago figura a nombre de "'+(leido.destinatario||'?')
           +'"'+(leido.cuenta_destino?(' / cuenta '+leido.cuenta_destino):'')
           +', que no es una cuenta de PROYECTOVISION.'});
    }
  }

  if(leido.nota) reparos.push({gravedad:'baja', que:'La IA anotó: '+leido.nota});

  return reparos;
}

// ════════════════════════════════════════════════════════════════════════════
// LA CORRIDA DE CADA NOCHE
// Pedido de Elkin (2 sep 2026): que haga LAS QUE HAGAN FALTA por noche sin
// pasarse del límite. Apps Script corta toda ejecución a los 6 minutos, así
// que una sola corrida no puede con una cola grande. En vez de subir el tope
// y rezar, la corrida mira el reloj: trabaja 4,5 minutos, GUARDA lo hecho, y
// si quedó cola se programa a sí misma para dentro de un par de minutos.
// Así la noche entera es una cadena de corridas cortas y la cola amanece
// vacía, sin acercarse nunca al corte. La cadena tiene tope (REV_MAX_CADENA)
// y solo continúa si esta corrida avanzó de verdad: contra un Gemini caído
// no se insiste (eso ya lo corta la regla de las 3 saturaciones seguidas).
// El disparador de la 1 a. m. NO cambia: sigue llamando a
// revisarSoportesPendientes, y el ▶ manual también — con una sola ejecutada,
// el resto sigue solo.
// ════════════════════════════════════════════════════════════════════════════
function revisarSoportesPendientes(){ REV_correr(false); }
function continuarRevisionNocturna(){ REV_correr(true); }

/* ¿Vale la pena otra corrida? Solo si quedó cola, si ESTA corrida avanzó
   (nuevos > 0: si nada entró, repetir no va a mejorar nada), si no cortó la
   saturación de Gemini, y si la cadena no llegó a su tope. */
function REV_debeContinuar(restantes, nuevos, cortada, cadena){
  return restantes > 0 && nuevos > 0 && !cortada && (Number(cadena)||0) < REV_MAX_CADENA;
}

function REV_correr(esContinuacion){
  var inicioCorrida = Date.now();
  // Los ganchos de continuación ya disparados quedan como chatarra en el
  // proyecto (hay un máximo de 20): se limpian al arrancar.
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction() === 'continuarRevisionNocturna') ScriptApp.deleteTrigger(t);
  });
  var doc = REV_leerDoc();
  var cola = doc.cola || [];
  var pendientes = cola.filter(function(x){ return !x.revisado; });

  if(pendientes.length === 0){
    Logger.log('No hay soportes pendientes de revisar.');
    return;
  }
  Logger.log('Pendientes: '+pendientes.length+'. Se revisan hasta '+REV_POR_TANDA+' en esta corrida.');

  var tanda = pendientes.slice(0, REV_POR_TANDA);
  var nuevos = 0, conReparos = 0, fallidos = 0;
  var cortada = false, seguidos = 0, aplazados = 0;

  var porTiempo = false;
  tanda.forEach(function(item, i){
    if(cortada) return;
    if((Date.now() - inicioCorrida) > REV_TOPE_MS){ porTiempo = true; return; }
    if(i > 0) Utilities.sleep(REV_PAUSA_MS);
    var salida = { id:item.id, oficina:item.oficina, movId:item.movId,
                   revisadoEn:new Date().toISOString() };
    try{
      var fid = REV_idDeArchivo(item);
      if(!fid) throw new Error('El comprobante no tiene una dirección de archivo utilizable.');
      var archivo = DriveApp.getFileById(fid);
      var blob = archivo.getBlob();
      var mime = blob.getContentType() || 'image/jpeg';
      // Gemini acepta imagen y PDF; cualquier otra cosa no se puede leer.
      if(mime.indexOf('image/') !== 0 && mime !== 'application/pdf')
        throw new Error('Tipo de archivo que no se puede leer: '+mime);

      var leido = REV_preguntarGeminiConCalma(blob, mime);
      var reparos = REV_comparar(item, leido);

      salida.leido   = leido;
      salida.reparos = reparos;
      salida.estado  = reparos.length === 0 ? 'ok'
                     : (reparos.some(function(r){ return r.gravedad === 'alta'; }) ? 'revisar' : 'aviso');
      if(reparos.length) conReparos++;
      seguidos = 0;
    }catch(e){
      /* Un error PASAJERO (Gemini saturado o caído) no consume el soporte:
         se aplaza sin marcarlo revisado y mañana se intenta de nuevo. Solo
         a la cuarta noche fallida se registra como error, para que un
         archivo gafado no se reintente eternamente. Y tres pasajeros
         SEGUIDOS cortan la corrida: si Gemini está caído, insistir con los
         que faltan solo quema el tiempo y la cuota. */
      var intentos = 0, k0;
      for(k0=0; k0<cola.length; k0++) if(cola[k0].id === item.id)
        intentos = Number(cola[k0].intentosPasajeros || 0);
      if(e && e.pasajero && intentos < 3){
        for(k0=0; k0<cola.length; k0++) if(cola[k0].id === item.id)
          cola[k0].intentosPasajeros = intentos + 1;
        aplazados++; seguidos++;
        if(seguidos >= 3){
          cortada = true;
          Logger.log('Gemini está saturado: se corta la corrida y lo pendiente queda para mañana.');
        }
        return;
      }
      salida.estado = 'error';
      salida.error  = String(e.message || e);
      fallidos++;
      seguidos = 0;
    }
    doc.resultados.push(salida);
    // Se marca en la cola para no volver a gastar en el mismo.
    for(var k=0; k<cola.length; k++) if(cola[k].id === item.id) cola[k].revisado = true;
    nuevos++;
  });

  // La cola no crece para siempre: lo ya revisado se suelta a los 60 días.
  var corte = new Date(Date.now() - 60*86400000).toISOString();
  doc.cola = cola.filter(function(x){ return !x.revisado || String(x.creadoEn||'') > corte; });
  // Y los resultados se quedan con los 1.500 más recientes, para no pasar del
  // límite de 1 MB por documento que impone Firestore.
  if(doc.resultados.length > 1500) doc.resultados = doc.resultados.slice(-1500);
  doc.ultimaCorrida = new Date().toISOString();
  // La cuenta de la cadena: la corrida de la 1 a. m. (o el ▶ manual) la pone
  // en cero; cada continuación suma uno.
  doc.cadena = esContinuacion ? (Number(doc.cadena)||0) + 1 : 0;

  REV_guardarDoc(doc);
  var restantes = pendientes.length - nuevos;
  Logger.log('Revisados '+nuevos+' · con reparos '+conReparos+' · con error '+fallidos
           + (aplazados ? ' · aplazados por saturación '+aplazados : '')
           + (porTiempo ? ' · se paró por tiempo, con todo guardado' : '')
           + ' · quedan '+restantes+'.');

  if(REV_debeContinuar(restantes, nuevos, cortada, doc.cadena)){
    ScriptApp.newTrigger('continuarRevisionNocturna').timeBased().after(90*1000).create();
    Logger.log('La revisión continúa SOLA en un par de minutos con los '+restantes+' que quedan.');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// PUESTA EN MARCHA Y COMPROBACIÓN
// ════════════════════════════════════════════════════════════════════════════
function instalarRevisionNocturna(){
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction() === 'revisarSoportesPendientes') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('revisarSoportesPendientes').timeBased().atHour(1).everyDays(1).create();
  Logger.log('Listo: la revisión corre todas las noches a la 1 a. m.');
}

function quitarRevisionNocturna(){
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction() === 'revisarSoportesPendientes'
    || t.getHandlerFunction() === 'continuarRevisionNocturna'){ ScriptApp.deleteTrigger(t); n++; }
  });
  Logger.log('Se quitaron '+n+' programación(es). La revisión ya no corre sola.');
}

/**
 * Comprueba que todo esté bien configurado ANTES de dejarlo solo.
 * Ejecuta esta función y mira el registro: tiene que decir TODO BIEN.
 */
function probarConfiguracion(){
  var problemas = [];

  try{ REV_prop('GEMINI_KEY');   Logger.log('✓ Clave de Gemini encontrada.'); }
  catch(e){ problemas.push('Falta GEMINI_KEY en Propiedades del script.'); }
  try{ REV_prop('FIREBASE_KEY'); Logger.log('✓ Clave de Firebase encontrada.'); }
  catch(e){ problemas.push('Falta FIREBASE_KEY en Propiedades del script.'); }

  if(problemas.length){ Logger.log('✗ ' + problemas.join('\n✗ ')); return; }

  try{
    var doc = REV_leerDoc();
    Logger.log('✓ Se pudo leer la base. En la cola hay '+(doc.cola||[]).length
             + ' soporte(s), y '+((doc.cola||[]).filter(function(x){return !x.revisado;}).length)
             + ' sin revisar.');
  }catch(e){ problemas.push('No se pudo leer la base: '+e.message); }

  // Se prueba Gemini con una imagen mínima creada aquí mismo: no gasta casi nada
  // y confirma que la clave sirve y que el modelo responde.
  try{
    var png = Utilities.newBlob(
      Utilities.base64Decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
      'image/png', 'prueba.png');
    var r = REV_preguntarGemini(png, 'image/png');
    Logger.log('✓ Gemini respondió correctamente (dijo es_comprobante='+r.es_comprobante+').');
  }catch(e){
    if(e && e.pasajero)
      Logger.log('✓ La clave de Gemini llega a Google, pero el modelo está saturado en este'
               + ' momento (es pasajero y no depende de ti). La configuración está bien;'
               + ' la corrida nocturna reintenta sola.');
    else problemas.push('Gemini no respondió bien: '+e.message);
  }

  try{
    DriveApp.getRootFolder().getName();
    Logger.log('✓ Hay permiso para leer Drive.');
  }catch(e){ problemas.push('Falta el permiso de Drive. Vuelve a ejecutar y acepta.'); }

  if(problemas.length) Logger.log('\n✗ FALTA ARREGLAR:\n✗ ' + problemas.join('\n✗ '));
  else Logger.log('\n✅ TODO BIEN. Ya puedes ejecutar instalarRevisionNocturna.');
}

/**
 * Revisa UN comprobante a mano, para ver cómo queda antes de dejarlo solo.
 * Pégale el id del archivo de Drive entre las comillas y dale ▶.
 */
function probarUnComprobante(){
  var ID_DEL_ARCHIVO = '';          // ← pega aquí el id y ejecuta
  if(!ID_DEL_ARCHIVO){ Logger.log('Pon el id de un archivo de Drive en ID_DEL_ARCHIVO.'); return; }
  var blob = DriveApp.getFileById(ID_DEL_ARCHIVO).getBlob();
  var leido = REV_preguntarGemini(blob, blob.getContentType());
  Logger.log('Esto leyó Gemini:\n' + JSON.stringify(leido, null, 2));
}
