import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_KEY   = process.env.GEMINI_API_KEY;

type QuizRow = { question: string; choices: string[]; correct_index: number };

async function callGemini(title: string, author: string, summary: string | null): Promise<QuizRow | null> {
  if (!GEMINI_KEY) return null;

  const ctx = summary ? `\n\nRésumé : "${summary.slice(0, 600)}"` : "";
  const prompt =
    `Génère une question de quiz pour valider la lecture du livre "${title}" de ${author}.${ctx}\n\n` +
    `RÈGLES :\n` +
    `- Porte sur un événement précis, un personnage secondaire ou un détail du début/milieu du livre\n` +
    `- Ne révèle pas la fin ni la résolution principale\n` +
    `- Impossible à répondre sans avoir vraiment lu le livre\n` +
    `- 4 choix, un seul correct, les autres plausibles\n` +
    `- Langue : français\n\n` +
    `Réponds UNIQUEMENT avec ce JSON, sans markdown ni explication :\n` +
    `{"question":"...","choices":["A","B","C","D"],"correct_index":0}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  if (!res.ok) return null;

  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    if (
      typeof parsed.question === "string" &&
      Array.isArray(parsed.choices) &&
      (parsed.choices as unknown[]).length === 4 &&
      typeof parsed.correct_index === "number" &&
      parsed.correct_index >= 0 &&
      parsed.correct_index <= 3
    ) {
      return parsed as unknown as QuizRow;
    }
  } catch { /* malformed JSON */ }
  return null;
}

export async function POST(req: NextRequest) {
  const { quizKey, title, author, summary, userId } =
    (await req.json()) as { quizKey?: string; title?: string; author?: string; summary?: string | null; userId?: string };

  if (!quizKey || !title) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Vérifier si l'utilisateur a déjà réussi ce quiz ─────────────────────
  let alreadyPassed = false;
  if (userId) {
    const { data: attempt } = await db
      .from("quiz_attempts").select("quiz_key").eq("user_id", userId).eq("quiz_key", quizKey).single();
    alreadyPassed = !!attempt;
  }

  // ── Chercher en cache ────────────────────────────────────────────────────
  const { data: cached } = await db
    .from("book_quizzes")
    .select("question, choices")
    .eq("quiz_key", quizKey)
    .single();

  if (cached) {
    return NextResponse.json({ question: cached.question, choices: cached.choices, alreadyPassed });
  }

  // ── Générer via Gemini ───────────────────────────────────────────────────
  const generated = await callGemini(title, author ?? "auteur inconnu", summary ?? null);
  if (!generated) {
    return NextResponse.json({ unavailable: true, alreadyPassed });
  }

  await db.from("book_quizzes").upsert(
    { quiz_key: quizKey, title, question: generated.question, choices: generated.choices, correct_index: generated.correct_index },
    { onConflict: "quiz_key" }
  );

  // Ne jamais retourner correct_index au client
  return NextResponse.json({ question: generated.question, choices: generated.choices, alreadyPassed });
}
