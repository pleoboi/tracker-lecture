"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "./ui";
import { useAuth } from "../lib/auth-context";
import { addQuote, MAX_QUOTE } from "../lib/quotes";

export type QuoteBook = { id: number; title: string; author: string; cover_url?: string | null };

/** Remet en forme le texte lu sur une photo : coupures de mots, retours à la ligne au milieu des phrases. */
function tidyOcr(raw: string): string {
  return raw
    .replace(/-\n(?=\p{Ll})/gu, "")
    .replace(/\n{2,}/g, "\u0000")
    .replace(/\n/g, " ")
    .replace(/\u0000/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function readPhoto(file: File, onProgress: (p: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("fra", 1, {
    logger: (m: { status: string; progress: number }) => { if (m.status === "recognizing text") onProgress(m.progress); },
  });
  try {
    const { data } = await worker.recognize(file);
    return tidyOcr(data.text);
  } finally {
    await worker.terminate();
  }
}

/**
 * Ajout d'une citation : saisie à la main, ou photo de la page dont le texte est lu sur l'appareil
 * (rien n'est envoyé à un serveur) puis corrigé avant enregistrement.
 */
export default function QuoteComposer({ open, onClose, books, defaultBookId, onSaved }: {
  open: boolean;
  onClose: () => void;
  books: QuoteBook[];
  defaultBookId?: number;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const [bookId, setBookId] = useState<number | null>(null);
  const [body, setBody] = useState("");
  const [page, setPage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scanned, setScanned] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setBookId(defaultBookId ?? books[0]?.id ?? null);
    setBody(""); setPage(""); setError(null); setScanning(false); setScanned(false); setProgress(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const book = books.find((b) => b.id === bookId) ?? null;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError(null);
    setScanning(true);
    setProgress(0);
    try {
      const text = await readPhoto(f, setProgress);
      if (!text) setError("Je n'ai pas réussi à lire de texte sur cette photo. Cadre mieux la page, ou écris la citation à la main.");
      else { setBody(text.slice(0, MAX_QUOTE)); setScanned(true); }
    } catch {
      setError("La lecture de la photo a échoué (connexion nécessaire la première fois). Écris la citation à la main.");
    }
    setScanning(false);
  };

  const save = async () => {
    if (!user?.id || !book || saving) return;
    setSaving(true);
    setError(null);
    const r = await addQuote({ userId: user.id, book, body, page: Number(page) || null });
    setSaving(false);
    if (!r.ok) { setError(r.error ?? "Erreur."); return; }
    onSaved?.();
    onClose();
  };

  const can = !!book && body.trim().length >= 3 && !saving && !scanning;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajouter une citation"
      footer={
        <button
          onClick={() => void save()}
          disabled={!can}
          className="w-full rounded-2xl bg-violet py-3.5 text-[14px] font-bold text-cream transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {saving ? "Enregistrement…" : "Enregistrer la citation"}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        {books.length > 1 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-muted">Livre</span>
            <select
              value={bookId ?? ""}
              onChange={(e) => setBookId(Number(e.target.value))}
              className="rounded-xl border border-line bg-input px-3 py-2.5 text-[14px] text-ink outline-none focus:border-violet"
            >
              {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
          </label>
        )}
        {books.length === 1 && book && (
          <p className="text-[13px] text-muted">Pour <span className="font-semibold text-ink">{book.title}</span></p>
        )}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={scanning}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-card px-3 py-3 text-[13.5px] font-semibold text-ink-2 transition-[transform,border-color] duration-[140ms] hover:border-violet active:scale-[0.98] disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z" />
            <circle cx="12" cy="13" r="3.2" />
          </svg>
          {scanning ? `Lecture de la page… ${Math.round(progress * 100)} %` : "Photographier la page"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
        {scanning && (
          <div className="-mt-2 h-1 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-violet transition-[width] duration-200" style={{ width: `${Math.max(6, progress * 100)}%` }} />
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between text-[12px] font-semibold text-muted">
            Citation
            <span className="font-normal">{body.length} / {MAX_QUOTE}</span>
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_QUOTE))}
            rows={6}
            placeholder="Recopie le passage ici"
            className="resize-none rounded-xl border border-line bg-input px-3.5 py-2.5 font-serif text-[15px] italic leading-relaxed text-ink outline-none focus:border-violet"
          />
          {scanned && <span className="text-[11.5px] text-muted">Texte lu sur la photo : relis-le et corrige les erreurs avant d&apos;enregistrer.</span>}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-muted">Page (facultatif)</span>
          <input
            value={page}
            onChange={(e) => setPage(e.target.value.replace(/\D/g, "").slice(0, 5))}
            inputMode="numeric"
            placeholder="Ex. 142"
            className="w-28 rounded-xl border border-line bg-input px-3 py-2.5 text-[14px] text-ink outline-none focus:border-violet"
          />
        </label>

        {error && <p className="text-[12.5px] font-medium text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
