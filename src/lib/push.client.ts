import { supabase } from "./supabase";

// Clé publique VAPID — publique par nature, peut être dans le source
export const VAPID_PUBLIC_KEY = "BOmWqI1xyCWcT-WCq5jklsWt_9PsB4YrUdiUtHj6KSeue-hBtmdDSnKb3KZzO98oA5xVt9wUbBzH0A8HoyHxIkQ";

export function urlBase64ToUint8Array(b64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

export function notifyUser(targetUserId: string, title: string, body: string, url?: string) {
  supabase.auth.getSession().then(async ({ data: { session } }) => {
    if (!session) {
      console.warn("[push] notifyUser: pas de session active, notification annulée");
      return;
    }
    try {
      const res = await fetch("/api/push/notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ targetUserId, title, body, url }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.warn("[push] notifyUser: réponse", res.status, errBody);
      }
    } catch (err) {
      console.warn("[push] notifyUser: erreur réseau", err);
    }
  });
}

/** Réabonnement silencieux — appelé au démarrage si la permission est déjà accordée */
export async function ensurePushSubscription(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    if (!json.keys?.p256dh || !json.keys?.auth) {
      console.warn("[push] ensurePushSubscription: clés manquantes dans la souscription");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.warn("[push] ensurePushSubscription: échec sauvegarde", res.status, errBody);
    }
  } catch (err) {
    console.warn("[push] ensurePushSubscription: erreur", err);
  }
}
