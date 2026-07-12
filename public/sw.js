// Swena — Service Worker v2
// tag/renotify/badge supprimés : certains mobiles remplacent silencieusement les notifs avec ces options

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Swena", body: event.data.text(), url: "/" };
  }
  const options = {
    body: data.body || "",
    icon: "/apple-touch-icon.png",
    data: { url: data.url || "/accueil" },
  };
  event.waitUntil(self.registration.showNotification(data.title || "Swena", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/accueil";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
