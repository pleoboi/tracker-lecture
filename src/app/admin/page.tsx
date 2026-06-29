"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

type BookResult = {
  id: string;
  title: string;
  author: string;
  isbn13: string | null;
  cover_url: string | null;
  status: string;
  user_id: string;
  member_name: string;
  import_source: string | null;
};

export default function AdminPage() {
  const router = useRouter();
  const [email, setEmail]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<BookResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [source, setSource] = useState<BookResult | null>(null);
  const [target, setTarget] = useState<BookResult | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<string | null>(null);
  const [mergeError,  setMergeError]  = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const userEmail = data.user?.email ?? null;
      setEmail(userEmail);
      if (!userEmail || userEmail !== ADMIN_EMAIL) {
        router.replace("/");
      } else {
        setLoading(false);
      }
    });
  }, [router]);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !email) return;
    setSearching(true);
    setResults([]);
    setSource(null);
    setTarget(null);
    setMergeResult(null);
    setMergeError(null);
    try {
      const res = await fetch("/api/admin/search-books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), callerEmail: email }),
      });
      const data = await res.json() as { books?: BookResult[]; error?: string };
      if (data.error) { setMergeError(data.error); return; }
      setResults(data.books ?? []);
    } finally {
      setSearching(false);
    }
  }, [query, email]);

  const handleMerge = async () => {
    if (!source || !target || !email) return;
    const confirmed = window.confirm(
      `Fusionner :\n\nSOURCE (sera supprimé) :\n"${source.title}" (${source.member_name})\n\nCIBLE (sera conservé) :\n"${target.title}" (${target.member_name})\n\nToutes les sessions de lecture du source seront transférées vers la cible.`
    );
    if (!confirmed) return;

    setMerging(true);
    setMergeResult(null);
    setMergeError(null);
    try {
      const res = await fetch("/api/admin/merge-books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: source.id, targetId: target.id, callerEmail: email }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) { setMergeError(data.error); return; }
      setMergeResult(`Fusion effectuée. "${source.title}" a été fusionné dans "${target.title}".`);
      setSource(null);
      setTarget(null);
      setResults([]);
      setQuery("");
    } finally {
      setMerging(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">Vérification des droits…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-input text-muted hover:text-ink">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M19 12H5M5 12l7 7M5 12l7-7" />
          </svg>
        </button>
        <h1 className="font-serif text-xl font-semibold text-ink">Administration</h1>
      </div>

      {/* ── Fusion de livres ────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-serif text-[15px] font-semibold text-ink">Fusion de livres</h2>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
          Recherche les deux livres à fusionner, désigne la source (qui sera supprimée) et la cible
          (qui sera conservée). Toutes les sessions de lecture de la source sont transférées vers la cible.
        </p>

        {/* Recherche */}
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Titre du livre…"
            className="flex-1 rounded-xl border border-line bg-input px-3 py-2 text-[13px] text-ink placeholder:text-muted focus:border-violet focus:outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="rounded-xl bg-violet px-4 py-2 text-[13px] font-semibold text-cream disabled:opacity-50"
          >
            {searching ? "…" : "Chercher"}
          </button>
        </div>

        {/* Résultats */}
        {results.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5 max-h-64 overflow-y-auto rounded-xl border border-line bg-paper">
            {results.map((book) => {
              const isSource = source?.id === book.id;
              const isTarget = target?.id === book.id;
              return (
                <div key={book.id}
                  className={`flex items-center gap-3 px-3 py-2.5 border-b border-line last:border-0 ${
                    isSource ? "bg-red-50 dark:bg-red-900/10" :
                    isTarget ? "bg-green-50 dark:bg-green-900/10" : ""
                  }`}>
                  {book.cover_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={book.cover_url} alt="" className="h-10 w-7 shrink-0 rounded object-cover" />
                    : <div className="h-10 w-7 shrink-0 rounded bg-input" />
                  }
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-ink">{book.title}</p>
                    <p className="truncate text-[11px] text-muted">{book.author} — {book.member_name}</p>
                    {book.import_source && (
                      <span className="text-[9.5px] text-muted">{book.import_source}</span>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => setSource(isSource ? null : book)}
                      className={`rounded-lg px-2 py-1 text-[10.5px] font-bold transition-colors ${
                        isSource
                          ? "bg-red-500 text-white"
                          : "bg-input text-muted hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/20"
                      }`}
                    >
                      Source
                    </button>
                    <button
                      onClick={() => setTarget(isTarget ? null : book)}
                      className={`rounded-lg px-2 py-1 text-[10.5px] font-bold transition-colors ${
                        isTarget
                          ? "bg-green-600 text-white"
                          : "bg-input text-muted hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900/20"
                      }`}
                    >
                      Cible
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Aperçu fusion */}
        {(source || target) && (
          <div className="mt-4 rounded-xl border border-line bg-paper p-3">
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted">Aperçu de la fusion</p>
            <div className="flex flex-col gap-1.5 text-[12.5px]">
              <div className="flex items-center gap-2">
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">SOURCE</span>
                <span className="text-ink">{source ? `"${source.title}" (${source.member_name})` : <span className="text-muted italic">non sélectionné</span>}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">CIBLE</span>
                <span className="text-ink">{target ? `"${target.title}" (${target.member_name})` : <span className="text-muted italic">non sélectionné</span>}</span>
              </div>
            </div>
            <button
              onClick={handleMerge}
              disabled={!source || !target || merging}
              className="mt-3 w-full rounded-xl bg-violet py-2.5 text-[13px] font-bold text-cream disabled:opacity-40"
            >
              {merging ? "Fusion en cours…" : "Fusionner les livres"}
            </button>
          </div>
        )}

        {/* Résultat */}
        {mergeResult && (
          <div className="mt-3 rounded-xl border border-[#cfe0cf] bg-[#eaf1ea] px-3 py-2.5">
            <p className="text-[12.5px] font-semibold text-success">{mergeResult}</p>
          </div>
        )}
        {mergeError && (
          <div className="mt-3 rounded-xl border border-[#e7c7bd] bg-[#f6e7e1] px-3 py-2.5">
            <p className="text-[12.5px] font-semibold text-danger">{mergeError}</p>
          </div>
        )}
      </section>
    </div>
  );
}
