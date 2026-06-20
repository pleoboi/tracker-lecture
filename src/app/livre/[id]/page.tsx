"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import type { Book, ReadingLog } from "../../../lib/types";
import { pct, isCompleted, isAbandoned, readingStats, formatDate, formatDateLong } from "../../../lib/books";
import { Cover, ProgressBar, Pill, Button } from "../../../components/ui";
import LogReadingModal from "../../../components/LogReadingModal";

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

  const load = useCallback(async () => {
    if (!userId) return;
    const [{ data: b }, { data: l }] = await Promise.all([
      supabase.from("books").select("*").eq("id", id).eq("user_id", userId).single(),
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

  const p = pct(book);
  const done = isCompleted(book);
  const abandoned = isAbandoned(book);
  const stats = readingStats(book, logs);
  const rating = book.rating || 0;

  return (
    <div className="animate-fadeIn -mx-5 md:-mx-10">
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
            {!done && !abandoned && (
              <button
                onClick={abandon}
                className="flex h-9 items-center justify-center rounded-xl border border-line bg-card px-3 text-xs font-medium text-muted"
              >
                Abandonner
              </button>
            )}
            {abandoned && (
              <span className="rounded-xl border border-[#e7c7bd] bg-[#f6e7e1] px-3 py-1.5 text-xs font-semibold text-danger">
                Abandonné
              </span>
            )}
            <button
              onClick={remove}
              className="flex h-9 items-center justify-center rounded-xl border border-line bg-card px-3 text-xs font-medium text-danger"
            >
              Supprimer
            </button>
          </div>
        </div>

        <Cover
          id={book.id}
          title={book.title}
          coverUrl={book.cover_url}
          className="h-[205px] w-[140px]"
          rounded="rounded-lg"
        />

        {editingInfo ? (
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
        ) : (
          <button
            onClick={() => setEditingInfo(true)}
            className="text-xs font-medium text-violet-deep underline decoration-violet/40 underline-offset-2"
          >
            Modifier les informations
          </button>
        )}

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
            <button onClick={() => setShowLog(true)} className="text-xs font-medium text-violet-deep">
              Noter une session
            </button>
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

        {/* Résumé */}
        {book.summary && (
          <div className="flex flex-col gap-2">
            <h2 className="font-serif text-[15px] font-medium text-ink">Résumé</h2>
            <p className="text-[13px] leading-relaxed text-ink-2">{book.summary}</p>
            <p className="text-[10.5px] text-muted">Source : Google Books</p>
          </div>
        )}

        {/* Mes notes */}
        <div className="flex flex-col gap-2 rounded-2xl border border-[#e4daef] bg-[#f2ecf6] p-4">
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
            <p className="font-serif text-[13.5px] italic leading-relaxed text-ink-2">
              « {book.notes} »
            </p>
          ) : (
            <p className="text-[13px] text-muted">Aucune note pour le moment.</p>
          )}
        </div>

        {/* Mes sessions de lecture */}
        {logs.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="font-serif text-[15px] font-medium text-ink">
              Mes sessions{" "}
              <span className="font-sans text-xs font-normal text-muted">({logs.length})</span>
            </h2>
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3.5"
              >
                <div className="flex flex-1 items-center gap-3">
                  <div className="flex flex-col gap-2.5 flex-1">
                    <p className="text-[12px] font-medium capitalize text-muted">
                      {formatDateLong(log.date)}
                    </p>
                    <div className="flex gap-2">
                      <div className="flex-1 rounded-xl bg-violet-soft px-3 py-2">
                        <p className="text-[9px] font-medium uppercase tracking-wide text-violet-deep">
                          Lu ce jour
                        </p>
                        <p className="font-serif text-base font-black text-violet-deep">
                          +{log.pages_read}
                        </p>
                      </div>
                      <div className="flex-1 rounded-xl bg-[#f4f0e8] px-3 py-2">
                        <p className="text-[9px] font-medium uppercase tracking-wide text-muted">
                          Arrêté p.
                        </p>
                        <p className="font-serif text-base font-black text-ink">{log.end_page}</p>
                      </div>
                    </div>
                    {log.session_notes && (
                      <p className="rounded-xl bg-[#f4f0e8] px-3 py-2 font-serif text-[12.5px] italic leading-relaxed text-ink-2">
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
                </div>
                <button
                  onClick={() => deleteLog(log.id)}
                  className="ml-1 shrink-0 text-muted hover:text-danger"
                  aria-label="Supprimer cette session"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <LogReadingModal
        open={showLog}
        onClose={() => setShowLog(false)}
        books={[book]}
        defaultBookId={book.id}
        onSaved={() => load()}
      />
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
