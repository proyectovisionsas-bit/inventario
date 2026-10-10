// ════════════════════════════════════════════════════════════════════
// 📺 PANTALLAS ABIERTAS (LATIDO) · PROYECTOVISION — código compartido
//
// Lo cargan OFICINAS, INVENTARIO, TÉCNICOS y RED con
//     <script src="pantallas.js?v=N"></script>
// UNA sola copia. REGLA: se edita pantallas.js, NUNCA se copia dentro de un HTML.
// Al cambiarlo hay que subir el ?v= en las CUATRO apps (el mismo número en
// todas), o los navegadores siguen con la copia vieja en caché.
// Si este archivo no carga (sin señal al abrir la app), la app sigue igual:
// solo que esa pantalla no envía latido y no sale en el panel.
//
// Para qué (docs/12, Etapa 6): una pantalla vieja abierta por días puede
// reescribir datos con su copia vieja; es la principal sospecha de los equipos
// instalados que volvieron a la cuadrilla. Cada pantalla deja un LATIDO en
// oficinas_sistema/sesiones_vivas, y el administrador ve en un panel cuáles
// siguen abiertas, con qué versión, cuáles llevan más de un día y cuáles ya no
// laten. Solo se ven las pantallas que tienen este código: las anteriores no
// envían latido (el panel lo dice siempre, con NOTA).
//
// EL DOCUMENTO oficinas_sistema/sesiones_vivas. Lo COMPARTEN las cuatro apps
// (regla 7 de CLAUDE.md): nadie le cambia la forma por su cuenta.
//   { sesiones: { "<clave>": { app, v, rol, nombre, sesion, equipo, disp,
//                              cargadaMs, ultimoMs, en, vieja, local, visible,
//                              recarga, n } } }
//   clave      'p' + 12 [a-z0-9], al azar POR CARGA de página, sin puntos.
//              La sesión va aparte: duplicar una pestaña copia su
//              sessionStorage, y con la sesión como clave las dos se pisarían.
//   app        'OFI' | 'INV' | 'TEC' | 'RED'
//   v          número de la versión cargada (APP_VERSION, _INV, _TEC, _RED)
//   rol        'admin', 'oficina', 'sgsst', 'bodega', 'tecnico'…
//   nombre     la sede (bodega u oficina), 'Admin', 'SG-SST' o el PRIMER nombre
//              de la persona («DONCELLO · Ana»). NUNCA cédula, teléfono ni
//              nombre completo: la colección se lee sin autenticación.
//   sesion     id de la pestaña (inv_sesion_id, tec_sesion_id, pv_pestana…)
//   equipo     localStorage['pv_equipo_id'] ('eq_' + 10, el de la Etapa 1)
//   disp       'celular' | 'pc' (nada más del navegador)
//   cargadaMs  cuándo se cargó la página (hora del equipo)
//   ultimoMs   cuándo salió este latido (hora del equipo)
//   en         serverTimestamp(): hora del SERVIDOR, la que manda en la poda
//   vieja      la pantalla ya sabe que hay una versión publicada mayor
//   local      copia local (127.0.0.1, localhost, red de la casa, file://)
//   visible    la pestaña estaba a la vista
//   recarga    PV_RECARGA.estado().fase, o '' si no hay recarga.js
//   n          latidos enviados en esta carga, contando este
// Sin campos de primer nivel tipo, firmaRef ni clienteCedula: entraría en
// consultas que ya existen sobre oficinas_sistema. Nada en main ni en
// inventario/datos (todas las pantallas los escuchan: cada latido costaría una
// lectura por pantalla).
//
// CÓMO SE ESCRIBE: SIEMPRE un set con merge:true:
//   { sesiones: { [clave]: entradaCompleta, [vieja1]: deleteField(), … } }
// Nunca un update del mapa sesiones (lo reemplaza y borra a todos), nunca un
// set sin merge, nunca un merge por campos, nunca un mapa sesiones vacío.
// Este archivo no conoce Firebase: el parche sale con las marcas {__ts:1}
// (serverTimestamp) y {__del:1} (deleteField), y la app las traduce
// (PV_PANTALLAS.traducir lo hace con las funciones que la app le pase).
//
// PODA. Son datos de vigilancia efímeros, no datos del negocio: se borran.
// En el MISMO set merge del primer latido de cada carga (con una lectura antes)
// y al abrir el panel, se quitan las entradas cuyo en es más de 24 h anterior
// al en MÁS NUEVO del documento. Nunca contra la hora del equipo: un reloj
// adelantado no puede borrar a los demás. Una entrada sin en legible se
// conserva, salvo que su ultimoMs sea más de 48 h anterior al en más nuevo.
// Tope: si quedan más de 400, se borran las más viejas. Nunca se borra la
// propia. Una entrada viva que se pode por error vuelve en su siguiente latido.
// HORA IMPOSIBLE: las apps escriben en con serverTimestamp(), pero el documento
// se escribe desde internet sin autenticación. Un en más de 24 h por delante
// del reloj de quien lee no cuenta: ni como «el más nuevo» (si contara, cada
// carga borraría a todas las demás y el panel quedaría ciego para siempre), ni
// como latido en el panel, ni para ordenar el tope (va de primera). Así la poda
// solo puede volverse más prudente: con el reloj de quien lee atrasado, poda
// menos o nada. La poda nunca borra una entrada por tener la hora imposible;
// eso lo hace solo el panel (futuras), y solo si además va más de 24 h por
// delante del en creíble más nuevo y las entradas con un en creíble son más
// que las de hora imposible (si no, no se sabe quién está mal: puede ser el
// reloj de quien lee, y no se borra nada).
//
// CADENCIA: el primer latido al iniciar (que la app llama DESPUÉS de iniciar
// sesión), luego cada 5 min con la pestaña a la vista y cada 15 min oculta; al
// volver a la vista, uno inmediato si pasó más de 5 min (minEntreMs). Sin señal
// (navigator.onLine === false) no se escribe, para no encolar latidos, y se
// intenta al volver la señal. Un solo temporizador. Un latido que falla (sin
// señal, cuota, reglas) nunca lanza ni afecta nada: se reintenta en el
// siguiente turno. Si la promesa de la app no termina en 30 s se suelta (sin
// señal, el SDK la deja en su cola). Si la hora del equipo retrocede (alguien
// la corrigió a mano), ningún turno pasa de 5 o 15 min y una diferencia
// negativa cuenta como «ya pasó el minuto»: la pantalla sigue latiendo.
//
// CONTRATO DEL ADAPTADOR op (lo arma cada app; los de () son funciones):
//   app             'OFI' | 'INV' | 'TEC' | 'RED'
//   modoPrueba      true o (): con ?prueba=1 no lee, no escribe ni lo intenta
//   entornoLocal    true o (): copia local. SOLO así se respeta
//                   window.__PV_LATIDO_PRUEBA, el objeto con los tiempos
//                   acelerados del banco de pruebas (mismos nombres de TIEMPOS)
//   cargadaMs       opcional: hora de carga de la página (número o ()); si no
//                   viene, la hora en que se cargó este archivo
//   datos()         { v, rol, nombre, persona, sesion, vieja, recarga }: lo que
//                   cambia en cada latido. persona es opcional: el nombre de la
//                   persona, del que se guarda SOLO el primero, después del de
//                   la sede («DONCELLO · Ana»). Si datos() lanza, ese latido no
//                   sale (mejor nada que una versión 0 marcada como vieja).
//   escribir(parche) -> Promise: set(parche traducido, {merge:true}) sobre
//                   oficinas_sistema/sesiones_vivas. La app rechaza en modo
//                   prueba ANTES del set, y NO lo pasa por sus contadores de
//                   escrituras en vuelo ni por su freno de versión vieja: justo
//                   esas pantallas hay que ver, y la recarga automática no debe
//                   esperar a un latido sin señal.
//   leer()          -> Promise<datos del documento | null> (un get)
//   leerVersiones() -> Promise<{OFI, INV, TEC, RED}> (solo donde hay panel)
//
// API:
//   PV_PANTALLAS.version, TIEMPOS, NOTA, APPS
// Puras (también en node, para las pruebas):
//   nuevaClave()                      'p' + 12 [a-z0-9]
//   claveValida(k)                    true si k tiene esa forma
//   primerNombre(texto)               «JUAN CARLOS PEREZ» → «Juan»; vacío → ''
//   dispositivo(userAgent)            'celular' | 'pc'
//   entrada(d, ahoraMs)               la entrada del documento, con LISTA BLANCA
//   msDe(x)                           número | Timestamp | {seconds} → ms o null
//   podar(sesiones, propia, t?, ahoraMs?)  claves que hay que borrar
//   futuras(sesiones, propia, t?, ahoraMs?) claves con la hora imposible que el panel quita
//   armarParche(clave, entrada, borrar) {sesiones:{…}} con marcas, o null
//   traducir(parche, hora, borrar)    cambia las marcas por hora() y borrar()
//   resumen(sesiones, publicadas, ahoraMs, t?)  filas y cuentas del panel
//   textoResumen(res)                 «N pantallas abiertas · M con versión vieja · K sin latido…»
//   htmlPanel(res, opciones)          el HTML del panel, TODO escapado
// En ejecución:
//   iniciar(op)      una vez por carga, DESPUÉS de iniciar sesión; idempotente
//   latir()          fuerza un latido ahora (respeta minEntreMs) -> Promise<bool>
//   estado()         { clave, n, ultimoOk, ultimoError, iniciado, enCurso, … }
//   leerPanel(op?)   -> Promise<resumen>: 1 lectura del documento + versiones;
//                    poda con un set merge si hay viejas (salvo modo prueba)
//   ultimoPanel()    { res, ms } de la última lectura del panel, o null
//   detener()        apaga el latido (pruebas o salida de sesión)
//   equipoId()       el id de este navegador (pv_equipo_id)
//
// REGLAS DE ESTE ARCHIVO
//   · Al cargarse no toca window, document ni el almacenamiento: solo define
//     funciones. Nunca lanza errores hacia la app.
//   · Nunca undefined en lo que se escribe; nunca serverTimestamp dentro de un
//     arreglo (el parche no lleva arreglos).
//   · Todo lo que se pinta pasa por esc(): el documento se puede escribir desde
//     internet.
//   · Todo acceso a localStorage va en try/catch.
// ════════════════════════════════════════════════════════════════════

(function (global) {
    'use strict';

    // ── Constantes ──────────────────────────────────────────────────
    var VERSION = 1;
    var TIEMPOS = {
        visibleMs: 300000,          // un latido cada 5 min con la pestaña a la vista
        ocultaMs: 900000,           // cada 15 min con la pestaña oculta
        minEntreMs: 300000,         // al volver a la vista, uno inmediato si pasó más de 5 min (no más que el ritmo normal: cuota de Firebase)
        edad24Ms: 86400000,         // poda: más de 24 h antes del en más nuevo (y «abierta más de 24 h»)
        sinLatidoMs: 960000,        // panel: sin latido hace más de 16 min (15 min oculta + 1 de margen)
        tope: 400                   // poda: como mucho 400 entradas
    };
    var INTERNOS = {
        esperaMs: 30000,            // espera máxima de una lectura o escritura de la app
        primeroMs: 0                // retraso del primer latido tras iniciar
    };
    var NOTA = 'Solo aparecen las pantallas con este código (desde OFICINAS v320, INVENTARIO v115, TÉCNICOS v101 y RED v44). Las anteriores no envían latido.';
    var APPS = ['OFI', 'INV', 'TEC', 'RED'];
    var NOMBRE_APP = { OFI: 'OFICINAS', INV: 'INVENTARIO', TEC: 'TÉCNICOS', RED: 'RED' };
    var RE_CLAVE = /^p[a-z0-9]{12}$/;
    var RE_EQUIPO = /^eq_[a-z0-9]{6,40}$/;           // el mismo que acepta TÉCNICOS (Etapa 1)
    var K_EQUIPO = 'pv_equipo_id';
    var CARGA_MS = Date.now();                         // hora de carga de la página si la app no da otra
    try { Object.freeze(TIEMPOS); Object.freeze(APPS); } catch (e) {}

    // ── Utilidades ──────────────────────────────────────────────────
    function noop() {}
    function str(x) { try { return x === undefined || x === null ? '' : String(x); } catch (e) { return ''; } }
    function esNum(x) { return typeof x === 'number' && isFinite(x); }
    function hasOwn(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
    function esObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
    function entero(x) { var n = Number(x); return isFinite(n) && n > 0 ? Math.floor(n) : 0; }
    function esc(s) {
        return str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    // Caracteres invisibles o de formato (los mismos que quita buzon.js): no se ven y esconden texto ajeno.
    var RE_INVISIBLES = /[\u0080-\u009f\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff0-\ufffb]/g;
    function unaLinea(s) { return str(s).replace(RE_INVISIBLES, '').replace(/[\x00-\x1f\x7f]+/g, ' ').replace(/\s+/g, ' ').trim(); }
    function msg(e) {
        var m = e && typeof e === 'object' && e.message !== undefined ? e.message : e;
        m = unaLinea(m).slice(0, 200);
        return m || 'error sin detalle';
    }
    var SIGNOS = 'abcdefghijklmnopqrstuvwxyz0123456789';
    function azar(n) {
        var s = '', b = null, i;
        try { if (global.crypto && typeof global.crypto.getRandomValues === 'function') { b = new Uint8Array(n); global.crypto.getRandomValues(b); } } catch (e) { b = null; }
        for (i = 0; i < n; i++) s += SIGNOS.charAt((b ? b[i] : Math.floor(Math.random() * 256)) % 36);
        return s;
    }
    // Tiempos para las puras: los de TIEMPOS, con lo que traiga t (números ≥ 0 de los mismos nombres).
    function tiemposDe(t) {
        var r = {}, k;
        for (k in TIEMPOS) if (hasOwn(TIEMPOS, k)) r[k] = TIEMPOS[k];
        if (esObj(t)) for (k in r) if (hasOwn(r, k) && esNum(t[k]) && t[k] >= 0) r[k] = t[k];
        r.tope = Math.max(1, Math.floor(r.tope));
        return r;
    }
    // Duración corta en español: «menos de 1 min», «7 min», «2 h 5 min», «1 d 3 h».
    function duracion(ms) {
        var m = Math.floor(Math.max(0, esNum(ms) ? ms : 0) / 60000);
        if (m < 1) return 'menos de 1 min';
        if (m < 60) return m + ' min';
        var h = Math.floor(m / 60), mm = m % 60;
        if (h < 24) return h + ' h' + (mm ? ' ' + mm + ' min' : '');
        var d = Math.floor(h / 24), hh = h % 24;
        return d + ' d' + (hh ? ' ' + hh + ' h' : '');
    }

    // ── Funciones puras (exportadas) ────────────────────────────────
    function nuevaClave() { return 'p' + azar(12); }
    function claveValida(k) { return typeof k === 'string' && RE_CLAVE.test(k); }

    // Primera palabra con letras, en tipo título y con tildes: «JOSÉ-MARÍA PÉREZ» → «José-María».
    // Las cifras se descartan: una cédula que llegue por error da ''. Lo que no es texto, también ''.
    function primerNombre(texto) {
        try {
            if (typeof texto !== 'string') return '';
            var palabras = unaLinea(texto).split(' '), i, p;
            for (i = 0; i < palabras.length; i++) {
                p = palabras[i].replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\-]/g, '').replace(/^-+|-+$/g, '');
                if (p) {
                    p = p.slice(0, 20).toLowerCase();
                    return p.replace(/(^|-)([a-záéíóúüñ])/g, function (m, g, l) { return g + l.toUpperCase(); });
                }
            }
        } catch (e) {}
        return '';
    }
    function dispositivo(ua) { return /Mobi|Android|iPhone/i.test(str(ua)) ? 'celular' : 'pc'; }

    // Nombre de la sede, 'Admin', 'SG-SST' o «SEDE · Primer». Por si se cuela algo, se quitan
    // correos y tramos de 5 o más cifras (una cédula, un teléfono) y se corta a 40 letras.
    function nombreSeguro(x) {
        if (typeof x !== 'string') return '';
        var s = unaLinea(x);
        s = s.replace(/[^\s@]+@[^\s@]+/g, ' ');
        s = s.replace(/\+?\d(?:[\s.,'\-]?\d){4,}/g, ' ');
        s = s.replace(/\s+/g, ' ').replace(/^[\s·\-]+|[\s·\-]+$/g, '');
        return s.slice(0, 40).trim();
    }
    function soloTexto(x) { return typeof x === 'string' || esNum(x) ? String(x) : ''; }   // un objeto no se vuelve «[object Object]»
    function idSeguro(x) { return soloTexto(x).replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 40); }
    function rolSeguro(x) { return unaLinea(soloTexto(x)).replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ_\- ]/g, '').trim().slice(0, 20); }
    function faseSegura(x) { return soloTexto(x).replace(/[^a-z_]/g, '').slice(0, 24); }

    // La entrada del documento (§1.1) desde datos planos, con LISTA BLANCA: cualquier otra llave
    // (cédula, teléfono, documento, nombre completo, tipo…) se descarta. Nunca undefined. El campo en
    // sale con la marca {__ts:1}, que la app traduce a serverTimestamp().
    //   d = { app, v, rol, nombre, persona, sesion, equipo, disp, cargadaMs, vieja, local, visible, recarga, n }
    function entrada(d, ahoraMs) {
        var ms = esNum(ahoraMs) ? Math.floor(ahoraMs) : Date.now();
        try {
            var x = esObj(d) ? d : {};
            var app = str(x.app).toUpperCase();
            if (APPS.indexOf(app) < 0) app = '';
            var nombre = nombreSeguro(x.nombre), pn = primerNombre(x.persona);
            if (pn) nombre = nombre ? nombre + ' · ' + pn : pn;
            var visible = x.visible === undefined || x.visible === null ? true : !!x.visible;
            return {
                app: app,
                v: entero(x.v),
                rol: rolSeguro(x.rol),
                nombre: nombre.slice(0, 64),
                sesion: idSeguro(x.sesion),
                equipo: idSeguro(x.equipo),
                disp: x.disp === 'celular' ? 'celular' : 'pc',
                cargadaMs: esNum(x.cargadaMs) && x.cargadaMs > 0 ? Math.floor(x.cargadaMs) : ms,
                ultimoMs: ms,
                en: { __ts: 1 },
                vieja: !!x.vieja,
                local: !!x.local,
                visible: visible,
                recarga: faseSegura(x.recarga),
                n: entero(x.n)
            };
        } catch (e) {
            return { app: '', v: 0, rol: '', nombre: '', sesion: '', equipo: '', disp: 'pc', cargadaMs: ms, ultimoMs: ms,
                en: { __ts: 1 }, vieja: false, local: false, visible: true, recarga: '', n: 0 };
        }
    }

    // Milisegundos de una marca de hora: número (el simulador), Timestamp (toMillis), Date,
    // {seconds, nanoseconds} o {_seconds, _nanoseconds}. null si no se puede leer.
    function msDe(x) {
        try {
            if (x === null || x === undefined) return null;
            if (typeof x === 'number') return isFinite(x) ? x : null;
            if (typeof x !== 'object') return null;
            var n;
            if (typeof x.toMillis === 'function') { n = Number(x.toMillis()); return isFinite(n) ? n : null; }
            if (typeof x.getTime === 'function') { n = Number(x.getTime()); return isFinite(n) ? n : null; }
            var s = esNum(x.seconds) ? x.seconds : (esNum(x._seconds) ? x._seconds : null);
            if (s === null) return null;
            var ns = esNum(x.nanoseconds) ? x.nanoseconds : (esNum(x._nanoseconds) ? x._nanoseconds : 0);
            return s * 1000 + Math.floor(ns / 1e6);
        } catch (e) { return null; }
    }
    function clavesDe(sesiones) {
        var out = [], k;
        if (!esObj(sesiones)) return out;
        for (k in sesiones) if (hasOwn(sesiones, k) && k !== '__proto__') out.push(k);
        return out;
    }
    // Hasta dónde es creíble un en: la hora de quien lee (ahoraMs, o la del equipo) más 24 h. Más allá
    // es una hora imposible (ver HORA IMPOSIBLE arriba). Solo sirve de tope: nunca adelanta una poda.
    function limiteEn(ahoraMs, T) { return (esNum(ahoraMs) ? ahoraMs : Date.now()) + T.edad24Ms; }
    // El en de una entrada si es creíble (no pasa de lim); null si no trae, no se lee o es imposible.
    function enCreible(e, lim) {
        var m = esObj(e) ? msDe(e.en) : null;
        return m !== null && m > lim ? null : m;
    }
    // El en (hora del servidor) creíble más nuevo del documento, o null si ninguna entrada lo trae.
    function enMasNuevo(sesiones, lim) {
        var ref = null, ks = clavesDe(sesiones), i, m;
        for (i = 0; i < ks.length; i++) {
            m = enCreible(sesiones[ks[i]], lim);
            if (m !== null && (ref === null || m > ref)) ref = m;
        }
        return ref;
    }
    // Para ordenar de más vieja a más nueva: en creíble; si no, ultimoMs (también hasta lim); si no, lo
    // más viejo posible. Una entrada con la hora imposible y sin otra hora creíble se va de primera.
    function momento(e, lim) {
        if (!esObj(e)) return -Infinity;
        var m = enCreible(e, lim);
        if (m !== null) return m;
        return esNum(e.ultimoMs) && e.ultimoMs <= lim ? e.ultimoMs : -Infinity;
    }

    // Claves que hay que borrar (regla de la poda, arriba). No muta nada. propia nunca sale.
    // t (opcional): tiempos con edad24Ms y tope. ahoraMs (opcional): la hora de quien poda, SOLO como tope
    // de lo creíble (un en más de 24 h por delante no cuenta); si no viene, la del equipo.
    function podar(sesiones, propia, t, ahoraMs) {
        var out = [];
        try {
            var T = tiemposDe(t), ks = clavesDe(sesiones), lim = limiteEn(ahoraMs, T), ref = enMasNuevo(sesiones, lim), quedan = [], i;
            var mia = typeof propia === 'string' && propia ? propia : null;
            for (i = 0; i < ks.length; i++) {
                var k = ks[i], e = sesiones[k];
                if (k === mia) { quedan.push(k); continue; }
                if (ref !== null) {
                    var en = esObj(e) ? msDe(e.en) : null;
                    if (en !== null) {
                        // ref nunca pasa de lim: una hora imposible (en > lim) no sale por edad (eso lo decide el panel, con futuras)
                        if (ref - en > T.edad24Ms) { out.push(k); continue; }
                    } else {
                        var u = esObj(e) && esNum(e.ultimoMs) ? e.ultimoMs : null;
                        if (u !== null && ref - u > 2 * T.edad24Ms) { out.push(k); continue; }
                    }
                }
                quedan.push(k);
            }
            // Tope: la propia cuenta aunque todavía no esté en el documento (se escribe en el mismo set).
            var total = quedan.length + (mia && quedan.indexOf(mia) < 0 ? 1 : 0);
            if (total > T.tope) {
                var cand = [];
                for (i = 0; i < quedan.length; i++) if (quedan[i] !== mia) cand.push(quedan[i]);
                cand.sort(function (a, b) {
                    var ma = momento(sesiones[a], lim), mb = momento(sesiones[b], lim);
                    if (ma !== mb) return ma < mb ? -1 : 1;
                    return a < b ? -1 : (a > b ? 1 : 0);
                });
                for (i = 0; i < total - T.tope && i < cand.length; i++) out.push(cand[i]);
            }
        } catch (e2) {}
        return out;
    }

    // Claves con la hora imposible que el panel quita (HORA IMPOSIBLE, arriba): su en pasa de la hora de
    // quien lee + 24 h Y va más de 24 h por delante del en creíble más nuevo. Solo si las entradas con un
    // en creíble son MÁS que las de hora imposible: si no (por ejemplo, el reloj de quien lee va días
    // atrasado y todas le parecen del futuro), no se sabe quién está mal y no se borra nada.
    // No muta nada; propia nunca sale. Mismos parámetros que podar.
    function futuras(sesiones, propia, t, ahoraMs) {
        var out = [];
        try {
            var T = tiemposDe(t), ks = clavesDe(sesiones), lim = limiteEn(ahoraMs, T), ref = null, creibles = 0, imposibles = [], i, m;
            var mia = typeof propia === 'string' && propia ? propia : null;
            for (i = 0; i < ks.length; i++) {
                var e = sesiones[ks[i]];
                m = esObj(e) ? msDe(e.en) : null;
                if (m === null) continue;
                if (m <= lim) { creibles++; if (ref === null || m > ref) ref = m; }
                else imposibles.push({ k: ks[i], m: m });
            }
            if (ref === null || creibles <= imposibles.length) return out;
            for (i = 0; i < imposibles.length; i++) {
                if (imposibles[i].k !== mia && imposibles[i].m - ref > T.edad24Ms) out.push(imposibles[i].k);
            }
        } catch (e2) {}
        return out;
    }

    // El parche del set merge: la entrada propia (si hay clave) y una marca {__del:1} por cada clave
    // que se borra. null si no hay nada que escribir (nunca un mapa sesiones vacío).
    function armarParche(clave, ent, borrar) {
        try {
            var s = {}, n = 0, i, k;
            if (typeof clave === 'string' && clave && esObj(ent)) { s[clave] = ent; n++; }
            var b = Array.isArray(borrar) ? borrar : [];
            for (i = 0; i < b.length; i++) {
                k = b[i];
                if (typeof k !== 'string' || !k || k === clave || k === '__proto__' || hasOwn(s, k)) continue;
                s[k] = { __del: 1 };
                n++;
            }
            return n ? { sesiones: s } : null;
        } catch (e) { return null; }
    }

    // Cambia las marcas por lo que da la app: {__ts:1} → hora() y {__del:1} → borrar(), en una copia.
    // hora y borrar pueden ser funciones (se llaman en cada marca) o valores.
    function traducir(parche, hora, borrar) {
        function dar(f) { return typeof f === 'function' ? f() : f; }
        function rec(x, prof) {
            if (prof > 32) return x;
            if (Array.isArray(x)) { var a = [], i; for (i = 0; i < x.length; i++) a.push(rec(x[i], prof + 1)); return a; }
            if (esObj(x)) {
                var ks = Object.keys(x);
                if (ks.length === 1 && ks[0] === '__ts' && x.__ts === 1) return dar(hora);
                if (ks.length === 1 && ks[0] === '__del' && x.__del === 1) return dar(borrar);
                var o = {}, j;
                for (j = 0; j < ks.length; j++) if (ks[j] !== '__proto__') o[ks[j]] = rec(x[ks[j]], prof + 1);
                return o;
            }
            return x;
        }
        return rec(parche, 0);
    }

    // ── Resumen y panel ─────────────────────────────────────────────
    // publicadas = {OFI:320, INV:115, TEC:101, RED:44}; ahoraMs = hora de quien mira, para «hace cuánto»
    // y como tope de lo creíble: un en más de 24 h por delante no cuenta (fila con futura:true, sin
    // latido). Las edades (sin latido) se miden contra el en creíble más nuevo; «abierta más de 24 h» con
    // las dos horas del mismo equipo (ultimoMs - cargadaMs).
    function resumen(sesiones, publicadas, ahoraMs, t) {
        var T = tiemposDe(t), ahora = esNum(ahoraMs) ? ahoraMs : Date.now(), lim = limiteEn(ahora, T), pub = {}, i;
        for (i = 0; i < APPS.length; i++) pub[APPS[i]] = esObj(publicadas) ? entero(publicadas[APPS[i]]) : 0;
        var res = { filas: [], porApp: {}, total: 0, vivas: 0, viejas: 0, viejasVivas: 0, sinLatido: 0, abiertas24: 0,
            enMasNuevo: null, publicadas: pub, ahoraMs: ahora };
        for (i = 0; i < APPS.length; i++) res.porApp[APPS[i]] = { total: 0, viejas: 0, sinLatido: 0, abiertas24: 0 };
        try {
            var ks = clavesDe(sesiones), ref = enMasNuevo(sesiones, lim);
            res.enMasNuevo = ref;
            for (i = 0; i < ks.length; i++) {
                var k = ks[i], e = esObj(sesiones[k]) ? sesiones[k] : {};
                var app = unaLinea(e.app).toUpperCase().slice(0, 12) || '?';
                var v = entero(e.v), publicada = hasOwn(pub, app) ? pub[app] : 0;
                var en = enCreible(e, lim), futura = en === null && msDe(e.en) !== null;
                var ult = esNum(e.ultimoMs) ? e.ultimoMs : null, carg = esNum(e.cargadaMs) ? e.cargadaMs : null;
                var vieja = (publicada > 0 && v < publicada) || e.vieja === true;
                var abierta24 = ult !== null && carg !== null && (ult - carg) > T.edad24Ms;
                var sinLatido = en === null || ref === null || (ref - en) > T.sinLatidoMs;
                var haceMs = en !== null ? Math.max(0, ahora - en) : null;
                var abiertaMs = ult !== null && carg !== null ? Math.max(0, ult - carg) : null;
                res.filas.push({
                    clave: str(k).slice(0, 60), app: app, nombreApp: hasOwn(NOMBRE_APP, app) ? NOMBRE_APP[app] : app,
                    v: v, publicada: publicada, vieja: vieja, abierta24: abierta24, sinLatido: sinLatido, futura: futura,
                    nombre: unaLinea(e.nombre).slice(0, 64), rol: unaLinea(e.rol).slice(0, 24),
                    disp: e.disp === 'celular' || e.disp === 'pc' ? e.disp : '',
                    local: e.local === true, visible: e.visible !== false, recarga: unaLinea(e.recarga).slice(0, 24),
                    n: entero(e.n), sesion: unaLinea(e.sesion).slice(0, 40), equipo: unaLinea(e.equipo).slice(0, 40),
                    enMs: en, ultimoMs: ult, cargadaMs: carg, haceMs: haceMs, abiertaMs: abiertaMs,
                    hace: haceMs === null ? 'sin dato' : 'hace ' + duracion(haceMs),
                    abiertaHace: abiertaMs === null ? '' : duracion(abiertaMs)
                });
                res.total++;
                if (!sinLatido) res.vivas++;
                if (vieja) res.viejas++;
                if (vieja && !sinLatido) res.viejasVivas++;
                if (sinLatido) res.sinLatido++;
                if (abierta24) res.abiertas24++;
                if (!hasOwn(res.porApp, app)) res.porApp[app] = { total: 0, viejas: 0, sinLatido: 0, abiertas24: 0 };
                var pa = res.porApp[app];
                pa.total++; if (vieja) pa.viejas++; if (sinLatido) pa.sinLatido++; if (abierta24) pa.abiertas24++;
            }
            // Primero las viejas, después las que laten, las de más de 24 h, por app y la más reciente arriba.
            res.filas.sort(function (a, b) {
                if (a.vieja !== b.vieja) return a.vieja ? -1 : 1;
                if (a.sinLatido !== b.sinLatido) return a.sinLatido ? 1 : -1;
                if (a.abierta24 !== b.abierta24) return a.abierta24 ? -1 : 1;
                var ia = APPS.indexOf(a.app), ib = APPS.indexOf(b.app);
                if (ia < 0) ia = 99; if (ib < 0) ib = 99;
                if (ia !== ib) return ia - ib;
                var ea = a.enMs === null ? -Infinity : a.enMs, eb = b.enMs === null ? -Infinity : b.enMs;
                if (ea !== eb) return ea > eb ? -1 : 1;
                return a.clave < b.clave ? -1 : (a.clave > b.clave ? 1 : 0);
            });
        } catch (e2) {}
        return res;
    }

    function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }
    // «N pantallas abiertas · M con versión vieja · K sin latido hace más de 15 min»
    function textoResumen(res) {
        var r = esObj(res) ? res : {};
        return plural(entero(r.total), 'pantalla abierta', 'pantallas abiertas') + ' · ' + entero(r.viejas) + ' con versión vieja · '
            + entero(r.sinLatido) + ' sin latido hace más de 15 min';
    }

    var COLOR = {
        vieja: 'rgba(220,38,38,.16)',          // rojo
        abierta24: 'rgba(245,158,11,.20)',     // ámbar
        sinLatido: 'rgba(128,128,128,.18)'     // gris
    };
    var CHIP = 'display:inline-block;max-width:100%;white-space:normal;padding:1px 6px;margin:1px 2px 1px 0;border-radius:9px;font-size:11px;';
    function chip(texto, fondo) { return '<span class="pvPantChip" style="' + CHIP + 'background:' + fondo + '">' + esc(texto) + '</span>'; }

    // El HTML del panel. TODO lo que viene del documento pasa por esc(). Cabe en 375 px: la tabla es de
    // ancho fijo al 100 % y los textos se parten; si algo no cupiera, se desplaza dentro de su recuadro.
    // opciones (opcional): { max } (filas como mucho; 400 por defecto).
    function htmlPanel(res, opciones) {
        try {
            var o = esObj(opciones) ? opciones : {}, r = esObj(res) ? res : {};
            var filas = Array.isArray(r.filas) ? r.filas : [];
            var max = entero(o.max) || 400, i;
            var h = '<div class="pvPantallas" style="max-width:100%;min-width:0;box-sizing:border-box;font-size:13px;line-height:1.35;overflow-wrap:anywhere">';
            if (r.error) {
                h += '<div class="pvPantError" style="padding:8px 10px;border-radius:8px;background:' + COLOR.vieja + ';margin-bottom:8px">⚠️ ' + esc(r.error) + '</div>';
            } else {
                h += '<div class="pvPantResumen" style="font-weight:600;margin-bottom:6px">' + esc(textoResumen(r)) + '</div>';
            }
            var pub = esObj(r.publicadas) ? r.publicadas : {}, partes = [];
            for (i = 0; i < APPS.length; i++) if (entero(pub[APPS[i]]) > 0) partes.push(NOMBRE_APP[APPS[i]] + ' v' + entero(pub[APPS[i]]));
            if (partes.length) h += '<div class="pvPantPublicadas" style="font-size:12px;opacity:.85;margin-bottom:6px">Publicadas: ' + esc(partes.join(' · ')) + '</div>';
            if (r.versionesError) h += '<div class="pvPantAviso" style="font-size:12px;margin-bottom:6px">⚠️ No se pudieron leer las versiones publicadas: «versión vieja» solo sale si la pantalla ya lo sabía.</div>';
            if (entero(r.podadas) > 0) {
                // r.futuras: cuántas de las podadas tenían la hora imposible (las quita el panel, con futuras)
                var nFut = Math.min(entero(r.podadas), entero(r.futuras)), nEdad = entero(r.podadas) - nFut;
                var txtFut = nFut ? plural(nFut, 'registro', 'registros') + ' con una hora imposible (más de un día en el futuro)' : '';
                h += '<div class="pvPantPoda" style="font-size:12px;opacity:.85;margin-bottom:6px">'
                    + esc(r.podaOk === false ? 'Hay ' + plural(entero(r.podadas), 'registro', 'registros') + (nFut ? ' de más de un día sin latido o con una hora imposible' : ' de más de un día sin latido') + '; no se pudieron quitar ahora.'
                        : 'Se quitaron ' + (nEdad ? plural(nEdad, 'registro', 'registros') + ' de pantallas sin latido hace más de un día' + (nFut ? ' y ' : '') : '') + txtFut + '.') + '</div>';
            }
            if (!filas.length) {
                if (!r.error) h += '<div class="pvPantVacio" style="padding:8px 0;opacity:.85">Ninguna pantalla ha enviado latido todavía.</div>';
            } else {
                var td = 'padding:6px 4px;border-top:1px solid rgba(128,128,128,.25);vertical-align:top;text-align:left;word-break:break-word;overflow-wrap:anywhere;';
                var th = 'padding:4px;text-align:left;font-size:11px;font-weight:700;opacity:.8;';
                h += '<div class="pvPantMarco" style="overflow-x:auto;max-width:100%">'
                    + '<table class="pvPantTabla" style="width:100%;max-width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px">'
                    + '<thead><tr><th style="' + th + 'width:24%">Pantalla</th><th style="' + th + 'width:28%">Quién</th>'
                    + '<th style="' + th + 'width:27%">Estado</th><th style="' + th + 'width:21%">Latido</th></tr></thead><tbody>';
                for (i = 0; i < filas.length && i < max; i++) {
                    var f = esObj(filas[i]) ? filas[i] : {};
                    var marcas = [], clases = 'pvPantFila', fondo = '';
                    if (f.vieja) { marcas.push('vieja'); clases += ' pvPantVieja'; }
                    if (f.abierta24) { marcas.push('abierta24'); clases += ' pvPant24'; }
                    if (f.sinLatido) { marcas.push('sinLatido'); clases += ' pvPantSinLatido'; }
                    if (!marcas.length) { marcas.push('ok'); clases += ' pvPantOk'; }
                    fondo = f.vieja ? COLOR.vieja : (f.abierta24 ? COLOR.abierta24 : (f.sinLatido ? COLOR.sinLatido : ''));
                    var estilo = (fondo ? 'background:' + fondo + ';' : '') + (f.sinLatido && !f.vieja && !f.abierta24 ? 'opacity:.75;' : '');
                    var app = hasOwn(NOMBRE_APP, f.app) ? NOMBRE_APP[f.app] : str(f.nombreApp || f.app || '?');
                    var ver = 'v' + entero(f.v) + (f.vieja && entero(f.publicada) > 0 ? ' (publicada v' + entero(f.publicada) + ')' : '');
                    var quien = [str(f.rol), str(f.disp), f.local ? 'copia local' : ''].filter(function (x) { return !!x; }).join(' · ');
                    var chips = '';
                    if (f.vieja) chips += chip('🔴 Versión vieja', COLOR.vieja);
                    if (f.abierta24) chips += chip('🟠 Más de 24 h', COLOR.abierta24);
                    if (f.sinLatido) chips += chip('⚪ Sin latido', COLOR.sinLatido);
                    if (f.futura) chips += chip('⚠️ Hora imposible (más de un día en el futuro)', COLOR.sinLatido);
                    if (!f.vieja && !f.abierta24 && !f.sinLatido) chips += chip('🟢 Al día', 'rgba(22,163,74,.16)');
                    if (f.visible === false && !f.sinLatido) chips += chip('Oculta', 'rgba(128,128,128,.12)');
                    if (f.recarga && f.recarga !== 'inactivo') chips += chip('🔄 ' + str(f.recarga), 'rgba(59,130,246,.15)');
                    h += '<tr class="' + clases + '" data-clave="' + esc(f.clave) + '" data-estado="' + esc(marcas.join(' ')) + '"' + (estilo ? ' style="' + estilo + '"' : '') + '>'
                        + '<td style="' + td + '"><b>' + esc(app) + '</b><br>' + esc(ver) + '</td>'
                        + '<td style="' + td + '">' + (esc(f.nombre) || '—') + (quien ? '<br><small style="opacity:.8">' + esc(quien) + '</small>' : '') + '</td>'
                        + '<td style="' + td + '">' + chips + '</td>'
                        + '<td style="' + td + '">' + esc(f.hace || 'sin dato') + (f.abiertaHace ? '<br><small style="opacity:.8">abierta ' + esc(f.abiertaHace) + '</small>' : '') + '</td>'
                        + '</tr>';
                }
                h += '</tbody></table></div>';
                if (filas.length > max) h += '<div class="pvPantMas" style="font-size:12px;opacity:.85;margin-top:4px">' + esc('…y ' + (filas.length - max) + ' más.') + '</div>';
            }
            h += '<div class="pvPantLeyenda" style="font-size:11px;opacity:.85;margin-top:6px">' + esc('🔴 versión vieja · 🟠 abierta más de 24 h sin recargar · ⚪ sin latido hace más de 15 min (cerrada, o el celular la dejó en pausa)') + '</div>';
            h += '<div class="pvPantNota" style="font-size:11px;opacity:.85;margin-top:4px">' + esc(NOTA) + '</div>';
            return h + '</div>';
        } catch (e) {
            return '<div class="pvPantallas"><div class="pvPantNota">' + esc(NOTA) + '</div></div>';
        }
    }

    // ── Estado de la pantalla ───────────────────────────────────────
    var S = {
        op: null, iniciado: false, detenido: false,
        clave: '', n: 0, ultimoOk: 0, ultimoError: '', ultimoIntento: 0,
        enCurso: false, podaHecha: false, podadas: 0, tmr: null, equipo: null, escuchas: false,
        panel: null, panelProm: null
    };
    function valorDe(o, nombre) { return o ? o[nombre] : undefined; }
    function flagDe(o, nombre) {
        try { var x = valorDe(o, nombre); return typeof x === 'function' ? !!x() : !!x; }
        catch (e) { return nombre === 'modoPrueba'; }     // ante la duda, una pantalla de prueba no escribe
    }
    function flag(nombre) { return flagDe(S.op, nombre); }
    // Tiempos en uso: los de TIEMPOS, o los del banco de pruebas SOLO en una copia local.
    function tiempos(o) {
        var t = tiemposDe(null), k;
        for (k in INTERNOS) if (hasOwn(INTERNOS, k)) t[k] = INTERNOS[k];
        if (!flagDe(o === undefined ? S.op : o, 'entornoLocal')) return t;
        try {
            var p = global.__PV_LATIDO_PRUEBA;
            if (p && typeof p === 'object') for (k in t) if (hasOwn(t, k) && esNum(p[k]) && p[k] >= 0) t[k] = p[k];
        } catch (e) {}
        t.tope = Math.max(1, Math.floor(t.tope));
        return t;
    }
    function aLaVista() {
        try {
            var d = global.document;
            if (!d) return true;
            if (typeof d.visibilityState === 'string') return d.visibilityState !== 'hidden';
            return !d.hidden;
        } catch (e) { return true; }
    }
    function enLinea() {
        try { return !(global.navigator && global.navigator.onLine === false); } catch (e) { return true; }
    }
    function cargadaMs() {
        try {
            var c = valorDe(S.op, 'cargadaMs');
            if (typeof c === 'function') c = c();
            if (esNum(c) && c > 0) return Math.floor(c);
        } catch (e) {}
        return CARGA_MS;
    }
    // Este navegador: localStorage['pv_equipo_id'], 'eq_' + 10, el mismo de la Etapa 1 (lo comparten
    // las cuatro apps del mismo navegador). Si no hay, se crea con ese formato; si el navegador no deja
    // guardarlo, uno al azar por carga ('eqx_').
    function equipoId() {
        if (S.equipo) return S.equipo;
        try {
            var ls = global.localStorage;
            var v = ls ? ls.getItem(K_EQUIPO) : null;
            if (typeof v === 'string' && RE_EQUIPO.test(v)) { S.equipo = v; return v; }
            v = 'eq_' + azar(10);
            ls.setItem(K_EQUIPO, v);
            if (ls.getItem(K_EQUIPO) === v) { S.equipo = v; return v; }
        } catch (e) {}
        S.equipo = 'eqx_' + azar(10);
        return S.equipo;
    }
    function agente() { try { return global.navigator ? str(global.navigator.userAgent) : ''; } catch (e) { return ''; } }
    function faseRecarga(d) {
        if (typeof d.recarga === 'string') return d.recarga;
        try { var R = global.PV_RECARGA; if (R && typeof R.estado === 'function') return str(R.estado().fase); } catch (e) {}
        return '';
    }
    // Lo que devuelve leer(): el objeto de datos. Si la app pasó la instantánea, se le sacan los datos.
    function datosDe(v) {
        try {
            if (v && typeof v.data === 'function') {
                var ex = typeof v.exists === 'function' ? v.exists() : v.exists;
                return ex === false ? null : v.data();
            }
        } catch (e) { return null; }
        return esObj(v) ? v : null;
    }

    // Llama una función de la app y nunca rechaza: {ok, valor} o {ok:false, error}.
    function llamar(o, nombre, arg) {
        return new Promise(function (listo) {
            try {
                var f = valorDe(o, nombre);
                if (typeof f !== 'function') { listo({ ok: false, error: 'la app no definió ' + nombre }); return; }
                var p = f(arg);
                if (p && typeof p.then === 'function') p.then(function (v) { listo({ ok: true, valor: v }); }, function (e) { listo({ ok: false, error: msg(e) }); });
                else listo({ ok: true, valor: p });
            } catch (e) { listo({ ok: false, error: msg(e) }); }
        });
    }
    // Espera como mucho ms: sin respuesta, se suelta (la escritura puede seguir en la cola del SDK).
    function conTope(prom, ms) {
        return new Promise(function (listo) {
            var hecho = false, h = null;
            function dar(r) {
                if (hecho) return;
                hecho = true;
                if (h !== null) { try { global.clearTimeout(h); } catch (e) {} h = null; }
                listo(r);
            }
            try {
                h = global.setTimeout(function () { h = null; dar({ ok: false, error: 'sin respuesta (¿sin señal?)' }); }, Math.max(1, esNum(ms) ? ms : INTERNOS.esperaMs));
                if (h && typeof h.unref === 'function') h.unref();
            } catch (e) { h = null; }
            prom.then(dar, function (e) { dar({ ok: false, error: msg(e) }); });
        });
    }

    // ── El único temporizador ───────────────────────────────────────
    function cancelar() {
        if (S.tmr !== null) { try { global.clearTimeout(S.tmr); } catch (e) {} S.tmr = null; }
    }
    function programar(ms) {
        cancelar();
        if (!S.op || S.detenido || !S.iniciado) return;
        try {
            S.tmr = global.setTimeout(function () {
                S.tmr = null;
                try { latido(false).then(noop, noop); } catch (e) {}
            }, Math.max(0, esNum(ms) ? ms : 0));
            if (S.tmr && typeof S.tmr.unref === 'function') S.tmr.unref();
        } catch (e) { S.tmr = null; }
    }
    // El turno que toca: cada visibleMs a la vista y cada ocultaMs oculta, contados desde el último intento.
    // Nunca más lejos que cada: si la hora del equipo retrocedió (se corrigió a mano), el último intento
    // quedó «en el futuro» y la cuenta daría días sin latido.
    function siguiente() {
        try {
            if (flag('modoPrueba')) { cancelar(); return; }
            var t = tiempos(), cada = aLaVista() ? t.visibleMs : t.ocultaMs, ahora = Date.now();
            var base = S.ultimoIntento || ahora;
            programar(Math.min(cada, Math.max(0, base + cada - ahora)));
        } catch (e) {}
    }
    // Pasó minEntreMs desde el último intento. Una diferencia negativa (la hora del equipo retrocedió)
    // cuenta como que ya pasó.
    function pasoMinimo(t) {
        var d = Date.now() - S.ultimoIntento;
        return !S.ultimoIntento || d < 0 || d >= t.minEntreMs;
    }

    // Un latido: en el primero de la carga, lee el documento y poda EN EL MISMO set merge.
    // forzado (latir, volver a la vista): no sale si no pasó minEntreMs desde el último intento.
    // Promise<bool> que nunca rechaza; al terminar programa el siguiente turno.
    function latido(forzado) {
        return new Promise(function (listo) {
            try {
                if (!S.op || S.detenido || !S.iniciado) { listo(false); return; }
                if (flag('modoPrueba')) { S.ultimoError = 'modo prueba'; cancelar(); listo(false); return; }
                if (S.enCurso) { listo(false); return; }          // el que está en marcha programa el siguiente
                var t = tiempos();
                if (forzado && !pasoMinimo(t)) { siguiente(); listo(false); return; }
                S.ultimoIntento = Date.now();
                if (!enLinea()) { S.ultimoError = 'sin señal'; siguiente(); listo(false); return; }
                var d;
                try {
                    var f = valorDe(S.op, 'datos');
                    d = typeof f === 'function' ? f() : f;
                    if (!esObj(d)) d = {};
                } catch (e) {
                    S.ultimoError = 'no se pudieron leer los datos de esta pantalla: ' + msg(e);
                    siguiente(); listo(false); return;
                }
                S.enCurso = true;
                cancelar();                                        // mientras tanto, ningún temporizador vivo
                var conPoda = !S.podaHecha;
                var lectura = conPoda ? conTope(llamar(S.op, 'leer'), t.esperaMs) : Promise.resolve({ ok: false });
                lectura.then(function (lect) {
                    var borrar = [];
                    var leida = conPoda && lect.ok;
                    if (leida) {
                        var datos = datosDe(lect.valor);
                        borrar = podar(datos && datos.sesiones, S.clave, t);
                    }
                    var ent = entrada({
                        app: valorDe(S.op, 'app'), v: d.v, rol: d.rol, nombre: d.nombre, persona: d.persona,
                        sesion: d.sesion, equipo: equipoId(), disp: dispositivo(agente()), cargadaMs: cargadaMs(),
                        vieja: d.vieja, local: flag('entornoLocal'), visible: aLaVista(), recarga: faseRecarga(d), n: S.n + 1
                    }, Date.now());
                    var parche = armarParche(S.clave, ent, borrar);
                    return conTope(llamar(S.op, 'escribir', parche), t.esperaMs).then(function (r) {
                        if (r.ok) {
                            S.n = ent.n; S.ultimoOk = Date.now(); S.ultimoError = '';
                            if (leida) { S.podaHecha = true; S.podadas += borrar.length; }
                            return true;
                        }
                        S.ultimoError = r.error === 'modo prueba' ? 'modo prueba' : 'no se pudo enviar el latido: ' + r.error;
                        return false;
                    });
                }).then(function (ok) {
                    S.enCurso = false; siguiente(); listo(!!ok);
                }, function (e) {
                    S.enCurso = false; S.ultimoError = 'no se pudo enviar el latido: ' + msg(e); siguiente(); listo(false);
                });
            } catch (e) {
                S.enCurso = false; S.ultimoError = 'no se pudo enviar el latido: ' + msg(e);
                try { siguiente(); } catch (x) {}
                listo(false);
            }
        });
    }

    // ── Eventos del navegador ───────────────────────────────────────
    function alCambiarVista() {
        try {
            if (!S.op || S.detenido || !S.iniciado || S.enCurso || flag('modoPrueba')) return;
            if (aLaVista() && pasoMinimo(tiempos())) { programar(0); return; }   // volvió a la vista: uno ya
            siguiente();                                                        // si no, el turno que toca
        } catch (e) {}
    }
    function alVolverRed() {
        try {
            if (!S.op || S.detenido || !S.iniciado || S.enCurso || flag('modoPrueba') || !S.ultimoError) return;
            var d = Date.now() - S.ultimoOk;                                    // negativa: la hora retrocedió, ya pasó
            if (!S.ultimoOk || d < 0 || d >= tiempos().minEntreMs) programar(0);
        } catch (e) {}
    }
    function escuchar() {
        if (S.escuchas) return;
        S.escuchas = true;
        try { var d = global.document; if (d && typeof d.addEventListener === 'function') d.addEventListener('visibilitychange', alCambiarVista); } catch (e) {}
        try {
            if (typeof global.addEventListener === 'function') {
                global.addEventListener('online', alVolverRed);
                global.addEventListener('pageshow', alCambiarVista);   // vuelve de la caché de retroceso
            }
        } catch (e) {}
    }

    // ── API en ejecución ────────────────────────────────────────────
    function estado() {
        return {
            clave: S.clave, n: S.n, ultimoOk: S.ultimoOk, ultimoError: S.ultimoError,
            iniciado: S.iniciado && !S.detenido, enCurso: S.enCurso, podaHecha: S.podaHecha, podadas: S.podadas,
            visible: aLaVista()
        };
    }
    function iniciar(op) {
        try {
            if (esObj(op)) S.op = op;                      // otra llamada solo cambia el adaptador
            else if (!S.op) S.op = {};
            if (!S.clave) S.clave = nuevaClave();
            if (flag('modoPrueba')) { S.ultimoError = 'modo prueba'; cancelar(); return estado(); }
            if (S.iniciado && !S.detenido) return estado();   // idempotente: ni otra clave ni otro temporizador
            S.iniciado = true; S.detenido = false;
            escuchar();
            programar(tiempos().primeroMs);                 // el primer latido (con la lectura para podar)
        } catch (e) {}
        return estado();
    }
    function latir() {
        try { return latido(true); } catch (e) { return Promise.resolve(false); }
    }
    function detener() {
        try { S.detenido = true; cancelar(); } catch (e) {}
        return estado();
    }
    function ultimoPanel() { return S.panel ? { res: S.panel.res, ms: S.panel.ms } : null; }

    // El panel del administrador: 1 lectura del documento y las de versión. Las entradas viejas (podar) y
    // las de hora imposible (futuras) se quitan del resumen y, salvo en modo prueba, de la nube con un
    // set merge de solo marcas {__del:1}.
    // Promise<resumen> que nunca rechaza; si la lectura falla, el resumen trae error (en español).
    function leerPanel(opArg) {
        if (S.panelProm) return S.panelProm;
        var o = esObj(opArg) ? opArg : (S.op || {});
        var cerrado = false;
        var prom = new Promise(function (listo) {
            function fin(res) {
                if (cerrado) return;
                cerrado = true;
                S.panel = { res: res, ms: Date.now() };
                S.panelProm = null;
                listo(res);
            }
            try {
                var t = tiempos(o);
                var pVer = typeof valorDe(o, 'leerVersiones') === 'function' ? conTope(llamar(o, 'leerVersiones'), t.esperaMs) : Promise.resolve({ ok: false, error: 'sin versiones' });
                Promise.all([conTope(llamar(o, 'leer'), t.esperaMs), pVer]).then(function (rs) {
                    try {
                        var lect = rs[0], ver = rs[1], pub = ver.ok && esObj(ver.valor) ? ver.valor : null;
                        if (!lect.ok) {
                            var r0 = resumen(null, pub, Date.now(), t);
                            r0.error = 'No se pudo leer la lista de pantallas (' + lect.error + '). Revisa la señal e intenta otra vez.';
                            r0.versionesError = !pub; r0.podadas = 0; r0.podaOk = null;
                            fin(r0); return;
                        }
                        var datos = datosDe(lect.valor);
                        var ses = datos && esObj(datos.sesiones) ? datos.sesiones : {}, ahora = Date.now();
                        var borrar = podar(ses, S.clave || '', t, ahora), quedan = {}, ks = clavesDe(ses), i;
                        // además, las de hora imposible (escritas desde internet): solo el panel las quita
                        var fut = futuras(ses, S.clave || '', t, ahora);
                        for (i = 0; i < fut.length; i++) if (borrar.indexOf(fut[i]) < 0) borrar.push(fut[i]);
                        for (i = 0; i < ks.length; i++) if (borrar.indexOf(ks[i]) < 0) quedan[ks[i]] = ses[ks[i]];
                        var res = resumen(quedan, pub, ahora, t);
                        res.versionesError = !pub; res.podadas = borrar.length; res.futuras = fut.length; res.podaOk = null;
                        if (!borrar.length) { fin(res); return; }
                        if (flagDe(o, 'modoPrueba')) { res.podaOk = false; res.podaNota = 'modo prueba: no se quitó nada'; fin(res); return; }
                        var parche = armarParche('', null, borrar);
                        if (!parche) { fin(res); return; }
                        conTope(llamar(o, 'escribir', parche), t.esperaMs).then(function (w) {
                            res.podaOk = !!w.ok;
                            if (!w.ok) res.podaError = w.error;
                            fin(res);
                        }, function () { res.podaOk = false; fin(res); });
                    } catch (e1) {
                        var r1 = resumen(null, null, Date.now(), t);
                        r1.error = 'No se pudo armar la lista de pantallas (' + msg(e1) + ').';
                        fin(r1);
                    }
                }, function (e2) {
                    var r2 = resumen(null, null, Date.now(), t);
                    r2.error = 'No se pudo leer la lista de pantallas (' + msg(e2) + ').';
                    fin(r2);
                });
            } catch (e) {
                var r3 = resumen(null, null, Date.now());
                r3.error = 'No se pudo leer la lista de pantallas (' + msg(e) + ').';
                fin(r3);
            }
        });
        if (!cerrado) S.panelProm = prom;                  // si ya terminó (sin esperar a nadie), no queda «en curso»
        return prom;
    }

    var PV_PANTALLAS = {
        version: VERSION, TIEMPOS: TIEMPOS, NOTA: NOTA, APPS: APPS,
        nuevaClave: nuevaClave, claveValida: claveValida, primerNombre: primerNombre, dispositivo: dispositivo,
        entrada: entrada, msDe: msDe, podar: podar, futuras: futuras, armarParche: armarParche, traducir: traducir,
        resumen: resumen, textoResumen: textoResumen, htmlPanel: htmlPanel,
        iniciar: iniciar, latir: latir, estado: estado, leerPanel: leerPanel, ultimoPanel: ultimoPanel,
        detener: detener, equipoId: equipoId
    };
    try { global.PV_PANTALLAS = PV_PANTALLAS; } catch (e) {}
    if (typeof module !== 'undefined' && module && module.exports) module.exports = PV_PANTALLAS;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
