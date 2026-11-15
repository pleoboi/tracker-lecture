import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase-server";
import { adminSupabase } from "../../../../lib/push.server";
import { findVolumeCovers, resolveMangadexId } from "../../../../lib/mangaReleases.server";

// Couverture exacte de chaque tome demandé, pour le Wrapped.
// Corps : { items: [{ mangaId, volume }] } -> { covers: { "<mangaId>-<volume>": url } }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { items?: { mangaId?: number; volume?: number }[] };
  const items = (body.items ?? [])
    .filter((i): i is { mangaId: number; volume: number } => Number.isInteger(i.mangaId) && Number.isInteger(i.volume))
    .slice(0, 24);
  if (!items.length) return NextResponse.json({ covers: {} });

  const byManga = new Map<number, number[]>();
  for (const i of items) byManga.set(i.mangaId, [...(byManga.get(i.mangaId) ?? []), i.volume]);

  const { data: mangas } = await adminSupabase
    .from("mangas")
    .select("id, user_id, title, anilist_id, mangadex_id")
    .in("id", [...byManga.keys()])
    .eq("user_id", user.id);

  const covers: Record<string, string> = {};
  await Promise.all(
    (mangas ?? []).map(async (m) => {
      let mdId: string | null = m.mangadex_id;
      if (!mdId) {
        mdId = await resolveMangadexId(m.title, m.anilist_id);
        if (mdId) await adminSupabase.from("mangas").update({ mangadex_id: mdId }).eq("id", m.id);
      }
      if (!mdId) return;
      const found = await findVolumeCovers(mdId, byManga.get(m.id) ?? []);
      for (const [vol, url] of Object.entries(found)) covers[`${m.id}-${vol}`] = url;
    })
  );
  return NextResponse.json({ covers });
}
