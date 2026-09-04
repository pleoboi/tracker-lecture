"use client";

import { createPortal } from "react-dom";
import { useState } from "react";

/**
 * Annonce des nouveautés récentes, montrée une fois aux comptes déjà en
 * place (onboarding déjà vu). Purement local (localStorage) : pas de
 * colonne DB dédiée, cohérent avec le flag `referral_prompt_seen_*` déjà
 * utilisé pour ce genre de rappel ponctuel. Incrémenter WHATS_NEW_VERSION
 * dans AppShell.tsx pour refaire apparaître une nouvelle annonce plus tard.
 */

/* ── Aperçus illustrant chaque nouveauté ───────────────────────────────── */

function VisualCommunaute() {
  return (
    <div className="w-full max-w-[230px]">
      <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-input px-2 py-1.5">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-muted">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <span className="text-[9.5px] text-muted">Un club ou un livre…</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {[
          { name: "Club Polar", c: "#4f46e5" },
          { name: "Lecture d'été", c: "#8b5a6b" },
        ].map((club) => (
          <div key={club.name} className="overflow-hidden rounded-lg border border-line bg-card">
            <div className="h-6" style={{ background: club.c }} />
            <p className="truncate px-1.5 py-1 text-[8px] font-semibold text-ink">{club.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisualScanner() {
  return (
    <div className="relative mx-auto w-[110px] overflow-hidden rounded-2xl border-2 border-line bg-[#111]">
      <div className="flex h-[130px] items-center justify-center">
        <div className="relative h-[46px] w-[80px] rounded-lg border-2 border-white/85">
          <div className="absolute inset-x-3 top-1/2 flex -translate-y-1/2 gap-[1.5px]">
            {[2, 1, 3, 1, 2, 1, 3, 2, 1, 2].map((w, i) => (
              <div key={i} className="h-4 bg-white/90" style={{ width: `${w}px` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function VisualLeaderboard() {
  return (
    <div className="w-full max-w-[230px]">
      <div className="mb-2 flex justify-end gap-1">
        <div className="flex overflow-hidden rounded-full border border-line text-[7.5px] font-semibold">
          <span className="bg-violet px-1.5 py-0.5 text-cream">Mois</span>
          <span className="bg-card px-1.5 py-0.5 text-muted">Année</span>
        </div>
        <div className="flex overflow-hidden rounded-full border border-line text-[7.5px] font-semibold">
          <span className="bg-violet px-1.5 py-0.5 text-cream">Pages</span>
          <span className="bg-card px-1.5 py-0.5 text-muted">Livres</span>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-card">
        {[
          { n: "Céline", v: "612", i: 1 },
          { n: "Toi", v: "588", i: 2, me: true },
          { n: "Nicolas", v: "540", i: 3 },
        ].map((r) => (
          <div key={r.n} className={`flex items-center gap-2 px-2 py-1.5 ${r.me ? "bg-violet-soft" : ""}`}>
            <span className="w-3 text-[8px] font-bold text-muted">{r.i}</span>
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet text-[7px] font-bold text-cream">
              {r.n[0]}
            </span>
            <span className="flex-1 truncate text-[8.5px] font-medium text-ink">{r.n}</span>
            <span className="text-[8.5px] font-bold text-ink">{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SLIDES = [
  {
    label: "Nouveau",
    title: "La Communauté",
    body: "Découverte et clubs de lecture n'en font plus qu'un. Une seule recherche pour trouver un club ou un livre, et tes suggestions de prochaines lectures personnalisées, au même endroit.",
    visual: <VisualCommunaute />,
  },
  {
    label: "Nouveau",
    title: "Scanne un livre",
    body: "Dans « Ajouter un livre », vise le code-barres au dos avec ta caméra : Swena retrouve le livre et remplit couverture, résumé et infos tout seul.",
    visual: <VisualScanner />,
  },
  {
    label: "Nouveau",
    title: "Un classement à ta façon",
    body: "Le classement de la Communauté se règle maintenant comme tu veux : sur le mois ou l'année, en pages ou en livres lus.",
    visual: <VisualLeaderboard />,
  },
];

export default function WhatsNewModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);

  if (!open || typeof document === "undefined") return null;

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const handleClose = () => {
    setStep(0);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-paper shadow-2xl sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between px-6 pb-2 pt-4">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.15em] text-violet">
            {slide.label} · {step + 1}/{SLIDES.length}
          </span>
          <button
            onClick={handleClose}
            className="text-[11.5px] font-medium text-muted transition-colors hover:text-ink"
          >
            Passer
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          <div className="mb-6 flex min-h-[132px] items-center justify-center rounded-2xl bg-violet-soft/60 px-4 py-5">
            {slide.visual}
          </div>

          <h2 className="font-serif text-[22px] font-bold leading-tight text-ink">
            {slide.title}
          </h2>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted" style={{ whiteSpace: "pre-line" }}>
            {slide.body}
          </p>
        </div>

        <div className="shrink-0 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5">
          <div className="mb-4 flex items-center justify-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-2 rounded-full transition-all duration-200 ${
                  i === step ? "w-6 bg-violet" : "w-2 bg-line hover:bg-muted/40"
                }`}
                aria-label={`Nouveauté ${i + 1}`}
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
              onClick={isLast ? handleClose : () => setStep((s) => s + 1)}
              className="flex-1 rounded-2xl bg-violet py-3.5 text-[15px] font-bold text-cream transition-opacity hover:opacity-90 active:scale-[0.98]"
            >
              {isLast ? "Compris !" : "Suivant →"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
