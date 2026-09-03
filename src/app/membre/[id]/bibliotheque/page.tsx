"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/auth-context";
import type { Book, ReadingLog } from "../../../../lib/types";
import { pct, isCompleted } from "../../../../lib/books";
import { Cover, ProgressBar } from "../../../../components/ui";
import AddToLibraryModal from "../../../../components/AddToLibraryModal";
import MemberSectionHeader from "../../../../components/MemberSectionHeader";
import { notifyUser } from "../../../../lib/push.client";

export default function MemberBibliothequePage() {
  const params = useParams();
  const { user } = useAuth();
  const memberId = params.id as string;
  const isOwn = user?.id === memberId;

  const [firstName, setFirstName] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "rating" | "title">("date");
  const [libLimit, setLibLimit] = useState(20);

  const [addTarget, setAddTarget] = useState<Book | null>(null);
  const [toast, setToast] = useState<string | null>(null);
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

  useEffect(() => {
    (async () => {
      const [{ data: prof }, { data: bs }, { data: ls }] = await Promise.all([
        supabase.from("user_profiles").select("display_name").eq("id", memberId).single(),
        supabase.from("books").select("*").eq("user_id", memberId),
        supabase.from("reading_logs").select("*").eq("user_id", memberId),
      ]);
      setFirstName(((prof as { display_name?: string } | null)?.display_name ?? "").split(" ")[0]);
      setBooks((bs as Book[]) || []);
      setLogs((ls as ReadingLog[]) || []);
      setLoading(false);
    })();
  }, [memberId]);

  useEffect(() => {
    if (!noteModal || !user?.id) { setNoteLiked(false); setNoteLikeCount(0); return; }
    (async () => {
      const [{ count }, { data: mine }] = await Promise.all([
        supabase.from("review_likes").select("*", { count: "exact", head: true })
          .eq("book_id", noteModal.bookId).eq("reviewer_user_id", noteModal.reviewerUserId),
        supabase.from("review_likes").select("id")
          .eq("book_id", noteModal.bookId).eq("reviewer_user_id", noteModal.reviewerUserId)
          .eq("liker_user_id", user.id).maybeSingle(),
      ]);
      setNoteLikeCount(count ?? 0);
      setNoteLiked(!!mine);
    })();
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
      const senderName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";
      notifyUser(
        noteModal.reviewerUserId,
        "Swena",
        `${senderName} a aimé ton activité sur «${noteModal.bookTitle || "ton livre"}»`,
        undefined,
        "likes",
      );
    }
    setNoteLikeLoading(false);
  };

  const reading = books.filter((b) => b.status === "reading");
  const completed = books.filter(isCompleted);
  const abandoned = books.filter((b) => b.status === "abandoned");
  const wantToRead = books.filter((b) => b.status === "to-read");

  const bookSessionNoteMap = new Map<number, string>();
  logs.forEach((l) => { if (l.session_notes) bookSessionNoteMap.set(l.book_id, l.session_notes); });

  const filteredBooks = useMemo(() => {
    const lastLogByBook = new Map<number, string>();
    logs.forEach((l) => {
      const existing = lastLogByBook.get(l.book_id);
      if (!existing || l.date > existing) lastLogByBook.set(l.book_id, l.date);
    });
    const recency = (b: Book) => lastLogByBook.get(b.id) || b.date_read || b.created_at || "";
    let filtered = books.filter((b) => {
      if (filterStatus === "all") return true;
      if (filterStatus === "reading") return b.status === "reading";
      if (filterStatus === "completed") return isCompleted(b);
      if (filterStatus === "abandoned") return b.status === "abandoned";
      if (filterStatus === "to-read") return b.status === "to-read";
      return true;
    });
    if (sortBy === "rating") filtered = [...filtered].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else if (sortBy === "title") filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title, "fr"));
    else filtered = [...filtered].sort((a, b) => recency(b).localeCompare(recency(a)));
    return filtered;
  }, [books, logs, filterStatus, sortBy]);

  return (
    <div className="animate-fadeIn flex flex-col gap-4 pt-4">
      <MemberSectionHeader memberId={memberId} firstName={firstName} title="Bibliothèque" />

      {loading ? (
        <div className="py-24 text-center text-xs font-medium uppercase tracking-wider text-muted">Chargement…</div>
      ) : (
        <>
          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { id: "all", label: `Tout (${books.length})` },
              { id: "reading", label: `En cours (${reading.length})` },
              { id: "completed", label: `Terminés (${completed.length})` },
              { id: "abandoned", label: `Abandonnés (${abandoned.length})` },
              { id: "to-read", label: `À lire (${wantToRead.length})` },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { setFilterStatus(id); setLibLimit(20); }}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  filterStatus === id
                    ? "bg-violet text-cream"
                    : "border border-line bg-card text-muted hover:border-violet/30 hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sort row */}
          <div className="flex items-center justify-end gap-1">
            <span className="mr-1 text-[11px] text-muted">Trier :</span>
            {([
              { id: "date", label: "Date" },
              { id: "rating", label: "Note" },
              { id: "title", label: "Titre" },
            ] as const).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSortBy(id)}
                className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                  sortBy === id ? "bg-violet-soft text-violet-deep" : "text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filteredBooks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
              <p className="font-serif text-base text-ink">Aucun livre dans cette catégorie.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {filteredBooks.slice(0, libLimit).map((b) => {
                  const hasReview = !!b.notes;
                  const sessionNote = bookSessionNoteMap.get(b.id) ?? null;
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
                          {b.status === "reading" && (
                            <div className="mt-1">
                              <ProgressBar value={pct(b) / 100} />
                              <p className="mt-0.5 text-[9.5px] font-medium text-muted">{pct(b)}%</p>
                            </div>
                          )}
                          {isCompleted(b) && (
                            (b.rating ?? 0) > 0
                              ? <p className="mt-1 text-[10.5px] font-medium text-gold">{"★".repeat(Math.round(b.rating!))} {b.rating!.toFixed(1).replace(".", ",")}</p>
                              : <p className="mt-1 text-[9.5px] font-medium text-success">✓ Terminé</p>
                          )}
                          {b.status === "abandoned" && (
                            <span className="mt-1.5 inline-block rounded-md bg-paper px-2 py-0.5 text-[10.5px] font-medium text-muted">Abandonné</span>
                          )}
                          {b.status === "to-read" && (
                            <span className="mt-1.5 inline-block rounded-md bg-violet-soft px-2 py-0.5 text-[10px] font-medium text-violet-deep">À lire</span>
                          )}
                          {(hasReview || sessionNote) && (
                            <div className="mt-1 flex gap-1">
                              {hasReview && (
                                <button
                                  onClick={(e) => { e.preventDefault(); setNoteModal({ type: "review", text: b.notes!, bookTitle: b.title, bookId: b.id, reviewerUserId: memberId }); }}
                                  className="flex h-[16px] w-[16px] items-center justify-center rounded bg-[#e4c97e] text-[8px] font-bold text-[#7a5c00]"
                                >≡</button>
                              )}
                              {sessionNote && (
                                <button
                                  onClick={(e) => { e.preventDefault(); setNoteModal({ type: "session", text: sessionNote, bookTitle: b.title, bookId: b.id, reviewerUserId: memberId }); }}
                                  className="flex h-[16px] w-[16px] items-center justify-center rounded bg-violet-soft text-[8px] font-bold text-violet-deep"
                                >≡</button>
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
              {libLimit < filteredBooks.length && (
                <button
                  onClick={() => setLibLimit((n) => n + 20)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet py-2.5 text-[12.5px] font-semibold text-cream"
                >
                  Voir plus · {Math.min(20, filteredBooks.length - libLimit)} de plus
                </button>
              )}
            </>
          )}

          {isOwn && (
            <Link
              href="/bibliotheque"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet/40 bg-violet-soft py-3 text-[13px] font-semibold text-violet-deep transition-colors hover:border-violet"
            >
              Voir toute la bibliothèque →
            </Link>
          )}
        </>
      )}

      {/* Note / review modal */}
      {noteModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 pt-4 pb-24 [touch-action:none]"
          onClick={() => setNoteModal(null)}
        >
          <div
            className="animate-slideUp w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-3 max-h-[75dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                noteModal.type === "review"
                  ? "bg-amber-soft text-amber-label"
                  : "bg-violet-soft text-violet-deep"
              }`}>
                {noteModal.type === "review" ? "Review globale" : "Note de session"}
              </span>
              {noteModal.bookTitle && (
                <p className="text-[11px] font-semibold text-ink truncate max-w-[55%] text-right">{noteModal.bookTitle}</p>
              )}
            </div>
            <div
              className="font-serif text-[14px] leading-relaxed text-ink prose-review"
              style={{ whiteSpace: "pre-line" }}
              dangerouslySetInnerHTML={noteModal.text?.startsWith("<") ? { __html: noteModal.text } : undefined}
            >
              {!noteModal.text?.startsWith("<") ? noteModal.text : undefined}
            </div>
            {noteModal.reviewerUserId !== user?.id && (
              <button
                onClick={toggleNoteLike}
                disabled={noteLikeLoading}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12px] font-semibold transition-colors disabled:opacity-50 ${
                  noteLiked
                    ? "border-danger/30 bg-danger-soft text-danger"
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

      {/* Add to library */}
      <AddToLibraryModal
        open={addTarget !== null}
        onClose={() => setAddTarget(null)}
        book={addTarget}
        onAdded={(msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); }}
      />

      {toast && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] left-1/2 z-[70] -translate-x-1/2 rounded-2xl border border-[#a78bfa]/45 bg-[#252131] px-4 py-2.5 text-sm font-medium text-[#fdfbf7] shadow-[0_8px_28px_rgba(0,0,0,0.4)] md:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
