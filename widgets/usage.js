// widget `usage` del board: las barras de CLAUDE por cuenta, el switch de modelo y el grafico de la semana.
// modulo de widget (orden 1793, 2026-09-16, "el board como las secciones de shopify"): el shell lo carga
// con `import()` y, cuando la pagina es `file://` (las pruebas), con un `<script>`, que es lo unico que ese
// protocolo deja. por eso el archivo NO tiene `export`: el contrato es registrarse en el shell, asi el mismo
// texto sirve de modulo ES y de script clasico. del shell solo se usa lo que expone `window.__board`.
(function(){
  var B = (typeof window !== "undefined" ? window : self).__board;
  var esc = B.esc, it = B.it, caja = B.caja, vacio = B.vacio, wset = B.wset;

  var swEspera = null, swUltimo = null, SW_ESPERA_MS = 30 * 1000;
  B.moldeSwitchReg("modelomodo", function(v){
    swEspera = {modo: v, ts: Date.now()};
    swUltimo = {cmd: "modelos " + v, tema: "tools", aparte: true};   // lo lee `prueba_web_modelos` (como `spEstado`)
    B.mandarAparte(swUltimo.cmd, "tools");
    B.repintarWidgets();
  });
  function swEstado(){ return {ultimo: swUltimo, esperando: swEspera && swEspera.modo}; }
  function swModelo(rep){
    var modo = (rep || {}).modelo_modo, d = (rep || {}).modelo || {};
    if(!modo) return "";
    // mientras el server no confirma, la posicion tocada queda puesta (y se dice): nunca un switch que no se mueve
    var esperando = swEspera && Date.now() - swEspera.ts < SW_ESPERA_MS && swEspera.modo !== modo;
    if(swEspera && swEspera.modo === modo) swEspera = null;
    var puesto = esperando ? swEspera.modo : modo;
    var filas = (d.cuentas || []).map(function(c){
      return esc(c.nombre) + " <b>" + esc(c.decision || "?") + "</b>";
    }).join(" · ");
    var carriles = ["cola", "chat", "resumen"].map(function(k){
      return (d[k] || {}).modelo ? k + " " + d[k].modelo + " en " + ((d[k] || {}).cuenta || "?") : "";
    }).filter(Boolean).join(", ");
    return '<div class="usw">' +
      B.moldeSwitch({nombre: "modelomodo", valor: puesto, aria: "modo de modelo",
                   opciones: [{valor: "reparto", title: "lo decide el script, por cuenta"},
                              // 1798: un modelo fijo por carril (cola fable, chat y resumen opus)
                              {valor: "tareas", title: "cola fable, chat y resumen opus"},
                              {valor: "opus", title: "todo con opus hasta que lo saques"},
                              {valor: "fable", title: "todo con fable hasta que lo saques"}]}) +
      (esperando ? '<div class="uswl g">mandando…</div>'
                 : (filas ? '<div class="uswl">' + filas + "</div>" : "")) +
      (carriles && !esperando ? '<div class="uswl g">' + esc(carriles) + "</div>" : "") + "</div>";
  }
  var USAGE_ORDEN = ["facu", "orugote"];
  var USAGE_BARRAS = [["five_hour", "5h"], ["seven_day", "week"], ["fable", "fable"]];
  function cajaUsage(u){
    var cuentas = (u.cuentas || []).slice(), rep = u.reparto || {}, pr = u.proyeccion || {}, html = "";
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
    // proyeccion general, las lineas por modelo, excluidas y brecha. arriba de las cuentas UNA linea del reparto.
    if(rep.linea)
      // orden 1396 (facundo, 2026-09-15): tipo propio. como `cuenta` salia "cuenta undefined" (el reparto no tiene nombre)
      html += it({tipo: "reparto", tema: "tools", d: rep,
                  completo: rep.linea + (rep.porque && rep.porque !== rep.linea ? " (" + rep.porque + ")" : "")},
                 '<div class="urep">' + esc(rep.linea) + "</div>");
    html += swModelo(rep);
    // las dos columnas: el nombre pintado por `estado` (ok verde clarito, warn amarillo, mal rojo)
    var cols = cuentas.map(function(cu){
      var est = cu.estado || (cu.sin_login ? "mal" : "");
      var cab = '<span class="cta"><span class="nom' + (est ? " e-" + esc(est) : "") + '">' + esc(cu.nombre) + "</span></span>";
      var cuerpo;
      if(cu.sin_login){
        // sin login propio: no se repiten los numeros de la otra, pero el hueco guarda la altura de las barras
        cuerpo = USAGE_BARRAS.map(function(){ return '<div class="ub-hueco"></div>'; }).join("");
      } else {
        var bs = cu.barras || [];
        cuerpo = USAGE_BARRAS.map(function(k){
          var b = bs.filter(function(x){ return x.clave === k[0] || x.nombre === k[1]; })[0];
          return B.barraUso(b || {nombre: k[1], pct: null, linea: null, nivel: "sin"});
        }).join("");
      }
      return '<div class="ucol' + (cu.elegida ? " elegida" : "") + '">' +
        it({tipo: "cuenta", tema: "tools", d: cu, completo: cu.motivo || ""}, cab) + cuerpo + "</div>";
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
    // lo unico que este modulo deja puesto afuera es el handler del switch: al soltarlo se saca
    destruir: function(){ B.moldeSwitchSacar("modelomodo"); swEspera = null; swUltimo = null; },
    swModelo: swModelo, swEstado: swEstado
  });
})();
