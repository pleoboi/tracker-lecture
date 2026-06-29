import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
// v3 — force rebuild

export async function GET() {
  const key = process.env.GEMINI_API_KEY;
  const deployId = process.env.VERCEL_DEPLOYMENT_ID ?? "local";
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";

  if (!key) {
    return NextResponse.json({
      ok: false,
      reason: "GEMINI_API_KEY manquante",
      deploy: deployId,
      commit: commitSha,
      allKeys: Object.keys(process.env).filter((k) =>
        k.includes("GEMINI") || k.includes("GOOGLE") || k.includes("AI")
      ),
    });
  }

  const preview = `${key.slice(0, 6)}...${key.slice(-4)} (${key.length} chars)`;

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
    const body = await res.text();
    return NextResponse.json({ ok: res.ok, status: res.status, key: preview, deploy: deployId, commit: commitSha, response: body.slice(0, 300) });
  } catch (err) {
    return NextResponse.json({ ok: false, key: preview, deploy: deployId, commit: commitSha, error: String(err) });
  }
}
