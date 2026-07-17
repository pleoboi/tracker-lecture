import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminSupabase } from "../../../../lib/push.server";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const { data: subs, error: subsErr } = await adminSupabase
    .from("user_push_subscriptions")
    .select("id, endpoint, created_at")
    .eq("user_id", user.id);

  const { count: totalSubs } = await adminSupabase
    .from("user_push_subscriptions")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    env: {
      vapidPrivateKey: vapidPrivate ? `présente (${vapidPrivate.length} chars)` : "MANQUANTE",
      supabaseServiceRole: serviceRole ? "présente" : "MANQUANTE",
      supabaseUrl: supabaseUrl ?? "MANQUANTE",
    },
    subscriptions: {
      forUser: subs ?? [],
      forUserCount: subs?.length ?? 0,
      totalInDB: totalSubs ?? 0,
      error: subsErr?.message ?? null,
    },
  });
}
