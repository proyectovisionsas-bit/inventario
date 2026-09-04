/**
 * ════════════════════════════════════════════════════════════════════════════
 * AVISOS AL CELULAR · PROYECTOVISION
 * El vigilante de las solicitudes de aprobación pendientes.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * QUÉ HACE
 * Cada 5 minutos mira en la nube si hay solicitudes de aprobación NUEVAS
 * esperando al administrador, y si las hay le manda una notificación al
 * celular (Android e iPhone) a través de Google (Firebase Cloud Messaging).
 * Solo avisa lo nuevo: recuerda qué ya avisó. Y una vez al día, temprano,
 * recuerda lo que sigue pendiente.
 *
 * QUÉ MIRA
 *   · INVENTARIO: solicitudes de EDICIÓN y de BORRADO de material/ventas.
 *   · OFICINAS: registros con fecha pasada, eliminar/editar movimientos,
 *     préstamos y abonos especiales — todo lo que aprueba el administrador.
 * Lee SOLO esos campos (con máscara), no los documentos completos: cientos
 * de kilobytes cada cinco minutos serían un gasto tonto.
 *
 * QUÉ NO HACE
 * No cambia nada en la base. No aprueba ni rechaza. Solo mira y avisa.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PARA PONERLO A ANDAR (una sola vez)
 *
 *  1. En la consola de Firebase → ⚙️ Configuración del proyecto → pestaña
 *     "Cuentas de servicio" → "Generar nueva clave privada". Se descarga un
 *     archivo .json. Ábrelo con el Bloc de notas, copia TODO su contenido.
 *
 *  2. En Apps Script: Configuración → Propiedades del script → agregar:
 *        FCM_CUENTA_SERVICIO   (pegar todo el contenido del .json)
 *        FIREBASE_KEY          AIzaSyDxDOjSzmsSNnULxmzyH2JM80u8AMFpO9w   (si no está ya)
 *     La cuenta de servicio es una CLAVE PRIVADA: no la compartas con nadie
 *     ni la pegues en la app. Aquí está segura.
 *
 *  3. En cada celular: abre INVENTARIO → Inicio → tarjeta 🔔 → "Activar en
 *     este celular" → Permitir. (iPhone: primero Compartir → "Añadir a
 *     pantalla de inicio" y abrir desde el icono.)
 *
 *  4. Arriba, elige  probarAvisos  y dale ▶. Debe decir TODO BIEN y llegar
 *     una notificación de prueba a los celulares activados.
 *
 *  5. Elige  instalarVigilanteAvisos  y dale ▶ una sola vez. Desde ahí corre
 *     solo cada 5 minutos.
 * ════════════════════════════════════════════════════════════════════════════
 */

var AV_PROYECTO   = 'inventario-88a28';
var AV_BASE_APPS  = 'https://proyectovisionsas-bit.github.io/inventario/';
var AV_CADA_MIN   = 5;                     // cada cuántos minutos mira
var AV_HORA_RECORDATORIO = 7;              // a esta hora recuerda lo que sigue pendiente

function AV_prop(nombre){
  var v = PropertiesService.getScriptProperties().getProperty(nombre);
  if(!v) throw new Error('Falta la propiedad "'+nombre+'". Ponla en Configuración → Propiedades del script.');
  return v;
}

// ════════════════════════════════════════════════════════════════════════════
// FIRESTORE POR REST (mismo traductor que la revisión de soportes)
// ════════════════════════════════════════════════════════════════════════════
function AV_aPlano(v){
  if(v === null || v === undefined) return null;
  if('nullValue'    in v) return null;
  if('stringValue'  in v) return v.stringValue;
  if('booleanValue' in v) return v.booleanValue;
  if('integerValue' in v) return Number(v.integerValue);
  if('doubleValue'  in v) return Number(v.doubleValue);
  if('timestampValue' in v) return v.timestampValue;
  if('arrayValue'   in v) return ((v.arrayValue.values)||[]).map(AV_aPlano);
  if('mapValue'     in v){ var o={}, c=v.mapValue.fields||{}; for(var k in c) o[k]=AV_aPlano(c[k]); return o; }
  return null;
}
function AV_aFirestore(x){
  if(x === null || x === undefined) return {nullValue:null};
  if(typeof x === 'string')  return {stringValue:x};
  if(typeof x === 'boolean') return {booleanValue:x};
  if(typeof x === 'number')  return (x % 1 === 0) ? {integerValue:String(x)} : {doubleValue:x};
  if(Object.prototype.toString.call(x) === '[object Array]') return {arrayValue:{values:x.map(AV_aFirestore)}};
  var campos = {}; for(var k in x) campos[k] = AV_aFirestore(x[k]);
  return {mapValue:{fields:campos}};
}
/* Lee SOLO los campos pedidos de un documento (máscara). */
function AV_leerCampos(ruta, campos){
  var url = 'https://firestore.googleapis.com/v1/projects/'+AV_PROYECTO+'/databases/(default)/documents/'+ruta
          + '?key='+encodeURIComponent(AV_prop('FIREBASE_KEY'))
          + campos.map(function(c){ return '&mask.fieldPaths='+encodeURIComponent(c); }).join('');
  var r = UrlFetchApp.fetch(url, {muteHttpExceptions:true});
  if(r.getResponseCode() === 404) return {};
  if(r.getResponseCode() !== 200) throw new Error('No se pudo leer '+ruta+' ('+r.getResponseCode()+'): '+r.getContentText().slice(0,200));
  var d = JSON.parse(r.getContentText());
  return AV_aPlano({mapValue:{fields:(d.fields||{})}}) || {};
}
/* Escribe campos sueltos (updateMask) sin tocar el resto del documento. */
function AV_escribirCampos(ruta, obj){
  var campos = {}; for(var k in obj) campos[k] = AV_aFirestore(obj[k]);
  var url = 'https://firestore.googleapis.com/v1/projects/'+AV_PROYECTO+'/databases/(default)/documents/'+ruta
          + '?key='+encodeURIComponent(AV_prop('FIREBASE_KEY'))
          + Object.keys(obj).map(function(c){ return '&updateMask.fieldPaths='+encodeURIComponent(c); }).join('');
  var r = UrlFetchApp.fetch(url, {method:'patch', contentType:'application/json', payload:JSON.stringify({fields:campos}), muteHttpExceptions:true});
  if(r.getResponseCode() !== 200) throw new Error('No se pudo escribir '+ruta+' ('+r.getResponseCode()+'): '+r.getContentText().slice(0,200));
}

// ════════════════════════════════════════════════════════════════════════════
// LO PENDIENTE — funciones PURAS (se prueban en PRUEBAS.html)
// Reciben los datos ya planos y devuelven una lista uniforme:
//   {id, app:'inventario'|'oficinas', tipo, que, donde}
// ════════════════════════════════════════════════════════════════════════════
var AV_TIPOS_OFI = {
  registro_pasado:'Registro con fecha pasada', eliminar_mov:'Eliminar movimiento',
  editar_mov:'Editar movimiento', eliminar_prestamo:'Eliminar préstamo',
  corregir_abono_especial:'Corregir abono especial', eliminar_abono_especial:'Eliminar abono especial'
};
function AV_pendientesInventario(datos){
  var out = [];
  ((datos && datos.editRequests) || []).forEach(function(r){
    if(!r || r.estado !== 'pendiente') return;
    out.push({ id:'inv_e_'+r.id, app:'inventario', tipo:'Edición de material',
               que:(r.materialNombre||'?')+(r.motivo?' — '+r.motivo:''), donde:r.bodegaNombre||'' });
  });
  ((datos && datos.deleteRequests) || []).forEach(function(r){
    if(!r || r.estado !== 'pendiente') return;
    var t = r.tipo === 'venta' ? 'Borrar venta' : 'Borrar material';
    out.push({ id:'inv_d_'+r.id, app:'inventario', tipo:t,
               que:(r.materialNombre||'?')+(r.cantidad?' × '+r.cantidad:'')+(r.obs||r.motivo?' — '+(r.obs||r.motivo):''), donde:r.bodegaNombre||'' });
  });
  return out;
}
function AV_pendientesOficinas(datos){
  var out = [];
  ((datos && datos.solicitudes) || []).forEach(function(s){
    if(!s || s.estado !== 'pendiente') return;
    out.push({ id:'ofi_'+s.id, app:'oficinas', tipo:AV_TIPOS_OFI[s.tipo] || (s.tipo||'Solicitud'),
               que:String(s.descripcion||'').slice(0,90), donde:s.oficina||'' });
  });
  return out;
}
/* Qué hay de nuevo respecto a lo ya avisado, y qué de lo avisado ya se resolvió. */
function AV_novedades(pendientes, avisados){
  var ya = {}; (avisados||[]).forEach(function(id){ ya[id]=true; });
  var ahora = {}; (pendientes||[]).forEach(function(p){ ahora[p.id]=true; });
  return {
    nuevas: (pendientes||[]).filter(function(p){ return !ya[p.id]; }),
    vigentes: (avisados||[]).filter(function(id){ return ahora[id]; })   // siguen pendientes
  };
}
/* El texto del aviso: corto, concreto, y con el detalle de las primeras. */
function AV_texto(lista, recordatorio){
  var n = lista.length;
  var titulo = recordatorio
    ? ('⏰ Siguen pendientes '+n+' solicitud'+(n===1?'':'es')+' por aprobar')
    : ('📋 '+n+' solicitud'+(n===1?'':'es')+' nueva'+(n===1?'':'s')+' por aprobar');
  var lineas = lista.slice(0,3).map(function(p){ return '• '+p.tipo+(p.donde?' ('+p.donde+')':'')+': '+p.que; });
  if(n > 3) lineas.push('… y '+(n-3)+' más');
  return { titulo:titulo, cuerpo:lineas.join('\n') };
}

// ════════════════════════════════════════════════════════════════════════════
// ENVIAR POR GOOGLE (FCM v1) con la cuenta de servicio
// ════════════════════════════════════════════════════════════════════════════
function AV_b64url(bytesOrStr){
  var b = (typeof bytesOrStr === 'string') ? Utilities.newBlob(bytesOrStr).getBytes() : bytesOrStr;
  return Utilities.base64EncodeWebSafe(b).replace(/=+$/,'');
}
function AV_tokenAcceso(){
  var cache = CacheService.getScriptCache();
  var t = cache.get('fcm_token'); if(t) return t;
  var sa = JSON.parse(AV_prop('FCM_CUENTA_SERVICIO'));
  var ahora = Math.floor(Date.now()/1000);
  var cab = AV_b64url(JSON.stringify({alg:'RS256', typ:'JWT'}));
  var cuerpo = AV_b64url(JSON.stringify({ iss:sa.client_email, scope:'https://www.googleapis.com/auth/firebase.messaging',
                                         aud:'https://oauth2.googleapis.com/token', iat:ahora, exp:ahora+3600 }));
  var firma = AV_b64url(Utilities.computeRsaSha256Signature(cab+'.'+cuerpo, sa.private_key));
  var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', { method:'post', payload:{
            grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion:cab+'.'+cuerpo+'.'+firma }, muteHttpExceptions:true });
  if(r.getResponseCode() !== 200) throw new Error('Google no dio permiso para enviar ('+r.getResponseCode()+'): '+r.getContentText().slice(0,200));
  t = JSON.parse(r.getContentText()).access_token;
  cache.put('fcm_token', t, 3000);
  return t;
}
/* Envía a UN dispositivo. Devuelve 'ok', 'muerto' (token ya no sirve) o el error. */
function AV_enviarA(token, titulo, cuerpo, link){
  var msg = { message: { token: token,
    notification: { title: titulo, body: cuerpo },
    webpush: { headers: { Urgency:'high' },
               notification: { title: titulo, body: cuerpo, icon: AV_BASE_APPS+'icono-192.png', badge: AV_BASE_APPS+'icono-192.png', tag:'pv-solicitudes', renotify:true },
               fcm_options: { link: link } },
    data: { link: link } } };
  var r = UrlFetchApp.fetch('https://fcm.googleapis.com/v1/projects/'+AV_PROYECTO+'/messages:send', {
            method:'post', contentType:'application/json', headers:{Authorization:'Bearer '+AV_tokenAcceso()},
            payload:JSON.stringify(msg), muteHttpExceptions:true });
  var code = r.getResponseCode();
  if(code === 200) return 'ok';
  var txt = r.getContentText();
  if(code === 404 || /UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/.test(txt)) return 'muerto';
  return 'error '+code+': '+txt.slice(0,160);
}
/* Envía a TODOS los celulares registrados; limpia los que ya no existen. */
function AV_enviarATodos(titulo, cuerpo, link){
  var doc = AV_leerCampos('inventario/avisos', ['dispositivos']);
  var disp = doc.dispositivos || [];
  if(!disp.length){ Logger.log('No hay celulares registrados: activa los avisos desde la app (Inicio → 🔔).'); return {enviados:0, muertos:0}; }
  var vivos = [], enviados = 0, muertos = 0, errores = [];
  disp.forEach(function(d){
    var res = AV_enviarA(d.token, titulo, cuerpo, link);
    if(res === 'ok'){ enviados++; vivos.push(d); }
    else if(res === 'muerto'){ muertos++; }
    else { errores.push((d.nombre||'?')+': '+res); vivos.push(d); }
  });
  if(muertos) AV_escribirCampos('inventario/avisos', {dispositivos:vivos});
  if(errores.length) Logger.log('Errores al enviar:\n'+errores.join('\n'));
  Logger.log('Enviado a '+enviados+' celular(es)'+(muertos?' · '+muertos+' ya no existían y se quitaron':''));
  return {enviados:enviados, muertos:muertos, errores:errores};
}

// ════════════════════════════════════════════════════════════════════════════
// LA RONDA DE CADA 5 MINUTOS
// ════════════════════════════════════════════════════════════════════════════
function AV_memoria(){ try{ return JSON.parse(PropertiesService.getScriptProperties().getProperty('AV_MEMORIA')||'{}'); }catch(e){ return {}; } }
function AV_guardarMemoria(m){ PropertiesService.getScriptProperties().setProperty('AV_MEMORIA', JSON.stringify(m)); }

function revisarSolicitudesYAvisar(){
  var inv = AV_leerCampos('inventario/datos', ['editRequests','deleteRequests']);
  var ofi = AV_leerCampos('oficinas_sistema/main', ['solicitudes']);
  var pendientes = AV_pendientesInventario(inv).concat(AV_pendientesOficinas(ofi));
  var mem = AV_memoria();
  var nov = AV_novedades(pendientes, mem.avisados||[]);

  var enviado = false;
  if(nov.nuevas.length){
    // Un aviso por app, para que el toque abra la pantalla correcta
    ['inventario','oficinas'].forEach(function(app){
      var lista = nov.nuevas.filter(function(p){ return p.app===app; });
      if(!lista.length) return;
      var t = AV_texto(lista, false);
      AV_enviarATodos(t.titulo, t.cuerpo, AV_BASE_APPS+(app==='inventario'?'INVENTARIO_PTOVISION.html':'OFICINAS_PTOVISION.html'));
      enviado = true;
    });
  }
  // El recordatorio diario, temprano, de lo que sigue esperando
  var hoy = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd');
  var hora = Number(Utilities.formatDate(new Date(), 'America/Bogota', 'H'));
  if(pendientes.length && !nov.nuevas.length && hora === AV_HORA_RECORDATORIO && mem.recordatorio !== hoy){
    var r = AV_texto(pendientes, true);
    AV_enviarATodos(r.titulo, r.cuerpo, AV_BASE_APPS+(pendientes[0].app==='inventario'?'INVENTARIO_PTOVISION.html':'OFICINAS_PTOVISION.html'));
    mem.recordatorio = hoy; enviado = true;
  }
  // La memoria: lo avisado que sigue pendiente + lo nuevo. Lo resuelto se olvida.
  mem.avisados = nov.vigentes.concat(nov.nuevas.map(function(p){ return p.id; }));
  mem.ultimaRonda = new Date().toISOString();
  AV_guardarMemoria(mem);
  Logger.log('Pendientes: '+pendientes.length+' · nuevas: '+nov.nuevas.length+(enviado?' · aviso enviado':' · sin novedades'));
}

// ════════════════════════════════════════════════════════════════════════════
// PUESTA EN MARCHA Y COMPROBACIÓN
// ════════════════════════════════════════════════════════════════════════════
function instalarVigilanteAvisos(){
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction() === 'revisarSolicitudesYAvisar') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('revisarSolicitudesYAvisar').timeBased().everyMinutes(AV_CADA_MIN).create();
  Logger.log('Listo: el vigilante mira las solicitudes cada '+AV_CADA_MIN+' minutos.');
}
function quitarVigilanteAvisos(){
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction() === 'revisarSolicitudesYAvisar'){ ScriptApp.deleteTrigger(t); n++; }
  });
  Logger.log('Se quitaron '+n+' programación(es). Ya no llegan avisos.');
}
/** Comprueba la configuración y manda una notificación de PRUEBA a los celulares activados. */
function probarAvisos(){
  var problemas = [];
  try{ AV_prop('FIREBASE_KEY'); Logger.log('✓ Clave de Firebase encontrada.'); }catch(e){ problemas.push(e.message); }
  try{ var sa = JSON.parse(AV_prop('FCM_CUENTA_SERVICIO')); if(!sa.client_email || !sa.private_key) throw new Error('El contenido de FCM_CUENTA_SERVICIO no parece el .json de la cuenta de servicio.'); Logger.log('✓ Cuenta de servicio: '+sa.client_email); }
  catch(e){ problemas.push('FCM_CUENTA_SERVICIO: '+e.message); }
  if(problemas.length){ Logger.log('✗ FALTA ARREGLAR:\n✗ '+problemas.join('\n✗ ')); return; }
  try{ AV_tokenAcceso(); Logger.log('✓ Google acepta la cuenta de servicio para enviar avisos.'); }
  catch(e){ Logger.log('✗ '+e.message+'\n   Revisa que la API "Firebase Cloud Messaging API (V1)" esté habilitada en la consola de Firebase → Cloud Messaging.'); return; }
  try{
    var inv = AV_leerCampos('inventario/datos', ['editRequests','deleteRequests']);
    var ofi = AV_leerCampos('oficinas_sistema/main', ['solicitudes']);
    var p = AV_pendientesInventario(inv).concat(AV_pendientesOficinas(ofi));
    Logger.log('✓ Se pudo leer la base. Hoy hay '+p.length+' solicitud(es) pendiente(s).');
  }catch(e){ Logger.log('✗ No se pudo leer la base: '+e.message); return; }
  var r = AV_enviarATodos('🔔 Prueba de avisos PROYECTOVISION', 'Si ves esto, los avisos al celular ya funcionan.', AV_BASE_APPS+'INVENTARIO_PTOVISION.html');
  if(r.enviados) Logger.log('\n✅ TODO BIEN. Llegó a '+r.enviados+' celular(es). Ya puedes ejecutar instalarVigilanteAvisos.');
  else Logger.log('\n△ La configuración está bien, pero no hay celulares activados todavía (o ninguno recibió). Activa los avisos desde la app y vuelve a probar.');
}
