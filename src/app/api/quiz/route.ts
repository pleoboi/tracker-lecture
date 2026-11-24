import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase-server";
import { adminSupabase } from "../../../lib/push.server";
import { bookKey, crossedTiers, QUIZ_XP } from "../../../lib/quiz";

export const dynamic = "force-dynamic";

// GET ?bookId=&from=&to= (pages) : la question du plus haut palier franchi, sans la réponse.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ quiz: null }, { status: 401 });

  const p = req.nextUrl.searchParams;
  const bookId = Number(p.get("bookId"));
  const from = Number(p.get("from"));
  const to = Number(p.get("to"));
  if (!Number.isFinite(bookId) || !Number.isFinite(from) || !Number.isFinite(to)) return NextResponse.json({ quiz: null });

  const { data: book } = await adminSupabase.from("books").select("id, title, pages, user_id").eq("id", bookId).single();
  if (!book || book.user_id !== user.id) return NextResponse.json({ quiz: null });

  const tiers = crossedTiers(book.pages, from, to);
  if (!tiers.length) return NextResponse.json({ quiz: null });

  const { data: done } = await adminSupabase.from("book_quiz_answers").select("tier").eq("user_id", user.id).eq("book_id", bookId);
  const doneTiers = new Set((done ?? []).map((d) => d.tier));
  const { data: questions } = await adminSupabase
    .from("book_quiz")
    .select("id, tier, question, options")
    .eq("book_key", bookKey(book.title))
    .in("tier", tiers);

  const next = (questions ?? [])
    .filter((q) => !doneTiers.has(q.tier))
    .sort((a, b) => b.tier - a.tier)[0];
  return NextResponse.json({ quiz: next ?? null });
}

// POST { quizId, bookId, choice } : corrige, enregistre une seule fois par palier et donne les XP.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { quizId?: number; bookId?: number; choice?: number };
  if (!Number.isInteger(body.quizId) || !Number.isInteger(body.bookId) || !Number.isInteger(body.choice)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { data: book } = await adminSupabase.from("books").select("id, title, user_id").eq("id", body.bookId!).single();
  const { data: quiz } = await adminSupabase.from("book_quiz").select("*").eq("id", body.quizId!).single();
  if (!book || book.user_id !== user.id || !quiz || quiz.book_key !== bookKey(book.title)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const correct = quiz.answer === body.choice;
  const xp = correct ? QUIZ_XP : 0;
  const { error } = await adminSupabase
    .from("book_quiz_answers")
    .insert({ user_id: user.id, book_id: book.id, tier: quiz.tier, correct, xp });
  // Déjà répondu à ce palier : on corrige sans redonner d'XP.
  if (error) return NextResponse.json({ correct, answer: quiz.answer, explanation: quiz.explanation, xp: 0 });

  if (xp) {
    const { data: prof } = await adminSupabase.from("user_profiles").select("quiz_bonus_points").eq("id", user.id).single();
    await adminSupabase
      .from("user_profiles")
      .update({ quiz_bonus_points: (prof?.quiz_bonus_points ?? 0) + xp })
      .eq("id", user.id);
  }
  return NextResponse.json({ correct, answer: quiz.answer, explanation: quiz.explanation, xp });
}
