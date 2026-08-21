import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { BADGE_DEFS } from "../../../../lib/badges";
import { sendPushToUser } from "../../../../lib/push.server";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const REFERRAL_TIERS: { id: string; count: number }[] = [
  { id: "referral-1", count: 1 },
  { id: "referral-3", count: 3 },
  { id: "referral-10", count: 10 },
];

/**
 * Attribue un parrainage : appelé une fois après l'inscription si l'utilisateur
 * est arrivé via un lien /register?ref=<id-du-parrain>. Idempotent — n'écrit
 * qu'une fois (n'écrase jamais un referred_by déjà posé).
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: { user }, error: authErr } = await anon.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Token invalide" }, { status: 401 });

  const { referrerId } = (await req.json()) as { referrerId?: string };
  if (!referrerId || referrerId === user.id) {
    return NextResponse.json({ ok: false, reason: "invalid" });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // Le parrain doit exister réellement.
  const { data: referrerProfile } = await db
    .from("user_profiles").select("id").eq("id", referrerId).maybeSingle();
  if (!referrerProfile) return NextResponse.json({ ok: false, reason: "unknown_referrer" });

  // On ne pose l'attribution que si elle n'existe pas déjà (première fois seulement).
  const { data: myProfile } = await db
    .from("user_profiles").select("referred_by").eq("id", user.id).maybeSingle();
  if (myProfile?.referred_by) {
    return NextResponse.json({ ok: false, reason: "already_attributed" });
  }

  const { error: updateErr } = await db
    .from("user_profiles")
    .upsert({ id: user.id, referred_by: referrerId }, { onConflict: "id" });
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Paliers de badges "Le Parrain" pour le parrain.
  const { count } = await db
    .from("user_profiles").select("id", { count: "exact", head: true })
    .eq("referred_by", referrerId);
  const referralCount = count ?? 0;

  const { data: existing } = await db
    .from("user_badges").select("badge_id").eq("user_id", referrerId);
  const unlocked = new Set((existing ?? []).map((r: { badge_id: string }) => r.badge_id));

  const newlyUnlocked = REFERRAL_TIERS.filter(
    (t) => !unlocked.has(t.id) && referralCount >= t.count,
  );

  if (newlyUnlocked.length > 0) {
    await db.from("user_badges").upsert(
      newlyUnlocked.map((t) => ({ user_id: referrerId, badge_id: t.id })),
      { onConflict: "user_id,badge_id", ignoreDuplicates: true },
    );
    const best = newlyUnlocked[newlyUnlocked.length - 1];
    const def = BADGE_DEFS.find((b) => b.id === best.id);
    if (def) {
      try {
        await sendPushToUser(
          referrerId,
          { title: "Swena", body: `Nouveau badge débloqué : ${def.name}`, url: `/membre/${referrerId}` },
          "badges",
        );
      } catch { /* la notification n'est pas critique */ }
    }
  }

  return NextResponse.json({ ok: true, referralCount });
}
