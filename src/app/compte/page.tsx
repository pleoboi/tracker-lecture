"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import type { Book } from "../../lib/types";
import { pct, isCompleted } from "../../lib/books";
import { Cover, ProgressBar, Button } from "../../components/ui";

type Filter = "tous" | "encours" | "termines" | "notes";
type Sort = "ajout" | "titre" | "auteur" | "note";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "encours", label: "En cours" },
  { key: "termines", label: "Terminés" },
  { key: "notes", label: "★ Top notes" },
];

export default function ComptePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const [tab, setTab] = useState<"profil" | "biblio">("profil");

  // Bibliothèque state
  const [books, setBooks] = useState<Book[]>([]);
  const [booksLoaded, setBooksLoaded] = useState(false);
  const [bibLoading, setBibLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("tous");
  const [sort, setSort] = useState<Sort>("ajout");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (tab === "biblio" && !booksLoaded && userId) {
      setBibLoading(true);
      supabase
        .from("books")
        .select("*")
        .eq("user_id", userId)
        .then(({ data }) => {
          setBooks((data as Book[]) || []);
          setBooksLoaded(true);
          setBibLoading(false);
        });
    }
  }, [tab, booksLoaded, userId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (authLoading) {
    return (
      <div className="py-24 text-center text-xs font-medium uppercase tracking-wider text-muted">
        Chargement…
      </div>
    );
  }

  const displayName =
    user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Anonyme";
  const initial = displayName[0]?.toUpperCase() ?? "?";

  // Bibliothèque filtering & sorting
  const completedCount = books.filter(isCompleted).length;
  let list = books.filter((b) => {
    if (filter === "encours") return !isCompleted(b);
    if (filter === "termines") return isCompleted(b);
    if (filter === "notes") return (b.rating || 0) > 0;
    return true;
  });
  if (query.trim()) {
    const q = query.toLowerCase();
    list = list.filter(
      (b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
    );
  }
  list = [...list].sort((a, b) => {
    if (sort === "titre") return a.title.localeCompare(b.title);
    if (sort === "auteur") return a.author.localeCompare(b.author);
    if (sort === "note") return (b.rating || 0) - (a.rating || 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="animate-fadeIn flex flex-col gap-5 pt-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-line bg-card p-1">
        <button
          onClick={() => setTab("profil")}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
            tab === "profil" ? "bg-violet text-cream shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          Profil
        </button>
        <button
          onClick={() => setTab("biblio")}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
            tab === "biblio" ? "bg-violet text-cream shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          Ma bibliothèque
        </button>
      </div>

      {/* ── TAB : PROFIL ── */}
      {tab === "profil" && (
        <div className="flex flex-col gap-4">
          {/* Carte profil */}
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-card p-5">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet font-serif text-xl font-semibold text-cream">
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-lg font-semibold text-ink">{displayName}</p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
            </div>
          </div>

          {/* Liens rapides */}
          <div className="flex flex-col gap-2">
            {user?.id && (
              <Link
                href={`/membre/${user.id}`}
                className="flex items-center justify-between rounded-2xl border border-line bg-card p-4 transition-colors hover:border-violet/40"
              >
                <div>
                  <p className="font-serif text-[15px] font-medium text-ink">Voir mon profil public</p>
                  <p className="mt-0.5 text-xs text-muted">Ce que les autres membres voient de toi</p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-muted">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
            <Link
              href="/membres"
              className="flex items-center justify-between rounded-2xl border border-line bg-card p-4 transition-colors hover:border-violet/40"
            >
              <div>
                <p className="font-serif text-[15px] font-medium text-ink">Membres du club</p>
                <p className="mt-0.5 text-xs text-muted">Voir tous les lecteurs</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-muted">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center justify-between rounded-2xl border border-line bg-card p-4 transition-colors hover:border-violet/40"
            >
              <div>
                <p className="font-serif text-[15px] font-medium text-ink">Statistiques</p>
                <p className="mt-0.5 text-xs text-muted">Tableau de bord & objectifs</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-muted">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full border-danger/30 text-danger hover:bg-[#f6e7e1]"
          >
            Se déconnecter
          </Button>
        </div>
      )}

      {/* ── TAB : BIBLIOTHÈQUE ── */}
      {tab === "biblio" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted">
              {books.length} ouvrage{books.length > 1 ? "s" : ""} · {completedCount} terminé{completedCount > 1 ? "s" : ""}
            </p>
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un titre, un auteur…"
            className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-violet"
          />

          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                    filter === f.key ? "bg-violet text-cream" : "border border-line bg-card text-ink-2"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="shrink-0 rounded-lg border border-line bg-card px-2 py-1.5 text-[11px] font-medium text-ink-2 outline-none"
            >
              <option value="ajout">Récent</option>
              <option value="titre">Titre</option>
              <option value="auteur">Auteur</option>
              <option value="note">Note</option>
            </select>
          </div>

          {bibLoading ? (
            <div className="py-16 text-center text-xs font-medium uppercase tracking-wider text-muted">
              Chargement…
            </div>
          ) : list.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted">Aucun livre ne correspond.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((book) => (
                <GridCard key={book.id} book={book} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GridCard({ book }: { book: Book }) {
  const p = pct(book);
  const done = isCompleted(book);
  const rating = book.rating || 0;
  return (
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
        <p className="truncate text-[11px] text-muted">{book.author}</p>
      </div>
      <div className="flex items-center justify-between px-0.5 pb-0.5">
        <span className="text-[11px] font-semibold text-ink-2">
          <span className="text-gold">★</span>{" "}
          {rating > 0 ? rating.toFixed(1).replace(".", ",") : "—"}
        </span>
        {done ? (
          <span className="text-[10.5px] font-semibold text-success">Terminé</span>
        ) : (
          <span className="text-[10.5px] font-semibold text-violet-deep">{p}%</span>
        )}
      </div>
      {!done && <ProgressBar value={p / 100} className="h-1" />}
    </Link>
  );
}
