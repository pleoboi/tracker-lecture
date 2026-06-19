import { NextResponse } from "next/server";
import { mapVolume } from "../../../../lib/googleBooks";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  const key = process.env.GOOGLE_BOOKS_API_KEY;
  const params = new URLSearchParams({
    q,
    maxResults: "8",
    printType: "books",
  });
  if (key) params.set("key", key);

  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
      { cache: "no-store" }
    );
    const data = await res.json();

    if (!res.ok) {
      const msg = data?.error?.message || "";
      if (res.status === 429 || /quota/i.test(msg)) {
        return NextResponse.json(
          { error: "Quota Google Books atteint. Ajoute le livre manuellement pour le moment." },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: "Recherche Google Books indisponible." }, { status: 502 });
    }

    const items: any[] = data.items || [];
    return NextResponse.json({ results: items.map(mapVolume) });
  } catch {
    return NextResponse.json({ error: "Recherche Google Books indisponible." }, { status: 502 });
  }
}
