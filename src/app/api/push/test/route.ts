import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser, adminSupabase } from "../../../../lib/push.server";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Vérifier que la souscription existe
  const { data: subs, error: subErr } = await adminSupabase
    .from("user_push_subscriptions")
    .select("id, endpoint")
    .eq("user_id", user.id);

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });
  if (!subs?.length) return NextResponse.json({ error: "Aucune souscription trouvée pour cet utilisateur" }, { status: 404 });

  try {
    const result = await sendPushToUser(user.id, {
      title: "Notification test",
      body: "Les notifications fonctionnent sur cet appareil !",
      url: "/accueil",
    });
    return NextResponse.json({ ...result, subscriptions: subs.length });
  } catch (err) {
    console.error("[push/test] error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
