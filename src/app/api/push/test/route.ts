import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { endpoint, p256dh, auth } = body as {
    endpoint?: string; p256dh?: string; auth?: string;
  };

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Données souscription manquantes" }, { status: 400 });
  }

  // Sauvegarder en DB (update-then-insert, pas de contrainte unique requise)
  const { data: existing } = await admin
    .from("user_push_subscriptions")
    .select("id")
    .eq("endpoint", endpoint)
    .maybeSingle();

  if (existing?.id) {
    await admin.from("user_push_subscriptions")
      .update({ p256dh, auth, user_id: user.id })
      .eq("id", existing.id);
  } else {
    await admin.from("user_push_subscriptions")
      .insert({ user_id: user.id, endpoint, p256dh, auth });
  }

  // Envoi DIRECT à cette souscription (bypass du lookup en DB)
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPrivate) {
    console.error("[push/test] VAPID_PRIVATE_KEY manquant");
    return NextResponse.json({ error: "Configuration serveur manquante (VAPID)" }, { status: 500 });
  }

  webpush.setVapidDetails(
    "mailto:ricard.leo07@gmail.com",
    "BOmWqI1xyCWcT-WCq5jklsWt_9PsB4YrUdiUtHj6KSeue-hBtmdDSnKb3KZzO98oA5xVt9wUbBzH0A8HoyHxIkQ",
    vapidPrivate,
  );

  try {
    await webpush.sendNotification(
      { endpoint, keys: { p256dh, auth } },
      JSON.stringify({ title: "Swena", body: "Les notifications fonctionnent.", url: "/accueil" }),
    );
    return NextResponse.json({ sent: 1 });
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    const message = (err as Error).message;
    console.error("[push/test] sendNotification error:", statusCode, message);

    if (statusCode === 410 || statusCode === 404) {
      await admin.from("user_push_subscriptions").delete().eq("endpoint", endpoint);
    }

    return NextResponse.json({
      error: `Rejeté par le serveur push (${statusCode ?? "?"}) : ${message}`,
      sent: 0,
    }, { status: 502 });
  }
}
