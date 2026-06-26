import { NextResponse } from "next/server";
import { mapVolume } from "../../../../lib/googleBooks";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  const key = process.env.GOOGLE_BOOKS_API_KEY;

  const tryFetch = async (extraParams: Record<string, string>) => {
    const params = new URLSearchParams({
      maxResults: "12",
      printType: "books",
      hl: "fr",
      ...extraParams,
    });
    if (key) params.set("key", key);
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
      { next: { revalidate: 3600 } }
    );
    const data = await res.json();
    if (!res.ok) {
      const reason = data?.error?.errors?.[0]?.reason || "";
      const msg = data?.error?.message || "";
      // Rate limit par seconde (userRateLimitExceeded) — temporaire, ne pas bloquer
      if (reason === "userRateLimitExceeded") {
        throw Object.assign(new Error("RATE_LIMIT"), { status: 429 });
      }
      // Quota journalier épuisé
      if (res.status === 429 || /quota/i.test(msg)) {
        throw Object.assign(new Error("QUOTA"), { status: 429 });
      }
      throw new Error("API_ERROR");
    }
    return (data.items || []) as any[];
  };

  const merge = (base: any[], extra: any[]) => {
    const seen = new Set(base.map((i: any) => i.id));
    for (const item of extra) {
      if (!seen.has(item.id)) { seen.add(item.id); base.push(item); }
    }
    return base;
  };

  try {
    // Passe 1 : éditions françaises en priorité
    let items = await tryFetch({ q, langRestrict: "fr" });

    // Passes 2 et 3 : optionnelles — si rate limit, on retourne ce qu'on a
    if (items.length < 8) {
      try {
        const more = await tryFetch({ q });
        items = merge(items, more);
      } catch (e: any) {
        if (e?.message !== "RATE_LIMIT") throw e;
      }
    }

    if (items.length < 5) {
      try {
        const more = await tryFetch({ q: `intitle:${q}` });
        items = merge(items, more);
      } catch (e: any) {
        if (e?.message !== "RATE_LIMIT") throw e;
      }
    }

    return NextResponse.json({ results: items.slice(0, 12).map(mapVolume) });
  } catch (err: any) {
    if (err?.message === "RATE_LIMIT") {
      // Passe 1 elle-même était rate-limitée — retourne vide sans message d'erreur
      return NextResponse.json({ results: [] });
    }
    if (err?.status === 429 || err?.message === "QUOTA") {
      const msg = key
        ? "Quota Google Books dépassé pour aujourd'hui. La recherche sera rétablie demain automatiquement."
        : "Quota Google Books atteint. Configure GOOGLE_BOOKS_API_KEY sur Vercel pour débloquer tous les utilisateurs.";
      return NextResponse.json({ error: msg }, { status: 429 });
    }
    return NextResponse.json({ error: "Recherche Google Books indisponible." }, { status: 502 });
  }
}
