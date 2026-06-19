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
  const [status, setStatus] = useState<"reading" | "completed">("reading");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [pages, setPages] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && book) {
      setStatus("reading");
      setStartDate(todayISO());
      setEndDate(todayISO());
      setPages(String(book.pages));
      setError(null);
    }
  }, [open, book]);

  if (!book) return null;

  const handleSave = async () => {
    if (!user) return;
    const n = Number(pages);
    if (!pages || isNaN(n) || n <= 0) {
      setError("Indique le nombre de pages de ton édition.");
      return;
    }
    setSaving(true);
    setError(null);

    // Vérifie doublon
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

    const { data: inserted, error: err } = await supabase
      .from("books")
      .insert({
        title: book.title,
        author: book.author,
        pages: n,
        progress: status === "completed" ? n : 0,
        status,
        cover_url: book.cover_url ?? null,
        genre: book.genre ?? null,
        published_year: book.published_year ?? null,
        summary: book.summary ?? null,
        rating: 0,
        user_id: user.id,
      })
      .select("id")
      .single();

    if (err || !inserted) {
      setError(err?.message ?? "Erreur lors de l'ajout.");
      setSaving(false);
      return;
    }

    if (status === "completed") {
      if (startDate && startDate !== endDate && n > 1) {
        // Deux sessions : une au début (1 page) et une à la fin (reste)
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
    onAdded(
      status === "completed"
        ? `« ${book.title} » marqué comme terminé dans ta bibliothèque.`
        : `« ${book.title} » ajouté à tes lectures en cours.`
    );
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Ajouter à mes lectures">
      <div className="flex flex-col gap-4">
        {/* Aperçu */}
        <div className="rounded-2xl border border-line bg-card px-4 py-3">
          <p className="font-serif text-[15px] font-medium text-ink">{book.title}</p>
          <p className="text-xs text-muted">{book.author}</p>
        </div>

        {/* Statut */}
        <div>
          <FieldLabel>Statut</FieldLabel>
          <div className="flex gap-2">
            {(["reading", "completed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                  status === s
                    ? "border-violet bg-violet-soft text-violet-deep"
                    : "border-line bg-card text-muted hover:border-violet/40"
                }`}
              >
                {s === "reading" ? "En cours" : "Terminé ✓"}
              </button>
            ))}
          </div>
        </div>

        {/* Pages */}
        <div>
          <FieldLabel>Pages (ton édition)</FieldLabel>
          <input
            type="number"
            min={1}
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Dates début + fin */}
        {status === "completed" && (
          <div className="flex flex-col gap-3">
            <div>
              <FieldLabel>Date de début de lecture</FieldLabel>
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <FieldLabel>Date de fin de lecture</FieldLabel>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        )}

        {error && <p className="text-xs font-medium text-danger">{error}</p>}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving
            ? "Ajout…"
            : status === "completed"
              ? "Marquer comme terminé"
              : "Commencer la lecture"}
        </Button>
      </div>
    </Modal>
  );
}
