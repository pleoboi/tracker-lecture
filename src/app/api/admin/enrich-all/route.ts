import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mapVolume } from "../../../../lib/googleBooks";

export const dynamic = "force-dynamic";
// Vercel hobby plan : 10s max. On traite 5 livres par appel (5 × ~1s = 5s).
export const maxDuration = 10;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_KEY = process.env.GOOGLE_BOOKS_API_KEY;

async function fetchBestVolume(title: string, author: string) {
  const q = `${title} ${author || ""}`.trim();
  const params = new URLSearchParams({
    q,
    maxResults: "5",
    langRestrict: "fr",
    hl: "fr",
  });
  if (GOOGLE_KEY) params.set("key", GOOGLE_KEY);
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.items?.length) return null;

  const authorSurname = (author || "").toLowerCase().split(/\s+/).pop() ?? "";
  const best =
    (data.items as any[]).find((item) => {
      const a = (item.volumeInfo?.authors?.[0] || "").toLowerCase();
      return !authorSurname || a.includes(authorSurname);
    }) ?? data.items[0];

  return mapVolume(best);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  if (!SERVICE_KEY) {
    return NextResponse.json(
      {
        error: "SUPABASE_SERVICE_ROLE_KEY non configurée.",
        hint: "Ajoute-la dans .env.local ET dans les variables d'environnement Vercel (Dashboard → Settings → Environment Variables).",
      },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const offset: number = body.offset ?? 0;
  const limit: number = body.limit ?? 5;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Compte total des livres sans couverture
  const { count } = await admin
    .from("books")
    .select("*", { count: "exact", head: true })
    .or("cover_url.is.null,cover_url.eq.");

  const total = count ?? 0;

  if (total === 0 || offset >= total) {
    return NextResponse.json({ total, offset, processed: 0, updated: 0, noMatch: 0, done: true });
  }

  // Batch courant
  const { data: books } = await admin
    .from("books")
    .select("id, title, author")
    .or("cover_url.is.null,cover_url.eq.")
    .range(offset, offset + limit - 1);

  const batch = (books as { id: number; title: string; author: string }[]) || [];
  let updated = 0;
  let noMatch = 0;

  for (let i = 0; i < batch.length; i++) {
    const book = batch[i];
    try {
      const meta = await fetchBestVolume(book.title, book.author);
      if (meta?.coverUrl) {
        await admin
          .from("books")
          .update({
            cover_url: meta.coverUrl,
            ...(meta.summary ? { summary: meta.summary } : {}),
            ...(meta.year ? { published_year: meta.year } : {}),
            ...(meta.genre ? { genre: meta.genre } : {}),
          })
          .eq("id", book.id);
        updated++;
      } else {
        noMatch++;
      }
    } catch {
      noMatch++;
    }
    if (i < batch.length - 1) await sleep(300);
  }

  const newOffset = offset + batch.length;
  return NextResponse.json({
    total,
    offset: newOffset,
    processed: batch.length,
    updated,
    noMatch,
    done: newOffset >= total,
  });
}
