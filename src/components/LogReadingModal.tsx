"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import type { Book } from "../lib/types";
import { todayISO } from "../lib/books";
import { Modal, Button, FieldLabel, inputClass } from "./ui";

export default function LogReadingModal({
  open,
  onClose,
  books,
  defaultBookId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  books: Book[];
  defaultBookId?: number;
  onSaved: (message: string) => void;
}) {
  const { user } = useAuth();
  const [bookId, setBookId] = useState<string>("");
  const [date, setDate] = useState(todayISO());
  const [endPage, setEndPage] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [sessionPhotoUrl, setSessionPhotoUrl] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setBookId(String(defaultBookId ?? books[0]?.id ?? ""));
      setDate(todayISO());
      setEndPage("");
      setSessionNotes("");
      setSessionPhotoUrl("");
      setShowExtras(false);
      setError(null);
    }
  }, [open, defaultBookId, books]);

  const book = books.find((b) => String(b.id) === bookId);
  const target = Number(endPage);
  const validNumber = endPage !== "" && !isNaN(target);
  const diff = book && validNumber ? target - book.progress : 0;

  const handleSave = async () => {
    if (!book || !validNumber || !user) return;
    if (target < 0 || target > book.pages) {
      setError(`Page d'arrêt invalide (0 à ${book.pages}).`);
      return;
    }
    setSaving(true);
    setError(null);

    const completed = target === book.pages;
    if (diff > 0) {
      await supabase.from("reading_logs").insert({
        book_id: book.id,
        date,
        pages_read: diff,
        end_page: target,
        user_id: user.id,
        session_notes: sessionNotes.trim() || null,
        session_photo_url: sessionPhotoUrl.trim() || null,
      });
    }
    await supabase
      .from("books")
      .update({
        progress: target,
        status: completed ? "completed" : "reading",
        ...(completed ? { date_read: date } : {}),
      })
      .eq("id", book.id);

    setSaving(false);
    onSaved(
      completed
        ? `« ${book.title} » terminé, bravo !`
        : diff < 0
          ? `Correction : retour page ${target}.`
          : `Session enregistrée : +${diff} pages.`
    );
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Noter ma lecture">
      {books.length === 0 ? (
        <p className="text-sm text-muted">Ajoute d&apos;abord un livre en cours de lecture.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <FieldLabel>Livre</FieldLabel>
            <select
              value={bookId}
              onChange={(e) => { setBookId(e.target.value); setEndPage(""); }}
              className={inputClass + " font-medium"}
            >
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} — {b.author}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>Date</FieldLabel>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <FieldLabel>Page d&apos;arrêt</FieldLabel>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={book?.pages || 9999}
                value={endPage}
                onChange={(e) => setEndPage(e.target.value)}
                placeholder={book ? String(book.progress) : "0"}
                className={inputClass + " text-lg font-bold"}
                autoFocus
              />
              <span className="whitespace-nowrap text-sm font-medium text-muted">
                / {book?.pages ?? "—"}
              </span>
            </div>
          </div>

          {validNumber && diff !== 0 && (
            <div
              className={`flex items-center justify-between rounded-xl px-3.5 py-3 ${
                diff > 0 ? "bg-violet-soft" : "bg-[#f6e7e1]"
              }`}
            >
              <span className={`text-xs font-medium ${diff > 0 ? "text-violet-deep" : "text-danger"}`}>
                {diff > 0 ? "Lu aujourd'hui" : "Correction"}
              </span>
              <span className={`text-sm font-semibold ${diff > 0 ? "text-violet-deep" : "text-danger"}`}>
                {diff > 0 ? `+ ${diff} pages` : `${diff} pages`}
              </span>
            </div>
          )}

          {/* Extras Strava */}
          <button
            type="button"
            onClick={() => setShowExtras((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-violet-deep"
          >
            <span className="text-base leading-none">{showExtras ? "▾" : "▸"}</span>
            {showExtras ? "Masquer les détails de session" : "Ajouter une note ou une photo"}
          </button>

          {showExtras && (
            <div className="flex flex-col gap-3 rounded-2xl border border-violet/20 bg-violet-soft p-3.5">
              <div>
                <FieldLabel>Note de session (optionnel)</FieldLabel>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  rows={3}
                  placeholder="Impressions, citations, contexte de lecture… Distinct de ta review finale."
                  className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-violet"
                />
              </div>
              <div>
                <FieldLabel>Photo de session (URL, optionnel)</FieldLabel>
                <input
                  type="url"
                  value={sessionPhotoUrl}
                  onChange={(e) => setSessionPhotoUrl(e.target.value)}
                  placeholder="https://… (lien vers une image)"
                  className={inputClass}
                />
                {sessionPhotoUrl.trim() && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sessionPhotoUrl.trim()}
                    alt="Aperçu"
                    className="mt-2 h-24 w-full rounded-xl object-cover"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                  />
                )}
              </div>
            </div>
          )}

          {error && <p className="text-xs font-medium text-danger">{error}</p>}

          <Button onClick={handleSave} disabled={saving || !validNumber} className="w-full">
            {saving ? "Enregistrement…" : "Enregistrer la session"}
          </Button>
          <p className="text-[11px] leading-4 text-muted">
            La progression et la durée de lecture se mettent à jour automatiquement.
          </p>
        </div>
      )}
    </Modal>
  );
}
