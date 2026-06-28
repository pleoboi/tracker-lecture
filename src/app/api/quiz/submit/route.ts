import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  const { userId, quizKey, answerIndex } =
    (await req.json()) as { userId?: string; quizKey?: string; answerIndex?: number };

  if (!userId || !quizKey || typeof answerIndex !== "number") {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Obtenir la bonne réponse ─────────────────────────────────────────────
  const { data: quiz } = await db
    .from("book_quizzes")
    .select("correct_index")
    .eq("quiz_key", quizKey)
    .single();

  if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });

  const passed = answerIndex === (quiz as { correct_index: number }).correct_index;

  if (!passed) {
    return NextResponse.json({ passed: false });
  }

  // ── Bonne réponse : crédit atomique (UNIQUE contrainte = protection) ─────
  const { error: insertErr } = await db
    .from("quiz_attempts")
    .insert({ user_id: userId, quiz_key: quizKey });

  if (insertErr) {
    // Déjà crédité (double-clic ou tentative en double)
    const { data: prof } = await db
      .from("user_profiles").select("quiz_pass_count").eq("id", userId).single();
    return NextResponse.json({ passed: true, alreadyAttempted: true, passCount: (prof as { quiz_pass_count: number } | null)?.quiz_pass_count ?? 1 });
  }

  // ── Incrémenter les stats (RPC atomique) ─────────────────────────────────
  const { data: updated } = await db.rpc("increment_quiz_stats", { uid: userId, bonus: 30 });
  const passCount = (updated as { pass_count: number }[] | null)?.[0]?.pass_count ?? 1;

  // ── Attribuer le badge "Sans Faute" (première fois uniquement) ───────────
  await db.from("user_badges").upsert(
    { user_id: userId, badge_id: "sans-faute" },
    { onConflict: "user_id,badge_id", ignoreDuplicates: true }
  );

  return NextResponse.json({ passed: true, passCount });
}
