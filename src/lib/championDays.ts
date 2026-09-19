import { supabase } from "./supabase";

export type ChampionLogRow = { user_id: string; pages_read: number; date: string };

const PAGE_SIZE = 1000;

// Supabase/PostgREST plafonne les réponses à 1000 lignes par défaut : au-delà,
// un simple .select() tronque silencieusement les lignes les plus récentes.
// On pagine donc avec .range() pour récupérer l'historique complet.
export async function fetchAllReadingLogsForChampionDays(): Promise<ChampionLogRow[]> {
  const rows: ChampionLogRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("reading_logs")
      .select("user_id, pages_read, date")
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data) break;
    rows.push(...(data as ChampionLogRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

export function computeChampionDays(rows: ChampionLogRow[], userId: string): number {
  const dateMap = new Map<string, Map<string, number>>();
  rows.forEach(({ date, user_id, pages_read }) => {
    if (!dateMap.has(date)) dateMap.set(date, new Map());
    const m = dateMap.get(date)!;
    m.set(user_id, (m.get(user_id) || 0) + pages_read);
  });
  let count = 0;
  for (const userMap of dateMap.values()) {
    const maxPages = Math.max(...userMap.values());
    if (maxPages > 0 && (userMap.get(userId) || 0) >= maxPages) count++;
  }
  return count;
}
