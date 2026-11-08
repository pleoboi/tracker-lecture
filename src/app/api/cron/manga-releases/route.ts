import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "../../../../lib/push.server";
import { refreshReleases, needsReleaseTracking, RELEASE_ROW_SELECT, syncMangaPlusReleases } from "../../../../lib/mangaReleases.server";

// Passage quotidien sur toutes les séries suivies, pour notifier les nouveaux
// chapitres même aux membres qui n'ont pas ouvert l'app.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "")
    ?? req.nextUrl.searchParams.get("secret");
  if (auth !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Flux MANGA Plus de la Communauté manga (toutes séries)
  const feed = await syncMangaPlusReleases();

  // 2. Séries suivies par les membres : dernier chapitre + notifications
  const { data } = await adminSupabase.from("mangas").select(RELEASE_ROW_SELECT);
  const rows = (data ?? []).filter(needsReleaseTracking);
  const result = await refreshReleases(rows);
  return NextResponse.json({ feed, ...result });
}
