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

    {"v":1, "ts":1757600000000, "origen":"ab12cd", "tabs":["tools","auto"], "paneles":["tools"], "foco":0}

- **al abrir**: primero pinta el cache de `localStorage` (instantaneo, sirve sin red) y despues lee
  `tabs.json` del repo; si el remoto es mas nuevo, se aplica.
- **cada vez que cambia algo** (abrir, cerrar, split, foco): sube el `ts`, guarda el cache y publica
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

## borrador del input continuable entre dispositivos (2026-09-11)

facundo: "quiero dejar de escribir esto desde la compu y sin tocar enviar terminar este mensaje
desde el celu". lo que hay en la caja es un **borrador por pestaña** y viaja en el mismo `tabs.json`:

    {"v":1, "ts":..., "tabs":[...], "paneles":[...], "foco":0,
     "borradores": {"tools": {"texto": "lo que venia escribiendo", "ts": 1757600000000}}}

- **se guarda al tipear**: cada tecla actualiza el borrador de la pestaña activa en memoria y en el
  cache, y encola la publicacion con debounce de 1 s (con el minimo de 8 s entre escrituras de la api).
- **se resuelve por tema, no por layout**: gana el `ts` mas nuevo de **cada** borrador. un cambio de
  pestañas hecho en la compu no se lleva puesto lo que el celu esta escribiendo, y al reves tampoco
  (`recibirBorradores()` corre siempre, gane el layout remoto o el mio).
- **al abrir, recargar o volver al foco**: la caja aparece con el borrador de la pestaña activa y el
  **cursor al final**. primero el cache de `localStorage` (instantaneo) y despues lo que traiga el buzon.
- **cambiar de pestaña** guarda lo escrito como borrador de la que se deja y trae el de la nueva
  (`cajaDeTema()`, al final de `pintarTabs()`), incluido el panel de al lado del split.
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

    {"v":1, "ts":..., "tabs":[...], "paneles":[...], "foco":0,
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
- el `foco` (que pestaña esta activa en cada panel) ya viajaba en `tabs.json` desde el dia 1: son
  `paneles` (el tema de cada panel) y `foco` (cual de los dos tiene el cursor).
- las vistas de mas de 7 dias se podan solas.

probarlo: `python3 -m recetas.prueba_web_tabs` (bloques "sincronizando" y "la vista de cada pestaña").

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

en pantalla tactil (`esTactil()`: `pointer: coarse` o ancho <= 899) **enter hace salto de linea** y el
mensaje sale solo con el boton `>_`; en desktop sigue enter = mandar, shift+enter = salto. el textarea
lleva `enterkeyhint="enter"` para que el teclado del celu muestre "intro" y no "enviar", y `ajustarCaja()`
crece con los parrafos hasta `TOPE_LINEAS` (6) o 28dvh, lo que sea menor, y ahi scrollea.
lo chequea `recetas/prueba_web_tabs` (emula touch por cdp, cero tokens).

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
- **lo calcula python, no el html**: `recetas/widgets_json.py` -> `barra()` deja `linea`, `ratio`,
  `nivel` (`ok` / `cerca` / `sobre` / `mal`) y `falta_s` en cada barra. La web solo pinta
  (`barraUso()` en `index.html`, clases `.ub`, `.ub-pista`, `.ub-lleno`, `.ub-tick`).
  La barra de `fable` sale del `weekly_scoped` de **esa** cuenta, no del plan global.
- tocar el nombre de una cuenta abre el modal de siempre, ahora con `linea` y `reset en ...`.
- se prueba con `python3 -m recetas.prueba_web_tabs` (cero tokens): seis barras, el ancho es el `%`,
  el tick esta en la linea, los tres colores, y que entre sin scroll horizontal.
