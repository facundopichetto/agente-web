// widget `models` del board (clave del setting e id: `sombra`): la escalera de modelos por tarea (1832) y la tabla de
// la sombra (acierto de cada modelo de respaldo sobre trafico real, veredicto por categoria, estado de hoy).
// 2176 {models} (facundo, 2026-09-19): el widget medía calidad y nada mas. ahora cada fila dice tambien **cuanto
// sale** (usd por millon de tokens, `$0` si es free tier), **cuanto falla** (error y cuota 429 en la grilla, no
// escondidos en el modal), **cuanto es red y cuanto es el modelo** (el `tok/s` de un remoto medía la ida y vuelta,
// 1817), **de cuando es el dato** (la frescura por fila) y **quien esta trabajando AHORA**, no solo el historico.
// las columnas `HISTORICOS` (proveedores que ya no se llaman) salieron de la grilla: eran una columna de `off`.
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
  // 2176 paso 1: el precio de un modelo, en usd por millon de tokens. tres formas, y se distinguen a ojo:
  // `$0` verde = free tier (no se paga), `.30/2.50` = lista in/out del proveedor, `~3.4` = claude, que no tiene
  // tarifa que se pueda multiplicar (el cache manda) y publica lo que de verdad se pago por millon.
  function plata(x){
    if(!x) return '<span class="ecel g">-</span>';
    if(x.free) return '<span class="ecel v">$0</span>';
    if(x.medido) return x.usd_tok ? '<span class="ecel a">~' + esc(String(x.usd_tok)) + "</span>"
                                  : '<span class="ecel g">-</span>';
    if(x["in"] === null || x["in"] === undefined) return '<span class="ecel g">-</span>';
    return '<span class="ecel c">' + esc(String(x["in"])) + "/" + esc(String(x.out)) + "</span>";
  }
  // 2176 paso 2: una tasa 0..100 en la grilla. verde hasta 5, ambar hasta 20, rojo arriba: el ojo tiene que
  // encontrar al que rebota sin abrir ningun modal.
  function tasa(v){
    if(v === null || v === undefined) return '<span class="ecel g">-</span>';
    return '<span class="ecel ' + (v < 5 ? "v" : v < 20 ? "a" : "r") + '">' + esc(String(v)) + "%</span>";
  }
  function seg(v, cl){
    if(v === null || v === undefined) return '<span class="ecel g">-</span>';
    return '<span class="ecel ' + (cl || "c") + '">' + esc(String(v)) + "s</span>";
  }
  // 2176 paso 4: la frescura. lo de hace minutos en cian, lo de hace horas en gris, lo de dias en ambar:
  // un acierto de hace cinco dias no vale lo mismo que uno de hace diez minutos, y hasta hoy se veian igual.
  function fresco(e){
    if(!e) return '<span class="ecel g">-</span>';
    var cl = /m$/.test(e) ? "c" : /d$/.test(e) ? "a" : "g";
    return '<span class="ecel ' + cl + '">' + esc(e) + "</span>";
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

  // 2176 {models}: la tabla de arriba compara **categorias**; esta compara **modelos**, que es donde viven la
  // plata (paso 1), la tasa de error y la de cuota (paso 2, antes escondidas en el modal), la red contra la
  // velocidad de generacion (paso 3) y la frescura (paso 4). una fila por modelo que hoy se llama.
  function modelosHtml(sb, cols, cortos){
    var pr = sb.precios || {}, md = sb.modelos || {}, rem = sb.remotos || [];
    var filas = cols.filter(function(c){ return md[c] || pr[c]; });
    if(!filas.length) return '<span class="g">sin modelos</span>';
    function nombre(c){
      var m = (md[c] || {}).modelo;
      return (cortos[c] || c) + (m ? " " + String(m).split("/").pop().replace(/-latest$/, "").replace(/^gpt-/, "") : "");
    }
    var cel = [[], [], [], [], [], [], []];
    filas.forEach(function(c){
      var x = pr[c] || {}, me = (md[c] || {}).medidas || {};
      cel[0].push(nombre(c));
      // el `~` va con comillas simples a proposito: `prueba_web` prohibe armar duraciones a mano (el patron de
      // concatenar una tilde con comillas dobles). esto no es una duracion: es la marca de `precio medido`.
      cel[1].push(x.free ? "$0" : x.medido ? '~' + x.usd_tok : (x["in"] == null ? "-" : x["in"] + "/" + x.out));
      cel[2].push(me.tasa_error == null ? "-" : me.tasa_error + "%");
      cel[3].push(me.tasa_cuota == null ? "-" : me.tasa_cuota + "%");
      cel[4].push(rem.indexOf(c) < 0 || me.red_s == null ? "-" : me.red_s + "s");
      cel[5].push(me.gen_toks == null ? "-" : String(me.gen_toks));
      cel[6].push(edadDe(me.ultimo) || "-");
    });
    var h = '<div class="esctab mdtab" style="grid-template-columns:' + esc(B.gridFr(cel)) + '">' +
      ["modelo", "$/M", "err", "429", "red", "tok/s", "visto"].map(function(t){
        return '<span class="eth">' + t + "</span>"; }).join("");
    filas.forEach(function(c){
      var x = pr[c] || {}, me = (md[c] || {}).medidas || {}, remoto = rem.indexOf(c) >= 0;
      // el `.it` (tocable) es el que entra en la grilla, asi que lleva el `enom`: sin eso la celda no se
      // achica ni corta con `…` y la tabla se pasa del ancho de la caja en el celu (1946)
      h += it({tipo: "modelo", tema: "tools", d: {prov: c, hoy: ((sb.hoy || {}).estados || {})[c] || {},
                                                  info: md[c] || {}, precio: x, tabla: sb.tabla || {},
                                                  cats: sb.cats || [], veredictos: sb.veredictos || {}}},
              esc(nombre(c))).replace('class="it"', 'class="it enom c"') +
           plata(x) + tasa(me.tasa_error) + tasa(me.tasa_cuota) +
           // la red solo tiene sentido en un remoto: el local no sale del server y claude no es una llamada sola
           (remoto ? seg(me.red_s, "g") : '<span class="ecel g">-</span>') +
           (me.gen_toks == null ? '<span class="ecel g">-</span>'
                                : '<span class="ecel c">' + esc(String(me.gen_toks)) + "</span>") +
           fresco(edadDe(me.ultimo));
    });
    return h + "</div>";
  }
  // `3m` / `2h` / `4d` desde un `YYYY-mm-dd HH:MM:SS` del server (el mismo formato que `_edad_corta`)
  function edadDe(ts){
    if(!ts) return null;
    var t = Date.parse(String(ts).replace(" ", "T"));
    if(!t) return null;
    var s = Math.max(0, (Date.now() - t) / 1000);
    return s < 5400 ? Math.floor(s / 60) + "m" : s < 172800 ? Math.floor(s / 3600) + "h" : Math.floor(s / 86400) + "d";
  }

  // 2176 paso 5 (facundo, 2026-09-19): "sumar que modelo esta trabajando AHORA (el presente, no solo el
  // historico que mide `models` hoy)". tres cosas vivas, en una linea: las tareas de la cola corriendo con su
  // modelo y sus minutos, el modelo con el que contesta el chat en este momento (ya pasado por el candado de
  // fable) y las tareas del chat que hoy atiende un local en vez de claude (1784). lo arma el server.
  var CLESC = {script: "v", local: "v", gratis: "v", opus: "a", fable: "m"};
  function ahoraHtml(a){
    if(!a) return '<span class="g">' + pad("ahora", 11) + "</span>" + '<span class="g">sin datos</span>';
    var ch = [];
    (a.tareas || []).forEach(function(t){
      var cl = CLESC[t.escalon] || "c";
      ch.push(it({tipo: "ahora", tema: t.tema || "tools", d: t},
                 '<span class="' + cl + '">' + esc(t.modelo || "?") + "</span>" +
                 '<span class="c"> ' + esc(t.nombre || t.carril || "") + "</span>" +
                 (t.min || t.min === 0 ? '<span class="g"> ' + esc(String(t.min)) + "m</span>" : "")));
    });
    if(a.chat && a.chat.modelo)
      ch.push(it({tipo: "ahora", tema: "tools", d: a.chat},
                 '<span class="g">chat </span>' +
                 '<span class="' + (CLESC[a.chat.escalon] || "c") + '">' + esc(a.chat.modelo) + "</span>" +
                 (a.chat.cuenta ? '<span class="g"> ' + esc(a.chat.cuenta) + "</span>" : "")));
    (a.ruteadas || []).forEach(function(r){
      ch.push('<span class="g">' + esc(r.tarea) + " </span>" + '<span class="v">' + esc(r.modelo || "local") + "</span>");
    });
    if(!ch.length) ch.push('<span class="g">nada corriendo</span>');
    // `.ahorafila` corta el `white-space:pre` del cuerpo: con cinco tareas, el chat y cuatro tareas ruteadas la
    // linea mide 230 caracteres y hacia scrollear el widget entero en el celu. las tablas siguen sin envolver.
    return '<span class="ahorafila"><span class="g">' + pad("ahora", 11) + "</span>" +
           ch.join('<span class="g"> \u00b7 </span>') + "</span>";
  }

function cajaSombra(sb){
  var escal = escaleraHtml(sb.escalera);
  // el widget se llama `models` (facundo, 2026-09-16): la clave del setting y el id siguen siendo `sombra`
  if(sb.error)
    return caja("models", "", '<span class="r">' + esc(sb.error) + "</span>", false, "sombra");
  // escala (facundo, 2026-09-14): el numero es la calidad normalizada, 100 = el mejor de esa categoria (uno solo)
  var cols = sb.cols || [], cortos = {opus:"opus", fable:"fabl", gemini:"gem", groq:"groq", openrouter:"orou",
                                      mistral:"mist", local:"locl", principal:"prin"};
  // 2176 paso 6: `sb.cols` ya viene sin los `HISTORICOS` (el server los saca): un proveedor que no se llama
  // mas ocupaba una columna entera de `off`. el detalle (`sb.modelos`) los sigue teniendo.
  var filas = ['<span class="g">' + pad("categoria", 11) + cols.map(function(c){ return pad(cortos[c] || c, 4, true); }).join(" ") +
               " " + pad("veredicto", 9) + " " + pad("visto", 5, true) + "</span>"];
  (sb.cats || []).forEach(function(cat){
    var f = (sb.tabla || {})[cat];
    if(!f) return;
    var celdas = cols.map(function(c){
      var x = f[c];
      if(!x) return '<span class="g">' + pad("-", 4, true) + "</span>";
      if(x.acierto === null || x.acierto === undefined){
        // `wait` = en la cola del juez · `nojz` = el juez la dio por perdida (motivo explicito)
        var t = x.sin_clave ? "-" : x.pendientes ? "wait" : x.sin_juez ? "nojz" : "err";
        return '<span class="g">' + pad(t, 4, true) + "</span>";
      }
      var cl = x.acierto >= 80 ? "v" : x.acierto >= 50 ? "a" : "r";
      return '<span class="' + cl + ' b">' + pad(String(x.acierto), 4, true) + "</span>";
    });
    var v = (sb.veredictos || {})[cat] || {};
    var ver = v.veredicto === "apto" ? '<span class="v b">' + pad("ok " + (cortos[v.proveedor] || v.proveedor || ""), 9) + "</span>"
            : v.veredicto === "no apto" ? '<span class="r b">' + pad("no", 9) + "</span>"
            : '<span class="g">' + pad("pocos", 9) + "</span>";
    // 2176 paso 4: al final de la fila, de cuando es el dato (`3m`, `2h`, `4d`). la escalera ya publicaba su
    // `ts` y esta tabla no: un 100 de hace cinco dias se veia igual que uno de hace diez minutos.
    var fr = ((sb.fresco || {})[cat] || {}).edad;
    var frcl = !fr ? "g" : /m$/.test(fr) ? "c" : /d$/.test(fr) ? "a" : "g";
    filas.push(it({tipo: "catbackup", tema: "tools", d: {cat: cat, fila: f, cols: cols, veredicto: v,
                                                         fresco: (sb.fresco || {})[cat] || {}}},
               pad(cat, 11) + celdas.join(" ") + " " + ver +
               ' <span class="' + frcl + '">' + pad(fr || "-", 5, true) + "</span>"));
  });
  if(filas.length === 1) filas.push(vacio("sin corridas todavia"));
  filas.push(modelosHtml(sb, cols, cortos));   // 2176: plata, fallas, red vs modelo y frescura, POR MODELO
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
  filas.push(ahoraHtml(sb.ahora));   // 2176 paso 5: quien esta escribiendo AHORA, no el historico
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
