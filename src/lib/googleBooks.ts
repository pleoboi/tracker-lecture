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
  return thumbnail.replace(/^http:/, "https:").replace(/&edge=curl/, "");
}

/** Transforme un volume brut de l'API Google Books en suggestion (utilisé côté serveur). */
export function mapVolume(item: any): BookSuggestion {
  const v = item.volumeInfo || {};
  const yearMatch = (v.publishedDate || "").match(/\d{4}/);
  return {
    googleId: item.id,
    title: v.title || "Sans titre",
    author: (v.authors && v.authors.join(", ")) || "Auteur inconnu",
    genre: frenchGenre(v.categories && v.categories[0]),
    year: yearMatch ? Number(yearMatch[0]) : null,
    coverUrl: httpsCover(v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail)),
    summary: v.description || null,
  };
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
