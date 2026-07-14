import { NextRequest, NextResponse } from "next/server";
import { sendPushToUser, adminSupabase } from "../../../../lib/push.server";

const MESSAGES = [
  { title: "Bonne journée", body: "Quelques pages ce matin pour bien commencer ?" },
  { title: "La journée commence", body: "Ton livre t'attend. Même 10 pages font la différence." },
  { title: "Matin de lecture", body: "Prêt pour une nouvelle session ? C'est le bon moment." },
  { title: "Bonne lecture", body: "Une petite session matinale pour avancer dans ta lecture ?" },
];

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "")
    ?? req.nextUrl.searchParams.get("secret");
  if (auth !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: subs } = await adminSupabase
    .from("user_push_subscriptions")
    .select("user_id");

  if (!subs?.length) return NextResponse.json({ sent: 0 });

  const userIds = [...new Set((subs as { user_id: string }[]).map((s) => s.user_id))];
  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

  await Promise.all(userIds.map((uid) => sendPushToUser(uid, msg)));

  return NextResponse.json({ sent: userIds.length });
}
