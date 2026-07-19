import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushDirect } from "../../../../lib/push.server";

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

  // Sauvegarder en DB
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

  // Envoi direct via push.server.ts (VAPID initialisé là-dedans)
  const result = await sendPushDirect(
    { endpoint, p256dh, auth },
    { title: "Swena", body: "Les notifications fonctionnent.", url: "/accueil" },
  );

  if (result.sent === 0) {
    return NextResponse.json({ error: result.error, sent: 0 }, { status: 502 });
  }

  return NextResponse.json({ sent: 1 });
}
