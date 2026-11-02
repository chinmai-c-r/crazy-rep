"use client";

/** Browser side of meal reminders: asking permission and registering this device. */

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushSupport =
  | "ok"
  /** iPhone and iPad only allow notifications from an app added to the Home Screen. */
  | "needs-install"
  | "unsupported";

export function pushSupport(): PushSupport {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) return ios ? "needs-install" : "unsupported";
  return "ok";
}

const toBytes = (base64Url: string) => {
  const padded = base64Url.padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), "=").replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

/** The service worker only runs in the production build, so in development there's nothing to subscribe with. */
async function registration() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return navigator.serviceWorker.ready;
}

/** Whether this device already has a push subscription. */
export async function currentSubscription() {
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export type EnableResult = "enabled" | "denied" | "no-worker" | "failed";

/** Asks permission (must follow a tap), subscribes this device and registers it with the server. */
export async function enablePush(): Promise<EnableResult> {
  const reg = await registration();
  if (!reg) return "no-worker";
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return "denied";
  try {
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(VAPID_PUBLIC_KEY) }));
    const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
    return res.ok ? "enabled" : "failed";
  } catch {
    return "failed";
  }
}

/** Stops notifications on this device and tells the server. Never throws: signing out shouldn't depend on it. */
export async function disablePush() {
  try {
    const sub = await currentSubscription();
    if (!sub) return;
    await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
    await sub.unsubscribe();
  } catch {}
}
