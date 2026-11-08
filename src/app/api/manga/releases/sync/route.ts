import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase-server";
import { adminSupabase } from "../../../../../lib/push.server";
import { syncMangaPlusReleases } from "../../../../../lib/mangaReleases.server";

// Rafraîchit le flux MANGA Plus à l'ouverture de la Communauté manga, au plus
// une fois par heure (le cron quotidien couvre le reste).
const MIN_INTERVAL_MS = 60 * 60 * 1000;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: last } = await adminSupabase
    .from("manga_releases")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  const lastAt = last?.[0]?.created_at ? new Date(last[0].created_at).getTime() : 0;
  if (Date.now() - lastAt < MIN_INTERVAL_MS) return NextResponse.json({ skipped: true, inserted: 0 });

  const result = await syncMangaPlusReleases();
  return NextResponse.json(result);
}
