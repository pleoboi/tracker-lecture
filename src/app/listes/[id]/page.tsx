"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import { Cover } from "../../../components/ui";

interface ListItem {
  id: string;
  book_title: string;
  book_author: string;
  book_cover_url: string | null;
  position: number;
  note: string | null;
}

interface BookList {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  ownerName: string;
  ownerAvatar: string | null;
}

export default function ListePage() {
  const { id } = useParams() as { id: string };
  const { user } = useAuth();
  const [list, setList] = useState<BookList | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add book modal
  const [showAdd, setShowAdd] = useState(false);
  const [myBooks, setMyBooks] = useState<{ id: number; title: string; author: string; cover_url: string | null }[]>([]);
  const [addSearch, setAddSearch] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addSelected, setAddSelected] = useState<{ title: string; author: string; cover_url: string | null } | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit list modal
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const load = useCallback(async () => {
    const { data: listData } = await supabase.from("book_lists").select("*").eq("id", id).single();
    if (!listData) { setLoading(false); return; }
    const { data: profile } = await supabase.from("user_profiles").select("display_name, avatar_url").eq("id", (listData as { user_id: string }).user_id).single();
    setList({ ...(listData as BookList), ownerName: (profile as { display_name: string } | null)?.display_name ?? "Membre", ownerAvatar: (profile as { avatar_url: string | null } | null)?.avatar_url ?? null });
    const { data: itemsData } = await supabase.from("book_list_items").select("*").eq("list_id", id).order("position").order("added_at");
    setItems((itemsData ?? []) as ListItem[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const isOwner = user?.id === list?.user_id;

  const openAdd = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("books").select("id, title, author, cover_url").eq("user_id", user.id).order("title");
    setMyBooks((data ?? []) as { id: number; title: string; author: string; cover_url: string | null }[]);
    setAddSelected(null);
    setAddSearch("");
    setAddNote("");
    setShowAdd(true);
  };

  const addItem = async () => {
    if (!addSelected || !user?.id) return;
    setSaving(true);
    await supabase.from("book_list_items").insert({
      list_id: id,
      book_title: addSelected.title,
      book_author: addSelected.author,
      book_cover_url: addSelected.cover_url,
      position: items.length,
      note: addNote.trim() || null,
    });
    await load();
    setSaving(false);
    setShowAdd(false);
  };

  const removeItem = async (itemId: string) => {
    await supabase.from("book_list_items").delete().eq("id", itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const saveEdit = async () => {
    if (!editTitle.trim()) return;
    await supabase.from("book_lists").update({ title: editTitle.trim(), description: editDesc.trim() || null }).eq("id", id);
    setList((prev) => prev ? { ...prev, title: editTitle.trim(), description: editDesc.trim() || null } : prev);
    setShowEdit(false);
  };

  const filteredBooks = myBooks.filter(
    (b) => !addSearch || b.title.toLowerCase().includes(addSearch.toLowerCase()) || b.author.toLowerCase().includes(addSearch.toLowerCase())
  );

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-violet border-t-transparent" />
    </div>
  );

  if (!list) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-muted">Liste introuvable.</p>
      <Link href="/" className="text-sm font-medium text-violet-deep">Retour</Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-2xl font-black text-ink">{list.title}</h1>
            {list.description && <p className="mt-1 text-sm text-muted">{list.description}</p>}
          </div>
          {isOwner && (
            <button
              onClick={() => { setEditTitle(list.title); setEditDesc(list.description ?? ""); setShowEdit(true); }}
              className="shrink-0 rounded-xl border border-line bg-card px-3 py-1.5 text-xs font-medium text-muted"
            >
              Modifier
            </button>
          )}
        </div>
        <Link href={`/membre/${list.user_id}`} className="flex items-center gap-2">
          <span className="text-[12px] text-muted">
            Liste de <span className="font-semibold text-ink">{list.ownerName}</span> · {items.length} livre{items.length !== 1 ? "s" : ""}
          </span>
        </Link>
      </div>

      {/* Livres */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-card py-12 text-center">
          <p className="text-sm text-muted">Aucun livre dans cette liste.</p>
          {isOwner && (
            <button onClick={openAdd} className="rounded-xl bg-violet px-4 py-2 text-sm font-bold text-cream">
              Ajouter un livre
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item, idx) => (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3">
              <span className="w-5 shrink-0 text-center font-serif text-sm font-bold text-muted">{idx + 1}</span>
              {item.book_cover_url
                ? <img src={item.book_cover_url} alt="" className="h-14 w-10 shrink-0 rounded-lg object-cover shadow" />
                : <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-soft text-[9px] text-violet-deep font-medium text-center px-1">{item.book_title.slice(0, 20)}</div>
              }
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-[14px] font-semibold text-ink">{item.book_title}</p>
                <p className="truncate text-[11px] text-muted">{item.book_author}</p>
                {item.note && <p className="mt-1 line-clamp-2 text-[11.5px] italic text-ink-2">&ldquo;{item.note}&rdquo;</p>}
              </div>
              {isOwner && (
                <button onClick={() => removeItem(item.id)} className="shrink-0 text-xs text-muted hover:text-danger">✕</button>
              )}
            </div>
          ))}
          {isOwner && (
            <button onClick={openAdd} className="mt-1 w-full rounded-2xl border border-dashed border-violet/40 py-3 text-sm font-semibold text-violet-deep hover:bg-violet-soft">
              + Ajouter un livre
            </button>
          )}
        </div>
      )}

      {/* Modal ajout livre */}
      {showAdd && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 md:items-center" onClick={() => setShowAdd(false)}>
          <div className="animate-slideUp w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-4 max-h-[85dvh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-semibold text-ink">Ajouter un livre</h3>
              <button onClick={() => setShowAdd(false)} className="text-sm text-muted">✕</button>
            </div>
            <input
              type="text"
              placeholder="Chercher dans ta bibliothèque…"
              value={addSearch}
              onChange={(e) => { setAddSearch(e.target.value); if (addSelected) setAddSelected(null); }}
              className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet"
              autoFocus
            />
            {!addSelected && (
              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-48">
                {filteredBooks.slice(0, 20).map((b) => (
                  <button key={b.id} onClick={() => setAddSelected(b)} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left hover:border-violet/40 hover:bg-violet-soft">
                    {b.cover_url ? <img src={b.cover_url} alt="" className="h-10 w-7 shrink-0 rounded object-cover" /> : <div className="h-10 w-7 shrink-0 rounded bg-violet-soft" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink">{b.title}</p>
                      <p className="truncate text-[11px] text-muted">{b.author}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {addSelected && (
              <>
                <div className="flex items-center gap-3 rounded-xl border border-violet/40 bg-violet-soft px-3 py-2.5">
                  {addSelected.cover_url ? <img src={addSelected.cover_url} alt="" className="h-12 w-8 shrink-0 rounded object-cover shadow" /> : <div className="h-12 w-8 shrink-0 rounded bg-violet/20" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink">{addSelected.title}</p>
                    <p className="truncate text-[11px] text-muted">{addSelected.author}</p>
                  </div>
                  <button onClick={() => setAddSelected(null)} className="shrink-0 text-xs text-muted">✕</button>
                </div>
                <textarea rows={2} placeholder="Note sur ce livre (optionnel)" value={addNote} onChange={(e) => setAddNote(e.target.value)} className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet resize-none" />
              </>
            )}
            <button disabled={!addSelected || saving} onClick={addItem} className="w-full rounded-2xl bg-violet py-3.5 text-[14px] font-bold text-cream disabled:opacity-40">
              {saving ? "Ajout…" : "Ajouter à la liste"}
            </button>
          </div>
        </div>
      )}

      {/* Modal édition liste */}
      {showEdit && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 md:items-center" onClick={() => setShowEdit(false)}>
          <div className="animate-slideUp w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-semibold text-ink">Modifier la liste</h3>
              <button onClick={() => setShowEdit(false)} className="text-sm text-muted">✕</button>
            </div>
            <input type="text" placeholder="Titre de la liste" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet" />
            <textarea rows={2} placeholder="Description (optionnelle)" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet resize-none" />
            <button disabled={!editTitle.trim()} onClick={saveEdit} className="w-full rounded-2xl bg-violet py-3.5 text-[14px] font-bold text-cream disabled:opacity-40">
              Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
