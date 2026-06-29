import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type QuizRow = { question: string; choices: string[]; correct_index: number };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout ${ms}ms`)), ms)
    ),
  ]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getGeminiKey(db: any): Promise<string | null> {
  // 1. Variables d'environnement (si elles marchent un jour)
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  // 2. Fallback : clé stockée dans Supabase > app_settings
  const { data } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "gemini_api_key")
    .single();
  return (data as { value: string } | null)?.value ?? null;
}

async function callGemini(key: string, title: string, author: string, summary: string | null): Promise<QuizRow | null> {
  const prompt =
    `Tu es un assistant spécialisé dans la création de questions de quiz littéraires.\n\n` +
    `Génère une question de niveau moyen avec 4 options (A, B, C, D) et la bonne réponse ` +
    `pour le livre "${title}" de ${author}.\n\n` +
    `CONTRAINTE ABSOLUE : La question doit porter exclusivement sur des événements, ` +
    `personnages ou intrigues situés dans les premiers 80 % du livre. ` +
    `Il est strictement interdit de faire référence aux 20 derniers % du livre ` +
    `ou à sa conclusion afin de ne jamais divulgâcher (spoiler) la fin à un utilisateur.\n` +
    `La question doit être impossible à répondre sans avoir vraiment lu le livre.\n` +
    `Langue : français uniquement.\n` +
    (summary ? `\nContexte (résumé partiel) : "${summary.slice(0, 600)}"\n` : "") +
    `\nRéponds UNIQUEMENT avec ce JSON exact, sans markdown ni explication :\n` +
    `{"question":"...","choices":["réponse A","réponse B","réponse C","réponse D"],"correct_index":0}`;

  let res: Response;
  try {
    res = await withTimeout(
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, topP: 0.9, maxOutputTokens: 512 },
          }),
        }
      ),
      20000
    );
  } catch (err) {
    console.error("[quiz/generate] Timeout ou erreur réseau Gemini :", err);
    return null;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[quiz/generate] Gemini HTTP ${res.status} :`, body.slice(0, 300));
    return null;
  }

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
  } catch { /* malformed */ }
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

  // ── Récupérer la clé Gemini (env var ou Supabase) ────────────────────────
  const geminiKey = await getGeminiKey(db);
  if (!geminiKey) {
    console.error("[quiz/generate] Clé Gemini introuvable (env var + Supabase)");
    return NextResponse.json({ unavailable: true, alreadyPassed });
  }

  // ── Générer via Gemini ───────────────────────────────────────────────────
  const generated = await callGemini(geminiKey, title, author ?? "auteur inconnu", summary ?? null);
  if (!generated) {
    return NextResponse.json({ unavailable: true, alreadyPassed });
  }

  // ── Mettre en cache ──────────────────────────────────────────────────────
  await db.from("book_quizzes").upsert(
    { quiz_key: quizKey, title, question: generated.question, choices: generated.choices, correct_index: generated.correct_index },
    { onConflict: "quiz_key" }
  );

  return NextResponse.json({ question: generated.question, choices: generated.choices, alreadyPassed });
}
