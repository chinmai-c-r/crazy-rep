import "server-only";
import webpush, { type PushSubscription } from "web-push";
import type { ReminderMessage } from "./reminders";

export const pushConfigured = () => Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let ready = false;
function setup() {
  if (ready) return;
  // The subject tells push services who to contact about misbehaving senders
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  ready = true;
}

/**
 * Push services only. The server posts to whatever address a device registers, so an arbitrary address
 * would let someone make it call internal URLs.
 */
const PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
export const isPushEndpoint = (endpoint: string) => {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
};

export type StoredSubscription = { id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Sends one message to one device. Returns "gone" when the push service says the device
 * unsubscribed or was uninstalled (the row should be removed), otherwise whether it was accepted.
 */
export async function sendPush(sub: StoredSubscription, message: ReminderMessage): Promise<"sent" | "gone" | "failed"> {
  setup();
  const target: PushSubscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
  try {
    // TTL: a reminder that couldn't be delivered within the hour isn't worth showing. Topic: a newer one replaces an older one.
    await webpush.sendNotification(target, JSON.stringify(message), { TTL: 60 * 60, urgency: "normal", topic: message.tag.slice(0, 32) });
    return "sent";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "failed";
  }
}
