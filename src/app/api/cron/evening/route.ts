import { NextRequest, NextResponse } from "next/server";
import { sendPushToUser, adminSupabase } from "../../../../lib/push.server";

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
      const pagesYear = goalsMap.get(uid);
      if (!pagesYear) return;
      const dailyGoal = Math.ceil(pagesYear / 365);
      const pagesRead = todayMap.get(uid) ?? 0;
      if (pagesRead >= dailyGoal) return;
      const remaining = dailyGoal - pagesRead;
      await sendPushToUser(uid, {
        title: "Objectif du jour",
        body: `Il te reste ${remaining} pages pour atteindre ton objectif quotidien. Tu peux le faire !`,
      });
      sent++;
    }),
  );

  return NextResponse.json({ sent });
}
