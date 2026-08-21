"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import type { Book } from "../lib/types";
import { todayISO } from "../lib/books";
import { Modal, Button, FieldLabel, inputClass, Cover } from "./ui";
import RichTextEditor from "./RichTextEditor";
import { compressImage } from "../lib/image";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// Étoiles avec remplissage continu (overlay clip)
function StarFill({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, (value / 5) * 100));
  return (
    <div className="relative inline-flex text-[28px] leading-none tracking-[2px]">
      <span className="text-line dark:text-line">★★★★★</span>
      <span
        className="absolute inset-0 overflow-hidden text-gold"
        style={{ width: `${pct}%` }}
      >
        ★★★★★
      </span>
    </div>
  );
}

// ── Notation glissante demi-étoile ───────────────────────────────────────────
function SessionStarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startVal = useRef(0);

  const calcVal = (clientX: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = Math.max(0, Math.min(rect.width - 1, clientX - rect.left));
    return Math.max(0.5, Math.min(5, Math.round(((relX / rect.width) * 5) * 2) / 2));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    startVal.current = value;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const v = calcVal(e.clientX);
    setHovered(v);
    onChange(v);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const v = calcVal(e.clientX);
    setHovered(v);
    if (dragging.current) onChange(v);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    const v = calcVal(e.clientX);
    onChange(startVal.current === v ? 0 : v);
    setHovered(0);
  };

  const onPointerLeave = () => {
    if (!dragging.current) setHovered(0);
  };

  const display = hovered || value;

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <p className="min-h-[18px] text-[13px] font-semibold text-muted transition-all">
        {display > 0 ? display.toFixed(1).replace(".", ",") + " / 5" : "Rate"}
      </p>
      <div
        ref={containerRef}
        className="flex cursor-pointer gap-2 py-1"
        style={{ touchAction: "none", userSelect: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const full = display >= star;
          const half = !full && display >= star - 0.5;
          return (
            <span key={star} className="relative text-[40px] leading-none">
              <span style={{ color: "var(--color-line, #3a3a5c)" }}>★</span>
              {(full || half) && (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ color: "#c9a227", width: full ? "100%" : "50%" }}
                >
                  ★
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

interface CompletionStats {
  startDate: string | null;
  endDate: string;
  durationDays: number;
  pagesPerDay: number | null;
}

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

  // ── Step "log" ──
  const [step, setStep] = useState<"log" | "complete">("log");
  const [bookId, setBookId] = useState<string>("");
  const [date, setDate] = useState(todayISO());
  const [endPage, setEndPage] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [sessionPhotoUrl, setSessionPhotoUrl] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [sessionRating, setSessionRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // ── Step "complete" ──
  const [completionStats, setCompletionStats] = useState<CompletionStats | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(0);

  useEffect(() => {
    if (open) {
      setStep("log");
      setBookId(String(defaultBookId ?? books[0]?.id ?? ""));
      setDate(todayISO());
      setEndPage("");
      setSessionNotes("");
      setSessionPhotoUrl("");
      setSessionRating(0);
      setShowExtras(false);
      setError(null);
      setPhotoUploading(false);
      setCompletionStats(null);
      setReviewText("");
      setReviewRating(0);
    }
  }, [open, defaultBookId, books]);

  const book = books.find((b) => String(b.id) === bookId);
  const target = Number(endPage);
  const validNumber = endPage !== "" && !isNaN(target);
  const diff = book && validNumber ? target - book.progress : 0;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const original = e.target.files?.[0];
    if (!original || !user) return;
    setPhotoUploading(true);
    await fetch("/api/storage/setup", { method: "POST" }).catch(() => null);
    // Compression / redimensionnement côté client avant envoi (WebP si supporté).
    const file = await compressImage(original);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { data, error: upErr } = await supabase.storage
      .from("session-photos")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (!upErr && data) {
      const { data: { publicUrl } } = supabase.storage
        .from("session-photos")
        .getPublicUrl(data.path);
      setSessionPhotoUrl(publicUrl);
    } else {
      setError(
        upErr?.message?.includes("bucket")
          ? "Le bucket 'session-photos' n'existe pas encore."
          : `Upload échoué : ${upErr?.message ?? "erreur inconnue"}`
      );
    }
    setPhotoUploading(false);
  };

  const handleSave = async () => {
    if (!book || !validNumber || !user) return;
    if (target < 0 || target > book.pages) {
      setError(`Page d'arrêt invalide (0 à ${book.pages}).`);
      return;
    }
    setSaving(true);
    setError(null);

    const completed = target === book.pages;
    // On enregistre un log dès qu'il y a une progression OU une note / photo de session,
    // sinon une note prise sans avancer dans les pages (diff === 0) serait perdue.
    const hasSessionExtras = !!sessionNotes.trim() || !!sessionPhotoUrl.trim();
    if (diff > 0 || hasSessionExtras) {
      await supabase.from("reading_logs").insert({
        book_id: book.id,
        date,
        pages_read: diff > 0 ? diff : 0,
        end_page: target,
        user_id: user.id,
        session_notes: sessionNotes.trim() || null,
        session_photo_url: sessionPhotoUrl.trim() || null,
      });
    }
    if (sessionRating > 0) {
      await supabase.from("book_ratings_history").insert({
        user_id: user.id,
        book_id: book.id,
        rating: sessionRating,
        page_at: target,
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

    if (completed) {
      // Récupère la date du premier log pour calculer les KPIs
      const { data: firstLog } = await supabase
        .from("reading_logs")
        .select("date")
        .eq("book_id", book.id)
        .eq("user_id", user.id)
        .order("date", { ascending: true })
        .limit(1);

      const startDate = firstLog?.[0]?.date ?? null;
      const endDate = date;
      let durationDays = 1;
      if (startDate) {
        const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
        durationDays = Math.max(1, Math.round(ms / 86400000) + 1);
      }
      const pagesPerDay = book.pages && durationDays ? Math.round(book.pages / durationDays) : null;

      setCompletionStats({ startDate, endDate, durationDays, pagesPerDay });
      setReviewRating(0);
      setReviewText("");
      setSaving(false);
      setStep("complete");
      return;
    }

    setSaving(false);
    // Vérifie les badges après chaque session (pas seulement à la fin d'un livre).
    triggerBadgeCheck(user.id);
    onSaved(
      diff < 0
        ? `Correction : retour page ${target}.`
        : diff > 0
          ? `Session enregistrée : +${diff} pages.`
          : hasSessionExtras
            ? "Note de session enregistrée."
            : "Aucune modification."
    );
    onClose();
  };

  const triggerBadgeCheck = (userId: string) => {
    fetch("/api/badges/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
      .then((r) => r.json())
      .then((data: { awarded?: { id: string }[] }) => {
        if (data.awarded?.length) {
          window.dispatchEvent(new CustomEvent("swena:badges-awarded", { detail: data.awarded }));
        }
      })
      .catch(() => {});
  };

  const submitReview = async () => {
    if (!book || !user) return;
    setSaving(true);
    const upd: Record<string, unknown> = {};
    if (reviewRating > 0) upd.rating = reviewRating;
    if (reviewText.trim()) upd.notes = reviewText.trim();
    if (Object.keys(upd).length > 0) {
      await supabase.from("books").update(upd).eq("id", book.id);
    }
    setSaving(false);
    triggerBadgeCheck(user.id);
    onSaved(`« ${book.title} » terminé — bravo !`);
    onClose();
  };

  const skipReview = () => {
    if (user) triggerBadgeCheck(user.id);
    onSaved(`« ${book?.title} » terminé, bravo !`);
    onClose();
  };

  // ── Render : étape "complete" ───────────────────────────────────────────
  if (step === "complete" && book && completionStats) {
    return (
      <Modal
        open={open}
        onClose={skipReview}
        title=""
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={skipReview} className="flex-1 py-3">
              Passer
            </Button>
            <Button onClick={submitReview} disabled={saving} className="flex-1 py-3">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          {/* Header célébration */}
          <div className="-mx-5 -mt-2 flex flex-col items-center gap-3 rounded-t-2xl bg-gradient-to-br from-violet/90 to-violet-deep px-5 py-6 text-center">
            <div className="flex gap-2">
              {book.cover_url ? (
                <Cover
                  id={book.id}
                  title={book.title}
                  coverUrl={book.cover_url}
                  className="h-[80px] w-[55px] shadow-xl"
                  rounded="rounded-lg"
                />
              ) : (
                <div className="text-4xl">📚</div>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60">Lecture terminée !</p>
              <p className="mt-0.5 font-serif text-lg font-black leading-tight text-cream">{book.title}</p>
              <p className="text-xs text-white/60">{book.author}</p>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2">
            {completionStats.startDate && (
              <div className="rounded-2xl bg-violet-soft px-4 py-3">
                <p className="text-[9.5px] font-semibold uppercase tracking-wide text-muted">Commencé le</p>
                <p className="mt-0.5 font-serif text-[13px] font-bold text-ink">
                  {fmtDate(completionStats.startDate)}
                </p>
              </div>
            )}
            <div className="rounded-2xl bg-violet-soft px-4 py-3">
              <p className="text-[9.5px] font-semibold uppercase tracking-wide text-muted">Terminé le</p>
              <p className="mt-0.5 font-serif text-[13px] font-bold text-ink">
                {fmtDate(completionStats.endDate)}
              </p>
            </div>
            <div className="rounded-2xl bg-violet-soft px-4 py-3">
              <p className="text-[9.5px] font-semibold uppercase tracking-wide text-muted">Durée totale</p>
              <p className="mt-0.5 font-serif text-[22px] font-black leading-none text-violet-deep">
                {completionStats.durationDays}
                <span className="ml-1 font-sans text-[13px] font-semibold text-muted">
                  jour{completionStats.durationDays > 1 ? "s" : ""}
                </span>
              </p>
            </div>
            {completionStats.pagesPerDay != null && (
              <div className="rounded-2xl bg-violet-soft px-4 py-3">
                <p className="text-[9.5px] font-semibold uppercase tracking-wide text-muted">Rythme moyen</p>
                <p className="mt-0.5 font-serif text-[22px] font-black leading-none text-violet-deep">
                  {completionStats.pagesPerDay}
                  <span className="ml-1 font-sans text-[13px] font-semibold text-muted">p./j</span>
                </p>
              </div>
            )}
          </div>

          {/* Séparateur */}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-line" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">Ta critique</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          {/* Review */}
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            rows={3}
            placeholder="Qu'as-tu pensé de ce livre ? (optionnel)"
            className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-violet dark:bg-input dark:text-ink"
          />

          {/* Note avec slider décimal */}
          <div className="flex flex-col items-center gap-2.5">
            <div className="flex items-center gap-3">
              <StarFill value={reviewRating} />
              <span className="font-serif text-[22px] font-black text-ink">
                {reviewRating > 0
                  ? reviewRating.toFixed(1).replace(".", ",")
                  : "—"}
                <span className="ml-1 font-sans text-xs font-normal text-muted">/ 5</span>
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={Math.round(reviewRating * 10)}
              onChange={(e) => setReviewRating(Number(e.target.value) / 10)}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-violet"
            />
            <p className="text-[10.5px] text-muted">
              {reviewRating === 0 ? "Glisse pour noter (optionnel)" : `Note : ${reviewRating.toFixed(1).replace(".", ",")} / 5`}
            </p>
          </div>

        </div>
      </Modal>
    );
  }

  // ── Render : étape "log" ────────────────────────────────────────────────
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Noter ma lecture"
      footer={
        books.length === 0 ? undefined : (
          <div className="flex flex-col gap-2">
            {error && <p className="text-xs font-medium text-danger">{error}</p>}
            <Button onClick={handleSave} disabled={saving || !validNumber} className="w-full">
              {saving
                ? "Enregistrement…"
                : book && validNumber && target === book.pages
                  ? "Terminer le livre ✓"
                  : "Enregistrer la session"}
            </Button>
            <p className="text-[11px] leading-4 text-muted">
              La progression et la durée de lecture se mettent à jour automatiquement.
            </p>
          </div>
        )
      }
    >
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
            {/* Badge "Livre terminé" quand la page = total */}
            {book && validNumber && target === book.pages && (
              <p className="mt-1.5 text-[11.5px] font-semibold text-violet-deep">
                ✓ Lecture terminée !
              </p>
            )}
          </div>

          {validNumber && diff !== 0 && (
            <div
              className={`flex items-center justify-between rounded-xl px-3.5 py-3 ${
                diff > 0 ? "bg-violet-soft" : "bg-danger-soft"
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
              {/* Évaluation de session */}
              <div>
                <FieldLabel>Évaluation de session (optionnel)</FieldLabel>
                <div className="mt-1">
                  <SessionStarRating value={sessionRating} onChange={setSessionRating} />
                </div>
              </div>

              <div>
                <FieldLabel>Note de session (optionnel)</FieldLabel>
                <RichTextEditor
                  value={sessionNotes}
                  onChange={setSessionNotes}
                  placeholder="Impressions, citations, contexte de lecture…"
                />
              </div>
              <div>
                <FieldLabel>Photo de session (optionnel)</FieldLabel>
                {sessionPhotoUrl ? (
                  <div className="relative mt-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sessionPhotoUrl}
                      alt="Photo de session"
                      className="h-32 w-full rounded-xl object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setSessionPhotoUrl("")}
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-[11px] text-white"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-input px-4 py-3 text-xs font-medium text-muted transition-colors hover:border-violet hover:text-violet-deep">
                    {photoUploading ? (
                      <span>Upload en cours…</span>
                    ) : (
                      <>
                        <span className="text-base">📷</span>
                        <span>Choisir une photo / prendre en direct</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={photoUploading}
                    />
                  </label>
                )}
              </div>
            </div>
          )}

        </div>
      )}
    </Modal>
  );
}
