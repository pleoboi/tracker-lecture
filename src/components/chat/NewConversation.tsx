"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { AvatarImg } from "../ui";

export type Friend = { id: string; name: string; avatar: string | null; mutual: boolean };

/** Amis (abonnements réciproques) puis abonnements, pour démarrer une conversation. */
export function useFriends(me?: string, demo?: Friend[]) {
  const [friends, setFriends] = useState<Friend[] | null>(demo ?? null);
  useEffect(() => {
    if (demo || !me) return;
    let cancelled = false;
    (async () => {
      const [{ data: out }, { data: inc }] = await Promise.all([
        supabase.from("user_follows").select("following_id").eq("follower_id", me),
        supabase.from("user_follows").select("follower_id").eq("following_id", me),
      ]);
      const following = ((out ?? []) as { following_id: string }[]).map((f) => f.following_id);
      const followers = new Set(((inc ?? []) as { follower_id: string }[]).map((f) => f.follower_id));
      const ids = [...new Set([...following, ...followers])].filter((id) => id !== me);
      if (!ids.length) { if (!cancelled) setFriends([]); return; }
      const { data: profs } = await supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", ids);
      const list = ((profs ?? []) as { id: string; display_name: string | null; avatar_url: string | null }[])
        .map((p) => ({ id: p.id, name: p.display_name ?? "Membre", avatar: p.avatar_url, mutual: following.includes(p.id) && followers.has(p.id) }))
        .sort((a, b) => Number(b.mutual) - Number(a.mutual) || a.name.localeCompare(b.name, "fr"));
      if (!cancelled) setFriends(list);
    })();
    return () => { cancelled = true; };
  }, [me, demo]);
  return friends;
}

export default function NewConversation({ friends, onSelect }: { friends: Friend[] | null; onSelect: (f: Friend) => void }) {
  const [search, setSearch] = useState("");
  const shown = (friends ?? []).filter((f) => !search || f.name.toLowerCase().includes(search.toLowerCase()));
  const mutual = shown.filter((f) => f.mutual);
  const others = shown.filter((f) => !f.mutual);

  const row = (f: Friend) => (
    <li key={f.id}>
      <button onClick={() => onSelect(f)} className="flex w-full items-center gap-3 px-3.5 py-2 text-left hover:bg-card">
        <AvatarImg url={f.avatar} name={f.name} className="h-9 w-9 shrink-0 text-sm" />
        <span className="truncate text-[14px] font-semibold text-ink">{f.name}</span>
      </button>
    </li>
  );

  return (
    <div className="flex min-h-0 flex-col">
      <div className="px-3.5 pb-1 pt-3">
        <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un ami"
          className="w-full rounded-xl border border-line bg-input px-3 py-2 text-[13.5px] text-ink outline-none focus:border-violet" />
      </div>
      <div className="min-h-0 overflow-y-auto pb-2">
        {friends === null ? (
          <p className="py-6 text-center text-[12.5px] text-muted">Chargement…</p>
        ) : shown.length === 0 ? (
          <p className="px-6 py-6 text-center text-[12.5px] text-muted">
            {friends.length ? "Personne ne correspond." : "Abonne-toi à des membres pour leur écrire d'ici."}
          </p>
        ) : (
          <>
            {mutual.length > 0 && <p className="px-3.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted">Amis</p>}
            <ul>{mutual.map(row)}</ul>
            {others.length > 0 && <p className="px-3.5 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-muted">Abonnements et abonnés</p>}
            <ul>{others.map(row)}</ul>
          </>
        )}
      </div>
    </div>
  );
}
