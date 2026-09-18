// widget `usage` del board: las barras de CLAUDE por cuenta (tocables: modal con el detalle) y el grafico de la semana.
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
  var cuentasVistas = {};
  function alTocar(ev){
    var n = ev.target.closest && ev.target.closest(".usage .cta[data-cta]");
    if(!n) return;
    ev.preventDefault(); ev.stopPropagation();
    var cu = cuentasVistas[n.getAttribute("data-cta")];
    if(cu) cuentaAbrir(cu);
  }
  document.addEventListener("click", alTocar, true);
  var USAGE_ORDEN = ["faacuu", "orugote", "facundo"];
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
  function cajaUsage(u){
    var cuentas = (u.cuentas || []).slice(), html = "";
    if(!cuentas.length && (u.barras || []).length)
      cuentas = [{nombre: "cuenta", activa: true, barras: u.barras}];
    var soloCta = wset("usage", "cuentas");
    if(soloCta && soloCta !== "todas")
      cuentas = cuentas.filter(function(c){ return c.nombre === soloCta; });
    cuentas.sort(function(x, y){
      var ix = USAGE_ORDEN.indexOf(x.nombre), iy = USAGE_ORDEN.indexOf(y.nombre);
      return (ix < 0 ? 9 : ix) - (iy < 0 ? 9 : iy);
    });
    // orden 1376/1377 (facundo, 2026-09-14): el titulo dice `CLAUDE` y al lado va solo la bateria. afuera la
    // proyeccion general, las lineas por modelo, excluidas y brecha. orden 1806 (2026-09-16): tambien afuera la
    // linea del reparto y el switch del modo: abajo del titulo van directo las dos cuentas.
    // las dos columnas: el nombre pintado por `estado` (ok verde clarito, warn amarillo, mal rojo), sin negrita
    cuentasVistas = {};
    var cols = cuentas.map(function(cu){
      // orden 1808 (facundo, 2026-09-16): la que no tiene limite que cuente va gris y no se toca
      var sinlim = sinLimite(cu);
      var est = sinlim ? "" : (cu.agotada ? "agotada" : (cu.estado || ""));
      if(!sinlim) cuentasVistas[cu.nombre] = cu;
      var cab = '<span class="cta"' + (sinlim ? "" : ' data-cta="' + esc(cu.nombre) + '" role="button" tabindex="0" title="detalle de ' + esc(cu.nombre) + '"') +
        '><span class="nom' + (est ? " e-" + esc(est) : "") + '">' + esc(cu.nombre) + "</span>" +
        (sinlim ? "" : renuevaHtml(cu)) + "</span>";
      var cuerpo;
      if(cu.sin_login){
        // sin login propio: no se repiten los numeros de la otra, pero el hueco guarda la altura de las barras
        cuerpo = USAGE_BARRAS.map(function(){ return '<div class="ub-hueco"></div>'; }).join("");
      } else {
        var bs = cu.barras || [];
        cuerpo = USAGE_BARRAS.map(function(k){
          var b = bs.filter(function(x){ return x.clave === k[0] || x.nombre === k[1]; })[0];
          return barraHtml(b || {nombre: k[1], pct: null, linea: null, nivel: "sin"});
        }).join("");
      }
      // 1915 {widgets}: `dormida` = sin 5h pero con lugar en la semana: misma opacidad que la agotada, la 5h en rojo
      return '<div class="ucol' + (cu.elegida ? " elegida" : "") + (sinlim ? " sinlim" : "") +
        (cu.agotada ? " agotada" : "") + (cu.dormida ? " dormida" : "") + '">' +
        cab + cuerpo + "</div>";
    });
    if(cols.length) html += '<div class="ucols">' + cols.join("") + "</div>";
    html += graficoSemana(u.semana);
    // al lado del titulo solo la bateria: sin numero, sin texto y sin tooltip
    return caja("CLAUDE", bateriaUso(u.bateria), '<div class="usage">' + (html || vacio("sin datos")) + "</div>",
                false, "usage");
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

  B.registrar("usage", {
    html: function(d){ return cajaUsage(d || {}); },
    pintar: function(d, nodo){ return B.reemplazar(nodo, cajaUsage(d || {})); },
    // lo que este modulo deja puesto afuera: el listener del titulo de cada cuenta y su modal. al soltarlo se sacan
    destruir: function(){
      document.removeEventListener("click", alTocar, true);
      if(cuModal){ try{ cuModal.cerrar(true); }catch(e){} var el = document.getElementById("cuentamodal"); if(el) el.remove(); }
      cuModal = null; cuUltimo = null; cuAbierta = null; cuentasVistas = {};
    },
    cuentaAbrir: cuentaAbrir, cuEstado: cuEstado
  });
})();
