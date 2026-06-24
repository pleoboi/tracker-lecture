import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function httpsCover(url: string | undefined): string | null {
  if (!url) return null;
  return url
    .replace(/^http:/, "https:")
    .replace(/&edge=curl/, "")
    .replace(/&zoom=\d+/, "&zoom=0");
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
  ];

  const allCovers: string[] = [];
  const seen = new Set<string>();

  await Promise.allSettled(
    queries.map(async (q) => {
      const params = new URLSearchParams({
        q,
        maxResults: "20",
        printType: "books",
      });
      if (key) params.set("key", key);

      try {
        const res = await fetch(
          `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = await res.json();
        for (const item of (data.items || []) as any[]) {
          const links = item.volumeInfo?.imageLinks || {};
          const raw =
            links.extraLarge ||
            links.large ||
            links.medium ||
            links.thumbnail ||
            links.smallThumbnail;
          const coverUrl = httpsCover(raw);
          if (coverUrl && !seen.has(coverUrl)) {
            seen.add(coverUrl);
            allCovers.push(coverUrl);
          }
        }
      } catch { /* ignore */ }
    })
  );

  return NextResponse.json({ covers: allCovers.slice(0, 24) });
}
