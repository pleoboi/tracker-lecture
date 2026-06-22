"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

const SLIDES = [
  {
    label: "Bienvenue",
    icon: "📚",
    title: "Bienvenue au Club !",
    body: "Un réseau social de lecture pensé pour toi et ton cercle.\n\nSuis tes lectures, partage ton activité et découvre ce que lisent les autres membres de ton club — au même endroit.",
  },
  {
    label: "Import Goodreads",
    icon: "📥",
    title: "Importe ton historique",
    body: "Tu as déjà beaucoup lu ? Rapatrie tout en un clic.\n\nVa dans Mon Compte → Import Goodreads, exporte ton CSV depuis Goodreads (Mon profil → Importer/Exporter), puis charge le fichier. Tous tes livres apparaissent instantanément.",
  },
  {
    label: "Bibliothèque",
    icon: "🗂️",
    title: "Gère ta Bibliothèque",
    body: "Ajoute tes livres via la recherche, change leur statut (En cours · Terminé · Abandonné) et personnalise leur genre.\n\nChoisis ton Top 4 Favoris — affiché sur ton profil public à la manière de Letterboxd.",
  },
  {
    label: "Sessions",
    icon: "✏️",
    title: "Note tes sessions",
    body: "Enregistre chaque session de lecture comme sur Strava : nombre de pages lues, note du moment, commentaire libre et même une photo depuis ta pellicule.\n\nChaque entrée alimente tes graphiques en temps réel.",
  },
  {
    label: "Club",
    icon: "👥",
    title: "La vie du Club",
    body: "Sur l'Accueil, retrouve l'activité de tous les membres en temps réel, filtrée sur les 3 derniers jours.\n\nClique sur les avatars pour voir leur profil, leurs lectures du moment et leurs avis complets sur chaque livre.",
  },
  {
    label: "Statistiques",
    icon: "📊",
    title: "Analyse tes Statistiques",
    body: "Tes pages lues, ton rythme quotidien, ton classement par auteur et tes objectifs annuels et mensuels — tout est dans l'onglet Statistiques.\n\nLes graphiques des autres membres sont visibles sur leurs profils.",
  },
  {
    label: "Installation",
    icon: "📱",
    title: "Installe l'appli sur ton iPhone",
    body: "Accède à Ma Bibliothèque comme une vraie app, sans passer par le navigateur.\n\n1. Ouvre le site sur Safari\n2. Appuie sur le bouton Partager ⬆\n3. Tout en bas, choisis « Sur l'écran d'accueil »\n\nL'icône apparaît comme une appli native — sans pub, sans App Store.",
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
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
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
          <div className="flex h-[120px] w-[120px] items-center justify-center rounded-3xl bg-violet-soft text-[60px] shadow-sm">
            {slide.icon}
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
