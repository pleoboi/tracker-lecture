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
  notes: string[];   // toutes les notes de session du jour (dans l'ordre)
  photos: string[];  // toutes les photos du jour (dans l'ordre)
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

  const load = useCallback(async () => {
    if (!userId) return;
    const [{ data: logs, error: logErr }, { data: books }] = await Promise.all([
      supabase
        .from("reading_logs")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: true }), // chronologique dans la journée
      supabase.from("books").select("*").eq("user_id", userId),
    ]);
    if (logErr) {
      setError(logErr.message);
      setLoading(false);
      return;
    }
    const bookList = (books as Book[]) || [];
    const logList = (logs as ReadingLog[]) || [];

    // Groupement par date+livre : cumul pages, toutes notes/photos conservées
    const map = new Map<string, DayEntry>();
    logList.forEach((log) => {
      const dateStr = log.date;
      const key = `${dateStr}-${log.book_id}`;
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
          date: dateStr,
          book: bookList.find((b) => b.id === log.book_id) || null,
          totalPages: log.pages_read || 0,
          endPage: log.end_page || 0,
          goalReached: false,
          notes: log.session_notes ? [log.session_notes] : [],
          photos: log.session_photo_url ? [log.session_photo_url] : [],
        });
      }
    });

    // Total journalier (tous livres confondus) pour goalReached
    const dayTotalPages = new Map<string, number>();
    logList.forEach((log) => {
      dayTotalPages.set(log.date, (dayTotalPages.get(log.date) || 0) + (log.pages_read || 0));
    });

    const merged = Array.from(map.values())
      .map((e) => ({ ...e, goalReached: (dayTotalPages.get(e.date) || 0) >= DAILY_GOAL }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Stats semaine
    const daySet = new Set<string>();
    const dayPages = new Map<string, number>();
    logList.forEach((log) => {
      const d = log.date;
      daySet.add(d);
      dayPages.set(d, (dayPages.get(d) || 0) + (log.pages_read || 0));
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

    // Streak
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

  const deleteEntry = async (ids: number[]) => {
    await supabase.from("reading_logs").delete().in("id", ids);
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
                <button
                  onClick={() => deleteEntry(e.ids)}
                  className="text-muted hover:text-danger"
                  aria-label="Supprimer"
                >
                  ✕
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

              {/* Toutes les notes de session du jour, dans l'ordre */}
              {e.notes.map((note, i) => (
                <p
                  key={i}
                  className="rounded-xl bg-violet-soft px-3 py-2.5 font-serif text-[12.5px] italic leading-relaxed text-ink"
                  style={{ whiteSpace: "pre-line" }}
                >
                  {e.notes.length > 1 && (
                    <span className="not-italic text-[9.5px] font-semibold uppercase tracking-wide text-violet-deep block mb-1">
                      Note {i + 1}
                    </span>
                  )}
                  « {note} »
                </p>
              ))}

              {/* Toutes les photos du jour */}
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
    </div>
  );
}
