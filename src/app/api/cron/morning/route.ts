import { NextRequest, NextResponse } from "next/server";
import { sendPushToUser, adminSupabase } from "../../../../lib/push.server";

const MORNING_MESSAGES = [
  "C'est le moment de rentrer tes pages d'hier !",
  "Tu as lu hier soir ? Note tes pages avant de les oublier.",
  "Ta session d'hier n'attend que toi pour être enregistrée.",
  "Ton journal attend le bilan de ta soirée d'hier.",
  "Une nouvelle journée commence. Note ce que tu as lu hier !",
  "Prends 10 secondes pour noter ta lecture d'hier.",
  "Pas de progrès sans traces — rentre tes pages d'hier !",
  "Un dernier effort : note tes pages d'hier dans ton journal.",
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

  await Promise.all(userIds.map((uid) => {
    const body = MORNING_MESSAGES[Math.floor(Math.random() * MORNING_MESSAGES.length)];
    return sendPushToUser(uid, { title: "Swena", body }, "reminders");
  }));

  return NextResponse.json({ sent: userIds.length });
}
