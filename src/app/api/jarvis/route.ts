import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminSupabase } from "../../../lib/push.server";

// Export en lecture seule de MES données de lecture pour mon assistant Jarvis
// (recos et avis basés sur mes notes). Appel serveur à serveur, auth par
// secret dédié dans le header Authorization uniquement (jamais en query
// string). Tout est filtré sur STATS_OWNER_USER_ID : aucune donnée d'un autre
// membre ne sort d'ici (pas de follows, clubs, messages, likes...).
const OWNER_USER_ID = process.env.STATS_OWNER_USER_ID;
const PAGE_SIZE = 1000;

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.JARVIS_API_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Supabase plafonne à 1000 lignes par requête : on pagine (cf. championDays).
async function fetchAll<T>(table: string, columns: string, order: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await adminSupabase
      .from(table)
      .select(columns)
      .eq("user_id", OWNER_USER_ID!)
      .order(order)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export async function GET(req: NextRequest) {
  if (!OWNER_USER_ID || !isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [books, readingLogs, readSessions, ratingsHistory, goals, badges, lists] = await Promise.all([
      fetchAll(
        "books",
        "id, title, author, pages, progress, status, rating, genre, published_year, notes, date_started, date_read, created_at",
        "id",
      ),
      fetchAll("reading_logs", "book_id, date, pages_read, end_page", "date"),
      fetchAll("book_read_sessions", "book_id, date_started, date_read", "id"),
      fetchAll("book_ratings_history", "book_id, rating, page_at, logged_at", "logged_at"),
      fetchAll("user_goals", "reading_pages_year, reading_books_year", "created_at"),
      fetchAll("user_badges", "badge_id, unlocked_at", "unlocked_at"),
      fetchAll<{ id: string; title: string; description: string | null }>(
        "book_lists",
        "id, title, description",
        "created_at",
      ),
    ]);

    const listIds = lists.map((l) => l.id);
    const { data: listItems, error: itemsError } = listIds.length
      ? await adminSupabase
          .from("book_list_items")
          .select("list_id, book_title, book_author, position, note")
          .in("list_id", listIds)
          .order("position")
      : { data: [], error: null };
    if (itemsError) throw new Error(`book_list_items: ${itemsError.message}`);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      books,
      readingLogs,
      readSessions,
      ratingsHistory,
      goals: goals[0] ?? null,
      badges,
      lists: lists.map((l) => ({
        title: l.title,
        description: l.description,
        items: (listItems ?? []).filter((i) => i.list_id === l.id),
      })),
    });
  } catch (e) {
    console.error("[jarvis]", e);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
