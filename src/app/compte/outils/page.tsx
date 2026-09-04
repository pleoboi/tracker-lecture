"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import type { Book } from "../../../lib/types";
import { Button } from "../../../components/ui";
import ReferralSection from "../../../components/ReferralSection";
import { searchBooks, fetchOpenLibraryCover, isFrench } from "../../../lib/googleBooks";

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

    // ── Phase 1 : déduplication (ISBN13 → œuvre Open Library → similarité titre) ─
    const { data: existing } = await supabase
      .from("books")
      .select("id, title, author, isbn13, openlibrary_work_id")
      .eq("user_id", userId);

    const existingBooks = (existing as (Pick<Book, "title" | "author" | "openlibrary_work_id"> & { id: number; isbn13?: string | null })[]) || [];
    const existingIsbns = new Set(existingBooks.map((b) => b.isbn13).filter(Boolean) as string[]);

    // B — Œuvre Open Library : une édition anglaise et sa traduction française ont
    // des ISBN totalement différents et des titres sans similarité textuelle, donc
    // ni le match ISBN ni la similarité de titre ne peuvent les rapprocher. Open
    // Library regroupe toutes les éditions/traductions d'un livre sous un même
    // identifiant "œuvre" (ex: OL82563W), résolu par ISBN.
    const isbnsNeedingResolution = new Set<string>();
    existingBooks.forEach((b) => { if (b.isbn13 && !b.openlibrary_work_id) isbnsNeedingResolution.add(b.isbn13); });
    preview.forEach((r) => { if (r.isbn13) isbnsNeedingResolution.add(r.isbn13); });

    const workIdByIsbn = new Map<string, string | null>();
    existingBooks.forEach((b) => { if (b.isbn13 && b.openlibrary_work_id) workIdByIsbn.set(b.isbn13, b.openlibrary_work_id); });
    if (isbnsNeedingResolution.size) {
      try {
        const res = await fetch("/api/openlibrary/work-id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isbns: [...isbnsNeedingResolution] }),
        });
        const data = await res.json() as { workIds?: Record<string, string | null> };
        for (const [isbn, workId] of Object.entries(data.workIds ?? {})) {
          if (workId) workIdByIsbn.set(isbn, workId);
        }
      } catch { /* Open Library indisponible : on continue sans cette détection */ }
    }

    // Met en cache les work id nouvellement résolus sur les livres existants qui
    // n'en avaient pas encore, pour accélérer les prochains imports.
    const toCache = existingBooks.filter((b) => b.isbn13 && !b.openlibrary_work_id && workIdByIsbn.get(b.isbn13));
    if (toCache.length) {
      await Promise.all(
        toCache.map((b) => supabase.from("books").update({ openlibrary_work_id: workIdByIsbn.get(b.isbn13!) }).eq("id", b.id))
      );
    }

    const existingWorkIds = new Set(
      existingBooks.map((b) => b.isbn13 ? workIdByIsbn.get(b.isbn13) : null).filter(Boolean) as string[]
    );

    const toInsert = preview.filter((r) => {
      // A — Match ISBN13 exact
      if (r.isbn13 && existingIsbns.has(r.isbn13)) return false;
      // B — Même œuvre Open Library (doublon multilingue)
      if (r.isbn13) {
        const workId = workIdByIsbn.get(r.isbn13);
        if (workId && existingWorkIds.has(workId)) return false;
      }
      // C — Similarité titre+auteur (Dice ≥ 85 %) — doublons même langue
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
        openlibrary_work_id: r.isbn13 ? (workIdByIsbn.get(r.isbn13) ?? null) : null,
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
      <div className="rounded-2xl border border-success-soft bg-success-soft p-4">
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

// ── Timeline Historique (aperçu) ────────────────────────────────────────────

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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function OutilsPage() {
  const { user } = useAuth();
  const userId = user?.id;

  return (
    <div className="animate-fadeIn flex flex-col gap-5 pt-4">
      <header className="flex items-center gap-3">
        <Link href="/compte" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink">
          ‹
        </Link>
        <h1 className="font-serif text-2xl font-black text-ink">Outils avancés</h1>
      </header>

      <TimelineSection />

      <div className="rounded-2xl border border-line bg-card p-4">
        <h3 className="font-serif text-[15px] font-medium text-ink">Couvertures manquantes</h3>
        <p className="mt-0.5 text-[11px] text-muted">
          Récupère automatiquement les couvertures, résumés et genres depuis Google Books.
        </p>
        <div className="mt-3">
          {userId && <EnrichLibrary userId={userId} onDone={() => {}} />}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-card p-4">
        <h3 className="font-serif text-[15px] font-medium text-ink">Import Goodreads</h3>
        <div className="mt-3">
          {userId && <GoodreadsImport userId={userId} onDone={() => {}} />}
        </div>
      </div>

      <ReferralSection userId={userId} />
    </div>
  );
}
