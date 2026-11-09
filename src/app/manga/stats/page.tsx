"use client";

import { useAuth } from "../../../lib/auth-context";
import MangaStatsView from "../../../components/manga/MangaStatsView";

export default function MangaStatsPage() {
  const { user } = useAuth();
  if (!user) return <p className="py-16 text-center text-xs font-medium uppercase tracking-wider text-muted">Chargement…</p>;
  return <MangaStatsView userId={user.id} isOwn />;
}
