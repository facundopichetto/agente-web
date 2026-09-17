// widget `igcola` del board: los follows y unfollows PROGRAMADOS de instagram (orden 1929 {colaig}, facundo
// 2026-09-17: "los follows o unfollows programados deberian verse en el widget, y el widget tiene que actualizar
// mucho mas rapido, es medio desastre").
// modulo de widget (orden 1793): el shell lo carga con `import()` y, en `file://` (las pruebas), con un `<script>`;
// por eso el archivo NO tiene `export` y del shell solo usa `window.__board`.
// las mismas reglas de columnas que la tabla de la cola de tareas (1792/1843/1862): las horas y las duraciones las
// arma el server (`recetas/hora.py`), aca no se calcula ninguna, la tabla la dibuja el css con `B.gridFr` y en
// 390 px no hay scroll horizontal. lo unico que avanza solo es el `en h:mm:ss` del proximo (el patron de la 1849).
// por la lan pide `igcola.json` cada 2 s (`recetas/ig_cola_fresca.py`: cacheado por firma, etag, 304, cero tokens)
// y repinta SOLO esta caja cuando cambia el `hash`; sin lan queda el `widgets.json` publicado y en background no
// pide nada.
(function(){
  var B = (typeof window !== "undefined" ? window : self).__board;
  var esc = B.esc, caja = B.caja, vacio = B.vacio, wset = B.wset;
  var POLL_MS = 2000, RELOJ_MS = 1000, ESPERA_MAX = 60000;
  var vivo = {base: null, offset: null, hash: null, etag: null, pidiendo: false, espera: 0, hasta: 0,
              recibidos: 0, repintados: 0};

  // el mismo texto de `hora.dur_col` del server: sin ceros a la izquierda (`4:12`, `1:05:22`, `0:07`)
  function durCol(seg){
    if(seg === null || seg === undefined || isNaN(seg) || seg < 0) return "";
    seg = Math.floor(seg);
    var h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60, ss = (s < 10 ? "0" : "") + s;
    return h ? (h + ":" + (m < 10 ? "0" : "") + m + ":" + ss) : (m + ":" + ss);
  }
  function ofs(srv){
    if(!srv) return;
    var cand = Date.now() / 1000 - srv;
    if(vivo.offset === null || cand < vivo.offset) vivo.offset = cand;
  }
  function adoptar(w, srv){
    w = w || {};
    ofs(srv || w.ahora);
    if(!w.ahora){ if(vivo.offset === null) vivo.offset = 0; w.ahora = Date.now() / 1000 - vivo.offset; }
    else if(vivo.base && vivo.base !== w && (vivo.base.ahora || 0) > w.ahora) return vivo.base;
    vivo.base = w;
    return w;
  }
  // cuanto falta para el proximo, a ESTE segundo: `falta_s` valia al `ahora` del server
  function faltaVivo(w){
    if(!w || w.falta_s === null || w.falta_s === undefined) return "";
    var s = w.falta_s - (Date.now() / 1000 - (vivo.offset || 0) - (w.ahora || 0));
    return durCol(Math.max(0, s));
  }

  var CL = {pendiente: "qcola", corriendo: "qcorre", hecho: "qpaso", "falló": "qpaso", cancelado: "qpaso",
            frenado: "qfren", revisar: "qcorre"};
  function celda(cl, v, mas){
    return '<span class="' + cl + " qcel qh" + (mas || "") + '">' + esc(v || "") + "</span>";
  }
  function fila(f){
    var cl = f.cl || CL[f.estado] || "qcola";
    return '<span class="' + cl + ' qnom">' + esc(f.que || "") + "</span>" +
           '<span class="' + cl + ' ignom" title="' + esc(f.detalle || "") + '">' + esc(f.quien || "") + "</span>" +
           celda(cl, f.pedido) + celda(cl, f.sale) +
           '<span class="' + cl + ' qcel igest">' + esc(f.estado || "") + "</span>";
  }
  function cabecera(){
    return '<span class="qth qnom">qué</span><span class="qth ignom">quién</span>' +
           '<span class="qth qcel">pedido</span><span class="qth qcel">sale</span>' +
           '<span class="qth qcel igest">estado</span>';
  }
  function cajaIgCola(w){
    w = w || {};
    if(w.error) return caja("ig cola", "", vacio(w.error), false, "igcola");
    var verHechas = wset("igcola", "hechas");
    var vis = (w.tabla || []).filter(function(f){ return verHechas || f.estado === "pendiente" || f.estado === "corriendo" || f.estado === "frenado"; });
    var filas = B.limFilas("igcola", vis.map(fila));
    var cols = [vis.map(function(f){ return f.que; }), vis.map(function(f){ return f.quien; }),
                vis.map(function(f){ return f.pedido; }), vis.map(function(f){ return f.sale; }),
                vis.map(function(f){ return f.estado; })];
    var cuerpo = filas.length ? '<div class="igtab" style="grid-template-columns:' + esc(B.gridFr(cols)) + '">' +
                                cabecera() + filas.join("") + "</div>"
               : vacio("nada programado");
    // la UNA linea del pie: tope del dia por tipo, la franja vigente y para cuando es el proximo. la arma entera
    // el server (`ig_cola._linea`); lo unico que se mueve aca es el `en h:mm:ss`, que baja cada segundo
    var falta = faltaVivo(w);
    cuerpo += '<div class="g igpie">' + esc(w.linea || "") +
              (falta ? ' <span class="c">· próximo en <span class="igfalta">' + esc(falta) + "</span></span>" : "") +
              "</div>";
    var ese = (w.pendientes ? '<span class="v b">' + w.pendientes + "</span> " +
                              '<span class="g">programad' + (w.pendientes === 1 ? "o" : "os") + "</span>"
                            : '<span class="g">sin programar</span>') +
              ((w.frenos || []).length ? ' <span class="r b">' + esc(w.frenos.join(" ")) + " frenado</span>" : "");
    return caja("ig cola", ese, cuerpo, false, "igcola");
  }

  function nodoCaja(){ return document.querySelector('#widgets [data-w="igcola"]'); }
  // el reloj de 1 s: SOLO el textContent del `en h:mm:ss`, ni el grid ni el ancla del chat
  function contar(){
    var nodo = nodoCaja();
    if(!nodo || !vivo.base) return;
    var c = nodo.querySelector(".igfalta");
    if(!c) return;
    var t = faltaVivo(vivo.base);
    if(t && c.textContent !== t) c.textContent = t;
  }
  function repintar(){
    var nodo = nodoCaja();
    if(!nodo) return false;
    B.anclado(function(){ B.reemplazar(nodo, cajaIgCola(vivo.base || {})); });
    vivo.repintados++;
    return true;
  }
  function recibir(j){
    if(!j || !j.igcola) return false;
    vivo.recibidos++;
    ofs(j.ahora_srv);
    var cambio = j.hash !== vivo.hash;
    vivo.hash = j.hash;
    var antes = vivo.base;
    adoptar(j.igcola, j.ahora_srv);
    if(vivo.base === antes) return false;   // lo del shell era mas nuevo
    B.datos("igcola", vivo.base);
    if(cambio) repintar(); else contar();
    return cambio;
  }
  function pedir(){
    if(vivo.pidiendo || !B.lan() || !B.visible() || !nodoCaja() || Date.now() < vivo.hasta) return;
    vivo.pidiendo = true;
    B.bajar("igcola.json", vivo.etag).then(function(r){
      vivo.pidiendo = false; vivo.espera = 0; vivo.hasta = 0;
      if(!r || r.status === 304) return;
      if(r.etag) vivo.etag = r.etag;
      recibir(r.json);
    }, function(){
      vivo.pidiendo = false;
      vivo.espera = Math.min((vivo.espera || POLL_MS) * 2, ESPERA_MAX);
      vivo.hasta = Date.now() + vivo.espera;
    });
  }
  B.cada(RELOJ_MS, contar);
  B.cada(POLL_MS, pedir);

  B.registrar("igcola", {
    html: function(d){ var w = adoptar(d || {}); setTimeout(contar, 0); return cajaIgCola(w); },
    pintar: function(d, nodo){ var w = adoptar(d || {}); setTimeout(contar, 0); return B.reemplazar(nodo, cajaIgCola(w)); },
    destruir: function(){ vivo.base = null; vivo.hash = null; },   // los dos timers los apaga el shell (`B.cada`)
    recibir: recibir, contar: contar, pedir: pedir, durCol: durCol,
    vivo: function(){ return {offset: vivo.offset, hash: vivo.hash, recibidos: vivo.recibidos,
                              repintados: vivo.repintados, espera: vivo.espera,
                              filas: vivo.base ? (vivo.base.tabla || []).length : 0}; }
  });
})();
