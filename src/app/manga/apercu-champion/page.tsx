"use client";

import { notFound } from "next/navigation";
import { MangaChampionBanner } from "../../../components/manga/MangaChampion";

// Aperçu du champion du jour manga avec des données d'exemple, développement uniquement.
export default function ChampionPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-4">
      <MangaChampionBanner
        today={{ userId: "demo", name: "Léo", avatar: null, chapters: 23 }}
        yesterday={{ userId: "demo2", name: "Camille", avatar: null, chapters: 9 }}
      />
      <MangaChampionBanner today={null} yesterday={{ userId: "demo2", name: "Camille", avatar: null, chapters: 9 }} />
    </div>
  );
}
