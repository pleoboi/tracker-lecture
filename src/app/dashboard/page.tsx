"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import type { Book, ReadingLog } from "../../lib/types";
import { loadGoals, updateGoal, DEFAULT_GOALS, type Goals } from "../../lib/settings";
import { GoalIndicator, ObjectiveChart, StatCard, RatingsChart } from "../../components/DashboardWidgets";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const MS_DAY = 86_400_000;
const VIOLET = "var(--color-violet)";
const VIOLET_LT = "#d8cfe6";
const VIOLET_DEEP = "var(--color-violet-deep)";

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

    // Calcul des jours Champion du jour pour l'utilisateur courant
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
    const bookLogs = logs
      .filter((l) => l.book_id === book.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (bookLogs.length) {
      const end = new Date(bookLogs[0].date);
      if (end.getFullYear() === year) booksByMonth[end.getMonth()] += 1;
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

  // Répartition des notes
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
          {/* Objectifs */}
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

          {/* Stats générales */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Pages cette année" value={totalPages.toLocaleString("fr-FR")} accent="#2b2733" />
            <StatCard
              label="Livres terminés"
              value={String(totalBooks)}
              unit={goals.reading_books_year !== null ? `/ ${goals.reading_books_year}` : undefined}
              accent={VIOLET_DEEP}
            />
            <StatCard label="Moyenne / jour" value={String(avgPerDay)} unit="pages" accent="#6e7a5a" />
            <StatCard label="Journée record" value={String(recordDay)} unit="pages" accent="#d7a33f" />
          </div>

          {/* Champion du jour */}
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

          {/* Graphiques */}
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
            />
          </div>

          <RatingsChart counts={ratingCounts} average={ratingAvg} total={ratedCount} />
        </>
      )}
    </div>
  );
}
