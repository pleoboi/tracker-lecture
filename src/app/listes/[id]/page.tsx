"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";

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

interface MyBook {
  id: number;
  title: string;
  author: string;
  cover_url: string | null;
  genre: string | null;
  date_read: string | null;
  rating: number | null;
  status: string;
}

type SortKey = "title" | "date_read" | "rating";

export default function ListePage() {
  const { id } = useParams() as { id: string };
  const { user } = useAuth();
  const [list, setList] = useState<BookList | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add modal — multi-select
  const [showAdd, setShowAdd] = useState(false);
  const [myBooks, setMyBooks] = useState<MyBook[]>([]);
  const [addSearch, setAddSearch] = useState("");
  const [addGenre, setAddGenre] = useState("Tous");
  const [addSort, setAddSort] = useState<SortKey>("date_read");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
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

  // Titres déjà dans la liste (pour les griser)
  const alreadyInList = useMemo(() => new Set(items.map((i) => i.book_title.toLowerCase())), [items]);

  const openAdd = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("books")
      .select("id, title, author, cover_url, genre, date_read, rating, status")
      .eq("user_id", user.id)
      .order("title");
    setMyBooks((data ?? []) as MyBook[]);
    setSelectedIds(new Set());
    setAddSearch("");
    setAddGenre("Tous");
    setAddSort("date_read");
    setShowAdd(true);
  };

  // Genres uniques extraits de la bibliothèque
  const allGenres = useMemo(() => {
    const set = new Set<string>();
    myBooks.forEach((b) => {
      if (b.genre) b.genre.split(",").map((g) => g.trim()).filter(Boolean).forEach((g) => set.add(g));
    });
    return ["Tous", ...Array.from(set).sort()];
  }, [myBooks]);

  // Filtrage + tri
  const filteredBooks = useMemo(() => {
    let result = myBooks.filter((b) => {
      const matchSearch = !addSearch || b.title.toLowerCase().includes(addSearch.toLowerCase()) || b.author.toLowerCase().includes(addSearch.toLowerCase());
      const matchGenre = addGenre === "Tous" || (b.genre ?? "").split(",").map((g) => g.trim()).includes(addGenre);
      return matchSearch && matchGenre;
    });
    result = [...result].sort((a, b) => {
      if (addSort === "title") return a.title.localeCompare(b.title, "fr");
      if (addSort === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
      if (addSort === "date_read") {
        const da = a.date_read ?? a.status === "reading" ? "9999" : "0000";
        const db = b.date_read ?? b.status === "reading" ? "9999" : "0000";
        return db.localeCompare(da);
      }
      return 0;
    });
    return result;
  }, [myBooks, addSearch, addGenre, addSort]);

  const toggleSelect = (bookId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  };

  const addItems = async () => {
    if (!selectedIds.size || !user?.id) return;
    setSaving(true);
    const toInsert = myBooks
      .filter((b) => selectedIds.has(b.id))
      .map((b, i) => ({
        list_id: id,
        book_title: b.title,
        book_author: b.author,
        book_cover_url: b.cover_url,
        position: items.length + i,
      }));
    await supabase.from("book_list_items").insert(toInsert);
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
      {/* Retour */}
      {list.user_id && (
        <Link href={`/membre/${list.user_id}`} className="mb-4 flex w-fit items-center gap-1.5 text-[12px] font-medium text-muted hover:text-ink">
          ← Retour au profil
        </Link>
      )}

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
        <span className="text-[12px] text-muted">
          Liste de <Link href={`/membre/${list.user_id}`} className="font-semibold text-ink">{list.ownerName}</Link> · {items.length} livre{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Livres */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-card py-12 text-center">
          <p className="text-sm text-muted">Aucun livre dans cette liste.</p>
          {isOwner && (
            <button onClick={openAdd} className="rounded-xl bg-violet px-4 py-2 text-sm font-bold text-cream">
              Ajouter des livres
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
              + Ajouter des livres
            </button>
          )}
        </div>
      )}

      {/* ── Modal ajout multi-sélection ── */}
      {showAdd && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 pt-4 pb-24 [touch-action:none]" onClick={() => setShowAdd(false)}>
          <div className="animate-slideUp w-full max-w-sm rounded-2xl bg-card flex flex-col max-h-[90dvh]" onClick={(e) => e.stopPropagation()}>

            {/* Header fixe */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="font-serif text-base font-semibold text-ink">Ajouter des livres</h3>
              <button onClick={() => setShowAdd(false)} className="text-sm text-muted">✕</button>
            </div>

            {/* Recherche */}
            <div className="px-5 pb-2">
              <input
                type="text"
                placeholder="Rechercher…"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet"
                autoFocus
              />
            </div>

            {/* Filtres genre */}
            <div className="flex gap-2 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {allGenres.map((g) => (
                <button
                  key={g}
                  onClick={() => setAddGenre(g)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${addGenre === g ? "bg-violet text-cream" : "bg-card border border-line text-muted"}`}
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Tri */}
            <div className="flex gap-2 px-5 pb-3">
              {([
                { key: "date_read", label: "Date de lecture" },
                { key: "rating", label: "Note" },
                { key: "title", label: "Titre" },
              ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setAddSort(key)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-colors ${addSort === key ? "bg-violet-soft text-violet-deep" : "text-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Liste scrollable */}
            <div className="flex-1 overflow-y-auto px-5 flex flex-col gap-1.5 pb-3">
              {filteredBooks.length === 0 && (
                <p className="py-6 text-center text-sm text-muted">Aucun livre trouvé.</p>
              )}
              {filteredBooks.map((b) => {
                const inList = alreadyInList.has(b.title.toLowerCase());
                const checked = selectedIds.has(b.id);
                return (
                  <button
                    key={b.id}
                    onClick={() => !inList && toggleSelect(b.id)}
                    disabled={inList}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      inList ? "opacity-40 cursor-not-allowed border-line" :
                      checked ? "border-violet bg-violet-soft" : "border-line hover:border-violet/40"
                    }`}
                  >
                    {/* Checkbox */}
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${checked ? "border-violet bg-violet text-cream" : "border-line bg-card"}`}>
                      {checked && <span className="text-[11px] font-bold">✓</span>}
                    </div>
                    {b.cover_url
                      ? <img src={b.cover_url} alt="" className="h-11 w-7 shrink-0 rounded object-cover" />
                      : <div className="h-11 w-7 shrink-0 rounded bg-violet-soft" />
                    }
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink">{b.title}</p>
                      <p className="truncate text-[11px] text-muted">{b.author}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {(b.rating ?? 0) > 0 && <span className="text-[10px] font-bold text-gold">★ {b.rating!.toFixed(1)}</span>}
                        {b.date_read && <span className="text-[10px] text-muted">{new Date(b.date_read).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}</span>}
                        {inList && <span className="text-[10px] font-semibold text-muted">déjà dans la liste</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer fixe */}
            <div className="border-t border-line px-5 py-4">
              <button
                disabled={selectedIds.size === 0 || saving}
                onClick={addItems}
                className="w-full rounded-2xl bg-violet py-3.5 text-[14px] font-bold text-cream disabled:opacity-40"
              >
                {saving ? "Ajout…" : selectedIds.size === 0 ? "Sélectionne des livres" : `Ajouter ${selectedIds.size} livre${selectedIds.size > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal édition liste */}
      {showEdit && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 pt-4 pb-24 [touch-action:none]" onClick={() => setShowEdit(false)}>
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
