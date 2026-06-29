"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

type Book = {
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

type AffectedEntry = {
  bookId: string;
  userId: string;
  memberName: string;
  originalTitle: string;
  action: "update_metadata" | "deduplicate";
  targetBookId?: string;
};

type Step = "library" | "choose-target" | "preview" | "done";

export default function AdminPage() {
  const router = useRouter();
  const [email, setEmail]       = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Bibliothèque complète
  const [allBooks,    setAllBooks]    = useState<Book[]>([]);
  const [libLoading,  setLibLoading]  = useState(false);
  const [query,       setQuery]       = useState("");

  // Multi-sélection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Flux de fusion
  const [step,        setStep]        = useState<Step>("library");
  const [target,      setTarget]      = useState<Book | null>(null);
  const [affected,    setAffected]    = useState<AffectedEntry[]>([]);
  const [previewing,  setPreviewing]  = useState(false);
  const [merging,     setMerging]     = useState(false);
  const [mergeResult, setMergeResult] = useState<{ updated: number; deduplicated: number } | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const userEmail = data.user?.email ?? null;
      setEmail(userEmail);
      if (!userEmail || userEmail !== ADMIN_EMAIL) {
        router.replace("/");
      } else {
        setAuthLoading(false);
      }
    });
  }, [router]);

  // ── Chargement de tous les livres ───────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !email) return;
    setLibLoading(true);
    fetch("/api/admin/search-books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "", callerEmail: email }),
    })
      .then((r) => r.json())
      .then((data: { books?: Book[] }) => setAllBooks(data.books ?? []))
      .finally(() => setLibLoading(false));
  }, [authLoading, email]);

  // ── Filtre client-side ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!query.trim()) return allBooks;
    const q = query.toLowerCase();
    return allBooks.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.member_name.toLowerCase().includes(q)
    );
  }, [allBooks, query]);

  // ── Sélection ───────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedBooks = useMemo(
    () => allBooks.filter((b) => selected.has(b.id)),
    [allBooks, selected]
  );

  const reset = () => {
    setSelected(new Set());
    setTarget(null);
    setAffected([]);
    setMergeResult(null);
    setError(null);
    setStep("library");
  };

  // ── Prévisualisation ─────────────────────────────────────────────────────────
  const handlePreview = async () => {
    if (!target || !email) return;
    const sourceIds = selectedBooks.filter((b) => b.id !== target.id).map((b) => b.id);
    if (!sourceIds.length) { setError("Sélectionne au moins un livre source."); return; }
    setPreviewing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/merge-books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceIds, targetId: target.id, callerEmail: email, dryRun: true }),
      });
      const data = await res.json() as { affected?: AffectedEntry[]; error?: string };
      if (data.error) { setError(data.error); return; }
      setAffected(data.affected ?? []);
      setStep("preview");
    } finally {
      setPreviewing(false);
    }
  };

  // ── Fusion finale ───────────────────────────────────────────────────────────
  const handleMerge = async () => {
    if (!target || !email) return;
    const sourceIds = selectedBooks.filter((b) => b.id !== target.id).map((b) => b.id);
    setMerging(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/merge-books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceIds, targetId: target.id, callerEmail: email, dryRun: false }),
      });
      const data = await res.json() as { ok?: boolean; updated?: number; deduplicated?: number; error?: string };
      if (data.error) { setError(data.error); return; }
      setMergeResult({ updated: data.updated ?? 0, deduplicated: data.deduplicated ?? 0 });
      // Retirer les sources fusionnées de la liste locale
      const removedIds = new Set(selectedBooks.filter((b) => b.id !== target.id).map((b) => b.id));
      setAllBooks((prev) => prev.filter((b) => !removedIds.has(b.id)));
      setStep("done");
    } finally {
      setMerging(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">Vérification des droits…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => (step === "library" ? router.back() : reset())}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-input text-muted hover:text-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M19 12H5M5 12l7 7M5 12l7-7" />
          </svg>
        </button>
        <div>
          <h1 className="font-serif text-xl font-semibold text-ink">Administration</h1>
          {step !== "library" && (
            <p className="text-[11px] text-muted">
              {step === "choose-target" && "Lequel conserver ?"}
              {step === "preview"       && "Aperçu de la fusion"}
              {step === "done"          && "Fusion effectuée"}
            </p>
          )}
        </div>
      </div>

      {/* ── Étape 1 : Bibliothèque + sélection ─────────────────────────────── */}
      {step === "library" && (
        <>
          <div className="mb-4 flex items-center gap-2">
            <div className="relative flex-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted pointer-events-none">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrer par titre, auteur ou membre…"
                className="w-full rounded-xl border border-line bg-input py-2 pl-9 pr-3 text-[13px] text-ink placeholder:text-muted focus:border-violet focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink text-xs">
                  ×
                </button>
              )}
            </div>
            {selected.size > 0 && (
              <button onClick={() => setSelected(new Set())}
                className="shrink-0 rounded-xl border border-line bg-paper px-3 py-2 text-[12px] text-muted hover:text-ink">
                Tout désélectionner
              </button>
            )}
          </div>

          {libLoading ? (
            <div className="py-16 text-center text-sm text-muted">Chargement de la bibliothèque…</div>
          ) : (
            <>
              <p className="mb-3 text-[11px] text-muted">
                {filtered.length} livre{filtered.length > 1 ? "s" : ""}
                {query ? ` correspondant à "${query}"` : " au total"}
                {selected.size > 0 ? ` · ${selected.size} sélectionné${selected.size > 1 ? "s" : ""}` : ""}
              </p>

              {/* Grille */}
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                {filtered.map((book) => {
                  const isSelected = selected.has(book.id);
                  return (
                    <button
                      key={book.id}
                      onClick={() => toggleSelect(book.id)}
                      className={`group relative flex flex-col overflow-hidden rounded-xl text-left transition-all ${
                        isSelected
                          ? "ring-2 ring-violet ring-offset-1"
                          : "ring-1 ring-line hover:ring-violet/40"
                      }`}
                    >
                      {/* Couverture */}
                      <div className="aspect-[3/4] w-full bg-input">
                        {book.cover_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={book.cover_url}
                            alt={book.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center p-1">
                            <span className="text-center text-[8px] leading-tight text-muted">{book.title}</span>
                          </div>
                        )}
                      </div>

                      {/* Overlay sélection */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-violet/15 flex items-start justify-end p-1">
                          <div className="flex h-4 w-4 items-center justify-center rounded-full bg-violet">
                            <svg viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.8" className="h-2.5 w-2.5">
                              <path d="M2 5l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                      )}

                      {/* Infos */}
                      <div className="p-1.5">
                        <p className="line-clamp-2 text-[9px] font-semibold leading-tight text-ink">{book.title}</p>
                        <p className="mt-0.5 truncate text-[8.5px] text-muted">{book.member_name}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {filtered.length === 0 && (
                <p className="py-12 text-center text-sm text-muted">Aucun résultat.</p>
              )}
            </>
          )}

          {/* Barre de fusion flottante */}
          {selected.size >= 2 && (
            <div className="sticky bottom-4 mt-6 flex items-center justify-between rounded-2xl border border-violet/30 bg-cream/95 dark:bg-ink/95 px-4 py-3 shadow-lg backdrop-blur-sm">
              <p className="text-[13px] font-semibold text-ink">
                {selected.size} livres sélectionnés
              </p>
              <button
                onClick={() => { setTarget(null); setStep("choose-target"); }}
                className="rounded-xl bg-violet px-5 py-2 text-[13px] font-bold text-cream"
              >
                Fusionner
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Étape 2 : Choisir lequel conserver ─────────────────────────────── */}
      {step === "choose-target" && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <p className="mb-1 text-[13px] font-semibold text-ink">Lequel de ces livres doit être conservé ?</p>
          <p className="mb-4 text-[12px] text-muted">
            Les autres verront leurs métadonnées remplacées par celui-ci. Les notes et notations des membres sont conservées.
          </p>

          <div className="flex flex-col gap-2">
            {selectedBooks.map((book) => {
              const isTarget = target?.id === book.id;
              return (
                <button
                  key={book.id}
                  onClick={() => setTarget(isTarget ? null : book)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    isTarget
                      ? "border-green-400 bg-green-50 dark:bg-green-900/10"
                      : "border-line bg-paper hover:border-violet/30"
                  }`}
                >
                  {book.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={book.cover_url} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="h-14 w-10 shrink-0 rounded bg-input" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-ink">{book.title}</p>
                    <p className="text-[11px] text-muted">{book.author}</p>
                    <p className="text-[10.5px] text-muted">{book.member_name}{book.isbn13 ? ` · ${book.isbn13}` : ""}</p>
                  </div>
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    isTarget ? "border-green-500 bg-green-500" : "border-line"
                  }`}>
                    {isTarget && (
                      <svg viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" className="h-3 w-3">
                        <path d="M2 5l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-[#e7c7bd] bg-[#f6e7e1] px-3 py-2">
              <p className="text-[12px] text-danger">{error}</p>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => { setStep("library"); setError(null); }}
              className="flex-1 rounded-xl border border-line bg-paper py-2.5 text-[13px] font-semibold text-muted hover:text-ink"
            >
              Retour
            </button>
            <button
              onClick={handlePreview}
              disabled={!target || previewing}
              className="flex-1 rounded-xl bg-violet py-2.5 text-[13px] font-bold text-cream disabled:opacity-40"
            >
              {previewing ? "Analyse…" : "Continuer"}
            </button>
          </div>
        </div>
      )}

      {/* ── Étape 3 : Prévisualisation ──────────────────────────────────────── */}
      {step === "preview" && target && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="mb-4 flex items-center gap-3">
            {target.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={target.cover_url} alt="" className="h-16 w-11 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="h-16 w-11 shrink-0 rounded-lg bg-input" />
            )}
            <div>
              <span className="rounded bg-green-100 px-1.5 py-0.5 text-[9.5px] font-bold text-green-700">VERSION CONSERVÉE</span>
              <p className="mt-1 text-[13px] font-semibold text-ink">{target.title}</p>
              <p className="text-[11px] text-muted">{target.author}</p>
            </div>
          </div>

          <div className="mb-1 text-[12px] font-semibold text-ink">
            {affected.length === 0
              ? "Aucun membre affecté."
              : `${affected.length} membre${affected.length > 1 ? "s" : ""} seront affectés :`}
          </div>

          {affected.length > 0 && (
            <div className="mb-3 max-h-52 overflow-y-auto rounded-xl border border-line bg-paper">
              {affected.map((e) => (
                <div key={e.bookId} className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-ink">{e.memberName}</p>
                    <p className="truncate text-[10.5px] text-muted">"{e.originalTitle}"</p>
                  </div>
                  {e.action === "update_metadata" ? (
                    <div className="shrink-0 text-right">
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-700">Mise à jour</span>
                      <p className="mt-0.5 text-[9px] text-muted">métadonnées FR</p>
                    </div>
                  ) : (
                    <div className="shrink-0 text-right">
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9.5px] font-bold text-blue-700">Fusion</span>
                      <p className="mt-0.5 text-[9px] text-muted">lectures transférées</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mb-4 rounded-xl border border-line bg-paper p-3 text-[11px] text-muted leading-relaxed">
            <p><strong className="text-ink">Mise à jour</strong> — le membre n'a que la version source : titre, couverture et métadonnées passent en version cible. Notes et notation conservées.</p>
            <p className="mt-1"><strong className="text-ink">Fusion</strong> — le membre a les deux versions : sessions de lecture transférées vers la version cible, doublon supprimé.</p>
          </div>

          {error && (
            <div className="mb-3 rounded-xl border border-[#e7c7bd] bg-[#f6e7e1] px-3 py-2">
              <p className="text-[12px] text-danger">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { setStep("choose-target"); setError(null); }}
              className="flex-1 rounded-xl border border-line bg-paper py-2.5 text-[13px] font-semibold text-muted hover:text-ink"
            >
              Retour
            </button>
            <button
              onClick={handleMerge}
              disabled={merging}
              className="flex-1 rounded-xl bg-violet py-2.5 text-[13px] font-bold text-cream disabled:opacity-40"
            >
              {merging ? "Fusion en cours…" : "Confirmer"}
            </button>
          </div>
        </div>
      )}

      {/* ── Étape 4 : Résultat ──────────────────────────────────────────────── */}
      {step === "done" && mergeResult && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="rounded-xl border border-[#cfe0cf] bg-[#eaf1ea] px-4 py-3">
            <p className="text-[13px] font-semibold text-success">Fusion effectuée.</p>
            <ul className="mt-1 space-y-0.5 text-[12px] text-muted">
              {mergeResult.updated > 0 && (
                <li>
                  {mergeResult.updated} membre{mergeResult.updated > 1 ? "s" : ""} basculé{mergeResult.updated > 1 ? "s" : ""} vers la version française.
                </li>
              )}
              {mergeResult.deduplicated > 0 && (
                <li>
                  {mergeResult.deduplicated} doublon{mergeResult.deduplicated > 1 ? "s" : ""} supprimé{mergeResult.deduplicated > 1 ? "s" : ""}, lectures transférées.
                </li>
              )}
              {mergeResult.updated === 0 && mergeResult.deduplicated === 0 && (
                <li>Aucune modification nécessaire.</li>
              )}
            </ul>
          </div>
          <button
            onClick={reset}
            className="mt-3 w-full rounded-xl border border-line bg-paper py-2.5 text-[13px] font-semibold text-muted hover:text-ink"
          >
            Nouvelle fusion
          </button>
        </div>
      )}
    </div>
  );
}
