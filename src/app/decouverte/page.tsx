"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import type { Book } from "../../lib/types";
import { Cover, AvatarImg } from "../../components/ui";
import AddToLibraryModal, { type BookRef } from "../../components/AddToLibraryModal";
import { searchBooks, type BookSuggestion } from "../../lib/googleBooks";

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

// Articles à ignorer dans la normalisation des titres (FR + EN)
const ARTICLES = new Set([
  "le", "la", "les", "l", "un", "une", "des", "du", "de",
  "the", "a", "an",
]);

// Fingerprint insensible à la langue : nom de famille + 4 premiers mots significatifs du titre
function fuzzyKey(title: string, author: string): string {
  const surname = (author || "")
    .toLowerCase()
    .replace(/,/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .pop() ?? "";
  const normTitle = title
    .toLowerCase()
    .replace(/[''"""«»\-—–:,!?.()[\]]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !ARTICLES.has(w))
    .slice(0, 4)
    .join(" ");
  return `${surname}_${normTitle}`;
}

// Traduit les genres français vers des requêtes Google Books plus efficaces
const GENRE_TO_QUERY: Record<string, string> = {
  "Roman": "literary fiction bestseller",
  "Thriller": "thriller suspense crime",
  "Policier": "detective mystery crime",
  "Science-Fiction": "science fiction",
  "Fantasy": "fantasy magic",
  "Biographie": "biography autobiography",
  "Témoignage": "memoir true story",
  "Histoire": "history historical",
  "Essai": "essays nonfiction",
  "Poésie": "poetry",
  "BD / Roman graphique": "graphic novel comics",
  "Manga": "manga japanese",
  "Développement personnel": "self-help personal development",
  "Science": "popular science",
  "Psychologie": "psychology",
  "Philosophie": "philosophy",
  "Aventure": "adventure",
  "Romance": "romance",
  "Humour": "humor comedy satire",
  "Jeunesse": "young adult fiction",
  "Économie": "economics business",
  "Sciences humaines": "sociology anthropology",
  "Sciences politiques": "political history",
};

// Pool de découverte — genres variés pour diversifier les suggestions
const DISCOVERY_POOL = [
  "literary fiction contemporary",
  "thriller psychological suspense",
  "mystery detective crime",
  "science fiction space",
  "fantasy epic adventure",
  "historical fiction",
  "biography memoir inspiring",
  "popular science discovery",
  "psychology human behavior",
  "philosophy ethics",
  "graphic novel award",
  "romance contemporary",
  "poetry modern",
  "travel adventure memoir",
  "economics inequality",
  "political history",
  "horror supernatural",
  "magical realism",
  "young adult coming of age",
  "humor satire",
  "essays cultural",
  "spy thriller",
  "dystopian fiction",
  "true crime",
];

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

  // Recommandations personnalisées
  const [recommendations, setRecommendations] = useState<BookSuggestion[]>([]);
  const [selectedReco, setSelectedReco] = useState<BookSuggestion | null>(null);
  const [addFromReco, setAddFromReco] = useState<{ ref: BookRef; googleId: string } | null>(null);
  const recoLoadedRef = useRef(false);

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

  // Calcul + chargement des recommandations (une seule fois, après chargement des livres)
  useEffect(() => {
    if (!user?.id || allBooks.length === 0 || recoLoadedRef.current) return;
    recoLoadedRef.current = true;

    // Seulement les livres de l'utilisateur connecté
    const myBooks = allBooks.filter((b) => b.user_id === user.id);
    if (myBooks.length === 0) return;

    const loadReco = async () => {
      const source = myBooks.filter((b) => (b.rating || 0) >= 4);
      const pool = source.length > 0 ? source : myBooks.slice(0, 8);

      const genreCount = new Map<string, number>();
      const authorCount = new Map<string, number>();
      pool.forEach((b) => {
        if (b.genre) genreCount.set(b.genre, (genreCount.get(b.genre) || 0) + 1);
        if (b.author) authorCount.set(b.author, (authorCount.get(b.author) || 0) + 1);
      });
      const topGenre = [...genreCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const topAuthor = [...authorCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

      // Double filtre d'exclusion : exact (même langue) + fuzzy (même livre, autre langue)
      const existingExact = new Set(myBooks.map((b) => dedupeKey(b)));
      const existingFuzzy = new Set(myBooks.map((b) => fuzzyKey(b.title, b.author || "")));

      // 3-4 requêtes : genre perso + auteur perso + 2 genres de découverte aléatoires
      const queries: string[] = [];

      if (topGenre) queries.push(GENRE_TO_QUERY[topGenre] || topGenre);

      if (topAuthor) {
        const lastName = topAuthor.split(" ").pop() || topAuthor;
        queries.push(`inauthor:"${lastName}"`);
      }

      // Genres de découverte — rotation aléatoire, hors des goûts connus
      const knownQueries = new Set(
        [...genreCount.keys()].map((g) => (GENRE_TO_QUERY[g] || g).toLowerCase())
      );
      const freshPool = DISCOVERY_POOL.filter((q) => !knownQueries.has(q.toLowerCase()));
      if (freshPool.length > 0) {
        const i1 = Math.floor(Math.random() * freshPool.length);
        queries.push(freshPool[i1]);
        const i2 = (i1 + Math.floor(freshPool.length / 2)) % freshPool.length;
        if (i2 !== i1) queries.push(freshPool[i2]);
      }

      if (queries.length === 0) return;

      try {
        const results = await Promise.allSettled(queries.map((q) => searchBooks(q)));
        const seen = new Set<string>();
        const slots: BookSuggestion[] = [];

        // Max 2 résultats par requête pour diversifier les sources
        results.forEach((r) => {
          if (r.status !== "fulfilled") return;
          let taken = 0;
          for (const s of r.value) {
            if (taken >= 2) break;
            const eKey = dedupeKey({ title: s.title, author: s.author } as Book);
            const fKey = fuzzyKey(s.title, s.author);
            if (
              !seen.has(eKey) &&
              !existingExact.has(eKey) &&
              !existingFuzzy.has(fKey) &&
              s.coverUrl
            ) {
              seen.add(eKey);
              slots.push(s);
              taken++;
            }
          }
        });

        setRecommendations(slots.slice(0, 4));
      } catch {
        // Silencieux : l'absence de recommandations n'est pas bloquante
      }
    };

    loadReco();
  }, [allBooks, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

      {/* Recommandé pour toi */}
      {recommendations.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-serif text-lg font-medium text-ink">Recommandé pour toi</h2>
            <p className="text-[11px] text-muted">Basé sur tes lectures préférées</p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
            {recommendations.map((s) => (
              <button
                key={s.googleId}
                onClick={() => setSelectedReco(s)}
                className="flex w-36 shrink-0 flex-col gap-2 rounded-2xl border border-violet/20 bg-violet-soft p-3 text-left transition-colors hover:border-violet/50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.coverUrl!}
                  alt={s.title}
                  className="h-[104px] w-full rounded-lg object-cover shadow-sm"
                />
                <div className="flex-1">
                  <p className="line-clamp-2 text-[11.5px] font-semibold leading-tight text-ink">
                    {s.title}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-muted">{s.author}</p>
                  {s.genre && (
                    <span className="mt-1 inline-block rounded-md bg-violet/10 px-1.5 py-0.5 text-[9.5px] font-medium text-violet-deep">
                      {s.genre}
                    </span>
                  )}
                </div>
                <span className="w-full rounded-xl bg-violet py-1.5 text-center text-[11px] font-semibold text-cream">
                  Voir + Ajouter
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

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

      {/* Modal détail livre du club */}
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

      {/* Modal détail recommandation */}
      {selectedReco && (
        <RecoDetailModal
          suggestion={selectedReco}
          onClose={() => setSelectedReco(null)}
          onAddToLibrary={(ref) => {
            setAddFromReco({ ref, googleId: selectedReco.googleId });
            setSelectedReco(null);
          }}
        />
      )}

      {/* Toast succès */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 rounded-2xl bg-ink px-4 py-2.5 text-sm font-medium text-cream shadow-xl">
          {toast}
        </div>
      )}

      {/* AddToLibraryModal pour les livres du club */}
      <AddToLibraryModal
        open={addTarget !== null}
        onClose={() => setAddTarget(null)}
        book={addTarget}
        onAdded={(msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); }}
      />

      {/* AddToLibraryModal pour les recommandations */}
      <AddToLibraryModal
        open={addFromReco !== null}
        onClose={() => setAddFromReco(null)}
        book={addFromReco?.ref ?? null}
        onAdded={(msg) => {
          setRecommendations((prev) => prev.filter((r) => r.googleId !== addFromReco?.googleId));
          setAddFromReco(null);
          setToast(msg);
          setTimeout(() => setToast(null), 3500);
        }}
      />
    </div>
  );
}

// ─── Modale détail d'une recommandation Google Books ───────────────────────
function RecoDetailModal({
  suggestion: s,
  onClose,
  onAddToLibrary,
}: {
  suggestion: BookSuggestion;
  onClose: () => void;
  onAddToLibrary: (ref: BookRef) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl bg-paper p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-start gap-4">
          {s.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.coverUrl}
              alt={s.title}
              className="h-[136px] w-[92px] shrink-0 rounded-xl object-cover shadow-md"
            />
          ) : (
            <div className="flex h-[136px] w-[92px] shrink-0 items-center justify-center rounded-xl bg-violet/15 text-4xl">
              📚
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-xl font-black leading-snug text-ink">{s.title}</h2>
            <p className="mt-0.5 text-sm text-ink-2">{s.author}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {s.genre && (
                <span className="rounded-md bg-violet-soft px-2 py-0.5 text-[11px] font-medium text-violet-deep">
                  {s.genre}
                </span>
              )}
              {s.year && (
                <span className="rounded-md bg-[#f4f0e8] px-2 py-0.5 text-[11px] font-medium text-muted">
                  {s.year}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-sm text-muted hover:bg-card"
          >
            ✕
          </button>
        </div>

        {/* Résumé */}
        <div className="mt-5">
          <h3 className="mb-2 font-serif text-[14px] font-semibold text-ink">Résumé</h3>
          {s.summary ? (
            <div className="flex flex-col gap-2.5">
              {s.summary.split(/\n\n+/).map((para, i) => (
                <p key={i} className="text-[13px] leading-relaxed text-ink-2">{para.trim()}</p>
              ))}
            </div>
          ) : (
            <p className="text-[13px] italic text-muted">Aucun résumé disponible pour ce livre.</p>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={() =>
            onAddToLibrary({
              title: s.title,
              author: s.author,
              pages: 0,
              cover_url: s.coverUrl,
              genre: s.genre,
              published_year: s.year,
              summary: s.summary,
            })
          }
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-violet/40 bg-violet-soft py-3 text-sm font-semibold text-violet-deep transition-colors hover:bg-violet hover:text-cream"
        >
          + Ajouter à mes lectures
        </button>
      </div>
    </div>
  );
}

// ─── Modale détail d'un livre du club ───────────────────────────────────────
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
            <h3 className="mb-2 font-serif text-[14px] font-semibold text-ink">Résumé</h3>
            <div className="flex flex-col gap-2.5">
              {b.summary.split(/\n\n+/).map((para, i) => (
                <p key={i} className="text-[13px] leading-relaxed text-ink-2">{para.trim()}</p>
              ))}
            </div>
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
