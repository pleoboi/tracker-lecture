"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import type { Book, ReadingLog } from "../../../lib/types";
import { pct, isCompleted } from "../../../lib/books";
import { Cover, ProgressBar, AvatarImg } from "../../../components/ui";
import { ObjectiveChart, RatingsChart } from "../../../components/DashboardWidgets";
import AddToLibraryModal from "../../../components/AddToLibraryModal";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const VIOLET = "var(--color-violet)";
const VIOLET_LT = "#d8cfe6";

interface Profile {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  created_at: string;
  bio?: string | null;
  favorite_book_ids?: number[] | null;
}


export default function MembrePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const memberId = params.id as string;
  const isOwn = user?.id === memberId;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [favoriteBooks, setFavoriteBooks] = useState<Book[]>([]);
  const [sessionPhotos, setSessionPhotos] = useState<{ url: string; date: string; bookTitle: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addTarget, setAddTarget] = useState<Book | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [championDays, setChampionDays] = useState(0);
  const [completedLimit, setCompletedLimit] = useState(1);
  const [noteModal, setNoteModal] = useState<{
    type: "review" | "session";
    text: string;
    bookTitle?: string;
    bookId: number;
    reviewerUserId: string;
  } | null>(null);
  const [noteLiked, setNoteLiked] = useState(false);
  const [noteLikeCount, setNoteLikeCount] = useState(0);
  const [noteLikeLoading, setNoteLikeLoading] = useState(false);

  // Follow system
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [followListType, setFollowListType] = useState<"followers" | "following" | null>(null);
  const [followList, setFollowList] = useState<{ id: string; display_name: string; avatar_url: string | null }[]>([]);

  useEffect(() => {
    const load = async () => {
      type LogRow = { user_id: string; pages_read: number; date: string };
      const [
        { data: prof }, { data: bs }, { data: ls }, { data: allLogs }, { data: logsWithPhotos },
        { count: fCount }, { count: ingCount },
      ] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("id", memberId).single(),
        supabase.from("books").select("*").eq("user_id", memberId),
        supabase.from("reading_logs").select("*").eq("user_id", memberId),
        supabase.from("reading_logs").select("user_id, pages_read, date"),
        supabase
          .from("reading_logs")
          .select("session_photo_url, date, book_id")
          .eq("user_id", memberId)
          .not("session_photo_url", "is", null)
          .order("date", { ascending: false })
          .limit(12),
        supabase.from("user_follows").select("*", { count: "exact", head: true }).eq("following_id", memberId),
        supabase.from("user_follows").select("*", { count: "exact", head: true }).eq("follower_id", memberId),
      ]);
      setFollowersCount(fCount ?? 0);
      setFollowingCount(ingCount ?? 0);

      // Vérifier si l'utilisateur courant suit ce membre
      if (user?.id && user.id !== memberId) {
        const { data: myFollowRow } = await supabase
          .from("user_follows")
          .select("id")
          .eq("follower_id", user.id)
          .eq("following_id", memberId)
          .maybeSingle();
        setIsFollowing(!!myFollowRow);
      }

      const profileData = prof as Profile;
      setProfile(profileData);
      const booksData = (bs as Book[]) || [];
      setBooks(booksData);
      setLogs((ls as ReadingLog[]) || []);

      // Favoris
      const favIds = (profileData?.favorite_book_ids ?? []).filter(Boolean);
      if (favIds.length > 0) {
        const { data: favData } = await supabase
          .from("books")
          .select("id, title, author, cover_url, rating")
          .in("id", favIds);
        const orderedFavs = favIds
          .map((id) => (favData as Book[])?.find((b) => b.id === id))
          .filter(Boolean) as Book[];
        setFavoriteBooks(orderedFavs);
      }

      // Photos de session
      type PhotoRow = { session_photo_url: string | null; date: string; book_id: number };
      const photosRaw = (logsWithPhotos as PhotoRow[]) || [];
      const bookMap = new Map(booksData.map((b) => [b.id, b.title]));
      setSessionPhotos(
        photosRaw
          .filter((r) => r.session_photo_url)
          .map((r) => ({
            url: r.session_photo_url!,
            date: r.date,
            bookTitle: bookMap.get(r.book_id) ?? "",
          }))
      );

      // Champion du jour
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
        if (maxPages > 0 && (userMap.get(memberId) || 0) >= maxPages) count++;
      }
      setChampionDays(count);

      setLoading(false);
    };
    load();
  }, [memberId]);

  useEffect(() => {
    if (!noteModal || !user?.id) { setNoteLiked(false); setNoteLikeCount(0); return; }
    const fetchLikes = async () => {
      const [{ count }, { data: mine }] = await Promise.all([
        supabase.from("review_likes").select("*", { count: "exact", head: true })
          .eq("book_id", noteModal.bookId).eq("reviewer_user_id", noteModal.reviewerUserId),
        supabase.from("review_likes").select("id")
          .eq("book_id", noteModal.bookId).eq("reviewer_user_id", noteModal.reviewerUserId)
          .eq("liker_user_id", user.id).maybeSingle(),
      ]);
      setNoteLikeCount(count ?? 0);
      setNoteLiked(!!mine);
    };
    fetchLikes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteModal?.bookId, noteModal?.reviewerUserId, user?.id]);

  const toggleNoteLike = async () => {
    if (!noteModal || !user?.id || noteModal.reviewerUserId === user.id || noteLikeLoading) return;
    setNoteLikeLoading(true);
    if (noteLiked) {
      await supabase.from("review_likes").delete()
        .eq("book_id", noteModal.bookId).eq("reviewer_user_id", noteModal.reviewerUserId)
        .eq("liker_user_id", user.id);
      setNoteLiked(false);
      setNoteLikeCount((n) => Math.max(0, n - 1));
    } else {
      await supabase.from("review_likes").upsert(
        { book_id: noteModal.bookId, reviewer_user_id: noteModal.reviewerUserId, liker_user_id: user.id },
        { onConflict: "book_id,reviewer_user_id,liker_user_id" }
      );
      setNoteLiked(true);
      setNoteLikeCount((n) => n + 1);
      await supabase.from("notifications").insert({
        user_id: noteModal.reviewerUserId,
        type: "review_like",
        from_user_id: user.id,
        book_id: noteModal.bookId,
        book_title: noteModal.bookTitle ?? "",
      });
    }
    setNoteLikeLoading(false);
  };

  const handleFollow = async () => {
    if (!user?.id) return;
    setLoadingFollow(true);
    if (isFollowing) {
      await supabase.from("user_follows").delete().eq("follower_id", user.id).eq("following_id", memberId);
      setIsFollowing(false);
      setFollowersCount((n) => Math.max(0, n - 1));
    } else {
      await supabase.from("user_follows").insert({ follower_id: user.id, following_id: memberId });
      setIsFollowing(true);
      setFollowersCount((n) => n + 1);
    }
    setLoadingFollow(false);
  };

  const handleShowFollowList = async (type: "followers" | "following") => {
    setFollowList([]);
    setFollowListType(type);
    const filterCol = type === "followers" ? "following_id" : "follower_id";
    const selectCol = type === "followers" ? "follower_id" : "following_id";
    const { data } = await supabase.from("user_follows").select(selectCol).eq(filterCol, memberId);
    const ids = ((data || []) as Record<string, string>[]).map((r) => r[selectCol]);
    if (ids.length === 0) return;
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, display_name, avatar_url")
      .in("id", ids);
    setFollowList((profiles || []) as { id: string; display_name: string; avatar_url: string | null }[]);
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-xs font-medium uppercase tracking-wider text-muted">
        Chargement…
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="py-24 text-center">
        <p className="font-serif text-lg text-ink">Profil introuvable.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-sm font-medium text-violet-deep"
        >
          ← Retour
        </button>
      </div>
    );
  }

  const completed = books.filter(isCompleted);
  const reading = books.filter((b) => b.status === "reading");
  const abandoned = books.filter((b) => b.status === "abandoned");

  // Map bookId → a session note (for Letterboxd-style icons)
  const bookSessionNoteMap = new Map<number, string>();
  logs.forEach((l) => { if (l.session_notes) bookSessionNoteMap.set(l.book_id, l.session_notes); });

  // Recency key : date du dernier log (activité réelle) > date_read > created_at
  // Cela évite que les imports Goodreads de 2021 remontent devant des lectures de cette semaine
  const lastLogByBook = new Map<number, string>();
  logs.forEach((l) => {
    const existing = lastLogByBook.get(l.book_id);
    if (!existing || l.date > existing) lastLogByBook.set(l.book_id, l.date);
  });
  const recencyKey = (b: Book): string =>
    lastLogByBook.get(b.id) || b.date_read || b.created_at || "";

  // Lecture en cours la plus récemment loggée
  const currentReading = reading.slice().sort(
    (a, b) => recencyKey(b).localeCompare(recencyKey(a))
  )[0] ?? null;

  // 3 derniers terminés : exclure les imports sans date_read ET sans log
  // (livres Goodreads marqués "lus" avec date inconnue → pas d'activité concrète)
  const last3Completed = [...completed]
    .filter((b) => lastLogByBook.has(b.id) || !!b.date_read)
    .sort((a, b) => recencyKey(b).localeCompare(recencyKey(a)))
    .slice(0, 3);
  const ratedBooks = completed.filter((b) => (b.rating || 0) > 0);
  const avgRating =
    ratedBooks.length > 0
      ? ratedBooks.reduce((s, b) => s + (b.rating || 0), 0) / ratedBooks.length
      : null;
  const totalPages = logs.reduce((s, l) => s + (l.pages_read || 0), 0);

  const ratingCounts = Array(10).fill(0);
  let ratingSum = 0;
  let ratedCount = 0;
  completed.forEach((b) => {
    const r = b.rating || 0;
    if (r > 0) {
      const bucket = Math.min(9, Math.max(0, Math.round(r * 2) - 1));
      ratingCounts[bucket] += 1;
      ratingSum += r;
      ratedCount += 1;
    }
  });
  const ratingAvg = ratedCount > 0 ? ratingSum / ratedCount : 0;

  const now = new Date();
  const pagesByMonth = Array(12).fill(0);
  logs.forEach((l) => {
    const d = new Date(l.date);
    if (d.getFullYear() === now.getFullYear()) {
      pagesByMonth[d.getMonth()] += l.pages_read || 0;
    }
  });
  const chartData = pagesByMonth.map((v, i) => ({ name: MONTHS[i], value: v }));

  const memberSince = new Date(profile.created_at).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="animate-fadeIn flex flex-col gap-6 pt-4">
      {/* Retour */}
      <button
        onClick={() => router.back()}
        className="flex w-fit items-center gap-1 text-xs font-medium text-muted"
      >
        ← Membres
      </button>

      {/* En-tête profil */}
      <div className="flex items-center gap-4 rounded-2xl bg-violet-soft px-5 py-6">
        <AvatarImg url={profile.avatar_url} name={profile.display_name} className="h-16 w-16 text-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl font-black text-ink">{profile.display_name}</h1>
            {isOwn && (
              <Link
                href="/compte"
                className="rounded-lg border border-line bg-card px-2 py-0.5 text-[11px] font-medium text-muted"
              >
                Modifier
              </Link>
            )}
          </div>
          <p className="mt-0.5 text-xs font-medium text-muted">Membre depuis {memberSince}</p>
          {profile.bio && (
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2" style={{ whiteSpace: "pre-line" }}>{profile.bio}</p>
          )}
          {/* Compteurs abonnés */}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => handleShowFollowList("followers")}
              className="flex items-center gap-1 text-[12px] text-ink hover:text-violet-deep"
            >
              <span className="font-bold">{followersCount}</span>
              <span className="text-muted"> abonné{followersCount !== 1 ? "s" : ""}</span>
            </button>
            <span className="text-line text-muted">·</span>
            <button
              onClick={() => handleShowFollowList("following")}
              className="flex items-center gap-1 text-[12px] text-ink hover:text-violet-deep"
            >
              <span className="font-bold">{followingCount}</span>
              <span className="text-muted"> abonnement{followingCount !== 1 ? "s" : ""}</span>
            </button>
          </div>
          {/* Bouton follow — pleine largeur sur mobile */}
          {!isOwn && user?.id && (
            <button
              onClick={handleFollow}
              disabled={loadingFollow}
              className={`mt-3 w-full rounded-2xl py-3 text-sm font-semibold transition-colors disabled:opacity-50 sm:w-auto sm:rounded-xl sm:px-5 sm:py-2 ${
                isFollowing
                  ? "border border-line bg-card text-muted hover:border-danger/50 hover:text-danger"
                  : "bg-violet text-cream hover:opacity-90"
              }`}
            >
              {loadingFollow ? "…" : isFollowing ? "Abonné ✓" : "S'abonner"}
            </button>
          )}
        </div>
      </div>

      {/* Chips stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip value={String(completed.length)} label="Livres terminés" />
        <StatChip value={(totalPages).toLocaleString("fr-FR")} label="Pages lues" />
        <StatChip value={reading.length > 0 ? String(reading.length) : "—"} label="En cours" />
        <StatChip
          value={avgRating != null ? avgRating.toFixed(1).replace(".", ",") + " ★" : "—"}
          label="Note moy."
        />
      </div>

      {/* Top 4 Favoris (style Letterboxd) — juste après les indicateurs */}
      {favoriteBooks.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="font-serif text-[15px] font-medium text-ink">
            Livres favoris{" "}
            <span className="font-sans text-xs font-normal text-muted">({favoriteBooks.length})</span>
          </h2>
          <div className="grid grid-cols-4 gap-2.5">
            {favoriteBooks.map((b) => (
              <Link key={b.id} href={`/livre/${b.id}`} className="group flex w-full flex-col items-center gap-1.5">
                <div className="relative w-full overflow-hidden rounded-xl shadow-sm transition-transform group-hover:scale-105">
                  <Cover
                    id={b.id}
                    title={b.title}
                    coverUrl={b.cover_url}
                    className="aspect-[3/4] w-full"
                    rounded="rounded-xl"
                  />
                  {(b.rating || 0) > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/70 to-transparent px-1.5 pb-1.5 pt-4">
                      <p className="text-[9px] font-bold text-cream">★ {b.rating!.toFixed(1)}</p>
                    </div>
                  )}
                </div>
                <p className="max-w-full truncate text-center text-[9.5px] font-medium text-muted">
                  {b.title}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Mise en avant lectures : en cours + derniers lus */}
      {(currentReading || last3Completed.length > 0) && (
        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-[15px] font-medium text-ink">Activités récentes</h2>
          <div className="grid grid-cols-4 gap-2">
            {/* En cours (col 1 — plus large) */}
            <div className="col-span-1">
              {currentReading ? (
                <Link href={`/livre/${currentReading.id}`} className="group flex h-full flex-col gap-1.5">
                  <div className="relative overflow-hidden rounded-xl shadow-sm transition-transform group-hover:scale-[1.03]">
                    <Cover
                      id={currentReading.id}
                      title={currentReading.title}
                      coverUrl={currentReading.cover_url}
                      className="aspect-[3/4] w-full"
                      rounded="rounded-xl"
                    />
                    <div className="absolute inset-x-0 bottom-0 rounded-b-xl bg-gradient-to-t from-ink/70 to-transparent px-2 pb-2 pt-6">
                      <div className="h-1 overflow-hidden rounded-full bg-white/30">
                        <div className="h-full rounded-full bg-cream" style={{ width: `${pct(currentReading)}%` }} />
                      </div>
                      <p className="mt-0.5 text-[9px] font-semibold text-cream">{pct(currentReading)}%</p>
                    </div>
                  </div>
                  <p className="line-clamp-2 text-center text-[9px] font-medium text-muted">{currentReading.title}</p>
                </Link>
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center rounded-xl border border-dashed border-line bg-card">
                  <span className="text-[9px] text-muted">En cours</span>
                </div>
              )}
            </div>

            {/* 3 derniers terminés */}
            {[0, 1, 2].map((i) => {
              const b = last3Completed[i];
              return b ? (
                <Link key={b.id} href={`/livre/${b.id}`} className="group flex flex-col gap-1.5">
                  <div className="relative overflow-hidden rounded-xl shadow-sm transition-transform group-hover:scale-[1.03]">
                    <Cover
                      id={b.id}
                      title={b.title}
                      coverUrl={b.cover_url}
                      className="aspect-[3/4] w-full"
                      rounded="rounded-xl"
                    />
                    {(b.rating || 0) > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/70 to-transparent px-1.5 pb-1.5 pt-4">
                        <p className="text-[9px] font-bold text-cream">★ {b.rating!.toFixed(1)}</p>
                      </div>
                    )}
                  </div>
                  <p className="line-clamp-2 text-center text-[9px] font-medium text-muted">{b.title}</p>
                </Link>
              ) : (
                <div key={i} className="flex aspect-[3/4] items-center justify-center rounded-xl border border-dashed border-line bg-card">
                  <span className="text-[9px] text-muted">—</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted">
            <span className="font-medium text-ink-2">En cours</span> · <span className="font-medium text-ink-2">3 derniers terminés</span>
          </p>
        </section>
      )}

      {/* Trophée Champion du jour */}
      {championDays > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-[#fdf7e9] p-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-xl">
            🏆
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink">
              {isOwn ? "Tes trophées Champion du jour" : "Trophées Champion du jour"}
            </p>
            <p className="text-[11px] text-muted">Jours où {isOwn ? "tu as" : profile.display_name + " a"} lu le plus de pages</p>
          </div>
          <div className="text-right">
            <p className="font-serif text-2xl font-black text-[#b8890a]">{championDays}</p>
            <p className="text-[10.5px] font-medium text-muted">{championDays > 1 ? "jours" : "jour"}</p>
          </div>
        </div>
      )}

      {/* Lectures en cours */}
      {reading.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-medium text-ink">
              En cours de lecture{" "}
              <span className="font-sans text-sm font-normal text-muted">({reading.length})</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {reading.map((b) => (
              <div key={b.id} className="flex flex-col gap-1.5">
                <Link
                  href={`/livre/${b.id}`}
                  className="flex h-[96px] items-center gap-2.5 overflow-hidden rounded-2xl border border-line bg-card p-2.5 transition-colors hover:border-violet/40"
                >
                  <Cover id={b.id} title={b.title} coverUrl={b.cover_url} className="h-[68px] w-[46px] shrink-0" rounded="rounded-md" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-serif text-[12px] font-medium leading-snug text-ink">{b.title}</p>
                    <p className="truncate text-[10px] text-muted">{b.author}</p>
                    <div className="mt-1.5">
                      <ProgressBar value={pct(b) / 100} />
                      <p className="mt-0.5 text-[9.5px] font-medium text-muted">{pct(b)}%</p>
                    </div>
                  </div>
                </Link>
                {!isOwn && (
                  <button
                    onClick={() => setAddTarget(b)}
                    className="flex w-full items-center justify-center gap-1 rounded-xl border border-violet/30 bg-violet-soft py-1.5 text-[10.5px] font-semibold text-violet-deep"
                  >
                    + Ajouter
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Livres terminés */}
      {completed.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-medium text-ink">
              Livres terminés{" "}
              <span className="font-sans text-sm font-normal text-muted">({completed.length})</span>
            </h2>
          </div>

          {/* Liste paginée : 1 initial, +5 par clic */}
          <div className="grid grid-cols-2 gap-2">
            {completed
              .sort((a, b) => (b.rating || 0) - (a.rating || 0))
              .slice(0, completedLimit)
              .map((b) => {
                const hasReview = !!b.notes;
                const hasSessionNote = bookSessionNoteMap.has(b.id);
                return (
                  <div key={b.id} className="flex flex-col gap-1.5">
                    <Link
                      href={`/livre/${b.id}`}
                      className="flex h-[96px] items-center gap-2.5 overflow-hidden rounded-2xl border border-line bg-card p-2.5 transition-colors hover:border-violet/40"
                    >
                      <Cover id={b.id} title={b.title} coverUrl={b.cover_url} className="h-[68px] w-[46px] shrink-0" rounded="rounded-md" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 font-serif text-[12px] font-medium leading-snug text-ink">{b.title}</p>
                        <p className="truncate text-[10px] text-muted">{b.author}</p>
                        {(b.rating || 0) > 0 ? (
                          <p className="mt-1 text-[10.5px] font-medium text-gold">
                            {"★".repeat(Math.round(b.rating!))} {b.rating!.toFixed(1).replace(".", ",")}
                          </p>
                        ) : (
                          <p className="mt-1 text-[9.5px] font-medium text-success">✓ Terminé</p>
                        )}
                        {/* Icônes Letterboxd */}
                        {(hasReview || hasSessionNote) && (
                          <div className="mt-1 flex gap-1">
                            {hasReview && (
                              <button
                                onClick={(e) => { e.preventDefault(); setNoteModal({ type: "review", text: b.notes!, bookTitle: b.title, bookId: b.id, reviewerUserId: memberId }); }}
                                className="flex h-[16px] w-[16px] items-center justify-center rounded bg-[#e4c97e] text-[8px] font-bold text-[#7a5c00]"
                                title="Voir la review"
                              >
                                ≡
                              </button>
                            )}
                            {hasSessionNote && (
                              <button
                                onClick={(e) => { e.preventDefault(); setNoteModal({ type: "session", text: bookSessionNoteMap.get(b.id)!, bookTitle: b.title, bookId: b.id, reviewerUserId: memberId }); }}
                                className="flex h-[16px] w-[16px] items-center justify-center rounded bg-violet-soft text-[8px] font-bold text-violet-deep"
                                title="Voir une note de session"
                              >
                                ≡
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                    {!isOwn && (
                      <button
                        onClick={() => setAddTarget(b)}
                        className="flex w-full items-center justify-center gap-1 rounded-xl border border-violet/30 bg-violet-soft py-1.5 text-[10.5px] font-semibold text-violet-deep"
                      >
                        + Ajouter
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
          {completedLimit < completed.length && (
            <button
              onClick={() => setCompletedLimit((n) => n + 5)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet py-2.5 text-[12.5px] font-semibold text-cream transition-colors hover:opacity-90 active:opacity-80"
            >
              Voir plus · {Math.min(5, completed.length - completedLimit)} de plus
            </button>
          )}
          {completedLimit > 1 && (
            <button
              onClick={() => setCompletedLimit(1)}
              className="flex w-full items-center justify-center rounded-xl border border-line bg-card py-2 text-[11.5px] font-medium text-muted hover:text-violet-deep"
            >
              Réduire ↑
            </button>
          )}
        </section>
      )}

      {/* Livres abandonnés */}
      {abandoned.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-medium text-ink">
              Abandonnés{" "}
              <span className="font-sans text-sm font-normal text-muted">({abandoned.length})</span>
            </h2>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {abandoned.map((b) => (
              <Link
                key={b.id}
                href={`/livre/${b.id}`}
                className="flex h-[96px] items-center gap-3.5 overflow-hidden rounded-2xl border border-line bg-card p-3.5 opacity-70 transition-colors hover:border-line hover:opacity-90"
              >
                <Cover id={b.id} title={b.title} coverUrl={b.cover_url} className="h-[70px] w-[48px] shrink-0 grayscale" rounded="rounded-md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-[13.5px] font-medium text-ink">{b.title}</p>
                  <p className="truncate text-[11px] text-muted">{b.author}</p>
                  <span className="mt-1.5 inline-block rounded-md bg-paper px-2 py-0.5 text-[10.5px] font-medium text-muted">
                    Abandonné
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Galerie de photos de sessions */}
      {sessionPhotos.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-lg font-medium text-ink">Galerie</h2>
          <div className="grid grid-cols-3 gap-2">
            {sessionPhotos.map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="group relative overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.bookTitle}
                  className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                  onError={(e) => ((e.target as HTMLImageElement).parentElement!.style.display = "none")}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/60 to-transparent px-2 pb-1.5 pt-4 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="truncate text-[9px] font-semibold text-cream">{p.bookTitle}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Histogramme des notes */}
      {ratedCount > 0 && (
        <RatingsChart counts={ratingCounts} average={ratingAvg} total={ratedCount} />
      )}

      {/* Graphique pages / mois */}
      {totalPages > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-lg font-medium text-ink">Pages lues en {now.getFullYear()}</h2>
          <ObjectiveChart
            title=""
            type="area"
            data={chartData}
            objective={null}
            unit="p."
            color={VIOLET}
            lightColor={VIOLET_LT}
            currentMonth={now.getMonth()}
          />
        </section>
      )}

      {completed.length === 0 && reading.length === 0 && abandoned.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-card p-10 text-center">
          <p className="font-serif text-base text-ink">Aucun livre pour le moment.</p>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 rounded-2xl bg-ink px-4 py-2.5 text-sm font-medium text-cream shadow-xl">
          {toast}
        </div>
      )}

      <AddToLibraryModal
        open={addTarget !== null}
        onClose={() => setAddTarget(null)}
        book={addTarget}
        onAdded={(msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); }}
      />

      {/* Mini-modale note / review (icônes Letterboxd) */}
      {noteModal && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 md:items-center"
          onClick={() => setNoteModal(null)}
        >
          <div
            className="animate-slideUp w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-3 max-h-[75dvh] overflow-y-auto"
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
              {noteModal.bookTitle && (
                <p className="text-[11px] font-semibold text-ink truncate max-w-[55%] text-right">{noteModal.bookTitle}</p>
              )}
            </div>
            <p className="font-serif text-[14px] italic leading-relaxed text-ink" style={{ whiteSpace: "pre-line" }}>
              « {noteModal.text} »
            </p>
            {/* Bouton like — masqué pour sa propre note */}
            {noteModal.reviewerUserId !== user?.id && (
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

      {/* Modal liste abonnés / abonnements */}
      {followListType !== null && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/30 backdrop-blur-sm"
          onClick={() => setFollowListType(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-paper p-5 pb-10 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold text-ink">
                {followListType === "followers" ? "Abonnés" : "Abonnements"}
              </h3>
              <button onClick={() => setFollowListType(null)} className="text-sm text-muted">✕</button>
            </div>
            {followList.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                {followListType === "followers" ? "Aucun abonné pour l'instant." : "Aucun abonnement pour l'instant."}
              </p>
            ) : (
              <div className="flex flex-col gap-2 overflow-y-auto max-h-72">
                {followList.map((m) => (
                  <Link
                    key={m.id}
                    href={`/membre/${m.id}`}
                    onClick={() => setFollowListType(null)}
                    className="flex items-center gap-3 rounded-xl border border-line bg-card px-3 py-2.5 hover:border-violet/40"
                  >
                    <AvatarImg url={m.avatar_url} name={m.display_name} className="h-8 w-8 shrink-0 text-sm" />
                    <span className="text-sm font-medium text-ink">{m.display_name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatChip({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-2xl border border-line bg-card px-3 py-3.5 text-center">
      <span className="font-serif text-xl font-bold text-ink">{value}</span>
      <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted">{label}</span>
    </div>
  );
}
