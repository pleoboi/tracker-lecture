import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ? `ok (${process.env.VAPID_PRIVATE_KEY.length} chars)` : "MANQUANTE",
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? "ok" : "MANQUANTE",
    supabaseServiceRole: process.env.SUPABASE_SERVICE_ROLE_KEY ? "ok" : "MANQUANTE",
  });
}
