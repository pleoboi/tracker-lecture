import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_KEY   = process.env.GEMINI_API_KEY;

type QuizRow = { question: string; choices: string[]; correct_index: number };

// Promise.race timeout — plus compatible qu'AbortSignal.timeout sur tous les runtimes
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)),
  ]);
}

async function callGemini(title: string, author: string, summary: string | null): Promise<QuizRow | null> {
  if (!GEMINI_KEY) {
    console.error("[quiz/generate] GEMINI_API_KEY non configurée — ajoutez-la dans Vercel > Environment Variables");
    return null;
  }

  // Prompt combiné (system + user) pour compatibilité maximale avec Gemini 2.0 Flash
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
    (summary ? `\nContexte (résumé partiel du début du livre) : "${summary.slice(0, 600)}"\n` : "") +
    `\nRéponds UNIQUEMENT avec ce JSON exact, sans markdown ni explication :\n` +
    `{"question":"...","choices":["réponse A","réponse B","réponse C","réponse D"],"correct_index":0}`;

  let res: Response;
  try {
    res = await withTimeout(
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, topP: 0.9, maxOutputTokens: 512 },
          }),
        }
      ),
      20000 // 20 secondes
    );
  } catch (err) {
    console.error("[quiz/generate] Erreur réseau ou timeout Gemini :", err);
    return null;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "(impossible de lire le body)");
    console.error(`[quiz/generate] Gemini HTTP ${res.status} :`, body);
    return null;
  }

  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!raw) {
    console.error("[quiz/generate] Gemini a retourné une réponse vide :", JSON.stringify(data));
    return null;
  }

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error("[quiz/generate] Aucun JSON trouvé dans la réponse :", raw.slice(0, 300));
      return null;
    }
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
    console.error("[quiz/generate] JSON mal formé :", JSON.stringify(parsed));
  } catch (e) {
    console.error("[quiz/generate] JSON.parse échoué :", e, "— raw :", raw.slice(0, 300));
  }
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
  const generated = await callGemini(title, author ?? "auteur inconnu", summary ?? null);
  if (!generated) {
    return NextResponse.json({ unavailable: true, alreadyPassed });
  }

  // Stocker en cache (correct_index côté serveur uniquement)
  const { error: upsertErr } = await db.from("book_quizzes").upsert(
    { quiz_key: quizKey, title, question: generated.question, choices: generated.choices, correct_index: generated.correct_index },
    { onConflict: "quiz_key" }
  );
  if (upsertErr) {
    console.error("[quiz/generate] Erreur upsert book_quizzes :", upsertErr.message);
  }

  // Ne jamais retourner correct_index au client
  return NextResponse.json({ question: generated.question, choices: generated.choices, alreadyPassed });
}
