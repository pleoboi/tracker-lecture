"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import type { Book, ReadingLog } from "../../lib/types";
import { pct } from "../../lib/books";
import { Cover, ProgressBar, Button, AvatarImg } from "../../components/ui";
import AddBookModal from "../../components/AddBookModal";
import LogReadingModal from "../../components/LogReadingModal";
import PodiumModal from "../../components/PodiumModal";

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
  allNotes?: string[];  // toutes les notes de session du jour pour ce livre
  allPhotos?: string[]; // toutes les photos du jour pour ce livre
  bookPages?: number;
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
  const [showLog, setShowLog] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Club activity
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [todayChampion, setTodayChampion] = useState<Champion | null>(null);
  const [yesterdayChampion, setYesterdayChampion] = useState<Champion | null>(null);
  const [showPodium, setShowPodium] = useState(false);
  const [likeMap, setLikeMap] = useState<Map<string, { count: number; liked: boolean }>>(new Map());

  // Members
  const [members, setMembers] = useState<Profile[]>([]);
  const [hasFollows, setHasFollows] = useState(false);

  // Challenges actifs
  const [activeChallenges, setActiveChallenges] = useState<
    { id: string; title: string; metric: string; target_value: number | null; start_date: string; end_date: string; myScore: number }[]
  >([]);

  // Mini-modal note / review
  const [noteModal, setNoteModal] = useState<{
    type: "review" | "session";
    text: string;
    member: string;
    date?: string;
    photoUrl?: string | null;
    bookId: number;
    reviewerUserId: string;
    bookTitle: string;
  } | null>(null);
  const [noteLiked, setNoteLiked] = useState(false);
  const [noteLikeCount, setNoteLikeCount] = useState(0);
  const [noteLikeLoading, setNoteLikeLoading] = useState(false);

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
    const yesterdayStr = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
    const threeDaysAgoDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0]; // YYYY-MM-DD — date effective de lecture

    // Étape 1 : profils, champion du jour (non filtré), champion d'hier, et liste des suivis
    const [{ data: profilesData }, { data: todayAllLogs }, { data: followData }, { data: yesterdayAllLogs }] = await Promise.all([
      supabase.from("user_profiles").select("id, display_name, avatar_url"),
      supabase.from("reading_logs").select("user_id, pages_read").eq("date", todayStr),
      supabase.from("user_follows").select("following_id").eq("follower_id", userId),
      supabase.from("reading_logs").select("user_id, pages_read").eq("date", yesterdayStr),
    ]);

    const followingIds = ((followData || []) as { following_id: string }[]).map((f) => f.following_id);
    setHasFollows(followingIds.length > 0);
    const allowedIds = [userId, ...followingIds];

    // Étape 2 : logs et livres filtrés par les utilisateurs suivis (+ soi-même)
    const [{ data: logsData }, { data: recentBooksData }] = await Promise.all([
      supabase
        .from("reading_logs")
        .select("*")
        .in("user_id", allowedIds)
        .gte("date", threeDaysAgoDate)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("books")
        .select("id, title, cover_url, author, user_id, created_at")
        .in("user_id", allowedIds)
        .eq("status", "reading")
        .gte("created_at", threeDaysAgoDate)
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
    const profileMap2 = new Map(profiles.map((p) => [p.id, p.display_name]));
    if (sorted.length > 0 && sorted[0][1] > 0) {
      const [champId, champPages] = sorted[0];
      setTodayChampion({
        userId: champId,
        name: profileMap2.get(champId) ?? (champId === userId ? displayName : "Membre"),
        pages: champPages,
      });
    } else {
      setTodayChampion(null);
    }

    // Champion d'hier
    const pagesByUserYesterday = new Map<string, number>();
    ((yesterdayAllLogs as { user_id: string; pages_read: number }[]) || []).forEach((l) => {
      pagesByUserYesterday.set(l.user_id, (pagesByUserYesterday.get(l.user_id) || 0) + l.pages_read);
    });
    const sortedYesterday = [...pagesByUserYesterday.entries()].sort((a, b) => b[1] - a[1]);
    if (sortedYesterday.length > 0 && sortedYesterday[0][1] > 0) {
      const [yId, yPages] = sortedYesterday[0];
      setYesterdayChampion({
        userId: yId,
        name: profileMap2.get(yId) ?? (yId === userId ? displayName : "Membre"),
        pages: yPages,
      });
    } else {
      setYesterdayChampion(null);
    }

    const profileNameMap = new Map(profiles.map((p) => [p.id, p.display_name]));
    const profileAvatarMap = new Map(profiles.map((p) => [p.id, p.avatar_url ?? null]));

    // ── Sessions de lecture ──────────────────────────────────────────────────
    let enriched: ActivityLog[] = [];

    if (logs.length > 0) {
      // ── Groupement par user+livre+jour : cumul pages, toutes notes/photos réunies ──
      const logGroupMap = new Map<string, ReadingLog & { allNotes: string[]; allPhotos: string[] }>();
      [...logs]
        .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "")) // chrono asc pour collecter dans l'ordre
        .forEach((l) => {
          const key = `${l.user_id}_${l.book_id}_${l.date}`;
          if (!logGroupMap.has(key)) {
            logGroupMap.set(key, {
              ...l,
              allNotes: l.session_notes ? [l.session_notes] : [],
              allPhotos: l.session_photo_url ? [l.session_photo_url] : [],
            });
          } else {
            const e = logGroupMap.get(key)!;
            e.pages_read += l.pages_read || 0;
            e.end_page = Math.max(e.end_page, l.end_page);
            e.created_at = l.created_at; // garde le plus récent
            if (l.session_notes) e.allNotes.push(l.session_notes);
            if (l.session_photo_url) e.allPhotos.push(l.session_photo_url);
          }
        });
      const aggregatedLogs = Array.from(logGroupMap.values()).sort((a, b) => {
        const d = (b.date ?? "").localeCompare(a.date ?? "");
        if (d !== 0) return d;
        return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      });

      const bookIds = [...new Set(aggregatedLogs.map((l) => l.book_id))];
      const { data: bookData } = await supabase
        .from("books")
        .select("id, title, cover_url, author, status, rating, notes, pages")
        .in("id", bookIds);

      type BookPreview = Pick<Book, "id" | "title" | "cover_url" | "author"> & {
        status: string;
        rating: number | null;
        notes: string | null;
        pages: number | null;
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
            allNotes: (log as any).allNotes ?? [],
            allPhotos: (log as any).allPhotos ?? [],
            bookPages: bk.pages ?? 0,
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

    // Fusion : date effective DESC, puis created_at DESC pour égalités
    const allEvents = [...enriched, ...startEvents]
      .sort((a, b) => {
        const d = (b.date ?? "").localeCompare(a.date ?? "");
        if (d !== 0) return d;
        return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      })
      .slice(0, 20);

    setActivity(allEvents);
    setActivityLoading(false);

    // Fetch likes for real logs (start events have negative ids)
    const realLogIds = allEvents
      .filter((e) => typeof e.id === "number" ? e.id > 0 : true)
      .map((e) => String(e.id));
    if (realLogIds.length > 0) {
      const { data: likesData } = await supabase
        .from("session_likes")
        .select("log_id, liker_id")
        .in("log_id", realLogIds);
      const map = new Map<string, { count: number; liked: boolean }>();
      for (const row of (likesData ?? []) as { log_id: string; liker_id: string }[]) {
        const cur = map.get(row.log_id) ?? { count: 0, liked: false };
        map.set(row.log_id, { count: cur.count + 1, liked: cur.liked || row.liker_id === userId });
      }
      setLikeMap(map);
    }
  }, [userId]);

  useEffect(() => {
    load();
    loadClub();
  }, [load, loadClub]);

  // Challenges actifs
  useEffect(() => {
    if (!userId) return;
    const today = new Date().toISOString().split("T")[0];
    (async () => {
      const { data: parts } = await supabase
        .from("challenge_participants")
        .select("challenge_id")
        .eq("user_id", userId)
        .eq("status", "accepted");
      if (!parts?.length) return;
      const ids = (parts as { challenge_id: string }[]).map((p) => p.challenge_id);
      const { data: chs } = await supabase
        .from("challenges")
        .select("id, title, metric, target_value, start_date, end_date")
        .in("id", ids)
        .lte("start_date", today)
        .gte("end_date", today);
      if (!chs?.length) return;
      const enriched = await Promise.all(
        (chs as { id: string; title: string; metric: string; target_value: number; start_date: string; end_date: string }[]).map(async (c) => {
          let myScore = 0;
          if (c.metric === "pages") {
            const { data } = await supabase
              .from("reading_logs")
              .select("pages_read")
              .eq("user_id", userId)
              .gte("date", c.start_date)
              .lte("date", c.end_date);
            myScore = ((data ?? []) as { pages_read: number }[]).reduce((s, l) => s + (l.pages_read ?? 0), 0);
          } else if (c.metric === "books") {
            const { count } = await supabase
              .from("books")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId)
              .eq("status", "completed")
              .gte("date_read", c.start_date)
              .lte("date_read", c.end_date);
            myScore = count ?? 0;
          } else {
            const { count } = await supabase
              .from("reading_logs")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId)
              .gte("date", c.start_date)
              .lte("date", c.end_date);
            myScore = count ?? 0;
          }
          return { ...c, myScore };
        })
      );
      setActiveChallenges(enriched);
    })();
  }, [userId]);

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

  // Like state — chargé à l'ouverture de la modale
  useEffect(() => {
    if (!noteModal || !userId) { setNoteLiked(false); setNoteLikeCount(0); return; }
    const fetchLikes = async () => {
      const [{ count }, { data: mine }] = await Promise.all([
        supabase.from("review_likes").select("*", { count: "exact", head: true })
          .eq("book_id", noteModal.bookId).eq("reviewer_user_id", noteModal.reviewerUserId),
        supabase.from("review_likes").select("id")
          .eq("book_id", noteModal.bookId).eq("reviewer_user_id", noteModal.reviewerUserId)
          .eq("liker_user_id", userId).maybeSingle(),
      ]);
      setNoteLikeCount(count ?? 0);
      setNoteLiked(!!mine);
    };
    fetchLikes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteModal?.bookId, noteModal?.reviewerUserId, userId]);

  const toggleNoteLike = async () => {
    if (!noteModal || !userId || noteModal.reviewerUserId === userId || noteLikeLoading) return;
    setNoteLikeLoading(true);
    if (noteLiked) {
      await supabase.from("review_likes").delete()
        .eq("book_id", noteModal.bookId).eq("reviewer_user_id", noteModal.reviewerUserId)
        .eq("liker_user_id", userId);
      setNoteLiked(false);
      setNoteLikeCount((n) => Math.max(0, n - 1));
    } else {
      await supabase.from("review_likes").upsert(
        { book_id: noteModal.bookId, reviewer_user_id: noteModal.reviewerUserId, liker_user_id: userId },
        { onConflict: "book_id,reviewer_user_id,liker_user_id" }
      );
      setNoteLiked(true);
      setNoteLikeCount((n) => n + 1);
      await supabase.from("notifications").insert({
        user_id: noteModal.reviewerUserId,
        type: "review_like",
        from_user_id: userId,
        book_id: noteModal.bookId,
        book_title: noteModal.bookTitle,
      });
    }
    setNoteLikeLoading(false);
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
          <Button variant="ghost" onClick={() => setShowLog(true)} className="text-sm">
            ✏️ Noter ma lecture
          </Button>
          <Button variant="ghost" onClick={() => setShowAdd(true)} className="text-sm">
            ＋ Livre
          </Button>
        </div>
      </header>

      {toast && (
        <div className="rounded-xl border border-[#cfe0cf] dark:border-success/30 bg-[#eaf1ea] dark:bg-[#162516] px-4 py-3 text-xs font-semibold text-success">
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
          <button
            onClick={() => setShowPodium(true)}
            className="w-full text-left"
          >
            <ChampionBanner champion={todayChampion} yesterdayChampion={yesterdayChampion} isMe={todayChampion.userId === userId} />
          </button>
        )}

        {!hasFollows && !activityLoading && (
          <Link
            href="/membres"
            className="flex items-center gap-3 rounded-2xl border border-violet/30 bg-violet-soft px-4 py-3"
          >
            <span className="text-lg">👥</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-violet-deep">Suis des membres pour voir leur activité</p>
              <p className="text-[11px] text-muted">Visite les profils → &quot;S&apos;abonner&quot;</p>
            </div>
            <span className="shrink-0 text-xs font-medium text-violet-deep">Voir →</span>
          </Link>
        )}

        {activityLoading ? (
          <div className="py-8 text-center text-xs font-medium text-muted">Chargement…</div>
        ) : activity.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-card p-6 text-center">
            <p className="text-sm text-muted">Pas encore d&apos;activité dans le club.</p>
          </div>
        ) : (() => {
          const todayStr = new Date().toISOString().split("T")[0];
          const yesterdayStr = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
          const dayGroups: { dateKey: string; label: string; logs: ActivityLog[] }[] = [];
          for (const log of activity) {
            const dk = log.date ?? "";
            const label = dk === todayStr ? "Aujourd'hui" : dk === yesterdayStr ? "Hier"
              : dk ? new Date(dk + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "";
            const last = dayGroups[dayGroups.length - 1];
            if (last && last.dateKey === dk) last.logs.push(log);
            else dayGroups.push({ dateKey: dk, label, logs: [log] });
          }
          return (
            <div className="flex flex-col gap-4">
              {dayGroups.map(({ dateKey, label, logs: dayLogs }) => (
                <div key={dateKey} className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-line" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">{label}</span>
                    <div className="h-px flex-1 bg-line" />
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {dayLogs.map((log) => (
                      <ActivityCarouselItem
                        key={log.id}
                        log={log}
                        isChampion={todayChampion?.userId === log.user_id}
                        likeData={likeMap.get(String(log.id))}
                        currentUserId={userId}
                        onLike={(logId) => {
                          if (!userId || log.user_id === userId) return;
                          const cur = likeMap.get(logId) ?? { count: 0, liked: false };
                          setLikeMap((prev) => new Map(prev).set(logId, { count: cur.liked ? Math.max(0, cur.count - 1) : cur.count + 1, liked: !cur.liked }));
                          if (cur.liked) {
                            supabase.from("session_likes").delete().eq("log_id", logId).eq("liker_id", userId);
                          } else {
                            supabase.from("session_likes").insert({ log_id: logId, liker_id: userId });
                          }
                        }}
                        onNoteClick={(type, text, photoUrl, date, bookId, reviewerUserId, bookTitle) =>
                          setNoteModal({ type, text, member: log.memberName, date, photoUrl, bookId, reviewerUserId, bookTitle })
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </section>

      {/* Challenges actifs */}
      {activeChallenges.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-lg font-medium text-ink">Challenges actifs</h2>
          <div className="flex gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {activeChallenges.map((c) => {
              const daysLeft = Math.max(0, Math.ceil((new Date(c.end_date).getTime() - Date.now()) / 86400000));
              const metricLabel = c.metric === "pages" ? "pages" : c.metric === "books" ? "livres" : "sessions";
              return (
                <div key={c.id} className="flex w-[200px] shrink-0 flex-col gap-2 rounded-2xl border border-violet/30 bg-violet-soft p-3">
                  <p className="line-clamp-1 text-[12.5px] font-semibold text-ink">{c.title}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="font-serif text-[20px] font-black text-violet-deep">{c.myScore.toLocaleString("fr-FR")}</span>
                    <span className="text-[11px] text-muted"> {metricLabel}</span>
                  </div>
                  <p className="text-[10px] text-muted">{daysLeft} jour{daysLeft !== 1 ? "s" : ""} restant{daysLeft !== 1 ? "s" : ""}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

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
      <LogReadingModal
        open={showLog}
        onClose={() => setShowLog(false)}
        books={books.filter((b) => b.status === "reading")}
        onSaved={(m) => { setShowLog(false); showToast(m); load(); }}
      />
      {showPodium && <PodiumModal onClose={() => setShowPodium(false)} />}

      {/* Mini-modale note / review (style Letterboxd) */}
      {noteModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center"
          onClick={() => setNoteModal(null)}
        >
          <div
            className="animate-slideUp w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-3 max-h-[80dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                noteModal.type === "review"
                  ? "bg-[#fdf7e9] text-[#8a6400] dark:bg-[#2a2210] dark:text-[#e0b83d]"
                  : "bg-violet-soft text-violet-deep"
              }`}>
                {noteModal.type === "review" ? "Review globale" : "Note de session"}
              </span>
              <div className="text-right">
                <p className="text-[11px] font-semibold text-ink">{noteModal.member}</p>
                {noteModal.date && (
                  <p className="text-[10px] text-muted">
                    {new Date(noteModal.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                  </p>
                )}
              </div>
            </div>
            <p className="font-serif text-[14px] italic leading-relaxed text-ink" style={{ whiteSpace: "pre-line" }}>
              « {noteModal.text} »
            </p>
            {noteModal.photoUrl && (
              <a href={noteModal.photoUrl} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={noteModal.photoUrl} alt="" className="w-full rounded-xl object-cover max-h-48" />
              </a>
            )}
            {/* Bouton like — masqué si c'est sa propre note */}
            {noteModal.reviewerUserId !== userId && (
              <button
                onClick={toggleNoteLike}
                disabled={noteLikeLoading}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12px] font-semibold transition-colors disabled:opacity-50 ${
                  noteLiked
                    ? "border-danger/30 bg-[#f6e7e1] dark:bg-[#2a1510] text-danger"
                    : "border-line bg-card text-muted hover:border-danger/30 hover:text-danger"
                }`}
              >
                <span className="text-sm">{noteLiked ? "♥" : "♡"}</span>
                {noteLikeCount > 0 ? `${noteLikeCount} j'aime` : "J'aime"}
              </button>
            )}
            <button
              onClick={() => setNoteModal(null)}
              className="w-full rounded-xl border border-line bg-card py-2.5 text-[12px] font-medium text-muted hover:text-ink"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
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

function ChampionBanner({ champion, yesterdayChampion, isMe }: {
  champion: Champion;
  yesterdayChampion: Champion | null;
  isMe: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-md"
      style={{ background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 55%, #4f46e5 100%)" }}
    >
      {/* Cercles décoratifs */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-5 right-10 h-20 w-20 rounded-full bg-white/5" />

      <div className="relative flex flex-col gap-2.5 p-4">
        {/* Ligne haute : champion du jour + trophée */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
              Champion du jour
            </p>
            <p className="mt-0.5 font-serif text-[20px] font-black leading-tight text-yellow-200 truncate">
              {champion.name}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <div className="text-right">
              <p className="text-[9px] font-medium uppercase tracking-wide text-white/45">pages</p>
              <p className="font-serif text-[26px] font-black leading-none text-white">
                {champion.pages}
              </p>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fde68a" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Champion d'hier */}
        {yesterdayChampion && (
          <p className="text-[10.5px] font-medium text-white/50">
            Champion d&apos;hier : <span className="font-semibold text-white/75">{yesterdayChampion.name}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function ActivityCarouselItem({
  log,
  isChampion,
  likeData,
  currentUserId,
  onLike,
  onNoteClick,
}: {
  log: ActivityLog;
  isChampion?: boolean;
  likeData?: { count: number; liked: boolean };
  currentUserId?: string;
  onLike?: (logId: string) => void;
  onNoteClick?: (type: "review" | "session", text: string, photoUrl: string | null | undefined, date: string, bookId: number, reviewerUserId: string, bookTitle: string) => void;
}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const showBadge = isChampion && log.date === todayStr;

  const actionLabel = log.eventType === "start"
    ? { text: "Commencé", color: "text-violet-deep" }
    : log.isCompletion
    ? {
        text: (log.bookRating ?? 0) > 0 ? `★ ${log.bookRating!.toFixed(1)}` : "✓ Lu",
        color: (log.bookRating ?? 0) > 0 ? "text-[#c9a227]" : "text-success",
      }
    : { text: `+${log.pages_read} p.`, color: "text-ink-2" };

  const avatarLink = log.user_id
    ? (children: React.ReactNode) => <Link href={`/membre/${log.user_id}`} className="flex items-center gap-1.5 overflow-hidden">{children}</Link>
    : (children: React.ReactNode) => <div className="flex items-center gap-1.5 overflow-hidden">{children}</div>;

  const hasReview = !!log.bookReview;
  const hasSessionNote = (log.allNotes?.length ?? 0) > 0 || !!log.session_notes;

  return (
    <div className="flex w-[128px] shrink-0 flex-col gap-2">
      {/* Couverture cliquable */}
      <Link
        href={`/livre/${log.book_id}`}
        className="group relative block overflow-hidden rounded-xl shadow-sm transition-transform active:scale-[0.97] hover:scale-[1.03]"
      >
        <Cover
          id={log.book_id}
          title={log.bookTitle}
          coverUrl={log.bookCover}
          className="aspect-[3/4] w-full"
          rounded="rounded-xl"
        />
        {/* Badge champion */}
        {showBadge && (
          <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#4f46e5] shadow-sm">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fde68a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
            </svg>
          </span>
        )}
      </Link>

      {/* Titre + Auteur */}
      <div className="flex flex-col gap-0.5">
        <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-ink">
          {log.bookTitle}
        </p>
        <p className="truncate text-[10px] text-muted">{log.bookAuthor}</p>
      </div>

      {/* Action + icônes de notes (style Letterboxd) */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className={`text-[11px] font-semibold leading-tight ${actionLabel.color}`}>
            {actionLabel.text}
          </p>
        </div>
        {(hasReview || hasSessionNote) && (
          <div className="flex shrink-0 flex-col gap-0.5">
            {hasReview && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onNoteClick?.("review", log.bookReview!, null, log.date, log.bookId, log.user_id!, log.bookTitle);
                }}
                className="flex h-[18px] w-[18px] items-center justify-center rounded bg-[#e4c97e] text-[9px] font-bold text-[#7a5c00]"
                title="Voir la review"
              >
                ≡
              </button>
            )}
            {hasSessionNote && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onNoteClick?.(
                    "session",
                    (log.allNotes && log.allNotes.length > 1)
                      ? log.allNotes.join("\n\n— \n\n")
                      : (log.allNotes?.[0] ?? log.session_notes ?? ""),
                    log.allPhotos?.[0] ?? log.session_photo_url ?? null,
                    log.date, log.bookId, log.user_id!, log.bookTitle
                  );
                }}
                className="flex h-[18px] w-[18px] items-center justify-center rounded bg-violet-soft text-[9px] font-bold text-violet-deep"
                title="Voir la note de session"
              >
                ≡
              </button>
            )}
          </div>
        )}
      </div>

      {/* Barre de progression — sessions de lecture uniquement */}
      {log.eventType !== "start" && !log.isCompletion && (log.bookPages ?? 0) > 0 && log.end_page > 0 && (
        <div className="flex flex-col gap-0.5">
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-violet"
              style={{ width: `${Math.min(100, (log.end_page / log.bookPages!) * 100)}%` }}
            />
          </div>
          <p className="text-[8.5px] text-muted">
            p.{log.end_page} / {log.bookPages}
          </p>
        </div>
      )}

      {/* Avatar + pseudo + like */}
      <div className="flex items-center justify-between gap-1">
        {avatarLink(
          <>
            <AvatarImg url={log.memberAvatar} name={log.memberName} className="h-4 w-4 shrink-0 text-[7px]" />
            <span className="truncate text-[10px] font-medium text-muted">{log.memberName}</span>
          </>
        )}
        {log.eventType !== "start" && (
          log.user_id !== currentUserId ? (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLike?.(String(log.id)); }}
              className="flex shrink-0 items-center gap-0.5 transition-transform active:scale-90"
            >
              {likeData && likeData.count > 0 ? (
                <>
                  <span className="text-[13px] leading-none" style={{ color: likeData.liked ? "#e05c7a" : "#c084a8" }}>
                    {likeData.liked ? "♥" : "♥"}
                  </span>
                  <span className="text-[9px] font-bold" style={{ color: "#e05c7a" }}>{likeData.count}</span>
                </>
              ) : (
                <span className="text-[13px] leading-none text-line">♡</span>
              )}
            </button>
          ) : likeData && likeData.count > 0 ? (
            <span className="flex shrink-0 items-center gap-0.5">
              <span className="text-[13px] leading-none" style={{ color: "#e05c7a" }}>♥</span>
              <span className="text-[9px] font-bold" style={{ color: "#e05c7a" }}>{likeData.count}</span>
            </span>
          ) : null
        )}
      </div>
    </div>
  );
}

