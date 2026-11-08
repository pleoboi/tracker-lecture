"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { todayISO, shiftDateISO } from "../../lib/books";
import { unitLabel, type MangaUnit } from "../../lib/manga";
import { AvatarImg } from "../ui";
import { MangaCover } from "./MangaUI";

type FeedItem = {
  id: number;
  user_id: string;
  manga_id: number;
  date: string;
  unit: MangaUnit;
  amount: number;
  end_value: number;
  notes: string | null;
  cover_url: string | null;
  mangas: { title: string; cover_url: string | null; status: string } | null;
};

type Profile = { id: string; display_name: string; avatar_url: string | null };

const DAYS = 21;

function dayLabel(iso: string) {
  const today = todayISO();
  if (iso === today) return "Aujourd'hui";
  if (iso === shiftDateISO(today, -1)) return "Hier";
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

/** Activité manga du club : toi + les membres suivis (mêmes abonnements que sur Swena). */
export default function FriendsMangaActivity({ userId }: { userId: string }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [hasFollows, setHasFollows] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: follows } = await supabase.from("user_follows").select("following_id").eq("follower_id", userId);
      const followingIds = ((follows ?? []) as { following_id: string }[]).map((f) => f.following_id);
      setHasFollows(followingIds.length > 0);
      // Comme l'activité du club côté livres : tes propres sessions en font partie
      const ids = [userId, ...followingIds];
      const [{ data: logs }, { data: profs }] = await Promise.all([
        supabase
          .from("manga_logs")
          .select("id, user_id, manga_id, date, unit, amount, end_value, notes, cover_url, mangas(title, cover_url, status)")
          .in("user_id", ids)
          .gte("date", shiftDateISO(todayISO(), -DAYS))
          .order("date", { ascending: false })
          .order("id", { ascending: false })
          .limit(60),
        supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", ids),
      ]);
      setItems((logs as unknown as FeedItem[]) ?? []);
      setProfiles(new Map(((profs ?? []) as Profile[]).map((p) => [p.id, p])));
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return <p className="py-6 text-center text-xs text-muted">Chargement…</p>;

  const followPrompt = !hasFollows && (
      <Link href="/membres" className="manga-panel flex items-center gap-3 px-4 py-3">
        <span className="text-lg">👥</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-ink">Suis des membres pour voir leurs lectures manga</p>
          <p className="text-[11px] text-muted">Les mêmes abonnements que côté livres</p>
        </div>
        <span className="shrink-0 text-xs font-bold text-violet-deep">Voir →</span>
      </Link>
  );

  if (!items.length) {
    return (
      <div className="flex flex-col gap-3">
        {followPrompt}
        <p className="rounded-lg border-2 border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          Aucune lecture manga dans le club ces {DAYS} derniers jours.
        </p>
      </div>
    );
  }

  const groups: { date: string; items: FeedItem[] }[] = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === it.date) last.items.push(it);
    else groups.push({ date: it.date, items: [it] });
  }

  return (
    <div className="flex flex-col gap-3">
    {followPrompt}
    <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      {groups.map((g) => (
        <div key={g.date} className="flex shrink-0 flex-col gap-2">
          <span className="text-[9.5px] font-bold uppercase tracking-widest text-muted">{dayLabel(g.date)}</span>
          <div className="flex gap-3">
            {g.items.map((it) => {
              const p = profiles.get(it.user_id);
              const name = it.user_id === userId ? "Toi" : p?.display_name ?? "Membre";
              return (
                <div key={it.id} className="manga-panel flex w-[180px] flex-col gap-2.5 p-3">
                  <Link href={`/membre/${it.user_id}`} className="flex items-center gap-1.5">
                    <AvatarImg url={p?.avatar_url} name={name} className="h-8 w-8 text-[12px]" />
                    <span className="truncate text-[13.5px] font-bold text-ink">{name}</span>
                  </Link>
                  <Link href={`/manga/${it.manga_id}`} className="flex flex-col gap-2">
                    {/* Couverture du tome lu (ou qui contient le chapitre), sinon celle de la série */}
                    <MangaCover id={it.manga_id} title={it.mangas?.title ?? "?"} coverUrl={it.cover_url ?? it.mangas?.cover_url} className="aspect-[2/3] h-auto w-full" />
                    {/* Sous l'image : série, lu pendant la session, chapitre / tome atteint */}
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="line-clamp-2 text-[14px] font-bold leading-tight text-ink">{it.mangas?.title ?? "Série"}</p>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="nums font-serif text-[20px] leading-none text-violet-deep">
                          +{it.amount} {unitLabel(it.unit, it.amount, true)}
                        </p>
                        <p className="nums text-[12px] font-semibold text-muted">
                          {it.unit === "chapter" ? "ch." : "tome"} {it.end_value}
                        </p>
                      </div>
                    </div>
                  </Link>
                  {it.notes && <p className="line-clamp-3 text-[12.5px] italic text-ink-2">« {it.notes} »</p>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
    </div>
  );
}
