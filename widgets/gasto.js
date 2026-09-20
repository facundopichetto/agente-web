// widget `gasto` del board (hasta la 2175 se llamaba `usage` y era solo CLAUDE): UNA linea por cuenta, todas en
// dolares (facundo, 2026-09-19, opcion A: "una linea por cuenta, todas en usd, claude contra sus $200 y las de api
// contra $20 amarillo / $100 rojo"). las tres cuentas de claude leen su `%` de week como plata sobre los $200/mes
// que sale cada una, y abajo van las de api (`mistral`, `gemini`, `groq`). la plata, el nivel de color y el texto
// secundario llegan ARMADOS del server (`recetas/gasto_api.py` -> `gasto.lineas`): la web no convierte nada.
// tocar cualquier linea abre su modal: la de claude con sus tres barras y el boton de pasar el agente, la de api
// con el plan, el consumo del mes y, si la hay, la advertencia de que ese numero no sale de la facturacion real.
// modulo de widget (orden 1793, 2026-09-16, "el board como las secciones de shopify"): el shell lo carga
// con `import()` y, cuando la pagina es `file://` (las pruebas), con un `<script>`, que es lo unico que ese
// protocolo deja. por eso el archivo NO tiene `export`: el contrato es registrarse en el shell, asi el mismo
// texto sirve de modulo ES y de script clasico. del shell solo se usa lo que expone `window.__board`.
(function(){
  var B = (typeof window !== "undefined" ? window : self).__board;
  var esc = B.esc, it = B.it, caja = B.caja, vacio = B.vacio, wset = B.wset;

  // orden 1806 (facundo, 2026-09-16): se fue el switch del modo de modelo y la linea del reparto: abajo del
  // titulo van directo las dos cuentas. el modo se cambia por el chat (`modelos reparto|tareas|opus|fable`).
  // tocar `faacuu` u `orugote` abre un modal con el molde (`modalMolde`, esc cierra) con el detalle de esa cuenta
  // y, solo si no es la activa, un boton verde que manda `cuenta <nombre>` (el daemon lo atiende sin modelo).
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
    var esActiva = activa(cu), bs = cu.barras || [];
    var estado = cu.agotada ? '<span class="r">agotada: sin creditos hasta que renueve</span>'
               : cu.dormida ? '<span class="r">dormida: sin 5h; la semana todavia tiene lugar</span>'
               : esActiva ? '<span class="v">es la cuenta que usa el agente ahora</span>'
               : '<span class="g">no es la cuenta activa</span>';
    var html = '<div class="cmod">' + estado +
      (cu.excluida ? '\n<span class="r">excluida</span> <span class="g">' + esc(cu.motivo || "") + "</span>"
                   : (cu.motivo && !esActiva ? '\n<span class="g">' + esc(cu.motivo) + "</span>" : "")) +
      (cu.modelo ? '\n<span class="g">hoy sale con</span> <span class="c">' + esc(cu.modelo) + "</span>" +
                   (cu.modelo_modo ? ' <span class="g">(modo ' + esc(cu.modelo_modo) + ")</span>" : "") : "") +
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
  var cuentasVistas = {}, lineasVistas = {};
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
  // 2175 {gasto}: UNA fila por cuenta. el server manda la plata (`usd_txt`), el nivel de color y el texto
  // secundario ya armados; aca solo se pinta. la barra reusa el molde `.ub` de siempre (`.ub-n` nombre,
  // `.ub-pista`/`.ub-lleno` la barra, `.ub-p` el numero), asi el color de cada nivel es el mismo del board.
  function filaGasto(l){
    var pct = (l.pct === null || l.pct === undefined) ? 0 : Math.max(0, Math.min(100, l.pct));
    var tit = l.nombre + ": " + (l.usd_txt || "$?") + " de " + (l.tope_txt || "") +
              (l.plan ? " (" + l.plan + ")" : "") + (l.detalle ? " · " + l.detalle : "");
    return '<div class="ub grow n-' + esc(l.nivel || "sin") + (l.agotada ? " agotada" : "") +
      (l.dormida ? " dormida" : "") + (l.tocable ? "" : " sinlim") + '" title="' + esc(tit) + '"' +
      (l.tocable ? ' data-cta="' + esc(l.nombre) + '" role="button" tabindex="0"' : "") + ">" +
      '<span class="ub-n nom' + (l.estado ? " e-" + esc(l.estado) : "") + '">' + esc(l.nombre) + "</span>" +
      '<span class="ub-pista"><span class="ub-lleno" style="width:' + pct + '%"></span></span>' +
      '<span class="ub-p">' + esc(l.usd_txt || "$?") + "</span>" +
      '<span class="ren">' + esc(l.sec || "") + (l.falta_fuente ? ' <span class="g">?</span>' : "") + "</span></div>";
  }
  // el modal de una cuenta de api: el plan, lo que va del mes y de donde sale ese numero. sin boton:
  // no hay nada que cambiar desde aca (la cuenta de api no se elige, se usa cuando toca).
  function apiAbrir(l){
    if(!l || !B.modalMolde) return false;
    if(!cuModal) cuModal = B.modalMolde({id: "cuentamodal", z: 43, sinServer: true,
                                         alCerrar: function(){ cuAbierta = null; }});
    var f = function(et, v){ return '<span><span class="g">' + esc(et) + "</span> " + v + "</span>"; };
    var html = '<div class="cmod">' + f("plan", '<span class="c">' + esc(l.plan || "?") + "</span>") +
      "\n" + f("este mes", '<span class="c">' + esc(l.usd_txt || "$?") + "</span>" +
                (l.incluido ? ' <span class="g">de $' + l.incluido + " incluidos</span>" : "")) +
      "\n" + f("tokens del mes", esc((l.tok || 0).toLocaleString("es-AR")) +
                ' <span class="g">en ' + (l.llamadas || 0) + " llamadas</span>") +
      (l.tpd ? "\n" + f("hoy", esc(l.sec || "")) : "") +
      (l.credito ? "\n" + f("credito", "$" + l.credito + ' <span class="g">de free trial</span>') : "") +
      (l.alerta ? "\n" + f("alerta", "$" + l.alerta + ' <span class="g">/mes</span>') : "") +
      (l.falta_fuente ? '\n<span class="r">el numero sale de `llamadas.jsonl`, no de la facturacion real</span>' : "") +
      "</div>";
    cuAbierta = l.nombre;
    return cuModal.abrir({titulo: "cuenta " + l.nombre, cuenta: l.plan || "", html: html, botones: []});
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
    cuentasVistas = {}; lineasVistas = {};
    cuentas.forEach(function(c){ if(!sinLimite(c)) cuentasVistas[c.nombre] = c; });
    lineas.forEach(function(l){ if(l.tipo !== "claude") lineasVistas[l.nombre] = l; });
    if(lineas.length) html += '<div class="glin">' + lineas.map(filaGasto).join("") + "</div>";
    html += graficoSemana(u.semana);
    // al lado del titulo solo la bateria: sin numero, sin texto y sin tooltip
    return caja("GASTO", bateriaUso(u.bateria), '<div class="usage gasto">' + (html || vacio("sin datos")) + "</div>",
                false, "gasto");
  }

  // orden 1377: lo que QUEDA (promedio de week y fable del tanque de las dos cuentas, lo calcula widgets_json).
  // llena = verde, se vacia proporcional, con 15% o menos le aparece el borde rojo.
  function bateriaUso(b){
    if(!b || b.carga === null || b.carga === undefined) return "";
    var c = Math.max(0, Math.min(100, +b.carga || 0));
    return '<span class="ubat' + (c <= 15 ? " baja" : "") + '"><span class="ubat-c" style="width:' + c + '%"></span></span>';
  }
  // orden 1379: una barrita por dia de los ultimos 7 (uso sumado de las dos cuentas en % de un cupo) y la linea de
  // cuanto usar por dia para llegar al 100% de week en cada reset. los dias viejos son aproximados (ver uso_historial.py).
  function graficoSemana(s){
    if(!s || !(s.dias || []).length) return "";
    var mx = Math.max(+s.max || 1, 1);
    var alto = function(v){ return Math.max(0, Math.min(100, Math.round(v / mx * 100))); };
    var barras = s.dias.map(function(d){
      var sin = d.pct === null || d.pct === undefined;
      var sobre = !sin && s.linea !== null && s.linea !== undefined && d.pct > s.linea;
      return '<span class="usd' + (sin ? " sin" : "") + (sobre ? " sobre" : "") + '" style="height:' +
             (sin ? 0 : Math.max(6, alto(d.pct))) + '%"></span>';
    }).join("");
    var ln = (s.linea === null || s.linea === undefined) ? "" :
             '<span class="usem-l" style="bottom:' + alto(s.linea) + '%"></span>';
    var ets = s.dias.map(function(d){ return "<span>" + esc(d.et || "") + "</span>"; }).join("");
    return it({tipo: "cuenta", tema: "tools", d: s,
               completo: "uso por dia de las dos cuentas (% de un cupo semanal); la linea es " + s.linea +
                         "% por dia para llegar al 100% de week en cada reset" + (s.aprox ? ". los dias viejos son aproximados" : "")},
              '<div class="usem"><div class="usem-g">' + ln + barras + '</div><div class="usem-et">' + ets + "</div></div>");
  }

  B.registrar("gasto", {
    html: function(d){ return cajaGasto(d || {}); },
    pintar: function(d, nodo){ return B.reemplazar(nodo, cajaGasto(d || {})); },
    // lo que este modulo deja puesto afuera: el listener del titulo de cada cuenta y su modal. al soltarlo se sacan
    destruir: function(){
      document.removeEventListener("click", alTocar, true);
      if(cuModal){ try{ cuModal.cerrar(true); }catch(e){} var el = document.getElementById("cuentamodal"); if(el) el.remove(); }
      cuModal = null; cuUltimo = null; cuAbierta = null; cuentasVistas = {}; lineasVistas = {};
    },
    cuentaAbrir: cuentaAbrir, apiAbrir: apiAbrir, cuEstado: cuEstado
  });
})();
