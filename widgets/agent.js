// widget `agent` del board: la tabla de la cola (queue): lo que paso, lo que corre y lo que espera.
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
  // (`recetas/cola_tiempos.py`): aca no se calcula ninguna, solo se pintan.
  var QCLASE = {hecha: "qpaso", fallo: "qpaso", corriendo: "qcorre", cola: "qcola"};
  function qCelda(cl, v, mas){ return '<span class="' + cl + " qcel qh" + (mas || "") + '">' + esc(v || "") + "</span>"; }
  function qFila(f){
    var cl = QCLASE[f.estado] || "qcola";
    return it({tipo: "tarea", estado: f.estado, tema: f.tema, d: f},
      '<span class="' + cl + ' qnom">' + esc(f.nombre || ("" + f.n)) +
      (f.estado === "fallo" ? ' <span class="r b">!!</span>' : "") + "</span>" +
      qCelda(cl, f.pedida) + qCelda(cl, f.iniciada) +
      qCelda(cl, f.dur, f.estado === "corriendo" ? " b" : "") + qCelda(cl, f.termino));
  }
  function qCabecera(){
    return '<span class="qth qnom">nombre</span><span class="qth qcel">pedida</span>' +
           '<span class="qth qcel">iniciada</span>' +
           '<span class="qth qcel"><span class="qhw">transcurrido / tardó</span><span class="qhn">tiempo</span></span>' +
           '<span class="qth qcel">terminó</span>';
  }
  function cajaAgente(a){
    var corr = a.corriendo || [], tabla = a.tabla || [];
    var verCola = wset("agent", "cola");
    var filas = tabla.filter(function(f){ return verCola || f.estado !== "cola"; }).map(qFila);
    filas = B.limFilas("agent", filas);
    var cuerpo = filas.length ? '<div class="qtab">' + qCabecera() + filas.join("") + "</div>"
               : (a.pausa ? '<span class="r b">PAUSA</span>' : vacio("nada en la cola"));
    // dato esencial, corto para que entre en el celu: la cuenta, cuantas corren (verde) y +las que esperan
    var ese = '<span class="c b">' + esc(a.cuenta || "?") + "</span> " +
              (a.pausa ? '<span class="r b">PAUSA</span>'
                       : corr.length ? '<span class="v b">' + corr.length + "</span>" : '<span class="g">idle</span>') +
              (a.pendientes ? ' <span class="qcola">+' + a.pendientes + "</span>" : "");
    return caja("queue", ese, cuerpo, false, "agent");
  }

  B.registrar("agent", {
    html: function(d){ return cajaAgente(d || {}); },
    pintar: function(d, nodo){ return B.reemplazar(nodo, cajaAgente(d || {})); },
    destruir: function(){},   // sin timers ni listeners propios: la tabla es html y nada mas
    nomTarea: nomTarea, qFila: qFila
  });
})();
