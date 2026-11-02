// Service worker: makes the app installable and lets it open without a connection.
// - Pages: network first; the last good copy of each page is kept and shown when the network is down.
// - App files (/_next/static, icons): cached on first use, they never change under the same URL.
// - API calls and Supabase requests always go to the network. The app keeps its own copy of fetched data.
const SHELL = "crazy-rep-v2";
const PAGES = "crazy-rep-pages-v2"; // cleared on sign-out (see lib/offline.ts)
const STATIC = "crazy-rep-static-v2";
const OFFLINE = "/offline.html";
const HOME = "/dashboard";
const MAX_STATIC = 400;
const SLOW_MS = 8000; // a connection that's "up" but not answering shouldn't hold the app hostage

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.filter((k) => ![SHELL, PAGES, STATIC].includes(k)).map((k) => caches.delete(k)))),
      // Start the page request while the worker boots (a worker resumed from idle can take a while to wake up)
      self.registration.navigationPreload?.enable(),
    ]),
  );
  self.clients.claim();
});

/** Pages are stored by path, so /scan?type=lunch and /scan share one copy. */
const pageKey = (url) => new Request(url.origin + url.pathname);

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), ms));

async function page(event) {
  const url = new URL(event.request.url);
  const pages = await caches.open(PAGES);
  const saved = await pages.match(pageKey(url));
  try {
    const load = (async () => (await event.preloadResponse) || (await fetch(event.request)))();
    // With a saved copy to fall back on, don't wait forever for a connection that isn't answering
    const res = saved ? await Promise.race([load, timeout(SLOW_MS)]) : await load;
    // Only keep real pages: not redirects (to sign-in), errors or API responses
    if (res.ok && !res.redirected && res.headers.get("content-type")?.includes("text/html")) {
      event.waitUntil(pages.put(pageKey(url), res.clone()));
    }
    return res;
  } catch {
    return saved || (await pages.match(pageKey(new URL(HOME, url.origin)))) || (await caches.match(OFFLINE));
  }
}

async function asset(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    // Old builds' files pile up otherwise: drop the oldest
    const all = await cache.keys();
    if (all.length > MAX_STATIC) await Promise.all(all.slice(0, all.length - MAX_STATIC).map((k) => cache.delete(k)));
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.mode === "navigate") return event.respondWith(page(event));

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(asset(request));
  }
});
