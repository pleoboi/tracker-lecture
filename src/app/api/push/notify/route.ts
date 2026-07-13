import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "../../../../lib/push.server";

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

  const { targetUserId, title, body, url } = await req.json();
  if (!targetUserId || !title || !body) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  try {
    await sendPushToUser(targetUserId, { title, body, url });
  } catch (err) {
    console.error("[push/notify] error:", err);
  }
  return NextResponse.json({ ok: true });
}
