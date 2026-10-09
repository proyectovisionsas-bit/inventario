// ════════════════════════════════════════════════════════════════════
// 🔄 RECARGA AUTOMÁTICA AL PUBLICAR · PROYECTOVISION — código compartido
//
// Lo cargan OFICINAS, INVENTARIO, TÉCNICOS y RED con
//     <script src="recarga.js?v=N"></script>
// UNA sola copia. REGLA: se edita recarga.js, NUNCA se copia dentro de un HTML.
// Al cambiarlo hay que subir el ?v= en las CUATRO apps (el mismo número en
// todas), o los navegadores siguen con la copia vieja en caché.
// Si este archivo no carga (sin señal al abrir la app), cada app sigue como
// antes: su botón «🔄 Actualizar ahora» tiene un respaldo propio que también
// conserva los parámetros de la dirección.
//
// Qué hace: cuando la app avisa que hay una versión publicada más nueva que la
// cargada (PV_RECARGA.anunciada), muestra una cuenta de 30 s y la pantalla se
// recarga sola, pero solo cuando es seguro:
//   1. nunca en modo prueba (?prueba=1) ni con ?ignorarVersion;
//   2. como máximo 3 recargas automáticas en 10 minutos por pestaña
//      (sessionStorage 'pv_recargas_<app>'); después, solo el botón;
//   3. nunca con un formulario a medias (op.formulario): espera a que se
//      cierre y vuelve a contar los 30 s completos;
//   4. después de la cuenta, un retraso al azar de 0 a 20 s, para que no se
//      recarguen todas las pantallas en el mismo segundo;
//   5. solo con internet: sin señal espera el evento 'online';
//   6. nunca con un guardado, una transacción o un envío en curso
//      (op.ocupado), y solo después de 3 s seguidos sin ocupación;
//   7. solo si la página publicada ya trae la versión nueva (GitHub Pages
//      tarda unos minutos): la baja sin caché, por partes, y deja de bajarla
//      apenas lee la constante. Si todavía no la trae, reintenta cada minuto.
//      Si la descarga falla, cuenta como «sin internet» (los datos móviles sin
//      salida dicen onLine=true).
//   Justo antes de recargar vuelve a mirar el formulario y la ocupación.
// La recarga conserva TODOS los parámetros de la dirección (prueba=1,
// ignorarVersion, caja, sede…) y el #, y solo pone nv=<hora>.
//
// No conoce Firebase, DB, USER ni TEC: todo le llega por el adaptador. NUNCA
// escribe en Firestore. Lo único que guarda es la lista de marcas de recarga
// en sessionStorage. Duplicar una pestaña copia su sessionStorage (y con él
// las marcas): se acepta.
//
// CONTRATO DEL ADAPTADOR op (lo arma cada app; los de () son funciones):
//   app             'INV' | 'OFI' | 'TEC' | 'RED' (da nombre a la clave de sessionStorage)
//   constante       'APP_VERSION_INV', 'APP_VERSION', 'APP_VERSION_TEC', 'APP_VERSION_RED'
//   versionLocal    número de la versión cargada en esta pantalla
//   modoPrueba      true con ?prueba=1: nunca recarga sola
//   ignorarVersion  true con ?ignorarVersion: nunca recarga sola
//   entornoLocal    true en una copia local (127.0.0.1, localhost, red de la
//                   casa, file://): SOLO así se respeta window.__PV_RECARGA_PRUEBA,
//                   el objeto con los tiempos acelerados del banco de pruebas
//                   (mismos nombres de TIEMPOS). En GitHub Pages se ignora.
//   ocupado()       '' o el motivo en español (guardado, transacción o envío en curso)
//   formulario()    opcional: '' o el motivo (formulario a medias; hoy solo TÉCNICOS)
//   antesDeRecargar() opcional: Promise o nada; se espera como máximo 5 s y la
//                   recarga sigue aunque falle
//   alCambiar(estado) opcional: se llama cuando cambia la fase o la versión
//                   anunciada (TÉCNICOS cambia franja ↔ bloqueo)
//
// API:
//   PV_RECARGA.iniciar(op)               una vez por carga de página
//   PV_RECARGA.anunciada(versionRemota)  la llama el oyente de versión de la app
//                                        cuando la remota es mayor; idempotente;
//                                        si llega una mayor, cambia el objetivo
//   PV_RECARGA.recargarAhora()           el botón «Actualizar ahora»: recarga ya,
//                                        conservando los parámetros (no mira la
//                                        página publicada ni el tope)
//   PV_RECARGA.estado()                  { fase, objetivo, segundos, motivo, recientes }
// Puras (también en node, para las pruebas):
//   PV_RECARGA.versionEnTexto(texto, constante)  número o 0
//   PV_RECARGA.urlRecarga(href, ahoraMs)         dirección con nv=<ms>, el resto igual
//   PV_RECARGA.podar(lista, ahoraMs)             deja las marcas de los últimos 10 min
//   PV_RECARGA.decidir(ctx)                      { fase, motivo } (ver decidir)
//   PV_RECARGA.TIEMPOS, PV_RECARGA.TEXTOS, PV_RECARGA.version
// Con red:
//   PV_RECARGA.leerVersionPublicada(constante, ruta) -> Promise<número>
//                                        (-1 si la descarga falla, 0 si no trae la constante)
//
// Fases (estado().fase): 'inactivo' (sin anuncio), 'prueba', 'tope',
// 'formulario', 'cuenta', 'azar', 'sin_red', 'ocupado', 'pagina_pendiente'
// (bajando la página publicada), 'pagina_vieja', 'recargando'.
// Un solo temporizador vivo a la vez.
//
// REGLAS DE ESTE ARCHIVO
//   · Al cargarse no toca window, document ni el almacenamiento: solo define
//     funciones. Nunca lanza errores hacia la app.
//   · El texto se escribe en TODO elemento con clase pvRecargaTexto, siempre
//     con textContent (nunca innerHTML).
//   · Todo acceso a sessionStorage va en try/catch; si falla, las marcas viven
//     en memoria.
//   · Si op.ocupado() lanza un error, se toma como ocupado (no se pierde nada:
//     queda el botón). Si op.formulario() lanza, se toma como sin formulario.
// ════════════════════════════════════════════════════════════════════

(function (global) {
    'use strict';

    // ── Constantes ──────────────────────────────────────────────────
    var VERSION = 1;
    var TIEMPOS = {
        cuentaMs: 30000,            // cuenta visible antes de recargar
        azarMaxMs: 20000,           // retraso al azar después de la cuenta (0 a 20 s)
        reintentoPaginaMs: 60000,   // página publicada vieja o sin red: se vuelve a mirar cada minuto
        sondeoMs: 2000,             // cada cuánto se mira si terminó el guardado o el formulario
        quietudMs: 3000,            // tiempo seguido sin ocupación antes de seguir
        topeRecargas: 3,            // recargas automáticas como máximo…
        ventanaMs: 600000,          // …en 10 minutos
        antesMaxMs: 5000            // espera máxima de op.antesDeRecargar
    };
    var DESCARGA_MAX_MS = 45000;    // una comprobación que no termina en 45 s cuenta como sin red
    var VIGIA_MS = 30000;           // si 30 s después de pedir la recarga la página sigue viva, el botón vuelve a servir
    var SOLAPE = 512;               // letras que se guardan de un trozo al siguiente (la constante puede quedar partida)
    var GENERICO = 'en curso';      // motivo cuando op.ocupado() devuelve true en vez de un texto
    var TEXTOS = {
        prueba: 'Modo prueba: esta pantalla no se actualiza sola.',
        ignorar: 'Abierta con ?ignorarVersion: esta pantalla no se actualiza sola.',
        tope: 'Ya se intentó actualizar varias veces. Toca «Actualizar ahora».',
        formulario: 'Termina lo que estás llenando; la app se actualizará después.',
        cuenta: 'Se actualizará sola en {n} s',
        azar: 'Actualizando…',
        sin_red: 'Sin internet: se actualizará cuando vuelva la señal.',
        ocupado: 'Esperando a que termine de guardar…',
        pagina_pendiente: 'Comprobando que la versión nueva ya esté publicada…',
        pagina_vieja: 'La versión nueva todavía no está lista; se vuelve a intentar en {t}.',
        recargando: 'Actualizando…',
        atascada: 'Si la página no se actualiza, toca «Actualizar ahora».'
    };
    var ESPERAS = { formulario: 1, cuenta: 1, azar: 1, sin_red: 1, ocupado: 1, pagina_pendiente: 1, pagina_vieja: 1 };
    try { Object.freeze(TIEMPOS); Object.freeze(TEXTOS); } catch (e) {}

    // ── Utilidades puras ────────────────────────────────────────────
    function noop() {}
    function esNum(x) { return typeof x === 'number' && isFinite(x); }
    function ahora() { return Date.now(); }
    function copiar(o) { var r = {}, k; for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k]; return r; }
    function escRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    // '' si no hay motivo; el texto si es texto; GENERICO si es true u otro valor verdadero
    function razon(x) {
        if (typeof x === 'string') return x.trim().slice(0, 160);
        return x ? GENERICO : '';
    }
    function textoOcupado(r) { return TEXTOS.ocupado + (r && r !== GENERICO ? ' (' + r + ')' : ''); }
    function textoCuenta(n) { return TEXTOS.cuenta.replace('{n}', String(n)); }
    function duracion(ms) {
        var s = Math.max(1, Math.round(Math.max(0, esNum(ms) ? ms : TIEMPOS.reintentoPaginaMs) / 1000));
        if (s >= 60 && s % 60 === 0) { var m = s / 60; return m === 1 ? '1 minuto' : m + ' minutos'; }
        return s + ' s';
    }
    function textoPaginaVieja(ms) { return TEXTOS.pagina_vieja.replace('{t}', duracion(ms)); }

    // Versión escrita en el texto de una página: número, o 0 si no está
    // (página de error, portal de wifi, descarga cortada antes de la constante).
    function versionEnTexto(texto, constante) {
        try {
            if (typeof texto !== 'string' || !texto || typeof constante !== 'string' || !constante) return 0;
            var m = new RegExp('const\\s+' + escRegex(constante) + '\\s*=\\s*(\\d+)\\s*;').exec(texto);
            var n = m ? parseInt(m[1], 10) : 0;
            return esNum(n) && n > 0 ? n : 0;
        } catch (e) { return 0; }
    }

    // Dirección para recargar: pone nv=<ms> (cambia el que hubiera) y conserva
    // TODOS los demás parámetros y el #.
    function urlRecarga(href, ahoraMs) {
        var ms = esNum(ahoraMs) ? Math.floor(ahoraMs) : ahora();
        var h = href == null ? '' : String(href);
        try {
            if (typeof URL === 'function') {
                var u = new URL(h);
                u.searchParams.set('nv', String(ms));
                return u.toString();
            }
        } catch (e) { /* dirección relativa o navegador sin URL: se arma a mano */ }
        var hash = '', i = h.indexOf('#');
        if (i >= 0) { hash = h.slice(i); h = h.slice(0, i); }
        var q = '', j = h.indexOf('?');
        if (j >= 0) { q = h.slice(j + 1); h = h.slice(0, j); }
        var partes = [];
        if (q) {
            var trozos = q.split('&');
            for (var k = 0; k < trozos.length; k++) {
                if (trozos[k] && trozos[k].split('=')[0] !== 'nv') partes.push(trozos[k]);
            }
        }
        partes.push('nv=' + ms);
        return h + '?' + partes.join('&') + hash;
    }

    // Marcas de recarga (ms): deja las de la ventana (10 min) hacia atrás, y
    // hacia adelante como mucho otra ventana (reloj corregido). Arreglo nuevo,
    // ordenado; no muta la entrada.
    function podar(lista, ahoraMs, ventanaMs) {
        var t = esNum(ahoraMs) ? ahoraMs : ahora();
        var v = esNum(ventanaMs) && ventanaMs >= 0 ? ventanaMs : TIEMPOS.ventanaMs;
        var out = [];
        if (!Array.isArray(lista)) return out;
        for (var i = 0; i < lista.length; i++) {
            var x = lista[i];
            var m = typeof x === 'number' ? x : (typeof x === 'string' && /^\d+(\.\d+)?$/.test(x) ? Number(x) : NaN);
            if (esNum(m) && t - m < v && m - t < v) out.push(m);
        }
        out.sort(function (a, b) { return a - b; });
        return out;
    }
    function contarRecientes(r, ahoraMs, ventanaMs) {
        if (Array.isArray(r)) {
            if (esNum(ahoraMs)) return podar(r, ahoraMs, ventanaMs).length;
            var n = 0;
            for (var i = 0; i < r.length; i++) if (esNum(r[i]) || (typeof r[i] === 'string' && /^\d+(\.\d+)?$/.test(r[i]))) n++;
            return n;
        }
        return esNum(r) && r > 0 ? Math.floor(r) : 0;
    }

    // La elección de fase, en este orden de prioridad:
    //   prueba (modoPrueba o ignorarVersion) → tope (3 recargas en 10 min) →
    //   formulario a medias → sin red → ocupado → página por bajar
    //   (versionPagina null) → descarga fallida (versionPagina < 0: sin red) →
    //   página vieja (versión < objetivo, o 0 = no trae la constante) → recargar.
    // ctx = { modoPrueba, ignorarVersion, recientes (número o lista de ms),
    //         formulario, online, ocupado, versionPagina, objetivo,
    //         opcionales: tope, ahoraMs y ventanaMs (para podar la lista),
    //         reintentoPaginaMs (para el texto) }
    function decidir(ctx) {
        var c = ctx && typeof ctx === 'object' ? ctx : {};
        var tope = esNum(c.tope) && c.tope >= 1 ? Math.floor(c.tope) : TIEMPOS.topeRecargas;
        if (c.modoPrueba) return { fase: 'prueba', motivo: TEXTOS.prueba };
        if (c.ignorarVersion) return { fase: 'prueba', motivo: TEXTOS.ignorar };
        if (contarRecientes(c.recientes, c.ahoraMs, c.ventanaMs) >= tope) return { fase: 'tope', motivo: TEXTOS.tope };
        if (razon(c.formulario)) return { fase: 'formulario', motivo: TEXTOS.formulario };
        if (c.online === false) return { fase: 'sin_red', motivo: TEXTOS.sin_red };
        var oc = razon(c.ocupado);
        if (oc) return { fase: 'ocupado', motivo: textoOcupado(oc) };
        var vp = c.versionPagina;
        if (vp === null || vp === undefined) return { fase: 'pagina_pendiente', motivo: TEXTOS.pagina_pendiente };
        vp = typeof vp === 'number' ? vp : Number(vp);
        if (!esNum(vp) || vp < 0) return { fase: 'sin_red', motivo: TEXTOS.sin_red };
        var obj = Number(c.objetivo);
        if (!esNum(obj)) obj = 0;
        if (vp < 1 || vp < obj) return { fase: 'pagina_vieja', motivo: textoPaginaVieja(c.reintentoPaginaMs) };
        return { fase: 'recargar', motivo: TEXTOS.recargando };
    }

    // ── Lectura de la página publicada (por partes, con cancelación) ─
    function cancelarSeguro(x) {
        try { var p = x && x.cancel ? x.cancel() : null; if (p && typeof p.catch === 'function') p.catch(noop); } catch (e) {}
    }
    // Promise<número>: la versión de la constante en la página publicada,
    // 0 si la página llegó pero no la trae, -1 si la descarga falló.
    function leerVersionPublicada(constante, ruta, ctrl) {
        return new Promise(function (listo) {
            var terminado = false;
            function dar(v) { if (!terminado) { terminado = true; listo(v); } }
            try {
                if (typeof global.fetch !== 'function') { dar(-1); return; }
                var loc = global.location || {};
                var base = typeof ruta === 'string' && ruta ? ruta : String(loc.pathname || '');
                var url = base + (base.indexOf('?') >= 0 ? '&' : '?') + 'nc=' + ahora();
                var opciones = { cache: 'no-store' };
                if (ctrl && ctrl.signal) opciones.signal = ctrl.signal;
                global.fetch(url, opciones).then(function (res) {
                    try {
                        if (!res || !res.ok) { if (res) cancelarSeguro(res.body); dar(0); return; }
                        var cuerpo = res.body, dec = null;
                        try {
                            if (cuerpo && typeof cuerpo.getReader === 'function' && typeof TextDecoder === 'function') dec = new TextDecoder('utf-8');
                        } catch (e1) { dec = null; }
                        if (!dec) {
                            res.text().then(function (tx) { dar(versionEnTexto(tx, constante)); }, function () { dar(-1); });
                            return;
                        }
                        var lector = cuerpo.getReader(), cola = '';
                        var leer = function () {
                            lector.read().then(function (r) {
                                if (terminado) { cancelarSeguro(lector); return; }
                                if (r.done) { dar(versionEnTexto(cola + dec.decode(), constante)); return; }
                                var buscar = cola + dec.decode(r.value, { stream: true });
                                var v = versionEnTexto(buscar, constante);
                                if (v > 0) { cancelarSeguro(lector); dar(v); return; }      // ya se sabe: no se baja el resto
                                cola = buscar.length > SOLAPE ? buscar.slice(-SOLAPE) : buscar;
                                leer();
                            }, function () { dar(-1); });
                        };
                        leer();
                    } catch (e2) { dar(-1); }
                }, function () { dar(-1); });
            } catch (e) { dar(-1); }
        });
    }

    // ── Estado de la pantalla ───────────────────────────────────────
    var S = {
        op: null, iniciado: false,
        fase: 'inactivo', motivo: '', objetivo: null, segundos: null,
        tmr: null, gen: 0, fin: 0,
        vioOcupado: false, libreDesde: 0, ultimaPagina: null,
        marcasMem: [], saliendo: false, ultimoAviso: ''
    };

    function opv(nombre) { return S.op ? S.op[nombre] : undefined; }
    function flag(nombre) {
        try { var x = opv(nombre); return typeof x === 'function' ? !!x() : !!x; }
        catch (e) { return nombre === 'modoPrueba'; }     // ante la duda, una pantalla de prueba no se recarga
    }
    function leerOcupado() {
        try { var f = opv('ocupado'); return razon(typeof f === 'function' ? f() : f); }
        catch (e) { return 'no se pudo comprobar si hay un guardado en curso'; }
    }
    function leerFormulario() {
        try { var f = opv('formulario'); return razon(typeof f === 'function' ? f() : f); }
        catch (e) { return ''; }
    }
    function enLinea() {
        try { return !(global.navigator && global.navigator.onLine === false); } catch (e) { return true; }
    }
    // Tiempos en uso: los de TIEMPOS, o los del banco de pruebas en una copia local.
    function tiempos() {
        var t = copiar(TIEMPOS);
        if (!flag('entornoLocal')) return t;
        try {
            var p = global.__PV_RECARGA_PRUEBA;
            if (p && typeof p === 'object') {
                for (var k in t) if (Object.prototype.hasOwnProperty.call(t, k) && esNum(p[k]) && p[k] >= 0) t[k] = p[k];
                t.topeRecargas = Math.max(1, Math.floor(t.topeRecargas));
            }
        } catch (e) {}
        return t;
    }

    // ── Marcas de recarga en sessionStorage ─────────────────────────
    function claveMarcas() { var a = opv('app'); return 'pv_recargas_' + (a ? String(a) : 'app'); }
    function leerMarcas() {
        var lista = S.marcasMem.slice();
        try {
            var ss = global.sessionStorage;
            var x = ss ? ss.getItem(claveMarcas()) : null;
            var a = x ? JSON.parse(x) : [];
            if (Array.isArray(a)) lista = lista.concat(a);
        } catch (e) {}
        var p = podar(lista, ahora(), tiempos().ventanaMs), sin = [];
        for (var i = 0; i < p.length; i++) if (sin.indexOf(p[i]) < 0) sin.push(p[i]);
        return sin;
    }
    function anotarMarca() {
        var lista = leerMarcas();
        lista.push(ahora());
        S.marcasMem = lista.slice();
        try { global.sessionStorage.setItem(claveMarcas(), JSON.stringify(lista)); } catch (e) {}
    }

    // ── Pantalla ────────────────────────────────────────────────────
    function pintar() {
        try {
            var d = global.document;
            if (!d || typeof d.querySelectorAll !== 'function') return;
            var els = d.querySelectorAll('.pvRecargaTexto');
            for (var i = 0; i < els.length; i++) {
                if (els[i] && els[i].textContent !== S.motivo) els[i].textContent = S.motivo;
            }
        } catch (e) {}
    }
    function estado() {
        var n = 0;
        try { n = leerMarcas().length; } catch (e) {}
        return { fase: S.fase, objetivo: S.objetivo, segundos: S.segundos, motivo: S.motivo, recientes: n };
    }
    function avisarCambio() {
        if (S.objetivo === null) return;
        var k = S.fase + '|' + S.objetivo;
        if (k === S.ultimoAviso) return;
        S.ultimoAviso = k;
        var f = opv('alCambiar');
        if (typeof f === 'function') { try { f(estado()); } catch (e) {} }
    }
    function fijarFase(f, motivo) {
        S.fase = f;
        S.motivo = typeof motivo === 'string' ? motivo : (TEXTOS[f] || '');
        if (f !== 'cuenta') S.segundos = null;
        pintar();
        avisarCambio();
    }

    // ── El único temporizador ───────────────────────────────────────
    function cancelarTimer() {
        if (S.tmr !== null) { try { global.clearTimeout(S.tmr); } catch (e) {} S.tmr = null; }
    }
    function programar(fn, ms) {
        cancelarTimer();
        try {
            S.tmr = global.setTimeout(function () {
                S.tmr = null;
                try { fn(); }
                catch (e) {
                    try { console.warn('recarga.js:', e); } catch (x) {}
                    // un fallo propio no deja la pantalla quieta para siempre: se vuelve a mirar más tarde
                    if (S.tmr === null && !S.saliendo && S.objetivo !== null && ESPERAS[S.fase]) programar(comprobar, tiempos().reintentoPaginaMs);
                }
            }, Math.max(0, esNum(ms) ? ms : 0));
        } catch (e) { S.tmr = null; }
    }

    // ── La máquina de estados ───────────────────────────────────────
    // Pasos 1 a 3 (sin mirar red, ocupación ni página).
    function previa() {
        var t = tiempos(), obj = S.objetivo || 1;
        return decidir({
            modoPrueba: flag('modoPrueba'), ignorarVersion: flag('ignorarVersion'),
            recientes: leerMarcas().length, tope: t.topeRecargas, formulario: leerFormulario(),
            online: true, ocupado: '', versionPagina: obj, objetivo: obj
        });
    }
    // Todos los pasos, con la versión de la página (null = todavía no se bajó).
    function completa(versionPagina) {
        var t = tiempos();
        return decidir({
            modoPrueba: flag('modoPrueba'), ignorarVersion: flag('ignorarVersion'),
            recientes: leerMarcas().length, tope: t.topeRecargas, formulario: leerFormulario(),
            online: enLinea(), ocupado: leerOcupado(), versionPagina: versionPagina,
            objetivo: S.objetivo, reintentoPaginaMs: t.reintentoPaginaMs
        });
    }

    function arrancar() {
        S.gen++; cancelarTimer();
        S.vioOcupado = false; S.libreDesde = 0;
        var d = previa();
        if (d.fase === 'prueba' || d.fase === 'tope') fijarFase(d.fase, d.motivo);
        else if (d.fase === 'formulario') enFormulario();
        else empezarCuenta();
        avisarCambio();
    }
    function enFormulario() {
        fijarFase('formulario', TEXTOS.formulario);
        programar(revisarFormulario, Math.max(20, tiempos().sondeoMs));
    }
    function revisarFormulario() {
        var d = previa();
        if (d.fase === 'formulario') { programar(revisarFormulario, Math.max(20, tiempos().sondeoMs)); return; }
        if (d.fase === 'prueba' || d.fase === 'tope') { fijarFase(d.fase, d.motivo); return; }
        S.vioOcupado = false; S.libreDesde = 0;
        empezarCuenta();                                   // al cerrar el formulario la cuenta empieza completa
    }
    function pasoCuenta(t, resta) { return Math.max(20, Math.min(resta, 1000, t.sondeoMs || 1000)); }
    function empezarCuenta() {
        var t = tiempos();
        S.fin = ahora() + t.cuentaMs;
        S.segundos = Math.ceil(t.cuentaMs / 1000);
        fijarFase('cuenta', textoCuenta(S.segundos));
        programar(tickCuenta, pasoCuenta(t, t.cuentaMs));
    }
    function tickCuenta() {
        var t = tiempos(), d = previa();
        if (d.fase === 'formulario') { enFormulario(); return; }
        if (d.fase === 'prueba' || d.fase === 'tope') { fijarFase(d.fase, d.motivo); return; }
        var resta = S.fin - ahora();
        if (resta <= 0) { empezarAzar(); return; }
        S.segundos = Math.ceil(resta / 1000);
        var tx = textoCuenta(S.segundos);
        if (tx !== S.motivo) { S.motivo = tx; pintar(); }
        programar(tickCuenta, pasoCuenta(t, resta));
    }
    function empezarAzar() {
        var t = tiempos();
        fijarFase('azar', TEXTOS.azar);
        programar(comprobar, Math.floor(Math.random() * Math.max(0, t.azarMaxMs)));
    }
    // Paso 6: red, ocupación (con quietud) y página publicada.
    function comprobar() {
        var t = tiempos(), d = completa(null);
        if (d.fase !== 'pagina_pendiente') { aplicar(d); return; }
        if (S.vioOcupado) {
            var n = ahora();
            if (!S.libreDesde) S.libreDesde = n;
            var falta = t.quietudMs - (n - S.libreDesde);
            if (falta > 0) {
                if (S.fase !== 'ocupado') fijarFase('ocupado', TEXTOS.ocupado);
                programar(comprobar, Math.max(10, Math.min(t.sondeoMs || falta, falta)));
                return;
            }
        }
        S.vioOcupado = false; S.libreDesde = 0;
        var c = S.ultimaPagina;
        if (c && c.v >= (S.objetivo || 0) && ahora() - c.ms < t.reintentoPaginaMs) { trasDescarga(c.v); return; }
        bajarPagina();
    }
    function aplicar(d) {
        var t = tiempos();
        switch (d.fase) {
            case 'prueba': case 'tope': cancelarTimer(); fijarFase(d.fase, d.motivo); return;
            case 'formulario': enFormulario(); return;
            case 'sin_red': fijarFase('sin_red', d.motivo); programar(comprobar, t.reintentoPaginaMs); return;
            case 'ocupado':
                S.vioOcupado = true; S.libreDesde = 0;
                fijarFase('ocupado', d.motivo);
                programar(comprobar, Math.max(20, t.sondeoMs));
                return;
            case 'pagina_vieja': fijarFase('pagina_vieja', d.motivo); programar(comprobar, t.reintentoPaginaMs); return;
            case 'recargar': recargarSola(); return;
            default: bajarPagina(); return;
        }
    }
    function bajarPagina() {
        var gen = ++S.gen, hecho = false, ctrl = null;
        fijarFase('pagina_pendiente', TEXTOS.pagina_pendiente);
        try { if (typeof AbortController === 'function') ctrl = new AbortController(); } catch (e) { ctrl = null; }
        var fin = function (v) {
            if (hecho) return;
            hecho = true;
            if (gen !== S.gen) return;                     // otra acción tomó el control (botón, anuncio, señal)
            cancelarTimer();
            S.ultimaPagina = esNum(v) && v >= 1 ? { v: v, ms: ahora() } : null;
            try { trasDescarga(v); } catch (e) { aplicar({ fase: 'sin_red', motivo: TEXTOS.sin_red }); }
        };
        programar(function () { try { if (ctrl) ctrl.abort(); } catch (e) {} fin(-1); }, DESCARGA_MAX_MS);
        leerVersionPublicada(opv('constante'), null, ctrl).then(fin, function () { fin(-1); });
    }
    function trasDescarga(v) {
        var d = completa(esNum(v) ? v : -1);           // vuelve a mirar formulario, red y ocupación justo antes de recargar
        aplicar(d.fase === 'pagina_pendiente' ? { fase: 'sin_red', motivo: TEXTOS.sin_red } : d);
    }

    // ── Paso 7: recargar ────────────────────────────────────────────
    function navegar() {
        try {
            var loc = global.location;
            if (!loc) return;
            var url = urlRecarga(String(loc.href), ahora());
            try { loc.replace(url); } catch (e) { loc.href = url; }
        } catch (e2) {}
    }
    // Si la página sigue viva un buen rato después de pedir la recarga (el navegador no
    // navegó), el botón vuelve a funcionar: si no, «Actualizar ahora» quedaría muerto.
    function vigilarNavegacion() {
        var ms = VIGIA_MS;
        try {
            if (flag('entornoLocal')) {
                var p = global.__PV_RECARGA_PRUEBA;
                if (p && esNum(p.vigiaMs) && p.vigiaMs >= 0) ms = p.vigiaMs;
            }
        } catch (e) {}
        try {
            var h = global.setTimeout(function () {
                S.saliendo = false;
                if (S.fase === 'recargando') fijarFase('tope', TEXTOS.atascada);
            }, ms);
            if (h && typeof h.unref === 'function') h.unref();
        } catch (e) {}
    }
    function devolverMarcas(lista) {
        S.marcasMem = lista.slice();
        try { global.sessionStorage.setItem(claveMarcas(), JSON.stringify(lista)); } catch (e) {}
    }
    function navegarTrasAntes(auto) {
        S.saliendo = true;
        var listo = false, previas = auto ? leerMarcas() : null;
        if (auto) anotarMarca();                           // la marca va antes de esperar: cuenta aunque la página muera aquí
        var seguir = function () {
            if (listo) return;
            listo = true;
            cancelarTimer();
            if (auto) {
                // antesDeRecargar pudo tardar hasta antesMaxMs. Si en ese rato empezó un guardado,
                // se abrió un formulario o se fue la señal, no se corta nada: se quita la marca
                // y se vuelve a esperar (la página ya se comprobó; queda en S.ultimaPagina).
                var t = tiempos();
                var d = decidir({
                    modoPrueba: flag('modoPrueba'), ignorarVersion: flag('ignorarVersion'),
                    recientes: previas.length, tope: t.topeRecargas, formulario: leerFormulario(),
                    online: enLinea(), ocupado: leerOcupado(), versionPagina: S.objetivo,
                    objetivo: S.objetivo, reintentoPaginaMs: t.reintentoPaginaMs
                });
                if (d.fase !== 'recargar') {
                    devolverMarcas(previas);
                    S.saliendo = false;
                    aplicar(d);
                    return;
                }
            }
            fijarFase('recargando', TEXTOS.recargando);
            navegar();
            vigilarNavegacion();
        };
        programar(seguir, tiempos().antesMaxMs);
        try {
            var f = opv('antesDeRecargar');
            var p = typeof f === 'function' ? f() : null;
            if (p && typeof p.then === 'function') p.then(seguir, seguir);
            else seguir();
        } catch (e) { seguir(); }
    }
    function recargarSola() {
        S.gen++; cancelarTimer();
        navegarTrasAntes(true);
    }

    // ── API ─────────────────────────────────────────────────────────
    function alVolverRed() {
        try {
            if (S.fase !== 'sin_red' || S.saliendo) return;
            programar(comprobar, Math.max(20, Math.min(1000, tiempos().sondeoMs)));
        } catch (e) {}
    }
    function iniciar(op) {
        try {
            S.op = op && typeof op === 'object' ? op : {};
            if (!S.iniciado) {
                S.iniciado = true;
                try { if (typeof global.addEventListener === 'function') global.addEventListener('online', alVolverRed); } catch (e) {}
            }
            if (S.fase === 'inactivo' && (flag('modoPrueba') || flag('ignorarVersion'))) {
                fijarFase('prueba', flag('modoPrueba') ? TEXTOS.prueba : TEXTOS.ignorar);
            }
            if (S.objetivo !== null && !S.saliendo) {         // el anuncio llegó antes que iniciar
                var local = Number(opv('versionLocal'));
                if (esNum(local) && S.objetivo <= local) S.objetivo = null;
                else if (S.fase === 'inactivo' || S.fase === 'prueba') arrancar();
            }
        } catch (e) {}
        return estado();
    }
    function anunciada(versionRemota) {
        try {
            var v = Number(versionRemota);
            if (!esNum(v) || v <= 0) return estado();
            if (S.op) {
                var local = Number(opv('versionLocal'));
                if (esNum(local) && v <= local) return estado();
            }
            if (S.objetivo !== null && v <= S.objetivo) { pintar(); return estado(); }   // ya anunciada: una sola cuenta
            var primera = S.objetivo === null;
            S.objetivo = v;
            if (!S.op) return estado();                         // arranca en iniciar
            if (primera && !S.saliendo) arrancar();
            else { pintar(); avisarCambio(); }                  // una mayor solo cambia el objetivo
        } catch (e) {}
        return estado();
    }
    function recargarAhora() {
        try {
            if (S.saliendo) return;
            S.gen++; cancelarTimer();
            navegarTrasAntes(false);
        } catch (e) { navegar(); }
    }

    var PV_RECARGA = {
        version: VERSION,
        TIEMPOS: TIEMPOS, TEXTOS: TEXTOS,
        iniciar: iniciar, anunciada: anunciada, recargarAhora: recargarAhora, estado: estado,
        versionEnTexto: versionEnTexto, urlRecarga: urlRecarga, podar: podar, decidir: decidir,
        leerVersionPublicada: function (constante, ruta) { return leerVersionPublicada(constante, ruta, null); }
    };
    try { global.PV_RECARGA = PV_RECARGA; } catch (e) {}
    if (typeof module !== 'undefined' && module && module.exports) module.exports = PV_RECARGA;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
