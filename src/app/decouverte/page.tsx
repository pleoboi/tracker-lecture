"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import type { Book } from "../../lib/types";
import { Cover } from "../../components/ui";
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

const ARTICLES = new Set([
  "le", "la", "les", "l", "un", "une", "des", "du", "de",
  "the", "a", "an",
]);

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

function toParas(text: string): string[] {
  if (/\n\n/.test(text)) {
    return text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  }
  const sentences = text.split(/(?<=[.!?…])\s+/);
  const paras: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (buf.length + s.length > 380 && buf.length > 0) {
      paras.push(buf.trim());
      buf = s;
    } else {
      buf += (buf ? " " : "") + s;
    }
  }
  if (buf.trim()) paras.push(buf.trim());
  return paras.length > 0 ? paras : [text];
}

const GENRE_TO_QUERY: Record<string, string> = {
  "Roman": "literary fiction bestseller",
  "Fiction": "fiction novel",
  "Non-Fiction": "nonfiction",
  "Classique": "classic literature",
  "Nouvelle": "short stories novella",
  "Thriller": "thriller suspense crime",
  "Policier": "detective mystery crime",
  "Crime": "crime true crime",
  "Mystère": "mystery suspense",
  "Science-Fiction": "science fiction",
  "Fantasy": "fantasy magic",
  "Biographie": "biography autobiography",
  "Témoignage": "memoir true story",
  "Histoire": "history historical",
  "Essai": "essays nonfiction",
  "Poésie": "poetry",
  "BD / Roman graphique": "graphic novel comics",
  "Manga": "manga japanese",
  "Comics": "comics superhero graphic",
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
  "Sport": "sports biography",
  "Cinéma": "cinema film movies",
  "Musique": "music biography",
  "Drame": "drama literary fiction",
  "Suspense": "suspense psychological thriller",
  "Théâtre": "theater plays drama",
};

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

export default function DecouvertePage() {
  const { user } = useAuth();
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [profileMap, setProfileMap] = useState<Map<string, string>>(new Map());
  const [avatarMap, setAvatarMap] = useState<Map<string, string | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [showGenrePanel, setShowGenrePanel] = useState(false);

  // Recommandations personnalisées
  const [recommendations, setRecommendations] = useState<BookSuggestion[]>([]);
  const [selectedReco, setSelectedReco] = useState<BookSuggestion | null>(null);
  const [addFromReco, setAddFromReco] = useState<{ ref: BookRef; googleId: string } | null>(null);
  const recoLoadedRef = useRef(false);

  // Résultats web (fallback Google Books pour la recherche)
  const [webResults, setWebResults] = useState<BookSuggestion[]>([]);
  const [webLoading, setWebLoading] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);
  const [webTarget, setWebTarget] = useState<BookRef | null>(null);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());

  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  const quickAddBook = async (r: BookSuggestion, status: "to-read" | "completed") => {
    if (!user) return;
    const { data: existing } = await supabase
      .from("books").select("id").eq("user_id", user.id).ilike("title", r.title).limit(1);
    if (existing && existing.length > 0) {
      setToast("Ce livre est déjà dans ta bibliothèque.");
      setTimeout(() => setToast(null), 3000);
      return;
    }
    const { error } = await supabase.from("books").insert({
      title: r.title,
      author: r.author || "Auteur inconnu",
      pages: 0,
      progress: 0,
      status,
      cover_url: r.coverUrl ?? null,
      genre: r.genre ?? null,
      published_year: r.year ?? null,
      summary: r.summary ?? null,
      rating: 0,
      user_id: user.id,
    });
    if (!error) {
      if (status === "to-read") {
        setWishlistIds((prev) => new Set([...prev, r.googleId]));
        setToast(`« ${r.title} » ajouté à ta liste Envie de lire.`);
      } else {
        setCompletedIds((prev) => new Set([...prev, r.googleId]));
        setToast(`« ${r.title} » ajouté à tes livres terminés.`);
      }
      setTimeout(() => setToast(null), 3500);
    }
  };

  const addToWishlist = (r: BookSuggestion) => quickAddBook(r, "to-read");

  const loadBooks = useCallback(async () => {
    try {
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
    } catch { /* réseau défaillant — continuer sans données */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  // Recommandations (une seule fois)
  useEffect(() => {
    if (!user?.id || allBooks.length === 0 || recoLoadedRef.current) return;
    recoLoadedRef.current = true;

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

      const existingExact = new Set(myBooks.map((b) => dedupeKey(b)));
      const existingFuzzy = new Set(myBooks.map((b) => fuzzyKey(b.title, b.author || "")));

      const queries: string[] = [];
      if (topGenre) queries.push(GENRE_TO_QUERY[topGenre] || topGenre);
      if (topAuthor) {
        const lastName = topAuthor.split(" ").pop() || topAuthor;
        queries.push(`inauthor:"${lastName}"`);
      }

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
      } catch { /* silencieux */ }
    };

    loadReco();
  }, [allBooks, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recherche web fallback (debounced, déclenché quand query >= 2 chars)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setWebResults([]);
      setWebError(null);
      setWebLoading(false);
      return;
    }
    setWebLoading(true);
    setWebError(null);
    const timer = setTimeout(async () => {
      try {
        const results = await searchBooks(q);
        const existingKeys = new Set(allBooks.map((b) => dedupeKey(b)));
        const fresh = results.filter(
          (r) => !existingKeys.has(dedupeKey({ title: r.title, author: r.author } as Book))
        );
        setWebResults(fresh.slice(0, 10));
      } catch (err: unknown) {
        setWebResults([]);
        const msg = err instanceof Error ? err.message : "";
        if (/quota|429/i.test(msg)) {
          setWebError("Quota Google Books atteint — configure la clé API sur Vercel pour débloquer tous les utilisateurs.");
        } else if (msg) {
          setWebError("Recherche web indisponible : " + msg);
        } else {
          setWebError("Recherche web indisponible.");
        }
      } finally {
        setWebLoading(false);
      }
    }, 600);
    return () => { clearTimeout(timer); };
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

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
      .filter((g) => {
        if (q && !g.canonical.title.toLowerCase().includes(q) && !(g.canonical.author || "").toLowerCase().includes(q)) return false;
        if (selectedGenres.length > 0) {
          const match = selectedGenres.some((sg) =>
            g.instances.some((inst) => {
              const bookGenres = (inst.book.genre || "")
                .split(",")
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean);
              if (bookGenres.length === 0) return false;
              const sgLower = sg.toLowerCase();
              return bookGenres.some(
                (bg) => bg === sgLower || bg.includes(sgLower) || sgLower.includes(bg)
              );
            })
          );
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const maxA = Math.max(...a.instances.map((i) => new Date(i.book.created_at).getTime()));
        const maxB = Math.max(...b.instances.map((i) => new Date(i.book.created_at).getTime()));
        return maxB - maxA;
      });
  }, [allBooks, profileMap, avatarMap, query, selectedGenres]);

  const showWebSection = query.trim().length >= 2;

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
          {/* Hauteur fixe sur le conteneur = même valeur que la carte → overflow-x-auto ne clippe plus le bas */}
          <div className="h-[252px] overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex h-full gap-3 pr-1">
              {recommendations.map((s) => (
                <button
                  key={s.googleId}
                  onClick={() => setSelectedReco(s)}
                  className="flex h-full w-36 shrink-0 flex-col gap-2 rounded-2xl border border-violet/20 bg-violet-soft p-3 text-left transition-colors hover:border-violet/50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.coverUrl!}
                    alt={s.title}
                    className="h-[104px] w-full shrink-0 rounded-lg object-cover shadow-sm"
                  />
                  <div className="flex min-h-0 flex-1 flex-col">
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
                  <span className="mt-auto w-full shrink-0 rounded-xl bg-violet py-1.5 text-center text-[11px] font-semibold text-cream">
                    Voir + Ajouter
                  </span>
                </button>
              ))}
            </div>
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

      {/* Filtres genres */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setShowGenrePanel((v) => !v)}
          className="flex items-center gap-2 self-start rounded-xl border border-line bg-card px-3.5 py-2 text-[12.5px] font-medium text-muted transition-colors hover:border-violet/40 hover:text-violet-deep"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2M9 16h6" />
          </svg>
          Filtrer par genre
          {selectedGenres.length > 0 && (
            <span className="ml-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-violet px-1 text-[9.5px] font-bold text-cream">
              {selectedGenres.length}
            </span>
          )}
          <span className="text-xs">{showGenrePanel ? "▾" : "▸"}</span>
        </button>

        {showGenrePanel && (
          <div className="rounded-2xl border border-line bg-card p-3.5">
            <div className="flex flex-wrap gap-2">
              {Object.keys(GENRE_TO_QUERY).map((genre) => {
                const active = selectedGenres.includes(genre);
                return (
                  <label
                    key={genre}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                      active
                        ? "border-violet bg-violet text-cream"
                        : "border-line bg-paper text-ink hover:border-violet/40 hover:text-violet-deep"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      className="sr-only"
                      onChange={() =>
                        setSelectedGenres((prev) =>
                          active ? prev.filter((g) => g !== genre) : [...prev, genre]
                        )
                      }
                    />
                    {genre}
                  </label>
                );
              })}
            </div>
            {selectedGenres.length > 0 && (
              <button
                onClick={() => setSelectedGenres([])}
                className="mt-3 text-[11px] font-medium text-violet-deep underline underline-offset-2"
              >
                Effacer les filtres
              </button>
            )}
          </div>
        )}

        {selectedGenres.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedGenres.map((g) => (
              <span
                key={g}
                className="flex items-center gap-1 rounded-full bg-violet-soft px-2.5 py-1 text-[11px] font-medium text-violet-deep"
              >
                {g}
                <button onClick={() => setSelectedGenres((prev) => prev.filter((x) => x !== g))} className="font-bold">✕</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs font-medium uppercase tracking-wider text-muted">
          Chargement…
        </div>
      ) : (
        <>
          {/* Résultats locaux */}
          {groups.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((g) => {
                const myId = g.instances.find(i => i.book.user_id === user?.id)?.book.id ?? g.canonical.id;
                return (
                  <Link
                    key={g.key}
                    href={`/livre/${myId}`}
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
                  </Link>
                );
              })}
            </div>
          ) : !showWebSection ? (
            <div className="rounded-2xl border border-dashed border-line bg-card p-10 text-center">
              <p className="font-serif text-base text-ink">Aucun livre trouvé.</p>
            </div>
          ) : null}

          {/* Résultats web — fallback Google Books */}
          {showWebSection && (webLoading || webResults.length > 0 || webError) && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="h-px flex-1 bg-line" />
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted">
                  Résultats du web — Ajouter à la plateforme
                </span>
                <span className="h-px flex-1 bg-line" />
              </div>

              {webLoading ? (
                <div className="py-6 text-center text-xs text-muted">Recherche en cours…</div>
              ) : webError ? (
                <div className="rounded-2xl border border-dashed border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30 p-4 text-center">
                  <p className="text-xs font-medium text-orange-700 dark:text-orange-400">{webError}</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {webResults.map((r) => (
                    <div
                      key={r.googleId}
                      className="flex items-start gap-3 rounded-2xl border border-dashed border-violet/30 bg-violet-soft/40 p-3 transition-colors hover:border-violet/60 hover:bg-violet-soft"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setWebTarget({
                            title: r.title,
                            author: r.author,
                            pages: 0,
                            cover_url: r.coverUrl,
                            genre: r.genre,
                            published_year: r.year,
                            summary: r.summary,
                          })
                        }
                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                      >
                        {r.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.coverUrl}
                            alt={r.title}
                            className="h-[72px] w-[48px] shrink-0 rounded-md object-cover shadow-sm"
                          />
                        ) : (
                          <div className="flex h-[72px] w-[48px] shrink-0 items-center justify-center rounded-md bg-violet/10">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-violet-deep/50"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 font-serif text-[13.5px] font-medium leading-snug text-ink">
                            {r.title}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-muted">{r.author}</p>
                          {r.genre && (
                            <span className="mt-1 inline-block rounded-md bg-violet/10 px-1.5 py-0.5 text-[9.5px] font-medium text-violet-deep">
                              {r.genre}
                            </span>
                          )}
                        </div>
                      </button>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => quickAddBook(r, "completed")}
                          title="Marquer comme terminé"
                          className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                            completedIds.has(r.googleId)
                              ? "border-success bg-success text-cream"
                              : "border-success/40 bg-white/60 text-success hover:bg-success hover:text-cream"
                          }`}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => addToWishlist(r)}
                          title="Envie de lire"
                          className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                            wishlistIds.has(r.googleId)
                              ? "border-violet bg-violet text-cream"
                              : "border-violet/40 bg-white/60 text-violet-deep hover:bg-violet hover:text-cream"
                          }`}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill={wishlistIds.has(r.googleId) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Aucun résultat nulle part */}
          {showWebSection && !webLoading && webResults.length === 0 && groups.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-card p-10 text-center">
              <p className="font-serif text-base text-ink">Aucun résultat pour « {query.trim()} ».</p>
              <p className="mt-1 text-xs text-muted">Essaie un autre titre ou auteur.</p>
            </div>
          )}
        </>
      )}

      {/* Modal détail recommandation */}
      {selectedReco && (
        <RecoDetailModal
          suggestion={selectedReco}
          onClose={() => setSelectedReco(null)}
          onQuickAdd={(status) => {
            quickAddBook(selectedReco, status);
            setSelectedReco(null);
          }}
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

      {/* AddToLibraryModal pour les résultats web */}
      <AddToLibraryModal
        open={webTarget !== null}
        onClose={() => setWebTarget(null)}
        book={webTarget}
        onAdded={(msg) => {
          setWebTarget(null);
          loadBooks();
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
  onQuickAdd,
  onAddToLibrary,
}: {
  suggestion: BookSuggestion;
  onClose: () => void;
  onQuickAdd: (status: "to-read" | "completed") => void;
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
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl bg-paper px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
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

        <div className="mt-5">
          <h3 className="mb-2 font-serif text-[14px] font-semibold text-ink">Résumé</h3>
          {s.summary ? (
            <div className="flex flex-col gap-2.5">
              {toParas(s.summary).map((para, i) => (
                <p key={i} className="text-[13px] leading-relaxed text-ink-2">{para.trim()}</p>
              ))}
            </div>
          ) : (
            <p className="text-[13px] italic text-muted">Aucun résumé disponible pour ce livre.</p>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onQuickAdd("completed")}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-[#eaf1ea] py-3 text-[13px] font-semibold text-success transition-colors hover:bg-success hover:text-cream"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Terminé
            </button>
            <button
              onClick={() => onQuickAdd("to-read")}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-violet-soft py-3 text-[13px] font-semibold text-violet-deep transition-colors hover:bg-violet hover:text-cream"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
              </svg>
              Envie de lire
            </button>
          </div>
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
            className="w-full rounded-2xl border border-line py-2.5 text-[12px] font-medium text-muted transition-colors hover:border-violet/40 hover:text-ink"
          >
            Personnaliser l'ajout…
          </button>
        </div>
      </div>
    </div>
  );
}
