// widget `models` del board (clave del setting e id: `sombra`): la escalera de modelos por tarea (1832) y la tabla de
// la sombra (acierto de cada modelo de respaldo sobre trafico real, veredicto por categoria, estado de hoy).
// modulo de widget (orden 1793): sin `export`, se registra en `window.__board`; el mismo archivo sirve como modulo ES y
// como `<script>` clasico (`file://`). del shell solo usa lo que expone `B`.
(function(){
  var B = (typeof window !== "undefined" ? window : self).__board;
  var esc = B.esc, it = B.it, caja = B.caja, vacio = B.vacio, limFilas = B.limFilas, pad = B.pad;

  // 1832 (facundo, 2026-09-16 10:40 pm): la escalera por tarea. todo viene armado del server (`escalera.widget_cache`):
  // `% script` que ya sale sin modelo, el mejor gratis con su acierto y si es apto (piso 95), opus, fable, quien la hace
  // hoy y el plan B si claude cae. abajo el reparto de la semana por escalon y la meta. sin negrita en texto: color.
  var CORTO = {"gemini": "gem", "groq": "groq", "openrouter": "orou", "mistral": "mist", "local": "locl"};
  function cortoCol(k){
    if(!k) return "-";
    var p = String(k).split(":")[0], m = String(k).split(":").slice(1).join(":");
    return (CORTO[p] || p) + (m ? " " + m.replace(/-latest$/, "").replace(/^gpt-/, "").slice(0, 12) : "");
  }
  function num(v, cl){
    if(v === null || v === undefined) return '<span class="ecel g">-</span>';
    return '<span class="ecel ' + (cl || (v >= 95 ? "v" : v >= 80 ? "a" : "r")) + '">' + esc(String(v)) + "</span>";
  }
  function escaleraHtml(e){
    if(!e || e.error) return '<span class="g">escalera: ' + esc((e && e.error) || "sin datos") + "</span>";
    // 1843: columnas `fr` proporcionales al contenido (100% del ancho de la caja, sin hueco a la derecha)
    var cols = [[], [], [], [], [], [], []];
    (e.filas || []).forEach(function(f){
      var g = f.gratis || {};
      cols[0].push(f.tarea); cols[1].push(f.pct_script == null ? "-" : String(Math.round(f.pct_script)));
      cols[2].push(g.columna ? cortoCol(g.columna) + " " + g.puntaje + "x" : "-");
      cols[3].push(f.opus == null ? "-" : String(f.opus)); cols[4].push(f.fable == null ? "-" : String(f.fable));
      cols[5].push(f.hoy || "-"); cols[6].push(f.plan_b ? (f.plan_b === g.columna ? "idem" : cortoCol(f.plan_b)) : "-");
    });
    var h = '<div class="esctab" style="grid-template-columns:' + esc(B.gridFr(cols)) + '">' +
      ["tarea", "script", "gratis", "opus", "fable", "hoy", "plan b"].map(function(t){ return '<span class="eth">' + t + "</span>"; }).join("");
    (e.filas || []).forEach(function(f){
      var g = f.gratis || {};
      var gcl = g.apto ? "v" : (g.puntaje !== null && g.puntaje !== undefined && g.puntaje >= 80 ? "a" : "g");
      h += '<span class="enom c">' + esc(f.tarea) + "</span>" +
           num(f.pct_script === null || f.pct_script === undefined ? null : Math.round(f.pct_script), "g") +
           '<span class="ecel ' + gcl + '">' + (g.columna ? esc(cortoCol(g.columna)) + " " + esc(String(g.puntaje)) + (g.apto ? "\u2713" : "") : "-") + "</span>" +
           num(f.opus) + num(f.fable) +
           '<span class="ecel c">' + esc(f.hoy || "-") + "</span>" +
           '<span class="ecel ' + (f.plan_b ? (f.plan_b_vivo === false ? "r" : "v") : "g") + '">' +
           (f.plan_b ? (f.plan_b === g.columna ? "idem" : esc(cortoCol(f.plan_b))) : "-") + "</span>";
    });
    h += "</div>";
    var r = e.reparto || {}, orden = ["script", "local", "gratis", "opus", "fable"];
    var partes = orden.filter(function(k){ return r[k]; }).map(function(k){
      var x = r[k], cl = k === "fable" ? "m" : k === "opus" ? "a" : "v";
      return '<span class="' + cl + '">' + k + " " + esc(String(x.pct_n)) + "%</span>" +
             (x.usd ? '<span class="g"> $' + esc(String(Math.round(x.usd))) + "</span>" : "");
    });
    h += '<span class="g">semana: </span>' + partes.join('<span class="g"> · </span>') +
         (e.week_pct !== null && e.week_pct !== undefined ? '<span class="g"> · week +' + esc(String(e.week_pct)) + "%</span>" : "") + "\n";
    h += '<span class="g">' + esc(e.meta || "") + (e.aptas && e.aptas.length ? " · aptas: " : "") + "</span>" +
         (e.aptas && e.aptas.length ? '<span class="v">' + esc(e.aptas.join(", ")) + "</span>" : "") +
         '<span class="g"> · ' + esc(e.ts || "") + "</span>";
    return h;
  }

function cajaSombra(sb){
  var escal = escaleraHtml(sb.escalera);
  // el widget se llama `models` (facundo, 2026-09-16): la clave del setting y el id siguen siendo `sombra`
  if(sb.error)
    return caja("models", "", '<span class="r">' + esc(sb.error) + "</span>", false, "sombra");
  // escala (facundo, 2026-09-14): el numero es la calidad normalizada, 100 = el mejor de esa categoria (uno solo)
  var cols = sb.cols || [], cortos = {opus:"opus", fable:"fabl", gemini:"gem", groq:"groq", openrouter:"orou",
                                      mistral:"mist", local:"locl", principal:"prin"};
  var hist = sb.historicos || [], esHist = function(c){ return hist.indexOf(c) >= 0; };
  var filas = ['<span class="g">' + pad("categoria", 11) + cols.map(function(c){ return pad(cortos[c] || c, 4, true); }).join(" ") +
               " " + pad("veredicto", 9) + "</span>"];
  (sb.cats || []).forEach(function(cat){
    var f = (sb.tabla || {})[cat];
    if(!f) return;
    var celdas = cols.map(function(c){
      var x = f[c];
      if(!x) return '<span class="g">' + pad("-", 4, true) + "</span>";
      if(x.acierto === null || x.acierto === undefined){
        // `wait` = en la cola del juez · `nojz` = el juez la dio por perdida (motivo explicito)
        var t = esHist(c) ? "off" : x.sin_clave ? "-" : x.pendientes ? "wait" : x.sin_juez ? "nojz" : "err";
        return '<span class="g">' + pad(t, 4, true) + "</span>";
      }
      var cl = x.acierto >= 80 ? "v" : x.acierto >= 50 ? "a" : "r";
      return '<span class="' + cl + ' b">' + pad(String(x.acierto), 4, true) + "</span>";
    });
    var v = (sb.veredictos || {})[cat] || {};
    var ver = v.veredicto === "apto" ? '<span class="v b">' + pad("ok " + (cortos[v.proveedor] || v.proveedor || ""), 9) + "</span>"
            : v.veredicto === "no apto" ? '<span class="r b">' + pad("no", 9) + "</span>"
            : '<span class="g">' + pad("pocos", 9) + "</span>";
    filas.push(it({tipo: "catbackup", tema: "tools", d: {cat: cat, fila: f, cols: cols, veredicto: v}},
               pad(cat, 11) + celdas.join(" ") + " " + ver));
  });
  if(filas.length === 1) filas.push(vacio("sin corridas todavia"));
  filas.unshift(escal);   // 1832: la escalera va arriba de la tabla de la sombra
  var hoy = sb.hoy || {}, est = hoy.estados || {};
  if(Object.keys(est).length){
    var clEst = {ok:"v", cuota:"a", pago:"r", roto:"r", "sin clave":"g"};
    var chips = Object.keys(est).map(function(p){
      var e = est[p], c = clEst[e.estado] || "g";
      var lat = e.estado === "ok" && e.latencia !== null ? " " + e.latencia + "s" : "";
      return it({tipo: "modelo", tema: "tools",
                 d: {prov: p, hoy: e, info: (sb.modelos || {})[p] || {}, tabla: sb.tabla || {},
                     cats: sb.cats || [], veredictos: sb.veredictos || {}}},
                '<span class="' + c + ' b">' + esc(cortos[p] || p) + "</span>" +
                '<span class="' + c + '">' + esc(" " + e.estado + lat) + "</span>");
    });
    filas.push('<span class="g">' + pad("hoy", 11) + "</span>" + chips.join('<span class="g"> \u00b7 </span>'));
  }
  // pie: el modelo real del ollama del server (o `sin local` si no contesta) y lo que el juez no pudo puntuar
  var loc = (sb.local || {}).modelo || ((sb.modelos || {}).local || {}).modelo;
  filas.push('<span class="g">' + (sb.n || 0) + " corridas · 100 = mejor de la categoria · apto = 85+ crudo 80+ &lt;5s 20+" +
             ((sb.faltan || []).length ? " · sin clave: " + sb.faltan.length : "") + "</span>");
  filas.push('<span class="g">locl = </span>' + (loc ? '<span class="c">' + esc(loc) + "</span>" +
               '<span class="g"> · local (ollama del server, sin internet)</span>'
             : '<span class="g">sin local</span>') +
             '<span class="g"> · sin juzgar: ' + (sb.sin_juzgar || 0) +
             (sb.en_cola ? " · en cola del juez: " + sb.en_cola : "") + "</span>");
  // dato esencial: el ultimo veredicto (el primer proveedor apto, o que no hay)
  var apto = null;
  (sb.cats || []).forEach(function(c){
    var v = (sb.veredictos || {})[c] || {};
    if(!apto && v.veredicto === "apto") apto = (cortos[v.proveedor] || v.proveedor || "") + " en " + c;
  });
  var ese = apto ? '<span class="v b">apto</span> <span class="g">' + esc(apto) + "</span>"
                 : '<span class="g">sin apto todavia</span>';
  return caja("models", ese, limFilas("sombra", filas).join("\n"), true, "sombra");
}

  B.registrar("sombra", {
    html: function(d){ return cajaSombra(d || {}); },
    pintar: function(d, nodo){ return B.reemplazar(nodo, cajaSombra(d || {})); },
    destruir: function(){},
    escaleraHtml: escaleraHtml   // lo mira `prueba_escalera`
  });
})();
