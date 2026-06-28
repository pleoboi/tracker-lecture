import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { BADGE_DEFS, BADGE_CUTOFF_DATE, getStatValue, type UserBadgeStats } from "../../../../lib/badges";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type LogRow = { book_id: string; date: string; pages_read: number | null; created_at: string };

export async function POST(req: NextRequest) {
  const { userId } = (await req.json()) as { userId?: string };
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── 1. Sessions depuis la date butoir (avec heure pour les badges horaires) ─
  const { data: recentLogsData } = await db
    .from("reading_logs")
    .select("book_id, date, pages_read, created_at")
    .eq("user_id", userId)
    .gte("date", BADGE_CUTOFF_DATE);

  const recentLogs      = (recentLogsData ?? []) as LogRow[];
  const activeBookIds   = [...new Set(recentLogs.map((r) => r.book_id))];
  const totalPages      = recentLogs.reduce((s, r) => s + (r.pages_read ?? 0), 0);
  const sessionsCount   = recentLogs.length;

  // ── Streak max ────────────────────────────────────────────────────────────
  const dateSet = [...new Set(recentLogs.map((r) => r.date))].sort();
  let maxStreak = dateSet.length > 0 ? 1 : 0;
  let streak    = 1;
  for (let i = 1; i < dateSet.length; i++) {
    const d = Math.round(
      (new Date(dateSet[i]).getTime() - new Date(dateSet[i - 1]).getTime()) / 86400000
    );
    if (d === 1) { streak++; if (streak > maxStreak) maxStreak = streak; }
    else if (d > 1) streak = 1;
  }

  const monthlySessionCount = recentLogs.filter(
    (r) => r.date >= "2026-07-01" && r.date <= "2026-07-31"
  ).length;

  // ── 2. Livres actifs depuis la date butoir ────────────────────────────────
  let booksCompleted = 0, uniqueGenres = 0, reviewsCount = 0;

  if (activeBookIds.length > 0) {
    const [booksRes, reviewsRes] = await Promise.all([
      db.from("books").select("genre, status").eq("user_id", userId).in("id", activeBookIds),
      db.from("books").select("id", { count: "exact", head: true })
        .eq("user_id", userId).not("notes", "is", null).neq("notes", "").in("id", activeBookIds),
    ]);
    const books = (booksRes.data ?? []) as { genre: string | null; status: string }[];
    booksCompleted = books.filter((b) => b.status === "completed").length;
    reviewsCount   = reviewsRes.count ?? 0;
    const genreSet = new Set<string>();
    for (const b of books) {
      if (!b.genre || b.status !== "completed") continue;
      b.genre.split(/[,;]+/).forEach((g) => { const t = g.trim(); if (t) genreSet.add(t); });
    }
    uniqueGenres = genreSet.size;
  }

  const stats: UserBadgeStats = {
    booksCompleted, uniqueGenres, sessionsCount, reviewsCount,
    totalPages, maxStreak, monthlySessionCount,
  };

  // ── 3. Badges déjà débloqués ──────────────────────────────────────────────
  const { data: existing } = await db
    .from("user_badges").select("badge_id").eq("user_id", userId);
  const unlockedIds = new Set((existing ?? []).map((r: { badge_id: string }) => r.badge_id));

  // ── 4. Attribution badges standards (stats numériques) ───────────────────
  const toAward = BADGE_DEFS.filter((def) => {
    if (unlockedIds.has(def.id) || def.isSpecial) return false;
    return getStatValue(def, stats) >= def.targetValue;
  });

  // ── 5. Checks badges spéciaux ─────────────────────────────────────────────
  const can = (id: string) => !unlockedIds.has(id);

  // ── Événements temporels ──────────────────────────────────────────────────
  const logDates = recentLogs.map((r) => r.date);
  if (can("event-dec31") && logDates.some((d) => d.slice(5) === "12-31")) toAward.push(BADGE_DEFS.find((b) => b.id === "event-dec31")!);
  if (can("event-jan1")  && logDates.some((d) => d.slice(5) === "01-01")) toAward.push(BADGE_DEFS.find((b) => b.id === "event-jan1")!);
  if (can("event-feb14") && logDates.some((d) => d.slice(5) === "02-14")) toAward.push(BADGE_DEFS.find((b) => b.id === "event-feb14")!);
  if (can("event-mar8")  && logDates.some((d) => d.slice(5) === "03-08")) toAward.push(BADGE_DEFS.find((b) => b.id === "event-mar8")!);

  // ── Badges horaires (heure locale du log via created_at UTC) ─────────────
  const logHours = recentLogs.map((r) => new Date(r.created_at).getHours());
  if (can("time-dawn")  && logHours.some((h) => h >= 4 && h < 7))           toAward.push(BADGE_DEFS.find((b) => b.id === "time-dawn")!);
  if (can("time-night") && logHours.some((h) => h >= 22 || h < 4))          toAward.push(BADGE_DEFS.find((b) => b.id === "time-night")!);

  // ── Performance : Le Rituel (30 jours consécutifs 15+ pages) ─────────────
  if (can("perf-ritual")) {
    const dayTotals = new Map<string, number>();
    for (const log of recentLogs) dayTotals.set(log.date, (dayTotals.get(log.date) ?? 0) + (log.pages_read ?? 0));
    const qualDays = [...dayTotals.entries()].filter(([, p]) => p >= 15).map(([d]) => d).sort();
    let maxC = qualDays.length > 0 ? 1 : 0, c = 1;
    for (let i = 1; i < qualDays.length; i++) {
      const d = Math.round((new Date(qualDays[i]).getTime() - new Date(qualDays[i - 1]).getTime()) / 86400000);
      if (d === 1) { c++; if (c > maxC) maxC = c; } else if (d > 1) c = 1;
    }
    if (maxC >= 30) toAward.push(BADGE_DEFS.find((b) => b.id === "perf-ritual")!);
  }

  // ── Performance : L'Inlassable (60 jours consécutifs) ────────────────────
  if (can("perf-unending") && maxStreak >= 60) toAward.push(BADGE_DEFS.find((b) => b.id === "perf-unending")!);

  // ── Performance : Toujours plus haut (7 jours croissants) ────────────────
  if (can("perf-climbing")) {
    const dayTotals = new Map<string, number>();
    for (const log of recentLogs) dayTotals.set(log.date, (dayTotals.get(log.date) ?? 0) + (log.pages_read ?? 0));
    const sorted = [...dayTotals.entries()].sort(([a], [b]) => a.localeCompare(b));
    let maxClimb = sorted.length > 0 ? 1 : 0, climb = 1;
    for (let i = 1; i < sorted.length; i++) {
      const dayDiff   = Math.round((new Date(sorted[i][0]).getTime() - new Date(sorted[i - 1][0]).getTime()) / 86400000);
      const pagesMore = sorted[i][1] > sorted[i - 1][1];
      if (dayDiff === 1 && pagesMore) { climb++; if (climb > maxClimb) maxClimb = climb; }
      else climb = 1;
    }
    if (maxClimb >= 7) toAward.push(BADGE_DEFS.find((b) => b.id === "perf-climbing")!);
  }

  // ── Performance : Le Pavé (livre 800+ pages ou 300 pages/jour) ───────────
  if (can("perf-brick")) {
    let met = false;
    if (activeBookIds.length > 0) {
      const { data: bigBooks } = await db.from("books")
        .select("id").eq("user_id", userId).eq("status", "completed")
        .gte("pages", 800).in("id", activeBookIds).limit(1);
      met = (bigBooks?.length ?? 0) > 0;
    }
    if (!met) {
      const dayTotals = new Map<string, number>();
      for (const log of recentLogs) dayTotals.set(log.date, (dayTotals.get(log.date) ?? 0) + (log.pages_read ?? 0));
      met = [...dayTotals.values()].some((p) => p >= 300);
    }
    if (met) toAward.push(BADGE_DEFS.find((b) => b.id === "perf-brick")!);
  }

  // ── Social : Identité (photo de profil) ───────────────────────────────────
  if (can("social-id")) {
    const { data: prof } = await db.from("user_profiles").select("avatar_url").eq("id", userId).single();
    if (prof?.avatar_url) toAward.push(BADGE_DEFS.find((b) => b.id === "social-id")!);
  }

  // ── Social : Illustrateur (photo de session) ──────────────────────────────
  if (can("social-photo")) {
    const { data: files } = await db.storage.from("session-photos").list(userId, { limit: 1 });
    if ((files?.length ?? 0) > 0) toAward.push(BADGE_DEFS.find((b) => b.id === "social-photo")!);
  }

  // ── Social : Plébiscité (25 likes) — skip si table absente ───────────────
  // Décommentez quand la table "likes" est disponible :
  // if (can("social-liked")) {
  //   const { count } = await db.from("likes").select("id", { count: "exact", head: true })
  //     .eq("liked_user_id", userId);
  //   if ((count ?? 0) >= 25) toAward.push(BADGE_DEFS.find(b => b.id === "social-liked")!);
  // }

  // ── 6. Dédoublonner (un badge ne peut être attribué qu'une fois) ──────────
  const uniqueAward = [...new Map(toAward.filter(Boolean).map((d) => [d.id, d])).values()];

  if (uniqueAward.length > 0) {
    await db.from("user_badges").insert(
      uniqueAward.map((def) => ({ user_id: userId, badge_id: def.id }))
    );
  }

  return NextResponse.json({
    awarded: uniqueAward.map((d) => ({ id: d.id, name: d.name, tier: d.tier, points: d.points })),
    stats,
  });
}
