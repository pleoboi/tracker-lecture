"use client";

import { useState } from "react";

/**
 * Bloc de fin d'accueil : un bouton pour partager le lien d'inscription à des amis.
 * Utilise le partage natif du téléphone (Messages, WhatsApp...), sinon copie le lien.
 * Le lien contient ton identifiant de parrain et présélectionne l'univers affiché.
 */
export default function ShareInviteCard({ userId, universe }: { userId?: string; universe: "books" | "manga" }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const manga = universe === "manga";

  const share = async () => {
    if (!userId) return;
    const url = `${window.location.origin}/register?ref=${userId}&univers=${manga ? "manga" : "livres"}`;
    const text = manga
      ? "Rejoins-moi sur Swena : suis tes mangas, note tes chapitres et vois ce que lisent tes amis."
      : "Rejoins-moi sur Swena : suis tes lectures, fixe-toi des objectifs et vois ce que lisent tes amis.";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Rejoins-moi sur Swena", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setFeedback("Lien copié, colle-le dans ta conversation.");
    } catch (e) {
      // Partage annulé par l'utilisateur : rien à dire. Autre erreur : on tente la copie.
      if (e instanceof DOMException && e.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        setFeedback("Lien copié, colle-le dans ta conversation.");
      } catch {
        setFeedback(url);
      }
    }
    setTimeout(() => setFeedback(null), 4000);
  };

  if (!userId) return null;

  return (
    <section
      className={`flex flex-col items-center gap-3 px-5 py-6 text-center ${
        manga ? "manga-panel" : "rounded-2xl border border-line bg-card"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7 text-violet-deep" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <path d="M18 8v6M15 11h6" />
      </svg>
      <div>
        <p className="font-serif text-[17px] font-bold text-ink">Swena, c&apos;est mieux entre amis</p>
        <p className="mx-auto mt-0.5 max-w-[260px] text-[12.5px] leading-snug text-muted">
          {manga ? "Invite tes amis à suivre leurs mangas avec toi." : "Invite tes amis à lire avec toi et à se challenger."}
        </p>
      </div>
      <button
        onClick={share}
        className={`btn-press rounded-xl px-6 py-2.5 text-[13px] font-bold text-cream ${
          manga ? "border-2 border-ink bg-violet shadow-[3px_3px_0_var(--color-ink)]" : "bg-violet transition-opacity hover:opacity-90"
        }`}
      >
        Partager le lien
      </button>
      {feedback && <p className="max-w-full break-all text-[12px] font-semibold text-violet-deep">{feedback}</p>}
    </section>
  );
}
