"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { todayISO } from "../lib/books";
import { Modal, Button, FieldLabel, inputClass } from "./ui";

export interface BookRef {
  title: string;
  author: string;
  pages: number;
  cover_url?: string | null;
  genre?: string | null;
  published_year?: number | null;
  summary?: string | null;
}

type Status = "to-read" | "reading" | "completed";

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "to-read", label: "Envie de lire" },
  { value: "reading", label: "En cours" },
  { value: "completed", label: "Terminé ✓" },
];

export default function AddToLibraryModal({
  open,
  onClose,
  book,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  book: BookRef | null;
  onAdded: (msg: string) => void;
}) {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>("to-read");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pages, setPages] = useState("");
  const [rating, setRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && book) {
      setStatus("to-read");
      setStartDate("");
      setEndDate("");
      setPages(book.pages ? String(book.pages) : "");
      setRating(0);
      setError(null);
    }
  }, [open, book]);

  if (!book) return null;

  const handleSave = async () => {
    if (!user) return;

    const n = Number(pages) || book.pages || 0;

    setSaving(true);
    setError(null);

    const { data: existing } = await supabase
      .from("books")
      .select("id")
      .eq("user_id", user.id)
      .ilike("title", book.title)
      .limit(1);

    if (existing && existing.length > 0) {
      setError("Ce livre est déjà dans ta bibliothèque.");
      setSaving(false);
      return;
    }

    const bookData: Record<string, unknown> = {
      title: book.title,
      author: book.author,
      pages: n,
      progress: status === "completed" ? n : 0,
      status,
      cover_url: book.cover_url ?? null,
      genre: book.genre ?? null,
      published_year: book.published_year ?? null,
      summary: book.summary ?? null,
      rating: rating || 0,
      user_id: user.id,
    };

    if (status === "reading" && startDate) bookData.date_started = startDate;
    if (status === "completed") {
      if (startDate) bookData.date_started = startDate;
      if (endDate) bookData.date_read = endDate;
    }

    const { data: inserted, error: err } = await supabase
      .from("books")
      .insert(bookData)
      .select("id")
      .single();

    if (err || !inserted) {
      setError(err?.message ?? "Erreur lors de l'ajout.");
      setSaving(false);
      return;
    }

    if (status === "completed" && endDate && n > 0) {
      if (startDate && startDate !== endDate && n > 1) {
        await supabase.from("reading_logs").insert([
          { book_id: inserted.id, date: startDate, pages_read: 1, end_page: 1, user_id: user.id },
          { book_id: inserted.id, date: endDate, pages_read: n - 1, end_page: n, user_id: user.id },
        ]);
      } else {
        await supabase.from("reading_logs").insert({
          book_id: inserted.id,
          date: endDate,
          pages_read: n,
          end_page: n,
          user_id: user.id,
        });
      }
    }

    setSaving(false);
    const msgs: Record<Status, string> = {
      "to-read": `« ${book.title} » ajouté à ta liste de souhaits.`,
      "reading": `« ${book.title} » ajouté à tes lectures en cours.`,
      "completed": `« ${book.title} » marqué comme terminé dans ta bibliothèque.`,
    };
    onAdded(msgs[status]);
    onClose();
  };

  const btnLabel = saving
    ? "Ajout…"
    : status === "to-read"
      ? "Ajouter à ma liste"
      : status === "completed"
        ? "Marquer comme terminé"
        : "Commencer la lecture";

  return (
    <Modal open={open} onClose={onClose} title="Ajouter à ma bibliothèque">
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-line bg-card px-4 py-3">
          <p className="font-serif text-[15px] font-medium text-ink">{book.title}</p>
          <p className="text-xs text-muted">{book.author}</p>
        </div>

        {/* Statut */}
        <div>
          <FieldLabel>Statut</FieldLabel>
          <div className="flex gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatus(s.value)}
                className={`flex-1 rounded-xl border py-2.5 text-xs font-semibold transition-colors ${
                  status === s.value
                    ? "border-violet bg-violet-soft text-violet-deep"
                    : "border-line bg-card text-muted hover:border-violet/40"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Note (pour Terminé) */}
        {status === "completed" && (
          <div>
            <FieldLabel>Note (optionnel)</FieldLabel>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(rating === s ? 0 : s)}
                  className="p-1 text-2xl leading-none"
                >
                  <span style={{ color: s <= rating ? "#c9a227" : "#dad2c2" }}>★</span>
                </button>
              ))}
              {rating > 0 && (
                <span className="ml-1 text-xs text-muted">{rating}/5</span>
              )}
            </div>
          </div>
        )}

        {/* Pages (optionnel pour non-wishlist) */}
        {status !== "to-read" && (
          <div>
            <FieldLabel>Pages de ton édition (optionnel)</FieldLabel>
            <input
              type="number"
              min={1}
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              placeholder={book.pages ? String(book.pages) : "Ex : 320"}
              className={inputClass}
            />
          </div>
        )}

        {/* Date de début */}
        {(status === "reading" || status === "completed") && (
          <div>
            <FieldLabel>Date de début (optionnel)</FieldLabel>
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </div>
        )}

        {/* Date de fin */}
        {status === "completed" && (
          <div>
            <FieldLabel>Date de fin (optionnel)</FieldLabel>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </div>
        )}

        {error && <p className="text-xs font-medium text-danger">{error}</p>}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {btnLabel}
        </Button>
      </div>
    </Modal>
  );
}
