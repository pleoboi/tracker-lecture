"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";

/* ── Mini-aperçus illustrant chaque étape ──────────────────────────────── */

function VisualWelcome() {
  return (
    <div className="flex items-end justify-center gap-2">
      {[
        { c: "#6b5b95", h: "72px" },
        { c: "#4f46e5", h: "92px" },
        { c: "#7c5e3b", h: "80px" },
        { c: "#8b5a6b", h: "64px" },
      ].map((b, i) => (
        <div
          key={i}
          className="w-[26px] rounded-md shadow-sm"
          style={{ backgroundColor: b.c, height: b.h }}
        />
      ))}
    </div>
  );
}

function VisualAddBook() {
  return (
    <div className="w-full max-w-[230px] rounded-xl border border-line bg-card p-2.5">
      <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-input px-2 py-1.5">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-muted">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <span className="text-[9.5px] text-muted">Germinal</span>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-violet/30 bg-violet-soft p-1.5">
        <div className="h-[34px] w-[24px] shrink-0 rounded" style={{ backgroundColor: "#7c5e3b" }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[9px] font-semibold text-ink">Germinal</p>
          <p className="text-[8px] text-muted">Émile Zola · 1885</p>
        </div>
        <span className="shrink-0 rounded-md bg-violet px-1.5 py-0.5 text-[8px] font-bold text-cream">+</span>
      </div>
      <p className="mt-1.5 text-center text-[8px] text-muted">
        Couverture, résumé et pages remplis tout seuls
      </p>
    </div>
  );
}

function VisualSession() {
  return (
    <div className="w-full max-w-[230px] rounded-xl border border-line bg-card p-3">
      <p className="mb-2 text-[8.5px] font-semibold uppercase tracking-wide text-muted">Page d&apos;arrêt</p>
      <div className="mb-2 flex items-baseline gap-1.5">
        <span className="font-serif text-[26px] font-black text-ink">212</span>
        <span className="text-[10px] text-muted">/ 448</span>
      </div>
      <div className="mb-2 h-[5px] w-full overflow-hidden rounded-full bg-line">
        <div className="h-full w-1/2 rounded-full bg-violet" />
      </div>
      <div className="flex items-center justify-between rounded-lg bg-violet-soft px-2 py-1.5">
        <span className="text-[9px] font-medium text-violet-deep">Lu aujourd&apos;hui</span>
        <span className="text-[9.5px] font-bold text-violet-deep">+ 34 pages</span>
      </div>
    </div>
  );
}

function VisualClub() {
  return (
    <div className="flex w-full max-w-[230px] flex-col gap-1.5">
      <div className="rounded-xl px-2.5 py-2" style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
        <p className="text-[7.5px] font-semibold uppercase tracking-wider text-white/60">Champion du jour</p>
        <div className="flex items-baseline justify-between">
          <span className="font-serif text-[13px] font-black text-[#fde68a]">Céline</span>
          <span className="text-[11px] font-bold text-white">64 p.</span>
        </div>
      </div>
      {[
        { n: "Sara", t: "a aimé ta note", i: "♥" },
        { n: "Nicolas", t: "te recommande un livre", i: "📚" },
      ].map((r) => (
        <div key={r.n} className="flex items-center gap-2 rounded-xl border border-line bg-card px-2 py-1.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet text-[8px] font-bold text-cream">
            {r.n[0]}
          </span>
          <p className="min-w-0 flex-1 truncate text-[9px] text-ink-2">
            {r.n} {r.t}
          </p>
          <span className="text-[9px]">{r.i}</span>
        </div>
      ))}
    </div>
  );
}

function VisualInstall() {
  return (
    <div className="relative w-[92px] rounded-2xl border-2 border-line bg-card p-1.5">
      <div className="relative overflow-hidden rounded-xl bg-paper px-2 py-3">
        <div className="absolute left-1/2 top-1 h-1.5 w-7 -translate-x-1/2 rounded-full bg-card" />
        <div className="mt-2 flex flex-col items-center gap-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-soft">
            <svg viewBox="0 0 100 76" className="h-4 w-4 text-violet" fill="currentColor">
              <path d="M8,68 C2,68 0,64 0,60 C0,52 4,48 12,48 C10,38 16,32 26,32 C24,24 30,18 40,18 C50,18 56,24 58,32 C62,30 70,30 74,36 C82,32 92,38 90,48 C90,56 86,64 78,66 C78,68 76,68 70,68 Z" />
            </svg>
          </div>
          <span className="font-serif text-[8px] font-bold text-ink">Swena</span>
        </div>
      </div>
    </div>
  );
}

/* ── Étapes ────────────────────────────────────────────────────────────── */

const SLIDES = [
  {
    label: "Bienvenue",
    title: "Bienvenue sur Swena",
    body: "Ton carnet de lecture, en plus vivant. Tu notes ce que tu lis, tu vois ta progression, et tu partages tout ça avec tes amis.\n\nTrois écrans à retenir, c'est parti.",
    visual: <VisualWelcome />,
  },
  {
    label: "Étape 1",
    title: "Ajoute un livre",
    body: "Appuie sur le bouton + puis cherche ton livre par son titre. La couverture, le résumé, l'année et le nombre de pages sont récupérés automatiquement.",
    visual: <VisualAddBook />,
  },
  {
    label: "Étape 2",
    title: "Note ta session",
    body: "Après ta lecture, indique simplement la page où tu t'es arrêté. Swena calcule les pages lues, ton rythme et ta progression.\n\nTu peux y ajouter une note ou une photo.",
    visual: <VisualSession />,
  },
  {
    label: "Étape 3",
    title: "Retrouve ton club",
    body: "L'accueil affiche l'activité de tes amis : ce qu'ils lisent, leurs notes, le champion du jour. Tu peux aimer, commenter et recommander des livres.",
    visual: <VisualClub />,
  },
  {
    label: "Astuce",
    title: "Installe l'app sur ton téléphone",
    body: "Sur iPhone : bouton Partager, puis « Sur l'écran d'accueil ».\nSur Android : menu ⋮, puis « Ajouter à l'écran d'accueil ».\n\nTu viens de Goodreads ? Importe ton historique depuis Mon compte.",
    visual: <VisualInstall />,
  },
];

export default function GuideModal({
  userId,
  open,
  onClose,
  onAddBook,
}: {
  userId?: string;
  open: boolean;
  onClose: () => void;
  /** Appelé à la fin du guide pour enchaîner sur l'ajout d'un premier livre. */
  onAddBook?: () => void;
}) {
  const [step, setStep] = useState(0);

  if (!open || typeof document === "undefined") return null;

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const markSeen = async () => {
    if (!userId) return;
    if (typeof window !== "undefined") {
      localStorage.setItem(`onboarding_done_${userId}`, "1");
    }
    await supabase
      .from("user_profiles")
      .upsert({ id: userId, has_seen_onboarding: true }, { onConflict: "id" });
  };

  const handleClose = async () => {
    await markSeen();
    setStep(0);
    onClose();
  };

  const handleFinish = async () => {
    await markSeen();
    setStep(0);
    onClose();
    onAddBook?.();
  };

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-paper shadow-2xl sm:rounded-3xl">
        {/* En-tête */}
        <div className="flex shrink-0 items-center justify-between px-6 pb-2 pt-4">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.15em] text-violet">
            {slide.label}
          </span>
          <button
            onClick={handleClose}
            className="text-[11.5px] font-medium text-muted transition-colors hover:text-ink"
          >
            Passer
          </button>
        </div>

        {/* Corps défilant */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          <div className="mb-6 flex min-h-[132px] items-center justify-center rounded-2xl bg-violet-soft/60 px-4 py-5">
            {slide.visual}
          </div>

          <h2 className="font-serif text-[22px] font-bold leading-tight text-ink">
            {slide.title}
          </h2>
          <p
            className="mt-2.5 text-[13.5px] leading-relaxed text-muted"
            style={{ whiteSpace: "pre-line" }}
          >
            {slide.body}
          </p>
        </div>

        {/* Pied : progression + actions */}
        <div className="shrink-0 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5">
          <div className="mb-4 flex items-center justify-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-2 rounded-full transition-all duration-200 ${
                  i === step ? "w-6 bg-violet" : "w-2 bg-line hover:bg-muted/40"
                }`}
                aria-label={`Étape ${i + 1}`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="rounded-2xl border border-line bg-card px-5 py-3.5 text-[14px] font-medium text-ink-2 transition-colors hover:text-ink"
              >
                Retour
              </button>
            )}
            <button
              onClick={isLast ? handleFinish : () => setStep((s) => s + 1)}
              className="flex-1 rounded-2xl bg-violet py-3.5 text-[15px] font-bold text-cream transition-opacity hover:opacity-90 active:scale-[0.98]"
            >
              {isLast ? "Ajouter mon premier livre" : "Suivant →"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
