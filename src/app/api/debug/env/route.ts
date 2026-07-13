import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY ? `set (${process.env.VAPID_PRIVATE_KEY.length} chars)` : "MISSING",
    VAPID_SUBJECT: process.env.VAPID_SUBJECT ?? "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "MISSING",
    CRON_SECRET: process.env.CRON_SECRET ? "set" : "MISSING",
    NODE_ENV: process.env.NODE_ENV,
  });
}
