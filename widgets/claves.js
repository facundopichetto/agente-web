// 2190 {vista}: la vista `claves` del board — la bóveda, leída por el SERVER (`recetas/web_claves.py`).
//
// facundo, 2026-09-23: "escribime el valor de manera que sea un script el que me lo dice y no una AI".
// el listado viene SIN valores (`GET /claves`) y el valor de una clave se pide de a uno, y solo cuando
// facundo toca esa fila (`GET /claves/<id>`, que la lan sirve nada mas que al board local). el modelo no
// toca nada de esto y ningún valor queda en `log.md`.
//
// es un modulo suelto para entrar en el repintado por pedazos (1793 {pedazos}): sin `export`, se registra
// en `window.__board` y el shell le pasa el nodo `#clavesvista` por `abrir()`. como es una VISTA y no una
// caja de `#widgets`, declara `vista: "clavesvista"` para que `repintarMod` sepa dónde repintarlo.
// 2143 {cache}: entrar a la vista SIEMPRE pide fresco al server; lo último que llegó pinta el primer frame
// y, si el pedido falla, queda eso CON aviso, nunca una pantalla en blanco.
(function(){
  var B = window.__board;
  if(!B) return;

  var st = {lista: null, aviso: "", q: "", abierta: null, valores: {}, cargando: false, nodo: null};

  function pedir(ruta){ return B.pedir(ruta); }

  function cargar(){
    st.cargando = true;
    pintar();
    return pedir("/claves").then(function(j){
      st.lista = j; st.aviso = ""; st.cargando = false;
      pintar();
      return j;
    }, function(e){
      st.cargando = false;
      st.aviso = st.lista ? "no pude pedirlo al server, esto es lo último que llegó" : "no pude pedirlo al server";
      pintar();
      return null;
    });
  }

  // el valor de UNA clave, recién cuando facundo toca su fila. no se cachea entre visitas: vive en memoria
  // mientras la vista está abierta y se borra al salir (`destruir`).
  function abrirFila(id){
    if(st.abierta === id){ st.abierta = null; pintar(); return Promise.resolve(null); }
    st.abierta = id;
    pintar();
    if(st.valores[id] != null) return Promise.resolve(st.valores[id]);
    return pedir("/claves/" + encodeURIComponent(id)).then(function(j){
      st.valores[id] = (j && j.valor) || "";
      if(st.abierta === id) pintar();
      return st.valores[id];
    }, function(){
      st.valores[id] = null;
      st.aviso = "no pude leer esa clave";
      pintar();
      return null;
    });
  }

  function filtradas(){
    var fs = ((st.lista || {}).claves || []).slice();
    var q = (st.q || "").trim().toLowerCase();
    if(!q) return fs;
    var pal = q.split(/\s+/);
    return fs.filter(function(f){
      var heno = ((f.que || "") + " " + (f.usuario || "") + " " + (f.tema || "") + " " + (f.boveda || "")).toLowerCase();
      return pal.every(function(p){ return heno.indexOf(p) >= 0; });
    });
  }

  function pintar(){
    var el = st.nodo;
    if(!el) return "";
    el.textContent = "";
    var cu = document.getElementById("clavescuenta");
    if(cu){
      var n = filtradas().length;
      cu.textContent = st.lista ? (n + (n === 1 ? " clave" : " claves")) : (st.cargando ? "pidiendo..." : "");
    }
    if(st.aviso){
      var a = document.createElement("div"); a.className = "cvaviso"; a.textContent = st.aviso;
      el.appendChild(a);
    }
    var bus = document.createElement("input");
    bus.id = "clavesq"; bus.className = "cvq"; bus.type = "search"; bus.value = st.q;
    bus.placeholder = "buscar por nombre";
    bus.setAttribute("autocomplete", "off");
    bus.setAttribute("autocapitalize", "off");
    bus.setAttribute("spellcheck", "false");
    bus.addEventListener("input", function(){ st.q = bus.value; pintar(); document.getElementById("clavesq").focus(); });
    el.appendChild(bus);

    var lista = document.createElement("div"); lista.id = "claveslista"; lista.className = "cvlista";
    el.appendChild(lista);
    var fs = filtradas();
    if(!fs.length){
      var v = document.createElement("div"); v.className = "cvvacio";
      v.textContent = st.lista ? (st.q ? "nada con eso" : "la bóveda está vacía") : "pidiendo la bóveda al server...";
      lista.appendChild(v);
      return el.innerHTML;
    }
    fs.forEach(function(f){ lista.appendChild(fila(f)); });
    return el.innerHTML;
  }

  function fila(f){
    var abierta = st.abierta === f.id;
    var d = document.createElement("div");
    d.className = "cvfila" + (abierta ? " abierta" : "");
    d.setAttribute("data-id", f.id);

    var cab = document.createElement("button");
    cab.type = "button"; cab.className = "cvcab";
    cab.setAttribute("aria-expanded", abierta ? "true" : "false");
    var q = document.createElement("span"); q.className = "cvque"; q.textContent = f.que || "(sin nombre)";
    cab.appendChild(q);
    var meta = document.createElement("span"); meta.className = "cvmeta";
    meta.textContent = [f.usuario ? "usuario " + f.usuario : "", f.boveda].filter(Boolean).join(" · ");
    cab.appendChild(meta);
    cab.addEventListener("click", function(){ abrirFila(f.id); });
    d.appendChild(cab);

    if(abierta){
      var caja = document.createElement("div"); caja.className = "cvvalor";
      var v = st.valores[f.id];
      var code = document.createElement("code"); code.className = "cvcode";
      code.textContent = v == null ? (st.valores.hasOwnProperty(f.id) ? "no pude leerla" : "pidiendo...") : v;
      caja.appendChild(code);
      if(v){
        var bt = document.createElement("button");
        bt.type = "button"; bt.className = "cvcopiar"; bt.textContent = "copiar";
        // el portapapeles se pide ADENTRO del click (gesto del usuario), como el resto del board (1214)
        bt.addEventListener("click", function(e){ e.stopPropagation(); B.tocarCopiar(bt, v); });
        caja.appendChild(bt);
      }
      d.appendChild(caja);
      if(f.fecha || f.tema){
        var pie = document.createElement("div"); pie.className = "cvpie";
        pie.textContent = [f.tema ? "tema " + f.tema : "", f.fecha].filter(Boolean).join(" · ");
        d.appendChild(pie);
      }
    }
    return d;
  }

  B.registrar("claves", {
    vista: "clavesvista",            // no es una caja de `#widgets`: es la vista entera
    // `abrir(nodo, fresco)`: el shell entrega el contenedor. con `fresco` (entrar a la vista) pide al server.
    abrir: function(nodo, fresco){
      st.nodo = nodo;
      pintar();
      return fresco ? cargar() : Promise.resolve(st.lista);
    },
    html: function(){ return ""; },   // no tiene caja en el panel de widgets
    pintar: function(_datos, nodo){ if(nodo) st.nodo = nodo; return pintar(); },
    // nada colgado: ni timers, ni el valor de una clave en memoria despues de soltar el modulo
    destruir: function(){ st.valores = {}; st.abierta = null; st.nodo = null; },
    estado: function(){ return {total: (st.lista || {}).total || 0, abierta: st.abierta, q: st.q,
                                aviso: st.aviso, leidas: Object.keys(st.valores).length}; },
    recargar: cargar, abrirFila: abrirFila
  });
})();
