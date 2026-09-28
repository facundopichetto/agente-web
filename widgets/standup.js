// widget `standup` del board (orden 2267, facundo 2026-09-28): el draft de la proxima standup de awtomic y, arriba,
// el dia y la hora en que la tiene que dar. *"ahi escribis la standup siguiente y cuándo es [...] la idea es que lo
// que te corrijo lo aprendas y eventualmente se haga siempre sola"*. eligio la C: el texto se edita ADENTRO del
// widget, al salir del foco se guarda y el diff contra el draft se vuelve regla solo; `mandada` cierra la vuelta.
// modulo de widget (orden 1793): el shell lo carga con `import()` y, en `file://` (las pruebas), con un `<script>`;
// por eso el archivo NO tiene `export` y del shell solo usa `window.__board`.
// todo lo pensado lo arma el server (`recetas/standup_widget.py` -> `widgets_json.w_standup`): el draft en ingles,
// la fecha en 12 h, las reglas aprendidas. aca no se calcula nada: se pinta, se edita y se manda.
// por la lan pide `standup.json` cada 60 s con etag (el patron de la 1849) y repinta SOLO esta caja, y NUNCA mientras
// facundo esta escribiendo adentro del textarea. nada sale a slack ni a nadie: `standup texto ...` y
// `standup mandada ...` son comandos sin modelo del daemon, que solo escriben archivos de qa.
(function(){
  var B = (typeof window !== "undefined" ? window : self).__board;
  var esc = B.esc, caja = B.caja, vacio = B.vacio;
  var POLL_MS = 60000, ESPERA_MAX = 600000;
  var vivo = {d: null, etag: null, hash: null, pidiendo: false, espera: 0, hasta: 0, recibidos: 0, repintados: 0,
              saltados: 0};
  var ultimo = null, mandados = 0, guardados = 0;   // lo lee `prueba_web_standup`
  // el shell repinta TODO el panel con `innerHTML` cada 30 s: si facundo esta escribiendo adentro del textarea, la
  // caja nueva sale con lo que tiene tipeado y el foco (y el cursor) vuelven al textarea nuevo en el mismo tick
  var pendiente = null;

  function estado(){ return {ultimo: ultimo, mandados: mandados, guardados: guardados, saltados: vivo.saltados}; }

  // ---------- la caja ----------
  function textoDe(w){ return (w && (w.texto || w.draft)) || ""; }
  function filas(t){
    var n = (t.match(/\n/g) || []).length + 2;
    return Math.max(6, Math.min(24, n));
  }
  function cajaStandup(w){
    w = w || {};
    if(w.error) return caja("standup", "", vacio(w.error), false, "standup");
    var px = w.proxima || {};
    var t = textoDe(w);
    var a = areaDe(nodoCaja());
    if(a && document.activeElement === a){   // repintado con facundo escribiendo: lo suyo manda, y el foco vuelve
      pendiente = {valor: a.value, ini: a.selectionStart, fin: a.selectionEnd, alto: a.style.height};
      t = a.value;
      vivo.saltados++;
      setTimeout(volverFoco, 0);
    }
    var cab = '<div class="stucab"><span class="g">la das el</span> ' +
              '<span class="v b stucuando">' + esc(px.texto || "?") + "</span>" +
              (px.hoy ? ' <span class="c">hoy</span>' : "") + "</div>";
    var area = '<textarea class="stutxt" rows="' + filas(t) + '" spellcheck="false" autocapitalize="off" ' +
               'autocorrect="off" aria-label="draft de la standup" placeholder="' +
               (t ? "" : "sin novedades desde la última standup") + '">' + esc(t) + "</textarea>";
    var nota = w.texto ? "corregida por vos" + (w.editado ? " · " + esc(horaCorta(w.editado)) : "")
                       : "draft armado solo" + (w.reglas_aplicadas ? " · " + w.reglas_aplicadas + " reglas aplicadas" : "");
    if(w.reglas) nota += ' · <span class="c">' + w.reglas + " aprendidas</span>";
    if(w.mandada && w.mandada.fecha) nota += ' · <span class="g">última mandada ' + esc(w.mandada.fecha.slice(5).split("-").reverse().join("/")) +
                                             " " + esc(w.mandada.hora || "") + "</span>";
    var pie = '<div class="stupie"><span class="g stunota">' + nota + "</span>" +
              '<button class="qforz stumand" type="button" title="ya la di: guarda el texto y arma la siguiente">mandada</button></div>';
    var ese = '<span class="v b">' + esc(px.dia || "") + " " + esc(px.ddmm || "") + '</span> <span class="g">·</span> ' +
              '<span class="b">' + esc(px.hora || "") + "</span>";
    return caja("standup", ese, '<div class="stu">' + cab + area + pie + "</div>", false, "standup");
  }
  function horaCorta(iso){
    // `2026-09-28T11:40:12-03:00` -> `11:40 am`. la unica cuenta de la web, y es de formato, no de hora
    var m = /T(\d\d):(\d\d)/.exec(iso || "");
    if(!m) return "";
    var h = +m[1], ap = h >= 12 ? "pm" : "am";
    h = h % 12; if(h === 0) h = 12;
    return h + ":" + m[2] + " " + ap;
  }

  // ---------- editar y mandar ----------
  function nodoCaja(){ return document.querySelector('#widgets [data-w="standup"]'); }
  function areaDe(nodo){ return nodo ? nodo.querySelector(".stutxt") : null; }
  function volverFoco(){
    var pd = pendiente; pendiente = null;
    var a = areaDe(nodoCaja());
    if(!pd || !a) return;
    if(a.value !== pd.valor) a.value = pd.valor;
    if(pd.alto) a.style.height = pd.alto;
    try{ a.focus({preventScroll: true}); a.setSelectionRange(pd.ini, pd.fin); } catch(e){}
  }
  function editando(){
    var a = areaDe(nodoCaja());
    return !!(a && document.activeElement === a);
  }
  function mandar(cmd){
    ultimo = {cmd: cmd, tema: "board"};
    return B.mandarAparte(cmd, "board");
  }
  function notaPoner(txt){
    var n = nodoCaja(), s = n && n.querySelector(".stunota");
    if(s) s.textContent = txt;
  }
  // al salir del foco: si el texto cambio contra lo que el server tiene, se guarda (y el server aprende del diff)
  function alSalir(ev){
    var a = ev.target;
    if(!a || !a.classList || !a.classList.contains("stutxt")) return;
    if(pendiente || !document.contains(a)) return;   // el foco se fue porque el shell repinto la caja, no porque salio facundo
    if(!a.closest('#widgets [data-w="standup"]')) return;
    var v = a.value.replace(/\r\n/g, "\n"), base = textoDe(vivo.d);
    if(v.trim() === base.trim()) return;
    if(!vivo.d) vivo.d = {};
    vivo.d.texto = v;   // lo que se ve queda como esta; el server confirma en el proximo `standup.json`
    guardados++;
    B.datos("standup", vivo.d);
    notaPoner("guardando…");
    mandar("standup texto\n" + v);
  }
  function alEscribir(ev){
    var a = ev.target;
    if(!a || !a.classList || !a.classList.contains("stutxt")) return;
    var n = (a.value.match(/\n/g) || []).length + 2;
    a.rows = Math.max(6, Math.min(24, n));
  }
  // `mandada`: el texto del textarea viaja en el mismo mensaje (asi no hay dos envios pegados), el server lo guarda,
  // escribe `standup-<fecha>.md`, actualiza `última standup:` y arma la siguiente
  function alTocar(ev){
    var b = ev.target.closest && ev.target.closest('#widgets [data-w="standup"] .stumand');
    if(!b) return;
    ev.preventDefault(); ev.stopPropagation();
    var a = areaDe(nodoCaja());
    var v = a ? a.value.replace(/\r\n/g, "\n") : "";
    var cambio = v.trim() !== textoDe(vivo.d).trim();
    b.disabled = true; b.textContent = "guardando…";
    mandados++;
    var p = mandar("standup mandada" + (cambio ? "\n" + v : ""));
    Promise.resolve(p).then(function(r){
      if(r && r.ok === false){ b.disabled = false; b.textContent = "mandada"; notaPoner("no salió: " + (r.motivo || "")); return; }
      notaPoner("mandada, armo la siguiente…");
      setTimeout(function(){ pedir(true); }, 1500);
      setTimeout(function(){ pedir(true); }, 6000);
    });
  }
  document.addEventListener("focusout", alSalir, true);
  document.addEventListener("input", alEscribir, true);
  document.addEventListener("click", alTocar, true);

  // ---------- el dato fresco por la lan ----------
  function adoptar(d){ if(d) vivo.d = d; return vivo.d || {}; }
  function repintar(){
    var nodo = nodoCaja();
    if(!nodo) return false;
    if(editando()){ vivo.saltados++; return false; }   // nunca pisar lo que facundo esta escribiendo
    B.anclado(function(){ B.reemplazar(nodo, cajaStandup(vivo.d || {})); });
    vivo.repintados++;
    return true;
  }
  function recibir(j){
    if(!j || !j.standup) return false;
    vivo.recibidos++;
    var cambio = j.hash !== vivo.hash;
    vivo.hash = j.hash;
    adoptar(j.standup);
    B.datos("standup", vivo.d);
    if(cambio) repintar();
    return cambio;
  }
  function pedir(forzado){
    if(!forzado && (vivo.pidiendo || !B.lan() || !B.visible() || !nodoCaja() || Date.now() < vivo.hasta)) return null;
    if(!B.lan()) return null;
    vivo.pidiendo = true;
    return B.bajar("standup.json", forzado ? null : vivo.etag).then(function(r){
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

  B.registrar("standup", {
    html: function(d){ return cajaStandup(adoptar(d)); },
    // el repintado de 30 s del shell: con el textarea en foco la caja se queda como esta
    pintar: function(d, nodo){ return B.reemplazar(nodo, cajaStandup(adoptar(d))); },
    destruir: function(){
      document.removeEventListener("focusout", alSalir, true);
      document.removeEventListener("input", alEscribir, true);
      document.removeEventListener("click", alTocar, true);
      vivo.d = null; vivo.hash = null; vivo.etag = null;
    },
    recibir: recibir, pedir: pedir, estado: estado,
    vivo: function(){ return {recibidos: vivo.recibidos, repintados: vivo.repintados, saltados: vivo.saltados, espera: vivo.espera}; }
  });
})();
