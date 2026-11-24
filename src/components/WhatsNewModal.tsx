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

function VisualQuiz() {
  return (
    <div className="w-full max-w-[230px]">
      <p className="text-[7.5px] font-bold uppercase tracking-widest text-violet-deep">Question de lecture · 50 %</p>
      <p className="mt-1 font-serif text-[10.5px] font-bold leading-tight text-ink">Qui fait chasser Boule de Neige de la ferme ?</p>
      <div className="mt-2 flex flex-col gap-1">
        {["Malabar", "Napoléon", "Old Major"].map((o, i) => (
          <div key={o} className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-[8.5px] text-ink ${i === 1 ? "border-success bg-success/10" : "border-line bg-card"}`}>
            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-paper text-[6.5px] font-bold text-muted">{"ABC"[i]}</span>
            {o}
            {i === 1 && <span className="ml-auto text-[8px] font-black text-success">+10 XP</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function VisualStats() {
  return (
    <div className="flex w-full max-w-[230px] items-end gap-3">
      <div className="flex flex-1 flex-wrap gap-1">
        {[["Roman", "#8b5cf6", 11], ["Thriller", "#ec4899", 9.5], ["Fantasy", "#f59e0b", 9], ["Essai", "#10b981", 8]].map(([g, c, s]) => (
          <span key={g as string} className="rounded-full border px-1.5 py-0.5 font-semibold"
            style={{ fontSize: `${s}px`, color: c as string, borderColor: `${c}55`, backgroundColor: `${c}1a` }}>{g}</span>
        ))}
      </div>
      <div className="relative h-[58px] w-[58px] shrink-0 rounded-full" style={{ background: "conic-gradient(#ec4899 0 72%, #6366f1 72% 100%)" }}>
        <div className="absolute inset-[11px] flex items-center justify-center rounded-full bg-paper text-[10px] font-black text-ink">24</div>
      </div>
    </div>
  );
}

function VisualChat() {
  return (
    <div className="w-full max-w-[220px] overflow-hidden rounded-xl border border-line bg-paper shadow">
      <div className="flex items-center gap-1.5 border-b border-line bg-card px-2 py-1.5">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-violet text-[7px] font-bold text-cream">C</span>
        <span className="text-[8.5px] font-bold text-ink">Camille</span>
        <span className="ml-auto text-[7.5px] font-semibold text-violet-deep">Ouvrir</span>
      </div>
      <div className="flex flex-col gap-1 p-2">
        <span className="self-start rounded-xl rounded-bl-sm border border-line bg-card px-2 py-1 text-[8.5px] text-ink">Tu as fini Dune ?</span>
        <span className="self-end rounded-xl rounded-br-sm bg-violet px-2 py-1 text-[8.5px] text-cream">Hier soir, quelle fin !</span>
      </div>
    </div>
  );
}

function VisualLog() {
  return (
    <div className="w-full max-w-[230px]">
      <div className="flex gap-1.5">
        {["#5b6bb5", "#c49ab5", "#a7b29a"].map((c, i) => (
          <div key={c} className={`h-[42px] w-[29px] rounded ${i === 0 ? "ring-2 ring-violet ring-offset-1 ring-offset-paper" : "opacity-50"}`} style={{ background: c }} />
        ))}
      </div>
      <p className="mt-2 text-[8px] font-semibold uppercase tracking-wider text-muted">Note du passage lu</p>
      <p className="text-[15px] leading-none tracking-[2px] text-gold">★★★★<span className="text-line">★</span></p>
      <div className="mt-1.5 rounded-md border border-line bg-card px-1.5 py-1 text-[8px] text-muted">Ce passage était…</div>
    </div>
  );
}

function VisualPrivate() {
  return (
    <div className="w-full max-w-[220px] rounded-xl border border-line bg-card p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-serif text-[10px] font-bold text-ink">Compte privé</p>
          <p className="text-[7.5px] text-muted">Champion du jour entre amis</p>
        </div>
        <span className="flex h-4 w-7 items-center justify-end rounded-full bg-violet p-0.5"><span className="h-3 w-3 rounded-full bg-white" /></span>
      </div>
      <div className="mt-2 grid grid-cols-6 gap-1">
        {["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"].map((c) => (
          <div key={c} className="aspect-square rounded" style={{ background: `${c}55` }} />
        ))}
      </div>
      <p className="mt-1 text-[7.5px] font-semibold text-muted">Galerie de tes photos de lecture</p>
    </div>
  );
}

const SLIDES = [
  {
    label: "Nouveau",
    title: "Un quiz sur ta lecture",
    body: "À la moitié et à la fin d'un livre, une question à choix multiples t'attend sur ce que tu viens de lire. Bonne réponse : +10 XP, et l'explication s'affiche dans tous les cas.",
    visual: <VisualQuiz />,
  },
  {
    label: "Nouveau",
    title: "Des statistiques à toucher",
    body: "La page Statistiques a été refaite : genres, fiction ou non-fiction, longueur, époques, auteurs, coups de cœur. Touche un chiffre pour voir les livres qui se cachent derrière.",
    visual: <VisualStats />,
  },
  {
    label: "Nouveau",
    title: "Écris à tes amis",
    body: "Touche « Message » sur le profil d'un membre pour discuter. Quand on t'écrit, une petite fenêtre s'ouvre pour répondre tout de suite. Tes conversations sont dans l'icône bulle, en haut.",
    visual: <VisualChat />,
  },
  {
    label: "Amélioré",
    title: "Noter ta lecture, en plus simple",
    body: "Choisis ton livre par sa couverture, puis note le passage que tu viens de lire et ajoute une mini-review si tu veux. Tout est facultatif.",
    visual: <VisualLog />,
  },
  {
    label: "Nouveau",
    title: "Compte privé et galerie",
    body: "Dans Mon compte, passe en privé : le champion du jour se joue alors seulement entre toi et tes amis. Et ton profil a maintenant un onglet Galerie avec toutes tes photos de lecture.",
    visual: <VisualPrivate />,
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
