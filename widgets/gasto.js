// widget `gasto` del board (hasta la 2175 se llamaba `usage` y era solo CLAUDE): UNA fila por cuenta, todas de
// CONSUMO (facundo, 2026-09-20, orden 2249 {consumo}, opcion C: "el widget deja de ser de plata y pasa a ser de
// consumo: todas las filas en tokens y % de cuota, la plata solo en un renglon de total abajo"). la gramatica es
// la misma en todas: `<cuenta> <consumo> · <usado>/<cuota> <ventana>`; claude va por su `week` en % y las apis por
// su gasto de los ultimos 7 dias. 2255 {escala} (facundo, 2026-09-20, opcion A: "`100%` de `week` = usd 46"):
// todas las filas se miden contra la MISMA ventana y el MISMO denominador -- una semana, `usd 46`, que es lo que
// sale una cuenta de claude por semana --, asi que un `40%` quiere decir lo mismo en claude y gemini.
// groq es la unica afuera: free tier, sin `%`. el consumo, la cuota y el nivel de color llegan ARMADOS del
// server (`recetas/gasto_api.py` -> `gasto.lineas`): la web no convierte nada, no arma ninguna frase y no
// inventa un denominador cuando el proveedor no publica cuota.
// tocar cualquier fila abre su modal: la de claude con sus tres barras y el boton de pasar el agente, la de api
// con el plan, los tokens y de donde sale su consumo, sin plata ({sinpie}).
// modulo de widget (orden 1793, 2026-09-16, "el board como las secciones de shopify"): el shell lo carga
// con `import()` y, cuando la pagina es `file://` (las pruebas), con un `<script>`, que es lo unico que ese
// protocolo deja. por eso el archivo NO tiene `export`: el contrato es registrarse en el shell, asi el mismo
// texto sirve de modulo ES y de script clasico. del shell solo se usa lo que expone `window.__board`.
// {sinpie} (facundo, 2026-09-22): se fue el pie entero -- el grafico de 7 dias con su linea de ritmo y el
// renglon `total del mes` --, y el widget no muestra plata en NINGUN lado, tampoco en el tooltip ni en el
// modal de una cuenta. queda la lista de cuentas con su `%`. el tick de ritmo de cada fila (1625 {tick}) SE
// QUEDA: {sinpie} se llevo la raya del pie, no la marca de adentro de cada barra, y volvio el mismo dia
// (facundo: *"te habia dicho la linea que separaba el gasto total abajo, no la de la proyeccion en las lineas
// individuales"*). el server sigue publicando `totales`, `semana` y los `usd_*` en el json: la web no los pinta.
(function(){
  var B = (typeof window !== "undefined" ? window : self).__board;
  var esc = B.esc, caja = B.caja, vacio = B.vacio, wset = B.wset;

  // orden 1806 (facundo, 2026-09-16): se fue el switch del modo de modelo y la linea del reparto: abajo del
  // titulo van directo las dos cuentas. el modo se cambia por el chat (`modelos reparto|tareas|opus|fable`).
  // tocar `faacuu` u `orugote` abre un modal con el molde (`modalMolde`, esc cierra) con el detalle de esa cuenta
  // y, solo si no es la activa, un boton verde que manda `cuenta <nombre>` (el daemon lo atiende sin modelo).
  // {sinpie}: lo que llega armado del server con un monto adentro (`free tier, $0`, `Pro $14.99/mes`) se
  // pinta sin el monto. es la unica transformacion de texto que hace la web sobre lo del server.
  // {pulida-mobile} (facundo, 2026-10-14: "textos en espanglish como to renew"): el server arma `Nd Nh Nm to renew`
  // y la web lo pinta en español corto (`renueva en Nd Nh Nm`). es la misma clase de retoque que `sinPlata`: solo
  // cambia la palabra, el tiempo sigue siendo el que armo el server.
  function renEs(t){
    return String(t).replace(/((?:\d+[dhms]\s*)+?)\s*to\s+renew\b/g, function(_, tm){ return "renueva en " + tm.trim(); });
  }
  function sinPlata(t){
    return renEs(String(t === null || t === undefined ? "" : t)
      .replace(/\s*[,·]?\s*(usd\s*)?\$\s?[\d.,]+[kKmM]?(\s*\/\s*(mes|dia|semana))?/g, "").trim());
  }
  var cuModal = null, cuUltimo = null, cuAbierta = null;
  function cuEstado(){ return {ultimo: cuUltimo, abierta: cuAbierta}; }
  function activa(cu){ return cu.elegida !== undefined && cu.elegida !== null ? !!cu.elegida : !!cu.activa; }
  // orden 1861 {claude} (facundo, 2026-09-17): "sacame week y fable abajo de faacuu y orugote. a la derecha del
  // titulo, ahi pone `xd xh xm to renew`". una sola linea, al lado del nombre de la cuenta, con el texto ENTERO
  // como vino del server (`renueva_txt`, de `widgets_json.w_usage`): la web no arma ni recorta ningun tiempo.
  function renuevaHtml(cu){
    return cu.renueva_txt ? '<span class="ren">' + esc(renEs(cu.renueva_txt)) + "</span>" : "";
  }
  function barraHtml(b){
    var h = B.barraUso(b);
    return b.oculta ? h.replace('class="ub ', 'class="ub ub-oculta ') : h;
  }
  function cuentaAbrir(cu){
    if(!cu || !B.modalMolde) return false;
    if(!cuModal) cuModal = B.modalMolde({id: "cuentamodal", z: 43, sinServer: true,
                                         alCerrar: function(){ cuAbierta = null; }});
    var esActiva = activa(cu), bs = cu.barras || [], lp = lineasClaude[cu.nombre] || {};
    var estado = cu.agotada ? '<span class="r">agotada: sin creditos hasta que renueve</span>'
               : cu.dormida ? '<span class="r">dormida: sin 5h; la semana todavia tiene lugar</span>'
               : esActiva ? '<span class="v">es la cuenta que usa el agente ahora</span>'
               : '<span class="g">no es la cuenta activa</span>';
    var html = '<div class="cmod">' + estado +
      (lp && lp.prioritaria_txt ? '\n<span class="v">' + esc(sinPlata(lp.prioritaria_txt)) + "</span>" : "") +
      (cu.excluida ? '\n<span class="r">excluida</span> <span class="g">' + esc(sinPlata(cu.motivo)) + "</span>"
                   : (cu.motivo && !esActiva ? '\n<span class="g">' + esc(sinPlata(cu.motivo)) + "</span>" : "")) +
      (cu.modelo ? '\n<span class="g">hoy sale con</span> <span class="c">' + esc(cu.modelo) + "</span>" +
                   (cu.modelo_modo ? ' <span class="g">(modo ' + esc(cu.modelo_modo) + ")</span>" : "") : "") +
      // {awtomicgasto}: la cuenta que no paga facundo dice quien la paga, y no tiene plata que mostrar
      (cu.etiqueta ? '\n<span class="g">' + esc(cu.etiqueta) + "</span>" : "") +
      // {pestanafija} (facundo, 2026-09-22): una cuenta puede no TENER fable (`awtomic`). la barra vacia no
      // lo dice, asi que lo dice la ficha: es el porque de que una pestaña fijada a fable salga con opus.
      // {color-awtomic} (facundo, 2026-10-15: "si es porque no tiene fable ya lo se, sacale el rojo"): en gris, no
      // en rojo: no tener fable es la cuenta, no una falla.
      (cu.sin_fable ? '\n<span class="g">sin fable en esta cuenta: sale con opus</span>' : "") +
      '<div class="cmod-b">' + USAGE_BARRAS.map(function(k){
        var b = bs.filter(function(x){ return x.clave === k[0] || x.nombre === k[1]; })[0];
        return barraHtml(b || {nombre: k[1], pct: null, linea: null, nivel: "sin"});
      }).join("") + "</div>" +
      (bs.some(function(b){ return b.falta_txt && !b.oculta; }) ?
        '<div class="cmod-r">' + bs.filter(function(b){ return b.falta_txt && !b.oculta; }).map(function(b){
          return '<span><span class="g">' + esc(b.nombre) + " renueva en</span> " + esc(b.falta_txt) + "</span>";
        }).join("") + "</div>" : "") + "</div>";
    var botones = [];
    if(!esActiva && !cu.sin_login){
      botones.push({tipo: "verde", txt: "pasar a " + cu.nombre, accion: function(m){
        cuUltimo = {cmd: "cuenta " + cu.nombre, tema: "flos", aparte: true};   // lo lee `prueba_web_modelos`
        B.mandarAparte(cuUltimo.cmd, "flos");
        m.estado("mandé cuenta " + cu.nombre);
        setTimeout(function(){ m.cerrar(false); }, 700);
      }});
    }
    cuAbierta = cu.nombre;
    return cuModal.abrir({titulo: "cuenta " + cu.nombre, cuenta: cu.email || "", html: html, botones: botones});
  }
  var cuentasVistas = {}, lineasVistas = {}, lineasClaude = {};   // lineasClaude: la fila del widget por cuenta (2100 {prioritaria})
  function alTocar(ev){
    var n = ev.target.closest && ev.target.closest(".gasto [data-cta]");
    if(!n) return;
    ev.preventDefault(); ev.stopPropagation();
    var k = n.getAttribute("data-cta");
    if(cuentasVistas[k]) cuentaAbrir(cuentasVistas[k]);
    else if(lineasVistas[k]) apiAbrir(lineasVistas[k]);
  }
  document.addEventListener("click", alTocar, true);
  // el orden de las cuentas lo pone el server (`gasto_api.lineas`), no la web. las tres barras siguen
  // vivas SOLO adentro del modal de una cuenta de claude (5h, week y el weekly de fable de esa cuenta).
  var USAGE_BARRAS = [["five_hour", "5h"], ["seven_day", "week"], ["fable", "fable"]];
  // orden 1808 (facundo, 2026-09-16): una cuenta sin limite que cuente (ninguna barra `week` ni `fable`
  // con numero: sin plan, sin login, sin datos de uso) se pinta en gris apagado y NO es tocable: no abre
  // el modal de detalle ni ofrece pasar el agente a ella. las otras siguen igual.
  function sinLimite(cu){
    if(cu.sin_login) return true;
    var bs = cu.barras || [];
    for(var i = 0; i < bs.length; i++){
      var b = bs[i] || {}, k = b.clave || b.nombre;
      if((k === "seven_day" || k === "week" || k === "fable") && b.pct !== null && b.pct !== undefined) return false;
    }
    return true;
  }
  // 2249 {consumo} (facundo, 2026-09-20, opcion C: "el widget deja de ser de plata y pasa a ser de consumo"):
  // la fila ya no muestra plata ni proyecta nada. UNA gramatica para todas, armada entera en el server
  // (`gasto_api.lineas`): `<cuenta>  <consumo>  ·  <ventana>` -- el `<usado>/<cuota>` del renglon se fue el
  // 2026-09-21 ("el 92%/100% es un dato que hace ruido"), queda `semana` pelado --, y en el renglon de abajo el
  // dato de esa familia (claude su `fable` y su `to renew`, una api de donde sale su cuota). la barra es el
  // `%` de la cuota ya usado (`l.pct`) y el color su nivel (`n-ok`/`n-cerca`/`n-mal`, `n-sin` sin cuota): se
  // fueron el gradiente por distancia (2182) y la plata del renglon. una fila sin
  // cuota llega con `pct: null` y `sec` diciendo por que: la web NO inventa un denominador ni una barra.
  // 2255 {escala}: el denominador de TODAS las filas es el mismo (el `100%` de una semana = `usd 46`), asi que
  // la barra de gemini y la de una cuenta de claude son comparables a ojo: el mismo ancho es la
  // misma plata. la web sigue sin convertir nada: el `%` y la escala llegan armados del server, y desde
  // {sinpie} la plata de la semana (`usd_semana_txt`) ya no se pinta ni en la ficha ni en el tooltip.
  // {awtomicgasto} (facundo, 2026-09-22): la cuenta `awtomic` (plan team, la paga awtomic) va con el molde de
  // las otras: el server la manda con `sin_costo` y la etiqueta solo para su modal; la web solo le suma la clase.
  // 1625 {tick} (facundo, 2026-09-21, y de vuelta el 2026-09-22): *"la de la fila: vuelve el tick de ritmo en
  // cada barra, ahora en la escala de la semana, sin plata en el renglon"*. marca por donde deberia ir la barra
  // a esta altura de la semana (la de esa cuenta de claude, la calendario para una api). el numero (`l.linea`) y
  // su texto (`l.linea_txt`) llegan armados del server (`gasto_api.tick_ritmo` / `tick_txt`, ninguno en usd): la
  // web no calcula ninguna fraccion. una fila sin cuota conocida (groq) llega con `linea: null` y no se pinta
  // nada: la web no inventa una marca. {fila} (facundo, 2026-09-22, segunda vuelta): la fila de `awtomic` ya
  // no es la excepcion, lleva el tick en sus DOS barritas (la de 5 h y la de week), cada una contra su ventana.
  function tickHtml(l){
    if(l.linea === null || l.linea === undefined) return "";
    var t = Number(l.linea);
    if(!isFinite(t)) return "";
    t = Math.max(0, Math.min(100, t));
    return '<span class="ub-tick" style="left:' + t + '%"></span>';
  }
  // {modelos-barras-finas} (facundo, 2026-10-15: "que el widget de models muestre todos los limites de todo lo que
  // hay, y todas las barritas pasan a ser tamano barrita chiquita; a la derecha solo cuanto falta para que
  // renueve"): cada cuenta es el nombre a la izquierda y, al lado, UNA barrita fina (4 px) por limite que TENGA --
  // en claude `5h`, `week` y `fable`; en gemini sus pozos; en groq el minuto y el dia --, todas del mismo
  // tamano. el tiempo va a la derecha, en corto (`2h 15m`, `4d 14h`), sin `to renew`, sin `%` y sin plata (el `%`
  // queda en el tooltip). un limite que la cuenta no tiene (`awtomic` sin `fable`, una ventana sin dato) NO se
  // pinta: ni barra vacia ni etiqueta.
  // {color-awtomic} (facundo, 2026-10-15: "pone los indicadores de 5h week y eso a la derecha, junto con cuando
  // renuevan" y "a los dias poneles horas en la renovacion"): la gramatica pasa a `barra | etiqueta | tiempo`, la
  // barra arranca pegada al nombre y la etiqueta va a la derecha, al lado del tiempo; y un tiempo de dias lleva
  // sus horas (`4d 14h`, antes `4d`).
  // lo que llega armado del server sigue siendo la fuente: la web solo acorta el texto del tiempo (`falta_txt`,
  // o el `reset` iso de un pozo de gemini, que es lo unico que no trae el `falta_txt`).
  function cortoSeg(s){
    if(s === null || s === undefined || !isFinite(s) || s < 0) return "";
    var m = Math.floor(s / 60), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
    if(d >= 1) return d + "d" + (h ? " " + h + "h" : "");
    m = m % 60;
    return h >= 1 ? h + "h" + (m ? " " + m + "m" : "") : m + "m";
  }
  function cortoTxt(t){   // `4d 21h 37m` -> segundos -> `4d 21h`; sin numero no hay tiempo que mostrar
    var q = /^\s*(?:(\d+)d)?\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*$/.exec(String(t || ""));
    if(!q || (q[1] === undefined && q[2] === undefined && q[3] === undefined)) return "";
    return cortoSeg((+q[1] || 0) * 86400 + (+q[2] || 0) * 3600 + (+q[3] || 0) * 60);
  }
  function cortoIso(iso){
    var t = iso ? Date.parse(iso) : NaN;
    return isFinite(t) ? cortoSeg((t - Date.now()) / 1000) : "";
  }
  function numPct(p){ return (p === null || p === undefined || !isFinite(p)) ? null : Math.max(0, Math.min(100, Number(p))); }
  // un limite: {et, pct, nivel, linea, t}. `nivel` pinta el relleno (`n-ok`/`n-cerca`/`n-sobre`/`n-mal`/`n-agotada`)
  function limiteHtml(q){
    return '<span class="gq n-' + esc(q.nivel || "sin") + '" data-lim="' + esc(q.et) + '">' +
      '<span class="gq-pista"><span class="gq-lleno" style="width:' + q.pct + '%"></span>' + tickHtml(q) + "</span>" +
      '<span class="gq-l">' + esc(q.et) + "</span>" +
      '<span class="gq-t">' + esc(q.t) + "</span></span>";
  }
  // los mismos cortes de `gasto_api.nivel_cuota` (verde, amarillo desde 70%, rojo desde 90%) para el pozo de gemini,
  // que llega con su `%` pero sin nivel propio
  function nivelPozo(p){ return p >= 90 ? "mal" : p >= 70 ? "cerca" : "ok"; }
  // los limites de una fila, en orden y SOLO los que existen. claude: las tres barras de su cuenta (`c.barras`)
  // menos la `oculta` (la 5h de una agotada); sin la cuenta, lo que traiga la fila (`cinco` y la week)
  function limitesDe(l, c){
    var out = [];
    if(l.tipo === "claude"){
      var bs = (c && c.barras) || [];
      USAGE_BARRAS.forEach(function(k){
        var b = bs.filter(function(x){ return x.clave === k[0] || x.nombre === k[1]; })[0];
        if(!b || b.oculta || numPct(b.pct) === null) return;
        out.push({et: k[1], pct: numPct(b.pct), nivel: b.nivel, linea: b.linea, t: b.falta_txt ? cortoTxt(b.falta_txt) : cortoSeg(b.falta_s)});
      });
      if(!bs.length){
        if(l.cinco && numPct(l.cinco.pct) !== null)
          out.push({et: l.cinco.etiqueta || "5h", pct: numPct(l.cinco.pct), nivel: l.cinco.nivel, linea: l.cinco.linea, t: cortoTxt(l.cinco.falta_txt)});
        if(numPct(l.pct) !== null) out.push({et: "week", pct: numPct(l.pct), nivel: l.nivel, linea: l.linea, t: ""});
      }
      return out;
    }
    if(l.pozos){   // gemini: cada pozo con su propio reset
      Object.keys(l.pozos).forEach(function(k){
        var p = l.pozos[k] || {};
        if(numPct(p.pct) !== null) out.push({et: k, pct: numPct(p.pct), nivel: nivelPozo(p.pct), linea: null, t: cortoIso(p.reset)});
      });
      return out;
    }
    if(l.cinco && numPct(l.cinco.pct) !== null)   // groq: el minuto
      out.push({et: l.cinco.etiqueta || "min", pct: numPct(l.cinco.pct), nivel: l.cinco.nivel, linea: l.cinco.linea, t: ""});
    if(numPct(l.pct) !== null)
      out.push({et: l.rotada ? "dia" : (l.ventana || "uso"), pct: numPct(l.pct), nivel: l.nivel, linea: l.cinco ? null : l.linea, t: ""});
    return out;
  }
  function filaGasto(l, c){
    var lim = limitesDe(l, c);
    // {sinpie}: el tooltip no lleva plata. el `%` de cada limite (que ya no se pinta suelto) vive aca, junto a su tiempo;
    // el ritmo SI vuelve (1625 {tick}: `linea_txt` es `%` puro) y las apis dicen de donde sale su cuota (`sec`, `extra`)
    var tit = l.nombre + lim.map(function(q){
      return "\n" + q.et + " " + Math.round(q.pct) + "%" + (q.t ? " · renueva en " + q.t : "");
    }).join("") + (l.linea_txt ? "\n" + sinPlata(l.linea_txt) : "") +
      (l.cinco && l.cinco.linea_txt ? "\n" + sinPlata(l.cinco.linea_txt) : "") +
      (l.tipo !== "claude" ? (l.sec ? "\n" + sinPlata(l.sec) : "") + (l.extra ? "\n" + sinPlata(l.extra) : "") : "") +
      (l.prioritaria_txt ? "\n" + sinPlata(l.prioritaria_txt) : "");
    return '<div class="gcu n-' + esc(l.nivel || "sin") + (l.agotada ? " agotada" : "") +
      (l.dormida ? " dormida" : "") + (l.sin_costo ? " sincosto" : "") + (l.tocable ? "" : " sinlim") + '" title="' + esc(tit) + '"' +
      (l.tocable ? ' data-cta="' + esc(l.nombre) + '" role="button" tabindex="0"' : "") + ">" +
      // 2100 {prioritaria}: la prioritaria del reparto (la que renueva antes) lleva la clase `pri` (un punto verde
      // por css, fuera del texto) y el porque (cuanto le falta) en el tooltip; el server decide cual es, la web solo pinta
      '<span class="gcu-n nom' + (l.estado ? " e-" + esc(l.estado) : "") + (l.prioritaria ? " pri" : "") + '">' + esc(l.nombre) + "</span>" +
      '<span class="gqs">' + lim.map(limiteHtml).join("") + "</span></div>";
  }
  // el modal de una cuenta de api: el plan, los tokens y de donde sale su consumo. sin boton: no hay nada que
  // cambiar desde aca (la cuenta de api no se elige, se usa cuando toca). {sinpie}: sin un solo monto -- se
  // fueron `esta semana`, `este mes`, `a precio de lista`, el credito y la alerta en dolares --; del credito
  // prepago queda solo cuanto lleva usado, en `%`.
  function apiAbrir(l){
    if(!l || !B.modalMolde) return false;
    if(!cuModal) cuModal = B.modalMolde({id: "cuentamodal", z: 43, sinServer: true,
                                         alCerrar: function(){ cuAbierta = null; }});
    var f = function(et, v){ return '<span><span class="g">' + esc(et) + "</span> " + v + "</span>"; };
    var plan = sinPlata(l.plan) || "?";
    // {groq-cuentas} (2949): una cuenta de groq de la rotacion dice su papel y sus dos topes, armados en el server
    if(l.rotada){
      var rot = '<div class="cmod">' + f("cuenta", '<span class="c">' + esc(l.cuenta || "?") + "</span>") +
        "\n" + f("ahora", esc(sinPlata(l.sec))) +
        (l.cinco ? "\n" + f("minuto", esc(l.cinco.pct_txt || "?") + ' <span class="g">' + esc(sinPlata(l.cinco.detalle)) + "</span>") : "") +
        "\n" + f("dia", esc(l.consumo_txt || "?") + ' <span class="g">' + esc(sinPlata(l.dia_txt)) + "</span>") +
        (l.motivo ? '\n<span class="r">' + esc(l.motivo) + "</span>" : "") + "</div>";
      cuAbierta = l.nombre;
      return cuModal.abrir({titulo: l.nombre + " · " + (l.cuenta || ""), cuenta: plan, html: rot, botones: []});
    }
    var html = '<div class="cmod">' + f("plan", '<span class="c">' + esc(plan) + "</span>") +
      (l.pozos && l.pozos.gemini ? "\n" + f("pozo gemini", esc(l.pozos.gemini.pct_txt || "?") + (l.pozos.gemini.resetea ? ' <span class="g">resetea ' + esc(l.pozos.gemini.resetea) + "</span>" : "")) : "") +
      (l.pozos && l.pozos.terceros ? "\n" + f("pozo terceros", esc(l.pozos.terceros.pct_txt || "?") + (l.pozos.terceros.resetea ? ' <span class="g">resetea ' + esc(l.pozos.terceros.resetea) + "</span>" : "")) : "") +
      "\n" + f("tokens del mes", esc((l.tok || 0).toLocaleString("es-AR")) +
                ' <span class="g">en ' + (l.llamadas || 0) + " llamadas</span>") +
      (l.tpd ? "\n" + f("hoy", esc(sinPlata(l.sec))) : "") +
      (!l.pozos && l.prepago && l.prepago_pct !== null && l.prepago_pct !== undefined ?
        "\n" + f("credito prepago", l.prepago_pct + '% usado <span class="g">de donde cobra la api</span>') : "") +
      (l.fuente_txt ? "\n" + f("de donde sale", (l.falta_fuente ? '<span class="r">' : '<span class="c">') +
                               esc(sinPlata(l.fuente_txt)) + "</span>" +
                               (l.real_periodo ? ' <span class="g">' + esc(l.real_periodo) + "</span>" : "")) : "") +
      (l.real_error ? '\n<span class="r">la ultima lectura fallo: ' + esc(sinPlata(l.real_error)) + "</span>" : "") +
      "</div>";
    cuAbierta = l.nombre;
    return cuModal.abrir({titulo: "cuenta " + l.nombre, cuenta: plan, html: html, botones: []});
  }
  // {limpiar}: las filas de las cadenas de modelos pasaron a su propio widget, `cadenas` (web/widgets/cadenas.js)
  function cajaGasto(u){
    // {widget-usage} (2958): la cuenta excluida llega con `oculta` (la decide el server) y no se pinta; su fila y
    // su conexion siguen en el json, asi vuelve sola cuando deja de estar excluida
    var lineas = (u.lineas || []).filter(function(l){ return !l.oculta; }), html = "";
    var cuentas = (u.cuentas || []).filter(function(c){ return !c.excluida; });
    var soloCta = wset("gasto", "cuentas");
    if(soloCta && soloCta !== "todas"){
      lineas = lineas.filter(function(l){ return l.tipo !== "claude" || l.nombre === soloCta; });
      cuentas = cuentas.filter(function(c){ return c.nombre === soloCta; });
    }
    // lo tocable: la de claude abre el modal de la cuenta (barras, motivo, boton verde), la de api el suyo
    cuentasVistas = {}; lineasVistas = {}; lineasClaude = {};
    var porNombre = {}, cuentasPorNombre = {};
    lineas.forEach(function(l){ porNombre[l.nombre] = l; if(l.tipo === "claude") lineasClaude[l.nombre] = l; });
    cuentas.forEach(function(c){
      cuentasPorNombre[c.nombre] = c;
      var l = porNombre[c.nombre] || {};
      c.etiqueta = l.sin_costo ? (l.etiqueta || null) : null;
      if(!sinLimite(c)) cuentasVistas[c.nombre] = c;
    });
    lineas.forEach(function(l){ if(l.tipo !== "claude") lineasVistas[l.nombre] = l; });
    // {sinpie}: las filas y nada mas; se fueron el grafico de 7 dias y el total del mes de abajo
    if(lineas.length) html += '<div class="glin">' + lineas.map(function(l){ return filaGasto(l, cuentasPorNombre[l.nombre]); }).join("") + "</div>";
    // {widget} (facundo, 2026-09-22): el titulo es `USAGE` y al lado no va nada (se fue la bateria)
    // {groq-cuentas} (2949): facundo lo llama `MODELS` (la caja A de la mesa, pendiente desde el 2026-10-04)
    return caja("MODELS", "", '<div class="usage gasto">' + (html || vacio("sin datos")) + "</div>",
                false, "gasto");
  }

  B.registrar("gasto", {
    html: function(d){ return cajaGasto(d || {}); },
    pintar: function(d, nodo){ return B.reemplazar(nodo, cajaGasto(d || {})); },
    // lo que este modulo deja puesto afuera: el listener del titulo de cada cuenta y su modal. al soltarlo se sacan
    destruir: function(){
      document.removeEventListener("click", alTocar, true);
      if(cuModal){ try{ cuModal.cerrar(true); }catch(e){} var el = document.getElementById("cuentamodal"); if(el) el.remove(); }
      cuModal = null; cuUltimo = null; cuAbierta = null; cuentasVistas = {}; lineasVistas = {}; lineasClaude = {};
    },
    cuentaAbrir: cuentaAbrir, apiAbrir: apiAbrir, cuEstado: cuEstado
  });
})();
