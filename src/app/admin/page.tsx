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

type AffectedEntry = {
  bookId: string;
  userId: string;
  memberName: string;
  originalTitle: string;
  action: "update_metadata" | "deduplicate";
  targetBookId?: string;
};

type MergeStep = "select" | "preview" | "done";

export default function AdminPage() {
  const router = useRouter();
  const [email, setEmail]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [query,     setQuery]     = useState("");
  const [results,   setResults]   = useState<BookResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [source, setSource] = useState<BookResult | null>(null);
  const [target, setTarget] = useState<BookResult | null>(null);

  const [step,       setStep]       = useState<MergeStep>("select");
  const [affected,   setAffected]   = useState<AffectedEntry[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [merging,    setMerging]    = useState(false);
  const [mergeResult, setMergeResult] = useState<{ updated: number; deduplicated: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const resetSelection = () => {
    setSource(null);
    setTarget(null);
    setAffected([]);
    setMergeResult(null);
    setError(null);
    setStep("select");
  };

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !email) return;
    setSearching(true);
    resetSelection();
    setResults([]);
    try {
      const res = await fetch("/api/admin/search-books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), callerEmail: email }),
      });
      const data = await res.json() as { books?: BookResult[]; error?: string };
      if (data.error) { setError(data.error); return; }
      setResults(data.books ?? []);
    } finally {
      setSearching(false);
    }
  }, [query, email]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePreview = async () => {
    if (!source || !target || !email) return;
    setPreviewing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/merge-books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: source.id, targetId: target.id, callerEmail: email, dryRun: true }),
      });
      const data = await res.json() as { affected?: AffectedEntry[]; error?: string };
      if (data.error) { setError(data.error); return; }
      setAffected(data.affected ?? []);
      setStep("preview");
    } finally {
      setPreviewing(false);
    }
  };

  const handleMerge = async () => {
    if (!source || !target || !email) return;
    setMerging(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/merge-books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: source.id, targetId: target.id, callerEmail: email, dryRun: false }),
      });
      const data = await res.json() as {
        ok?: boolean;
        updated?: number;
        deduplicated?: number;
        error?: string;
      };
      if (data.error) { setError(data.error); return; }
      setMergeResult({ updated: data.updated ?? 0, deduplicated: data.deduplicated ?? 0 });
      setStep("done");
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

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-serif text-[15px] font-semibold text-ink">Fusion de livres</h2>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
          Sélectionne la version à remplacer (<strong className="text-ink">Source</strong>) et la version
          à conserver (<strong className="text-ink">Cible</strong>). Tous les membres ayant la source
          seront automatiquement basculés vers la cible — leurs notes et notation sont conservées.
        </p>

        {/* ── Étape 1 : Sélection ──────────────────────────────────────────── */}
        {step === "select" && (
          <>
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Rechercher un titre…"
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

            <p className="mt-2 text-[10.5px] text-muted">
              Cherche le titre anglais, puis le titre français dans deux recherches séparées.
            </p>

            {results.length > 0 && (
              <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-line bg-paper">
                {results.map((book) => {
                  const isSource = source?.id === book.id;
                  const isTarget = target?.id === book.id;
                  return (
                    <div key={book.id}
                      className={`flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0 ${
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
                        <p className="truncate text-[11px] text-muted">{book.author}</p>
                        <p className="text-[10.5px] text-muted">
                          {book.member_name}
                          {book.isbn13 ? ` · ISBN ${book.isbn13}` : ""}
                          {book.import_source ? ` · ${book.import_source}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          onClick={() => setSource(isSource ? null : book)}
                          title="Version à remplacer (anglaise)"
                          className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-colors ${
                            isSource ? "bg-red-500 text-white" : "bg-input text-muted hover:bg-red-100 hover:text-red-700"
                          }`}
                        >
                          Source
                        </button>
                        <button
                          onClick={() => setTarget(isTarget ? null : book)}
                          title="Version à conserver (française)"
                          className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-colors ${
                            isTarget ? "bg-green-600 text-white" : "bg-input text-muted hover:bg-green-100 hover:text-green-700"
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

            {source && target && (
              <div className="mt-4 rounded-xl border border-line bg-paper p-3">
                <div className="flex flex-col gap-1.5 text-[12.5px]">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[9.5px] font-bold text-red-700">SOURCE</span>
                    <span className="text-ink">"{source.title}" <span className="text-muted">({source.member_name})</span></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-[9.5px] font-bold text-green-700">CIBLE</span>
                    <span className="text-ink">"{target.title}" <span className="text-muted">({target.member_name})</span></span>
                  </div>
                </div>
                <button
                  onClick={handlePreview}
                  disabled={previewing}
                  className="mt-3 w-full rounded-xl bg-violet py-2.5 text-[13px] font-bold text-cream disabled:opacity-40"
                >
                  {previewing ? "Analyse en cours…" : "Voir les membres affectés"}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Étape 2 : Prévisualisation ───────────────────────────────────── */}
        {step === "preview" && source && target && (
          <div className="mt-4">
            <div className="mb-3 rounded-xl border border-violet/20 bg-violet-soft px-3 py-2.5">
              <p className="text-[12px] font-semibold text-violet-deep">
                {affected.length === 0
                  ? "Aucun doublon trouvé sur d'autres membres."
                  : `${affected.length} membre${affected.length > 1 ? "s" : ""} seront affectés.`}
              </p>
            </div>

            {affected.length > 0 && (
              <div className="mb-3 max-h-60 overflow-y-auto rounded-xl border border-line bg-paper">
                {affected.map((e) => (
                  <div key={e.bookId} className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-ink">{e.memberName}</p>
                      <p className="truncate text-[11px] text-muted">"{e.originalTitle}"</p>
                    </div>
                    {e.action === "update_metadata" ? (
                      <div className="shrink-0 text-right">
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-700">Mise à jour</span>
                        <p className="mt-0.5 text-[9.5px] text-muted">vers la version FR</p>
                      </div>
                    ) : (
                      <div className="shrink-0 text-right">
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9.5px] font-bold text-blue-700">Fusion</span>
                        <p className="mt-0.5 text-[9.5px] text-muted">a déjà la version FR</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mb-3 rounded-xl border border-line bg-paper p-3 text-[11.5px] text-muted leading-relaxed">
              <p><strong className="text-ink">Mise à jour</strong> — le membre n'a que la version anglaise : ses métadonnées passent en français, ses notes et notation sont conservées.</p>
              <p className="mt-1"><strong className="text-ink">Fusion</strong> — le membre a les deux versions : les sessions de lecture sont transférées vers la version française, l'entrée anglaise est supprimée.</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={resetSelection}
                className="flex-1 rounded-xl border border-line bg-paper py-2.5 text-[13px] font-semibold text-muted hover:text-ink"
              >
                Annuler
              </button>
              <button
                onClick={handleMerge}
                disabled={merging}
                className="flex-1 rounded-xl bg-violet py-2.5 text-[13px] font-bold text-cream disabled:opacity-40"
              >
                {merging ? "Fusion en cours…" : "Confirmer la fusion"}
              </button>
            </div>
          </div>
        )}

        {/* ── Étape 3 : Résultat ──────────────────────────────────────────── */}
        {step === "done" && mergeResult && (
          <div className="mt-4">
            <div className="rounded-xl border border-[#cfe0cf] bg-[#eaf1ea] px-4 py-3">
              <p className="text-[13px] font-semibold text-success">Fusion effectuée.</p>
              <ul className="mt-1 space-y-0.5 text-[12px] text-muted">
                {mergeResult.updated > 0 && (
                  <li>{mergeResult.updated} membre{mergeResult.updated > 1 ? "s" : ""} basculé{mergeResult.updated > 1 ? "s" : ""} vers la version française.</li>
                )}
                {mergeResult.deduplicated > 0 && (
                  <li>{mergeResult.deduplicated} doublon{mergeResult.deduplicated > 1 ? "s" : ""} supprimé{mergeResult.deduplicated > 1 ? "s" : ""} (lectures transférées).</li>
                )}
                {mergeResult.updated === 0 && mergeResult.deduplicated === 0 && (
                  <li>Aucun doublon trouvé.</li>
                )}
              </ul>
            </div>
            <button
              onClick={resetSelection}
              className="mt-3 w-full rounded-xl border border-line bg-paper py-2.5 text-[13px] font-semibold text-muted hover:text-ink"
            >
              Nouvelle fusion
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl border border-[#e7c7bd] bg-[#f6e7e1] px-3 py-2.5">
            <p className="text-[12.5px] font-semibold text-danger">{error}</p>
          </div>
        )}
      </section>
    </div>
  );
}
