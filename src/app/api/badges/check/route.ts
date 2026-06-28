import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { BADGE_DEFS, getStatValue, type UserBadgeStats } from "../../../../lib/badges";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CUTOFF = "2026-06-20";

export async function POST(req: NextRequest) {
  const { userId } = (await req.json()) as { userId?: string };
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Fetch all needed data in parallel (only data since CUTOFF) ────────────
  const [booksRes, logsRes, reviewsRes, genresRes] = await Promise.all([
    db.from("books")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("created_at", CUTOFF),

    db.from("reading_logs")
      .select("date, pages_read")
      .eq("user_id", userId)
      .gte("date", CUTOFF),

    db.from("books")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("notes", "is", null)
      .neq("notes", "")
      .gte("created_at", CUTOFF),

    db.from("books")
      .select("genre")
      .eq("user_id", userId)
      .eq("status", "completed")
      .not("genre", "is", null)
      .gte("created_at", CUTOFF),
  ]);

  type LogRow = { date: string; pages_read: number | null };
  const logs = (logsRes.data ?? []) as LogRow[];

  // ── Pages total ────────────────────────────────────────────────────────────
  const totalPages = logs.reduce((s, r) => s + (r.pages_read ?? 0), 0);

  // ── Unique genres (split comma-separated if needed) ────────────────────────
  const genreSet = new Set<string>();
  for (const row of (genresRes.data ?? []) as { genre: string | null }[]) {
    if (!row.genre) continue;
    row.genre.split(/[,;]+/).forEach((g) => {
      const t = g.trim();
      if (t) genreSet.add(t);
    });
  }

  // ── Max consecutive reading streak ─────────────────────────────────────────
  const dateSet = [...new Set(logs.map((r) => r.date))].sort();
  let maxStreak = dateSet.length > 0 ? 1 : 0;
  let streak = 1;
  for (let i = 1; i < dateSet.length; i++) {
    const prev = new Date(dateSet[i - 1]).getTime();
    const curr = new Date(dateSet[i]).getTime();
    const diff = Math.round((curr - prev) / 86400000);
    if (diff === 1) { streak++; if (streak > maxStreak) maxStreak = streak; }
    else if (diff > 1) streak = 1;
  }

  // ── Monthly challenge (July 2026) ──────────────────────────────────────────
  const monthlySessionCount = logs.filter(
    (r) => r.date >= "2026-07-01" && r.date <= "2026-07-31"
  ).length;

  const stats: UserBadgeStats = {
    booksCompleted:      booksRes.count ?? 0,
    uniqueGenres:        genreSet.size,
    sessionsCount:       logs.length,
    reviewsCount:        reviewsRes.count ?? 0,
    totalPages,
    maxStreak,
    monthlySessionCount,
  };

  // ── Already-unlocked badges ────────────────────────────────────────────────
  const { data: existing } = await db
    .from("user_badges")
    .select("badge_id")
    .eq("user_id", userId);
  const unlockedIds = new Set((existing ?? []).map((r: { badge_id: string }) => r.badge_id));

  // ── Award new badges ───────────────────────────────────────────────────────
  const toAward = BADGE_DEFS.filter((def) => {
    if (unlockedIds.has(def.id)) return false;
    return getStatValue(def, stats) >= def.targetValue;
  });

  if (toAward.length > 0) {
    await db.from("user_badges").insert(
      toAward.map((def) => ({ user_id: userId, badge_id: def.id }))
    );
  }

  return NextResponse.json({
    awarded: toAward.map((d) => ({ id: d.id, name: d.name, tier: d.tier, points: d.points })),
    stats,
  });
}
