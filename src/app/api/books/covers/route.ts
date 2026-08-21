import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function httpsCover(url: string | undefined, zoom = 1): string | null {
  if (!url) return null;
  return url
    .replace(/^http:/, "https:")
    .replace(/&edge=curl/, "")
    .replace(/&zoom=\d+/, `&zoom=${zoom}`);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const title = url.searchParams.get("title")?.trim() || "";
  const author = url.searchParams.get("author")?.trim() || "";

  if (!title) return NextResponse.json({ covers: [] });

  const key = process.env.GOOGLE_BOOKS_API_KEY;
  const surname = author.split(/\s+/).filter(Boolean).pop() || author;

  const queries = [
    `intitle:"${title}" inauthor:"${surname}"`,
    `intitle:"${title}"`,
    `${title} ${surname}`,
  ];

  const allCovers: string[] = [];
  const seen = new Set<string>();

  // Apple Books (iTunes Search API) — pochettes haute résolution, en priorité.
  // artworkUrl100 se termine par « /100x100bb.jpg » ; on demande 600x600 pour du net.
  try {
    const term = [title, author].filter(Boolean).join(" ").trim();
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=ebook&limit=10&country=FR`,
      { next: { revalidate: 86400 } },
    );
    if (res.ok) {
      const data = await res.json();
      for (const r of (data.results || []) as { artworkUrl100?: string }[]) {
        const art = r.artworkUrl100;
        if (!art) continue;
        const hi = art.replace(/\/\d+x\d+bb\.(jpg|png)$/, "/1000x1000bb.$1");
        if (!seen.has(hi)) { seen.add(hi); allCovers.push(hi); }
      }
    }
  } catch { /* ignore */ }

  // Google Books — zoom=1 (thumbnail fiable) ou zoom=2 (qualité)
  await Promise.allSettled(
    queries.map(async (q) => {
      const params = new URLSearchParams({ q, maxResults: "20", printType: "books" });
      if (key) params.set("key", key);
      try {
        const res = await fetch(
          `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
          { next: { revalidate: 86400 } }
        );
        if (!res.ok) return;
        const data = await res.json();
        for (const item of (data.items || []) as any[]) {
          const links = item.volumeInfo?.imageLinks || {};
          const rawHigh = links.large || links.medium;
          const rawLow  = links.thumbnail || links.smallThumbnail;
          const chosen = httpsCover(rawHigh, 2) || httpsCover(rawLow, 1);
          if (chosen && !seen.has(chosen)) { seen.add(chosen); allCovers.push(chosen); }
        }
      } catch { /* ignore */ }
    })
  );

  // Open Library — couvertures supplémentaires si < 6 résultats
  if (allCovers.length < 6) {
    try {
      const q = [title, surname].filter(Boolean).join(" ").trim();
      const olRes = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10&fields=cover_i`,
        { next: { revalidate: 86400 } }
      );
      if (olRes.ok) {
        const olData = await olRes.json();
        for (const doc of ((olData.docs || []) as { cover_i?: number }[])) {
          if (doc.cover_i) {
            const olUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
            if (!seen.has(olUrl)) { seen.add(olUrl); allCovers.push(olUrl); }
          }
        }
      }
    } catch { /* ignore */ }
  }

  // Filtre parallèle HEAD : exclure les images < 4 Ko (placeholders Google "not available")
  const checked = await Promise.allSettled(
    allCovers.map(async (coverUrl) => {
      try {
        const head = await fetch(coverUrl, { method: "HEAD", cache: "no-store" });
        const len = parseInt(head.headers.get("content-length") || "0", 10);
        return len > 4000 || len === 0 ? coverUrl : null; // 0 = pas de Content-Length, on garde
      } catch { return coverUrl; }
    })
  );

  const valid = checked
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter(Boolean) as string[];

  return NextResponse.json({ covers: valid.slice(0, 24) });
}
