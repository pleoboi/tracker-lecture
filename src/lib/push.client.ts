import { supabase } from "./supabase";

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

export interface PushSyncResult {
  ok: boolean;
  message: string;
}

/**
 * Crée ou resynchronise l'abonnement push du navigateur courant en base.
 * Retourne un résultat exploitable par l'UI.
 * Safe à appeler sur chaque chargement de page — l'API fait un upsert.
 */
/**
 * @param force Si true, désabonne puis réabonne pour forcer une souscription fraîche.
 *              À utiliser depuis un geste utilisateur (clic bouton) pour contourner
 *              les souscriptions expirées ou créées avec une ancienne clé VAPID.
 */
export async function ensurePushSubscription(force = false): Promise<PushSyncResult> {
  if (typeof window === "undefined") return { ok: false, message: "SSR" };
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    return { ok: false, message: "Push non supporté par ce navigateur" };
  if (Notification.permission !== "granted")
    return { ok: false, message: "Permission non accordée" };

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (force && sub) {
      // Désabonne pour forcer une nouvelle souscription fraîche
      await sub.unsubscribe();
      sub = null;
    }

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = sub.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } };
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!p256dh || !auth) {
      console.error("[push] ensurePushSubscription: clés manquantes dans la souscription", json);
      return { ok: false, message: "Clés de souscription manquantes — réinstalle l'app" };
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn("[push] ensurePushSubscription: session non disponible");
      return { ok: false, message: "Session non disponible" };
    }

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ endpoint: sub.endpoint, p256dh, auth }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.warn("[push] ensurePushSubscription: échec sauvegarde", res.status, errBody);
      return { ok: false, message: `Erreur sauvegarde (${res.status})` };
    }

    return { ok: true, message: "Souscription synchronisée" };
  } catch (err) {
    console.error("[push] ensurePushSubscription: erreur", err);
    return { ok: false, message: (err as Error).message || "Erreur inconnue" };
  }
}
