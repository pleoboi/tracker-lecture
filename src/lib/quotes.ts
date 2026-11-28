import { supabase } from "./supabase";
import { bookKey } from "./quiz";

export type Quote = {
  id: number;
  user_id: string;
  book_id: number | null;
  book_key: string;
  book_title: string;
  book_author: string | null;
  book_cover: string | null;
  body: string;
  page: number | null;
  /** false = citation privée, visible seulement par son auteur (migration v47). */
  is_public?: boolean | null;
  created_at: string;
  // Ajoutés côté client
  author_name?: string;
  author_avatar?: string | null;
  likes: number;
  liked: boolean;
};

export const MAX_QUOTE = 1200;

/** Charge des citations avec le nombre de likes, si je les ai likées et le profil de l'auteur. */
export async function hydrateQuotes(rows: Omit<Quote, "likes" | "liked" | "author_name" | "author_avatar">[], me?: string | null): Promise<Quote[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const [{ data: likes }, { data: profs }] = await Promise.all([
    supabase.from("quote_likes").select("quote_id, user_id").in("quote_id", ids),
    supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", userIds),
  ]);
  const count = new Map<number, number>();
  const mine = new Set<number>();
  for (const l of (likes ?? []) as { quote_id: number; user_id: string }[]) {
    count.set(l.quote_id, (count.get(l.quote_id) ?? 0) + 1);
    if (l.user_id === me) mine.add(l.quote_id);
  }
  const pm = new Map(((profs ?? []) as { id: string; display_name: string | null; avatar_url: string | null }[]).map((p) => [p.id, p]));
  return rows.map((r) => ({
    ...r,
    likes: count.get(r.id) ?? 0,
    liked: mine.has(r.id),
    author_name: pm.get(r.user_id)?.display_name ?? "Membre",
    author_avatar: pm.get(r.user_id)?.avatar_url ?? null,
  }));
}

export async function addQuote(input: {
  userId: string;
  book: { id?: number | null; title: string; author?: string | null; cover_url?: string | null };
  body: string;
  page?: number | null;
  isPublic?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const body = input.body.trim();
  if (body.length < 3) return { ok: false, error: "La citation est trop courte." };
  const { error } = await supabase.from("book_quotes").insert({
    user_id: input.userId,
    book_id: input.book.id ?? null,
    book_key: bookKey(input.book.title),
    book_title: input.book.title,
    book_author: input.book.author ?? null,
    book_cover: input.book.cover_url ?? null,
    body: body.slice(0, MAX_QUOTE),
    page: input.page && input.page > 0 ? input.page : null,
    // Colonne ajoutée par la migration v47 : envoyée seulement pour une citation privée
    ...(input.isPublic === false ? { is_public: false } : {}),
  });
  if (error) {
    return { ok: false, error: /is_public/.test(error.message) ? "Les citations privées ne sont pas encore activées (migration v47)." : /does not exist|relation/.test(error.message) ? "Les citations ne sont pas encore activées (migration v46)." : "Impossible d'enregistrer la citation." };
  }
  window.dispatchEvent(new CustomEvent("swena:quote-added"));
  return { ok: true };
}

export async function toggleQuoteLike(quoteId: number, userId: string, liked: boolean) {
  if (liked) await supabase.from("quote_likes").delete().eq("quote_id", quoteId).eq("user_id", userId);
  else await supabase.from("quote_likes").insert({ quote_id: quoteId, user_id: userId });
}
