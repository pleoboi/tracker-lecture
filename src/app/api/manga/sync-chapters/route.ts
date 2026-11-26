import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase-server";
import { adminSupabase } from "../../../../lib/push.server";
import { findLogCover, lastChapterOfVolume, resolveMangadexId } from "../../../../lib/mangaReleases.server";

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
    const chapter = await lastChapterOfVolume(mdId, m.current_volume, m.title);
    if (chapter && chapter !== m.current_chapter) {
      await adminSupabase.from("mangas").update({ current_chapter: chapter }).eq("id", m.id);
      updated++;
    }
  }

  // Sessions en chapitres sans tome (séries où MangaDex ne relie pas les chapitres aux tomes) :
  // on retrouve le tome, la bonne couverture et le tome en cours.
  const { data: orphans } = await adminSupabase
    .from("manga_logs")
    .select("id, manga_id, end_value")
    .eq("user_id", user.id)
    .eq("unit", "chapter")
    .is("volume", null)
    .order("end_value", { ascending: false })
    .limit(300);
  const seen = new Map<string, { cover: string | null; volume: number | null }>();
  const titles = new Map<number, { title: string; mdId: string | null; anilist: number | null }>();
  const volumeByManga = new Map<number, { chapter: number; volume: number }>();
  let budget = 25;
  let fixed = 0;
  for (const l of orphans ?? []) {
    const key = `${l.manga_id}:${l.end_value}`;
    if (!seen.has(key)) {
      if (budget <= 0) continue;
      let info = titles.get(l.manga_id);
      if (!info) {
        const { data: m } = await adminSupabase.from("mangas").select("title, anilist_id, mangadex_id").eq("id", l.manga_id).single();
        if (!m) continue;
        info = { title: m.title, mdId: m.mangadex_id, anilist: m.anilist_id };
        if (!info.mdId) {
          info.mdId = await resolveMangadexId(m.title, m.anilist_id);
          if (info.mdId) await adminSupabase.from("mangas").update({ mangadex_id: info.mdId }).eq("id", l.manga_id);
        }
        titles.set(l.manga_id, info);
      }
      if (!info.mdId) continue;
      budget--;
      const { cover, volume } = await findLogCover(info.mdId, "chapter", l.end_value, info.title);
      seen.set(key, { cover, volume });
    }
    const r = seen.get(key);
    if (!r || r.volume == null) continue;
    await adminSupabase.from("manga_logs").update({ volume: r.volume, ...(r.cover ? { cover_url: r.cover } : {}) }).eq("id", l.id);
    fixed++;
    const best = volumeByManga.get(l.manga_id);
    if (!best || l.end_value > best.chapter) volumeByManga.set(l.manga_id, { chapter: l.end_value, volume: r.volume });
  }
  for (const [mangaId, v] of volumeByManga) {
    await adminSupabase.from("mangas").update({ current_volume: v.volume }).eq("id", mangaId).eq("current_chapter", v.chapter);
  }
  return NextResponse.json({ updated, fixed });
}
