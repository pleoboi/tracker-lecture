import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_KEY   = process.env.GEMINI_API_KEY;

type QuizRow = { question: string; choices: string[]; correct_index: number };

async function callGemini(title: string, author: string, summary: string | null): Promise<QuizRow | null> {
  if (!GEMINI_KEY) return null;

  // Instruction système : contrainte absolue anti-spoil 80%
  const systemInstruction =
    `Tu es un assistant spécialisé dans la création de questions de quiz littéraires. ` +
    `Génère une question de niveau moyen avec 4 options (A, B, C, D) et la bonne réponse ` +
    `pour le livre "${title}" de ${author}. ` +
    `CONTRAINTE ABSOLUE : La question doit porter exclusivement sur des événements, ` +
    `personnages ou intrigues situés dans les premiers 80% du livre. ` +
    `Il est strictement interdit de faire référence aux 20 derniers % du livre ` +
    `ou à sa conclusion afin de ne jamais divulgâcher (spoiler) la fin à un utilisateur. ` +
    `La question doit être impossible à répondre sans avoir vraiment lu le livre. ` +
    `Langue : français uniquement.`;

  const ctx = summary ? `\n\nContexte du livre (résumé partiel) : "${summary.slice(0, 600)}"` : "";
  const userPrompt =
    `Génère la question de quiz pour "${title}" de ${author}.${ctx}\n\n` +
    `Réponds UNIQUEMENT avec ce JSON exact, sans markdown ni explication :\n` +
    `{"question":"...","choices":["réponse A","réponse B","réponse C","réponse D"],"correct_index":0}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.4, topP: 0.9 },
      }),
      signal: AbortSignal.timeout(8000),
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

  // ── Générer via Gemini (anti-spoil 80%) ─────────────────────────────────
  const generated = await callGemini(title, author ?? "auteur inconnu", summary ?? null).catch(() => null);
  if (!generated) {
    return NextResponse.json({ unavailable: true, alreadyPassed });
  }

  // Stocker en cache (correct_index côté serveur uniquement)
  await db.from("book_quizzes").upsert(
    { quiz_key: quizKey, title, question: generated.question, choices: generated.choices, correct_index: generated.correct_index },
    { onConflict: "quiz_key" }
  );

  // Ne jamais retourner correct_index au client
  return NextResponse.json({ question: generated.question, choices: generated.choices, alreadyPassed });
}
