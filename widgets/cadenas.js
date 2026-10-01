// widget `cadenas` del board ({limpiar}, facundo 2026-10-01): una fila por parte del chat (chat, entendi, acciones,
// cola) con su modelo, y la cadena entera con el modelo REAL de cada eslabon (`groq` = `openai/gpt-oss-120b`,
// `sonnet` = `claude-sonnet-5-5`). antes eran filas de abajo del widget `USAGE` (2569 {cadena}); ahora tiene su caja.
// el desplegable manda el MISMO texto que el comando (`chat groq`, `acciones vuelve`) por `mandarAparte`, y el daemon
// lo atiende sin modelo (`atajo_partes`). la cola no tiene desplegable: no se cambia desde aca. todo llega armado del
// server (`modelo_partes.widget`): la web no decide ningun modelo. sin plata y sin pie ({sinpie}).
// modulo de widget (orden 1793): sin `export`, del shell solo usa `window.__board`.
(function(){
  var B = (typeof window !== "undefined" ? window : self).__board;
  var esc = B.esc, caja = B.caja, vacio = B.vacio;
  var parteUltimo = null;
  function realDe(p, m){ return (p.reales || {})[m] || ""; }
  function filaParte(p){
    var sel;
    if(p.editable){
      sel = '<select class="gparte-sel" data-parte="' + esc(p.parte) + '" aria-label="modelo de ' + esc(p.nombre) + '">' +
        (p.opciones || []).map(function(o){
          // la opcion `cadena` dice quien atiende de verdad hoy, no la palabra pelada
          var et = o === "cadena" && p.atiende ? "cadena · " + p.atiende : o;
          return '<option value="' + esc(o) + '"' + (o === p.modelo ? " selected" : "") + ">" + esc(et) + "</option>";
        }).join("") + "</select>";
    } else {
      sel = '<span class="gparte-fijo">' + esc(p.modelo || "?") + "</span>";
    }
    var cad = (p.cadena || []).map(function(m, i){
      var r = realDe(p, m);
      return '<span class="gparte-p' + (i === 0 && !p.override ? " primero" : "") + '">' + esc(m) +
        (r && r !== m ? ' <b>' + esc(r) + "</b>" : "") + "</span>";
    });
    var hoy = p.editable ? (p.atiende_real || "") : (p.real || "");
    var pie = p.editable
      ? '<span class="gparte-pts">' + cad.join("") + "</span>"
      : '<span class="gparte-pts"><span class="gparte-p primero">' + esc(hoy) + "</span>" +
        '<span class="gparte-p">' + esc(p.detalle || "") + "</span></span>";
    return '<div class="gparte conpuntos" title="' + esc(p.nombre + ": " + (p.detalle || "")) + '">' +
      '<span class="gparte-n">' + esc(p.nombre) + "</span>" + sel + pie + "</div>";
  }
  function alCambiarParte(ev){
    var n = ev.target;
    if(!n || !n.classList || !n.classList.contains("gparte-sel")) return;
    var parte = n.getAttribute("data-parte"), v = n.value;
    parteUltimo = {cmd: parte + " " + (v === "cadena" ? "vuelve" : v), tema: "modelos", aparte: true};
    if(B.mandarAparte) B.mandarAparte(parteUltimo.cmd, "modelos");
  }
  document.addEventListener("change", alCambiarParte, true);
  function cajaCadenas(d){
    var ps = (d && d.partes) || [];
    var cuerpo = ps.length ? '<div class="usage cadenas"><div class="gpartes">' + ps.map(filaParte).join("") + "</div></div>"
                           : vacio(d && d.error ? "no pude leer las cadenas: " + d.error : "sin cadenas");
    return caja("CADENAS", "", cuerpo, false, "cadenas");
  }
  B.registrar("cadenas", {
    html: function(d){ return cajaCadenas(d || {}); },
    pintar: function(d, nodo){ return B.reemplazar(nodo, cajaCadenas(d || {})); },
    destruir: function(){ document.removeEventListener("change", alCambiarParte, true); parteUltimo = null; },
    parteEstado: function(){ return parteUltimo; }
  });
})();
