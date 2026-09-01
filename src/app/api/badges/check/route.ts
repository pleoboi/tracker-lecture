import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { BADGE_DEFS, BADGE_CUTOFF_DATE, getStatValue, type UserBadgeStats } from "../../../../lib/badges";
import { sendPushToUser } from "../../../../lib/push.server";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type LogRow = {
  book_id: string; date: string; pages_read: number | null; created_at: string;
  session_notes: string | null; session_photo_url: string | null;
};
type BookRow = {
  id: number; genre: string | null; status: string; author: string | null;
  pages: number | null; rating: number | null; published_year: number | null;
  notes: string | null; date_read: string | null;
};

const db = createClient(SUPABASE_URL, SERVICE_KEY);

// Détecte une citation dans une note de session (guillemets français ou droits,
// contenu substantiel pour écarter les faux positifs).
function containsQuote(text: string): boolean {
  const m = text.match(/[«"][^»"]{8,}[»"]/);
  return !!m;
}

// Reproduit le calcul des scores d'un défi (identique à la logique client de la
// page membre) pour déterminer si l'utilisateur a terminé premier.
async function computeChallengeScores(
  metric: "pages" | "books" | "sessions",
  startDate: string,
  endDate: string,
  participantIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!participantIds.length) return map;
  if (metric === "pages") {
    const { data } = await db.from("reading_logs").select("user_id, pages_read")
      .in("user_id", participantIds).gte("date", startDate).lte("date", endDate);
    for (const r of (data ?? []) as { user_id: string; pages_read: number }[])
      map.set(r.user_id, (map.get(r.user_id) ?? 0) + (r.pages_read ?? 0));
  } else if (metric === "books") {
    const { data } = await db.from("books").select("user_id")
      .in("user_id", participantIds).eq("status", "completed")
      .gte("date_read", startDate).lte("date_read", endDate);
    for (const r of (data ?? []) as { user_id: string }[])
      map.set(r.user_id, (map.get(r.user_id) ?? 0) + 1);
  } else {
    const { data } = await db.from("reading_logs").select("user_id")
      .in("user_id", participantIds).gte("date", startDate).lte("date", endDate);
    for (const r of (data ?? []) as { user_id: string }[])
      map.set(r.user_id, (map.get(r.user_id) ?? 0) + 1);
  }
  return map;
}

export async function POST(req: NextRequest) {
  const { userId } = (await req.json()) as { userId?: string };
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  // ── 1. Sessions depuis la date butoir (avec heure pour les badges horaires) ─
  const { data: recentLogsData } = await db
    .from("reading_logs")
    .select("book_id, date, pages_read, created_at, session_notes, session_photo_url")
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

  // ── 2. Livres actifs depuis la date butoir ────────────────────────────────
  let booksCompleted = 0, uniqueGenres = 0, reviewsCount = 0, monthlyBooksCount = 0;
  let books: BookRow[] = [];

  const today = new Date();
  const thisYear   = today.getFullYear();
  const thisMonth  = String(today.getMonth() + 1).padStart(2, "0");
  // Date du jour en calendrier local (pas toISOString, qui bascule en UTC et peut
  // désigner le mauvais jour autour de minuit heure française).
  const todayStr = `${thisYear}-${thisMonth}-${String(today.getDate()).padStart(2, "0")}`;
  const firstOfMonth = `${thisYear}-${thisMonth}-01`;
  // Dernier jour réel du mois (évite les faux positifs si 31 n'existe pas)
  const lastOfMonth  = `${thisYear}-${thisMonth}-${String(new Date(thisYear, today.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;

  const monthlySessionCount = recentLogs.filter(
    (r) => r.date >= firstOfMonth && r.date <= lastOfMonth
  ).length;
  const monthlyPagesCount = recentLogs
    .filter((r) => r.date >= firstOfMonth && r.date <= lastOfMonth)
    .reduce((s, r) => s + (r.pages_read ?? 0), 0);

  if (activeBookIds.length > 0) {
    const [booksRes, monthlyBooksRes] = await Promise.all([
      db.from("books")
        .select("id, genre, status, author, pages, rating, published_year, notes, date_read")
        .eq("user_id", userId).in("id", activeBookIds),
      db.from("books").select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("status", "completed")
        .gte("date_read", firstOfMonth).in("id", activeBookIds),
    ]);
    books = (booksRes.data ?? []) as BookRow[];
    booksCompleted    = books.filter((b) => b.status === "completed").length;
    reviewsCount      = books.filter((b) => b.notes && b.notes.trim().length > 0).length;
    monthlyBooksCount = monthlyBooksRes.count ?? 0;
    const genreSet = new Set<string>();
    for (const b of books) {
      if (!b.genre || b.status !== "completed") continue;
      b.genre.split(/[,;]+/).forEach((g) => { const t = g.trim(); if (t) genreSet.add(t); });
    }
    uniqueGenres = genreSet.size;
  }
  const completedBooks = books.filter((b) => b.status === "completed");

  // Bibliothèque complète ajoutée depuis la date butoir (indépendant des sessions
  // de lecture — sert aux badges d'import et de complétude ISBN).
  const { data: libraryData } = await db
    .from("books")
    .select("id, isbn13, import_source")
    .eq("user_id", userId)
    .gte("created_at", BADGE_CUTOFF_DATE);
  const library = (libraryData ?? []) as { id: number; isbn13: string | null; import_source: string | null }[];

  // ── Profil utilisateur (pour les badges cumulatifs et l'ancienneté) ──────
  const { data: profileData } = await db
    .from("user_profiles")
    .select("sprint_eclair_count, sprint_bonus_points, created_at")
    .eq("id", userId)
    .single();
  const profile = profileData as { sprint_eclair_count: number; created_at: string } | null;
  const currentSprintCount = profile?.sprint_eclair_count ?? 0;

  const stats: UserBadgeStats = {
    booksCompleted, uniqueGenres, sessionsCount, reviewsCount,
    totalPages, maxStreak, monthlySessionCount, monthlyBooksCount,
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
  const award = (id: string) => { const d = BADGE_DEFS.find((b) => b.id === id); if (d) toAward.push(d); };

  // ── Événements temporels ──────────────────────────────────────────────────
  const logDates = recentLogs.map((r) => r.date);
  if (can("event-dec31") && logDates.some((d) => d.slice(5) === "12-31")) award("event-dec31");
  if (can("event-jan1")  && logDates.some((d) => d.slice(5) === "01-01")) award("event-jan1");
  if (can("event-feb14") && logDates.some((d) => d.slice(5) === "02-14")) award("event-feb14");
  if (can("event-mar8")  && logDates.some((d) => d.slice(5) === "03-08")) award("event-mar8");
  if (can("event-sep1")  && logDates.some((d) => d.slice(5) === "09-01")) award("event-sep1");
  if (can("event-oct31")) {
    const oct31Books = new Set(
      recentLogs.filter((r) => r.date.slice(5) === "10-31").map((r) => r.book_id)
    );
    if (oct31Books.size > 0) {
      const spookyGenres = ["thriller", "horreur", "policier"];
      const hit = books.some(
        (b) => oct31Books.has(String(b.id)) && b.genre &&
          spookyGenres.some((g) => b.genre!.toLowerCase().includes(g))
      );
      if (hit) award("event-oct31");
    }
  }

  // ── Badges horaires (heure locale du log via created_at UTC) ─────────────
  const logHours = recentLogs.map((r) => new Date(r.created_at).getHours());
  if (can("time-dawn")  && logHours.some((h) => h >= 4 && h < 7))  award("time-dawn");
  if (can("time-night") && logHours.some((h) => h >= 22 || h < 4)) award("time-night");

  // ── Performance : Le Rituel (30 jours consécutifs 15+ pages) ─────────────
  const dayTotals = new Map<string, number>();
  for (const log of recentLogs) dayTotals.set(log.date, (dayTotals.get(log.date) ?? 0) + (log.pages_read ?? 0));

  if (can("perf-ritual")) {
    const qualDays = [...dayTotals.entries()].filter(([, p]) => p >= 15).map(([d]) => d).sort();
    let maxC = qualDays.length > 0 ? 1 : 0, c = 1;
    for (let i = 1; i < qualDays.length; i++) {
      const d = Math.round((new Date(qualDays[i]).getTime() - new Date(qualDays[i - 1]).getTime()) / 86400000);
      if (d === 1) { c++; if (c > maxC) maxC = c; } else if (d > 1) c = 1;
    }
    if (maxC >= 30) award("perf-ritual");
  }

  // ── Performance : L'Inlassable (60 jours) et Le Centenaire (100 jours) ───
  if (can("perf-unending") && maxStreak >= 60)  award("perf-unending");
  if (can("perf-100days")  && maxStreak >= 100) award("perf-100days");

  // ── Performance : Toujours plus haut (7 jours croissants) ────────────────
  if (can("perf-climbing")) {
    const sorted = [...dayTotals.entries()].sort(([a], [b]) => a.localeCompare(b));
    let maxClimb = sorted.length > 0 ? 1 : 0, climb = 1;
    for (let i = 1; i < sorted.length; i++) {
      const dayDiff   = Math.round((new Date(sorted[i][0]).getTime() - new Date(sorted[i - 1][0]).getTime()) / 86400000);
      const pagesMore = sorted[i][1] > sorted[i - 1][1];
      if (dayDiff === 1 && pagesMore) { climb++; if (climb > maxClimb) maxClimb = climb; }
      else climb = 1;
    }
    if (maxClimb >= 7) award("perf-climbing");
  }

  // ── Performance : Le Pavé (livre 800+ pages ou 300 pages/jour) ───────────
  if (can("perf-brick")) {
    const met = completedBooks.some((b) => (b.pages ?? 0) >= 800)
      || [...dayTotals.values()].some((p) => p >= 300);
    if (met) award("perf-brick");
  }

  // ── Performance : Le Pavé Ultime (1000+ pages) ────────────────────────────
  if (can("perf-brick2") && completedBooks.some((b) => (b.pages ?? 0) >= 1000)) award("perf-brick2");

  // ── Performance : Format Court (10 livres < 150 pages) ────────────────────
  if (can("perf-shorts")) {
    const shortCount = completedBooks.filter((b) => (b.pages ?? 0) > 0 && (b.pages ?? 0) < 150).length;
    if (shortCount >= 10) award("perf-shorts");
  }

  // ── Performance : Le Millier (1000 pages en une semaine glissante) ───────
  if (can("perf-week1000")) {
    const days = [...dayTotals.keys()].sort();
    let hit = false;
    for (const startDay of days) {
      const start = new Date(startDay).getTime();
      const end = start + 6 * 86400000;
      let sum = 0;
      for (const [d, p] of dayTotals) {
        const t = new Date(d).getTime();
        if (t >= start && t <= end) sum += p;
      }
      if (sum >= 1000) { hit = true; break; }
    }
    if (hit) award("perf-week1000");
  }

  // ── Performance : Le Century (100 pages en une session) ──────────────────
  if (can("perf-century") && recentLogs.some((r) => (r.pages_read ?? 0) >= 100)) award("perf-century");

  // ── Performance : Retour de Flamme (reprise après 30 jours d'inactivité) ─
  if (can("perf-comeback")) {
    const sortedDates = [...dateSet];
    let comeback = false;
    for (let i = 1; i < sortedDates.length; i++) {
      const gap = Math.round((new Date(sortedDates[i]).getTime() - new Date(sortedDates[i - 1]).getTime()) / 86400000);
      if (gap >= 30) { comeback = true; break; }
    }
    if (comeback) award("perf-comeback");
  }

  // ── Genres : Le Spécialiste (10 livres d'un même genre) ──────────────────
  if (can("genre-specialist")) {
    const perGenre = new Map<string, number>();
    for (const b of completedBooks) {
      if (!b.genre) continue;
      b.genre.split(/[,;]+/).forEach((g) => {
        const t = g.trim();
        if (t) perGenre.set(t, (perGenre.get(t) ?? 0) + 1);
      });
    }
    if ([...perGenre.values()].some((c) => c >= 10)) award("genre-specialist");
  }

  // ── Auteurs ────────────────────────────────────────────────────────────────
  if (can("author-loyal") || can("author-collect")) {
    const perAuthor = new Map<string, number>();
    for (const b of completedBooks) {
      if (!b.author) continue;
      perAuthor.set(b.author, (perAuthor.get(b.author) ?? 0) + 1);
    }
    if (can("author-loyal") && [...perAuthor.values()].some((c) => c >= 3)) award("author-loyal");
    if (can("author-collect") && perAuthor.size >= 20) award("author-collect");
  }
  if (can("author-contemp")) {
    const count = completedBooks.filter((b) => b.published_year === thisYear).length;
    if (count >= 5) award("author-contemp");
  }
  if (can("author-classic")) {
    const count = completedBooks.filter((b) => (b.published_year ?? 9999) < 1950).length;
    if (count >= 5) award("author-classic");
  }

  // ── Reviews & notes ───────────────────────────────────────────────────────
  if (can("review-long") && completedBooks.some((b) => (b.notes ?? "").trim().length >= 500)) {
    award("review-long");
  }
  if (can("note-quote")) {
    const quoteCount = recentLogs.filter((r) => r.session_notes && containsQuote(r.session_notes)).length;
    if (quoteCount >= 10) award("note-quote");
  }

  // ── Notes attribuées ──────────────────────────────────────────────────────
  const ratedBooks = completedBooks.filter((b) => (b.rating ?? 0) > 0);
  if (can("rating-harsh") && ratedBooks.filter((b) => (b.rating ?? 0) < 2).length >= 5) award("rating-harsh");
  if (can("rating-lover") && ratedBooks.filter((b) => (b.rating ?? 0) === 5).length >= 10) award("rating-lover");
  if (can("rating-balanced") && ratedBooks.length >= 20) {
    const avg = ratedBooks.reduce((s, b) => s + (b.rating ?? 0), 0) / ratedBooks.length;
    if (avg >= 3 && avg <= 4) award("rating-balanced");
  }

  // ── Social : Identité (photo de profil) ───────────────────────────────────
  if (can("social-id")) {
    const { data: prof } = await db.from("user_profiles").select("avatar_url").eq("id", userId).single();
    if (prof?.avatar_url) award("social-id");
  }

  // ── Social : Illustrateur / Photographe Confirmé (photos de session) ─────
  if (can("social-photo") || can("social-photographer")) {
    const photoCount = recentLogs.filter((r) => !!r.session_photo_url).length;
    if (can("social-photo") && photoCount > 0) award("social-photo");
    if (can("social-photographer") && photoCount >= 20) award("social-photographer");
  }

  // ── Social : Influenceur (abonnés) ────────────────────────────────────────
  if (can("social-influencer")) {
    const { count } = await db.from("user_follows").select("id", { count: "exact", head: true })
      .eq("following_id", userId).gte("created_at", BADGE_CUTOFF_DATE);
    if ((count ?? 0) >= 10) award("social-influencer");
  }

  // ── Social : Le Généreux (recommandations envoyées) ───────────────────────
  if (can("social-generous")) {
    const { count } = await db.from("notifications").select("id", { count: "exact", head: true })
      .eq("from_user_id", userId).eq("type", "book_recommendation").gte("created_at", BADGE_CUTOFF_DATE);
    if ((count ?? 0) >= 10) award("social-generous");
  }

  // ── Social : Plébiscité+ (50 likes cumulés, sessions + reviews) ──────────
  if (can("social-liked-2")) {
    const { data: ownLogIds } = await db.from("reading_logs").select("id").eq("user_id", userId);
    const logIdStrs = ((ownLogIds ?? []) as { id: number }[]).map((r) => String(r.id));
    const [sessionLikesRes, reviewLikesRes] = await Promise.all([
      logIdStrs.length
        ? db.from("session_likes").select("id", { count: "exact", head: true })
            .in("log_id", logIdStrs).gte("created_at", BADGE_CUTOFF_DATE)
        : Promise.resolve({ count: 0 }),
      db.from("review_likes").select("id", { count: "exact", head: true })
        .eq("reviewer_user_id", userId).gte("created_at", BADGE_CUTOFF_DATE),
    ]);
    const totalLikes = (sessionLikesRes.count ?? 0) + (reviewLikesRes.count ?? 0);
    if (totalLikes >= 50) award("social-liked-2");
  }

  // ── Social : Le Commentateur (commentaires rédigés) ───────────────────────
  if (can("social-commenter")) {
    const { count } = await db.from("session_comments").select("id", { count: "exact", head: true })
      .eq("user_id", userId).gte("created_at", BADGE_CUTOFF_DATE);
    if ((count ?? 0) >= 20) award("social-commenter");
  }

  // ── Social : Le Mentor (suivre 5 membres récemment inscrits) ─────────────
  if (can("social-mentor")) {
    const { data: follows } = await db.from("user_follows").select("following_id")
      .eq("follower_id", userId).gte("created_at", BADGE_CUTOFF_DATE);
    const followingIds = [...new Set(((follows ?? []) as { following_id: string }[]).map((f) => f.following_id))];
    if (followingIds.length > 0) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: followedProfiles } = await db.from("user_profiles").select("id, created_at")
        .in("id", followingIds).gte("created_at", thirtyDaysAgo);
      if ((followedProfiles?.length ?? 0) >= 5) award("social-mentor");
    }
  }

  // ── Défis de club ─────────────────────────────────────────────────────────
  if (can("challenge-winner") || can("challenge-finisher") || can("challenge-addict")) {
    const { data: myParts } = await db.from("challenge_participants")
      .select("challenge_id").eq("user_id", userId).eq("status", "accepted");
    const myChallengeIds = [...new Set(((myParts ?? []) as { challenge_id: string }[]).map((p) => p.challenge_id))];

    if (myChallengeIds.length > 0) {
      const { data: challengesData } = await db.from("challenges")
        .select("id, metric, start_date, end_date")
        .in("id", myChallengeIds)
        .gte("start_date", BADGE_CUTOFF_DATE);
      const challenges = (challengesData ?? []) as
        { id: string; metric: "pages" | "books" | "sessions"; start_date: string; end_date: string }[];

      if (can("challenge-addict") && challenges.length >= 5) award("challenge-addict");

      const ended = challenges.filter((c) => c.end_date < todayStr);
      if (can("challenge-finisher") && ended.length >= 1) award("challenge-finisher");

      if (can("challenge-winner")) {
        for (const c of ended) {
          const { data: partsData } = await db.from("challenge_participants")
            .select("user_id").eq("challenge_id", c.id).eq("status", "accepted");
          const participantIds = ((partsData ?? []) as { user_id: string }[]).map((p) => p.user_id);
          if (participantIds.length < 2) continue; // pas de "vainqueur" seul face à soi-même
          const scores = await computeChallengeScores(c.metric, c.start_date, c.end_date, participantIds);
          const myScore = scores.get(userId) ?? 0;
          const maxScore = Math.max(...scores.values());
          if (myScore > 0 && myScore === maxScore) { award("challenge-winner"); break; }
        }
      }
    }
  }

  // ── Défis à objectif individuel : points de récompense ───────────────────
  // Contrairement au classement compétitif ci-dessus (un seul gagnant), ce
  // mode récompense TOUT participant qui atteint la cible (ex. "Finir 5
  // livres avant la fin de l'année"). On ne verse les points qu'une fois par
  // participant, en marquant challenge_participants.completed_at.
  let challengePointsAwarded = 0;
  const { data: myPendingGoalParts } = await db
    .from("challenge_participants")
    .select("challenge_id")
    .eq("user_id", userId)
    .eq("status", "accepted")
    .is("completed_at", null);
  const pendingGoalChallengeIds = [...new Set(
    ((myPendingGoalParts ?? []) as { challenge_id: string }[]).map((p) => p.challenge_id)
  )];

  if (pendingGoalChallengeIds.length > 0) {
    const { data: goalChallengesData } = await db
      .from("challenges")
      .select("id, metric, target_value, reward_points, start_date, end_date")
      .in("id", pendingGoalChallengeIds)
      .not("target_value", "is", null)
      .lte("start_date", todayStr);
    const goalChallenges = (goalChallengesData ?? []) as {
      id: string; metric: "pages" | "books" | "sessions";
      target_value: number; reward_points: number; start_date: string; end_date: string;
    }[];

    for (const c of goalChallenges) {
      const scores = await computeChallengeScores(c.metric, c.start_date, c.end_date, [userId]);
      const myScore = scores.get(userId) ?? 0;
      if (myScore < c.target_value) continue;
      await db.from("challenge_participants")
        .update({ completed_at: new Date().toISOString() })
        .eq("challenge_id", c.id).eq("user_id", userId);
      challengePointsAwarded += c.reward_points ?? 0;
    }

    if (challengePointsAwarded > 0) {
      const { data: profRow } = await db.from("user_profiles")
        .select("challenge_bonus_points").eq("id", userId).single();
      const currentChallengePoints = (profRow as { challenge_bonus_points?: number } | null)?.challenge_bonus_points ?? 0;
      await db.from("user_profiles")
        .update({ challenge_bonus_points: currentChallengePoints + challengePointsAwarded })
        .eq("id", userId);

      try {
        await sendPushToUser(userId, {
          title: "Swena",
          body: `Objectif de challenge atteint : +${challengePointsAwarded} points !`,
          url: `/membre/${userId}`,
        }, "badges");
      } catch (e) {
        console.error("[badges] push error (challenge points):", e);
      }
    }
  }

  // ── Ancienneté du compte ──────────────────────────────────────────────────
  if (profile?.created_at) {
    const accountAgeDays = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000);
    if (can("anniversary-1") && accountAgeDays >= 365) award("anniversary-1");
    if (can("anniversary-2") && accountAgeDays >= 730) award("anniversary-2");
  }

  // ── Bibliothèque : Le Migrateur (import Goodreads) & Le Bibliothécaire (ISBN) ─
  if (can("import-migrator")) {
    const importCount = library.filter((b) => b.import_source === "goodreads").length;
    if (importCount >= 50) award("import-migrator");
  }
  if (can("isbn-librarian")) {
    const isbnCount = library.filter((b) => !!b.isbn13).length;
    if (isbnCount >= 20) award("isbn-librarian");
  }

  // ── Sprint Éclair : livre dévoré dans la même journée (cumulatif) ────────
  let newSprintCount = 0;
  if (activeBookIds.length > 0) {
    const { data: sprintBooks } = await db
      .from("books")
      .select("id, date_started, date_read")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("date_read", BADGE_CUTOFF_DATE)
      .not("date_started", "is", null)
      .neq("import_source", "goodreads")
      .in("id", activeBookIds);

    const sprintTotal = ((sprintBooks ?? []) as { date_started: string | null; date_read: string | null }[])
      .filter((b) => b.date_started && b.date_read && b.date_started === b.date_read)
      .length;

    newSprintCount = sprintTotal - currentSprintCount;
    if (newSprintCount > 0) {
      await db.from("user_profiles").update({
        sprint_eclair_count: sprintTotal,
        sprint_bonus_points: sprintTotal * 40,
      }).eq("id", userId);

      if (currentSprintCount === 0) award("sprint-eclair");
    }
  }

  // ── Défi mensuel livres : 3 livres DANS le mois en cours uniquement ────────
  const currentMonthBooksId = `defi-books-${thisYear}-${thisMonth}`;
  if (can(currentMonthBooksId) && monthlyBooksCount >= 3) {
    const def = BADGE_DEFS.find((b) => b.id === currentMonthBooksId);
    // Double garde : ne décerner que si aujourd'hui est bien dans la fenêtre du badge
    if (def?.startDate && def?.endDate && todayStr >= def.startDate && todayStr <= def.endDate) {
      toAward.push(def);
    }
  }

  // ── Défi mensuel sessions : 15 sessions DANS le mois en cours uniquement ──
  const currentMonthSessionsId = `defi-sessions-${thisYear}-${thisMonth}`;
  if (can(currentMonthSessionsId)) {
    const def = BADGE_DEFS.find((b) => b.id === currentMonthSessionsId);
    // Double garde identique
    if (
      def?.startDate && def?.endDate &&
      todayStr >= def.startDate && todayStr <= def.endDate &&
      monthlySessionCount >= def.targetValue
    ) {
      toAward.push(def);
    }
  }

  // ── Champion du mois : champion du jour 20 fois dans le mois en cours ────
  const currentMonthChampionId = `champion-month-${thisYear}-${thisMonth}`;
  if (can(currentMonthChampionId)) {
    const def = BADGE_DEFS.find((b) => b.id === currentMonthChampionId);
    const inWindow = def?.startDate && def?.endDate && todayStr >= def.startDate && todayStr <= def.endDate;
    if (def && inWindow) {
      const { data: monthAllLogs } = await db.from("reading_logs")
        .select("user_id, pages_read, date").gte("date", firstOfMonth).lte("date", lastOfMonth);
      const perDayPerUser = new Map<string, Map<string, number>>();
      for (const r of (monthAllLogs ?? []) as { user_id: string; pages_read: number; date: string }[]) {
        if (!perDayPerUser.has(r.date)) perDayPerUser.set(r.date, new Map());
        const m = perDayPerUser.get(r.date)!;
        m.set(r.user_id, (m.get(r.user_id) ?? 0) + (r.pages_read ?? 0));
      }
      let championDays = 0;
      for (const userMap of perDayPerUser.values()) {
        const maxPages = Math.max(...userMap.values());
        if (maxPages > 0 && (userMap.get(userId) ?? 0) >= maxPages) championDays++;
      }
      if (championDays >= def.targetValue) toAward.push(def);
    }
  }

  // ── Objectifs personnels : fixés, dépassés, atteints sur le mois en cours ─
  const { data: goalsData } = await db
    .from("user_goals")
    .select("reading_pages_year, reading_books_year")
    .eq("user_id", userId)
    .maybeSingle();
  const goals = goalsData as { reading_pages_year: number | null; reading_books_year: number | null } | null;

  if (can("goal-set-pages") && goals?.reading_pages_year) award("goal-set-pages");
  if (can("goal-set-books") && goals?.reading_books_year) award("goal-set-books");

  const currentMonthGoalId = `goal-month-${thisYear}-${thisMonth}`;
  if (can(currentMonthGoalId)) {
    const def = BADGE_DEFS.find((b) => b.id === currentMonthGoalId);
    const inWindow = def?.startDate && def?.endDate && todayStr >= def.startDate && todayStr <= def.endDate;
    const pagesGoalHit = !!goals?.reading_pages_year && monthlyPagesCount >= goals.reading_pages_year / 12;
    const booksGoalHit = !!goals?.reading_books_year && monthlyBooksCount >= goals.reading_books_year / 12;
    if (def && inWindow && (pagesGoalHit || booksGoalHit)) {
      toAward.push(def);
    }
  }

  // ── Objectif Dépassé (+20 % sur l'année en cours) ─────────────────────────
  if (can("goal-exceeded") && (goals?.reading_pages_year || goals?.reading_books_year)) {
    const yearStart = `${thisYear}-01-01` > BADGE_CUTOFF_DATE ? `${thisYear}-01-01` : BADGE_CUTOFF_DATE;
    const pagesThisYear = recentLogs.filter((r) => r.date >= yearStart).reduce((s, r) => s + (r.pages_read ?? 0), 0);
    const booksThisYear = completedBooks.filter((b) => (b.date_read ?? "") >= yearStart).length;
    const pagesExceeded = !!goals?.reading_pages_year && pagesThisYear >= goals.reading_pages_year * 1.2;
    const booksExceeded = !!goals?.reading_books_year && booksThisYear >= goals.reading_books_year * 1.2;
    if (pagesExceeded || booksExceeded) award("goal-exceeded");
  }

  // ── Trois Mois d'Affilée / Année Parfaite ─────────────────────────────────
  if ((can("goal-3-months") || can("goal-12-months")) && (goals?.reading_pages_year || goals?.reading_books_year)) {
    const pagesByMonth = new Map<string, number>();
    for (const r of recentLogs) {
      const key = r.date.slice(0, 7);
      pagesByMonth.set(key, (pagesByMonth.get(key) ?? 0) + (r.pages_read ?? 0));
    }
    const booksByMonth = new Map<string, number>();
    for (const b of completedBooks) {
      if (!b.date_read) continue;
      const key = b.date_read.slice(0, 7);
      booksByMonth.set(key, (booksByMonth.get(key) ?? 0) + 1);
    }
    // Tous les mois calendaires depuis la date butoir jusqu'au mois en cours.
    const months: string[] = [];
    const cursor = new Date(BADGE_CUTOFF_DATE + "T12:00:00");
    cursor.setDate(1);
    const end = new Date(thisYear, today.getMonth(), 1);
    while (cursor <= end) {
      months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const monthHit = months.map((key) => {
      const pagesHit = !!goals?.reading_pages_year && (pagesByMonth.get(key) ?? 0) >= goals.reading_pages_year / 12;
      const booksHit = !!goals?.reading_books_year && (booksByMonth.get(key) ?? 0) >= goals.reading_books_year / 12;
      return pagesHit || booksHit;
    });

    if (can("goal-3-months")) {
      let run = 0, maxRun = 0;
      for (const hit of monthHit) { run = hit ? run + 1 : 0; if (run > maxRun) maxRun = run; }
      if (maxRun >= 3) award("goal-3-months");
    }
    if (can("goal-12-months")) {
      const byYear = new Map<number, boolean[]>();
      months.forEach((key, i) => {
        const y = Number(key.slice(0, 4));
        if (!byYear.has(y)) byYear.set(y, Array(12).fill(false));
        byYear.get(y)![Number(key.slice(5, 7)) - 1] = monthHit[i];
      });
      for (const [y, arr] of byYear) {
        if (y < thisYear && arr.every(Boolean)) { award("goal-12-months"); break; }
      }
    }
  }

  // ── 6. Dédoublonner (un badge ne peut être attribué qu'une fois) ──────────
  const uniqueAward = [...new Map(toAward.filter(Boolean).map((d) => [d.id, d])).values()];

  if (uniqueAward.length > 0) {
    // upsert avec ignoreDuplicates pour éviter les erreurs de contrainte unique
    await db.from("user_badges").upsert(
      uniqueAward.map((def) => ({ user_id: userId, badge_id: def.id })),
      { onConflict: "user_id,badge_id", ignoreDuplicates: true }
    );

    // Notification push (fonctionne en fond et au premier plan via le service worker).
    try {
      const body =
        uniqueAward.length === 1
          ? `Nouveau badge débloqué : ${uniqueAward[0].name}`
          : `${uniqueAward.length} nouveaux badges débloqués !`;
      await sendPushToUser(userId, { title: "Swena", body, url: `/membre/${userId}` }, "badges");
    } catch (e) {
      console.error("[badges] push error:", e);
    }
  }

  return NextResponse.json({
    awarded: uniqueAward.map((d) => ({ id: d.id, name: d.name, tier: d.tier, points: d.points })),
    challengePointsAwarded,
    stats,
  });
}
