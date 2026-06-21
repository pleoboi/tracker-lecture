"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import type { Book, ReadingLog } from "../../../lib/types";
import { pct, isCompleted, isAbandoned, readingStats, formatDate, formatDateLong } from "../../../lib/books";
import { Cover, ProgressBar, Pill, Button, AvatarImg } from "../../../components/ui";
import LogReadingModal from "../../../components/LogReadingModal";

const GENRES = [
  "Roman", "Thriller", "Policier", "Fantasy", "Science-Fiction",
  "Histoire", "Biographie", "Jeunesse", "BD / Roman graphique",
  "Développement personnel", "Philosophie", "Poésie",
  "Économie", "Science", "Sciences humaines",
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

  // Confetti + genre picker
  const [showConfetti, setShowConfetti] = useState(false);
  const [showGenrePicker, setShowGenrePicker] = useState(false);
  const [savingGenre, setSavingGenre] = useState(false);

  // Mark as read (no date)
  const [markingRead, setMarkingRead] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const [{ data: b }, { data: l }] = await Promise.all([
      supabase.from("books").select("*").eq("id", id).single(),
      supabase
        .from("reading_logs")
        .select("*")
        .eq("book_id", id)
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
    setBook(b as Book);
    setLogs((l as ReadingLog[]) || []);
    const loaded = b as Book;
    setNotesDraft(loaded?.notes || "");
    if (loaded) {
      setInfoDraft({
        title: loaded.title,
        author: loaded.author,
        year: loaded.published_year ? String(loaded.published_year) : "",
        summary: loaded.summary || "",
        coverUrl: loaded.cover_url || "",
      });
    }

    // Fetch other members who have this book (by title match)
    if (loaded) {
      const { data: otherBooks } = await supabase
        .from("books")
        .select("user_id, rating, notes, status")
        .ilike("title", `%${loaded.title.replace(/[%_]/g, "\\$&")}%`)
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
    }

    setLoading(false);
  }, [id, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const setRating = async (value: number) => {
    if (!book) return;
    setBook({ ...book, rating: value });
    await supabase.from("books").update({ rating: value }).eq("id", book.id);
  };

  const saveNotes = async () => {
    if (!book) return;
    await supabase.from("books").update({ notes: notesDraft }).eq("id", book.id);
    setBook({ ...book, notes: notesDraft });
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
    await supabase.from("books").update(update).eq("id", book.id);
    setBook({ ...book, ...update });
    setEditingInfo(false);
  };

  const deleteLog = async (logId: number) => {
    await supabase.from("reading_logs").delete().eq("id", logId);
    load();
  };

  const abandon = async () => {
    if (!book) return;
    if (!confirm(`Marquer « ${book.title} » comme abandonné ?`)) return;
    await supabase.from("books").update({ status: "abandoned" }).eq("id", book.id);
    router.push("/");
  };

  const remove = async () => {
    if (!book) return;
    if (!confirm(`Supprimer « ${book.title} » et son historique ?`)) return;
    await supabase.from("reading_logs").delete().eq("book_id", book.id);
    await supabase.from("books").delete().eq("id", book.id);
    router.push("/bibliotheque");
  };

  // Marquer comme lu sans date (ne comptabilise pas dans les graphiques annuels)
  const markAsReadNoDate = async () => {
    if (!book || markingRead) return;
    setMarkingRead(true);
    await supabase
      .from("books")
      .update({ status: "completed", progress: book.pages, date_read: null })
      .eq("id", book.id);
    const updated = { ...book, status: "completed", progress: book.pages, date_read: null };
    setBook(updated);
    setMarkingRead(false);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3800);
    if (!book.genre) setShowGenrePicker(true);
  };

  const saveGenre = async (genre: string) => {
    if (!book || savingGenre) return;
    setSavingGenre(true);
    await supabase.from("books").update({ genre }).eq("id", book.id);
    setBook({ ...book, genre });
    setSavingGenre(false);
    setShowGenrePicker(false);
  };

  // Groupement des logs par jour
  const groupedLogs = (() => {
    const map = new Map<string, ReadingLog>();
    [...logs].reverse().forEach((log) => {
      const key = log.date;
      if (!map.has(key)) {
        map.set(key, { ...log });
      } else {
        const existing = map.get(key)!;
        existing.pages_read += log.pages_read;
        existing.end_page = Math.max(existing.end_page, log.end_page);
        if (!existing.session_notes && log.session_notes) existing.session_notes = log.session_notes;
        if (!existing.session_photo_url && log.session_photo_url) existing.session_photo_url = log.session_photo_url;
      }
    });
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  })();

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

  const isOwner = book.user_id === userId;
  const p = pct(book);
  const done = isCompleted(book);
  const abandoned = isAbandoned(book);
  const stats = readingStats(book, logs);
  const rating = book.rating || 0;

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
                  className="flex h-9 items-center justify-center rounded-xl border border-[#cfe0cf] bg-[#eaf1ea] px-3 text-xs font-semibold text-success"
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
              <span className="rounded-xl border border-[#e7c7bd] bg-[#f6e7e1] px-3 py-1.5 text-xs font-semibold text-danger">
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
          </div>
        </div>

        <Cover
          id={book.id}
          title={book.title}
          coverUrl={book.cover_url}
          className="h-[205px] w-[140px]"
          rounded="rounded-lg"
        />

        {isOwner && editingInfo ? (
          <div className="flex w-full max-w-sm flex-col gap-2">
            <input
              value={infoDraft.coverUrl}
              onChange={(e) => setInfoDraft({ ...infoDraft, coverUrl: e.target.value })}
              placeholder="URL couverture (https://…)"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-xs text-ink outline-none focus:border-violet"
              autoFocus
            />
            <input
              value={infoDraft.title}
              onChange={(e) => setInfoDraft({ ...infoDraft, title: e.target.value })}
              placeholder="Titre"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-xs text-ink outline-none focus:border-violet"
            />
            <input
              value={infoDraft.author}
              onChange={(e) => setInfoDraft({ ...infoDraft, author: e.target.value })}
              placeholder="Auteur"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-xs text-ink outline-none focus:border-violet"
            />
            <input
              value={infoDraft.year}
              onChange={(e) => setInfoDraft({ ...infoDraft, year: e.target.value })}
              placeholder="Année (ex. 2021)"
              type="number"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-xs text-ink outline-none focus:border-violet"
            />
            <textarea
              value={infoDraft.summary}
              onChange={(e) => setInfoDraft({ ...infoDraft, summary: e.target.value })}
              placeholder="Résumé…"
              rows={3}
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-xs text-ink outline-none focus:border-violet"
            />
            <div className="flex gap-2">
              <Button onClick={saveInfo} className="flex-1 py-2">Enregistrer</Button>
              <Button variant="ghost" onClick={() => setEditingInfo(false)} className="flex-1 py-2">Annuler</Button>
            </div>
          </div>
        ) : isOwner ? (
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
        </div>

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
      </div>

      {/* Corps */}
      <div className="flex flex-col gap-5 px-5 pt-5 md:px-10">
        <div className="flex flex-wrap gap-2">
          {book.genre && <Pill tone="sage">{book.genre}</Pill>}
          <Pill tone="neutral">{book.pages} pages</Pill>
          {stats.durationDays != null && (
            <Pill tone="violet">Lu en {stats.durationDays} jour{stats.durationDays > 1 ? "s" : ""}</Pill>
          )}
          {book.published_year && <Pill tone="neutral">{book.published_year}</Pill>}
        </div>

        {/* Ma lecture */}
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
          <p className={`text-[11px] font-medium ${done ? "text-success" : "text-muted"}`}>
            {done ? "Terminé · " : ""}
            {book.progress} / {book.pages} pages
          </p>
        </div>

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

        {/* Mes notes (visible uniquement par le propriétaire) */}
        {isOwner && <div className="flex flex-col gap-2 rounded-2xl border border-[#e4daef] bg-[#f2ecf6] p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-[15px] font-medium text-ink">Mes notes</h2>
            {!editingNotes && (
              <button onClick={() => setEditingNotes(true)} className="text-xs font-medium text-violet-deep">
                {book.notes ? "Modifier" : "Ajouter"}
              </button>
            )}
          </div>
          {editingNotes ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={4}
                placeholder="Tes impressions, citations préférées… (visible dans l'espace Découverte)"
                className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-violet"
                autoFocus
              />
              <div className="flex gap-2">
                <Button onClick={saveNotes} className="px-4 py-2">Enregistrer</Button>
                <Button
                  variant="ghost"
                  onClick={() => { setNotesDraft(book.notes || ""); setEditingNotes(false); }}
                  className="px-4 py-2"
                >
                  Annuler
                </Button>
              </div>
            </div>
          ) : book.notes ? (
            <p className="font-serif text-[13.5px] italic leading-relaxed text-ink-2" style={{ whiteSpace: "pre-line" }}>
              « {book.notes} »
            </p>
          ) : (
            <p className="text-[13px] text-muted">Aucune note pour le moment.</p>
          )}
        </div>}

        {/* Sessions de lecture — groupées par jour */}
        {groupedLogs.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="font-serif text-[15px] font-medium text-ink">
              Mes sessions{" "}
              <span className="font-sans text-xs font-normal text-muted">
                ({logs.length}
                {groupedLogs.length < logs.length
                  ? ` · ${groupedLogs.length} jour${groupedLogs.length > 1 ? "s" : ""}`
                  : ""})
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
                    <div className="flex-1 rounded-xl bg-[#f4f0e8] px-3 py-2">
                      <p className="text-[9px] font-medium uppercase tracking-wide text-muted">Arrêté p.</p>
                      <p className="font-serif text-base font-black text-ink">{log.end_page}</p>
                    </div>
                  </div>
                  {log.session_notes && (
                    <p className="rounded-xl bg-[#f4f0e8] px-3 py-2 font-serif text-[12.5px] italic leading-relaxed text-ink-2" style={{ whiteSpace: "pre-line" }}>
                      « {log.session_notes} »
                    </p>
                  )}
                  {log.session_photo_url && (
                    <a href={log.session_photo_url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={log.session_photo_url}
                        alt="Photo de session"
                        className="h-36 w-full rounded-xl object-cover"
                      />
                    </a>
                  )}
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

      {/* Modale review d'un membre */}
      {selectedMember && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="animate-slideUp w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <Link
                href={`/membre/${selectedMember.userId}`}
                onClick={() => setSelectedMember(null)}
              >
                <AvatarImg
                  url={selectedMember.avatarUrl}
                  name={selectedMember.displayName}
                  className="h-11 w-11 text-xs font-semibold"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{selectedMember.displayName}</p>
                <p className="text-[11px] text-muted">
                  {selectedMember.status === "completed" ? "A terminé ce livre" : "En cours de lecture"}
                </p>
              </div>
              {(selectedMember.rating ?? 0) > 0 && (
                <div className="text-right">
                  <p className="text-base text-gold">{"★".repeat(Math.round(selectedMember.rating!))}</p>
                  <p className="text-xs font-semibold text-ink">
                    {selectedMember.rating!.toFixed(1).replace(".", ",")} /5
                  </p>
                </div>
              )}
            </div>
            {selectedMember.review ? (
              <p className="font-serif text-[13.5px] italic leading-relaxed text-ink-2" style={{ whiteSpace: "pre-line" }}>
                « {selectedMember.review} »
              </p>
            ) : (
              <p className="text-sm text-muted">Pas encore de review pour ce livre.</p>
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
                  className="rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-violet hover:bg-violet-soft disabled:opacity-50"
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
