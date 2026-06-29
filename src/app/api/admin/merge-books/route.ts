import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_EMAIL  = process.env.ADMIN_EMAIL ?? "";

export async function POST(req: NextRequest) {
  const { sourceId, targetId, callerEmail } =
    (await req.json()) as { sourceId?: string; targetId?: string; callerEmail?: string };

  if (!callerEmail || callerEmail !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (!sourceId || !targetId || sourceId === targetId) {
    return NextResponse.json({ error: "IDs source et cible requis et distincts" }, { status: 400 });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Vérifier que les deux livres existent ────────────────────────────────────
  const [{ data: src }, { data: tgt }] = await Promise.all([
    db.from("books").select("id, title, author, cover_url, summary, genre, published_year, pages, isbn13, user_id").eq("id", sourceId).single(),
    db.from("books").select("id, title, author, cover_url, summary, genre, published_year, pages, isbn13, user_id").eq("id", targetId).single(),
  ]);

  if (!src || !tgt) {
    return NextResponse.json({ error: "Un des deux livres est introuvable" }, { status: 404 });
  }

  type BookRow = { id: string; title: string; author: string; cover_url: string | null; summary: string | null; genre: string | null; published_year: number | null; pages: number; isbn13: string | null; user_id: string };
  const source = src as BookRow;
  const target = tgt as BookRow;

  // ── 1. Rediriger tous les reading_logs du source vers le target ──────────────
  const { error: logsErr } = await db
    .from("reading_logs")
    .update({ book_id: targetId })
    .eq("book_id", sourceId);

  if (logsErr) {
    return NextResponse.json({ error: `Erreur lectures : ${logsErr.message}` }, { status: 500 });
  }

  // ── 2. Mettre à jour les quiz qui référencent l'ancien book_id ───────────────
  await db
    .from("book_quizzes")
    .update({ quiz_key: `book-${targetId}` })
    .eq("quiz_key", `book-${sourceId}`);

  // ── 3. Enrichir le livre cible avec les meilleures données disponibles ───────
  const betterData: Partial<BookRow> = {
    cover_url:      target.cover_url      ?? source.cover_url,
    summary:        target.summary        ?? source.summary,
    genre:          target.genre          ?? source.genre,
    published_year: target.published_year ?? source.published_year,
    pages:          Math.max(target.pages ?? 0, source.pages ?? 0) || target.pages,
    isbn13:         target.isbn13         ?? source.isbn13,
  };

  await db.from("books").update(betterData).eq("id", targetId);

  // ── 4. Supprimer le livre source ─────────────────────────────────────────────
  const { error: delErr } = await db.from("books").delete().eq("id", sourceId);
  if (delErr) {
    return NextResponse.json({ error: `Suppression impossible : ${delErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    merged: {
      source: { id: source.id, title: source.title },
      target: { id: target.id, title: target.title },
    },
  });
}
