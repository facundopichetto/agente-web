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
  // 3553 (facundo, 2026-10-12): formato de hora 11:57:33a (sin espacio ni m)
  function qFmtHora(h){
    if(!h) return "";
    return String(h).replace(/\s*([ap])m\b/i, "$1");
  }
  // 3553: tipo de tarea (chat/interactivo vs fondo/script vs proceso adoptado)
  function qTipo(f){
    if(!f) return "fondo";
    if(f.adoptado || f.proceso || f.tipo === "proceso" || f.estado === "corre") return "proceso";
    var txt = (f.completo || f.texto || "");
    if(f.interactivo || f.tipo === "chat" || /\(de chat\)|\[pestana\b/i.test(txt)) return "chat";
    return "fondo";
  }
  // 1792: una fila de la tabla de la cola. las horas y las duraciones ya vienen armadas del server
  // (`recetas/cola_tiempos.py`): aca no se calcula ninguna, solo se pintan. la unica excepcion (1849 {fluida}) es
  // el `tiempo` de la que corre y el `delay` de la que espera, que el reloj de abajo hace avanzar segundo a segundo
  // desde el `dur_s` / `delay_s` del server (3635).
  var QCLASE = {hecha: "qpaso", fallo: "qfallo", corriendo: "qcorre", corre: "qcorre", cola: "qcola", borrada: "qborrada"};
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
    if(f.forzada || !f.espera) return qCelda("qcola", qFmtHora(f.termino) || "");
    return '<span class="qcel qh"><button class="qforz" type="button" data-msg="forzar ' + esc(String(f.n)) +
           '" title="largarla igual, sin mirar el choque de recursos">forzar</button></span>';
  }
  function qFila(f){
    var tipo = qTipo(f);
    var clEstado = QCLASE[f.estado] || "qcola";
    var cl = clEstado + " qtipo-" + tipo;
    var corre = f.estado === "corriendo" || f.estado === "corre";
    var pend = f.estado === "cola";
    // 1862 {cola}: `cola: true` marca que esta fila es una orden de la cola local, la unica que puede ofrecer
    // forzar inicio, frenar y reordenar en su modal (el widget `server` tambien pinta items `tarea`, ajenos)
    return it({tipo: "tarea", cola: true, estado: f.estado, tipo_cola: tipo, tema: f.tema, d: f},
      '<span class="' + cl + ' qnom">' + esc(f.nombre || ("" + f.n)) +
      (f.estado === "fallo" ? ' <span class="r b">!!</span>' : "") +
      (f.veces > 1 ? ' <span class="g" title="' + esc(f.veces + ' ordenes con este nombre, juntas en una fila') + '">×' +
                     esc(String(f.veces)) + "</span>" : "") + "</span>" +
      qCelda(cl, qFmtHora(f.pedida)) +
      qCelda(cl, pend && f.delay_vivo ? delayVivo(f) : f.delay, pend && f.delay_vivo ? " qvivo" : "",
             pend && f.delay_vivo ? ' data-k="delay" data-n="' + esc(String(f.n)) + '"' : "") +
      (pend ? qEsperaCelda(f) : qCelda(cl, qFmtHora(f.iniciada))) +
      qCelda(cl, corre ? durVivo(f) : f.dur, corre ? " b qvivo" : "", corre ? ' data-k="dur" data-n="' + esc(String(f.n)) + '"' : "") +
      (pend ? qForzarCelda(f) : qCelda(cl, qFmtHora(f.termino))));
  }
  // lo que va en la columna `iniciada` / `terminó` de una fila, para medir el ancho de la columna (1843)
  function qTxtEspera(f){ return f.estado === "cola" ? (f.forzada ? "forzada" : (f.espera || "")) : qFmtHora(f.iniciada); }
  function qTxtFin(f){ return f.estado === "cola" ? (f.forzada || !f.espera ? "" : "forzar") : qFmtHora(f.termino); }
  function qCabecera(){
    return '<span class="qth qnom">nombre</span><span class="qth qcel">pedida</span>' +
           '<span class="qth qcel">delay</span>' +          // 1862: lo que espero de `pedida` a `iniciada`
           '<span class="qth qcel">iniciada</span>' +       // 2202: en una pendiente, por que espera
           '<span class="qth qcel qtiempo">tiempo</span>' +
           '<span class="qth qcel">terminó</span>';
  }
  // 2368 {hora} (facundo, 2026-09-29: "los de la madrugada se pueden no ver en el widget de la cola normal?"):
  // una orden con hora de arranque a futuro (la de `[madrugada]` y cualquier otra con marca) ya no esta en la
  // tabla de arriba: el server la manda aparte en `programadas`, y se pinta en su propia seccion, ordenada por
  // hora y con el tema de cada una. si no hay ninguna la seccion no existe (ni titulo ni tabla vacia). la hora
  // en 12 h la arma el server (regla de las horas): aca no se calcula nada.
  function pFila(f){
    return it({tipo: "tarea", cola: true, estado: "cola", tema: f.tema, d: f},
      '<span class="qcola qnom" title="' + esc(f.completo || f.texto || "") + '">' + esc(f.nombre || ("" + f.n)) +
      (f.tema ? ' <span class="g">' + esc(f.tema) + "</span>" : "") + "</span>" +
      qCelda("qcola", f.hora));
  }
  function secProgramadas(ps){
    if(!ps || !ps.length) return "";
    var cols = [ps.map(function(f){ return (f.nombre || ("" + f.n)) + (f.tema ? " " + f.tema : ""); }),
                ps.map(function(f){ return f.hora; })];
    return '<div class="madsub g">programadas</div>' +
           '<div class="madtab igtab" style="grid-template-columns:' + esc(B.gridFr(cols)) + '">' +
           '<span class="qth qnom">tarea</span><span class="qth qcel">sale</span>' +
           B.limFilas("agent", ps.map(pFila)).join("") + "</div>";
  }
  function cajaAgente(a){
    var corr = a.corriendo || [], tabla = a.tabla || [];
    var verCola = wset("agent", "cola");
    var filas = tabla.filter(function(f){ return verCola || f.estado !== "cola"; }).map(qFila);
    filas = B.limFilas("agent", filas);
    // 1843: columnas `fr` proporcionales a lo que hay en cada una, para ocupar el 100% del ancho de la caja
    var vis = tabla.filter(function(f){ return verCola || f.estado !== "cola"; });
    var cols = [vis.map(function(f){ return f.nombre || ("" + f.n); }), vis.map(function(f){ return qFmtHora(f.pedida); }),
                vis.map(function(f){ return f.delay; }),
                vis.map(qTxtEspera), vis.map(function(f){ return f.dur; }),
                vis.map(qTxtFin)];
    var prog = a.programadas || [];
    var cuerpo = filas.length ? '<div class="qtab" style="grid-template-columns:' + esc(B.gridFr(cols)) + '">' +
                                qCabecera() + filas.join("") + "</div>"
               : (a.pausa ? '<span class="r b">PAUSA</span>'
                          : vacio(prog.length ? "nada en la cola de ahora" : "nada en la cola"));
    cuerpo += secProgramadas(prog);
    // 2671 {encolo-2}: el pie lo arma el server (`cola_filas.pie`) y nunca viene vacio
    cuerpo += '<div class="g igpie">' + esc(a.pie || "sin novedades de la cola") + "</div>";
    // dato esencial, corto para que entre en el celu: la cuenta, cuantas corren (verde) y +las que esperan.
    // 1915 {widgets}: la cuenta la manda el server ya resuelta (`cuenta_cola`): la que de verdad puede tomar
    // trabajo, o `sin cuenta hasta <hora>` si ninguna puede. la web no decide nada ni arma esa hora.
    var sinCta = !!((a.cuenta_cola || {}).sin_cuenta);
    var ese = '<span class="' + (sinCta ? "r" : "c") + ' b">' + esc(a.cuenta || "?") + "</span> " +
              (a.pausa ? '<span class="r b">PAUSA</span>'
                       : corr.length ? '<span class="v b">' + corr.length + "</span>" : '<span class="g">idle</span>') +
              (a.pendientes ? ' <span class="qcola">+' + a.pendientes + "</span>" : "") +
              // 2368 {hora}: las programadas no son cola de ahora, asi que se cuentan aparte del `+N`
              (prog.length ? ' <span class="g">· ' + prog.length + " programada" + (prog.length === 1 ? "" : "s") +
                             "</span>" : "") +
               viejoHtml();   // 3814 {cola-sin-desfase}: si no se confirma contra el server, la caja lo dice
    return caja("queue", ese, cuerpo, false, "agent");
  }

  // ---------- 1849 {fluida} (facundo, 2026-09-17: "la lista de queue tiene que ser fluida, actualizar el tiempo
  // cada segundo y ni bien entra una orden nueva meterla") ----------
  // (1) el `tiempo` (antes `delta`) de la que corre y el `delay` de la que espera (3635) avanzan cada segundo aca, sin pedirle nada al server: el server manda `dur_s`
  //     (lo que llevaba) y `ahora` (su epoch en ese instante); el reloj del cliente se corrige con `offset`
  //     (reloj cliente - reloj server, el minimo visto: la latencia solo lo agranda), asi no salta si el celu
  //     tiene la hora corrida. se toca SOLO el textContent de esa celda: ni el grid ni el ancla del chat.
  // (2) por la lan se pide `cola.json` cada 2 s (`recetas/cola_fresca.py`, cacheado por firma, cero tokens) con
  //     etag; si el `hash` de la cola cambio (orden nueva, arranco, cerro, borrada, reordenada) se repinta ESTA
  //     caja en el acto. sin lan no se pide nada: queda el `widgets.json` publicado de siempre.
  var vivo = {base: null, offset: null, hash: null, etag: null, pidiendo: false, t: 0, recibidos: 0, repintados: 0,
              espera: 0, hasta: 0, ok: 0, offLan: null};
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
  // 3635: el `delay` de una pendiente es lo que lleva esperando desde `pedida`; corre igual que el `tiempo`
  function delayVivo(f){
    if(!vivo.base || f.delay_s === null || f.delay_s === undefined) return f.delay || "";
    var s = f.delay_s + (Date.now() / 1000 - (vivo.offset || 0) - (vivo.base.ahora || 0));
    return durCol(Math.max(s, f.delay_s));
  }
  function nodoCaja(){ return document.querySelector('#widgets [data-w="agent"]'); }
  // el reloj de 1 s: solo el textContent de la celda `tiempo` de cada fila que corre y del `delay` de cada pendiente
  function contar(){
    var nodo = nodoCaja();
    if(!nodo || !vivo.base) return;
    marcarViejo();
    if(esViejo()) return;   // 3814 {cola-sin-desfase}: sobre datos sin confirmar el reloj no corre (parecerian vivos)
    (vivo.base.tabla || []).forEach(function(f){
      var corre = f.estado === "corriendo", pendv = f.estado === "cola" && f.delay_vivo;
      if(!corre && !pendv) return;
      var c = nodo.querySelector('.qvivo[data-k="' + (corre ? "dur" : "delay") + '"][data-n="' + String(f.n).replace(/"/g, "") + '"]');
      if(!c) return;
      var t = corre ? durVivo(f) : delayVivo(f);
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
    if(j.ahora_srv){ var cl = Date.now() / 1000 - j.ahora_srv; if(vivo.offLan === null || cl < vivo.offLan) vivo.offLan = cl; }
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
      vivo.ok = Date.now();   // 3814 {cola-sin-desfase}: un 304 tambien es el server confirmando que la cola sigue igual
      if(!r || r.status === 304) return;
      if(r.etag) vivo.etag = r.etag;
      recibir(r.json);
    }, function(){
      vivo.pidiendo = false;
      vivo.espera = Math.min((vivo.espera || POLL_MS) * 2, ESPERA_MAX);
      vivo.hasta = Date.now() + vivo.espera;
    });
  }

  // ---------- 3814 {cola-sin-desfase} (facundo, 2026-10-16: "por que veo una cola vieja?") ----------
  // la cola no puede mentir: si dejo de confirmarse contra el server, el widget lo dice en vez de dibujar tareas
  // pasadas como vivas, y el `tiempo` de las que "corren" deja de avanzar (un reloj andando sobre datos viejos
  // parece una cola en vivo). dos relojes para saber cuan vieja es: `vivo.ok` (la ultima vez que el server
  // contesto por la lan, 200 o 304: una cola quieta no cambia el hash pero sigue confirmada) y la `ahora` de la
  // tabla (lo que trae el `widgets.json` publicado cuando no hay lan). la edad es la menor de las dos.
  // con la lan confirmando cada 2 s, 20 s sin respuesta ya es corte; por el buzon se publica cada 60 s y la web lo
  // baja cada 30, asi que ahi el corte es a los 150 s.
  var VIEJA_LAN_S = 20, VIEJA_BUZON_S = 150;
  function edadViva(){
    if(!vivo.base) return 0;
    // el offset de `ofs()` sale de la propia `ahora` de la tabla cuando no hay lan (daria edad 0 siempre): para medir
    // la edad solo vale el que sale de `ahora_srv` (lo que el server dijo al CONTESTAR); sin ese, se confia en el reloj
    var reloj = Date.now() / 1000 - (vivo.offLan === null ? 0 : vivo.offLan);
    var porTabla = Math.max(0, reloj - (vivo.base.ahora || reloj));
    return vivo.ok ? Math.min(porTabla, (Date.now() - vivo.ok) / 1000) : porTabla;
  }
  function esViejo(){ return edadViva() > (B.lan() && vivo.ok ? VIEJA_LAN_S : VIEJA_BUZON_S); }
  function haceTxt(s){
    s = Math.floor(s);
    return s < 60 ? s + " s" : s < 3600 ? Math.floor(s / 60) + " min" : Math.floor(s / 3600) + " h";
  }
  function viejoTxt(){ return "sin sync · hace " + haceTxt(edadViva()); }
  var VIEJO_TIT = "la cola no se esta actualizando: lo que ves puede no ser lo real (se reintenta solo)";
  // 3816 {foto-409-sync-cola}: sin lan la cola sale de `widgets.json` en el buzon, y el buzon solo es tan fresco como lo
  // ultimo que el server logro publicar (el 16/10 estuvo 38 min sin publicar por el tope de escrituras por hora): el
  // cartel lo dice, para que no parezca un fallo de esta pagina
  function viejoTit(){
    return B.lan() ? VIEJO_TIT
      : "sin conexion directa con el server: la cola viene del buzon de github y el server no publico una cola nueva hace " +
        haceTxt(edadViva()) + " (se vuelve a probar la conexion directa cada 15 s)";
  }
  function viejoHtml(){
    return esViejo() ? ' <span class="qviejo" style="color:var(--naranja)" title="' + esc(viejoTit()) + '">' + esc(viejoTxt()) + "</span>" : "";
  }
  // el cartel sobre la caja ya pintada (la caja se repinta solo si cambia el hash): idempotente, corre cada 1 s
  function marcarViejo(){
    var nodo = nodoCaja();
    if(!nodo) return;
    var esc_ = nodo.querySelector(".tit .wesc");
    if(!esc_) return;
    var m = esc_.querySelector(".qviejo");
    if(!esViejo()){ if(m) m.parentNode.removeChild(m); return; }
    var t = viejoTxt();
    if(m){ if(m.textContent !== t) m.textContent = t; m.title = viejoTit(); return; }
    m = document.createElement("span");
    m.className = "qviejo"; m.style.color = "var(--naranja)"; m.title = viejoTit(); m.textContent = t;
    esc_.appendChild(document.createTextNode(" ")); esc_.appendChild(m);
  }
  // volver a la pestaña (o tocar el `[↻]`): se olvida la espera acumulada (hasta 60 s de backoff) y el etag, y se
  // pide la cola entera ya, en vez de esperar al proximo golpe de 2 s o a que se agote un backoff de un corte viejo
  function reanudar(){
    vivo.espera = 0; vivo.hasta = 0; vivo.etag = null;
    pedir();
    marcarViejo();
  }
  B.cada(RELOJ_MS, contar);
  B.cada(POLL_MS, pedir);

  B.registrar("agent", {
    html: function(d){ var a = adoptar(d || {}); setTimeout(contar, 0); return cajaAgente(a); },
    pintar: function(d, nodo){ var a = adoptar(d || {}); setTimeout(contar, 0); return B.reemplazar(nodo, cajaAgente(a)); },
    destruir: function(){ vivo.base = null; vivo.hash = null; vivo.ok = 0; },   // los dos timers los apaga el shell (`B.cada`)
    recibir: recibir, contar: contar, pedir: pedir, durCol: durCol, reanudar: reanudar,
    vivo: function(){ return {offset: vivo.offset, hash: vivo.hash, recibidos: vivo.recibidos, repintados: vivo.repintados,
                              espera: vivo.espera, ok: vivo.ok, edad: edadViva(), viejo: esViejo(),
                              ahora: vivo.base ? vivo.base.ahora : null, filas: vivo.base ? (vivo.base.tabla || []).length : 0}; },
    nomTarea: nomTarea, qFila: qFila
  });
})();
