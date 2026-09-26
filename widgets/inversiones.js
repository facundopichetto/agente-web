// widget `inversiones` del board (orden 2078, facundo 2026-09-26): la cartera de ibkr. arriba dos numeros, lo que
// gano o perdio AYER y en el ultimo MES (usd y `%`, verde si es positivo y rojo si es negativo); abajo el total
// invertido y una fila chica por activo con su parte en usd; al pie una sparkline svg de los ultimos 30 dias del
// valor total, sin ejes ni leyenda, del mismo verde/rojo que el mes.
// modulo de widget (orden 1793): el shell lo carga con `import()` y, en `file://` (las pruebas), con un `<script>`;
// por eso el archivo NO tiene `export` y del shell solo usa `window.__board`.
// el dato es `~/.claudio/plata/inversiones.json` (el contrato esta en `recetas/inversiones.py`: lo escribe el
// tracker de ibkr, hoy `mock: true`). llega por dos caminos: adentro de `widgets.json` (lan, y github de respaldo
// sin lan) y, por la lan, `inversiones.json` cada 60 s con etag, que repinta SOLO esta caja (el patron de la 1849).
// la web hace una sola cuenta: la resta de dos cierres del historial. todo lo demas viene en usd del json.
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

  // ---------- la caja ----------
  function numGrande(et, dl){
    return '<div class="invnum ' + clase(dl.usd) + '"><span class="invet g">' + esc(et) + "</span>" +
           '<span class="invusd b">' + esc(conSigno(dl.usd)) + "</span>" +
           '<span class="invpct">' + esc(conSigno(dl.pct, "%")) + "</span></div>";
  }
  function filaActivo(a){
    return '<div class="invfila"><span class="invtk b">' + esc(a.ticker || "?") + "</span>" +
           '<span class="invcant g">' + esc(a.cantidad !== undefined ? String(a.cantidad) + " u" : "") + "</span>" +
           '<span class="invval">' + esc(usd(a.valor)) + "</span></div>";
  }
  // la sparkline: una polilinea en un svg de 100 x 28 unidades estirado al ancho de la caja (`preserveAspectRatio`
  // none). sin ejes, sin leyenda, sin puntos: solo la forma. el color es `currentColor`, que lo pone la clase.
  function sparkline(vals, cl){
    if(vals.length < 2) return "";
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals), rango = (max - min) || 1;
    var W = 100, H = 28, pad = 2;
    var pts = vals.map(function(v, i){
      var x = i / (vals.length - 1) * W, y = pad + (1 - (v - min) / rango) * (H - 2 * pad);
      return x.toFixed(2) + "," + y.toFixed(2);
    }).join(" ");
    return '<svg class="invspark ' + cl + '" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" ' +
           'aria-hidden="true" focusable="false"><polyline points="' + pts + '" fill="none" stroke="currentColor" ' +
           'stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }
  function cajaInversiones(d){
    d = d || {};
    if(d.error) return caja("inversiones", "", vacio(d.error), false, "inversiones");
    var h = historial(d), acts = d.activos || [];
    if(h.length < 2 && !acts.length) return caja("inversiones", "", vacio("sin datos todavia"), false, "inversiones");
    var ayer = h.length >= 2 ? delta(h[h.length - 1], h[h.length - 2]) : {usd: 0, pct: 0};
    var mes = h.length >= 2 ? delta(h[h.length - 1], h[0]) : {usd: 0, pct: 0};
    var vale = h.length ? h[h.length - 1] : acts.reduce(function(s, a){ return s + Number(a.valor || 0); }, Number(d.efectivo || 0));
    var cuerpo = '<div class="inv">' +
      '<div class="invtop">' + numGrande("ayer", ayer) + numGrande("mes", mes) + "</div>" +
      '<div class="invtot"><span class="g">invertido</span> <span class="b">' + esc(usd(d.total_invertido)) + "</span>" +
      ' <span class="g">· vale</span> <span class="' + clase(vale - Number(d.total_invertido || 0)) + '">' + esc(usd(vale)) + "</span>" +
      (d.efectivo ? ' <span class="g">· efectivo ' + esc(usd(d.efectivo)) + "</span>" : "") + "</div>" +
      (acts.length ? '<div class="invact">' + acts.map(filaActivo).join("") + "</div>" : "") +
      sparkline(h, clase(mes.usd)) + "</div>";
    var ese = '<span class="g">usd</span> ' + (d.mock ? '<span class="g" title="datos inventados: el tracker de ibkr todavia no corrio">mock</span>' : "");
    return caja("inversiones", ese, cuerpo, false, "inversiones");
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
