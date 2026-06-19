"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { searchBooks, type BookSuggestion } from "../lib/googleBooks";
import type { Book } from "../lib/types";
import { Modal, Button, FieldLabel, inputClass, Cover } from "./ui";

type Draft = { title: string; author: string; pages: string; genre: string; year: string };
const emptyDraft: Draft = { title: "", author: "", pages: "", genre: "", year: "" };

export default function AddBookModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (message: string) => void;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookSuggestion[]>([]);
  const [clubResults, setClubResults] = useState<BookSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<BookSuggestion | null>(null);
  const [manual, setManual] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [pages, setPages] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setClubResults([]);
      setSelected(null);
      setManual(false);
      setDraft(emptyDraft);
      setPages("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || selected || manual) return;
    clearTimeout(debounce.current);
    if (query.trim().length < 3) {
      setResults([]);
      setClubResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    debounce.current = setTimeout(async () => {
      try {
        const [googleData, { data: clubData }] = await Promise.all([
          searchBooks(query).catch(() => []),
          supabase
            .from("books")
            .select("*")
            .ilike("title", `%${query.trim()}%`)
            .neq("user_id", user?.id ?? "")
            .limit(5),
        ]);

        // Déduplique les livres du club par titre+auteur, prend le plus complet
        const seen = new Map<string, Book>();
        ((clubData as Book[]) || []).forEach((b) => {
          const key = `${b.title.toLowerCase().trim()}__${(b.author || "").toLowerCase().trim()}`;
          const existing = seen.get(key);
          if (!existing || (!existing.cover_url && b.cover_url) || (!existing.summary && b.summary)) {
            seen.set(key, b);
          }
        });

        const club: BookSuggestion[] = Array.from(seen.values()).map((b) => ({
          googleId: `club-${b.id}`,
          title: b.title,
          author: b.author,
          coverUrl: b.cover_url ?? null,
          genre: b.genre ?? null,
          year: b.published_year ?? null,
          summary: b.summary ?? null,
        }));

        setClubResults(club);
        setResults(googleData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Recherche indisponible.");
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(debounce.current);
  }, [query, open, selected, manual, user?.id]);

  const insertBook = async (b: {
    title: string;
    author: string;
    pages: number;
    cover_url?: string | null;
    genre?: string | null;
    year?: number | null;
    summary?: string | null;
  }) => {
    if (!user) return false;
    setSaving(true);
    setError(null);
    const { error: dbError } = await supabase.from("books").insert({
      title: b.title,
      author: b.author || "Auteur inconnu",
      pages: b.pages,
      progress: 0,
      status: "reading",
      cover_url: b.cover_url ?? null,
      rating: 0,
      genre: b.genre ?? null,
      published_year: b.year ?? null,
      summary: b.summary ?? null,
      user_id: user.id,
    });
    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return false;
    }
    onAdded(`« ${b.title} » ajouté à ta bibliothèque.`);
    onClose();
    return true;
  };

  const handleAddSelected = async () => {
    if (!selected) return;
    const n = Number(pages);
    if (!pages || isNaN(n) || n <= 0) {
      setError("Indique le nombre de pages de ton édition.");
      return;
    }
    await insertBook({ ...selected, pages: n });
  };

  const handleAddManual = async () => {
    const n = Number(draft.pages);
    if (!draft.title.trim()) return setError("Le titre est obligatoire.");
    if (!draft.pages || isNaN(n) || n <= 0) return setError("Indique le nombre de pages.");
    await insertBook({
      title: draft.title.trim(),
      author: draft.author.trim(),
      pages: n,
      genre: draft.genre.trim() || null,
      year: draft.year ? Number(draft.year) : null,
    });
  };

  // ---- Vue : confirmation (Google Books ou Club) ----
  if (selected) {
    const fromClub = selected.googleId.startsWith("club-");
    return (
      <Modal open={open} onClose={onClose} title="Ajouter un livre">
        <div className="flex flex-col gap-4">
          <div className="flex gap-3 rounded-2xl border border-line bg-card p-3">
            <Cover id={0} title={selected.title} coverUrl={selected.coverUrl} className="h-[84px] w-[58px]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-base font-medium text-ink">{selected.title}</h3>
                {fromClub && (
                  <span className="shrink-0 rounded-md bg-violet-soft px-1.5 py-0.5 text-[10px] font-semibold text-violet-deep">
                    Du club
                  </span>
                )}
              </div>
              <p className="text-xs text-muted">{selected.author}</p>
              <p className="mt-1 text-[11px] font-medium text-muted">
                {[selected.genre, selected.year].filter(Boolean).join(" · ") || "Genre non renseigné"}
              </p>
            </div>
          </div>
          <div>
            <FieldLabel>Nombre de pages de ton édition</FieldLabel>
            <input
              type="number"
              min={1}
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              placeholder="ex. 384"
              className={inputClass + " text-base font-semibold"}
              autoFocus
            />
            <p className="mt-1.5 text-[11px] leading-4 text-muted">
              {fromClub
                ? "Toutes les informations sont pré-remplies depuis le club. Tu peux ajuster le nombre de pages si ton édition est différente."
                : "Le genre, l'année, la couverture et le résumé sont remplis automatiquement."}
            </p>
          </div>
          {error && <p className="text-xs font-medium text-danger">{error}</p>}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setSelected(null)} className="flex-1">
              ‹ Retour
            </Button>
            <Button onClick={handleAddSelected} disabled={saving} className="flex-1">
              {saving ? "Ajout…" : "Ajouter le livre"}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // ---- Vue : saisie manuelle ----
  if (manual) {
    return (
      <Modal open={open} onClose={onClose} title="Ajouter un livre">
        <div className="flex flex-col gap-3">
          <div>
            <FieldLabel>Titre *</FieldLabel>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className={inputClass}
              autoFocus
            />
          </div>
          <div>
            <FieldLabel>Auteur</FieldLabel>
            <input
              value={draft.author}
              onChange={(e) => setDraft({ ...draft, author: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <FieldLabel>Pages *</FieldLabel>
              <input
                type="number"
                min={1}
                value={draft.pages}
                onChange={(e) => setDraft({ ...draft, pages: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="flex-1">
              <FieldLabel>Année</FieldLabel>
              <input
                type="number"
                value={draft.year}
                onChange={(e) => setDraft({ ...draft, year: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <FieldLabel>Genre</FieldLabel>
            <input
              value={draft.genre}
              onChange={(e) => setDraft({ ...draft, genre: e.target.value })}
              placeholder="Roman, Fantasy…"
              className={inputClass}
            />
          </div>
          {error && <p className="text-xs font-medium text-danger">{error}</p>}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setManual(false)} className="flex-1">
              ‹ Recherche
            </Button>
            <Button onClick={handleAddManual} disabled={saving} className="flex-1">
              {saving ? "Ajout…" : "Ajouter le livre"}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // ---- Vue : recherche ----
  const hasClub = clubResults.length > 0;
  const hasGoogle = results.length > 0;

  return (
    <Modal open={open} onClose={onClose} title="Ajouter un livre">
      <div className="flex flex-col gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Titre ou auteur…"
          className={inputClass}
          autoFocus
        />
        {loading && <p className="text-xs font-medium text-muted">Recherche en cours…</p>}
        {error && <p className="text-xs font-medium text-danger">{error}</p>}

        <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {/* Livres du club */}
          {hasClub && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-deep">
                Dans le club
              </p>
              {clubResults.map((r) => (
                <button
                  key={r.googleId}
                  onClick={() => { setSelected(r); setError(null); setPages(""); }}
                  className="flex items-center gap-3 rounded-2xl border border-violet/30 bg-violet-soft p-3 text-left transition-colors hover:border-violet"
                >
                  <Cover id={0} title={r.title} coverUrl={r.coverUrl} className="h-[66px] w-[46px]" />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-serif text-[15px] font-medium text-ink">{r.title}</h3>
                    <p className="truncate text-[11.5px] text-muted">{r.author}</p>
                    <p className="mt-0.5 truncate text-[10.5px] font-medium text-muted">
                      {[r.genre, r.year].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <span className="rounded-xl bg-violet px-3 py-2 text-xs font-semibold text-cream">
                    Reprendre
                  </span>
                </button>
              ))}
            </>
          )}

          {/* Google Books */}
          {!loading && query.trim().length >= 3 && !hasGoogle && !hasClub && !error && (
            <p className="text-xs font-medium text-muted">Aucun résultat.</p>
          )}
          {hasGoogle && (
            <>
              {hasClub && (
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Google Books
                </p>
              )}
              {results.map((r) => (
                <button
                  key={r.googleId}
                  onClick={() => { setSelected(r); setError(null); setPages(""); }}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 text-left transition-colors hover:border-violet"
                >
                  <Cover id={0} title={r.title} coverUrl={r.coverUrl} className="h-[66px] w-[46px]" />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-serif text-[15px] font-medium text-ink">{r.title}</h3>
                    <p className="truncate text-[11.5px] text-muted">{r.author}</p>
                    <p className="mt-0.5 truncate text-[10.5px] font-medium text-muted">
                      {[r.genre, r.year].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <span className="rounded-xl bg-violet px-3 py-2 text-xs font-semibold text-cream">
                    Choisir
                  </span>
                </button>
              ))}
            </>
          )}
        </div>

        <button
          onClick={() => { setManual(true); setError(null); setDraft({ ...emptyDraft, title: query.trim() }); }}
          className="mt-1 text-center text-xs font-medium text-violet-deep underline decoration-violet/40 underline-offset-2"
        >
          Saisir le livre manuellement
        </button>
      </div>
    </Modal>
  );
}
