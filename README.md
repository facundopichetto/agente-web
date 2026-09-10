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

## publicar

no se pushea a mano: se edita el clon (`~/.claudio/tools/agente/web/`), se corre
`python3 -m recetas.prueba_web` y `python3 -m recetas.prueba_autoupdate`, y se deja la marca
`touch ~/.claudio/tools/agente/.pendiente-web`. el daemon la mira en cada vuelta del loop:
bumpea, commitea, pushea y avisa "web publicada vX" una sola vez por lote.
