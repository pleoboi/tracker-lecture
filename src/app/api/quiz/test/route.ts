import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    return NextResponse.json({ ok: false, reason: "GEMINI_API_KEY manquante dans les variables Vercel" });
  }

  const preview = `${key.slice(0, 6)}...${key.slice(-4)} (${key.length} chars)`;

  let status = 0;
  let body = "";
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Dis juste: OK" }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      }
    );
    status = res.status;
    body = await res.text();
    if (res.ok) {
      return NextResponse.json({ ok: true, key: preview, status, response: body.slice(0, 200) });
    }
  } catch (err) {
    return NextResponse.json({ ok: false, key: preview, reason: "Erreur réseau", error: String(err) });
  }

  return NextResponse.json({ ok: false, key: preview, status, error: body.slice(0, 400) });
}
