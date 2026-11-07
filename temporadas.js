// ═══════════════════════════════════════════════════════════════
// 🎉 ADORNOS DE CADA MES (TEMPORADAS) · PROYECTOVISION — código compartido
//
// Lo cargan OFICINAS, INVENTARIO, TÉCNICOS y RED con
//     <script src="temporadas.js?v=N"></script>
// UNA sola copia. REGLA: se edita temporadas.js, NUNCA se copia dentro de un HTML.
// Al cambiarlo hay que subir el ?v= en las CUATRO apps (el mismo número en
// todas), o los navegadores siguen con la copia vieja en caché.
// Si este archivo no carga (sin señal al abrir la app), la app sigue igual, sin adornos.
//
// Para qué (6 nov 2026, idea de Elkin): que el programa se adorne solo con la
// celebración de cada mes. Mientras dura la temporada: una línea de colores bajo
// el encabezado, un adorno sobre el logo y, en el Inicio de OFICINAS e
// INVENTARIO, una franja con una frase. El día exacto de la celebración, además,
// al entrar caen emojis unos segundos (una vez al día en cada equipo y app) y el
// saludo de bienvenida trae la frase del día.
//
// SOLO ADORNA. No lee ni escribe datos del negocio, no tapa clics
// (pointer-events:none), no sale al imprimir y no se anima si el equipo pide
// «reducir movimiento». Este archivo no conoce Firebase.
//
// EL INTERRUPTOR: oficinas_sistema/temporadas = { apagado:bool, porNombre, enMs }.
// Lo escribe SOLO el administrador desde OFICINAS (⚙️ Administración). Las cuatro
// apps lo leen UNA vez al entrar con la función op.leer que pasan (sin documento,
// sin señal o con error → encendido; si la conexión aún no está lista, op.leer
// lanza un error y se reintenta 3 veces cada 5 s). El último estado leído queda en
// el equipo (localStorage 'pv_temp_estado'), porque el saludo sale antes de que llegue.
// LA LLUVIA espera: a esa lectura (o que se agoten los intentos: entonces vale lo del
// equipo), a que la pantalla esté a la vista y a que haya alguien delante (un toque,
// una tecla o volver a la pestaña en los últimos 20 s; si no, el siguiente). Así no
// cae después de que el administrador los apagó, ni en una pestaña escondida, ni en
// una recarga sola o a medianoche sin nadie. El día cuenta como «ya llovió» solo si
// la lluvia estuvo 1,5 s en pantalla: si el toque que la soltó era «Salir», F5 o
// «Actualizar ahora», no se gasta. Si se agotaron los intentos de leer, se vuelve a
// leer cuando vuelve la señal ('online').
//
// UNA PANTALLA QUE PASA LA NOCHE ABIERTA: cada minuto, y al volver a la pestaña, se
// mira si cambió el día. Si cambió, se vuelve a leer el interruptor (una lectura al
// día) y, si cambió la celebración, se cambian la línea, el adorno y la franja del
// Inicio si sigue a la vista.
//
// AL SALIR (cerrar sesión) cada app llama detener(): se quitan los adornos y la lluvia
// no se gasta en la pantalla de entrada; cae cuando alguien vuelva a entrar. Una lectura
// del interruptor que llegue después de «Salir» ya no cuenta.
//
// EL CALENDARIO (CALENDARIO, abajo) es el de Colombia. Cada temporada: id, nombre,
// colores (c1, c2), adorno (va sobre el logo), guirnalda (va en la franja), lo que
// cae el día especial (caen), el rango de fechas (rango) y sus días especiales
// (dias). Las fechas que se mueven (Día de la Madre, del Padre, del Niño, Amor y
// Amistad) se calculan cada año. Para agregar una fecha propia (el aniversario de
// la empresa, por ejemplo) se agrega una entrada. Si dos temporadas se cruzan,
// gana la que tenga hoy su día especial; si ninguna, la primera de la lista.
// Noviembre no tiene temporada: el programa se ve como siempre.
// Ojo con los emojis: Windows no dibuja banderas (🇨🇴 sale como «CO»); no usarlas.
//
// VISTA PREVIA: con ?temporada=<id> en la dirección (por ejemplo ?temporada=navidad)
// esa pantalla se ve como el día especial de esa temporada, sin guardar nada.
// Administración (OFICINAS) trae lo mismo con un botón.
//
// API (window.PV_TEMPORADAS):
//   iniciar(op)     op = { app, cabecera, ancla, anclaLado:'izq'|'der', leer }. cabecera y
//                   ancla: elemento, selector o función que lo devuelve. Se puede llamar
//                   otra vez (otra sesión en la misma pestaña): no duplica nada.
//   franja(cont)    pone la franja al principio de cont (el Inicio); sin temporada, nada.
//   fraseDelDia()   la frase del día especial, o '' (para el saludo de bienvenida).
//   para(fecha)     → { id, nombre, dia, c1, c2, adorno, guirnalda, caen, frase, fraseDia } o null. Pura.
//   vistaPrevia(id) muestra esa temporada en esta pantalla, sin guardar ('' = volver a la de hoy).
//   fijarApagado(b) aplica el interruptor en esta pantalla (OFICINAS lo llama al cambiarlo).
//   quitar()        quita todos los adornos de esta pantalla.
//   detener()       al cerrar sesión: quita todo y no hace nada hasta el próximo iniciar().
//   estado()        { iniciado, app, id, dia, apagado, vista, leido, confirmado, lluviaPendiente, esperaAlguien }
//   CALENDARIO
// ═══════════════════════════════════════════════════════════════
(function (global) {
    'use strict';
    if (global.PV_TEMPORADAS) return;
    var doc = global.document;

    // ── Fechas ──
    function f(a, m, d) { return new Date(a, m - 1, d); }
    function mas(fecha, dias) { return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + dias); }
    // n-ésimo día de la semana del mes (diaSemana: 0 = domingo … 6 = sábado)
    function nEsimo(a, m, diaSemana, n) {
        var primero = new Date(a, m - 1, 1), salto = (diaSemana - primero.getDay() + 7) % 7;
        return new Date(a, m - 1, 1 + salto + 7 * (n - 1));
    }
    // último día de la semana del mes (el Día del Niño es el último sábado de abril)
    function ultimo(a, m, diaSemana) {
        var fin = new Date(a, m, 0), salto = (fin.getDay() - diaSemana + 7) % 7;
        return new Date(a, m - 1, fin.getDate() - salto);
    }
    function mismoDia(x, y) { return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); }
    function soloFecha(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
    function claveMD(d) { return (d.getMonth() + 1) + '-' + d.getDate(); }
    function claveDia(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

    var CALENDARIO = [
        { id: 'anio_nuevo', nombre: 'Año nuevo', c1: '#f59e0b', c2: '#3b82f6', adorno: '🎆', guirnalda: '🎆 ✨ 🥂 🎉 🎆', caen: ['🎆', '✨', '🎉', '🥂'],
          rango: function (a) { return [f(a, 1, 1), f(a, 1, 6)]; }, dias: function (a) { return [f(a, 1, 1)]; },
          frase: '¡Feliz año nuevo! Que este año la red no se caiga y la caja siempre cuadre.',
          fraseDia: '¡Feliz año nuevo, equipo! Arrancamos con toda. 🎆' },
        { id: 'regreso_clases', nombre: 'Regreso a clases', c1: '#3b82f6', c2: '#facc15', adorno: '🎒', guirnalda: '🎒 ✏️ 📚 📐 🎒', caen: ['✏️', '📚', '🎒', '📐'],
          rango: function (a) { return [f(a, 1, 19), f(a, 2, 6)]; }, dias: function () { return []; },
          frase: 'Regreso a clases: los estudiantes necesitan buen internet. ¡A ofrecer planes!', fraseDia: '' },
        { id: 'san_valentin', nombre: 'San Valentín', c1: '#ec4899', c2: '#ef4444', adorno: '💘', guirnalda: '💘 🌹 💌 💝 💘', caen: ['💘', '🌹', '💌', '💝'],
          rango: function (a) { return [f(a, 2, 10), f(a, 2, 14)]; }, dias: function (a) { return [f(a, 2, 14)]; },
          frase: 'Semana de San Valentín: que el internet también llegue con amor.',
          fraseDia: '¡Feliz San Valentín! 💘' },
        { id: 'mujer', nombre: 'Día de la Mujer', c1: '#a855f7', c2: '#ec4899', adorno: '💜', guirnalda: '💜 🌷 🌸 💐 💜', caen: ['💜', '🌷', '🌸', '💐'],
          rango: function (a) { return [f(a, 3, 1), f(a, 3, 8)]; }, dias: function (a) { return [f(a, 3, 8)]; },
          frase: 'Marzo, mes de la mujer: gracias a todas las que hacen grande a PROYECTOVISION.',
          fraseDia: '¡Feliz Día de la Mujer a todas las que hacen grande a PROYECTOVISION! 💜' },
        { id: 'nino', nombre: 'Día del Niño', c1: '#22c55e', c2: '#f59e0b', adorno: '🎈', guirnalda: '🎈 🧸 🪁 🎠 🎈', caen: ['🎈', '🧸', '⭐', '🎈'],
          rango: function (a) { var d = ultimo(a, 4, 6); return [mas(d, -6), d]; }, dias: function (a) { return [ultimo(a, 4, 6)]; },
          frase: 'Semana de los niños: que en cada casa haya buena señal para estudiar y jugar.',
          fraseDia: '¡Feliz Día del Niño a los niños de nuestras familias y de nuestros clientes! 🎈' },
        { id: 'trabajo', nombre: 'Día del Trabajo', c1: '#10b981', c2: '#0ea5e9', adorno: '🛠️', guirnalda: '🛠️ 👷 💪 🔧 🛠️', caen: ['🛠️', '💪', '🔧', '⭐'],
          rango: function (a) { return [f(a, 4, 28), f(a, 5, 1)]; }, dias: function (a) { return [f(a, 5, 1)]; },
          frase: 'Semana del trabajo: gracias por cada instalación, cada cobro y cada cliente atendido.',
          fraseDia: '¡Feliz Día del Trabajo! Gracias por cada instalación, cada cobro y cada cliente atendido. 💪' },
        { id: 'madre', nombre: 'Día de la Madre', c1: '#f472b6', c2: '#a855f7', adorno: '💐', guirnalda: '💐 🌸 💖 🌷 💐', caen: ['🌸', '💐', '💖', '🌷'],
          rango: function (a) { return [f(a, 5, 2), nEsimo(a, 5, 0, 2)]; }, dias: function (a) { return [nEsimo(a, 5, 0, 2)]; },
          frase: 'Mayo, mes de las madres: un saludo a todas las mamás del equipo y de nuestros clientes.',
          fraseDia: '¡Feliz Día de la Madre a todas las mamás del equipo y a las de nuestros clientes! 💐' },
        { id: 'padre', nombre: 'Día del Padre', c1: '#0ea5e9', c2: '#1e40af', adorno: '👔', guirnalda: '👔 🔧 💙 ⚽ 👔', caen: ['💙', '👔', '🔧', '⚽'],
          rango: function (a) { var d = nEsimo(a, 6, 0, 3); return [mas(d, -6), d]; }, dias: function (a) { return [nEsimo(a, 6, 0, 3)]; },
          frase: 'Semana del padre: un saludo a todos los papás del equipo.',
          fraseDia: '¡Feliz Día del Padre a todos los papás del equipo! 💙' },
        { id: 'independencia', nombre: 'Día de la Independencia', c1: '#facc15', c2: '#ef4444', adorno: '🎉', guirnalda: '💛 💙 ❤️ 🎉 💛', caen: ['💛', '💙', '❤️', '🎉'],
          rango: function (a) { return [f(a, 7, 15), f(a, 7, 20)]; }, dias: function (a) { return [f(a, 7, 20)]; },
          frase: 'Mes de la patria: orgullosos de conectar al Caquetá.',
          fraseDia: '¡Viva Colombia! Feliz 20 de julio. 💛💙❤️' },
        { id: 'cometas', nombre: 'Mes de las cometas', c1: '#38bdf8', c2: '#f59e0b', adorno: '🪁', guirnalda: '🪁 🌬️ ☀️ 🪁 🌬️', caen: ['🪁', '🌬️', '☀️'],
          rango: function (a) { return [f(a, 8, 1), f(a, 8, 31)]; }, dias: function () { return []; },
          frase: 'Agosto, mes de las cometas: que la señal vuele tan alto como ellas.', fraseDia: '' },
        { id: 'amor_amistad', nombre: 'Amor y Amistad', c1: '#f43f5e', c2: '#facc15', adorno: '💛', guirnalda: '💛 🤝 🎁 ❤️ 💛', caen: ['💛', '❤️', '🎁', '🤝'],
          rango: function (a) { return [f(a, 9, 1), nEsimo(a, 9, 6, 3)]; }, dias: function (a) { return [nEsimo(a, 9, 6, 3)]; },
          frase: 'Septiembre, mes del amor y la amistad: gracias por el buen equipo que somos.',
          fraseDia: '¡Feliz Día del Amor y la Amistad! Gracias por el buen equipo que somos. 💛' },
        { id: 'halloween', nombre: 'Halloween', c1: '#f97316', c2: '#8b5cf6', adorno: '🎃', guirnalda: '🎃 🦇 👻 🕸️ 🎃', caen: ['🎃', '🦇', '👻', '🕸️'],
          rango: function (a) { return [f(a, 10, 1), f(a, 10, 31)]; }, dias: function (a) { return [f(a, 10, 31)]; },
          frase: '¡Octubre de Halloween! Que los únicos sustos sean de disfraz y no de la red.',
          fraseDia: '¡Feliz Halloween y feliz día de los niños! 🎃' },
        { id: 'navidad', nombre: 'Navidad', c1: '#ef4444', c2: '#22c55e', adorno: '🎄', guirnalda: '🎄 ⭐ 🎁 ❄️ 🎄', caen: ['❄️', '⭐', '🎁', '❄️'],
          rango: function (a) { return [f(a, 12, 1), f(a, 12, 25)]; }, dias: function (a) { return [f(a, 12, 7), f(a, 12, 16), f(a, 12, 24), f(a, 12, 25)]; },
          frase: '¡Llegó diciembre! Gracias por todo lo que hicimos este año.',
          fraseDia: '¡Feliz Navidad, equipo! 🎄',
          frasesDia: { '12-7': '¡Feliz Día de las Velitas! Que se encienda la ilusión de diciembre. 🕯️',
                       '12-16': '¡Arrancan las novenas de aguinaldos! 🎄',
                       '12-24': '¡Feliz Nochebuena! 🎄' },
          caenDia: { '12-7': ['🕯️', '✨', '⭐', '🕯️'] } },
        { id: 'fin_de_anio', nombre: 'Fin de año', c1: '#f59e0b', c2: '#a855f7', adorno: '🥂', guirnalda: '🥂 🎆 ✨ 🎉 🥂', caen: ['🎆', '✨', '🎉', '🥂'],
          rango: function (a) { return [f(a, 12, 26), f(a, 12, 31)]; }, dias: function (a) { return [f(a, 12, 31)]; },
          frase: 'Cerramos el año: gracias por cada día de trabajo. ¡Por un año nuevo con toda!',
          fraseDia: '¡Feliz fin de año! Gracias por este año de trabajo. 🥂' }
    ];

    function armar(t, d, esDia) {
        var md = d ? claveMD(d) : '';
        return { id: t.id, nombre: t.nombre, dia: !!esDia, c1: t.c1, c2: t.c2, adorno: t.adorno, guirnalda: t.guirnalda,
                 caen: (esDia && t.caenDia && t.caenDia[md]) || t.caen, frase: t.frase,
                 fraseDia: esDia ? ((t.frasesDia && t.frasesDia[md]) || t.fraseDia || t.frase) : '' };
    }
    // La temporada de una fecha (la hora no importa). Pura: no mira el interruptor ni la pantalla.
    function para(fecha) {
        var d = fecha instanceof Date ? fecha : new Date(fecha);
        if (!d || isNaN(d.getTime())) return null;
        d = soloFecha(d);
        var a = d.getFullYear(), primera = null;
        for (var i = 0; i < CALENDARIO.length; i++) {
            var t = CALENDARIO[i], r = t.rango(a);
            if (d < r[0] || d > r[1]) continue;
            var dias = t.dias(a), esDia = false;
            for (var j = 0; j < dias.length; j++) if (mismoDia(dias[j], d)) esDia = true;
            if (esDia) return armar(t, d, true);
            if (!primera) primera = armar(t, d, false);
        }
        return primera;
    }
    function porId(id) { for (var i = 0; i < CALENDARIO.length; i++) if (CALENDARIO[i].id === id) return CALENDARIO[i]; return null; }
    function temaVista(id) {
        var t = porId(id); if (!t) return null;
        var a = new Date().getFullYear(), dias = t.dias(a);
        return armar(t, dias.length ? dias[dias.length - 1] : t.rango(a)[0], dias.length > 0);
    }
    function idDeLaDireccion() {
        try { var id = new global.URLSearchParams(global.location.search).get('temporada'); return id && porId(id) ? id : ''; } catch (e) { return ''; }
    }

    // ── Estado de esta pantalla ──
    var K_ESTADO = 'pv_temp_estado', K_LLUVIA = 'pv_temp_lluvia_';
    var S = { iniciado: false, app: '', op: null, tema: null, apagado: false, vista: false, leido: false, franjaEn: null, cab: null, posPuesta: false, rz: null, oyeRz: false,
              leyendo: false, confirmado: false, lluviaPend: null, lluviaPendDia: '', diaClave: '', oyeReloj: false,
              franjaAncla: null, oyeClase: false, gen: 0, ultimoGesto: 0 };
    function lsLeer(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }
    function lsPoner(k, v) { try { global.localStorage.setItem(k, v); } catch (e) {} }
    function apagadoGuardado() { try { var o = JSON.parse(lsLeer(K_ESTADO) || 'null'); return !!(o && o.apagado === true); } catch (e) { return false; } }
    function guardarApagado(b) { lsPoner(K_ESTADO, JSON.stringify({ apagado: !!b, ms: Date.now() })); }
    function oculta() { try { return doc.visibilityState === 'hidden'; } catch (e) { return false; } }
    // ¿El navegador entiende :where()? (querySelector lanza un error si no). Si no, la posición de la cabecera
    // se pone en línea y se vuelve a mirar cada vez que cambia la clase del body (el tema diurno/nocturno de RED).
    // __PV_TEMP_SIN_WHERE: solo para las pruebas.
    function hayWhere() { if (global.__PV_TEMP_SIN_WHERE) return false; try { doc.querySelector(':where(body)'); return true; } catch (e) { return false; } }
    function sinMovimiento() { try { return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
    function el(x) { try { if (!x) return null; if (typeof x === 'function') return x() || null; if (typeof x === 'string') return doc.querySelector(x); return x.nodeType === 1 ? x : null; } catch (e) { return null; } }
    function sacar(n) { if (n && n.parentNode) n.parentNode.removeChild(n); }
    function rgba(hex, a) {
        var h = String(hex || '').replace('#', '');
        if (!/^[0-9a-fA-F]{6}$/.test(h)) return 'rgba(0,0,0,' + a + ')';
        return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
    }

    var CSS = [
        ':where(.pv-temp-cab){position:relative;}',
        'body.pv-temporada .pv-temp-cab::after{content:"";position:absolute;left:0;right:0;bottom:-3px;height:3px;background:linear-gradient(90deg,var(--pv-t1),var(--pv-t2),var(--pv-t1));pointer-events:none;z-index:2;}',
        '.pv-temp-adorno{position:absolute;font-size:19px;line-height:1;transform:rotate(-14deg);pointer-events:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45));z-index:3;-webkit-user-select:none;user-select:none;}',
        '.pv-temp-franja{display:flex;align-items:center;gap:12px;margin:0 0 14px;padding:10px 14px;border-radius:12px;font-weight:700;font-size:.86rem;line-height:1.35;pointer-events:none;-webkit-user-select:none;user-select:none;border:1px solid var(--pv-t1b);background:linear-gradient(90deg,var(--pv-t1f),var(--pv-t2f));}',
        '.pv-temp-franja .pv-temp-em{font-size:1.25rem;letter-spacing:3px;white-space:nowrap;}',
        '@media (max-width:700px){.pv-temp-franja{flex-wrap:wrap;gap:6px 12px;}.pv-temp-franja .pv-temp-em{flex-basis:100%;}}',
        '.pv-temp-capa{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:99990;overflow:hidden;}',
        '.pv-temp-capa span{position:absolute;top:-40px;will-change:transform;animation:pvTempCae linear forwards;}',
        '@keyframes pvTempCae{to{transform:translateY(112vh) rotate(240deg);opacity:.15;}}',
        '@media (prefers-reduced-motion: reduce){.pv-temp-capa{display:none;}}',
        '@media print{.pv-temp-capa,.pv-temp-franja,.pv-temp-adorno{display:none!important;}body.pv-temporada .pv-temp-cab::after{display:none!important;}}'
    ].join('\n');
    function ponerCss() {
        if (!doc || doc.getElementById('pvTempCss')) return;
        var s = doc.createElement('style'); s.id = 'pvTempCss'; s.textContent = CSS;
        (doc.head || doc.documentElement).appendChild(s);
    }

    function quitarAdornos() {
        var b = doc && doc.body; if (!b) return;
        b.classList.remove('pv-temporada');
        ['--pv-t1', '--pv-t2', '--pv-t1f', '--pv-t2f', '--pv-t1b'].forEach(function (v) { b.style.removeProperty(v); });
        var cabs = doc.querySelectorAll('.pv-temp-cab');
        for (var i = 0; i < cabs.length; i++) {
            cabs[i].classList.remove('pv-temp-cab');
            if (cabs[i].getAttribute('data-pv-temp-pos') === '1') { cabs[i].style.position = ''; cabs[i].removeAttribute('data-pv-temp-pos'); }
        }
        var otros = doc.querySelectorAll('.pv-temp-adorno, .pv-temp-capa');
        for (var j = 0; j < otros.length; j++) sacar(otros[j]);
        S.cab = null;
    }
    function quitarFranjas() { var fs = doc ? doc.querySelectorAll('.pv-temp-franja') : []; for (var i = 0; i < fs.length; i++) sacar(fs[i]); }

    function ponerAdorno() {
        var viejos = doc.querySelectorAll('.pv-temp-adorno');
        for (var i = 0; i < viejos.length; i++) sacar(viejos[i]);
        var t = S.tema, op = S.op || {}, cab = S.cab, ancla = el(op.ancla);
        if (!t || !cab || !ancla) return;
        var r = ancla.getBoundingClientRect(), rc = cab.getBoundingClientRect();
        if (!r.width && !r.height) return;   // la cabecera todavía está escondida
        var s = doc.createElement('span'); s.className = 'pv-temp-adorno'; s.setAttribute('aria-hidden', 'true'); s.textContent = t.adorno;
        s.style.left = Math.round(r.left - rc.left + (op.anclaLado === 'izq' ? -7 : r.width - 13)) + 'px';
        s.style.top = Math.round(r.top - rc.top - 9) + 'px';
        cab.appendChild(s);
    }

    // Solo sin :where: la cabecera sin posición recibe position:relative en línea, y se vuelve a mirar al cambiar el tema.
    function ajustarPosicion() {
        var cab = S.cab; if (!cab || hayWhere()) return;
        try {
            if (cab.getAttribute('data-pv-temp-pos') === '1') { cab.style.position = ''; cab.removeAttribute('data-pv-temp-pos'); }
            if (global.getComputedStyle(cab).position === 'static') { cab.style.position = 'relative'; cab.setAttribute('data-pv-temp-pos', '1'); }
        } catch (e) {}
    }
    function aplicar(t) {
        quitarAdornos();
        S.tema = t || null;
        if (!t || !doc.body) { quitarFranjas(); return; }
        ponerCss();
        var b = doc.body;
        b.classList.add('pv-temporada');
        b.style.setProperty('--pv-t1', t.c1); b.style.setProperty('--pv-t2', t.c2);
        b.style.setProperty('--pv-t1f', rgba(t.c1, 0.2)); b.style.setProperty('--pv-t2f', rgba(t.c2, 0.16)); b.style.setProperty('--pv-t1b', rgba(t.c1, 0.5));
        var cab = el((S.op || {}).cabecera);
        if (cab) {
            // Antes: un estilo en línea. Con RED en nocturno (cabecera sin posición) quedaba puesto al pasar a diurno
            // y le ganaba a body.light-mode .top{position:absolute}: la tarjeta dejaba de flotar y empujaba el mapa.
            cab.classList.add('pv-temp-cab'); S.cab = cab;
            ajustarPosicion();
        }
        ponerAdorno();   // la franja la pone cada app al pintar su Inicio (franja); aquí no, para que no salga en otra pantalla
        // Al cambiar la clase del body (el tema de RED, por ejemplo) se recoloca el adorno y, sin :where, la posición.
        if (!S.oyeClase && global.MutationObserver) {
            S.oyeClase = true;
            try { new global.MutationObserver(function () { if (!S.tema || !S.cab) return; try { ajustarPosicion(); ponerAdorno(); } catch (e) {} }).observe(b, { attributes: true, attributeFilter: ['class'] }); } catch (e) {}
        }
        if (!S.oyeRz) {
            S.oyeRz = true;
            global.addEventListener('resize', function () { clearTimeout(S.rz); S.rz = setTimeout(function () { try { ponerAdorno(); } catch (e) {} }, 150); });
        }
    }

    // Lluvia de emojis: solo el día especial, una vez al día en cada equipo y app (forzar = vista previa).
    // La marca «ya llovió hoy» se guarda solo si la lluvia estuvo 1,5 s en pantalla, con la pestaña a la vista y la
    // sesión abierta: si el toque que la soltó era «Salir», F5 o «Actualizar ahora», no se gasta y cae otra vez.
    function lluvia(t, forzar) {
        if (!t || !t.dia || !doc.body || sinMovimiento()) return false;
        var k = K_LLUVIA + (S.app || 'app') + '_' + claveDia(new Date());
        if (!forzar && (lsLeer(k) === '1' || doc.querySelector('.pv-temp-capa'))) return false;
        var viejas = doc.querySelectorAll('.pv-temp-capa'); for (var v = 0; v < viejas.length; v++) sacar(viejas[v]);
        var capa = doc.createElement('div'); capa.className = 'pv-temp-capa'; capa.setAttribute('aria-hidden', 'true');
        for (var i = 0; i < 16; i++) {
            var e = doc.createElement('span'); e.textContent = t.caen[i % t.caen.length];
            e.style.left = (Math.random() * 96).toFixed(1) + '%';
            e.style.fontSize = Math.round(16 + Math.random() * 16) + 'px';
            e.style.animationDuration = (3.5 + Math.random() * 3).toFixed(2) + 's';
            e.style.animationDelay = (Math.random() * 1.5).toFixed(2) + 's';
            capa.appendChild(e);
        }
        doc.body.appendChild(capa);
        if (!forzar) {
            var gen = S.gen;
            setTimeout(function () { if (capa.isConnected && S.iniciado && gen === S.gen && !oculta()) lsPoner(k, '1'); }, 1500);
        }
        setTimeout(function () { sacar(capa); }, 8500);
        return true;
    }

    // ¿Hay alguien delante? Un toque, una tecla o volver a la pestaña en los últimos 20 s. Se oye desde que carga la
    // página (también lo que se teclea en la entrada) y en fase de captura (aunque la app corte el evento).
    var RECIENTE_MS = 20000;
    function hayAlguien() { return Date.now() - S.ultimoGesto <= RECIENTE_MS; }
    function oirGestos() {
        if (!doc) return;
        var alguien = function () { S.ultimoGesto = Date.now(); try { intentarLluvia(); } catch (e) {} };
        ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { try { doc.addEventListener(ev, alguien, { capture: true, passive: true }); } catch (e) {} });
        // Volver a la pestaña cuenta como que alguien llegó; y si cambió el día, se pone al día.
        try { doc.addEventListener('visibilitychange', function () { if (oculta()) return; S.ultimoGesto = Date.now(); try { alDia(false); intentarLluvia(); } catch (e) {} }); } catch (e) {}
    }
    // La lluvia de hoy espera: a saber qué dice el interruptor, a que la pantalla esté a la vista y a que haya alguien.
    function pedirLluvia(t) { S.lluviaPend = (t && t.dia) ? t : null; S.lluviaPendDia = claveDia(new Date()); intentarLluvia(); }
    function intentarLluvia() {
        var t = S.lluviaPend; if (!t) return;
        if (!S.iniciado || S.vista || S.apagado || S.lluviaPendDia !== claveDia(new Date())) { S.lluviaPend = null; return; }
        if (!S.confirmado || oculta() || !hayAlguien()) return;
        S.lluviaPend = null; lluvia(t, false);
    }
    // ¿Sigue a la vista el Inicio donde se pintó la franja? Sí, mientras lo primero que tenía siga ahí
    // (al cambiar de pantalla, la app reemplaza ese contenido).
    function inicioALaVista() { var c = S.franjaEn, a = S.franjaAncla; return !!(c && c.isConnected && a && a.parentNode === c); }
    function rehacerFranja() { if (inicioALaVista()) franja(S.franjaEn); }
    function mismoTema(a, b) { return !!(a && b && a.id === b.id && a.dia === b.dia && a.fraseDia === b.fraseDia && String(a.caen) === String(b.caen)); }
    // ¿Cambió el día desde que se calculó la celebración? Entonces se vuelve a calcular.
    // desdeFranja: la llama franja(), que ya pinta la suya (no se rehace aquí).
    function alDia(desdeFranja) {
        if (!S.iniciado || S.vista || !doc || !doc.body) return;
        var k = claveDia(new Date());
        if (k === S.diaClave) return;
        S.diaClave = k;
        // Un día nuevo: se vuelve a leer el interruptor (lo pudieron apagar o encender desde otro equipo).
        S.leido = false; S.confirmado = false; leerInterruptor();
        if (S.apagado) return;
        var hoy = para(new Date());
        if (mismoTema(hoy, S.tema) || (!hoy && !S.tema)) return;
        if (hoy) aplicar(hoy); else { quitarAdornos(); S.tema = null; }
        // La franja del Inicio se rehace si sigue a la vista; si la persona está en otra pantalla, no se pone.
        if (!desdeFranja) rehacerFranja();
        pedirLluvia(hoy);
    }
    function oirReloj() {
        if (S.oyeReloj) return; S.oyeReloj = true;
        try { global.addEventListener('online', function () { if (S.iniciado && !S.leido && !S.leyendo) leerInterruptor(); }); } catch (e) {}
        (function tic() { setTimeout(function () { try { alDia(false); } catch (e) {} tic(); }, 60000); })();
    }

    function franja(cont) {
        var c = el(cont); if (!c || !doc) return;
        alDia(true);
        S.franjaEn = c;
        for (var i = c.children.length - 1; i >= 0; i--) if (c.children[i].classList && c.children[i].classList.contains('pv-temp-franja')) sacar(c.children[i]);
        S.franjaAncla = c.firstElementChild || null;
        var t = S.tema;
        if (!S.iniciado && !t) { t = apagadoGuardado() ? null : para(new Date()); if (t) aplicar(t); }
        if (!t || (S.apagado && !S.vista)) return;
        var d = doc.createElement('div'); d.className = 'pv-temp-franja'; d.setAttribute('aria-hidden', 'true');
        var em = doc.createElement('span'); em.className = 'pv-temp-em'; em.textContent = t.guirnalda;
        var tx = doc.createElement('span'); tx.textContent = (t.dia && t.fraseDia) ? t.fraseDia : t.frase;
        d.appendChild(em); d.appendChild(tx);
        c.insertBefore(d, c.firstChild);
    }

    function fraseDelDia() {
        alDia(false);
        if (S.vista && S.tema) return S.tema.dia ? (S.tema.fraseDia || '') : '';
        if (S.iniciado ? S.apagado : apagadoGuardado()) return '';
        var t = S.tema || para(new Date());
        return t && t.dia ? (t.fraseDia || '') : '';
    }

    function fijarApagado(b) {
        b = !!b; guardarApagado(b);
        var antes = S.apagado; S.apagado = b; S.confirmado = true;
        if (S.vista) { S.lluviaPend = null; return; }   // la vista previa sigue hasta recargar o quitarla
        if (b) { quitarAdornos(); quitarFranjas(); S.tema = null; S.lluviaPend = null; return; }
        if (!S.iniciado) return;                         // sin sesión (la pantalla de entrada) no se pone nada
        var k = claveDia(new Date());
        if (antes || !S.tema || S.diaClave !== k) {
            S.diaClave = k; var hoy = para(new Date());
            if (hoy) { aplicar(hoy); rehacerFranja(); pedirLluvia(hoy); }
        }
        intentarLluvia();
    }

    // S.gen cambia con «Salir» (detener): una lectura que llegue después ya no cuenta.
    function leerInterruptor() {
        if (S.leido || S.leyendo) return;
        var gen = S.gen;
        var listo = function () { if (gen !== S.gen) return; S.leyendo = false; S.confirmado = true; intentarLluvia(); };
        if (typeof (S.op || {}).leer !== 'function') { listo(); return; }
        S.leyendo = true;
        (function intento(n) {
            if (gen !== S.gen) return;
            var p = null;
            try { p = (S.op || {}).leer(); } catch (e) { p = null; }
            // Sin respuesta: se reintenta 3 veces cada 5 s; después vale lo guardado en el equipo.
            var otraVez = function () { if (gen !== S.gen) return; if (n < 3) setTimeout(function () { intento(n + 1); }, 5000); else listo(); };
            if (!p || typeof p.then !== 'function') { otraVez(); return; }
            p.then(function (d) { if (gen !== S.gen) return; S.leyendo = false; S.leido = true; fijarApagado(!!(d && d.apagado === true)); }, otraVez);
        })(0);
    }

    function iniciar(op) {
        if (!doc) return;
        S.op = op || {}; S.app = String(S.op.app || '');
        S.iniciado = true;
        S.apagado = apagadoGuardado(); S.diaClave = claveDia(new Date()); S.lluviaPend = null;
        oirReloj();
        var id = idDeLaDireccion();
        // Con ?temporada=… también se lee el interruptor: la tarjeta dice lo que de verdad hay y «Quitar la vista previa» lo respeta.
        if (id) { S.vista = true; aplicar(temaVista(id)); lluvia(S.tema, true); leerInterruptor(); return; }
        S.vista = false;
        var hoy = S.apagado ? null : para(new Date());
        if (hoy) { aplicar(hoy); pedirLluvia(hoy); } else { quitarAdornos(); quitarFranjas(); S.tema = null; }
        leerInterruptor();
    }

    function vistaPrevia(id) {
        if (!id) {
            S.vista = false; S.diaClave = claveDia(new Date());
            var hoy = S.apagado ? null : para(new Date());
            if (hoy) aplicar(hoy); else { quitarAdornos(); quitarFranjas(); S.tema = null; }
            return S.tema ? S.tema.id : '';
        }
        var t = temaVista(id); if (!t) return '';
        S.vista = true; S.lluviaPend = null; aplicar(t); lluvia(t, true);
        return t.id;
    }

    function quitar() { quitarAdornos(); quitarFranjas(); S.tema = null; }
    // Al cerrar sesión: quita todo, olvida la lluvia pendiente y corta la lectura que vaya en camino (la próxima
    // persona vuelve a leer el interruptor). El reloj sigue, pero no hace nada hasta el próximo iniciar().
    function detener() {
        S.gen++;
        S.iniciado = false; S.vista = false; S.lluviaPend = null;
        S.leido = false; S.leyendo = false; S.confirmado = false; S.franjaEn = null; S.franjaAncla = null;
        quitarAdornos(); quitarFranjas(); S.tema = null;
    }
    function estado() { return { iniciado: S.iniciado, app: S.app, id: S.tema ? S.tema.id : '', dia: !!(S.tema && S.tema.dia), apagado: S.apagado, vista: S.vista,
                                 leido: S.leido, confirmado: S.confirmado, lluviaPendiente: !!S.lluviaPend, esperaAlguien: !!(S.lluviaPend && !hayAlguien()) }; }

    oirGestos();
    global.PV_TEMPORADAS = { iniciar: iniciar, franja: franja, fraseDelDia: fraseDelDia, para: para, vistaPrevia: vistaPrevia,
                             fijarApagado: fijarApagado, quitar: quitar, detener: detener, estado: estado, CALENDARIO: CALENDARIO };
})(typeof window !== 'undefined' ? window : this);
