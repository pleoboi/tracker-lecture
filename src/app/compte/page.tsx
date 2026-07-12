"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import type { Book } from "../../lib/types";
import { pct, isCompleted } from "../../lib/books";
import { Cover, ProgressBar, Button } from "../../components/ui";
import { searchBooks, fetchOpenLibraryCover, isFrench } from "../../lib/googleBooks";

type Filter = "tous" | "encours" | "termines" | "abandonnes" | "notes" | "recents" | "envie";
type Sort = "ajout" | "titre" | "auteur" | "note";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "encours", label: "En cours" },
  { key: "recents", label: "Derniers lus" },
  { key: "termines", label: "Terminés" },
  { key: "abandonnes", label: "Abandonné" },
  { key: "notes", label: "★ Top notes" },
  { key: "envie", label: "Envie de lire" },
];
const VALID_FILTERS: Filter[] = ["tous", "encours", "termines", "abandonnes", "notes", "recents", "envie"];
const VALID_SORTS: Sort[] = ["ajout", "titre", "auteur", "note"];

// ── CSV Goodreads parser ────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === "," && !inQ) {
      result.push(cur); cur = "";
    } else { cur += c; }
  }
  result.push(cur);
  return result;
}

function parseGRDate(s: string): string | null {
  if (!s) return null;
  const m = s.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

interface GRRow {
  title: string;
  author: string;
  isbn13: string | null;
  pages: number;
  rating: number;
  status: string;
  date_read: string | null;
  date_started: string | null;
  notes: string | null;
  // Enriched from Google Books
  cover_url?: string | null;
  summary?: string | null;
  published_year?: number | null;
  genre?: string | null;
}

function parseGoodreadsCSV(text: string): GRRow[] {
  const clean = text.replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = {
    title: headers.indexOf("title"),
    author: headers.indexOf("author"),
    pages: headers.indexOf("number of pages"),
    rating: headers.indexOf("my rating"),
    shelf: headers.indexOf("exclusive shelf"),
    dateRead: headers.indexOf("date read"),
    dateAdded: headers.indexOf("date added"),
    review: headers.indexOf("my review"),
    isbn: headers.indexOf("isbn"),
    isbn13: headers.indexOf("isbn13"),
  };
  if (idx.title === -1) return [];

  const rows: GRRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseCSVLine(line);
    const shelf = idx.shelf >= 0 ? (cols[idx.shelf] || "").trim() : "";
    if (shelf === "to-read") continue;
    const title = (cols[idx.title] || "").trim();
    if (!title) continue;
    const statusMap: Record<string, string> = {
      read: "completed",
      "currently-reading": "reading",
    };
    // Goodreads exporte les ISBN sous la forme ="9782070417858" — on strip les non-chiffres
    const rawIsbn = (
      (idx.isbn13 >= 0 ? cols[idx.isbn13] : "") ||
      (idx.isbn >= 0 ? cols[idx.isbn] : "") ||
      ""
    ).replace(/[^0-9]/g, "");
    const isbn13 = rawIsbn.length >= 10 ? rawIsbn.slice(-13) : null;

    rows.push({
      title,
      author: (cols[idx.author] || "").trim(),
      isbn13,
      pages: Math.max(0, parseInt(cols[idx.pages] || "0", 10) || 0),
      rating: Math.max(0, Math.min(5, parseInt(cols[idx.rating] || "0", 10) || 0)),
      status: statusMap[shelf] ?? "reading",
      date_read: idx.dateRead >= 0 ? parseGRDate(cols[idx.dateRead]) : null,
      date_started: idx.dateAdded >= 0 ? parseGRDate(cols[idx.dateAdded]) : null,
      notes: idx.review >= 0 ? (cols[idx.review] || "").trim() || null : null,
    });
  }
  return rows;
}

// ── Helpers import ───────────────────────────────────────────────────────────

/** Dice coefficient sur les mots significatifs (>2 car). Retourne 0–1. */
function titleSimilarity(a: string, b: string): number {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  const wa = norm(a).split(" ").filter((w) => w.length > 2);
  const wb = new Set(norm(b).split(" ").filter((w) => w.length > 2));
  if (!wa.length || !wb.size) return a.toLowerCase() === b.toLowerCase() ? 1 : 0;
  const common = wa.filter((w) => wb.has(w)).length;
  return (2 * common) / (wa.length + wb.size);
}

// ── Goodreads Import Component ──────────────────────────────────────────────

function GoodreadsImport({ userId, onDone }: { userId: string; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"auto" | "csv">("auto");
  const [goodreadsUrl, setGoodreadsUrl] = useState("");
  const [fetchingRss, setFetchingRss] = useState(false);
  const [preview, setPreview] = useState<GRRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [phase, setPhase] = useState<"enrich" | "insert" | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAutoFetch = async () => {
    if (!goodreadsUrl.trim()) return;
    setFetchingRss(true);
    setError(null);
    try {
      const res = await fetch("/api/goodreads/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: goodreadsUrl.trim() }),
      });
      const data = await res.json() as { error?: string; books?: GRRow[]; count?: number };
      if (data.error) { setError(data.error); return; }
      if (!data.books?.length) {
        setError("Aucun livre trouvé. Vérifiez que votre profil Goodreads est public.");
        return;
      }
      setPreview(data.books);
    } catch {
      setError("Connexion à Goodreads impossible. Vérifiez l'URL et réessayez.");
    } finally {
      setFetchingRss(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      setError("Sélectionne un fichier .csv exporté depuis Goodreads.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseGoodreadsCSV(ev.target?.result as string);
        if (rows.length === 0) {
          setError("Fichier non reconnu. Exporte ton historique depuis Goodreads : Mon profil → Importer/Exporter.");
          return;
        }
        setPreview(rows);
        setError(null);
      } catch {
        setError("Impossible de lire ce fichier CSV.");
      }
    };
    reader.readAsText(file, "utf-8");
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);

    // ── Phase 1 : déduplication (ISBN13 → similarité Dice titre+auteur) ────────
    const { data: existing } = await supabase
      .from("books")
      .select("title, author, isbn13")
      .eq("user_id", userId);

    const existingBooks = (existing as (Pick<Book, "title" | "author"> & { isbn13?: string | null })[]) || [];
    const existingIsbns = new Set(existingBooks.map((b) => b.isbn13).filter(Boolean) as string[]);

    const toInsert = preview.filter((r) => {
      // A — Match ISBN13 exact
      if (r.isbn13 && existingIsbns.has(r.isbn13)) return false;
      // B — Similarité titre+auteur (Dice ≥ 85 %)
      const rSurname = (r.author || "").toLowerCase().split(/\s+/).pop() ?? "";
      for (const eb of existingBooks) {
        if (titleSimilarity(r.title, eb.title) >= 0.85) {
          const eSurname = (eb.author || "").toLowerCase().split(/\s+/).pop() ?? "";
          if (!rSurname || !eSurname || rSurname === eSurname ||
              eSurname.includes(rSurname) || rSurname.includes(eSurname)) {
            return false;
          }
        }
      }
      return true;
    });
    const skipped = preview.length - toInsert.length;

    // ── Phase 2 : enrichissement Google Books ────────────────────────────────
    setPhase("enrich");
    setProgress({ done: 0, total: toInsert.length });

    const enriched: GRRow[] = toInsert.map((r) => ({ ...r }));
    const ENRICH_CONCURRENCY = 3;

    // Pré-charge les fiches déjà en base (autres utilisateurs, avec couverture)
    // pour réutiliser leurs métadonnées sans appel API supplémentaire.
    type GBok = { isbn13?: string | null; title: string; author: string | null; cover_url: string | null; summary: string | null; published_year: number | null; genre: string | null };
    const { data: globalPool } = await supabase
      .from("books")
      .select("isbn13, title, author, cover_url, summary, published_year, genre")
      .neq("user_id", userId)
      .not("cover_url", "is", null);
    const globalBooks = (globalPool as GBok[]) || [];
    const globalByIsbn = new Map(globalBooks.filter((b) => b.isbn13).map((b) => [b.isbn13!, b]));

    for (let i = 0; i < enriched.length; i += ENRICH_CONCURRENCY) {
      const chunk = enriched.slice(i, Math.min(i + ENRICH_CONCURRENCY, enriched.length));
      await Promise.all(
        chunk.map(async (row, j) => {
          try {
            const authorSurname = (row.author || "").toLowerCase().split(/\s+/).pop() ?? "";

            // Données déjà complètes depuis le serveur (import auto RSS) : on se
            // contente d'améliorer la couverture via la base existante si besoin.
            const alreadyEnriched = !!(row.cover_url && row.summary && row.genre);

            // 1. Couverture depuis la base (ISBN exact, ou titre+auteur similaires)
            const isbnHit = row.isbn13 ? globalByIsbn.get(row.isbn13) : undefined;
            const titleHit = isbnHit
              ? undefined
              : globalBooks.find((b) => {
                  if (titleSimilarity(b.title, row.title) < 0.85) return false;
                  const bSurname = (b.author || "").toLowerCase().split(/\s+/).pop() ?? "";
                  return !authorSurname || !bSurname ||
                    bSurname.includes(authorSurname) || authorSurname.includes(bSurname);
                });
            const dbCover = (isbnHit ?? titleHit)?.cover_url ?? null;

            if (alreadyEnriched) {
              // Données serveur déjà là : on n'écrase que si la base locale a mieux
              enriched[i + j] = {
                ...row,
                cover_url: dbCover ?? row.cover_url,
              };
              return;
            }

            // 2. Google Books (langRestrict: fr) — titre FR + métadonnées
            const q = [row.title, row.author].filter(Boolean).join(" ").trim();
            const results = await searchBooks(q);
            const withCover = results.filter((r) => r.coverUrl);
            const matchAuthor = (pool: typeof results) =>
              pool.find((r) => !authorSurname || r.author.toLowerCase().includes(authorSurname));
            const best = matchAuthor(withCover) ?? matchAuthor(results) ?? null;

            // 3. Open Library en fallback couverture
            let coverUrl = dbCover ?? best?.coverUrl ?? null;
            if (!coverUrl) {
              coverUrl = await fetchOpenLibraryCover(row.title, row.author, row.isbn13);
            }

            enriched[i + j] = {
              ...row,
              title: (best?.title && isFrench(best.title)) ? best.title : row.title,
              cover_url: coverUrl,
              summary: best?.summary ?? null,
              published_year: best?.year ?? null,
              genre: best?.genre ?? null,
            };
          } catch { /* fallback : données brutes */ }
        })
      );
      setProgress({ done: Math.min(i + ENRICH_CONCURRENCY, enriched.length), total: enriched.length });
      if (i + ENRICH_CONCURRENCY < enriched.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // ── Phase 3 : insertion Supabase ─────────────────────────────────────────
    setPhase("insert");
    setProgress({ done: 0, total: enriched.length });

    const BATCH = 25;
    let done = 0;
    for (let i = 0; i < enriched.length; i += BATCH) {
      const batch = enriched.slice(i, i + BATCH).map((r) => ({
        title: r.title,
        author: r.author || "Auteur inconnu",
        isbn13: r.isbn13 ?? null,
        pages: r.pages || 0,
        progress: r.status === "completed" ? (r.pages || 0) : 0,
        status: r.status,
        rating: r.rating || 0,
        notes: r.notes,
        cover_url: r.cover_url ?? null,
        summary: r.summary ?? null,
        published_year: r.published_year ?? null,
        genre: r.genre ?? null,
        date_read: r.date_read,
        date_started: r.date_started,
        import_source: "goodreads",
        user_id: userId,
      }));
      await supabase.from("books").insert(batch);
      done += batch.length;
      setProgress({ done, total: enriched.length });
    }

    setImporting(false);
    setPhase(null);
    setResult({ inserted: enriched.length, skipped });
    setPreview(null);
    onDone();
  };

  if (result) {
    return (
      <div className="rounded-2xl border border-[#cfe0cf] bg-[#eaf1ea] p-4">
        <p className="font-serif text-[15px] font-semibold text-success">Import terminé !</p>
        <p className="mt-1 text-[13px] text-ink-2">
          <span className="font-semibold">{result.inserted}</span> livre{result.inserted > 1 ? "s" : ""} importé{result.inserted > 1 ? "s" : ""}
          {result.skipped > 0 && ` · ${result.skipped} déjà présent${result.skipped > 1 ? "s" : ""}`}.
        </p>
        <button
          onClick={() => setResult(null)}
          className="mt-2 text-xs font-medium text-success underline"
        >
          Importer un autre fichier
        </button>
      </div>
    );
  }

  if (preview) {
    const completed = preview.filter((r) => r.status === "completed").length;
    const reading = preview.filter((r) => r.status === "reading").length;
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="font-serif text-[14px] font-semibold text-ink">
            {preview.length} livre{preview.length > 1 ? "s" : ""} détecté{preview.length > 1 ? "s" : ""}
          </p>
          <div className="mt-1.5 flex gap-3 text-[12px] text-muted">
            <span>✓ {completed} terminé{completed > 1 ? "s" : ""}</span>
            {reading > 0 && <span>▶ {reading} en cours</span>}
          </div>
          {importing && (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] font-medium">
                <span className={phase === "enrich" ? "text-violet-deep" : "text-muted"}>
                  {phase === "enrich" ? "⚡ Enrichissement Google Books…" : "✓ Enrichissement terminé"}
                </span>
                <span className={phase === "insert" ? "text-violet-deep" : "text-muted"}>
                  {phase === "insert" ? "💾 Import en base…" : "En attente"}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#e6decc]">
                <div
                  className="h-full rounded-full bg-violet transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-center text-[11px] text-muted">
                {progress.done} / {progress.total}
                {phase === "enrich" && " — Récupération couvertures & titres français"}
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setPreview(null)} className="flex-1 text-sm">
            Annuler
          </Button>
          <Button onClick={handleImport} disabled={importing} className="flex-1 text-sm">
            {importing
              ? phase === "enrich"
                ? "Enrichissement…"
                : "Import en cours…"
              : "Importer maintenant"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Sélecteur de mode */}
      <div className="flex overflow-hidden rounded-xl border border-line text-[12.5px] font-semibold">
        <button
          onClick={() => { setMode("auto"); setError(null); }}
          className={`flex-1 py-2 transition-colors ${mode === "auto" ? "bg-violet text-cream" : "bg-card text-muted hover:text-ink"}`}
        >
          Automatique
        </button>
        <button
          onClick={() => { setMode("csv"); setError(null); }}
          className={`flex-1 border-l border-line py-2 transition-colors ${mode === "csv" ? "bg-violet text-cream" : "bg-card text-muted hover:text-ink"}`}
        >
          Fichier CSV
        </button>
      </div>

      {mode === "auto" ? (
        <div className="flex flex-col gap-4">
          {/* 3 étapes style Lexu */}
          <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-paper px-4 py-3.5">
            {[
              { n: 1, title: "Connectez-vous à Goodreads", desc: "Ouvrez votre profil Goodreads et copiez l'URL depuis la barre d'adresse." },
              { n: 2, title: "Vos étagères sont analysées", desc: "SWENA récupère automatiquement votre bibliothèque lue depuis le flux public." },
              { n: 3, title: "Vos livres sont importés", desc: "Chaque livre est enrichi (couverture, résumé, genre) puis ajouté à votre collection." },
            ].map(({ n, title, desc }) => (
              <div key={n} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-soft font-mono text-[11px] font-black text-violet-deep">
                  {n}
                </span>
                <div>
                  <p className="text-[12.5px] font-semibold text-ink">{title}</p>
                  <p className="text-[11.5px] leading-relaxed text-muted">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Avertissement de confidentialité */}
          <p className="rounded-xl bg-input px-3 py-2 text-[11px] leading-relaxed text-muted">
            Vos identifiants Goodreads ne sont ni stockés ni transmis. Seule la liste de vos livres est récupérée depuis votre profil public.
          </p>

          {/* Champ URL */}
          <input
            type="url"
            value={goodreadsUrl}
            onChange={(e) => setGoodreadsUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAutoFetch()}
            placeholder="https://www.goodreads.com/user/show/12345678-votre-nom"
            className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-[13px] text-ink placeholder:text-muted focus:border-violet focus:outline-none"
          />

          {error && (
            <p className="rounded-xl border border-[#e7c7bd] bg-[#f6e7e1] px-3 py-2 text-xs font-medium text-danger">
              {error}
            </p>
          )}

          <Button
            onClick={handleAutoFetch}
            disabled={fetchingRss || !goodreadsUrl.trim()}
            className="w-full text-sm"
          >
            {fetchingRss ? "Connexion en cours…" : "Se connecter a Goodreads"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] leading-relaxed text-ink-2">
            Exporte ton historique depuis <span className="font-semibold">Goodreads</span> (Mon profil → Importer/Exporter → Exporter la bibliothèque), puis charge le fichier CSV ici.
            Les livres déjà présents ne seront pas dupliqués.
          </p>
          {error && (
            <p className="rounded-xl border border-[#e7c7bd] bg-[#f6e7e1] px-3 py-2 text-xs font-medium text-danger">
              {error}
            </p>
          )}
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          <Button onClick={() => fileRef.current?.click()} variant="ghost" className="w-full text-sm">
            Choisir le fichier CSV Goodreads
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Favorite Book Picker ────────────────────────────────────────────────────
// Se charge tout seul depuis Supabase — pas de dépendance sur l'onglet Biblio

function FavoriteBookPicker({
  userId,
  current,
  slotIndex,
  onSelect,
  onClose,
}: {
  userId: string;
  current: number[];
  slotIndex: number;
  onSelect: (bookId: number) => void;
  onClose: () => void;
}) {
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase
      .from("books")
      .select("*")
      .eq("user_id", userId)
      .then(({ data }) => {
        setAllBooks((data as Book[]) || []);
        setLoadingBooks(false);
      });
  }, [userId]);

  const completed = allBooks.filter(
    (b) => isCompleted(b) && !current.filter((_, i) => i !== slotIndex).includes(b.id)
  );
  const filtered = q.trim()
    ? completed.filter(
        (b) =>
          b.title.toLowerCase().includes(q.toLowerCase()) ||
          b.author.toLowerCase().includes(q.toLowerCase())
      )
    : completed;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4 pt-4 pb-24 [touch-action:none]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-paper p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg font-semibold text-ink">Choisir un favori</h3>
          <button onClick={onClose} className="text-xl font-light text-muted">✕</button>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher…"
          className="mb-3 w-full rounded-xl border border-line bg-input px-3 py-2.5 text-sm text-ink outline-none focus:border-violet"
          autoFocus
        />
        <div className="flex-1 overflow-y-auto flex flex-col gap-2">
          {loadingBooks && (
            <p className="py-8 text-center text-xs font-medium uppercase tracking-wider text-muted">
              Chargement…
            </p>
          )}
          {!loadingBooks && filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">
              {completed.length === 0 ? "Aucun livre terminé dans ta bibliothèque." : "Aucun résultat."}
            </p>
          )}
          {filtered.map((b) => (
            <button
              key={b.id}
              onClick={() => { onSelect(b.id); onClose(); }}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 text-left transition-colors hover:border-violet"
            >
              <Cover id={b.id} title={b.title} coverUrl={b.cover_url} className="h-14 w-10 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-[14px] font-medium text-ink">{b.title}</p>
                <p className="truncate text-[11px] text-muted">{b.author}</p>
                {(b.rating || 0) > 0 && (
                  <p className="text-[11px] font-medium text-gold">★ {b.rating!.toFixed(1)}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Enrichissement bibliothèque ─────────────────────────────────────────────
// Tente d'abord via la route admin (tous les livres du club, service role key).
// Fallback sur les propres livres de l'utilisateur si la clé n'est pas configurée.

function EnrichLibrary({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [mode, setMode] = useState<"club" | "own" | "update" | null>(null);
  const [result, setResult] = useState<{ updated: number; noMatch: number } | null>(null);
  const [serviceKeyMissing, setServiceKeyMissing] = useState(false);

  // ── Enrichissement via route admin (tous les livres) ──────────────────────
  const handleEnrichAll = async () => {
    setRunning(true);
    setMode("club");
    setResult(null);
    setServiceKeyMissing(false);

    let offset = 0;
    let totalUpdated = 0;
    let totalNoMatch = 0;
    const LIMIT = 5;

    while (true) {
      let res: Response;
      try {
        res = await fetch("/api/admin/enrich-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset, limit: LIMIT }),
        });
      } catch {
        break;
      }

      if (res.status === 503) {
        setServiceKeyMissing(true);
        setRunning(false);
        setMode(null);
        return;
      }

      if (!res.ok) break;

      const data = await res.json();
      offset = data.offset;
      totalUpdated += data.updated ?? 0;
      totalNoMatch += data.noMatch ?? 0;
      setProgress({ done: offset, total: data.total });

      if (data.done) break;
    }

    setRunning(false);
    setResult({ updated: totalUpdated, noMatch: totalNoMatch });
    onDone();
  };

  // ── Fallback : seulement les livres de l'utilisateur (sans service key) ──
  const handleEnrichOwn = async () => {
    setRunning(true);
    setMode("own");
    setResult(null);

    const { data: rawBooks } = await supabase
      .from("books")
      .select("id, title, author, isbn13")
      .eq("user_id", userId)
      .or("cover_url.is.null,cover_url.eq.");

    const toEnrich = (rawBooks as (Pick<Book, "id" | "title" | "author"> & { isbn13?: string | null })[]) || [];
    setProgress({ done: 0, total: toEnrich.length });

    let updated = 0;
    let noMatch = 0;

    for (let i = 0; i < toEnrich.length; i++) {
      const book = toEnrich[i];
      try {
        const q = `${book.title} ${book.author || ""}`.trim();
        const apiRes = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`);
        let best = null;
        if (apiRes.ok) {
          best = (await apiRes.json()).results?.[0] ?? null;
        }

        // Fallback Open Library si Google Books n'a pas de couverture
        let coverUrl = best?.coverUrl ?? null;
        if (!coverUrl) {
          coverUrl = await fetchOpenLibraryCover(book.title, book.author || "", book.isbn13);
        }

        if (coverUrl) {
          await supabase.from("books").update({ cover_url: coverUrl }).eq("id", book.id);
          updated++;
        } else {
          noMatch++;
        }
      } catch {
        noMatch++;
      }
      setProgress({ done: i + 1, total: toEnrich.length });
      if (i < toEnrich.length - 1) await new Promise((r) => setTimeout(r, 300));
    }

    setRunning(false);
    setResult({ updated, noMatch });
    onDone();
  };

  if (result) {
    const scope = mode === "club" ? "tous les membres" : "ta bibliothèque";
    return (
      <div className="rounded-2xl border border-[#cfe0cf] bg-[#eaf1ea] px-4 py-3">
        <p className="text-[13px] font-semibold text-success">Enrichissement terminé !</p>
        <p className="mt-0.5 text-[12px] text-ink-2">
          {result.updated} livre{result.updated > 1 ? "s" : ""} enrichi{result.updated > 1 ? "s" : ""} ({scope})
          {result.noMatch > 0 && ` · ${result.noMatch} sans résultat`}.
        </p>
        <button onClick={() => { setResult(null); setMode(null); }} className="mt-1.5 text-[11px] font-medium text-success underline">
          Relancer
        </button>
      </div>
    );
  }

  if (running) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-medium text-violet-deep">
          {mode === "club" ? "🌐 Enrichissement pour tout le club…" : mode === "update" ? "🔄 Mise à jour des données en cours…" : "🖼️ Enrichissement de ta bibliothèque…"}
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#e6decc]">
          <div
            className="h-full rounded-full bg-violet transition-all duration-300"
            style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
          />
        </div>
        <p className="text-center text-[11px] text-muted">
          {progress.done} / {progress.total}
        </p>
      </div>
    );
  }

  if (serviceKeyMissing) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-[#e7c7bd] bg-[#f6e7e1] px-3 py-2.5 text-[12px] text-danger">
          <p className="font-semibold">Service Role Key manquante</p>
          <p className="mt-0.5 text-[11px]">
            Pour enrichir tous les livres du club, ajoute{" "}
            <code className="rounded bg-[#f0d9d4] px-1 font-mono text-[11px]">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            dans <strong>.env.local</strong> et dans les variables Vercel (Dashboard → Settings → Environment Variables).
          </p>
          <p className="mt-1 text-[11px]">
            Récupère-la sur : Supabase Dashboard → Settings → API → service_role
          </p>
        </div>
        <Button variant="ghost" onClick={handleEnrichOwn} className="w-full text-sm">
          🖼️ Enrichir mes livres uniquement
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleEnrichAll} className="w-full text-sm">
        🌐 Enrichir tous les livres du club
      </Button>
      <Button variant="ghost" onClick={handleEnrichOwn} className="w-full text-sm">
        🖼️ Enrichir mes livres uniquement
      </Button>
    </div>
  );
}

// ── Timeline Historique (aperçu compte) ────────────────────────────────────

interface TLPreviewEvent {
  id: string;
  title: string;
  start_year: number;
  end_year: number | null;
  book_cover_url: string | null;
  book_title: string | null;
}

function fmtYear(y: number): string {
  return y < 0 ? `${Math.abs(y)} av. J.-C.` : String(y);
}
function fmtPeriod(start: number, end: number | null): string {
  return end != null ? `${fmtYear(start)} – ${fmtYear(end)}` : fmtYear(start);
}

const PREVIEW_COUNT = 3;

function TimelineSection() {
  const [events, setEvents] = useState<TLPreviewEvent[]>([]);
  const [total,  setTotal]  = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser || cancelled) { setLoading(false); return; }
      let { data, count, error } = await supabase
        .from("user_timeline_events")
        .select("id, title, start_year, end_year, book_cover_url, book_title", { count: "exact" })
        .eq("user_id", authUser.id)
        .order("start_year", { ascending: true })
        .limit(PREVIEW_COUNT);
      if (error) {
        const res = await supabase
          .from("user_timeline_events")
          .select("id, title, start_year, end_year", { count: "exact" })
          .eq("user_id", authUser.id)
          .order("start_year", { ascending: true })
          .limit(PREVIEW_COUNT);
        data = res.data as typeof data;
        count = res.count;
      }
      if (cancelled) return;
      setEvents((data ?? []) as TLPreviewEvent[]);
      setTotal(count ?? 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const extra = total - PREVIEW_COUNT;

  return (
    <Link
      href="/frise"
      className="block rounded-2xl border border-line bg-card p-4 transition-colors hover:border-violet/40"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif text-[15px] font-medium text-ink">Ma Frise Historique</h3>
          <p className="mt-0.5 text-[11px] text-muted">
            {loading ? "Chargement…" : total === 0 ? "Aucun repère · commence sur la frise" : `${total} repère${total > 1 ? "s" : ""}`}
          </p>
        </div>
        <span className="shrink-0 text-[13px] text-muted">›</span>
      </div>

      {!loading && events.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center gap-2.5">
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet/50" />
              <span className="shrink-0 font-serif text-[10px] font-semibold text-violet-deep">
                {fmtPeriod(ev.start_year, ev.end_year)}
              </span>
              <p className="flex-1 truncate text-[12px] font-medium text-ink">{ev.title}</p>
              {ev.book_cover_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ev.book_cover_url}
                  alt={ev.book_title ?? ""}
                  className="h-7 w-5 shrink-0 rounded object-cover opacity-80"
                />
              )}
            </div>
          ))}

          {extra > 0 && (
            <p className="mt-1 text-[11px] font-medium text-violet-deep">
              + {extra} autre{extra > 1 ? "s" : ""} · voir la frise complète →
            </p>
          )}
        </div>
      )}
    </Link>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ComptePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const [tab, setTab] = useState<"profil" | "biblio">("profil");

  // Dark mode
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains("dark"));
  }, []);
  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) { document.documentElement.classList.add("dark"); localStorage.setItem("theme", "dark"); }
    else { document.documentElement.classList.remove("dark"); localStorage.setItem("theme", "light"); }
  };

  // Notifications push
  const [notifStatus, setNotifStatus] = useState<"granted" | "default" | "denied" | null>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifTestResult, setNotifTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const perm = Notification.permission as "granted" | "default" | "denied";
    setNotifStatus(perm);
    if (perm === "granted" && "serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setNotifEnabled(!!sub);
      });
    }
  }, []);

  function urlBase64ToUint8Array(b64: string): ArrayBuffer {
    const padding = "=".repeat((4 - (b64.length % 4)) % 4);
    const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr.buffer as ArrayBuffer;
  }

  const handleToggleNotif = async () => {
    if (notifLoading || notifStatus === "denied" || !("serviceWorker" in navigator)) return;
    setNotifLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (notifEnabled) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await fetch("/api/push/subscribe", {
              method: "DELETE",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ endpoint }),
            });
          }
        }
        setNotifEnabled(false);
      } else {
        const permission = await Notification.requestPermission();
        setNotifStatus(permission as "granted" | "default" | "denied");
        if (permission === "granted") {
          const existing = await reg.pushManager.getSubscription();
          const sub = existing ?? await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
          });
          const { keys } = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await fetch("/api/push/subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth }),
            });
          }
          setNotifEnabled(true);
          localStorage.removeItem("swena_push_dismissed");
        }
      }
    } catch { /* permission refusée ou erreur SW */ }
    setNotifLoading(false);
  };

  const handleTestNotif = async () => {
    setNotifTestResult(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setNotifTestResult("Non connecté"); return; }
    const res = await fetch("/api/push/test", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = await res.json();
    if (!res.ok) {
      setNotifTestResult(`Erreur : ${json.error}`);
    } else {
      setNotifTestResult(`Envoyé (${json.sent}/${json.subscriptions} souscription${json.subscriptions > 1 ? "s" : ""})`);
    }
    setTimeout(() => setNotifTestResult(null), 4000);
  };

  // Profile
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState("");
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [pseudoDraft, setPseudoDraft] = useState("");
  const [editingPseudo, setEditingPseudo] = useState(false);
  const [savingPseudo, setSavingPseudo] = useState(false);
  const [bio, setBio] = useState<string | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [savingBio, setSavingBio] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Favorites
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [favoriteBooks, setFavoriteBooks] = useState<Book[]>([]);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [savingFavorites, setSavingFavorites] = useState(false);

  // Bibliotheque
  const [books, setBooks] = useState<Book[]>([]);
  const [booksLoaded, setBooksLoaded] = useState(false);
  const [bibLoading, setBibLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("tous");
  const [sort, setSort] = useState<Sort>("ajout");
  const [query, setQuery] = useState("");
  const [urlRestored, setUrlRestored] = useState(false);

  const loadProfile = async (uid: string) => {
    const { data } = await supabase
      .from("user_profiles")
      .select("avatar_url, bio, favorite_book_ids")
      .eq("id", uid)
      .single();
    const d = data as { avatar_url?: string | null; bio?: string | null; favorite_book_ids?: number[] | null } | null;
    const url = d?.avatar_url ?? null;
    setAvatarUrl(url);
    setAvatarDraft(url ?? "");
    setBio(d?.bio ?? null);
    setBioDraft(d?.bio ?? "");
    const ids = (d?.favorite_book_ids ?? []).filter(Boolean);
    setFavoriteIds(ids);
    if (ids.length > 0) {
      const { data: favData } = await supabase
        .from("books")
        .select("id, title, author, cover_url, rating")
        .in("id", ids);
      setFavoriteBooks((favData as Book[]) || []);
    }
  };

  useEffect(() => {
    if (userId) loadProfile(userId);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Lit les paramètres URL une seule fois au montage et restaure l'état
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t === "biblio") setTab("biblio");
    const f = params.get("filter");
    if (f && VALID_FILTERS.includes(f as Filter)) setFilter(f as Filter);
    const s = params.get("sort");
    if (s && VALID_SORTS.includes(s as Sort)) setSort(s as Sort);
    const q = params.get("q");
    if (q) setQuery(q);
    setUrlRestored(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Synchronise l'état vers l'URL (sans créer d'entrée dans l'historique)
  useEffect(() => {
    if (!urlRestored) return;
    const params = new URLSearchParams();
    if (tab === "biblio") params.set("tab", "biblio");
    if (filter !== "tous") params.set("filter", filter);
    if (sort !== "ajout") params.set("sort", sort);
    if (query) params.set("q", query);
    const qs = params.toString();
    window.history.replaceState(null, "", `/compte${qs ? `?${qs}` : ""}`);
  }, [tab, filter, sort, query, urlRestored]);

  // Restaure la position de scroll après chargement des livres
  useEffect(() => {
    if (!booksLoaded) return;
    const saved = sessionStorage.getItem("compte-scroll-y");
    if (!saved) return;
    sessionStorage.removeItem("compte-scroll-y");
    requestAnimationFrame(() => window.scrollTo({ top: Number(saved), behavior: "instant" }));
  }, [booksLoaded]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleDeleteAccount = async () => {
    if (!userId) return;
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Suppression échouée");
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Suppression échouée");
      setDeletingAccount(false);
    }
  };

  const handleAvatarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/avatar/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload échoué");
      setAvatarDraft(json.url);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Upload échoué. Réessaie.");
    }
    setAvatarUploading(false);
  };

  const handleSaveAvatar = async () => {
    if (!userId) return;
    setSavingAvatar(true);
    setAvatarError(null);
    const url = avatarDraft.trim() || null;
    const { error } = await supabase
      .from("user_profiles")
      .upsert({ id: userId, avatar_url: url }, { onConflict: "id" });
    setSavingAvatar(false);
    if (error) { setAvatarError(error.message); return; }
    setAvatarUrl(url);
    setEditingAvatar(false);
    window.dispatchEvent(new CustomEvent("profile-updated"));
  };

  const handleSavePseudo = async () => {
    if (!userId) return;
    const name = pseudoDraft.trim();
    if (!name) return;
    setSavingPseudo(true);
    await Promise.all([
      supabase.auth.updateUser({ data: { display_name: name } }),
      supabase.from("user_profiles").upsert({ id: userId, display_name: name }, { onConflict: "id" }),
    ]);
    setSavingPseudo(false);
    setEditingPseudo(false);
    window.dispatchEvent(new CustomEvent("profile-updated"));
  };

  const handleSaveBio = async () => {
    if (!userId) return;
    setSavingBio(true);
    const text = bioDraft.trim() || null;
    await supabase.from("user_profiles").upsert({ id: userId, bio: text }, { onConflict: "id" });
    setSavingBio(false);
    setBio(text);
    setEditingBio(false);
  };

  const handleSelectFavorite = async (slotIndex: number, bookId: number) => {
    if (!userId) return;
    const updated = [...favoriteIds];
    while (updated.length <= slotIndex) updated.push(0);
    updated[slotIndex] = bookId;
    const cleaned = updated.filter(Boolean);
    setSavingFavorites(true);
    await supabase
      .from("user_profiles")
      .upsert({ id: userId, favorite_book_ids: cleaned }, { onConflict: "id" });
    setSavingFavorites(false);
    setFavoriteIds(cleaned);
    const { data: favData } = await supabase
      .from("books")
      .select("id, title, author, cover_url, rating")
      .in("id", cleaned);
    setFavoriteBooks((favData as Book[]) || []);
  };

  const handleRemoveFavorite = async (slotIndex: number) => {
    if (!userId) return;
    const updated = favoriteIds.filter((_, i) => i !== slotIndex);
    await supabase
      .from("user_profiles")
      .upsert({ id: userId, favorite_book_ids: updated }, { onConflict: "id" });
    setFavoriteIds(updated);
    setFavoriteBooks((prev) => prev.filter((b) => updated.includes(b.id)));
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

  const completedCount = books.filter(isCompleted).length;
  let list = books.filter((b) => {
    if (filter === "encours") return b.status === "reading";
    if (filter === "termines") return isCompleted(b);
    if (filter === "recents") return isCompleted(b);
    if (filter === "abandonnes") return b.status === "abandoned";
    if (filter === "notes") return (b.rating || 0) > 0;
    if (filter === "envie") return b.status === "to-read";
    if (filter === "tous") return b.status !== "to-read";
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
    // "Derniers lus" : toujours trié par date de fin de lecture DESC
    if (filter === "recents") {
      const da = a.date_read || a.created_at || "";
      const db = b.date_read || b.created_at || "";
      return db.localeCompare(da);
    }
    // Pour les terminés avec tri ajout, utiliser date_read
    if (sort === "ajout" && filter === "termines") {
      const da = a.date_read || a.created_at || "";
      const db = b.date_read || b.created_at || "";
      return db.localeCompare(da);
    }
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
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-card p-5">
            <div className="relative">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-violet/20"
                />
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-violet font-serif text-3xl font-semibold text-cream">
                  {initial}
                </span>
              )}
            </div>
            <div className="text-center">
              {editingPseudo ? (
                <div className="flex flex-col gap-2 w-full max-w-[220px]">
                  <input
                    value={pseudoDraft}
                    onChange={(e) => setPseudoDraft(e.target.value)}
                    placeholder="Ton pseudo"
                    autoFocus
                    className="rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-violet text-center"
                  />
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setEditingPseudo(false)} className="flex-1 text-xs py-1.5">Annuler</Button>
                    <Button onClick={handleSavePseudo} disabled={savingPseudo} className="flex-1 text-xs py-1.5">
                      {savingPseudo ? "…" : "OK"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 justify-center">
                  <p className="font-serif text-lg font-semibold text-ink">{displayName}</p>
                  <button
                    onClick={() => { setPseudoDraft(displayName); setEditingPseudo(true); }}
                    className="rounded-md border border-line bg-paper px-1.5 py-0.5 text-[10px] font-medium text-muted hover:border-violet/40 hover:text-violet-deep"
                  >
                    Modifier
                  </button>
                </div>
              )}
              <p className="text-xs text-muted">{user?.email}</p>
            </div>
            <button
              onClick={() => { setEditingAvatar((v) => !v); setAvatarError(null); }}
              className="flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-violet/40 hover:text-violet-deep"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l-4 1 1-4L14.5 3.5a2.121 2.121 0 013 3L9 13z" />
              </svg>
              {editingAvatar ? "Fermer" : "Modifier la photo"}
            </button>

            {editingAvatar && (
              <div className="w-full rounded-2xl border border-violet/30 bg-violet-soft p-4">
                {/* Aperçu de la future photo */}
                {avatarDraft ? (
                  <div className="mb-3 flex flex-col items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarDraft} alt="Aperçu" className="h-20 w-20 rounded-full object-cover ring-2 ring-violet/30" />
                    <button
                      onClick={() => setAvatarDraft("")}
                      className="text-[11px] font-medium text-danger underline"
                    >
                      Changer de photo
                    </button>
                  </div>
                ) : (
                  <label className="mb-3 flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-violet/30 bg-input px-4 py-7 text-center transition-colors hover:border-violet hover:bg-violet-soft/60 active:scale-[0.98]">
                    {avatarUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet/20 border-t-violet" />
                        <span className="text-[12px] font-medium text-violet-deep">Envoi en cours…</span>
                      </div>
                    ) : (
                      <>
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-soft text-violet">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                            <circle cx="12" cy="13" r="4" />
                          </svg>
                        </span>
                        <div>
                          <p className="text-[13px] font-semibold text-ink">
                            Choisir une photo
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted">Galerie ou appareil photo · max 10 Mo</p>
                        </div>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarFileUpload}
                      disabled={avatarUploading}
                    />
                  </label>
                )}
                {avatarError && (
                  <p className="mt-1 text-xs font-medium text-danger">{avatarError}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => { setEditingAvatar(false); setAvatarDraft(avatarUrl ?? ""); }}
                    className="flex-1 text-sm"
                  >
                    Annuler
                  </Button>
                  <Button onClick={handleSaveAvatar} disabled={savingAvatar || !avatarDraft || avatarUploading} className="flex-1 text-sm">
                    {savingAvatar ? "Sauvegarde…" : "Sauvegarder"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Bio */}
          <div className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-[15px] font-medium text-ink">Bio</h3>
              {!editingBio && (
                <button
                  onClick={() => { setEditingBio(true); setBioDraft(bio ?? ""); }}
                  className="text-xs font-medium text-violet-deep"
                >
                  {bio ? "Modifier" : "Ajouter"}
                </button>
              )}
            </div>
            {editingBio ? (
              <div className="mt-3 flex flex-col gap-2">
                <textarea
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value)}
                  rows={3}
                  maxLength={280}
                  placeholder="Décris ton rapport aux livres, tes genres favoris…"
                  className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-sm text-ink outline-none focus:border-violet"
                  autoFocus
                />
                <p className="text-right text-[10px] text-muted">{bioDraft.length}/280</p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setEditingBio(false)} className="flex-1 text-sm">
                    Annuler
                  </Button>
                  <Button onClick={handleSaveBio} disabled={savingBio} className="flex-1 text-sm">
                    {savingBio ? "Sauvegarde…" : "Enregistrer"}
                  </Button>
                </div>
              </div>
            ) : bio ? (
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2" style={{ whiteSpace: "pre-line" }}>{bio}</p>
            ) : (
              <p className="mt-2 text-[13px] text-muted">Pas encore de bio.</p>
            )}
          </div>

          {/* Top 4 favoris */}
          <div className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-[15px] font-medium text-ink">Mes 4 favoris</h3>
              {savingFavorites && (
                <span className="text-[11px] text-muted">Sauvegarde…</span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-muted">
              Tes livres coup de cœur, visibles sur ton profil public.
            </p>
            {completedCount < 4 && (
              <p className="mt-1.5 rounded-xl border border-violet/20 bg-violet-soft px-3 py-2 text-[11px] text-muted">
                Pas assez de livres terminés ?{" "}
                <button
                  onClick={() => document.getElementById("import-goodreads")?.scrollIntoView({ behavior: "smooth" })}
                  className="font-semibold text-violet-deep underline underline-offset-2"
                >
                  Importez votre historique Goodreads
                </button>{" "}
                en un clic plus bas !
              </p>
            )}
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((slot) => {
                const bkId = favoriteIds[slot];
                const bk = bkId ? favoriteBooks.find((b) => b.id === bkId) : null;
                return (
                  <div key={slot} className="flex w-full flex-col items-center gap-1.5">
                    {bk ? (
                      <div className="group relative w-full">
                        <Cover
                          id={bk.id}
                          title={bk.title}
                          coverUrl={bk.cover_url}
                          className="aspect-[3/4] w-full cursor-pointer rounded-lg"
                          rounded="rounded-lg"
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg bg-ink/60 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => setPickerSlot(slot)}
                            className="text-[10px] font-semibold text-cream underline"
                          >
                            Changer
                          </button>
                          <button
                            onClick={() => handleRemoveFavorite(slot)}
                            className="text-[10px] font-semibold text-cream/70 underline"
                          >
                            Retirer
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setPickerSlot(slot)}
                        className="flex aspect-[3/4] w-full items-center justify-center rounded-lg border-2 border-dashed border-violet/30 bg-violet-soft text-2xl text-violet/40 transition-colors hover:border-violet/60 hover:text-violet"
                      >
                        +
                      </button>
                    )}
                    <span className="max-w-full truncate text-center text-[9.5px] text-muted">
                      {bk ? bk.title : `Favori ${slot + 1}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Frise historique */}
          <TimelineSection />

          {/* Enrichissement couvertures */}
          <div className="rounded-2xl border border-line bg-card p-4">
            <h3 className="font-serif text-[15px] font-medium text-ink">Couvertures manquantes</h3>
            <p className="mt-0.5 text-[11px] text-muted">
              Récupère automatiquement les couvertures, résumés et genres depuis Google Books.
            </p>
            <div className="mt-3">
              {userId && (
                <EnrichLibrary userId={userId} onDone={() => setBooksLoaded(false)} />
              )}
            </div>
          </div>

          {/* Import Goodreads */}
          <div id="import-goodreads" className="rounded-2xl border border-line bg-card p-4">
            <h3 className="font-serif text-[15px] font-medium text-ink">Import Goodreads</h3>
            <div className="mt-3">
              {userId && (
                <GoodreadsImport
                  userId={userId}
                  onDone={() => { setBooksLoaded(false); }}
                />
              )}
            </div>
          </div>

          {/* Liens rapides */}
          <div className="flex flex-col gap-2">
            {user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL && (
              <Link
                href="/admin"
                className="flex items-center justify-between rounded-2xl border border-violet/30 bg-violet-soft p-4 transition-colors hover:border-violet/60"
              >
                <div>
                  <p className="font-serif text-[15px] font-medium text-violet-deep">Administration</p>
                  <p className="mt-0.5 text-xs text-muted">Fusion de livres, outils admin</p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-violet-deep">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
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
                <p className="mt-0.5 text-xs text-muted">Tableau de bord &amp; objectifs</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-muted">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Toggle mode sombre */}
          <button
            onClick={toggleDark}
            className="flex w-full items-center justify-between rounded-2xl border border-line bg-card p-4 transition-colors hover:border-violet/40"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{darkMode ? "☀️" : "🌙"}</span>
              <div>
                <p className="text-left font-serif text-[15px] font-medium text-ink">
                  {darkMode ? "Mode clair" : "Mode sombre"}
                </p>
                <p className="text-left text-xs text-muted">
                  {darkMode ? "Revenir au thème clair" : "Activer le thème sombre"}
                </p>
              </div>
            </div>
            <div className={`relative h-6 w-11 rounded-full transition-colors ${darkMode ? "bg-violet" : "bg-line"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-cream shadow transition-transform ${darkMode ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
          </button>

          {/* Toggle notifications */}
          {notifStatus !== null && (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleToggleNotif}
                disabled={notifLoading || notifStatus === "denied"}
                className="flex w-full items-center justify-between rounded-2xl border border-line bg-card p-4 transition-colors hover:border-violet/40 disabled:opacity-60"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">🔔</span>
                  <div>
                    <p className="text-left font-serif text-[15px] font-medium text-ink">Notifications</p>
                    <p className="text-left text-xs text-muted">
                      {notifStatus === "denied"
                        ? "Bloquées dans les réglages du navigateur"
                        : notifEnabled
                        ? "Activées"
                        : "Désactivées"}
                    </p>
                  </div>
                </div>
                {notifStatus !== "denied" && (
                  <div className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${notifEnabled ? "bg-violet" : "bg-line"}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-cream shadow transition-transform ${notifEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                )}
              </button>
              {notifEnabled && (
                <button
                  onClick={handleTestNotif}
                  className="rounded-2xl border border-line bg-card px-4 py-2.5 text-left text-[12px] font-medium text-muted transition-colors hover:border-violet/40 hover:text-violet-deep"
                >
                  {notifTestResult ?? "Envoyer une notification test"}
                </button>
              )}
            </div>
          )}

          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full border-danger/30 text-danger hover:bg-[#f6e7e1]"
          >
            Se déconnecter
          </Button>

          <button
            onClick={() => { setShowDeleteConfirm(true); setDeleteError(null); }}
            className="w-full rounded-2xl border border-transparent py-2 text-[12px] font-medium text-muted transition-colors hover:text-danger"
          >
            Supprimer mon compte
          </button>
        </div>
      )}

      {/* ── Modale suppression compte ── */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm px-4 pt-4 pb-24 [touch-action:none]"
          onClick={() => !deletingAccount && setShowDeleteConfirm(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-t-3xl bg-paper p-6 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f6e7e1] text-danger">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
            <h3 className="font-serif text-lg font-bold text-ink">Supprimer mon compte</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
              Cette action est <span className="font-semibold text-danger">irréversible</span>. Tous tes livres, sessions de lecture, statistiques et ton profil seront définitivement supprimés.
            </p>
            {deleteError && (
              <p className="mt-3 rounded-xl border border-[#e7c7bd] bg-[#f6e7e1] px-3 py-2 text-xs font-medium text-danger">
                {deleteError}
              </p>
            )}
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="w-full rounded-2xl bg-danger py-3 text-[14px] font-semibold text-cream transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {deletingAccount ? "Suppression…" : "Oui, supprimer définitivement"}
              </button>
              <Button
                variant="ghost"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingAccount}
                className="w-full"
              >
                Annuler
              </Button>
            </div>
          </div>
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
            className="w-full rounded-2xl border border-line bg-input px-4 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-violet"
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

      {/* Picker favoris — charge ses propres livres depuis Supabase */}
      {pickerSlot !== null && userId && (
        <FavoriteBookPicker
          userId={userId}
          current={favoriteIds}
          slotIndex={pickerSlot}
          onSelect={(id) => {
            handleSelectFavorite(pickerSlot, id);
            setPickerSlot(null);
          }}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  );
}

function GridCard({ book }: { book: Book }) {
  const p = pct(book);
  const done = isCompleted(book);
  const abandoned = book.status === "abandoned";
  const wantToRead = book.status === "to-read";
  const rating = book.rating || 0;
  return (
    <Link
      href={`/livre/${book.id}`}
      onClick={() => sessionStorage.setItem("compte-scroll-y", String(window.scrollY))}
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
        {wantToRead ? (
          <span className="flex items-center gap-1 text-[10.5px] font-semibold text-violet-deep">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
            Envie de lire
          </span>
        ) : (
          <>
            <span className="text-[11px] font-semibold text-ink-2">
              <span className="text-gold">★</span>{" "}
              {rating > 0 ? rating.toFixed(1).replace(".", ",") : "—"}
            </span>
            {done ? (
              <span className="text-[10.5px] font-semibold text-success">Terminé</span>
            ) : abandoned ? (
              <span className="text-[10.5px] font-semibold text-muted">Abandonné</span>
            ) : (
              <span className="text-[10.5px] font-semibold text-violet-deep">{p}%</span>
            )}
          </>
        )}
      </div>
      {!done && !abandoned && !wantToRead && <ProgressBar value={p / 100} className="h-1" />}
    </Link>
  );
}

