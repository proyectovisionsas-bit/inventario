# Modo mantenimiento (OFICINAS v309, INVENTARIO v111, TECNICOS v96, RED v41 · 16 Sep 2026)

Pedido de Elkin: poder avisar desde el panel del administrador que el sistema
está en mantenimiento, que las oficinas no puedan hacer nada y que el aviso
dure hasta que se publique la versión nueva.

## Dónde vive

Documento `oficinas_sistema/mantenimiento`:

```
{
  activo: true,
  mensaje: "Estamos haciendo mejoras…",
  apps: { oficinas: true, inventario: false, tecnicos: false, red: false },
  avisoMin: 2,                 // minutos de cuenta regresiva antes de bloquear
  desdeMs, desde,              // cuándo se activó
  empiezaMs,                   // desdeMs + avisoMin minutos: desde aquí se bloquea
  por: "Administrador",
  terminaAlPublicar: true,     // ver abajo
  versionAlActivar: { oficinas: 309, inventario: 111, tecnicos: 96, red: null },
  terminadoMs, terminadoPor    // al terminarlo a mano
}
```

Lo escribe `_activarMantenimiento()` (OFICINAS, panel del administrador) y lo
apaga `_terminarMantenimiento()`. Las dos dejan registro de auditoría
(`MANTENIMIENTO_ON` / `MANTENIMIENTO_OFF`) con `_enviarLogsAuditoria()`.

## Qué hace cada app

Las cuatro apps escuchan el documento con `onSnapshot` (una lectura al abrir
y una por cambio) y además revisan cada 5 s por si cambió la sesión. La lógica
es la misma en todas (`_mantVigente`, `_aplicarMantenimiento`), solo cambia
`MANT_APP` y cómo se sabe si hay sesión y si es el administrador:

| Estado | Qué se ve |
|---|---|
| activo, antes de `empiezaMs` | franja naranja arriba con la cuenta regresiva; se puede seguir trabajando |
| activo, después de `empiezaMs` | pantalla completa (`#mantOverlay`, z-index 99998) con el mensaje; el teclado queda bloqueado |
| activo y soy administrador (OFICINAS, INVENTARIO, RED) | solo la franja, con el botón de terminar en OFICINAS |
| activo y sin sesión iniciada | solo la franja (así el administrador puede entrar a terminarlo) |
| `activo:false` | nada; la pantalla y la franja se quitan solas |

TECNICOS no tiene administrador: si está marcado, bloquea a todos los técnicos.

## Cómo termina

1. **A mano:** botón "Terminar mantenimiento" en el panel o en la franja.
2. **Al publicar** (`terminaAlPublicar`), por dos caminos:
   - cada app compara su versión con la que había al activar
     (`versionAlActivar[app]`): una sesión con versión MAYOR da el
     mantenimiento por terminado, es la versión nueva;
   - las cuatro apps escuchan `oficinas_sistema/app_version` (la versión de
     OFICINAS que registra cada sesión al abrir). Si es mayor que
     `versionAlActivar.oficinas`, terminó para todas, también para RED, que
     no tiene versión propia en la nube (su `versionAlActivar` es `null`).
   Las sesiones viejas siguen bloqueadas, pero la pantalla de "hay versión
   nueva" (`#ovVersionVieja`, z-index 99999, y `#versionBanner`) queda por
   encima, así que ven el botón de actualizar.
3. Al publicar, además, conviene dejar `activo:false` por REST:

```bash
curl -s -X PATCH "https://firestore.googleapis.com/v1/projects/inventario-88a28/databases/(default)/documents/oficinas_sistema/mantenimiento?updateMask.fieldPaths=activo" -H "Content-Type: application/json" -d '{"fields":{"activo":{"booleanValue":false}}}'
```

## Qué pasa con los guardados

- En OFICINAS, mientras la sesión tiene la pantalla puesta
  (`window._mantBloqueando`), `_saveReal` y `_enviarLogsAuditoria` no
  escriben: anotan `_mantGuardadoPendiente` y, al quitarse la pantalla, se
  hace un `save({silencioso:true})` (entre 1,5 y 9,5 s después, distinto en cada
  sesión, para que no escriban todas a la vez) para que salga lo que quedó en memoria
  (por ejemplo, lo que la sincronización de WispHub agregó mientras tanto).
  Por eso la cuenta regresiva pide terminar y guardar antes: lo que se
  registre justo cuando aparece la pantalla espera hasta el final.
- En INVENTARIO, TECNICOS y RED solo se bloquea la pantalla y el teclado; sus
  temporizadores de fondo siguen. La tarjeta del panel lo dice así.
- Al bloquear se cierra el modal abierto (`closeModal`) donde existe, porque
  algunos modales tienen z-index mayor que la pantalla.
- El administrador (OFICINAS, INVENTARIO, RED) nunca se bloquea. Con
  `?prueba=1` la activación queda tapada por el modo prueba y la tarjeta lo
  dice.

## Cómo probarlo sin tocar la nube

`PRUEBAS.html` tiene la prueba "El administrador puede poner el sistema en
mantenimiento…": construye documentos de prueba, llama `_aplicarMantenimiento`
con cada rol y revisa la pantalla, la franja, el teclado y el orden de las
capas. `_activarMantenimiento` en modo prueba queda bloqueado por el proxy de
Firebase (cuenta como escritura bloqueada).
