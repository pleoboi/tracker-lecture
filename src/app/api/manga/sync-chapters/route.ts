import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase-server";
import { adminSupabase } from "../../../../lib/push.server";
import { lastChapterOfVolume, resolveMangadexId } from "../../../../lib/mangaReleases.server";

// Séries lues par tomes : le chapitre atteint est le dernier chapitre du tome en cours.
// Rattrape les sessions enregistrées avant que ce calcul existe.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: mangas } = await adminSupabase
    .from("mangas")
    .select("id, title, anilist_id, mangadex_id, current_chapter, current_volume, last_unit")
    .eq("user_id", user.id)
    .gt("current_volume", 0)
    .eq("last_unit", "volume");

  let updated = 0;
  for (const m of mangas ?? []) {
    let mdId: string | null = m.mangadex_id;
    if (!mdId) {
      mdId = await resolveMangadexId(m.title, m.anilist_id);
      if (mdId) await adminSupabase.from("mangas").update({ mangadex_id: mdId }).eq("id", m.id);
    }
    if (!mdId) continue;
    const chapter = await lastChapterOfVolume(mdId, m.current_volume);
    if (chapter && chapter !== m.current_chapter) {
      await adminSupabase.from("mangas").update({ current_chapter: chapter }).eq("id", m.id);
      updated++;
    }
  }
  return NextResponse.json({ updated });
}
