import { NextRequest, NextResponse } from "next/server";
import { sendPushToUser, adminSupabase } from "../../../../lib/push.server";

const PROGRESS_MESSAGES = (remaining: number, pagesRead: number): string[] => [
  `Il te reste ${remaining} pages pour atteindre ton objectif du jour.`,
  `Tu es à ${pagesRead} pages aujourd'hui — encore ${remaining} pour finir la journée en beauté.`,
  `${remaining} pages et tu boucles ton objectif. Ce soir, c'est possible !`,
  `Tu es si proche. Plus que ${remaining} pages pour ton objectif quotidien.`,
];

const NO_READ_MESSAGES = [
  "Pas encore ouvert ton livre aujourd'hui ? Il est encore temps ce soir !",
  "Ton livre te manque, non ? Il est là, il attend.",
  "Les meilleures soirées commencent par quelques pages. Lance-toi !",
  "Même 10 pages ce soir font la différence. Tu peux le faire !",
  "Juste quelques pages avant de dormir ? Ton objectif t'attend.",
  "Ta série de lectures a besoin de toi ce soir.",
  "Un livre ouvert ce soir, et ta journée est complète.",
  "Ce soir, le meilleur moment pour lire commence maintenant.",
];

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "")
    ?? req.nextUrl.searchParams.get("secret");
  if (auth !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  const { data: subs } = await adminSupabase
    .from("user_push_subscriptions")
    .select("user_id");

  if (!subs?.length) return NextResponse.json({ sent: 0 });

  const userIds = [...new Set((subs as { user_id: string }[]).map((s) => s.user_id))];

  const { data: goals } = await adminSupabase
    .from("user_goals")
    .select("user_id, reading_pages_year")
    .in("user_id", userIds)
    .not("reading_pages_year", "is", null);

  const goalsMap = new Map(
    (goals ?? [] as { user_id: string; reading_pages_year: number }[]).map((g) => [
      g.user_id,
      g.reading_pages_year,
    ]),
  );

  const { data: todayLogs } = await adminSupabase
    .from("reading_logs")
    .select("user_id, pages_read")
    .in("user_id", userIds)
    .eq("date", today);

  const todayMap = new Map<string, number>();
  for (const log of (todayLogs ?? [] as { user_id: string; pages_read: number }[])) {
    todayMap.set(log.user_id, (todayMap.get(log.user_id) ?? 0) + log.pages_read);
  }

  let sent = 0;
  await Promise.all(
    userIds.map(async (uid) => {
      const pagesRead = todayMap.get(uid) ?? 0;
      const pagesYear = goalsMap.get(uid);

      if (pagesYear) {
        const dailyGoal = Math.ceil(pagesYear / 365);
        if (pagesRead >= dailyGoal) return; // objectif atteint, pas de notification
        if (pagesRead > 0) {
          const remaining = dailyGoal - pagesRead;
          const msgs = PROGRESS_MESSAGES(remaining, pagesRead);
          const body = msgs[Math.floor(Math.random() * msgs.length)];
          await sendPushToUser(uid, { title: "Swena", body });
          sent++;
          return;
        }
      }

      // Aucune page lue aujourd'hui
      if (pagesRead === 0) {
        const body = NO_READ_MESSAGES[Math.floor(Math.random() * NO_READ_MESSAGES.length)];
        await sendPushToUser(uid, { title: "Swena", body });
        sent++;
      }
    }),
  );

  return NextResponse.json({ sent });
}
