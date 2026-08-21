import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json({ error: "Clé serveur manquante — contacte l'administrateur." }, { status: 503 });
    }

    let body: { email?: string; password?: string; displayName?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
    }

    const { email, password, displayName } = body;

    if (!email || !password || !displayName?.trim()) {
      return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { persistSession: false } }
    );

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      user_metadata: { display_name: displayName.trim() },
      email_confirm: true,
    });

    if (error) {
      const msg =
        error.message.includes("already registered") ||
        error.message.includes("already exists") ||
        error.message.includes("Email address already")
          ? "Un compte existe déjà avec cet email."
          : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    await admin
      .from("user_profiles")
      .upsert({ id: data.user.id, display_name: displayName.trim() }, { onConflict: "id" });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[register] unexpected error:", err);
    return NextResponse.json(
      { error: "Erreur interne. Réessaie dans quelques secondes." },
      { status: 500 }
    );
  }
}
