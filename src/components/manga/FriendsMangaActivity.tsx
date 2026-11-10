"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/auth-context";
import { supabase } from "../../lib/supabase";
import { todayISO, shiftDateISO } from "../../lib/books";
import { unitLabel, mergeMangaLogs, mangaProfileHref, type MangaUnit } from "../../lib/manga";
import { notifyUser } from "../../lib/push.client";
import { AvatarImg } from "../ui";
import { MangaCover, RatingTag } from "./MangaUI";

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
  volume: number | null;
  rating: number | null;
  mangas: { title: string; cover_url: string | null; status: string } | null;
};

type Like = { log_id: number; liker_id: string };

type Profile = { id: string; display_name: string; avatar_url: string | null };

const DAYS = 21;

function dayLabel(iso: string) {
  const today = todayISO();
  if (iso === today) return "Aujourd'hui";
  if (iso === shiftDateISO(today, -1)) return "Hier";
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

/** Fleur de cerisier (sakura) : cinq pétales encochés. */
function Sakura({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" aria-hidden>
      <g fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        {[0, 72, 144, 216, 288].map((r) => (
          <path key={r} transform={`rotate(${r} 12 12)`} d="M12 12 C8.6 9.4 8.8 4.6 10.6 2.8 L12 4.2 L13.4 2.8 C15.2 4.6 15.4 9.4 12 12 Z" />
        ))}
      </g>
      <circle cx="12" cy="12" r="1.6" fill={filled ? "var(--color-cream)" : "currentColor"} />
    </svg>
  );
}

/**
 * Bouton « J'aime » avec une fleur de cerisier : texte explicite pour qu'on comprenne
 * tout de suite qu'on peut aimer. Plein quand tu as aimé, en contour sinon.
 * Sur ses propres sessions : juste le compteur.
 */
function LikeStamp({ count, liked, own, onToggle }: { count: number; liked: boolean; own: boolean; onToggle: () => void }) {
  if (own) {
    return count > 0 ? (
      <span className="flex items-center gap-1 text-violet-deep">
        <Sakura filled />
        <span className="nums text-[12px] font-bold">{count}</span>
      </span>
    ) : null;
  }
  return (
    <button
      onClick={onToggle}
      aria-pressed={liked}
      aria-label={liked ? "Retirer mon like" : "Aimer cette activité"}
      className={`btn-press flex shrink-0 items-center gap-0.5 rounded-full border-2 px-1.5 py-px text-[10.5px] font-bold transition-colors ${
        liked ? "border-ink bg-violet text-cream" : "border-ink bg-card text-ink"
      }`}
    >
      <Sakura filled={liked} />
      <span>{liked ? "Aimé" : "J'aime"}</span>
      {count > 0 && <span className="nums opacity-80">{count}</span>}
    </button>
  );
}

/** Activité manga du club : toi + les membres suivis (mêmes abonnements que sur Swena). */
export default function FriendsMangaActivity({ userId }: { userId: string }) {
  const [items, setItems] = useState<ReturnType<typeof mergeMangaLogs<FeedItem>>>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [hasFollows, setHasFollows] = useState(true);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState<Like[]>([]);
  const { user } = useAuth();
  const myName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";

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
          .select("*, mangas(title, cover_url, status)")
          .in("user_id", ids)
          .gte("date", shiftDateISO(todayISO(), -DAYS))
          .order("date", { ascending: false })
          .order("id", { ascending: false })
          .limit(60),
        supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", ids),
      ]);
      // Même jour, même tome : une seule ligne (2 + 2 chapitres du tome 3 → +4 ch.)
      setItems(mergeMangaLogs((logs as unknown as FeedItem[]) ?? []));
      const logIds = ((logs ?? []) as { id: number }[]).map((l) => l.id);
      if (logIds.length) {
        const { data: lk } = await supabase.from("manga_log_likes").select("log_id, liker_id").in("log_id", logIds);
        setLikes((lk ?? []) as Like[]);
      }
      setProfiles(new Map(((profs ?? []) as Profile[]).map((p) => [p.id, p])));
      setLoading(false);
    })();
  }, [userId]);

  const toggleLike = async (it: (typeof items)[number]) => {
    if (it.user_id === userId) return;
    const mineIds = it.ids.filter((id) => likes.some((l) => l.log_id === id && l.liker_id === userId));
    const before = likes;
    if (mineIds.length) {
      setLikes((prev) => prev.filter((l) => !(it.ids.includes(l.log_id) && l.liker_id === userId)));
      const { error } = await supabase.from("manga_log_likes").delete().in("log_id", mineIds).eq("liker_id", userId);
      if (error) setLikes(before);
    } else {
      setLikes((prev) => [...prev, { log_id: it.id, liker_id: userId }]);
      const { error } = await supabase.from("manga_log_likes").insert({ log_id: it.id, liker_id: userId });
      if (error) setLikes(before);
      else {
        // Centre de notifications (la cloche) + push, comme les likes côté livres
        await supabase.from("notifications").insert({
          user_id: it.user_id,
          from_user_id: userId,
          type: "manga_like",
          book_title: it.mangas?.title ?? "ton manga",
        });
        notifyUser(it.user_id, "Swena", `${myName} a aimé ton activité sur «${it.mangas?.title ?? "ton manga"}»`, `/manga`, "likes");
      }
    }
  };

  if (loading) return <p className="py-6 text-center text-xs text-muted">Chargement…</p>;

  const followPrompt = !hasFollows && (
      <Link href="/manga/membres" className="manga-panel flex items-center gap-3 px-4 py-3">
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

  const groups: { date: string; items: typeof items }[] = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === it.date) last.items.push(it);
    else groups.push({ date: it.date, items: [it] });
  }

  return (
    <div className="flex flex-col gap-3">
    {followPrompt}
    <div className="-mx-5 flex items-stretch gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      {groups.map((g) => (
        <div key={g.date} className="flex shrink-0 flex-col gap-2">
          <span className="text-[9.5px] font-bold uppercase tracking-widest text-muted">{dayLabel(g.date)}</span>
          <div className="flex flex-1 items-stretch gap-3">
            {g.items.map((it) => {
              const p = profiles.get(it.user_id);
              const name = it.user_id === userId ? "Toi" : p?.display_name ?? "Membre";
              const mine = likes.filter((l) => it.ids.includes(l.log_id));
              const likers = new Set(mine.map((l) => l.liker_id));
              return (
                <div key={it.id} className="manga-panel flex w-[158px] flex-col gap-2 p-2.5">
                  <Link href={mangaProfileHref(it.user_id)} className="flex min-w-0 items-center gap-1.5">
                    <AvatarImg url={p?.avatar_url} name={name} className="h-5 w-5 shrink-0 text-[9px]" />
                    <span className="truncate text-[11.5px] font-bold text-ink">{name}</span>
                  </Link>
                  <Link href={`/manga/${it.manga_id}`} className="flex flex-col gap-2">
                    {/* Couverture du tome lu (ou qui contient le chapitre), sinon celle de la série */}
                    <MangaCover id={it.manga_id} title={it.mangas?.title ?? "?"} coverUrl={it.cover_url ?? it.mangas?.cover_url} className="aspect-[2/3] h-auto w-full" />
                    {/* Hauteurs fixes : toutes les cartes ont la même taille, quel que soit le titre */}
                    <p className="line-clamp-2 h-[2.5em] text-[12.5px] font-bold leading-tight text-ink">{it.mangas?.title ?? "Série"}</p>
                    <div className="flex items-baseline justify-between gap-1.5 whitespace-nowrap">
                      <p className="nums truncate font-serif text-[16px] leading-none text-violet-deep">
                        +{it.amount} {unitLabel(it.unit, it.amount, true)}
                      </p>
                      <p className="nums shrink-0 text-[11px] font-semibold text-muted">
                        {it.unit === "chapter" ? "ch." : "t."} {it.end_value}
                      </p>
                    </div>
                  </Link>
                  {it.notes && <p className="line-clamp-2 text-[11.5px] italic leading-snug text-ink-2">« {it.notes} »</p>}
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <div className="min-w-0">{it.avgRating != null && <RatingTag value={it.avgRating} className="text-[11px]" />}</div>
                    <LikeStamp
                      count={likers.size}
                      liked={likers.has(userId)}
                      own={it.user_id === userId}
                      onToggle={() => toggleLike(it)}
                    />
                  </div>
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
