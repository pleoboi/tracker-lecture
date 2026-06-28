"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import type { Book, ReadingLog, ReadSession } from "../../../lib/types";
import { pct, isCompleted, isAbandoned, readingStats, formatDate, formatDateLong } from "../../../lib/books";
import { Cover, ProgressBar, Pill, Button, AvatarImg } from "../../../components/ui";
import LogReadingModal from "../../../components/LogReadingModal";
import AddToLibraryModal from "../../../components/AddToLibraryModal";
import CoverPickerModal from "../../../components/CoverPickerModal";

const GENRES = [
  "Roman", "Fiction", "Non-Fiction", "Classique", "Nouvelle",
  "Thriller", "Policier", "Crime", "Mystère",
  "Fantasy", "Science-Fiction",
  "Histoire", "Biographie", "Témoignage", "Jeunesse",
  "BD / Roman graphique", "Manga", "Comics",
  "Développement personnel", "Philosophie", "Poésie", "Psychologie",
  "Économie", "Science", "Sciences humaines", "Sciences politiques",
  "Essai", "Aventure", "Romance", "Humour", "Sport", "Cinéma",
  "Musique", "Drame", "Suspense", "Théâtre",
];

interface MemberEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  rating: number | null;
  review: string | null;
  status: string;
}

/* ── Confetti ──────────────────────────────────────────────────────── */
const CONFETTI_COLORS = ["#8b79be", "#d7a33f", "#5e8c61", "#c0563f", "#6e7a5a", "#6f5da6", "#9b5c8f"];

function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {Array.from({ length: 48 }).map((_, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: `${(i * 6.37 + (i % 3) * 11) % 100}%`,
            top: "-24px",
            width: `${6 + (i % 6) * 2}px`,
            height: `${6 + (i % 6) * 2}px`,
            borderRadius: i % 3 === 0 ? "50%" : i % 3 === 1 ? "2px" : "0",
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDuration: `${2.2 + (i % 5) * 0.4}s`,
            animationDelay: `${(i * 0.07) % 1.6}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Page principale ───────────────────────────────────────────────── */
export default function BookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const isAdmin = user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const id = Number(params.id);

  const [book, setBook] = useState<Book | null>(null);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoDraft, setInfoDraft] = useState({ title: "", author: "", year: "", summary: "", coverUrl: "" });

  // Social
  const [memberActivity, setMemberActivity] = useState<MemberEntry[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberEntry | null>(null);

  // Likes de reviews
  const [reviewLikeCount, setReviewLikeCount] = useState(0);
  const [reviewLiked, setReviewLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  // Cover picker dans le formulaire d'édition admin
  const [showCoverPickerEdit, setShowCoverPickerEdit] = useState(false);

  // Confetti + genre picker
  const [showConfetti, setShowConfetti] = useState(false);
  const [showGenrePicker, setShowGenrePicker] = useState(false);
  const [savingGenre, setSavingGenre] = useState(false);

  // Édition multi-genres inline
  const [editingGenre, setEditingGenre] = useState(false);
  const [genreSelection, setGenreSelection] = useState<string[]>([]);
  const [savingGenreEdit, setSavingGenreEdit] = useState(false);

  // Relectures
  const [readSessions, setReadSessions] = useState<ReadSession[]>([]);
  const [addingRelecture, setAddingRelecture] = useState(false);
  const [relectureDraft, setRelectureDraft] = useState({ date_started: "", date_read: "" });
  const [savingRelecture, setSavingRelecture] = useState(false);

  // Mark as read (no date)
  const [markingRead, setMarkingRead] = useState(false);

  // Correction inline de la progression
  const [editingProgress, setEditingProgress] = useState(false);
  const [progressDraft, setProgressDraft] = useState("");
  const [savingProgress, setSavingProgress] = useState(false);

  // Ajouter à ma bibliothèque (non-propriétaire)
  const [showAddModal, setShowAddModal] = useState(false);
  const [addedMsg, setAddedMsg] = useState<string | null>(null);
  const [wishlistAdded, setWishlistAdded] = useState(false);

  const quickAddWishlist = async () => {
    if (!userId || !book) return;
    const { data: existing } = await supabase.from("books").select("id").eq("user_id", userId).ilike("title", book.title).limit(1);
    if (existing && existing.length > 0) { setAddedMsg("Ce livre est déjà dans ta bibliothèque."); setTimeout(() => setAddedMsg(null), 3000); return; }
    const { error } = await supabase.from("books").insert({ title: book.title, author: book.author, pages: book.pages, progress: 0, status: "to-read", cover_url: book.cover_url ?? null, genre: book.genre ?? null, published_year: book.published_year ?? null, summary: book.summary ?? null, rating: 0, user_id: userId });
    if (!error) { setWishlistAdded(true); setAddedMsg("Ajouté à ta liste Envie de lire."); setTimeout(() => setAddedMsg(null), 3500); }
  };

  // Copie personnelle de l'utilisateur si ce n'est pas son livre
  const [myBook, setMyBook] = useState<Book | null>(null);

  // Notes de session du membre affiché dans la modale
  const [selectedMemberSessionNotes, setSelectedMemberSessionNotes] = useState<
    { date: string; session_notes: string; session_photo_url: string | null }[]
  >([]);

  const load = useCallback(async () => {
    if (!userId) return;

    // Étape A : métadonnées du livre (URL)
    const { data: b } = await supabase.from("books").select("*").eq("id", id).single();
    setBook(b as Book | null);
    if (!b) { setLoading(false); return; }

    const urlBook = b as Book;
    setInfoDraft({
      title: urlBook.title,
      author: urlBook.author,
      year: urlBook.published_year ? String(urlBook.published_year) : "",
      summary: urlBook.summary || "",
      coverUrl: urlBook.cover_url || "",
    });

    // Étape B : copie de l'utilisateur connecté (peut être le même livre)
    let ownBook: Book | null = urlBook.user_id === userId ? urlBook : null;
    if (!ownBook) {
      const { data: own } = await supabase
        .from("books")
        .select("*")
        .ilike("title", urlBook.title.replace(/[%_]/g, "\\$&"))
        .eq("user_id", userId)
        .maybeSingle();
      ownBook = (own as Book) || null;
    }
    setMyBook(urlBook.user_id === userId ? null : ownBook);
    setNotesDraft(ownBook?.notes || "");

    // Étape C : logs et sessions de lecture (pour la copie de l'user)
    const ownId = ownBook?.id ?? id;
    const [{ data: l }, { data: sess }] = await Promise.all([
      supabase
        .from("reading_logs")
        .select("*")
        .eq("book_id", ownId)
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("book_read_sessions")
        .select("*")
        .eq("book_id", ownId)
        .eq("user_id", userId)
        .order("date_read", { ascending: true }),
    ]);
    setLogs((l as ReadingLog[]) || []);
    setReadSessions((sess as ReadSession[]) || []);

    // Étape D : activité des autres membres
    const { data: otherBooks } = await supabase
      .from("books")
      .select("user_id, rating, notes, status")
      .ilike("title", `%${urlBook.title.replace(/[%_]/g, "\\$&")}%`)
      .neq("user_id", userId);

    if (otherBooks?.length) {
      const uids = [...new Set((otherBooks as any[]).map((ob) => ob.user_id))] as string[];
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, display_name, avatar_url")
        .in("id", uids);

      setMemberActivity(
        (otherBooks as any[])
          .filter((ob) => ob.status !== "abandoned")
          .map((ob) => {
            const p = (profiles as any[])?.find((x) => x.id === ob.user_id);
            return {
              userId: ob.user_id,
              displayName: p?.display_name || "Membre",
              avatarUrl: p?.avatar_url || null,
              rating: ob.rating || null,
              review: ob.notes || null,
              status: ob.status,
            };
          })
      );
    }

    setLoading(false);
  }, [id, userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Charge le statut de like quand un membre est sélectionné (a une review)
  useEffect(() => {
    if (!selectedMember?.review || !userId) {
      setReviewLikeCount(0);
      setReviewLiked(false);
      return;
    }
    const loadLikes = async () => {
      const [{ count }, { data: myLike }] = await Promise.all([
        supabase
          .from("review_likes")
          .select("*", { count: "exact", head: true })
          .eq("book_id", id)
          .eq("reviewer_user_id", selectedMember.userId),
        supabase
          .from("review_likes")
          .select("id")
          .eq("book_id", id)
          .eq("reviewer_user_id", selectedMember.userId)
          .eq("liker_user_id", userId)
          .maybeSingle(),
      ]);
      setReviewLikeCount(count ?? 0);
      setReviewLiked(!!myLike);
    };
    loadLikes();
  }, [selectedMember, userId, id]);

  // Charge les notes de session du membre sélectionné
  useEffect(() => {
    if (!selectedMember || !book) { setSelectedMemberSessionNotes([]); return; }
    const loadSessionNotes = async () => {
      const { data: mb } = await supabase
        .from("books")
        .select("id")
        .ilike("title", book.title.replace(/[%_]/g, "\\$&"))
        .eq("user_id", selectedMember.userId)
        .maybeSingle();
      if (!mb) { setSelectedMemberSessionNotes([]); return; }
      const { data: mlogs } = await supabase
        .from("reading_logs")
        .select("date, session_notes, session_photo_url")
        .eq("book_id", (mb as any).id)
        .not("session_notes", "is", null)
        .order("date", { ascending: true });
      setSelectedMemberSessionNotes(
        ((mlogs as any[]) || []).filter((l) => l.session_notes)
      );
    };
    loadSessionNotes();
  }, [selectedMember, book]);

  const toggleReviewLike = async () => {
    if (!selectedMember?.review || !userId || likeLoading || selectedMember.userId === userId) return;
    setLikeLoading(true);
    if (reviewLiked) {
      await supabase
        .from("review_likes")
        .delete()
        .eq("book_id", id)
        .eq("reviewer_user_id", selectedMember.userId)
        .eq("liker_user_id", userId);
      setReviewLiked(false);
      setReviewLikeCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from("review_likes").insert({
        book_id: id,
        reviewer_user_id: selectedMember.userId,
        liker_user_id: userId,
      });
      setReviewLiked(true);
      setReviewLikeCount((c) => c + 1);
      // Notification pour l'auteur de la review
      if (selectedMember.userId !== userId && book) {
        await supabase.from("notifications").insert({
          user_id: selectedMember.userId,
          type: "review_like",
          from_user_id: userId,
          book_id: id,
          book_title: book.title,
        });
      }
    }
    setLikeLoading(false);
  };

  const setRating = async (value: number) => {
    if (!activeBook) return;
    updateActiveBook({ ...activeBook, rating: value });
    await supabase.from("books").update({ rating: value }).eq("id", activeBook.id);
  };

  const saveNotes = async () => {
    if (!activeBook) return;
    await supabase.from("books").update({ notes: notesDraft }).eq("id", activeBook.id);
    updateActiveBook({ ...activeBook, notes: notesDraft });
    setEditingNotes(false);
  };

  const saveInfo = async () => {
    if (!book) return;
    const year = infoDraft.year ? Number(infoDraft.year) : null;
    const update = {
      title: infoDraft.title.trim() || book.title,
      author: infoDraft.author.trim() || book.author,
      published_year: year,
      summary: infoDraft.summary.trim() || null,
      cover_url: infoDraft.coverUrl.trim() || null,
    };
    if (isAdmin) {
      // Passe par l'API route (service role) pour bypasser RLS et mettre à jour toutes les copies
      const { data: { session } } = await supabase.auth.getSession();
      await fetch("/api/books/update-metadata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ title: book.title, update }),
      });
    } else if (activeBook) {
      await supabase.from("books").update(update).eq("id", activeBook.id);
    }
    setBook({ ...book, ...update });
    if (activeBook) updateActiveBook({ ...activeBook, ...update });
    setEditingInfo(false);
  };

  const deleteLog = async (logId: number) => {
    await supabase.from("reading_logs").delete().eq("id", logId);
    load();
  };

  const abandon = async () => {
    if (!activeBook) return;
    if (!confirm(`Marquer « ${book?.title} » comme abandonné ?`)) return;
    await supabase.from("books").update({ status: "abandoned" }).eq("id", activeBook.id);
    router.push("/");
  };

  const remove = async () => {
    if (!activeBook) return;
    if (!confirm(`Supprimer « ${book?.title} » et son historique ?`)) return;
    await supabase.from("reading_logs").delete().eq("book_id", activeBook.id);
    await supabase.from("books").delete().eq("id", activeBook.id);
    router.push("/bibliotheque");
  };

  // Marquer comme lu sans date
  const markAsReadNoDate = async () => {
    if (!activeBook || markingRead) return;
    setMarkingRead(true);
    await supabase
      .from("books")
      .update({ status: "completed", progress: activeBook.pages, date_read: null })
      .eq("id", activeBook.id);
    updateActiveBook({ ...activeBook, status: "completed", progress: activeBook.pages, date_read: null });
    setMarkingRead(false);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3800);
    if (!activeBook.genre) setShowGenrePicker(true);
  };

  const saveProgress = async () => {
    if (!activeBook || !userId) return;
    const newPage = parseInt(progressDraft, 10);
    if (isNaN(newPage) || newPage < 0 || newPage > activeBook.pages) return;
    setSavingProgress(true);

    await supabase.from("books").update({ progress: newPage }).eq("id", activeBook.id);

    // Met aussi à jour le dernier log pour rester cohérent avec le journal
    const { data: latestLog } = await supabase
      .from("reading_logs")
      .select("id, end_page, pages_read")
      .eq("user_id", userId)
      .eq("book_id", activeBook.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (latestLog?.[0]) {
      const delta = newPage - latestLog[0].end_page;
      await supabase.from("reading_logs").update({
        end_page: newPage,
        pages_read: Math.max(0, latestLog[0].pages_read + delta),
      }).eq("id", latestLog[0].id);
    }

    updateActiveBook({ ...activeBook, progress: newPage });
    setSavingProgress(false);
    setEditingProgress(false);
  };

  const saveGenre = async (genre: string) => {
    if (!activeBook || savingGenre) return;
    setSavingGenre(true);
    await supabase.from("books").update({ genre }).eq("id", activeBook.id);
    updateActiveBook({ ...activeBook, genre });
    setSavingGenre(false);
    setShowGenrePicker(false);
  };

  const saveGenreMulti = async () => {
    if (!activeBook || savingGenreEdit) return;
    setSavingGenreEdit(true);
    const genre = genreSelection.length > 0 ? genreSelection.join(", ") : null;
    await supabase.from("books").update({ genre }).eq("id", activeBook.id);
    updateActiveBook({ ...activeBook, genre });
    setSavingGenreEdit(false);
    setEditingGenre(false);
  };

  const addRelecture = async () => {
    if (!activeBook || !userId || !relectureDraft.date_read || savingRelecture) return;
    setSavingRelecture(true);
    const newSession = {
      book_id: activeBook.id,
      user_id: userId,
      date_started: relectureDraft.date_started || null,
      date_read: relectureDraft.date_read,
    };
    await supabase.from("book_read_sessions").insert(newSession);
    await supabase.from("books").update({ date_read: relectureDraft.date_read }).eq("id", activeBook.id);
    updateActiveBook({ ...activeBook, date_read: relectureDraft.date_read });
    setSavingRelecture(false);
    setAddingRelecture(false);
    setRelectureDraft({ date_started: "", date_read: "" });
    load();
  };

  // Groupement par jour : pages cumulées, toutes les notes/photos du jour conservées
  const groupedLogs = (() => {
    const map = new Map<string, ReadingLog & { extraNotes: string[]; extraPhotos: string[] }>();
    [...logs]
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
      .forEach((log) => {
        if (!map.has(log.date)) {
          map.set(log.date, {
            ...log,
            extraNotes: log.session_notes ? [log.session_notes] : [],
            extraPhotos: log.session_photo_url ? [log.session_photo_url] : [],
          });
        } else {
          const e = map.get(log.date)!;
          e.pages_read += log.pages_read;
          e.end_page = Math.max(e.end_page, log.end_page);
          if (log.session_notes) e.extraNotes.push(log.session_notes);
          if (log.session_photo_url) e.extraPhotos.push(log.session_photo_url);
        }
      });
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  })();

  // activeBook = copie de l'user (myBook si navigué depuis un autre profil, book sinon)
  const activeBook = myBook ?? (book?.user_id === userId ? book : null);

  // Met à jour la bonne entrée selon le contexte (own copy vs direct ownership)
  const updateActiveBook = (updated: Book) => {
    if (myBook) setMyBook(updated);
    else setBook(updated);
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-xs font-medium uppercase tracking-wider text-muted">
        Chargement…
      </div>
    );
  }
  if (!book) {
    return (
      <div className="py-24 text-center">
        <p className="font-serif text-lg text-ink">Livre introuvable.</p>
        <Button variant="ghost" onClick={() => router.push("/bibliotheque")} className="mt-4">
          Retour à la bibliothèque
        </Button>
      </div>
    );
  }

  const isOwner = !!activeBook;
  const canEdit = isOwner || isAdmin;
  const p = activeBook ? pct(activeBook) : 0;
  const done = activeBook ? isCompleted(activeBook) : false;
  const abandoned = activeBook ? isAbandoned(activeBook) : false;
  const stats = activeBook ? readingStats(activeBook, logs) : { startDate: null, endDate: null, durationDays: null, pagesPerDay: null };
  const rating = activeBook?.rating || 0;

  // Note moyenne du club (tous lecteurs ayant noté, y compris soi-même)
  const ratedInClub = memberActivity.filter((m) => (m.rating ?? 0) > 0);
  const allClubRatings = [
    ...ratedInClub.map((m) => m.rating!),
    ...(rating > 0 ? [rating] : []),
  ];
  const clubRaterCount = allClubRatings.length;
  const clubAvgRating =
    clubRaterCount > 0
      ? allClubRatings.reduce((s, r) => s + r, 0) / clubRaterCount
      : 0;

  return (
    <div className="animate-fadeIn -mx-5 md:-mx-10">
      {showConfetti && <Confetti />}

      {/* En-tête */}
      <div className="flex flex-col items-center gap-4 bg-violet-soft px-5 pb-7 pt-4 md:rounded-3xl md:px-10">
        <div className="flex w-full items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-card text-lg text-ink"
            aria-label="Retour"
          >
            ‹
          </button>
          <div className="flex items-center gap-2">
            {isOwner && !done && !abandoned && (
              <>
                <button
                  onClick={markAsReadNoDate}
                  disabled={markingRead}
                  className="flex h-9 items-center justify-center rounded-xl border border-[#cfe0cf] dark:border-success/30 bg-[#eaf1ea] dark:bg-[#162516] px-3 text-xs font-semibold text-success"
                >
                  {markingRead ? "…" : "✓ Lu"}
                </button>
                <button
                  onClick={abandon}
                  className="flex h-9 items-center justify-center rounded-xl border border-line bg-card px-3 text-xs font-medium text-muted"
                >
                  Abandonner
                </button>
              </>
            )}
            {isOwner && abandoned && (
              <span className="rounded-xl border border-[#e7c7bd] dark:border-danger/30 bg-[#f6e7e1] dark:bg-[#2a1510] px-3 py-1.5 text-xs font-semibold text-danger">
                Abandonné
              </span>
            )}
            {isOwner && (
              <button
                onClick={remove}
                className="flex h-9 items-center justify-center rounded-xl border border-line bg-card px-3 text-xs font-medium text-danger"
              >
                Supprimer
              </button>
            )}
            {!isOwner && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={quickAddWishlist}
                  title="Envie de lire"
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                    wishlistAdded
                      ? "border-violet bg-violet text-cream"
                      : "border-violet/40 bg-violet-soft text-violet-deep hover:bg-violet hover:text-cream"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={wishlistAdded ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
                  </svg>
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-violet/40 bg-violet-soft px-3 text-xs font-semibold text-violet-deep transition-colors hover:bg-violet hover:text-cream"
                >
                  + Ajouter
                </button>
              </div>
            )}
          </div>
        </div>

        <Cover
          id={book.id}
          title={book.title}
          coverUrl={book.cover_url}
          className="h-[205px] w-[140px]"
          rounded="rounded-lg"
        />

        {canEdit && editingInfo ? (
          <div className="flex w-full max-w-sm flex-col gap-2">
            {/* Couverture : aperçu + bouton picker */}
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <Cover
                  id={0}
                  title={infoDraft.title || book.title}
                  coverUrl={infoDraft.coverUrl || null}
                  className="h-[80px] w-[55px]"
                  rounded="rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowCoverPickerEdit(true)}
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-violet text-[11px] text-cream shadow-md"
                  title="Choisir une couverture"
                >
                  ✎
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[10.5px] font-medium text-muted">
                  URL couverture (ou utilise ✎)
                </p>
                <input
                  value={infoDraft.coverUrl}
                  onChange={(e) => setInfoDraft({ ...infoDraft, coverUrl: e.target.value })}
                  placeholder="https://…"
                  className="w-full rounded-xl border border-line bg-input px-3 py-2 text-xs text-ink outline-none focus:border-violet"
                />
              </div>
            </div>
            <input
              value={infoDraft.title}
              onChange={(e) => setInfoDraft({ ...infoDraft, title: e.target.value })}
              placeholder="Titre"
              className="w-full rounded-xl border border-line bg-input px-3 py-2 text-xs text-ink outline-none focus:border-violet"
              autoFocus
            />
            <input
              value={infoDraft.author}
              onChange={(e) => setInfoDraft({ ...infoDraft, author: e.target.value })}
              placeholder="Auteur"
              className="w-full rounded-xl border border-line bg-input px-3 py-2 text-xs text-ink outline-none focus:border-violet"
            />
            <input
              value={infoDraft.year}
              onChange={(e) => setInfoDraft({ ...infoDraft, year: e.target.value })}
              placeholder="Année (ex. 2021)"
              type="number"
              className="w-full rounded-xl border border-line bg-input px-3 py-2 text-xs text-ink outline-none focus:border-violet"
            />
            <textarea
              value={infoDraft.summary}
              onChange={(e) => setInfoDraft({ ...infoDraft, summary: e.target.value })}
              placeholder="Résumé…"
              rows={3}
              className="w-full rounded-xl border border-line bg-input px-3 py-2 text-xs text-ink outline-none focus:border-violet"
            />
            {isAdmin && !isOwner && (
              <p className="rounded-xl bg-violet-soft px-3 py-2 text-[10.5px] font-medium text-violet-deep">
                ⚡ Mode admin — les modifications s&apos;appliquent à toutes les copies
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={saveInfo} className="flex-1 py-2">Enregistrer</Button>
              <Button variant="ghost" onClick={() => setEditingInfo(false)} className="flex-1 py-2">Annuler</Button>
            </div>
          </div>
        ) : canEdit ? (
          <button
            onClick={() => setEditingInfo(true)}
            className="text-xs font-medium text-violet-deep underline decoration-violet/40 underline-offset-2"
          >
            Modifier les informations
          </button>
        ) : null}

        <div className="text-center">
          <h1 className="font-serif text-2xl font-black text-ink">{book.title}</h1>
          <p className="mt-0.5 text-sm text-ink-2">{book.author}</p>
          {clubRaterCount > 0 && (
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <span className="text-gold text-base leading-none">★</span>
              <span className="font-serif text-[15px] font-bold text-ink">
                {clubAvgRating.toFixed(1).replace(".", ",")}
              </span>
              <span className="text-xs text-muted">/ 5</span>
              <span className="text-[11px] text-muted">
                ({clubRaterCount} lecteur{clubRaterCount > 1 ? "s" : ""})
              </span>
            </div>
          )}
        </div>

        {isOwner && (
          <div className="flex flex-col items-center gap-2.5">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setRating(s)} className="text-2xl leading-none">
                  <span style={{ color: s <= Math.round(rating) ? "var(--color-gold)" : "#dad2c2" }}>★</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRating(Math.max(0, Math.round((rating - 0.1) * 10) / 10))}
                className="flex h-8 w-9 items-center justify-center rounded-lg border border-line bg-card text-xs font-bold text-ink"
              >
                −0,1
              </button>
              <span className="min-w-[58px] rounded-lg border border-line bg-card py-1.5 text-center text-sm font-bold text-ink">
                {rating > 0 ? rating.toFixed(1).replace(".", ",") : "—"}{" "}
                <span className="text-xs font-medium text-muted">/ 5</span>
              </span>
              <button
                onClick={() => setRating(Math.min(5, Math.round((rating + 0.1) * 10) / 10))}
                className="flex h-8 w-9 items-center justify-center rounded-lg border border-line bg-card text-xs font-bold text-ink"
              >
                +0,1
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Corps */}
      <div className="flex flex-col gap-5 px-5 pt-5 md:px-10">
        <div className="flex flex-wrap items-center gap-2">
          {book.genre
            ? book.genre.split(", ").filter(Boolean).map((g) => (
                <Pill key={g} tone="sage">{g}</Pill>
              ))
            : null}
          <Pill tone="neutral">{book.pages} pages</Pill>
          {stats.durationDays != null && (
            <Pill tone="violet">Lu en {stats.durationDays} jour{stats.durationDays > 1 ? "s" : ""}</Pill>
          )}
          {book.published_year && <Pill tone="neutral">{book.published_year}</Pill>}
          {isOwner && (
            <button
              onClick={() => {
                setGenreSelection(activeBook!.genre?.split(", ").filter(Boolean) || []);
                setEditingGenre((v) => !v);
              }}
              className="rounded-full border border-dashed border-violet/40 px-2.5 py-0.5 text-[10.5px] font-medium text-muted transition-colors hover:border-violet hover:text-violet-deep"
            >
              {editingGenre ? "✕ Fermer" : activeBook!.genre ? "Modifier le genre" : "+ Genre"}
            </button>
          )}
        </div>

        {/* Panneau d'édition des genres (multi-sélection) */}
        {editingGenre && (
          <div className="rounded-2xl border border-violet/20 bg-violet-soft p-4 flex flex-col gap-3">
            <p className="text-[12.5px] font-medium text-ink-2">
              Sélectionne le ou les genres :
            </p>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => {
                const active = genreSelection.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() =>
                      setGenreSelection((prev) =>
                        active ? prev.filter((x) => x !== g) : [...prev, g]
                      )
                    }
                    className={`rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                      active
                        ? "border-violet bg-violet text-cream"
                        : "border-line bg-input text-ink hover:border-violet/40 hover:text-violet-deep"
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditingGenre(false)} className="flex-1 py-2 text-sm">
                Annuler
              </Button>
              <Button onClick={saveGenreMulti} disabled={savingGenreEdit} className="flex-1 py-2 text-sm">
                {savingGenreEdit ? "…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        )}

        {/* Ma lecture — visible uniquement par le propriétaire */}
        {isOwner && (
        <div className="flex flex-col gap-3.5 rounded-2xl border border-line bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-[15px] font-medium text-ink">Ma lecture</h2>
            {isOwner && (
              <button onClick={() => setShowLog(true)} className="text-xs font-medium text-violet-deep">
                Noter une session
              </button>
            )}
          </div>
          <div className="flex justify-between">
            <Stat label="Commencé" value={formatDate(stats.startDate)} />
            <Stat label={done ? "Terminé" : "Dernière"} value={formatDate(stats.endDate)} />
            <Stat label="Durée" value={stats.durationDays ? `${stats.durationDays} j` : "—"} accent="text-violet-deep" />
            <Stat label="Rythme" value={stats.pagesPerDay ? `${stats.pagesPerDay} p./j` : "—"} accent="text-sage" />
          </div>
          <ProgressBar value={p / 100} color={done ? "var(--color-success)" : "var(--color-violet)"} />

          {editingProgress ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={activeBook!.pages}
                value={progressDraft}
                onChange={(e) => setProgressDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveProgress(); if (e.key === "Escape") setEditingProgress(false); }}
                autoFocus
                className="w-20 rounded-lg border border-violet bg-input px-2 py-1 text-center text-sm font-bold text-ink outline-none"
              />
              <span className="text-[11px] text-muted">/ {activeBook!.pages} pages</span>
              <button
                onClick={saveProgress}
                disabled={savingProgress}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-violet text-[11px] font-bold text-cream disabled:opacity-60"
              >
                ✓
              </button>
              <button
                onClick={() => setEditingProgress(false)}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-[11px] text-muted"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className={`text-[11px] font-medium ${done ? "text-success" : "text-muted"}`}>
                {done ? "Terminé · " : ""}
                {activeBook!.progress} / {activeBook!.pages} pages
              </p>
              {!done && (
                <button
                  onClick={() => { setProgressDraft(String(activeBook!.progress)); setEditingProgress(true); }}
                  title="Corriger la page"
                  className="flex h-5 w-5 items-center justify-center rounded-full text-muted transition-colors hover:bg-violet-soft hover:text-violet-deep"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Historique des relectures */}
          {done && (activeBook!.date_started || activeBook!.date_read || readSessions.length > 0) && (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Historique des lectures
              </p>
              {/* Session originale */}
              <div className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet text-[9px] font-bold text-cream">1</span>
                <div className="min-w-0 flex-1">
                  {activeBook!.date_started && (
                    <span className="text-[11px] text-muted">
                      {formatDate(activeBook!.date_started)} →{" "}
                    </span>
                  )}
                  <span className="text-[11.5px] font-medium text-ink">
                    {activeBook!.date_read ? formatDate(activeBook!.date_read) : "Date inconnue"}
                  </span>
                  {activeBook!.import_source === "goodreads" && (
                    <span className="ml-1.5 rounded-md bg-[#f4f0e8] dark:bg-card px-1.5 py-0.5 text-[9.5px] font-medium text-muted">
                      Goodreads
                    </span>
                  )}
                </div>
              </div>
              {/* Sessions supplémentaires */}
              {readSessions.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet text-[9px] font-bold text-cream">
                    {i + 2}
                  </span>
                  <div className="min-w-0 flex-1">
                    {s.date_started && (
                      <span className="text-[11px] text-muted">
                        {formatDate(s.date_started)} →{" "}
                      </span>
                    )}
                    <span className="text-[11.5px] font-medium text-ink">
                      {formatDate(s.date_read)}
                    </span>
                    <span className="ml-1.5 rounded-md bg-violet-soft px-1.5 py-0.5 text-[9.5px] font-medium text-violet-deep">
                      Relecture
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bouton Relire + formulaire inline */}
          {isOwner && done && (
            <div className="border-t border-line pt-3">
              {!addingRelecture ? (
                <button
                  onClick={() => setAddingRelecture(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-violet/30 bg-violet-soft py-2.5 text-[12px] font-semibold text-violet-deep transition-colors hover:border-violet/60"
                >
                  ↺ Relire ce livre
                </button>
              ) : (
                <div className="flex flex-col gap-3 rounded-2xl border border-violet/20 bg-violet-soft p-3.5">
                  <p className="text-[12.5px] font-semibold text-ink">Nouvelle période de lecture</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-1 text-[10.5px] font-medium text-muted">Début (optionnel)</p>
                      <input
                        type="date"
                        value={relectureDraft.date_started}
                        onChange={(e) => setRelectureDraft({ ...relectureDraft, date_started: e.target.value })}
                        className="w-full rounded-xl border border-line bg-input px-3 py-2 text-sm text-ink outline-none focus:border-violet"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-[10.5px] font-medium text-muted">Fin (requis)</p>
                      <input
                        type="date"
                        value={relectureDraft.date_read}
                        onChange={(e) => setRelectureDraft({ ...relectureDraft, date_read: e.target.value })}
                        className="w-full rounded-xl border border-line bg-input px-3 py-2 text-sm text-ink outline-none focus:border-violet"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => { setAddingRelecture(false); setRelectureDraft({ date_started: "", date_read: "" }); }} className="flex-1 py-2 text-sm">
                      Annuler
                    </Button>
                    <Button onClick={addRelecture} disabled={savingRelecture || !relectureDraft.date_read} className="flex-1 py-2 text-sm">
                      {savingRelecture ? "…" : "Enregistrer"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* Activité des membres (style Letterboxd) */}
        {memberActivity.length > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
            <h2 className="font-serif text-[15px] font-medium text-ink">
              Activité des membres{" "}
              <span className="font-sans text-xs font-normal text-muted">({memberActivity.length})</span>
            </h2>
            <div className="flex flex-wrap gap-4">
              {memberActivity.map((m) => (
                <button
                  key={m.userId}
                  onClick={() => setSelectedMember(m)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <AvatarImg
                    url={m.avatarUrl}
                    name={m.displayName}
                    className={`h-11 w-11 text-xs font-semibold ring-2 ring-offset-1 ${
                      m.status === "completed" ? "ring-success/60" : "ring-violet/40"
                    }`}
                  />
                  <span className="max-w-[56px] truncate text-[10px] font-medium text-muted">
                    {m.displayName.split(" ")[0]}
                  </span>
                  {(m.rating ?? 0) > 0 && (
                    <span className="text-[10px] font-semibold text-gold">
                      {"★".repeat(Math.round(m.rating!))}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Résumé */}
        {book.summary && (
          <div className="flex flex-col gap-2">
            <h2 className="font-serif text-[15px] font-medium text-ink">Résumé</h2>
            <p className="text-[13px] leading-relaxed text-ink-2">{book.summary}</p>
            <p className="text-[10.5px] text-muted">Source : Google Books</p>
          </div>
        )}

        {/* Ma review (visible uniquement par le propriétaire) */}
        {isOwner && <div className="flex flex-col gap-2 rounded-2xl border border-[#e4c97e]/50 dark:border-[#5a3d0a]/50 bg-[#fdf7e9] dark:bg-[#2a2210] p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-[15px] font-medium text-ink">Ma review</h2>
            {!editingNotes && (
              <button onClick={() => setEditingNotes(true)} className="text-xs font-medium text-[#8a6400] dark:text-[#e0b83d]">
                {activeBook!.notes ? "Modifier" : "Ajouter"}
              </button>
            )}
          </div>
          {editingNotes ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={4}
                placeholder="Ta critique globale du livre, tes citations préférées… (visible par les membres du club)"
                className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-sm text-ink outline-none focus:border-violet"
                autoFocus
              />
              <div className="flex gap-2">
                <Button onClick={saveNotes} className="px-4 py-2">Enregistrer</Button>
                <Button
                  variant="ghost"
                  onClick={() => { setNotesDraft(activeBook!.notes || ""); setEditingNotes(false); }}
                  className="px-4 py-2"
                >
                  Annuler
                </Button>
              </div>
            </div>
          ) : activeBook!.notes ? (
            <p className="font-serif text-[13.5px] italic leading-relaxed text-ink-2" style={{ whiteSpace: "pre-line" }}>
              « {activeBook!.notes} »
            </p>
          ) : (
            <p className="text-[13px] text-ink-2">Aucune review pour le moment.</p>
          )}
        </div>}

        {/* Sessions de lecture — individuelles */}
        {groupedLogs.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="font-serif text-[15px] font-medium text-ink">
              Mes sessions{" "}
              <span className="font-sans text-xs font-normal text-muted">
                ({logs.length})
              </span>
            </h2>
            {groupedLogs.map((log) => (
              <div
                key={log.date}
                className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3.5"
              >
                <div className="flex flex-1 flex-col gap-2.5">
                  <p className="text-[12px] font-medium capitalize text-muted">
                    {formatDateLong(log.date)}
                  </p>
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-xl bg-violet-soft px-3 py-2">
                      <p className="text-[9px] font-medium uppercase tracking-wide text-violet-deep">
                        Lu ce jour
                      </p>
                      <p className="font-serif text-base font-black text-violet-deep">+{log.pages_read}</p>
                    </div>
                    <div className="flex-1 rounded-xl bg-input px-3 py-2">
                      <p className="text-[9px] font-medium uppercase tracking-wide text-ink-2">Arrêté p.</p>
                      <p className="font-serif text-base font-black text-ink">{log.end_page}</p>
                    </div>
                  </div>
                  {log.extraNotes.map((note, ni) => (
                    <p key={ni} className="rounded-xl bg-violet-soft px-3 py-2 font-serif text-[12.5px] italic leading-relaxed text-ink" style={{ whiteSpace: "pre-line" }}>
                      « {note} »
                    </p>
                  ))}
                  {log.extraPhotos.map((url, pi) => (
                    <a key={pi} href={url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="Photo de session" className="h-36 w-full rounded-xl object-cover" />
                    </a>
                  ))}
                </div>
                <button
                  onClick={() => {
                    logs.filter((l) => l.date === log.date).forEach((l) => deleteLog(l.id));
                  }}
                  className="ml-1 shrink-0 self-start text-muted hover:text-danger"
                  aria-label="Supprimer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {isOwner && <LogReadingModal
        open={showLog}
        onClose={() => setShowLog(false)}
        books={[book]}
        defaultBookId={book.id}
        onSaved={(msg) => {
          load();
          if (msg.includes("terminé")) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3800);
            if (!book.genre) setTimeout(() => setShowGenrePicker(true), 700);
          }
        }}
      />}

      {!isOwner && (
        <AddToLibraryModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          book={{ title: book.title, author: book.author, pages: book.pages, cover_url: book.cover_url, genre: book.genre, published_year: book.published_year, summary: book.summary }}
          onAdded={(msg) => { setAddedMsg(msg); setTimeout(() => setAddedMsg(null), 4000); }}
        />
      )}

      {addedMsg && (
        <div className="fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 rounded-2xl bg-ink px-4 py-2.5 text-sm font-medium text-cream shadow-xl">
          {addedMsg}
        </div>
      )}

      {showCoverPickerEdit && (
        <CoverPickerModal
          title={infoDraft.title || book.title}
          author={infoDraft.author || book.author}
          currentCover={infoDraft.coverUrl || null}
          onPick={(url) => {
            setInfoDraft((d) => ({ ...d, coverUrl: url }));
            setShowCoverPickerEdit(false);
          }}
          onClose={() => setShowCoverPickerEdit(false)}
        />
      )}

      {/* Modale review d'un membre */}
      {selectedMember && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="animate-slideUp w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-4 max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête membre */}
            <div className="flex items-center gap-3">
              <Link href={`/membre/${selectedMember.userId}`} onClick={() => setSelectedMember(null)}>
                <AvatarImg url={selectedMember.avatarUrl} name={selectedMember.displayName} className="h-11 w-11 text-xs font-semibold" />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{selectedMember.displayName}</p>
                <p className="text-[11px] text-muted">
                  {selectedMember.status === "completed" ? "A terminé ce livre" : "En cours de lecture"}
                </p>
              </div>
              {(selectedMember.rating ?? 0) > 0 && (
                <div className="shrink-0 text-right">
                  <p className="text-base text-gold">{"★".repeat(Math.round(selectedMember.rating!))}</p>
                  <p className="text-xs font-semibold text-ink">{selectedMember.rating!.toFixed(1).replace(".", ",")} /5</p>
                </div>
              )}
            </div>

            {/* Review globale — bloc ambre */}
            <div className="rounded-xl border border-[#e4c97e]/50 dark:border-[#5a3d0a]/50 bg-[#fdf7e9] dark:bg-[#2a2210] p-3.5">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8a6400] dark:text-[#e0b83d]">Review globale</p>
              {selectedMember.review ? (
                <>
                  <p className="font-serif text-[13.5px] italic leading-relaxed text-ink-2" style={{ whiteSpace: "pre-line" }}>
                    « {selectedMember.review} »
                  </p>
                  {selectedMember.userId !== userId && (
                    <button
                      onClick={toggleReviewLike}
                      disabled={likeLoading}
                      className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-colors ${
                        reviewLiked
                          ? "border-danger/30 bg-[#f6e7e1] dark:bg-[#2a1510] text-danger"
                          : "border-line bg-paper text-muted hover:border-danger/30 hover:text-danger"
                      }`}
                    >
                      <span className="text-sm">{reviewLiked ? "♥" : "♡"}</span>
                      {reviewLikeCount > 0 ? `${reviewLikeCount} j'aime` : "J'aime"}
                    </button>
                  )}
                </>
              ) : (
                <p className="text-[13px] italic text-ink-2">Pas encore de review pour ce livre.</p>
              )}
            </div>

            {/* Notes de session — bloc violet */}
            {selectedMemberSessionNotes.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Notes de session ({selectedMemberSessionNotes.length})
                </p>
                {selectedMemberSessionNotes.map((note, i) => (
                  <div key={i} className="rounded-xl bg-violet-soft p-3">
                    <p className="mb-1 text-[10px] font-medium text-muted">{formatDate(note.date)}</p>
                    <p className="font-serif text-[13px] italic leading-relaxed text-ink-2" style={{ whiteSpace: "pre-line" }}>
                      « {note.session_notes} »
                    </p>
                    {note.session_photo_url && (
                      <a href={note.session_photo_url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={note.session_photo_url} alt="" className="mt-2 h-32 w-full rounded-lg object-cover" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Button variant="ghost" onClick={() => setSelectedMember(null)} className="w-full py-2.5">
              Fermer
            </Button>
          </div>
        </div>
      )}

      {/* Sélecteur de genre post-complétion */}
      {showGenrePicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
          <div className="animate-slideUp w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-4">
            <div className="text-center">
              <p className="text-3xl">📚</p>
              <h3 className="mt-2 font-serif text-lg font-bold text-ink">Quel genre ?</h3>
              <p className="mt-0.5 text-xs text-muted">Aide à mieux organiser ta bibliothèque</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {GENRES.map((g) => (
                <button
                  key={g}
                  onClick={() => saveGenre(g)}
                  disabled={savingGenre}
                  className="rounded-full border border-line bg-input px-3.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-violet hover:bg-violet-soft disabled:opacity-50"
                >
                  {g}
                </button>
              ))}
            </div>
            <Button variant="ghost" onClick={() => setShowGenrePicker(false)} className="w-full py-2.5">
              Passer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent = "text-ink" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`font-serif text-[17px] font-semibold ${accent}`}>{value}</span>
      <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted">{label}</span>
    </div>
  );
}
