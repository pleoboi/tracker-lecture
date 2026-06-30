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
    .from("user_goals")
    .select("reading_pages_year, reading_books_year")
    .eq("user_id", userId)
    .single();
  if (!data) return DEFAULT_GOALS;
  return {
    reading_pages_year: (data as Goals).reading_pages_year ?? null,
    reading_books_year: (data as Goals).reading_books_year ?? null,
  };
}

export async function updateGoal(
  key: keyof Goals,
  value: number | null,
  userId: string
): Promise<void> {
  await supabase
    .from("user_goals")
    .upsert({ user_id: userId, [key]: value }, { onConflict: "user_id" });
}
