"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import type { Book, ReadingLog } from "../../lib/types";
import { loadGoals, updateGoal, DEFAULT_GOALS, type Goals } from "../../lib/settings";
import {
  GoalIndicator,
  ObjectiveChart,
  StatCard,
  RatingsChart,
  type FriendLine,
} from "../../components/DashboardWidgets";
import { DateRangePicker, buildRange, DEFAULT_RANGE, type DateRange } from "../../components/DateRangePicker";
import PodiumModal from "../../components/PodiumModal";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const MS_DAY = 86_400_000;
const VIOLET = "var(--color-violet)";
const VIOLET_LT = "#d8cfe6";
const VIOLET_DEEP = "var(--color-violet-deep)";
const FRIEND_COLOR = "#e07246";
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
          className="rounded-xl bg-violet-soft px-4 py-2 text-xs font-semibold text-violet-deep"
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
          onKeyDown={(e) => { if (e.key === "Enter") { const v = Number(value); if (v > 0) { onSet(v); setEditing(false); } } }}
          placeholder="Ex : 15 000"
          autoFocus
          className="flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-violet"
        />
        <button onClick={() => { const v = Number(value); if (v > 0) { onSet(v); setEditing(false); } }} className="rounded-xl bg-violet px-4 py-2 text-xs font-semibold text-cream">Valider</button>
        <button onClick={() => setEditing(false)} className="rounded-xl border border-line px-3 py-2 text-xs font-medium text-muted">Annuler</button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const now = new Date();

  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_RANGE);
  const dateFrom = dateRange.from;
  const dateTo = dateRange.to;
  const isYTD = dateRange.preset === "ytd";

  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [championDays, setChampionDays] = useState(0);
  const [showAllAuthors, setShowAllAuthors] = useState(false);
  const [showPodium, setShowPodium] = useState(false);

  const [mutualPagesPerMember, setMutualPagesPerMember] = useState<FriendLine[]>([]);
  const [mutualBooksPerMember, setMutualBooksPerMember] = useState<FriendLine[]>([]);
  const [hasMutuals, setHasMutuals] = useState(false);

  const [mutualProfiles, setMutualProfiles] = useState<{ id: string; name: string }[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [friendName, setFriendName] = useState("");
  const [friendLogs, setFriendLogs] = useState<{ date: string; pages_read: number; book_id?: number | null }[]>([]);
  const [friendBooks, setFriendBooks] = useState<{ id: number; date_read: string | null }[]>([]);

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

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const { data: f1 } = await supabase.from("user_follows").select("following_id").eq("follower_id", userId);
      const followingIds = ((f1 || []) as { following_id: string }[]).map((f) => f.following_id);
      if (!followingIds.length) return;
      const { data: f2 } = await supabase.from("user_follows").select("follower_id").eq("following_id", userId).in("follower_id", followingIds);
      const mutualIds = [...new Set(((f2 || []) as { follower_id: string }[]).map((f) => f.follower_id))];
      if (!mutualIds.length) return;
      const { data: p } = await supabase.from("user_profiles").select("id, display_name").in("id", mutualIds);
      setMutualProfiles(((p || []) as { id: string; display_name: string }[]).map((pr) => ({ id: pr.id, name: pr.display_name })));
    };
    load();
  }, [userId]);

  useEffect(() => {
    if (!userId || !isYTD) {
      setMutualPagesPerMember([]); setMutualBooksPerMember([]); setHasMutuals(false);
      return;
    }
    const loadMutuals = async () => {
      const { data: myFollowsData } = await supabase.from("user_follows").select("following_id").eq("follower_id", userId);
      const followingIds = ((myFollowsData || []) as { following_id: string }[]).map((f) => f.following_id);
      if (!followingIds.length) { setHasMutuals(false); return; }
      const { data: mutualCheck } = await supabase.from("user_follows").select("follower_id").eq("following_id", userId).in("follower_id", followingIds);
      const mutualIds = [...new Set(((mutualCheck || []) as { follower_id: string }[]).map((f) => f.follower_id))];
      if (!mutualIds.length) { setHasMutuals(false); return; }
      setHasMutuals(true);

      const currentYear = now.getFullYear();
      const [{ data: mLogs }, { data: mProfs }, { data: mBooks }] = await Promise.all([
        supabase.from("reading_logs").select("user_id, pages_read, date, book_id").in("user_id", mutualIds).gte("date", `${currentYear}-01-01`).lte("date", `${currentYear}-12-31`),
        supabase.from("user_profiles").select("id, display_name").in("id", mutualIds),
        supabase.from("books").select("id, user_id, status, date_read").in("user_id", mutualIds).eq("status", "completed"),
      ]);
      type LR = { user_id: string; pages_read: number; date: string; book_id?: string | null };
      type PR = { id: string; display_name: string };
      type BR = { id: string; user_id: string; status: string; date_read: string | null };

      const allL = (mLogs as LR[]) || [];
      const profMap = new Map(((mProfs as PR[]) || []).map((p) => [p.id, p.display_name]));
      const allB = (mBooks as BR[]) || [];
      const shownIds = mutualIds.slice(0, 4);

      setMutualPagesPerMember(shownIds.map((id, idx) => {
        const mo = Array(12).fill(0);
        allL.filter((l) => l.user_id === id).forEach((l) => { mo[new Date(l.date + "T00:00:00").getMonth()] += l.pages_read || 0; });
        return { name: profMap.get(id) || "Membre", color: MEMBER_COLORS[idx % MEMBER_COLORS.length], data: mo.map((v, i) => ({ name: MONTHS[i], value: v })) };
      }));

      setMutualBooksPerMember(shownIds.map((id, idx) => {
        const mo = Array(12).fill(0);
        allB.filter((b) => b.user_id === id).forEach((book) => {
          let cs: string | null = book.date_read;
          if (!cs) { const last = allL.filter((l) => l.user_id === id && l.book_id === book.id).sort((a, b) => b.date.localeCompare(a.date))[0]; if (last) cs = last.date; }
          if (cs && cs.startsWith(String(currentYear))) mo[new Date(cs + "T00:00:00").getMonth()]++;
        });
        return { name: profMap.get(id) || "Membre", color: MEMBER_COLORS[idx % MEMBER_COLORS.length], data: mo.map((v, i) => ({ name: MONTHS[i], value: v })) };
      }));
    };
    loadMutuals();
  }, [userId, isYTD]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedFriendId) { setFriendLogs([]); setFriendBooks([]); setFriendName(""); return; }
    setFriendName(mutualProfiles.find((p) => p.id === selectedFriendId)?.name || "Ami");
    const load = async () => {
      const [{ data: l }, { data: b }] = await Promise.all([
        supabase.from("reading_logs").select("date, pages_read, book_id").eq("user_id", selectedFriendId),
        supabase.from("books").select("id, date_read").eq("user_id", selectedFriendId).eq("status", "completed"),
      ]);
      setFriendLogs((l as { date: string; pages_read: number; book_id?: number | null }[]) || []);
      setFriendBooks((b as { id: number; date_read: string | null }[]) || []);
    };
    load();
  }, [selectedFriendId, mutualProfiles]); // eslint-disable-line react-hooks/exhaustive-deps

  const setGoal = async (key: keyof Goals, value: number) => {
    if (!userId) return;
    setGoals((prev) => ({ ...prev, [key]: value }));
    await updateGoal(key, value, userId);
  };

  // ── Calculs ──────────────────────────────────────────────────────────────────
  const pagesByMonth = Array(12).fill(0);
  const booksByMonth = Array(12).fill(0);
  const dayPages = new Map<string, number>();

  logs.forEach((log) => {
    if (log.date >= dateFrom && log.date <= dateTo) {
      const m = new Date(log.date + "T00:00:00").getMonth();
      pagesByMonth[m] += log.pages_read || 0;
      dayPages.set(log.date, (dayPages.get(log.date) || 0) + (log.pages_read || 0));
    }
  });

  books.forEach((book) => {
    if (book.status !== "completed") return;
    let cs: string | null = book.date_read ?? null;
    if (!cs) {
      const last = logs.filter((l) => l.book_id === book.id && l.date >= dateFrom && l.date <= dateTo).sort((a, b) => b.date.localeCompare(a.date))[0];
      if (last) cs = last.date;
    }
    if (cs && cs >= dateFrom && cs <= dateTo) booksByMonth[new Date(cs + "T00:00:00").getMonth()]++;
  });

  const totalPages = pagesByMonth.reduce((a, b) => a + b, 0);
  const totalBooks = booksByMonth.reduce((a, b) => a + b, 0);

  const rangeEndDate = new Date(dateTo + "T23:59:59");
  const rangeStartDate = new Date(dateFrom + "T00:00:00");
  const effectiveEnd = now < rangeEndDate ? now : rangeEndDate;
  const rangeElapsedDays = Math.max(1, Math.floor((effectiveEnd.getTime() - rangeStartDate.getTime()) / MS_DAY) + 1);
  const avgPerDay = Math.round(totalPages / rangeElapsedDays);
  const recordDay = Math.max(0, ...Array.from(dayPages.values()));

  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear() + "-01-01T00:00:00").getTime()) / MS_DAY) + 1;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const pagesThisMonth = pagesByMonth[now.getMonth()];
  const booksThisMonth = booksByMonth[now.getMonth()];
  const yearPeriod = (cur: number, goal: number) => ({ cur, goal, expected: goal * (dayOfYear / 365) });
  const monthPeriod = (cur: number, goal: number) => ({ cur, goal, expected: goal * (now.getDate() / daysInMonth) });

  // Mois présents dans la plage → X-axis restreint
  const chartMonths: { name: string; m: number }[] = [];
  {
    const cur = new Date(rangeStartDate.getFullYear(), rangeStartDate.getMonth(), 1);
    while (cur <= rangeEndDate && chartMonths.length < 12) {
      chartMonths.push({ name: MONTHS[cur.getMonth()], m: cur.getMonth() });
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  let chartPagesData: { name: string; value: number }[];
  let chartBooksData: { name: string; value: number }[];

  if (dateRange.preset === "month") {
    const y = now.getFullYear();
    const mo = now.getMonth() + 1;
    const dayBooksMap = new Map<string, number>();
    books.forEach((book) => {
      if (book.status !== "completed") return;
      let cs: string | null = book.date_read ?? null;
      if (!cs) { const last = logs.filter((l) => l.book_id === book.id).sort((a, b) => b.date.localeCompare(a.date))[0]; if (last) cs = last.date; }
      if (cs && cs >= dateFrom && cs <= dateTo) dayBooksMap.set(cs, (dayBooksMap.get(cs) || 0) + 1);
    });
    chartPagesData = Array.from({ length: now.getDate() }, (_, i) => {
      const d = `${y}-${String(mo).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
      return { name: String(i + 1), value: dayPages.get(d) || 0 };
    });
    chartBooksData = Array.from({ length: now.getDate() }, (_, i) => {
      const d = `${y}-${String(mo).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
      return { name: String(i + 1), value: dayBooksMap.get(d) || 0 };
    });
  } else {
    chartPagesData = chartMonths.map(({ name, m }) => ({ name, value: pagesByMonth[m] }));
    chartBooksData = chartMonths.map(({ name, m }) => ({ name, value: booksByMonth[m] }));
  }

  // Friend data
  const friendPagesByMonth = Array(12).fill(0);
  const friendDayPages = new Map<string, number>();
  friendLogs.forEach((log) => {
    if (log.date >= dateFrom && log.date <= dateTo) {
      friendPagesByMonth[new Date(log.date + "T00:00:00").getMonth()] += log.pages_read || 0;
      friendDayPages.set(log.date, (friendDayPages.get(log.date) || 0) + (log.pages_read || 0));
    }
  });

  const friendBooksByMonth = Array(12).fill(0);
  const friendDayBooks = new Map<string, number>();
  friendBooks.forEach((book) => {
    let cs: string | null = book.date_read;
    if (!cs) { const last = friendLogs.filter((l) => l.book_id === book.id).sort((a, b) => b.date.localeCompare(a.date))[0]; if (last) cs = last.date; }
    if (cs && cs >= dateFrom && cs <= dateTo) {
      friendBooksByMonth[new Date(cs + "T00:00:00").getMonth()]++;
      friendDayBooks.set(cs, (friendDayBooks.get(cs) || 0) + 1);
    }
  });

  const friendTotalPages = friendPagesByMonth.reduce((a, b) => a + b, 0);
  const friendTotalBooks = friendBooksByMonth.reduce((a, b) => a + b, 0);
  const friendAvgPerDay = Math.round(friendTotalPages / rangeElapsedDays);

  const mkDailyFriend = (dayMap: Map<string, number>) =>
    Array.from({ length: now.getDate() }, (_, i) => {
      const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
      return { name: String(i + 1), value: dayMap.get(d) || 0 };
    });

  const friendPageLineData = dateRange.preset === "month"
    ? mkDailyFriend(friendDayPages)
    : chartMonths.map(({ name, m }) => ({ name, value: friendPagesByMonth[m] }));

  const friendBooksLineData = dateRange.preset === "month"
    ? mkDailyFriend(friendDayBooks)
    : chartMonths.map(({ name, m }) => ({ name, value: friendBooksByMonth[m] }));

  const mutualPagesSliced = mutualPagesPerMember.map((fl) => ({
    ...fl,
    data: chartMonths.map(({ m }) => fl.data[m] ?? { name: MONTHS[m], value: 0 }),
  }));
  const mutualBooksSliced = mutualBooksPerMember.map((fl) => ({
    ...fl,
    data: chartMonths.map(({ m }) => fl.data[m] ?? { name: MONTHS[m], value: 0 }),
  }));

  const activePagesLines: FriendLine[] | undefined = selectedFriendId
    ? [{ name: friendName || "Ami", color: FRIEND_COLOR, data: friendPageLineData }]
    : isYTD && hasMutuals && mutualPagesSliced.length > 0 ? mutualPagesSliced : undefined;

  const activeBooksLines: FriendLine[] | undefined = selectedFriendId
    ? [{ name: friendName || "Ami", color: FRIEND_COLOR, data: friendBooksLineData }]
    : isYTD && hasMutuals && mutualBooksSliced.length > 0 ? mutualBooksSliced : undefined;

  const currentMonthIdx = isYTD ? chartMonths.findIndex(({ m }) => m === now.getMonth()) : -1;

  // Notes
  const ratingCounts = Array(10).fill(0);
  let ratingSum = 0, ratedCount = 0;
  books.forEach((b) => {
    const r = b.rating || 0;
    if (r > 0) { ratingCounts[Math.min(9, Math.max(0, Math.round(r * 2) - 1))]++; ratingSum += r; ratedCount++; }
  });
  const ratingAvg = ratedCount > 0 ? ratingSum / ratedCount : 0;

  // Auteurs
  const authorMap = new Map<string, number>();
  books.forEach((book) => {
    if (book.status !== "completed") return;
    let cs: string | null = book.date_read ?? null;
    if (!cs) { const last = logs.filter((l) => l.book_id === book.id).sort((a, b) => b.date.localeCompare(a.date))[0]; if (last) cs = last.date; }
    if (!cs || cs < dateFrom || cs > dateTo) return;
    authorMap.set(book.author.trim(), (authorMap.get(book.author.trim()) || 0) + 1);
  });
  const authorRanking = Array.from(authorMap.entries()).sort((a, b) => b[1] - a[1]);
  const top5Authors = authorRanking.slice(0, 5);
  const extraAuthors = authorRanking.slice(5);
  const maxAuthorBooks = top5Authors[0]?.[1] ?? 1;

  const periodLabel = dateRange.preset === "month" ? "ce mois" : dateRange.preset === "3m" ? "ces 3 mois" : "cette année";
  const rangeLabel = isYTD ? `YTD ${now.getFullYear()}` : dateRange.preset === "3m" ? "3 derniers mois" : now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  // Évite l'import inutilisé
  void buildRange;

  return (
    <div className="animate-fadeIn flex flex-col gap-5 pt-4">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-black text-ink">Statistiques</h1>
            <p className="text-xs font-medium text-muted">{rangeLabel}</p>
          </div>
          {mutualProfiles.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-2.5 py-1.5">
              <span className="text-[10px] font-bold text-muted">VS</span>
              <select
                value={selectedFriendId || ""}
                onChange={(e) => setSelectedFriendId(e.target.value || null)}
                className="max-w-[120px] bg-transparent text-[11px] font-medium text-ink outline-none"
              >
                <option value="">Choisir…</option>
                {mutualProfiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {selectedFriendId && <button onClick={() => setSelectedFriendId(null)} className="text-[10px] text-muted hover:text-danger">✕</button>}
            </div>
          )}
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </header>

      {loading ? (
        <div className="py-20 text-center text-xs font-medium uppercase tracking-wider text-muted">Chargement…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label={`Pages ${periodLabel}`} value={totalPages.toLocaleString("fr-FR")} accent="#2b2733"
              vs={selectedFriendId ? { label: friendName, value: friendTotalPages.toLocaleString("fr-FR") } : undefined} />
            <StatCard label={`Livres ${periodLabel}`} value={String(totalBooks)}
              unit={isYTD && goals.reading_books_year !== null ? `/ ${goals.reading_books_year}` : undefined} accent={VIOLET_DEEP}
              vs={selectedFriendId ? { label: friendName, value: String(friendTotalBooks) } : undefined} />
            <StatCard label="Moyenne / jour" value={String(avgPerDay)} unit="pages" accent="#6e7a5a"
              vs={selectedFriendId ? { label: friendName, value: `${friendAvgPerDay} p.` } : undefined} />
            <StatCard label="Journée record" value={String(recordDay)} unit="pages" accent="#d7a33f" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ObjectiveChart title="Pages lues" type="area" data={chartPagesData}
              objective={isYTD && goals.reading_pages_year !== null ? Math.round(goals.reading_pages_year / 12) : null}
              unit="p." color={VIOLET} lightColor={VIOLET_LT} currentMonth={currentMonthIdx}
              onObjectiveChange={isYTD && goals.reading_pages_year !== null ? (v) => setGoal("reading_pages_year", v * 12) : undefined}
              friendLines={activePagesLines} />
            <ObjectiveChart title="Livres lus" type="area" data={chartBooksData}
              objective={isYTD && goals.reading_books_year !== null ? Math.max(1, Math.round(goals.reading_books_year / 12)) : null}
              unit="livres" color={VIOLET_DEEP} lightColor={VIOLET_LT} currentMonth={currentMonthIdx}
              onObjectiveChange={isYTD && goals.reading_books_year !== null ? (v) => setGoal("reading_books_year", v * 12) : undefined}
              friendLines={activeBooksLines} />
          </div>

          <button onClick={() => setShowPodium(true)}
            className="flex w-full items-center gap-4 rounded-2xl border border-gold/40 bg-[#fdf7e9] p-4 text-left transition-colors hover:border-gold/70">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold/15 text-2xl">🏆</span>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-[15px] font-semibold text-ink">Trophées Champion du jour</p>
              <p className="text-xs text-muted">Jours où tu as lu le plus de pages parmi tous les membres</p>
            </div>
            <div className="text-right">
              <p className="font-serif text-3xl font-black text-[#b8890a]">{championDays}</p>
              <p className="text-[11px] font-medium text-muted">{championDays > 1 ? "jours" : "jour"}</p>
              <p className="mt-0.5 text-[9.5px] text-muted/70">Voir le podium →</p>
            </div>
          </button>

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
                        <span className="shrink-0 text-xs font-bold text-violet-deep">{count} livre{count > 1 ? "s" : ""}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-violet-light">
                        <div className="h-full rounded-full bg-violet transition-all duration-500" style={{ width: `${(count / maxAuthorBooks) * 100}%` }} />
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
                          <span className="shrink-0 text-[11px] font-semibold text-muted">{count} livre{count > 1 ? "s" : ""}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setShowAllAuthors((v) => !v)}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-violet-soft px-4 py-2 text-xs font-semibold text-violet-deep">
                    {showAllAuthors ? "Réduire ↑" : `Voir tous les auteurs (${extraAuthors.length} de plus)`}
                  </button>
                </>
              )}
            </div>
          )}

          {isYTD && (
            <div className="grid gap-4 md:grid-cols-2">
              {goals.reading_pages_year !== null
                ? <GoalIndicator title="Objectif pages" accent="#8b79be" unit="p." year={yearPeriod(totalPages, goals.reading_pages_year)} month={monthPeriod(pagesThisMonth, goals.reading_pages_year / 12)} />
                : <GoalSetupCard label="Objectif pages" onSet={(v) => setGoal("reading_pages_year", v)} />}
              {goals.reading_books_year !== null
                ? <GoalIndicator title="Objectif livres" accent="#6f5da6" unit="livres" year={yearPeriod(totalBooks, goals.reading_books_year)} month={monthPeriod(booksThisMonth, goals.reading_books_year / 12)} />
                : <GoalSetupCard label="Objectif livres" onSet={(v) => setGoal("reading_books_year", v)} />}
            </div>
          )}

          <RatingsChart counts={ratingCounts} average={ratingAvg} total={ratedCount} />
        </>
      )}

      {showPodium && <PodiumModal onClose={() => setShowPodium(false)} />}
    </div>
  );
}
