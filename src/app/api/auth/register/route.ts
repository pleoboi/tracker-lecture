import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    // No service key — fall back to client-side signUp (with email confirmation)
    return NextResponse.json({ fallback: true });
  }

  const body = await req.json();
  const { email, password, displayName, inviteCode } = body as {
    email: string;
    password: string;
    displayName: string;
    inviteCode?: string;
  };

  if (!email || !password || !displayName?.trim()) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
  }

  // Validate invite code server-side
  const expectedCode = process.env.NEXT_PUBLIC_INVITE_CODE ?? "";
  if (expectedCode && inviteCode?.trim() !== expectedCode) {
    return NextResponse.json({ error: "Code d'invitation incorrect." }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false } }
  );

  // Create user with email already confirmed — no confirmation email sent
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    user_metadata: { display_name: displayName.trim() },
    email_confirm: true,
  });

  if (error) {
    const msg =
      error.message.includes("already registered") || error.message.includes("already exists")
        ? "Un compte existe déjà avec cet email."
        : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Also upsert user_profiles so display_name is stored there too
  await admin
    .from("user_profiles")
    .upsert({ id: data.user.id, display_name: displayName.trim() }, { onConflict: "id" });

  return NextResponse.json({ ok: true });
}
