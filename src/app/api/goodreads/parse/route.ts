import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

export async function POST(req: NextRequest) {
  const { url } = (await req.json()) as { url?: string };
  if (!url?.trim()) {
    return NextResponse.json({ error: "URL manquante" }, { status: 400 });
  }

  const userId = extractUserId(url.trim());
  if (!userId) {
    return NextResponse.json(
      { error: "Identifiant Goodreads introuvable dans l'URL fournie." },
      { status: 400 }
    );
  }

  const rssUrl = `https://www.goodreads.com/review/list_rss/${userId}?shelf=read&per_page=200`;

  let xml: string;
  try {
    const res = await fetch(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json(
          { error: "Profil Goodreads introuvable. Vérifiez l'URL et que votre profil est public." },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: `Impossible d'accéder à Goodreads (erreur ${res.status}).` },
        { status: 502 }
      );
    }

    xml = await res.text();
  } catch {
    return NextResponse.json(
      { error: "Goodreads est inaccessible. Vérifiez votre connexion ou réessayez plus tard." },
      { status: 502 }
    );
  }

  // ── Découpage en items ───────────────────────────────────────────────────────
  const rawItems = xml.split(/<item>/i).slice(1).map((s) => {
    const end = s.indexOf("</item>");
    return end !== -1 ? s.slice(0, end) : s;
  });

  if (!rawItems.length) {
    return NextResponse.json(
      { error: "Aucun livre trouvé. Assurez-vous que votre profil Goodreads est public et contient des livres lus." },
      { status: 200 }
    );
  }

  const books: ParsedBook[] = rawItems.map((item) => {
    // Sous-section <book>...</book>
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

    const dateRead    = parseRssDate(extractTag(item, "user_read_at"));
    const dateStarted = null; // non disponible dans le flux RSS

    const shelf = extractTag(item, "user_shelves") || "read";
    const status = shelf.includes("currently") ? "reading" : "completed";

    const coverUrl =
      extractTag(item, "book_large_image_url") ||
      extractTag(item, "book_image_url") ||
      null;
    // Filtrer les images placeholder Goodreads (dimensions 1x1)
    const validCover = coverUrl && !coverUrl.includes("nophoto") ? coverUrl : null;

    const summary =
      extractTag(item, "book_description")?.slice(0, 2000) || null;

    const pubYearRaw = extractTag(bookSec, "published");
    const publishedYear = parseInt(pubYearRaw, 10) || null;

    return {
      title: title || "(Titre inconnu)",
      author: author || "Auteur inconnu",
      isbn13: validIsbn,
      pages,
      rating: Math.min(5, Math.max(0, userRating)),
      status,
      date_read: dateRead,
      date_started: dateStarted,
      notes: null,
      cover_url: validCover,
      summary,
      published_year: publishedYear,
      genre: null,
    };
  }).filter((b) => b.title !== "(Titre inconnu)" || b.author !== "Auteur inconnu");

  return NextResponse.json({ books, userId, count: books.length });
}
