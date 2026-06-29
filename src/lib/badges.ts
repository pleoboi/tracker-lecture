export type BadgeTier = 1 | 2 | 3 | 4;
export type BadgeType =
  | "volume" | "genre" | "sessions" | "pages" | "review" | "streak" | "monthly"
  | "event" | "time_of_day" | "performance" | "social" | "quiz" | "monthly_books";

export type IconKey =
  | "books" | "compass" | "lightning" | "quill" | "pages" | "flame" | "calendar"
  | "moon" | "sunrise" | "heart" | "camera" | "chart" | "crown" | "seal";

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
  label: string; stroke: string; bg: string; bgDark: string; textClass: string; borderClass: string;
}> = {
  1: { label:"Bronze",  stroke:"#c97d41", bg:"bg-[#fdf0e0]",  bgDark:"dark:bg-[#2a1a0a]",  textClass:"text-[#c97d41]",   borderClass:"border-[#c97d41]"  },
  2: { label:"Argent",  stroke:"#8a9ab5", bg:"bg-[#f0f2f6]",  bgDark:"dark:bg-[#141c28]",  textClass:"text-[#8a9ab5]",   borderClass:"border-[#8a9ab5]"  },
  3: { label:"Or",      stroke:"#c8961a", bg:"bg-[#fdf6d3]",  bgDark:"dark:bg-[#261e00]",  textClass:"text-[#c8961a]",   borderClass:"border-[#c8961a]"  },
  4: { label:"Platine", stroke:"#7c5bbf", bg:"bg-violet-soft", bgDark:"dark:bg-violet/10", textClass:"text-violet-deep", borderClass:"border-violet"     },
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
  // ── Défi mensuel sessions — Juillet 2026 ────────────────────────────────
  { id:"monthly-jul-2026", name:"Défi Juillet 2026", description:"Enregistrer 15 sessions en juillet 2026",
    type:"monthly", tier:3, targetValue:15, points:50, iconKey:"calendar", startDate:"2026-07-01", endDate:"2026-07-31" },

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

  // ── Validation de lecture (cumulatif : +30 pts par livre validé) ─────────
  { id:"sans-faute", name:"Sans Faute", description:"Valider le QCM de fin de lecture avec la bonne réponse",
    type:"quiz", tier:3, targetValue:1, points:0, iconKey:"seal", isSpecial:true },
];

// ── Badges Défi mensuel livres (Juin 2026 → Décembre 2027) ──────────────────
const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
function monthlyBooksName(m: number): string {
  const n = MONTHS_FR[m - 1];
  return ["Avril","Août","Octobre"].includes(n) ? `Défi d'${n}` : `Défi de ${n}`;
}

const MONTHLY_BOOKS_DEFS: BadgeDef[] = [];
for (let y = 2026; y <= 2027; y++) {
  for (let m = (y === 2026 ? 6 : 1); m <= 12; m++) {
    MONTHLY_BOOKS_DEFS.push({
      id: `defi-books-${y}-${String(m).padStart(2, "0")}`,
      name: monthlyBooksName(m),
      description: `Terminer 3 livres en ${MONTHS_FR[m - 1]} ${y}`,
      type: "monthly_books",
      tier: 2,
      targetValue: 3,
      points: 30,
      iconKey: "calendar",
    });
  }
}
BADGE_DEFS.push(...MONTHLY_BOOKS_DEFS);

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
    case "monthly":     return stats.monthlySessionCount;
    case "monthly_books": return stats.monthlyBooksCount;
    case "event":
    case "time_of_day":
    case "performance":
    case "social":
    case "quiz":
    default:
      return -1; // logique spéciale dans l'API
  }
}

export function getTotalPoints(unlockedIds: Set<string>): number {
  return BADGE_DEFS.filter(d => unlockedIds.has(d.id)).reduce((s, d) => s + d.points, 0);
}

export function getLevel(points: number): { level: number; title: string } {
  if (points >= 1000) return { level: 5, title: "Légende"  };
  if (points >= 400)  return { level: 4, title: "Expert"   };
  if (points >= 150)  return { level: 3, title: "Confirmé" };
  if (points >= 50)   return { level: 2, title: "Apprenti" };
  return { level: 1, title: "Débutant" };
}

const LEVEL_THRESHOLDS = [0, 50, 150, 400, 1000] as const;
const LEVEL_TITLES     = ["", "Débutant", "Apprenti", "Confirmé", "Expert", "Légende"] as const;

export function getLevelProgress(points: number): {
  level: number; title: string; pct: number; toNext: number; nextTitle: string;
} {
  const { level, title } = getLevel(points);
  if (level === 5) return { level, title, pct: 100, toNext: 0, nextTitle: "" };
  const from = LEVEL_THRESHOLDS[level - 1];
  const to   = LEVEL_THRESHOLDS[level];
  return {
    level, title,
    pct:      Math.min(100, ((points - from) / (to - from)) * 100),
    toNext:   to - points,
    nextTitle: LEVEL_TITLES[level + 1] ?? "",
  };
}
