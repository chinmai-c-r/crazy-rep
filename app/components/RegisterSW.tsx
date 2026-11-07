"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RegisterSW() {
  const router = useRouter();

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // Messages from the service worker
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const sameOrigin = (href: unknown) => {
      try {
        const u = new URL(String(href), window.location.origin);
        return u.origin === window.location.origin ? u : null;
      } catch {
        return null;
      }
    };
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; url?: string } | null;
      const url = sameOrigin(data?.url);
      if (!url) return;
      if (data?.type === "open") {
        // A tapped notification: go there inside the running app, without reloading it
        e.ports[0]?.postMessage("ok");
        window.dispatchEvent(new CustomEvent("crazy-rep:open", { detail: { pathname: url.pathname, search: url.search } }));
        router.push(url.pathname + url.search);
      } else if (data?.type === "navigate") {
        // The server wants this page somewhere else (signed out, for instance)
        window.location.replace(url.href);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  return null;
}
