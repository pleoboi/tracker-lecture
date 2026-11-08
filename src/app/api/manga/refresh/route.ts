import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase-server";
import { adminSupabase } from "../../../../lib/push.server";
import { refreshReleases, needsReleaseTracking, RELEASE_ROW_SELECT } from "../../../../lib/mangaReleases.server";

// Vérification à l'ouverture de la mangathèque : on ne réinterroge MangaDex
// que pour les séries du membre pas vérifiées depuis STALE_MS. Le cron
// quotidien couvre ceux qui n'ouvrent pas l'app.
const STALE_MS = 3 * 60 * 60 * 1000;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await adminSupabase.from("mangas").select(RELEASE_ROW_SELECT).eq("user_id", user.id);
  const cutoff = Date.now() - STALE_MS;
  const rows = (data ?? []).filter(
    (r) => needsReleaseTracking(r) && (!r.latest_checked_at || new Date(r.latest_checked_at).getTime() < cutoff)
  );
  if (!rows.length) return NextResponse.json({ checked: 0, released: 0 });

  // Le membre voit la nouveauté à l'écran : pas de push pour lui, mais ses
  // amis qui suivent la même série sont prévenus.
  const result = await refreshReleases(rows, { skipNotifyUserId: user.id });
  return NextResponse.json(result);
}
