import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const allowed = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: "Format non supporté" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Fichier trop lourd (max 10 Mo)" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const path = `covers/${user.id}_${Date.now()}.${ext}`;

  const uploadKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    uploadKey,
    { auth: { persistSession: false } }
  );

  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.some((b) => b.name === "club-covers")) {
    await admin.storage.createBucket("club-covers", {
      public: true,
      fileSizeLimit: 10485760,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"],
    });
  }

  const { data, error: upErr } = await admin.storage
    .from("club-covers")
    .upload(path, buffer, { upsert: true, contentType: file.type });

  if (upErr || !data) {
    return NextResponse.json({ error: upErr?.message ?? "Upload échoué" }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage.from("club-covers").getPublicUrl(data.path);
  return NextResponse.json({ url: publicUrl });
}
