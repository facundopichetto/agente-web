// widget `madrugada` del board (orden 1959, facundo 2026-09-24): la cola de tareas que el programa para cuando
// se va a dormir. *"la hora la pongo yo por tarea [...] por default a las 2 am"*, *"a la hora del comienzo de la
// cola tiene que haber 15 minutos sin inputs MIOS del chat"*.
// modulo de widget (orden 1793): el shell lo carga con `import()` y, en `file://` (las pruebas), con un
// `<script>`; por eso el archivo NO tiene `export` y del shell solo usa `window.__board`.
// todo lo pensado lo arma el server (`recetas/madrugada.py` -> `widgets_json.w_madrugada`): la hora en 12 h, la
// duracion estimada, el `%` de la semana de una cuenta de usd 200 y la linea del pie. aca no se calcula nada.
// por la lan pide `madrugada.json` cada 30 s con etag (el patron de la 1849) y repinta SOLO esta caja; sin lan
// queda el `widgets.json` publicado. tocar una fila abre su ficha, y la ficha pide el dato fresco antes de
// abrirse ({modalviejo}: ningun modal se abre con datos viejos).
(function(){
  var B = (typeof window !== "undefined" ? window : self).__board;
  var esc = B.esc, caja = B.caja, vacio = B.vacio;
  var POLL_MS = 30000, ESPERA_MAX = 300000;
  var vivo = {d: null, etag: null, hash: null, pidiendo: false, espera: 0, hasta: 0, recibidos: 0, repintados: 0};
  var maModal = null, maUltimo = null, maAbierta = null;

  function estado(){ return {ultimo: maUltimo, abierta: maAbierta}; }   // lo lee `prueba_web_madrugada`

  // ---------- la caja ----------
  function celda(cl, v, mas){ return '<span class="' + cl + " qcel qh" + (mas || "") + '">' + esc(v || "") + "</span>"; }
  function fila(f){
    var cl = f.estado === "corriendo" ? "qcorre" : "qcola";
    return '<span class="' + cl + ' qnom" data-mad="' + esc(String(f.n)) + '" title="' + esc(f.texto || "") + '">' +
             esc(f.nombre || "") + (f.nota ? ' <span class="c">✎</span>' : "") + "</span>" +
           celda(cl, f.hora) + celda(cl, f.min + " min") + celda(cl, f.pct + "%");
  }
  function cabecera(){
    return '<span class="qth qnom">tarea</span><span class="qth qcel">arranca</span>' +
           '<span class="qth qcel">dura</span><span class="qth qcel">semana</span>';
  }
  function cajaMadrugada(w){
    w = w || {};
    if(w.error) return caja("madrugada", "", vacio(w.error), false, "madrugada");
    var fs = w.filas || [];
    // arriba de todo, el boton de largar la cola ya (el "me voy a dormir"): saltea la espera de 15 min
    var boton = fs.length ? '<div class="madpie">' +
        '<button class="qforz" type="button" data-msg="madrugada ' + (w.largada ? "esperar" : "ya") + '">' +
        (w.largada ? "volver a esperarme" : "me voy a dormir: largá la cola") + "</button></div>" : "";
    var cols = [fs.map(function(f){ return f.nombre; }), fs.map(function(f){ return f.hora; }),
                fs.map(function(f){ return f.min + " min"; }), fs.map(function(f){ return f.pct + "%"; })];
    var cuerpo = boton + (fs.length
      ? '<div class="madtab igtab" style="grid-template-columns:' + esc(B.gridFr(cols)) + '">' +
        cabecera() + B.limFilas("madrugada", fs.map(fila)).join("") + "</div>"
      : vacio("nada para esta madrugada"));
    cuerpo += '<div class="g igpie">' + esc(w.linea || "") +
              (w.ultimo_input ? ' <span class="g">· escribiste ' + esc(w.ultimo_input) + "</span>" : "") + "</div>";
    var ese = fs.length ? '<span class="v b">' + fs.length + "</span> " +
                          '<span class="g">para la madrugada ·</span> <span class="b">' + (w.total_pct || 0) +
                          '%</span> <span class="g">de la semana</span>'
                        : '<span class="g">vacía</span>';
    return caja("madrugada", ese, cuerpo, false, "madrugada");
  }

  // ---------- la ficha de una tarea ----------
  function filaDe(n){
    return ((vivo.d || {}).filas || []).filter(function(f){ return String(f.n) === String(n); })[0] || null;
  }
  function inputVal(sel){
    var el = maModal && maModal.el && maModal.el.querySelector(sel);
    return el ? el.value : "";
  }
  function mandar(cmd){
    maUltimo = {cmd: cmd, tema: "board"};   // lo lee `prueba_web_madrugada`
    B.mandarAparte(cmd, "board");
  }
  function fichaHtml(f){
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
      return maModal.abrir({
        titulo: f.nombre, cuenta: f.estado === "corriendo" ? "corriendo" : "programada",
        html: fichaHtml(f),
        botones: [
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
        ]});
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
    var cambio = j.hash !== vivo.hash || JSON.stringify(j.madrugada.filas) !== JSON.stringify((vivo.d || {}).filas);
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
    return B.bajar("madrugada.json", forzado ? null : vivo.etag).then(function(r){
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

  B.registrar("madrugada", {
    html: function(d){ return cajaMadrugada(adoptar(d)); },
    pintar: function(d, nodo){ return B.reemplazar(nodo, cajaMadrugada(adoptar(d))); },
    destruir: function(){ vivo.d = null; vivo.hash = null; vivo.etag = null; maAbierta = null; },
    recibir: recibir, pedir: pedir, fichaAbrir: fichaAbrir, estado: estado,
    vivo: function(){ return {recibidos: vivo.recibidos, repintados: vivo.repintados, espera: vivo.espera,
                              filas: ((vivo.d || {}).filas || []).length}; }
  });
})();
