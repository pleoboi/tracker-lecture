import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase-server";
import { adminSupabase, sendPushToUser } from "../../../../../lib/push.server";
import { evaluateMangaBadges, type MangaBadgeInput } from "../../../../../lib/mangaBadges";

export const dynamic = "force-dynamic";

// Attribue les badges manga mérités par le membre connecté. Les données sont
// relues côté serveur : le client ne peut pas s'auto-attribuer un badge en
// envoyant ses propres chiffres. Appelée après une session, un changement de
// statut, et à l'ouverture de la page des badges (rattrapage de l'historique).
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: mangas } = await adminSupabase.from("mangas").select("*").eq("user_id", user.id);

  const logs: MangaBadgeInput["logs"] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await adminSupabase
      .from("manga_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error || !data) break;
    logs.push(...(data as MangaBadgeInput["logs"]));
    if (data.length < PAGE) break;
  }

  const states = evaluateMangaBadges({ mangas: (mangas ?? []) as MangaBadgeInput["mangas"], logs }, new Date().toISOString().slice(0, 10));
  const earned = states.filter((st) => st.unlocked);

  const { data: existing } = await adminSupabase.from("user_badges").select("badge_id").eq("user_id", user.id).like("badge_id", "manga-%");
  const have = new Set(((existing ?? []) as { badge_id: string }[]).map((r) => r.badge_id));
  const fresh = earned.filter((st) => !have.has(st.def.id));

  if (fresh.length > 0) {
    await adminSupabase.from("user_badges").upsert(
      fresh.map((st) => ({ user_id: user.id, badge_id: st.def.id })),
      { onConflict: "user_id,badge_id", ignoreDuplicates: true }
    );
    try {
      const body =
        fresh.length === 1 ? `Nouveau badge manga débloqué : ${fresh[0].def.name}` : `${fresh.length} nouveaux badges manga débloqués !`;
      await sendPushToUser(user.id, { title: "Swena", body, url: `/manga/membre/${user.id}/badges` }, "badges");
    } catch (e) {
      console.error("[manga badges] push error:", e);
    }
  }

  return NextResponse.json({
    awarded: fresh.map((st) => ({ id: st.def.id, name: st.def.name, tier: st.def.tier })),
    unlocked: earned.length,
  });
}
