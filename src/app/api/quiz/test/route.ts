import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Vérifie plusieurs noms possibles pour la clé Gemini
  const candidates: Record<string, string | undefined> = {
    GEMINI_API_KEY:          process.env.GEMINI_API_KEY,
    GOOGLE_AI_API_KEY:       process.env.GOOGLE_AI_API_KEY,
    GOOGLE_GEMINI_API_KEY:   process.env.GOOGLE_GEMINI_API_KEY,
    GEMINI_KEY:              process.env.GEMINI_KEY,
    // Vérifie aussi que les autres vars connues sont bien présentes
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "présente" : "manquante",
  };

  const found = Object.entries(candidates)
    .filter(([, v]) => v)
    .map(([k, v]) => ({
      name: k,
      preview: v && v.length > 8 ? `${v.slice(0, 6)}...${v.slice(-4)} (${v.length} chars)` : v,
    }));

  const missing = Object.keys(candidates).filter((k) => !candidates[k]);

  const geminiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GEMINI_KEY;

  if (!geminiKey) {
    return NextResponse.json({
      ok: false,
      message: "Aucune clé Gemini trouvée parmi les noms testés",
      found,
      missing,
    });
  }

  // Test appel Gemini
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Dis juste: OK" }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      }
    );
    const body = await res.text();
    return NextResponse.json({ ok: res.ok, status: res.status, found, response: body.slice(0, 300) });
  } catch (err) {
    return NextResponse.json({ ok: false, found, error: String(err) });
  }
}
