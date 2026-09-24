// Web Push service worker for the Coach app (openspec/changes/coach-web-push-notifications).
// Kept deliberately minimal: no offline caching / PWA install story, just push delivery.

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "FutbolBase";
  const body = payload.body || "";
  const deepLinkPath = payload.deepLinkPath || "/";

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body,
        data: { deepLinkPath },
      }),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
        clientsList.forEach((client) => {
          client.postMessage({ type: "rffm.push_received", title, body, deepLinkPath });
        });
      }),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const deepLinkPath = (event.notification.data && event.notification.data.deepLinkPath) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if ("focus" in client) {
          client.postMessage({ type: "rffm.notification_click", deepLinkPath });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(deepLinkPath);
      }
    })
  );
});
