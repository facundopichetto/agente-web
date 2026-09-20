// widget `agent` del board: la tabla de la cola (queue): lo mas nuevo arriba, sin importar el estado (1862).
// modulo de widget (orden 1793, 2026-09-16, "el board como las secciones de shopify"): el shell lo carga
// con `import()` y, cuando la pagina es `file://` (las pruebas), con un `<script>`, que es lo unico que ese
// protocolo deja. por eso el archivo NO tiene `export`: el contrato es registrarse en el shell, asi el mismo
// texto sirve de modulo ES y de script clasico. del shell solo se usa lo que expone `window.__board`.
(function(){
  var B = (typeof window !== "undefined" ? window : self).__board;
  var esc = B.esc, it = B.it, caja = B.caja, vacio = B.vacio, wset = B.wset;

  // el nombre de una palabra de la tarea primero y el numero chico (facundo, 2026-09-13, 1165)
  function nomTarea(t){
    if(!t || !t.nombre) return "";
    return '<span class="c b tnom">' + esc(t.nombre) + "</span>" +
           (t.n ? ' <span class="g tnum">' + esc(String(t.n)) + "</span>" : "") + " ";
  }
  // widget `queue` (facundo, 2026-09-15, 1521): arriba en blanco las 2 ultimas que pasaron, en el medio en verde lo
  // que corre (nombre, hora del pedido, cuanto va) y abajo en verde apagado lo que espera. una linea corta por tarea,
  // sin texto, recursos ni modelo: el detalle esta en el modal de cada fila. la clave sigue `agent` (orden y settings).
  function qNom(t){ return esc(t.nombre || B.corto(t.texto || "?", 24)); }
  function qHora(h){ return '<span class="qh">' + esc(h || "--:--") + "</span>"; }
  // 1792: una fila de la tabla de la cola. las horas y las duraciones ya vienen armadas del server
  // (`recetas/cola_tiempos.py`): aca no se calcula ninguna, solo se pintan. la unica excepcion (1849 {fluida}) es
  // el `delta` de la que corre, que el reloj de abajo hace avanzar segundo a segundo desde el `dur_s` del server.
  var QCLASE = {hecha: "qpaso", fallo: "qpaso", corriendo: "qcorre", cola: "qcola"};
  function qCelda(cl, v, mas, attrs){
    return '<span class="' + cl + " qcel qh" + (mas || "") + '"' + (attrs || "") + '>' + esc(v || "") + "</span>";
  }
  // 2202 {forzar} (facundo, 2026-09-20 1:13 am: "por que hay una sola tarea corriendo en la cola?"): una
  // pendiente dice POR QUE espera, con el recurso concreto que la frena (`*exclusivo*`, `archivo:x.py`,
  // `codigo:daemon`), y al lado tiene el boton que la larga igual. el motivo lo calcula el server
  // (`recetas/forzar_cola.esperas`, cero tokens): aca no se adivina nada. la celda ocupa la columna
  // `iniciada`, que en una pendiente estaba vacia, y el boton la de `terminó`.
  function qEsperaCelda(f){
    if(f.forzada) return qCelda("v", "forzada", "", ' title="la largó facundo: arranca en el próximo tick"');
    if(!f.espera) return qCelda("qcola", "");
    return qCelda("a", f.espera, "", ' title="' + esc(f.espera_motivo || "") + '"');
  }
  function qForzarCelda(f){
    if(f.forzada || !f.espera) return qCelda("qcola", f.termino || "");
    return '<span class="qcel qh"><button class="qforz" type="button" data-msg="forzar ' + esc(String(f.n)) +
           '" title="largarla igual, sin mirar el choque de recursos">forzar</button></span>';
  }
  function qFila(f){
    var cl = QCLASE[f.estado] || "qcola";
    var corre = f.estado === "corriendo";
    var pend = f.estado === "cola";
    // 1862 {cola}: `cola: true` marca que esta fila es una orden de la cola local, la unica que puede ofrecer
    // forzar inicio, frenar y reordenar en su modal (el widget `server` tambien pinta items `tarea`, ajenos)
    return it({tipo: "tarea", cola: true, estado: f.estado, tema: f.tema, d: f},
      '<span class="' + cl + ' qnom">' + esc(f.nombre || ("" + f.n)) +
      (f.estado === "fallo" ? ' <span class="r b">!!</span>' : "") + "</span>" +
      qCelda(cl, f.pedida) + qCelda(cl, f.delay) +
      (pend ? qEsperaCelda(f) : qCelda(cl, f.iniciada)) +
      qCelda(cl, corre ? durVivo(f) : f.dur, corre ? " b qdelta" : "", corre ? ' data-n="' + esc(String(f.n)) + '"' : "") +
      (pend ? qForzarCelda(f) : qCelda(cl, f.termino)));
  }
  // lo que va en la columna `iniciada` / `terminó` de una fila, para medir el ancho de la columna (1843)
  function qTxtEspera(f){ return f.estado === "cola" ? (f.forzada ? "forzada" : (f.espera || "")) : f.iniciada; }
  function qTxtFin(f){ return f.estado === "cola" ? (f.forzada || !f.espera ? "" : "forzar") : f.termino; }
  function qCabecera(){
    return '<span class="qth qnom">nombre</span><span class="qth qcel">pedida</span>' +
           '<span class="qth qcel">delay</span>' +          // 1862: lo que espero de `pedida` a `iniciada`
           '<span class="qth qcel">iniciada</span>' +       // 2202: en una pendiente, por que espera
           '<span class="qth qcel qtiempo">delta</span>' +
           '<span class="qth qcel">terminó</span>';
  }
  function cajaAgente(a){
    var corr = a.corriendo || [], tabla = a.tabla || [];
    var verCola = wset("agent", "cola");
    var filas = tabla.filter(function(f){ return verCola || f.estado !== "cola"; }).map(qFila);
    filas = B.limFilas("agent", filas);
    // 1843: columnas `fr` proporcionales a lo que hay en cada una, para ocupar el 100% del ancho de la caja
    var vis = tabla.filter(function(f){ return verCola || f.estado !== "cola"; });
    var cols = [vis.map(function(f){ return f.nombre || ("" + f.n); }), vis.map(function(f){ return f.pedida; }),
                vis.map(function(f){ return f.delay; }),
                vis.map(qTxtEspera), vis.map(function(f){ return f.dur; }),
                vis.map(qTxtFin)];
    var cuerpo = filas.length ? '<div class="qtab" style="grid-template-columns:' + esc(B.gridFr(cols)) + '">' +
                                qCabecera() + filas.join("") + "</div>"
               : (a.pausa ? '<span class="r b">PAUSA</span>' : vacio("nada en la cola"));
    // dato esencial, corto para que entre en el celu: la cuenta, cuantas corren (verde) y +las que esperan.
    // 1915 {widgets}: la cuenta la manda el server ya resuelta (`cuenta_cola`): la que de verdad puede tomar
    // trabajo, o `sin cuenta hasta <hora>` si ninguna puede. la web no decide nada ni arma esa hora.
    var sinCta = !!((a.cuenta_cola || {}).sin_cuenta);
    var ese = '<span class="' + (sinCta ? "r" : "c") + ' b">' + esc(a.cuenta || "?") + "</span> " +
              (a.pausa ? '<span class="r b">PAUSA</span>'
                       : corr.length ? '<span class="v b">' + corr.length + "</span>" : '<span class="g">idle</span>') +
              (a.pendientes ? ' <span class="qcola">+' + a.pendientes + "</span>" : "");
    return caja("queue", ese, cuerpo, false, "agent");
  }

  // ---------- 1849 {fluida} (facundo, 2026-09-17: "la lista de queue tiene que ser fluida, actualizar el delta
  // cada segundo y ni bien entra una orden nueva meterla") ----------
  // (1) el `delta` de la que corre avanza cada segundo aca, sin pedirle nada al server: el server manda `dur_s`
  //     (lo que llevaba) y `ahora` (su epoch en ese instante); el reloj del cliente se corrige con `offset`
  //     (reloj cliente - reloj server, el minimo visto: la latencia solo lo agranda), asi no salta si el celu
  //     tiene la hora corrida. se toca SOLO el textContent de esa celda: ni el grid ni el ancla del chat.
  // (2) por la lan se pide `cola.json` cada 2 s (`recetas/cola_fresca.py`, cacheado por firma, cero tokens) con
  //     etag; si el `hash` de la cola cambio (orden nueva, arranco, cerro, borrada, reordenada) se repinta ESTA
  //     caja en el acto. sin lan no se pide nada: queda el `widgets.json` publicado de siempre.
  var vivo = {base: null, offset: null, hash: null, etag: null, pidiendo: false, t: 0, recibidos: 0, repintados: 0,
              espera: 0, hasta: 0};
  var POLL_MS = 2000, RELOJ_MS = 1000;
  // el mismo texto de `hora.dur_col` (1915 {widgets}): sin ceros a la izquierda (`4:12`, `1:05:22`, `0:07`);
  // la columna se alinea por el `text-align:right` del css, no por el ancho del texto
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
  // el `agente` que se pinta: el mas nuevo entre lo que trae el shell (widgets.json) y lo fresco de la lan
  // (un json sin `ahora`, de un server viejo o de una prueba, vale como recien armado: se adopta siempre)
  function adoptar(a, srv){
    a = a || {};
    ofs(srv || a.ahora);
    if(!a.ahora){ if(vivo.offset === null) vivo.offset = 0; a.ahora = Date.now() / 1000 - vivo.offset; }
    else if(vivo.base && vivo.base !== a && (vivo.base.ahora || 0) > a.ahora) return vivo.base;
    vivo.base = a;
    return a;
  }
  function segVivo(f){
    if(!vivo.base || f.dur_s === null || f.dur_s === undefined) return null;
    return f.dur_s + (Date.now() / 1000 - (vivo.offset || 0) - (vivo.base.ahora || 0));
  }
  function durVivo(f){
    var s = segVivo(f);
    return s === null ? (f.dur || "") : durCol(Math.max(s, f.dur_s || 0));
  }
  function nodoCaja(){ return document.querySelector('#widgets [data-w="agent"]'); }
  // el reloj de 1 s: solo el textContent de la celda `delta` de cada fila que corre
  function contar(){
    var nodo = nodoCaja();
    if(!nodo || !vivo.base) return;
    (vivo.base.tabla || []).forEach(function(f){
      if(f.estado !== "corriendo") return;
      var c = nodo.querySelector('.qdelta[data-n="' + String(f.n).replace(/"/g, "") + '"]');
      if(!c) return;
      var t = durVivo(f);
      if(t && c.textContent !== t) c.textContent = t;
    });
  }
  function repintar(){
    var nodo = nodoCaja();
    if(!nodo) return false;
    B.anclado(function(){ B.reemplazar(nodo, cajaAgente(vivo.base || {})); });
    vivo.repintados++;
    return true;
  }
  // llego `cola.json` (de la lan o de la prueba): repinta la caja solo si el hash cambio
  function recibir(j){
    if(!j || !j.agente) return false;
    vivo.recibidos++; vivo.t = Date.now();
    ofs(j.ahora_srv);
    var cambio = j.hash !== vivo.hash;
    vivo.hash = j.hash;
    var antes = vivo.base;
    adoptar(j.agente, j.ahora_srv);
    if(vivo.base === antes) return false;   // lo del shell era mas nuevo: nada que pintar
    B.datos("agente", vivo.base);
    if(cambio) repintar(); else contar();
    return cambio;
  }
  // si el endpoint no lo tiene (un daemon de antes de la 1849 contesta 404 via github) o falla, se espera el doble
  // cada vez, hasta 60 s: nunca un pedido cada 2 s contra algo que no contesta
  var ESPERA_MAX = 60000;
  function pedir(){
    if(vivo.pidiendo || !B.lan() || !B.visible() || !nodoCaja() || Date.now() < vivo.hasta) return;
    vivo.pidiendo = true;
    B.bajar("cola.json", vivo.etag).then(function(r){
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

  B.registrar("agent", {
    html: function(d){ var a = adoptar(d || {}); setTimeout(contar, 0); return cajaAgente(a); },
    pintar: function(d, nodo){ var a = adoptar(d || {}); setTimeout(contar, 0); return B.reemplazar(nodo, cajaAgente(a)); },
    destruir: function(){ vivo.base = null; vivo.hash = null; },   // los dos timers los apaga el shell (`B.cada`)
    recibir: recibir, contar: contar, pedir: pedir, durCol: durCol,
    vivo: function(){ return {offset: vivo.offset, hash: vivo.hash, recibidos: vivo.recibidos, repintados: vivo.repintados,
                              espera: vivo.espera,
                              ahora: vivo.base ? vivo.base.ahora : null, filas: vivo.base ? (vivo.base.tabla || []).length : 0}; },
    nomTarea: nomTarea, qFila: qFila
  });
})();
