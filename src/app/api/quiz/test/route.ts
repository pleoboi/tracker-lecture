import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Vérifier la clé dans Supabase
  const { data, error } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "gemini_api_key")
    .single();

  if (error || !data) {
    return NextResponse.json({
      ok: false,
      reason: "Clé Gemini absente de app_settings",
      hint: "Exécutez le SQL dans Supabase pour insérer la clé",
      supabaseError: error?.message,
    });
  }

  const key = (data as { value: string }).value;
  const preview = `${key.slice(0, 6)}...${key.slice(-4)} (${key.length} chars)`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Réponds uniquement: OK" }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      }
    );
    const body = await res.text();
    return NextResponse.json({ ok: res.ok, status: res.status, key: preview, response: body.slice(0, 200) });
  } catch (err) {
    return NextResponse.json({ ok: false, key: preview, error: String(err) });
  }
}
