// Minimal service worker: makes the app installable and shows an offline page.
// API calls and Supabase requests always go to the network.
const CACHE = "crazy-rep-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
      // Start the page request while the worker boots (a worker resumed from idle can take a while to wake up)
      self.registration.navigationPreload?.enable(),
    ]),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    (async () => {
      try {
        return (await event.preloadResponse) || (await fetch(event.request));
      } catch {
        return caches.match(OFFLINE);
      }
    })(),
  );
});
