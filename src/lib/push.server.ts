import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const VAPID_PUBLIC = "BOmWqI1xyCWcT-WCq5jklsWt_9PsB4YrUdiUtHj6KSeue-hBtmdDSnKb3KZzO98oA5xVt9wUbBzH0A8HoyHxIkQ";
const VAPID_MAILTO = "mailto:ricard.leo07@gmail.com";

function initVapid(): boolean {
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!priv) {
    console.error("[push] VAPID_PRIVATE_KEY manquant");
    return false;
  }
  webpush.setVapidDetails(VAPID_MAILTO, VAPID_PUBLIC, priv);
  return true;
}

/** Envoie directement à une souscription sans passer par la DB */
export async function sendPushDirect(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url?: string },
): Promise<{ sent: number; error?: string }> {
  if (!initVapid()) return { sent: 0, error: "VAPID_PRIVATE_KEY manquant sur le serveur" };
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return { sent: 1 };
  } catch (err: unknown) {
    const code = (err as { statusCode?: number }).statusCode;
    const msg = (err as Error).message;
    console.error("[push] sendPushDirect error:", code, msg);
    return { sent: 0, error: `Rejeté par le serveur push (${code ?? "?"}) : ${msg}` };
  }
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string },
): Promise<{ sent: number; skipped: number }> {
  if (!initVapid()) return { sent: 0, skipped: 0 };

  const { data: subs, error: subsErr } = await adminSupabase
    .from("user_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (subsErr) {
    console.error("[push] erreur lecture souscriptions:", subsErr.message, "userId:", userId);
    return { sent: 0, skipped: 0 };
  }

  if (!subs?.length) {
    console.info("[push] aucune souscription pour userId:", userId);
    return { sent: 0, skipped: 0 };
  }

  const message = JSON.stringify(payload);
  let sent = 0;
  let skipped = 0;

  await Promise.all(
    (subs as { id: string; endpoint: string; p256dh: string; auth: string }[]).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          message,
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          // Souscription expirée — on nettoie
          await adminSupabase.from("user_push_subscriptions").delete().eq("id", s.id);
          console.info("[push] souscription expirée supprimée, id:", s.id);
          skipped++;
        } else {
          console.error("[push] sendNotification error:", statusCode, (err as Error).message, "userId:", userId);
          skipped++;
        }
      }
    }),
  );

  console.info(`[push] userId=${userId} — sent=${sent}, skipped=${skipped}`);
  return { sent, skipped };
}
