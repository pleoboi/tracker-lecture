export type BadgeTier = 1 | 2 | 3 | 4;
export type BadgeType =
  | "volume" | "genre" | "sessions" | "pages" | "review" | "streak" | "monthly"
  | "event" | "time_of_day" | "performance" | "social" | "monthly_books"
  | "goal" | "monthly_goal" | "author" | "champion_month" | "challenge"
  | "milestone" | "referral" | "genre_specific";

export type IconKey =
  | "books" | "compass" | "lightning" | "quill" | "pages" | "flame" | "calendar"
  | "moon" | "sunrise" | "heart" | "camera" | "chart" | "crown" | "seal" | "target"
  | "invite";

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  type: BadgeType;
  tier: BadgeTier;
  targetValue: number;
  points: number;
  iconKey: IconKey;
  startDate?: string;
  endDate?: string;
  isSpecial?: true; // checked via API logic, not getStatValue
}

export interface UserBadgeStats {
  booksCompleted: number;
  uniqueGenres: number;
  sessionsCount: number;
  reviewsCount: number;
  totalPages: number;
  maxStreak: number;
  monthlySessionCount: number;
  monthlyBooksCount: number;
}

// ── Couleurs par palier ───────────────────────────────────────────────────────
export const TIER_META: Record<BadgeTier, {
  label: string; stroke: string; bg: string; bgDark: string; bgClass: string; textClass: string; borderClass: string;
}> = {
  1: { label:"Bronze",  stroke:"#c97d41", bg:"bg-[#fdf0e0]",  bgDark:"dark:bg-[#2a1a0a]",  bgClass:"tier-bg-1", textClass:"text-[#c97d41]",   borderClass:"border-[#c97d41]"  },
  2: { label:"Argent",  stroke:"#8a9ab5", bg:"bg-[#f0f2f6]",  bgDark:"dark:bg-[#141c28]",  bgClass:"tier-bg-2", textClass:"text-[#8a9ab5]",   borderClass:"border-[#8a9ab5]"  },
  3: { label:"Or",      stroke:"#c8961a", bg:"bg-[#fdf6d3]",  bgDark:"dark:bg-[#261e00]",  bgClass:"tier-bg-3", textClass:"text-[#c8961a]",   borderClass:"border-[#c8961a]"  },
  4: { label:"Platine", stroke:"#7c5bbf", bg:"bg-violet-soft", bgDark:"dark:bg-violet/10", bgClass:"tier-bg-4", textClass:"text-violet-deep", borderClass:"border-violet"     },
};

// ── Définitions des badges ────────────────────────────────────────────────────
export const BADGE_DEFS: BadgeDef[] = [
  // ── Bâtisseur — livres terminés ──────────────────────────────────────────
  { id:"builder-1", name:"Bâtisseur", description:"Terminer 5 livres",   type:"volume", tier:1, targetValue:5,   points:15,  iconKey:"books"    },
  { id:"builder-2", name:"Bâtisseur", description:"Terminer 25 livres",  type:"volume", tier:2, targetValue:25,  points:40,  iconKey:"books"    },
  { id:"builder-3", name:"Bâtisseur", description:"Terminer 100 livres", type:"volume", tier:3, targetValue:100, points:100, iconKey:"books"    },
  { id:"builder-4", name:"Bâtisseur", description:"Terminer 250 livres", type:"volume", tier:4, targetValue:250, points:250, iconKey:"books"    },
  // ── Explorateur — genres distincts ───────────────────────────────────────
  { id:"explorer-1", name:"Explorateur", description:"Lire dans 3 genres distincts",  type:"genre", tier:1, targetValue:3,  points:10,  iconKey:"compass" },
  { id:"explorer-2", name:"Explorateur", description:"Lire dans 5 genres distincts",  type:"genre", tier:2, targetValue:5,  points:25,  iconKey:"compass" },
  { id:"explorer-3", name:"Explorateur", description:"Lire dans 8 genres distincts",  type:"genre", tier:3, targetValue:8,  points:60,  iconKey:"compass" },
  { id:"explorer-4", name:"Explorateur", description:"Lire dans 12 genres distincts", type:"genre", tier:4, targetValue:12, points:150, iconKey:"compass" },
  // ── Badges de genre — un badge par genre, débloqué dès qu'un livre terminé
  // porte ce genre parmi les siens (un livre peut en avoir plusieurs). Le nom
  // du badge EST le genre à faire correspondre (voir api/badges/check).
  { id:"genre-fantasy",     name:"Fantasy",                  description:"Terminer un livre du genre Fantasy",                  type:"genre_specific", tier:1, targetValue:1, points:15, iconKey:"compass", isSpecial:true },
  { id:"genre-scifi",       name:"Science-Fiction",          description:"Terminer un livre de Science-Fiction",                type:"genre_specific", tier:1, targetValue:1, points:15, iconKey:"compass", isSpecial:true },
  { id:"genre-romance",     name:"Romance",                  description:"Terminer un livre du genre Romance",                  type:"genre_specific", tier:1, targetValue:1, points:15, iconKey:"compass", isSpecial:true },
  { id:"genre-thriller",    name:"Thriller",                 description:"Terminer un livre du genre Thriller",                 type:"genre_specific", tier:1, targetValue:1, points:15, iconKey:"compass", isSpecial:true },
  { id:"genre-policier",    name:"Policier",                 description:"Terminer un livre du genre Policier",                 type:"genre_specific", tier:1, targetValue:1, points:15, iconKey:"compass", isSpecial:true },
  { id:"genre-aventure",    name:"Aventure",                 description:"Terminer un livre du genre Aventure",                 type:"genre_specific", tier:1, targetValue:1, points:15, iconKey:"compass", isSpecial:true },
  { id:"genre-jeunesse",    name:"Jeunesse",                 description:"Terminer un livre du genre Jeunesse",                 type:"genre_specific", tier:1, targetValue:1, points:15, iconKey:"compass", isSpecial:true },
  { id:"genre-manga",       name:"Manga",                    description:"Terminer un manga ou une BD",                         type:"genre_specific", tier:1, targetValue:1, points:15, iconKey:"compass", isSpecial:true },
  { id:"genre-classique",   name:"Classique",                description:"Terminer un livre classique",                         type:"genre_specific", tier:1, targetValue:1, points:15, iconKey:"compass", isSpecial:true },
  { id:"genre-histoire",    name:"Histoire",                 description:"Terminer un livre d'Histoire",                        type:"genre_specific", tier:1, targetValue:1, points:15, iconKey:"compass", isSpecial:true },
  { id:"genre-biographie",  name:"Biographie",               description:"Terminer une biographie",                             type:"genre_specific", tier:1, targetValue:1, points:15, iconKey:"compass", isSpecial:true },
  { id:"genre-devperso",    name:"Développement personnel",  description:"Terminer un livre de développement personnel",         type:"genre_specific", tier:1, targetValue:1, points:15, iconKey:"compass", isSpecial:true },
  { id:"genre-philosophie", name:"Philosophie",              description:"Terminer un livre de philosophie",                    type:"genre_specific", tier:1, targetValue:1, points:15, iconKey:"compass", isSpecial:true },
  { id:"genre-psychologie", name:"Psychologie",              description:"Terminer un livre de psychologie",                    type:"genre_specific", tier:1, targetValue:1, points:15, iconKey:"compass", isSpecial:true },
  { id:"genre-essai",       name:"Essai",                    description:"Terminer un essai",                                   type:"genre_specific", tier:1, targetValue:1, points:15, iconKey:"compass", isSpecial:true },
  { id:"genre-guerre",      name:"Guerre",                   description:"Terminer un livre sur la guerre",                     type:"genre_specific", tier:1, targetValue:1, points:15, iconKey:"compass", isSpecial:true },
  // ── Marathonien — sessions enregistrées ─────────────────────────────────
  { id:"marathon-1", name:"Marathonien", description:"10 sessions de lecture",  type:"sessions", tier:1, targetValue:10,  points:10,  iconKey:"lightning" },
  { id:"marathon-2", name:"Marathonien", description:"50 sessions de lecture",  type:"sessions", tier:2, targetValue:50,  points:30,  iconKey:"lightning" },
  { id:"marathon-3", name:"Marathonien", description:"150 sessions de lecture", type:"sessions", tier:3, targetValue:150, points:80,  iconKey:"lightning" },
  { id:"marathon-4", name:"Marathonien", description:"500 sessions de lecture", type:"sessions", tier:4, targetValue:500, points:200, iconKey:"lightning" },
  // ── Critique — reviews rédigées ──────────────────────────────────────────
  { id:"critic-1", name:"Critique", description:"Rédiger 3 critiques",  type:"review", tier:1, targetValue:3,  points:15,  iconKey:"quill" },
  { id:"critic-2", name:"Critique", description:"Rédiger 10 critiques", type:"review", tier:2, targetValue:10, points:40,  iconKey:"quill" },
  { id:"critic-3", name:"Critique", description:"Rédiger 25 critiques", type:"review", tier:3, targetValue:25, points:100, iconKey:"quill" },
  { id:"critic-4", name:"Critique", description:"Rédiger 75 critiques", type:"review", tier:4, targetValue:75, points:200, iconKey:"quill" },
  // ── Vorace — pages lues total ────────────────────────────────────────────
  { id:"voracious-1", name:"Vorace", description:"Lire 1 000 pages",   type:"pages", tier:1, targetValue:1000,  points:10,  iconKey:"pages" },
  { id:"voracious-2", name:"Vorace", description:"Lire 5 000 pages",   type:"pages", tier:2, targetValue:5000,  points:25,  iconKey:"pages" },
  { id:"voracious-3", name:"Vorace", description:"Lire 15 000 pages",  type:"pages", tier:3, targetValue:15000, points:75,  iconKey:"pages" },
  { id:"voracious-4", name:"Vorace", description:"Lire 50 000 pages",  type:"pages", tier:4, targetValue:50000, points:200, iconKey:"pages" },
  // ── Régulier — série de jours consécutifs ────────────────────────────────
  { id:"streak-1", name:"Régulier", description:"7 jours consécutifs de lecture",   type:"streak", tier:1, targetValue:7,   points:15,  iconKey:"flame" },
  { id:"streak-2", name:"Régulier", description:"21 jours consécutifs de lecture",  type:"streak", tier:2, targetValue:21,  points:40,  iconKey:"flame" },
  { id:"streak-3", name:"Régulier", description:"60 jours consécutifs de lecture",  type:"streak", tier:3, targetValue:60,  points:120, iconKey:"flame" },
  { id:"streak-4", name:"Régulier", description:"180 jours consécutifs de lecture", type:"streak", tier:4, targetValue:180, points:300, iconKey:"flame" },
  // ── Sprint Éclair (cumulatif : +40 pts par livre dévoré en une journée) ─
  { id:"sprint-eclair", name:"Sprint Éclair", description:"Commencer et terminer un livre dans la même journée",
    type:"performance", tier:3, targetValue:1, points:0, iconKey:"lightning", isSpecial:true },

  // ── Événements temporels ─────────────────────────────────────────────────
  { id:"event-dec31",  name:"Dernier chapitre de l'année", description:"Session de lecture le 31 décembre",        type:"event", tier:2, targetValue:1, points:30, iconKey:"calendar", isSpecial:true },
  { id:"event-jan1",   name:"Page Blanche",               description:"Session de lecture le 1er janvier",          type:"event", tier:2, targetValue:1, points:30, iconKey:"pages",    isSpecial:true },
  { id:"event-feb14",  name:"Roman d'Amour",              description:"Session de lecture le 14 février",           type:"event", tier:2, targetValue:1, points:25, iconKey:"heart",    isSpecial:true },
  { id:"event-mar8",   name:"Lectures Engagées",          description:"Session de lecture le 8 mars",               type:"event", tier:3, targetValue:1, points:40, iconKey:"crown",    isSpecial:true },

  // ── Badges horaires ──────────────────────────────────────────────────────
  { id:"time-dawn",  name:"Lecteur de l'Aube",  description:"Session enregistrée entre 4h et 7h du matin",    type:"time_of_day", tier:2, targetValue:1, points:25, iconKey:"sunrise", isSpecial:true },
  { id:"time-night", name:"Oiseau de Nuit",     description:"Session enregistrée entre 22h et 4h du matin",   type:"time_of_day", tier:2, targetValue:1, points:25, iconKey:"moon",    isSpecial:true },

  // ── Défis de performance ─────────────────────────────────────────────────
  { id:"perf-ritual",   name:"Le Rituel",          description:"15+ pages par jour pendant 30 jours consécutifs",       type:"performance", tier:3, targetValue:1, points:75,  iconKey:"flame",     isSpecial:true },
  { id:"perf-unending", name:"L'Inlassable",       description:"60 jours consécutifs de lecture",                       type:"performance", tier:4, targetValue:1, points:150, iconKey:"lightning", isSpecial:true },
  { id:"perf-climbing", name:"Toujours plus haut", description:"Plus de pages que la veille, 7 jours de suite",         type:"performance", tier:2, targetValue:1, points:35,  iconKey:"chart",     isSpecial:true },
  { id:"perf-brick",    name:"Le Pavé",            description:"Livre de 800+ pages ou 300 pages en une seule journée", type:"performance", tier:3, targetValue:1, points:50,  iconKey:"books",     isSpecial:true },

  // ── Social & profil ──────────────────────────────────────────────────────
  { id:"social-liked",   name:"Plébiscité",  description:"Recevoir 25 J'aime cumulés sur vos critiques",     type:"social", tier:3, targetValue:25, points:60, iconKey:"heart",  isSpecial:true },
  { id:"social-id",      name:"Identité",    description:"Ajouter une photo de profil",                       type:"social", tier:1, targetValue:1,  points:10, iconKey:"camera", isSpecial:true },
  { id:"social-photo",   name:"Illustrateur",description:"Ajouter une photo à une session de lecture",        type:"social", tier:1, targetValue:1,  points:15, iconKey:"camera", isSpecial:true },
  { id:"social-archive", name:"Archiviste",  description:"Ajouter manuellement un livre dans la base",        type:"social", tier:2, targetValue:1,  points:25, iconKey:"books",  isSpecial:true },

  // ── Objectifs personnels ──────────────────────────────────────────────────
  { id:"goal-set-pages", name:"Objectif Pages",  description:"Définir un objectif de pages pour l'année",  type:"goal", tier:1, targetValue:1, points:10, iconKey:"target", isSpecial:true },
  { id:"goal-set-books", name:"Objectif Livres", description:"Définir un objectif de livres pour l'année", type:"goal", tier:1, targetValue:1, points:10, iconKey:"target", isSpecial:true },
  { id:"goal-exceeded",  name:"Objectif Dépassé", description:"Dépasser son objectif annuel de pages ou de livres de 20 %", type:"goal", tier:3, targetValue:1, points:60, iconKey:"target", isSpecial:true },
  { id:"goal-3-months",  name:"Trois Mois d'Affilée", description:"Atteindre son objectif personnel du mois, 3 mois consécutifs", type:"goal", tier:2, targetValue:1, points:50, iconKey:"target", isSpecial:true },
  { id:"goal-12-months", name:"Année Parfaite", description:"Atteindre son objectif personnel chaque mois d'une année complète", type:"goal", tier:4, targetValue:1, points:250, iconKey:"target", isSpecial:true },

  // ── Performance (suite) ───────────────────────────────────────────────────
  { id:"perf-brick2",   name:"Le Pavé Ultime",     description:"Terminer un livre de 1 000 pages ou plus",                 type:"performance", tier:2, targetValue:1, points:40, iconKey:"books",     isSpecial:true },
  { id:"perf-shorts",   name:"Format Court",       description:"Terminer 10 livres de moins de 150 pages",                 type:"performance", tier:2, targetValue:10, points:35, iconKey:"pages",    isSpecial:true },
  { id:"perf-week1000", name:"Le Millier",         description:"Lire 1 000 pages en une seule semaine",                    type:"performance", tier:2, targetValue:1, points:45, iconKey:"pages",     isSpecial:true },
  { id:"perf-century",  name:"Le Century",         description:"Lire 100 pages en une seule session",                      type:"performance", tier:1, targetValue:1, points:20, iconKey:"lightning", isSpecial:true },
  { id:"perf-100days",  name:"Le Centenaire",      description:"100 jours consécutifs de lecture",                         type:"performance", tier:3, targetValue:1, points:110, iconKey:"flame",    isSpecial:true },
  { id:"perf-comeback", name:"Retour de Flamme",   description:"Reprendre la lecture après 30 jours d'inactivité",         type:"performance", tier:1, targetValue:1, points:15, iconKey:"flame",     isSpecial:true },

  // ── Genres & auteurs ──────────────────────────────────────────────────────
  { id:"polyglot",       name:"Polyglotte",     description:"Lire dans 15 genres distincts",         type:"genre",  tier:4, targetValue:15, points:180, iconKey:"compass" },
  { id:"genre-specialist",name:"Le Spécialiste", description:"Lire 10 livres d'un même genre",        type:"genre",  tier:2, targetValue:10, points:35,  iconKey:"compass", isSpecial:true },
  { id:"author-loyal",   name:"Le Fidèle",       description:"Lire 3 livres d'un même auteur",        type:"author", tier:1, targetValue:3,  points:20,  iconKey:"quill",   isSpecial:true },
  { id:"author-collect", name:"Le Collectionneur", description:"Lire 20 auteurs différents",          type:"author", tier:3, targetValue:20, points:90,  iconKey:"quill",   isSpecial:true },
  { id:"author-contemp", name:"Le Contemporain", description:"Lire 5 livres publiés cette année",     type:"author", tier:2, targetValue:5,  points:40,  iconKey:"quill",   isSpecial:true },
  { id:"author-classic", name:"Le Classique",    description:"Lire 5 livres publiés avant 1950",      type:"author", tier:2, targetValue:5,  points:40,  iconKey:"quill",   isSpecial:true },

  // ── Reviews, notes & évaluations ──────────────────────────────────────────
  { id:"review-long",   name:"Le Chroniqueur", description:"Rédiger une critique de plus de 500 caractères",        type:"review", tier:2, targetValue:1,  points:30, iconKey:"quill", isSpecial:true },
  { id:"review-curator",name:"Le Curateur",    description:"Rédiger un avis sur 15 livres",                          type:"review", tier:2, targetValue:15, points:45, iconKey:"quill" },
  { id:"note-quote",    name:"Le Citateur",    description:"10 notes de session contenant une citation",             type:"review", tier:2, targetValue:10, points:30, iconKey:"quill", isSpecial:true },
  { id:"rating-harsh",  name:"Le Juge Sévère", description:"Attribuer moins de 2 étoiles à 5 livres",                type:"review", tier:1, targetValue:5,  points:20, iconKey:"heart", isSpecial:true },
  { id:"rating-lover",  name:"Coup de Cœur",   description:"Attribuer 5 étoiles à 10 livres",                        type:"review", tier:2, targetValue:10, points:30, iconKey:"heart", isSpecial:true },
  { id:"rating-balanced", name:"L'Équilibré",  description:"Note moyenne entre 3 et 4 étoiles sur 20 livres notés",  type:"review", tier:2, targetValue:20, points:25, iconKey:"heart", isSpecial:true },

  // ── Social ────────────────────────────────────────────────────────────────
  { id:"social-photographer", name:"Photographe Confirmé", description:"Ajouter 20 photos de session", type:"social", tier:2, targetValue:20, points:35, iconKey:"camera", isSpecial:true },
  { id:"social-influencer",   name:"L'Influenceur",        description:"Être suivi par 10 membres",     type:"social", tier:2, targetValue:10, points:35, iconKey:"heart",  isSpecial:true },
  { id:"social-generous",     name:"Le Généreux",          description:"Recommander 10 livres à des amis", type:"social", tier:2, targetValue:10, points:35, iconKey:"heart", isSpecial:true },
  { id:"social-liked-2",      name:"Plébiscité+",          description:"Recevoir 50 J'aime cumulés",    type:"social", tier:4, targetValue:50, points:100, iconKey:"heart", isSpecial:true },
  { id:"social-commenter",    name:"Le Commentateur",      description:"Rédiger 20 commentaires sur les sessions d'autres membres", type:"social", tier:2, targetValue:20, points:35, iconKey:"quill", isSpecial:true },
  { id:"social-mentor",       name:"Le Mentor",            description:"Suivre 5 membres ayant rejoint Swena récemment", type:"social", tier:2, targetValue:5, points:30, iconKey:"heart", isSpecial:true },

  // ── Défis de club ─────────────────────────────────────────────────────────
  { id:"challenge-winner",  name:"Le Vainqueur",  description:"Terminer premier d'un défi de club",       type:"challenge", tier:3, targetValue:1, points:70, iconKey:"crown", isSpecial:true },
  { id:"challenge-finisher",name:"Le Finisher",   description:"Aller au bout d'un défi de club",           type:"challenge", tier:1, targetValue:1, points:20, iconKey:"chart", isSpecial:true },
  { id:"challenge-addict",  name:"L'Increvable",  description:"Participer à 5 défis de club différents",   type:"challenge", tier:2, targetValue:5, points:45, iconKey:"chart", isSpecial:true },

  // ── Ancienneté & bibliothèque ─────────────────────────────────────────────
  { id:"anniversary-1", name:"Un An Déjà",     description:"1 an depuis la création du compte",       type:"milestone", tier:2, targetValue:1, points:40, iconKey:"seal", isSpecial:true },
  { id:"anniversary-2", name:"Vétéran",        description:"2 ans depuis la création du compte",      type:"milestone", tier:3, targetValue:1, points:80, iconKey:"seal", isSpecial:true },
  { id:"import-migrator", name:"Le Migrateur", description:"Importer 50 livres ou plus depuis Goodreads", type:"milestone", tier:2, targetValue:50, points:35, iconKey:"seal", isSpecial:true },
  { id:"isbn-librarian", name:"Le Bibliothécaire", description:"Renseigner l'ISBN de 20 livres",       type:"milestone", tier:2, targetValue:20, points:30, iconKey:"seal", isSpecial:true },

  // ── Événements calendaires (suite) ───────────────────────────────────────
  { id:"event-sep1",  name:"Rentrée Littéraire", description:"Session de lecture le 1er septembre",                    type:"event", tier:2, targetValue:1, points:25, iconKey:"calendar", isSpecial:true },
  { id:"event-oct31", name:"Halloween",          description:"Session de lecture le 31 octobre sur un livre du genre Thriller, Horreur ou Policier", type:"event", tier:2, targetValue:1, points:30, iconKey:"calendar", isSpecial:true },

  // ── Parrainage ────────────────────────────────────────────────────────────
  { id:"referral-1",  name:"Le Parrain", description:"Parrainer 1 ami qui rejoint Swena",     type:"referral", tier:1, targetValue:1,  points:20,  iconKey:"invite", isSpecial:true },
  { id:"referral-3",  name:"Le Parrain", description:"Parrainer 3 amis qui rejoignent Swena", type:"referral", tier:2, targetValue:3,  points:60,  iconKey:"invite", isSpecial:true },
  { id:"referral-10", name:"Le Parrain", description:"Parrainer 10 amis qui rejoignent Swena",type:"referral", tier:3, targetValue:10, points:200, iconKey:"invite", isSpecial:true },
];

// ── Helpers date ─────────────────────────────────────────────────────────────
const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
function lastDayOf(y: number, m: number): number { return new Date(y, m, 0).getDate(); }
function monthlyBooksName(m: number): string {
  const n = MONTHS_FR[m - 1];
  return ["Avril","Août","Octobre"].includes(n) ? `Défi d'${n}` : `Défi de ${n}`;
}

// ── Badges Défi mensuel livres (Juin 2026 → Décembre 2027) ──────────────────
const MONTHLY_BOOKS_DEFS: BadgeDef[] = [];
for (let y = 2026; y <= 2027; y++) {
  for (let m = (y === 2026 ? 6 : 1); m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    MONTHLY_BOOKS_DEFS.push({
      id: `defi-books-${y}-${mm}`,
      name: monthlyBooksName(m),
      description: `Terminer 3 livres en ${MONTHS_FR[m - 1]} ${y}`,
      type: "monthly_books",
      tier: 2,
      targetValue: 3,
      points: 30,
      iconKey: "calendar",
      startDate: `${y}-${mm}-01`,
      endDate:   `${y}-${mm}-${lastDayOf(y, m)}`,
      isSpecial: true, // contrôle via check route uniquement (pas la stat générique)
    });
  }
}
BADGE_DEFS.push(...MONTHLY_BOOKS_DEFS);

// ── Badges Défi mensuel sessions (Juillet 2026 → Décembre 2027) ─────────────
const MONTHLY_SESSIONS_DEFS: BadgeDef[] = [];
for (let y = 2026; y <= 2027; y++) {
  for (let m = (y === 2026 ? 7 : 1); m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    MONTHLY_SESSIONS_DEFS.push({
      id: `defi-sessions-${y}-${mm}`,
      name: `Défi ${MONTHS_FR[m - 1]} ${y}`,
      description: `Enregistrer 15 sessions en ${MONTHS_FR[m - 1].toLowerCase()} ${y}`,
      type: "monthly",
      tier: 3,
      targetValue: 15,
      points: 50,
      iconKey: "calendar",
      startDate: `${y}-${mm}-01`,
      endDate:   `${y}-${mm}-${lastDayOf(y, m)}`,
      isSpecial: true,
    });
  }
}
BADGE_DEFS.push(...MONTHLY_SESSIONS_DEFS);

// ── Badges Objectif du mois (Juillet 2026 → Décembre 2027) ──────────────────
// Atteindre l'objectif personnel du mois (pages ou livres, au prorata de l'objectif
// annuel fixé par l'utilisateur — pas un défi à cible fixe comme les précédents).
const MONTHLY_GOAL_DEFS: BadgeDef[] = [];
for (let y = 2026; y <= 2027; y++) {
  for (let m = (y === 2026 ? 7 : 1); m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    MONTHLY_GOAL_DEFS.push({
      id: `goal-month-${y}-${mm}`,
      name: `Objectif de ${MONTHS_FR[m - 1]} ${y}`,
      description: `Atteindre ton objectif personnel de pages ou de livres du mois de ${MONTHS_FR[m - 1]} ${y}`,
      type: "monthly_goal",
      tier: 2,
      targetValue: 1,
      points: 25,
      iconKey: "target",
      startDate: `${y}-${mm}-01`,
      endDate:   `${y}-${mm}-${lastDayOf(y, m)}`,
      isSpecial: true,
    });
  }
}
BADGE_DEFS.push(...MONTHLY_GOAL_DEFS);

// ── Badges Champion du mois (Juillet 2026 → Décembre 2027) ──────────────────
// Être champion du jour (le plus de pages lues, ex æquo compris) 20 jours dans
// le même mois calendaire.
const CHAMPION_MONTH_DEFS: BadgeDef[] = [];
for (let y = 2026; y <= 2027; y++) {
  for (let m = (y === 2026 ? 7 : 1); m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    CHAMPION_MONTH_DEFS.push({
      id: `champion-month-${y}-${mm}`,
      name: `Champion de ${MONTHS_FR[m - 1]} ${y}`,
      description: `Être champion du jour 20 fois durant le mois de ${MONTHS_FR[m - 1]} ${y}`,
      type: "champion_month",
      tier: 3,
      targetValue: 20,
      points: 70,
      iconKey: "crown",
      startDate: `${y}-${mm}-01`,
      endDate:   `${y}-${mm}-${lastDayOf(y, m)}`,
      isSpecial: true,
    });
  }
}
BADGE_DEFS.push(...CHAMPION_MONTH_DEFS);

export const BADGE_CUTOFF_DATE = "2026-06-20";

// ── Helpers ───────────────────────────────────────────────────────────────────
export function getStatValue(def: BadgeDef, stats: UserBadgeStats): number {
  switch (def.type) {
    case "volume":      return stats.booksCompleted;
    case "genre":       return stats.uniqueGenres;
    case "sessions":    return stats.sessionsCount;
    case "review":      return stats.reviewsCount;
    case "pages":       return stats.totalPages;
    case "streak":      return stats.maxStreak;
    case "monthly":
    case "monthly_books":
      return -1; // contrôle date-specific dans le check route
    case "event":
    case "time_of_day":
    case "performance":
    case "social":
    default:
      return -1; // logique spéciale dans l'API
  }
}

export function getTotalPoints(unlockedIds: Set<string>): number {
  return BADGE_DEFS.filter(d => unlockedIds.has(d.id)).reduce((s, d) => s + d.points, 0);
}

// Barème recalibré : avec les badges de genre en plus, le total de points
// obtenables dépasse largement 5000 (badges fixes + badges mensuels récurrents
// dans le temps). L'ancien plafond à 1000 pts faisait atteindre le niveau
// "maximum" avec à peine 45 % de la collection débloquée — corrigé avec une
// progression plus longue (8 paliers) et un plafond bien plus élevé.
const LEVEL_THRESHOLDS = [0, 80, 250, 600, 1200, 2200, 3800, 6000] as const;
const LEVEL_TITLES     = ["", "Débutant", "Apprenti", "Confirmé", "Expert", "Maître", "Virtuose", "Légende", "Mythique"] as const;

export function getLevel(points: number): { level: number; title: string } {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= LEVEL_THRESHOLDS[i]) return { level: i + 1, title: LEVEL_TITLES[i + 1] };
  }
  return { level: 1, title: LEVEL_TITLES[1] };
}

export function getLevelProgress(points: number): {
  level: number; title: string; pct: number; toNext: number; nextTitle: string;
} {
  const { level, title } = getLevel(points);
  if (level >= LEVEL_THRESHOLDS.length) return { level, title, pct: 100, toNext: 0, nextTitle: "" };
  const from = LEVEL_THRESHOLDS[level - 1];
  const to   = LEVEL_THRESHOLDS[level];
  return {
    level, title,
    pct:      Math.min(100, ((points - from) / (to - from)) * 100),
    toNext:   to - points,
    nextTitle: LEVEL_TITLES[level + 1] ?? "",
  };
}
