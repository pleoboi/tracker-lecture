import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "Service role key manquante" }, { status: 503 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false } }
  );

  const { data: buckets } = await admin.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === "session-photos");

  if (!exists) {
    const { error } = await admin.storage.createBucket("session-photos", {
      public: true,
      fileSizeLimit: 10485760, // 10 MB
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"],
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, created: !exists });
}
