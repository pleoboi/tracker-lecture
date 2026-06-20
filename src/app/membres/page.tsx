"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import type { Book, ReadingLog } from "../../lib/types";
import { AvatarImg } from "../../components/ui";

interface Profile {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  created_at: string;
}

interface MemberStats {
  completed: number;
  reading: number;
  totalPages: number;
  avgRating: number | null;
}


export default function MembresPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, MemberStats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ data: profs }, { data: books }, { data: logs }] = await Promise.all([
        supabase.from("user_profiles").select("*").order("created_at", { ascending: true }),
        supabase.from("books").select("id, user_id, status, rating, pages"),
        supabase.from("reading_logs").select("user_id, pages_read"),
      ]);

      const ps = (profs as Profile[]) || [];
      const bs = (books as Pick<Book, "id" | "user_id" | "status" | "rating" | "pages">[]) || [];
      const ls = (logs as Pick<ReadingLog, "user_id" | "pages_read">[]) || [];

      const map: Record<string, MemberStats> = {};
      ps.forEach((p) => {
        const userBooks = bs.filter((b) => b.user_id === p.id);
        const completed = userBooks.filter((b) => b.status === "completed");
        const reading = userBooks.filter((b) => b.status === "reading");
        const totalPages = ls
          .filter((l) => l.user_id === p.id)
          .reduce((sum, l) => sum + (l.pages_read || 0), 0);
        const rated = completed.filter((b) => (b.rating || 0) > 0);
        const avgRating =
          rated.length > 0
            ? rated.reduce((s, b) => s + (b.rating || 0), 0) / rated.length
            : null;
        map[p.id] = { completed: completed.length, reading: reading.length, totalPages, avgRating };
      });

      setProfiles(ps);
      setStatsMap(map);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="animate-fadeIn flex flex-col gap-6 pt-4">
      <header>
        <h1 className="font-serif text-3xl font-black text-ink">Membres</h1>
        <p className="mt-0.5 text-xs font-medium text-muted">
          {profiles.length} lecteur{profiles.length > 1 ? "s" : ""} dans ce club
        </p>
      </header>

      {loading ? (
        <div className="py-20 text-center text-xs font-medium uppercase tracking-wider text-muted">
          Chargement…
        </div>
      ) : profiles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-10 text-center">
          <p className="font-serif text-lg text-ink">Aucun membre pour le moment.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {profiles.map((p) => {
            const s = statsMap[p.id];
            return (
              <Link
                key={p.id}
                href={`/membre/${p.id}`}
                className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-violet/50"
              >
                <AvatarImg url={p.avatar_url} name={p.display_name} className="h-12 w-12 text-lg font-semibold" />
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-base font-semibold text-ink">{p.display_name}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-medium text-muted">
                    <span>{s?.completed ?? 0} livres terminés</span>
                    {(s?.reading ?? 0) > 0 && <span>{s!.reading} en cours</span>}
                    <span>{(s?.totalPages ?? 0).toLocaleString("fr-FR")} pages</span>
                    {s?.avgRating != null && (
                      <span>★ {s.avgRating.toFixed(1).replace(".", ",")}</span>
                    )}
                  </div>
                </div>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-4 w-4 shrink-0 text-muted"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
