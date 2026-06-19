import type { Book, ReadingLog } from "./types";

const SPINE_COLORS = [
  "var(--color-spine-1)",
  "var(--color-spine-2)",
  "var(--color-spine-3)",
  "var(--color-spine-4)",
  "var(--color-spine-5)",
  "var(--color-spine-6)",
];

/** Couleur de couverture déterministe (toujours la même pour un livre donné). */
export function spineColor(id: number): string {
  return SPINE_COLORS[Math.abs(id) % SPINE_COLORS.length];
}

/** Initiales d'un titre (1 à 2 lettres) pour la couverture placeholder. */
export function initials(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .replace(/[^A-Za-zÀ-ÿ]/g, "")
    .slice(0, 2)
    .toUpperCase();
}

export function pct(book: Pick<Book, "pages" | "progress">): number {
  if (!book.pages || book.pages <= 0) return 0;
  return Math.min(Math.round((book.progress / book.pages) * 100), 100);
}

export function isCompleted(book: Pick<Book, "pages" | "progress" | "status">): boolean {
  return book.status === "completed" || pct(book) >= 100;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface ReadingStats {
  startDate: Date | null;
  endDate: Date | null;
  durationDays: number | null;
  pagesPerDay: number | null;
  totalPages: number;
}

/** Statistiques de lecture d'un livre calculées depuis ses logs. */
export function readingStats(book: Book, logs: ReadingLog[]): ReadingStats {
  const bookLogs = logs
    .filter((l) => l.book_id === book.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (bookLogs.length === 0) {
    return { startDate: null, endDate: null, durationDays: null, pagesPerDay: null, totalPages: 0 };
  }

  const startDate = new Date(bookLogs[0].date);
  const endDate = new Date(bookLogs[bookLogs.length - 1].date);
  const totalPages = bookLogs.reduce((sum, l) => sum + (l.pages_read || 0), 0);
  const durationDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1);
  const pagesPerDay = durationDays > 0 ? Math.round(totalPages / durationDays) : null;

  return { startDate, endDate, durationDays, pagesPerDay, totalPages };
}

/** Estime le nombre de jours restants au rythme moyen des 30 derniers jours. */
export function estimatedDaysLeft(book: Book, logs: ReadingLog[]): number | null {
  if (isCompleted(book)) return null;
  const remaining = book.pages - book.progress;
  if (remaining <= 0) return null;

  const since = Date.now() - 30 * MS_PER_DAY;
  const recent = logs.filter(
    (l) => l.book_id === book.id && new Date(l.date).getTime() >= since
  );
  const pages = recent.reduce((s, l) => s + (l.pages_read || 0), 0);
  if (pages <= 0) return null;
  const perDay = pages / 30;
  return Math.max(1, Math.ceil(remaining / perDay));
}

const FR_DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const FR_DATE_LONG = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatDate(d: Date | string | null): string {
  if (!d) return "—";
  return FR_DATE.format(typeof d === "string" ? new Date(d) : d);
}

export function formatDateLong(d: Date | string | null): string {
  if (!d) return "—";
  return FR_DATE_LONG.format(typeof d === "string" ? new Date(d) : d);
}

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}
