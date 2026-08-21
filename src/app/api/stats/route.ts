import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "../../../lib/push.server";

// Endpoint de lecture seule pour des consommateurs externes (ex: mon app de
// bingo d'objectifs) : renvoie mes propres stats de lecture. Pas de session
// utilisateur en jeu ici (appel serveur à serveur), donc auth par secret
// partagé — même pattern que cron/evening, cron/morning, cron/sprint.
const OWNER_USER_ID = process.env.STATS_OWNER_USER_ID!;

function currentYearRange() {
  const year = new Date().getFullYear();
  return { year, start: `${year}-01-01`, end: `${year}-12-31` };
}

export async function GET(req: NextRequest) {
  const auth =
    req.headers.get("authorization")?.replace("Bearer ", "") ?? req.nextUrl.searchParams.get("secret");
  if (auth !== process.env.STATS_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { year, start, end } = currentYearRange();

  const [booksThisYearRes, booksTotalRes, logsThisYearRes, logsTotalRes] = await Promise.all([
    adminSupabase
      .from("books")
      .select("id", { count: "exact", head: true })
      .eq("user_id", OWNER_USER_ID)
      .eq("status", "completed")
      .gte("date_read", start)
      .lte("date_read", end),
    adminSupabase
      .from("books")
      .select("id", { count: "exact", head: true })
      .eq("user_id", OWNER_USER_ID)
      .eq("status", "completed"),
    adminSupabase.from("reading_logs").select("pages_read").eq("user_id", OWNER_USER_ID).gte("date", start).lte("date", end),
    adminSupabase.from("reading_logs").select("pages_read").eq("user_id", OWNER_USER_ID),
  ]);

  const sumPages = (rows: { pages_read: number }[] | null) =>
    (rows ?? []).reduce((sum, row) => sum + (row.pages_read ?? 0), 0);

  return NextResponse.json({
    year,
    booksReadThisYear: booksThisYearRes.count ?? 0,
    booksReadTotal: booksTotalRes.count ?? 0,
    pagesReadThisYear: sumPages(logsThisYearRes.data as { pages_read: number }[] | null),
    pagesReadTotal: sumPages(logsTotalRes.data as { pages_read: number }[] | null),
  });
}
