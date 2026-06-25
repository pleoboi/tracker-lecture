"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import type { Book } from "../../lib/types";
import { pct, isCompleted } from "../../lib/books";
import { Cover, ProgressBar } from "../../components/ui";

type Filter = "tous" | "encours" | "termines" | "notes";
type Sort = "ajout" | "titre" | "auteur" | "note";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "encours", label: "En cours" },
  { key: "termines", label: "Terminés" },
  { key: "notes", label: "★ Top notes" },
];

export default function BibliothequePage() {
  const { user } = useAuth();
  const userId = user?.id;

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("tous");
  const [sort, setSort] = useState<Sort>("ajout");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("books")
      .select("*")
      .eq("user_id", userId)
      .then(({ data }) => {
        setBooks((data as Book[]) || []);
        setLoading(false);
      });
  }, [userId]);

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
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q)
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
      <header className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-black text-ink">Bibliothèque</h1>
        <p className="text-xs font-medium text-muted">
          {books.length} ouvrage{books.length > 1 ? "s" : ""} · {completedCount} terminé
          {completedCount > 1 ? "s" : ""}
        </p>
      </header>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un titre, un auteur…"
        className="w-full rounded-2xl border border-line bg-input px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-violet"
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                filter === f.key
                  ? "bg-violet text-cream"
                  : "border border-line bg-card text-ink-2"
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

      {loading ? (
        <div className="py-20 text-center text-xs font-medium uppercase tracking-wider text-muted">
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
