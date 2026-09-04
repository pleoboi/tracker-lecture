"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import type { Book } from "../lib/types";
import { pct, isCompleted, isAbandoned } from "../lib/books";
import { Cover, ProgressBar } from "./ui";
import AddToLibraryModal from "./AddToLibraryModal";

type Status = "tous" | "encours" | "termines" | "alire" | "abandonnes";
type SortKey = "ajout" | "titre" | "auteur" | "note" | "lecture" | "sortie" | "pages";
type SortDir = "asc" | "desc";

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "tous", label: "Tout statut" },
  { value: "encours", label: "En cours" },
  { value: "termines", label: "Terminés" },
  { value: "alire", label: "À lire" },
  { value: "abandonnes", label: "Abandonnés" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "ajout", label: "Date d'ajout" },
  { value: "lecture", label: "Date de lecture" },
  { value: "sortie", label: "Date de sortie" },
  { value: "note", label: "Note" },
  { value: "titre", label: "Titre" },
  { value: "auteur", label: "Auteur" },
  { value: "pages", label: "Nombre de pages" },
];

// Genres canoniques (français) — sert à filtrer le bruit des imports Google Books.
const GENRES = [
  "Roman", "Fiction", "Non-Fiction", "Classique", "Nouvelle",
  "Thriller", "Policier", "Crime", "Mystère",
  "Fantasy", "Science-Fiction",
  "Histoire", "Biographie", "Témoignage", "Jeunesse",
  "BD / Roman graphique", "Manga", "Comics",
  "Développement personnel", "Philosophie", "Poésie", "Psychologie",
  "Économie", "Science", "Sciences humaines", "Sciences politiques",
  "Essai", "Aventure", "Romance", "Humour", "Sport", "Cinéma",
  "Musique", "Drame", "Suspense", "Théâtre", "Guerre",
];
const GENRE_SET = new Set(GENRES);

// Le champ `genre` regroupe plusieurs genres séparés par des virgules.
// On ne garde que les genres canoniques connus.
function bookGenres(b: Book): string[] {
  if (!b.genre) return [];
  return b.genre.split(",").map((s) => s.trim()).filter((g) => GENRE_SET.has(g));
}

// Direction par défaut sensée à chaque changement de critère.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  ajout: "desc", lecture: "desc", sortie: "desc", note: "desc",
  pages: "desc", titre: "asc", auteur: "asc",
};

const yearOf = (d?: string | null): number | null => {
  if (!d) return null;
  const y = new Date(d).getFullYear();
  return isNaN(y) ? null : y;
};

function nullableNumCmp(a: number | null, b: number | null, mul: number): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // valeurs manquantes toujours en dernier
  if (b == null) return -1;
  return (a - b) * mul;
}

/**
 * Vue bibliothèque complète (recherche, filtres statut/genre/année, tri, grille) —
 * partagée entre /bibliotheque (la sienne, avec persistance des filtres et de la
 * position de scroll) et /membre/[id]/bibliotheque (celle d'un membre, avec un
 * bouton "+ Ajouter" par livre pour l'importer dans sa propre bibliothèque).
 */
export default function BibliothequeView({
  targetUserId,
  isOwn,
  persistState = false,
}: {
  targetUserId: string;
  isOwn: boolean;
  /** Persistance filtres/scroll en sessionStorage — réservé à sa propre bibliothèque. */
  persistState?: boolean;
}) {
  const currentYear = new Date().getFullYear();

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("tous");
  const [genres, setGenres] = useState<string[]>([]); // sélection multiple
  const [readYear, setReadYear] = useState<string>("toutes"); // "toutes" | "cette" | "2024"...
  const [sortKey, setSortKey] = useState<SortKey>("ajout");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [addTarget, setAddTarget] = useState<Book | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!targetUserId) return;
    supabase
      .from("books")
      .select("*")
      .eq("user_id", targetUserId)
      .then(({ data }) => {
        setBooks((data as Book[]) || []);
        setLoading(false);
      });
  }, [targetUserId]);

  // Persistance des filtres : ils survivent à la navigation (ex. clic sur une
  // couverture puis retour). Restauration au montage, sauvegarde à chaque changement.
  const filtersRestored = useRef(false);
  useEffect(() => {
    if (!persistState) { filtersRestored.current = true; return; }
    try {
      const saved = JSON.parse(sessionStorage.getItem("biblio-filters") || "{}");
      if (typeof saved.query === "string") setQuery(saved.query);
      if (STATUS_OPTIONS.some((o) => o.value === saved.status)) setStatus(saved.status);
      if (Array.isArray(saved.genres) && saved.genres.every((g: unknown) => typeof g === "string")) setGenres(saved.genres);
      if (typeof saved.readYear === "string") setReadYear(saved.readYear);
      if (SORT_OPTIONS.some((o) => o.value === saved.sortKey)) setSortKey(saved.sortKey);
      if (saved.sortDir === "asc" || saved.sortDir === "desc") setSortDir(saved.sortDir);
    } catch { /* ignore */ }
    filtersRestored.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!persistState || !filtersRestored.current) return;
    try {
      sessionStorage.setItem(
        "biblio-filters",
        JSON.stringify({ query, status, genres, readYear, sortKey, sortDir }),
      );
    } catch { /* ignore */ }
  }, [persistState, query, status, genres, readYear, sortKey, sortDir]);

  // Position de scroll : on la mémorise en continu, et on la restaure une fois la
  // grille rendue (au retour depuis une fiche livre, on revient au même endroit).
  useEffect(() => {
    if (!persistState) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        try { sessionStorage.setItem("biblio-scroll", String(window.scrollY)); } catch { /* ignore */ }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [persistState]);

  const scrollRestored = useRef(false);
  useEffect(() => {
    if (!persistState || loading || scrollRestored.current) return;
    scrollRestored.current = true;
    let y = 0;
    try { y = Number(sessionStorage.getItem("biblio-scroll") || 0); } catch { /* ignore */ }
    if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y));
  }, [persistState, loading]);

  // Genres individuels présents dans la bibliothèque, avec le nombre de livres pour chacun.
  const availableGenres = useMemo(() => {
    const counts = new Map<string, number>();
    books.forEach((b) => bookGenres(b).forEach((g) => counts.set(g, (counts.get(g) || 0) + 1)));
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "fr"))
      .map(([genre, count]) => ({ genre, count }));
  }, [books]);

  // Années de lecture présentes (d'après date_read), les plus récentes d'abord.
  const availableReadYears = useMemo(() => {
    const set = new Set<number>();
    books.forEach((b) => {
      const y = yearOf(b.date_read);
      if (y) set.add(y);
    });
    return [...set].sort((a, b) => b - a);
  }, [books]);

  const yearOptions = useMemo(
    () => [
      { value: "toutes", label: "Toutes années" },
      { value: "cette", label: `Cette année (${currentYear})` },
      ...availableReadYears.filter((y) => y !== currentYear).map((y) => ({ value: String(y), label: String(y) })),
    ],
    [availableReadYears, currentYear],
  );

  const completedCount = useMemo(() => books.filter(isCompleted).length, [books]);

  const filtered = useMemo(() => {
    let list = books.filter((b) => {
      // Statut
      if (status === "encours") {
        if (isCompleted(b) || isAbandoned(b) || b.status === "to-read") return false;
      } else if (status === "termines") {
        if (!isCompleted(b)) return false;
      } else if (status === "alire") {
        if (b.status !== "to-read") return false;
      } else if (status === "abandonnes") {
        if (!isAbandoned(b)) return false;
      }
      // Genres (multi) : le livre doit posséder au moins un des genres sélectionnés.
      if (genres.length > 0) {
        const bg = bookGenres(b);
        if (!genres.some((g) => bg.includes(g))) return false;
      }
      // Année de lecture
      if (readYear !== "toutes") {
        const y = yearOf(b.date_read);
        if (y == null) return false;
        if (readYear === "cette") {
          if (y !== currentYear) return false;
        } else if (String(y) !== readYear) return false;
      }
      return true;
    });

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q),
      );
    }

    const mul = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case "titre": return a.title.localeCompare(b.title, "fr") * mul;
        case "auteur": return a.author.localeCompare(b.author, "fr") * mul;
        case "note": return nullableNumCmp(a.rating ?? null, b.rating ?? null, mul);
        case "pages": return nullableNumCmp(a.pages || null, b.pages || null, mul);
        case "lecture": return nullableNumCmp(
          a.date_read ? new Date(a.date_read).getTime() : null,
          b.date_read ? new Date(b.date_read).getTime() : null, mul);
        case "sortie": return nullableNumCmp(a.published_year ?? null, b.published_year ?? null, mul);
        case "ajout":
        default: return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * mul;
      }
    });
  }, [books, status, genres, readYear, query, sortKey, sortDir, currentYear]);

  const changeSort = (key: SortKey) => {
    setSortKey(key);
    setSortDir(DEFAULT_DIR[key]);
  };

  const toggleGenre = (g: string) => {
    setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const genreDisplay =
    genres.length === 0 ? "Tous genres" : genres.length === 1 ? genres[0] : `${genres.length} genres`;

  const filtersActive =
    status !== "tous" || genres.length > 0 || readYear !== "toutes" || query.trim() !== "";

  const resetFilters = () => {
    setStatus("tous"); setGenres([]); setReadYear("toutes"); setQuery("");
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-medium text-muted">
        {books.length} ouvrage{books.length > 1 ? "s" : ""} · {completedCount} terminé
        {completedCount > 1 ? "s" : ""}
      </p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un titre, un auteur…"
        className="w-full rounded-2xl border border-line bg-input px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-violet"
      />

      {/* Barre de filtres façon Letterboxd — dropdowns personnalisés, lisibles en mode sombre */}
      <div className="flex flex-wrap items-center gap-2">
        <Dropdown
          label="Statut"
          display={STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "Tout statut"}
          options={STATUS_OPTIONS}
          isActive={(v) => v === status}
          onPick={(v) => setStatus(v as Status)}
        />

        <Dropdown
          label="Genre"
          display={genreDisplay}
          multiple
          options={availableGenres.map(({ genre, count }) => ({ value: genre, label: `${genre} (${count})` }))}
          emptyLabel="Aucun genre renseigné"
          isActive={(v) => genres.includes(v)}
          onPick={(v) => toggleGenre(v)}
          onClear={() => setGenres([])}
          clearLabel="Tous genres"
          clearActive={genres.length === 0}
        />

        <Dropdown
          label="Année de lecture"
          display={yearOptions.find((o) => o.value === readYear)?.label ?? readYear}
          options={yearOptions}
          isActive={(v) => v === readYear}
          onPick={(v) => setReadYear(v)}
        />

        <div className="ml-auto flex items-center gap-1.5">
          <Dropdown
            label="Trier par"
            align="right"
            display={SORT_OPTIONS.find((o) => o.value === sortKey)?.label ?? "Date d'ajout"}
            options={SORT_OPTIONS}
            isActive={(v) => v === sortKey}
            onPick={(v) => changeSort(v as SortKey)}
          />
          <button
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            title={sortDir === "asc" ? "Ordre croissant" : "Ordre décroissant"}
            aria-label="Inverser l'ordre de tri"
            className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-lg border border-line bg-card text-ink-2 transition-colors hover:border-violet hover:text-violet-deep"
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {filtersActive && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted">
            {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
          </span>
          <button
            onClick={resetFilters}
            className="text-[11px] font-semibold text-violet-deep underline-offset-2 hover:underline"
          >
            Réinitialiser les filtres
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-xs font-medium uppercase tracking-wider text-muted">
          Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">Aucun livre ne correspond.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((book) => (
            <GridCard key={book.id} book={book} onAdd={!isOwn ? () => setAddTarget(book) : undefined} />
          ))}
        </div>
      )}

      {!isOwn && (
        <>
          <AddToLibraryModal
            open={addTarget !== null}
            onClose={() => setAddTarget(null)}
            book={addTarget}
            onAdded={(msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); }}
          />
          {toast && (
            <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] left-1/2 z-[70] -translate-x-1/2 rounded-2xl border border-[#a78bfa]/45 bg-[#252131] px-4 py-2.5 text-sm font-medium text-[#fdfbf7] shadow-[0_8px_28px_rgba(0,0,0,0.4)] md:bottom-6">
              {toast}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Dropdown({
  label,
  display,
  options,
  isActive,
  onPick,
  multiple,
  onClear,
  clearLabel,
  clearActive,
  emptyLabel,
  align = "left",
}: {
  label: string;
  display: string;
  options: { value: string; label: string }[];
  isActive: (value: string) => boolean;
  onPick: (value: string) => void;
  multiple?: boolean;
  onClear?: () => void;
  clearLabel?: string;
  clearActive?: boolean;
  emptyLabel?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 transition-colors ${
          open ? "border-violet bg-violet-soft" : "border-line bg-card hover:border-violet/50"
        }`}
      >
        <span className="text-[9.5px] font-semibold uppercase tracking-wide text-muted">{label}</span>
        <span className="max-w-[140px] truncate text-[11.5px] font-semibold text-ink">{display}</span>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute z-40 mt-1 max-h-[320px] min-w-[190px] max-w-[76vw] overflow-y-auto rounded-xl border border-line bg-paper p-1 shadow-[0_12px_32px_rgba(0,0,0,0.35)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {multiple && onClear && (
            <button
              onClick={() => { onClear(); setOpen(false); }}
              className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors ${
                clearActive ? "bg-violet text-cream" : "text-ink-2 hover:bg-violet-soft"
              }`}
            >
              <span className="flex h-4 w-4 items-center justify-center">{clearActive ? "✓" : ""}</span>
              {clearLabel}
            </button>
          )}

          {options.length === 0 ? (
            <p className="px-2.5 py-3 text-[11.5px] text-muted">{emptyLabel ?? "Aucune option"}</p>
          ) : (
            options.map((o) => {
              const active = isActive(o.value);
              return (
                <button
                  key={o.value}
                  onClick={() => { onPick(o.value); if (!multiple) setOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition-colors ${
                    active ? "bg-violet text-cream font-semibold" : "text-ink hover:bg-violet-soft"
                  }`}
                >
                  {multiple && (
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                      active ? "border-cream/60 bg-white/15" : "border-line"
                    }`}>
                      {active ? "✓" : ""}
                    </span>
                  )}
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function GridCard({ book, onAdd }: { book: Book; onAdd?: () => void }) {
  const p = pct(book);
  const done = isCompleted(book);
  const abandoned = isAbandoned(book);
  const rating = book.rating || 0;
  return (
    <div className="flex flex-col gap-1.5">
      <Link
        href={`/livre/${book.id}`}
        className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card p-2.5 transition-colors hover:border-violet/50"
      >
        <Cover
          id={book.id}
          title={book.title}
          coverUrl={book.cover_url}
          className="aspect-[3/4] w-full"
          rounded="rounded-lg"
        />
        <div className="px-0.5">
          <h3 className="truncate font-serif text-sm font-medium text-ink">{book.title}</h3>
          <p className="truncate text-[11px] text-muted">
            {book.author}
            {book.published_year ? ` · ${book.published_year}` : ""}
          </p>
        </div>
        <div className="flex items-center justify-between px-0.5 pb-0.5">
          <span className="text-[11px] font-semibold text-ink-2">
            <span className="text-gold">★</span>{" "}
            {rating > 0 ? rating.toFixed(1).replace(".", ",") : "—"}
          </span>
          {abandoned ? (
            <span className="text-[10.5px] font-semibold text-muted">Abandonné</span>
          ) : done ? (
            <span className="text-[10.5px] font-semibold text-success">Terminé</span>
          ) : book.status === "to-read" ? (
            <span className="text-[10.5px] font-semibold text-muted">À lire</span>
          ) : (
            <span className="text-[10.5px] font-semibold text-violet-deep">{p}%</span>
          )}
        </div>
        {!done && !abandoned && book.status !== "to-read" && <ProgressBar value={p / 100} className="h-1" />}
      </Link>
      {onAdd && (
        <button
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-1 rounded-xl border border-violet/30 bg-violet-soft py-1.5 text-[10.5px] font-semibold text-violet-deep"
        >
          + Ajouter
        </button>
      )}
    </div>
  );
}
