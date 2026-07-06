"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

/* ── Icônes SVG (Lucide-style, stroke currentColor) ─────────────────── */

function IconBook() {
  return (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="12" y1="6" x2="16" y2="6" />
      <line x1="12" y1="10" x2="16" y2="10" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconLibrary() {
  return (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="5" height="18" rx="1" />
      <rect x="10" y="3" width="5" height="18" rx="1" />
      <path d="M17.3 3.6l3.8 14.6a1 1 0 0 1-.7 1.2l-1 .3a1 1 0 0 1-1.2-.7L14.4 4.5" />
    </svg>
  );
}

function IconPen() {
  return (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      <line x1="3" y1="12" x2="9" y2="12" opacity="0.35" />
      <line x1="3" y1="16" x2="7" y2="16" opacity="0.35" />
    </svg>
  );
}

function IconClub() {
  return (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
      <polyline points="2 10 7 5 12 9 17 3" strokeWidth="1.5" />
      <circle cx="17" cy="3" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2" />
      <polyline points="9 8 12 5 15 8" />
      <line x1="12" y1="5" x2="12" y2="13" />
    </svg>
  );
}

const SLIDE_ICONS = [
  <IconBook key="book" />,
  <IconDownload key="dl" />,
  <IconLibrary key="lib" />,
  <IconPen key="pen" />,
  <IconClub key="club" />,
  <IconChart key="chart" />,
  <IconPhone key="phone" />,
];

const SLIDES = [
  {
    label: "Bienvenue",
    title: "Bienvenue au Club !",
    body: "Un réseau social de lecture pensé pour toi et ton cercle.\n\nSuis tes lectures, partage ton activité et découvre ce que lisent les autres membres de ton club — au même endroit.",
  },
  {
    label: "Import Goodreads",
    title: "Importe ton historique",
    body: "Tu as déjà beaucoup lu ? Rapatrie tout en un clic.\n\nVa dans Mon Compte → Import Goodreads, puis exporte ton CSV depuis le site Goodreads (Mon profil → Importer/Exporter) et charge le fichier ici.\n\n⚠ L'export Goodreads n'est possible que sur ordinateur — l'application mobile ne le permet pas.",
  },
  {
    label: "Bibliothèque",
    title: "Gère ta Bibliothèque",
    body: "Ajoute tes livres via la recherche, change leur statut (En cours · Terminé · Abandonné) et personnalise leur genre.\n\nChoisis ton Top 4 Favoris — affiché sur ton profil public à la manière de Letterboxd.",
  },
  {
    label: "Sessions",
    title: "Note tes sessions",
    body: "Enregistre chaque session de lecture comme sur Strava : nombre de pages lues, note du moment, commentaire libre et même une photo depuis ta pellicule.\n\nChaque entrée alimente tes graphiques en temps réel.",
  },
  {
    label: "Club",
    title: "La vie du Club",
    body: "Sur l'Accueil, retrouve l'activité de tous les membres en temps réel, filtrée sur les 3 derniers jours.\n\nClique sur les avatars pour voir leur profil, leurs lectures du moment et leurs avis complets sur chaque livre.",
  },
  {
    label: "Statistiques",
    title: "Analyse tes Statistiques",
    body: "Tes pages lues, ton rythme quotidien, ton classement par auteur et tes objectifs annuels et mensuels — tout est dans l'onglet Statistiques.\n\nLes graphiques des autres membres sont visibles sur leurs profils.",
  },
  {
    label: "Installation",
    title: "Installe l'appli sur ton téléphone",
    body: "Accède à l'application comme une vraie app, sans passer par le navigateur.\n\nSur iPhone (Safari) :\n1. Appuie sur les ••• en bas à droite\n2. Appuie sur l'icône Partager ↑\n3. Choisis « Sur l'écran d'accueil »\n\nSur Android (Chrome) :\n1. Appuie sur les ⋮ en haut à droite\n2. Choisis « Ajouter à l'écran d'accueil »\n\nL'icône apparaît comme une app native — sans pub, sans Store.",
  },
];

export default function GuideModal({
  userId,
  open,
  onClose,
}: {
  userId?: string;
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);

  if (!open) return null;

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const handleClose = async () => {
    if (userId) {
      if (typeof window !== "undefined") {
        localStorage.setItem(`onboarding_done_${userId}`, "1");
      }
      await supabase
        .from("user_profiles")
        .upsert({ id: userId, has_seen_onboarding: true }, { onConflict: "id" });
    }
    setStep(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-t-[28px] bg-paper px-6 pb-10 pt-4 shadow-2xl sm:rounded-3xl">
        {/* Handle mobile */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-line sm:hidden" />

        {/* Top row : label + croix */}
        <div className="mb-7 flex items-center justify-between">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.15em] text-violet">
            {slide.label}
          </span>
          <button
            onClick={handleClose}
            aria-label="Fermer"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-card text-[12px] text-muted transition-colors hover:border-violet/40 hover:text-ink"
          >
            ✕
          </button>
        </div>

        {/* Illustration */}
        <div className="mb-7 flex justify-center">
          <div className="flex h-[120px] w-[120px] items-center justify-center rounded-3xl bg-violet-soft text-violet-deep shadow-sm">
            {SLIDE_ICONS[step]}
          </div>
        </div>

        {/* Titre + Corps */}
        <div className="mb-7">
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

        {/* Indicateur de progression */}
        <div className="mb-5 flex items-center justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all duration-200 ${
                i === step ? "w-6 bg-violet" : "w-2 bg-line hover:bg-muted/40"
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Bouton principal */}
        <button
          onClick={isLast ? handleClose : () => setStep((s) => s + 1)}
          className="w-full rounded-2xl bg-violet py-3.5 text-[15px] font-bold text-cream transition-opacity hover:opacity-90 active:scale-[0.98]"
        >
          {isLast ? "C'est parti !" : "Suivant  →"}
        </button>
      </div>
    </div>
  );
}

