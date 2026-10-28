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
  // 1681 {cuelgue}: el rojo del atascado viene del server en `cl` (`qcola qvieja`), con la espera en el `title`:
  // aca no se calcula ninguna demora, igual que las horas
  // 4233 {igcola-modal-cancelar-forzar}: toda fila de follow/unfollow es tocable (las cinco celdas llevan el id) y
  // abre el modal de esa accion
  var TOCABLES = {follow: 1, unfollow: 1};
  function fila(f){
    var cl = f.cl || CL[f.estado] || "qcola";
    var t = (TOCABLES[f.tipo || f.que] && f.id) ? ' igtoca" data-igid="' + esc(f.id) : "";
    return '<span class="' + cl + ' qnom' + t + '">' + esc(f.que || "") + "</span>" +
           '<span class="' + cl + ' ignom' + t + '" title="' + esc(f.detalle || "") + '">' + esc(f.quien || "") + "</span>" +
           celda(cl, f.pedido, t) + celda(cl, f.sale, t) +
           '<span class="' + cl + ' qcel igest' + t + '">' + esc(f.estado || "") + "</span>";
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
    // lo ya salido que llega del server ya viene cortado a las ultimas 24 h corridas (2148 {igcola24},
    // `ig_cola._en_ventana`); aca solo queda el filtro de la setting `mostrar las que ya salieron`
    var vis = (w.tabla || []).filter(function(f){ return verHechas || f.estado === "pendiente" || f.estado === "corriendo" || f.estado === "frenado"; });
    // las que de verdad se pintan: `limFilas` corta por la setting `filas` y agrega el `+N más` (que no es una fila)
    var lim = +wset("igcola", "filas") || 0;
    var pint = (lim && vis.length > lim) ? vis.slice(0, lim) : vis;
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
    // 2148 {igcola24}: el contador del titulo cuenta lo que REALMENTE se pinta, no lo que hay en la cola entera
    var prog = pint.filter(function(f){ return f.estado === "pendiente" || f.estado === "frenado"; }).length;
    var ese = (prog ? '<span class="v b">' + prog + "</span> " +
                      '<span class="g">programad' + (prog === 1 ? "o" : "os") + "</span>"
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
  // ---------- 4233 {igcola-modal-cancelar-forzar}: el modal de una fila ----------
  // tocar un follow o unfollow pide la ficha FRESCA al server ({modalviejo}: `POST /ig/cola {accion: ver}`, que lee
  // la cola del disco en el momento) y recien ahi abre el modal. sin lan no abre nada. `cancelar` lo saca de la cola
  // (`cancelada`, como a mano) e `intentar forzarlo` lo larga ya: el server saltea solo el turno y respeta el
  // congelado, los frenos, el enfriamiento, la franja, el tope del dia y la sesion; si no sale, el modal dice por que.
  var igModal = null, igAbierta = null, igUltimo = null;
  function postCola(cuerpo){
    igUltimo = cuerpo;   // lo lee `prueba_ig_cola_web`
    return B.pedir("/ig/cola", {method: "POST", headers: {"content-type": "application/json"},
                                body: JSON.stringify(cuerpo)});
  }
  function fichaHtml(f){
    return '<div class="cmod igficha">' +
      '<span class="g">pedido</span> <span class="b">' + esc(f.pedido || "") + "</span>" +
      (f.sale ? ' <span class="g">· sale</span> <span class="b">' + esc(f.sale) + "</span>" : "") +
      (f.detalle ? '\n<span class="g">' + esc(f.detalle) + "</span>" : "") +
      (f.cancelable && !f.forzable && f.no_forzar
        ? '\n<span class="r">forzarlo ahora no sale: ' + esc(f.no_forzar) + "</span>" : "") +
      "</div>";
  }
  function botones(f){
    if(!f.cancelable) return [];
    return [
      {tipo: "rojo", txt: "cancelar", accion: function(m){ accionar("cancelar", f, m); }},
      {tipo: "verde", txt: "intentar forzarlo", accion: function(m){ accionar("forzar", f, m); }}
    ];
  }
  function pintarFicha(f, m){
    m.pintar({titulo: (f.tipo || "") + " a " + (f.quien || ""), cuenta: f.estado || "",
              html: fichaHtml(f), botones: botones(f)});
  }
  function accionar(acc, f, m){
    m.estado(acc === "forzar" ? "intentando que salga ya…" : "cancelando…");
    m.el.querySelectorAll(".mbotones button").forEach(function(b){ b.disabled = true; });
    return postCola({accion: acc, id: f.id}).then(function(r){
      r = r || {};
      if(r.ficha && r.ficha.ok && m.abierto) pintarFicha(r.ficha, m);
      m.estado(r.ok ? (r.texto || "listo") : ("no salió: " + (r.motivo || "sin motivo")));
      vivo.etag = null; vivo.hasta = 0; pedir();   // la caja se entera ya, sin esperar el poll
      return r;
    }, function(e){
      m.el.querySelectorAll(".mbotones button").forEach(function(b){ b.disabled = false; });
      m.estado("no llegó al server (" + ((e && e.message) || "sin lan") + ")");
      return {ok: false};
    });
  }
  function fichaAbrir(id){
    if(!B.modalMolde || !B.lan()) return Promise.resolve(false);
    if(!igModal){
      igModal = B.modalMolde({id: "igcolamodal", z: 43, sinServer: true, alCerrar: function(){ igAbierta = null; }});
      // 2002 {back}: el back grande a la izquierda (vuelve a la cola) y la `✕` del molde a la derecha
      var head = igModal.el.querySelector(".mhead");
      if(head && !head.querySelector(".igatras")){
        var bk = document.createElement("button");
        bk.type = "button"; bk.className = "bglifo mesquina b-atras igatras";
        bk.setAttribute("aria-label", "back"); bk.title = "back";
        bk.innerHTML = '<span class="mglf">←</span>';
        bk.addEventListener("click", function(){ igModal.cerrar(false); });
        head.insertBefore(bk, head.firstChild);
      }
    }
    return postCola({accion: "ver", id: id}).then(function(f){
      if(!f || !f.ok) return false;
      igAbierta = f.id;
      return igModal.abrir({titulo: (f.tipo || "") + " a " + (f.quien || ""), cuenta: f.estado || "",
                            html: fichaHtml(f), botones: botones(f)});
    }, function(){ return false; });
  }
  function alTocar(ev){
    var n = ev.target.closest && ev.target.closest('#widgets [data-w="igcola"] [data-igid]');
    if(!n) return;
    ev.preventDefault(); ev.stopPropagation();
    fichaAbrir(n.getAttribute("data-igid"));
  }
  document.addEventListener("click", alTocar, true);

  B.cada(RELOJ_MS, contar);
  B.cada(POLL_MS, pedir);

  B.registrar("igcola", {
    html: function(d){ var w = adoptar(d || {}); setTimeout(contar, 0); return cajaIgCola(w); },
    pintar: function(d, nodo){ var w = adoptar(d || {}); setTimeout(contar, 0); return B.reemplazar(nodo, cajaIgCola(w)); },
    destruir: function(){   // los dos timers los apaga el shell (`B.cada`); el listener del toque lo saca aca
      vivo.base = null; vivo.hash = null; igAbierta = null;
      document.removeEventListener("click", alTocar, true);
    },
    recibir: recibir, contar: contar, pedir: pedir, durCol: durCol,
    fichaAbrir: fichaAbrir, accionar: accionar,
    modal: function(){ return {abierta: igAbierta, ultimo: igUltimo, abierto: !!(igModal && igModal.abierto)}; },
    vivo: function(){ return {offset: vivo.offset, hash: vivo.hash, recibidos: vivo.recibidos,
                              repintados: vivo.repintados, espera: vivo.espera,
                              filas: vivo.base ? (vivo.base.tabla || []).length : 0}; }
  });
})();
