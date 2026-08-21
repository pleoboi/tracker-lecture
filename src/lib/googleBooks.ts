/**
 * Recherche de livres via Google Books.
 * Côté client : on appelle notre route serveur /api/books/search (qui ajoute
 * la clé API si elle est configurée, pour éviter le quota partagé du mode sans clé).
 * On ne récupère que genre / année / couverture / résumé (les pages sont saisies à la main).
 */

export interface BookSuggestion {
  googleId: string;
  title: string;
  author: string;
  genre: string | null;
  year: number | null;
  coverUrl: string | null;
  summary: string | null;
  isbn: string | null;
}

// Traduction des catégories Google (souvent en anglais) vers le français.
const GENRE_FR: Record<string, string> = {
  fiction: "Roman",
  "juvenile fiction": "Jeunesse",
  "science fiction": "Science-Fiction",
  fantasy: "Fantasy",
  history: "Histoire",
  biography: "Biographie",
  "biography & autobiography": "Biographie",
  philosophy: "Philosophie",
  poetry: "Poésie",
  "comics & graphic novels": "BD / Roman graphique",
  "business & economics": "Économie",
  psychology: "Psychologie",
  "self-help": "Développement personnel",
  science: "Science",
  "political science": "Sciences politiques",
  "social science": "Sciences humaines",
  thriller: "Thriller",
  "detective and mystery stories": "Policier",
};

function frenchGenre(category: string | undefined): string | null {
  if (!category) return null;
  const segments = category.split("/").map((s) => s.trim());
  const main = segments[segments.length - 1] || segments[0];
  const key = main.toLowerCase();
  return GENRE_FR[key] || GENRE_FR[category.toLowerCase()] || main;
}

function httpsCover(thumbnail: string | undefined): string | null {
  if (!thumbnail) return null;
  return thumbnail
    .replace(/^http:/, "https:")
    .replace(/&edge=curl/, "")
    .replace(/&zoom=\d+/, "&zoom=1");
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Mots très fréquents en français mais rares en anglais/néerlandais/etc.
const FR_MARKERS = [
  " est ", " une ", " dans ", " avec ", " pour ", " mais ", " qui ",
  " que ", " les ", " des ", " cette ", " sont ", " leur ", " sur ",
  " par ", " aussi ", " très ", " comme ", " encore ", " tout ",
];

export function isFrench(text: string): boolean {
  const haystack = " " + text.toLowerCase() + " ";
  let hits = 0;
  for (const w of FR_MARKERS) {
    if (haystack.includes(w) && ++hits >= 4) return true;
  }
  return false;
}

/** Transforme un volume brut de l'API Google Books en suggestion (utilisé côté serveur). */
export function mapVolume(item: any): BookSuggestion {
  const v = item.volumeInfo || {};
  const yearMatch = (v.publishedDate || "").match(/\d{4}/);
  // ISBN : on privilégie l'ISBN_13, sinon l'ISBN_10.
  const ids = (v.industryIdentifiers || []) as { type?: string; identifier?: string }[];
  const isbn =
    ids.find((i) => i.type === "ISBN_13")?.identifier ||
    ids.find((i) => i.type === "ISBN_10")?.identifier ||
    null;
  return {
    googleId: item.id,
    title: v.title || "Sans titre",
    author: (v.authors && v.authors.join(", ")) || "Auteur inconnu",
    isbn: isbn ? isbn.replace(/[^0-9Xx]/g, "") : null,
    genre: frenchGenre(v.categories && v.categories[0]),
    year: yearMatch ? Number(yearMatch[0]) : null,
    coverUrl: httpsCover(
      v.imageLinks && (
        v.imageLinks.extraLarge ||
        v.imageLinks.large ||
        v.imageLinks.medium ||
        v.imageLinks.thumbnail ||
        v.imageLinks.smallThumbnail
      )
    ),
    summary: (() => {
      if (!v.description) return null;
      const cleaned = stripHtml(v.description);
      return isFrench(cleaned) ? cleaned : null;
    })(),
  };
}

/**
 * Cherche une couverture haute qualité sur Open Library.
 * Essaie d'abord par ISBN13, puis par titre + auteur.
 * Retourne l'URL grande taille (-L.jpg) ou null.
 */
export async function fetchOpenLibraryCover(
  title: string,
  author: string,
  isbn13?: string | null
): Promise<string | null> {
  try {
    // 1. Par ISBN — le plus précis
    if (isbn13) {
      const res = await fetch(
        `https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn13)}&limit=1`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        const coverId = data.docs?.[0]?.cover_i as number | undefined;
        if (coverId) return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
      }
    }
    // 2. Par titre + auteur
    const q = [title, author].filter(Boolean).join(" ").trim();
    if (!q) return null;
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=5`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const hit = ((data.docs || []) as { cover_i?: number }[]).find((d) => d.cover_i);
    if (hit?.cover_i) return `https://covers.openlibrary.org/b/id/${hit.cover_i}-L.jpg`;
  } catch { /* pas de couverture */ }
  return null;
}

// Mapping catégorie (Google Books, souvent hiérarchique/anglais) → genre canonique FR.
// Ordre important : du plus spécifique au plus générique ("fiction" en dernier).
const CATEGORY_TO_GENRE: [string, string][] = [
  ["juvenile fiction", "Jeunesse"], ["juvenile nonfiction", "Jeunesse"],
  ["young adult", "Jeunesse"], ["jeunesse", "Jeunesse"], ["enfant", "Jeunesse"],
  ["science fiction", "Science-Fiction"], ["science-fiction", "Science-Fiction"],
  ["fantasy", "Fantasy"], ["fantastique", "Fantasy"], ["fantasy fiction", "Fantasy"],
  ["thriller", "Thriller"], ["suspense", "Suspense"],
  ["mystery", "Mystère"], ["mystère", "Mystère"],
  ["detective", "Policier"], ["policier", "Policier"], ["police", "Policier"],
  ["true crime", "Crime"], ["crime", "Crime"],
  ["graphic novel", "BD / Roman graphique"], ["comic", "Comics"],
  ["bande dessinée", "BD / Roman graphique"], ["manga", "Manga"],
  ["biography", "Biographie"], ["biographie", "Biographie"], ["autobiography", "Biographie"],
  ["memoir", "Témoignage"], ["témoignage", "Témoignage"],
  ["history", "Histoire"], ["histoire", "Histoire"], ["historical", "Histoire"],
  ["war", "Guerre"], ["guerre", "Guerre"], ["military", "Guerre"],
  ["philosophy", "Philosophie"], ["philosophie", "Philosophie"],
  ["poetry", "Poésie"], ["poésie", "Poésie"],
  ["psychology", "Psychologie"], ["psychologie", "Psychologie"],
  ["self-help", "Développement personnel"], ["self help", "Développement personnel"],
  ["développement personnel", "Développement personnel"], ["bien-être", "Développement personnel"],
  ["business", "Économie"], ["economics", "Économie"], ["économie", "Économie"],
  ["political science", "Sciences politiques"], ["politique", "Sciences politiques"],
  ["social science", "Sciences humaines"], ["sciences humaines", "Sciences humaines"],
  ["romance", "Romance"], ["love stories", "Romance"],
  ["humor", "Humour"], ["humour", "Humour"], ["comic", "Humour"], ["comedy", "Humour"],
  ["adventure", "Aventure"], ["aventure", "Aventure"],
  ["sports", "Sport"], ["sport", "Sport"],
  ["music", "Musique"], ["musique", "Musique"],
  ["performing arts", "Cinéma"], ["cinema", "Cinéma"], ["cinéma", "Cinéma"], ["film", "Cinéma"],
  ["drama", "Drame"], ["drame", "Drame"],
  ["theater", "Théâtre"], ["theatre", "Théâtre"], ["théâtre", "Théâtre"],
  ["essay", "Essai"], ["essai", "Essai"],
  ["short stories", "Nouvelle"], ["nouvelle", "Nouvelle"],
  ["classic", "Classique"], ["classique", "Classique"],
  ["science", "Science"],
  ["nonfiction", "Non-Fiction"], ["non-fiction", "Non-Fiction"],
  ["fiction", "Roman"], ["roman", "Roman"], ["littérature", "Roman"], ["literature", "Roman"],
];

function mapCategorySegment(segment: string): string | null {
  const key = segment.trim().toLowerCase();
  if (!key) return null;
  for (const [needle, genre] of CATEGORY_TO_GENRE) {
    if (key.includes(needle)) return genre;
  }
  return null;
}

/**
 * Mappe des catégories (Google Books, souvent hiérarchiques « Fiction / Thrillers / Crime »)
 * vers des genres canoniques FR distincts. Fonction pure (réutilisable côté serveur).
 */
export function mapCategoriesToGenres(categories: string[]): string[] {
  const found = new Set<string>();
  for (const cat of categories) {
    for (const seg of String(cat).split(/[/,&>]/)) {
      const g = mapCategorySegment(seg);
      if (g) found.add(g);
    }
  }
  return [...found].slice(0, 6);
}

/**
 * Parmi des extraits d'articles Wikipédia, choisit celui qui décrit bien le LIVRE
 * (et pas une adaptation film/série — ex. « Conclave »). Fonction pure.
 * Préfère un extrait qui parle d'un livre ET mentionne l'auteur ; sinon un extrait
 * clairement « livre » ; sinon rien (on ne renvoie jamais un résumé douteux).
 */
export function pickBookExtract(
  pages: { extract?: string; index?: number }[],
  author: string,
): string | null {
  const surname = author.trim().split(/\s+/).filter(Boolean).pop()?.toLowerCase() || "";
  const isBook = (t: string) =>
    /\b(un roman|une nouvelle|un récit|un essai|un livre|une bande dessinée|un recueil)\b|roman (?:de |policier|historique|graphique)/.test(t);
  const isScreen = (t: string) =>
    /\b(un film|une série|un téléfilm|une mini-série|un long métrage)\b|réalisé par|réalisée par/.test(t);

  const candidates = [...pages]
    .sort((a, b) => (a.index ?? 99) - (b.index ?? 99))
    .map((p) => (p.extract || "").trim())
    .filter((ex) => ex.length > 40);

  const withAuthor = candidates.find((ex) => {
    const low = ex.toLowerCase();
    return isBook(low) && !isScreen(low) && surname && low.includes(surname);
  });
  if (withAuthor) return withAuthor;

  const bookOnly = candidates.find((ex) => {
    const low = ex.toLowerCase();
    return isBook(low) && !isScreen(low);
  });
  return bookOnly ?? null;
}

/** Recherche côté client (passe par notre route serveur). */
export async function searchBooks(query: string): Promise<BookSuggestion[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Recherche indisponible");
  }
  const data = await res.json();
  return data.results || [];
}
