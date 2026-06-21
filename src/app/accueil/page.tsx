"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import type { Book, ReadingLog } from "../../lib/types";
import { pct, isCompleted } from "../../lib/books";
import { Cover, ProgressBar, Button, AvatarImg } from "../../components/ui";
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
  avatar_url?: string | null;
}

interface ActivityLog extends ReadingLog {
  memberName: string;
  memberAvatar?: string | null;
  bookTitle: string;
  bookCover: string | null;
  bookAuthor: string;
  bookId: number;
  isMe?: boolean;
  isCompletion?: boolean;
  bookRating?: number | null;
  bookReview?: string | null;
  eventType?: "start"; // undefined = session normale
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
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: logsData }, { data: profilesData }, { data: todayAllLogs }, { data: recentBooksData }] = await Promise.all([
      // Tous les membres (y compris l'utilisateur courant)
      supabase
        .from("reading_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("user_profiles").select("id, display_name, avatar_url"),
      supabase
        .from("reading_logs")
        .select("user_id, pages_read")
        .eq("date", todayStr),
      // Livres récemment commencés (7 derniers jours, statut "en cours")
      supabase
        .from("books")
        .select("id, title, cover_url, author, user_id, created_at")
        .eq("status", "reading")
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(10),
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
        name: profileMap2.get(champId) ?? (champId === userId ? displayName : "Membre"),
        pages: champPages,
      });
    } else {
      setTodayChampion(null);
    }

    const profileNameMap = new Map(profiles.map((p) => [p.id, p.display_name]));
    const profileAvatarMap = new Map(profiles.map((p) => [p.id, p.avatar_url ?? null]));

    // ── Sessions de lecture ──────────────────────────────────────────────────
    let enriched: ActivityLog[] = [];

    if (logs.length > 0) {
      // ── Agrégation des logs du même jour pour le même livre (même user) ──
      const logGroupMap = new Map<string, ReadingLog[]>();
      logs.forEach((l) => {
        const key = `${l.user_id}_${l.book_id}_${l.date}`;
        if (!logGroupMap.has(key)) logGroupMap.set(key, []);
        logGroupMap.get(key)!.push(l);
      });
      const aggregatedLogs: ReadingLog[] = Array.from(logGroupMap.values()).map((group) => {
        if (group.length === 1) return group[0];
        return {
          ...group[0],
          id: group[group.length - 1].id,
          pages_read: group.reduce((s, l) => s + l.pages_read, 0),
          end_page: Math.max(...group.map((l) => l.end_page)),
          created_at: group.reduce(
            (max, l) => ((l.created_at ?? "") > (max ?? "") ? l.created_at : max),
            group[0].created_at
          ),
        };
      });
      aggregatedLogs.sort((a, b) =>
        (b.created_at ?? b.date).localeCompare(a.created_at ?? a.date)
      );

      const bookIds = [...new Set(aggregatedLogs.map((l) => l.book_id))];
      const { data: bookData } = await supabase
        .from("books")
        .select("id, title, cover_url, author, status, rating, notes")
        .in("id", bookIds);

      type BookPreview = Pick<Book, "id" | "title" | "cover_url" | "author"> & {
        status: string;
        rating: number | null;
        notes: string | null;
      };

      const bookMap = new Map(
        ((bookData as BookPreview[]) || []).map((b) => [b.id, b])
      );

      const latestLogKey = new Map<string, string>();
      aggregatedLogs.forEach((l) => {
        const key = `${l.user_id}_${l.book_id}`;
        const ts = l.created_at ?? l.date;
        if (!latestLogKey.has(key) || ts > latestLogKey.get(key)!) {
          latestLogKey.set(key, ts);
        }
      });

      enriched = aggregatedLogs
        .map((log) => {
          const bk = bookMap.get(log.book_id);
          if (!bk) return null;
          const key = `${log.user_id}_${log.book_id}`;
          const isLatest = (log.created_at ?? log.date) === latestLogKey.get(key);
          const isCompletion = bk.status === "completed" && isLatest;
          const isMe = log.user_id === userId;
          return {
            ...log,
            memberName: isMe
              ? displayName || profileNameMap.get(log.user_id ?? "") || "Moi"
              : (profileNameMap.get(log.user_id ?? "") ?? "Membre"),
            memberAvatar: profileAvatarMap.get(log.user_id ?? "") ?? null,
            bookTitle: bk.title,
            bookCover: bk.cover_url ?? null,
            bookAuthor: bk.author,
            bookId: bk.id,
            isMe,
            isCompletion,
            bookRating: isCompletion ? (bk.rating ?? null) : null,
            bookReview: isCompletion ? (bk.notes ?? null) : null,
          };
        })
        .filter(Boolean) as ActivityLog[];
    }

    // ── Débuts de lecture (livres commencés sans log encore) ────────────────
    type RecentBook = { id: number; title: string; cover_url: string | null; author: string; user_id: string; created_at: string };
    const loggedPairs = new Set(logs.map((l) => `${l.user_id}_${l.book_id}`));

    const startEvents: ActivityLog[] = ((recentBooksData as RecentBook[]) || [])
      .filter((b) => !loggedPairs.has(`${b.user_id}_${b.id}`))
      .map((b) => {
        const isMe = b.user_id === userId;
        return {
          id: -(b.id * 100 + 1),
          user_id: b.user_id,
          book_id: b.id,
          pages_read: 0,
          end_page: 0,
          date: b.created_at.split("T")[0],
          created_at: b.created_at,
          memberName: isMe
            ? displayName || profileNameMap.get(b.user_id) || "Moi"
            : (profileNameMap.get(b.user_id) ?? "Membre"),
          memberAvatar: profileAvatarMap.get(b.user_id) ?? null,
          bookTitle: b.title,
          bookCover: b.cover_url ?? null,
          bookAuthor: b.author,
          bookId: b.id,
          isMe,
          eventType: "start" as const,
        };
      });

    // Fusion triée par date décroissante, max 20 événements
    const allEvents = [...enriched, ...startEvents]
      .sort((a, b) => (b.created_at ?? b.date ?? "").localeCompare(a.created_at ?? a.date ?? ""))
      .slice(0, 20);

    setActivity(allEvents);
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

  const reading = books.filter((b) => b.status === "reading");
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
            <p className="text-sm text-muted">Pas encore d&apos;activité dans le club.</p>
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
            {members.map((m) => (
              <Link
                key={m.id}
                href={`/membre/${m.id}`}
                className="flex shrink-0 flex-col items-center gap-1.5"
              >
                <AvatarImg url={m.avatar_url} name={m.display_name} className="h-12 w-12 text-base" />
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
  const [reviewExpanded, setReviewExpanded] = useState(false);
  const TRUNCATE_AT = 150;
  const todayStr = new Date().toISOString().split("T")[0];
  const isToday = log.date === todayStr;
  const showBadge = isChampion && isToday;

  const dateStr = new Date(log.date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });

  const subject = log.isMe ? "Tu" : <span className="font-semibold">{log.memberName}</span>;
  const verb = log.isMe ? "as" : "a";

  const hasLongReview = (log.bookReview?.length ?? 0) > TRUNCATE_AT;
  const reviewText = log.bookReview
    ? !reviewExpanded && hasLongReview
      ? log.bookReview.slice(0, TRUNCATE_AT) + "…"
      : log.bookReview
    : null;

  const cardClass = showBadge
    ? "border-gold/40 bg-[#fdf7e9]"
    : log.isCompletion
    ? "border-[#cfe0cf] bg-[#eaf1ea]"
    : log.eventType === "start"
    ? "border-violet/20 bg-violet-soft"
    : "border-line bg-card";

  const accentClass = showBadge
    ? "text-[#b8890a]"
    : log.isCompletion
    ? "text-success"
    : "text-violet-deep";

  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-3 transition-colors ${cardClass}`}>
      {log.user_id ? (
        <Link href={`/membre/${log.user_id}`} className="shrink-0">
          <AvatarImg
            url={log.memberAvatar}
            name={log.memberName}
            className={`h-8 w-8 text-xs font-semibold ${showBadge ? "ring-2 ring-gold ring-offset-1" : ""}`}
          />
        </Link>
      ) : (
        <AvatarImg
          url={log.memberAvatar}
          name={log.memberName}
          className={`h-8 w-8 shrink-0 text-xs font-semibold ${showBadge ? "ring-2 ring-gold ring-offset-1" : ""}`}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink">
          {subject}{" "}
          {log.eventType === "start" ? (
            <><span className={`font-semibold ${accentClass}`}>{verb} commencé</span></>
          ) : log.isCompletion ? (
            <><span className={`font-semibold ${accentClass}`}>{verb} terminé</span></>
          ) : (
            <>{verb} lu{" "}<span className={`font-semibold ${accentClass}`}>+{log.pages_read} p.</span></>
          )}
        </p>
        <Link
          href={`/livre/${log.book_id}`}
          className="block truncate text-[11px] font-medium text-muted hover:text-violet-deep hover:underline"
        >
          {log.bookTitle}
        </Link>
        {log.isCompletion && (log.bookRating ?? 0) > 0 && (
          <p className="mt-1 text-xs text-[#c9a227]">
            {"★".repeat(Math.round(log.bookRating!))}
            {"☆".repeat(5 - Math.round(log.bookRating!))}
            {" "}{log.bookRating!.toFixed(1).replace(".", ",")}
          </p>
        )}
        {log.isCompletion && reviewText && (
          <div className="mt-1.5">
            <p className="text-[11.5px] italic text-muted">&ldquo;{reviewText}&rdquo;</p>
            {hasLongReview && (
              <button
                onClick={(e) => { e.stopPropagation(); setReviewExpanded((v) => !v); }}
                className="mt-0.5 text-[11px] font-semibold text-violet-deep"
              >
                {reviewExpanded ? "Voir moins ↑" : "Voir plus ↓"}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {showBadge && (
          <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[9.5px] font-bold text-[#b8890a]">
            🏆 Champion
          </span>
        )}
        {log.isCompletion && !showBadge && (
          <span className="rounded-full bg-[#d4edda] px-2 py-0.5 text-[9.5px] font-bold text-success">
            ✓ Terminé
          </span>
        )}
        {log.eventType === "start" && (
          <span className="rounded-full bg-violet/10 px-2 py-0.5 text-[9.5px] font-bold text-violet-deep">
            ▶ Début
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
