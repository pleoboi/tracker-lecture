import { supabase } from "./supabase";

type Maskable = { user_id?: string | null; session_private?: boolean | null; session_notes?: string | null; session_photo_url?: string | null };

/**
 * Sessions de lecture marquées « privées » : leur note et leur photo ne sont visibles que par leur auteur.
 * Les pages lues, elles, comptent toujours dans les statistiques et l'activité.
 */
export function maskPrivateSessions<T extends Maskable>(rows: T[], me: string | null | undefined, ownerId?: string): T[] {
  return rows.map((r) => {
    const owner = ownerId ?? r.user_id;
    if (!r.session_private || (me && owner === me)) return r;
    return { ...r, session_notes: null, session_photo_url: null };
  });
}

/** Même chose, en retrouvant moi-même la personne connectée (pages qui n'ont pas déjà l'utilisateur). */
export async function maskPrivateSessionsForViewer<T extends Maskable>(rows: T[], ownerId?: string): Promise<T[]> {
  if (!rows.some((r) => r.session_private)) return rows;
  const { data } = await supabase.auth.getUser();
  return maskPrivateSessions(rows, data.user?.id, ownerId);
}
