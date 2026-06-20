"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { searchBooks, type BookSuggestion } from "../lib/googleBooks";
import type { Book } from "../lib/types";
import { Modal, Button, FieldLabel, inputClass, Cover } from "./ui";

type Draft = { title: string; author: string; pages: string; genre: string; year: string };
const emptyDraft: Draft = { title: "", author: "", pages: "", genre: "", year: "" };

// Club books carry extra fields not in BookSuggestion
type ClubSuggestion = BookSuggestion & { pages?: number; memberCount?: number };

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
  const [clubResults, setClubResults] = useState<ClubSuggestion[]>([]);
  const [ownResults, setOwnResults] = useState<{ id: number; title: string; author: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ClubSuggestion | null>(null);
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
      setOwnResults([]);
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
      setOwnResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    debounce.current = setTimeout(async () => {
      try {
        const q = query.trim();
        const [googleData, { data: clubData }, { data: ownData }] = await Promise.all([
          searchBooks(query).catch((e: unknown): BookSuggestion[] => {
            const msg = e instanceof Error ? e.message : "";
            if (/quota|429|indisponible/i.test(msg)) {
              setError("Google Books indisponible pour le moment. Utilise la saisie manuelle.");
            }
            return [];
          }),
          // Livres d'autres membres
          supabase
            .from("books")
            .select("*")
            .ilike("title", `%${q}%`)
            .neq("user_id", user?.id ?? "")
            .limit(8),
          // Livres déjà dans la bibliothèque de l'utilisateur
          supabase
            .from("books")
            .select("id, title, author, cover_url, status")
            .ilike("title", `%${q}%`)
            .eq("user_id", user?.id ?? "")
            .limit(3),
        ]);

        // Propres livres de l'utilisateur
        setOwnResults(
          ((ownData as Pick<Book, "id" | "title" | "author">[]) || []).slice(0, 3)
        );

        // Déduplique les livres du club par titre+auteur (prend le plus complet)
        const seen = new Map<string, Book>();
        ((clubData as Book[]) || []).forEach((b) => {
          const key = `${b.title.toLowerCase().trim()}__${(b.author || "").toLowerCase().trim()}`;
          const existing = seen.get(key);
          if (!existing || (!existing.cover_url && b.cover_url) || (!existing.summary && b.summary)) {
            seen.set(key, b);
          }
        });

        // Compte le nombre de membres ayant chaque livre
        const titleCount = new Map<string, number>();
        ((clubData as Book[]) || []).forEach((b) => {
          const key = `${b.title.toLowerCase().trim()}__${(b.author || "").toLowerCase().trim()}`;
          titleCount.set(key, (titleCount.get(key) || 0) + 1);
        });

        const club: ClubSuggestion[] = Array.from(seen.values()).map((b) => {
          const key = `${b.title.toLowerCase().trim()}__${(b.author || "").toLowerCase().trim()}`;
          return {
            googleId: `club-${b.id}`,
            title: b.title,
            author: b.author,
            coverUrl: b.cover_url ?? null,
            genre: b.genre ?? null,
            year: b.published_year ?? null,
            summary: b.summary ?? null,
            pages: b.pages || undefined,
            memberCount: titleCount.get(key) || 1,
          };
        });

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
    await insertBook({ ...selected, cover_url: selected.coverUrl, year: selected.year, pages: n });
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

  // ---- Vue : confirmation ----
  if (selected) {
    const fromClub = selected.googleId.startsWith("club-");
    return (
      <Modal open={open} onClose={onClose} title="Ajouter un livre">
        <div className="flex flex-col gap-4">
          <div className="flex gap-3 rounded-2xl border border-line bg-card p-3">
            <Cover id={0} title={selected.title} coverUrl={selected.coverUrl} className="h-[84px] w-[58px]" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="font-serif text-base font-medium text-ink">{selected.title}</h3>
                {fromClub && (
                  <span className="shrink-0 rounded-md bg-violet-soft px-1.5 py-0.5 text-[10px] font-semibold text-violet-deep">
                    Club
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
                ? "Métadonnées pré-remplies depuis le club. Ajuste le nombre de pages si ton édition diffère."
                : "La couverture, le genre et le résumé sont remplis automatiquement."}
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
  const hasOwn = ownResults.length > 0;
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

          {/* Déjà dans ta bibliothèque */}
          {hasOwn && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#b8890a]">
                Déjà dans ta bibliothèque
              </p>
              {ownResults.map((r) => (
                <Link
                  key={r.id}
                  href={`/livre/${r.id}`}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-[#fdf7e9] p-3 transition-colors hover:border-gold"
                >
                  <Cover id={r.id} title={r.title} coverUrl={null} className="h-[52px] w-[36px]" />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-serif text-[14px] font-medium text-ink">{r.title}</h3>
                    <p className="truncate text-[11px] text-muted">{r.author}</p>
                  </div>
                  <span className="shrink-0 rounded-xl bg-[#f0e4c8] px-2.5 py-1.5 text-[11px] font-semibold text-[#b8890a]">
                    Voir →
                  </span>
                </Link>
              ))}
            </>
          )}

          {/* Livres du club */}
          {hasClub && (
            <>
              <p className={`text-[11px] font-semibold uppercase tracking-wide text-violet-deep${hasOwn ? " mt-1" : ""}`}>
                Déjà partagé dans le club
              </p>
              {clubResults.map((r) => (
                <button
                  key={r.googleId}
                  onClick={() => {
                    setSelected(r);
                    setError(null);
                    setPages(r.pages ? String(r.pages) : "");
                  }}
                  className="flex items-center gap-3 rounded-2xl border border-violet/30 bg-violet-soft p-3 text-left transition-colors hover:border-violet"
                >
                  <Cover id={0} title={r.title} coverUrl={r.coverUrl} className="h-[66px] w-[46px]" />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-serif text-[15px] font-medium text-ink">{r.title}</h3>
                    <p className="truncate text-[11.5px] text-muted">{r.author}</p>
                    <p className="mt-0.5 truncate text-[10.5px] font-medium text-muted">
                      {[r.genre, r.year].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {(r.memberCount ?? 0) > 1 && (
                      <p className="mt-0.5 text-[10px] font-medium text-violet-deep">
                        {r.memberCount} membres
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="rounded-xl bg-violet px-2.5 py-1.5 text-[11px] font-semibold text-cream">
                      Ajouter
                    </span>
                    {r.pages && (
                      <span className="text-[9.5px] font-medium text-muted">{r.pages} p.</span>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Google Books */}
          {!loading && query.trim().length >= 3 && !hasGoogle && !hasClub && !hasOwn && !error && (
            <p className="text-xs font-medium text-muted">Aucun résultat.</p>
          )}
          {hasGoogle && (
            <>
              {(hasClub || hasOwn) && (
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
                  <span className="shrink-0 rounded-xl bg-violet px-2.5 py-1.5 text-[11px] font-semibold text-cream">
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
