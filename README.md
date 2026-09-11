# agente-web

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
- el poll va al mismo ritmo que los widgets: 30 s a la vista, 120 s en background.
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
