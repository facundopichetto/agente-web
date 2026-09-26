// widget `gasto` del board (hasta la 2175 se llamaba `usage` y era solo CLAUDE): UNA fila por cuenta, todas de
// CONSUMO (facundo, 2026-09-20, orden 2249 {consumo}, opcion C: "el widget deja de ser de plata y pasa a ser de
// consumo: todas las filas en tokens y % de cuota, la plata solo en un renglon de total abajo"). la gramatica es
// la misma en todas: `<cuenta> <consumo> · <usado>/<cuota> <ventana>`; claude va por su `week` en % y las apis por
// su gasto de los ultimos 7 dias. 2255 {escala} (facundo, 2026-09-20, opcion A: "`100%` de `week` = usd 46"):
// todas las filas se miden contra la MISMA ventana y el MISMO denominador -- una semana, `usd 46`, que es lo que
// sale una cuenta de claude por semana --, asi que un `40%` quiere decir lo mismo en claude, gemini y mistral.
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
  function sinPlata(t){
    return String(t === null || t === undefined ? "" : t)
      .replace(/\s*[,·]?\s*(usd\s*)?\$\s?[\d.,]+[kKmM]?(\s*\/\s*(mes|dia|semana))?/g, "").trim();
  }
  var cuModal = null, cuUltimo = null, cuAbierta = null;
  function cuEstado(){ return {ultimo: cuUltimo, abierta: cuAbierta}; }
  function activa(cu){ return cu.elegida !== undefined && cu.elegida !== null ? !!cu.elegida : !!cu.activa; }
  // orden 1861 {claude} (facundo, 2026-09-17): "sacame week y fable abajo de faacuu y orugote. a la derecha del
  // titulo, ahi pone `xd xh xm to renew`". una sola linea, al lado del nombre de la cuenta, con el texto ENTERO
  // como vino del server (`renueva_txt`, de `widgets_json.w_usage`): la web no arma ni recorta ningun tiempo.
  function renuevaHtml(cu){
    return cu.renueva_txt ? '<span class="ren">' + esc(cu.renueva_txt) + "</span>" : "";
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
      (cu.sin_fable ? '\n<span class="r">sin fable en esta cuenta: sale con opus</span>' : "") +
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
        cuUltimo = {cmd: "cuenta " + cu.nombre, tema: "tools", aparte: true};   // lo lee `prueba_web_modelos`
        B.mandarAparte(cuUltimo.cmd, "tools");
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
  // la barra de gemini, la de mistral y la de una cuenta de claude son comparables a ojo: el mismo ancho es la
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
  // {fila} (facundo, 2026-09-22): la fila de `awtomic` lleva DOS barritas apiladas: arriba la de la ventana de
  // 5 h de claude (session limit) y abajo la de `week`, que queda exactamente como estaba. es la unica cuenta
  // con esa ventana a la vista, asi que es el server quien decide (manda `cinco` solo en esa fila): la web no
  // pregunta por el nombre de la cuenta ni abre otra fila. la barrita de arriba usa clases propias (`g5-*`)
  // a proposito: si reusara `.ub-p` / `.ub-lleno`, el `%` y el ancho de la fila pasarian a ser los de 5 h.
  // el `5h` chiquito en gris al lado del `%` es lo que las distingue; la de abajo va sin etiqueta. el tick de
  // ritmo si es el mismo (`tickHtml`, `.ub-tick`): el server lo manda ya medido contra la ventana de 5 h.
  function cincoHtml(l){
    var c = l.cinco;
    if(!c) return "";
    var pct = (c.pct === null || c.pct === undefined) ? 0 : Math.max(0, Math.min(100, c.pct));
    return '<span class="g5 n-' + esc(c.nivel || "sin") + '">' +
      '<span class="g5-h"></span>' +
      '<span class="g5-pista"><span class="g5-lleno" style="width:' + pct + '%"></span>' + tickHtml(c) + "</span>" +
      '<span class="g5-p">' + esc(sinPlata(c.pct_txt || "?")) + "</span>" +
      '<span class="g5-et">' + esc(c.etiqueta || "5h") + "</span></span>";
  }
  function filaGasto(l){
    var pct = (l.pct === null || l.pct === undefined) ? 0 : Math.max(0, Math.min(100, l.pct));
    // {sinpie}: el tooltip ya no lleva la plata de la semana ni el `detalle` (que la trae adentro). el ritmo
    // SI vuelve (1625 {tick}): `linea_txt` es `%` puro, no tiene un solo numero en usd.
    var tit = l.nombre + ": " + sinPlata(l.consumo_txt || "?") + " · " + sinPlata(l.sec) +
              (l.linea_txt ? "\n" + sinPlata(l.linea_txt) : "") +
              (l.extra ? "\n" + sinPlata(l.extra) : "") +
              (l.prioritaria_txt ? "\n" + sinPlata(l.prioritaria_txt) : "") +
              (l.cinco ? "\n" + sinPlata(l.cinco.detalle) +
                         (l.cinco.linea_txt ? "\n" + sinPlata(l.cinco.linea_txt) : "") : "");
    return '<div class="ub grow n-' + esc(l.nivel || "sin") + (l.agotada ? " agotada" : "") +
      (l.dormida ? " dormida" : "") + (l.sin_costo ? " sincosto" : "") + (l.tocable ? "" : " sinlim") + '" title="' + esc(tit) + '"' +
      (l.tocable ? ' data-cta="' + esc(l.nombre) + '" role="button" tabindex="0"' : "") + ">" +
      cincoHtml(l) +
      // 2100 {prioritaria}: la prioritaria del reparto (la que renueva antes) lleva la clase `pri` (un punto verde
      // por css, fuera del texto) y el porque (cuanto le falta) en el tooltip; el server decide cual es, la web solo pinta
      '<span class="ub-n nom' + (l.estado ? " e-" + esc(l.estado) : "") + (l.prioritaria ? " pri" : "") + '">' + esc(l.nombre) + "</span>" +
      '<span class="ub-pista"><span class="ub-lleno" style="width:' + pct + '%"></span>' + tickHtml(l) + "</span>" +
      '<span class="ub-p">' + esc(sinPlata(l.consumo_txt || "?")) + "</span>" +
      '<span class="ren">' + esc(sinPlata(l.sec)) + "</span>" +
      '<span class="gsec">' + esc(sinPlata(l.extra)) + "</span></div>";
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
    var html = '<div class="cmod">' + f("plan", '<span class="c">' + esc(plan) + "</span>") +
      "\n" + f("tokens del mes", esc((l.tok || 0).toLocaleString("es-AR")) +
                ' <span class="g">en ' + (l.llamadas || 0) + " llamadas</span>") +
      (l.tpd ? "\n" + f("hoy", esc(sinPlata(l.sec))) : "") +
      (l.prepago && l.prepago_pct !== null && l.prepago_pct !== undefined ?
        "\n" + f("credito prepago", l.prepago_pct + '% usado <span class="g">de donde cobra la api</span>') : "") +
      (l.fuente_txt ? "\n" + f("de donde sale", (l.falta_fuente ? '<span class="r">' : '<span class="c">') +
                               esc(sinPlata(l.fuente_txt)) + "</span>" +
                               (l.real_periodo ? ' <span class="g">' + esc(l.real_periodo) + "</span>" : "")) : "") +
      (l.real_error ? '\n<span class="r">la ultima lectura fallo: ' + esc(sinPlata(l.real_error)) + "</span>" : "") +
      "</div>";
    cuAbierta = l.nombre;
    return cuModal.abrir({titulo: "cuenta " + l.nombre, cuenta: plan, html: html, botones: []});
  }
  function cajaGasto(u){
    var lineas = (u.lineas || []).slice(), html = "";
    var cuentas = (u.cuentas || []).slice();
    var soloCta = wset("gasto", "cuentas");
    if(soloCta && soloCta !== "todas"){
      lineas = lineas.filter(function(l){ return l.tipo !== "claude" || l.nombre === soloCta; });
      cuentas = cuentas.filter(function(c){ return c.nombre === soloCta; });
    }
    // lo tocable: la de claude abre el modal de la cuenta (barras, motivo, boton verde), la de api el suyo
    cuentasVistas = {}; lineasVistas = {}; lineasClaude = {};
    var porNombre = {};
    lineas.forEach(function(l){ porNombre[l.nombre] = l; if(l.tipo === "claude") lineasClaude[l.nombre] = l; });
    cuentas.forEach(function(c){
      var l = porNombre[c.nombre] || {};
      c.etiqueta = l.sin_costo ? (l.etiqueta || null) : null;
      if(!sinLimite(c)) cuentasVistas[c.nombre] = c;
    });
    lineas.forEach(function(l){ if(l.tipo !== "claude") lineasVistas[l.nombre] = l; });
    // {sinpie}: las filas y nada mas; se fueron el grafico de 7 dias y el total del mes de abajo
    if(lineas.length) html += '<div class="glin">' + lineas.map(filaGasto).join("") + "</div>";
    // {widget} (facundo, 2026-09-22): el titulo es `USAGE` y al lado no va nada (se fue la bateria)
    return caja("USAGE", "", '<div class="usage gasto">' + (html || vacio("sin datos")) + "</div>",
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
