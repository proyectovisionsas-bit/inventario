/* ════════════════════════════════════════════════════════════════════════════
   🔔 EL RECEPTOR DE AVISOS (service worker) · PROYECTOVISION Inventario
   ────────────────────────────────────────────────────────────────────────────
   Este archivo es lo que permite que el celular reciba una notificación
   aunque la app esté cerrada. Chrome (y Safari, con la app instalada en la
   pantalla de inicio) lo mantiene vivo en segundo plano, y cuando Google le
   entrega un mensaje, aquí se muestra.

   NO toca la app: no guarda páginas, no intercepta nada. Solo recibe avisos.
   El que ENVÍA es el vigilante que corre en el Apps Script del Drive
   (AVISOS_PENDIENTES.gs), con una clave que nunca está en la app.
   ════════════════════════════════════════════════════════════════════════════ */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyDxDOjSzmsSNnULxmzyH2JM80u8AMFpO9w",
    authDomain: "inventario-88a28.firebaseapp.com",
    projectId: "inventario-88a28",
    storageBucket: "inventario-88a28.firebasestorage.app",
    messagingSenderId: "981251888141",
    appId: "1:981251888141:web:85e27f09ec4350c27c7144"
});

const messaging = firebase.messaging();

/* Los avisos llegan con título y texto ya armados, y Google los muestra solo.
   Este gancho queda para los mensajes que vengan sin "notification" (solo
   datos), para que tampoco se pierdan. */
messaging.onBackgroundMessage(function(payload){
    try{
        if(payload && payload.notification) return;   // ya lo mostró el navegador
        const d = (payload && payload.data) || {};
        self.registration.showNotification(d.title || 'PROYECTOVISION', {
            body: d.body || 'Tienes solicitudes pendientes.',
            icon: d.icon || 'icono-192.png',
            data: { link: d.link || './INVENTARIO_PTOVISION.html' }
        });
    }catch(e){}
});

/* Al tocar la notificación se abre la app en la pantalla que corresponde. */
self.addEventListener('notificationclick', function(ev){
    ev.notification.close();
    const link = (ev.notification.data && (ev.notification.data.link || (ev.notification.data.FCM_MSG && ev.notification.data.FCM_MSG.notification && ev.notification.data.FCM_MSG.notification.click_action)))
              || './INVENTARIO_PTOVISION.html';
    ev.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then(function(lista){
        for(const c of lista){ if(c.url.indexOf(link.split('#')[0].split('?')[0]) >= 0 && 'focus' in c) return c.focus(); }
        if(clients.openWindow) return clients.openWindow(link);
    }));
});
