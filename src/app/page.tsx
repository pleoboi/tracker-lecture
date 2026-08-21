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

/* ── Livres réels utilisés dans les aperçus ────────────────────────────── */
const DEMO_BOOKS = [
  { isbn: "9782070360024", title: "L'Étranger", author: "Albert Camus", tint: "#6b5b95" },
  { isbn: "9782070368228", title: "1984", author: "George Orwell", tint: "#4f46e5" },
  { isbn: "9782253004226", title: "Germinal", author: "Émile Zola", tint: "#7c5e3b" },
  { isbn: "9782070413119", title: "Madame Bovary", author: "G. Flaubert", tint: "#8b5a6b" },
  { isbn: "9782253006329", title: "Vingt mille lieues", author: "Jules Verne", tint: "#2f6b7a" },
  { isbn: "9782070409341", title: "Le Père Goriot", author: "H. de Balzac", tint: "#7a4a3a" },
];

/** Couverture avec repli coloré : si l'image ne charge pas, le bloc reste élégant. */
function DemoCover({
  book,
  className = "",
}: {
  book: (typeof DEMO_BOOKS)[number];
  className?: string;
}) {
  return (
    <span
      className={`relative block overflow-hidden rounded-md ${className}`}
      style={{ backgroundColor: book.tint }}
    >
      <span className="absolute inset-0 flex items-center justify-center p-1 text-center font-serif text-[7px] leading-tight text-white/80">
        {book.title}
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://covers.openlibrary.org/b/isbn/${book.isbn}-M.jpg`}
        alt=""
        loading="lazy"
        className="relative h-full w-full object-cover"
      />
    </span>
  );
}

/* ── Cadre téléphone ───────────────────────────────────────────────────── */
function PhoneFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative w-[248px] shrink-0 cursor-default transition-transform duration-300 ease-out hover:rotate-0 hover:scale-105 ${className}`}
    >
      <div className="rounded-[2rem] border border-line bg-card p-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] transition-shadow duration-300 hover:shadow-[0_32px_70px_-16px_rgba(124,58,237,0.35)]">
        <div className="relative overflow-hidden rounded-[1.6rem] bg-paper">
          {/* encoche */}
          <div className="absolute left-1/2 top-1.5 z-10 h-3.5 w-16 -translate-x-1/2 rounded-full bg-card" />
          <div className="h-[420px] overflow-hidden px-3 pb-3 pt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ── Aperçu 1 : le feed d'activité ─────────────────────────────────────── */
function FeedPreview() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="font-serif text-[13px] font-bold text-ink">Activité du club</span>
        <span className="text-[8px] text-muted">Aujourd&apos;hui</span>
      </div>

      {/* Champion du jour */}
      <div className="rounded-xl px-2.5 py-2" style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
        <p className="text-[7px] font-semibold uppercase tracking-wider text-white/60">Champion du jour</p>
        <div className="flex items-baseline justify-between">
          <span className="font-serif text-[13px] font-black text-[#fde68a]">Céline</span>
          <span className="text-[11px] font-bold text-white">64 p.</span>
        </div>
      </div>

      {/* Cartes livres */}
      <div className="flex gap-2">
        {DEMO_BOOKS.slice(0, 3).map((b) => (
          <div key={b.isbn} className="flex w-[62px] flex-col gap-1">
            <DemoCover book={b} className="aspect-[3/4] w-full" />
            <p className="line-clamp-2 text-[7.5px] font-semibold leading-tight text-ink">{b.title}</p>
            <p className="text-[7px] font-semibold text-violet-deep">+34 p.</p>
            <div className="h-[2px] w-full overflow-hidden rounded-full bg-line">
              <div className="h-full w-2/3 rounded-full bg-violet" />
            </div>
          </div>
        ))}
      </div>

      {/* Session en cours */}
      <div className="flex items-center gap-2 rounded-xl border border-line bg-card p-2">
        <DemoCover book={DEMO_BOOKS[3]} className="h-[38px] w-[26px] shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[8.5px] font-semibold text-ink">{DEMO_BOOKS[3].title}</p>
          <p className="text-[7px] text-muted">p. 212 / 448</p>
          <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-line">
            <div className="h-full w-1/2 rounded-full bg-violet" />
          </div>
        </div>
        <span className="shrink-0 rounded-lg bg-violet px-1.5 py-1 text-[7px] font-bold text-cream">+</span>
      </div>

      {/* Ligne sociale */}
      <div className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-2 py-1.5">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-violet text-[7px] font-bold text-cream">S</span>
        <p className="min-w-0 flex-1 truncate text-[7.5px] text-ink-2">Sara a aimé ta note</p>
        <span className="text-[8px] text-danger">♥</span>
      </div>
    </div>
  );
}

/* ── Aperçu 2 : statistiques ───────────────────────────────────────────── */
function StatsPreview() {
  const bars = [40, 62, 35, 78, 55, 88, 70];
  return (
    <div className="flex flex-col gap-3">
      <span className="font-serif text-[13px] font-bold text-ink">Tes statistiques</span>

      <div className="grid grid-cols-3 gap-1.5">
        {[
          { v: "1 284", l: "pages" },
          { v: "12", l: "livres" },
          { v: "31", l: "jours" },
        ].map((s) => (
          <div key={s.l} className="rounded-lg bg-violet-soft px-1.5 py-2 text-center">
            <p className="font-serif text-[13px] font-black text-violet-deep">{s.v}</p>
            <p className="text-[6.5px] text-muted">{s.l}</p>
          </div>
        ))}
      </div>

      {/* Graphique */}
      <div className="rounded-xl border border-line bg-card p-2.5">
        <p className="mb-2 text-[7px] font-semibold uppercase tracking-wide text-muted">Cette semaine</p>
        <div className="flex h-[64px] items-end justify-between gap-1">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 rounded-t-sm bg-violet" style={{ height: `${h}%`, opacity: 0.55 + i * 0.06 }} />
          ))}
        </div>
      </div>

      {/* Objectif */}
      <div className="rounded-xl border border-line bg-card p-2.5">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[8px] font-semibold text-ink">Objectif 2026</span>
          <span className="text-[8px] font-bold text-violet-deep">12 / 24</span>
        </div>
        <div className="h-[5px] w-full overflow-hidden rounded-full bg-line">
          <div className="h-full w-1/2 rounded-full bg-violet" />
        </div>
      </div>

      {/* Badge */}
      <div className="flex items-center gap-2 rounded-xl border border-violet/25 bg-violet-soft px-2.5 py-2">
        <span className="text-[14px]">🏆</span>
        <div className="min-w-0">
          <p className="text-[8px] font-bold text-ink">Série de 31 jours</p>
          <p className="text-[7px] text-muted">Badge débloqué</p>
        </div>
      </div>
    </div>
  );
}

/* ── Vitrine statistiques (panneau large, pas un mockup téléphone) ───────── */
const YEAR_BARS = [180, 240, 190, 310, 260, 350, 300, 420, 280, 390, 340, 410];
const MONTHS_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const TOP_GENRES = [
  { name: "Thriller", pct: 38 },
  { name: "Roman", pct: 27 },
  { name: "Fantasy", pct: 19 },
];

function StatsShowcase() {
  return (
    <div className="rounded-3xl border border-line bg-card p-5 shadow-sm transition-shadow duration-300 hover:shadow-xl md:p-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.1fr_1fr]">
        {/* Graphique annuel */}
        <div className="min-w-0 rounded-2xl border border-line bg-paper p-4 md:p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Pages lues par mois</p>
            <p className="font-serif text-lg font-black text-violet-deep">4 218<span className="ml-1 text-[11px] font-sans font-medium text-muted">cette année</span></p>
          </div>
          <div className="flex h-[110px] items-stretch justify-between gap-1.5">
            {YEAR_BARS.map((h, i) => (
              <div key={i} className="group/bar relative flex flex-1 cursor-default flex-col justify-end">
                <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-1.5 py-1 text-[9px] font-semibold text-cream opacity-0 shadow-lg transition-opacity duration-150 group-hover/bar:opacity-100">
                  {MONTHS_SHORT[i]} · {h} p.
                </span>
                <div
                  className="relative overflow-hidden rounded-t-md bg-violet transition-transform duration-200 group-hover/bar:-translate-y-1"
                  style={{ height: `${(h / 420) * 100}%`, opacity: 0.5 + i * 0.045 }}
                >
                  <div className="absolute inset-0 bg-white/0 transition-colors duration-200 group-hover/bar:bg-white/25" />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[9.5px] text-muted">
            <span>Jan</span><span>Déc</span>
          </div>
        </div>

        {/* Grille de statistiques */}
        <div className="grid min-w-0 grid-cols-2 gap-2.5">
          {[
            { v: "18", l: "livres terminés" },
            { v: "12 j.", l: "série en cours 🔥" },
            { v: "34", l: "pages / jour en moyenne" },
            { v: "3", l: "amis dépassés cette semaine" },
          ].map((s) => (
            <div
              key={s.l}
              className="group cursor-default rounded-2xl bg-violet-soft px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:bg-violet hover:shadow-md"
            >
              <p className="font-serif text-xl font-black text-violet-deep transition-colors duration-200 group-hover:text-cream">{s.v}</p>
              <p className="text-[10.5px] leading-tight text-ink-2 transition-colors duration-200 group-hover:text-cream/85">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Genres préférés */}
        <div className="min-w-0 rounded-2xl border border-line bg-paper p-4 transition-colors duration-200 hover:border-violet/30">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Tes genres préférés</p>
          <div className="flex flex-col gap-1">
            {TOP_GENRES.map((g) => (
              <div
                key={g.name}
                className="group -mx-1.5 flex cursor-default items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors duration-150 hover:bg-violet-soft"
              >
                <span className="w-16 shrink-0 text-[12px] text-ink transition-colors duration-150 group-hover:font-semibold group-hover:text-violet-deep">{g.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-violet transition-[filter] duration-150 group-hover:brightness-110"
                    style={{ width: `${g.pct}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-[11px] font-semibold text-muted transition-colors duration-150 group-hover:text-violet-deep">{g.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Objectif annuel */}
        <div className="group min-w-0 cursor-default rounded-2xl border border-line bg-paper p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-violet/40 hover:shadow-md">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Objectif 2026</p>
            <p className="text-[12px] font-bold text-violet-deep">18 / 24 livres</p>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full w-3/4 rounded-full bg-violet transition-[filter] duration-200 group-hover:brightness-110" />
          </div>
          <p className="mt-2 text-[11px] text-muted">À ce rythme, objectif atteint mi-novembre.</p>
        </div>
      </div>
    </div>
  );
}

/* ── Vitrine activité des amis (panneau large) ────────────────────────────── */
const FRIENDS_FEED = [
  { name: "Céline", tint: "#7c3aed", action: "a terminé", book: "Les Piliers de la Terre", extra: "★★★★☆" },
  { name: "Nicolas", tint: "#4f46e5", action: "en cours sur", book: "Dune", extra: "p. 312 / 688" },
  { name: "Sara", tint: "#c9a227", action: "a aimé ta note sur", book: "1984", extra: "♥" },
];

function FriendsShowcase() {
  return (
    <div className="rounded-3xl border border-line bg-card p-5 shadow-sm transition-shadow duration-300 hover:shadow-xl md:p-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_1.1fr] md:items-center">
        <div className="order-2 min-w-0 md:order-1">
          <p className="font-serif text-xl font-bold text-ink">L&apos;activité de ton club, en direct</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            Suis ce que lisent tes amis, vois qui a lu le plus de pages aujourd&apos;hui,
            aime et commente leurs notes, recommande-leur un livre. Tout ça sans jamais
            quitter l&apos;appli.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {["Fil d'activité de tout ton club", "Champion du jour et podium hebdomadaire", "J'aime, commentaires et recommandations"].map((t) => (
              <li
                key={t}
                className="group -mx-2 flex cursor-default items-center gap-2 rounded-lg px-2 py-0.5 text-[13px] text-ink-2 transition-colors duration-150 hover:bg-violet-soft hover:text-ink"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-violet transition-transform duration-150 group-hover:scale-125">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="order-1 flex min-w-0 flex-col gap-2.5 md:order-2">
          <div
            className="cursor-default rounded-2xl px-4 py-3 transition-transform duration-200 hover:scale-[1.015]"
            style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Champion du jour</p>
            <div className="flex items-baseline justify-between">
              <span className="font-serif text-[17px] font-black text-[#fde68a]">Céline</span>
              <span className="text-[13px] font-bold text-white">64 pages</span>
            </div>
          </div>
          {FRIENDS_FEED.map((f) => (
            <div
              key={f.name}
              className="flex cursor-default items-center gap-3 rounded-2xl border border-line bg-paper px-3.5 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-violet/50 hover:bg-violet-soft/40 hover:shadow-sm"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-serif text-[12px] font-bold text-cream"
                style={{ backgroundColor: f.tint }}
              >
                {f.name[0]}
              </span>
              <p className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">
                <span className="font-semibold text-ink">{f.name}</span> {f.action}{" "}
                <span className="font-medium text-ink">{f.book}</span>
              </p>
              <span className="shrink-0 text-[11.5px] font-semibold text-violet-deep">{f.extra}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Contenus ──────────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    title: "Note chaque session",
    desc: "Pages lues, impressions du moment, citation marquante, photo de ta lecture. En dix secondes, c'est enregistré.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
    title: "Une vraie bibliothèque",
    desc: "Couvertures en haute définition, résumés et genres récupérés automatiquement. Filtre et trie comme tu veux.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
        <line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    ),
    title: "Des statistiques qui motivent",
    desc: "Rythme de lecture, séries de jours, objectif annuel, genres préférés. Tu vois enfin ta progression.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: "Lis avec tes amis",
    desc: "Suis leurs lectures, commente leurs notes, recommande un livre. Un club intime, pas un réseau social géant.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M12 2v7M8 9h8" />
      </svg>
    ),
    title: "Défis et badges",
    desc: "Champion du jour, podium hebdomadaire, séries à tenir et badges à débloquer. De quoi garder le rythme.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
    title: "Tu viens de Goodreads ?",
    desc: "Importe tout ton historique depuis un fichier CSV. Rien à ressaisir, tes années de lecture te suivent.",
  },
];

const STEPS = [
  { n: "1", title: "Ajoute un livre", desc: "Cherche par titre : couverture, résumé et nombre de pages arrivent tout seuls." },
  { n: "2", title: "Note ta session", desc: "À la fin de ta lecture, indique ta page. Ta progression et tes stats se mettent à jour." },
  { n: "3", title: "Partage avec tes amis", desc: "Ton club voit ton activité, commente tes notes et te recommande des livres." },
];

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 md:px-10">
          <SwenaWordmark className="h-8 w-auto" />
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-xl px-3.5 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:bg-card hover:text-ink">
              Se connecter
            </Link>
            <Link href="/register" className="rounded-xl bg-violet px-3.5 py-2 text-[13px] font-semibold text-cream transition-opacity hover:opacity-85">
              Créer un compte
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* halo décoratif */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-140px] h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-[0.18] blur-3xl"
          style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 65%)" }}
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-16 md:grid-cols-2 md:gap-8 md:px-10 md:py-24">
          {/* Colonne texte */}
          <div className="flex flex-col items-center text-center md:items-start md:text-left">
            <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-violet/25 bg-violet-soft px-3 py-1 text-[11.5px] font-medium text-violet-deep">
              Gratuit · Sur mobile et ordinateur
            </span>

            <h1 className="font-serif text-[40px] font-black leading-[1.08] text-ink md:text-[56px]">
              Chaque page lue<br />
              <span className="text-violet">mérite sa trace.</span>
            </h1>

            <p className="mt-5 max-w-md text-[15.5px] leading-relaxed text-ink-2">
              Swena transforme tes lectures en un carnet vivant : tu notes tes sessions,
              tu vois ta progression, et tu partages tout ça avec tes amis lecteurs.
            </p>

            <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row">
              <Link
                href="/register"
                className="rounded-2xl bg-violet px-8 py-3.5 text-center text-[15px] font-semibold text-cream transition-opacity hover:opacity-85"
              >
                Commencer gratuitement
              </Link>
              <Link
                href="/login"
                className="rounded-2xl border border-line bg-card px-8 py-3.5 text-center text-[15px] font-medium text-ink transition-colors hover:border-violet/40"
              >
                J&apos;ai déjà un compte
              </Link>
            </div>

            <p className="mt-4 text-[12px] text-muted">
              Sans carte bancaire. Ton compte est prêt en une minute.
            </p>
          </div>

          {/* Colonne aperçus */}
          <div className="flex items-center justify-center gap-4 md:justify-end">
            <PhoneFrame className="rotate-[-4deg] md:rotate-[-6deg]">
              <FeedPreview />
            </PhoneFrame>
            <PhoneFrame className="hidden rotate-[4deg] lg:block">
              <StatsPreview />
            </PhoneFrame>
          </div>
        </div>
      </section>

      {/* Bandeau couvertures */}
      <section className="border-y border-line bg-card/60 py-8">
        <p className="mb-5 text-center text-[12px] font-medium uppercase tracking-widest text-muted">
          Des classiques aux nouveautés, toute ta bibliothèque
        </p>
        <div className="flex flex-wrap items-end justify-center gap-3 px-6 md:gap-5">
          {DEMO_BOOKS.map((b, i) => (
            <div
              key={b.isbn}
              className="group flex w-[74px] flex-col items-center gap-1.5 md:w-[92px]"
              style={{ transform: `translateY(${i % 2 === 0 ? "0" : "10px"})` }}
            >
              <DemoCover
                book={b}
                className="aspect-[2/3] w-full shadow-md transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_14px_28px_-8px_rgba(124,58,237,0.5)]"
              />
              <p className="line-clamp-1 text-center text-[10px] text-muted transition-colors duration-200 group-hover:text-violet-deep">{b.author}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Vitrine statistiques */}
      <section className="mx-auto max-w-5xl px-6 py-16 md:px-10">
        <div className="mb-8 text-center">
          <h2 className="font-serif text-[26px] font-black text-ink md:text-[32px]">
            Un avant-goût de tes statistiques
          </h2>
          <p className="mx-auto mt-2.5 max-w-lg text-[14px] leading-relaxed text-muted">
            Rythme de lecture, séries, genres préférés, objectifs — voici exactement ce que
            tu retrouveras dès ta première session.
          </p>
        </div>
        <StatsShowcase />
      </section>

      {/* Vitrine activité des amis */}
      <section className="mx-auto max-w-5xl px-6 pb-16 md:px-10">
        <FriendsShowcase />
      </section>

      {/* Fonctionnalités */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:px-10 md:py-20">
        <div className="mb-10 text-center">
          <h2 className="font-serif text-[28px] font-black text-ink md:text-4xl">
            Tout ce qu&apos;il faut pour lire plus
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[14.5px] leading-relaxed text-muted">
            Pensé pour les lecteurs réguliers comme pour ceux qui veulent reprendre le rythme.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group flex cursor-default flex-col gap-3 rounded-2xl border border-line bg-card p-5 transition-all duration-200 hover:-translate-y-1 hover:border-violet/50 hover:shadow-lg"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-soft text-violet-deep transition-colors duration-200 group-hover:bg-violet group-hover:text-cream">
                {f.icon}
              </span>
              <h3 className="font-serif text-[16px] font-bold text-ink">{f.title}</h3>
              <p className="text-[13px] leading-relaxed text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="border-y border-line bg-violet-soft/50 px-6 py-16 md:px-10 md:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center font-serif text-[28px] font-black text-ink md:text-4xl">
            Trois gestes, c&apos;est tout
          </h2>

          <div className="mt-10 grid grid-cols-1 items-center gap-10 md:grid-cols-2">
            <ol className="flex flex-col gap-6">
              {STEPS.map((s) => (
                <li
                  key={s.n}
                  className="group -m-2 flex cursor-default gap-4 rounded-2xl p-2 transition-colors duration-200 hover:bg-card/70"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet font-serif text-[15px] font-black text-cream transition-transform duration-200 group-hover:scale-110">
                    {s.n}
                  </span>
                  <div>
                    <h3 className="font-serif text-[17px] font-bold text-ink transition-colors duration-200 group-hover:text-violet-deep">{s.title}</h3>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="flex justify-center md:justify-end">
              <PhoneFrame>
                <StatsPreview />
              </PhoneFrame>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-20 text-center">
        <h2 className="font-serif text-[30px] font-black leading-tight text-ink md:text-4xl">
          Ta prochaine lecture commence ici
        </h2>
        <p className="max-w-md text-[14.5px] leading-relaxed text-muted">
          Crée ton compte, ajoute ton livre en cours et note ta première session dès ce soir.
        </p>
        <Link
          href="/register"
          className="rounded-2xl bg-violet px-9 py-4 text-[15.5px] font-semibold text-cream transition-opacity hover:opacity-85"
        >
          Créer mon compte gratuitement
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-line px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5">
          <div className="flex flex-col items-center gap-3 md:flex-row md:justify-between md:self-stretch">
            <SwenaWordmark className="h-6 w-auto opacity-60" />
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <Link href="/mentions-legales" className="text-[11.5px] text-muted transition-colors hover:text-ink">
                Mentions légales
              </Link>
              <Link href="/confidentialite" className="text-[11.5px] text-muted transition-colors hover:text-ink">
                Confidentialité
              </Link>
              <Link href="/conditions" className="text-[11.5px] text-muted transition-colors hover:text-ink">
                Conditions d&apos;utilisation
              </Link>
              <Link href="/login" className="text-[11.5px] text-muted transition-colors hover:text-ink">
                Se connecter
              </Link>
            </div>
          </div>

          <p className="max-w-2xl text-center text-[10.5px] leading-relaxed text-muted">
            Swena · Le carnet de lecture de ton club. Certaines fiches de livres comportent des
            liens partenaires. En tant que Partenaire Amazon, Swena réalise un bénéfice sur les
            achats remplissant les conditions requises.
          </p>
        </div>
      </footer>
    </div>
  );
}
