import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_EMAIL  = process.env.ADMIN_EMAIL ?? "";

export async function POST(req: NextRequest) {
  const { query, callerEmail } = (await req.json()) as { query?: string; callerEmail?: string };

  if (!callerEmail || callerEmail !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  let dbQuery = db
    .from("books")
    .select("id, title, author, isbn13, cover_url, status, user_id, import_source")
    .order("title")
    .limit(600);

  if (query?.trim()) {
    dbQuery = dbQuery.ilike("title", `%${query.trim()}%`);
  }

  const { data, error } = await dbQuery;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrichir avec le display_name de l'utilisateur
  const userIds = [...new Set((data ?? []).map((b: { user_id: string }) => b.user_id))];
  const { data: profiles } = await db
    .from("user_profiles")
    .select("id, display_name")
    .in("id", userIds);

  const nameMap = new Map((profiles ?? []).map((p: { id: string; display_name: string }) => [p.id, p.display_name]));

  const books = (data ?? []).map((b: { id: string; title: string; author: string; isbn13: string | null; cover_url: string | null; status: string; user_id: string; import_source: string | null }) => ({
    ...b,
    member_name: nameMap.get(b.user_id) ?? "Inconnu",
  }));

  return NextResponse.json({ books });
}
