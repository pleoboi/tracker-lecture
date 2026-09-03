"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/auth-context";
import MemberSectionHeader from "../../../../components/MemberSectionHeader";

export default function MemberListesPage() {
  const params = useParams();
  const { user } = useAuth();
  const memberId = params.id as string;
  const isOwn = user?.id === memberId;

  const [firstName, setFirstName] = useState("");
  const [lists, setLists] = useState<{ id: string; title: string; description: string | null; created_at: string; covers: (string | null)[]; count: number }[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [creatingList, setCreatingList] = useState(false);

  useEffect(() => {
    supabase.from("user_profiles").select("display_name").eq("id", memberId).single()
      .then(({ data }) => setFirstName(((data as { display_name?: string } | null)?.display_name ?? "").split(" ")[0]));
  }, [memberId]);

  const loadLists = useCallback(async () => {
    setListsLoading(true);
    const { data } = await supabase.from("book_lists").select("id, title, description, created_at").eq("user_id", memberId).order("created_at", { ascending: false });
    const rows = (data ?? []) as { id: string; title: string; description: string | null; created_at: string }[];
    const withCovers = await Promise.all(rows.map(async (l) => {
      const { data: items, count: totalCount } = await supabase.from("book_list_items").select("book_cover_url", { count: "exact" }).eq("list_id", l.id).order("position").limit(4);
      return { ...l, covers: ((items ?? []) as { book_cover_url: string | null }[]).map((i) => i.book_cover_url), count: totalCount ?? 0 };
    }));
    setLists(withCovers);
    setListsLoading(false);
  }, [memberId]);

  useEffect(() => { loadLists(); }, [loadLists]);

  return (
    <div className="animate-fadeIn flex flex-col gap-4 pt-4">
      <MemberSectionHeader memberId={memberId} firstName={firstName} title="Listes" />

      {isOwn && (
        <button
          onClick={() => { setNewListTitle(""); setNewListDesc(""); setShowCreateList(true); }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet py-3.5 text-[14px] font-bold text-cream"
        >
          + Nouvelle liste
        </button>
      )}
      {listsLoading ? (
        <div className="py-8 text-center text-xs text-muted">Chargement…</div>
      ) : lists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
          <p className="font-serif text-base text-ink">Aucune liste pour le moment.</p>
          {isOwn && <p className="mt-1 text-sm text-muted">Crée ta première liste thématique !</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {lists.map((l) => (
            <Link key={l.id} href={`/listes/${l.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-violet/40">
              {/* Mini covers */}
              <div className="flex shrink-0 gap-0.5">
                {[0, 1, 2, 3].map((i) => (
                  l.covers[i]
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img key={i} src={l.covers[i]!} alt="" className="h-12 w-8 rounded object-cover shadow-sm" />
                    : <div key={i} className="h-12 w-8 rounded bg-violet-soft" />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-[15px] font-semibold text-ink">{l.title}</p>
                {l.description && <p className="truncate text-[11px] text-muted">{l.description}</p>}
                <p className="text-[10px] text-muted">{l.count} livre{l.count !== 1 ? "s" : ""}</p>
              </div>
              <span className="shrink-0 text-muted">›</span>
            </Link>
          ))}
        </div>
      )}

      {/* Créer une liste */}
      {showCreateList && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 pt-4 pb-24 [touch-action:none]" onClick={() => setShowCreateList(false)}>
          <div className="animate-slideUp w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-semibold text-ink">Nouvelle liste</h3>
              <button onClick={() => setShowCreateList(false)} className="text-sm text-muted">✕</button>
            </div>
            <input
              type="text"
              placeholder="Titre de la liste"
              value={newListTitle}
              onChange={(e) => setNewListTitle(e.target.value)}
              className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet"
              autoFocus
            />
            <textarea
              rows={2}
              placeholder="Description (optionnelle)"
              value={newListDesc}
              onChange={(e) => setNewListDesc(e.target.value)}
              className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet resize-none"
            />
            <button
              disabled={!newListTitle.trim() || creatingList}
              onClick={async () => {
                if (!user?.id || !newListTitle.trim()) return;
                setCreatingList(true);
                await supabase.from("book_lists").insert({ user_id: user.id, title: newListTitle.trim(), description: newListDesc.trim() || null });
                setCreatingList(false);
                setShowCreateList(false);
                loadLists();
              }}
              className="w-full rounded-2xl bg-violet py-3.5 text-[14px] font-bold text-cream disabled:opacity-40"
            >
              {creatingList ? "Création…" : "Créer la liste"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
