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
- el poll va al mismo ritmo que los widgets: **10 s a la vista**, 120 s en background.
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
- **poll a 10 s a la vista** para widgets y pestañas (antes 30 s); el chat sigue en 5 s. en background
  quedan los 120 s de siempre.
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
  **mismo camino** que la camara (`imagenDe(dataTransfer)` -> `mandarFoto`). texto pegado sigue
  normal y el arrastre de pestañas no se toca (solo reacciona a `dataTransfer.types` con `Files`).
- **la foto se achica antes de subir**: canvas a `FOTO_LADO` (1600 px de lado mayor) y jpeg con
  calidad decreciente hasta entrar en `FOTO_TOPE` (2 mb). si el navegador no puede decodificarla
  (heic) y el archivo ya entra, se sube tal cual.
- **se sube al mismo repo del buzon** que `widgets.json` / `tabs.json`, por la contents api y con el
  mismo token, como `img/<hash12>-<nombre>` (hash sha-256 del contenido: la misma foto no se sube dos
  veces; un 422 se toma como "ya esta"). `fetch` propio y no `api()`: un 403 de escritura no puede
  desloguear a facundo del chat.
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

## el gap de abajo del input y la barra de flechas de ios (facundo, 2026-09-11)

> "hay un gap abajo de la línea del input y un coso de flechas con un tilde en el teclado de mac,
> pero arriba. parece venir del ios, sácalo"

- **el gap**: `#pie` reserva `env(safe-area-inset-bottom)` para el home indicator, y con el **teclado
  abierto** ios lo sigue reservando: queda una franja negra entre el input y el teclado. ahora
  `ajustarAlto()` (visualViewport) marca `body.teclado` cuando el viewport visible pierde mas de
  120 px, y `body.teclado #pie{padding-bottom:4px}` lo pega abajo. con el teclado cerrado el
  safe-area vuelve.
- **la fila de chips** ya no ocupa alto ni margen cuando esta vacia (`#chips.oculta,#chips:empty`).
- **la barra de flechas + "listo"** que aparece arriba del teclado es la **accesoria del sistema** de
  ios (el mismo teclado la pinta para cualquier campo de texto): **no se puede sacar desde una web**,
  ni en safari ni en pwa; no hay api. lo que si esta hecho: el `manifest.json` ya declara
  `display: standalone` (agregando la web a la pantalla de inicio se gana la barra de safari, no la
  del teclado), y el textarea va con `enterkeyhint="enter"`, `inputmode="text"` y `autocomplete="off"`
  para que el teclado no sume nada mas (autocorreccion y mayusculas de oracion quedan **prendidas** a
  proposito: no tienen nada que ver con esa barra y facundo escribe mejor con ellas).

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
dedo y el mouse): apretado graba y el boton late en rojo con el reloj al lado, soltar manda, arrastrar
el dedo afuera cancela y un toque de menos de `AUDIO_MIN_MS` (600 ms) no manda nada. el formato lo
elige el navegador entre `MIMES` (opus en webm donde se puede, mp4 en safari) a 24 kbps. el archivo se
sube al **mismo repo del buzon** que las fotos (`audio/<hash>.<ext>`, contents api, mismo token,
`subirBuzon`) y sale como un mensaje normal de la pestaña activa con su `tema x:` y el marcador
`[audio](audio/<hash>.webm)`.

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

se prueba con `python3 -m recetas.prueba_web_audio` (cero tokens, chrome headless, sin microfono: el
blob se manda a mano y la subida va contra un stub) y corre tambien dentro de `recetas/prueba_web`.

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
- **el aviso llega antes del corte**: cuando un limite de la cuenta activa pasa el 90%, el daemon deja un
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
| todos | `plegado por default`, `filas visibles` (todas / 3 / 5 / 8 / 12) | |
| `server` | | `mostrar el log` |
| `usage` | | `cuentas` (todas o una) |
| `agent` | | `mostrar la cola` |
| `my tickets` | | `filtro de estado` (los estados que hay ahora) |
| `opportunities` | | `ocultar las decididas` (saca la caja `decided`) |
| `propuestas` | | `filtro de tema` |
| `avisos` | | `solo los de hoy` |
| `podcast` | | `abierto por default` |
| `dj` | | `mostrar la cola` |

**donde viven**: en `tabs.json` del buzon, en la clave `wsets` (`{clave: {setting: valor, ts}}`),
junto al layout, los borradores y el split, con el mismo debounce. se resuelven **una por una por su
propio `ts`** (como los borradores): tocar el filtro de tickets en la compu no pisa el plegado que
dejaste en el celu. `localStorage` (`agente_tabs`) queda de cache offline.

lo prueba `recetas/prueba_web_tabs` (cero tokens): que cada caja tenga su header con los dos botones,
el dato esencial de cada una, que plegar quede guardado y viaje en `tabs.json`, que el modal liste las
settings, que filtrar y recortar filas cambie lo que se pinta, y que el `[↻]` tire el etag.

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
