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
  var CORTO = {"gemini": "gem", "groq": "groq", "openrouter": "orou", "local": "locl"};
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

  // 2176 {models}: la tabla de arriba compara **categorias**; esta compara **MODELOS**, que es donde viven la
  // plata (paso 1), la tasa de error y la de cuota (paso 2), la red contra la velocidad de generacion (paso 3)
  // y la frescura (paso 4).
  // 2240 {widgets} paso 2 (panel `widgets`, 5 de 5): una fila por MODELO, no por proveedor. la columna `local`
  // tapaba a los ollama y la de un proveedor a tres niveles de distinto precio, asi que dos modelos con 0% y 32%
  // de error se leian como una sola fila. el proveedor pasa a ser un dato de la fila (el prefijo del nombre).
  // no rompe la 1045 ("una tabla de widget compara UNA cosa"): sigue comparando modelos, cambio la unidad.
  // 2240 paso 3: `lat` (la latencia) entra a la grilla y el color de `err`, `429` y `lat` lo decide el server
  // (`nivel`, como el widget `gasto`). la columna `red` de la 2176 se fue a la fila tocable: con una fila por
  // modelo son ocho columnas y en 390 px los porcentajes salian cortados con `\u2026`, que es peor que no estar.
  // la red sigue separada de la generacion, que es lo que pedia la 2176: `tok/s` en la grilla, `red` en el modal.
  var NIVEL = {ok: "v", aviso: "a", mal: "r", sin: "g"};
  function nombreModelo(prov, modelo, cortos){
    var p = cortos[prov] || prov;
    // el nombre de la fila no repite al proveedor: `gemini-flash-lite-latest` bajo `gem` es `flash-lite`
    var m = String(modelo || "").split("/").pop().replace(/-latest$/, "").replace(/^gpt-/, "")
              .replace(/^claude-/, "").replace(/:free$/, "")
              .replace(new RegExp("^" + prov + "[-.]?", "i"), "");
    if(!m || m === prov) return p;
    // el nombre entero no entra en 390 px al lado de seis numeros. se corta por el MEDIO, no por el final:
    // dos modelos de la misma familia se distinguen por el sufijo (`flash` vs `flash-lite`) y
    // cortando por atras las dos filas quedaban con el mismo texto. el nombre completo esta en el modal.
    return p + " " + (m.length > 17 ? m.slice(0, 8) + "\u2026" + m.slice(-8) : m);
  }
  function celdaNivel(v, nivel, suf){
    if(v === null || v === undefined) return '<span class="ecel g">-</span>';
    return '<span class="ecel ' + (NIVEL[nivel] || "g") + '">' + esc(String(v)) + (suf || "") + "</span>";
  }
  function modelosHtml(sb, cortos){
    var filas = sb.modelos_fila || [];
    if(!filas.length) return '<span class="g">sin modelos</span>';
    // las columnas las fija el css (`.esctab.mdtab`): los seis numeros a `max-content` y el nombre con lo que
    // sobre. el reparto `fr` de `B.gridFr` es para la tabla de arriba, donde todas las celdas son cortas.
    var h = '<div class="esctab mdtab">' +
      ["modelo", "$/M", "err", "429", "lat", "tok/s", "visto"].map(function(t){
        return '<span class="eth">' + t + "</span>"; }).join("");
    filas.forEach(function(f){
      var m = f.medidas || {}, x = f.precio || {}, n = f.nivel || {};
      // el `.it` (tocable) es el que entra en la grilla, asi que lleva el `enom`: sin eso la celda no se
      // achica ni corta con `\u2026` y la tabla se pasa del ancho de la caja en el celu (1946)
      h += it({tipo: "modelo", tema: "flos", d: {prov: f.proveedor, modelo: f.modelo,
                                                  hoy: ((sb.hoy || {}).estados || {})[f.proveedor] || {},
                                                  info: Object.assign({}, (sb.modelos || {})[f.proveedor] || {},
                                                                      {modelo: f.modelo, medidas: m}),
                                                  precio: x, tabla: sb.tabla || {},
                                                  cats: sb.cats || [], veredictos: sb.veredictos || {}}},
              esc(nombreModelo(f.proveedor, f.modelo, cortos))).replace('class="it"', 'class="it enom c"') +
           plata(x) + celdaNivel(m.tasa_error, n.error, "%") + celdaNivel(m.tasa_cuota, n.cuota, "%") +
           celdaNivel(m.latencia, n.lat, "s") +
           (m.gen_toks == null ? '<span class="ecel g">-</span>'
                               : '<span class="ecel c">' + esc(String(m.gen_toks)) + "</span>") +
           fresco(f.edad);
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
      ch.push(it({tipo: "ahora", tema: t.tema || "flos", d: t},
                 '<span class="' + cl + '">' + esc(t.modelo || "?") + "</span>" +
                 '<span class="c"> ' + esc(t.nombre || t.carril || "") + "</span>" +
                 (t.min || t.min === 0 ? '<span class="g"> ' + esc(String(t.min)) + "m</span>" : "")));
    });
    if(a.chat && a.chat.modelo)
      ch.push(it({tipo: "ahora", tema: "flos", d: a.chat},
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
                                      local:"locl", principal:"prin"};
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
    filas.push(it({tipo: "catbackup", tema: "flos", d: {cat: cat, fila: f, cols: cols, veredicto: v,
                                                         fresco: (sb.fresco || {})[cat] || {}}},
               pad(cat, 11) + celdas.join(" ") + " " + ver +
               ' <span class="' + frcl + '">' + pad(fr || "-", 5, true) + "</span>"));
  });
  if(filas.length === 1) filas.push(vacio("sin corridas todavia"));
  filas.push(modelosHtml(sb, cortos));   // 2240 paso 2: una fila por MODELO, con plata, fallas, red y frescura
  filas.unshift(escal);   // 1832: la escalera va arriba de la tabla de la sombra
  var hoy = sb.hoy || {}, est = hoy.estados || {};
  if(Object.keys(est).length){
    var clEst = {ok:"v", cuota:"a", pago:"r", roto:"r", "sin clave":"g"};
    var chips = Object.keys(est).map(function(p){
      var e = est[p], c = clEst[e.estado] || "g";
      var lat = e.estado === "ok" && e.latencia !== null ? " " + e.latencia + "s" : "";
      return it({tipo: "modelo", tema: "flos",
                 d: {prov: p, hoy: e, info: (sb.modelos || {})[p] || {}, tabla: sb.tabla || {},
                     cats: sb.cats || [], veredictos: sb.veredictos || {}}},
                '<span class="' + c + ' b">' + esc(cortos[p] || p) + "</span>" +
                '<span class="' + c + '">' + esc(" " + e.estado + lat) + "</span>");
    });
    filas.push('<span class="g">' + pad("hoy", 11) + "</span>" + chips.join('<span class="g"> \u00b7 </span>'));
  }
  filas.push(ahoraHtml(sb.ahora));   // 2176 paso 5: quien esta escribiendo AHORA, no el historico
  filas.push(paresFila(sb));         // 2360 {voto}: los pares del banco pareado que esperan el voto de facundo
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

  // ---------- 2360 {voto}: el modal `pares` (facundo es el juez del banco pareado) ----------
  // cada par cerrado del banco pareado (opus vs fable sobre la MISMA orden, o un barato en sombra) queda `a votar`.
  // aca se ve la orden y los dos lados como `A` y `B`, sorteados con el id del par y con los nombres de modelo
  // tapados por el server: NADA de lo que llega dice cual es de quien. tres botones grandes al pie; el voto sale
  // por socket como `pares votar <id> <A|B|iguales>` (sin modelo) y recien la respuesta fresca destapa cual era
  // cual. molde de `docs/componentes-web.md`: back grande a la izquierda (par anterior de la fila, sin deshacer
  // nada), `✕` a la derecha, esc cierra, y `confirmar` pide `pares.json?fresco=1` al abrir: sin datos viejos.
  var parM = null, par = {lista: [], i: 0, votados: [], n: 0, mandados: 0, ultimo: null, local: false, crudo: {}};
  function paresFila(sb){
    var p = sb.pares || {}, n = p.a_votar || 0;
    return '<span class="parfila"><span class="g">' + pad("pares", 11) + "</span>" +
      (n ? '<span class="a b">' + esc(String(n)) + " a votar</span>" : '<span class="g">nada a votar</span>') +
      (p.votados ? '<span class="g"> \u00b7 ' + esc(String(p.votados)) + " votados</span>" : "") +
      (n ? ' <button class="qforz parvot" type="button" title="opus vs fable a ciegas: elegís el mejor sin saber cuál es de quién">votar</button>' : "") +
      "</span>";
  }
  function parCargar(){
    if(!B.lan()) return Promise.resolve(false);
    return B.bajar("pares.json?fresco=1", null).then(function(r){
      if(!r || !r.json) return false;
      parAdoptar(r.json);
      return true;
    }, function(){ return false; });
  }
  function parAdoptar(j){
    par.lista = j.pares || []; par.votados = j.votados || []; par.n = j.n || par.lista.length;
    if(par.i >= par.lista.length) par.i = 0;
  }
  // 2414 {pares}: lo que se MUESTRA de cada lado son los tres renglones del resumen ciego que escribio un modelo
  // gratis (`banco_pareado.resumir`), no el diff crudo: facundo, 2026-09-29, "no puedo votar MDs". el diff sigue
  // estando, atras de la caja chica `ver el diff`, del mismo par y sin cambiar de letra. un par sin resumen (el
  // gratis no llego todavia) muestra el diff como antes, asi el modal nunca queda vacio.
  function parTieneResumen(x){
    return !!(x && String(x.resumen_A || "").trim() && String(x.resumen_B || "").trim());
  }
  function parCrudo(x){
    return !parTieneResumen(x) || !!par.crudo[x.id];
  }
  function parLadoHtml(x, letra, crudo, lado){
    var cab = '<div class="parcab"><span class="c b">' + letra + '</span> <span class="g">' +
      (crudo ? lado : "resumen") + "</span></div>";
    if(crudo) return '<div class="parlado">' + cab + '<pre class="partxt">' + esc(x[letra] || "") + "</pre></div>";
    var ls = String(x["resumen_" + letra] || "").split("\n").filter(function(l){ return l.trim(); });
    return '<div class="parlado">' + cab + '<div class="partxt">' +
      ls.map(function(l){ return "<div>" + esc(l.trim()) + "</div>"; }).join("") + "</div></div>";
  }
  function parHtml(x){
    var lado = x.solo_lectura ? "respuesta" : "diff", crudo = parCrudo(x);
    return '<div class="parord"><span class="g">orden ' + esc(String(x.n || "?")) + " \u00b7 " + esc(x.tipo || "") +
             (x.clase === "sombra" ? " \u00b7 sombra" : "") +
             // 2361 {atiende-sombra} paso 9: un par de este carril no es opus contra fable, es la respuesta
             // que ya se publico (opencode) contra la de agy en sombra. se dice, para que el voto se entienda.
             (x.clase === "opencode" ? " \u00b7 opencode vs sombra" : "") +
             (x.tema ? " \u00b7 " + esc(x.tema) : "") + "</span>\n" +
             esc(x.texto || "") + "</div>" +
           '<div class="parcols">' + parLadoHtml(x, "A", crudo, lado) + parLadoHtml(x, "B", crudo, lado) + "</div>" +
           (parTieneResumen(x) ? '<button class="qforz pardiff" type="button" title="' +
              (crudo ? "volver a los dos resumenes" : "los dos lados crudos, sin cambiar de letra") + '">' +
              (crudo ? "ver el resumen" : "ver el " + lado) + "</button>" : "") +
           (crudo && x.recortado ? '<span class="g">los lados estan recortados al tope del juez</span>' : "");
  }
  function parModal(){
    if(parM) return parM;
    parM = B.modalMolde({
      id: "paresmodal", z: 44,
      confirmar: function(d){ return (d && d.local) ? Promise.resolve(true) : parCargar(); },
      alCerrar: function(){ par.lista = []; par.i = 0; par.local = false; par.crudo = {}; }
    });
    // 2002 {back}: el back grande a la izquierda de la cabecera. aca es "el par anterior de la fila" (para
    // volver a mirarlo), nunca deshace un voto ya mandado. apagado en el primero.
    var h = parM.el.querySelector(".mhead");
    var back = document.createElement("button");
    back.type = "button"; back.className = "bglifo mesquina b-atras parback apagado";
    back.setAttribute("aria-label", "par anterior"); back.title = "par anterior";
    back.innerHTML = '<span class="mglf">\u2190</span>';
    back.addEventListener("click", function(){ if(par.i > 0){ par.i--; parPintar(); } });
    h.insertBefore(back, h.firstChild);
    // la caja chica `ver el diff` / `ver el resumen`: mismo par, misma letra, no manda nada a ningun lado
    parM.el.addEventListener("click", function(ev){
      var b = ev.target.closest && ev.target.closest(".pardiff");
      if(!b) return;
      ev.preventDefault(); ev.stopPropagation();
      var x = par.lista[par.i];
      if(!x) return;
      if(par.crudo[x.id]) delete par.crudo[x.id]; else par.crudo[x.id] = 1;
      parPintar();
    }, true);
    return parM;
  }
  function parPintar(nota){
    var m = parModal(), x = par.lista[par.i];
    if(!x){
      m.pintar({titulo: "pares", cuenta: "", texto: "no queda ningún par a votar", botones: []});
    } else {
      m.pintar({titulo: "par " + x.id, cuenta: (par.i + 1) + " de " + par.lista.length, html: parHtml(x),
                botones: [
                  {tipo: "verde", txt: "mejor A", clase: "parbtn", aria: "mejor A", accion: function(){ parVotar(x, "A"); }},
                  {tipo: "verde", txt: "mejor B", clase: "parbtn", aria: "mejor B", accion: function(){ parVotar(x, "B"); }},
                  {tipo: "verde", txt: "iguales", clase: "parbtn", aria: "iguales", accion: function(){ parVotar(x, "iguales"); }}]});
    }
    var back = m.el.querySelector(".parback");
    if(back) back.classList.toggle("apagado", par.i === 0);
    if(nota) m.estado(nota);
  }
  function parDestape(id){
    var v = null;
    (par.votados || []).forEach(function(z){ if(z && z.id === id) v = z; });
    if(!v) return "voto guardado";
    return "par " + id + ": A era " + v.A + " \u00b7 B era " + v.B + " \u00b7 " +
           (v.gana === "iguales" ? "iguales" : "gana " + v.gana) + (v.juez ? " (el juez gratis decía " + v.juez + ")" : "");
  }
  function parVotar(x, letra){
    var m = parModal();
    var bs = m.el.querySelectorAll(".mbotones button");
    [].forEach.call(bs, function(b){ b.disabled = true; });
    m.estado("mandando el voto\u2026");
    par.mandados++;
    par.ultimo = {id: x.id, letra: letra};
    var q = par.local ? Promise.resolve({ok: true}) : B.mandarAparte("pares votar " + x.id + " " + letra, "board");
    Promise.resolve(q).then(function(r){
      if(r && r.ok === false){
        [].forEach.call(bs, function(b){ b.disabled = false; });
        m.estado("no salió: " + (r.motivo || "sin conexión")); return;
      }
      // el que se voto sale de la fila en el momento; el destape llega con el json fresco
      par.lista = par.lista.filter(function(z){ return z.id !== x.id; });
      if(par.i >= par.lista.length) par.i = Math.max(0, par.lista.length - 1);
      parPintar("voto mandado, destapando\u2026");
      if(par.local) return;
      setTimeout(function(){
        parCargar().then(function(ok){ parPintar(ok ? parDestape(x.id) : "voto mandado"); B.repintarWidgets && B.repintarWidgets(); });
      }, 1500);
    });
  }
  function paresAbrir(){
    par.i = 0; par.local = false;
    return parModal().abrir({titulo: "pares", texto: "cargando\u2026"}).then(function(ok){
      if(ok) parPintar();
      return ok;
    });
  }
  // para las pruebas (sin lan): la misma fila, con un json ya armado; el voto no sale a ningun lado
  function paresMostrar(j){
    par.i = 0; par.local = true; parAdoptar(j || {});
    return parModal().abrir({titulo: "pares", texto: "", local: true}).then(function(ok){ if(ok) parPintar(); return ok; });
  }
  function alTocarPares(ev){
    var b = ev.target.closest && ev.target.closest('#widgets [data-w="sombra"] .parvot');
    if(!b) return;
    ev.preventDefault(); ev.stopPropagation();
    paresAbrir();
  }
  document.addEventListener("click", alTocarPares, true);

  B.registrar("sombra", {
    html: function(d){ return cajaSombra(d || {}); },
    pintar: function(d, nodo){ return B.reemplazar(nodo, cajaSombra(d || {})); },
    destruir: function(){ document.removeEventListener("click", alTocarPares, true); },
    escaleraHtml: escaleraHtml,   // lo mira `prueba_escalera`
    pares: {abrir: paresAbrir, mostrar: paresMostrar, votar: function(l){ var x = par.lista[par.i]; if(x) parVotar(x, l); return !!x; },
            estado: function(){ return {n: par.lista.length, i: par.i, mandados: par.mandados, ultimo: par.ultimo,
                                        crudo: Object.keys(par.crudo).length, abierto: !!(parM && parM.abierto)}; }}
  });
})();
