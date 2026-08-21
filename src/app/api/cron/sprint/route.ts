import { NextRequest, NextResponse } from "next/server";
import { sendPushToUser, adminSupabase } from "../../../../lib/push.server";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "")
    ?? req.nextUrl.searchParams.get("secret");
  if (auth !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  const { data: challenges } = await adminSupabase
    .from("challenges")
    .select("id, title, start_date")
    .eq("metric", "pages")
    .gte("end_date", today);

  if (!challenges?.length) return NextResponse.json({ sent: 0 });

  let sent = 0;

  for (const challenge of (challenges as { id: string; title: string; start_date: string }[])) {
    const { data: participants } = await adminSupabase
      .from("challenge_participants")
      .select("user_id")
      .eq("challenge_id", challenge.id)
      .eq("status", "accepted");

    if (!participants || participants.length < 2) continue;

    const userIds = (participants as { user_id: string }[]).map((p) => p.user_id);

    const { data: logs } = await adminSupabase
      .from("reading_logs")
      .select("user_id, pages_read")
      .in("user_id", userIds)
      .gte("date", challenge.start_date)
      .lte("date", today);

    const progressMap = new Map<string, number>();
    for (const log of (logs ?? [] as { user_id: string; pages_read: number }[])) {
      progressMap.set(log.user_id, (progressMap.get(log.user_id) ?? 0) + log.pages_read);
    }

    const leaderPages = Math.max(...userIds.map((uid) => progressMap.get(uid) ?? 0));
    if (leaderPages === 0) continue;

    await Promise.all(
      userIds.map(async (uid) => {
        const myPages = progressMap.get(uid) ?? 0;
        const gap = leaderPages - myPages;
        if (gap <= 0 || gap > 30) return;
        await sendPushToUser(uid, {
          title: "Sprint final",
          body: `Tu es à ${gap} pages du leader dans le challenge "${challenge.title}". Fonce !`,
        }, "sprint");
        sent++;
      }),
    );
  }

  return NextResponse.json({ sent });
}
