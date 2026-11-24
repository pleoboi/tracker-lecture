import { supabase } from "./supabase";

/**
 * Qui peut apparaître dans le champion du jour vu par `viewerId` (compte privé, v43) :
 * - si le lecteur a un compte privé : seulement lui et ses amis (abonnements réciproques) ;
 * - sinon : tout le monde, sauf les comptes privés dont il n'est pas ami.
 * Renvoie un filtre sur les identifiants de membres.
 */
export async function championScope(viewerId: string | null | undefined): Promise<(userId: string) => boolean> {
  const { data: priv } = await supabase.from("user_profiles").select("id").eq("is_private", true);
  const privateIds = new Set(((priv ?? []) as { id: string }[]).map((p) => p.id));
  if (!viewerId) return (id) => !privateIds.has(id);

  const [{ data: out }, { data: inc }] = await Promise.all([
    supabase.from("user_follows").select("following_id").eq("follower_id", viewerId),
    supabase.from("user_follows").select("follower_id").eq("following_id", viewerId),
  ]);
  const following = new Set(((out ?? []) as { following_id: string }[]).map((f) => f.following_id));
  const friends = new Set(((inc ?? []) as { follower_id: string }[]).map((f) => f.follower_id).filter((id) => following.has(id)));
  friends.add(viewerId);

  if (privateIds.has(viewerId)) return (id) => friends.has(id);
  return (id) => !privateIds.has(id) || friends.has(id);
}
