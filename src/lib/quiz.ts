export const QUIZ_TIERS = [50, 100] as const;
export const QUIZ_XP = 10;

/** Clé d'un livre dans la banque de questions : le titre sans accents ni ponctuation. */
export function bookKey(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Paliers franchis entre deux progressions en pages (le plus haut en dernier). */
export function crossedTiers(pages: number, from: number, to: number): number[] {
  if (!pages || to <= from) return [];
  return QUIZ_TIERS.filter((t) => from < (pages * t) / 100 && to >= (pages * t) / 100);
}

export interface QuizQuestion {
  id: number;
  tier: number;
  question: string;
  options: string[];
}

export interface QuizResult {
  correct: boolean;
  answer: number;
  explanation: string;
  xp: number;
}
