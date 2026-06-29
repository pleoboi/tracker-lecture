import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GOOGLE_BOOKS_KEY = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_KEY ?? process.env.GOOGLE_BOOKS_KEY ?? "";
const MAX_BOOKS = 500;
const ENRICH_CONCURRENCY = 12;

// ── Extraction depuis XML (CDATA ou texte brut) ───────────────────────────────
function extractTag(xml: string, tag: string): string {
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, "i");
  const cdataM  = xml.match(cdataRe);
  if (cdataM) return cdataM[1].trim();
  const plainRe = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const plainM  = xml.match(plainRe);
  return plainM?.[1]?.trim() ?? "";
}

// ── Parsing date RSS (RFC 2822) → YYYY-MM-DD ─────────────────────────────────
function parseRssDate(s: string): string | null {
  if (!s) return null;
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

// ── Extraction de l'ID Goodreads depuis une URL ou un ID brut ────────────────
function extractUserId(input: string): string | null {
  const m = input.match(/(\d{5,})/);
  return m?.[1] ?? null;
}

// ── Améliore une URL de couverture Goodreads → taille maximale ───────────────
function upgradeGoodreadsCover(url: string | null): string | null {
  if (!url || url.includes("nophoto")) return null;
  // Format classique : ...TIMESTAMPm/ID.jpg → ...TIMESTAMPl/ID.jpg
  let u = url.replace(/(\d{4,})m\/(\d+\.jpg)/, "$1l/$2");
  // Format Amazon-CDN : _SX98_ / _SY160_ → _SX500_
  u = u.replace(/_S[XY]\d+_/g, "_SX500_");
  return u;
}

// ── Améliore une URL Google Books thumbnail → haute résolution ───────────────
function upgradeGoogleBooksCover(url: string): string {
  return url
    .replace("zoom=1", "zoom=0")
    .replace("zoom=2", "zoom=0")
    .replace(/^http:/, "https:");
}

// ── Google Books lookup par ISBN (édition française en priorité) ─────────────
type GBResult = {
  title: string | null;
  summary: string | null;
  coverUrl: string | null;
  genre: string | null;
  year: number | null;
};

async function googleBooksByIsbn(isbn: string): Promise<GBResult | null> {
  const keyParam = GOOGLE_BOOKS_KEY ? `&key=${GOOGLE_BOOKS_KEY}` : "";

  // 1. Tentative édition française
  let result = await fetchGoogleBooks(`isbn:${isbn}`, "fr", keyParam);
  // 2. Si aucune donnée utile, essai sans restriction de langue
  if (!result || (!result.coverUrl && !result.summary)) {
    const fallback = await fetchGoogleBooks(`isbn:${isbn}`, "", keyParam);
    if (fallback && (fallback.coverUrl || fallback.summary)) {
      result = {
        title:    result?.title    ?? fallback.title,
        summary:  result?.summary  ?? fallback.summary,
        coverUrl: result?.coverUrl ?? fallback.coverUrl,
        genre:    result?.genre    ?? fallback.genre,
        year:     result?.year     ?? fallback.year,
      };
    }
  }
  return result;
}

async function fetchGoogleBooks(
  query: string,
  lang: string,
  keyParam: string
): Promise<GBResult | null> {
  const langParam = lang ? `&langRestrict=${lang}` : "";
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=3${langParam}${keyParam}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    type GBItem = { volumeInfo: { title?: string; description?: string; imageLinks?: { thumbnail?: string; large?: string }; categories?: string[]; publishedDate?: string } };
    const data = await res.json() as { totalItems: number; items?: GBItem[] };
    if (!data.items?.length) return null;
    const vol = data.items[0].volumeInfo;
    const rawCover = vol.imageLinks?.large ?? vol.imageLinks?.thumbnail;
    return {
      title:    vol.title ?? null,
      summary:  vol.description?.slice(0, 2500) ?? null,
      coverUrl: rawCover ? upgradeGoogleBooksCover(rawCover) : null,
      genre:    vol.categories?.[0] ?? null,
      year:     vol.publishedDate ? parseInt(vol.publishedDate.slice(0, 4), 10) || null : null,
    };
  } catch {
    return null;
  }
}

// ── Fetch d'une page RSS Goodreads ───────────────────────────────────────────
async function fetchRssPage(userId: string, page: number): Promise<string | null> {
  const url = `https://www.goodreads.com/review/list_rss/${userId}?shelf=read&per_page=200&page=${page}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

interface ParsedBook {
  title: string;
  author: string;
  isbn13: string | null;
  pages: number;
  rating: number;
  status: string;
  date_read: string | null;
  date_started: string | null;
  notes: string | null;
  cover_url: string | null;
  summary: string | null;
  published_year: number | null;
  genre: string | null;
}

function parseItems(xml: string): ParsedBook[] {
  const rawItems = xml.split(/<item>/i).slice(1).map((s) => {
    const end = s.indexOf("</item>");
    return end !== -1 ? s.slice(0, end) : s;
  });

  return rawItems.map((item): ParsedBook => {
    const bookSec = item.match(/<book[^>]*>([\s\S]*?)<\/book>/i)?.[1] ?? "";

    const title =
      extractTag(bookSec, "title_without_series") ||
      extractTag(bookSec, "title") ||
      extractTag(item, "title");

    const author =
      extractTag(item, "author_name") ||
      extractTag(bookSec, "author_name");

    const isbn13Raw =
      extractTag(item, "isbn13") ||
      extractTag(bookSec, "isbn13") ||
      extractTag(item, "isbn") ||
      extractTag(bookSec, "isbn");
    const isbn13 = isbn13Raw.replace(/[^0-9]/g, "").slice(-13) || null;
    const validIsbn = isbn13 && isbn13.length >= 10 ? isbn13 : null;

    const pagesRaw = extractTag(bookSec, "num_pages") || extractTag(item, "num_pages");
    const pages = Math.max(0, parseInt(pagesRaw, 10) || 0);
    const userRating = parseInt(extractTag(item, "user_rating"), 10) || 0;
    const dateRead = parseRssDate(extractTag(item, "user_read_at"));
    const shelf = extractTag(item, "user_shelves") || "read";
    const status = shelf.includes("currently") ? "reading" : "completed";

    const rawCover =
      extractTag(item, "book_large_image_url") ||
      extractTag(item, "book_image_url") ||
      null;

    const summary = extractTag(item, "book_description")?.slice(0, 2500) || null;
    const pubYearRaw = extractTag(bookSec, "published");

    return {
      title: title || "(Titre inconnu)",
      author: author || "Auteur inconnu",
      isbn13: validIsbn,
      pages,
      rating: Math.min(5, Math.max(0, userRating)),
      status,
      date_read: dateRead,
      date_started: null,
      notes: null,
      cover_url: upgradeGoodreadsCover(rawCover),
      summary,
      published_year: parseInt(pubYearRaw, 10) || null,
      genre: null,
    };
  }).filter((b) => b.title !== "(Titre inconnu)" || b.author !== "Auteur inconnu");
}

export async function POST(req: NextRequest) {
  const { url } = (await req.json()) as { url?: string };
  if (!url?.trim()) {
    return NextResponse.json({ error: "URL manquante" }, { status: 400 });
  }

  const goodreadsUserId = extractUserId(url.trim());
  if (!goodreadsUserId) {
    return NextResponse.json(
      { error: "Identifiant Goodreads introuvable dans l'URL fournie." },
      { status: 400 }
    );
  }

  // ── 1. Pagination RSS — jusqu'à MAX_BOOKS livres (3 pages de 200) ────────────
  const page1xml = await fetchRssPage(goodreadsUserId, 1);
  if (!page1xml) {
    return NextResponse.json(
      { error: "Goodreads est inaccessible. Vérifiez que votre profil est public et réessayez." },
      { status: 502 }
    );
  }

  let allBooks = parseItems(page1xml);

  if (!allBooks.length) {
    return NextResponse.json(
      { error: "Aucun livre trouvé. Assurez-vous que votre profil Goodreads est public et contient des livres lus." },
      { status: 200 }
    );
  }

  // Fetch pages 2 et 3 si la page 1 est pleine (200 livres)
  if (allBooks.length >= 200) {
    const page2xml = await fetchRssPage(goodreadsUserId, 2);
    if (page2xml) {
      const page2 = parseItems(page2xml);
      allBooks = [...allBooks, ...page2];

      if (page2.length >= 200 && allBooks.length < MAX_BOOKS) {
        const page3xml = await fetchRssPage(goodreadsUserId, 3);
        if (page3xml) {
          allBooks = [...allBooks, ...parseItems(page3xml)];
        }
      }
    }
  }

  // Tronquer à 500
  if (allBooks.length > MAX_BOOKS) allBooks = allBooks.slice(0, MAX_BOOKS);

  // ── 2. Enrichissement Google Books (côté serveur, par ISBN) ─────────────────
  // Ne traiter que les livres avec ISBN13 — accélère considérablement
  const withIsbn    = allBooks.filter((b) => b.isbn13);
  const withoutIsbn = allBooks.filter((b) => !b.isbn13);

  const enrichedWithIsbn: ParsedBook[] = [...withIsbn];

  for (let i = 0; i < withIsbn.length; i += ENRICH_CONCURRENCY) {
    const batch = withIsbn.slice(i, i + ENRICH_CONCURRENCY);
    await Promise.all(
      batch.map(async (book, j) => {
        const gb = await googleBooksByIsbn(book.isbn13!);
        if (!gb) return;

        enrichedWithIsbn[i + j] = {
          ...book,
          // Titre français préféré si Google Books en a un
          title:          gb.title ?? book.title,
          cover_url:      gb.coverUrl ?? book.cover_url,
          summary:        gb.summary ?? book.summary,
          published_year: gb.year    ?? book.published_year,
          genre:          gb.genre   ?? book.genre,
        };
      })
    );
  }

  const books = [...enrichedWithIsbn, ...withoutIsbn];

  return NextResponse.json({ books, userId: goodreadsUserId, count: books.length });
}
