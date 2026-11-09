import type { Manga, MangaLog } from "./manga";

// Badges du mode Manga. Stockés dans la même table user_badges que les badges
// livres, avec des identifiants préfixés « manga- » (les écrans livres ignorent
// les identifiants qu'ils ne connaissent pas). Ce fichier est pur (aucun accès
// base) : il sert à la fois à la route serveur qui attribue les badges et aux
// écrans qui affichent la progression.

export type MangaBadgeTier = 1 | 2 | 3 | 4;
export type MangaBadgeGroup = "series" | "progress" | "habits";

export type MangaBadgeIconKey =
  | "scroll" | "stack" | "check" | "shelf" | "compass" | "flame" | "bolt" | "star" | "target"
  | "hat" | "crown" | "leaf" | "orb" | "blade" | "gear" | "notebook" | "wings" | "diamond"
  | "greatsword" | "enso" | "eye" | "wave" | "fist" | "saw" | "ball" | "wand";

export type MangaMetric =
  | "chapters" | "volumes" | "finished" | "library" | "categories"
  | "streak" | "marathon" | "rated" | "uptodate";

export interface MangaBadgeDef {
  id: string;
  name: string;
  description: string;
  group: MangaBadgeGroup;
  tier: MangaBadgeTier;
  icon: MangaBadgeIconKey;
  /** Badge « progression / habitude » : valeur à atteindre sur la statistique. */
  metric?: MangaMetric;
  target?: number;
  /** Badge « série / perso » : se débloque en avançant dans une série précise. */
  series?: {
    anilistId: number;
    /** Titres (sans accents ni ponctuation) pour reconnaître une série ajoutée à la main. */
    titles: string[];
    chapter?: number;
    volume?: number;
  };
}

export const MANGA_BADGE_GROUPS: { key: MangaBadgeGroup; label: string; hint: string }[] = [
  { key: "series", label: "Séries & persos", hint: "Avance dans les grandes séries" },
  { key: "progress", label: "Progression", hint: "Chapitres, tomes, séries terminées" },
  { key: "habits", label: "Habitudes", hint: "Régularité et marathons" },
];

const s = (
  id: string, name: string, description: string, tier: MangaBadgeTier, icon: MangaBadgeIconKey,
  series: NonNullable<MangaBadgeDef["series"]>
): MangaBadgeDef => ({ id, name, description, group: "series", tier, icon, series });

const p = (
  id: string, name: string, description: string, group: MangaBadgeGroup, tier: MangaBadgeTier,
  icon: MangaBadgeIconKey, metric: MangaMetric, target: number
): MangaBadgeDef => ({ id, name, description, group, tier, icon, metric, target });

export const MANGA_BADGE_DEFS: MangaBadgeDef[] = [
  // ── Séries & persos ───────────────────────────────────────────────────────
  s("manga-op-100", "Mugiwara", "Atteindre le chapitre 100 de One Piece", 1, "hat", { anilistId: 30013, titles: ["one piece"], chapter: 100 }),
  s("manga-op-500", "Supernova", "Atteindre le chapitre 500 de One Piece", 2, "hat", { anilistId: 30013, titles: ["one piece"], chapter: 500 }),
  s("manga-op-1000", "Roi des Pirates", "Atteindre le chapitre 1000 de One Piece", 3, "crown", { anilistId: 30013, titles: ["one piece"], chapter: 1000 }),
  s("manga-naruto-100", "Genin", "Atteindre le chapitre 100 de Naruto", 1, "leaf", { anilistId: 30011, titles: ["naruto"], chapter: 100 }),
  s("manga-naruto-end", "Hokage", "Terminer Naruto", 3, "leaf", { anilistId: 30011, titles: ["naruto"], chapter: 700, volume: 72 }),
  s("manga-dragonball-end", "Super Saiyan", "Terminer Dragon Ball", 3, "orb", { anilistId: 30042, titles: ["dragon ball"], chapter: 519, volume: 42 }),
  s("manga-bleach-end", "Shinigami remplaçant", "Terminer Bleach", 3, "blade", { anilistId: 30012, titles: ["bleach"], chapter: 686, volume: 74 }),
  s("manga-fma-end", "Alchimiste d'État", "Terminer Fullmetal Alchemist", 3, "gear", { anilistId: 30025, titles: ["fullmetal alchemist", "hagane no renkinjutsushi"], chapter: 108, volume: 27 }),
  s("manga-deathnote-end", "Kira", "Terminer Death Note", 2, "notebook", { anilistId: 30021, titles: ["death note"], chapter: 108, volume: 12 }),
  s("manga-aot-end", "Bataillon d'exploration", "Terminer L'Attaque des Titans", 3, "wings", { anilistId: 53390, titles: ["attack on titan", "shingeki no kyojin", "l attaque des titans"], chapter: 139, volume: 34 }),
  s("manga-hxh-100", "Hunter", "Atteindre le chapitre 100 de Hunter x Hunter", 2, "diamond", { anilistId: 30026, titles: ["hunter x hunter", "hunter hunter", "hunterxhunter"], chapter: 100 }),
  s("manga-berserk-100", "L'Épéiste noir", "Atteindre le chapitre 100 de Berserk", 2, "greatsword", { anilistId: 30002, titles: ["berserk"], chapter: 100 }),
  s("manga-vagabond-50", "Takezo", "Atteindre le chapitre 50 de Vagabond", 1, "enso", { anilistId: 30656, titles: ["vagabond"], chapter: 50 }),
  s("manga-vagabond-end", "Musashi", "Terminer Vagabond", 3, "enso", { anilistId: 30656, titles: ["vagabond"], chapter: 327, volume: 37 }),
  s("manga-jjk-end", "Sorcier de Jujutsu", "Terminer Jujutsu Kaisen", 3, "eye", { anilistId: 101517, titles: ["jujutsu kaisen"], chapter: 271, volume: 30 }),
  s("manga-kny-end", "Pourfendeur de démons", "Terminer Demon Slayer", 3, "wave", { anilistId: 87216, titles: ["kimetsu no yaiba", "demon slayer"], chapter: 205, volume: 23 }),
  s("manga-mha-end", "Plus Ultra", "Terminer My Hero Academia", 3, "fist", { anilistId: 85486, titles: ["boku no hero academia", "my hero academia"], chapter: 430, volume: 42 }),
  s("manga-csm-97", "Devil Hunter", "Atteindre le chapitre 97 de Chainsaw Man", 2, "saw", { anilistId: 105778, titles: ["chainsaw man"], chapter: 97 }),
  s("manga-slamdunk-end", "Génie du basket", "Terminer Slam Dunk", 3, "ball", { anilistId: 30051, titles: ["slam dunk"], chapter: 276, volume: 31 }),
  s("manga-haikyu-end", "Corbeau de Karasuno", "Terminer Haikyu!!", 3, "ball", { anilistId: 65243, titles: ["haikyu", "haikyuu"], chapter: 402, volume: 45 }),
  s("manga-fairytail-end", "Mage de Fairy Tail", "Terminer Fairy Tail", 3, "wand", { anilistId: 30598, titles: ["fairy tail"], chapter: 545, volume: 63 }),

  // ── Progression ───────────────────────────────────────────────────────────
  p("manga-chapters-1", "Lecteur de scans", "Lire 50 chapitres", "progress", 1, "scroll", "chapters", 50),
  p("manga-chapters-2", "Lecteur de scans", "Lire 250 chapitres", "progress", 2, "scroll", "chapters", 250),
  p("manga-chapters-3", "Lecteur de scans", "Lire 1 000 chapitres", "progress", 3, "scroll", "chapters", 1000),
  p("manga-chapters-4", "Lecteur de scans", "Lire 3 000 chapitres", "progress", 4, "scroll", "chapters", 3000),
  p("manga-volumes-1", "Rat de tomes", "Lire 5 tomes", "progress", 1, "stack", "volumes", 5),
  p("manga-volumes-2", "Rat de tomes", "Lire 25 tomes", "progress", 2, "stack", "volumes", 25),
  p("manga-volumes-3", "Rat de tomes", "Lire 100 tomes", "progress", 3, "stack", "volumes", 100),
  p("manga-finished-1", "Série bouclée", "Terminer 1 série", "progress", 1, "check", "finished", 1),
  p("manga-finished-2", "Série bouclée", "Terminer 5 séries", "progress", 2, "check", "finished", 5),
  p("manga-finished-3", "Série bouclée", "Terminer 15 séries", "progress", 3, "check", "finished", 15),
  p("manga-finished-4", "Série bouclée", "Terminer 40 séries", "progress", 4, "check", "finished", 40),
  p("manga-library-1", "Mangathèque garnie", "Avoir 10 séries dans ta mangathèque", "progress", 1, "shelf", "library", 10),
  p("manga-library-2", "Mangathèque garnie", "Avoir 30 séries dans ta mangathèque", "progress", 2, "shelf", "library", 30),
  p("manga-library-3", "Mangathèque garnie", "Avoir 100 séries dans ta mangathèque", "progress", 3, "shelf", "library", 100),
  p("manga-categories-1", "Touche-à-tout", "Lire dans 3 catégories (shonen, seinen, shojo...)", "progress", 2, "compass", "categories", 3),
  p("manga-categories-2", "Touche-à-tout", "Lire dans 5 catégories (shonen, seinen, shojo...)", "progress", 3, "compass", "categories", 5),
  p("manga-rated-1", "Critique", "Noter 10 sessions de lecture", "progress", 1, "star", "rated", 10),
  p("manga-rated-2", "Critique", "Noter 50 sessions de lecture", "progress", 2, "star", "rated", 50),
  p("manga-uptodate-1", "À jour", "Être à jour sur 1 série en cours de parution", "progress", 1, "target", "uptodate", 1),
  p("manga-uptodate-2", "À jour", "Être à jour sur 5 séries en cours de parution", "progress", 2, "target", "uptodate", 5),

  // ── Habitudes ─────────────────────────────────────────────────────────────
  p("manga-streak-1", "Flamme", "Lire 3 jours d'affilée", "habits", 1, "flame", "streak", 3),
  p("manga-streak-2", "Flamme", "Lire 7 jours d'affilée", "habits", 2, "flame", "streak", 7),
  p("manga-streak-3", "Flamme", "Lire 14 jours d'affilée", "habits", 3, "flame", "streak", 14),
  p("manga-streak-4", "Flamme", "Lire 30 jours d'affilée", "habits", 4, "flame", "streak", 30),
  p("manga-marathon-1", "Marathon", "Lire 10 chapitres dans la même journée", "habits", 1, "bolt", "marathon", 10),
  p("manga-marathon-2", "Marathon", "Lire 25 chapitres dans la même journée", "habits", 2, "bolt", "marathon", 25),
  p("manga-marathon-3", "Marathon", "Lire 50 chapitres dans la même journée", "habits", 3, "bolt", "marathon", 50),
];

export function isMangaBadgeId(id: string): boolean {
  return id.startsWith("manga-");
}

/* ---------------- Séries de jours ---------------- */

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

export interface MangaStreaks {
  /** Jours d'affilée jusqu'à aujourd'hui (ou hier : la série reste vivante jusqu'à la fin de la journée). */
  current: number;
  best: number;
  /** Lu aujourd'hui ? Sinon, la série en cours (si > 0) se joue encore aujourd'hui. */
  readToday: boolean;
}

/** Séries de jours consécutifs avec au moins une session. `today` au format YYYY-MM-DD, heure locale. */
export function computeStreaks(dates: string[], today: string): MangaStreaks {
  const days = [...new Set(dates.map(dayNumber))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev = NaN;
  for (const d of days) {
    run = d === prev + 1 ? run + 1 : 1;
    prev = d;
    if (run > best) best = run;
  }
  const t = dayNumber(today);
  const readToday = days.includes(t);
  // La série en cours se termine au dernier jour lu, s'il s'agit d'aujourd'hui ou d'hier
  let current = 0;
  let cursor = readToday ? t : days.includes(t - 1) ? t - 1 : NaN;
  while (!Number.isNaN(cursor) && days.includes(cursor)) {
    current += 1;
    cursor -= 1;
  }
  return { current, best, readToday };
}

/* ---------------- Évaluation ---------------- */

export type MangaBadgeInput = {
  mangas: Pick<
    Manga,
    "id" | "title" | "anilist_id" | "status" | "current_chapter" | "current_volume" | "demographic" | "publication_status" | "latest_chapter"
  >[];
  logs: Pick<MangaLog, "manga_id" | "date" | "unit" | "amount" | "rating">[];
};

export interface MangaBadgeState {
  def: MangaBadgeDef;
  unlocked: boolean;
  /** Progression vers l'objectif (pour les badges verrouillés). */
  value: number;
  target: number;
  /** « ch. », « t. »... pour afficher « 120 / 700 ch. ». */
  unit: string;
}

const normalize = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export function evaluateMangaBadges(input: MangaBadgeInput, today: string): MangaBadgeState[] {
  const { mangas, logs } = input;
  const sumUnit = (u: "chapter" | "volume") => logs.filter((l) => l.unit === u).reduce((acc, l) => acc + l.amount, 0);

  const perDay = new Map<string, number>();
  logs.filter((l) => l.unit === "chapter").forEach((l) => perDay.set(l.date, (perDay.get(l.date) ?? 0) + l.amount));

  const readIds = new Set(logs.map((l) => l.manga_id));
  const metrics: Record<MangaMetric, number> = {
    chapters: sumUnit("chapter"),
    volumes: sumUnit("volume"),
    finished: mangas.filter((m) => m.status === "completed").length,
    library: mangas.length,
    categories: new Set(
      mangas.filter((m) => readIds.has(m.id) && m.demographic && m.demographic !== "autre").map((m) => m.demographic)
    ).size,
    streak: computeStreaks(logs.map((l) => l.date), today).best,
    marathon: Math.max(0, ...perDay.values()),
    rated: logs.filter((l) => Number(l.rating) > 0).length,
    uptodate: mangas.filter((m) => {
      if (m.status !== "reading" || m.publication_status !== "RELEASING" || m.latest_chapter == null) return false;
      const latest = Math.floor(Number(m.latest_chapter));
      return latest > 0 && m.current_chapter >= latest;
    }).length,
  };

  return MANGA_BADGE_DEFS.map((def): MangaBadgeState => {
    if (def.metric && def.target) {
      const value = metrics[def.metric];
      const unit = def.metric === "chapters" ? "ch." : def.metric === "volumes" ? "t." : "";
      return { def, unlocked: value >= def.target, value: Math.min(value, def.target), target: def.target, unit };
    }
    const sr = def.series!;
    const mine = mangas.filter((m) => m.anilist_id === sr.anilistId || sr.titles.includes(normalize(m.title)));
    const completed = mine.some((m) => m.status === "completed");
    const reached =
      (sr.chapter != null && mine.some((m) => m.current_chapter >= sr.chapter!)) ||
      (sr.volume != null && mine.some((m) => m.current_volume >= sr.volume!));
    const unlocked = completed || reached;
    const chapterNow = Math.max(0, ...mine.map((m) => m.current_chapter));
    const volumeNow = Math.max(0, ...mine.map((m) => m.current_volume));
    const byChapter = sr.chapter ? chapterNow / sr.chapter : 0;
    const byVolume = sr.volume ? volumeNow / sr.volume : 0;
    const useVolume = byVolume > byChapter;
    return {
      def,
      unlocked,
      value: unlocked ? (useVolume ? sr.volume! : sr.chapter!) : useVolume ? volumeNow : chapterNow,
      target: (useVolume ? sr.volume : sr.chapter) ?? 1,
      unit: useVolume ? "t." : "ch.",
    };
  });
}
