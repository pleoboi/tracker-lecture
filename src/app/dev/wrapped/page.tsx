"use client";

import { notFound, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import WrappedStory from "../../../components/WrappedStory";
import type { WrappedStats, MangaWrapped } from "../../../lib/wrapped";

// Aperçu du Wrapped avec des données d'exemple — développement uniquement
// (le proxy ne laisse passer /dev/ qu'en local, et la page renvoie 404 en prod).

const OP = "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-BeslEMqiPhlk.jpg";
const VAGA = "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30656-9mW113O7rDnA.png";
const KAGU = "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx169355-5pqzh1Wb4NOQ.png";

function daily(year: number, month: number, values: Record<number, number>) {
  const days = new Date(year, month, 0).getDate();
  return Array.from({ length: days }, (_, i) => ({
    date: `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
    pages: values[i + 1] ?? 0,
  }));
}

const manga: MangaWrapped = {
  chapters: 64,
  volumes: 3,
  sessionsCount: 19,
  daysActive: 16,
  longestStreak: 5,
  prevChapters: 41,
  seriesCount: 3,
  seriesFinished: [{ id: 2, title: "Vagabond", cover_url: VAGA, rating: 4.5 }],
  topSeries: { id: 1, title: "ONE PIECE", author: "Eiichirō Oda", cover_url: OP, chapters: 48, volumes: 0 },
  bestDay: { date: "2026-10-12", chapters: 14, volumes: 0 },
  daily: daily(2026, 10, { 2: 3, 3: 4, 5: 6, 6: 2, 9: 5, 10: 7, 11: 3, 12: 14, 13: 2, 16: 4, 19: 1, 20: 3, 23: 5, 26: 2, 27: 4, 30: 3 }),
  volumeCovers: [
    { mangaId: 2, title: "Vagabond", volume: 32, cover_url: "https://uploads.mangadex.org/covers/d1a9fdeb-f713-407f-960c-8326b586e6fd/03e80417-426f-45ed-b144-0e1d76695c2f.jpg.256.jpg" },
    { mangaId: 2, title: "Vagabond", volume: 31, cover_url: "https://uploads.mangadex.org/covers/d1a9fdeb-f713-407f-960c-8326b586e6fd/0992482c-90f0-4076-892b-361bd06c91c6.jpg.256.jpg" },
    { mangaId: 1, title: "ONE PIECE", volume: 114, cover_url: OP },
  ],
  coverPool: [
    { id: 1, title: "ONE PIECE", cover_url: OP },
    { id: 2, title: "Vagabond", cover_url: VAGA },
    { id: 3, title: "Kagurabachi", cover_url: KAGU },
  ],
};

const base: WrappedStats = {
  year: 2026,
  month: 10,
  monthLabel: "Octobre 2026",
  totalPages: 0,
  prevMonthPages: null,
  deltaPct: null,
  sessionsCount: 0,
  daysActive: 0,
  daysInMonth: 31,
  longestStreak: 0,
  booksCompleted: [],
  topBook: null,
  topGenre: null,
  topGenrePages: 0,
  bestDay: null,
  avgPerActiveDay: 0,
  rankPercentile: null,
  activeReadersCount: null,
  topGenres: [],
  dailyPages: daily(2026, 10, {}),
  coverPool: manga.coverPool.map((m) => ({ ...m, id: -m.id })),
};

const shogun = {
  id: 9001, created_at: "", title: "Shōgun, partie 1", author: "James Clavell", pages: 1133, progress: 1133, status: "completed",
  cover_url: null, rating: 2.9,
};
const pilgrim = {
  id: 9002, created_at: "", title: "La Splendeur et l'Infamie", author: "Erik Larson", pages: 720, progress: 720, status: "completed",
  cover_url: "https://m.media-amazon.com/images/I/71bQ7B-xwWL._AC_UF1000,1000_QL80_.jpg", rating: 5,
};

const mixed: WrappedStats = {
  ...base,
  totalPages: 2140,
  prevMonthPages: 1880,
  deltaPct: 14,
  sessionsCount: 27,
  daysActive: 24,
  longestStreak: 9,
  booksCompleted: [pilgrim, shogun],
  topBook: pilgrim,
  topGenre: "Histoire",
  topGenrePages: 1200,
  bestDay: { date: "2026-10-18", pages: 186 },
  avgPerActiveDay: 89,
  rankPercentile: 82,
  activeReadersCount: 23,
  topGenres: [{ genre: "Histoire", pages: 1200 }, { genre: "Roman", pages: 700 }, { genre: "Non-fiction", pages: 240 }],
  dailyPages: daily(2026, 10, Object.fromEntries(Array.from({ length: 24 }, (_, i) => [i + 3, 40 + ((i * 37) % 120)]))),
  coverPool: [
    { id: pilgrim.id, title: pilgrim.title, cover_url: pilgrim.cover_url },
    { id: shogun.id, title: shogun.title, cover_url: shogun.cover_url },
    ...manga.coverPool.map((m) => ({ ...m, id: -m.id })),
  ],
  hasBooks: true,
  manga,
};

const mangaOnly: WrappedStats = { ...base, hasBooks: false, manga };

function Demo() {
  const params = useSearchParams();
  const mode = params.get("mode") === "mixte" ? "mixte" : "manga";
  // ?mois=11 ou 12 : aperçu de l'ambiance d'hiver (neige) du Wrapped
  const month = Number(params.get("mois")) || 10;
  const label = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"][month] ?? "Octobre";
  const base = mode === "mixte" ? mixed : mangaOnly;
  return (
    <WrappedStory
      key={mode + month}
      stats={{ ...base, month, monthLabel: `${label} 2026` }}
      profile={{ displayName: "Léo", avatarUrl: null }}
      onClose={() => {}}
    />
  );
}

export default function WrappedDemoPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <Demo />
    </Suspense>
  );
}
