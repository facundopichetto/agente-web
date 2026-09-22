// service worker de claudio board: notificaciones push al iphone y badge (facundo, 2026-09-12).
// no cachea nada a proposito (sin handler de fetch): la pagina va siempre a la red y se recarga sola con
// version.json. el daemon reescribe VERSION en cada publicacion, asi el navegador toma el sw nuevo.
// detalle en README.md, seccion "notificaciones push".
var VERSION = "4.429";

self.addEventListener("install", function(){ self.skipWaiting(); });
self.addEventListener("activate", function(e){ e.waitUntil(self.clients.claim()); });

// el payload lo arma `recetas/push.py`: {titulo, cuerpo, tema, tipo, badge, ts, id}. titulo = "tipo: asunto" en una
// linea y cuerpo plano de 2-3 lineas (`recetas/push_filtro.formato`, 1328). aca no se agrega nada al titulo: la
// linea con el nombre de la app ("flaudio board", del manifest) la pone ios solo en toda web push y no se puede sacar.
self.addEventListener("push", function(e){
  var d = {};
  try{ d = e.data ? e.data.json() : {}; }
  catch(x){ d = {cuerpo: e.data ? e.data.text() : ""}; }
  var tareas = [
    // ios exige mostrar una notificacion por cada push: si no, revoca la suscripcion
    self.registration.showNotification(d.titulo || "flaudio", {
      body: d.cuerpo || "", icon: "icon-192.png", badge: "icon-192.png",
      data: {tema: d.tema || null, ts: d.ts || Date.now(), id: d.id || null,
             titulo: d.titulo || "", cuerpo: d.cuerpo || ""}
    })
  ];
  var nav = self.navigator;
  if(typeof d.badge === "number" && nav && nav.setAppBadge){
    tareas.push((d.badge > 0 ? nav.setAppBadge(d.badge) : nav.clearAppBadge()).catch(function(){}));
  }
  // si el board esta abierto se entera (limpia el badge si lo estas mirando)
  tareas.push(self.clients.matchAll({type: "window", includeUncontrolled: true}).then(function(cs){
    cs.forEach(function(c){ c.postMessage({tipo: "push", tema: d.tema || null}); });
  }));
  e.waitUntil(Promise.all(tareas));
});

// tocar la notificacion (notimodal, 1350): la app NO cambia de pestaña. abre un modal encima del chat con el
// detalle; si la app estaba cerrada, abre en la ultima pestaña con `?noti=<json>` y el modal arriba.
self.addEventListener("notificationclick", function(e){
  e.notification.close();
  var dt = e.notification.data || {};
  var p = {tipo: "noti", id: dt.id || null, tema: dt.tema || null, ts: dt.ts || null,
           titulo: dt.titulo || e.notification.title || "", cuerpo: dt.cuerpo || e.notification.body || ""};
  var url = new URL("./?noti=" + encodeURIComponent(JSON.stringify(p)), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type: "window", includeUncontrolled: true}).then(function(cs){
    for(var i = 0; i < cs.length; i++){
      if("focus" in cs[i]){
        cs[i].postMessage(p);
        return cs[i].focus();
      }
    }
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});
