"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import type { Book, ReadingLog } from "../../lib/types";
import { pct, isCompleted } from "../../lib/books";
import { Cover, ProgressBar, Button } from "../../components/ui";
import AddBookModal from "../../components/AddBookModal";

const today = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

interface Profile {
  id: string;
  display_name: string;
}

interface ActivityLog extends ReadingLog {
  memberName: string;
  bookTitle: string;
  bookCover: string | null;
  bookAuthor: string;
  bookId: number;
}

interface Champion {
  userId: string;
  name: string;
  pages: number;
}

export default function AccueilPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const displayName =
    user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllReading, setShowAllReading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Club activity
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [todayChampion, setTodayChampion] = useState<Champion | null>(null);

  // Members
  const [members, setMembers] = useState<Profile[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data: booksData } = await supabase
      .from("books")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setBooks((booksData as Book[]) || []);
    setLoading(false);
  }, [userId]);

  const loadClub = useCallback(async () => {
    if (!userId) return;
    setActivityLoading(true);

    const todayStr = new Date().toISOString().split("T")[0];

    const [{ data: logsData }, { data: profilesData }, { data: todayAllLogs }] = await Promise.all([
      supabase
        .from("reading_logs")
        .select("*")
        .neq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.from("user_profiles").select("id, display_name"),
      supabase
        .from("reading_logs")
        .select("user_id, pages_read")
        .eq("date", todayStr),
    ]);

    const logs = (logsData as ReadingLog[]) || [];
    const profiles = (profilesData as Profile[]) || [];

    setMembers(profiles.filter((p) => p.id !== userId));

    // Calcul du champion du jour (toutes sessions confondues)
    const pagesByUser = new Map<string, number>();
    ((todayAllLogs as { user_id: string; pages_read: number }[]) || []).forEach((l) => {
      pagesByUser.set(l.user_id, (pagesByUser.get(l.user_id) || 0) + l.pages_read);
    });
    const sorted = [...pagesByUser.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][1] > 0) {
      const [champId, champPages] = sorted[0];
      const profileMap2 = new Map(profiles.map((p) => [p.id, p.display_name]));
      setTodayChampion({
        userId: champId,
        name: profileMap2.get(champId) ?? "Membre",
        pages: champPages,
      });
    } else {
      setTodayChampion(null);
    }

    if (logs.length === 0) {
      setActivity([]);
      setActivityLoading(false);
      return;
    }

    const bookIds = [...new Set(logs.map((l) => l.book_id))];
    const { data: bookData } = await supabase
      .from("books")
      .select("id, title, cover_url, author")
      .in("id", bookIds);

    const bookMap = new Map(
      ((bookData as Pick<Book, "id" | "title" | "cover_url" | "author">[]) || []).map((b) => [
        b.id,
        b,
      ])
    );
    const profileMap = new Map(profiles.map((p) => [p.id, p.display_name]));

    const enriched: ActivityLog[] = logs
      .map((log) => {
        const bk = bookMap.get(log.book_id);
        if (!bk) return null;
        return {
          ...log,
          memberName: profileMap.get(log.user_id ?? "") ?? "Membre",
          bookTitle: bk.title,
          bookCover: bk.cover_url ?? null,
          bookAuthor: bk.author,
          bookId: bk.id,
        };
      })
      .filter(Boolean) as ActivityLog[];

    setActivity(enriched);
    setActivityLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
    loadClub();
  }, [load, loadClub]);

  // Écoute les mises à jour déclenchées depuis AppShell
  useEffect(() => {
    const onUpdate = () => load();
    window.addEventListener("books-updated", onUpdate);
    return () => window.removeEventListener("books-updated", onUpdate);
  }, [load]);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3500);
  };

  const reading = books.filter((b) => !isCompleted(b));
  const displayedReading = showAllReading ? reading : reading.slice(0, 3);
  const hasMore = reading.length > 3;

  return (
    <div className="animate-fadeIn flex flex-col gap-6 pt-4">
      {/* Header */}
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">{today}</p>
          <h1 className="font-serif text-3xl font-black text-ink">
            {greeting()}{displayName ? `, ${displayName}` : ""}
          </h1>
        </div>
        {/* CTA desktop uniquement (mobile = bouton + dans la nav) */}
        <div className="hidden gap-2 md:flex">
          <Button variant="ghost" onClick={() => setShowAdd(true)} className="text-sm">
            ＋ Livre
          </Button>
        </div>
      </header>

      {toast && (
        <div className="rounded-xl border border-[#cfe0cf] bg-[#eaf1ea] px-4 py-3 text-xs font-semibold text-success">
          {toast}
        </div>
      )}

      {/* En cours */}
      {loading ? (
        <div className="py-20 text-center text-xs font-medium uppercase tracking-wider text-muted">
          Chargement…
        </div>
      ) : reading.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
          <p className="font-serif text-lg text-ink">Aucune lecture en cours</p>
          <p className="mt-1 text-sm text-muted">Ajoute ton premier livre pour démarrer.</p>
          <Button onClick={() => setShowAdd(true)} className="mt-4">
            ＋ Ajouter un livre
          </Button>
        </div>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-medium text-ink">
              En cours
              <span className="ml-2 font-sans text-sm font-normal text-muted">({reading.length})</span>
            </h2>
            <Link href="/compte" className="text-xs font-medium text-violet-deep">
              Bibliothèque →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displayedReading.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
          {hasMore && (
            <button
              onClick={() => setShowAllReading((v) => !v)}
              className="mt-1 text-center text-xs font-medium text-violet-deep"
            >
              {showAllReading
                ? "Voir moins ↑"
                : `Voir ${reading.length - 3} de plus ↓`}
            </button>
          )}
        </section>
      )}

      {/* Activité du club */}
      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-lg font-medium text-ink">Activité du club</h2>

        {/* Champion du jour */}
        {todayChampion && (
          <ChampionBanner champion={todayChampion} isMe={todayChampion.userId === userId} />
        )}

        {activityLoading ? (
          <div className="py-8 text-center text-xs font-medium text-muted">Chargement…</div>
        ) : activity.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-card p-6 text-center">
            <p className="text-sm text-muted">Pas encore d'activité de la part des autres membres.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {activity.map((log) => (
              <ActivityCard
                key={log.id}
                log={log}
                isChampion={todayChampion?.userId === log.user_id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Membres du club */}
      {members.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-medium text-ink">Membres</h2>
            <Link href="/membres" className="text-xs font-medium text-violet-deep">
              Voir tout →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
            {members.map((m, i) => (
              <Link
                key={m.id}
                href={`/membre/${m.id}`}
                className="flex shrink-0 flex-col items-center gap-1.5"
              >
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-full font-serif text-base font-semibold text-cream"
                  style={{ backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length] }}
                >
                  {m.display_name[0]?.toUpperCase()}
                </span>
                <span className="max-w-[56px] truncate text-center text-[10.5px] font-medium text-muted">
                  {m.display_name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <AddBookModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={(m) => { showToast(m); load(); }}
      />
    </div>
  );
}

const MEMBER_COLORS = ["#7c6ba0", "#6e7a5a", "#b07a4b", "#5b8a8b", "#8a5b6e"];

function BookCard({ book }: { book: Book }) {
  const p = pct(book);
  return (
    <Link
      href={`/livre/${book.id}`}
      className="flex items-center gap-3.5 rounded-2xl border border-line bg-card p-3 transition-colors hover:border-violet/50"
    >
      <Cover
        id={book.id}
        title={book.title}
        coverUrl={book.cover_url}
        className="h-[80px] w-[56px] shrink-0"
        rounded="rounded-md"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div>
          <h3 className="truncate font-serif text-[15px] font-medium text-ink">{book.title}</h3>
          <p className="truncate text-[11.5px] text-muted">{book.author}</p>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-ink-2">p. {book.progress} / {book.pages}</span>
          <span className="font-semibold text-violet-deep">{p}%</span>
        </div>
        <ProgressBar value={p / 100} className="h-1.5" />
      </div>
    </Link>
  );
}

function ChampionBanner({ champion, isMe }: { champion: Champion; isMe: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-[#fdf7e9] p-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-xl">
        🏆
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink">
          {isMe ? "Tu es" : <><span className="font-bold">{champion.name}</span> est</>}{" "}
          <span className="text-[#b8890a]">Champion du jour</span>
        </p>
        <p className="text-[11px] text-muted">
          {champion.pages} pages lues aujourd&apos;hui
        </p>
      </div>
      <span className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[10.5px] font-bold text-[#b8890a]">
        +1 🏅
      </span>
    </div>
  );
}

function ActivityCard({ log, isChampion }: { log: ActivityLog; isChampion?: boolean }) {
  const initial = log.memberName[0]?.toUpperCase() ?? "?";
  const todayStr = new Date().toISOString().split("T")[0];
  const isToday = log.date === todayStr;
  const showBadge = isChampion && isToday;

  const dateStr = new Date(log.date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
        showBadge
          ? "border-gold/40 bg-[#fdf7e9]"
          : "border-line bg-card"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-serif text-xs font-semibold text-cream ${
          showBadge ? "bg-gold" : "bg-violet"
        }`}
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ink">
          <span className="font-semibold">{log.memberName}</span>
          {" "}a lu{" "}
          <span className={`font-semibold ${showBadge ? "text-[#b8890a]" : "text-violet-deep"}`}>
            +{log.pages_read} p.
          </span>
        </p>
        <p className="truncate text-[11px] text-muted">{log.bookTitle}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {showBadge && (
          <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[9.5px] font-bold text-[#b8890a]">
            🏆 Champion
          </span>
        )}
        <Cover
          id={log.bookId}
          title={log.bookTitle}
          coverUrl={log.bookCover}
          className="h-10 w-7"
          rounded="rounded"
        />
        <p className="text-[10px] text-muted">{dateStr}</p>
      </div>
    </div>
  );
}
