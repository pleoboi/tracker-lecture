import { supabase } from "./supabase";
import type { Book, ReadingLog } from "./types";

const MONTHS_FULL = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export interface WrappedStats {
  year: number;
  month: number; // 1-12
  monthLabel: string; // "Septembre 2026"
  totalPages: number;
  prevMonthPages: number | null;
  deltaPct: number | null; // évolution vs mois précédent, en %
  sessionsCount: number;
  daysActive: number;
  daysInMonth: number;
  longestStreak: number;
  booksCompleted: Book[];
  topBook: Book | null;
  topGenre: string | null;
  topGenrePages: number;
  bestDay: { date: string; pages: number } | null;
  avgPerActiveDay: number;
  rankPercentile: number | null; // % de lecteurs actifs dépassés ce mois-ci (0-100)
  activeReadersCount: number | null;
  topGenres: { genre: string; pages: number }[]; // top 3, pondéré par pages
  dailyPages: { date: string; pages: number }[]; // un point par jour du mois (0 si rien lu)
  coverPool: { id: number; title: string; cover_url: string | null }[]; // livres touchés ce mois-ci, pour les visuels
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function monthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${pad(month)}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const end = `${year}-${pad(month)}-${pad(daysInMonth)}`;
  return { start, end };
}

function longestConsecutiveStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const sorted = [...new Set(dates)].sort();
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + "T12:00:00");
    const next = new Date(sorted[i] + "T12:00:00");
    const diffDays = Math.round((next.getTime() - prev.getTime()) / 86_400_000);
    if (diffDays === 1) {
      cur++;
      best = Math.max(best, cur);
    } else {
      cur = 1;
    }
  }
  return best;
}

export async function getMonthlyWrapped(userId: string, year: number, month: number): Promise<WrappedStats | null> {
  const { start, end } = monthRange(year, month);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const { start: prevStart, end: prevEnd } = monthRange(prevYear, prevMonth);
  const daysInMonth = new Date(year, month, 0).getDate();

  const [
    { data: logsData },
    { data: prevLogsData },
    { data: booksData },
    { data: allLogsData },
  ] = await Promise.all([
    supabase.from("reading_logs").select("*").eq("user_id", userId).gte("date", start).lte("date", end),
    supabase.from("reading_logs").select("pages_read").eq("user_id", userId).gte("date", prevStart).lte("date", prevEnd),
    supabase.from("books").select("*").eq("user_id", userId),
    supabase.from("reading_logs").select("user_id, pages_read").gte("date", start).lte("date", end),
  ]);

  const logs = (logsData as ReadingLog[]) || [];
  const books = (booksData as Book[]) || [];
  const bookMap = new Map(books.map((b) => [b.id, b]));

  const totalPages = logs.reduce((s, l) => s + (l.pages_read || 0), 0);
  const sessionsCount = logs.length;

  if (totalPages === 0 && sessionsCount === 0) return null;

  const prevMonthPages = ((prevLogsData as { pages_read: number }[]) || []).reduce((s, l) => s + (l.pages_read || 0), 0);
  const deltaPct = prevMonthPages > 0 ? Math.round(((totalPages - prevMonthPages) / prevMonthPages) * 100) : null;

  const dayPages = new Map<string, number>();
  logs.forEach((l) => dayPages.set(l.date, (dayPages.get(l.date) || 0) + (l.pages_read || 0)));
  const daysActive = dayPages.size;
  const longestStreak = longestConsecutiveStreak([...dayPages.keys()]);

  let bestDay: { date: string; pages: number } | null = null;
  for (const [date, pages] of dayPages) {
    if (!bestDay || pages > bestDay.pages) bestDay = { date, pages };
  }

  const avgPerActiveDay = daysActive > 0 ? Math.round(totalPages / daysActive) : 0;

  // Livres terminés ce mois-ci (date_read prioritaire, sinon dernière session du mois)
  const booksCompleted = books.filter((b) => {
    if (b.status !== "completed") return false;
    let cs: string | null = b.date_read ?? null;
    if (!cs) {
      const last = logs.filter((l) => l.book_id === b.id).sort((a, c) => c.date.localeCompare(a.date))[0];
      if (last) cs = last.date;
    }
    return !!cs && cs >= start && cs <= end;
  });

  // Coup de cœur : meilleure note parmi les livres terminés ce mois, sinon le livre le plus lu
  let topBook: Book | null = null;
  if (booksCompleted.length > 0) {
    topBook = [...booksCompleted].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
  } else {
    const pagesByBook = new Map<number, number>();
    logs.forEach((l) => pagesByBook.set(l.book_id, (pagesByBook.get(l.book_id) || 0) + (l.pages_read || 0)));
    const topEntry = [...pagesByBook.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topEntry) topBook = bookMap.get(topEntry[0]) ?? null;
  }

  // Genre dominant, pondéré par pages lues ce mois. Un livre peut porter plusieurs
  // genres séparés par une virgule (même convention que GenreBreakdown) — on les
  // compte individuellement plutôt que comme une seule étiquette composite.
  const EXCLUDED_GENRES = new Set(["fiction", "non-fiction", "nonfiction"]);
  const pagesByGenre = new Map<string, number>();
  logs.forEach((l) => {
    const raw = bookMap.get(l.book_id)?.genre;
    if (!raw) return;
    raw.split(",").forEach((g) => {
      const genre = g.trim();
      if (!genre || EXCLUDED_GENRES.has(genre.toLowerCase())) return;
      pagesByGenre.set(genre, (pagesByGenre.get(genre) || 0) + (l.pages_read || 0));
    });
  });
  const genreRanking = [...pagesByGenre.entries()].sort((a, b) => b[1] - a[1]);
  const topGenreEntry = genreRanking[0];
  const topGenre = topGenreEntry?.[0] ?? null;
  const topGenrePages = topGenreEntry?.[1] ?? 0;
  const topGenres = genreRanking.slice(0, 3).map(([genre, pages]) => ({ genre, pages }));

  // Un point par jour du mois (0 si rien lu) — pour la frise/heatmap de régularité
  const dailyPages: { date: string; pages: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${pad(month)}-${pad(d)}`;
    dailyPages.push({ date, pages: dayPages.get(date) ?? 0 });
  }

  // Livres touchés ce mois-ci (lus ou terminés), triés par pages lues — pour les
  // collages visuels (couverture, récap final).
  const pagesByBookAll = new Map<number, number>();
  logs.forEach((l) => pagesByBookAll.set(l.book_id, (pagesByBookAll.get(l.book_id) || 0) + (l.pages_read || 0)));
  booksCompleted.forEach((b) => { if (!pagesByBookAll.has(b.id)) pagesByBookAll.set(b.id, 0); });
  const coverPool = [...pagesByBookAll.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => bookMap.get(id))
    .filter((b): b is Book => !!b)
    .map((b) => ({ id: b.id, title: b.title, cover_url: b.cover_url ?? null }));

  // Classement parmi tous les lecteurs actifs ce mois-ci
  const allLogs = (allLogsData as { user_id: string; pages_read: number }[]) || [];
  const pagesByUser = new Map<string, number>();
  allLogs.forEach((l) => pagesByUser.set(l.user_id, (pagesByUser.get(l.user_id) || 0) + (l.pages_read || 0)));
  const activeReaders = [...pagesByUser.entries()].filter(([, p]) => p > 0);
  let rankPercentile: number | null = null;
  let activeReadersCount: number | null = null;
  if (activeReaders.length > 1) {
    activeReadersCount = activeReaders.length;
    const beaten = activeReaders.filter(([, p]) => p < totalPages).length;
    rankPercentile = Math.round((beaten / (activeReaders.length - 1)) * 100);
  }

  return {
    year,
    month,
    monthLabel: `${MONTHS_FULL[month - 1]} ${year}`,
    totalPages,
    prevMonthPages: prevMonthPages > 0 ? prevMonthPages : null,
    deltaPct,
    sessionsCount,
    daysActive,
    daysInMonth,
    longestStreak,
    booksCompleted,
    topBook,
    topGenre,
    topGenrePages,
    bestDay,
    avgPerActiveDay,
    rankPercentile,
    activeReadersCount,
    topGenres,
    dailyPages,
    coverPool,
  };
}
