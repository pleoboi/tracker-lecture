"use client";

const STEPS = [
  {
    icon: "📚",
    title: "La Bibliothèque",
    body: "Ajoute tes livres via la recherche Google Books ou en reprenant un livre déjà saisi par un autre membre (bouton « Reprendre »). Retrouve ici tous tes livres en cours ou terminés avec leur couverture, ta progression et tes notes personnelles.",
  },
  {
    icon: "✏️",
    title: "Le Journal",
    body: "Enregistre chaque session depuis l'accueil ou directement dans la fiche d'un livre. Saisis simplement la page d'arrêt — les pages lues sont calculées automatiquement. Toutes tes sessions sont listées dans le détail du livre concerné.",
  },
  {
    icon: "🧭",
    title: "La Découverte",
    body: "Parcours tous les livres du club en un coup d'œil. Clique sur un titre pour voir la note moyenne globale, le nombre d'avis, le résumé et les critiques de chaque membre. La meilleure façon de dénicher ta prochaine lecture.",
  },
  {
    icon: "👥",
    title: "Les Membres",
    body: "Consulte le profil public de chaque lecteur : ses livres en cours, sa bibliothèque terminée, ses statistiques et son graphique de progression annuel. Idéal pour s'inspirer ou savoir où en est chacun.",
  },
  {
    icon: "📊",
    title: "Statistiques & Objectifs",
    body: "Ton tableau de bord affiche pages lues, livres terminés, rythme quotidien et record personnel. L'objectif annuel est entièrement facultatif — si tu ne l'as pas encore défini, des suggestions t'inviteront à le configurer. Les graphiques des autres membres sont aussi visibles sur leurs profils publics.",
  },
];

export default function GuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-paper sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-serif text-lg font-black text-ink">Guide du Club de Lecture</h2>
            <p className="text-[11px] font-medium text-muted">Tout ce que tu dois savoir</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-sm text-muted transition-colors hover:bg-card"
          >
            ✕
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="flex flex-col gap-3 overflow-y-auto p-5">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className="flex gap-3.5 rounded-2xl border border-line bg-card p-4"
            >
              <span className="text-2xl leading-none">{step.icon}</span>
              <div className="min-w-0">
                <h3 className="font-serif text-[14.5px] font-semibold text-ink">{step.title}</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{step.body}</p>
              </div>
            </div>
          ))}

          <p className="pb-2 pt-1 text-center text-[11px] text-muted">
            Des questions ? Contacte le créateur du club 👋
          </p>
        </div>
      </div>
    </div>
  );
}
