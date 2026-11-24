// Normalisation des genres d'un livre : une liste propre de genres connus, avec toujours
// une étiquette « Fiction » ou « Non-Fiction » quand on peut la déterminer.
// Utilisé par le script de nettoyage (scripts/books-enrich.mjs) et à l'ajout d'un livre.

export const CANONICAL_GENRES = [
  "Roman", "Fiction", "Non-Fiction", "Classique", "Nouvelle",
  "Thriller", "Policier", "Crime", "Mystère",
  "Fantasy", "Science-Fiction", "Horreur",
  "Histoire", "Guerre", "Biographie", "Témoignage", "Jeunesse",
  "BD / Roman graphique", "Manga", "Comics",
  "Développement personnel", "Philosophie", "Poésie", "Psychologie",
  "Économie", "Science", "Sciences humaines", "Sciences politiques",
  "Essai", "Aventure", "Romance", "Humour", "Sport", "Cinéma",
  "Musique", "Drame", "Suspense", "Théâtre", "Voyage", "Art", "Religion", "Bien-être",
] as const;

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9/& ]+/g, " ").replace(/\s+/g, " ").trim();

const CANON_BY_KEY = new Map<string, string>(CANONICAL_GENRES.map((g) => [norm(g), g]));

// Variantes (clés normalisées) → genre(s) canonique(s). Une liste vide = on ignore le terme.
const ALIASES: Record<string, string[]> = {
  "romans": ["Roman"], "novel": ["Roman"], "novels": ["Roman"],
  "roman policier": ["Policier"], "polar": ["Policier"], "detective": ["Policier"], "mystery": ["Mystère"],
  "roman historique": ["Roman", "Histoire"], "historical fiction": ["Roman", "Histoire"],
  "nouvelles": ["Nouvelle"], "short stories": ["Nouvelle"],
  "drama": ["Drame"], "classical literature": ["Classique"], "classics": ["Classique"],
  "science fiction": ["Science-Fiction"], "sci fi": ["Science-Fiction"], "scifi": ["Science-Fiction"],
  "horror": ["Horreur"], "romance": ["Romance"], "love stories": ["Romance"],
  "biography": ["Biographie"], "biography & autobiography": ["Biographie"], "autobiography": ["Biographie"],
  "history": ["Histoire"], "philosophy": ["Philosophie"], "poetry": ["Poésie"], "psychology": ["Psychologie"],
  "self help": ["Développement personnel"], "self-help": ["Développement personnel"],
  "business & economics": ["Économie"], "economics": ["Économie"], "science": ["Science"],
  "political science": ["Sciences politiques"], "social science": ["Sciences humaines"],
  "sports & recreation": ["Sport"], "sports": ["Sport"], "sport": ["Sport"],
  "true crime": ["Crime", "Non-Fiction"], "travel": ["Voyage"], "music": ["Musique"],
  "juvenile fiction": ["Jeunesse", "Fiction"], "young adult fiction": ["Jeunesse", "Fiction"],
  "juvenile nonfiction": ["Jeunesse", "Non-Fiction"], "young adult nonfiction": ["Jeunesse", "Non-Fiction"],
  "children s stories": ["Jeunesse"], "album jeunesse": ["Jeunesse"],
  "comics & graphic novels": ["BD / Roman graphique"], "comic books strips etc": ["BD / Roman graphique"],
  "graphic novels": ["BD / Roman graphique"], "bd": ["BD / Roman graphique"],
  "literary criticism": ["Essai"], "essays": ["Essai"], "nonfiction": ["Non-Fiction"], "non fiction": ["Non-Fiction"],
  "world war 1939 1945": ["Guerre", "Histoire"], "guerre mondiale 1939 1945": ["Guerre", "Histoire"],
  "theatre": ["Théâtre"], "theater": ["Théâtre"], "plays": ["Théâtre"],
  "literary collections": [], "study aids": [], "education": [], "design": [], "families": [],
  "french literature": [], "english literature": [], "american literature": [], "french fiction": ["Fiction"],
  "french language materials": [], "contests": [], "correspondence": [], "religion": ["Religion"],
  "bien etre": ["Bien-être"], "wellness": ["Bien-être"], "art": ["Art"], "humor": ["Humour"],
  "adventure": ["Aventure"], "thrillers": ["Thriller"], "suspense": ["Suspense"],
  "cinema": ["Cinéma"], "motion picture": ["Cinéma"],
};

const KEYWORDS: [RegExp, string][] = [
  [/\bnon ?fiction\b/, "Non-Fiction"],
  [/(^|\s)(fiction|fiktion|ficcion)\b/, "Fiction"],
  [/\bromance\b/, "Romance"], [/\bthriller/, "Thriller"], [/\bfantasy\b/, "Fantasy"],
  [/\b(mystery|detective)\b/, "Mystère"], [/\bscience fiction\b/, "Science-Fiction"],
  [/\bhorror\b/, "Horreur"], [/\bgraphic novel|comics\b/, "BD / Roman graphique"],
];

const FICTION_SIGNALS =new Set(["Roman", "Fantasy", "Science-Fiction", "Thriller", "Policier", "Romance", "Horreur", "Mystère", "Suspense", "Nouvelle", "Théâtre", "Aventure", "Drame", "Poésie"]);
const NONFICTION_SIGNALS = new Set(["Biographie", "Essai", "Témoignage", "Développement personnel", "Philosophie", "Psychologie", "Économie", "Science", "Sciences humaines", "Sciences politiques", "Bien-être", "Voyage", "Religion", "Art"]);

const FICTION_FORMATS = new Set(["BD / Roman graphique", "Manga", "Comics", "Jeunesse"]);
const WEB_NOISY = ["Sport", "Cinéma", "Musique", "Art", "Voyage", "Religion", "Bien-être"];

export type NormalizedGenre = {
  genre: string;
  fiction: "Fiction" | "Non-Fiction" | null;
  /** Genres contradictoires ou signaux insuffisants : à relire à la main. */
  review: boolean;
};

/** Transforme un texte de genres brut (ou une liste) en liste propre et ordonnée. */
export function normalizeGenres(raw: string | string[] | null | undefined, opts: { web?: boolean } = {}): NormalizedGenre {
  const parts = (Array.isArray(raw) ? raw : (raw ?? "").split(",")).map((t) => t.trim()).filter(Boolean);
  const set = new Set<string>();
  for (const p of parts) {
    const k = norm(p);
    const canon = CANON_BY_KEY.get(k);
    if (canon) { set.add(canon); continue; }
    const alias = ALIASES[k];
    if (alias) { alias.forEach((a) => set.add(a)); continue; }
    // Mots-clés dans un terme plus long (« romance fiction », « historical fiction--France »…)
    for (const [re, g] of KEYWORDS) if (re.test(k)) set.add(g);
    // sinon : terme parasite (lieu, nationalité, sujet isolé), on l'ignore
  }

  // Sujets issus du web : pas de Sport / Cinéma / Art… tirés d'un mot isolé, ni de Roman générique
  if (opts.web) for (const g of WEB_NOISY) set.delete(g);

  // « Roman » n'a rien à faire sur un livre explicitement non-fiction
  if (set.has("Non-Fiction")) { set.delete("Roman"); set.delete("Fiction"); }
  if (set.has("Fiction") && set.has("Non-Fiction")) set.delete("Non-Fiction");

  let fiction: "Fiction" | "Non-Fiction" | null = set.has("Fiction") ? "Fiction" : set.has("Non-Fiction") ? "Non-Fiction" : null;
  let review = false;

  if (!fiction && set.size) {
    const f = [...set].some((g) => FICTION_SIGNALS.has(g));
    const n = [...set].some((g) => NONFICTION_SIGNALS.has(g));
    // BD, manga, comics, jeunesse : de la fiction, sauf signal d'ouvrage documentaire (Histoire, Guerre…)
    const factual = [...set].some((g) => g === "Histoire" || g === "Guerre");
    const format = [...set].some((g) => FICTION_FORMATS.has(g));
    if ((f && !n) || (format && !n && !factual)) fiction = "Fiction";
    else if (n && !f) fiction = "Non-Fiction";
    else review = true; // signaux contradictoires, ou seulement Histoire / BD / Jeunesse…
    if (fiction) set.add(fiction);
  }
  if (!set.size) review = true;

  // Ordre stable (celui de la liste des genres : Roman, Fiction, puis les thèmes)
  const order = new Map<string, number>(CANONICAL_GENRES.map((g, i) => [g, i]));
  const list = [...set].sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
  return { genre: list.join(", "), fiction, review };
}
