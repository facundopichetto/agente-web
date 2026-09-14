# claudio board (repo `agente-web`)

**claudio board** es el nombre de esta interfaz (facundo, 2026-09-11): la interfaz principal de
claudio. el repo y la url siguen siendo `agente-web`.

terminal web del agente de fondo de facundo. es un solo `index.html` (html + css + js inline,
todo dentro de un iife), servido por github pages en
`https://facundopichetto.github.io/agente-web/`. dos paneles: chat | widgets (en el celu, uno
a la vez con el toggle). el buzon es un issue de `facundopichetto/agente-buzon`.

## auto actualizacion (la pestaña abierta se recarga sola)

no hace falta cerrar la pwa ni limpiar cache: cuando se publica un build nuevo, las pestañas
abiertas se recargan solas en menos de 60 s.

**como esta armado**

- la version vive en `<meta name="agente-web-version" content="X.Y">` del `index.html`.
- al publicar, `bump_web()` (`~/.claudio/tools/agente/daemon.py`) sube el minor y lo escribe en
  cuatro lugares: la meta, `manifest.json` (campo `version`), el querystring del link al manifest
  (`manifest.json?v=X.Y`, si no pages lo cachea para siempre) y **`version.json`**
  (`{"version": "X.Y", "ts": <epoch>, "fecha": "..."}`).
- la pagina (`mirarVersion()`) pide `version.json` con `cache: "no-store"` + cache-buster
  (`?_=<now>`) **al cargar, cada 60 s y en cada `visibilitychange` al volver al frente**.
- la referencia es la **version embebida en el html**, no el primer fetch: si pages sirvio un
  html viejo del cache, `version.json` ya viene nuevo y se recarga igual. tambien detecta un
  republish con la misma version comparando el `ts`.
- la recarga es `location.replace(pathname + "?v=X.Y")`: con el querystring nuevo pages no puede
  devolver el html viejo. si la url **ya** trae ese `?v=`, no recarga otra vez (nada de loop
  cuando el cdn tarda en propagar).
- si facundo esta escribiendo (`#txt` con texto), la recarga espera al chequeo siguiente.
- el html va con `cache-control: no-cache, no-store, must-revalidate` + `pragma` + `expires`.
- **no hay service worker** y no hay js/css externos (todo inline), asi que no queda nada
  cacheado aparte del html. si algun dia se agrega un `sw.js`: `skipWaiting()` + `clients.claim()`
  y `bump_web()` ya le escribe la version (`RE_SW_VER`) para invalidar el cache.

**probarlo** (cero tokens, chrome headless, no toca el repo):

    python3 -m recetas.prueba_autoupdate

12 chequeos: metas, intervalo de 60 s, `visibilitychange`, `no-store`, html viejo del cache que
se recarga solo, version nueva que dispara la recarga, y el freno mientras se escribe.

## pestañas sincronizadas entre dispositivos (2026-09-11)

las pestañas ya no viven solo en el `localStorage` del navegador (por eso el celu y el desktop
veian pestañas distintas). el layout se publica en el buzon como **`tabs.json`**, el mismo
mecanismo que `widgets.json`:

    {"v":1, "ts":1757600000000, "origen":"ab12cd", "tabs":["tools","auto"], "activo":"tools"}

- **al abrir**: primero pinta el cache de `localStorage` (instantaneo, sirve sin red) y despues lee
  `tabs.json` del repo; si el remoto es mas nuevo, se aplica.
- **cada vez que cambia algo** (abrir una pestaña, cerrarla, cambiar de pestaña): sube el `ts`,
  guarda el cache y publica
  con un debounce de 1,5 s (minimo 8 s entre escrituras, para no pegarle a la api).
- **conflictos**: gana el `ts` mas nuevo. si el remoto es mas viejo y lo escribio otro dispositivo,
  se republica el mio. un `409`/`422` de sha releee y reintenta una vez.
- **pintar sin cambios no toca el `ts`**: abrir la pagina no pisa lo que dejo el otro dispositivo.
- `localStorage` queda **solo como cache offline** (`agente_tabs`, mas `agente_dispositivo` con el id
  corto de este telefono/mac).
- el poll va al mismo ritmo que los widgets: **30 s a la vista**, 120 s en background.
- **el token necesita `Contents: read and write`** sobre `agente-buzon`. si el PUT da 403/404, la web
  avisa una sola vez y sigue andando con las pestañas locales: **un 403 de escritura no desloguea**
  (por eso el PUT usa `fetch` propio y no `api()`).
- reglas de siempre: una pestaña por tema, y la general (`auto`) no se renombra.
- **el chat es un panel unico** (facundo, 2026-09-12): el layout es `tabs` + `activo` (la pestaña
  abierta). los `tabs.json` viejos traian `paneles` y `foco` del split que ya no existe: se leen para
  saber en que pestaña estabas (`sanearLayout` cae a `paneles[0]`) y **ya no se escriben**.

## borrador del input continuable entre dispositivos (2026-09-11)

facundo: "quiero dejar de escribir esto desde la compu y sin tocar enviar terminar este mensaje
desde el celu". lo que hay en la caja es un **borrador por pestaña** y viaja en el mismo `tabs.json`:

    {"v":1, "ts":..., "tabs":[...], "activo":"tools",
     "borradores": {"tools": {"texto": "lo que venia escribiendo", "ts": 1757600000000}}}

- **se guarda al tipear**: cada tecla actualiza el borrador de la pestaña activa en memoria y en el
  cache, y encola la publicacion con debounce de 1 s (con el minimo de 8 s entre escrituras de la api).
- **se resuelve por tema, no por layout**: gana el `ts` mas nuevo de **cada** borrador. un cambio de
  pestañas hecho en la compu no se lleva puesto lo que el celu esta escribiendo, y al reves tampoco
  (`recibirBorradores()` corre siempre, gane el layout remoto o el mio).
- **al abrir, recargar o volver al foco**: la caja aparece con el borrador de la pestaña activa y el
  **cursor al final**. primero el cache de `localStorage` (instantaneo) y despues lo que traiga el buzon.
- **cambiar de pestaña** guarda lo escrito como borrador de la que se deja y trae el de la nueva
  (`cajaDeTema()`, al final de `pintarTabs()`).
- **al mandar el mensaje** el borrador de esa pestaña se borra en todos los dispositivos: queda una
  **tumba** (`{"texto": "", "ts": ...}`) que le gana al borrador viejo del otro lado. las tumbas de mas
  de 2 dias se podan solas y el texto se corta en 8000 caracteres.
- **un mensaje escrito en la pestaña X que viaja a otra** (pregunta "mandalo a la pestaña Y", `tema y:` a
  mano, o partido en dos temas) **se borra de X**: caja y borrador de `tabs.json` (tumba con `ts`), antes
  de abrir Y (`soltarOrigen()`). partido: cada mitad que sale se descuenta de X (`mandarPartido(trozos,
  origen, texto)`); la que no pudo salir queda **solo en X**, no en la caja de Y (orden 1189).
- **cerrar la pestaña o bloquear el telefono** no pierde nada: en `pagehide` / `beforeunload` /
  `visibilitychange` se publica lo escrito y el PUT va con `keepalive`.
- `localStorage` sigue siendo **solo cache offline**.

probarlo: `python3 -m recetas.prueba_web_tabs` (bloque "borrador del input", cero tokens).

## sincronizar al abrir y al volver al foco (2026-09-11)

facundo: "cuando vuelvo a la interfaz desde el telefono se ven cosas re viejas y va actualizando.
quiero abrir el telefono o la compu y estar en el mismo lugar".

antes la web pintaba primero el `localStorage` (cache vieja) y recien despues traia el buzon, con
polls de 30 s a la vista y 120 s en background. ahora:

- **`sincronizar()`** baja **todo el buzon en paralelo** (el body del issue, los comentarios del chat,
  `widgets.json` y `tabs.json`) y recien ahi renderiza. la usa `arrancar()` al abrir y cualquier
  vuelta al foco.
- **mientras baja** se ve la linea `sincronizando…` arriba del chat y lo que viene del cache queda
  **apagado** (`body.sincronizando`, opacidad 45%): la cache ya no se muestra como si fuera el estado
  real. si github no contesta, la linea pasa a amarillo con `sin conexión con el buzón: esto es la
  copia local` (modo offline) y se sigue con lo cacheado.
- **al volver al foco** (`visibilitychange`, `focus`, `pageshow`) se dispara una sincronizacion ya,
  con un piso de 1,2 s para que un alt-tab no haga una bajada por segundo, y una sola en vuelo a la vez.
- **poll a 30 s a la vista** para widgets y pestañas (2026-09-13; estuvo en 10 s, pero el daemon publica
  `widgets.json` cada 60 s y pedir mas seguido traia el mismo archivo); el chat sigue en 5 s. en background
  quedan los 120 s de siempre.
- **edad de los widgets en el header** (facundo, 2026-09-13): con el `ts` del json fresco (< 5 min) no se
  muestra nada; pasados 5 min `hace N min` en ambar (`.wage-vieja`) y pasados 30 en rojo (`.wage-muy`).
  la calcula `edadWid()` y un reloj de 1 s (`refrescarEdad`) reescribe solo los `.wedad`, sin repintar,
  asi que avanza sola aunque no llegue un json nuevo. lo chequea `recetas/prueba_web_tabs`.
- los `chat-<tema>.jsonl` del daemon **no viven en el buzon**: la fuente del chat de la web son los
  comentarios del issue, y `recalcularTemas()` los reparte por pestaña. el log por tema es lo que lee
  el daemon para armar el contexto del modelo, no la web.

## donde quedaste leyendo cada pestaña (2026-09-11)

viaja en el mismo `tabs.json`, al lado de los borradores:

    {"v":1, "ts":..., "tabs":[...], "activo":"tools",
     "vistas": {"tools": {"ancla": "3512349", "abajo": false, "ts": 1757600000000}}}

- **no se guardan pixeles**: el alto de pantalla del celu y el de la mac no coinciden. se guarda el
  **id del comentario que quedo pegado al borde de arriba** (`ancla`) y al restaurar se scrollea hasta
  ese mensaje (`aplicarVista`).
- **`abajo: true`** es el caso normal (estabas al final) y no necesita ancla: es lo que ya hacia la web.
- **se resuelve por tema y por `ts` mas nuevo**, igual que los borradores: un `tabs.json` viejo no se
  lleva puesta la vista nueva del otro dispositivo.
- **se anota** al scrollear (debounce de 400 ms en memoria, publicacion con debounce de 4 s) y al
  esconder la pagina; **se restaura** al abrir, al terminar una sincronizacion y al cambiar de pestaña
  (`irDonde()` = ir al final y despues, si habia vista guardada, al ancla).
- si el ancla del otro dispositivo **todavia no esta cargada** (este lado tiene menos historial), no se
  pisa con un "estoy al final" falso: la vista se respeta hasta que aparezca el mensaje.
- **que pestaña esta abierta** viaja en el mismo `tabs.json` como `activo` (antes eran `paneles` y
  `foco`, del split que ya no existe).
- las vistas de mas de 7 dias se podan solas.

probarlo: `python3 -m recetas.prueba_web_tabs` (bloques "sincronizando" y "la vista de cada pestaña").

## el historial de cada pestaña sale del buzon, entero (facundo, 2026-09-11)

facundo: "cada vez que prendo el celu lo primero que veo es una conversacion re vieja" / "la pestaña de
server esta muerta". la causa era como se armaba el historial: `cargarComentarios` traia los comentarios
del issue de las ultimas N horas (`horas`, con un boton "cargar mas viejo" de a 24 h) y recien despues
`recalcularTemas` los repartia entre pestañas. una pestaña de tema con poca actividad reciente (`server`)
quedaba vacia y lo primero que se pintaba era el cache de `localStorage`.

ahora la charla **no sale de los comentarios**:

- **el daemon publica un archivo por tema** en el repo del buzon: `chat/<tema>.json` con TODA la charla
  de ese tema (de `logs/chat-<tema>.jsonl`: `ts, origen, tema, motor, fuente, modelo, pregunta,
  respuesta, partido`, ultimos `TOPE_CHAT_WEB` = 300 intercambios) y `chat/index.json` con
  `{tema: {ts, n}}`. misma contents api, mismo token y mismo mecanismo que `widgets.json` / `tabs.json`
  (`chat_web_publicar` en `daemon.py`). se publica **en el momento** en que se guarda cada respuesta
  (`chat_guardar` -> `chat_web_al_toque`, hilo aparte) y el script `chat_web` (cada 120 s, cero tokens)
  recupera lo que haya quedado sin subir. un motor (`awtomic/qa`) comparte el archivo de su tema padre.
- **la web baja `chat/index.json` y, en paralelo, el archivo de cada pestaña abierta** (el de la activa
  primero; si esta la general, los de todos los temas del indice, porque junta lo que no tiene pestaña
  propia). eso pasa dentro de `sincronizar()`, **antes** de pintar: una sola pasada de render con todo
  abajo, sin cache vieja de por medio.
- **el poll de comentarios sigue**, pero solo para la franja reciente (`horas` = 3, `?h=` para agrandarla):
  cubre lo que todavia no se publico y lo que el daemon contesta **sin modelo** (`status`, `cola`,
  `op N X`, `dale N`), que no va al log de chat.
- **las dos fuentes se mezclan en `mezclar()`**: `msgsHist` (por tema, orden del log) + `msgsCom` (orden
  de llegada), unidas por fecha con `mezclarOrdenadas` (cada lista conserva su orden interno). lo que ya
  esta en el historial no se pinta dos veces: `claveMsg` (clase + 120 chars normalizados) y una ventana
  de 30 min (`CERCA`).
- **abrir una pestaña que nunca se bajo** (`abrirTab`) dispara `chatDeTab`: su charla llega
  sola, sin esperar el proximo sync.
- **fuera el boton "cargar mas viejo"**, `cargarViejos`, `PASO`, `masViejoIso` y `sinMasViejo`.

probar: `python3 -m recetas.prueba_web_tabs` (bloque "4 quater": abre con la pestaña `server` activa
contra un stub del buzon y chequea que aparezca llena al primer render, que el `[tema]` no se pinte, que
el indice diga que temas hay, y que un mensaje que ya esta en el historial no se duplique con el poll).

## publicar

no se pushea a mano: se edita el clon (`~/.claudio/tools/agente/web/`), se corre
`python3 -m recetas.prueba_web` y `python3 -m recetas.prueba_autoupdate`, y se deja la marca
`touch ~/.claudio/tools/agente/.pendiente-web`. el daemon la mira en cada vuelta del loop:
bumpea, commitea, pushea y avisa "web publicada vX" una sola vez por lote.

## color del texto del chat (2026-09-11)

el cuerpo de cada mensaje pasa por `resaltar()`: escapa, y despues marca con un span cada cosa,
que el css pinta con la paleta fluo de `:root`.

| marca | clase | color |
|---|---|---|
| `**negrita**` | `neg` | amarillo `#ffd60a` |
| `` `code` `` | `cod` | cian `#22d3ee` sobre `#07222a` |
| `## titulo` | `tit` | magenta `#ff4fd8` |
| `---` | `sep` | verde tenue `#1f7a12` |
| `[tag]` del principio | `tag` | verde `#39ff14` |
| `ORDEN:` / `PROPUESTA:` | `orden` | amarillo |
| tabla | `tcab` / `tsep` / `tfila`(`.par`) | cabecera magenta, filas alternadas |
| `- [ ]` / `[x]` / `[!]` / `[>]` | `pend` / `ok` / `fallo` / `corriendo` | ya estaban |

el cuerpo del agente es `#e8e8e8` y el de facundo verde tenue `#9be88a`, para distinguir quien habla.
se chequea con `python3 -m recetas.prueba_web_color` (colores computados del css real, chrome
headless, cero tokens); corre solo dentro de `python3 -m recetas.prueba_web`.

## la fila del input (2026-09-11)

facundo: "sacale el borde verde a este input y a mandar, achica el alto de esta linea, mandar reemplazalo
por algun icono de terminal".

- `#txt` y `#mandar` sin verde: borde `#1a1a1a` (focus `#2a2a2a`, `outline:none`) y el boton con borde
  transparente. el verde queda solo en el texto del icono.
- alto de una linea: padding `5px 8px` y `min-height:30px` (30 px medidos), crece solo si el texto tiene
  varias lineas hasta `28dvh`.
- el boton dice `>_` (icono en texto plano, sin imagen), con el mismo id, el mismo handler y
  `title`/`aria-label` "mandar" para que se siga entendiendo.

## enter en el celu no manda (facundo, 2026-09-11)

en pantalla tactil **enter hace salto de linea** y el mensaje sale solo con el boton `>_`; en desktop
enter = mandar, shift+enter = salto. el textarea lleva `enterkeyhint="enter"` para que el teclado del celu
muestre "intro" y no "enviar", y `ajustarCaja()` crece con los parrafos hasta `TOPE_LINEAS` (6) o 28dvh,
lo que sea menor, y ahi scrollea.

**tactil se decide SOLO por hardware** (facundo, 2026-09-12: "tenes que saber si es un celular o compu
independientemente del espacio de la ventana"). `esTactil()` mira `matchMedia("(pointer: coarse)")` y, si
el navegador entiende la media query, esa respuesta manda (`pointer: fine` = desktop); solo cuando no la
entiende cae a `navigator.maxTouchPoints > 0`. **nunca por ancho, aspect ratio ni vista**: la version vieja
devolvia tactil con `innerWidth <= 899`, asi que en la compu con la ventana angosta enter dejaba de mandar.
lo chequea `recetas/prueba_web_tabs` (emula touch y metricas por cdp, cero tokens) en las cuatro ramas:
desktop ancho, desktop angosto (600px, enter manda igual), tactil ancho (1200px, enter no manda) y celu.

## widget usage: barras contra la linea (facundo, 2026-09-11)

"quiero ver cada uno de los parametros 5h week fable de cada cuenta como esta en relacion a la linea".
El widget `usage` muestra **solo barras**: tres por cuenta (`facu` y `orugote`), `5h`, `week` y `fable`.
Nada de presupuesto, horario laboral ni costo (los datos siguen en el json, no se pintan aca).

- **la linea** es la fraccion de la ventana que ya transcurrio, sacada de `resets_at`:
  `linea = (1 - falta / ventana) * 100`, ventana 5 h para `5h` y 7 dias para `week` y `fable`.
  Se pinta como un **tick blanco** sobre la barra: ahi deberia estar el relleno.
- **el color sale del ratio**, no del porcentaje: `ratio = pct / max(linea, 1)`.
  `<= 0.8` verde, `<= 1.1` amarillo, `<= 1.5` naranja, arriba de eso **rojo fuerte** (con glow).
  Renovo hace 20 min y ya gasto casi todo = rojo; renueva recien y uso poco = verde.
- **arriba, que cuenta esta usando y por que** (facundo, 2026-09-12: "vamos mitad y mitad"): la fila
  `.rep` dice `usa <cuenta>` + `reparto` / `auto, espera el corte` / `fija` y el motivo en gris. Sale de
  la clave `reparto` del json (`recetas/reparto_cuentas.py`, cero tokens): gana la cuenta con el **ratio
  peor mas bajo**, o sea la mas lejos de sus lineas. Cada cuenta suma su **nota** (`peor <limite> 1.25x`),
  la elegida queda marcada con `&larr; usa` y la que esta al tope (>= 97%) lo dice en rojo.
- **lo calcula python, no el html**: `recetas/reparto_cuentas.py` -> `barra()` (la usa `widgets_json`) deja `linea`, `ratio`,
  `nivel` (`ok` / `cerca` / `sobre` / `mal`) y `falta_s` en cada barra. La web solo pinta
  (`barraUso()` en `index.html`, clases `.ub`, `.ub-pista`, `.ub-lleno`, `.ub-tick`).
  La barra de `fable` sale del `weekly_scoped` de **esa** cuenta, no del plan global.
- tocar el nombre de una cuenta abre el modal de siempre, ahora con `linea` y `reset en ...`.
- se prueba con `python3 -m recetas.prueba_web_tabs` (cero tokens): seis barras, el ancho es el `%`,
  el tick esta en la linea, los tres colores, la fila del reparto (cuenta elegida y motivo), y que entre
  sin scroll horizontal. La decision en si se prueba con `python3 -m recetas.prueba_reparto_cuentas`.

## widget `server` (facundo, 2026-09-11)

> "haceme un widget dedicado al server, que diga todo lo que importa"

La **primera caja**, arriba de `usage`. El dato lo arma `w_server()` de `recetas/widgets_json.py`
(cero tokens, clave `server` de `widgets.json`); la web solo pinta (`cajaServer()` en `index.html`).

- **una sola ssh de 3 s** a la geekom (`f@192.168.1.80` con `~/.claudio/server/id_claudio`): uptime,
  `/proc/stat`, `/proc/meminfo`, `df`, la temperatura del hwmon **`k10temp`** (no `acpitz`, que miente),
  `/proc/net/dev`, `hostname -I`, `tailscale ip -4` y si el daemon corre como el usuario `agente`.
- **cpu % y bytes/s son deltas** contra la corrida anterior, cacheada en `agente/.server.json`: sin
  `sleep` remoto, el script de 60 s no se frena. El **throughput mac->server** (20 mb empujados por ssh
  a `cat > /dev/null`) se mide como mucho cada 10 min y tambien se cachea.
- **si no contesta la caja no desaparece**: dice `apagado / sin red` (o `sin ssh` si el ping anda),
  apaga las barras (`.usage.off`) y deja las ultimas metricas con el `visto hace`.
- ademas de las metricas: la **etapa** (`EN CURSO` de `~/.claudio/server/ESTADO.md`), las ordenes de
  `tema server` de la cola, lo que **espera a Facundo** y las ultimas lineas de `log.md` con "server".
- tres barras `.ub` (cpu / ram / disco) con color por umbral (`75` amarillo, `90` rojo), sin tick: aca
  no hay linea de presupuesto. Tocar la caja abre el modal `server`, en la pestaña `server`.
- se prueba con `python3 -m recetas.prueba_web_tabs` (cero tokens), con el server vivo y caido; para
  simular el caido a mano: `CLAUDIO_SERVER_IP=192.168.1.234 python3 recetas/widgets_json.py`.

## separador arrastrable entre chat y widgets (facundo, 2026-09-11)

> "tendria que haber un cursor resize horizontal entre chat y widgets y tendria que poder yo correr
> eso con mi cursor"

- **`#sep`** entre `#panel-chat` y `#panel-widgets`: una linea fina con el color de borde de la paleta
  (el `border-left` que antes tenia el panel de widgets), area de agarre de 7px, `cursor:col-resize`,
  y se prende en verde con glow al pasar el mouse o mientras se arrastra.
- **solo en escritorio**: abajo de 900px el separador no se pinta y `aplicarSplit()` no toca nada
  (en el celu las vistas van de a una y no hay dos paneles juntos).
- **arrastre por pointer events** (mouse y dedo en tablet), con `setPointerCapture`: mientras se
  arrastra solo se **pinta** (`guardarSplit(pct, false, true)`); al soltar recien ahi se guarda y se
  publica. asi no se escribe localStorage ni la api en cada pixel.
- **minimo de 280px por panel** (`SPLIT_MIN`). el pct es sobre el ancho de `#cuerpo`, con el separador
  adentro, asi que el tope de la derecha se calcula descontandolo.
- **son dos paneles y nada mas** (chat | widgets): el chat va a `flex:0 0 <pct>%` y los widgets a
  `flex:1 1 auto`, que se estiran con lo que sobra.
- **viaja en `tabs.json`** como campo `split: {pct, ts}`, al lado de `tabs`, `activo`,
  `borradores` y `vistas`, con `localStorage` de cache. se resuelve **por su propio `ts`** (como los
  borradores y las vistas) y no por el del layout: correr el separador en la compu no se lleva puestas
  las pestañas del celu, y al reves tampoco.
- al cambiar el ancho de la ventana el pct se recorta de nuevo contra el minimo (`resize`).
- se prueba en `recetas/prueba_web_tabs` (chrome headless, cero tokens): el separador se ve, se
  arrastra de verdad con `Input.dispatchMouseEvent` y el chat se achica en vivo, ningun panel baja del
  minimo de los dos lados, el ancho viaja en `tabs.json` y gana el `ts` mas nuevo, y en celu no aplica.
  ganchos: `window.__agente.split()` / `guardarSplit` / `recibirSplit` / `aplicarSplit` / `limitarPct`.

## el envio es idempotente (facundo, 2026-09-11)

dos enter muy rapidos mandaban el mismo mensaje dos veces y confundian la charla: la caja se vaciaba
recien cuando volvia el POST, asi que el segundo enter leia el mismo texto. ahora `mandar()`:

- no sale si ya hay un envio en vuelo (`enviando`), y bloquea el boton `>_` mientras tanto.
- vacia la caja y borra el borrador (tumba en `tabs.json`) **al toque**, antes del POST.
- ignora un texto identico al ultimo enviado hace menos de `REPE_MS` (2 s).
- si el POST falla, devuelve el texto a la caja y libera el dedupe para poder reintentar.

enter = mandar en desktop (shift+enter salto) y salto de linea en tactil sigue igual.
lo prueba `recetas/prueba_web_tabs` (punto 12) enchufando un POST falso con
`window.__agente.stubApi(fn)`; en produccion `apiStub` es null.

## fuente del input del chat (2026-09-11)

facundo: "orden o comando font esta muy grande, al menos desde el celu". el textarea `#txt` y el boton
`#mandar` van en **12px**, el mismo tamaño que los mensajes del chat (antes 13px en desktop y 16px forzados
en celu). el zoom automatico de ios safari al enfocar un input de menos de 16px lo frena
**`maximum-scale=1`** en el `meta viewport`, no la fuente grande; los inputs de login (`#clave`, `#tok`)
siguen en 16px. `python3 -m recetas.prueba_web` lo chequea en desktop y con el viewport de celu emulado.

## sugerencias de respuesta arriba del input (facundo, 2026-09-11)

facundo: "y esa caja de input deberia sugerir respuestas".

- **fila `#chips`** arriba de `#fila`, look terminal (mismo estilo que las pestañas,
  sin borde verde, alto chico, scroll horizontal en el celu). **se oculta si no hay sugerencias**
  (o sea: si el daemon todavia no contesto nada en esa pestaña).
- **cero tokens y cero red**: los chips los arma `sugerencias(texto)` en js leyendo la **ultima
  respuesta del daemon de esa pestaña** (`ultimaRespuesta(tema)`, el ultimo `clase: "agente"` que
  cae en la pestaña segun `deEstaTab`). el orden es:
  - **a/b/c**: lineas `**A** texto`, `A) texto`, `- A. texto`, `A: texto`, mas el cierre
    "decime A, B o C". chip = la letra y el titulo de la opcion recortado a 30 chars; **manda la letra sola**.
  - **`dale N`**: lineas `` - `N` `` o un "dale N" en el texto (tambien "dale 3, 7 y 9").
  - **`op N X`**: si la respuesta nombra `op N`, las opciones son las **reales** de `widgets.json`
    (`oportunidades.items[].opciones`), no las que diga el texto; si no hay datos y el texto trae la
    letra, queda ese chip solo.
  - **si / no** si la respuesta termina en pregunta.
  - **nada fijo**: los chips `status` y `cola` se sacaron (facundo, 2026-09-11), solo quedan los
    derivados de la ultima respuesta.
- **tocar un chip llena la caja y deja el foco ahi, NO manda**: queda como borrador de la pestaña
  (viaja en `tabs.json` como cualquier borrador) y se manda con enter o el boton. el `tema x:` lo
  agrega el envio de siempre, asi que el chip lleva el texto pelado (`status`, `op 2 B` y `dale 3`
  son de `RE_CRUDO` y salen sin prefijo).
- se repinta en `render()`, al llegar una respuesta (`pintarMsg`), al cambiar de pestaña (`pintarTabs`)
  y cuando llega `widgets.json` (`pintarWidgets`, que es de donde salen las opciones de las oportunidades).
- probado en `recetas/prueba_web_tabs` (chips de A/B/C con su titulo, `dale N`, si/no, `op N X` con las
  opciones del json, la fila oculta sin respuesta previa, y que tocar un chip llene la caja sin mandar).

## el chat es un panel unico: las pestañas no se arrastran (facundo, 2026-09-12)

> "che lo de los paneles del ui con el drag and drop por ahora sacalo. al menos las pestanas del chat
> no tienen que poder ser dragandropeables. el chat es un panel unico (como lo es los widgets)"

antes una pestaña se podia arrastrar hasta los widgets y quedaba como segundo panel (`#panel-lado`,
`#zona-drop`, `splitCon()`), y esa era la unica forma de partir la vista. **eso se saco entero**:

- **fuera el arrastre de pestañas**: `#zona-drop`, `#fantasma-tab`, `window.__arrastre`, los
  `pointerdown`/`pointermove`/`pointerup` de `#tabs`, el `touch-action:pan-x` de `.tab` y su css. la
  barra de pestañas **solo** hace click (cambiar de pestaña), `×` (cerrar) y `+` (pestaña nueva).
- **fuera el segundo panel**: `#panel-lado`, `#hist1`/`#lista1`, el boton `⊟ 1 pane`, `splitCon()`,
  `unPanel()`, `focoEn()` y la tercera vista del celu (`ver-lado`, el boton `lado` del header). el
  menu contextual de una pestaña ya no ofrece "mandar al lado de los widgets" y la pregunta de "esto
  parece de otro tema" queda con **ir a esa pestaña** o **forzar `tema x:` aca**.
- **el estado del chat es una sola pestaña**: `activo` en vez de `paneles` + `foco`, y `pintarMsg` /
  `render` / `anclaDe` / `aplicarVista` trabajan sobre `#lista` y nada mas.
- **los layouts guardados no se rompen**: `sanearLayout` ignora `paneles`/`foco` y solo los usa como
  respaldo para saber que pestaña dejar abierta; `tabs.json` ya no los escribe.
- **el resize horizontal chat | widgets queda como estaba** (`#sep`, `split: {pct, ts}`): eso no es
  drag and drop de pestañas.
- se prueba en `recetas/prueba_web_tabs` (chrome headless, cero tokens): no existe el boton de split,
  ni `draggable`, ni `window.__arrastre`, ni `#zona-drop`, ni `#panel-lado`, y arrastrar una pestaña
  con el mouse hasta los widgets **no** pinta fantasma ni abre ningun panel.

## camara: una foto desde el celu o la compu (facundo, 2026-09-11)

> "se puede poner una función tipo cámara acá? como en whatsapp"

- **boton `[◉]`** al lado del input (mismo look terminal que `>_`), y un `<input type="file"
  accept="image/*">` escondido: en el celu el sistema ofrece **camara o galeria**, en escritorio el
  selector de archivos. **sin `capture`** (facundo, 2026-09-11: con `capture="environment"` ios y
  android saltaban directo a la camara y no dejaban elegir una foto ya sacada).
- **pegar y arrastrar** (desktop): un `ctrl+v` con una imagen en el portapapeles, o arrastrar un
  archivo de imagen sobre el panel de chat (se resalta con `#panel-chat.soltar-img`), entran por el
  **mismo camino** que la camara (`imagenDe(dataTransfer)` -> `adjuntarFoto`). texto pegado sigue
  normal y el arrastre de pestañas no se toca (solo reacciona a `dataTransfer.types` con `Files`).
- **la foto se achica antes de subir**: canvas a `FOTO_LADO` (1600 px de lado mayor) y jpeg con
  calidad decreciente hasta entrar en `FOTO_TOPE` (2 mb). si el navegador no puede decodificarla
  (heic) y el archivo ya entra, se sube tal cual.
- **se sube al mismo repo del buzon** que `widgets.json` / `tabs.json`, por la contents api y con el
  mismo token, como `img/<hash12>-<nombre>` (hash sha-256 del contenido: la misma foto no se sube dos
  veces; un 422 se toma como "ya esta"). `fetch` propio y no `api()`: un 403 de escritura no puede
  desloguear a facundo del chat.
- **no se manda sola**: elegirla la deja como **adjunto pendiente** arriba del input (ver la seccion
  de abajo). se sube y se manda recien al tocar enviar.
- **sale como un mensaje normal de la pestaña activa**, con su `tema x:`: lo que hubiera en la caja
  como pie, mas `![<nombre>](img/<hash>-<nombre>)`. la web lo pinta inline con el mismo camino que
  las imagenes que manda el daemon (`conImagenes` / `bajarImagen`), sin volver a bajarla (el blob ya
  subido queda en `imgUrls`).
- **del otro lado**: `daemon.py` (`web_imagenes_entrantes`) llama a
  `recetas/mostrar_imagen.recibir_web()`, que baja `img/...` del buzon a `tmp/img/` y deja en el
  mensaje la **ruta local**, que es lo unico que `claude -p` puede abrir. solo rutas `img/<archivo>`
  del propio buzon, con extension de imagen y menos de 8 mb; si falla, el mensaje va igual.
- se prueba en `recetas/prueba_web_tabs` (cero tokens, cero red: `window.__agente.stubFoto()` y un
  `File` de juguete) y en `python3 -m recetas.mostrar_imagen --probar` (la bajada, con un bajador falso).

## el adjunto no se manda solo: primero se ve, se escribe o se borra (facundo, 2026-09-12)

> "cuando suba una foto tengo que poder borrarla o escribir algo. es decir que no se mande
> automáticamente el mensaje."

- **una foto elegida (camara, galeria, pegar, arrastrar) y un audio grabado con `[●]` quedan
  pendientes**, no salen al toque. el adjunto se pinta en `#adjunto`, arriba de los chips y del
  input: miniatura de 44 px (imagen) o `[▶]` con la duracion (audio), el nombre, y una **`×`** que
  lo descarta. mientras tanto el input sigue editable.
- **uno a la vez**: elegir otra foto reemplaza a la que estaba (el object url de la anterior se
  suelta). la `×` lo saca sin subir nada.
- **enviar** (boton `>_`, o enter en desktop) es lo unico que sube: comprime / hashea, sube al buzon
  y manda **un solo mensaje** de la pestaña activa con el texto de la caja mas el
  `![](img/...)` o `[audio](audio/...)`. con adjunto pendiente, un enter con la caja vacia manda
  igual (el archivo solo).
- **el adjunto vive solo en memoria**: no viaja en el borrador de `tabs.json` (el archivo no esta en
  el otro dispositivo, un blob no se sincroniza). el texto de la caja si, como siempre.
- **si la subida falla** (sin token, github frenado, 403), el adjunto **vuelve** al pie y el texto a
  la caja: no se pierde y se puede reintentar.
- funciones: `adjuntarFoto` / `adjuntarAudio` dejan el pendiente, `pintarAdjunto` lo dibuja,
  `descartarAdjunto` es la `×`, y `mandarAdjunto(texto)` (lo llama `enviarMensaje` antes de
  clasificar) sube y manda. `mandarFoto(file, pie)` y `mandarAudio(blob, mime, pie)` siguen siendo
  el camino de subida, ahora con el texto explicito.
- se prueba en `recetas/prueba_web_tabs` (cero tokens, cero red): el adjunto pendiente no dispara
  envio, la `×` lo saca sin subir, enviar manda imagen+texto (y audio+texto) en un solo mensaje, y
  no aparece en `tabs.json`.

## el gap de abajo del input y la barra de flechas de ios (facundo, 2026-09-11)

> "hay un gap abajo de la línea del input y un coso de flechas con un tilde en el teclado de mac,
> pero arriba. parece venir del ios, sácalo"

- **el gap**: `#pie` reserva `env(safe-area-inset-bottom)` para el home indicator, y con el **teclado
  abierto** ios lo sigue reservando: queda una franja negra entre el input y el teclado. ahora
  `ajustarAlto()` (visualViewport) marca `body.teclado` cuando el viewport visible pierde mas de
  120 px, y `body.teclado #pie{padding-bottom:4px}` lo pega abajo. con el teclado cerrado el
  safe-area vuelve.
- **la fila de chips** ya no ocupa alto ni margen cuando esta vacia (`#chips.oculta,#chips:empty`).
- **la barra de flechas + "listo"** que aparece arriba del teclado es la **accesoria de safari**
  (la pinta el navegador, no la pagina): desde el html no se saca, pero **en pwa standalone safari no
  la pinta**. por eso la web se agrega a la pantalla de inicio (ver abajo).
- **la fila predictiva** ("no y si" arriba del teclado) la pone el teclado de ios cuando el campo
  tiene autocorreccion. desde el 2026-09-12 el textarea va con `autocorrect="off"`,
  `autocapitalize="off"` y `spellcheck="false"` (mas `enterkeyhint="enter"`, `inputmode="text"` y
  `autocomplete="off"`), asi el teclado no suma nada arriba del input. si igual aparece, se apaga del
  todo en ajustes > general > teclado > predictivo.

## pwa: agregarla a la pantalla de inicio (facundo, 2026-09-12)

el objetivo es que **entre el input y el teclado no quede nada**: en standalone no hay barra de
safari ni barra de accesorios.

- **lo que declara la pagina**: `manifest.json` (`display: standalone`, `start_url` y `scope` `./`,
  iconos 192/512 + svg, fondo y tema negros), las metas `apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, `mobile-web-app-capable` y
  `<link rel="apple-touch-icon" href="icon-180.png">`. el manifest se pide con `?v=<version>`: el
  bump del daemon lo actualiza solo, si no pages lo cachea para siempre.
- **agregar a inicio (ios)**: abrir `https://facundopichetto.github.io/agente-web/` en **safari**
  (chrome no puede agregar pwa en ios), compartir > "agregar a inicio", y abrirla desde el icono. la
  clave del board y el token se piden una vez adentro de la pwa (es otro almacenamiento que safari).
- **como se detecta**: `esStandalone()` mira `navigator.standalone` (ios) y
  `matchMedia("(display-mode: standalone)")` (android / desktop), y deja la clase `standalone` en el
  `body` (`window.__agente.esStandalone()` / `marcarStandalone()` para las pruebas).
- **el teclado en standalone** sigue el mismo camino que en safari: `ajustarAlto()` con
  `visualViewport`, `body.teclado` para comerse el `safe-area` de abajo y `trabarScroll()` para que
  la ventana no se corra. `recetas/prueba_web_tabs` lo chequea con la clase `standalone` puesta.
- **lo que la pwa cambia y hay que saber**: los links se abren en safari aparte, no hay pull to
  refresh (la pagina igual se recarga sola con `version.json`), y cerrar la app no borra nada.

## se saco la fila de comandos rapidos (facundo, 2026-09-11)

facundo: "sacame la linea esa que ahora dice status cola y la de arriba tambien".

- se borro del todo la fila **`#rapidos`** que iba arriba del input (`status` / `log` / `cola` /
  `pausa` / `propuestas` / `avisos` / `ronda jira`), con su css y su handler de click.
- se sacaron tambien los chips **fijos** `status` y `cola` que `sugerencias()` agregaba al final de
  cada respuesta: la fila `#chips` ahora solo muestra lo derivado de la ultima respuesta
  (A/B/C, `dale N`, `op N X`, si/no) y sigue oculta si no hay nada.
- **los comandos no se perdieron**: el widget `agent` mantiene su fila `pausa` / `cola` / `status`,
  que manda los mismos mensajes crudos.
- `recetas/prueba_web_tabs` chequea que `#rapidos` ya no exista y que los chips no traigan fijos.

## menu contextual: responder, copiar, editar (facundo, 2026-09-11)

"quiero poder hacer tap and hold o click derecho en cualquier mensaje del chat (o cualquier cosa de la ui,
a tu criterio) y que salga un menu contextual".

**el gesto**: `contextmenu` en desktop (con `preventDefault`, asi no sale el del navegador) y **tap and hold
de 500 ms** en el celu. el hold se cancela si el dedo se mueve mas de 10 px (era un scroll) o si levanta
antes, y los listeners de touch son `passive`: el scroll de la pagina no se toca. el menu abre con un
fondo (`#ctxfondo`) que **se come el click que viene atras del hold**, asi el tap no cambia de pestaña ni
abre el modal; ese fondo ignora los clicks de los primeros 400 ms por la misma razon.

**sobre que**, delegado en el contenedor (los mensajes se repintan enteros en cada `render()`, por eso el
mensaje viaja en el nodo como `div.__msg`):

| donde | opciones |
|---|---|
| un mensaje del chat | `responder`, `copiar`; y si es de facundo, `editar` y `mandar a otra pestaña` |
| una fila de un widget | `ver y decidir (a/b/c)` (abre el modal que ya existia) y `copiar` |
| una pestaña | `renombrar tema`, `cerrar la pestaña` |

la pestaña **general** (`auto`) solo ofrece cerrar: no se renombra nunca.

**responder** pone en el input un bloque de cita y una linea vacia abajo (queda como borrador de la
pestaña, asi que se puede terminar de escribir desde el otro dispositivo):

```
> facundo: agrega un widget al daemon

```

hasta 3 lineas, cada una recortada a 120 chars. el daemon la separa del pedido (`marcas_chat` en
`daemon.py`) y se la pasa al modelo como **contexto** (`## a que esta contestando`), no como parte de lo
que facundo pide.

**editar** carga el mensaje en la caja con el prefijo `edicion del mensaje de <hh:mm>: `. al mandarlo, el
daemon lo guarda en `logs/chat-<tema>.jsonl` como `edita_ts` y le dice al modelo que **corrige** al
mensaje anterior, no que es un pedido nuevo suelto; en la charla previa de esa pestaña aparece como
`facundo (corrige lo de las 14:32): ...`.

**copiar** usa `navigator.clipboard` y cae en `execCommand("copy")` si no esta (file:// y http).

el menu se cierra con `esc`, tocando afuera o al scrollear (`scroll` con captura, que no burbujea).
se prueba en `recetas/prueba_web_tabs` (bloque 15): `window.__agente.menuEn(selector, n)` dispara el
gesto, `menuInfo()` devuelve titulo, opciones y si el menu quedo adentro de la pantalla, y `tocarMenu(t)`
elige una opcion. la cita y la edicion se cruzan ahi mismo con el `marcas_chat` de `daemon.py`, para que
las dos puntas no se separen.

## audios: mandarlos como en whatsapp y escuchar las respuestas (facundo, 2026-09-11)

> "estaria bueno poder mandarte audios como en whatsapp, implementalo. y tus respuestas tienen que
> tener un play para que me los lea daniela en un formato que ocupe lo menos posible de audio."

**entrantes.** el boton `[●]`, al lado del de camara, graba con **tap and hold** (pointer, asi vale el
dedo y el mouse): apretado graba y el boton late en rojo con el reloj al lado, arrastrar el dedo afuera
cancela y un toque de menos de `AUDIO_MIN_MS` (600 ms) no deja nada. el formato lo elige el navegador
entre `MIMES` (opus en webm donde se puede, mp4 en safari), **mono 16 khz a 16 kbps** (`AUDIO_BPS`,
`AUDIO_PISTA`): el minimo legible medido (ver abajo). si el celu rechaza las constraints, micro pelado.

**soltar ya no manda** (facundo, 2026-09-12): el audio queda como **adjunto pendiente** arriba del
input, con `[▶]` para escucharlo, su duracion y una `×` para descartarlo (ver "el adjunto no se manda
solo"). al tocar enviar se sube al **mismo repo del buzon** que las fotos (`audio/<hash>.<ext>`,
contents api, mismo token, `subirBuzon`) y sale como un mensaje normal de la pestaña activa con su
`tema x:`, el texto que haya escrito y el marcador `[audio](audio/<hash>.webm)`.

### el celu transcribe antes de mandar (facundo, 2026-09-14, orden 1209)

> "audio del chat transcripto en el celu antes de mandar."

si el navegador tiene reconocimiento de voz (`SpeechRecognition` / `webkitSpeechRecognition` de safari
ios, `es-AR`), arranca **en paralelo** al `MediaRecorder` (`empezarDictado`, justo despues de
`grabador.start()`): mientras grabas, el telefono transcribe. al soltar, el texto ya esta y se ve en el
adjunto pendiente entre comillas (`.adj-dicho`, se descarta con la misma `×`). el mensaje sale con el
texto **y** el archivo:

```
mira esto
(audio de facundo, transcripto en el celu): hola flaudio, esto lo dicta el celu
[audio](audio/<hash>.webm)
```

esa marca la lee `recetas/transcribir_audio.recibir_web`: con ella **whisper no corre** (saca el
marcador del archivo y le pasa al modelo el texto del celu, sin esperar ni gastar cpu). el archivo
igual queda en el disco del server, asi que el `[▶]` del chat suena igual.

**los dos caminos, siempre**: sin reconocimiento, si falla (`onerror`), si no se entendio nada, o si el
reconocedor no arranca, el mensaje va como siempre (solo el archivo) y lo transcribe whisper local. el
dictado **nunca** puede romper la grabacion: arranca despues del `MediaRecorder`, todos sus errores se
comen ahi y `cortarDictado()` lo suelta en los mismos caminos que el microfono.

**on-device**: chrome 138+ sabe decir si el modelo esta en el telefono
(`SpeechRecognition.available({langs, processLocally: true})`, se pregunta **una vez** al cargar con
`prepararDictado()`) y ahi se prende `rec.processLocally = true`. safari no expone nada: se dicta igual
(lo hace el telefono con el dictado del sistema) pero **no se puede afirmar** que el reconocimiento sea
on-device; lo que si es seguro es que **el archivo de audio no sale de la lan**.

### el archivo del audio no sale a internet (orden 1209)

`mandarAudio` prueba la lan **antes** de subir (`probarLan()` si `lan.base` esta vacio) y manda los
bytes al endpoint (`POST /subir?ruta=audio/...`, `recetas/chat_lan.py`). del otro lado, `audio/` esta en
`SOLO_LAN`: `recibir_archivo` **no deja marcador de subida**, asi que el archivo se queda en
`tmp/lan/audio/` y **nunca se publica en el buzon de github**. como cloud solo lee el buzon (y `tmp/`
esta excluido del rsync de `trabajo_nube` y de `replica_estado`), **el audio nunca pasa por cloud**. si
el comentario sale al buzon sin atender, lleva la nota "el audio quedó en el disco del server"
(`nota_solo_lan`) para que el nodo que lo atienda no lo busque en github.

la unica vez que el archivo viaja por internet es con **la lan caida**: ahi la web lo sube al buzon
(`subirBuzon`), que es el respaldo. mejor eso que perder el audio.

### whisper local, cuando el celu no pudo

el daemon lo baja a `tmp/audio-entrante/` y lo transcribe **local y sin tokens** con faster-whisper
`small` en cpu int8 (`recetas/transcribir_audio.py`, venv en `~/.claudio/tools/stt`), asi que al modelo
le llega el texto con la marca `(audio de facundo, transcripto): ...`. el enganche esta en
`atender_mensaje`, que es por donde pasan **todos** los canales: web, cola y telegram lo heredan.

**el microfono se suelta siempre** (`soltarMicro`, en todos los caminos y en `pagehide`): un micro
abierto en el celu es la ventana que mas se nota.

**salientes.** el daemon renderiza cada respuesta con daniela (piper, el mismo `tts/render.py` y el
mismo `pronunciacion.json` del podcast) en un **hilo aparte**: el texto sale primero y el audio aparece
despues, sin trabar nada. se publica como `audio/r-<hash>.m4a` y el hash sale del texto **ya limpio**,
asi que la misma respuesta no se renderiza ni se sube dos veces. la fila de `chat/<tema>.json` lleva el
campo `audio` y aca se pinta un `[▶]` con look terminal al lado del `[tema]`; el tick refresca el
historial cada 10 s (etag, 304 casi siempre), asi que el play llega solo, sin volver al foco.

**formato: aac mono 32 kbps en `.m4a`.** medido con la misma frase: opus 24k en ogg 10,6 kb, opus en
caf 10,5 kb, aac 32k en m4a 16,4 kb (3,68 s). el opus ocupa 1,5 veces menos, pero **ogg/webm opus solo
lo reproduce safari 17.5 para arriba** y facundo escucha del celu: un play que no suena no sirve. m4a
lo reproduce todo y sigue dando ~250 kb por minuto. se cambia en `FORMATO`, una linea, en
`recetas/audio_respuesta.py`.

lo que **no** se lee en voz alta (`limpiar()`): bloques de codigo, imagenes, urls (quedan como "un
link"), rutas largas (queda el nombre del archivo), los signos del markdown y los separadores de tabla.
tope de 3 minutos por respuesta: se corta en la ultima oracion que entra y avisa que el resto esta
escrito.

**compresion: 16 kbps es el piso, medido.** `python3 -m recetas.prueba_web_audio --compresion` (cero
tokens, ~2 min) hace que piper diga una frase, la encodea en opus a 8, 16 y 24 kbps y la lee con
whisper: a 16 sale lo mismo que a 24 (0,88 vs 0,78 de parecido con el wav crudo) y pesa 30% menos
(16,9 kb vs 23,9 kb); a 8 kbps ya se come las primeras palabras (0,50). de ahi salio `AUDIO_BPS`.

se prueba con `python3 -m recetas.prueba_web_audio` (cero tokens, chrome headless, sin microfono: el
blob se manda a mano y la subida va contra un stub; el dictado va contra un reconocedor falso y cubre
**los dos caminos**) y corre tambien dentro de `recetas/prueba_web`.

## claudio sigue contestando aunque claude no tenga tokens (facundo, 2026-09-12)

facundo mando cuatro mensajes seguidos y en los cuatro leyo lo mismo: `You've hit your session limit ·
resets 1:20am`. eso era el texto crudo de `claude -p` pasado tal cual como respuesta. su pedido: "yo hablo
con claudio, si claudio ve que claude se queda sin tokens tiene que poder hacer cosas, explicarme a mi por
lo pronto eso", y tener los guards puestos de antemano.

**la web no cambia**: el guard vive del lado del daemon (`recetas/sin_tokens.py`, cero tokens) y lo que llega
a la pestaña es un mensaje normal, con el tag `[tema]` de siempre y el cuerpo arrancando en `[sin modelo]`.
lo que se ve en el chat cuando claude no esta:

- **una explicacion, no un error**: que paso (limite de 5 h, limite semanal, limite del modelo, oauth
  vencido, api sobrecargada, red, binario, timeout), **hasta cuando** (la hora del `resets_at` con cuanto
  falta), como viene cada limite de la cuenta activa contra su linea, y que otra cuenta tiene margen.
- **un menu a/b/c** al final, para contestar con una letra desde el celu: `a` esperar el reset, `b` pasar a
  la cuenta con margen (`cuenta <nombre>`), `c` seguir con el modelo gratis (`eco: ...`).
- **comandos que andan sin claude**: `status`, `cola`, `usage`, `cuenta`, `log`, `avisos`, `propuestas`,
  `pendientes`, `pausa`, `segui`, `ayuda`. `usage` imprime los tres limites (5h / week / modelo) de cada
  cuenta contra su linea, en texto, desde el cache: sirve igual con el widget caido.
- **el mensaje no se pierde**: lo que escribio queda en `preguntas-sin-tokens.jsonl` y cuando claude vuelve
  aparece un mensaje en la pestaña listando lo que quedo sin contestar (`pendientes` lo muestra antes).
- **el aviso llega antes del corte**: cuando un limite de la cuenta activa pasa el 97% (`sin_tokens.AVISO_PCT`;
  era 90% hasta el 2026-09-13, cuando el switch de cuenta paso a ser casi al 99%), el daemon deja un
  aviso al celu y un mensaje en la pestaña `tools`, una sola vez por ventana.

las letras `a` / `b` / `c` sueltas se interceptan **solo** cuando claude de verdad no esta; si claude
contesto un menu a/b/c, la letra le sigue llegando al modelo como siempre.

probar sin gastar tokens: `python3 -m recetas.prueba_sin_tokens -v` (simula los nueve fallos y muestra el
texto de cada uno) y `python3 -m recetas.sin_tokens --estado` (que ve claudio ahora mismo).

## header de cada widget: dato esencial, [↻] y [⚙] (facundo, 2026-09-12)

cada caja de la derecha tiene una fila de header:

- **izquierda**: el titulo (tocarlo **pliega y despliega** la caja) y un **dato esencial de una
  linea**, el que resume el widget sin abrirlo:
  `server` vivo/apagado + cpu, `usage` la barra mas cerca de la linea **por cuenta**, `agent` la
  cuenta activa + que esta corriendo, `verification agent` / `my tickets` / `propuestas` / `avisos`
  la cantidad, `opportunities` las pendientes, `decided` las decididas, `podcast` el episodio de
  arriba, `dj` si suena algo y cuantos bloques van, `backup models` el ultimo veredicto.
- **derecha**: `hace Xs` (la edad del `widgets.json` que se esta viendo), **`[↻]`** y **`[⚙]`**.
  en el celu los dos botones tienen area tactil de 40 px.

`[↻]` **vuelve a bajar `widgets.json` del buzon al toque**: tira el etag (si no github contesta 304)
y repinta. el json lo republica solo el script `widgets_web` del daemon cada 60 s, asi que el boton
trae lo ultimo publicado sin gastar un token; no fuerza al daemon a re-medir.

`[⚙]` abre el **modal con look terminal de siempre**, una accion a/b/c por setting (bool: si/no;
opciones: cicla la lista), mas "volver a los valores de fabrica" y "cerrar". las settings se aplican
en el momento y el modal se queda abierto:

| widget | comunes | propia |
|---|---|---|
| todos | `plegado por default`, `filas visibles` (todas / 3 / 5 / 8 / 12), `ocultar este widget`, `subir`, `bajar` | |
| `server` | | `mostrar el log` |
| `usage` | | `cuentas` (todas o una) |
| `agent` | | `mostrar la cola` |
| `my tickets` | | `filtro de estado` (los estados que hay ahora) |
| `opportunities` | | `ocultar las decididas` (saca la caja `decided`) |
| `propuestas` | | `filtro de tema` |
| `podcast` | | `abierto por default` |
| `dj` | | `mostrar la cola` |

**donde viven**: en `tabs.json` del buzon, en la clave `wsets` (`{clave: {setting: valor, ts}}`),
junto al layout, los borradores y el split, con el mismo debounce. se resuelven **una por una por su
propio `ts`** (como los borradores): tocar el filtro de tickets en la compu no pisa el plegado que
dejaste en el celu. `localStorage` (`agente_tabs`) queda de cache offline.

lo prueba `recetas/prueba_web_tabs` (cero tokens): que cada caja tenga su header con los dos botones,
el dato esencial de cada una, que plegar quede guardado y viaje en `tabs.json`, que el modal liste las
settings, que filtrar y recortar filas cambie lo que se pinta, y que el `[↻]` tire el etag.

## los widgets se ordenan arrastrandolos (facundo, 2026-09-12)

facundo: "los widgets tienen que poder ordenarse con drag and drop".

- **se agarran del header**, no del cuerpo: en la **compu** con el mouse (arranca despues de mover
  5 px, asi un click sigue siendo un click) y en el **celu** con **tap and hold de 500 ms** y despues
  el dedo. mientras dura el arrastre la caja va `position: fixed`, queda un **fantasma punteado**
  donde va a caer y el panel **no scrollea** (el `touchmove` del arrastre es `preventDefault`).
- **no pisa nada de lo que ya andaba**: `[↻]` y `[⚙]` siguen siendo botones, tocar el titulo sigue
  plegando (el click que viene atras de un arrastre se ignora por 300 ms), el hold del **menu
  contextual** solo se pide sobre las filas (`[data-it]`), no sobre el header, y tocar una fila sigue
  abriendo el modal a/b/c.
- **las pestañas del chat siguen SIN drag** (regla del 2026-09-12: el chat es un panel unico). el
  reorden es solo de widgets.

**donde vive**: en `tabs.json` como **`orden_widgets`** (`{ids: [claves], ts}`), al lado de `wsets`,
los borradores y el split, resuelto **por su propio `ts`** (gana el mas nuevo), con `localStorage` de
cache offline. asi el celu y la compu muestran las cajas en el mismo orden. una clave que ya no
existe se ignora y un **widget nuevo que no este en la lista va al final**: nunca desaparece.

**sin drag**: el modal `[⚙]` de cada caja trae `subir` y `bajar` (saltan las cajas ocultas, si no
mover una vez no cambiaria nada) y dice en que posicion esta ("caja 3 de 14"). `ocultar este widget`
la saca de la lista; las ocultas se listan en el **pie** del panel (`ocultos: dj mail`) y se vuelven a
mostrar tocando su nombre, que es el unico lugar desde donde se pueden recuperar.

lo prueba `recetas/prueba_web_tabs` (cero tokens): arrastrar la ultima caja hasta arriba con eventos
de mouse de verdad y con **tap and hold** tactil, que un dedo que se mueve antes de los 500 ms sea un
scroll y no un arrastre, que el orden sobreviva al repintado de `widgets.json`, que viaje en
`tabs.json` y se resuelva por `ts`, que `subir` / `bajar` muevan, y que ocultar y volver a mostrar
desde el pie funcione.

## la vista mobile entra por forma, no solo por ancho (facundo, 2026-09-11)

facundo: "si es mas alta que ancho tiene que tener la view de mobile. me refiero a el toggle chat
widgets".

antes la vista de una-sola-cosa-a-la-vez se decidia por **ancho fijo** (`max-width:899px` en el css,
`innerWidth < 900` desperdigado por el js), asi que una ventana angosta pero de mas de 900px, o el
celu de pie, caia en los dos paneles y quedaba ilegible.

- **un solo media query, en los dos lados**: `(max-width:899px), (max-aspect-ratio: 1/1)`. esta en
  el css (los dos bloques `@media`) y en el js como la constante `MQ_MOBILE`.
- **una sola funcion decide**: `esVistaMobile()` (`window.matchMedia(MQ_MOBILE).matches`, con
  fallback a `innerWidth`/`innerHeight` para navegadores sin `matchMedia`). `anchoDesktop()` es
  `!esVistaMobile()` y **ningun otro lugar del js lee `innerWidth` para decidir layout**.
- **reacciona sin recargar**: `sincronizarVista()` corre en `resize`, en `orientationchange` y en el
  evento `change` del propio media query (que ademas avisa cuando cambia el alto sin un `resize`
  util: teclado de ios, ventana partida, zoom). ahi se acomoda lo que el css no puede: el `pct` del
  separador se recorta a los minimos.
- **la vista elegida se recuerda**: girar a apaisado muestra los dos paneles (el css ignora la clase
  `ver-widgets` fuera de mobile) y al volver a vertical se cae donde estabas.
- **el separador** (`#sep`) sigue siendo solo de desktop: en vista mobile no se pinta y el `flex`
  elegido en la compu no le toca el layout, aunque la ventana sea ancha.
- se prueba en `recetas/prueba_web_tabs` con `Emulation.setDeviceMetricsOverride`: `1000x1400` tiene
  que dar toggle y una vista a la vez, `1400x1000` los dos paneles y el separador, y `600x900` y
  `844x390` (celu de pie y acostado) mobile las dos.

## de donde escribe facundo: `celu` o `compu` (facundo, 2026-09-12)

> "deberias poder saber de donde te escribo (al menos de donde mando el send jaja)"

cada mensaje que sale de la web lleva pegada al final una marca con **de donde salio**:

```
tema tools: hola
[desde: celu ab12cd ios/safari]
```

- **`celu` / `compu` se decide por HARDWARE**, con el mismo `esTactil()` que decide si enter manda
  (`pointer: coarse` + `maxTouchPoints`). nunca por ancho de ventana, aspect ratio ni vista: la compu
  con la ventana angosta sigue siendo `compu`.
- **`ab12cd`** es el id corto del dispositivo (`DISPOSITIVO`, `localStorage agente_dispositivo`), el
  mismo que ya usaba `tabs.json` para no re-aplicarse lo que acaba de publicar.
- **`ios/safari`** sale de `navCorto()` (os + navegador del `userAgent`), o `otro` si no se reconoce.

la forma es **cerrada a proposito** (`celu|compu` + id + navegador): un mensaje que termina en
"[desde: casa]" es texto de facundo y no se toca. misma regex en los dos lados (`RE_DESDE` de
`index.html` y de `daemon.py`).

del lado del daemon, `marca_desde(texto)` la saca **antes de mirar el texto** (primera linea de
`atender_mensaje`), asi los comandos crudos (`status`, `cola`, `op 2 B`, `dale 3`, `codigo <x>`)
siguen matcheando exacto. de ahi:

- se guarda como campo `desde` en `logs/chat-<tema>.jsonl` (`chat_guardar`), y viaja a la web en
  `chat/<tema>.json` (`CAMPOS_CHAT_WEB`);
- se le pasa al modelo en el prompt del chat como una seccion `## desde donde escribe`, para que
  sepa si facundo esta frente a la mac o con el celu en la mano antes de darle pasos a tipear;
- queda en `log.md` en la linea del chat (`..., desde celu ab12cd (ios/safari)`).

la web la saca del cuerpo al pintar (`sacarDesde()` en `agregar()`), asi que en el chat se ve el
mensaje limpio y el dato queda en `m.desde`.

pruebas (cero tokens): `python3 -m recetas.prueba_web` (incluye `prueba_web_tabs`: la marca al final
del cuerpo, que se saque al pintar y que un "[desde: casa]" no cuente) y `python3 daemon.py --prueba`
(`marca_desde` / `desde_texto` / `CAMPOS_CHAT_WEB`).

## la hora de envio manda sobre la de llegada (facundo, 2026-09-13, orden 1191)

> "un audio queda abajo de un texto posterior"

el chat estaba ordenado por **cuando se escribia la fila en el server**, que es cuando la respuesta ya
salio. un audio se sube al buzon, se transcribe con whisper y recien ahi se contesta: se escribia dos
minutos despues de un texto que facundo habia mandado **mas tarde**, y quedaba abajo (`chat-tools.jsonl`,
21:44 a 21:45).

ahora cada mensaje de facundo sale con **la hora en que apreto mandar**, arriba de `[desde: ...]`:

```
tema tools: hola
[enviado: 1757800000123]
[desde: celu ab12cd ios/safari iphone]
```

- **epoch en ms** y no texto: el reloj del celu y el del server no comparten formato ni zona.
- la pone `cuerpoMsg(texto, tema, crudo, tsEnvio)`. lo que tarda en salir (una foto, un audio) pasa su
  propio `tsEnvio`, tomado **cuando se apreto enviar**, no cuando termino la subida.
- lo guardado por el freno de github sale despues con su hora original: ya viaja en el cuerpo.

del lado del daemon, `marca_enviado(texto)` la saca **despues** de `marca_desde` (va arriba de esa) y
**antes** de mirar el texto, asi los comandos crudos siguen matcheando exacto. de ahi:

- el **`ts` de la fila** de `logs/chat-<tema>.jsonl` es esa hora, y la de llegada queda en
  **`ts_llegada`** (las dos viajan en `chat/<tema>.json`, `CAMPOS_CHAT_WEB`);
- `chat_web_datos` publica las filas **ordenadas por `ts`** (el jsonl se apendea como llega, no como se
  mando) y `chat_nodo.fusionar_filas` ya ordenaba por `ts`;
- el indice (`chat/index.json`, el "hace N min") sigue midiendo la **ultima actividad en el server**:
  usa `ts_llegada`.
- **guard del reloj**: si el `enviado` esta mas de 2 min adelantado o mas de un dia atrasado respecto
  del server, se ignora y manda la hora de llegada (un celu desfasado no manda mensajes al principio
  ni al final del historial). queda una linea en `log.md`.

en la web: la **pregunta** se pinta con la hora de envio y la **respuesta** con `ts_llegada` (cuando se
escribio de verdad); un comentario del buzon con la marca gana sobre el `created_at` de github.

pruebas (cero tokens, sin publicar en el buzon): `prueba_web_tabs` (un audio mandado 21:44 que se
escribio 21:46 queda **arriba** de un texto mandado 21:45, las dos horas pintadas, y la marca que
escribe la web la lee `daemon.py`), `prueba_web_audio` (el audio sale con la hora en que se apreto
mandar, no con la de la subida) y `python3 daemon.py --prueba` (`marca_enviado`, `ts` / `ts_llegada` y
el orden que publica `chat_web_datos`).

### el historial viejo tambien (orden 1194, `recetas/reordenar_chat.py`)

lo de arriba vale de la 1191 en adelante. las filas **anteriores** se habian guardado con la hora de la
respuesta, asi que un mensaje que tardo mas quedaba debajo de uno mandado despues (`C: contraste` de las
21:44:44 debajo de `cuando algo mando a otra pestaña` de las 21:44:52). el script `reordenar_chat` del
daemon (cada 10 min, cero tokens) cruza cada fila con el **comentario original del buzon** (por `com_id`,
y si no por texto normalizado + dia, sin repetir comentario) y le pone al `ts` el `created_at` de github,
dejando la hora vieja en `ts_llegada`. no se mueve lo que vino de telegram o la consola, ni lo que no
matchea ningun comentario: nunca se inventa una hora. antes de reescribir deja backup con fecha en
`backup/`, y los temas que movio los **republica el daemon** (la receta no escribe en el buzon).

corrida de fondo 2026-09-13 23:57 sobre todo el historial: 480 filas corregidas (tools 234, server 145,
awtomic 71, fuzzer 12, podcast 11, personal 6, juegos 1), sin perder ni duplicar ninguna.
`python3 -m recetas.reordenar_chat --seco` lista lo que moveria; prueba
`python3 -m recetas.prueba_reordenar_chat` (cero tokens, cero red).

## urls: enteras y clickeables (facundo, 2026-09-12)

paso con el `login orugote`: la url de oauth (450 chars) llego cortada y claude.com contesto
**"Invalid OAuth Request / Missing state parameter"**. eran dos cosas:

- el widget `avisos` cortaba cada fila a **400 chars** (`cajaAvisos`), y el `&state=` de esa url
  arranca justo en el 400. ahora **un aviso con url no se corta nunca** (el tope de 400 sigue para
  los avisos sin link);
- en el chat las urls eran **texto plano**: habia que seleccionar 450 chars a dedo en el celu.

`enlaces(l)` (arriba de `costos()`) es el unico lugar donde se arman links: convierte
`[texto](url)` y las urls sueltas en `<a target="_blank">`, y lo llama `enLinea()` **al final**
(despues de `code`, costos y negrita) y `cajaAvisos()`. detalles que importan:

- el texto ya viene escapado, asi que `&` llega como `&amp;` y **va igual al href**: el html lo
  decodifica solo. no hay que des-escapar nada;
- la puntuacion final (`.`, `)`, `,`, `!`) queda afuera del link, pero **`;` no se saca**: es el
  cierre de `&amp;`, que trae casi toda url larga;
- lo que esta entre backticks no se linkea (lo aparta `enCodigo`).

del lado del que manda la url, `recetas/login_remoto.url_ok()`: una url de oauth se manda **solo si
llego entera** (`state=` y `code_challenge=`). si la pantalla del tmux se leyo a medias, no se manda
nada y lo dice; la url ademas va **sola en su propio aviso**.

pruebas: `recetas/prueba_web_tabs` (el link entero con su `&state=`, el punto final afuera, el
markdown link, y el aviso sin cortar ni puntos suspensivos).

## github frenado: un solo escritor y el mensaje no se pierde (2026-09-12)

paso 16:01-16:04: el daemon subia 6 `chat/*.json` + `widgets.json` por vuelta desde dos hilos y
reintentaba cada 409 en caliente. github bloqueo el token por **"secondary rate limit / content
creation"** (403) y, como el token es el mismo, el POST del mensaje de facundo desde la web tambien
rebotaba. la web mostraba "vuelvo a intentar en 900 s" porque tomaba el `x-ratelimit-reset`, que es del
limite **primario**.

**daemon** (`recetas/buzon.py`, `BUZON` en `daemon.py`):

- **un solo escritor** con cola: `_web_poner` encola archivos y `web_enviar` encola comentarios; un hilo
  los manda. un archivo que cambia 3 veces en un minuto se sube una vez (`CADA_RUTA` 60 s, con el ultimo
  contenido). los comentarios salen primero y en orden.
- **tope**: `TOPE_MIN` 20 escrituras por minuto y `TOPE_HORA` 400, contando todo lo que escribe el daemon
  (tambien el PATCH del estado). los archivos dejan `RESERVA` 4 por minuto para los comentarios.
- **403/429 de limite**: respeta `retry-after`; secundario sin retry-after = 60 s. frena **todas** las
  escrituras, tambien las de otros procesos (`.buzon-freno.json`). nada se pierde: queda en la cola.
- **409/422** (sha viejo): no se reintenta en caliente; se olvida el sha y va en la proxima pasada (20 s).
- `widgets.json` solo si cambio el hash, y como mucho cada 60 s.

**web** (`limiteGithub()`, `frenar()`, `salida`):

- secundario sin `retry-after` = reintento a los 60 s. el reset de `x-ratelimit` solo vale si
  `x-ratelimit-remaining` es 0 (primario). un 403 de limite al guardar pestañas ya no se toma como
  "el token no tiene permiso".
- el mensaje que github freno **no vuelve a la caja**: queda en `salida` (localStorage `agente_salida`,
  sobrevive a recargar), el chat dice "tu mensaje quedó guardado y se manda solo en ~N s" y `tick()` lo
  manda apenas pasa el freno. con github frenado, un mensaje nuevo ni se intenta: va directo a la salida.

probar: `python3 -m recetas.prueba_buzon_403` (cero red: coalesce, tormenta, tope, 403 con y sin
retry-after, 409) y `recetas/prueba_web_tabs` (punto 12b).

## el teclado de ios no deja hueco abajo del input (facundo, 2026-09-12)

captura `IMG_8095`: con el teclado abierto en el celu quedaba una franja negra de ~150 px entre el input
y el teclado. la causa no era el `safe-area` (eso ya lo tapaba `body.teclado`, 2026-09-11) sino el
**scroll de la ventana**: al enfocar el textarea, ios safari achica el viewport visible **y ademas
scrollea la pagina entera**; el body mide el alto del viewport visible (`--alto`) y `ajustarAlto()` solo
compensaba `vv.offsetTop`, asi que lo que se habia ido en `window.scrollY` quedaba como hueco.

- **la ventana se traba**: `html` y `body` van `position:fixed` con `overflow:hidden`. lo unico que
  scrollea es `#hist`. `trabarScroll()` devuelve la ventana a `0,0` antes de cada medicion, por si ios
  la corre igual.
- **queda un solo desplazamiento por compensar**, el del viewport visible dentro del layout viewport:
  `body { transform: translateY(vv.offsetTop) }`, como antes.
- **se remide al enfocar el input** (`focus` + 120 ms + 350 ms) y en el `scroll` de la ventana, porque
  ios mueve las cosas unos frames despues de abrir el teclado.
- **lo que llega mientras escribis se ve**: `seguirAlFinal()` (= `pegadoAbajo()` o el input enfocado)
  reemplaza a `pegadoAbajo()` en las **llegadas** (comentarios y `chat/<tema>.json`). con el teclado
  abierto el alto de `#hist` cambia y la respuesta quedaba pintada fuera de pantalla (la de las 17:09
  "tardo 2 minutos en aparecer"). scrollear para leer lo viejo cierra el teclado, asi que esto no pisa
  la lectura. el poll nunca se pausaba por el foco: eso ya estaba bien.
- **prueba**: `recetas/prueba_web_tabs` punto 14b. `visualViewport` no se puede falsear en headless, asi
  que se stubea (`window.__agente.stubVV({height, offsetTop})`) y `viewportInfo()` devuelve `sobra`, los
  px entre el borde de abajo del `#pie` y el borde de abajo del viewport visible: tiene que dar 0.

## selector de nodos: SERVER | MBP | NUBE (facundo, 2026-09-12)

arriba a la izquierda de la barra (antes del toggle `chat | widgets` y del `[⚙]` del board, donde vive `salir`) hay tres botones,
uno por maquina donde puede vivir claudio:

| nodo | que es | hoy |
|---|---|---|
| `SERVER` | la geekom (`claudio`), la **main** | ahi corre el daemon |
| `MBP` | la macbook de facundo | daemon apagado, de respaldo |
| `NUBE` | tercer nodo online | **no existe**: se pinta gris, "sin configurar" |

- **los datos salen de `widgets.json`**, clave `nodos`, que arma `recetas/nodos.py` (cero tokens, y la
  mac se consulta por ssh **cacheada 120 s**, no en cada repintado). cada nodo trae `estado`, `nivel`
  (`bien` / `medio` / `mal` / `gris`, la lucecita), ultima señal, pid, cola, cuenta de claude y su uso.
- **el nodo de guardia va marcado** (`◉` y borde verde): es el unico que publica en el buzon, o sea con
  el que habla la web. la marca es `.guardia-server` y la mueve `~/.claudio/server/guardia.sh`.
- **tocar un nodo abre el modal de siempre** con dos acciones: `revivir` (reinicia el daemon de ESE
  nodo) y `poner de guardia` (solo si no lo esta). los dos salen como **comando crudo** (`revivir mbp`,
  `guardia server`) y los atiende el daemon **sin modelo** (`es_cmd_nodos` / `nodos_cmd`).
- **revivir el server no corta ninguna tarea**: pasa por `pedir_reinicio` (diferido). si el daemon esta
  muerto, va por `systemctl --user restart` o por el kit de rescate del puerto 8899.
- **pasar la guardia a la mac se hace diferido y en otro proceso**: `guardia.sh mac` para el daemon que
  esta contestando el chat; si se hiciera en linea, la respuesta nunca saldria. y no se suelta la
  guardia si la mac no contesta.
- probar: `python3 -m recetas.prueba_nodos` (cero tokens) y el bloque de nodos de
  `recetas/prueba_web_tabs` (desktop y celu).

## las pruebas web piden un puerto libre (2026-09-12)

`recetas/prueba_web`, `prueba_web_tabs`, `prueba_web_audio` y `prueba_web_color` tenian el puerto de
depuracion escrito a mano (9333 / 9334 / 9337 / 9336). si otro chrome ya lo estaba escuchando (el del
server, una pestaña de login abierta) la prueba moria con `no arranco chrome` **sin decir por que**, y
la web quedaba sin forma de verificarse. ahora lo piden con `cdp.puerto_libre(<preferido>)` (usa el
preferido si esta libre, si no uno efimero) y el error dice el puerto.

## widget `que ver` (facundo, 2026-09-12)

"5 opciones de que ver con source (plex, youtube, disney+, amazon prime, flow, hbomax, todas mis
cuentas!). idealmente el widget deberia llevarme al contenido".

- lo arma `recetas/que_ver.py` (cero tokens, cero modelo) y viaja en `widgets.json` como clave
  `que_ver`. **cache de 30 min**: el refresco del panel no sale a preguntarle nada a nadie, solo el
  `[↻]` del header (o `que ver fresco` en el chat) vuelve a mirar las fuentes.
- **como entra a las cuentas: sin chrome.** las cookies del perfil `orugote` de la mac viajan en
  `secretos/google-cookies.json` y se usan con urllib pelado. hoy andan **youtube** (lo nuevo de tus
  suscripciones y lo que dejaste a medias) y **prime video** (tu watchlist, por la sesion de
  `amazon.com`). **plex, disney+, hbo max y flow no viajan**: atan la sesion a tokens de
  localStorage, no a cookies, asi que necesitan un login por vnc en el chrome del server
  (`ver-chrome.sh`). la fuente que falta **nunca frena al widget**: se salta y se dice cual.
- **cada fila lleva al contenido**: `watch?v=` de youtube y `primevideo.com/detail/<asin>`, que en el
  celu abren la app. tocar la fila abre el modal a/b/c: **abrir**, **otra de esta fuente**
  (`que ver otra prime`) y **no me interesa** (`que ver no <id>`, queda en `.que_ver-descartes.json`
  y no vuelve a salir). los dos ultimos son **comandos crudos que contesta el daemon sin modelo**
  (`es_cmd_que_ver` / `que_ver_cmd`), igual que `dale N` y `op N X`.
- settings del `[⚙]`: las dos comunes (plegado, filas) mas **fuentes** (solo una, o todas),
  **cuantas por fuente** (1/2/3), **solo lo nuevo** y "avisar que fuente falta". se resuelven en la
  web sobre `candidatos` (todo lo que trajo la receta), asi que cambiar una no vuelve a pedir nada.
- en el chat, sin gastar un token: `que ver`, `que ver fresco`, `que ver otra <fuente>`,
  `que ver no <n>`, `que ver login` (que falta loguear y donde).
- probar: `python3 -m recetas.prueba_que_ver` (cero tokens, cero red) y el bloque `que ver` de
  `recetas/prueba_web_tabs`.

## escribir desde un widget: `[✎]` (facundo, 2026-09-12)

"los widgets tienen que tener una opcion que sea escribir, asi te puedo decir algo ahi y ya tenes el contexto".

- **header**: `[✎]` a la izquierda de `[↻]` y `[⚙]`. lleva a la pestaña del tema del widget (`TEMA_WIDGET`:
  `server` -> server, `usage`/`agent`/`avisos`/`propuestas` -> tools, `tickets` -> awtomic, `verificaciones` ->
  awtomic/qa, `podcast` -> podcast, `dj`/`mail` -> fuzzer, `que_ver` -> personal; lo que no esta, tools) y deja
  `> widget <nombre>: <dato esencial del header>` + linea vacia, cursor al final. **no manda nada**. tocarlo de
  nuevo no apila otra cita.
- **modal de una fila**: ultima accion `escribir sobre esto`, a la pestaña del tema del item, con
  `> widget <nombre> / <titulo de la fila>: <cuerpo en una linea, 300 chars>`.
- en el celu pasa sola a la vista chat.
- **daemon**: la cita `>` la separa `marcas_chat` (la misma de `responder`), queda como `cita` en
  `logs/chat-<tema>.jsonl` y al modelo le llega como "desde que widget escribe", no como parte del pedido.
- pruebas: `recetas/prueba_web_tabs` (`tocarHeader(clave, 'esc')`, `headers()[i].escribir`) y
  `recetas/prueba_chat_tema`.

## notificaciones push al iphone, con badge (facundo, 2026-09-12)

cada aviso de `avisos.md` y cada respuesta del chat llegan como **notificacion real** a la pantalla del
celu, con el numero en el icono.

- **paso unico de facundo**: abrir el board **desde el icono de inicio** (compartir > agregar a inicio en
  safari) y tocar **`notificaciones`** en `[⚙]` settings del board (el widget `avisos` se saco en la 1163:
  los avisos van por la tira de notificaciones). ios 16.4+ solo manda push a la pwa de inicio y solo pide permiso dentro de un toque.
  en safari a secas el boton dice "agregá a inicio para activar".
- **web**: `sw.js` (sin cache, `VERSION` la reescribe `bump_web`) muestra la notificacion, pone el badge con
  `setAppBadge(n)` y al tocarla abre `./?tema=<tema>` (o le avisa a la ventana abierta). `activarPush()`
  pide permiso, se suscribe con la clave vapid publica de `widgets.json` (clave `push`) y publica
  `push/<hash del endpoint>.json` en el buzon (`{endpoint, keys, dispositivo, ua, ts}`), uno por dispositivo.
  al abrir o volver al foco `pushVisto()` limpia el badge y deja `push_leido` (ms) en `tabs.json`.
- **daemon**: `push_al_toque()` (hilo, nunca frena) en `despachar_avisos` (titulo `aviso`) y en
  `chat_guardar` (titulo `[tema]`, cuerpo 120 chars; un mensaje partido suena una vez). por abajo,
  `recetas/push.py`: claves en `secretos/vapid.json` (600), cifrado aes128gcm + jwt es256 con
  `cryptography` (el daemon corre con `/usr/bin/python3`; `pywebpush` esta en el venv y la prueba lo usa
  para validar el cifrado). badge = pushes desde el ultimo `push_leido`.
- **guards**: una suscripcion que contesta 404/410 se borra sola del buzon (DELETE con sha, respeta el
  freno del escritor); sin suscripciones no se manda nada y el aviso sigue por buzon/telegram; github o
  apple caidos quedan en `log.md` y no rompen nada.
- **cli**: `python3 -m recetas.push listar | clave | mandar "<texto>" [--tema x] [--badge n] | probar`
  (`probar` manda un push REAL y lo anota en `log.md`).
- **pruebas**: `python3 -m recetas.prueba_push` (sin red, suscripcion falsa, 410, badge) y el bloque push de
  `recetas/prueba_web_tabs` (sw registrado, boton, safari sin pwa, flujo simulado, sin errores).

## estado en vivo, una sola respuesta y nodo en el header (facundo, 2026-09-13)

"quiero ida y vuelta casi instantanea, ver que pasa mientras espero, una sola respuesta por mensaje y ver en el
header que nodo y que modelo contesto". el criterio del daemon esta en `recetas/chat_estado.py` (cero tokens).

- **una sola respuesta**: el server recien reiniciado arrancaba con el lock `chat.json` en `libre` sin haberlo
  leido y contestaba lo mismo que cloud (13:00). ahora `atiendo_chat` lo lee antes de decidir
  (`chat_nodo.atiendo_con_lock`), el server retoma con relevo si lo ultimo que vio era un lock ajeno, y el hilo
  del chat vuelve a mirar el lock antes del modelo y antes de publicar: si el chat paso a otro nodo, la respuesta
  se suelta (`chat: suelto la respuesta` en `log.md`). en la web, `sinDobles()` esconde la repetida: dos
  respuestas al mismo mensaje, mismo `[tema]`, menos de 3 min, y una de `cloud` -> se ve solo la de cloud.
- **nodo en el header**: el daemon manda `<!--agente-->` + `<!--nodo:cloud modelo:fable dur:12
  cuello:modelo-->` + el cuerpo. `leerMeta()` lo saca del cuerpo (tambien el `[cloud]` viejo) y el header queda
  `claudio · 12:46 · cloud` (facundo, 2026-09-13: el modelo viaja en el json pero **no se pinta**). en `chat/<tema>.json` las filas nuevas traen `nodo`, `modelo`, `duracion_s` y
  `cuello`; una fila vieja sin `nodo` no pinta nada.
- **mini estado**: antes del `[▶]`, en gris, `12 s · modelo` = ida y vuelta real (desde que github creo el
  comentario hasta que sale la respuesta) y la fase mas lenta (`cola`, `audio`, `historial`, `oauth`, `modelo`,
  `buzón`).
- **en vuelo**: al mandar, abajo del mensaje aparece `claudio · hh:mm` con un spinner `- \ | /` (120 ms), la fase y
  la cuenta regresiva hasta la **respuesta completa** (`~8 s`, `~7 s`... y `+3 s` si se paso del estimado, contada
  desde `ts_inicio`). la fase la publica el daemon en `chat/estado-<clave>.json` (`{fase, palabra, ts, ts_inicio,
  eta_respuesta_s, eta_s, canal, tema, nodo}`; clave = tema del prefijo `tema x:` o `auto`) y la web la mira cada 1 s solo mientras hay
  un mensaje en vuelo (los comentarios pasan a 3 s). fases: `recibido`, `audio`, `clasificando`, `cuenta`,
  `historial`, `modelo` (dice `fable` / `opus`), `guardando`, `listo`, `sin claude`; una fase nueva sin palabra se
  registra sola. el estado lo sube **solo el nodo que atiende el chat**, coalescido (una subida cada 1,5 s como
  mucho) y respetando el freno y el tope del buzon. `eta_respuesta_s` = promedio del `duracion_s` de los ultimos 20
  intercambios del mismo canal, nodo y modelo en `logs/chat-*.jsonl` (`chat_estado.eta_respuesta`; sin muestras cae
  a canal + nodo y a canal), reestimado cuando la fase `modelo` dice el modelo real. el bloque se va cuando llega la respuesta, o 15 s despues de `listo`.
- probar: `python3 -m recetas.chat_estado --probar`, `python3 -m recetas.chat_nodo --probar` y los bloques
  `estado en vivo` de `recetas/prueba_web_tabs`.

## pwa de escritorio sin barra de titulo (facundo, 2026-09-13)

- `manifest.json` pide `"display_override": ["window-controls-overlay", "standalone"]`: la app instalada en la
  mac esconde la barra de titulo y la fila `SERVER MAC CLOUD` sube a esa franja (`env(titlebar-area-*)`, con
  fallback a 0), al lado de los semaforos. la barra arrastra la ventana (`-webkit-app-region: drag`); botones
  y pestañas no (`no-drag`). en el celu y en el navegador comun no hay overlay y todo queda igual.
- `salir` salio de la barra: vive en el `[⚙]` del board (ultimo boton de la barra), con la misma confirmacion
  en rojo (`borrar token?`, 4 s para el segundo toque).
- una app ya instalada toma el manifest nuevo sola en unas horas; si no, se reinstala desde chrome (menu ⋮ >
  instalar claudio board). chrome tambien deja volver a la barra clasica con el chevron de la franja.

## lan primero, el buzón de respaldo (facundo, 2026-09-13)

"siempre que haya una comunicación que sea en lan, intentar hacerla por lan primero. ejemplo, envío una
screenshot, eso no debería viajar por internet al pedo si se puede evitar". antes todo (mensaje, foto, audio,
respuesta, widgets) iba mac -> github -> server -> github -> mac con las dos máquinas en la misma red.

**el endpoint** (`recetas/chat_lan.py`, adentro del daemon del server, puerto `8781`, en `127.0.0.1` y en la
ip `192.168.x`): `GET /ping`, `GET /repos/<repo>/contents/...` (widgets, `chat/<tema>.json` y
`chat/estado-*.json` salen de lo que el daemon ya tiene; lo demás por proxy al buzón con cache y etag
compartidos), `GET /repos/<repo>/issues/1[/comments]` (proxy), `GET /img/...` y `/audio/...` (del disco si
llegaron por la lan), `POST /subir?ruta=img/...` (bytes crudos), `POST /msg` (`{body, lid}` o multipart con
`adjunto`), y el board mismo en `/` sin auth. todo lo demás pide `Authorization: Bearer <token de github>`,
verificado una vez contra `/user` (hash cacheado 12 h, nunca el token). cors `*` + `allow-private-network`.

**la web** prueba al cargar, en cada sync y cada 60 s (1 s por candidato): el https de `tailscale serve`
(`https://claudio.taile8a6a7.ts.net`, más los `lan.endpoints` que anuncia `widgets.json`) y, si se abrió por
http desde el server (`http://192.168.1.80:8781/`), ese mismo origen. el http de la lan **no** se prueba desde
github pages: es mixed content y el navegador lo bloquea. si contesta, `api()` manda por ahí el poll
(comentarios, estado, widgets, chat), el envío, la subida de fotos y audios (`subirBuzon`, bytes sin base64) y
la bajada de imágenes (`bajarBlob`). la barra de arriba dice **`lan`** (verde: directo o tailscale por la lan),
**`tailscale`** (verde: tailscale por derp) o **`buzón`** (gris).

**sin perder mensajes**: si una llamada por la lan falla, `lanPoner(null)` y la misma llamada sale por github en
el acto. un POST que cae al buzón lleva `<!--lan:<lid>-->`: si el endpoint alcanzó a atenderlo, el daemon ve el
lid y no lo contesta dos veces. del lado del server, `/msg` escribe `tmp/lan/salida/<t>-<lid>.json` **antes**
de contestar 201; si este nodo atiende el chat lo contesta ya, y el hilo de salida publica el comentario en el
buzón en background con `<!--lan:<lid> atendido:server-->` (así el otro dispositivo y cloud lo ven y
`iface_web_ok` / `respaldo_chat` no lo contestan). si el chat está en cloud, sale sin `atendido` y **después**
de subir sus adjuntos. la marca no se pinta (`RE_LAN_MARCA`) y el mensaje que salió por la lan no se duplica
con su copia del buzón (`lanMsgs`). la cola sobrevive reinicios.

**lo que falta de facundo**: el tailnet no da certificados (`tailscale cert`: "does not support getting TLS
certs"). hasta prender **HTTPS Certificates** en `login.tailscale.com/admin/dns`, desde github pages el board
sigue por el buzón; el script `chat_lan` (cada 10 min) engancha `tailscale serve` solo apenas se pueda (por
`cambio_sistema`, con revert) y deja un único aviso mientras falta.

probar: `python3 -m recetas.prueba_chat_lan` (el endpoint real con github falso) y el bloque `lan` de
`recetas/prueba_web_tabs` (endpoint vivo, caído y de vuelta). estado: `python3 -m recetas.chat_lan --estado`.

## nombres, input y cajas a/b/c (facundo, 2026-09-13)

- **nombres que se ven**: el agente es `claudio` y facundo es `f` (en verde), en la cabecera de cada mensaje, el
  historial del buzon, el `f>` del input y la cita de `responder` (`> f: ...`). las claves del jsonl y del buzon
  no cambian (`QUIEN_F` / `QUIEN_AGENTE` en `index.html`). la tui pinta `f` en verde igual.
- **fila del input**: `f>`, la caja y los tres iconos centrados a la misma altura (`align-items:center`); la
  caja y el pie sin borde ni fondo propio. iconos svg de linea (`.ico`, 18 px, caja de 32 px y 40 px en el
  celu): microfono (tap and hold, rojo mientras graba), camara (foto o galeria) y avion de papel (mandar). ids y
  handlers de siempre (`grabar`, `camara`, `foto`, `mandar`).
- **cajas a/b/c**: el chat del daemon cierra con `OPCION A: ...` / `OPCION B: ...` / `OPCION C: ...` (1 a 3
  lineas) cuando necesita algo de facundo. A = lo que haria claudio (verde), B = la segura (celeste), C = la
  transgresora (fucsia); el texto nunca dice cual recomienda. el daemon las guarda en el jsonl y en
  `chat/<tema>.json` como `opciones: [{letra, texto}]` (`opciones_de` en `daemon.py`); la web usa ese campo o
  parsea las lineas del comentario (`opcionesDe`), y no las pinta como texto.
  - sin elegir: fondo negro, letra y borde del color. elegida: fondo del color, letra negra.
  - **un toque manda** (1202, reemplaza al "primer tap elige, segundo manda"): el tap sobre una caja de una
    respuesta que todavia no tiene ninguna marca **manda** `A: <texto>` como mensaje normal de la pestaña (con
    su `tema x:`) y la caja queda marcada, con estado persistente. si el mensaje nombra una oportunidad (`op N`)
    con opciones reales en `widgets.json`, las cajas mandan `op N X` crudo (varias: una por linea, el daemon
    corre todas).
  - **con una marca, el toque no manda: pregunta adentro de esa misma caja** (1202, `opcConf[clave]`), y la
    pregunta le tapa el texto a la caja tocada (`.opc.conf`, spans `.cf .q` / `.si` / `.no`):
    - **la ya marcada** -> `revertir?`. `sí` la desmarca (solo esa letra: si habia dos sumadas, la otra queda) y
      manda `me arrepentí: <letra>: <texto>` con la cita. `no` deja todo como estaba y no manda nada.
    - **otra distinta** -> `sumo esta también?`. `sí` la marca y manda **un solo mensaje** `A y C: <texto a> /
      <texto c>` (el formato que ya entiende `opciones_de` del daemon). con `op N X` sale solo el comando nuevo.
    - la confirmacion es **un tap simple** (con teclado, enter sobre esa caja = `sí`); tocar otra opcion mueve la
      pregunta a esa sin mandar nada, y un cambio de estado que llega de otro dispositivo la cancela.
    - ya **no hay** boton `mandar`, ni envio solo a los 2 s, ni doble tap: se sacaron `OPC_AUTO_MS`,
      `OPC_DOBLE_MS`, `opcSel`, `opcTimer` y `botonMandar`. una caja marcada nunca queda `disabled`
      (`aria-pressed`), porque siempre se puede tocar para revertir o sumar.
  - **no vencen** (1168): mandar un mensaje ya no cierra las cajas de antes. solo queda hecha la tocada, o la mas
    reciente si facundo escribe la letra (`A`, `A: ...`). tocar una caja que no es la ultima manda la cita
    `> claudio hh:mm: <titulo o 2 lineas>` + linea vacia (`citaCaja`), que `marcas_chat` separa del pedido.
    la cita va sin el `[tema]` de la respuesta; `citaEsDe` igual acepta una con `[tema]` adelante (mensajes viejos).
  - **me arrepenti** (1169, la interaccion la cambio 1202: ahora sale del `revertir?` confirmado)
    manda `me arrepentí: <letra>: <texto>` con la cita. el daemon (`arrepentido_cmd`) cancela sin modelo las
    ordenes de esa opcion que siguen `[ ]` (las busca en `logs/opcion-orden.jsonl`, que anota cada `ORDEN:` que salio
    de un `A: ...`); si ya corren o terminaron, pasa al chat con el estado para charlarlo.
  - drag o scroll por encima no elige: `pointerdown`/`pointerup` con umbral de 10 px (`OPC_UMBRAL`).
  - **hora de envio al lado de cada marca** (1203): una caja marcada muestra a la derecha de su texto un `hh:mm`
    chiquito (`.hh`, 9 px) con la hora de **buenos aires** (`hhmmBA`, `Intl` con `America/Argentina/Buenos_Aires`,
    no la del dispositivo; si el navegador no tiene esa zona cae a la local) del mensaje que salio al tocarla.
    **cada letra lleva la suya**: al sumar (`A y C`, un solo mensaje) la que ya estaba conserva la hora de su
    toque y la nueva se lleva la de ahora (`conHoras`). mientras la caja pregunta (`revertir?` / `sumo esta
    también?`) la hora queda tapada, y al desmarcar (revertir confirmado) se borra con la marca.
  - estado: `localStorage.agente_opciones` = `{clave: {l, ts, g, h}}` de este dispositivo (`h` = `{letra: ms}`,
    las horas de 1203, solo de las letras marcadas y solo fechas de verdad: un `ts` de fallback no es una hora); en los otros se deduce de los
    mensajes de f (`estadoDeducido`: letra sin cita = la caja mas reciente, con cita = la de esa respuesta,
    `me arrepentí` la reabre). gana el mas nuevo, con sus horas. facundo siempre puede contestar escribiendo.
    **la hora viaja sola entre dispositivos**: sale del `iso` del mensaje que eligio esa caja (desde 1194 es
    cuando facundo apreto enviar), asi que el celu y la compu muestran el mismo `hh:mm` sin sincronizar nada.
  - **purga de 24 h** (1212): `g` es cuando se guardo en este dispositivo (`ts` sigue siendo la precedencia contra
    lo deducido). cada vez que se pinta una respuesta nueva con cajas, `purgarOpc()` tira de `agente_opciones` lo
    guardado hace mas de 24 h (`OPC_VIDA_MS`) y toda clave o valor invalido (no string, letras fuera de `ABC`,
    basura de versiones viejas). una entrada sin `g` (formato viejo) no se tira: se migra con la fecha de hoy y
    conserva su `ts`, asi sigue perdiendo contra lo deducido. la purga se escribe en `localStorage` solo si cambio.
  - **sin automarcado** (1211): la clave de una caja es de esa respuesta y no cambia (`claveCajas`): comentario =
    su id de github, historial = `r:<tema>|<ts_llegada>|<hashTexto>` (`m.clave`, lo pone `recibirChat`). antes el
    historial usaba el id por posicion (`h:tools-199:r`) y la marca guardada saltaba a la respuesta nueva cuando
    entraba una fila. `RE_CLAVE_OK` hace que `purgarOpc` tire las claves `h:...`. una letra sin cita marca solo
    la caja mas reciente que ya existia cuando facundo mando (`cajaAlMandar`, por hora de envio); con cita, la de
    esa respuesta (`citaEsDe`). caso en `prueba_web_tabs`: respuesta nueva con opciones de texto identico, ninguna
    caja marcada aunque la anterior tenga la C.
  - lo prueba `recetas/prueba_web_tabs` (pinta, drag que no elige, el primer tap manda y marca, `revertir?` con
    `no` que no manda y `sí` que manda `me arrepentí`, `sumo esta también?` con el mensaje unico `A y B: ...`,
    revertir una de dos sumadas, tocar otra mientras una pregunta, caja vieja viva tras 3 mensajes con su cita,
    deduccion en otro dispositivo, purga de 24 h y de claves invalidas al llegar una respuesta con cajas,
    y las de 1203: sin marcar no hay hora, al tocar sale el `hh:mm` de BA y se guarda en `localStorage`, al
    sumar cada caja conserva la hora de su mensaje, mientras pregunta la hora se tapa, revertir la borra,
    en otro dispositivo sale del mensaje, y las horas invalidas o de letras no marcadas se tiran).
    capturas de los cuatro estados (sin elegir, marcada, `revertir?`, `sumo esta también?`) en desktop y celu:
    `tmp/capturas-1202/` (1202) y `tmp/capturas-1203/` (con la hora), las sacan `tmp/capturas_1202.py` y
    `tmp/capturas_1203.py` (cero tokens, api stubbeada).

## notificaciones: la tira muestra solo el ultimo aviso (facundo, 2026-09-13, orden 1170)

- debajo de las pestañas, **una sola linea**: el aviso sin leer mas nuevo (luz, hora y primeras palabras). nada de
  `+N más`, desplegar ni `cerrar todas` ("leer mas no, solo la ultima. y que se pueda cerrar").
- **`x` a la derecha** (`.nx`, `data-notix`, 40 px de area tactil): marca leido ese aviso (`avLeidos`, viaja en
  `tabs.json`) y la tira pasa al siguiente sin leer; sin mas, se esconde. tocar el texto abre el detalle con
  `responder` / `cerrar sin responder`, igual que en la 1162.
- la lista completa de no leidas vive solo en la campanita del header (1166).
- lo prueba `recetas/prueba_web_tabs` (5 avisos: se ve solo el mas nuevo, la `x` pasa al siguiente sin abrir el
  detalle, area de toque en el celu).

## campana, persona y `x` de widgets (facundo, 2026-09-13, orden 1166)

- **campana** (`#campana`, a la izquierda de la persona): badge chiquito con las no leidas y fondo del color de la peor
  (rojo error, naranja problema, amarillo advertencia, verde ok, gris info). tocarla abre `#nlista`: solo las no leidas,
  la mas nueva arriba, cada fila con circulito, hora, texto, `responder` y `×`; abajo `cerrar todas`. las leidas son las
  mismas `avisos_leidos` de `tabs.json`. la tira `#notis` usa el mismo circulito. el nivel viene en `notificaciones[].nivel`.
- **persona** (`#persona`, reemplaza a `[⚙]`): menu con la cuenta en uso (`usage.reparto`), `cuenta <x>` / `cuenta auto`
  (comando crudo, sin modelo), `settings del board` (push y widgets ocultos), `reinicia` y `salir` con confirmacion.
- **widgets**: iconos del header a 17 px (20 px con 40 px de area en celu) y `×` que oculta la caja; vuelve con `mostrar`
  desde settings del board o desde el pie.
- **via**: ya no hay cartel en el header; el menu del nodo server dice `habla por: lan|tailscale|buzón`.
- se prueba en `prueba_web_tabs` (bloque 1166) y el nivel en `prueba_web` y `daemon.py --prueba`.

## tonos de fondo (facundo, 2026-09-13, ordenes 1188 y 1190)

sin bordes y con **look plano**: chat, panel de widgets y cajas casi del mismo tono, la diferencia
justa para distinguir el panel. los tonos salen de variables css en `:root` de `web/index.html`,
no de hex sueltos:

| variable | nivel | quien lo usa | hoy |
|---|---|---|---|
| `--fondo-chat` | 0 | `#panel-chat` | `#000000` |
| `--fondo-panel` | 1 | `#panel-widgets`, `#notis`, `#sync` | `#040404` |
| `--fondo-caja` | 2 | `.caja`, pestaña activa | `#080808` |
| `--fondo-hundido` | 3 | pista de las barras de `usage` | `#0b0b0b` |

**para ajustar el contraste se toca `--tono-paso`** (hoy `1.5%`: cuanto aclara cada nivel sobre
`--tono-base`) y los tres niveles se recalculan con `color-mix`. los hex de la tabla estan escritos
como fallback para un navegador sin `color-mix`; si se cambia `--tono-paso`, actualizar tambien esos
fallbacks. vale igual en desktop y en celu (el mismo panel ocupa toda la pantalla).

## grabando o subiendo un audio: el daemon no reinicia (facundo, 2026-09-14, orden 1204)

- mientras el microfono esta abierto o el m4a viaja, la web avisa al endpoint de la lan:
  `GET /ping?ocupado=grabando|subiendo&on=1|0` (`marcarOcupado`/`pingOcupado` en `index.html`), y lo
  **renueva cada 10 s** (`OCUPADO_RENUEVA`). `grabando` se prende en `empezarGrabacion` y se apaga en
  `soltarMicro` (el `finally` de todos los caminos del micro); `subiendo` envuelve a `mandarAudio`.
- del otro lado, `recetas/chat_lan.py` lo guarda en `tmp/lan/ocupado.json` y el daemon lo refleja en
  `daemon.json` (`web_audio`) y **difiere el reinicio** mientras dure (cambio de codigo, `reinicia`,
  watchdog). vence solo a los 30 s sin renovar y nunca frena mas de 3 min seguidos.
- sin endpoint lan (la web hablando solo por el buzon) no hay por donde avisar: el reinicio no espera.
- pruebas: `python3 -m recetas.prueba_web_audio` (graba de verdad con el microfono falso de chrome).

## drafts copiables (1240, 2026-09-14)
una respuesta del agente con bloques ``` (draft de comment de jira, slack, push o fix) los saca del cuerpo y los pinta
abajo de las cajas a/b/c como `.drafts pre` con boton `copiar` (`draftsDe`, `nodoDrafts`). un `OPCION X:` dentro de un
bloque no es caja (`opcionesDe` y `opciones_de` del daemon saltean lo cercado). prueba en `prueba_web_tabs`.

## boton copiar de un toque (1214, 2026-09-14)
en las respuestas de claudio (`m.clase === "agente"`), `ponerCopiar(b)` pone un `.cp` chico al lado de: cada link (copia
el href entero, `&` incluido), `code` con url, `code` con token o clave (`esClave`), `code` precedido por `clave:` /
`password:` / `token:` / `usuario:`..., y valores `clave: valor` en texto pelado (con numero, mayuscula o simbolo, o 8+
chars; `<clave: algo>` es un tapado de la boveda y no lleva boton). los bloques ``` siguen con su `copiar` (1240).
- un toque copia: `navigator.clipboard.writeText` dentro del click; si no esta o lo rechaza, `copiaSeleccion`
  (textarea readonly 16px + foco sin scroll + rango + `setSelectionRange` + `execCommand("copy")`, lo que pide safari ios).
  el boton dice `copiado` 1 s (`COPIADO_MS`), `no pude` si fallo.
- el rotulo va por `::after` (`data-t`), asi el textContent del mensaje no cambia. el boton lleva
  `-webkit-touch-callout:none` y `user-select:none`, cancela su `contextmenu`, y `pedirMenuMsg` no abre el menu propio
  sobre `.cp` / `.copiar`. los links siguen con `target=_blank`.
- prueba: `python3 -m recetas.prueba_web_copiar [--vivo]` (user agent de iphone, touch emulado, taps por cdp, lee el
  portapapeles; el fallback se chequea por el evento `copy` y el portapapeles).
