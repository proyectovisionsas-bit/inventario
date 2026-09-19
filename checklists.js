// ════════════════════════════════════════════════════════════════════
// 🛑 ANTES DE LLAMAR AL INGENIERO · PROYECTOVISION — código compartido
//
// Lo cargan OFICINAS y TECNICOS con <script src="checklists.js"></script>.
// UNA sola copia: si cambia un paso de una lista, se cambia aquí y las dos
// apps quedan actualizadas. No duplicar este archivo dentro de un HTML.
//
// Qué hace: guía una lista corta por servicio (fibra, radio, tv, instalación),
// recoge 6 a 9 datos de verdad (potencia, bombillos, ping...), sugiere la
// salida y arma la ficha de WhatsApp para el grupo de soporte de la sede.
//
// API sin pantalla (también funciona en node, para las pruebas):
//   PV_CHECK.version                          -> versión de las listas
//   PV_CHECK.datos                            -> las listas (PV_CHECK_DATOS), solo lectura
//   PV_CHECK.pasos(servicio, rol, sintoma, variante) -> pasos que aplican
//   PV_CHECK.semaforo(tipo, valor)            -> 'verde'|'amarillo'|'rojo'|''
//   PV_CHECK.nuevoEstado(opciones)            -> estado vacío de un caso
//   PV_CHECK.evaluar(estado)                  -> hechos, faltan, guías, sugerencia
//   PV_CHECK.textoWhatsApp(estado, ctx, completo) -> ficha (máx. 900 letras)
//   PV_CHECK.resumenOrden(estado)             -> resumen de 160 para la orden
//   PV_CHECK.registro(estado, ctx)            -> objeto SIN datos personales
//   PV_CHECK.docMes(ms, oficinaId)            -> 'esc_AAAA_MM_<oficina>'
//   PV_CHECK.resumenMes(registros)            -> estadísticas del mes (admin)
//   PV_CHECK.tablaMesHTML(resumen)            -> tabla del mes en HTML
//   PV_CHECK.masivaNueva(form, ctx)           -> objeto de falla masiva
//   PV_CHECK.masivasVigentes(mapa, ahoraMs, municipios)
//   PV_CHECK.textoMasiva(m)                   -> texto de WhatsApp de la masiva
//   PV_CHECK.franjaHTML(vigentes)             -> franja roja/ámbar en HTML
// API con pantalla:
//   PV_CHECK.abrir(op)                        -> abre la capa de la lista
//   PV_CHECK.abrirMasiva(op)                  -> abre directo "Reportar falla masiva"
//   PV_CHECK.cerrar()
//   PV_CHECK.pendientes()                     -> cuántos registros faltan por subir
//   PV_CHECK.reenviarPendientes(guardar)      -> Promise<cuántos quedan>
//
// REGLAS DE ESTE ARCHIVO
//   · Aquí NO se guardan nombre completo, cédula, dirección, teléfono, IP,
//     usuario PPPoE, claves, serial ni MAC. La base tiene reglas abiertas.
//   · Las claves de los objetos guardados nunca son numéricas.
//   · Las fechas son en HORA LOCAL (nunca toISOString).
//   · Todo texto que se pinta pasa por esc().
//   · La capa usa z-index 99990: queda DEBAJO de las capas de mantenimiento
//     y de versión de las apps (99997 en adelante).
// ════════════════════════════════════════════════════════════════════

// <<DATOS>>
var PV_CHECK_DATOS = {
    version: 1,
    servicios: {
        fibra: {
            nombre: "Fibra óptica", icono: "💡",
            sintomas: [{"id":"sin_servicio","t":"Sin servicio"},{"id":"lento","t":"Lento"},{"id":"intermitente","t":"Se cae a ratos"},{"id":"wifi","t":"Solo wifi o solo lejos del módem"}],
            variantes: [],
            oficina: [
                {"id":"f_o_bombillos","bloque":"Equipo en casa","titulo":"Pregunta por la corriente y los bombillos del módem","ayuda":"Pide al cliente que mire el módem y te diga qué bombillos ve: POWER, PON, LOS, LAN y WIFI/WLAN (según la marca cambian un poco los nombres). Normal: POWER y PON fijos y LOS apagado. LOS en rojo, fijo o parpadeando, es que no llega luz por la fibra. Que NO oprima el botón reset ni toque el cable de fibra. La foto por WhatsApp es opcional.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[{"id":"f_o_bombillos_luces","etiqueta":"Qué bombillos ve el cliente","tipo":"opcion","opciones":[{"v":"normal","t":"POWER y PON fijos, LOS apagado","color":"verde"},{"v":"los","t":"LOS en rojo (fijo o parpadeando)","color":"rojo"},{"v":"pon_parpadea","t":"PON parpadeando","color":"amarillo"},{"v":"apagado","t":"Todo apagado (sin POWER)","color":"rojo"},{"v":"no_sabe","t":"El cliente no sabe o no puede ver","color":""}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"POWER apagado","hacer":"Que pruebe otra toma y revise que el adaptador esté bien puesto. Si no prende, orden al técnico con adaptador de repuesto. Nunca es del ingeniero.","salida":"tecnico","si":{"campo":"f_o_bombillos_luces","v":["apagado"]}},{"cuando":"LOS en rojo en un solo cliente","hacer":"Pregunta si movieron el módem o doblaron el cable de fibra. Orden al técnico. Un solo cliente con LOS nunca es del ingeniero.","salida":"tecnico","si":{"campo":"f_o_bombillos_luces","v":["los"]}},{"cuando":"PON parpadeando","hacer":"Sigue con el reinicio y mira el estado en la plataforma de la OLT. Si sigue igual, orden al técnico.","salida":""},{"cuando":"POWER y PON bien, pero LAN o WIFI apagado","hacer":"Que revise el cable de red bien puesto en el módem y que el wifi no esté apagado con el botón WLAN o WIFI del módem.","salida":"resuelve"}],"seguridad":false,"posicion":""},
                {"id":"f_o_reinicio","bloque":"Equipo en casa","titulo":"Pide reiniciar el módem: 30 segundos sin corriente","ayuda":"Pide desconectar el módem de la corriente 30 segundos y volver a conectarlo. Que NO oprima el botón reset (borra la configuración) ni toque el cable de fibra. Espera unos 3 minutos a que el bombillo PON quede fijo y pide probar. Bien = volvió y se queda funcionando.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[],"siMal":[{"cuando":"No volvió","hacer":"Sigue con la plataforma de la OLT: ahí se ve si es fibra, energía o conexión.","salida":""},{"cuando":"Vuelve, pero se cae otra vez el mismo día","hacer":"Marca el síntoma «se cae a ratos» y sigue la lista. Si se repite, orden al técnico por energía o potencia.","salida":""},{"cuando":"El cliente oprimió el botón reset","hacer":"El módem quedó sin configuración: orden al técnico para reconfigurar. No es del ingeniero.","salida":"tecnico"}],"seguridad":false,"posicion":""},
                {"id":"f_o_olt_estado","bloque":"Plataforma de la OLT","titulo":"Busca el módem y pulsa «obtener estado en vivo»","ayuda":"Abre la plataforma de la OLT de ese municipio (SmartOLT o AdminOLT; la app te dice cuál). Busca el módem y pulsa «obtener estado en vivo» (puede decir «Get status» o «Live»). En inglés: Online = en línea; Power fail = sin corriente; LOS = sin luz de fibra; Offline = desconectado. Mira el estado, la última causa de caída y la hora. Bien = en línea desde hace días. SOLO MIRAR: no reinicies, no borres ni muevas nada.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[{"id":"f_o_olt_estado_est","etiqueta":"Estado que muestra la plataforma","tipo":"opcion","opciones":[{"v":"en_linea","t":"En línea","color":"verde"},{"v":"los","t":"LOS (sin luz de fibra)","color":"rojo"},{"v":"sin_corriente","t":"Se quedó sin corriente (Power fail)","color":"amarillo"},{"v":"desconectado","t":"Desconectado, sin causa clara","color":"rojo"},{"v":"no_aparece","t":"No aparece o sale sin autorizar","color":"rojo"},{"v":"no_carga","t":"No carga ningún módem","color":"rojo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Se quedó sin corriente","hacer":"Es la energía de la casa, no la fibra: que revise toma y adaptador. Si dice LOS pero en la casa el POWER está apagado, también es energía.","salida":"resuelve","si":{"campo":"f_o_olt_estado_est","v":["sin_corriente"]}},{"cuando":"LOS o desconectado en un solo cliente","hacer":"Es fibra o equipo: orden al técnico con el resumen. Nunca es del ingeniero.","salida":"tecnico","si":{"campo":"f_o_olt_estado_est","v":["los","desconectado"]}},{"cuando":"No aparece o sale sin autorizar","hacer":"Pásalo a la persona autorizada de tu sede para que lo busque en toda la OLT y lo autorice. Solo si ella no puede: mensaje al ingeniero.","salida":"autorizador","si":{"campo":"f_o_olt_estado_est","v":["no_aparece"]}},{"cuando":"La plataforma no muestra estado de NINGÚN módem por más de 10 minutos","hacer":"Primero confirma que a un compañero tampoco le carga: si es solo tu computador o tu internet, no es del ingeniero. Si ya se avisó en el grupo de la sede, no llames otra vez.","salida":"ingeniero_llamada","si":{"campo":"f_o_olt_estado_est","v":["no_carga"]}},{"cuando":"A un compañero tampoco le carga ningún módem y nadie ha avisado en el grupo","hacer":"Llama al ingeniero una sola vez desde la sede y avisa en el grupo para que nadie más llame.","salida":"ingeniero_llamada","si":{"campo":"f_o_olt_estado_est","v":["no_carga"]}}],"seguridad":false,"posicion":""},
                {"id":"f_o_potencias","bloque":"Plataforma de la OLT","titulo":"Anota las dos potencias que muestra la plataforma","ayuda":"En la misma pantalla del módem mira la potencia que recibe el módem (verde -10 a -25; amarillo -25 a -27 o -8 a -10; rojo peor que -27 o más fuerte que -8) y la que recibe la OLT (verde -26 o mejor; amarillo -26 a -28; rojo peor que -28). La app pone el signo menos. Este número sí vale aunque la TV vaya por la misma fibra.","obligatorio":true,"sintomas":["sin_servicio","lento","intermitente"],"variantes":[],"campos":[{"id":"f_o_potencias_onu","etiqueta":"Potencia que recibe el módem","tipo":"numero","opciones":[],"unidad":"dBm","semaforo":"rx_onu","sinDato":"No reporta"},{"id":"f_o_potencias_olt","etiqueta":"Potencia que recibe la OLT","tipo":"numero","opciones":[],"unidad":"dBm","semaforo":"rx_olt","sinDato":"No reporta"}],"siMal":[{"cuando":"Amarillo o rojo en un solo cliente","hacer":"Orden al técnico para limpiar conectores y revisar el cable de la casa y la acometida. Nunca es del ingeniero.","salida":"tecnico","si":{"campo":"f_o_potencias_onu","color":["rojo","amarillo"],"sinDato":false}},{"cuando":"Más fuerte que -8 (saturado)","hacer":"Orden al técnico para revisar cómo quedó conectado en la caja. Nunca es del ingeniero.","salida":"tecnico"},{"cuando":"El módem no reporta potencia","hacer":"Pulsa otra vez «obtener estado en vivo». Si el módem está caído no hay número: guíate por el estado y sigue la lista.","salida":""},{"cuando":"Varios módems del mismo puerto con potencia mala","hacer":"Sigue con el paso de los otros módems del puerto: puede ser daño de fibra de varios clientes.","salida":""}],"seguridad":false,"posicion":""},
                {"id":"f_o_vecinos","bloque":"Plataforma de la OLT","titulo":"Mira qué otros módems del mismo puerto PON cayeron a la misma hora","ayuda":"En la plataforma de la OLT abre el puerto PON del cliente y mira cuántos módems cayeron A LA MISMA HORA que él (5 minutos) y con qué causa (LOS o sin corriente). En casi todos los puertos hay módems caídos de hace días (retirados, apagados o en mora): esos NO cuentan. Varios con LOS a la misma hora es daño de fibra. Varios «sin corriente» o causas mezcladas suele ser apagón: confírmalo con el cliente. SOLO MIRAR.","obligatorio":true,"sintomas":["sin_servicio","intermitente"],"variantes":[],"campos":[{"id":"f_o_vecinos_caidos","etiqueta":"Módems caídos en ese puerto","tipo":"opcion","opciones":[{"v":"solo","t":"Solo el del cliente (los de otros días no cuentan)","color":"verde"},{"v":"dos","t":"2 caídos a la misma hora","color":"amarillo"},{"v":"tres_los","t":"3 o más con LOS a la misma hora","color":"rojo"},{"v":"apagon","t":"Varios «sin corriente» o causas mezcladas a la misma hora","color":"amarillo"},{"v":"puerto","t":"Todo el puerto caído","color":"rojo"}],"unidad":"","semaforo":"","sinDato":""},{"id":"f_o_vecinos_puerto","etiqueta":"Puerto PON tal como sale en la pantalla (ej: 0/1/3)","tipo":"texto","opciones":[],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"3 o más con LOS dentro de 5 minutos, sin «sin corriente» mezclado","hacer":"Botón «Reportar falla masiva» y una sola llamada al ingeniero con el puerto y la lista de afectados.","salida":"masiva","si":{"campo":"f_o_vecinos_caidos","v":["tres_los"]}},{"cuando":"Causas mezcladas o todos «sin corriente»","hacer":"Pregunta al cliente si hay luz en su casa y en el barrio. Sin luz: es apagón, repórtalo como apagón con el botón de falla masiva y NO llames al ingeniero.","salida":"masiva","si":{"campo":"f_o_vecinos_caidos","v":["apagon"]}},{"cuando":"Todo el puerto caído o casi nadie en línea","hacer":"Llamada al ingeniero una sola vez, con el puerto y la hora. Reporta también la falla masiva para que salga la franja.","salida":"ingeniero_llamada","si":{"campo":"f_o_vecinos_caidos","v":["puerto"]}},{"cuando":"Solo 2 caídos","hacer":"Todavía no es falla masiva. Sigue la lista y vuelve a mirar el puerto en 10 minutos.","salida":""},{"cuando":"Causas mezcladas, pero el cliente SÍ tiene luz y su módem cayó con LOS a la misma hora que los otros","hacer":"No es solo apagón: pudo caerse un poste con la fibra. Repórtalo como falla masiva y haz una sola llamada al ingeniero.","salida":"masiva","si":{"campo":"f_o_vecinos_caidos","v":["apagon"]}}],"seguridad":false,"posicion":""},
                {"id":"f_o_sesion","bloque":"Conexión","titulo":"Mira la sesión del cliente y hace cuánto está conectado","ayuda":"Primero en WispHub (herramientas del cliente). Luego confirma en Winbox: PPP, pestaña Active Connections; busca al cliente y mira el tiempo conectado (Uptime). SOLO MIRAR: en Winbox no cambies, borres ni desconectes nada. No copies aquí el usuario ni la dirección. Bien = conectado hace horas o días.","obligatorio":true,"sintomas":["sin_servicio","lento","intermitente"],"variantes":[],"campos":[{"id":"f_o_sesion_est","etiqueta":"Sesión del cliente","tipo":"opcion","opciones":[{"v":"horas","t":"Conectado hace horas o días","color":"verde"},{"v":"minutos","t":"Conectado hace pocos minutos (se reconecta)","color":"amarillo"},{"v":"sin_sesion","t":"Sin sesión","color":"rojo"},{"v":"casi_nadie","t":"Casi nadie conectado en ese Mikrotik","color":"rojo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Conectado pocos minutos, una y otra vez","hacer":"Orden al técnico por energía o potencia. No es del ingeniero.","salida":"tecnico","si":{"campo":"f_o_sesion_est","v":["minutos"]}},{"cuando":"Sin sesión y el módem en línea en la OLT","hacer":"Suele ser el módem reseteado o la conexión mal configurada: orden al técnico para revisar la configuración.","salida":"tecnico","si":{"campo":"f_o_sesion_est","v":["sin_sesion"]}},{"cuando":"Casi NADIE conectado en ese Mikrotik","hacer":"Llamada al ingeniero una sola vez y botón «Reportar falla masiva». No toques nada en Winbox.","salida":"ingeniero_llamada","si":{"campo":"f_o_sesion_est","v":["casi_nadie"]}}],"seguridad":false,"posicion":""},
                {"id":"f_o_cortados","bloque":"Conexión","titulo":"Revisa si el cliente está en la lista de cortados","ayuda":"En WispHub mira si el servicio figura cortado por mora. Luego confirma en Winbox: IP, Firewall, pestaña Address Lists; busca al cliente en la lista de cortados o morosos de tu sede (el nombre de la lista lo da el ingeniero). SOLO MIRAR: nunca saques ni metas a nadie a mano; eso se hace desde WispHub. Bien = al día y fuera de la lista.","obligatorio":true,"sintomas":["sin_servicio"],"variantes":[],"campos":[{"id":"f_o_cortados_lista","etiqueta":"¿Está en la lista de cortados?","tipo":"opcion","opciones":[{"v":"no","t":"No está en la lista","color":"verde"},{"v":"si","t":"Sí está en la lista","color":"rojo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Está en la lista y debe","hacer":"Es de cartera: se cobra y se reactiva desde WispHub. Nunca es del ingeniero.","salida":"cartera"},{"cuando":"Pagó y sigue en la lista","hacer":"Reactiva desde WispHub, espera unos minutos, vuelve a mirar y devuélvele la llamada al cliente. No lo saques a mano en Winbox.","salida":"resuelve"},{"cuando":"Al día y sigue en la lista tras 2 reactivaciones","hacer":"Mensaje al ingeniero con la ficha en el grupo de WhatsApp de la sede.","salida":"ingeniero_mensaje"}],"seguridad":false,"posicion":""},
                {"id":"f_o_ping","bloque":"Conexión","titulo":"Haz ping de 20 paquetes al cliente desde el Mikrotik","ayuda":"En WispHub: ficha del cliente, herramienta de ping, 20 paquetes (no es el botón «Verificar equipo» de esta app). O en Winbox: Tools, Ping, a la dirección que muestra la sesión del cliente, 20 paquetes. SOLO MIRAR: no cambies nada y no anotes la dirección. 0 perdidos verde; 1 perdido: repite; 2 o más: rojo.","obligatorio":true,"sintomas":["sin_servicio","lento","intermitente"],"variantes":[],"campos":[{"id":"f_o_ping_perdidos","etiqueta":"Paquetes perdidos","tipo":"numero","opciones":[],"unidad":"perdidos de 20","semaforo":"perdidos","sinDato":"No responde"}],"siMal":[{"cuando":"2 o más perdidos","hacer":"Repite una vez. Si sigue igual en un solo cliente: orden al técnico para revisar potencia, cables y equipo.","salida":"tecnico"},{"cuando":"No responde, pero hay sesión activa","hacer":"Por sí solo no es falla: muchos módems no contestan el ping. Sigue la lista.","salida":""},{"cuando":"WispHub o Winbox no conectan con el Mikrotik por más de 10 minutos","hacer":"Primero confirma que tu internet funciona y que a un compañero tampoco le conecta. Llama al ingeniero una sola vez y avisa en el grupo de la sede para que nadie más llame.","salida":"ingeniero_llamada"},{"cuando":"En línea, con sesión, fuera de cortados y no navega ni por cable","hacer":"Si ya probó por cable y sin router propio: mensaje al ingeniero con la ficha. Si no pudo probar: orden al técnico.","salida":"ingeniero_mensaje"}],"seguridad":false,"posicion":""},
                {"id":"f_o_wifi","bloque":"Wifi de la casa","titulo":"Pregunta por el wifi: aparatos, distancia y si falla en todos","ayuda":"Pregunta cuántos aparatos hay conectados, a qué distancia del módem falla y si les pasa a todos. Pide probar pegado al módem, o por cable si tiene computador. Bien = cerca del módem funciona bien en todos. La clave y el nombre del wifi no se anotan aquí.","obligatorio":true,"sintomas":["lento","intermitente","wifi"],"variantes":[],"campos":[],"siMal":[{"cuando":"Bien cerca del módem y mal lejos","hacer":"Es cobertura wifi, no falla de la red. Ofrece un repetidor o reubicar el módem; si acepta, crea la orden. Nunca es del ingeniero.","salida":"comercial"},{"cuando":"Muchos aparatos al mismo tiempo","hacer":"Explica que el plan se reparte entre todos los aparatos. Si quiere más velocidad, ofrece cambio de plan.","salida":"comercial"},{"cuando":"Falla en un solo aparato","hacer":"Es de ese aparato: que olvide la red y se conecte de nuevo, o lo reinicie. No es falla nuestra.","salida":"resuelve"},{"cuando":"Lento también pegado al módem o por cable","hacer":"No es el wifi: termina la lista y crea orden al técnico para prueba de velocidad por cable.","salida":"tecnico"}],"seguridad":false,"posicion":""}
            ],
            tecnico: [
                {"id":"f_t_energia","bloque":"Energía y bombillos","titulo":"Revisa toma, regleta y adaptador original del módem","ayuda":"Mira que la toma tenga corriente, que la regleta no esté floja y que el adaptador sea el del módem (mismo voltaje). Si dudas, prueba con tu adaptador bueno. Bien = POWER fijo y el módem no se reinicia solo.","obligatorio":true,"sintomas":["sin_servicio","intermitente"],"variantes":[],"campos":[],"siMal":[{"cuando":"Toma o regleta mala","hacer":"Conéctalo directo a otra toma y muéstrale al cliente cuál era el daño.","salida":"resuelve"},{"cuando":"Adaptador dañado","hacer":"Cámbialo por uno bueno del mismo voltaje y anótalo en el cierre para INVENTARIO.","salida":"resuelve"},{"cuando":"Con adaptador bueno no prende o se reinicia solo","hacer":"Módem dañado: va a reemplazo. El módem nuevo lo autoriza la persona autorizada de tu sede (paso del módem nuevo).","salida":"autorizador"}],"seguridad":false,"posicion":""},
                {"id":"f_t_bombillos","bloque":"Energía y bombillos","titulo":"Mira los bombillos del módem al llegar","ayuda":"Mira POWER, PON, LOS, LAN y WIFI/WLAN (según la marca cambian un poco los nombres). Normal: POWER y PON fijos y LOS apagado. La foto va al grupo de WhatsApp de la sede solo si vas a escalar.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[{"id":"f_t_bombillos_luces","etiqueta":"Bombillos al llegar","tipo":"opcion","opciones":[{"v":"normal","t":"POWER y PON fijos, LOS apagado","color":"verde"},{"v":"los","t":"LOS en rojo (fijo o parpadeando)","color":"rojo"},{"v":"pon_parpadea","t":"PON parpadeando","color":"amarillo"},{"v":"apagado","t":"Todo apagado (sin POWER)","color":"rojo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"LOS en rojo","hacer":"Es fibra: sigue con el bloque Fibra. LOS en un solo cliente nunca es del ingeniero.","salida":""},{"cuando":"PON parpadeando","hacer":"Mide la potencia y después revisa si el módem está autorizado en la OLT (paso del módem nuevo).","salida":""},{"cuando":"Todo normal y no navega","hacer":"La fibra está bien: pasa a OLT y equipo y luego a Configuración.","salida":""},{"cuando":"LAN o WIFI apagado","hacer":"Revisa el cable de red con el probador y que el wifi no esté apagado con el botón WLAN o WIFI.","salida":"resuelve"}],"seguridad":false,"posicion":""},
                {"id":"f_t_patchcord","bloque":"Fibra","titulo":"Revisa y limpia el cable corto de fibra y el conector verde","ayuda":"Desconecta el módem. Limpia el conector con limpiador de fibra. Revisa que no haya dobleces cerrados ni cable pisado y que sea verde con verde, NUNCA azul con verde. Debe entrar con clic. NUNCA mires la punta de la fibra ni la apuntes a nadie. Bien = limpio, sin dobleces y con clic al entrar.","obligatorio":true,"sintomas":["sin_servicio","lento","intermitente"],"variantes":[],"campos":[],"siMal":[{"cuando":"Doblado, pisado o rayado","hacer":"Cámbialo por un cable corto nuevo y vuelve a medir.","salida":"resuelve"},{"cuando":"Conector azul con verde","hacer":"Cambia el cable por uno verde con verde: mezclados pierden potencia y dañan el conector.","salida":"resuelve"},{"cuando":"Conector sucio","hacer":"Límpialo, limpia también el puerto del módem y vuelve a medir.","salida":"resuelve"}],"seguridad":false,"posicion":""},
                {"id":"f_t_potencia","bloque":"Fibra","titulo":"Mide la potencia en la punta que entra al módem","ayuda":"Mide en la punta que entra al módem. Verde -10 a -25; amarillo -25 a -27 o -8 a -10; rojo peor que -27 o más fuerte que -8. Si en tu sede la TV va por la misma fibra (RF), el medidor normal solo dice si hay luz: el número válido es el del medidor PON, la página del módem o la OLT. NUNCA mires la punta de la fibra. La app pone el signo menos.","obligatorio":true,"sintomas":["sin_servicio","lento","intermitente"],"variantes":[],"campos":[{"id":"f_t_potencia_valor","etiqueta":"Potencia en la punta que entra al módem","tipo":"numero","opciones":[],"unidad":"dBm","semaforo":"rx_onu","sinDato":"Sin luz / no marca"},{"id":"f_t_potencia_conque","etiqueta":"Con qué se midió","tipo":"opcion","opciones":[{"v":"medidor_pon","t":"Medidor PON (separa internet y TV)","color":"verde"},{"v":"pagina_modem","t":"La página del módem","color":"verde"},{"v":"olt","t":"La plataforma de la OLT","color":"verde"},{"v":"medidor_normal","t":"Medidor de potencia normal","color":"amarillo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Amarillo o rojo","hacer":"Sigue midiendo hacia atrás: roseta y después caja NAP. Potencia mala en un solo cliente nunca es del ingeniero.","salida":""},{"cuando":"Sin luz","hacer":"Pasa la luz roja para buscar el corte y mide en la roseta. Si tampoco hay luz, sigue con la caja NAP.","salida":""},{"cuando":"Más fuerte que -8 (saturado)","hacer":"Confirma con medidor PON o la página del módem. Si es real, revisa en la caja que salga del divisor y pon atenuador.","salida":"resuelve"},{"cuando":"Medidor normal en sede con TV por la misma fibra","hacer":"Ese número no vale. Repite con medidor PON, mira la página del módem o pide a la oficina el dato de la OLT.","salida":""}],"seguridad":false,"posicion":""},
                {"id":"f_t_roseta","bloque":"Fibra","titulo":"Si salió mala: mide en la roseta con un cable de prueba bueno","ayuda":"Solo si la potencia en la punta salió amarilla, roja o sin luz. Mide en la roseta (la cajita de la pared) con tu cable de prueba bueno y compara con lo que dio en la punta. Bien = en la roseta sale verde. Si da casi igual que en la punta (0,5 o menos de diferencia), el daño viene de más atrás. NUNCA mires la punta de la fibra.","obligatorio":false,"sintomas":["sin_servicio","lento","intermitente"],"variantes":[],"campos":[],"siMal":[{"cuando":"Mejora más de 1 con tu cable de prueba","hacer":"El cable corto del cliente estaba malo: cámbialo y vuelve a medir en la punta.","salida":"resuelve"},{"cuando":"La roseta también sale mala","hacer":"El daño está en la acometida o en la caja: sigue con la caja NAP, después de la parada de seguridad.","salida":""},{"cuando":"Roseta o conector de la roseta dañado","hacer":"Rehaz el conector o cambia la roseta y vuelve a medir.","salida":"resuelve"}],"seguridad":false,"posicion":""},
                {"id":"f_t_nap","bloque":"Fibra","titulo":"Si la roseta también salió mala: mide en la caja NAP","ayuda":"Solo después de la parada de seguridad. Ubica el puerto del cliente pasando la luz roja desde la casa, con el módem desconectado. Si no lo identificas, mide SOLO un puerto libre: NO sueltes puertos vivos. Bien = de la caja a la casa se pierde máximo 1,5. Con TV por la misma fibra el medidor normal marca de más. NUNCA mires la punta de la fibra. Al cerrar, pide a la oficina confirmar que no tumbaste a ningún vecino.","obligatorio":false,"sintomas":["sin_servicio","lento","intermitente"],"variantes":[],"campos":[{"id":"f_t_nap_valor","etiqueta":"Potencia en el puerto del cliente en la caja (o en un puerto libre)","tipo":"numero","opciones":[],"unidad":"dBm","semaforo":"rx_onu","sinDato":"Sin luz / no marca"}],"siMal":[{"cuando":"Caja buena y casa mala","hacer":"Rehaz el conector o cambia la acometida y vuelve a medir en la punta.","salida":"resuelve","si":{"campo":"f_t_nap_valor","color":["verde"]}},{"cuando":"Solo ese puerto malo","hacer":"Pasa al cliente a un puerto libre, rotula el puerto dañado y avisa a la oficina la caja y el puerto.","salida":"resuelve"},{"cuando":"Tu puerto y un puerto libre sin luz o malos, y la oficina ve otros módems de ese puerto PON caídos","hacer":"Botón «Reportar falla masiva» con caja, hora y foto del daño si lo ves. Una sola llamada al ingeniero. Si los demás siguen en línea NO es masiva: revisa tu cable de prueba y tu puerto.","salida":"masiva"},{"cuando":"Más fuerte que -8 con medidor normal, en sede con TV por la misma fibra","hacer":"Ese número no vale: el medidor normal suma la luz de la TV. Bórralo y compara con lo que ese mismo medidor dio en la casa (máximo 1,5 de diferencia), o repite con medidor PON.","salida":""},{"cuando":"No pudiste identificar el puerto del cliente","hacer":"No sueltes nada. Mide un puerto libre y pide a la oficina el puerto que figura para ese cliente.","salida":""}],"seguridad":false,"posicion":""},
                {"id":"f_t_vfl","bloque":"Fibra","titulo":"Pasa la luz roja (VFL) unos pocos segundos","ayuda":"Con el módem desconectado, pasa la luz roja pocos segundos desde la casa. Sirve para ver si llega al otro extremo, para identificar el puerto en la caja y para ver fugas (puntos rojos que brillan) en el cable corto, la roseta o el conector. NUNCA mires la punta de la fibra ni apuntes la luz roja a los ojos. Bien = llega y no hay fugas.","obligatorio":false,"sintomas":["sin_servicio","intermitente"],"variantes":[],"campos":[],"siMal":[{"cuando":"No llega y no hay daño a la vista","hacer":"Cambia la acometida.","salida":"resuelve"},{"cuando":"Fuga en el cable corto, la roseta o el conector","hacer":"Cambia el cable corto o rehaz el conector donde se ve la fuga y vuelve a medir.","salida":"resuelve"}],"seguridad":false,"posicion":""},
                {"id":"f_t_olt","bloque":"OLT y equipo","titulo":"Con buena potencia, confirma el estado en vivo en la OLT","ayuda":"Pide a la oficina (o mira tú en la plataforma de la OLT de tu municipio) «obtener estado en vivo»: módem en línea y las dos potencias. La que recibe el MÓDEM según la plataforma debe parecerse a lo que mediste en la punta (3 o menos de diferencia). La que recibe la OLT: verde -26 o mejor; amarillo -26 a -28; rojo peor que -28. Donde la TV va por la misma fibra, vale el número de la plataforma. SOLO MIRAR.","obligatorio":true,"sintomas":["sin_servicio","lento","intermitente"],"variantes":[],"campos":[{"id":"f_t_olt_rx","etiqueta":"Potencia que recibe la OLT","tipo":"numero","opciones":[],"unidad":"dBm","semaforo":"rx_olt","sinDato":"No reporta"}],"siMal":[{"cuando":"OLT en rojo con el módem en verde","hacer":"Limpia otra vez los conectores de la casa y de la caja y prueba con otro módem.","salida":"resuelve","si":{"campo":"f_t_olt_rx","color":["rojo"]}},{"cuando":"La potencia del módem en la plataforma difiere más de 3 de lo que mediste","hacer":"Repite la medida con medidor PON o en la página del módem: el medidor normal no vale si la TV va por la fibra.","salida":""},{"cuando":"Buena potencia y no aparece en línea","hacer":"Sigue con el paso del módem nuevo o sin autorizar: primero la persona autorizada de tu sede.","salida":"autorizador"},{"cuando":"La plataforma no muestra NINGÚN módem por más de 10 minutos","hacer":"La oficina llama al ingeniero una sola vez. Tú sigue con lo que puedas medir en sitio.","salida":"ingeniero_llamada"}],"seguridad":false,"posicion":""},
                {"id":"f_t_serial","bloque":"OLT y equipo","titulo":"PON parpadea o módem nuevo: pide autorizarlo en la OLT","ayuda":"Compara el serial de la etiqueta con el que está autorizado: díctalo por llamada o manda la foto al grupo de la sede; NO lo escribas aquí. La persona autorizada de tu sede lo busca en TODA la OLT y usa «reemplazar por serial» en el MISMO puerto. El módem retirado se resetea antes de volver a bodega y el de prueba se quita de la OLT al terminar.","obligatorio":false,"sintomas":["sin_servicio"],"variantes":[],"campos":[],"siMal":[{"cuando":"Módem nuevo o cambiado, sin autorizar","hacer":"Llama a la persona autorizada de tu sede: ella lo autoriza o lo reemplaza por serial en el mismo puerto. Todavía no es del ingeniero.","salida":"autorizador"},{"cuando":"La persona autorizada no lo ve en la OLT","hacer":"Que lo busque en toda la OLT. Revisa otra vez potencia y conector y prueba con un segundo módem bueno.","salida":""},{"cuando":"Dos módems buenos, con buena potencia, no aparecen o dan error","hacer":"Ya pasó por la persona autorizada: mensaje al ingeniero con la ficha y 2 fotos en el grupo de la sede.","salida":"ingeniero_mensaje"}],"seguridad":false,"posicion":""},
                {"id":"f_t_config","bloque":"Configuración","titulo":"Entra a la página del módem y revisa la conexión","ayuda":"Por cable, entra a la página del módem y mira: modo de conexión, VLAN del municipio, usuario y estado. Las claves se piden por LLAMADA a la oficina o al ingeniero, nunca por chat, y no se escriben aquí. PROHIBIDO resetear sin tener en la mano usuario, clave, VLAN, nombre y clave del wifi y la plantilla. Bien = conectado y con dirección.","obligatorio":true,"sintomas":["sin_servicio"],"variantes":[],"campos":[{"id":"f_t_config_msg","etiqueta":"Mensaje exacto del error que muestra la página","tipo":"texto","opciones":[],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"«Falla de autenticación»","hacer":"Corrige el usuario o la clave; pídelos por llamada a la oficina, nunca por chat.","salida":"resuelve"},{"cuando":"Sin respuesta o se queda conectando","hacer":"Corrige la VLAN del municipio según la plantilla.","salida":"resuelve"},{"cuando":"«Ya hay una sesión activa»","hacer":"Si acabas de cambiar el módem: deja el viejo desconectado, espera unos minutos y vuelve a intentar. Si sigue, pide a la oficina revisar (solo mirando) si ese usuario está puesto en otro módem.","salida":""},{"cuando":"Sesión activa y ese usuario está puesto en el módem de otro cliente","hacer":"El usuario está mal escrito aquí o allá: se confirma por llamada y se corrige; no es del ingeniero.","salida":""},{"cuando":"Sesión activa, no está en ningún otro módem y sigue igual","hacer":"Mensaje al ingeniero con la ficha. Nadie desconecta sesiones a mano.","salida":""},{"cuando":"Usuario, clave y VLAN verificados, módem en línea y no levanta","hacer":"Mensaje al ingeniero con la ficha en el grupo de la sede. Deja el portátil por cable; acceso remoto solo si él lo pide.","salida":"ingeniero_mensaje"}],"seguridad":false,"posicion":""},
                {"id":"f_t_red_casa","bloque":"Configuración","titulo":"Revisa la red de la casa: cable, dirección y router propio","ayuda":"Conecta tu portátil por cable a un puerto LAN del módem: debe recibir dirección en segundos y prender el bombillo LAN. Si hay router del cliente, revisa que vaya del LAN del módem al puerto WAN o Internet del router, y prueba SIN él. Pasa el probador si el cable de red se ve maltratado. No anotes direcciones. Bien = recibe dirección y navega.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[],"siMal":[{"cuando":"Sin el router del cliente funciona","hacer":"El problema es de ese router: muéstraselo al cliente. No es falla de la red.","salida":"resuelve"},{"cuando":"Bombillo LAN apagado o no recibe dirección","hacer":"Cambia de puerto LAN y de cable. Si ningún puerto da dirección, revisa la configuración o cambia el módem.","salida":"resuelve"},{"cuando":"Router del cliente mal conectado o reseteado","hacer":"Conéctalo bien (LAN del módem al WAN del router). Configurarlo le toca al cliente.","salida":"resuelve"}],"seguridad":false,"posicion":""},
                {"id":"f_t_tiempos","bloque":"Configuración","titulo":"Solo si se cae a ratos: compara los tres tiempos","ayuda":"Mira tres tiempos: 1) tiempo encendido del módem, en la página del módem; 2) tiempo en línea en la plataforma de la OLT; 3) tiempo de la sesión del cliente, que la oficina ve en WispHub o en Winbox, solo mirando. Bien = los tres largos y parecidos.","obligatorio":true,"sintomas":["intermitente"],"variantes":[],"campos":[],"siMal":[{"cuando":"Módem recién encendido (se reinicia solo)","hacer":"Es energía: revisa toma, regleta y adaptador. Si con adaptador bueno sigue, módem a reemplazo.","salida":"resuelve"},{"cuando":"Módem con días encendido y poco tiempo en línea en la OLT","hacer":"Es fibra: vuelve al bloque Fibra (conector, potencia, roseta y caja).","salida":""},{"cuando":"Módem y OLT con tiempo largo y la sesión corta","hacer":"La oficina revisa que el usuario no esté en otro módem. Si no está repetido: mensaje al ingeniero con la ficha.","salida":"ingeniero_mensaje"}],"seguridad":false,"posicion":""},
                {"id":"f_t_pruebas","bloque":"Pruebas","titulo":"Haz ping, abre una página y mide la velocidad por cable","ayuda":"Con el portátil por cable en el puerto rápido del módem: ping de 10 paquetes a la puerta de enlace y a 8.8.8.8, abre una página y haz prueba de velocidad. Anota el peor ping y la bajada. Bien = 0 perdidos y 90 % del plan o más. Si pierde paquetes, revisa otra vez potencia y conectores. Un módem de solo 2.4G se prueba únicamente por cable.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[{"id":"f_t_pruebas_perdidos","etiqueta":"Paquetes perdidos (el peor de los dos ping)","tipo":"numero","opciones":[],"unidad":"perdidos de 10","semaforo":"perdidos","sinDato":"No responde"},{"id":"f_t_pruebas_bajada","etiqueta":"Velocidad de bajada por cable","tipo":"numero","opciones":[],"unidad":"Mbps","semaforo":"","sinDato":""}],"siMal":[{"cuando":"8.8.8.8 responde pero no abren las páginas, en un solo cliente","hacer":"Es el DNS: corrígelo en la página del módem según la plantilla.","salida":"resuelve"},{"cuando":"Lo mismo en varios clientes","hacer":"Llamada al ingeniero una sola vez, con la lista de afectados. Reporta la falla masiva.","salida":"ingeniero_llamada"},{"cuando":"Velocidad baja por cable con buena potencia","hacer":"Prueba con otro cable de red (los 8 hilos), en el puerto rápido y con otro servidor. Si sigue baja, la oficina compara el plan en WispHub. Si el plan está bien: mensaje al ingeniero con la ficha.","salida":"ingeniero_mensaje"},{"cuando":"En línea, con sesión, fuera de cortados y no navega por cable","hacer":"Mensaje al ingeniero con la ficha en el grupo de la sede. Deja el portátil conectado por cable al módem.","salida":"ingeniero_mensaje"}],"seguridad":false,"posicion":""},
                {"id":"f_t_wifi","bloque":"Pruebas","titulo":"Solo si la queja es wifi: mide la señal donde se queja","ayuda":"Con el celular mide la señal wifi en el sitio donde el cliente se queja: verde mejor que -65; amarillo -65 a -75; rojo peor que -75. Mira en la página del módem el canal del wifi y cuántos aparatos hay conectados, y si el módem está encerrado, en el piso o en una esquina. La app pone el signo menos.","obligatorio":true,"sintomas":["lento","wifi"],"variantes":[],"campos":[{"id":"f_t_wifi_senal","etiqueta":"Señal wifi donde se queja el cliente","tipo":"numero","opciones":[],"unidad":"dBm","semaforo":"wifi","sinDato":"No llega señal"}],"siMal":[{"cuando":"Señal amarilla o roja lejos del módem","hacer":"Reubica el módem a un punto central y alto, u ofrece un repetidor. Nunca es del ingeniero.","salida":"resuelve","si":{"campo":"f_t_wifi_senal","color":["rojo","amarillo"]}},{"cuando":"Canal lleno de redes vecinas","hacer":"Cambia el canal del wifi de la casa (1, 6 u 11 en 2.4G) y deja los aparatos cercanos en 5G.","salida":"resuelve"},{"cuando":"Muchos aparatos para el plan","hacer":"Explícale al cliente que el plan se reparte. Si quiere más, la oficina le ofrece cambio de plan.","salida":"comercial"}],"seguridad":false,"posicion":""}
            ]
        },
        radio: {
            nombre: "Radio enlace", icono: "📡",
            sintomas: [{"id":"sin_servicio","t":"Sin servicio"},{"id":"lento","t":"Lento"},{"id":"intermitente","t":"Se cae a ratos"},{"id":"wifi","t":"Solo wifi"}],
            variantes: [],
            oficina: [
                {"id":"r_o_corriente","bloque":"Equipo en casa","titulo":"Confirma que el PoE y el router tienen el bombillo encendido","ayuda":"El PoE es la cajita por donde pasa el cable que sube a la antena; tiene un bombillo. Pide al cliente que mire ese bombillo y los del router. Si alguno está apagado, que pruebe otra toma de la pared, sin regleta, y revise que el adaptador esté bien metido. Que no destape ni moje nada.","obligatorio":true,"sintomas":["sin_servicio","intermitente"],"variantes":[],"campos":[{"id":"r_o_corriente_estado","etiqueta":"Corriente en la casa","tipo":"opcion","opciones":[{"v":"ok","t":"PoE y router encendidos","color":"verde"},{"v":"poe_apagado","t":"PoE apagado","color":"rojo"},{"v":"router_apagado","t":"Router apagado","color":"rojo"},{"v":"no_sabe","t":"El cliente no sabe o no está en casa","color":"amarillo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"PoE o router apagado","hacer":"Que pruebe otra toma y ajuste el adaptador. Si enciende, espera 2 minutos a que la antena enganche y confirma que navega.","salida":"resuelve","si":{"campo":"r_o_corriente_estado","v":["poe_apagado","router_apagado"]}},{"cuando":"No enciende en ninguna toma","hacer":"Orden al técnico: visita con PoE de repuesto del mismo voltaje. No es del ingeniero.","salida":"tecnico"},{"cuando":"No hay luz en la casa o en el barrio","hacer":"Es apagón, no falla nuestra: vuelve solo al llegar la luz. Si son varios clientes, repórtalo como apagón con el botón rojo y no llames.","salida":"resuelve"}],"seguridad":false,"posicion":""},
                {"id":"r_o_cables","bloque":"Equipo en casa","titulo":"Revisa que cada cable esté en su puerto: POE al techo, LAN al router","ayuda":"En la cajita PoE hay dos puertos marcados. POE es el cable que sube a la antena del techo. LAN es el que va al router. Nunca se conecta el router ni un computador al puerto POE: lleva corriente y los puede quemar. Pregunta si alguien movió los cables. Si el cliente duda, que no cambie nada y mande foto por WhatsApp.","obligatorio":false,"sintomas":["sin_servicio","intermitente"],"variantes":[],"campos":[],"siMal":[{"cuando":"Cables cambiados de puerto","hacer":"Primero que desconecte el PoE de la corriente. Después guíalo para dejar POE hacia la antena y LAN hacia el router, y que lo vuelva a conectar. Espera 2 minutos a que la antena enganche.","salida":"resuelve"},{"cuando":"El cliente duda o no distingue los puertos","hacer":"Que no cambie nada y mande foto. Si no se aclara por teléfono, orden al técnico.","salida":"tecnico"},{"cuando":"Cable roto, mordido o conector suelto","hacer":"Orden al técnico para cambiar el cable. No es del ingeniero.","salida":"tecnico"}],"seguridad":false,"posicion":""},
                {"id":"r_o_bombillos_antena","bloque":"Equipo en casa","titulo":"Pregunta por los bombillos de la antena, si alcanza a verla","ayuda":"Solo si la ve desde el piso: que NO se suba al techo. La antena tiene un bombillo de encendido, uno de red y varios de señal (las barras). Bueno: encendida y con 3 barras o más. Algunas antenas no tienen barras o las traen apagadas: en ese caso marca «No alcanza a verla» y sigue.","obligatorio":false,"sintomas":["sin_servicio","lento","intermitente"],"variantes":[],"campos":[{"id":"r_o_bombillos_antena_barras","etiqueta":"Bombillos de la antena","tipo":"opcion","opciones":[{"v":"tres_mas","t":"Encendida, 3 barras o más","color":"verde"},{"v":"una_dos","t":"Encendida, 1 o 2 barras","color":"amarillo"},{"v":"sin_barras","t":"Encendida, sin barras","color":"rojo"},{"v":"apagada","t":"Apagada","color":"rojo"},{"v":"no_ve","t":"No alcanza a verla","color":""}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Antena apagada con el PoE encendido","hacer":"Es el PoE o el cable. Orden al técnico con PoE y cable de repuesto.","salida":"tecnico"},{"cuando":"Encendida y sin barras","hacer":"Antena desalineada o con obstáculo. Orden al técnico. Nunca es del ingeniero.","salida":"tecnico","si":{"campo":"r_o_bombillos_antena_barras","v":["sin_barras"]}},{"cuando":"1 o 2 barras","hacer":"Señal baja: anótalo en la orden para que el técnico alinee.","salida":"tecnico","si":{"campo":"r_o_bombillos_antena_barras","v":["una_dos"]}}],"seguridad":false,"posicion":""},
                {"id":"r_o_reinicio","bloque":"Equipo en casa","titulo":"Guía el reinicio en orden: primero el PoE, después el router","ayuda":"Desconecta de la luz el PoE y el router 30 segundos. Conecta primero el PoE y espera 2 minutos a que la antena enganche; después el router. Debe volver en 5 minutos. NO oprimir el botón reset de ningún equipo, ni con palillo: se borra la configuración y toca visita.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[{"id":"r_o_reinicio_volvio","etiqueta":"¿Volvió el servicio?","tipo":"opcion","opciones":[{"v":"si","t":"Volvió y se queda","color":"verde"},{"v":"recae","t":"Volvió y se cayó otra vez","color":"amarillo"},{"v":"no","t":"No volvió","color":"rojo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Se cae varias veces al día","hacer":"Marca el síntoma «se cae a ratos» y crea orden al técnico para revisar PoE, cable y señal.","salida":"tecnico","si":{"campo":"r_o_reinicio_volvio","v":["recae"]}},{"cuando":"No volvió","hacer":"Sigue con la sesión del cliente, la lista de cortados y la torre antes de crear la orden.","salida":""},{"cuando":"El cliente oprimió reset","hacer":"Orden al técnico para reconfigurar con la plantilla. No es del ingeniero.","salida":"tecnico"}],"seguridad":false,"posicion":""},
                {"id":"r_o_sesion","bloque":"Conexión","titulo":"Mira la sesión del cliente en WispHub y confírmala en Winbox","ayuda":"En WispHub: herramientas del cliente, mira si está conectado y hace cuánto. En Winbox del Mikrotik de la sede: PPP, pestaña de conexiones activas; busca al cliente y mira el tiempo conectado. SOLO MIRAR: no cambies, borres ni desconectes nada en Winbox. No escribas aquí el usuario ni la dirección del cliente.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[{"id":"r_o_sesion_estado","etiqueta":"Sesión del cliente","tipo":"opcion","opciones":[{"v":"horas","t":"Conectado hace horas o días","color":"verde"},{"v":"minutos","t":"Se conecta pocos minutos, una y otra vez","color":"amarillo"},{"v":"sin","t":"Sin sesión","color":"rojo"},{"v":"casi_nadie","t":"Casi nadie conectado en ese Mikrotik","color":"rojo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Sin sesión y con los equipos encendidos","hacer":"Es enlace o antena: orden al técnico. Antes mira la lista de cortados y la torre.","salida":"tecnico","si":{"campo":"r_o_sesion_estado","v":["sin"]}},{"cuando":"Conectado pocos minutos, una y otra vez","hacer":"Orden al técnico por PoE, cable o señal. Marca «se cae a ratos».","salida":"tecnico","si":{"campo":"r_o_sesion_estado","v":["minutos"]}},{"cuando":"Conectado hace horas y dice que no navega","hacer":"Prueba con otro aparato y sin el router propio. Si sigue, orden al técnico para probar por cable.","salida":"tecnico","si":{"campo":"r_o_sesion_estado","v":["horas"]}},{"cuando":"Casi nadie conectado en ese Mikrotik","hacer":"Botón rojo «Reportar falla masiva» y llama al ingeniero UNA sola vez.","salida":"ingeniero_llamada","si":{"campo":"r_o_sesion_estado","v":["casi_nadie"]}}],"seguridad":false,"posicion":""},
                {"id":"r_o_cortados","bloque":"Conexión","titulo":"Revisa en Winbox si el cliente sigue en la lista de cortados","ayuda":"En Winbox: IP, Firewall, pestaña de listas de direcciones; busca la lista de cortados o morosos de la sede y mira si el cliente aparece. Compara con WispHub abierto AHORA. SOLO MIRAR: no saques ni metas a nadie a mano; la reactivación se hace desde WispHub. Si no sabes cómo se llama la lista en tu sede, pregúntalo una sola vez y anótalo.","obligatorio":true,"sintomas":["sin_servicio"],"variantes":[],"campos":[{"id":"r_o_cortados_estado","etiqueta":"Lista de cortados","tipo":"opcion","opciones":[{"v":"fuera","t":"No está en la lista","color":"verde"},{"v":"debe","t":"Está en la lista y debe","color":"amarillo"},{"v":"al_dia","t":"Está en la lista y está al día","color":"rojo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"En la lista y con saldo pendiente","hacer":"No es falla: se cobra y se reactiva desde WispHub. Nunca es del ingeniero.","salida":"cartera","si":{"campo":"r_o_cortados_estado","v":["debe"]}},{"cuando":"Pagó hoy y sigue en la lista","hacer":"Reactiva desde WispHub, espera unos minutos, pide reiniciar el PoE y devuélvele la llamada.","salida":"resuelve","si":{"campo":"r_o_cortados_estado","v":["al_dia"]}},{"cuando":"Al día y sigue en la lista tras 2 reactivaciones","hacer":"Ficha por MENSAJE al grupo de soporte de la sede. No lo saques a mano de la lista.","salida":"ingeniero_mensaje"}],"seguridad":false,"posicion":""},
                {"id":"r_o_torre_masiva","bloque":"Torre","titulo":"Mira si otros clientes de la misma torre cayeron a la misma hora","ayuda":"En WispHub filtra los clientes de esa torre o sector. En Winbox, en las conexiones activas de PPP, mira cuáles NO tienen sesión o se reconectaron a la misma hora. Forma rápida: busca ahí 3 o 4 clientes de esa torre; si ninguno aparece o todos llevan pocos minutos, la torre se cayó. Cuentan las SESIONES caídas: el ping a los routers de las casas NO sirve, muchos no contestan. SOLO MIRAR en Winbox: no cambies nada.","obligatorio":true,"sintomas":["sin_servicio","intermitente"],"variantes":[],"campos":[{"id":"r_o_torre_masiva_cuantos","etiqueta":"Caídos de la misma torre o sector","tipo":"opcion","opciones":[{"v":"uno","t":"Solo este cliente","color":"verde"},{"v":"dos","t":"2 caídos a la misma hora","color":"amarillo"},{"v":"tres_mas","t":"3 o más caídos a la misma hora","color":"rojo"},{"v":"torre_vacia","t":"Torre sin ningún cliente conectado","color":"rojo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"3 o más caídos a la misma hora","hacer":"Botón rojo «Reportar falla masiva» con torre, hora y cuántos. Pregunta si hay luz en la zona de la torre y llama al ingeniero UNA sola vez.","salida":"masiva","si":{"campo":"r_o_torre_masiva_cuantos","v":["tres_mas"]}},{"cuando":"Torre sin ningún cliente conectado","hacer":"Reporta la falla masiva y llama al ingeniero una sola vez con la lista de afectados. A la torre solo sube personal autorizado.","salida":"ingeniero_llamada","si":{"campo":"r_o_torre_masiva_cuantos","v":["torre_vacia"]}},{"cuando":"2 caídos a la misma hora","hacer":"Espera 5 minutos y vuelve a mirar. Si llega a 3, es falla masiva. Si no, sigue cada caso por aparte.","salida":""},{"cuando":"Los caídos están sin luz en sus casas","hacer":"Es apagón del barrio: repórtalo como apagón con el botón rojo y no llames. Vuelve solo al llegar la luz.","salida":"masiva"}],"seguridad":false,"posicion":""},
                {"id":"r_o_ping","bloque":"Pruebas","titulo":"Haz ping de 20 paquetes al cliente desde WispHub o el Mikrotik","ayuda":"En WispHub: ficha del cliente, herramienta de ping, 20 paquetes. En Winbox: Herramientas (Tools), Ping, a la dirección que muestra la sesión del cliente, 20 paquetes y detener. Es un dato de apoyo. Anota solo cuántos se perdieron; la dirección NO se escribe en la app. SOLO MIRAR: en Winbox no cambies nada.","obligatorio":true,"sintomas":["lento","intermitente"],"variantes":[],"campos":[{"id":"r_o_ping_perdidos","etiqueta":"Paquetes perdidos","tipo":"numero","opciones":[],"unidad":"perdidos de 20","semaforo":"perdidos","sinDato":"No responde"}],"siMal":[{"cuando":"No responde pero hay sesión activa","hacer":"Por sí solo no es falla: muchos equipos no contestan el ping. Sigue con la lista.","salida":""},{"cuando":"1 perdido","hacer":"Repite el ping. Si vuelve a perder, trátalo como 2 o más.","salida":""},{"cuando":"2 o más perdidos","hacer":"Orden al técnico para revisar señal, alineación y cable. Un solo cliente nunca es llamada.","salida":"tecnico"},{"cuando":"WispHub no logra conectar con el Mikrotik","hacer":"Primero confirma que tu internet funciona y que a un compañero tampoco le conecta. Si pasa de 10 minutos, llama al ingeniero UNA sola vez: afecta a toda la sede.","salida":"ingeniero_llamada"}],"seguridad":false,"posicion":""},
                {"id":"r_o_lento_wifi","bloque":"Pruebas","titulo":"Pregunta cuántos aparatos hay, a qué distancia y a qué horas falla","ayuda":"Pregunta: ¿cuántos aparatos están conectados?, ¿cerca del router va bien y lejos va mal?, ¿le pasa a todos o solo a uno?, ¿es todo el día o solo de noche (7 a 10)? Pide una prueba de velocidad pegado al router, con los demás aparatos quietos. La cobertura wifi, la clave del wifi y tener muchos aparatos nunca son del ingeniero.","obligatorio":true,"sintomas":["lento","intermitente","wifi"],"variantes":[],"campos":[{"id":"r_o_lento_wifi_donde","etiqueta":"Dónde y cuándo falla","tipo":"opcion","opciones":[{"v":"cobertura","t":"Cerca va bien, lejos va mal","color":"amarillo"},{"v":"muchos","t":"Muchos aparatos conectados a la vez","color":"amarillo"},{"v":"uno","t":"Falla en un solo aparato","color":"amarillo"},{"v":"noche","t":"Lento solo de noche, de 7 a 10","color":"rojo"},{"v":"siempre","t":"Lento todo el día, hasta pegado al router","color":"rojo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Cerca va bien y lejos va mal","hacer":"Es cobertura wifi: ofrece reubicar el router o un repetidor. Nunca es del ingeniero.","salida":"comercial","si":{"campo":"r_o_lento_wifi_donde","v":["cobertura"]}},{"cuando":"Muchos aparatos a la vez","hacer":"No es falla: el plan se reparte entre todos. Ofrece un plan mayor.","salida":"comercial","si":{"campo":"r_o_lento_wifi_donde","v":["muchos"]}},{"cuando":"Lento hasta pegado al router, todo el día o solo de noche","hacer":"Orden al técnico para medir señal, calidad del enlace y velocidad por cable. Anota a qué horas pasa.","salida":"tecnico","si":{"campo":"r_o_lento_wifi_donde","v":["noche","siempre"]}},{"cuando":"Varios clientes lentos de torres o sectores distintos","hacer":"Llama al ingeniero UNA sola vez con la lista de afectados: no es de un solo cliente.","salida":"ingeniero_llamada"},{"cuando":"3 o más clientes de la MISMA torre o sector lentos a las mismas horas","hacer":"No es de cada casa: es la torre cargada o con interferencia. Ficha por MENSAJE al grupo de soporte de la sede y escribe debajo la torre, las horas y cuántos clientes. No mandes técnico casa por casa.","salida":"ingeniero_mensaje"},{"cuando":"Falla en un solo aparato","hacer":"Es de ese aparato: que olvide la red y se conecte de nuevo, o lo reinicie. No es falla nuestra.","salida":"resuelve","si":{"campo":"r_o_lento_wifi_donde","v":["uno"]}}],"seguridad":false,"posicion":""}
            ],
            tecnico: [
                {"id":"r_t_poe","bloque":"Corriente y cable","titulo":"Revisa la toma, el bombillo del PoE y cada cable en su puerto","ayuda":"Prueba la toma y la regleta. POE es el cable que sube a la antena; LAN va al router. El PoE se diagnostica CAMBIÁNDOLO por uno bueno del MISMO voltaje. NUNCA pongas un PoE de 48 V a una antena de 24 V: la quema. Mira el voltaje en la etiqueta de la antena y en la del PoE antes de conectar.","obligatorio":true,"sintomas":["sin_servicio","intermitente"],"variantes":[],"campos":[],"siMal":[{"cuando":"PoE sin bombillo o que no alimenta la antena","hacer":"Cámbialo por uno bueno del mismo voltaje y anota el cambio para INVENTARIO.","salida":"resuelve"},{"cuando":"Cables cambiados de puerto","hacer":"Déjalos bien (POE a la antena, LAN al router) y revisa que el router no se haya quemado.","salida":"resuelve"},{"cuando":"La antena se reinicia sola","hacer":"Es PoE, cable o toma floja: cambia el PoE y revisa el cable entero.","salida":"resuelve"},{"cuando":"Es el segundo PoE o antena quemada en esta casa","hacer":"Antes de poner otro, revisa la puesta a tierra y el protector (paso de tierra).","salida":""}],"seguridad":false,"posicion":""},
                {"id":"r_t_bombillos","bloque":"Corriente y cable","titulo":"Mira los bombillos de la antena: encendida, red y barras de señal","ayuda":"Míralos desde el piso, sin subir todavía. Bueno: bombillo de encendido, bombillo de red (LAN) y 3 barras o más. Algunas antenas traen las barras apagadas por configuración: en ese caso guíate por la señal que verás al entrar a la antena. Toma foto para la ficha.","obligatorio":false,"sintomas":["sin_servicio"],"variantes":[],"campos":[],"siMal":[{"cuando":"Apagada","hacer":"Es PoE o cable: vuelve al paso del PoE y sigue con el cable.","salida":""},{"cuando":"Encendida pero sin bombillo de red","hacer":"Es cable o conector: revísalos con el probador.","salida":""},{"cuando":"Encendida y sin barras","hacer":"Es alineación u obstáculo: sigue con la vista a la torre y la señal.","salida":""}],"seguridad":false,"posicion":""},
                {"id":"r_t_cable","bloque":"Corriente y cable","titulo":"Recorre el cable de la antena y prueba los conectores (8 de 8 hilos)","ayuda":"Debe ser cable de exterior, de cobre puro, de UNA sola pieza y de menos de 60 m. Recórrelo buscando cortes, mordidas, dobleces y empalmes. Revisa los dos conectores: limpios, secos y sin sulfato. Pásale el probador: deben dar los 8 hilos. El tramo alto se revisa solo después de la parada de seguridad.","obligatorio":true,"sintomas":["sin_servicio","intermitente"],"variantes":[],"campos":[],"siMal":[{"cuando":"Cable dañado, empalmado o que no es de exterior","hacer":"Cambia el cable entero, sin empalmes.","salida":"resuelve"},{"cuando":"Conector con sulfato o agua","hacer":"Corta y poncha de nuevo; deja una curva para que escurra el agua y la tapa de la antena bien cerrada.","salida":"resuelve"},{"cuando":"El probador no da los 8 hilos","hacer":"Poncha de nuevo los dos extremos; si sigue igual, cambia el cable.","salida":"resuelve"},{"cuando":"Puerto de red de la antena quemado o sulfatado","hacer":"Cambia la antena por una preconfigurada. No es del ingeniero.","salida":"resuelve"}],"seguridad":false,"posicion":""},
                {"id":"r_t_tierra","bloque":"Corriente y cable","titulo":"Si es el segundo equipo quemado aquí: revisa tierra y protector","ayuda":"Solo aplica si en esta misma casa ya se quemó antes otra antena u otro PoE. Antes de poner uno nuevo revisa la puesta a tierra del mástil, el protector contra rayos y que la toma no se comparta con motores o neveras. Si no aplica, déjalo sin marcar. No trabajes en el techo con tormenta.","obligatorio":false,"sintomas":["sin_servicio"],"variantes":[],"campos":[],"siMal":[{"cuando":"No hay puesta a tierra ni protector","hacer":"Instálalos antes de poner el equipo nuevo, o déjalo anotado como pendiente y avisa a la oficina.","salida":"resuelve"},{"cuando":"Toma compartida con motores o voltaje inestable","hacer":"Recomienda al cliente otra toma o un regulador y déjalo anotado en la orden.","salida":""}],"seguridad":false,"posicion":""},
                {"id":"r_t_vista","bloque":"Antena","titulo":"Revisa el soporte firme y la vista libre hacia la torre","ayuda":"SOLO después de la parada de seguridad de alturas. El mástil no debe moverse con la mano ni con el viento. Desde la antena debe verse la torre sin árboles, techos ni construcciones nuevas en el camino; un árbol que creció o se mueve con el viento tumba el enlace a ratos. Toma foto hacia la torre para la ficha.","obligatorio":true,"sintomas":["sin_servicio","intermitente"],"variantes":[],"campos":[],"siMal":[{"cuando":"Soporte flojo o mástil que se mueve","hacer":"Asegúralo y vuelve a alinear.","salida":"resuelve"},{"cuando":"Hay obstáculo hacia la torre","hacer":"Sube el mástil o reubica la antena donde se vea la torre, y alinea.","salida":"resuelve"},{"cuando":"No hay forma de librar el obstáculo","hacer":"Foto y aviso a la oficina para definirlo con el cliente. No es del ingeniero.","salida":"comercial"},{"cuando":"No es seguro subir","hacer":"Marca «No pude: condición insegura». No cuenta en tu contra y sí te deja escalar.","salida":""}],"seguridad":false,"posicion":""},
                {"id":"r_t_entrar","bloque":"Antena","titulo":"Entra a la página de la antena y mira la velocidad del puerto de red","ayuda":"Conecta el portátil por cable al puerto LAN del PoE. La clave de la antena se pide por LLAMADA al ingeniero o a la oficina; nunca por chat, y no se escribe en la app. En la página principal busca la velocidad del puerto de red (cable): debe decir 100 completo (full) o más. No cambies ninguna configuración todavía y NO resetees la antena.","obligatorio":true,"sintomas":["sin_servicio","lento","intermitente"],"variantes":[],"campos":[{"id":"r_t_entrar_puerto","etiqueta":"Velocidad del puerto de red","tipo":"opcion","opciones":[{"v":"full","t":"100 o 1000 completo","color":"verde"},{"v":"bajo","t":"10, o medio (half)","color":"rojo"},{"v":"no_responde","t":"La antena no responde","color":"rojo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Marca 10 o medio (half)","hacer":"Es cable o conector: poncha de nuevo o cambia el cable.","salida":"resuelve","si":{"campo":"r_t_entrar_puerto","v":["bajo"]}},{"cuando":"La antena no responde por cable","hacer":"Prueba con otro cable y con otro PoE del MISMO voltaje (míralo en la etiqueta de la antena). Si sigue, cambia la antena por una preconfigurada.","salida":"resuelve","si":{"campo":"r_t_entrar_puerto","v":["no_responde"]}},{"cuando":"No tienes la clave","hacer":"Llama al ingeniero o a la oficina para que te la dicten. Nunca por chat.","salida":""}],"seguridad":false,"posicion":""},
                {"id":"r_t_torre","bloque":"Enlace","titulo":"Confirma que la antena está conectada a la torre correcta","ayuda":"En la página de la antena mira a qué red (nombre de la torre o sector) está conectada y la distancia que marca. Compárala con la torre asignada en la orden; si no la trae, pídela a la oficina. Si necesitas buscar redes, solo MIRA la lista: no cambies frecuencia, ancho de canal ni modo.","obligatorio":true,"sintomas":["sin_servicio","lento","intermitente"],"variantes":[],"campos":[],"siMal":[{"cuando":"Conectada a otra torre","hacer":"Fíjala a la torre correcta (el nombre de red asignado) y alinea hacia ella.","salida":"resuelve"},{"cuando":"No ve la torre y los demás clientes de esa torre están bien","hacer":"Es alineación u obstáculo: sigue con la vista a la torre y la señal.","salida":""},{"cuando":"No ve la torre y la oficina ve 3 o más caídos de esa torre","hacer":"Es falla masiva: botón rojo y llamada al ingeniero una sola vez. No subas a la torre.","salida":"masiva"}],"seguridad":false,"posicion":""},
                {"id":"r_t_senal","bloque":"Enlace","titulo":"Mide la señal de las dos cadenas; si está peor que -65, alinea fino","ayuda":"En la página de la antena mira la señal de las dos cadenas (polaridades). Bueno: -45 a -65 y 5 o menos de diferencia entre las dos; más fuerte que -40 satura. Si está peor que -65, alinea fino (después de la parada de seguridad): mueve muy despacio a los lados y luego arriba-abajo, espera que el número cambie y aprieta en el mejor punto.","obligatorio":true,"sintomas":["sin_servicio","lento","intermitente"],"variantes":[],"campos":[{"id":"r_t_senal_llegada","etiqueta":"Señal al llegar (la peor de las dos cadenas)","tipo":"numero","opciones":[],"unidad":"dBm","semaforo":"senal_radio","sinDato":"No engancha / no marca"},{"id":"r_t_senal_final","etiqueta":"Señal al terminar (si no alineaste, repite el número)","tipo":"numero","opciones":[],"unidad":"dBm","semaforo":"senal_radio","sinDato":"No engancha / no marca"}],"siMal":[{"cuando":"Amarillo o rojo (peor que -65)","hacer":"Alinea fino hasta dejarla en verde y aprieta bien el soporte.","salida":"resuelve","si":{"campo":"r_t_senal_llegada","color":["amarillo"]}},{"cuando":"No sube de -72 después de alinear","hacer":"Obstáculo o demasiada distancia: revisa la vista a la torre. Si no hay forma, foto y aviso a la oficina.","salida":"comercial"},{"cuando":"Una cadena mucho peor que la otra (más de 5)","hacer":"Antena torcida o dañada: nivélala; si sigue igual, cámbiala.","salida":"resuelve"},{"cuando":"Más fuerte que -40","hacer":"Satura por estar muy cerca de la torre. No desalinees la antena ni toques la potencia: anota las dos cadenas y pasa la ficha por MENSAJE al grupo de la sede; lo decide el ingeniero.","salida":"ingeniero_mensaje"}],"seguridad":false,"posicion":""},
                {"id":"r_t_calidad","bloque":"Enlace","titulo":"Mira la calidad del enlace (CCQ) y la velocidad del enlace","ayuda":"En la página de la antena busca la calidad del enlace (CCQ o calidad, en %) y la velocidad del enlace en bajada y subida. Bueno: 90 % o más y velocidad estable de al menos 3 veces el plan. Buena señal con mala calidad es interferencia. NUNCA cambies la frecuencia ni el ancho de canal: tumbas a los demás clientes de la torre.","obligatorio":true,"sintomas":["lento","intermitente"],"variantes":[],"campos":[{"id":"r_t_calidad_ccq","etiqueta":"Calidad del enlace (CCQ)","tipo":"numero","opciones":[],"unidad":"%","semaforo":"ccq","sinDato":"No reporta"}],"siMal":[{"cuando":"Señal buena y calidad menor de 90 %","hacer":"Es interferencia: realinea. Si sigue igual, capturas y ficha por MENSAJE al grupo de soporte de la sede.","salida":"ingeniero_mensaje"},{"cuando":"Señal mala y calidad mala","hacer":"Primero arregla la señal: alineación, obstáculo o cable.","salida":""},{"cuando":"Velocidad del enlace menor de 3 veces el plan","hacer":"Realinea y revisa el cable. Si no mejora con buena señal, ficha por MENSAJE con capturas.","salida":"ingeniero_mensaje"}],"seguridad":false,"posicion":""},
                {"id":"r_t_tiempos","bloque":"Enlace","titulo":"Compara el tiempo encendida de la antena con el tiempo del enlace","ayuda":"En la página de la antena hay dos relojes: cuánto lleva ENCENDIDA y cuánto lleva CONECTADA a la torre. Pide a la oficina el tiempo de la sesión del cliente. Bueno: los tres largos y parecidos. Así se sabe si lo que se cae es la corriente, el enlace o la sesión.","obligatorio":true,"sintomas":["intermitente"],"variantes":[],"campos":[{"id":"r_t_tiempos_cual","etiqueta":"Qué muestran los tiempos","tipo":"opcion","opciones":[{"v":"parecidos","t":"Largos y parecidos","color":"verde"},{"v":"enlace_corto","t":"Antena con días, enlace de minutos","color":"rojo"},{"v":"reinicia","t":"La antena se reinicia sola","color":"rojo"},{"v":"sesion_corta","t":"Antena y enlace largos, sesión corta","color":"rojo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Antena con días encendida y enlace de minutos","hacer":"Es señal o interferencia: revisa alineación, vista a la torre y calidad del enlace.","salida":""},{"cuando":"La antena se reinicia sola","hacer":"Es PoE, cable o toma: cambia el PoE y revisa el cable entero.","salida":"resuelve","si":{"campo":"r_t_tiempos_cual","v":["reinicia"]}},{"cuando":"Antena y enlace largos, sesión del cliente corta","hacer":"Ficha por MENSAJE al grupo de soporte de la sede, con los tres tiempos.","salida":"ingeniero_mensaje","si":{"campo":"r_t_tiempos_cual","v":["sesion_corta"]}}],"seguridad":false,"posicion":""},
                {"id":"r_t_conexion","bloque":"Conexión","titulo":"Mira dónde está la conexión del cliente y en qué estado está","ayuda":"La conexión (usuario y clave del servicio) puede estar en la antena o en el router: mira en cuál y su estado. Bueno: conectado y con dirección. Copia el MENSAJE EXACTO del error. El usuario y la clave se confirman por LLAMADA con la oficina; nunca se escriben aquí ni en el chat. NO resetees nada sin tener esos datos y la plantilla en la mano.","obligatorio":true,"sintomas":["sin_servicio"],"variantes":[],"campos":[{"id":"r_t_conexion_msg","etiqueta":"Mensaje exacto del error (sin usuario ni clave)","tipo":"texto","opciones":[],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Falla de autenticación","hacer":"Corrige el usuario o la clave, dictados por llamada. La oficina confirma que el cliente está activo.","salida":"resuelve"},{"cuando":"Dice que ya hay una sesión activa","hacer":"Si acabas de cambiar el equipo: deja el viejo desconectado, espera unos minutos y vuelve a intentar. Si sigue, la oficina mira en Winbox (solo mirar) si ese usuario está puesto en otro equipo.","salida":""},{"cuando":"Sesión activa y ese usuario está puesto en el equipo de otro cliente","hacer":"El usuario está mal escrito aquí o allá: se confirma por llamada y se corrige; no es del ingeniero.","salida":""},{"cuando":"Sesión activa, no está en ningún otro equipo y sigue igual","hacer":"Ficha por MENSAJE al grupo de la sede. Nadie desconecta sesiones a mano.","salida":""},{"cuando":"Equipo reseteado o sin configuración","hacer":"Configúralo con la plantilla de la sede. No es del ingeniero.","salida":"resuelve"},{"cuando":"Enlace bueno, plantilla bien, cliente activo y no levanta","hacer":"Ficha por MENSAJE al grupo de soporte de la sede, con el mensaje exacto.","salida":"ingeniero_mensaje"}],"seguridad":false,"posicion":""},
                {"id":"r_t_red_casa","bloque":"Conexión","titulo":"Confirma que la casa recibe dirección y el router no está reseteado","ayuda":"Conecta tu portátil por cable: debe recibir dirección en segundos. Mira que el router wifi tenga el nombre y la clave de wifi del cliente y no los de fábrica. Si hay router propio del cliente, revisa que el cable entre por el puerto de internet (WAN) y prueba sin él. No escribas direcciones ni claves en la app.","obligatorio":true,"sintomas":["sin_servicio","wifi"],"variantes":[],"campos":[],"siMal":[{"cuando":"Router reseteado (wifi con nombre de fábrica)","hacer":"Configúralo con la plantilla. No es del ingeniero.","salida":"resuelve"},{"cuando":"Sin el router del cliente sí funciona","hacer":"El problema es de ese router: muéstraselo al cliente y déjalo anotado.","salida":"resuelve"},{"cuando":"No recibe dirección","hacer":"Cambia el cable de red, prueba otro puerto y revisa dónde está la conexión del cliente.","salida":""}],"seguridad":false,"posicion":""},
                {"id":"r_t_pruebas","bloque":"Pruebas","titulo":"Haz los pings en orden y la prueba de velocidad por cable","ayuda":"Por cable, 10 paquetes cada uno: 1) ping a la antena; 2) desde la antena a su puerta de enlace; 3) ping a 8.8.8.8; 4) abre una página; 5) prueba de velocidad sin otros aparatos usando internet. Bueno: 0 perdidos y 80 % del plan o más. Anota los perdidos del peor ping. No escribas direcciones en la app.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[{"id":"r_t_pruebas_perdidos","etiqueta":"Perdidos en el peor ping","tipo":"numero","opciones":[],"unidad":"perdidos de 10","semaforo":"perdidos","sinDato":"No responde"},{"id":"r_t_pruebas_bajada","etiqueta":"Velocidad de bajada por cable","tipo":"numero","opciones":[],"unidad":"Mbps","semaforo":"","sinDato":"No navega"}],"siMal":[{"cuando":"Falla el ping a la antena, o de la antena a su puerta de enlace","hacer":"El primero es cable o PoE; el segundo es el enlace (señal, alineación o calidad). Vuelve a ese paso.","salida":""},{"cuando":"8.8.8.8 responde pero no abren páginas, solo este cliente","hacer":"Es el DNS: corrígelo con la plantilla.","salida":"resuelve"},{"cuando":"Lo mismo en varios clientes (lo confirma la oficina)","hacer":"Llamada al ingeniero, una sola vez.","salida":"ingeniero_llamada"},{"cuando":"Lento con enlace bueno y plan correcto, o solo de 7 a 10 de la noche","hacer":"Torre saturada o límite mal puesto: capturas y ficha por MENSAJE al grupo de soporte de la sede.","salida":"ingeniero_mensaje"}],"seguridad":false,"posicion":""},
                {"id":"r_t_wifi","bloque":"Pruebas","titulo":"Mide el wifi donde se queja el cliente: señal, canal y aparatos","ayuda":"Con una aplicación de medir wifi en el celular, párate donde el cliente se queja y anota la señal. Bueno: mejor que -65; de -65 a -75 regular; peor que -75 no sirve. Mira si el canal está lleno de redes vecinas y cuántos aparatos hay. Esto es el canal del WIFI de la casa: la frecuencia de la ANTENA del techo no se toca.","obligatorio":true,"sintomas":["lento","wifi"],"variantes":[],"campos":[{"id":"r_t_wifi_senal","etiqueta":"Señal wifi donde se queja el cliente","tipo":"numero","opciones":[],"unidad":"dBm","semaforo":"wifi","sinDato":"No llega la red"}],"siMal":[{"cuando":"Señal amarilla o roja donde se queja","hacer":"Reubica el router a un punto central y alto, lejos de espejos y electrodomésticos.","salida":"resuelve","si":{"campo":"r_t_wifi_senal","color":["rojo","amarillo"]}},{"cuando":"Casa grande o de varios pisos","hacer":"Ofrece un repetidor o un segundo punto por cable y avisa a la oficina. Nunca es del ingeniero.","salida":"comercial"},{"cuando":"Canal lleno de redes vecinas","hacer":"Cambia el canal del wifi del router (no el de la antena) al más libre.","salida":"resuelve"},{"cuando":"Por cable va bien y por wifi va mal","hacer":"Es wifi o el aparato del cliente, no el servicio. Explícale y cierra.","salida":"resuelve"}],"seguridad":false,"posicion":""}
            ]
        },
        tv: {
            nombre: "Televisión", icono: "📺",
            sintomas: [{"id":"nada_se_ve","t":"Ningún canal se ve / la aplicación no abre"},{"id":"algunos_canales","t":"Faltan o fallan algunos canales"},{"id":"pixelado","t":"Se congela o se pixela"},{"id":"un_solo_tv","t":"Falla en un solo TV (los otros sí se ven)"}],
            variantes: [{"id":"tvbox","t":"TV Box (cajita conectada al TV)"},{"id":"app_tv","t":"Aplicación en el Smart TV"},{"id":"app_movil","t":"Aplicación en el celular"},{"id":"rf","t":"Señal por cable coaxial (RF)"}],
            oficina: [
                {"id":"t_o_contratada","bloque":"Servicio","titulo":"Confirma que tiene TV contratada y de qué tipo es","ayuda":"Mira en WispHub si el plan incluye TV y cuántos televisores. Pregunta cómo la ve: cajita conectada al TV por HDMI (TV Box), aplicación en el Smart TV, aplicación en el celular, o cable coaxial (el grueso de rosca) que sale del módem al TV. Si escogiste mal el tipo arriba, devuélvete y cámbialo: los pasos cambian. Si tiene dos tipos, escoge el del TV que falla.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[],"siMal":[{"cuando":"No tiene TV contratada","hacer":"No es una falla, es una venta. Pásalo a comercial y cierra el caso.","salida":"comercial"},{"cuando":"Tiene más TV o aparatos de los contratados","hacer":"El plan no los cubre todos. Explícale y ofrece el punto o la pantalla adicional.","salida":"comercial"}],"seguridad":false,"posicion":""},
                {"id":"t_o_pantalla","bloque":"Falla","titulo":"Pide que lean la pantalla palabra por palabra y en cuántos TV pasa","ayuda":"Que el cliente lea lo que dice la pantalla tal cual, sin resumir: «Sin señal», «No signal», «Error de usuario», «Sin conexión», un código, pantalla negra o imagen a cuadros. Pregunta en cuántos televisores pasa y cuántos tiene. Si puede, que mande foto por WhatsApp (la foto no se guarda en la app). No pidas ni anotes claves ni usuarios.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[{"id":"t_o_pantalla_msg","etiqueta":"Mensaje exacto de la pantalla","tipo":"texto","opciones":[],"unidad":"","semaforo":"","sinDato":"No sale ningún mensaje"},{"id":"t_o_pantalla_cuantos","etiqueta":"En cuántos TV pasa","tipo":"opcion","opciones":[{"v":"unico","t":"Solo tiene un TV","color":""},{"v":"todos","t":"En todos los TV de la casa","color":"rojo"},{"v":"varios","t":"En varios, pero no en todos","color":"amarillo"},{"v":"uno","t":"En uno solo; los otros se ven","color":"amarillo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Un solo TV malo y los otros se ven","hacer":"Es ese TV, su cable o su caja, no la red. Cambia el síntoma a «un solo TV» y sigue; si no se arregla por teléfono, orden al técnico.","salida":"tecnico","si":{"campo":"t_o_pantalla_cuantos","v":["uno"]}},{"cuando":"Dice «Sin señal» o «No signal»","hacer":"Casi siempre es la entrada equivocada del TV o la caja apagada. Sigue con el paso de entrada y control.","salida":""},{"cuando":"Habla de usuario, cuenta, clave o dispositivos","hacer":"Es de la cuenta de la aplicación: revísala en el paso de la cuenta. Nunca pidas la clave por chat.","salida":""}],"seguridad":false,"posicion":""},
                {"id":"t_o_internet","bloque":"Conexión","titulo":"Pregunta si el internet de la casa funciona en otro aparato","ayuda":"Que abra una página o un video en un celular conectado al wifi de la casa (no con datos). Si es la app del celular, que pruebe siempre en ese wifi. Si dudas, mira en Winbox que la sesión del cliente esté activa, que no esté en la lista de cortados y hazle ping desde el Mikrotik: SOLO MIRAR, no cambies nada. En cable coaxial, si también cayó el internet, el daño es de la fibra.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[{"id":"t_o_internet_ok","etiqueta":"El internet de la casa","tipo":"opcion","opciones":[{"v":"si","t":"Sí funciona bien","color":"verde"},{"v":"lento","t":"Funciona lento o se cae","color":"amarillo"},{"v":"no","t":"No funciona","color":"rojo"},{"v":"solotv","t":"Solo tiene TV, sin internet","color":""}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"El internet no funciona","hacer":"No sigas con TV: pasa a la lista de FIBRA o de RADIO según el cliente. Al volver el internet vuelve la TV.","salida":""},{"cuando":"Internet lento o se cae a ratos","hacer":"La TV se pixela por eso. Sigue la lista de FIBRA o RADIO con el síntoma «lento» o «se cae a ratos».","salida":""},{"cuando":"Estaba con datos del celular y no en el wifi","hacer":"Que se conecte al wifi de la casa y pruebe de nuevo la aplicación.","salida":"resuelve"},{"cuando":"Solo tiene TV y no hay cómo probar internet","hacer":"Mira en la plataforma de la OLT que el módem esté en línea y con potencia en verde. Si sale LOS o rojo: orden al técnico.","salida":"tecnico"}],"seguridad":false,"posicion":""},
                {"id":"t_o_testigo","bloque":"Falla general","titulo":"Mira el TV testigo de la oficina y si hay más quejas de TV hoy","ayuda":"Prende el TV testigo de la oficina con el mismo tipo de servicio del cliente y mira los mismos canales que él dice. Revisa también si hoy llamaron más clientes por TV en ese municipio. Falla masiva de TV = el testigo sin señal o varios clientes con lo mismo. Si tu oficina no tiene TV testigo, marca «No hay TV testigo» y guíate por las quejas.","obligatorio":true,"sintomas":["nada_se_ve","algunos_canales","pixelado"],"variantes":[],"campos":[{"id":"t_o_testigo_ve","etiqueta":"Cómo se ve el TV testigo","tipo":"opcion","opciones":[{"v":"bien","t":"Se ve bien","color":"verde"},{"v":"canales","t":"Fallan los mismos canales","color":"rojo"},{"v":"nada","t":"Tampoco se ve","color":"rojo"},{"v":"nohay","t":"No hay TV testigo","color":""}],"unidad":"","semaforo":"","sinDato":""},{"id":"t_o_testigo_otros","etiqueta":"Clientes con queja de TV hoy en ese municipio","tipo":"opcion","opciones":[{"v":"solo","t":"Solo este","color":"verde"},{"v":"dos","t":"2 clientes","color":"amarillo"},{"v":"tres","t":"3 o más","color":"rojo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"El TV testigo tampoco se ve","hacer":"Es falla general. Botón rojo «Reportar falla masiva» con la hora, y una sola llamada al ingeniero. No abras órdenes una por una.","salida":"masiva","si":{"campo":"t_o_testigo_ve","v":["nada"]}},{"cuando":"3 o más clientes con la misma queja de TV","hacer":"Botón rojo «Reportar falla masiva» con cuántos afectados y desde qué hora. Una sola llamada al ingeniero.","salida":"masiva","si":{"campo":"t_o_testigo_otros","v":["tres"]}},{"cuando":"En el testigo fallan los mismos canales","hacer":"No es del cliente, es la fuente de esos canales. Reporta falla masiva diciendo cuáles y avisa por mensaje en el grupo de la sede.","salida":"masiva","si":{"campo":"t_o_testigo_ve","v":["canales"]}},{"cuando":"2 clientes con lo mismo","hacer":"Todavía no es masiva. Sigue la lista y vuelve a mirar en 15 minutos; si llega un tercero, repórtala.","salida":""}],"seguridad":false,"posicion":""},
                {"id":"t_o_entrada","bloque":"Equipo en casa","titulo":"Revisa entrada del TV (Source/HDMI), control con pilas y corriente","ayuda":"Con el control DEL TV, botón Source, Input o Entrada: TV Box = el HDMI donde está la cajita; cable coaxial = «TV», «Antena» o «Cable». El control de la caja debe tener pilas buenas y apuntar a la caja. La caja debe tener su bombillo encendido y el cable HDMI bien metido en las dos puntas. En Smart TV, que abra la aplicación desde el menú de inicio.","obligatorio":true,"sintomas":["nada_se_ve","un_solo_tv"],"variantes":["tvbox","app_tv","rf"],"campos":[],"siMal":[{"cuando":"Estaba en otra entrada o sin pilas","hacer":"Se corrige por teléfono. Confirma que ya ve canales y cierra el caso.","salida":"resuelve"},{"cuando":"La caja no prende en ninguna toma","hacer":"Orden al técnico con caja y adaptador de repuesto.","salida":"tecnico"},{"cuando":"Entrada correcta y sigue «Sin señal»","hacer":"Que cambie el cable HDMI de puerto en el TV. Si sigue igual, orden al técnico para prueba cruzada.","salida":"tecnico"}],"seguridad":false,"posicion":""},
                {"id":"t_o_reinicio","bloque":"Equipo en casa","titulo":"Reinicia caja o TV y el módem: 30 segundos sin corriente","ayuda":"Desconectar de la luz 30 segundos la caja o el TV y el módem; prender primero el módem, esperar 2 minutos y luego la caja o el TV. Si es aplicación: cerrarla del todo y abrirla; si pide actualizar, que la actualice. NO oprimir el botón reset, NO restablecer de fábrica la caja, NO tocar el cable de fibra. En cable coaxial NO hacer búsqueda de canales.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[],"siMal":[{"cuando":"Volvió y se quedó bien","hacer":"Caso resuelto. Dile que si se repite el mismo día vuelva a llamar.","salida":"resuelve"},{"cuando":"Vuelve pero se repite varias veces al día","hacer":"Orden al técnico para revisar wifi, cables y energía del equipo.","salida":"tecnico"},{"cuando":"El cliente ya oprimió reset o restableció la caja","hacer":"Orden al técnico para configurarla de nuevo. La clave de la cuenta se dicta por llamada, nunca por chat.","salida":"tecnico"}],"seguridad":false,"posicion":""},
                {"id":"t_o_cuenta","bloque":"Aplicación","titulo":"Revisa la cuenta de la aplicación: activa, vigente y dispositivos","ayuda":"En el panel de cuentas de TV (si tu oficina tiene acceso) busca la cuenta del cliente y mira: si está activa, hasta cuándo está vigente y cuántos aparatos tiene conectados contra los permitidos. Aquí NUNCA se anota la clave ni el usuario. Si hay que volver a entrar a la aplicación, la clave se le dicta al cliente por llamada. Sin acceso al panel: marca «No pude».","obligatorio":true,"sintomas":["nada_se_ve","algunos_canales","un_solo_tv"],"variantes":["tvbox","app_tv","app_movil"],"campos":[{"id":"t_o_cuenta_estado","etiqueta":"Estado de la cuenta de TV","tipo":"opcion","opciones":[{"v":"activa","t":"Activa y vigente","color":"verde"},{"v":"vencida","t":"Vencida","color":"rojo"},{"v":"bloqueada","t":"Bloqueada o suspendida","color":"rojo"},{"v":"limite","t":"Llegó al tope de dispositivos","color":"amarillo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Vencida o bloqueada y el cliente está al día","hacer":"La arregla la oficina en el panel. Pide que cierre y abra la aplicación y confirma que ya ve.","salida":"resuelve","si":{"campo":"t_o_cuenta_estado","v":["vencida","bloqueada"]}},{"cuando":"Bloqueada por mora","hacer":"Se cobra y se reactiva. Nunca es del ingeniero.","salida":"cartera"},{"cuando":"Tope de dispositivos o canales fuera del paquete","hacer":"Cierra en el panel las sesiones viejas. Más pantallas o canales fuera del plan: es una venta.","salida":"comercial","si":{"campo":"t_o_cuenta_estado","v":["limite"]}},{"cuando":"Activa, internet bueno y no abre en ningún aparato","hacer":"Ficha por mensaje al grupo de soporte de la sede, con el mensaje exacto de la pantalla.","salida":"ingeniero_mensaje"}],"seguridad":false,"posicion":""},
                {"id":"t_o_youtube","bloque":"Aplicación","titulo":"Pide abrir YouTube en ese mismo TV y pregunta si va por cable o wifi","ayuda":"Que abra YouTube u otra aplicación de video en el MISMO TV, caja o celular donde falla la TV. Pregunta si ese aparato está por cable de red (UTP) o por wifi y a qué distancia del módem. Si YouTube se ve bien, el internet de ese aparato está bien y la falla es de la aplicación o la cuenta. Si también se pega, es el wifi o el internet.","obligatorio":true,"sintomas":["nada_se_ve","pixelado","un_solo_tv"],"variantes":["tvbox","app_tv","app_movil"],"campos":[{"id":"t_o_youtube_abre","etiqueta":"YouTube en ese mismo aparato","tipo":"opcion","opciones":[{"v":"bien","t":"Abre y se ve bien","color":"verde"},{"v":"pega","t":"Abre pero se pega","color":"amarillo"},{"v":"no","t":"No abre","color":"rojo"},{"v":"nohay","t":"No tiene YouTube","color":""}],"unidad":"","semaforo":"","sinDato":""},{"id":"t_o_youtube_red","etiqueta":"Cómo está conectado ese aparato","tipo":"opcion","opciones":[{"v":"cable","t":"Por cable de red","color":"verde"},{"v":"cerca","t":"Wifi, cerca del módem","color":"verde"},{"v":"lejos","t":"Wifi, lejos o con paredes","color":"amarillo"},{"v":"nosabe","t":"No sabe","color":""}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"YouTube no abre en ese aparato","hacer":"Es la conexión de ese aparato. Que revise que esté en el wifi de la casa; si no conecta, orden al técnico.","salida":"tecnico","si":{"campo":"t_o_youtube_abre","v":["no"]}},{"cuando":"Se pega y está por wifi lejos del módem","hacer":"Es cobertura wifi, nunca del ingeniero. Orden al técnico para dejar la caja por cable, reubicar el módem o poner repetidor.","salida":"tecnico"},{"cuando":"YouTube bien y la aplicación de TV no","hacer":"La red está bien. Revisa la cuenta; si está activa, orden al técnico para actualizar la app y probar con cuenta de prueba.","salida":"tecnico"}],"seguridad":false,"posicion":""},
                {"id":"t_o_rf_modem","bloque":"Cable coaxial","titulo":"Mira el bombillo de TV del módem y el cable coaxial bien apretado","ayuda":"En el módem busca el bombillo que dice TV, CATV o RF: debe estar encendido (algunos módems no lo tienen). El cable coaxial sale del puerto de rosca del módem y va al TV: que esté apretado a mano en las dos puntas, sin doblarlo. Si tienes la plataforma de la OLT, mira si la TV (CATV) de ese módem aparece activada: solo mirar. No tocar el cable de fibra.","obligatorio":true,"sintomas":["nada_se_ve","algunos_canales","pixelado"],"variantes":["rf"],"campos":[{"id":"t_o_rf_modem_bombillo","etiqueta":"Bombillo de TV del módem","tipo":"opcion","opciones":[{"v":"on","t":"Encendido","color":"verde"},{"v":"off","t":"Apagado o en rojo","color":"rojo"},{"v":"nohay","t":"El módem no tiene ese bombillo","color":""}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Cable coaxial suelto o flojo","hacer":"Que lo apriete a mano en el módem y en el TV. Confirma que ya ve canales.","salida":"resuelve"},{"cuando":"Bombillo de TV apagado con internet bueno, un solo cliente","hacer":"Orden al técnico: revisa la luz de TV que llega y el puerto de TV del módem.","salida":"tecnico","si":{"campo":"t_o_rf_modem_bombillo","v":["off"]}},{"cuando":"En la plataforma la TV del módem sale desactivada y está al día","hacer":"No la cambies tú. Pide a la persona autorizada de la sede que la active; si no puede, mensaje al ingeniero.","salida":"autorizador"},{"cuando":"Bombillo de TV apagado en varios clientes","hacer":"Es falla general de TV. Botón rojo «Reportar falla masiva» y una sola llamada al ingeniero.","salida":"masiva"}],"seguridad":false,"posicion":""},
                {"id":"t_o_rf_cables","bloque":"Cable coaxial","titulo":"Pregunta por divisores, cables nuevos y si buscaron canales","ayuda":"Pregunta si el cliente puso un divisor (la T o cajita que reparte la señal a más TV), alargó el cable o movió el TV. Cada divisor debilita la señal y los canales altos se pixelan primero. Pregunta si ya hicieron «búsqueda de canales». NO la guíes por teléfono: con señal débil la búsqueda borra los canales. Se resintoniza solo en sitio, con los parámetros de la plantilla de la sede.","obligatorio":false,"sintomas":[],"variantes":["rf"],"campos":[],"siMal":[{"cuando":"El cliente puso divisor o alargó el cable","hacer":"Que conecte un solo TV directo al módem con el cable original. Si así se ve bien, el daño es de su divisor o cable.","salida":"resuelve"},{"cuando":"Quiere TV en más puntos","hacer":"Es un punto adicional: lo instala el técnico con divisor y cable buenos. Pásalo a comercial.","salida":"comercial"},{"cuando":"Hicieron búsqueda y se borraron los canales","hacer":"Orden al técnico: resintoniza en sitio, con buena señal y con los parámetros de la plantilla de la sede.","salida":"tecnico"}],"seguridad":false,"posicion":""}
            ],
            tecnico: [
                {"id":"t_t_falla","bloque":"Falla","titulo":"Mira la falla en cada TV y copia lo que dice la pantalla","ayuda":"Prende cada TV de la casa y mira tú mismo la falla: no te quedes con lo que dice la orden. Copia el mensaje palabra por palabra o el código. Toma una foto de la pantalla para el grupo de WhatsApp de la sede (la foto no se guarda en la app; si sale una clave o un usuario, recórtala). Si falla un solo TV y los otros se ven, cambia el síntoma a «un solo TV».","obligatorio":true,"sintomas":[],"variantes":[],"campos":[{"id":"t_t_falla_msg","etiqueta":"Mensaje exacto de la pantalla","tipo":"texto","opciones":[],"unidad":"","semaforo":"","sinDato":"No sale ningún mensaje"}],"siMal":[{"cuando":"Falla un solo TV y los otros se ven","hacer":"No es la red ni la cuenta. Cambia el síntoma a «un solo TV» y haz la prueba cruzada.","salida":""},{"cuando":"Dice «Sin señal» o «No signal»","hacer":"Es entrada equivocada, caja apagada o cable HDMI o coaxial suelto. Lo arreglas tú en el paso de entrada y control.","salida":""},{"cuando":"Habla de usuario, cuenta o dispositivos","hacer":"Pide a la oficina revisar la cuenta en el panel. La clave se pide por llamada a la oficina, nunca por chat.","salida":""}],"seguridad":false,"posicion":""},
                {"id":"t_t_entrada","bloque":"Equipo en casa","titulo":"Revisa entrada del TV, control con pilas, cable HDMI y corriente","ayuda":"Entrada correcta con el control del TV (Source/Input): el HDMI de la cajita, o «TV/Antena/Cable» si es coaxial. Prueba el control con pilas nuevas. Cambia el cable HDMI de puerto y, si dudas, pon uno tuyo. La caja con su adaptador original y el bombillo encendido. En Smart TV abre la aplicación desde el menú de inicio.","obligatorio":true,"sintomas":["nada_se_ve","un_solo_tv"],"variantes":["tvbox","app_tv","rf"],"campos":[],"siMal":[{"cuando":"Estaba en otra entrada, sin pilas o HDMI flojo","hacer":"Corrígelo, muéstrale al cliente cómo se cambia la entrada y cierra.","salida":"resuelve"},{"cuando":"La caja no prende con un adaptador bueno","hacer":"Caja dañada: cámbiala por la de prueba. Los seriales van en INVENTARIO, no en esta lista.","salida":"resuelve"},{"cuando":"Puerto HDMI del TV dañado","hacer":"Es del televisor del cliente. Muéstrale la prueba con otro puerto u otro TV y déjalo anotado.","salida":"resuelve"}],"seguridad":false,"posicion":""},
                {"id":"t_t_reinicio","bloque":"Equipo en casa","titulo":"Reinicia en orden: módem, router, caja y TV","ayuda":"Todo 30 segundos sin corriente. Prende primero el módem o la antena y espera 2 minutos; luego el router, después la caja y por último el TV. Es apagar y prender: NO oprimas reset ni restablezcas de fábrica la caja, el módem o el router sin tener en la mano usuario y clave de conexión, VLAN, nombre y clave del wifi y los datos de la cuenta de TV.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[],"siMal":[{"cuando":"Volvió con el reinicio","hacer":"Sigue con las pruebas para saber por qué se cayó (wifi, energía, hora). No cierres solo con el reinicio.","salida":""},{"cuando":"La caja se reinicia sola o se queda en el logo","hacer":"Prueba con otro adaptador. Si sigue, cámbiala por la caja de prueba.","salida":"resuelve"},{"cuando":"Alguien ya la restableció de fábrica","hacer":"Configúrala de nuevo. Pide los datos de la cuenta por llamada a la oficina, nunca por chat.","salida":"resuelve"}],"seguridad":false,"posicion":""},
                {"id":"t_t_vecinos","bloque":"Falla general","titulo":"Pregunta a un vecino con TV y pide mirar el TV testigo de la oficina","ayuda":"Pregunta a uno o dos vecinos que tengan TV con nosotros si les pasa lo mismo y desde qué hora. Llama a la oficina para que miren el TV testigo (si lo hay) y si hay más quejas de TV hoy. Falla masiva de TV = varios clientes sin TV o el TV testigo sin señal. No anotes nombres ni direcciones de los vecinos: solo cuántos.","obligatorio":true,"sintomas":["nada_se_ve","algunos_canales","pixelado"],"variantes":[],"campos":[{"id":"t_t_vecinos_cuantos","etiqueta":"Cuántos más están sin TV","tipo":"opcion","opciones":[{"v":"solo","t":"Solo este cliente","color":"verde"},{"v":"pocos","t":"1 o 2 más","color":"amarillo"},{"v":"varios","t":"3 o más, o el TV testigo","color":"rojo"},{"v":"nohay","t":"No hay vecinos con TV","color":""}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"3 o más sin TV, o el TV testigo sin señal","hacer":"Botón rojo «Reportar falla masiva» con hora y cuántos. Una sola llamada al ingeniero. No sigas desarmando la casa.","salida":"masiva","si":{"campo":"t_t_vecinos_cuantos","v":["varios"]}},{"cuando":"1 o 2 vecinos con lo mismo","hacer":"Avisa a la oficina para que esté pendiente. Termina tus pruebas; si aparece un tercero, se reporta masiva.","salida":""},{"cuando":"A los vecinos les fallan los mismos canales","hacer":"Es la fuente de esos canales. Reporta falla masiva diciendo cuáles y avisa por mensaje al grupo de la sede.","salida":"masiva"}],"seguridad":false,"posicion":""},
                {"id":"t_t_cruzada","bloque":"Pruebas","titulo":"Un solo TV malo: cambia de sitio el TV, la caja y el cable","ayuda":"Cambia UNA cosa a la vez y mira con cuál se va la falla: 1) la caja buena al TV malo; 2) la caja mala al TV bueno; 3) cambia el cable HDMI, el de red o el coaxial por uno tuyo. En coaxial conecta el TV malo directo a la salida del módem con cable corto. En Smart TV prueba la misma cuenta en tu celular. Así sabes si el daño es del TV, de la caja, del cable o de ese punto.","obligatorio":true,"sintomas":["un_solo_tv"],"variantes":["tvbox","app_tv","rf"],"campos":[{"id":"t_t_cruzada_culpable","etiqueta":"Qué resultó malo","tipo":"opcion","opciones":[{"v":"tv","t":"El televisor","color":""},{"v":"caja","t":"La caja","color":"rojo"},{"v":"cable","t":"Un cable o conector","color":"amarillo"},{"v":"punto","t":"Ese punto: wifi débil o toma","color":"amarillo"},{"v":"nada","t":"Nada: todo funciona ahora","color":"verde"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Falla el televisor","hacer":"Es del cliente, no de la red. Muéstrale la prueba con el otro TV y déjalo anotado en el cierre.","salida":"resuelve","si":{"campo":"t_t_cruzada_culpable","v":["tv"]}},{"cuando":"Falla la caja","hacer":"Cámbiala por la caja de prueba y configúrala. Los seriales van en INVENTARIO, no en esta lista.","salida":"resuelve","si":{"campo":"t_t_cruzada_culpable","v":["caja"]}},{"cuando":"Falla un cable o conector","hacer":"Cámbialo por uno bueno y repite la prueba en ese TV.","salida":"resuelve","si":{"campo":"t_t_cruzada_culpable","v":["cable"]}},{"cuando":"Falla ese punto de la casa","hacer":"Es wifi débil o toma mala: mide la señal ahí, deja la caja por cable UTP o reubica.","salida":"resuelve","si":{"campo":"t_t_cruzada_culpable","v":["punto"]}}],"seguridad":false,"posicion":""},
                {"id":"t_t_internet","bloque":"Conexión","titulo":"Prueba primero el internet por cable en el módem","ayuda":"Conecta tu portátil por cable al módem o router. Haz ping de 20 paquetes a 8.8.8.8 y una prueba de velocidad. Bueno: 0 perdidos y 80 % del plan o más; cada TV necesita unas 10 megas libres. 1 perdido: repite la prueba. 2 o más perdidos o velocidad baja: la TV no es el problema, es el internet. No anotes direcciones IP.","obligatorio":true,"sintomas":["nada_se_ve","algunos_canales","pixelado"],"variantes":["tvbox","app_tv","app_movil"],"campos":[{"id":"t_t_internet_perdidos","etiqueta":"Paquetes perdidos en el ping","tipo":"numero","opciones":[],"unidad":"perdidos de 20","semaforo":"perdidos","sinDato":"No responde"},{"id":"t_t_internet_bajada","etiqueta":"Velocidad de bajada por cable","tipo":"numero","opciones":[],"unidad":"Mbps","semaforo":"","sinDato":""}],"siMal":[{"cuando":"2 o más perdidos, no responde o velocidad baja","hacer":"Deja la TV quieta y sigue la lista de FIBRA o de RADIO: arreglado el internet se arregla la TV.","salida":""},{"cuando":"1 paquete perdido","hacer":"Repite el ping de 20. Si vuelve a perder, trátalo como rojo.","salida":""},{"cuando":"Velocidad buena pero no alcanza para los TV que tiene","hacer":"Cada TV gasta unas 10 megas. Explícale y pásalo a comercial para subir el plan.","salida":"comercial"}],"seguridad":false,"posicion":""},
                {"id":"t_t_conexion","bloque":"Conexión","titulo":"Mira si va por cable UTP o wifi, mide la señal y prueba YouTube","ayuda":"Por cable UTP: pásale el probador (8 de 8 hilos) y mira que el puerto prenda. Por wifi: mide la señal con tu celular AL LADO de la caja o del TV: verde mejor que -65, amarillo -65 a -75, rojo peor que -75; usa la red 5G si alcanza. Luego abre YouTube en ese mismo aparato: si también se pega, es la conexión de ese aparato y no la aplicación de TV.","obligatorio":true,"sintomas":["nada_se_ve","pixelado","un_solo_tv"],"variantes":["tvbox","app_tv","app_movil"],"campos":[{"id":"t_t_conexion_senal","etiqueta":"Señal wifi al lado de la caja o TV","tipo":"numero","opciones":[],"unidad":"dBm","semaforo":"wifi","sinDato":"Va por cable UTP"}],"siMal":[{"cuando":"Wifi en amarillo o rojo","hacer":"Deja la caja por cable UTP, o reubica el módem o pon repetidor. Nunca es del ingeniero.","salida":"resuelve","si":{"campo":"t_t_conexion_senal","color":["rojo"]}},{"cuando":"Cable UTP con hilos malos o puerto sin bombillo","hacer":"Poncha de nuevo o cambia el cable y prueba otro puerto del módem.","salida":"resuelve"},{"cuando":"YouTube bien y la aplicación de TV no","hacer":"La conexión está bien. Sigue con hora, aplicación y cuenta de prueba.","salida":""}],"seguridad":false,"posicion":""},
                {"id":"t_t_hora","bloque":"Aplicación","titulo":"Revisa fecha y hora de la caja o TV y que reciba dirección de red","ayuda":"En los ajustes de la caja o del Smart TV: fecha y hora en automático, con la zona horaria de Bogotá. Con la hora mala la aplicación no carga o da error de conexión. En los ajustes de red mira que diga «conectado» y que tenga dirección; no la anotes. Si no recibe dirección, olvida la red wifi y vuelve a conectarla.","obligatorio":true,"sintomas":["nada_se_ve","algunos_canales"],"variantes":["tvbox","app_tv"],"campos":[],"siMal":[{"cuando":"Fecha u hora equivocada","hacer":"Ponla en automático, reinicia la caja y abre de nuevo la aplicación.","salida":"resuelve"},{"cuando":"No recibe dirección de red","hacer":"Olvida el wifi y conéctalo otra vez, o prueba por cable UTP. Si tu portátil tampoco recibe, revisa el router.","salida":"resuelve"}],"seguridad":false,"posicion":""},
                {"id":"t_t_app","bloque":"Aplicación","titulo":"Actualiza la aplicación; si sigue, borra datos y vuelve a entrar","ayuda":"ANTES de borrar datos confirma por llamada con la oficina que tienes la cuenta del cliente: al borrar, la aplicación pide entrar otra vez. Orden: 1) forzar cierre; 2) actualizar desde la tienda; 3) borrar caché; 4) borrar datos y entrar de nuevo. La clave no se escribe en esta app ni en el chat. No restablezcas la caja de fábrica.","obligatorio":true,"sintomas":[],"variantes":["tvbox","app_tv","app_movil"],"campos":[],"siMal":[{"cuando":"No tienes los datos de la cuenta","hacer":"No borres datos. Llama a la oficina y pídelos por llamada; nunca por chat.","salida":""},{"cuando":"La tienda no deja actualizar o no hay espacio","hacer":"Desinstala aplicaciones que no se usan y actualiza. Si la caja es muy vieja, cámbiala por la de prueba.","salida":"resuelve"},{"cuando":"Actualizada, con datos borrados, y sigue el error","hacer":"Anota el mensaje exacto y sigue con la cuenta de prueba para saber si es caja, cuenta o servidor.","salida":""}],"seguridad":false,"posicion":""},
                {"id":"t_t_cuentaprueba","bloque":"Pruebas","titulo":"Prueba con tu celular, con la cuenta de prueba y con caja de prueba","ayuda":"Conectado al wifi del cliente prueba las 4 combinaciones: cuenta del cliente en su caja, cuenta de prueba en su caja, cuenta del cliente en tu celular y cuenta de prueba en tu celular. Así queda claro si el daño es de la caja, de la cuenta o del servidor. Al terminar CIERRA la sesión de la cuenta de prueba. Seriales de cajas cambiadas: en INVENTARIO, no aquí.","obligatorio":true,"sintomas":[],"variantes":["tvbox","app_tv","app_movil"],"campos":[{"id":"t_t_cuentaprueba_res","etiqueta":"Qué mostró la prueba","tipo":"opcion","opciones":[{"v":"caja","t":"Falla solo la caja o TV del cliente","color":"amarillo"},{"v":"cuenta","t":"Falla solo la cuenta del cliente","color":"amarillo"},{"v":"todo","t":"Falla todo, con internet bueno","color":"rojo"},{"v":"nada","t":"Todo funciona ahora","color":"verde"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Falla solo la caja o el TV del cliente","hacer":"Cambia la caja por la de prueba. Si es la aplicación del Smart TV la que no sirve, ofrece TV Box.","salida":"resuelve","si":{"campo":"t_t_cuentaprueba_res","v":["caja"]}},{"cuando":"Falla solo la cuenta del cliente","hacer":"La oficina la revisa en el panel: vigencia, bloqueo y dispositivos. No es del ingeniero.","salida":""},{"cuando":"Nada funciona y el internet está bueno","hacer":"Ficha por mensaje al grupo de soporte de la sede con el mensaje exacto y 2 fotos.","salida":"ingeniero_mensaje","si":{"campo":"t_t_cuentaprueba_res","v":["todo"]}},{"cuando":"Pasa igual en varios clientes","hacer":"Botón rojo «Reportar falla masiva» y una sola llamada al ingeniero.","salida":"masiva"}],"seguridad":false,"posicion":""},
                {"id":"t_t_rf_modem","bloque":"Cable coaxial","titulo":"Mira el bombillo de TV del módem y anota la potencia de internet","ayuda":"Bombillo TV, CATV o RF encendido = llega luz de TV. La potencia de internet se lee en la página del módem o la da la oficina desde la OLT: verde -10 a -25. La TV va por la misma fibra, así que el medidor normal solo sirve para saber si hay luz. NUNCA mires la punta de la fibra. NO pongas atenuador sin revisar esta potencia: si con él baja de -25, tumbas el internet.","obligatorio":true,"sintomas":["nada_se_ve","algunos_canales","pixelado"],"variantes":["rf"],"campos":[{"id":"t_t_rf_modem_potencia","etiqueta":"Potencia que recibe el módem (internet)","tipo":"numero","opciones":[],"unidad":"dBm","semaforo":"rx_onu","sinDato":"No reporta"}],"siMal":[{"cuando":"Potencia en amarillo o rojo","hacer":"Es de fibra, no de TV: limpia el conector verde y sigue la lista de FIBRA. Con la potencia buena vuelve la TV.","salida":""},{"cuando":"Bombillo de TV apagado con potencia verde, un cliente","hacer":"Pide a la oficina mirar si la TV del módem está activada en la OLT. Limpia el conector y prueba otro módem. Si sigue: ficha al ingeniero.","salida":"ingeniero_mensaje"},{"cuando":"Imagen rayada o saturada y piensas en atenuador","hacer":"No lo pongas por tu cuenta. Anota la potencia de internet y consulta por mensaje; debe quedar en verde con él puesto.","salida":"ingeniero_mensaje"},{"cuando":"Bombillo de TV apagado en varios clientes","hacer":"Falla general de TV. Botón rojo «Reportar falla masiva» y una sola llamada al ingeniero.","salida":"masiva"}],"seguridad":false,"posicion":""},
                {"id":"t_t_rf_directo","bloque":"Cable coaxial","titulo":"Conecta un TV directo a la salida del módem con cable corto","ayuda":"Suelta el cable coaxial de la casa en el puerto de TV del módem y conecta ahí un TV con un cable corto y bueno, sin divisores. Si así se ve bien, el módem y la señal están bien y el daño está en el cableado de la casa. Si directo tampoco se ve, es el puerto de TV del módem o la señal que llega. No hagas búsqueda de canales todavía.","obligatorio":true,"sintomas":[],"variantes":["rf"],"campos":[{"id":"t_t_rf_directo_res","etiqueta":"Cómo se ve directo al módem","tipo":"opcion","opciones":[{"v":"bien","t":"Se ve bien","color":"verde"},{"v":"mal","t":"Pixelado o con rayas","color":"amarillo"},{"v":"nada","t":"No se ve nada","color":"rojo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Directo se ve bien","hacer":"El daño está en la casa: sigue con cable coaxial, conectores y divisores.","salida":""},{"cuando":"Directo tampoco se ve y la potencia de internet está verde","hacer":"Prueba con otro módem con salida de TV. Si sigue igual, ficha por mensaje al grupo de la sede.","salida":"ingeniero_mensaje"},{"cuando":"Con otro módem sí se ve","hacer":"Puerto de TV dañado: cambia el módem teniendo antes los datos de conexión. El nuevo lo autoriza la persona autorizada de la sede.","salida":"autorizador"}],"seguridad":false,"posicion":""},
                {"id":"t_t_rf_coaxial","bloque":"Cable coaxial","titulo":"Revisa cable coaxial, conectores y divisores que puso el cliente","ayuda":"Recorre el cable: sin aplastones, dobleces cerrados ni empalmes con cinta. Conectores de rosca firmes, sin sulfato y sin pelos de la malla tocando el centro. Cuenta los divisores: cada uno debilita la señal y los canales altos fallan primero. Quita los que puso el cliente y prueba. Usa cable y divisores buenos, y no dejes salidas del divisor sin usar destapadas.","obligatorio":true,"sintomas":[],"variantes":["rf"],"campos":[],"siMal":[{"cuando":"Conector flojo, sulfatado o mal hecho","hacer":"Corta y haz el conector de nuevo. Repite la prueba en ese TV.","salida":"resuelve"},{"cuando":"Divisor o cable que puso el cliente","hacer":"Quítalo y muestra que directo sí se ve. Si quiere más puntos, es punto adicional con material bueno.","salida":"comercial"},{"cuando":"Cable aplastado, partido o con empalmes","hacer":"Cambia el tramo entero, sin empalmes.","salida":"resuelve"}],"seguridad":false,"posicion":""},
                {"id":"t_t_rf_diag","bloque":"Cable coaxial","titulo":"Mira el diagnóstico de señal del TV; resintoniza solo si toca","ayuda":"En el menú del TV busca «diagnóstico» o «información de señal» y mira intensidad y calidad en un canal que falle y en uno bueno. Resintoniza SOLO en sitio, con señal buena y con los parámetros de la plantilla de tu sede (si no los tienes, pídelos a la oficina). Con señal débil la búsqueda borra los canales. Por teléfono no se guía al cliente.","obligatorio":true,"sintomas":[],"variantes":["rf"],"campos":[],"siMal":[{"cuando":"Señal o calidad baja en ese TV","hacer":"No busques canales. Vuelve al cable, conectores y divisores hasta que la señal suba.","salida":""},{"cuando":"Señal buena y faltan canales","hacer":"Resintoniza con los parámetros de la plantilla de tu sede. Confirma con el cliente que quedaron todos.","salida":""},{"cuando":"Se borraron los canales por una búsqueda","hacer":"Primero deja la señal buena (prueba directo al módem) y luego resintoniza con los parámetros de la plantilla.","salida":""},{"cuando":"El TV no sintoniza nuestra señal y otro TV sí","hacer":"Es del televisor del cliente. Muéstrale la prueba en otro TV y déjalo anotado.","salida":"resuelve"}],"seguridad":false,"posicion":""}
            ]
        },
        instalacion: {
            nombre: "Instalación, traslado o cambio de equipo", icono: "🧰",
            sintomas: [{"id":"inst_fibra","t":"Instalación o traslado de fibra"},{"id":"inst_radio","t":"Instalación o traslado de radio enlace"},{"id":"inst_tv","t":"Instalación de televisión (TV Box, app o cable coaxial)"},{"id":"cambio_equipo","t":"Cambio de equipo (módem, antena, router o caja de TV)"}],
            variantes: [],
            oficina: [

            ],
            tecnico: [
                {"id":"i_t_orden_plan","bloque":"Antes de salir","titulo":"Confirma con la oficina el plan y el trabajo de la orden","ayuda":"Lee la orden completa: tipo de trabajo (instalación, traslado o cambio), servicio (fibra, radio o TV) y plan contratado. Si algo no está claro, pregúntale a la oficina, no al ingeniero. Alista lo que vas a usar: módem o antena, cable, conectores, medidor cargado, luz roja, portátil y la plantilla del municipio. Llegar sin plantilla es llegar a pedir AnyDesk.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[],"siMal":[{"cuando":"La orden no dice el plan o el servicio","hacer":"Pídelo a la oficina antes de salir. No es tema del ingeniero.","salida":""},{"cuando":"No tienes la plantilla del municipio","hacer":"Pídela por LLAMADA a la oficina o al ingeniero antes de salir, nunca por chat. No la pidas con el cliente esperando.","salida":""},{"cuando":"El cliente pide algo distinto a la orden","hacer":"No lo cambies por tu cuenta: primero la oficina ajusta el plan o la orden.","salida":"comercial"}],"seguridad":false,"posicion":""},
                {"id":"i_t_cliente_activo","bloque":"Antes de salir","titulo":"Pide a la oficina confirmar que el cliente está activo en WispHub","ayuda":"Antes de pedir activación, la oficina abre WispHub y te confirma que el cliente ya está creado, activo, con el plan correcto y con su usuario de conexión asignado. Tú no lo creas y el ingeniero tampoco. Si la orden tiene más de un día, vuelve a confirmar. Los datos de conexión te los dictan por LLAMADA; no se escriben en esta app ni en el chat.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[],"siMal":[{"cuando":"No está creado o le falta el plan","hacer":"La oficina lo crea en WispHub antes de que sigas. Nunca es del ingeniero.","salida":"comercial"},{"cuando":"Aparece suspendido o con saldo","hacer":"Es de cartera: la oficina cobra y reactiva. No pidas activación hasta que quede activo.","salida":"cartera"},{"cuando":"La oficina no contesta","hacer":"Insiste por llamada a tu oficina. No saltes al ingeniero para que él lo active.","salida":""}],"seguridad":false,"posicion":""},
                {"id":"i_t_ruta_sitio","bloque":"Ruta y ubicación","titulo":"Define la ruta del cable o el sitio de la antena antes de tender","ayuda":"Fibra: de la caja NAP más cercana con puerto libre hasta la casa, sin dobleces cerrados, sin tensar y lejos de cables de energía. Radio: vista libre a la torre asignada, mástil firme, cable de exterior de una sola pieza y de menos de 60 m. TV: dónde va la caja y por dónde pasa el cable. Si hay que subir, vale la parada de seguridad del inicio: si no es seguro, no subas.","obligatorio":true,"sintomas":["inst_fibra","inst_radio","inst_tv"],"variantes":[],"campos":[],"siMal":[{"cuando":"No hay puerto libre en la caja NAP","hacer":"Pide a la oficina otra caja. No sueltes puertos vivos ni desconectes a un vecino para hacer campo.","salida":""},{"cuando":"No se ve la torre desde la casa","hacer":"Sube el mástil o busca otro punto. Si no hay forma, avisa a la oficina: así no se instala. No es del ingeniero.","salida":"comercial"},{"cuando":"Ruta insegura o sin permiso del dueño","hacer":"No tiendas el cable. Marca No pude: condición insegura y reprograma con la oficina.","salida":"tecnico"}],"seguridad":false,"posicion":""},
                {"id":"i_t_potencia_punta","bloque":"Fibra","titulo":"Fibra: mide la potencia en la punta ANTES de conectar el módem","ayuda":"Mide en la roseta o en la punta que va al módem. Verde: -10 a -25. Amarillo: -25 a -27 o -8 a -10. Rojo: peor que -27 o más fuerte que -8. Nunca mires la punta de la fibra. En la caja NAP no sueltes puertos vivos: usa un puerto libre. Si la TV va por la misma fibra, el medidor normal solo dice si hay luz; vale el número del módem. Si tu cambio no es de fibra, marca Bien.","obligatorio":true,"sintomas":["inst_fibra","cambio_equipo"],"variantes":[],"campos":[{"id":"i_t_potencia_punta_dbm","etiqueta":"Potencia en la punta, antes de conectar el módem","tipo":"numero","opciones":[],"unidad":"dBm","semaforo":"rx_onu","sinDato":"Sin luz / no marca"},{"id":"i_t_potencia_punta_medidor","etiqueta":"Con qué la mediste","tipo":"opcion","opciones":[{"v":"normal","t":"Medidor normal","color":""},{"v":"pon","t":"Medidor PON (separa internet y TV)","color":""},{"v":"modem","t":"Página del módem (ya conectado)","color":""}],"unidad":"","semaforo":"","sinDato":""},{"id":"i_t_potencia_punta_nap","etiqueta":"Caja NAP y puerto usados (ej: C-14 puerto 5)","tipo":"texto","opciones":[],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Amarillo o rojo","hacer":"No conectes ni pidas activación. Limpia el conector, mide en la roseta y en la caja NAP con cable de prueba y rehaz el conector o la acometida.","salida":"resuelve","si":{"campo":"i_t_potencia_punta_dbm","color":["rojo","amarillo"]}},{"cuando":"Sin luz en una sola casa","hacer":"Confirma con la luz roja que es tu puerto y que la acometida no está partida. Una sola casa sin luz nunca es del ingeniero.","salida":"resuelve"},{"cuando":"Más fuerte que -8","hacer":"Si la TV va por la misma fibra, el medidor normal marca de más: confirma con la página del módem antes de hacer algo.","salida":"resuelve"},{"cuando":"Varios puertos libres de la caja sin luz o malos, y la oficina ve otros módems de ese puerto PON caídos","hacer":"Botón Reportar falla masiva con la caja y la hora, y UNA sola llamada al ingeniero. Si la caja es nueva o los demás siguen en línea NO es masiva: pide a la oficina otra caja o puerto.","salida":"masiva"}],"seguridad":false,"posicion":""},
                {"id":"i_t_autorizar","bloque":"Fibra","titulo":"Fibra: foto de la etiqueta y pide autorizar el módem en tu sede","ayuda":"Con potencia en verde, conecta el módem y manda al grupo de la sede la foto de la etiqueta (tapa las claves si las trae). Pide autorizarlo a la persona AUTORIZADORA de tu sede, no al ingeniero, con caja NAP, puerto y plan. En cambio de equipo se reemplaza en el MISMO puerto. Antes de decir «no aparece», que lo busquen en toda la OLT. Si tu cambio no es de fibra, marca Bien.","obligatorio":true,"sintomas":["inst_fibra","cambio_equipo"],"variantes":[],"campos":[{"id":"i_t_autorizar_resultado","etiqueta":"Cómo quedó la autorización","tipo":"opcion","opciones":[{"v":"en_linea","t":"Autorizado y en línea","color":"verde"},{"v":"esperando","t":"Esperando a la persona autorizadora","color":"amarillo"},{"v":"falla_1","t":"No aparece o da error (probé 1 módem)","color":"amarillo"},{"v":"falla_2","t":"No aparece o da error con 2 módems buenos","color":"rojo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"No aparece, da error o PON sigue parpadeando (1 módem)","hacer":"Revisa la potencia, limpia el conector, confirma que es tu puerto y prueba con un SEGUNDO módem bueno. Todavía no es del ingeniero.","salida":"resuelve","si":{"campo":"i_t_autorizar_resultado","v":["falla_1"]}},{"cuando":"La persona autorizadora no contesta","hacer":"Insiste por llamada a la oficina de tu sede. El ingeniero no autoriza módems de rutina.","salida":"autorizador","si":{"campo":"i_t_autorizar_resultado","v":["esperando"]}},{"cuando":"Traslado: el módem quedó en otro puerto","hacer":"La persona autorizadora lo mueve al puerto nuevo, o lo borra y lo autoriza otra vez con el mismo plan. No es del ingeniero.","salida":"autorizador"},{"cuando":"Dos módems buenos con potencia verde no aparecen o dan error","hacer":"Ahora SÍ: ficha por MENSAJE al grupo de la sede para el ingeniero, con potencia, caja NAP, puerto y 2 fotos. No es llamada.","salida":"ingeniero_mensaje","si":{"campo":"i_t_autorizar_resultado","v":["falla_2"]}}],"seguridad":false,"posicion":""},
                {"id":"i_t_radio_enlace","bloque":"Radio","titulo":"Radio: alinea con señal verde en las dos cadenas y torre correcta","ayuda":"En la página de la antena (la clave se pide por llamada): conectada a la torre asignada; señal de -45 a -65 en las dos cadenas, con 5 o menos de diferencia (más fuerte que -40 satura); CCQ de 90% o más; puerto de red a 100 completo. NUNCA cambies frecuencia ni ancho de canal. PoE de 48V nunca a antena de 24V. Si tu cambio no es de antena, marca Bien. Si la antena tiene una sola cadena, deja la cadena 2 sin llenar.","obligatorio":true,"sintomas":["inst_radio","cambio_equipo"],"variantes":[],"campos":[{"id":"i_t_radio_enlace_c0","etiqueta":"Señal de la cadena 1","tipo":"numero","opciones":[],"unidad":"dBm","semaforo":"senal_radio","sinDato":"No conecta a la torre"},{"id":"i_t_radio_enlace_c1","etiqueta":"Señal de la cadena 2 (si tiene)","tipo":"numero","opciones":[],"unidad":"dBm","semaforo":"senal_radio","sinDato":""},{"id":"i_t_radio_enlace_ccq","etiqueta":"Calidad del enlace (CCQ)","tipo":"numero","opciones":[],"unidad":"%","semaforo":"ccq","sinDato":"No la muestra"}],"siMal":[{"cuando":"Señal en amarillo o no sube de -72","hacer":"Alinea fino, despacio, a los lados y arriba-abajo. Si no sube: obstáculo o distancia; sube el mástil o reubica. No es del ingeniero.","salida":"resuelve","si":{"campo":"i_t_radio_enlace_c0","color":["amarillo"]}},{"cuando":"Una cadena mucho peor que la otra","hacer":"Antena torcida o dañada: nivélala, revisa el conector y, si sigue igual, cámbiala por la de repuesto.","salida":"resuelve"},{"cuando":"Conectada a otra torre, o puerto de red a 10 o a medio","hacer":"Otra torre: fíjala a la asignada y realinea. Puerto lento: poncha de nuevo y prueba los 8 hilos con el probador.","salida":"resuelve"},{"cuando":"Buena señal pero calidad menor de 90%","hacer":"Es interferencia: realinea. Si sigue, manda las capturas por MENSAJE al ingeniero. No toques frecuencia ni ancho de canal.","salida":"ingeniero_mensaje"}],"seguridad":false,"posicion":""},
                {"id":"i_t_config","bloque":"Configuración","titulo":"Configura con la plantilla del municipio, sin inventar datos","ayuda":"En la página del módem o de la antena aplica la plantilla: modo, VLAN y usuario de conexión. Esos datos y las claves se piden por LLAMADA a la oficina o al ingeniero, nunca por chat, y no se escriben aquí. No resetees nada sin esos datos en la mano. Revisa letra por letra antes de decir que no levanta. AnyDesk solo si el ingeniero lo pide después de leer la ficha.","obligatorio":true,"sintomas":["inst_fibra","inst_radio","cambio_equipo"],"variantes":[],"campos":[{"id":"i_t_config_mensaje","etiqueta":"Mensaje exacto del error, si no conecta","tipo":"texto","opciones":[],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Falla de autenticación","hacer":"Usuario o clave mal escritos: corrígelos con la oficina por llamada. Nunca es del ingeniero.","salida":"resuelve"},{"cuando":"Sin respuesta, no conecta","hacer":"Revisa la VLAN y el modo de la plantilla, y que el módem esté autorizado y en línea o la antena enlazada.","salida":"resuelve"},{"cuando":"Dice que ya hay una sesión activa","hacer":"Si es un cambio de equipo: deja el viejo desconectado, espera unos minutos y vuelve a intentar. Si sigue, la oficina mira en Winbox (solo mirar) si ese usuario está puesto en otro equipo.","salida":""},{"cuando":"Sesión activa y ese usuario está puesto en el equipo de otro cliente","hacer":"El usuario está mal escrito aquí o allá: se confirma por llamada y se corrige; nunca es del ingeniero.","salida":""},{"cuando":"Sesión activa, no está en ningún otro equipo y sigue igual","hacer":"Ficha por MENSAJE al grupo de la sede. Nadie desconecta sesiones a mano.","salida":""},{"cuando":"Plantilla verificada, equipo en línea, cliente activo y no levanta","hacer":"Ahora SÍ: ficha por MENSAJE al grupo de la sede con el mensaje exacto. Deja el portátil por cable al equipo, con internet del celular.","salida":"ingeniero_mensaje"}],"seguridad":false,"posicion":""},
                {"id":"i_t_wifi","bloque":"Configuración","titulo":"Deja el wifi con nombre y clave acordados y entrégalos en papel","ayuda":"Acuerda con el cliente el nombre y la clave del wifi (mínimo 8 caracteres; que no sea el teléfono ni la cédula) y entrégalos en papel. No van por chat ni en esta app. En cambio de equipo deja el MISMO nombre y la MISMA clave que tenía, para que los aparatos se conecten solos. Ubica el módem en sitio central y alto: donde más lo usan, la señal debe ser mejor que -65.","obligatorio":false,"sintomas":["inst_fibra","inst_radio","cambio_equipo"],"variantes":[],"campos":[],"siMal":[{"cuando":"El cliente no recuerda la clave que tenía","hacer":"Pon una nueva acordada con él, entrégala en papel y ayúdale a conectar dos aparatos.","salida":"resuelve"},{"cuando":"El wifi no llega a toda la casa","hacer":"Reubica el módem u ofrece un repetidor por la oficina. Nunca es del ingeniero.","salida":"comercial"},{"cuando":"Hay router propio del cliente","hacer":"Conéctalo bien y prueba primero sin él. Si sin él funciona, el problema es de ese router.","salida":"resuelve"}],"seguridad":false,"posicion":""},
                {"id":"i_t_pruebas","bloque":"Pruebas","titulo":"Prueba velocidad por cable y navegación en dos aparatos","ayuda":"Con el portátil por cable en el puerto rápido: prueba de velocidad (bueno: 90% del plan en fibra, 80% en radio), ping de 10 paquetes a 8.8.8.8 sin perdidos y abre dos páginas. Después navega con el cliente en dos aparatos por wifi. Un módem de solo 2.4G se prueba únicamente por cable. Si el cliente solo tiene TV por cable coaxial, marca Bien.","obligatorio":false,"sintomas":[],"variantes":[],"campos":[{"id":"i_t_pruebas_bajada","etiqueta":"Velocidad de bajada por cable","tipo":"numero","opciones":[],"unidad":"Mbps","semaforo":"","sinDato":"No pude medir"}],"siMal":[{"cuando":"Velocidad baja con potencia o señal en verde","hacer":"Prueba otro cable y otro servidor. La oficina compara el plan en WispHub. Si el plan está bien: ficha por MENSAJE al ingeniero.","salida":"ingeniero_mensaje"},{"cuando":"Responde 8.8.8.8 pero no abren las páginas","hacer":"En un solo cliente es el DNS: corrígelo con la plantilla. Si pasa en VARIOS clientes, es llamada al ingeniero.","salida":"resuelve"},{"cuando":"Pierde 2 o más paquetes","hacer":"Con 1 perdido, repite. Con 2 o más, revisa otra vez cable, potencia o señal antes de cerrar.","salida":"resuelve"},{"cuando":"Por cable va bien y por wifi va mal","hacer":"Es cobertura o canal del wifi: cambia el canal o reubica el módem. Nunca es del ingeniero.","salida":"resuelve"}],"seguridad":false,"posicion":""},
                {"id":"i_t_tv_conexion","bloque":"Televisión","titulo":"TV: conecta la caja o el televisor por cable o con wifi en verde","ayuda":"TV Box o app en el Smart TV: mejor por cable UTP; por wifi solo si en el sitio del TV la señal es mejor que -65, y cuenta 10 megas libres por cada TV. La caja debe tener fecha y hora automáticas. Cable coaxial (RF): conector bien ponchado, sin divisores de más, y prueba primero un TV directo con cable corto. No pongas atenuador sin revisar antes la potencia de internet.","obligatorio":true,"sintomas":["inst_tv"],"variantes":[],"campos":[],"siMal":[{"cuando":"Wifi débil donde está el TV","hacer":"Déjalo por cable UTP o reubica el router. Nunca es del ingeniero.","salida":"resuelve"},{"cuando":"RF: imagen con lluvia o canales que faltan","hacer":"Revisa conectores y divisores y prueba un TV directo. Los datos para buscar canales van en la plantilla de tu sede; no los inventes.","salida":"resuelve"},{"cuando":"La caja no prende o no da imagen","hacer":"Revisa la entrada HDMI del TV, el cable HDMI y la corriente. Si sigue igual, cambia la caja por otra.","salida":"resuelve"}],"seguridad":false,"posicion":""},
                {"id":"i_t_tv_cuenta","bloque":"Televisión","titulo":"TV: deja la app instalada y la cuenta activa, sin escribir claves","ayuda":"TV Box, app en Smart TV o app en el celular: instala o actualiza la app y entra con la cuenta del cliente. La oficina confirma que la cuenta está activa, vigente y cuántos aparatos permite. La clave se pide por llamada y no se escribe en la app ni en el chat. Abre dos o tres canales para confirmar. En RF no hay cuenta: marca Bien. Si tu cambio no es de caja de TV, marca Bien.","obligatorio":true,"sintomas":["inst_tv","cambio_equipo"],"variantes":[],"campos":[],"siMal":[{"cuando":"Cuenta sin crear, vencida o bloqueada","hacer":"La crea o la arregla la oficina. Nunca es del ingeniero.","salida":"comercial"},{"cuando":"La app no carga con internet bueno","hacer":"Revisa fecha y hora de la caja, borra los datos de la app y vuelve a entrar. Prueba la cuenta en tu celular.","salida":"resuelve"},{"cuando":"No funciona ni en la caja ni en tu celular, con cuenta activa e internet bueno","hacer":"Ficha por MENSAJE al ingeniero con foto de la pantalla. Si pasa en varios clientes a la vez, es llamada.","salida":"ingeniero_mensaje"}],"seguridad":false,"posicion":""},
                {"id":"i_t_tv_canales","bloque":"Televisión","titulo":"TV: prueba los canales en cada televisor junto con el cliente","ayuda":"En cada televisor contratado: recorre varios canales unos minutos, sin que se congele ni se pixele. Enséñale al cliente a poner la entrada correcta (botón Source o HDMI) y a usar el control. En RF haz la búsqueda de canales solo con buena señal y con los datos de la plantilla: con señal débil la búsqueda borra canales. La app en el celular se prueba con el wifi de la casa.","obligatorio":false,"sintomas":["inst_tv"],"variantes":[],"campos":[],"siMal":[{"cuando":"Un solo TV falla y los otros no","hacer":"Prueba cruzada: cambia de sitio el TV, la caja y el cable para saber cuál de los tres falla.","salida":"resuelve"},{"cuando":"Se congela o se pixela","hacer":"Es la conexión de la caja: pásala a cable UTP o mejora el wifi, y repite la prueba de velocidad.","salida":"resuelve"},{"cuando":"No se ve en ningún TV y la oficina confirma 3 o más clientes sin TV, o el TV testigo sin señal","hacer":"Es falla general: botón rojo «Reportar falla masiva» y UNA sola llamada al ingeniero.","salida":"masiva"},{"cuando":"No se ve en ningún TV y solo 1 o 2 vecinos están sin TV","hacer":"Con 1 o 2 vecinos sin TV todavía no es masiva: avisa a la oficina y termina tus pruebas; si aparece un tercero, se reporta.","salida":""}],"seguridad":false,"posicion":""},
                {"id":"i_t_equipo_retirado","bloque":"Cierre","titulo":"Equipo retirado: resétealo y devuélvelo a bodega","ayuda":"Solo cuando el equipo NUEVO ya quedó funcionando: resetea el equipo que retiraste, para que no salga a otra casa con los datos de este cliente, y llévalo a bodega con su adaptador. El serial del retirado y el del nuevo se anotan en la ORDEN (para INVENTARIO), no en esta lista. Si usaste un módem de prueba, pide a la persona autorizadora quitarlo de la OLT al terminar.","obligatorio":false,"sintomas":["cambio_equipo"],"variantes":[],"campos":[],"siMal":[{"cuando":"El equipo retirado está dañado o quemado","hacer":"Márcalo como dañado en la orden y entrégalo aparte. Si es el segundo quemado en la misma casa, revisa la puesta a tierra y el protector.","salida":""},{"cuando":"El cliente no quiere entregar el equipo","hacer":"Avisa a la oficina: es un trámite comercial, no técnico.","salida":"comercial"},{"cuando":"No sabes si el módem de prueba sigue en la OLT","hacer":"Pide a la persona autorizadora que lo busque en la OLT y lo quite.","salida":"autorizador"}],"seguridad":false,"posicion":""},
                {"id":"i_t_orden_limpieza","bloque":"Cierre","titulo":"Deja todo ordenado, rotulado y limpio antes de irte","ayuda":"Cable bien grapado y sin dobleces cerrados, sobrante de fibra enrollado en vueltas amplias, roseta fija, caja NAP cerrada y el puerto rotulado, mástil apretado y conectores de exterior sellados. Recoge los sobrantes y las puntas de fibra cortadas: son vidrio y se clavan. Si abriste la caja NAP, pide a la oficina confirmar que no tumbaste a ningún vecino.","obligatorio":false,"sintomas":[],"variantes":[],"campos":[],"siMal":[{"cuando":"Quedó algo en amarillo o pendiente","hacer":"Anótalo en la orden como pendiente de mejora y avisa a la oficina.","salida":""},{"cuando":"La oficina dice que se cayó un vecino","hacer":"Vuelve a la caja NAP, revisa el puerto que moviste y no te vayas hasta que el vecino quede en línea.","salida":"resuelve"}],"seguridad":false,"posicion":""}
            ]
        }
    },
    comun: {
        oficina: [
            {"id":"c_o_franja","bloque":"Falla masiva","titulo":"Mira la franja: ¿hay falla masiva o apagón en ese municipio?","ayuda":"La franja roja sale arriba en la app cuando alguien ya reportó una falla masiva o un apagón en el municipio del cliente. Vence sola a las 6 horas. Si hay franja: dile al cliente el texto de la franja, agrégalo a la lista de afectados con un toque y NO llames al ingeniero, él ya sabe. Si no hay franja, marca Bien y sigue.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[],"siMal":[{"cuando":"Hay franja activa en ese municipio","hacer":"Dile al cliente el texto de la franja, agrégalo a la lista de afectados con un toque y NO llames: el ingeniero ya está avisado.","salida":"masiva"},{"cuando":"No hay franja, pero están llamando varios del mismo sector","hacer":"Sigue la lista hasta el paso de los otros módems del mismo puerto o de la misma torre. Con 3 o más caídos a la vez, usa el botón rojo de falla masiva.","salida":""}],"seguridad":false,"posicion":""},
            {"id":"c_o_cliente","bloque":"Cliente y cartera","titulo":"Busca al cliente y confirma cuál servicio es el que falla","ayuda":"Búscalo por documento; si no aparece, por teléfono o dirección. La app llena sola el nombre y el plan: no los escribas en ningún campo. Si tiene varios servicios (fibra, radio, TV o varias casas), confirma con el cliente cuál es el que falla. Mira en la ficha si ya tiene una orden abierta y cuántas visitas técnicas lleva en los últimos 30 días.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[{"id":"c_o_cliente_orden","etiqueta":"¿Ya tiene una orden abierta?","tipo":"sino","opciones":[],"unidad":"","semaforo":"","sinDato":""},{"id":"c_o_cliente_visitas","etiqueta":"Visitas técnicas en los últimos 30 días","tipo":"opcion","opciones":[{"v":"v0","t":"0","color":"verde"},{"v":"v1","t":"1","color":"amarillo"},{"v":"v2","t":"2","color":"rojo"},{"v":"v3mas","t":"3 o más","color":"rojo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"No aparece por documento","hacer":"Búscalo por teléfono o por dirección. Si de verdad no existe en WispHub, no es cliente activo: pásalo a comercial.","salida":"comercial"},{"cuando":"Ya tiene una orden abierta","hacer":"No crees otra orden. Agrega a la que ya existe lo nuevo que cuente el cliente y dile la fecha de la visita.","salida":""},{"cuando":"Ya lleva 2 o más visitas en 30 días","hacer":"Crea la orden marcada REINCIDENTE con lo que se hizo en las visitas anteriores. El técnico hace la lista completa con datos medidos antes de escalar.","salida":"tecnico","si":{"campo":"c_o_cliente_visitas","v":["v2","v3mas"]}}],"seguridad":false,"posicion":""},
            {"id":"c_o_wisphub","bloque":"Cliente y cartera","titulo":"Abre WispHub AHORA y marca el estado que ves","ayuda":"La copia de la app puede estar vieja: abre WispHub en este momento y mira el estado del servicio, las facturas pendientes y si pagó hoy. Suspendido por corte se cobra y se reactiva: nunca es del ingeniero. Activo con saldo pendiente NO está cortado: la falla es otra, sigue la lista. Si pagó y sigue cortado: registra el pago, reactiva, espera unos minutos y devuélvele la llamada al cliente.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[{"id":"c_o_wisphub_estado","etiqueta":"Estado que ves ahora en WispHub","tipo":"opcion","opciones":[{"v":"activo_dia","t":"Activo y al día","color":"verde"},{"v":"activo_saldo","t":"Activo con saldo pendiente (no está cortado)","color":""},{"v":"suspendido","t":"Suspendido por corte","color":"rojo"},{"v":"cancelado","t":"Cancelado","color":"rojo"},{"v":"pago_cortado","t":"Pagó hoy y sigue cortado","color":"amarillo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Suspendido por corte","hacer":"Se cobra y se reactiva al registrar el pago. Nunca es del ingeniero.","salida":"cartera","si":{"campo":"c_o_wisphub_estado","v":["suspendido"]}},{"cuando":"Cancelado","hacer":"Es reconexión o venta nueva, no una falla. Pásalo a comercial.","salida":"comercial","si":{"campo":"c_o_wisphub_estado","v":["cancelado"]}},{"cuando":"Pagó hoy y sigue cortado","hacer":"Registra el pago, reactiva en WispHub, espera unos minutos y devuélvele la llamada al cliente para confirmar que volvió.","salida":"resuelve","si":{"campo":"c_o_wisphub_estado","v":["pago_cortado"]}},{"cuando":"Al día y sigue cortado después de 2 reactivaciones","hacer":"Mira en Winbox si sigue en la lista de cortados (solo mirar, no cambies nada). Si sigue ahí, mensaje al ingeniero con la ficha.","salida":"ingeniero_mensaje"}],"seguridad":false,"posicion":""},
            {"id":"c_o_alcance","bloque":"La falla","titulo":"Pregunta desde cuándo falla y si a los vecinos les pasa igual","ayuda":"El síntoma ya lo marcaste al empezar. Aquí pregunta desde cuándo pasa y si algún vecino con nuestro servicio está igual. Lo normal es un solo cliente afectado. Si a los vecinos también les pasa, vuelve a mirar la franja y haz con cuidado el paso de los otros módems del mismo puerto o de los clientes de la misma torre antes de llamar a nadie.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[{"id":"c_o_alcance_desde","etiqueta":"¿Desde cuándo falla?","tipo":"opcion","opciones":[{"v":"hora","t":"Hace menos de 1 hora","color":""},{"v":"hoy","t":"Desde hoy","color":""},{"v":"ayer","t":"Desde ayer","color":""},{"v":"dias","t":"Hace 2 días o más","color":""},{"v":"ratos","t":"Va y viene hace días","color":""}],"unidad":"","semaforo":"","sinDato":""},{"id":"c_o_alcance_vecinos","etiqueta":"¿A los vecinos les pasa igual?","tipo":"opcion","opciones":[{"v":"no","t":"No, solo a este cliente","color":"verde"},{"v":"si","t":"Sí, a los vecinos también","color":"rojo"},{"v":"nosabe","t":"No sabe","color":"amarillo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"A los vecinos también les pasa","hacer":"Revisa otra vez la franja y haz el paso de los otros módems del mismo puerto o de la misma torre. No llames sin confirmar 3 o más caídos a la vez.","salida":""},{"cuando":"Falla solo un aparato o solo una página","hacer":"No es falla nuestra. Guía al cliente (reiniciar el aparato, probar otra página u otro aparato) y cierra el caso.","salida":"resuelve"},{"cuando":"Va y viene hace días","hacer":"Trátalo como «se cae a ratos» y sigue la lista: casi siempre es energía, potencia o señal, y termina en orden al técnico.","salida":"tecnico"}],"seguridad":false,"posicion":""},
            {"id":"c_o_cambio","bloque":"La falla","titulo":"Pregunta qué cambió antes de la falla","ayuda":"Pregunta con calma: ¿movieron el equipo o los muebles?, ¿hubo tormenta o se fue la luz?, ¿alguien oprimió el botón reset?, ¿pusieron un router propio? Ninguna de estas causas es del ingeniero. Si oprimieron reset, no guíes la configuración por teléfono ni pidas claves por chat: va orden al técnico, que lleva los datos y la plantilla.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[{"id":"c_o_cambio_que","etiqueta":"¿Qué cambió antes de la falla?","tipo":"opcion","opciones":[{"v":"nada","t":"Nada","color":"verde"},{"v":"movieron","t":"Movieron el equipo","color":"amarillo"},{"v":"tormenta","t":"Tormenta o apagón","color":"amarillo"},{"v":"reset","t":"Oprimieron reset","color":"rojo"},{"v":"router","t":"Pusieron router propio","color":"amarillo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Oprimieron el botón reset","hacer":"Orden al técnico para reconfigurar con la plantilla. No guíes la configuración por teléfono. No es del ingeniero.","salida":"tecnico","si":{"campo":"c_o_cambio_que","v":["reset"]}},{"cuando":"Pusieron un router propio","hacer":"Pide probar sin ese router, con un aparato conectado directo a nuestro equipo. Si así funciona, el problema es del router del cliente.","salida":"resuelve","si":{"campo":"c_o_cambio_que","v":["router"]}},{"cuando":"Movieron el equipo","hacer":"Revisa con el cliente que cada cable esté en su puerto y que el cable de fibra no quede doblado ni aplastado. Si no vuelve, orden al técnico.","salida":"tecnico","si":{"campo":"c_o_cambio_que","v":["movieron"]}},{"cuando":"Tormenta o apagón","hacer":"Revisa corriente y bombillos con la lista del servicio. Si el equipo no prende o quedó quemado, orden al técnico.","salida":"tecnico","si":{"campo":"c_o_cambio_que","v":["tormenta"]}}],"seguridad":false,"posicion":""}
        ],
        tecnicoInicio: [
            {"id":"c_t_orden","bloque":"Antes de salir","titulo":"Antes de salir: lee la orden y el resumen de la oficina","ayuda":"La orden debe traer el servicio, el estado del cliente, el estado del equipo y la potencia o la señal que vio la oficina. Alista repuestos según la falla (módem, cable corto de fibra, conectores, PoE y antena de repuesto) y carga el medidor y el portátil. Si falta algún dato, pídelo a la oficina por mensaje, no al ingeniero.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[],"siMal":[{"cuando":"A la orden le faltan datos","hacer":"Pídelos a la oficina por mensaje antes de salir. No es motivo para escribirle al ingeniero.","salida":""},{"cuando":"La orden llegó sin el resumen de la lista de la oficina","hacer":"Pide a la oficina que haga primero su lista: muchas fallas se resuelven ahí y te ahorras la visita.","salida":""}],"seguridad":false,"posicion":"inicio"},
            {"id":"c_t_estado","bloque":"Antes de salir","titulo":"Confirma que el cliente está activo, no suspendido","ayuda":"Mira el estado del cliente en la orden. Si la orden tiene más de un día, reconfirma con la oficina antes de salir o al llegar: pudo quedar suspendido por corte después de creada. Un cliente suspendido o en mora no es una falla: no se revisa nada más hasta que pague y la oficina lo reactive.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[{"id":"c_t_estado_cliente","etiqueta":"Estado del cliente hoy","tipo":"opcion","opciones":[{"v":"activo","t":"Activo","color":"verde"},{"v":"suspendido","t":"Suspendido o en mora","color":"rojo"},{"v":"sinconfirmar","t":"La oficina no confirmó","color":"amarillo"}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Suspendido o en mora","hacer":"No es falla. Avisa a la oficina para que cobre y reactive, y cierra la visita sin tocar el equipo.","salida":"cartera","si":{"campo":"c_t_estado_cliente","v":["suspendido"]}},{"cuando":"Cancelado o retirado","hacer":"Es trámite comercial. Avisa a la oficina y no instales ni reconectes nada sin una orden nueva.","salida":"comercial"},{"cuando":"Orden de más de un día y la oficina no contesta","hacer":"Sigue con la visita, pero deja marcado que el estado quedó sin confirmar.","salida":""}],"seguridad":false,"posicion":"inicio"},
            {"id":"c_t_llegada","bloque":"Al llegar","titulo":"Al llegar: casa correcta y que el cliente te muestre la falla","ayuda":"Confirma con el titular o con un adulto que es la casa de la orden. Pide que te muestren la falla en el aparato donde la notan y pregunta qué cambió: movieron el equipo, tormenta, reset o router propio. Si falla un solo aparato, o solo lejos del módem o del router, es wifi o es del aparato, no de la red.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[],"siMal":[{"cuando":"Falla un solo aparato o solo lejos del equipo","hacer":"Es wifi o es del aparato. Haz el paso de wifi de la lista: canal, ubicación o repetidor. Nunca es del ingeniero.","salida":"resuelve"},{"cuando":"La falla que ves no es la de la orden","hacer":"Cambia el síntoma en la app por el que ves en sitio y sigue la lista con ese.","salida":""},{"cuando":"No hay nadie o no te dejan entrar","hacer":"Marca No pude: el cliente no está. Avisa a la oficina para reprogramar la visita.","salida":""}],"seguridad":false,"posicion":"inicio"},
            {"id":"c_t_alturas","bloque":"Seguridad","titulo":"PARADA: antes de subir a poste, techo, torre o a más de 2 metros","ayuda":"Antes de subir revisa tres cosas: certificado de alturas vigente, equipo completo (arnés, eslinga, casco y escalera buena y amarrada) y que no haya tormenta, lluvia ni cables eléctricos cerca. Si falta una sola, NO subas: marca No pude, condición insegura. No cuenta en tu contra y SÍ te deja pasar el caso. Si en esta visita no hay que subir, toca «Hoy no hay que subir» y Bien.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[{"id":"c_t_alturas_ok","etiqueta":"¿Certificado de alturas vigente, equipo completo y sin tormenta?","tipo":"opcion","opciones":[{"v":"si","t":"Sí","color":"verde"},{"v":"no","t":"Falta algo: NO subo","color":"amarillo"},{"v":"no_subo","t":"Hoy no hay que subir","color":""}],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Falta el certificado, falta equipo o hay tormenta","hacer":"NO subas. Marca No pude: condición insegura. No cuenta en tu contra y sí te deja pasar el caso. Avisa a la oficina para reprogramar.","salida":""},{"cuando":"El trabajo es arriba en la torre","hacer":"La torre solo se trabaja con falla masiva declarada y con personal autorizado para alturas. No subas por un solo cliente.","salida":""}],"seguridad":true,"posicion":"inicio"},
            {"id":"c_t_captura","bloque":"Antes de tocar","titulo":"Antes de tocar la configuración: captura de conexión y wifi","ayuda":"Toma captura de la pantalla de conexión (modo, VLAN, usuario) y de la del wifi en la página del módem, de la antena o del router: son tus datos para volver atrás. Recorta o tapa cualquier clave antes de enviar una captura. Sin usuario, clave, VLAN, wifi y plantilla en la mano NO se resetea. Las claves se piden por LLAMADA al ingeniero o a la oficina, nunca por chat.","obligatorio":true,"sintomas":[],"variantes":[],"campos":[],"siMal":[{"cuando":"La captura muestra una clave","hacer":"Recórtala o tápala antes de enviarla al grupo. Las claves nunca van por chat ni en la app.","salida":""},{"cuando":"No tienes los datos de conexión ni la plantilla","hacer":"No resetees. Pide los datos por LLAMADA a la oficina o al ingeniero y sigue cuando los tengas en la mano.","salida":""},{"cuando":"No puedes entrar a la página del equipo","hacer":"Pide la clave por LLAMADA a la oficina o al ingeniero, nunca por chat. No oprimas reset para poder entrar.","salida":""},{"cuando":"El equipo ya estaba reseteado","hacer":"Configúralo con la plantilla y con los datos que te dicten por llamada. Un equipo reseteado nunca es del ingeniero.","salida":"resuelve"}],"seguridad":false,"posicion":"inicio"}
        ],
        tecnicoFin: [
            {"id":"c_t_cierre","bloque":"Cierre","titulo":"Cierre: prueba final con el cliente en dos aparatos","ayuda":"Prueba con el cliente en dos aparatos distintos (un celular y el TV o un computador): que abran páginas y video. Mide la velocidad de bajada, por cable si se puede. Deja los cables recogidos, el equipo en su sitio y nada tirado. Lo que marcaste se vuelve el texto de cierre de la orden. Los equipos cambiados se registran en INVENTARIO, no aquí.","obligatorio":false,"sintomas":[],"variantes":[],"campos":[{"id":"c_t_cierre_bajada","etiqueta":"Velocidad de bajada en la prueba final","tipo":"numero","opciones":[],"unidad":"Mbps","semaforo":"","sinDato":"No se pudo medir"},{"id":"c_t_cierre_verde","etiqueta":"¿Todo quedó en verde?","tipo":"sino","opciones":[],"unidad":"","semaforo":"","sinDato":""}],"siMal":[{"cuando":"Quedó algo en amarillo (potencia, señal o velocidad)","hacer":"Déjalo anotado en el cierre como pendiente de mejora y avisa a la oficina.","salida":"resuelve"},{"cuando":"Por cable va bien y por wifi va lento","hacer":"Es cobertura wifi: cambia el canal, reubica el equipo u ofrece un repetidor. Nunca es del ingeniero.","salida":"resuelve"},{"cuando":"Velocidad por cable muy por debajo del plan, con todo lo demás en verde","hacer":"La oficina compara el plan en WispHub. Si el plan está bien, mensaje al ingeniero con la ficha.","salida":"ingeniero_mensaje"},{"cuando":"Nada funcionó después de toda la lista","hacer":"Escoge el caso de «cuándo sí» y pega la ficha con 2 fotos en el grupo de soporte de tu sede. Deja el portátil conectado por cable, con internet del celular.","salida":"ingeniero_mensaje"}],"seguridad":false,"posicion":"fin"}
        ]
    },
    casos: [
        {"id":"caso_masiva_puerto","texto":"3 o más módems del mismo puerto PON con LOS en menos de 5 minutos, sin apagón de por medio","via":"llamada","servicios":["fibra"],"roles":["oficina","tecnico"],"primeroA":""},
        {"id":"caso_masiva_nap","texto":"Caja NAP sin luz o mala en tu puerto y en los libres, con otros módems de ese puerto PON caídos","via":"llamada","servicios":["fibra","instalacion"],"roles":["tecnico"],"primeroA":""},
        {"id":"caso_masiva_torre","texto":"3 o más clientes de la misma torre o sector caídos a la misma hora","via":"llamada","servicios":["radio"],"roles":["oficina","tecnico"],"primeroA":""},
        {"id":"caso_olt_caida","texto":"Puerto PON, tarjeta u OLT completa caída","via":"llamada","servicios":["fibra"],"roles":["oficina","tecnico"],"primeroA":""},
        {"id":"caso_torre_sin_clientes","texto":"Torre o sector de radio sin ningún cliente conectado","via":"llamada","servicios":["radio"],"roles":["oficina","tecnico"],"primeroA":""},
        {"id":"caso_router_vacio","texto":"Casi nadie conectado en el router principal de la sede (visto en WispHub o en Winbox, solo mirando)","via":"llamada","servicios":["fibra","radio"],"roles":["oficina"],"primeroA":""},
        {"id":"caso_plataforma_sin_conexion","texto":"WispHub, SmartOLT o AdminOLT sin conexión con el equipo por más de 10 minutos","via":"llamada","servicios":["fibra","radio","instalacion"],"roles":["oficina"],"primeroA":""},
        {"id":"caso_dns_varios","texto":"8.8.8.8 responde pero no abren las páginas en VARIOS clientes","via":"llamada","servicios":["fibra","radio"],"roles":["oficina","tecnico"],"primeroA":""},
        {"id":"caso_lentos_varios","texto":"Varios clientes lentos a la vez en sectores distintos","via":"llamada","servicios":["fibra","radio"],"roles":["oficina","tecnico"],"primeroA":""},
        {"id":"caso_corporativo","texto":"Cliente corporativo o dedicado caído","via":"llamada","servicios":["fibra","radio"],"roles":["oficina","tecnico"],"primeroA":""},
        {"id":"caso_tv_general","texto":"La TV falla en varios clientes a la vez con internet bueno (app, TV Box o señal RF)","via":"llamada","servicios":["tv"],"roles":["oficina","tecnico"],"primeroA":""},
        {"id":"caso_modem_no_aparece","texto":"Módem nuevo con buena potencia que no aparece o da error al autorizarlo, probado con dos módems","via":"mensaje","servicios":["fibra","instalacion"],"roles":["oficina","tecnico"],"primeroA":"autorizador"},
        {"id":"caso_conexion_no_levanta","texto":"Conexión verificada (usuario, clave y VLAN), módem en línea en la OLT y no levanta","via":"mensaje","servicios":["fibra","instalacion"],"roles":["tecnico"],"primeroA":""},
        {"id":"caso_radio_no_levanta","texto":"Enlace de radio bueno, plantilla bien puesta, cliente activo y la conexión no levanta","via":"mensaje","servicios":["radio","instalacion"],"roles":["tecnico"],"primeroA":""},
        {"id":"caso_sigue_cortado","texto":"Cliente al día que sigue cortado después de 2 reactivaciones","via":"mensaje","servicios":["fibra","radio","tv","instalacion"],"roles":["oficina"],"primeroA":""},
        {"id":"caso_velocidad_baja","texto":"Velocidad baja por cable con buena potencia o buen enlace y el plan correcto en WispHub","via":"mensaje","servicios":["fibra","radio","tv","instalacion"],"roles":["oficina","tecnico"],"primeroA":""},
        {"id":"caso_no_navega","texto":"Equipo en línea, sesión activa, fuera de la lista de cortados y no navega por cable","via":"mensaje","servicios":["fibra","radio"],"roles":["oficina","tecnico"],"primeroA":""},
        {"id":"caso_sesion_corta","texto":"Se cae a ratos: equipo con días encendido y enlazado (OLT o torre), pero la sesión se reinicia sola","via":"mensaje","servicios":["fibra","radio"],"roles":["oficina","tecnico"],"primeroA":""},
        {"id":"caso_interferencia","texto":"Interferencia o torre saturada (lento de 7 a 10 pm con buen enlace), con capturas","via":"mensaje","servicios":["radio","instalacion"],"roles":["tecnico"],"primeroA":""},
        {"id":"caso_torre_lenta","texto":"3 o más clientes de la misma torre o sector lentos a las mismas horas (torre saturada o interferencia)","via":"mensaje","servicios":["radio"],"roles":["oficina","tecnico"],"primeroA":""},
        {"id":"caso_ip_repetida","texto":"Dirección de red (IP) repetida entre dos clientes","via":"mensaje","servicios":["fibra","radio","instalacion"],"roles":["oficina","tecnico"],"primeroA":""},
        {"id":"caso_cambio_config","texto":"Hace falta un cambio que solo hace el ingeniero en la OLT, en el Mikrotik o en la potencia o frecuencia de una antena","via":"mensaje","servicios":["fibra","radio","tv","instalacion"],"roles":["oficina","tecnico"],"primeroA":""},
        {"id":"caso_tv_no_funciona","texto":"TV de un solo cliente que no funciona con internet bueno y cuenta activa, ya probada en otro aparato, con otro equipo o con cuenta de prueba","via":"mensaje","servicios":["tv","instalacion"],"roles":["oficina","tecnico"],"primeroA":""}
    ],
    nunca: [
        "Cliente suspendido, en mora o cancelado.",
        "Falla que ya está en la franja de falla masiva o apagón: el ingeniero ya sabe.",
        "Módem o PoE apagado, adaptador dañado o apagón.",
        "LOS rojo o potencia mala en UN solo cliente.",
        "Cable de fibra doblado, conector sucio o acometida rota.",
        "Wifi sin cobertura, clave del wifi, muchos aparatos, una sola página o un solo aparato.",
        "Módem, antena o router reseteado; usuario o clave mal escritos.",
        "Router propio del cliente mal conectado o cable de red malo.",
        "Antena desalineada, cable sulfatado o antena quemada: se cambia.",
        "TV en la entrada equivocada, control sin pilas, cuenta de TV vencida o app sin actualizar.",
        "Un solo TV malo cuando los demás de la casa funcionan; cable coaxial o divisor dañado dentro de la casa.",
        "Trámites comerciales: traslados, cambios de plan, reconexiones.",
        "Módem nuevo que no aparece, sin haber pasado primero por el autorizador de la sede.",
        "No saber la clave de un equipo no es una falla: se pide por llamada, nunca con ficha ni por chat.",
        "Dar acceso remoto (AnyDesk, UltraViewer, RustDesk) «para que mire» sin ficha."
    ],
    motivosNoPude: [
        {"id":"sin_acceso","t":"Sin acceso a la plataforma"},
        {"id":"sin_herramienta","t":"Sin la herramienta"},
        {"id":"no_se","t":"No sé hacerlo"},
        {"id":"cliente","t":"El cliente no colabora o no está"},
        {"id":"inseguro","t":"Condición insegura"},
        {"id":"no_aplica","t":"No aplica en este caso"}
    ],
    causasResuelto: [
        {"id":"causa_mora","t":"Mora o corte","roles":["oficina","tecnico"]},
        {"id":"causa_energia","t":"Energía del cliente (toma, adaptador o apagón)","roles":["oficina","tecnico"]},
        {"id":"causa_desconectado","t":"Equipo desconectado o mal conectado","roles":["oficina","tecnico"]},
        {"id":"causa_reinicio","t":"Se arregló con reinicio","roles":["oficina","tecnico"]},
        {"id":"causa_wifi","t":"Wifi o cobertura","roles":["oficina","tecnico"]},
        {"id":"causa_router_propio","t":"Router propio del cliente","roles":["oficina","tecnico"]},
        {"id":"causa_aparato_cliente","t":"Aparato del cliente o una sola página","roles":["oficina","tecnico"]},
        {"id":"causa_conector_fibra","t":"Conector o cable corto de fibra","roles":["tecnico"]},
        {"id":"causa_acometida","t":"Acometida","roles":["tecnico"]},
        {"id":"causa_puerto_nap","t":"Puerto o conector de la caja NAP","roles":["tecnico"]},
        {"id":"causa_modem_cambiado","t":"Equipo dañado, se cambió (módem, antena, router o TV Box)","roles":["tecnico"]},
        {"id":"causa_configuracion","t":"Configuración corregida","roles":["oficina","tecnico"]},
        {"id":"causa_antena_desalineada","t":"Antena desalineada","roles":["tecnico"]},
        {"id":"causa_cable_poe","t":"Cable o PoE de la antena","roles":["tecnico"]},
        {"id":"causa_cuenta_tv","t":"Cuenta o app de TV","roles":["oficina","tecnico"]},
        {"id":"causa_entrada_tv","t":"Entrada o control del TV","roles":["oficina","tecnico"]},
        {"id":"causa_coaxial","t":"Cable coaxial o divisor de TV","roles":["tecnico"]},
        {"id":"causa_instalacion","t":"Instalación, traslado o cambio terminado","roles":["tecnico"]},
        {"id":"causa_masiva","t":"Falla masiva ya reportada","roles":["oficina","tecnico"]},
        {"id":"causa_otro","t":"Otro","roles":["oficina","tecnico"]}
    ],
    reglasGenerales: [
        "Las claves nunca se escriben en la app ni en el chat. Se piden y se dictan por LLAMADA al ingeniero o a la oficina.",
        "Prohibido resetear un módem, antena, router o TV Box sin tener en la mano el usuario y la clave de conexión, la VLAN, el nombre y la clave del wifi y la plantilla.",
        "El acceso remoto (AnyDesk, UltraViewer, RustDesk) se da solo cuando el ingeniero lo pida, después de leer la ficha."
    ]
};
// <</DATOS>>

(function (global) {
    'use strict';

    var D = PV_CHECK_DATOS;
    var SIN = '__sin__';                       // valor del botón alterno "Sin luz / no marca"
    var MAX_FICHA = 900;
    var COLA = 'pv_check_pend';
    var FECHA_MIN = new Date(2026, 8, 1).getTime();   // 1-sep-2026 en hora local
    var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    var EMOJI = { verde: '🟢', amarillo: '🟡', rojo: '🔴' };

    // ── Utilidades ──────────────────────────────────────────────────
    function esc(s) {
        return String(s === undefined || s === null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function txt(s, max) {                     // texto limpio de una línea
        var r = String(s === undefined || s === null ? '' : s).replace(/[\x00-\x1f\x7f]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (max && r.length > max) r = r.slice(0, max - 1) + '…';
        return r;
    }
    // Lo tecleado a mano puede traer una IP o un teléfono: se tapan.
    function sinPersonales(s, max) {
        return txt(String(s === undefined || s === null ? '' : s)
            .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, '[IP]')
            .replace(/\b([0-9a-f]{2}[:\-]){5}[0-9a-f]{2}\b/gi, '[MAC]')
            .replace(/\d[\d\s.\-]{5,}\d/g, function (m) { return m.replace(/\D/g, '').length >= 7 ? '[número]' : m; }), max);
    }
    function primerNombre(s) {
        var p = txt(s).split(' ')[0] || '';
        p = p.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
        return p.slice(0, 20);
    }
    function sinTildes(s) {
        var r = txt(s).toLowerCase();
        var de = 'áéíóúüñ', a = 'aeiouun', i;
        for (i = 0; i < de.length; i++) r = r.split(de.charAt(i)).join(a.charAt(i));
        return r;
    }
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    function hora(ms) { var d = new Date(ms || 0); return p2(d.getHours()) + ':' + p2(d.getMinutes()); }
    function fechaCorta(ms) { var d = new Date(ms || 0); return d.getDate() + '-' + MESES[d.getMonth()] + ' ' + hora(ms); }
    function azar(n) { var s = ''; while (s.length < n) s += Math.random().toString(36).slice(2); return s.slice(0, n); }
    function lista(x) { return Object.prototype.toString.call(x) === '[object Array]' ? x : []; }
    function claveSegura(k) {                  // nunca claves numéricas ni con puntos
        var r = String(k === undefined || k === null ? '' : k).replace(/[^A-Za-z0-9_\-]/g, '_');
        if (r === '' || /^\d/.test(r)) r = 'k_' + r;
        return r;
    }
    function aNumero(v) {
        if (typeof v === 'number') return isFinite(v) ? v : NaN;
        var s = String(v === undefined || v === null ? '' : v).replace(/\s/g, '').replace(',', '.').replace(/−/g, '-');
        if (s === '' || !/^-?\d*\.?\d+$|^-?\d+\.$/.test(s)) return NaN;
        return parseFloat(s);
    }

    // ── Listas ──────────────────────────────────────────────────────
    function servicioDe(id) { return (D.servicios && D.servicios[id]) || null; }
    function aplica(p, sintoma, variante) {
        var s = lista(p.sintomas), v = lista(p.variantes);
        if (s.length && s.indexOf(sintoma) < 0) return false;
        if (v.length && v.indexOf(variante) < 0) return false;
        return true;
    }
    function pasos(servicio, rol, sintoma, variante) {
        var sv = servicioDe(servicio), c = D.comun || {}, todos;
        if (!sv) return [];
        if (rol === 'tecnico') todos = lista(c.tecnicoInicio).concat(lista(sv.tecnico), lista(c.tecnicoFin));
        else todos = lista(c.oficina).concat(lista(sv.oficina));
        return todos.filter(function (p) { return p && aplica(p, sintoma || '', variante || ''); });
    }

    // ── Semáforo ────────────────────────────────────────────────────
    function semaforo(tipo, valor) {
        var n = aNumero(valor);
        if (isNaN(n)) return '';
        if (tipo === 'rx_onu' || tipo === 'rx_olt' || tipo === 'senal_radio' || tipo === 'wifi') n = -Math.abs(n);
        if (tipo === 'rx_onu') {
            if (n < -27 || n > -8) return 'rojo';
            if (n < -25 || n > -10) return 'amarillo';
            return 'verde';
        }
        if (tipo === 'rx_olt') {
            if (n < -28) return 'rojo';
            if (n < -26) return 'amarillo';
            return 'verde';
        }
        if (tipo === 'senal_radio') {
            if (n < -72 || n > -40) return 'rojo';
            if (n < -65 || n > -45) return 'amarillo';
            return 'verde';
        }
        if (tipo === 'wifi') {
            if (n < -75) return 'rojo';
            if (n <= -65) return 'amarillo';
            return 'verde';
        }
        if (tipo === 'perdidos') {
            if (n < 0) return '';
            if (n === 0) return 'verde';
            if (n <= 1) return 'amarillo';
            return 'rojo';
        }
        if (tipo === 'ccq') {
            if (n < 0 || n > 100) return '';
            if (n >= 90) return 'verde';
            if (n >= 70) return 'amarillo';
            return 'rojo';
        }
        return '';
    }
    // Valor ya normalizado de un campo numérico (con el signo puesto).
    function valorNumero(campo, v) {
        var n = aNumero(v);
        if (isNaN(n)) return NaN;
        var s = campo.semaforo;
        if (s === 'rx_onu' || s === 'rx_olt' || s === 'senal_radio' || s === 'wifi') n = -Math.abs(n);
        return n;
    }
    function colorCampo(campo, v) {
        var i, ops;
        if (v === undefined || v === null || v === '') return '';
        if (v === SIN) return (campo.semaforo === 'rx_onu' || campo.semaforo === 'senal_radio' || campo.semaforo === 'perdidos') ? 'rojo' : 'amarillo';
        if (campo.tipo === 'numero') return semaforo(campo.semaforo, v);
        if (campo.tipo === 'opcion') {
            ops = lista(campo.opciones);
            for (i = 0; i < ops.length; i++) if (ops[i].v === v) return ops[i].color || '';
        }
        return '';
    }
    function textoCampo(campo, v, conEmoji) {
        var i, ops, r = '', c;
        if (v === undefined || v === null || v === '') return '';
        if (v === SIN) r = campo.sinDato || 'sin dato';
        else if (campo.tipo === 'numero') {
            var n = valorNumero(campo, v);
            if (isNaN(n)) return '';
            r = String(n).replace('.', ',') + (campo.unidad ? ' ' + campo.unidad : '');
        } else if (campo.tipo === 'sino') r = v === 'si' ? 'Sí' : (v === 'no' ? 'No' : '');
        else if (campo.tipo === 'opcion') {
            ops = lista(campo.opciones);
            for (i = 0; i < ops.length; i++) if (ops[i].v === v) r = ops[i].t;
            if (!r) r = txt(v, 30);
        } else r = sinPersonales(v, 80);
        if (!r) return '';
        c = conEmoji ? EMOJI[colorCampo(campo, v)] : '';
        return txt(campo.etiqueta) + ': ' + r + (c ? ' ' + c : '');
    }

    // ── Estado de un caso ───────────────────────────────────────────
    function nuevoEstado(o) {
        o = o || {};
        var ahora = Date.now();
        return {
            id: 'e' + ahora.toString(36) + azar(4), v: D.version || 0,
            app: txt(o.app, 20), rol: o.rol === 'tecnico' ? 'tecnico' : 'oficina',
            iniMs: ahora, finMs: 0,
            servicio: '', sintoma: '', variante: '',
            resp: {}, motivo: {}, datos: {},
            salida: '', caso: '', causa: '', estadoVisto: '',
            pre: { sw: '', nom: '', plan: '', ord: '', tipoOrden: '' }
        };
    }

    // La llamada al ingeniero va ANTES que técnico: sus guías solo existen sobre opciones que hablan de varios clientes
    // (todo el puerto caído, torre vacía, casi nadie conectado, la plataforma no carga), y un dato de técnico de UN cliente no debe taparlas.
    var ORDEN_SALIDAS = ['cartera', 'comercial', 'masiva', 'ingeniero_llamada', 'autorizador', 'tecnico', 'ingeniero_mensaje', 'resuelve'];
    var TEXTO_SALIDA = {
        cartera: 'Esto es de cartera, no del ingeniero: se cobra y se reactiva.',
        comercial: 'Esto es de comercial, no del ingeniero.',
        masiva: 'Parece falla masiva o apagón. Si ya sale la franja de esa falla, NO la reportes otra vez ni llames: el ingeniero ya sabe. Si no hay franja, usa el botón rojo «Reportar falla masiva o apagón» y sigue la guía del paso marcado: si es daño de varios clientes, llama al ingeniero UNA sola vez; si es apagón, NO llames.',
        autorizador: 'Primero a la persona que autoriza módems en tu sede. Solo si ella no puede, pasa al ingeniero.',
        tecnico: 'Esto es de técnico: crea la orden de visita. No es del ingeniero.',
        ingeniero_llamada: 'Esto sí es para el ingeniero, por LLAMADA. Escoge el caso y manda la ficha.',
        ingeniero_mensaje: 'Esto puede pasar al ingeniero por MENSAJE con la ficha. Escoge el caso.',
        resuelve: 'Se puede arreglar ahí mismo: sigue la guía del paso marcado.'
    };

    // Una guía solo mueve la sugerencia si trae "si" y el dato de ESE campo coincide: si:{campo, v:[códigos]} para campos de un toque
    // (en sí/no los códigos son 'si' y 'no'), o si:{campo, color:['rojo','amarillo']} para un número con semáforo. Sin "si", solo se muestra.
    function guiaCoincide(g, datos, p) {
        var s = g && g.si, cs, c = null, i;
        if (!s || !s.campo) return false;
        if (lista(s.v).length && lista(s.v).indexOf(datos[s.campo]) >= 0) return true;
        if (!lista(s.color).length || !p) return false;
        if (s.sinDato === false && datos[s.campo] === SIN) return false;   // el botón alterno («No reporta») no cuenta para esta guía
        cs = lista(p.campos); for (i = 0; i < cs.length; i++) if (cs[i].id === s.campo) c = cs[i];
        return !!c && lista(s.color).indexOf(colorCampo(c, datos[s.campo])) >= 0;
    }
    function evaluar(e) {
        e = e || {};
        var resp = e.resp || {}, motivo = e.motivo || {}, datos = e.datos || {};
        var ps = pasos(e.servicio, e.rol, e.sintoma, e.variante);
        var hechos = 0, faltan = [], problemas = [], guias = [], salidas = {};
        ps.forEach(function (p) {
            var r = resp[p.id] || '', rojo = false, amarillo = false;
            lista(p.campos).forEach(function (c) {
                var col = colorCampo(c, datos[c.id]);
                if (col === 'rojo') rojo = true;
                if (col === 'amarillo') amarillo = true;
            });
            if (r) hechos++;
            else if (p.obligatorio) faltan.push(p);
            // La parada de alturas respondida "No pude: inseguro" nunca penaliza.
            var seguro = p.seguridad && r === 'nopude' && motivo[p.id] === 'inseguro';
            if (!seguro && (r === 'problema' || rojo)) problemas.push(p);
            if (!seguro && (r === 'problema' || rojo || amarillo)) {
                lista(p.siMal).forEach(function (g) {
                    guias.push({ pasoId: p.id, cuando: g.cuando || '', hacer: g.hacer || '', salida: g.salida || '' });
                    if (g.salida && guiaCoincide(g, datos, p)) salidas[g.salida] = true;
                });
            }
        });
        if (e.rol === 'tecnico') delete salidas.tecnico;   // el técnico ya está en sitio
        var sug = { salida: '', texto: '' }, i;
        for (i = 0; i < ORDEN_SALIDAS.length; i++) {
            if (salidas[ORDEN_SALIDAS[i]]) { sug = { salida: ORDEN_SALIDAS[i], texto: TEXTO_SALIDA[ORDEN_SALIDAS[i]] }; break; }
        }
        var casos = lista(D.casos).filter(function (c) {
            var s = lista(c.servicios), r = lista(c.roles);
            return (!s.length || s.indexOf(e.servicio) >= 0) && (!r.length || r.indexOf(e.rol) >= 0);
        });
        return { pasos: ps, hechos: hechos, total: ps.length, faltan: faltan, problemas: problemas, guias: guias,
                 sugerencia: sug, casos: casos, puedeEscalar: ps.length > 0 && faltan.length === 0 };
    }

    // ── Ficha de WhatsApp ───────────────────────────────────────────
    function buscar(arr, id) {
        var a = lista(arr), i;
        for (i = 0; i < a.length; i++) if (a[i] && a[i].id === id) return a[i];
        return null;
    }
    function fichaId(e) {
        var d = new Date(e.iniMs || 0), id = String(e.id || '');
        var letra = (String(e.servicio || 'x').charAt(0) || 'x').toUpperCase();
        return letra + '-' + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + id.slice(-4);
    }
    function nombreServicio(id) { var s = servicioDe(id); return s ? txt(s.nombre) : txt(id, 20); }
    function ctxLimpio(e, ctx) {
        ctx = ctx || {}; e = e || {};
        var pre = e.pre || {};
        return {
            app: txt(ctx.app || e.app, 20), rol: (ctx.rol || e.rol) === 'tecnico' ? 'tecnico' : 'oficina',
            municipio: txt(ctx.municipio, 40), oficinaId: txt(ctx.oficinaId, 40),
            quienId: txt(ctx.quienId, 40), quienNombre: txt(ctx.quienNombre, 40),
            ordenId: sinPersonalesCorto(ctx.ordenId || pre.ord, 32),   // los ids de orden miden 23 ('ord_'+13 dígitos+'_'+5 letras)
            servicioWisphub: sinPersonalesCorto(ctx.servicioWisphub || pre.sw, 20),
            nombreCorto: primerNombre(ctx.nombreCorto || pre.nom),
            plan: txt(ctx.plan || pre.plan, 40),
            estadoVisto: txt(ctx.estadoVisto || e.estadoVisto, 40)
        };
    }
    // Ids de orden y de servicio: solo letras, números y guiones (no se tapan como teléfono).
    function sinPersonalesCorto(s, max) { return txt(s).replace(/[^A-Za-z0-9_\-]/g, '').slice(0, max || 20); }

    function armarFicha(e, c, corto) {
        var ev = evaluar(e), L = [], sv = servicioDe(e.servicio), datos = e.datos || {}, resp = e.resp || {}, motivo = e.motivo || {};
        var maxTxt = corto ? 28 : 80, maxTit = corto ? 26 : 70;
        L.push('🛑 FICHA ' + fichaId(e) + ' · ' + nombreServicio(e.servicio).toUpperCase() + (c.municipio ? ' · ' + c.municipio : ''));
        L.push('De: ' + (c.rol === 'tecnico' ? 'TÉCNICO' : 'OFICINA') + (c.quienNombre ? ' ' + c.quienNombre : '') +
               (c.ordenId ? ' · Orden ' + c.ordenId : '') + ' · ' + fechaCorta(e.finMs || Date.now()));
        var cli = [];
        if (c.nombreCorto) cli.push(c.nombreCorto);
        if (c.servicioWisphub) cli.push('servicio WispHub ' + c.servicioWisphub);
        if (c.plan) cli.push('plan ' + c.plan);
        if (c.estadoVisto) cli.push(c.estadoVisto);
        if (cli.length) L.push('Cliente: ' + cli.join(' · '));
        var sint = sv ? buscar(sv.sintomas, e.sintoma) : null, vari = sv ? buscar(sv.variantes, e.variante) : null;
        if (sint || vari) L.push('Falla: ' + (sint ? txt(sint.t) : '') + (sint && vari ? ' · ' : '') + (vari ? txt(vari.t) : ''));
        ev.pasos.forEach(function (p) {
            lista(p.campos).forEach(function (cm) {
                var v = datos[cm.id], t;
                if (cm.tipo === 'texto' && v && v !== SIN) t = txt(cm.etiqueta) + ': ' + sinPersonales(v, maxTxt);
                else t = textoCampo(cm, v, true);
                if (t) L.push(t);
            });
        });
        var prob = ev.problemas.filter(function (p) { return resp[p.id] === 'problema'; }).map(function (p) { return txt(p.titulo, maxTit); });
        if (prob.length) L.push('Con problema: ' + prob.join('; '));
        var np = ev.pasos.filter(function (p) { return resp[p.id] === 'nopude'; }).map(function (p) {
            var m = buscar(D.motivosNoPude, motivo[p.id]);
            return txt(p.titulo, maxTit) + ' (' + (m ? txt(m.t) : 'sin motivo') + ')';
        });
        if (np.length) L.push('No pude: ' + np.join('; '));
        var caso = buscar(D.casos, e.caso);
        if (caso) L.push('CASO: «' + txt(caso.texto, corto ? 70 : 140) + '» → ' + (caso.via === 'llamada' ? 'LLAMADA' : 'MENSAJE'));
        L.push('Hechos ' + ev.hechos + '/' + ev.total + ' · fotos (máximo 2) a continuación');
        return L.join('\n');
    }
    function textoWhatsApp(e, ctx, completo) {
        e = e || {};
        var c = ctxLimpio(e, ctx), t = armarFicha(e, c, false), cola = '… (usa Copiar texto completo)';
        if (completo || t.length <= MAX_FICHA) return t;
        t = armarFicha(e, c, true);                      // primero se recortan los textos largos
        if (t.length <= MAX_FICHA) return t;
        return t.slice(0, MAX_FICHA - cola.length - 1).replace(/\s+\S*$/, '') + '\n' + cola;
    }
    // Resumen para la orden al técnico: máximo 160, sin < ni >.
    function resumenOrden(e) {
        e = e || {};
        var ev = evaluar(e), sv = servicioDe(e.servicio), sint = sv ? buscar(sv.sintomas, e.sintoma) : null, datos = e.datos || {}, partes = [];
        ev.pasos.forEach(function (p) {
            lista(p.campos).forEach(function (cm) {
                var col = colorCampo(cm, datos[cm.id]);
                if (col === 'rojo' || col === 'amarillo') partes.push(textoCampo(cm, datos[cm.id], false));
            });
        });
        ev.problemas.forEach(function (p) { if ((e.resp || {})[p.id] === 'problema' && !lista(p.campos).length) partes.push(txt(p.titulo, 40)); });
        var r = nombreServicio(e.servicio).toUpperCase() + (sint ? ' ' + txt(sint.t).toLowerCase() : '') + '. ' +
                (partes.length ? partes.join('; ') + '. ' : '') + 'Ficha ' + fichaId(e) + ' ' + ev.hechos + '/' + ev.total;
        r = txt(r.replace(/[<>]/g, ''));
        return r.length > 160 ? r.slice(0, 159) + '…' : r;
    }

    // ── Registro compacto (lo único que se guarda en la nube) ───────
    function registro(e, ctx) {
        e = e || {};
        var c = ctxLimpio(e, ctx), ev = evaluar(e), d = {}, np = {}, datos = e.datos || {}, resp = e.resp || {}, motivo = e.motivo || {};
        ev.pasos.forEach(function (p) {
            if (resp[p.id] === 'nopude') np[claveSegura(p.id)] = txt(motivo[p.id], 30);
            lista(p.campos).forEach(function (cm) {
                var v = datos[cm.id], n;
                if (v === undefined || v === null || v === '') return;
                if (v === SIN) d[claveSegura(cm.id)] = SIN;
                else if (cm.tipo === 'numero') { n = valorNumero(cm, v); if (!isNaN(n)) d[claveSegura(cm.id)] = n; }
                else if (cm.tipo === 'texto') d[claveSegura(cm.id)] = sinPersonales(v, 80);
                else d[claveSegura(cm.id)] = txt(v, 30);
            });
        });
        return {
            id: txt(e.id, 40), v: Number(e.v) || 0, app: c.app, rol: c.rol,
            serv: txt(e.servicio, 20), sint: txt(e.sintoma, 30), vari: txt(e.variante, 30),
            of: c.oficinaId, mun: c.municipio, porId: c.quienId, porNombre: c.quienNombre,
            sw: c.servicioWisphub, ord: c.ordenId,
            iniMs: Number(e.iniMs) || 0, finMs: Number(e.finMs) || 0,
            sal: txt(e.salida, 20), caso: txt(e.caso, 40), causa: txt(e.causa, 30),
            h: ev.hechos, t: ev.total,
            pr: ev.problemas.map(function (p) { return txt(p.id, 60); }), np: np, d: d
        };
    }
    function docMes(ms, oficinaId) {
        var n = Number(ms) || 0;
        if (n < FECHA_MIN) n = FECHA_MIN;                // reloj del celular malo
        var f = new Date(n), of = txt(oficinaId).replace(/[^A-Za-z0-9_\-]/g, '_');
        return 'esc_' + f.getFullYear() + '_' + p2(f.getMonth() + 1) + '_' + (of || 'sin');
    }

    // ── Tabla del mes (solo administrador) ──────────────────────────
    function resumenMes(registros) {
        var arr = [], k, R;
        if (Object.prototype.toString.call(registros) === '[object Array]') arr = registros;
        else if (registros && typeof registros === 'object') for (k in registros) if (Object.prototype.hasOwnProperty.call(registros, k)) arr.push(registros[k]);
        // Mapas SIN prototipo: las claves vienen de la nube y un nombre como «__proto__» no debe tocar Object.prototype.
        R = { total: 0, porSalida: Object.create(null), resueltosSinIngeniero: 0, escalados: [], porPersona: Object.create(null), noPudePorMotivo: Object.create(null), causasFrecuentes: [] };
        var causas = Object.create(null);
        arr.forEach(function (r) {
            if (typeof r === 'string') { try { r = JSON.parse(r); } catch (x) { r = null; } }
            if (!r || typeof r !== 'object') return;
            var sal = txt(r.sal, 20) || 'sin_salida', nombre = txt(r.porNombre, 40) || 'Sin nombre';
            var h = Number(r.h) || 0, t = Number(r.t) || 0, pct = t > 0 ? Math.round(h * 100 / t) : 0, m, c, mot;
            R.total++;
            R.porSalida[sal] = (R.porSalida[sal] || 0) + 1;
            if (sal === 'resuelto' || sal === 'orden' || sal === 'pendiente' || sal === 'masiva_conocida') R.resueltosSinIngeniero++;
            var P = R.porPersona[nombre] || (R.porPersona[nombre] = { casos: 0, escalados: 0, promedioHechosPct: 0, _suma: 0 });
            P.casos++; P._suma += pct;
            if (sal === 'ingeniero') {
                P.escalados++;
                c = buscar(D.casos, r.caso);
                R.escalados.push({ porNombre: nombre, serv: nombreServicio(r.serv), caso: c ? txt(c.texto) : (txt(r.caso, 40) || 'sin caso'),
                                   h: h, t: t, fecha: fechaCorta(Number(r.finMs) || Number(r.iniMs) || 0), ms: Number(r.finMs) || 0 });
            }
            if (r.np && typeof r.np === 'object') for (m in r.np) if (Object.prototype.hasOwnProperty.call(r.np, m)) {
                mot = buscar(D.motivosNoPude, r.np[m]);
                mot = mot ? txt(mot.t) : (txt(r.np[m], 30) || 'sin motivo');
                R.noPudePorMotivo[mot] = (R.noPudePorMotivo[mot] || 0) + 1;
            }
            if (r.causa) { c = buscar(D.causasResuelto, r.causa); c = c ? txt(c.t) : txt(r.causa, 30); causas[c] = (causas[c] || 0) + 1; }
        });
        for (k in R.porPersona) if (Object.prototype.hasOwnProperty.call(R.porPersona, k)) {
            R.porPersona[k].promedioHechosPct = R.porPersona[k].casos ? Math.round(R.porPersona[k]._suma / R.porPersona[k].casos) : 0;
            delete R.porPersona[k]._suma;
        }
        for (k in causas) if (Object.prototype.hasOwnProperty.call(causas, k)) R.causasFrecuentes.push({ t: k, n: causas[k] });
        R.causasFrecuentes.sort(function (a, b) { return b.n - a.n; });
        R.escalados.sort(function (a, b) { return b.ms - a.ms; });
        return R;
    }
    var NOMBRE_SALIDA = { resuelto: 'Resuelto', orden: 'Orden al técnico', pendiente: 'Pendiente otra visita', ingeniero: 'Pasó al ingeniero', masiva_conocida: 'Era de una falla masiva', sin_salida: 'Sin salida' };
    function tablaMesHTML(R) {
        R = R || resumenMes([]);
        var h = '', k, est = 'border:1px solid #ccc;padding:4px 8px;text-align:left;';
        function fila(cs, th) { return '<tr>' + cs.map(function (c) { return '<' + (th ? 'th' : 'td') + ' style="' + est + '">' + esc(c) + '</' + (th ? 'th' : 'td') + '>'; }).join('') + '</tr>'; }
        function tabla(cab, filas) { return '<table style="border-collapse:collapse;width:100%;margin:6px 0 14px;font-size:13px;">' + fila(cab, true) + (filas.length ? filas.join('') : fila(['Sin datos'].concat(cab.slice(1).map(function () { return ''; })))) + '</table>'; }
        h += '<div class="pvck-tablames"><p><b>Casos del mes: ' + esc(R.total) + '</b> · resueltos sin ingeniero: <b>' + esc(R.resueltosSinIngeniero) + '</b> · pasaron al ingeniero: <b>' + esc(lista(R.escalados).length) + '</b></p>';
        var f = [];
        for (k in R.porSalida) if (Object.prototype.hasOwnProperty.call(R.porSalida, k)) f.push(fila([Object.prototype.hasOwnProperty.call(NOMBRE_SALIDA, k) ? NOMBRE_SALIDA[k] : k, R.porSalida[k]]));
        h += tabla(['Salida', 'Casos'], f);
        f = [];
        for (k in R.porPersona) if (Object.prototype.hasOwnProperty.call(R.porPersona, k)) f.push(fila([k, R.porPersona[k].casos, R.porPersona[k].escalados, R.porPersona[k].promedioHechosPct + ' %']));
        h += tabla(['Persona', 'Casos', 'Pasó al ingeniero', 'Pasos hechos (promedio)'], f);
        h += tabla(['Quién escaló', 'Servicio', 'Caso', 'Hechos', 'Fecha'], lista(R.escalados).map(function (x) { return fila([x.porNombre, x.serv, x.caso, x.h + '/' + x.t, x.fecha]); }));
        f = [];
        for (k in R.noPudePorMotivo) if (Object.prototype.hasOwnProperty.call(R.noPudePorMotivo, k)) f.push(fila([k, R.noPudePorMotivo[k]]));
        h += tabla(['«No pude» por motivo', 'Veces'], f);
        h += tabla(['Causa cuando quedó resuelto', 'Veces'], lista(R.causasFrecuentes).map(function (x) { return fila([x.t, x.n]); }));
        return h + '</div>';
    }

    // ── Falla masiva o apagón ───────────────────────────────────────
    var MSJ_MASIVA = 'Hay una falla general en su sector y ya estamos trabajando en ella. No necesita reiniciar ni mover nada.';
    var MSJ_APAGON = 'Hay un corte de energía en el sector. El servicio vuelve solo cuando regrese la luz.';
    function masivaNueva(form, ctx) {
        form = form || {}; ctx = ctx || {};
        var ahora = Number(ctx.ahoraMs) || Date.now(), tipo = form.tipo === 'apagon' ? 'apagon' : 'masiva';
        var desde = Number(form.desdeMs) || 0, hm = /^(\d{1,2}):(\d{2})$/.exec(String(form.desdeHora || '')), f;
        if (!desde && hm) {
            f = new Date(ahora); f.setHours(Number(hm[1]), Number(hm[2]), 0, 0);
            desde = f.getTime();
            if (desde > ahora + 5 * 60000) desde -= 24 * 3600000;   // la hora era de ayer
        }
        if (!desde) desde = ahora;
        var luz = form.hayLuz === 'si' || form.hayLuz === 'no' ? form.hayLuz : 'nose';
        return {
            id: 'm' + ahora.toString(36) + azar(4), tipo: tipo,
            municipio: txt(form.municipio, 40), servicio: txt(form.servicio, 20),
            comun: sinPersonales(form.comun, 80), afectados: Math.max(0, Math.round(aNumero(form.afectados)) || 0),
            desdeMs: desde, hayLuz: luz,
            mensajeCliente: txt(form.mensajeCliente, 200) || (tipo === 'apagon' ? MSJ_APAGON : MSJ_MASIVA),
            porApp: txt(ctx.app, 20), porNombre: txt(ctx.quienNombre, 40),
            creadaMs: ahora, venceMs: ahora + 6 * 3600000, cerradaMs: 0, cerradaPor: ''
        };
    }
    function masivasVigentes(mapa, ahoraMs, municipios) {
        // Lo que hay en la nube NO es de fiar (reglas abiertas): aquí se topan la vigencia, la cantidad y el largo de los textos.
        var ahora = Number(ahoraMs) || Date.now(), arr = [], k, TOPE = 6 * 3600000, esMapa = false;
        var mun = lista(municipios).map(sinTildes).filter(function (x) { return x; });
        if (Object.prototype.toString.call(mapa) === '[object Array]') arr = mapa;
        else if (mapa && typeof mapa === 'object') { esMapa = true; for (k in mapa) if (Object.prototype.hasOwnProperty.call(mapa, k)) arr.push(mapa[k]); }
        // Un aviso sin "id" toma la clave con la que está guardado: si no, nadie lo podría quitar desde la app.
        function claveDe(m) { var c; if (esMapa) for (c in mapa) if (Object.prototype.hasOwnProperty.call(mapa, c) && mapa[c] === m) return c; return ''; }
        return arr.filter(function (m) {
            if (!m || typeof m !== 'object') return false;
            if (Number(m.cerradaMs) > 0) return false;
            var cre = Number(m.creadaMs) || 0;
            if (cre > ahora + 3600000) return false;   // creada "en el futuro": dato falso o reloj muy corrido
            if (!(Math.min(Number(m.venceMs) || 0, cre + TOPE) > ahora)) return false;   // nunca más de 6 h, diga lo que diga la nube
            return !mun.length || mun.indexOf(sinTildes(m.municipio)) >= 0;
        }).sort(function (a, b) { return (Number(b.creadaMs) || 0) - (Number(a.creadaMs) || 0); })
          .slice(0, 8).map(function (m) {
            var cre = Number(m.creadaMs) || 0;
            return { id: txt(m.id, 40) || txt(claveDe(m), 40), tipo: m.tipo === 'apagon' ? 'apagon' : 'masiva',
                     municipio: txt(m.municipio, 40), servicio: txt(m.servicio, 20), comun: sinPersonales(m.comun, 80),
                     afectados: Math.min(9999, Math.max(0, Math.round(Number(m.afectados)) || 0)),
                     desdeMs: Number(m.desdeMs) || cre, hayLuz: (m.hayLuz === 'si' || m.hayLuz === 'no') ? m.hayLuz : 'nose',
                     mensajeCliente: txt(m.mensajeCliente, 200) || (m.tipo === 'apagon' ? MSJ_APAGON : MSJ_MASIVA),
                     porApp: txt(m.porApp, 20), porNombre: txt(m.porNombre, 40),
                     creadaMs: cre, venceMs: Math.min(Number(m.venceMs) || 0, cre + TOPE), cerradaMs: 0 };
        });
    }
    var LUZ = { si: 'Sí hay luz en el sector', no: 'NO hay luz en el sector', nose: 'No se sabe si hay luz' };
    function servicioMasiva(s) { return (s === 'todo' || s === 'todos') ? 'Todos los servicios' : nombreServicio(s || ''); }
    function textoMasiva(m) {
        m = m || {};
        var L = [];
        L.push((m.tipo === 'apagon' ? '⚡ APAGÓN' : '🚨 FALLA MASIVA') + (m.municipio ? ' · ' + txt(m.municipio) : '') + (m.servicio ? ' · ' + servicioMasiva(m.servicio) : ''));
        if (m.comun) L.push('En común: ' + txt(m.comun));
        L.push('Afectados: ' + (Number(m.afectados) || 0) + ' · desde ' + fechaCorta(Number(m.desdeMs) || Number(m.creadaMs) || 0));
        L.push(LUZ[m.hayLuz] || LUZ.nose);
        if (m.porNombre) L.push('Reporta: ' + txt(m.porNombre) + (m.porApp ? ' (' + txt(m.porApp) + ')' : ''));
        if (m.mensajeCliente) L.push('A los clientes se les dice: ' + txt(m.mensajeCliente));
        L.push('Aviso ' + txt(m.id, 20) + ' · vence solo a las ' + hora(Number(m.venceMs) || 0));
        return L.join('\n');
    }
    function lineaFranja(m) {
        var sv = servicioMasiva(m.servicio);             // un aviso viejo o ajeno puede venir sin servicio: nunca «()»
        return '⚠ ' + (m.tipo === 'apagon' ? 'Apagón' : 'Falla masiva') + ' en ' + (txt(m.municipio, 40) || 'la zona') +
               (sv ? ' (' + sv + ')' : '') + ' desde ' + hora(Number(m.desdeMs) || Number(m.creadaMs) || 0) + ': ' +
               txt(m.mensajeCliente, 200) + ' — NO llames al ingeniero por clientes de este sector';
    }
    function franjaHTML(vigentes) {
        var v = lista(vigentes);
        if (!v.length) return '';
        return v.map(function (m) {
            var ambar = m.tipo === 'apagon';
            return '<div class="pvck-franja' + (ambar ? ' pvck-franja-ambar' : '') + '" style="background:' + (ambar ? '#b7791f' : '#c53030') +
                   ';color:#fff;padding:10px 12px;border-radius:8px;margin:0 0 8px;font:600 14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">' + esc(lineaFranja(m)) + '</div>';
        }).join('');
    }

    // ════════════════════════════════════════════════════════════════
    // DE AQUÍ PARA ABAJO: PANTALLA (necesita document). En node no se usa.
    // ════════════════════════════════════════════════════════════════
    var S = null;        // sesión de la capa abierta: { op, e, vista, vistaAntes, m, finalizado, ... }

    // ── Guardado local (borrador y cola de pendientes) ──────────────
    function lsLeer(k) { try { return global.localStorage ? global.localStorage.getItem(k) : null; } catch (x) { return null; } }
    function lsPoner(k, v) { try { if (global.localStorage) { global.localStorage.setItem(k, v); return true; } } catch (x) {} return false; }
    function lsBorrar(k) { try { if (global.localStorage) global.localStorage.removeItem(k); } catch (x) {} }
    function colaLeer() {
        var a; try { a = JSON.parse(lsLeer(COLA) || '[]'); } catch (x) { a = []; }
        return lista(a).filter(function (p) { return p && typeof p.docId === 'string' && typeof p.id === 'string' && typeof p.json === 'string'; });
    }
    function colaPoner(a) { return lsPoner(COLA, JSON.stringify(a.slice(-200))); }   // false: este equipo no dejó guardar (lleno o bloqueado)
    function colaQuitar(id) { return colaPoner(colaLeer().filter(function (p) { return p.id !== id; })); }
    function pendientes() { return colaLeer().length; }
    function bloqueado() { return global._mantBloqueando === true; }

    // Intenta subir un pendiente. Devuelve una promesa que resuelve true si subió.
    // Con topeMs: si guardar no contesta en ese tiempo resuelve false y el registro SIGUE en la cola (no se borra nada);
    // si la subida termina después, igual se quita de la cola en ese momento.
    function subir(p, guardar, topeMs) {
        if (typeof guardar !== 'function' || bloqueado()) return Promise.resolve(false);
        if (global.navigator && global.navigator.onLine === false) return Promise.resolve(false);
        var pr, hecho;
        try { pr = guardar(p.docId, p.id, p.json); } catch (x) { return Promise.resolve(false); }
        hecho = Promise.resolve(pr).then(function () { colaQuitar(p.id); return true; }, function () { return false; });
        if (!(topeMs > 0)) return hecho;
        return new Promise(function (listo) {
            var t = setTimeout(function () { listo(false); }, topeMs);
            hecho.then(function (ok) { clearTimeout(t); listo(ok); });
        });
    }
    var ESPERA_SUBIR = 20000;   // con señal mala Firestore ni resuelve ni rechaza: 20 s por registro y se sigue con el otro
    var _reenviando = null;     // una sola cadena de reenvío a la vez (temporizador, abrir() y el botón de OFICINAS la comparten)
    function reenviarPendientes(guardar, topeMs) {
        if (_reenviando) return _reenviando;
        var a = colaLeer(), tope = Number(topeMs) > 0 ? Number(topeMs) : ESPERA_SUBIR;
        var fin = function () { _reenviando = null; return pendientes(); };
        if (!a.length) return Promise.resolve(0);
        _reenviando = a.reduce(function (cadena, p) {
            return cadena.then(function () { return subir(p, guardar, tope); });
        }, Promise.resolve()).then(fin, fin);
        return _reenviando;
    }

    // Borrador por app Y por persona: en un equipo compartido nadie retoma (ni borra) el caso a medias de otro.
    function claveBorrador(op) {
        op = op || (S && S.op) || {};
        var q = op.quien || {}, quien = String(q.id === undefined || q.id === null || q.id === '' ? (q.nombre === undefined || q.nombre === null ? '' : q.nombre) : q.id);
        return 'pv_check_borrador_' + txt(op.app, 20) + '_' + quien.replace(/[^A-Za-z0-9_]/g, '').slice(0, 24);
    }
    function guardarBorrador() {
        if (!S || !S.e || S.finalizado) return;
        lsPoner(claveBorrador(), JSON.stringify({ ms: Date.now(), e: S.e, vista: S.vista === 'lista' || S.vista === 'decidir' ? S.vista : 'inicio' }));
    }
    function leerBorrador() {
        var b; try { b = JSON.parse(lsLeer(claveBorrador()) || 'null'); } catch (x) { b = null; }
        if (!b || !b.e || typeof b.e !== 'object' || !b.e.id) return null;
        if (!(Date.now() - Number(b.ms) < 12 * 3600000) || b.e.v !== D.version) { lsBorrar(claveBorrador()); return null; }
        if (!b.e.resp || !b.e.datos || !b.e.motivo) return null;
        if (!b.e.pre) b.e.pre = { sw: '', nom: '', plan: '', ord: '', tipoOrden: '' };
        return b;
    }

    function ctxDe() {
        var op = S.op, q = op.quien || {};
        return { app: op.app, rol: S.e ? S.e.rol : op.rol, municipio: op.municipio, oficinaId: op.oficinaId, quienId: q.id, quienNombre: q.nombre };
    }
    function avisar(msg) {
        if (S && S.op && typeof S.op.aviso === 'function') { try { S.op.aviso(msg); return; } catch (x) {} }
        var c = doc().getElementById('pvCheckAviso');
        if (c) { c.textContent = msg; c.style.display = 'block'; clearTimeout(avisar._t); avisar._t = setTimeout(function () { c.style.display = 'none'; }, 5000); }
    }
    function doc() { return global.document; }

    // Cierra el caso: arma el registro, lo deja en la cola y lo manda SIN esperar.
    function finalizar(salida) {
        if (!S || !S.e || S.finalizado) return;
        var e = S.e, op = S.op;
        e.salida = salida; e.finMs = Date.now();
        S.finalizado = true;
        lsBorrar(claveBorrador());                       // el caso ya quedó cerrado: no se ofrece como "a medias"
        if (op.modoPrueba) { avisar('Modo prueba: no se sube a la nube'); return; }
        var p = { docId: docMes(e.finMs, op.oficinaId), id: e.id, json: JSON.stringify(registro(e, ctxDe())), ms: e.finMs };
        var a = colaLeer().filter(function (x) { return x.id !== p.id; }); a.push(p);
        var enCola = colaPoner(a);                       // false: no quedó en la cola (almacenamiento lleno o bloqueado): no se promete un reenvío
        var NO_GUARDO = 'No se pudo guardar en este equipo: copia el texto y envíalo igual.';
        if (bloqueado()) { avisar(enCola ? 'La app está en mantenimiento: el registro queda pendiente y se sube después.' : NO_GUARDO); return; }
        subir(p, op.guardar).then(function (ok) { if (!ok) avisar(enCola ? 'Sin señal: el registro quedó pendiente y se sube solo cuando vuelva.' : NO_GUARDO); });
    }

    function abrirWhatsApp(texto) {
        try { global.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank'); } catch (x) {}
    }
    function copiar(texto) {
        var ok = function () { avisar('Texto copiado. Pégalo en el grupo de soporte de tu sede.'); };
        var plan2 = function () {
            try {
                var t = doc().createElement('textarea');
                t.value = texto; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
                doc().body.appendChild(t); t.select();
                var bien = doc().execCommand('copy');
                doc().body.removeChild(t);
                if (bien) { ok(); return; }
            } catch (x) {}
            try { global.prompt('Copia este texto:', texto); } catch (y) {}
        };
        try {
            if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
                global.navigator.clipboard.writeText(texto).then(ok, plan2); return;
            }
        } catch (x) {}
        plan2();
    }

    // ── Estilos (una sola vez) ──────────────────────────────────────
    var CSS = [
        '#pvCheckCapa{--pv-fondo:#f4f5f7;--pv-tarjeta:#fff;--pv-texto:#1a202c;--pv-suave:#5a6474;--pv-borde:#d5dae2;--pv-azul:#1f5fbf;--pv-verde:#1d8a4a;--pv-ambar:#b7791f;--pv-rojo:#c53030;--pv-verde-f:#e3f4ea;--pv-ambar-f:#fbf0da;--pv-rojo-f:#fbe4e4;',
        'position:fixed;left:0;top:0;right:0;bottom:0;z-index:99990;background:var(--pv-fondo);color:var(--pv-texto);font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;display:flex;flex-direction:column;overflow:hidden;text-align:left;}',
        '#pvCheckCapa.pvck-oscuro{--pv-fondo:#12161c;--pv-tarjeta:#1d232c;--pv-texto:#e8ecf1;--pv-suave:#a3adba;--pv-borde:#364050;--pv-azul:#6ea8ff;--pv-verde-f:#16341f;--pv-ambar-f:#3a2e12;--pv-rojo-f:#3f1a1a;}',
        '#pvCheckCapa *{box-sizing:border-box;}',
        '#pvCheckCapa button,#pvCheckCapa input,#pvCheckCapa select{font:inherit;color:inherit;}',
        '#pvCheckCapa :focus-visible{outline:3px solid var(--pv-azul);outline-offset:2px;}',
        '.pvck-cab{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--pv-tarjeta);border-bottom:1px solid var(--pv-borde);}',
        '.pvck-cab h2{flex:1 1 auto;margin:0;font-size:16px;line-height:1.2;}',
        '.pvck-cont{font-weight:700;color:var(--pv-suave);white-space:nowrap;}',
        '.pvck-x{min-width:44px;min-height:44px;border:1px solid var(--pv-borde);border-radius:8px;background:transparent;font-size:18px;cursor:pointer;}',
        '.pvck-cuerpo{flex:1 1 auto;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;}',
        '.pvck-in{max-width:720px;margin:0 auto;padding:10px 12px 40px;}',
        '.pvck-b{display:block;width:100%;min-height:44px;margin:8px 0;padding:10px 14px;border:1px solid var(--pv-borde);border-radius:10px;background:var(--pv-tarjeta);font-weight:600;text-align:center;cursor:pointer;}',
        '.pvck-b:disabled{opacity:.5;cursor:not-allowed;}',
        '.pvck-b-rojo{background:var(--pv-rojo);border-color:var(--pv-rojo);color:#fff !important;}',
        '.pvck-b-azul{background:#1f5fbf;border-color:#1f5fbf;color:#fff !important;}',
        '.pvck-b-verde{background:var(--pv-verde);border-color:var(--pv-verde);color:#fff !important;}',
        '.pvck-b-grande{min-height:56px;font-size:17px;text-align:left;}',
        '.pvck-t{background:var(--pv-tarjeta);border:1px solid var(--pv-borde);border-radius:12px;padding:12px;margin:10px 0;}',
        '.pvck-t.pvck-r-bien{border-left:6px solid var(--pv-verde);}',
        '.pvck-t.pvck-r-problema{border-left:6px solid var(--pv-rojo);}',
        '.pvck-t.pvck-r-nopude{border-left:6px solid var(--pv-suave);}',
        '.pvck-t h3{margin:0 0 4px;font-size:15px;line-height:1.3;}',
        '.pvck-ob{color:var(--pv-rojo);font-weight:700;}',
        '.pvck-bloque{margin:18px 0 4px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--pv-suave);}',
        '.pvck-suave{color:var(--pv-suave);font-size:13px;}',
        '.pvck-link{background:none;border:0;padding:8px 0;min-height:36px;color:var(--pv-azul) !important;text-decoration:underline;cursor:pointer;font-size:14px;}',
        '.pvck-ayuda{display:none;background:var(--pv-fondo);border-radius:8px;padding:8px 10px;margin:2px 0 8px;font-size:14px;}',
        '.pvck-ayuda.pvck-ver{display:block;}',
        '.pvck-campo{margin:10px 0;}',
        '.pvck-campo label,.pvck-et{display:block;font-size:13px;font-weight:600;color:var(--pv-suave);margin-bottom:4px;}',
        '.pvck-chips{display:flex;flex-wrap:wrap;gap:6px;}',
        '.pvck-chip{min-height:44px;padding:8px 12px;border:1px solid var(--pv-borde);border-radius:22px;background:var(--pv-tarjeta);cursor:pointer;font-size:14px;max-width:100%;text-align:left;}',
        '.pvck-chip.pvck-sel{border-width:2px;border-color:var(--pv-azul);font-weight:700;}',
        '.pvck-chip.pvck-sel.pvck-c-verde{border-color:var(--pv-verde);background:var(--pv-verde-f);}',
        '.pvck-chip.pvck-sel.pvck-c-amarillo{border-color:var(--pv-ambar);background:var(--pv-ambar-f);}',
        '.pvck-chip.pvck-sel.pvck-c-rojo{border-color:var(--pv-rojo);background:var(--pv-rojo-f);}',
        '.pvck-num{display:flex;flex-wrap:wrap;align-items:center;gap:6px;}',
        '.pvck-inp{min-height:44px;padding:8px 10px;border:1px solid var(--pv-borde);border-radius:8px;background:var(--pv-tarjeta);width:100%;max-width:100%;}',
        '.pvck-num .pvck-inp{width:110px;}',
        '.pvck-sem{display:inline-block;min-width:74px;padding:4px 8px;border-radius:12px;font-size:13px;font-weight:700;text-align:center;}',
        '.pvck-sem:empty{display:none;}',
        '.pvck-s-verde{background:var(--pv-verde-f);color:var(--pv-verde);}',
        '.pvck-s-amarillo{background:var(--pv-ambar-f);color:var(--pv-ambar);}',
        '.pvck-s-rojo{background:var(--pv-rojo-f);color:var(--pv-rojo);}',
        '.pvck-resp{display:flex;gap:6px;margin-top:10px;}',
        '.pvck-resp button{flex:1 1 0;min-width:0;min-height:48px;padding:6px 4px;border:1px solid var(--pv-borde);border-radius:10px;background:var(--pv-tarjeta);font-size:13px;font-weight:600;cursor:pointer;}',
        '.pvck-resp button.pvck-sel[data-r="bien"]{background:var(--pv-verde-f);border:2px solid var(--pv-verde);}',
        '.pvck-resp button.pvck-sel[data-r="problema"]{background:var(--pv-rojo-f);border:2px solid var(--pv-rojo);}',
        '.pvck-resp button.pvck-sel[data-r="nopude"]{background:var(--pv-fondo);border:2px solid var(--pv-suave);}',
        '.pvck-guia{background:var(--pv-ambar-f);border-left:4px solid var(--pv-ambar);border-radius:6px;padding:8px 10px;margin:8px 0 0;font-size:14px;}',
        '.pvck-caja{border-radius:10px;padding:10px 12px;margin:10px 0;border:1px solid var(--pv-borde);background:var(--pv-tarjeta);}',
        '.pvck-caja-rojo{background:var(--pv-rojo-f);border-color:var(--pv-rojo);}',
        '.pvck-caja-ambar{background:var(--pv-ambar-f);border-color:var(--pv-ambar);}',
        '.pvck-caja-verde{background:var(--pv-verde-f);border-color:var(--pv-verde);}',
        '.pvck-pre{white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;background:var(--pv-tarjeta);border:1px solid var(--pv-borde);border-radius:8px;padding:10px;font:13px/1.4 ui-monospace,Consolas,monospace;margin:8px 0;}',
        '#pvCheckCapa details{margin:10px 0;background:var(--pv-tarjeta);border:1px solid var(--pv-borde);border-radius:10px;padding:4px 12px;}',
        '#pvCheckCapa summary{min-height:44px;display:flex;align-items:center;font-weight:600;cursor:pointer;}',
        '#pvCheckCapa ul{margin:4px 0 10px;padding-left:20px;}',
        '#pvCheckAviso{display:none;position:absolute;left:12px;right:12px;bottom:14px;max-width:696px;margin:0 auto;background:#1a202c;color:#fff;padding:12px 14px;border-radius:10px;font-weight:600;z-index:2;}'
    ].join('\n');

    function ponerCss() {
        var d = doc();
        if (d.getElementById('pvCheckCss')) return;
        var s = d.createElement('style'); s.id = 'pvCheckCss'; s.textContent = CSS;
        (d.head || d.documentElement).appendChild(s);
    }
    function esOscuro(op) {
        var d = doc(), b = d.body, h = d.documentElement;
        function tiene(x) { return !!x && ((x.classList && x.classList.contains('dark')) || (x.getAttribute && x.getAttribute('data-theme') === 'dark')); }
        return !!(op && op.oscuro) || tiene(b) || tiene(h);
    }

    // ── Piezas de HTML (todo texto pasa por esc) ────────────────────
    var TXT_SEM = { verde: '🟢 Bien', amarillo: '🟡 Regular', rojo: '🔴 Malo' };
    function boton(acc, texto, clase, extra) { return '<button type="button" class="pvck-b ' + (clase || '') + '" data-acc="' + esc(acc) + '"' + (extra || '') + '>' + esc(texto) + '</button>'; }
    function chip(acc, v, texto, sel, color, extra) {
        return '<button type="button" class="pvck-chip' + (sel ? ' pvck-sel' : '') + (color ? ' pvck-c-' + esc(color) : '') + '" data-acc="' + esc(acc) + '" data-v="' + esc(v) + '"' + (extra || '') + '>' + esc(texto) + '</button>';
    }
    function htmlCampo(c, datos) {
        var v = datos[c.id], h = '<div class="pvck-campo">', ex = ' data-campo="' + esc(c.id) + '"';
        if (c.tipo === 'opcion' || c.tipo === 'sino') {
            var ops = c.tipo === 'sino' ? [ { v: 'si', t: 'Sí', color: '' }, { v: 'no', t: 'No', color: '' } ] : lista(c.opciones);
            h += '<span class="pvck-et">' + esc(c.etiqueta) + '</span><div class="pvck-chips">' +
                 ops.map(function (o) { return chip('dato', o.v, o.t, v === o.v, o.color, ex); }).join('') + '</div>';
        } else if (c.tipo === 'numero') {
            h += '<label>' + esc(c.etiqueta) + '</label><div class="pvck-num">' +
                 '<input class="pvck-inp" type="text" inputmode="decimal" autocomplete="off" maxlength="8"' + ex + ' value="' + esc(v === SIN || v === undefined ? '' : v) + '" aria-label="' + esc(c.etiqueta) + '">' +
                 '<span>' + esc(c.unidad) + '</span><span class="pvck-sem" data-sem="' + esc(c.id) + '"></span>' +
                 (c.sinDato ? chip('sindato', SIN, c.sinDato, v === SIN, '', ex) : '') + '</div>';
        } else {
            h += '<label>' + esc(c.etiqueta) + '</label><input class="pvck-inp" type="text" autocomplete="off" maxlength="80"' + ex +
                 ' value="' + esc(v === undefined ? '' : v) + '" aria-label="' + esc(c.etiqueta) + '">' +
                 '<span class="pvck-suave">Solo el mensaje. No escribas claves, cédulas ni direcciones.</span>';
        }
        return h + '</div>';
    }
    function htmlTarjeta(p, e) {
        var h = '<div class="pvck-t" data-paso="' + esc(p.id) + '"><h3>' + (p.seguridad ? '⛑️ ' : '') + esc(p.titulo) + (p.obligatorio ? ' <span class="pvck-ob" title="Hay que responderlo">*</span>' : '') + '</h3>';
        if (p.ayuda) h += '<button type="button" class="pvck-link" data-acc="ayuda">¿Cómo se hace?</button><div class="pvck-ayuda">' + esc(p.ayuda) + '</div>';
        h += lista(p.campos).map(function (c) { return htmlCampo(c, e.datos); }).join('');
        h += '<div class="pvck-resp">' +
             '<button type="button" data-acc="resp" data-r="bien">✅ Bien</button>' +
             '<button type="button" data-acc="resp" data-r="problema">⚠️ Con problema</button>' +
             '<button type="button" data-acc="resp" data-r="nopude">🚫 No pude</button></div>' +
             '<div class="pvck-motivos" style="display:none"><span class="pvck-et" style="margin-top:8px">¿Por qué no pudiste? (no cuenta en tu contra)</span><div class="pvck-chips">' +
             lista(D.motivosNoPude).map(function (m) { return chip('motivo', m.id, m.t, false, ''); }).join('') + '</div></div>' +
             '<div class="pvck-guias"></div></div>';
        return h;
    }
    function cada(nodos, fn) { var i; for (i = 0; i < nodos.length; i++) fn(nodos[i]); }
    function pasoActual(id) { return buscar(pasos(S.e.servicio, S.e.rol, S.e.sintoma, S.e.variante), id); }
    function tarjetaDe(id) {
        var r = null;
        cada(S.capa.querySelectorAll('.pvck-t'), function (t) { if (t.getAttribute('data-paso') === id) r = t; });
        return r;
    }
    function pintarContador() {
        var c = doc().getElementById('pvCheckCont'), ev;
        if (!c) return;
        if (S.e && S.e.servicio && (S.vista === 'lista' || S.vista === 'decidir' || S.vista === 'ingeniero')) { ev = evaluar(S.e); c.textContent = ev.hechos + '/' + ev.total; }
        else c.textContent = '';
    }
    // Actualiza SOLO lo que cambia de una tarjeta: no toca los inputs (no pierde foco ni scroll).
    function pintarDinamico(t, p) {
        var e = S.e, r = e.resp[p.id] || '', alerta = false;
        t.className = 'pvck-t' + (r ? ' pvck-r-' + r : '');
        cada(t.querySelectorAll('[data-acc="resp"]'), function (b) {
            var sel = b.getAttribute('data-r') === r;
            b.className = sel ? 'pvck-sel' : ''; b.setAttribute('aria-pressed', sel ? 'true' : 'false');
        });
        var mot = t.querySelector('.pvck-motivos');
        if (mot) mot.style.display = r === 'nopude' ? 'block' : 'none';
        cada(t.querySelectorAll('[data-acc="motivo"]'), function (b) { b.classList[b.getAttribute('data-v') === e.motivo[p.id] ? 'add' : 'remove']('pvck-sel'); });
        lista(p.campos).forEach(function (c) {
            var v = e.datos[c.id], col = colorCampo(c, v);
            if (col === 'rojo' || col === 'amarillo') alerta = true;
            cada(t.querySelectorAll('[data-acc="dato"],[data-acc="sindato"]'), function (b) {
                if (b.getAttribute('data-campo') === c.id) b.classList[b.getAttribute('data-v') === v ? 'add' : 'remove']('pvck-sel');
            });
            cada(t.querySelectorAll('[data-sem]'), function (s) {
                if (s.getAttribute('data-sem') !== c.id) return;
                s.className = 'pvck-sem' + (col ? ' pvck-s-' + col : ''); s.textContent = v === SIN ? '' : (TXT_SEM[col] || '');
            });
        });
        var g = t.querySelector('.pvck-guias'), seguro = p.seguridad && r === 'nopude' && e.motivo[p.id] === 'inseguro';
        if (g) {
            g.innerHTML = seguro ? '<div class="pvck-guia">Bien hecho: la seguridad va primero. Esto no cuenta en tu contra y sí puedes pasar el caso.</div>' :
                ((r === 'problema' || alerta) ? lista(p.siMal).map(function (x) { return '<div class="pvck-guia"><b>' + esc(x.cuando) + '</b> → ' + esc(x.hacer) + '</div>'; }).join('') : '');
        }
        pintarContador();
    }

    // ── Vistas ──────────────────────────────────────────────────────
    function vigentesAhora() {
        var mapa = {}, op = S.op, mun = lista(op.municipios).length ? op.municipios : (op.municipio ? [op.municipio] : []);
        try { if (typeof op.masivas === 'function') mapa = op.masivas() || {}; } catch (x) { mapa = {}; }
        return masivasVigentes(mapa, Date.now(), mun);
    }
    function htmlFranjas() {
        var conCaso = !!S.e && !S.finalizado && (S.vista === 'inicio' || S.vista === 'lista' || S.vista === 'decidir');
        return vigentesAhora().map(function (m) {
            var id = ' data-id="' + esc(m.id) + '"';
            return franjaHTML([m]) + (conCaso ? boton('esmasiva', 'Este cliente es de esa falla', '', id) : '') +
                   (typeof S.op.cerrarMasiva === 'function' ? '<button type="button" class="pvck-link" data-acc="cerrarmasiva"' + id + '>Ya se arregló: quitar este aviso</button>' : '');
        }).join('');
    }
    function vBorrador() {
        var e = S.b.e;
        return '<div class="pvck-caja pvck-caja-ambar"><b>Tienes un caso a medias</b><br>' + esc(nombreServicio(e.servicio) || 'Sin servicio elegido') +
               (e.pre && e.pre.nom ? ' · ' + esc(e.pre.nom) : '') + (e.pre && e.pre.sw ? ' · servicio ' + esc(e.pre.sw) : '') + ' · empezado ' + esc(fechaCorta(e.iniMs)) + '</div>' +
               boton('seguir', 'Seguir con el caso que dejaste a medias', 'pvck-b-azul') + boton('nuevo', 'Empezar uno nuevo');
    }
    function vInicio() {
        var e = S.e, op = S.op, pc = op.precarga || null, h = '', sv = servicioDe(e.servicio), k;
        if (e.pre.sw || e.pre.nom) {
            h += '<div class="pvck-caja"><b>' + esc(e.pre.nom || 'Cliente') + '</b>' + (e.pre.plan ? ' · plan ' + esc(e.pre.plan) : '') + (e.pre.sw ? ' · servicio WispHub ' + esc(e.pre.sw) : '') + (e.pre.ord ? ' · orden ' + esc(e.pre.ord) : '');
            if (pc && sinPersonalesCorto(pc.servicioWisphub) === e.pre.sw) {
                if (pc.estadoSugerido) h += '<br>Estado en la app: <b>' + esc(txt(pc.estadoSugerido, 40)) + '</b> <span class="pvck-suave">(' + esc(txt(pc.estadoNota, 120) || 'puede estar viejo: confírmalo en WispHub') + ')</span>';
                if (pc.ordenAbierta) h += '<br>⚠ Ya tiene una orden abierta: no crees otra.';
                if (Number(pc.visitas30d) > 0) h += '<br>Visitas en 30 días: <b>' + esc(Number(pc.visitas30d)) + '</b>';
                if (pc.resumenOficina) h += '<br><span class="pvck-suave">Oficina: ' + esc(txt(pc.resumenOficina, 200)) + '</span>';
            }
            h += '</div>';
        }
        h += '<p class="pvck-bloque">1. ¿Qué servicio falla?</p>';
        for (k in D.servicios) if (Object.prototype.hasOwnProperty.call(D.servicios, k)) {
            if (k === 'instalacion' && e.rol !== 'tecnico') continue;
            h += '<button type="button" class="pvck-b pvck-b-grande' + (e.servicio === k ? ' pvck-b-azul' : '') + '" data-acc="serv" data-v="' + esc(k) + '">' + esc(D.servicios[k].icono || '') + ' ' + esc(D.servicios[k].nombre) + '</button>';
        }
        if (sv) {
            h += '<p class="pvck-bloque">2. ¿Qué pasa?</p><div class="pvck-chips">' + lista(sv.sintomas).map(function (s) { return chip('sint', s.id, s.t, e.sintoma === s.id, ''); }).join('') + '</div>';
            if (lista(sv.variantes).length) h += '<p class="pvck-bloque">3. ¿Cómo ve la televisión?</p><div class="pvck-chips">' + lista(sv.variantes).map(function (s) { return chip('vari', s.id, s.t, e.variante === s.id, ''); }).join('') + '</div>';
        }
        var listo = sv && e.sintoma && (!lista(sv.variantes).length || e.variante);
        return h + boton('empezar', 'Empezar ▶', 'pvck-b-azul', listo ? ' style="margin-top:18px"' : ' style="margin-top:18px" disabled');
    }
    function vLista() {
        var e = S.e, ps = pasos(e.servicio, e.rol, e.sintoma, e.variante), h = '', bloque = null;
        h += '<p class="pvck-suave">Responde cada paso con un toque. Los que tienen <span class="pvck-ob">*</span> hay que responderlos (vale «No pude»).</p>';
        ps.forEach(function (p) {
            if (p.bloque !== bloque) { bloque = p.bloque; h += '<p class="pvck-bloque">' + esc(bloque) + '</p>'; }
            h += htmlTarjeta(p, e);
        });
        if (!ps.length) h += '<div class="pvck-caja">Este servicio todavía no tiene lista para tu rol.</div>';
        return h + boton('ir-decidir', 'Seguir: decidir qué hacer ▶', 'pvck-b-azul') + boton('ir-inicio', '◀ Cambiar servicio o síntoma');
    }
    function vDecidir() {
        var ev = evaluar(S.e), h = '', of = S.e.rol !== 'tecnico';
        if (ev.sugerencia.texto) h += '<div class="pvck-caja pvck-caja-ambar"><b>Sugerencia:</b> ' + esc(ev.sugerencia.texto) + '</div>';
        else h += '<div class="pvck-caja">Llevas ' + esc(ev.hechos) + ' de ' + esc(ev.total) + ' pasos. Si dudas entre técnico e ingeniero: es técnico.</div>';
        h += boton('sal-resuelto', '✅ Quedó resuelto', 'pvck-b-verde pvck-b-grande');
        if (of) { if (typeof S.op.crearOrden === 'function') h += boton('sal-orden', '🧰 Crear orden al técnico', 'pvck-b-grande'); }
        else h += boton('sal-pendiente', '📅 Queda pendiente otra visita', 'pvck-b-grande');
        h += boton('sal-ing', '🛑 Pasar al ingeniero', 'pvck-b-rojo pvck-b-grande');
        h += '<details><summary>Nunca es para el ingeniero</summary><ul>' + lista(D.nunca).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details>';
        h += '<p class="pvck-bloque">Reglas de siempre</p><ul>' + lista(D.reglasGenerales).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
        return h + boton('ir-lista', '◀ Volver a la lista');
    }
    function vResuelto() {
        var rol = S.e.rol;
        return '<p class="pvck-bloque">¿Qué era? (un toque y queda guardado)</p><div class="pvck-chips">' +
               lista(D.causasResuelto).filter(function (c) { return !lista(c.roles).length || c.roles.indexOf(rol) >= 0; }).map(function (c) { return chip('causa', c.id, c.t, false, ''); }).join('') +
               '</div>' + boton('ir-decidir', '◀ Volver');
    }
    function vIngeniero() {
        var e = S.e, ev = evaluar(e), h = '', caso = buscar(ev.casos, e.caso);
        if (!ev.puedeEscalar) {
            h += '<div class="pvck-caja pvck-caja-rojo"><b>Todavía no se puede pasar al ingeniero.</b> Faltan estos pasos (puedes responder «No pude»):<ul>' +
                 ev.faltan.map(function (p) { return '<li>' + esc(p.titulo) + '</li>'; }).join('') + '</ul>' + (ev.total ? '' : 'Elige servicio y síntoma primero.') + '</div>';
            return h + boton('ir-lista', '◀ Volver a la lista', 'pvck-b-azul');
        }
        // Si lo marcado apunta a cartera, comercial, técnico o falla masiva, se avisa ANTES de escoger el caso: es la llamada que más se repite.
        if (ev.sugerencia && ['cartera', 'comercial', 'tecnico', 'masiva', 'autorizador'].indexOf(ev.sugerencia.salida) >= 0) h += '<div class="pvck-caja pvck-caja-ambar"><b>Ojo:</b> ' + esc(ev.sugerencia.texto) + ' Pásalo al ingeniero solo si de verdad aplica uno de estos casos.</div>';
        h += '<p class="pvck-bloque">Escoge UN caso válido</p>' + ev.casos.map(function (c) {
            return '<button type="button" class="pvck-b' + (e.caso === c.id ? ' pvck-b-azul' : '') + '" style="text-align:left" data-acc="caso" data-v="' + esc(c.id) + '">' + (c.via === 'llamada' ? '📞 ' : '💬 ') + esc(c.texto) + '</button>';
        }).join('');
        h += '<p class="pvck-suave">Si ninguno aplica, esto es de técnico o de cartera.</p>';
        if (caso) {
            h += '<div id="pvCheckFicha"></div>';        // ancla: bajarAFicha() deja la pantalla empezando aquí
            if (caso.primeroA === 'autorizador') h += '<div class="pvck-caja pvck-caja-ambar"><b>Primero a la persona que autoriza módems en tu sede.</b> Solo si ella no puede, pasa la ficha al ingeniero.</div>';
            h += '<div class="pvck-caja ' + (caso.via === 'llamada' ? 'pvck-caja-rojo' : 'pvck-caja-verde') + '"><b>' + (caso.via === 'llamada' ? '📞 Este caso es por LLAMADA' : '💬 Este caso es por MENSAJE') + '</b> — ' +
                 (caso.via === 'llamada' ? 'manda la ficha al grupo y llama una sola vez.' : 'manda la ficha al grupo. Un solo cliente nunca es llamada.') + '</div>';
            h += '<div class="pvck-pre">' + esc(textoWhatsApp(e, ctxDe())) + '</div>';
            h += boton('wa', 'Abrir WhatsApp', 'pvck-b-verde pvck-b-grande') + boton('copiar', 'Copiar texto');
            h += '<p class="pvck-suave">' + esc(RECORDATORIO) + '</p>';
        }
        return h + boton('ir-decidir', '◀ Volver');
    }
    var RECORDATORIO = 'Pega la ficha en el grupo de soporte de tu sede y envía las fotos (máximo 2) en el mismo chat. No des acceso remoto hasta que el ingeniero lo pida. Las claves, solo por llamada.';
    function vFin() {
        var e = S.e, h = '', caso = buscar(D.casos, e.caso);
        if (e.salida === 'ingeniero') {
            h += '<div class="pvck-caja pvck-caja-verde"><b>Ficha ' + esc(fichaId(e)) + ' lista.</b> ' + esc(RECORDATORIO) + '</div>';
            if (caso && caso.via === 'llamada') h += '<div class="pvck-caja pvck-caja-rojo"><b>📞 Ahora LLAMA al ingeniero una sola vez.</b></div>';
            h += boton('wa2', 'Abrir WhatsApp otra vez') + boton('copiar2', 'Copiar texto completo');
        } else if (e.salida === 'masiva_conocida') {
            h += '<div class="pvck-caja pvck-caja-verde"><b>Anotado como parte de la falla masiva.</b> Dile al cliente el mensaje de la franja. No llames al ingeniero por este cliente.</div>';
        } else {
            h += '<div class="pvck-caja pvck-caja-verde"><b>Caso guardado.</b> ' + (e.salida === 'orden' ? 'La orden al técnico quedó con el resumen escrito.' : (e.salida === 'pendiente' ? 'Queda pendiente otra visita.' : 'Quedó resuelto sin ingeniero. ¡Bien!')) + '</div>';
        }
        if (S.op.modoPrueba) h += '<p class="pvck-suave">Modo prueba: no se sube a la nube.</p>';
        return h + boton('cerrar', 'Cerrar', 'pvck-b-azul');
    }
    function vMasiva() {
        var m = S.m, op = S.op, muns = lista(op.municipios).length ? op.municipios : (op.municipio ? [op.municipio] : []), k, h;
        h = '<p class="pvck-bloque">🚨 Reportar falla masiva o apagón</p><p class="pvck-suave">Solo es obligatorio escoger el servicio. Lo demás, llena lo que sepas y envía.</p>';
        h += '<div class="pvck-campo"><span class="pvck-et">1. ¿Qué es?</span><div class="pvck-chips">' + chip('m-tipo', 'masiva', '🚨 Falla masiva', m.tipo === 'masiva', 'rojo') + chip('m-tipo', 'apagon', '⚡ Apagón', m.tipo === 'apagon', 'amarillo') + '</div></div>';
        h += '<div class="pvck-campo"><label for="pvckMmun">2. Municipio y servicio</label><select class="pvck-inp" id="pvckMmun">' +
             (muns.length ? '' : '<option value="">(sin municipio)</option>') +
             muns.map(function (x) { return '<option value="' + esc(x) + '"' + (sinTildes(x) === sinTildes(m.municipio) ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select><div class="pvck-chips" style="margin-top:6px">';
        for (k in D.servicios) if (Object.prototype.hasOwnProperty.call(D.servicios, k) && k !== 'instalacion') h += chip('m-serv', k, (D.servicios[k].icono || '') + ' ' + D.servicios[k].nombre, m.servicio === k, '');
        h += chip('m-serv', 'todo', 'Todos los servicios', m.servicio === 'todo', '') + '</div></div>';
        h += '<div class="pvck-campo"><label for="pvckMcomun">3. ¿Qué tienen en común? (puerto PON, torre, caja NAP o barrio)</label><input class="pvck-inp" id="pvckMcomun" type="text" maxlength="80" autocomplete="off"></div>';
        h += '<div class="pvck-campo"><label for="pvckMafec">4. ¿Cuántos afectados y desde qué hora?</label><div class="pvck-num"><input class="pvck-inp" id="pvckMafec" type="text" inputmode="numeric" maxlength="4" autocomplete="off"><span>afectados · desde</span><input class="pvck-inp" id="pvckMhora" type="time" style="width:130px" value="' + esc(hora(Date.now())) + '"></div></div>';
        h += '<div class="pvck-campo"><span class="pvck-et">5. ¿Hay luz en el sector?</span><div class="pvck-chips">' + chip('m-luz', 'si', 'Sí hay luz', m.hayLuz === 'si', '') + chip('m-luz', 'no', 'No hay luz', m.hayLuz === 'no', '') + chip('m-luz', 'nose', 'No sé', m.hayLuz === 'nose', '') + '</div></div>';
        return h + boton('m-enviar', 'Enviar al grupo por WhatsApp', 'pvck-b-rojo pvck-b-grande') + boton('m-volver', '◀ Volver');
    }
    function vMasivaFin() {
        var m = S.mUltima || {};
        return '<div class="pvck-caja ' + (m.tipo === 'apagon' ? 'pvck-caja-ambar' : 'pvck-caja-rojo') + '"><b>' +
               (m.tipo === 'apagon' ? '⚡ Apagón reportado. Pega el aviso en el grupo de soporte de tu sede. Por apagón NO hace falta llamar al ingeniero.' : '📞 Ahora LLAMA al ingeniero una sola vez.') +
               '</b><br>La franja queda visible 6 horas en las dos apps. A los clientes diles: «' + esc(m.mensajeCliente) + '»</div>' +
               boton('m-copiar', 'Copiar texto del aviso') + boton('m-volver', S.vistaAntes ? '◀ Volver al caso' : 'Cerrar', 'pvck-b-azul');
    }

    function pintar(sinSubir) {
        if (!S || !S.capa) return;
        var cont = doc().getElementById('pvCheckIn'), barra = doc().getElementById('pvCheckBarra'), v = S.vista, h;
        var enMasiva = v === 'masiva' || v === 'masiva-fin';
        if (barra) barra.style.display = enMasiva ? 'none' : 'block';
        h = enMasiva ? '' : htmlFranjas();
        if (v === 'borrador') h += vBorrador();
        else if (v === 'inicio') h += vInicio();
        else if (v === 'lista') h += vLista();
        else if (v === 'decidir') h += vDecidir();
        else if (v === 'resuelto') h += vResuelto();
        else if (v === 'ingeniero') h += vIngeniero();
        else if (v === 'fin') h += vFin();
        else if (v === 'masiva') h += vMasiva();
        else if (v === 'masiva-fin') h += vMasivaFin();
        cont.innerHTML = h;
        if (v === 'lista') pasos(S.e.servicio, S.e.rol, S.e.sintoma, S.e.variante).forEach(function (p) { var t = tarjetaDe(p.id); if (t) pintarDinamico(t, p); });
        pintarContador();
        if (!sinSubir && cont.parentNode) cont.parentNode.scrollTop = 0;
        if (!sinSubir && v === 'ingeniero' && S.e && S.e.caso) bajarAFicha();   // se volvió a entrar con un caso ya elegido
    }
    function ir(vista) { S.vista = vista; guardarBorrador(); pintar(); }
    function bajarAFicha() {   // la ficha sale debajo de 12-14 casos (~1000 px en celular). Mueve SOLO el cuerpo de la capa, nunca la página de atrás.
        try {
            var a = doc().getElementById('pvCheckFicha'), c = a && doc().getElementById('pvCheckIn').parentNode;
            if (a && c) c.scrollTop += a.getBoundingClientRect().top - c.getBoundingClientRect().top - 8;
        } catch (x) {}
    }

    // ── Eventos (delegación: un solo click y un solo input) ─────────
    function cercano(el, sel) {
        while (el && el !== S.capa && el.nodeType === 1) {
            if (el.matches ? el.matches(sel) : (el.msMatchesSelector && el.msMatchesSelector(sel))) return el;
            el = el.parentNode;
        }
        return null;
    }
    function campoDe(p, id) { return buscar(p ? p.campos : [], id); }
    function ponerDato(p, c, v) {
        var e = S.e, auto = e.auto || (e.auto = {});
        if (v === '' || v === undefined) delete e.datos[c.id]; else e.datos[c.id] = v;
        // Un dato en rojo deja el paso "Con problema" si aún no tenía respuesta. Si esa marca la puso la app
        // (p. ej. a medio teclear «-2» de «-21») y ya ningún dato del paso está en rojo, se quita sola.
        if (!e.resp[p.id]) { if (colorCampo(c, e.datos[c.id]) === 'rojo') { e.resp[p.id] = 'problema'; auto[p.id] = 1; } }
        else if (auto[p.id] && e.resp[p.id] === 'problema' && !lista(p.campos).some(function (x) { return colorCampo(x, e.datos[x.id]) === 'rojo'; })) { delete e.resp[p.id]; delete auto[p.id]; }
    }
    function alClic(ev) {
        if (!S) return;
        var b = cercano(ev.target, '[data-acc]');
        if (!b || b.disabled) return;
        var acc = b.getAttribute('data-acc'), v = b.getAttribute('data-v') || '', e = S.e, t, p, c, id, texto;
        if (acc === 'cerrar') { cerrar(); return; }
        if (acc === 'masiva') { S.vistaAntes = S.vista; S.m = formMasivaVacio(); S.vista = 'masiva'; pintar(); return; }
        if (acc === 'seguir') { S.e = S.b.e; S.e.rol = S.op.rol === 'tecnico' ? 'tecnico' : 'oficina'; S.vista = S.b.vista || 'inicio'; S.b = null; pintar(); return; }
        if (acc === 'nuevo') { lsBorrar(claveBorrador()); S.b = null; nuevoCaso(); pintar(); return; }
        if (acc === 'ayuda') { t = b.nextSibling; if (t && t.classList) t.classList.toggle('pvck-ver'); return; }
        if (acc === 'cerrarmasiva') {
            if (b.getAttribute('data-ok') !== '1') { b.setAttribute('data-ok', '1'); b.textContent = '¿Seguro que ya se arregló? Toca otra vez para quitar el aviso'; return; }
            id = b.getAttribute('data-id') || '';
            if (S.op.modoPrueba) { avisar('Modo prueba: no se sube a la nube'); return; }
            if (bloqueado()) { avisar('La app está en mantenimiento: inténtalo en un momento.'); return; }
            try { Promise.resolve(S.op.cerrarMasiva(id)).then(function () { if (S) pintar(true); }, function (x) { if (!x || x.message !== 'sin permiso') avisar('No se pudo quitar el aviso. Revisa la señal.'); }); } catch (x) { avisar('No se pudo quitar el aviso.'); }   // «sin permiso» ya lo explica la app
            return;
        }
        // Formulario de falla masiva
        if (acc === 'm-tipo' || acc === 'm-serv' || acc === 'm-luz') {
            S.m[acc === 'm-tipo' ? 'tipo' : (acc === 'm-serv' ? 'servicio' : 'hayLuz')] = v;
            cada(b.parentNode.querySelectorAll('.pvck-chip'), function (x) { x.classList[x === b ? 'add' : 'remove']('pvck-sel'); });
            return;
        }
        if (acc === 'm-enviar') { enviarMasiva(); return; }
        if (acc === 'm-copiar') { copiar(textoMasiva(S.mUltima)); return; }
        if (acc === 'm-volver') { if (S.vistaAntes) { S.vista = S.vistaAntes; S.vistaAntes = ''; pintar(); } else cerrar(); return; }
        if (!e) return;
        // Inicio
        if (acc === 'serv') { if (e.servicio !== v) { e.servicio = v; e.sintoma = ''; e.variante = ''; } guardarBorrador(); pintar(true); return; }
        if (acc === 'sint') { e.sintoma = v; guardarBorrador(); pintar(true); return; }
        if (acc === 'vari') { e.variante = v; guardarBorrador(); pintar(true); return; }
        if (acc === 'empezar' || acc === 'ir-lista') { ir('lista'); return; }
        if (acc === 'ir-inicio') { ir('inicio'); return; }
        if (acc === 'ir-decidir') { ir('decidir'); return; }
        // Tarjetas de la lista
        if (acc === 'resp' || acc === 'motivo' || acc === 'dato' || acc === 'sindato') {
            t = cercano(b, '.pvck-t'); if (!t) return;
            p = pasoActual(t.getAttribute('data-paso')); if (!p) return;
            if (acc === 'resp') {
                v = b.getAttribute('data-r');
                if (e.resp[p.id] === v) delete e.resp[p.id]; else e.resp[p.id] = v;
                if (e.auto) delete e.auto[p.id];   // respuesta puesta a mano: ya no se quita sola
                if (e.resp[p.id] !== 'nopude') delete e.motivo[p.id];
            } else if (acc === 'motivo') { e.motivo[p.id] = v; e.resp[p.id] = 'nopude'; }
            else {
                c = campoDe(p, b.getAttribute('data-campo')); if (!c) return;
                ponerDato(p, c, e.datos[c.id] === v ? '' : v);
                if (acc === 'sindato') cada(t.querySelectorAll('input'), function (i) { if (i.getAttribute('data-campo') === c.id) i.value = ''; });
            }
            pintarDinamico(t, p); guardarBorrador(); return;
        }
        // Salidas
        if (acc === 'sal-resuelto') { ir('resuelto'); return; }
        if (acc === 'causa') { e.causa = v; finalizar('resuelto'); S.vista = 'fin'; pintar(); return; }
        if (acc === 'sal-pendiente') { finalizar('pendiente'); S.vista = 'fin'; pintar(); return; }
        if (acc === 'sal-orden') {
            if (typeof S.op.crearOrden === 'function') { try { S.op.crearOrden(resumenOrden(e), e.servicio, e.id); } catch (x) { avisar('No se pudo abrir la orden: créala a mano con este resumen.'); } }
            finalizar('orden'); S.vista = 'fin'; pintar(); return;
        }
        if (acc === 'sal-ing') { e.caso = buscar(evaluar(e).casos, e.caso) ? e.caso : ''; ir('ingeniero'); return; }
        if (acc === 'caso') { e.caso = v; guardarBorrador(); pintar(true); bajarAFicha(); return; }
        if (acc === 'wa' || acc === 'copiar') {
            if (!evaluar(e).puedeEscalar || !buscar(D.casos, e.caso)) return;
            // PRIMERO WhatsApp, en el mismo clic y sin esperar nada: si no, el celular bloquea la ventana.
            if (acc === 'wa') abrirWhatsApp(textoWhatsApp(e, ctxDe())); else copiar(textoWhatsApp(e, ctxDe(), true));
            finalizar('ingeniero'); S.vista = 'fin'; pintar(); return;
        }
        if (acc === 'wa2') { abrirWhatsApp(textoWhatsApp(e, ctxDe())); return; }
        if (acc === 'copiar2') { copiar(textoWhatsApp(e, ctxDe(), true)); return; }
        if (acc === 'esmasiva') { e.caso = txt(b.getAttribute('data-id'), 40); finalizar('masiva_conocida'); S.vista = 'fin'; pintar(); return; }
    }
    function alEscribir(ev) {
        if (!S || !S.e || S.vista !== 'lista') return;
        var i = ev.target, id = i && i.getAttribute ? i.getAttribute('data-campo') : '', t, p, c;
        if (!id || i.tagName !== 'INPUT') return;
        t = cercano(i, '.pvck-t'); p = t ? pasoActual(t.getAttribute('data-paso')) : null; c = campoDe(p, id);
        if (!c) return;
        // El texto libre se filtra AL TECLEAR: ni el estado ni el borrador de este equipo guardan una IP o un teléfono.
        // OJO: el recuadro NO se reescribe al teclear. El filtro recorta los espacios de las puntas y, si se devolviera al recuadro,
        // se comería cada espacio («C-14puerto5») y los dígitos que siguen a un «[número]» ya no se volverían a tapar.
        ponerDato(p, c, c.tipo === 'texto' ? sinPersonales(String(i.value).slice(0, 80), 80) : String(i.value).slice(0, 8));
        pintarDinamico(t, p); guardarBorrador();
    }
    function alTeclear(ev) { if (S && S.capa && (ev.key === 'Escape' || ev.key === 'Esc')) cerrar(); }

    function formMasivaVacio() { return { tipo: 'masiva', servicio: (S && S.e && S.e.servicio && S.e.servicio !== 'instalacion') ? S.e.servicio : '', hayLuz: 'nose', municipio: S && S.op ? txt(S.op.municipio, 40) : '' }; }
    function enviarMasiva() {
        var d = doc(), op = S.op, q = op.quien || {}, val = function (id) { var x = d.getElementById(id); return x ? x.value : ''; };
        // Lo único obligatorio: el servicio («Todos los servicios» vale). Sin él la franja no dice qué falla.
        if (!S.m.servicio) { avisar('Falta escoger el servicio que falla (si son todos, toca «Todos los servicios»).'); return; }
        var m = masivaNueva({ tipo: S.m.tipo, servicio: S.m.servicio, hayLuz: S.m.hayLuz, municipio: val('pvckMmun') || S.m.municipio,
                              comun: val('pvckMcomun'), afectados: val('pvckMafec'), desdeHora: val('pvckMhora') }, { app: op.app, quienNombre: q.nombre });
        abrirWhatsApp(textoMasiva(m));                   // primero WhatsApp, sin esperar
        S.mUltima = m;
        if (op.modoPrueba) avisar('Modo prueba: no se sube a la nube');
        else if (bloqueado()) avisar('La app está en mantenimiento: la franja no se pudo crear, pero el aviso de WhatsApp sí sale.');
        else if (typeof op.guardarMasiva === 'function') {
            try { Promise.resolve(op.guardarMasiva(m)).then(null, function () { avisar('Sin señal: la franja no se creó, pero el aviso de WhatsApp sí sale.'); }); }
            catch (x) { avisar('No se pudo crear la franja; el aviso de WhatsApp sí sale.'); }
        }
        S.vista = 'masiva-fin'; pintar();
    }

    // ── Abrir y cerrar la capa ──────────────────────────────────────
    function nuevoCaso() {
        var op = S.op, pc = op.precarga || {}, e = nuevoEstado({ app: op.app, rol: op.rol });
        e.pre = { sw: sinPersonalesCorto(pc.servicioWisphub), nom: primerNombre(pc.nombreCorto), plan: txt(pc.plan, 40), ord: sinPersonalesCorto(pc.ordenId, 32), tipoOrden: txt(pc.tipoOrden, 30) };
        if (pc.servicio && servicioDe(pc.servicio) && (pc.servicio !== 'instalacion' || e.rol === 'tecnico')) e.servicio = pc.servicio;
        S.e = e; S.finalizado = false; S.vista = 'inicio';
    }
    // ── Botón Atrás del celular ─────────────────────────────────────
    // Al abrir, la capa deja UNA entrada {pvck:1} en el historial: Atrás cierra la capa (el borrador queda) en vez de salir de la app.
    // Al cerrar con la ✕ o por código, esa entrada se devuelve con history.back() para no dejar una entrada fantasma.
    var _atrasPuesto = false, _atrasPropioMs = 0;
    function hayEntradaPvck() { try { var st = global.history.state; return !!st && st.pvck === 1; } catch (x) { return false; } }
    function atrasEnCamino() { return _atrasPropioMs > 0 && Date.now() - _atrasPropioMs < 2000; }
    function alAtras() {
        // El popstate de NUESTRO history.back() (el de cerrar) no es un toque de la persona: se deja pasar una vez.
        var propio = atrasEnCamino();
        _atrasPropioMs = 0;
        if (S && hayEntradaPvck()) return;               // la capa sigue abierta y con su entrada debajo: no hay nada que hacer
        if (propio) {                                    // era nuestro back(); si mientras tanto se reabrió la capa y quedó sin entrada, se le pone
            if (S) { try { global.history.pushState({ pvck: 1 }, ''); } catch (x) {} }
            return;
        }
        if (S) cerrar(true);                             // el navegador ya consumió la entrada: no se hace back() otra vez
    }
    function ponerAtras() {
        try {
            if (!_atrasPuesto) { global.addEventListener('popstate', alAtras); _atrasPuesto = true; }
            // Si la entrada ya está (capa abierta dos veces seguidas, o página recargada con la capa abierta) se reusa.
            // Con un back() propio todavía en camino se pone una nueva: ese back() cae sobre la vieja y la capa sigue con su entrada.
            if (!hayEntradaPvck() || atrasEnCamino()) global.history.pushState({ pvck: 1 }, '');
        } catch (x) {}
    }
    function quitarAtras() {
        try { if (hayEntradaPvck()) { _atrasPropioMs = Date.now(); global.history.back(); } } catch (x) { _atrasPropioMs = 0; }
    }

    function montar(op) {
        if (!doc() || !doc().body) return false;
        cerrar(true);                                    // si ya había una capa abierta, la nueva hereda su entrada del historial
        ponerCss();
        var capa = doc().createElement('div');
        capa.id = 'pvCheckCapa';
        capa.setAttribute('role', 'dialog'); capa.setAttribute('aria-modal', 'true'); capa.setAttribute('aria-label', 'Antes de llamar al ingeniero');
        if (esOscuro(op)) capa.className = 'pvck-oscuro';
        capa.innerHTML = '<div class="pvck-cab"><h2>🛑 Antes de llamar al ingeniero</h2><span class="pvck-cont" id="pvCheckCont" aria-label="Pasos hechos"></span>' +
            '<button type="button" class="pvck-x" data-acc="cerrar" aria-label="Cerrar">✕</button></div>' +
            '<div id="pvCheckBarra" style="flex:0 0 auto;padding:0 12px;background:var(--pv-tarjeta);border-bottom:1px solid var(--pv-borde)"><div style="max-width:720px;margin:0 auto">' +
            '<button type="button" class="pvck-b pvck-b-rojo" data-acc="masiva">🚨 Reportar falla masiva o apagón</button></div></div>' +
            '<div class="pvck-cuerpo"><div class="pvck-in" id="pvCheckIn"></div></div><div id="pvCheckAviso" role="status" aria-live="polite"></div>';
        capa.addEventListener('click', alClic);
        capa.addEventListener('input', alEscribir);
        doc().addEventListener('keydown', alTeclear);
        S = { op: op || {}, e: null, b: null, m: null, mUltima: null, vista: '', vistaAntes: '', finalizado: false, capa: capa, overflow: doc().body.style.overflow };
        doc().body.style.overflow = 'hidden';
        doc().body.appendChild(capa);
        ponerAtras();
        return true;
    }
    function abrir(op) {
        op = op || {};
        if (!montar(op)) return;
        if (!op.modoPrueba && typeof op.guardar === 'function') reenviarPendientes(op.guardar);
        S.b = leerBorrador();
        if (S.b) S.vista = 'borrador'; else nuevoCaso();
        pintar();
    }
    function abrirMasiva(op) {
        op = op || {};
        if (!montar(op)) return;
        S.m = formMasivaVacio(); S.vista = 'masiva'; S.vistaAntes = '';
        pintar();
    }
    function cerrar(sinAtras) {                          // sinAtras === true: la entrada del historial ya se consumió o la hereda otra capa
        if (!S) return;
        var s = S, copia = null;
        S = null;
        if (sinAtras !== true) quitarAtras();
        try { doc().removeEventListener('keydown', alTeclear); } catch (x) {}
        try { if (s.capa && s.capa.parentNode) s.capa.parentNode.removeChild(s.capa); doc().body.style.overflow = s.overflow || ''; } catch (y) {}
        if (s.e) { try { copia = JSON.parse(JSON.stringify(s.e)); } catch (z) { copia = null; } }
        if (s.op && typeof s.op.alCerrar === 'function') { try { s.op.alCerrar(copia); } catch (w) {} }
    }

    // ── API pública ─────────────────────────────────────────────────
    var PV_CHECK = {
        version: D.version || 0,
        datos: D,                                  // las listas (solo lectura: para PRUEBAS.html)
        pasos: pasos, semaforo: semaforo, nuevoEstado: nuevoEstado, evaluar: evaluar,
        textoWhatsApp: textoWhatsApp, resumenOrden: resumenOrden, registro: registro, docMes: docMes,
        resumenMes: resumenMes, tablaMesHTML: tablaMesHTML,
        masivaNueva: masivaNueva, masivasVigentes: masivasVigentes, textoMasiva: textoMasiva, franjaHTML: franjaHTML,
        abrir: abrir, abrirMasiva: abrirMasiva, cerrar: cerrar,
        pendientes: pendientes, reenviarPendientes: reenviarPendientes,
        claveBorrador: function (op) { return claveBorrador(op || {}); }   // clave de localStorage del borrador de esa app y esa persona (para PRUEBAS.html)
    };
    global.PV_CHECK = PV_CHECK;
    if (typeof module !== 'undefined' && module && module.exports) module.exports = PV_CHECK;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
