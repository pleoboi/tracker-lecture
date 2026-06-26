import { NextResponse } from "next/server";
import { mapVolume } from "../../../../lib/googleBooks";
import type { BookSuggestion } from "../../../../lib/googleBooks";

export const dynamic = "force-dynamic";

// Open Library subjects → French genre labels
const OL_GENRES: Record<string, string> = {
  fiction: "Roman",
  "juvenile fiction": "Jeunesse",
  "science fiction": "Science-Fiction",
  fantasy: "Fantasy",
  history: "Histoire",
  biography: "Biographie",
  philosophy: "Philosophie",
  poetry: "Poésie",
  comics: "BD / Roman graphique",
  mystery: "Policier",
  thriller: "Thriller",
  romance: "Romance",
  horror: "Horreur",
  psychology: "Psychologie",
  "self-help": "Développement personnel",
  science: "Science",
  "political science": "Sciences politiques",
  "social science": "Sciences humaines",
  "detective": "Policier",
  "short stories": "Nouvelles",
  "historical fiction": "Roman historique",
};

function olGenre(subjects: string[] | undefined): string | null {
  if (!subjects?.length) return null;
  for (const s of subjects.slice(0, 5)) {
    const key = s.toLowerCase();
    for (const [k, v] of Object.entries(OL_GENRES)) {
      if (key.includes(k)) return v;
    }
  }
  return subjects[0] || null;
}

interface OLDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  subject?: string[];
  cover_i?: number;
}

function mapOLDoc(doc: OLDoc): BookSuggestion {
  const workId = (doc.key ?? "").replace("/works/", "") || `ol-${Math.random().toString(36).slice(2)}`;
  return {
    googleId: workId,
    title: doc.title || "Sans titre",
    author: doc.author_name?.join(", ") || "Auteur inconnu",
    genre: olGenre(doc.subject),
    year: doc.first_publish_year ?? null,
    coverUrl: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
      : null,
    summary: null,
  };
}

async function searchOpenLibrary(q: string, lang?: string): Promise<BookSuggestion[]> {
  const params = new URLSearchParams({
    q,
    limit: "15",
    fields: "key,title,author_name,first_publish_year,subject,cover_i",
  });
  if (lang) params.set("language", lang);
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?${params.toString()}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.docs || []) as OLDoc[])
      .filter((d) => d.title)
      .map(mapOLDoc);
  } catch {
    return [];
  }
}

function mergeResults(base: BookSuggestion[], extra: BookSuggestion[]): BookSuggestion[] {
  const seenIds = new Set(base.map((i) => i.googleId));
  const seenTitles = new Set(
    base.map((i) => `${i.title.toLowerCase().trim()}|${i.author.toLowerCase().trim()}`)
  );
  for (const item of extra) {
    const tk = `${item.title.toLowerCase().trim()}|${item.author.toLowerCase().trim()}`;
    if (!seenIds.has(item.googleId) && !seenTitles.has(tk)) {
      seenIds.add(item.googleId);
      seenTitles.add(tk);
      base.push(item);
    }
  }
  return base;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  // Pass 1 : Open Library en parallèle (français en priorité + toutes langues)
  // Aucun quota, aucune clé API nécessaire
  const [olFr, olAll] = await Promise.all([
    searchOpenLibrary(q, "fre"),
    searchOpenLibrary(q),
  ]);
  let items = mergeResults(olFr, olAll);

  // Pass 2 : Google Books en complément uniquement si clé présente et résultats insuffisants
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (key && items.length < 8) {
    try {
      const params = new URLSearchParams({
        q,
        maxResults: "12",
        printType: "books",
        hl: "fr",
        key,
      });
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
        { next: { revalidate: 3600 } }
      );
      if (res.ok) {
        const data = await res.json();
        const gbItems: BookSuggestion[] = ((data.items || []) as unknown[]).map(mapVolume);
        items = mergeResults(items, gbItems);
      }
    } catch { /* Google Books optionnel, on ignore les erreurs */ }
  }

  return NextResponse.json({ results: items.slice(0, 12) });
}
