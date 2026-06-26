import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!token) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Verify the user's identity
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "Service key manquante — suppression impossible" }, { status: 503 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false } }
  );

  const uid = user.id;

  // Delete all user data in order (child tables first)
  await admin.from("review_likes").delete().eq("user_id", uid);
  await admin.from("notifications").delete().or(`recipient_id.eq.${uid},actor_id.eq.${uid}`);
  await admin.from("user_follows").delete().or(`follower_id.eq.${uid},following_id.eq.${uid}`);
  await admin.from("reading_logs").delete().eq("user_id", uid);
  await admin.from("books").delete().eq("user_id", uid);
  await admin.from("user_profiles").delete().eq("id", uid);

  // Delete the auth user last
  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
