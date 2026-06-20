"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import type { Book } from "../../lib/types";
import { Cover, AvatarImg } from "../../components/ui";
import AddToLibraryModal from "../../components/AddToLibraryModal";

interface Profile {
  id: string;
  display_name: string;
  avatar_url?: string | null;
}

interface BookInstance {
  book: Book;
  memberName: string;
  memberAvatar?: string | null;
}

interface UniqueBook {
  key: string;
  canonical: Book;
  instances: BookInstance[];
  avgRating: number | null;
  ratingCount: number;
}

function dedupeKey(b: Book) {
  return `${b.title.toLowerCase().trim()}__${(b.author || "").toLowerCase().trim()}`;
}

function StarRow({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[#c9a227]">{"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))}</span>
      <span className="text-sm font-semibold text-ink">{rating.toFixed(1).replace(".", ",")}</span>
      <span className="text-[11.5px] text-muted">— {count} avis</span>
    </div>
  );
}

export default function DecouvertePage() {
  const { user } = useAuth();
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, string>>(new Map());
  const [avatarMap, setAvatarMap] = useState<Map<string, string | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<UniqueBook | null>(null);
  const [addTarget, setAddTarget] = useState<Book | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [{ data: books }, { data: profiles }] = await Promise.all([
        supabase.from("books").select("*"),
        supabase.from("user_profiles").select("id, display_name, avatar_url"),
      ]);
      const pmap = new Map<string, string>();
      const amap = new Map<string, string | null>();
      ((profiles as Profile[]) || []).forEach((p) => {
        pmap.set(p.id, p.display_name);
        amap.set(p.id, p.avatar_url ?? null);
      });
      setAllBooks((books as Book[]) || []);
      setProfileMap(pmap);
      setAvatarMap(amap);
      setLoading(false);
    };
    load();
  }, []);

  const groups = useMemo<UniqueBook[]>(() => {
    const map = new Map<string, UniqueBook>();

    allBooks.forEach((book) => {
      const key = dedupeKey(book);
      const memberName = book.user_id ? (profileMap.get(book.user_id) ?? "Membre") : "Membre";
      const memberAvatar = book.user_id ? (avatarMap.get(book.user_id) ?? null) : null;
      const instance: BookInstance = { book, memberName, memberAvatar };

      const existing = map.get(key);
      if (existing) {
        existing.instances.push(instance);
        // Upgrade canonical if this instance has more data
        if (!existing.canonical.cover_url && book.cover_url) existing.canonical = book;
        if (!existing.canonical.summary && book.summary) existing.canonical = book;
      } else {
        map.set(key, { key, canonical: book, instances: [instance], avgRating: null, ratingCount: 0 });
      }
    });

    map.forEach((group) => {
      const rated = group.instances.filter((i) => (i.book.rating || 0) > 0);
      group.ratingCount = rated.length;
      group.avgRating =
        rated.length > 0
          ? rated.reduce((s, i) => s + (i.book.rating || 0), 0) / rated.length
          : null;
    });

    const q = query.toLowerCase().trim();
    return Array.from(map.values())
      .filter(
        (g) =>
          !q ||
          g.canonical.title.toLowerCase().includes(q) ||
          (g.canonical.author || "").toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const maxA = Math.max(...a.instances.map((i) => new Date(i.book.created_at).getTime()));
        const maxB = Math.max(...b.instances.map((i) => new Date(i.book.created_at).getTime()));
        return maxB - maxA;
      });
  }, [allBooks, profileMap, avatarMap, query]);

  return (
    <div className="animate-fadeIn flex flex-col gap-5 pt-4">
      <header>
        <h1 className="font-serif text-3xl font-black text-ink">Découverte</h1>
        <p className="mt-0.5 text-xs font-medium text-muted">
          {loading ? "…" : `${groups.length} livre${groups.length > 1 ? "s" : ""} dans le club`}
        </p>
      </header>

      {/* Barre de recherche */}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un titre ou un auteur…"
        className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-sm text-ink outline-none focus:border-violet"
      />

      {loading ? (
        <div className="py-20 text-center text-xs font-medium uppercase tracking-wider text-muted">
          Chargement…
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-10 text-center">
          <p className="font-serif text-base text-ink">Aucun livre trouvé.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <button
              key={g.key}
              onClick={() => setSelected(g)}
              className="flex items-start gap-3 rounded-2xl border border-line bg-card p-3 text-left transition-colors hover:border-violet/50"
            >
              <Cover
                id={g.canonical.id}
                title={g.canonical.title}
                coverUrl={g.canonical.cover_url}
                className="h-[84px] w-[58px] shrink-0"
                rounded="rounded-md"
              />
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="line-clamp-2 font-serif text-[14px] font-medium leading-snug text-ink">
                  {g.canonical.title}
                </p>
                <p className="mt-0.5 truncate text-[11.5px] text-muted">{g.canonical.author}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {g.avgRating != null ? (
                    <span className="text-xs font-semibold text-[#c9a227]">
                      ★ {g.avgRating.toFixed(1).replace(".", ",")}
                      <span className="font-normal text-muted"> ({g.ratingCount})</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted">Pas encore noté</span>
                  )}
                  {g.instances.length > 1 && (
                    <span className="rounded-md bg-violet-soft px-1.5 py-0.5 text-[10px] font-semibold text-violet-deep">
                      {g.instances.length} lecteurs
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Modal détail */}
      {selected && (
        <BookDetailModal
          group={selected}
          onClose={() => setSelected(null)}
          onAddToLibrary={(b) => { setSelected(null); setAddTarget(b); }}
          onBookUpdated={(bookId, updates) =>
            setAllBooks((prev) => prev.map((bk) => bk.id === bookId ? { ...bk, ...updates } : bk))
          }
        />
      )}

      {/* Toast succès */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 rounded-2xl bg-ink px-4 py-2.5 text-sm font-medium text-cream shadow-xl">
          {toast}
        </div>
      )}

      <AddToLibraryModal
        open={addTarget !== null}
        onClose={() => setAddTarget(null)}
        book={addTarget}
        onAdded={(msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); }}
      />
    </div>
  );
}

function BookDetailModal({
  group,
  onClose,
  onAddToLibrary,
  onBookUpdated,
}: {
  group: UniqueBook;
  onClose: () => void;
  onAddToLibrary: (b: Book) => void;
  onBookUpdated: (bookId: number, updates: Partial<Book>) => void;
}) {
  const [localBook, setLocalBook] = useState(group.canonical);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaDraft, setMetaDraft] = useState({
    title: group.canonical.title,
    author: group.canonical.author,
    coverUrl: group.canonical.cover_url || "",
    year: group.canonical.published_year ? String(group.canonical.published_year) : "",
    summary: group.canonical.summary || "",
  });
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  const b = localBook;

  const saveMeta = async () => {
    setSavingMeta(true);
    setMetaError(null);
    const updates = {
      title: metaDraft.title.trim() || b.title,
      author: metaDraft.author.trim() || b.author,
      cover_url: metaDraft.coverUrl.trim() || null,
      summary: metaDraft.summary.trim() || null,
      published_year: metaDraft.year ? Number(metaDraft.year) : null,
    };
    const { error } = await supabase.rpc("update_book_metadata", {
      p_book_id: b.id,
      p_title: updates.title,
      p_author: updates.author,
      p_cover_url: updates.cover_url,
      p_summary: updates.summary,
      p_year: updates.published_year,
    });
    if (error) {
      setMetaError(error.message);
      setSavingMeta(false);
      return;
    }
    setLocalBook({ ...b, ...updates });
    onBookUpdated(b.id, updates);
    setEditingMeta(false);
    setSavingMeta(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl bg-paper p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-start gap-4">
          <Cover
            id={b.id}
            title={b.title}
            coverUrl={b.cover_url}
            className="h-[110px] w-[76px] shrink-0"
            rounded="rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-xl font-black leading-snug text-ink">{b.title}</h2>
            <p className="mt-0.5 text-sm text-ink-2">{b.author}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {b.genre && (
                <span className="rounded-md bg-violet-soft px-2 py-0.5 text-[11px] font-medium text-violet-deep">
                  {b.genre}
                </span>
              )}
              {b.published_year && (
                <span className="rounded-md bg-[#f4f0e8] px-2 py-0.5 text-[11px] font-medium text-muted">
                  {b.published_year}
                </span>
              )}
              <span className="rounded-md bg-[#f4f0e8] px-2 py-0.5 text-[11px] font-medium text-muted">
                {b.pages} p.
              </span>
            </div>
            {group.avgRating != null && (
              <div className="mt-2">
                <StarRow rating={group.avgRating} count={group.ratingCount} />
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-sm text-muted"
          >
            ✕
          </button>
        </div>

        {/* Résumé */}
        {b.summary && !editingMeta && (
          <div className="mt-5">
            <h3 className="mb-1.5 font-serif text-[14px] font-semibold text-ink">Résumé</h3>
            <p className="text-[13px] leading-relaxed text-ink-2">{b.summary}</p>
          </div>
        )}

        {/* Édition des métadonnées */}
        {editingMeta ? (
          <div className="mt-5 flex flex-col gap-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Modifier les informations</p>
            <input
              value={metaDraft.coverUrl}
              onChange={(e) => setMetaDraft({ ...metaDraft, coverUrl: e.target.value })}
              placeholder="URL de la couverture (https://…)"
              className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-violet"
              autoFocus
            />
            <input
              value={metaDraft.title}
              onChange={(e) => setMetaDraft({ ...metaDraft, title: e.target.value })}
              placeholder="Titre"
              className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-violet"
            />
            <input
              value={metaDraft.author}
              onChange={(e) => setMetaDraft({ ...metaDraft, author: e.target.value })}
              placeholder="Auteur"
              className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-violet"
            />
            <input
              value={metaDraft.year}
              onChange={(e) => setMetaDraft({ ...metaDraft, year: e.target.value })}
              placeholder="Année de publication"
              type="number"
              className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-violet"
            />
            <textarea
              value={metaDraft.summary}
              onChange={(e) => setMetaDraft({ ...metaDraft, summary: e.target.value })}
              placeholder="Résumé…"
              rows={4}
              className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-violet"
            />
            {metaError && <p className="text-xs font-medium text-danger">{metaError}</p>}
            <div className="flex gap-2">
              <button
                onClick={saveMeta}
                disabled={savingMeta}
                className="flex-1 rounded-2xl bg-violet py-2.5 text-sm font-semibold text-cream disabled:opacity-50"
              >
                {savingMeta ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button
                onClick={() => { setEditingMeta(false); setMetaError(null); }}
                className="flex-1 rounded-2xl border border-line bg-card py-2.5 text-sm font-medium text-ink"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditingMeta(true)}
            className="mt-4 w-full text-center text-xs font-medium text-muted underline decoration-muted/40 underline-offset-2"
          >
            Modifier les informations
          </button>
        )}

        {/* CTA */}
        <button
          onClick={() => onAddToLibrary(b)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-violet/40 bg-violet-soft py-3 text-sm font-semibold text-violet-deep transition-colors hover:bg-violet hover:text-cream"
        >
          + Ajouter à mes lectures
        </button>

        {/* Avis des membres */}
        <div className="mt-5 flex flex-col gap-3">
          <h3 className="font-serif text-[14px] font-semibold text-ink">
            Avis des membres{" "}
            <span className="font-sans text-xs font-normal text-muted">
              ({group.instances.length} lecteur{group.instances.length > 1 ? "s" : ""})
            </span>
          </h3>
          {group.instances.map(({ book, memberName, memberAvatar }, i) => (
            <div
              key={i}
              className="flex flex-col gap-1.5 rounded-2xl border border-line bg-card p-3.5"
            >
              <div className="flex items-center gap-2">
                <AvatarImg url={memberAvatar} name={memberName} className="h-7 w-7 text-xs font-semibold" />
                <span className="text-[13px] font-semibold text-ink">{memberName}</span>
                <span className="ml-auto rounded-md bg-[#f4f0e8] px-2 py-0.5 text-[10.5px] font-medium text-muted">
                  {book.status === "completed" ? "Terminé" : "En cours"}
                </span>
              </div>
              {(book.rating || 0) > 0 && (
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span
                      key={s}
                      className="text-base leading-none"
                      style={{ color: s <= Math.round(book.rating!) ? "#c9a227" : "#dad2c2" }}
                    >
                      ★
                    </span>
                  ))}
                  <span className="ml-1 text-xs font-semibold text-ink">
                    {book.rating!.toFixed(1).replace(".", ",")}
                  </span>
                </div>
              )}
              {book.notes ? (
                <p className="font-serif text-[13px] italic leading-relaxed text-ink-2">
                  « {book.notes} »
                </p>
              ) : (book.rating || 0) === 0 ? (
                <p className="text-[12px] text-muted">Pas encore d'avis.</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
