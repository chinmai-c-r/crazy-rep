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

/** The signed-in app pages. Their HTML is only a shell (the data loads in the browser), so it's safe to open from the saved copy. */
const APP_PATHS = ["/dashboard", "/scan", "/history", "/profile", "/coach", "/onboarding"];
const isAppPage = (url) => APP_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"));

const isHtml = (res) => res.ok && !res.redirected && res.headers.get("content-type")?.includes("text/html");

/** Sends a message to one open window (or all of them when we don't know which). */
async function tell(clientId, message) {
  const one = clientId ? await clients.get(clientId) : null;
  const targets = one ? [one] : await clients.matchAll({ type: "window" });
  targets.forEach((c) => c.postMessage(message));
}

/**
 * After an app page was opened from the saved copy: fetch the current one and keep it for next time.
 * If the server sends us somewhere else (signed out, or access removed), the saved page was the wrong thing to show,
 * so drop it and tell the page to go where the server wanted.
 */
async function refresh(event, url, pages) {
  try {
    event.preloadResponse?.catch(() => {}); // not used here: a plain fetch lets us see redirects
    const res = await fetch(url.href, { credentials: "same-origin", headers: { Accept: "text/html" } });
    if (res.redirected && new URL(res.url).pathname !== url.pathname) {
      await pages.delete(pageKey(url));
      return tell(event.resultingClientId, { type: "navigate", url: res.url });
    }
    if (isHtml(res)) {
      await pages.put(pageKey(url), res.clone());
      await keepFilesOf(await res.text());
    }
  } catch {
    // offline or the server is slow: the saved copy is still good
  }
}

/**
 * A saved page is only useful if its code is saved too. The page that was open when a new version was released is still running the old
 * code, so the new version's files have never been loaded on this phone; without this, the next open shows the saved page but can't be
 * used until those files download over the network. So when a fresh copy of a page is kept, its files are kept with it.
 */
async function keepFilesOf(html) {
  const cache = await caches.open(STATIC);
  const urls = [...new Set(html.match(/\/_next\/static\/[^"'\\\s)<>]+\.(?:js|css)/g) ?? [])].slice(0, 80);
  await Promise.all(
    urls.map(async (u) => {
      try {
        if (await cache.match(u)) return;
        const res = await fetch(u);
        if (res.ok) await cache.put(u, res);
      } catch {
        // the page fetches it itself when needed
      }
    }),
  );
}

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), ms));

async function page(event) {
  const url = new URL(event.request.url);
  const pages = await caches.open(PAGES);
  const saved = await pages.match(pageKey(url));

  // Opening the app (from the home screen, or from a notification) shouldn't wait for the server, which may be cold:
  // show the saved page at once, with its loading state, and refresh it behind the scenes
  if (saved && isAppPage(url)) {
    event.waitUntil(refresh(event, url, pages));
    return saved;
  }

  try {
    const load = (async () => (await event.preloadResponse) || (await fetch(event.request)))();
    // With a saved copy to fall back on, don't wait forever for a connection that isn't answering
    const res = saved ? await Promise.race([load, timeout(SLOW_MS)]) : await load;
    // Only keep real pages: not redirects (to sign-in), errors or API responses
    if (isHtml(res)) event.waitUntil(pages.put(pageKey(url), res.clone()));
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

// ── Meal reminders (Web Push) ────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  // Every push must show something (browsers can revoke permission otherwise)
  event.waitUntil(
    self.registration.showNotification(data.title || "Crazy Rep", {
      body: data.body || "Time to log a meal.",
      icon: "/icons/icon-192.png",
      tag: data.tag, // a newer reminder of the same meal replaces the old one
      data: { url: data.url || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
      const app = windows.find((w) => new URL(w.url).origin === self.location.origin && "focus" in w);
      // The app isn't running: open it (its saved page appears straight away)
      if (!app) return clients.openWindow(target);

      await app.focus().catch(() => {});
      // Ask the running app to move there itself. That's instant: no page reload, no waiting on the server.
      const answered = await new Promise((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve(true);
        app.postMessage({ type: "open", url: target }, [channel.port2]);
        setTimeout(() => resolve(false), 3000);
      });
      // An older copy of the app that doesn't listen: load the page instead
      if (!answered && "navigate" in app) await app.navigate(target).catch(() => clients.openWindow(target));
    })(),
  );
});
