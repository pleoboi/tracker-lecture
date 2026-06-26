import Link from "next/link";

/* ── Logo Swena (cloud + wordmark) ─────────────────────────────────────── */
function SwenaWordmark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 308 70" xmlns="http://www.w3.org/2000/svg" className={className}>
      <g transform="translate(0,6) scale(0.71)" className="fill-[#8b79be] dark:fill-[#9b89cf]">
        <path d="M8,68 C2,68 0,64 0,60 C0,52 4,48 12,48 C10,38 16,32 26,32 C24,24 30,18 40,18 C50,18 56,24 58,32 C62,30 70,30 74,36 C82,32 92,38 90,48 C90,56 86,64 78,66 C78,68 76,68 70,68 Z" />
        <path d="M22,17 L22.6,19.4 L25,20 L22.6,20.6 L22,23 L21.4,20.6 L19,20 L21.4,19.4 Z" />
        <path d="M42,2 L42.8,5.2 L46,6 L42.8,6.8 L42,10 L41.2,6.8 L38,6 L41.2,5.2 Z" />
        <path d="M68,15 L68.6,17.4 L71,18 L68.6,18.6 L68,21 L67.4,18.6 L65,18 L67.4,17.4 Z" />
      </g>
      <text x="87" y="50" fontFamily="Georgia, serif" fontWeight="700" fontSize="50" letterSpacing="-1.2" className="fill-[#2b2733] dark:fill-[#f0eade]">SWENA</text>
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg viewBox="0 0 100 76" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <g fill="currentColor">
        <path d="M8,68 C2,68 0,64 0,60 C0,52 4,48 12,48 C10,38 16,32 26,32 C24,24 30,18 40,18 C50,18 56,24 58,32 C62,30 70,30 74,36 C82,32 92,38 90,48 C90,56 86,64 78,66 C78,68 76,68 70,68 Z" />
        <path d="M22,17 L22.6,19.4 L25,20 L22.6,20.6 L22,23 L21.4,20.6 L19,20 L21.4,19.4 Z" />
        <path d="M42,2 L42.8,5.2 L46,6 L42.8,6.8 L42,10 L41.2,6.8 L38,6 L41.2,5.2 Z" />
        <path d="M68,15 L68.6,17.4 L71,18 L68.6,18.6 L68,21 L67.4,18.6 L65,18 L67.4,17.4 Z" />
      </g>
    </svg>
  );
}

/* ── Features ───────────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    title: "Sessions de lecture",
    desc: "Enregistre tes pages lues, une note du moment et même une photo — comme Strava pour les livres.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
    title: "Bibliothèque",
    desc: "Catalogue tes livres avec couvertures, genres, statuts et ton Top 4 affiché sur ton profil.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
        <line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    ),
    title: "Statistiques",
    desc: "Graphiques de progression, objectifs annuels et mensuels, classement par auteur.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: "Club en temps réel",
    desc: "Suis l'activité de tes proches, visite leurs profils et découvre leurs lectures du moment.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M12 2v7M8 9h8" />
      </svg>
    ),
    title: "Champion du jour",
    desc: "Classement quotidien par pages lues, podium hebdomadaire et profils prestige.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
    title: "Import Goodreads",
    desc: "Rapatrie tout ton historique de lecture en un clic depuis un fichier CSV.",
  },
];

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">

      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-line bg-paper/90 px-5 py-3 backdrop-blur-md md:px-10">
        <SwenaWordmark className="h-8 w-auto" />
        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-xl px-3.5 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:bg-card hover:text-ink">
            Se connecter
          </Link>
          <Link href="/register" className="rounded-xl bg-violet px-3.5 py-2 text-[13px] font-semibold text-cream transition-opacity hover:opacity-85">
            Rejoindre
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center gap-8 px-6 py-16 text-center md:py-24">
        <div className="flex h-[88px] w-[88px] items-center justify-center rounded-3xl bg-violet-soft p-5 text-violet">
          <CloudIcon />
        </div>

        <div className="max-w-md">
          <h1 className="font-serif text-[42px] font-black leading-[1.1] text-ink md:text-6xl">
            Ton club de<br />
            <span className="text-violet">lecture privé.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
            Suis tes lectures, enregistre tes sessions et partage ta progression avec les membres de ton club — au même endroit.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row">
          <Link
            href="/register"
            className="rounded-2xl bg-violet px-8 py-3.5 text-[15px] font-semibold text-cream transition-opacity hover:opacity-85"
          >
            Rejoindre le club →
          </Link>
          <Link
            href="/login"
            className="rounded-2xl border border-line bg-card px-8 py-3.5 text-[15px] font-medium text-ink transition-colors hover:border-violet/40"
          >
            J&apos;ai déjà un compte
          </Link>
        </div>

        {/* Invitation badge */}
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Accès sur invitation uniquement
        </p>
      </section>

      {/* Features */}
      <section className="bg-violet-soft px-5 py-14 md:px-10">
        <h2 className="mb-2 text-center font-serif text-2xl font-bold text-ink">
          Tout ce dont tu as besoin
        </h2>
        <p className="mb-8 text-center text-[13.5px] text-muted">
          Une app pensée pour les lecteurs sérieux, dans un espace intime.
        </p>
        <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex flex-col gap-2.5 rounded-2xl border border-line bg-paper p-4"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-soft text-violet-deep">
                {f.icon}
              </span>
              <h3 className="font-serif text-[14px] font-semibold text-ink">{f.title}</h3>
              <p className="text-[12.5px] leading-relaxed text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA bottom */}
      <section className="flex flex-col items-center gap-5 px-6 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-soft p-3.5 text-violet">
          <CloudIcon />
        </div>
        <div>
          <p className="font-serif text-xl font-bold text-ink">Prêt à rejoindre le club ?</p>
          <p className="mt-1 text-[13.5px] text-muted">Rejoins tes amis sur Swena.</p>
        </div>
        <Link
          href="/register"
          className="rounded-2xl bg-violet px-8 py-3.5 text-[15px] font-semibold text-cream transition-opacity hover:opacity-85"
        >
          Créer mon compte →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-line px-6 py-5 text-center">
        <div className="flex flex-col items-center gap-1">
          <SwenaWordmark className="h-6 w-auto opacity-50" />
          <p className="text-[11px] text-muted">Club de lecture privé · Accès sur invitation</p>
        </div>
      </footer>
    </div>
  );
}
