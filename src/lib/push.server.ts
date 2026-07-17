import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string },
): Promise<{ sent: number; skipped: number }> {
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPrivate) {
    console.error("[push] VAPID_PRIVATE_KEY manquant — notifications désactivées");
    return { sent: 0, skipped: 0 };
  }

  webpush.setVapidDetails(
    "mailto:ricard.leo07@gmail.com",
    "BOmWqI1xyCWcT-WCq5jklsWt_9PsB4YrUdiUtHj6KSeue-hBtmdDSnKb3KZzO98oA5xVt9wUbBzH0A8HoyHxIkQ",
    vapidPrivate,
  );

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
