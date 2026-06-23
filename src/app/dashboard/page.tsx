"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import type { Book, ReadingLog } from "../../lib/types";
import { loadGoals, updateGoal, DEFAULT_GOALS, type Goals } from "../../lib/settings";
import { GoalIndicator, ObjectiveChart, StatCard, RatingsChart, DailyComparisonChart, type FriendLine } from "../../components/DashboardWidgets";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const MS_DAY = 86_400_000;
const VIOLET = "var(--color-violet)";
const VIOLET_LT = "#d8cfe6";
const VIOLET_DEEP = "var(--color-violet-deep)";

// Palette bien contrastée pour les membres mutuels
const MEMBER_COLORS = ["#e07246", "#2e9e6e", "#3a7dc9", "#d4902a", "#a8558a"];

function GoalSetupCard({ label, onSet }: { label: string; onSet: (v: number) => void }) {
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-card p-5 text-center">
        <p className="font-serif text-[15px] font-medium text-ink">{label}</p>
        <p className="text-xs text-muted">Pas d&apos;objectif défini pour cette année.</p>
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 rounded-xl bg-violet-soft px-4 py-2 text-xs font-semibold text-violet-deep"
        >
          Définir un objectif
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5">
      <p className="font-serif text-[15px] font-medium text-ink">{label}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = Number(value);
              if (v > 0) { onSet(v); setEditing(false); }
            }
          }}
          placeholder="Ex : 15 000"
          autoFocus
          className="flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-violet"
        />
        <button
          onClick={() => { const v = Number(value); if (v > 0) { onSet(v); setEditing(false); } }}
          className="rounded-xl bg-violet px-4 py-2 text-xs font-semibold text-cream"
        >
          Valider
        </button>
        <button
          onClick={() => setEditing(false)}
          className="rounded-xl border border-line px-3 py-2 text-xs font-medium text-muted"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [championDays, setChampionDays] = useState(0);
  const [showAllAuthors, setShowAllAuthors] = useState(false);

  // Données mutuelles — par membre individuel
  const [mutualPagesPerMember, setMutualPagesPerMember] = useState<FriendLine[]>([]);
  const [mutualBooksPerMember, setMutualBooksPerMember] = useState<FriendLine[]>([]);
  const [mutualDailyData, setMutualDailyData] = useState<{ name: string; color: string; data: { day: number; pages: number }[] }[]>([]);
  const [hasMutuals, setHasMutuals] = useState(false);

  const loadAll = useCallback(async () => {
    if (!userId) return;
    const [g, { data: l }, { data: b }, { data: allLogs }] = await Promise.all([
      loadGoals(userId),
      supabase.from("reading_logs").select("*").eq("user_id", userId),
      supabase.from("books").select("*").eq("user_id", userId),
      supabase.from("reading_logs").select("user_id, pages_read, date"),
    ]);
    setGoals(g);
    setLogs((l as ReadingLog[]) || []);
    setBooks((b as Book[]) || []);

    // Calcul Champion du jour
    type LogRow = { user_id: string; pages_read: number; date: string };
    const rows = (allLogs as LogRow[]) || [];
    const dateMap = new Map<string, Map<string, number>>();
    rows.forEach(({ date, user_id, pages_read }) => {
      if (!dateMap.has(date)) dateMap.set(date, new Map());
      const m = dateMap.get(date)!;
      m.set(user_id, (m.get(user_id) || 0) + pages_read);
    });
    let count = 0;
    for (const userMap of dateMap.values()) {
      const maxPages = Math.max(...userMap.values());
      if (maxPages > 0 && (userMap.get(userId) || 0) >= maxPages) count++;
    }
    setChampionDays(count);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Chargement des données mutuelles (uniquement pour l'année en cours)
  useEffect(() => {
    if (!userId || year !== now.getFullYear()) {
      setMutualPagesPerMember([]);
      setMutualBooksPerMember([]);
      setMutualDailyData([]);
      setHasMutuals(false);
      return;
    }
    const loadMutuals = async () => {
      const { data: myFollowsData } = await supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", userId);

      const followingIds = ((myFollowsData || []) as { following_id: string }[]).map((f) => f.following_id);
      if (followingIds.length === 0) { setHasMutuals(false); return; }

      const { data: mutualCheck } = await supabase
        .from("user_follows")
        .select("follower_id")
        .eq("following_id", userId)
        .in("follower_id", followingIds);

      const mutualIds = [...new Set(((mutualCheck || []) as { follower_id: string }[]).map((f) => f.follower_id))];
      if (mutualIds.length === 0) { setHasMutuals(false); return; }
      setHasMutuals(true);

      const currentYear = now.getFullYear();
      const [{ data: mutualLogsData }, { data: mutualProfilesData }, { data: mutualBooksData }] = await Promise.all([
        supabase
          .from("reading_logs")
          .select("user_id, pages_read, date, book_id")
          .in("user_id", mutualIds)
          .gte("date", `${currentYear}-01-01`)
          .lte("date", `${currentYear}-12-31`),
        supabase.from("user_profiles").select("id, display_name").in("id", mutualIds),
        supabase
          .from("books")
          .select("id, user_id, status, date_read")
          .in("user_id", mutualIds)
          .eq("status", "completed"),
      ]);

      type LogRow = { user_id: string; pages_read: number; date: string; book_id?: string | null };
      type ProfRow = { id: string; display_name: string };
      type BookRow = { id: string; user_id: string; status: string; date_read: string | null };

      const allLogs = (mutualLogsData as LogRow[]) || [];
      const profiles = (mutualProfilesData as ProfRow[]) || [];
      const allBooks = (mutualBooksData as BookRow[]) || [];

      const profileMap = new Map(profiles.map((p) => [p.id, p.display_name]));
      const shownIds = mutualIds.slice(0, 4);

      // Pages par mois par membre
      const pagesPerMember: FriendLine[] = shownIds.map((id, idx) => {
        const monthly = Array(12).fill(0);
        allLogs
          .filter((l) => l.user_id === id)
          .forEach((l) => {
            monthly[new Date(l.date).getMonth()] += l.pages_read || 0;
          });
        return {
          name: profileMap.get(id) || "Membre",
          color: MEMBER_COLORS[idx % MEMBER_COLORS.length],
          data: monthly.map((v, i) => ({ name: MONTHS[i], value: v })),
        };
      });
      setMutualPagesPerMember(pagesPerMember);

      // Livres terminés par mois par membre
      const booksPerMember: FriendLine[] = shownIds.map((id, idx) => {
        const monthly = Array(12).fill(0);
        allBooks
          .filter((b) => b.user_id === id)
          .forEach((book) => {
            let completionDate: Date | null = null;
            if (book.date_read) {
              completionDate = new Date(book.date_read);
            } else {
              const lastLog = allLogs
                .filter((l) => l.user_id === id && l.book_id === book.id)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
              if (lastLog) completionDate = new Date(lastLog.date);
            }
            if (completionDate && completionDate.getFullYear() === currentYear) {
              monthly[completionDate.getMonth()]++;
            }
          });
        return {
          name: profileMap.get(id) || "Membre",
          color: MEMBER_COLORS[idx % MEMBER_COLORS.length],
          data: monthly.map((v, i) => ({ name: MONTHS[i], value: v })),
        };
      });
      setMutualBooksPerMember(booksPerMember);

      // Pages par jour (mois en cours) par membre
      const currentMonth = now.getMonth();
      const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
      const dailyResult = shownIds.map((id, idx) => {
        const dayMap = new Map<number, number>();
        allLogs
          .filter((l) => l.user_id === id && l.date.startsWith(monthStr))
          .forEach((l) => {
            const day = new Date(l.date).getDate();
            dayMap.set(day, (dayMap.get(day) || 0) + (l.pages_read || 0));
          });
        return {
          name: profileMap.get(id) || "Membre",
          color: MEMBER_COLORS[idx % MEMBER_COLORS.length],
          data: Array.from({ length: now.getDate() }, (_, i) => ({
            day: i + 1,
            pages: dayMap.get(i + 1) || 0,
          })),
        };
      });
      setMutualDailyData(dailyResult);
    };
    loadMutuals();
  }, [userId, year]); // eslint-disable-line react-hooks/exhaustive-deps

  const setGoal = async (key: keyof Goals, value: number) => {
    if (!userId) return;
    setGoals((prev) => ({ ...prev, [key]: value }));
    await updateGoal(key, value, userId);
  };

  // ----- Calculs lecture -----
  const isCurrentYear = year === now.getFullYear();
  const pagesByMonth = Array(12).fill(0);
  const booksByMonth = Array(12).fill(0);
  const dayPages = new Map<string, number>();

  logs.forEach((log) => {
    const d = new Date(log.date);
    if (d.getFullYear() === year) {
      const key = d.toISOString().split("T")[0];
      pagesByMonth[d.getMonth()] += log.pages_read || 0;
      dayPages.set(key, (dayPages.get(key) || 0) + (log.pages_read || 0));
    }
  });

  books.forEach((book) => {
    if (book.status !== "completed") return;
    let completionDate: Date | null = null;
    if (book.date_read) {
      completionDate = new Date(book.date_read);
    } else {
      const bookLogs = logs
        .filter((l) => l.book_id === book.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (bookLogs.length) completionDate = new Date(bookLogs[0].date);
    }
    if (completionDate && completionDate.getFullYear() === year) {
      booksByMonth[completionDate.getMonth()] += 1;
    }
  });

  const totalPages = pagesByMonth.reduce((a, b) => a + b, 0);
  const totalBooks = booksByMonth.reduce((a, b) => a + b, 0);
  const pagesThisMonth = isCurrentYear ? pagesByMonth[now.getMonth()] : 0;
  const booksThisMonth = isCurrentYear ? booksByMonth[now.getMonth()] : 0;

  const dayOfYear = isCurrentYear
    ? Math.floor((now.getTime() - new Date(year, 0, 1).getTime()) / MS_DAY) + 1
    : 365;
  const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();
  const dayOfMonth = isCurrentYear ? now.getDate() : daysInMonth;

  const avgPerDay = dayOfYear > 0 ? Math.round(totalPages / dayOfYear) : 0;
  const recordDay = Math.max(0, ...Array.from(dayPages.values()));
  const currentMonthIdx = isCurrentYear ? now.getMonth() : -1;

  const yearPeriod = (cur: number, goal: number) => ({
    cur,
    goal,
    expected: goal * (dayOfYear / 365),
  });

  const monthPeriod = (cur: number, goal: number) => ({
    cur,
    goal,
    expected: goal * (dayOfMonth / daysInMonth),
  });

  const monthChart = (arr: number[]) => arr.map((v, i) => ({ name: MONTHS[i], value: v }));

  const myDailyData = isCurrentYear
    ? Array.from({ length: now.getDate() }, (_, i) => {
        const day = i + 1;
        const dateStr = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        return { day, pages: dayPages.get(dateStr) || 0 };
      })
    : [];

  const ratingCounts = Array(10).fill(0);
  let ratingSum = 0;
  let ratedCount = 0;
  books.forEach((b) => {
    const r = b.rating || 0;
    if (r > 0) {
      const bucket = Math.min(9, Math.max(0, Math.round(r * 2) - 1));
      ratingCounts[bucket] += 1;
      ratingSum += r;
      ratedCount += 1;
    }
  });
  const ratingAvg = ratedCount > 0 ? ratingSum / ratedCount : 0;

  const authorMap = new Map<string, number>();
  books.forEach((book) => {
    if (book.status !== "completed") return;
    let completionDate: Date | null = null;
    if (book.date_read) {
      completionDate = new Date(book.date_read);
    } else {
      const bookLogs = logs
        .filter((l) => l.book_id === book.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (bookLogs.length) completionDate = new Date(bookLogs[0].date);
    }
    if (!completionDate || completionDate.getFullYear() !== year) return;
    const author = book.author.trim();
    authorMap.set(author, (authorMap.get(author) || 0) + 1);
  });
  const authorRanking = Array.from(authorMap.entries()).sort((a, b) => b[1] - a[1]);
  const top5Authors = authorRanking.slice(0, 5);
  const extraAuthors = authorRanking.slice(5);
  const maxAuthorBooks = top5Authors[0]?.[1] ?? 1;

  return (
    <div className="animate-fadeIn flex flex-col gap-5 pt-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-black text-ink">Statistiques</h1>
          <p className="text-xs font-medium text-muted">Lecture {year}</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-card px-2 py-1.5">
          <button onClick={() => setYear((y) => y - 1)} className="px-1.5 text-sm font-bold text-muted">
            ‹
          </button>
          <span className="w-12 text-center text-sm font-semibold text-ink">{year}</span>
          <button
            onClick={() => setYear((y) => Math.min(y + 1, now.getFullYear()))}
            disabled={year >= now.getFullYear()}
            className="px-1.5 text-sm font-bold text-muted disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </header>

      {loading ? (
        <div className="py-20 text-center text-xs font-medium uppercase tracking-wider text-muted">
          Chargement…
        </div>
      ) : (
        <>
          {/* 1. Indicateurs clés */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Pages cette année" value={totalPages.toLocaleString("fr-FR")} accent="#2b2733" />
            <StatCard
              label={`Livres terminés ${year}`}
              value={String(totalBooks)}
              unit={goals.reading_books_year !== null ? `/ ${goals.reading_books_year}` : undefined}
              accent={VIOLET_DEEP}
            />
            <StatCard label="Moyenne / jour" value={String(avgPerDay)} unit="pages" accent="#6e7a5a" />
            <StatCard label="Journée record" value={String(recordDay)} unit="pages" accent="#d7a33f" />
          </div>

          {/* 2. Graphiques mensuels */}
          <div className="grid gap-4 md:grid-cols-2">
            <ObjectiveChart
              title="Pages lues / mois"
              type="area"
              data={monthChart(pagesByMonth)}
              objective={goals.reading_pages_year !== null ? Math.round(goals.reading_pages_year / 12) : null}
              unit="p."
              color={VIOLET}
              lightColor={VIOLET_LT}
              currentMonth={currentMonthIdx}
              onObjectiveChange={
                goals.reading_pages_year !== null
                  ? (v) => setGoal("reading_pages_year", v * 12)
                  : undefined
              }
              friendLines={hasMutuals && isCurrentYear && mutualPagesPerMember.length > 0 ? mutualPagesPerMember : undefined}
            />
            <ObjectiveChart
              title="Livres lus / mois"
              type="area"
              data={monthChart(booksByMonth)}
              objective={
                goals.reading_books_year !== null
                  ? Math.max(1, Math.round(goals.reading_books_year / 12))
                  : null
              }
              unit="livres"
              color={VIOLET_DEEP}
              lightColor={VIOLET_LT}
              currentMonth={currentMonthIdx}
              onObjectiveChange={
                goals.reading_books_year !== null
                  ? (v) => setGoal("reading_books_year", v * 12)
                  : undefined
              }
              friendLines={hasMutuals && isCurrentYear && mutualBooksPerMember.length > 0 ? mutualBooksPerMember : undefined}
            />
          </div>

          {/* 2b. Comparatif jour par jour (mois en cours) */}
          {isCurrentYear && hasMutuals && mutualDailyData.length > 0 && (
            <DailyComparisonChart
              myData={myDailyData}
              mutuals={mutualDailyData}
              month={now.getMonth()}
              year={year}
              myColor={VIOLET}
            />
          )}

          {/* 3. Champion du jour */}
          <div className="flex items-center gap-4 rounded-2xl border border-gold/40 bg-[#fdf7e9] p-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold/15 text-2xl">
              🏆
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-[15px] font-semibold text-ink">Trophées Champion du jour</p>
              <p className="text-xs text-muted">
                Jours où tu as lu le plus de pages parmi tous les membres
              </p>
            </div>
            <div className="text-right">
              <p className="font-serif text-3xl font-black text-[#b8890a]">{championDays}</p>
              <p className="text-[11px] font-medium text-muted">
                {championDays > 1 ? "jours" : "jour"}
              </p>
            </div>
          </div>

          {/* 4. Classement par auteur */}
          {top5Authors.length > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
              <h2 className="font-serif text-[15px] font-medium text-ink">Classement par auteur</h2>
              <div className="flex flex-col gap-3">
                {top5Authors.map(([author, count], i) => (
                  <div key={author} className="flex items-center gap-3">
                    <span className="w-5 shrink-0 text-center text-xs font-bold text-muted">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-ink">{author}</span>
                        <span className="shrink-0 text-xs font-bold text-violet-deep">
                          {count} livre{count > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-violet-light">
                        <div
                          className="h-full rounded-full bg-violet transition-all duration-500"
                          style={{ width: `${(count / maxAuthorBooks) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {extraAuthors.length > 0 && (
                <>
                  {showAllAuthors && (
                    <div className="flex flex-col gap-2 border-t border-line pt-3">
                      {extraAuthors.map(([author, count]) => (
                        <div key={author} className="flex items-center justify-between gap-2">
                          <span className="truncate text-[12.5px] text-ink-2">{author}</span>
                          <span className="shrink-0 text-[11px] font-semibold text-muted">
                            {count} livre{count > 1 ? "s" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setShowAllAuthors((v) => !v)}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-violet-soft px-4 py-2 text-xs font-semibold text-violet-deep"
                  >
                    {showAllAuthors
                      ? "Réduire ↑"
                      : `Voir tous les auteurs (${extraAuthors.length} de plus)`}
                  </button>
                </>
              )}
            </div>
          )}

          {/* 5. Objectifs */}
          <div className="grid gap-4 md:grid-cols-2">
            {goals.reading_pages_year !== null ? (
              <GoalIndicator
                title="Objectif pages"
                accent="#8b79be"
                unit="p."
                year={yearPeriod(totalPages, goals.reading_pages_year)}
                month={monthPeriod(pagesThisMonth, goals.reading_pages_year / 12)}
              />
            ) : (
              <GoalSetupCard
                label="Objectif pages"
                onSet={(v) => setGoal("reading_pages_year", v)}
              />
            )}
            {goals.reading_books_year !== null ? (
              <GoalIndicator
                title="Objectif livres"
                accent="#6f5da6"
                unit="livres"
                year={yearPeriod(totalBooks, goals.reading_books_year)}
                month={monthPeriod(booksThisMonth, goals.reading_books_year / 12)}
              />
            ) : (
              <GoalSetupCard
                label="Objectif livres"
                onSet={(v) => setGoal("reading_books_year", v)}
              />
            )}
          </div>

          {/* 6. Histogramme des notes */}
          <RatingsChart counts={ratingCounts} average={ratingAvg} total={ratedCount} />
        </>
      )}
    </div>
  );
}
