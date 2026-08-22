/* eslint-disable no-restricted-globals */

/**
 * 10minute service worker.
 *
 * Handles two things:
 *   1. Web-push notifications for order-status updates.
 *   2. A minimal install / activate lifecycle so it registers cleanly.
 *
 * Kept deliberately small — no offline cache strategy here yet. The PWA
 * install prompt separately doesn't need this file to succeed; it's only
 * required for push. Add a workbox-style precache later if we want offline.
 */

self.addEventListener("install", (event) => {
  // Activate immediately — no waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "10minute", body: event.data.text() };
  }
  const title = payload.title || "10minute";
  const options = {
    body: payload.body || "",
    icon: "/icon",
    badge: "/icon",
    tag: payload.tag,          // collapses duplicates for the same order
    data: { url: payload.url || "/orders" },
    renotify: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((all) => {
      // Focus an existing tab if one's open, otherwise open a new one.
      for (const client of all) {
        if ("focus" in client) {
          client.postMessage({ type: "NAVIGATE", url });
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
