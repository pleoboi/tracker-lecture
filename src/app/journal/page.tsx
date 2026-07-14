"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import type { Book, ReadingLog } from "../../lib/types";
import { formatDateLong } from "../../lib/books";
import { Cover, Pill } from "../../components/ui";

const DAILY_GOAL = 69;
const MS_DAY = 86_400_000;

interface DayEntry {
  ids: number[];
  date: string;
  book: Book | null;
  totalPages: number;
  endPage: number;
  goalReached: boolean;
  notes: string[];
  photos: string[];
}

export default function JournalPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [weekPages, setWeekPages] = useState(0);
  const [weekDays, setWeekDays] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // État pour la modale d'édition
  const [editEntry, setEditEntry] = useState<DayEntry | null>(null);
  const [editPage, setEditPage] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const [{ data: logs, error: logErr }, { data: books }] = await Promise.all([
      supabase
        .from("reading_logs")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase.from("books").select("*").eq("user_id", userId),
    ]);
    if (logErr) {
      setError(logErr.message);
      setLoading(false);
      return;
    }
    const bookList = (books as Book[]) || [];
    const logList = (logs as ReadingLog[]) || [];

    const map = new Map<string, DayEntry>();
    logList.forEach((log) => {
      const key = `${log.date}-${log.book_id}`;
      const existing = map.get(key);
      if (existing) {
        existing.ids.push(log.id);
        existing.totalPages += log.pages_read || 0;
        existing.endPage = log.end_page || existing.endPage;
        if (log.session_notes) existing.notes.push(log.session_notes);
        if (log.session_photo_url) existing.photos.push(log.session_photo_url);
      } else {
        map.set(key, {
          ids: [log.id],
          date: log.date,
          book: bookList.find((b) => b.id === log.book_id) || null,
          totalPages: log.pages_read || 0,
          endPage: log.end_page || 0,
          goalReached: false,
          notes: log.session_notes ? [log.session_notes] : [],
          photos: log.session_photo_url ? [log.session_photo_url] : [],
        });
      }
    });

    const dayTotalPages = new Map<string, number>();
    logList.forEach((log) => {
      dayTotalPages.set(log.date, (dayTotalPages.get(log.date) || 0) + (log.pages_read || 0));
    });

    const merged = Array.from(map.values())
      .map((e) => ({ ...e, goalReached: (dayTotalPages.get(e.date) || 0) >= DAILY_GOAL }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const daySet = new Set<string>();
    const dayPages = new Map<string, number>();
    logList.forEach((log) => {
      daySet.add(log.date);
      dayPages.set(log.date, (dayPages.get(log.date) || 0) + (log.pages_read || 0));
    });

    const now = Date.now();
    let wp = 0;
    const wd = new Set<string>();
    dayPages.forEach((pages, d) => {
      if (now - new Date(d).getTime() < 7 * MS_DAY) {
        wp += pages;
        wd.add(d);
      }
    });

    let s = 0;
    const cur = new Date();
    cur.setHours(0, 0, 0, 0);
    if (!daySet.has(cur.toISOString().split("T")[0]))
      cur.setTime(cur.getTime() - MS_DAY);
    while (daySet.has(cur.toISOString().split("T")[0])) {
      s++;
      cur.setTime(cur.getTime() - MS_DAY);
    }

    setEntries(merged);
    setWeekPages(wp);
    setWeekDays(wd.size);
    setStreak(s);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Suppression : remet le progress du livre à la page du log précédent
  const deleteEntry = async (e: DayEntry) => {
    await supabase.from("reading_logs").delete().in("id", e.ids);

    if (e.book) {
      const { data: prev } = await supabase
        .from("reading_logs")
        .select("end_page")
        .eq("user_id", userId!)
        .eq("book_id", e.book.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1);

      const prevPage = prev?.[0]?.end_page ?? 0;
      await supabase.from("books").update({ progress: prevPage }).eq("id", e.book.id);
    }

    load();
  };

  // Ouverture de la modale d'édition
  const openEdit = (e: DayEntry) => {
    setEditEntry(e);
    setEditPage(String(e.endPage));
    setEditError(null);
  };

  // Sauvegarde de la correction
  const saveEdit = async () => {
    if (!editEntry?.book) return;
    const newPage = parseInt(editPage, 10);
    if (isNaN(newPage) || newPage < 0) {
      setEditError("Numéro de page invalide.");
      return;
    }

    setEditSaving(true);
    setEditError(null);

    // Ajuste pages_read du dernier log : oldPages + (newEndPage - oldEndPage)
    const lastId = editEntry.ids[editEntry.ids.length - 1];
    const pagesReadDelta = newPage - editEntry.endPage;
    const correctedPagesRead = Math.max(0, editEntry.totalPages + pagesReadDelta);

    await supabase.from("reading_logs").update({
      end_page: newPage,
      pages_read: correctedPagesRead,
    }).eq("id", lastId);

    // Met à jour le progress du livre
    await supabase.from("books").update({ progress: newPage }).eq("id", editEntry.book.id);

    setEditSaving(false);
    setEditEntry(null);
    load();
  };

  return (
    <div className="animate-fadeIn flex flex-col gap-5 pt-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-black text-ink">Journal</h1>
        <p className="text-xs font-medium text-muted">Ton historique de lecture</p>
      </header>

      {!loading && !error && (
        <div className="flex items-center justify-between rounded-2xl bg-violet-soft px-4 py-3.5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-violet-deep">
              Cette semaine
            </p>
            <p className="font-serif text-[15px] font-semibold text-ink">
              {weekPages} pages · {weekDays} jour{weekDays > 1 ? "s" : ""} actif
              {weekDays > 1 ? "s" : ""}
            </p>
          </div>
          <span className="font-bold text-violet-deep">🔥 {streak}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-xs font-medium uppercase tracking-wider text-muted">
          Chargement…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-[#e7c7bd] bg-[#f6e7e1] p-4 text-xs text-danger">
          {error}
        </div>
      ) : entries.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          Aucune session enregistrée pour le moment.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {entries.map((e) => (
            <div
              key={e.ids.join("-")}
              className={`flex flex-col gap-3 rounded-2xl border bg-card p-4 ${
                e.goalReached ? "border-[#cfe0cf]" : "border-line"
              }`}
            >
              <div className="flex items-center gap-3">
                {e.book ? (
                  <Link href={`/livre/${e.book.id}`}>
                    <Cover
                      id={e.book.id}
                      title={e.book.title}
                      coverUrl={e.book.cover_url}
                      className="h-14 w-10"
                    />
                  </Link>
                ) : (
                  <div className="h-14 w-10 rounded-md bg-line" />
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-serif text-[15px] font-medium text-ink">
                    {e.book?.title || "Livre supprimé"}
                  </h2>
                  <p className="text-[11.5px] capitalize text-muted">
                    {formatDateLong(e.date)}
                    {e.ids.length > 1 && (
                      <span className="ml-1.5 rounded-full bg-violet-soft px-1.5 py-0.5 text-[9.5px] font-semibold text-violet-deep">
                        {e.ids.length} sessions
                      </span>
                    )}
                  </p>
                </div>
                {e.goalReached && <Pill tone="success">Objectif ✓</Pill>}

                {/* Bouton Modifier */}
                <button
                  onClick={() => openEdit(e)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-violet-soft hover:text-violet-deep"
                  aria-label="Modifier"
                  title="Corriger la page"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>

                {/* Bouton Supprimer */}
                <button
                  onClick={() => deleteEntry(e)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-[#f6e7e1] hover:text-danger"
                  aria-label="Supprimer"
                  title="Supprimer ce log"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>

              <div className="flex gap-2.5">
                <div
                  className={`flex-1 rounded-xl px-3 py-2.5 ${
                    e.goalReached ? "bg-[#eaf1ea] dark:bg-[#162516]" : "bg-violet-soft"
                  }`}
                >
                  <p
                    className={`text-[9.5px] font-medium uppercase tracking-wide ${
                      e.goalReached ? "text-success" : "text-violet-deep"
                    }`}
                  >
                    Lu ce jour
                  </p>
                  <p
                    className={`font-serif text-lg font-black ${
                      e.goalReached ? "text-success" : "text-violet-deep"
                    }`}
                  >
                    +{e.totalPages}
                  </p>
                </div>
                <div className="flex-1 rounded-xl bg-input px-3 py-2.5">
                  <p className="text-[9.5px] font-medium uppercase tracking-wide text-muted">
                    Arrêté page
                  </p>
                  <p className="font-serif text-lg font-black text-ink">{e.endPage}</p>
                </div>
              </div>

              {e.notes.map((note, i) => (
                <div key={i} className="rounded-xl bg-violet-soft px-3 py-2.5">
                  {e.notes.length > 1 && (
                    <span className="mb-1 block text-[9.5px] font-semibold uppercase tracking-wide text-violet-deep">
                      Note {i + 1}
                    </span>
                  )}
                  {note.startsWith("<") ? (
                    <div className="prose-review font-serif text-[12.5px] leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: note }} />
                  ) : (
                    <p className="font-serif text-[12.5px] leading-relaxed text-ink" style={{ whiteSpace: "pre-line" }}>
                      {note}
                    </p>
                  )}
                </div>
              ))}

              {e.photos.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="Photo de session"
                    className="h-36 w-full rounded-xl object-cover"
                  />
                </a>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Modale de correction de page */}
      {editEntry && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 px-5 backdrop-blur-sm"
          onClick={() => setEditEntry(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-paper p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-serif text-lg font-bold text-ink">Corriger la progression</h2>
            {editEntry.book && (
              <p className="mt-0.5 truncate text-sm text-muted">{editEntry.book.title}</p>
            )}

            <div className="mt-5 flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Page réelle où tu t&apos;es arrêté(e)
              </label>
              <input
                type="number"
                min={0}
                value={editPage}
                onChange={(e) => setEditPage(e.target.value)}
                autoFocus
                className="rounded-xl border border-line bg-input px-4 py-3 text-center font-serif text-2xl font-black text-ink outline-none focus:border-violet"
              />
              <p className="text-[11px] text-muted">
                Log actuel : page {editEntry.endPage}
              </p>
            </div>

            {editError && (
              <p className="mt-2 rounded-xl border border-[#e7c7bd] bg-[#f6e7e1] px-3 py-2 text-xs text-danger">
                {editError}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setEditEntry(null)}
                className="flex-1 rounded-2xl border border-line py-3 text-sm font-semibold text-muted transition-colors hover:border-violet/40 hover:text-ink"
              >
                Annuler
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="flex-1 rounded-2xl bg-violet py-3 text-sm font-semibold text-cream transition-opacity disabled:opacity-60"
              >
                {editSaving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
