import { supabase } from "./supabase";

export interface Goals {
  reading_pages_year: number | null;
  reading_books_year: number | null;
}

export const DEFAULT_GOALS: Goals = {
  reading_pages_year: null,
  reading_books_year: null,
};

export async function loadGoals(userId: string): Promise<Goals> {
  const { data } = await supabase
    .from("app_settings")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (!data) return DEFAULT_GOALS;
  return {
    reading_pages_year: data.reading_pages_year ?? null,
    reading_books_year: data.reading_books_year ?? null,
  };
}

export async function updateGoal(
  key: keyof Goals,
  value: number | null,
  userId: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("app_settings")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (existing) {
    await supabase
      .from("app_settings")
      .update({ [key]: value })
      .eq("user_id", userId);
  } else {
    await supabase
      .from("app_settings")
      .insert({ user_id: userId, [key]: value });
  }
}
