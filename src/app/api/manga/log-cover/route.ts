import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase-server";
import { adminSupabase } from "../../../../lib/push.server";
import { findLogCover, resolveMangadexId } from "../../../../lib/mangaReleases.server";

// Appelée juste après l'enregistrement d'une session manga : retrouve la
// couverture du tome lu (ou du tome qui contient le chapitre) et la pose sur
// le log, pour l'activité des amis, avec le numéro du tome.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { logId } = (await req.json().catch(() => ({}))) as { logId?: number };
  if (!logId) return NextResponse.json({ error: "logId manquant" }, { status: 400 });

  const { data: log } = await adminSupabase
    .from("manga_logs")
    .select("id, user_id, manga_id, unit, end_value")
    .eq("id", logId)
    .single();
  if (!log || log.user_id !== user.id) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const { data: manga } = await adminSupabase
    .from("mangas")
    .select("id, title, anilist_id, mangadex_id")
    .eq("id", log.manga_id)
    .single();
  if (!manga) return NextResponse.json({ cover: null });

  let mdId: string | null = manga.mangadex_id;
  if (!mdId) {
    mdId = await resolveMangadexId(manga.title, manga.anilist_id);
    if (mdId) await adminSupabase.from("mangas").update({ mangadex_id: mdId }).eq("id", manga.id);
  }
  if (!mdId) return NextResponse.json({ cover: null });

  const { cover, volume } = await findLogCover(mdId, log.unit, log.end_value);
  if (cover) await adminSupabase.from("manga_logs").update({ cover_url: cover }).eq("id", log.id);
  // Tome des chapitres lus : sert à fusionner les sessions du même tome dans l'activité du club.
  // Mise à jour séparée pour que la couverture reste posée même si la colonne n'existe pas encore (v39).
  if (volume != null) await adminSupabase.from("manga_logs").update({ volume }).eq("id", log.id);
  return NextResponse.json({ cover, volume });
}
