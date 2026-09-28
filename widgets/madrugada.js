// widget `madrugada` del board (orden 1959, facundo 2026-09-24; reescrito en la 2302): la cola de tareas que el
// programa para cuando se va a dormir. *"la hora la pongo yo por tarea [...] por default a las 2 am"*, *"a la hora
// del comienzo de la cola tiene que haber 15 minutos sin inputs MIOS del chat"*.
// modulo de widget (orden 1793): el shell lo carga con `import()` y, en `file://` (las pruebas), con un
// `<script>`; por eso el archivo NO tiene `export` y del shell solo usa `window.__board`.
// 2302 (facundo: *"ese archivo no existe, asi que el widget siempre se ve vacio"*): NO hay ningun
// `web/madrugada.json` en disco ni se escribe ninguno. `madrugada.json` es el nombre de un ENDPOINT del daemon
// (`daemon.py`, `local_json`), que llama a `recetas/madrugada.widget()` y lee la cola de verdad en el momento
// (`ordenes.md`, la vista de `cola.db`), cero tokens. lo que cambio aca: se pintan las dos tablas (las que
// esperan y las que YA corrieron con su resultado), un error del endpoint se DICE en la caja en vez de quedar
// como caja vacia, y la caja nunca queda muda: siempre hay una linea que cuenta que pasa.
// todo lo pensado lo arma el server (la hora en 12 h, la duracion, el `%` de la semana de una cuenta de usd 200
// y la linea del pie). aca no se calcula nada.
(function(){
  var B = (typeof window !== "undefined" ? window : self).__board;
  var esc = B.esc, caja = B.caja, vacio = B.vacio;
  var POLL_MS = 30000, ESPERA_MAX = 300000;
  // el endpoint del daemon que arma la cola de madrugada en el momento (NO es un archivo: ver la cabecera)
  var RUTA = "madrugada.json";
  var vivo = {d: null, etag: null, hash: null, pidiendo: false, espera: 0, hasta: 0, recibidos: 0,
              repintados: 0, err: null};
  var maModal = null, maUltimo = null, maAbierta = null;

  function estado(){ return {ultimo: maUltimo, abierta: maAbierta}; }   // lo lee `prueba_web_madrugada`

  // ---------- la caja ----------
  function celda(cl, v, mas){ return '<span class="' + cl + " qcel qh" + (mas || "") + '">' + esc(v || "") + "</span>"; }
  function num(v, suf){ return (v === null || v === undefined || v === "") ? "·" : (v + (suf || "")); }
  function fila(f){
    var cl = f.estado === "corriendo" ? "qcorre" : "qcola";
    return '<span class="' + cl + ' qnom" data-mad="' + esc(String(f.n)) + '" title="' + esc(f.texto || "") + '">' +
             esc(f.nombre || "") + (f.tema ? ' <span class="g">' + esc(f.tema) + "</span>" : "") +
             (f.nota ? ' <span class="c">✎</span>' : "") + "</span>" +
           celda(cl, f.hora) + celda(cl, num(f.min, " min")) + celda(cl, num(f.pct, "%"));
  }
  function cabecera(c3){
    return '<span class="qth qnom">tarea</span><span class="qth qcel">' + esc(c3) + "</span>" +
           '<span class="qth qcel">dura</span><span class="qth qcel">semana</span>';
  }
  // 2302: la tabla de abajo, las que YA corrieron. el glifo dice como salieron (`✓` ok, `✗` fallo, `⊘` cancelada)
  // y la fila sigue siendo tocable: abre la misma ficha con su texto entero.
  var GLIFO = {ok: ["✓", "qcorre"], fallo: ["✗", "qfren"], cancelada: ["⊘", "qpaso"]};
  function filaHecha(f){
    var g = GLIFO[f.estado] || GLIFO.ok, cl = g[1];
    return '<span class="' + cl + ' qnom" data-mad="' + esc(String(f.n)) + '" title="' + esc(f.texto || "") + '">' +
             '<span class="' + cl + '">' + g[0] + "</span> " + esc(f.nombre || "") +
             (f.tema ? ' <span class="g">' + esc(f.tema) + "</span>" : "") + "</span>" +
           celda(cl, f.hora) + celda(cl, num(f.min, " min")) + celda(cl, num(f.pct, "%"));
  }
  function tabla(clave, fs, c3, pinta){
    var cols = [fs.map(function(f){ return f.nombre + (f.tema ? " " + f.tema : ""); }),
                fs.map(function(f){ return f.hora; }),
                fs.map(function(f){ return num(f.min, " min"); }), fs.map(function(f){ return num(f.pct, "%"); })];
    return '<div class="madtab igtab" style="grid-template-columns:' + esc(B.gridFr(cols)) + '">' +
           cabecera(c3) + B.limFilas(clave, fs.map(pinta)).join("") + "</div>";
  }
  function cajaMadrugada(w){
    w = w || {};
    if(w.error) return caja("madrugada", "", vacio(w.error), false, "madrugada");
    var fs = w.filas || [], hs = w.corridas || [];
    // arriba de todo, el boton de largar la cola ya (el "me voy a dormir"): saltea la espera de 15 min
    var boton = fs.length ? '<div class="madpie">' +
        '<button class="qforz" type="button" data-msg="madrugada ' + (w.largada ? "esperar" : "ya") + '">' +
        (w.largada ? "volver a esperarme" : "me voy a dormir: largá la cola") + "</button></div>" : "";
    var cuerpo = boton + (fs.length ? tabla("madrugada", fs, "arranca", fila)
                                    : vacio("nada esperando la madrugada"));
    if(hs.length){
      cuerpo += '<div class="madsub g">' + esc(w.corridas_titulo || "ya corrieron") + "</div>" +
                tabla("madrugada", hs, "corrió", filaHecha);
    }
    // la linea del pie la arma el server y NUNCA viene vacia; si el endpoint no contesto, lo dice aca
    cuerpo += '<div class="g igpie">' + esc(w.linea || "sin novedades de la cola de madrugada") +
              (w.ultimo_input ? ' <span class="g">· escribiste ' + esc(w.ultimo_input) + "</span>" : "") +
              (vivo.err ? ' <span class="r">· ' + esc(vivo.err) + "</span>" : "") + "</div>";
    var ese = fs.length ? '<span class="v b">' + fs.length + "</span> " +
                          '<span class="g">para la madrugada ·</span> <span class="b">' + (w.total_pct || 0) +
                          '%</span> <span class="g">de la semana</span>'
                        : (hs.length ? '<span class="g">nada pendiente ·</span> <span class="b">' + hs.length +
                                       '</span> <span class="g">' + esc(hs.length === 1 ? "corrió" : "corrieron") +
                                       "</span>"
                                     : '<span class="g">vacía</span>');
    return caja("madrugada", ese, cuerpo, false, "madrugada");
  }

  // ---------- la ficha de una tarea ----------
  function filaDe(n){
    var d = vivo.d || {}, todas = (d.filas || []).concat(d.corridas || []);
    return todas.filter(function(f){ return String(f.n) === String(n); })[0] || null;
  }
  function yaCorrio(f){ return !!f && (f.estado === "ok" || f.estado === "fallo" || f.estado === "cancelada"); }
  function inputVal(sel){
    var el = maModal && maModal.el && maModal.el.querySelector(sel);
    return el ? el.value : "";
  }
  function mandar(cmd){
    maUltimo = {cmd: cmd, tema: "board"};   // lo lee `prueba_web_madrugada`
    B.mandarAparte(cmd, "board");
  }
  function fichaHtml(f){
    if(yaCorrio(f)){
      // 2302: una que ya corrio no se re-programa: la ficha cuenta como salio y muestra el texto entero
      var g = GLIFO[f.estado] || GLIFO.ok;
      return '<div class="cmod">' +
        '<span class="' + g[1] + '">' + g[0] + " " + esc(f.estado) + "</span>" +
        ' <span class="g">· cerró</span> <span class="b">' + esc(f.hora) + "</span>" +
        (f.fecha ? ' <span class="g">' + esc(f.fecha) + "</span>" : "") +
        (f.min ? ' <span class="g">· tardó</span> ' + esc(String(f.min)) + ' <span class="g">min</span>' : "") +
        (f.pct === null || f.pct === undefined ? ""
          : ' <span class="g">· salió</span> ' + esc(String(f.pct)) + '<span class="g">% de la semana</span>') +
        '\n<div class="madtxt">' + esc(f.texto || "") + "</div></div>";
    }
    return '<div class="cmod">' +
      '<span class="g">arranca</span> <span class="b">' + esc(f.hora) + "</span>" +
      ' <span class="g">· dura ~</span>' + esc(String(f.min)) + ' <span class="g">min · sale ~</span>' +
      esc(String(f.pct)) + '<span class="g">% de la semana</span>' +
      '\n<div class="madtxt">' + esc(f.texto || "") + "</div>" +
      '<label class="g madlbl">hora de arranque' +
      '<input class="madhora" type="time" value="' + esc(f.hora_hhmm || "02:00") + '"></label>' +
      '<label class="g madlbl">nota para esta tarea' +
      '<textarea class="madnota" rows="2" placeholder="lo que quieras decirle a la tarea">' +
      esc(f.nota || "") + "</textarea></label></div>";
  }
  // {modalviejo} + {cache}: la ficha pide el dato fresco al server antes de abrirse; sin lan abre con lo
  // ultimo que llego en `widgets.json`, que es lo mismo que pinta la caja.
  function fichaAbrir(n){
    if(!B.modalMolde) return Promise.resolve(false);
    if(!maModal) maModal = B.modalMolde({id: "madmodal", z: 43, sinServer: true,
                                         alCerrar: function(){ maAbierta = null; }});
    return Promise.resolve(B.lan() ? pedir(true) : null).then(function(){
      var f = filaDe(n);
      if(!f) return false;
      maAbierta = f.n;
      var btns = yaCorrio(f) ? [] : [
          {tipo: "verde", txt: "guardar", accion: function(m){
            var h = inputVal(".madhora"), nota = inputVal(".madnota");
            if(h && h !== f.hora_hhmm) mandar("madrugada hora " + f.n + " " + h);
            if((nota || "") !== (f.nota || "")) mandar("madrugada nota " + f.n + " " + nota);
            m.estado("guardado");
            setTimeout(function(){ m.cerrar(false); }, 700);
          }},
          {tipo: "rojo", txt: "sacar de la madrugada", accion: function(m){
            mandar("madrugada sacar " + f.n);
            m.estado("la saqué: vuelve a la cola normal");
            setTimeout(function(){ m.cerrar(false); }, 700);
          }}
        ];
      return maModal.abrir({
        titulo: f.nombre,
        cuenta: yaCorrio(f) ? ("ya corrió · " + f.estado) : (f.estado === "corriendo" ? "corriendo" : "programada"),
        html: fichaHtml(f), botones: btns});
    });
  }
  function alTocar(ev){
    var n = ev.target.closest && ev.target.closest('#widgets [data-w="madrugada"] [data-mad]');
    if(!n) return;
    ev.preventDefault(); ev.stopPropagation();
    fichaAbrir(n.getAttribute("data-mad"));
  }
  document.addEventListener("click", alTocar, true);

  // ---------- el dato fresco por la lan ----------
  function nodoCaja(){ return document.querySelector('#widgets [data-w="madrugada"]'); }
  function adoptar(d){ if(d) vivo.d = d; return vivo.d || {}; }
  function repintar(){
    var nodo = nodoCaja();
    if(!nodo) return false;
    B.anclado(function(){ B.reemplazar(nodo, cajaMadrugada(vivo.d || {})); });
    vivo.repintados++;
    return true;
  }
  function recibir(j){
    if(!j || !j.madrugada) return false;
    vivo.recibidos++;
    vivo.err = null;
    var cambio = j.hash !== vivo.hash ||
                 JSON.stringify([j.madrugada.filas, j.madrugada.corridas]) !==
                 JSON.stringify([(vivo.d || {}).filas, (vivo.d || {}).corridas]);
    vivo.hash = j.hash;
    adoptar(j.madrugada);
    B.datos("madrugada", vivo.d);
    if(cambio) repintar();
    return cambio;
  }
  function pedir(forzado){
    if(!forzado && (vivo.pidiendo || !B.lan() || !B.visible() || !nodoCaja() || Date.now() < vivo.hasta)) return null;
    if(!B.lan()) return null;
    vivo.pidiendo = true;
    return B.bajar(RUTA, forzado ? null : vivo.etag).then(function(r){
      vivo.pidiendo = false; vivo.espera = 0; vivo.hasta = 0;
      if(!r || r.status === 304) return false;
      if(r.etag) vivo.etag = r.etag;
      return recibir(r.json);
    }, function(e){
      vivo.pidiendo = false;
      vivo.espera = Math.min((vivo.espera || POLL_MS) * 2, ESPERA_MAX);
      vivo.hasta = Date.now() + vivo.espera;
      // 2302: el widget NO se queda mudo cuando el server no contesta. antes un error acá dejaba `vivo.d` en
      // null y la caja pintaba "nada para esta madrugada", que es lo que a facundo le parecia un widget vacio
      var m = (e && e.message) || "sin respuesta";
      vivo.err = "no pude leer la cola de madrugada (" + m + "), vuelvo a intentar";
      repintar();
      return false;
    });
  }
  B.cada(POLL_MS, function(){ pedir(false); });

  B.registrar("madrugada", {
    html: function(d){ return cajaMadrugada(adoptar(d)); },
    pintar: function(d, nodo){ return B.reemplazar(nodo, cajaMadrugada(adoptar(d))); },
    destruir: function(){ vivo.d = null; vivo.hash = null; vivo.etag = null; vivo.err = null; maAbierta = null; },
    recibir: recibir, pedir: pedir, fichaAbrir: fichaAbrir, estado: estado,
    vivo: function(){ return {recibidos: vivo.recibidos, repintados: vivo.repintados, espera: vivo.espera,
                              filas: ((vivo.d || {}).filas || []).length,
                              corridas: ((vivo.d || {}).corridas || []).length, err: vivo.err}; }
  });
})();
