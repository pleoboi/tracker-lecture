import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_EMAIL  = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

async function verifyAdmin(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return null;
  const anonClient = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) return null;
  return user;
}

// GET — liste des livres sans genre (dédoublonnés par titre+auteur)
export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // Récupère jusqu'à 3000 entrées sans genre pour dédoublonner côté JS
  const { data, error } = await db
    .from("books")
    .select("title, author, cover_url, summary, pages, published_year")
    .or("genre.is.null,genre.eq.")
    .order("created_at", { ascending: false })
    .limit(3000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = { title: string; author: string; cover_url: string | null; summary: string | null; pages: number | null; published_year: number | null };
  const rows = (data as Row[]) ?? [];

  // Dédoublonnage : pour chaque titre+auteur, garde la meilleure entrée
  const seen = new Map<string, Row>();
  for (const book of rows) {
    const key = `${book.title.toLowerCase().trim()}__${(book.author ?? "").toLowerCase().trim()}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, book);
    } else {
      // Préfère l'entrée avec cover + summary
      const better = {
        ...existing,
        cover_url: existing.cover_url ?? book.cover_url,
        summary: existing.summary ?? book.summary,
        pages: existing.pages ?? book.pages,
        published_year: existing.published_year ?? book.published_year,
      };
      seen.set(key, better);
    }
  }

  const books = Array.from(seen.values());
  return NextResponse.json({ books, total: books.length });
}

// POST — enregistre le genre d'un livre (toutes ses copies)
export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title, genre } = (await req.json()) as { title?: string; genre?: string };
  if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const escaped = title.replace(/[%_]/g, "\\$&");

  const { error } = await db
    .from("books")
    .update({ genre: genre?.trim() || null })
    .ilike("title", escaped);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
