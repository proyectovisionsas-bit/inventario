## Adornos de cada mes (temporadas.js v1 · OFICINAS v328 · INVENTARIO v123 · TÉCNICOS v104 · RED v45, 6 Nov 2026)

Idea de Elkin: que el programa «se anime» solo con la celebración de cada mes
(regreso a clases, San Valentín, Día de la Mujer, de la Madre, del Trabajo, Halloween,
Navidad…), sin afectar nada. Solo es decoración.

| Qué | Cuándo |
|---|---|
| Línea de colores bajo el encabezado y un adorno sobre el logo (🎄, 🎃, 💐…) | todos los días de la temporada, en las cuatro apps |
| Franja con la frase de la temporada arriba del Inicio | OFICINAS (📊 Dashboard) e INVENTARIO (Inicio) |
| Lluvia de emojis unos segundos al entrar | solo el día especial, una vez al día en cada equipo y app (`pv_temp_lluvia_<app>_<fecha>`), cuando ya se leyó el interruptor, la pantalla está a la vista y hay alguien delante |
| El saludo de bienvenida trae la frase del día | el día especial, en OFICINAS, INVENTARIO y TÉCNICOS (`_mensajeDelDia…` pregunta primero a `PV_TEMPORADAS.fraseDelDia()`) |

Noviembre no tiene temporada: el programa se ve como siempre.

### Arquitectura

`temporadas.js` (raíz del repo, CRLF) es UNA sola copia para las cuatro apps, con
`<script src="temporadas.js?v=1"></script>` y el comentario «Adornos de cada mes,
compartido: editar temporadas.js, no copiarlo aquí». Publica `window.PV_TEMPORADAS`.
No conoce Firebase ni los datos: cada app le pasa un `op` en su `enterApp` (RED en
`_montarAppRed`). Al «Salir», OFICINAS, INVENTARIO y TÉCNICOS llaman
`PV_TEMPORADAS.detener()`: se quitan los adornos y la lluvia del día no se gasta en la
pantalla de entrada (cae cuando alguien vuelva a entrar). Una lectura del interruptor que
llegue después de «Salir» ya no cuenta: quien entra después la vuelve a hacer. RED recarga
la página al salir.

```
{ app, cabecera, ancla, anclaLado:'izq'|'der', leer }
```

`cabecera` y `ancla` son selectores (OFICINAS: `#app > .header` y el logo;
INVENTARIO: `#app > header.header` y su `h1`; TÉCNICOS: `#app > header` y `#hWho`;
RED: `#app > .top` y `.marca`). `leer` devuelve una promesa con el documento del
interruptor, o lanza un error si la conexión aún no está lista (se reintenta 3 veces
cada 5 s).

Todo va con `pointer-events:none`, se oculta al imprimir y la lluvia no corre si el
equipo pide «reducir movimiento». Los adornos se quitan solos con `quitar()`.

La línea de colores se dibuja con `::after` en la cabecera, que necesita una posición.
Se la da `:where(.pv-temp-cab){position:relative}`, que no pesa nada: cualquier regla
de la app que fije la posición gana. Así la barra de RED sigue flotando en diurno
(`body.light-mode .top{position:absolute}`). Antes iba un estilo en línea, que se
quedaba puesto al pasar de nocturno a diurno y empujaba el mapa hacia abajo. Un
navegador que no entienda `:where()` (se mira con `querySelector(':where(body)')`, que
falla en esos navegadores) sigue con el estilo en línea, pero se vuelve a calcular
cada vez que cambia la clase del `body` (el tema). Al cambiar el tema también se
recoloca el adorno sobre el logo.

**Una pantalla abierta de un día para otro.** Cada minuto, y al volver a la pestaña,
se mira si cambió el día. Si cambió, se vuelve a leer el interruptor (una lectura al
día por pantalla) y, si cambió la celebración, se cambian la línea, el adorno, la
franja del Inicio y la frase del saludo (24 → 25 dic: Nochebuena pasa a Navidad;
31 oct → 2 nov: se quita Halloween; 30 nov → 1 dic: llega Navidad). La franja solo se
rehace si el Inicio sigue a la vista: se sabe porque lo primero que tenía el Inicio al
pintarse sigue ahí. Si la persona está en otra pantalla, no se pone; sale cuando se
vuelva a pintar el Inicio.

**La lluvia, solo con alguien delante.** Además de esperar al interruptor y a que la
pestaña esté a la vista, espera a que haya alguien: un toque, una tecla o volver a la
pestaña en los últimos 20 segundos (se oye desde que carga la página, en fase de
captura; quien acaba de teclear su clave para entrar cuenta). Si no, cae con el
siguiente toque. Así no cae a medianoche sin nadie, ni en una recarga sola (la
recarga automática, una sesión que se reanuda). Y el día cuenta como «ya llovió» solo
si la lluvia estuvo 1,5 s en pantalla con la sesión abierta y la pestaña a la vista:
si el toque que la soltó era «Salir», F5 o «Actualizar ahora», no se gasta.

### El interruptor: `oficinas_sistema/temporadas`

`{ apagado:bool, porNombre, enMs }`. Lo escribe SOLO el administrador desde OFICINAS,
tarjeta «🎉 Adornos de cada mes» de ⚙️ Administración (`_temporadasCambiarOfi`), y
nunca en modo prueba (avisa antes del `set`). Las cuatro apps lo leen una vez al
entrar; sin documento, sin señal o con error, quedan encendidos. El último estado leído
se guarda en el equipo (`pv_temp_estado`) porque el saludo sale antes de que llegue la
lectura. Un cambio se ve al abrir o recargar cada pantalla.

- La **lluvia espera** a esa lectura (o a que se agoten los 4 intentos: entonces vale lo
  guardado en el equipo) y a que la pestaña esté a la vista. Así no cae después de que
  el administrador los apagó, ni se gasta en una pestaña escondida (la recarga
  automática de la madrugada): cae cuando la persona vuelve a la pestaña (ver «La
  lluvia, solo con alguien delante»).
- Si se agotaron los 4 intentos, se vuelve a leer cuando vuelve la señal (`online`).
- Si el equipo tenía guardado «apagado» y la nube dice «encendido», salen la línea, el
  adorno, la franja del Inicio que ya estaba pintado y la lluvia del día.
- Lo que se dejó así: en un equipo que todavía no sabe que se apagaron, la línea, el
  adorno, la franja y la frase del saludo salen hasta que llega la lectura, y el saludo
  sale a los 400 ms con lo que haya. Desde la segunda vez que se abre en ese equipo ya
  no sale nada.

### Vista previa

- En Administración: elegir la temporada y «👀 Ver cómo se ve» (solo en esa pantalla,
  también en el Dashboard; no se guarda).
- En cualquier app: `?temporada=<id>` en la dirección (por ejemplo `?temporada=navidad`).
  La pantalla se ve como el día especial de esa temporada. También se lee el interruptor:
  la tarjeta de Administración dice si están apagados y «Quitar la vista previa» lo respeta.

### Agregar o cambiar una fecha

Todo está en `CALENDARIO` dentro de `temporadas.js`: `id`, `nombre`, colores `c1`/`c2`,
`adorno`, `guirnalda`, `caen`, `rango(año)`, `dias(año)`, `frase`, `fraseDia` y, si un
día tiene frase propia, `frasesDia` (`'12-7'` → Velitas). Las fechas que se mueven usan
`nEsimo(año, mes, díaSemana, n)` y `ultimo(año, mes, díaSemana)`. Si dos temporadas se
cruzan, gana la que tenga hoy su día especial; si ninguna, la primera de la lista.
No usar banderas: Windows las dibuja como letras («CO»). Al cambiar el archivo hay que
subir el `?v=` en las CUATRO apps, igual en todas.

Pruebas (cuatro): «Adornos de cada mes: el calendario de Colombia cae en su fecha…»
(también las frases y las velitas del 7, 16, 24 y 25 de diciembre), «…las cuatro apps
cargan el mismo temporadas.js una vez…» (la misma `?v=` en las cuatro, cada adorno sin
clics, lo que se esconde al imprimir, el documento del interruptor solo se lee fuera de
OFICINAS, «Salir» detiene los adornos), «…solo adornan…» (la vista previa con su lluvia,
el saludo, el interruptor, una oficina no lo cambia, el modo prueba no escribe) y «…al
entrar se ponen la línea y el adorno…». Esta última corre una copia aparte de
`temporadas.js` (`temporadasAparte`) con su propia cabecera (sticky, o la barra de RED),
reloj, temporizadores, nube de mentira y un botón que corta los eventos, porque en los
marcos de PRUEBAS nadie inicia sesión. Revisa la entrada, el sitio del adorno, lo que se
esconde al imprimir (regla por regla), la lluvia que espera (al interruptor, a la pestaña
a la vista y a alguien delante: tecla, clic, toque o volver a la pestaña), la recarga
sola, la marca de 1,5 s («Salir» o F5 como primer toque, la pestaña que se esconde antes), la
ventana de 20 s (a los 19 s cae, a los 21 s espera), la lectura que falla, lanza un error
o llega después de «Salir» (también con un reintento pendiente), la vuelta de la señal, volver a encender (también desde
Administración en otra pantalla), el cambio de día (a medianoche y en otra pantalla), la
vista previa con el interruptor y la barra de RED, también sin `:where()`. Cada una de 79
copias a las que les falta un arreglo hace fallar al menos una de las cuatro
(`TEMPORADAS=<copia>` en el banco sirve otra copia del archivo).
