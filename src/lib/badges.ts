export type BadgeTier = 1 | 2 | 3 | 4;
export type BadgeType = "volume" | "genre" | "sessions" | "pages" | "review" | "streak" | "monthly";
export type IconKey = "books" | "compass" | "lightning" | "quill" | "pages" | "flame" | "calendar";

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  type: BadgeType;
  tier: BadgeTier;
  targetValue: number;
  points: number;
  iconKey: IconKey;
  startDate?: string; // YYYY-MM-DD, inclusive
  endDate?: string;
}

export interface UserBadgeStats {
  booksCompleted: number;
  uniqueGenres: number;
  sessionsCount: number;
  reviewsCount: number;
  totalPages: number;
  maxStreak: number;
  monthlySessionCount: number;
}

// ── Couleurs par palier ───────────────────────────────────────────────────────
export const TIER_META: Record<BadgeTier, {
  label: string;
  stroke: string;
  bg: string;        // Tailwind bg class (light mode)
  bgDark: string;
  textClass: string;
  borderClass: string;
}> = {
  1: {
    label: "Bronze",
    stroke: "#c97d41",
    bg: "bg-[#fdf0e0]",
    bgDark: "dark:bg-[#2a1a0a]",
    textClass: "text-[#c97d41]",
    borderClass: "border-[#c97d41]",
  },
  2: {
    label: "Argent",
    stroke: "#8a9ab5",
    bg: "bg-[#f0f2f6]",
    bgDark: "dark:bg-[#141c28]",
    textClass: "text-[#8a9ab5]",
    borderClass: "border-[#8a9ab5]",
  },
  3: {
    label: "Or",
    stroke: "#c8961a",
    bg: "bg-[#fdf6d3]",
    bgDark: "dark:bg-[#261e00]",
    textClass: "text-[#c8961a]",
    borderClass: "border-[#c8961a]",
  },
  4: {
    label: "Platine",
    stroke: "#7c5bbf",
    bg: "bg-violet-soft",
    bgDark: "dark:bg-violet/10",
    textClass: "text-violet-deep",
    borderClass: "border-violet",
  },
};

// ── Définitions des badges ────────────────────────────────────────────────────
export const BADGE_DEFS: BadgeDef[] = [
  // Bâtisseur — livres terminés
  { id: "builder-1", name: "Bâtisseur",   description: "Terminer 5 livres",   type: "volume",   tier: 1, targetValue: 5,   points: 15,  iconKey: "books"    },
  { id: "builder-2", name: "Bâtisseur",   description: "Terminer 25 livres",  type: "volume",   tier: 2, targetValue: 25,  points: 40,  iconKey: "books"    },
  { id: "builder-3", name: "Bâtisseur",   description: "Terminer 100 livres", type: "volume",   tier: 3, targetValue: 100, points: 100, iconKey: "books"    },
  { id: "builder-4", name: "Bâtisseur",   description: "Terminer 250 livres", type: "volume",   tier: 4, targetValue: 250, points: 250, iconKey: "books"    },
  // Explorateur — genres distincts
  { id: "explorer-1", name: "Explorateur", description: "Lire dans 3 genres distincts",  type: "genre", tier: 1, targetValue: 3,  points: 10,  iconKey: "compass" },
  { id: "explorer-2", name: "Explorateur", description: "Lire dans 5 genres distincts",  type: "genre", tier: 2, targetValue: 5,  points: 25,  iconKey: "compass" },
  { id: "explorer-3", name: "Explorateur", description: "Lire dans 8 genres distincts",  type: "genre", tier: 3, targetValue: 8,  points: 60,  iconKey: "compass" },
  { id: "explorer-4", name: "Explorateur", description: "Lire dans 12 genres distincts", type: "genre", tier: 4, targetValue: 12, points: 150, iconKey: "compass" },
  // Marathonien — sessions enregistrées
  { id: "marathon-1", name: "Marathonien", description: "10 sessions de lecture",  type: "sessions", tier: 1, targetValue: 10,  points: 10,  iconKey: "lightning" },
  { id: "marathon-2", name: "Marathonien", description: "50 sessions de lecture",  type: "sessions", tier: 2, targetValue: 50,  points: 30,  iconKey: "lightning" },
  { id: "marathon-3", name: "Marathonien", description: "150 sessions de lecture", type: "sessions", tier: 3, targetValue: 150, points: 80,  iconKey: "lightning" },
  { id: "marathon-4", name: "Marathonien", description: "500 sessions de lecture", type: "sessions", tier: 4, targetValue: 500, points: 200, iconKey: "lightning" },
  // Critique — reviews rédigées
  { id: "critic-1", name: "Critique", description: "Rédiger 3 critiques",  type: "review", tier: 1, targetValue: 3,  points: 15,  iconKey: "quill" },
  { id: "critic-2", name: "Critique", description: "Rédiger 10 critiques", type: "review", tier: 2, targetValue: 10, points: 40,  iconKey: "quill" },
  { id: "critic-3", name: "Critique", description: "Rédiger 25 critiques", type: "review", tier: 3, targetValue: 25, points: 100, iconKey: "quill" },
  { id: "critic-4", name: "Critique", description: "Rédiger 75 critiques", type: "review", tier: 4, targetValue: 75, points: 200, iconKey: "quill" },
  // Vorace — pages lues total
  { id: "voracious-1", name: "Vorace", description: "Lire 1 000 pages",   type: "pages", tier: 1, targetValue: 1000,  points: 10,  iconKey: "pages" },
  { id: "voracious-2", name: "Vorace", description: "Lire 5 000 pages",   type: "pages", tier: 2, targetValue: 5000,  points: 25,  iconKey: "pages" },
  { id: "voracious-3", name: "Vorace", description: "Lire 15 000 pages",  type: "pages", tier: 3, targetValue: 15000, points: 75,  iconKey: "pages" },
  { id: "voracious-4", name: "Vorace", description: "Lire 50 000 pages",  type: "pages", tier: 4, targetValue: 50000, points: 200, iconKey: "pages" },
  // Régulier — série de jours consécutifs (max historique)
  { id: "streak-1", name: "Régulier", description: "7 jours consécutifs de lecture",   type: "streak", tier: 1, targetValue: 7,   points: 15,  iconKey: "flame" },
  { id: "streak-2", name: "Régulier", description: "21 jours consécutifs de lecture",  type: "streak", tier: 2, targetValue: 21,  points: 40,  iconKey: "flame" },
  { id: "streak-3", name: "Régulier", description: "60 jours consécutifs de lecture",  type: "streak", tier: 3, targetValue: 60,  points: 120, iconKey: "flame" },
  { id: "streak-4", name: "Régulier", description: "180 jours consécutifs de lecture", type: "streak", tier: 4, targetValue: 180, points: 300, iconKey: "flame" },
  // Défi mensuel — Juillet 2026
  {
    id: "monthly-jul-2026",
    name: "Défi Juillet 2026",
    description: "Enregistrer 15 sessions en juillet 2026",
    type: "monthly",
    tier: 3,
    targetValue: 15,
    points: 50,
    iconKey: "calendar",
    startDate: "2026-07-01",
    endDate: "2026-07-31",
  },
];

export const BADGE_CUTOFF_DATE = "2026-06-20";

// ── Helpers ───────────────────────────────────────────────────────────────────
export function getStatValue(def: BadgeDef, stats: UserBadgeStats): number {
  switch (def.type) {
    case "volume":   return stats.booksCompleted;
    case "genre":    return stats.uniqueGenres;
    case "sessions": return stats.sessionsCount;
    case "review":   return stats.reviewsCount;
    case "pages":    return stats.totalPages;
    case "streak":   return stats.maxStreak;
    case "monthly":  return stats.monthlySessionCount;
  }
}

export function getTotalPoints(unlockedIds: Set<string>): number {
  return BADGE_DEFS.filter(d => unlockedIds.has(d.id)).reduce((s, d) => s + d.points, 0);
}

export function getLevel(points: number): { level: number; title: string } {
  if (points >= 1000) return { level: 5, title: "Légende" };
  if (points >= 400)  return { level: 4, title: "Expert"  };
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
