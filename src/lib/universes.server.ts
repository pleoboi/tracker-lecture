import { adminSupabase } from "./push.server";
import { userUniverses, type Universe } from "./universes";

/** Garde les membres qui ont activé l'univers donné (ex. rappels de lecture : livres seulement). */
export async function usersWithUniverse(userIds: string[], universe: Universe): Promise<string[]> {
  const kept = await Promise.all(
    userIds.map(async (id) => {
      const { data } = await adminSupabase.auth.admin.getUserById(id);
      // Compte introuvable : on ne filtre pas, comme avant l'existence du choix d'univers
      return !data?.user || userUniverses(data.user).includes(universe) ? id : null;
    })
  );
  return kept.filter((id): id is string => id !== null);
}
