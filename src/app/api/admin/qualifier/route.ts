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

// GET — tous les livres du site avec ≤ 2 genres (dédupliqués par titre)
export async function GET(req: NextRequest) {
  const user = await verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data, error } = await db
    .from("books")
    .select("title, author, cover_url, summary, pages, published_year, genre")
    .order("title", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type BookRow = {
    title: string;
    author: string;
    cover_url: string | null;
    summary: string | null;
    pages: number | null;
    published_year: number | null;
    genre: string | null;
  };

  // Dédupliquer par titre (on garde la copie la plus riche en données)
  const byTitle = new Map<string, BookRow>();
  for (const b of (data ?? []) as BookRow[]) {
    const key = b.title.toLowerCase().trim();
    const existing = byTitle.get(key);
    if (!existing || (!existing.cover_url && b.cover_url) || (!existing.summary && b.summary)) {
      byTitle.set(key, b);
    }
  }

  // Garder uniquement les livres avec ≤ 2 genres
  const books = [...byTitle.values()].filter((b) => {
    if (!b.genre || b.genre.trim() === "") return true;
    const parts = b.genre.split(",").map((g) => g.trim()).filter(Boolean);
    return parts.length <= 2;
  });

  return NextResponse.json({ books, total: books.length });
}

// POST — enregistre le genre d'un livre (toutes les copies sur la plateforme)
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
