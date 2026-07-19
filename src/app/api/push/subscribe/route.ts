import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await admin.auth.getUser(token);
  return user ?? null;
}

export async function POST(req: NextRequest) {
  const { endpoint, p256dh, auth } = await req.json();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
  }

  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Cherche un enregistrement existant avec ce endpoint
  const { data: existing } = await admin
    .from("user_push_subscriptions")
    .select("id")
    .eq("endpoint", endpoint)
    .maybeSingle();

  let dbError;
  if (existing?.id) {
    // Mise à jour des clés (peut avoir changé après un renouvellement)
    const { error } = await admin
      .from("user_push_subscriptions")
      .update({ p256dh, auth, user_id: user.id })
      .eq("id", existing.id);
    dbError = error;
  } else {
    // Nouvelle souscription
    const { error } = await admin
      .from("user_push_subscriptions")
      .insert({ user_id: user.id, endpoint, p256dh, auth });
    dbError = error;
  }

  if (dbError) {
    console.error("[push/subscribe] erreur DB:", dbError.message, dbError.code);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { endpoint } = await req.json();
  if (!endpoint) return NextResponse.json({ error: "endpoint manquant" }, { status: 400 });

  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  await admin
    .from("user_push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  return NextResponse.json({ ok: true });
}
