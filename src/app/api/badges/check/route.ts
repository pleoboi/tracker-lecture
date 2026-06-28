import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { BADGE_DEFS, BADGE_CUTOFF_DATE, getStatValue, type UserBadgeStats } from "../../../../lib/badges";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CUTOFF = BADGE_CUTOFF_DATE;

export async function POST(req: NextRequest) {
  const { userId } = (await req.json()) as { userId?: string };
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── 1. Sessions depuis la date butoir ─────────────────────────────────────
  const { data: recentLogsData } = await db
    .from("reading_logs")
    .select("book_id, date, pages_read")
    .eq("user_id", userId)
    .gte("date", CUTOFF);

  type LogRow = { book_id: string; date: string; pages_read: number | null };
  const recentLogs = (recentLogsData ?? []) as LogRow[];
  const activeBookIds = [...new Set(recentLogs.map((r) => r.book_id))];

  // ── 2. Stats dérivées des sessions récentes ────────────────────────────────
  const totalPages    = recentLogs.reduce((s, r) => s + (r.pages_read ?? 0), 0);
  const sessionsCount = recentLogs.length;

  const dateSet = [...new Set(recentLogs.map((r) => r.date))].sort();
  let maxStreak = dateSet.length > 0 ? 1 : 0;
  let streak = 1;
  for (let i = 1; i < dateSet.length; i++) {
    const prev = new Date(dateSet[i - 1]).getTime();
    const curr = new Date(dateSet[i]).getTime();
    const diff = Math.round((curr - prev) / 86400000);
    if (diff === 1) { streak++; if (streak > maxStreak) maxStreak = streak; }
    else if (diff > 1) streak = 1;
  }

  const monthlySessionCount = recentLogs.filter(
    (r) => r.date >= "2026-07-01" && r.date <= "2026-07-31"
  ).length;

  // ── 3. Livres actifs depuis la date butoir ─────────────────────────────────
  // Un livre compte uniquement s'il a au moins une session enregistrée >= CUTOFF
  let booksCompleted = 0;
  let uniqueGenres   = 0;
  let reviewsCount   = 0;

  if (activeBookIds.length > 0) {
    const [completedRes, genresRes, reviewsRes] = await Promise.all([
      db.from("books")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "completed")
        .in("id", activeBookIds),

      db.from("books")
        .select("genre")
        .eq("user_id", userId)
        .eq("status", "completed")
        .not("genre", "is", null)
        .in("id", activeBookIds),

      db.from("books")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("notes", "is", null)
        .neq("notes", "")
        .in("id", activeBookIds),
    ]);

    booksCompleted = completedRes.count ?? 0;
    reviewsCount   = reviewsRes.count ?? 0;

    const genreSet = new Set<string>();
    for (const row of (genresRes.data ?? []) as { genre: string | null }[]) {
      if (!row.genre) continue;
      row.genre.split(/[,;]+/).forEach((g) => { const t = g.trim(); if (t) genreSet.add(t); });
    }
    uniqueGenres = genreSet.size;
  }

  const stats: UserBadgeStats = {
    booksCompleted,
    uniqueGenres,
    sessionsCount,
    reviewsCount,
    totalPages,
    maxStreak,
    monthlySessionCount,
  };

  // ── 4. Badges déjà débloqués ───────────────────────────────────────────────
  const { data: existing } = await db
    .from("user_badges")
    .select("badge_id")
    .eq("user_id", userId);
  const unlockedIds = new Set((existing ?? []).map((r: { badge_id: string }) => r.badge_id));

  // ── 5. Attribution des nouveaux badges ────────────────────────────────────
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
