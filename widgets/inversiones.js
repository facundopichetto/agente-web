// widget `inversiones` del board (orden 2078, facundo 2026-09-26): la cartera de ibkr. arriba dos numeros, lo que
// gano o perdio AYER y en el ultimo MES (usd y `%`, verde si es positivo y rojo si es negativo); abajo el total
// invertido y una fila chica por activo con su parte en usd; al pie una sparkline svg de los ultimos 30 dias del
// valor total, sin ejes ni leyenda, del mismo verde/rojo que el mes.
// modulo de widget (orden 1793): el shell lo carga con `import()` y, en `file://` (las pruebas), con un `<script>`;
// por eso el archivo NO tiene `export` y del shell solo usa `window.__board`.
// el dato es `~/.claudio/plata/inversiones.json` (el contrato esta en `recetas/inversiones.py`: lo escribe el
// tracker de ibkr, SOLO lectura). el `estado` del json manda (2204): con `ok` o `viejo` hay cartera y se pintan los
// numeros (`viejo` = son de verdad pero la ultima lectura de ibkr fallo, y se avisa); con `en_revision`,
// `sin_token` o `error` **no hay ni un numero** y la caja dice en una linea por que, sin inventar nada. ya no hay
// modo mock. llega por dos caminos: adentro de `widgets.json` (lan, y github de respaldo
// sin lan) y, por la lan, `inversiones.json` cada 60 s con etag, que repinta SOLO esta caja (el patron de la 1849).
// la web hace una sola cuenta: la resta de dos cierres del historial. todo lo demas viene en usd del json.
// 3731 {widget-total-anual} (facundo 2026-10-15): titulo `US$`; primera fila `total` (puse · tengo · %), segunda `anual`
// (menor en bordo / medio en blanco / mayor en verde; el medio es el `%` de `total` hasta cumplir el año, lo decide
// `recetas/inversiones_anual.py`); cada etf muestra SOLO `total` y `anual` en `%` (`total_pct`/`anual_pct` del json);
// y el grafico de abajo dibuja `pnl_diario` (ganancia o perdida total de cada dia, calculada en python), verde si el
// ultimo punto es positivo y rojo si es negativo. la web solo dibuja: ninguna cuenta nueva.
(function(){
  var B = (typeof window !== "undefined" ? window : self).__board;
  var esc = B.esc, caja = B.caja, vacio = B.vacio;
  var POLL_MS = 60000, ESPERA_MAX = 600000;
  var vivo = {d: null, etag: null, hash: null, pidiendo: false, espera: 0, hasta: 0, recibidos: 0, repintados: 0};

  // ---------- numeros ----------
  function usd(n){
    n = Number(n || 0);
    return n.toLocaleString("es-AR", {minimumFractionDigits: 2, maximumFractionDigits: 2});
  }
  function conSigno(n, suf){
    n = Number(n || 0);
    return (n > 0 ? "+" : n < 0 ? "−" : "") + usd(Math.abs(n)) + (suf || "");
  }
  function delta(nuevo, viejo){
    var u = Number(nuevo) - Number(viejo);
    return {usd: u, pct: viejo ? u / Number(viejo) * 100 : 0};
  }
  // el color: verde si sube, rojo si baja, gris si no se movio
  function clase(u){ return u > 0 ? "v" : u < 0 ? "r" : "g"; }
  function historial(d){
    return (d.historial || []).filter(function(x){ return x && isFinite(Number(x.valor)); })
                              .map(function(x){ return Number(x.valor); });
  }
  // con cartera o sin cartera. un json sin `estado` es de antes de la 2204 (o el respaldo de github atrasado):
  // ahi manda lo que traiga, para no tapar numeros buenos con un cartel.
  var CON_DATOS = {ok: 1, viejo: 1};
  function conDatos(d){
    if(d.estado) return !!CON_DATOS[d.estado];
    return !!(historial(d).length || (d.activos || []).length);
  }

  // ---------- la caja ----------
  function numGrande(et, dl){
    return '<div class="invnum ' + clase(dl.usd) + '"><span class="invet g">' + esc(et) + "</span>" +
           '<span class="invusd b">' + esc(conSigno(dl.usd)) + "</span>" +
           '<span class="invpct">' + esc(conSigno(dl.pct, "%")) + "</span></div>";
  }
  // 3731 {widget-total-anual}: el rotulo gris de cada fila (`total`, `anual`) y el `%` con signo y color de un etf
  function nom(t){ return '<span class="invnom g">' + esc(t) + "</span>"; }
  function pctColor(n){
    if(n === null || n === undefined || !isFinite(Number(n))) return '<span class="g">—</span>';
    return '<span class="' + clase(Number(n)) + '">' + esc(conSigno(n, "%")) + "</span>";
  }
  // 3592 {promedio-simple} + 3731: fila `anual` (valor menor en bordo / medio en blanco / valor mayor en verde, sin
  // mas textos que el rotulo). el medio (`medio`) es el `%` de `total` hasta cumplir el año: lo calcula python.
  function filaAnual(a){
    if(!a) return "";
    if(a.pct === null || a.pct === undefined)
      return '<div class="invanio">' + nom("anual") + '<span class="g">' + esc(a.motivo || "sin dato todavia") + "</span></div>";
    var v1 = a.proyeccion_real !== undefined ? a.proyeccion_real : (a.real_anual_pct !== undefined ? a.real_anual_pct : a.pct);
    var v2 = a.proyeccion_anio !== undefined ? a.proyeccion_anio : a.pct;
    var vmin = a.minimo !== undefined ? a.minimo : Math.min(v1, v2);
    var vmax = a.maximo !== undefined ? a.maximo : Math.max(v1, v2);
    var med = a.medio !== undefined ? a.medio : (a.promedio !== undefined ? a.promedio : Math.round((v1 + v2) / 2 * 100) / 100);
    if(vmin === vmax){
      return '<div class="invanio">' + nom("anual") + '<span class="blanco">' + esc(conSigno(med, "%")) + "</span></div>";
    }
    return '<div class="invanio">' + nom("anual") +
           '<span class="bordo">' + esc(conSigno(vmin, "%")) + '</span> ' +
           '<span class="g">/</span> ' +
           '<span class="blanco">' + esc(conSigno(med, "%")) + '</span> ' +
           '<span class="g">/</span> ' +
           '<span class="v">' + esc(conSigno(vmax, "%")) + '</span>' +
           '</div>';
  }
  // 3731: cada etf muestra SOLO porcentajes: ticker | total x% | anual y% (sin cantidad ni usd)
  function filaActivo(a){
    return '<div class="invfila"><span class="invtk b">' + esc(a.ticker || "?") + "</span>" +
           '<span class="invcant">' + nom("total") + pctColor(a.total_pct) + "</span>" +
           '<span class="invval">' + nom("anual") + pctColor(a.anual_pct) + "</span></div>";
  }
  // 3731: los puntos del grafico salen de `pnl_diario` (ganancia o perdida total de cada dia, ya calculada en python)
  function pnlDiario(d){
    return (d.pnl_diario || []).filter(function(x){ return x && isFinite(Number(x.usd)); })
                               .map(function(x){ return Number(x.usd); });
  }
  // el grafico: una polilinea en un svg de 100 x 28 unidades estirado al ancho de la caja (`preserveAspectRatio`
  // none), sin ejes de numeros ni leyenda ni puntos. 3731: lleva UNA linea tenue en el cero (`invcero`, gana arriba /
  // pierde abajo) y el rango siempre lo incluye. el color es `currentColor`, que lo pone la clase.
  function sparkline(vals, cl){
    if(vals.length < 2) return "";
    var min = Math.min.apply(null, vals.concat([0])), max = Math.max.apply(null, vals.concat([0])), rango = (max - min) || 1;
    var W = 100, H = 28, pad = 2;
    var yDe = function(v){ return pad + (1 - (v - min) / rango) * (H - 2 * pad); };
    var pts = vals.map(function(v, i){
      return (i / (vals.length - 1) * W).toFixed(2) + "," + yDe(v).toFixed(2);
    }).join(" ");
    var y0 = yDe(0).toFixed(2);
    return '<svg class="invspark ' + cl + '" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" ' +
           'aria-hidden="true" focusable="false"><line class="invcero" x1="0" y1="' + y0 + '" x2="' + W + '" y2="' + y0 +
           '" stroke="currentColor" stroke-width="1" stroke-opacity=".25" stroke-dasharray="2 2" vector-effect="non-scaling-stroke"/>' +
           '<polyline points="' + pts + '" fill="none" stroke="currentColor" ' +
           'stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }
  function cajaInversiones(d){
    d = d || {};
    if(d.error) return caja("US$", "", vacio(d.error), false, "inversiones");
    // la cuenta todavia no da plata: la linea del tracker tal cual, y ningun numero
    if(!conDatos(d)){
      return caja("US$", '<span class="g">ibkr</span>',
                  vacio(d.detalle || "la cuenta de ibkr todavia no da datos"), false, "inversiones");
    }
    var h = historial(d), acts = d.activos || [];
    if(h.length < 2 && !acts.length) return caja("US$", "", vacio("sin datos todavia"), false, "inversiones");
    var pnl = pnlDiario(d);
    var ultimoPnl = pnl.length ? pnl[pnl.length - 1] : 0;
    var vale = h.length ? h[h.length - 1] : acts.reduce(function(s, a){ return s + Number(a.valor || 0); }, Number(d.efectivo || 0));
    var puse = Number(d.total_invertido || 0);
    var diff_usd = vale - puse;
    var diff_pct = puse ? (diff_usd / puse) * 100 : 0;
    // 3592 {promedio-simple}: tengo en blanco si diferencia < 5%, verde si > 5%, rojo si < -5%
    var colorTengo = diff_pct > 5 ? "v" : (diff_pct < -5 ? "r" : "blanco");

    // 3731: fila `total` (rotulo gris): puse en blanco, tengo con buffer del 5%, cambio % real sin buffer
    var filaTot = '<div class="invtot">' + nom("total") +
      '<span class="blanco">' + esc(usd(puse)) + '</span> ' +
      '<span class="g">·</span> ' +
      '<span class="' + colorTengo + '">' + esc(usd(vale)) + '</span> ' +
      '<span class="g">·</span> ' +
      '<span class="' + clase(diff_usd) + '">' + esc(conSigno(diff_pct, "%")) + '</span>' +
      '</div>';

    var cuerpo = '<div class="inv">' +
      filaTot +
      filaAnual(d.anual) +
      (acts.length ? '<div class="invact">' + acts.map(filaActivo).join("") + "</div>" : "") +
      sparkline(pnl, clase(ultimoPnl)) +
      (d.estado === "viejo" ? '<div class="invviejo g">' + esc(d.detalle || "la ultima lectura de ibkr fallo") +
                              "</div>" : "") + "</div>";
    var ese = (d.estado === "viejo" ? '<span class="r" title="' + esc(d.detalle || "") + '">sin refrescar</span>' : "");
    return caja("US$", ese, cuerpo, false, "inversiones");
  }

  // ---------- el dato fresco por la lan ----------
  function nodoCaja(){ return document.querySelector('#widgets [data-w="inversiones"]'); }
  function adoptar(d){ if(d) vivo.d = d; return vivo.d || {}; }
  function repintar(){
    var nodo = nodoCaja();
    if(!nodo) return false;
    B.anclado(function(){ B.reemplazar(nodo, cajaInversiones(vivo.d || {})); });
    vivo.repintados++;
    return true;
  }
  function recibir(j){
    if(!j || !j.inversiones) return false;
    vivo.recibidos++;
    var cambio = j.hash !== vivo.hash;
    vivo.hash = j.hash;
    adoptar(j.inversiones);
    B.datos("inversiones", vivo.d);
    if(cambio) repintar();
    return cambio;
  }
  function pedir(forzado){
    if(!forzado && (vivo.pidiendo || !B.lan() || !B.visible() || !nodoCaja() || Date.now() < vivo.hasta)) return null;
    if(!B.lan()) return null;
    vivo.pidiendo = true;
    return B.bajar("inversiones.json", forzado ? null : vivo.etag).then(function(r){
      vivo.pidiendo = false; vivo.espera = 0; vivo.hasta = 0;
      if(!r || r.status === 304) return false;
      if(r.etag) vivo.etag = r.etag;
      return recibir(r.json);
    }, function(){
      vivo.pidiendo = false;
      vivo.espera = Math.min((vivo.espera || POLL_MS) * 2, ESPERA_MAX);
      vivo.hasta = Date.now() + vivo.espera;
      return false;
    });
  }
  B.cada(POLL_MS, function(){ pedir(false); });

  B.registrar("inversiones", {
    html: function(d){ return cajaInversiones(adoptar(d)); },
    pintar: function(d, nodo){ return B.reemplazar(nodo, cajaInversiones(adoptar(d))); },
    destruir: function(){ vivo.d = null; vivo.hash = null; vivo.etag = null; },
    recibir: recibir, pedir: pedir,
    vivo: function(){ return {recibidos: vivo.recibidos, repintados: vivo.repintados, espera: vivo.espera,
                              dias: historial(vivo.d || {}).length}; }
  });
})();
