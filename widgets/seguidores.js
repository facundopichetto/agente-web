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
  var POLL_MS = 30000, ESPERA_MAX = 300000, TOPE_MOVIMIENTOS = 15;
  var vivo = {d: null, etag: null, pidiendo: false, espera: 0, hasta: 0, recibidos: 0, repintados: 0};

  function ordenarMovimientos(p){
    var tope = (p && p.tope > 0) ? Math.min(p.tope, TOPE_MOVIMIENTOS) : TOPE_MOVIMIENTOS;
    var lista = [];
    if(Array.isArray(p.movimientos)){
      p.movimientos.forEach(function(u, i){
        lista.push({usuario: u.usuario, nombre: u.nombre, fecha: u.fecha, hora: u.hora, ts: u.ts,
                    tipo: u.tipo, signo: u.signo || (u.tipo === "dejo_de_seguirte" ? "-" : "+"), _i: i});
      });
    } else {
      (p.dejaron || []).forEach(function(u, i){
        lista.push({usuario: u.usuario, nombre: u.nombre, fecha: u.fecha, hora: u.hora, ts: u.ts,
                    tipo: "dejo_de_seguirte", signo: "-", _i: i});
      });
      (p.nuevos || []).forEach(function(u, i){
        lista.push({usuario: u.usuario, nombre: u.nombre, fecha: u.fecha, hora: u.hora, ts: u.ts,
                    tipo: "te_empezo_a_seguir", signo: "+", _i: i});
      });
    }
    lista.sort(function(a, b){
      var ta = typeof a.ts === "number" ? a.ts : 0, tb = typeof b.ts === "number" ? b.ts : 0;
      if(ta !== tb) return tb - ta;
      var fa = (a.fecha || "") + " " + (a.hora || ""), fb = (b.fecha || "") + " " + (b.hora || "");
      if(fa !== fb) return fb < fa ? -1 : 1;
      return a._i - b._i;
    });
    return lista.slice(0, tope);
  }

  function cajaSeguidores(p){
    p = p || {};
    if(p.error) return caja("IG FOLLOW", "", vacio(p.error), false, "seguidores");
    var fechaHora = p.dato_hora || p.foto_hora || (p.fecha ? p.fecha.slice(5) : "");
    var extra = '<span class="b">' + (p.seguidores || 0) + '</span> ' +
                '<span class="g">/</span> ' +
                '<span class="b">' + (p.seguidos || 0) + '</span>' +
                (fechaHora ? ' <span class="g">- ' + esc(fechaHora) + "</span>" : "") +
                (p.contador_viejo ? ' <span class="a">·</span>' : "");
    var filas = [], quien = function(u){
      // {votador} (facundo, 2026-10-11): el arroba abre el votador de SU lista (`B.abrirCuenta`, handler de abajo)
      return '<a class="arroba" href="#" data-cuenta="' + esc(u.usuario) + '">@' + esc(u.usuario) + "</a>" + (u.nombre ? ' <span class="g">' + esc(u.nombre) + "</span>" : "");
    };
    ordenarMovimientos(p).forEach(function(u){
      var esBaja = u.signo === "-" || u.tipo === "dejo_de_seguirte";
      filas.push('<span class="' + (esBaja ? "r" : "v") + '">' + (esBaja ? "-" : "+") + "</span> " +
                 quien(u) + ' <span class="g">' + esc((u.fecha || "").slice(5)) + "</span>");
    });
    if(!filas.length) filas.push(vacio("sin bajas ni altas en " + (p.dias || 7) + " días"));
    var pie = "no te siguen <b>" + (p.no_me_siguen === null || p.no_me_siguen === undefined ? "?" : p.no_me_siguen) + "</b>";
    if((p.dejaste || []).length || (p.seguiste || []).length)
      pie += ' <span class="g">· vos: -' + (p.dejaste || []).length + " +" + (p.seguiste || []).length + "</span>";
    if(p.foto_hora || p.fecha) pie += ' <span class="g">· foto ' + esc(p.foto_hora || p.fecha.slice(5)) + "</span>";   // 2161: la fecha de la foto de las listas
    filas.push(pie);
    if(p.freno) filas.push('<span class="a">' + esc(p.freno) + "</span>");   // 2161: "instagram frena la lectura desde ..."
    if(p.problema) filas.push('<span class="a">' + esc(p.problema) + "</span>");
    return caja("IG FOLLOW", extra, B.limFilas("seguidores", filas).join("\n"), false, "seguidores");
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
  // un solo handler delegado: la caja se repinta entera (`B.reemplazar`) y los nodos viejos se van con sus listeners
  if(typeof document !== "undefined" && !document.__arrobasSeguidores){
    document.__arrobasSeguidores = true;
    document.addEventListener("click", function(ev){
      var a = ev.target && ev.target.closest ? ev.target.closest('[data-w="seguidores"] a.arroba') : null;
      if(!a) return;
      ev.preventDefault(); ev.stopPropagation();
      if(B.abrirCuenta) B.abrirCuenta(a.getAttribute("data-cuenta"));
    });
  }

  B.registrar("seguidores", {
    html: function(d){ return cajaSeguidores(adoptar(d)); },
    pintar: function(d, nodo){ return B.reemplazar(nodo, cajaSeguidores(adoptar(d))); },
    destruir: function(){ vivo.d = null; vivo.etag = null; },   // el timer lo apaga el shell (`B.cada`)
    recibir: recibir, pedir: pedir,
    vivo: function(){ return {recibidos: vivo.recibidos, repintados: vivo.repintados, espera: vivo.espera}; }
  });
})();
