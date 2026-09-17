// widget `seguidores` del board: el numero de instagram de facundo, FRESCO (orden 1915 {widgets}, 2026-09-17:
// "se actualiza lentisimo, tiene que mostrar informacion actual").
// modulo de widget (orden 1793): el shell lo carga con `import()` y, en `file://` (las pruebas), con un
// `<script>`; por eso el archivo NO tiene `export` y del shell solo usa lo que expone `window.__board`.
// el numero lo lee el server cada 10 min (`recetas/ig_contador.py`, UNA lectura de `users/<pk>/info/`) y por la
// lan este modulo pide `seguidores.json` cada 30 s con etag (igual que `agent.js` pide `cola.json`, 1849):
// sin lan no pide nada y queda el `widgets.json` publicado. cero tokens y cero decisiones: los textos de
// cuan viejo es el dato los arma el server, aca solo se pintan.
(function(){
  var B = (typeof window !== "undefined" ? window : self).__board;
  var esc = B.esc, caja = B.caja, vacio = B.vacio;
  var POLL_MS = 30000, ESPERA_MAX = 300000;
  var vivo = {d: null, etag: null, pidiendo: false, espera: 0, hasta: 0, recibidos: 0, repintados: 0};

  function cajaSeguidores(p){
    p = p || {};
    if(p.error) return caja("seguidores", "", vacio(p.error), false, "seguidores");
    var extra = '<span class="b">' + (p.seguidores || 0) + '</span> <span class="g">te siguen ·</span> ' +
                '<span class="b">' + (p.seguidos || 0) + '</span> <span class="g">seguís</span>' +
                (p.contador_viejo ? ' <span class="a">·</span>' : "");
    var filas = [], quien = function(u){
      return "@" + esc(u.usuario) + (u.nombre ? ' <span class="g">' + esc(u.nombre) + "</span>" : "");
    };
    (p.dejaron || []).forEach(function(u){ filas.push('<span class="r">-</span> ' + quien(u) + ' <span class="g">' + esc(u.fecha.slice(5)) + "</span>"); });
    (p.nuevos || []).forEach(function(u){ filas.push('<span class="v">+</span> ' + quien(u) + ' <span class="g">' + esc(u.fecha.slice(5)) + "</span>"); });
    if(!filas.length) filas.push(vacio("sin bajas ni altas en " + (p.dias || 7) + " días"));
    var pie = "no te siguen <b>" + (p.no_me_siguen === null || p.no_me_siguen === undefined ? "?" : p.no_me_siguen) + "</b>";
    if((p.dejaste || []).length || (p.seguiste || []).length)
      pie += ' <span class="g">· vos: -' + (p.dejaste || []).length + " +" + (p.seguiste || []).length + "</span>";
    if(p.fecha) pie += ' <span class="g">· foto ' + esc(p.fecha.slice(5)) + "</span>";
    filas.push(pie);
    if(p.problema) filas.push('<span class="a">' + esc(p.problema) + "</span>");
    return caja("seguidores", extra, B.limFilas("seguidores", filas).join("\n"), false, "seguidores");
  }

  function nodoCaja(){ return document.querySelector('#widgets [data-w="seguidores"]'); }
  function adoptar(d){ if(d) vivo.d = d; return vivo.d || {}; }
  function recibir(j){
    var d = (j && j.seguidores) || null;
    if(!d) return false;
    vivo.recibidos++;
    var antes = JSON.stringify(vivo.d || {});
    vivo.d = d;
    B.datos("seguidores", d);
    if(JSON.stringify(d) === antes) return false;
    var nodo = nodoCaja();
    if(!nodo) return false;
    B.anclado(function(){ B.reemplazar(nodo, cajaSeguidores(d)); });
    vivo.repintados++;
    return true;
  }
  function pedir(){
    if(vivo.pidiendo || !B.lan() || !B.visible() || !nodoCaja() || Date.now() < vivo.hasta) return;
    vivo.pidiendo = true;
    B.bajar("seguidores.json", vivo.etag).then(function(r){
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
  B.cada(POLL_MS, pedir);

  B.registrar("seguidores", {
    html: function(d){ return cajaSeguidores(adoptar(d)); },
    pintar: function(d, nodo){ return B.reemplazar(nodo, cajaSeguidores(adoptar(d))); },
    destruir: function(){ vivo.d = null; vivo.etag = null; },   // el timer lo apaga el shell (`B.cada`)
    recibir: recibir, pedir: pedir,
    vivo: function(){ return {recibidos: vivo.recibidos, repintados: vivo.repintados, espera: vivo.espera}; }
  });
})();
