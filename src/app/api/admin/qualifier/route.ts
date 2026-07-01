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

// GET — livres de la bibliothèque personnelle de l'admin sans genre
export async function GET(req: NextRequest) {
  const user = await verifyAdmin(req);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // On cible uniquement les livres de l'admin (pas les copies des autres membres)
  const { data, error } = await db
    .from("books")
    .select("title, author, cover_url, summary, pages, published_year")
    .eq("user_id", user.id)
    .or("genre.is.null,genre.eq.")
    .order("title", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const books = (data ?? []) as {
    title: string;
    author: string;
    cover_url: string | null;
    summary: string | null;
    pages: number | null;
    published_year: number | null;
  }[];

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
