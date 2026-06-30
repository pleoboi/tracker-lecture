"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { searchBooks, type BookSuggestion } from "../lib/googleBooks";
import type { Book } from "../lib/types";
import { Modal, Button, FieldLabel, inputClass, Cover } from "./ui";
import CoverPickerModal from "./CoverPickerModal";

type Status = "to-read" | "reading" | "completed";

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "to-read", label: "Envie de lire" },
  { value: "reading", label: "En cours" },
  { value: "completed", label: "Terminé ✓" },
];

type Draft = { title: string; author: string; pages: string; genre: string; year: string };
const emptyDraft: Draft = { title: "", author: "", pages: "", genre: "", year: "" };

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

  // Champs communs
  const [status, setStatus] = useState<Status>("reading");
  const [pages, setPages] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rating, setRating] = useState(0);

  const [currentPage, setCurrentPage] = useState("");
  const [localCoverUrl, setLocalCoverUrl] = useState<string | null>(null);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
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
      setStatus("reading");
      setPages("");
      setCurrentPage("");
      setStartDate("");
      setEndDate("");
      setRating(0);
      setError(null);
      setLocalCoverUrl(null);
      setShowCoverPicker(false);
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
          supabase
            .from("books")
            .select("*")
            .ilike("title", `%${q}%`)
            .neq("user_id", user?.id ?? "")
            .limit(8),
          supabase
            .from("books")
            .select("id, title, author, cover_url, status")
            .ilike("title", `%${q}%`)
            .eq("user_id", user?.id ?? "")
            .limit(3),
        ]);

        setOwnResults(
          ((ownData as Pick<Book, "id" | "title" | "author">[]) || []).slice(0, 3)
        );

        const seen = new Map<string, Book>();
        ((clubData as Book[]) || []).forEach((b) => {
          const key = `${b.title.toLowerCase().trim()}__${(b.author || "").toLowerCase().trim()}`;
          const existing = seen.get(key);
          if (!existing || (!existing.cover_url && b.cover_url) || (!existing.summary && b.summary)) {
            seen.set(key, b);
          }
        });

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

    const { data: existing } = await supabase
      .from("books")
      .select("id")
      .eq("user_id", user.id)
      .ilike("title", b.title)
      .limit(1);

    if (existing && existing.length > 0) {
      setError("Ce livre est déjà dans ta bibliothèque.");
      setSaving(false);
      return false;
    }

    const bookData: Record<string, unknown> = {
      title: b.title,
      author: b.author || "Auteur inconnu",
      pages: b.pages,
      progress: status === "completed" ? b.pages : (currentPage ? Math.min(Number(currentPage), b.pages) : 0),
      status,
      cover_url: b.cover_url ?? null,
      rating: rating || 0,
      genre: b.genre ?? null,
      published_year: b.year ?? null,
      summary: b.summary ?? null,
      user_id: user.id,
    };

    if (status === "reading" && startDate) bookData.date_started = startDate;
    if (status === "completed") {
      if (startDate) bookData.date_started = startDate;
      if (endDate) bookData.date_read = endDate;
    }

    const { data: inserted, error: dbError } = await supabase
      .from("books")
      .insert(bookData)
      .select("id")
      .single();

    if (dbError || !inserted) {
      setError(dbError?.message ?? "Erreur lors de l'ajout.");
      setSaving(false);
      return false;
    }

    if (status === "completed" && endDate && b.pages > 0) {
      if (startDate && startDate !== endDate && b.pages > 1) {
        await supabase.from("reading_logs").insert([
          { book_id: inserted.id, date: startDate, pages_read: 1, end_page: 1, user_id: user.id },
          { book_id: inserted.id, date: endDate, pages_read: b.pages - 1, end_page: b.pages, user_id: user.id },
        ]);
      } else {
        await supabase.from("reading_logs").insert({
          book_id: inserted.id,
          date: endDate,
          pages_read: b.pages,
          end_page: b.pages,
          user_id: user.id,
        });
      }
    }

    setSaving(false);
    const msgs: Record<Status, string> = {
      "to-read": `« ${b.title} » ajouté à ta liste Envie de lire.`,
      "reading": `« ${b.title} » ajouté à tes lectures en cours.`,
      "completed": `« ${b.title} » marqué comme terminé.`,
    };
    onAdded(msgs[status]);
    onClose();
    return true;
  };

  const handleAddSelected = async () => {
    if (!selected) return;
    const n = pages ? Number(pages) : (selected.pages ?? 0);
    await insertBook({
      ...selected,
      cover_url: localCoverUrl ?? selected.coverUrl,
      year: selected.year,
      pages: n,
    });
  };

  const handleAddManual = async () => {
    const n = draft.pages ? Number(draft.pages) : 0;
    if (!draft.title.trim()) return setError("Le titre est obligatoire.");
    await insertBook({
      title: draft.title.trim(),
      author: draft.author.trim(),
      pages: n,
      genre: draft.genre.trim() || null,
      year: draft.year ? Number(draft.year) : null,
    });
  };

  // Champs conditionnels partagés entre "selected" et "manual"
  const renderStatusFields = (autoFocusPages = false) => (
    <>
      {/* Statut */}
      <div>
        <FieldLabel>Où en es-tu ?</FieldLabel>
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatus(s.value)}
              className={`flex-1 rounded-xl border py-2.5 text-xs font-semibold transition-colors ${
                status === s.value
                  ? "border-violet bg-violet-soft text-violet-deep"
                  : "border-line bg-card text-muted hover:border-violet/40"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Note — Terminé seulement */}
      {status === "completed" && (
        <div>
          <FieldLabel>Note (optionnel)</FieldLabel>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRating(rating === s ? 0 : s)}
                className="p-1 text-2xl leading-none"
              >
                <span style={{ color: s <= rating ? "#c9a227" : "#dad2c2" }}>★</span>
              </button>
            ))}
            {rating > 0 && <span className="ml-1 text-xs text-muted">{rating}/5</span>}
          </div>
        </div>
      )}

      {/* Pages totales — En cours et Terminé */}
      {status !== "to-read" && (
        <div>
          <FieldLabel>Nombre de pages total (optionnel)</FieldLabel>
          <input
            type="number"
            min={1}
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            placeholder="ex. 384"
            className={inputClass}
            autoFocus={autoFocusPages}
          />
        </div>
      )}

      {/* Page actuelle — En cours seulement */}
      {status === "reading" && (
        <div>
          <FieldLabel>Page actuelle (optionnel)</FieldLabel>
          <input
            type="number"
            min={0}
            value={currentPage}
            onChange={(e) => setCurrentPage(e.target.value)}
            placeholder="ex. 47"
            className={inputClass}
          />
        </div>
      )}

      {/* Date de début — En cours et Terminé */}
      {(status === "reading" || status === "completed") && (
        <div>
          <FieldLabel>Date de début (optionnel)</FieldLabel>
          <input
            type="date"
            value={startDate}
            max={endDate || undefined}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      {/* Date de fin — Terminé seulement */}
      {status === "completed" && (
        <div>
          <FieldLabel>Date de fin (optionnel)</FieldLabel>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
          />
        </div>
      )}
    </>
  );

  // ---- Vue : confirmation après sélection d'un livre ----
  if (selected) {
    const fromClub = selected.googleId.startsWith("club-");
    const activeCover = localCoverUrl ?? selected.coverUrl;
    const btnLabel = saving
      ? "Ajout…"
      : status === "to-read"
        ? "Ajouter à ma liste"
        : status === "reading"
          ? "Commencer la lecture"
          : "Marquer comme terminé";

    return (
      <>
        <Modal open={open} onClose={onClose} title="Ajouter un livre">
          <div className="flex flex-col gap-4">
            {/* Aperçu du livre */}
            <div className="flex gap-3 rounded-2xl border border-line bg-card p-3">
              <div className="relative shrink-0">
                <Cover id={0} title={selected.title} coverUrl={activeCover} className="h-[84px] w-[58px]" />
                <button
                  onClick={() => setShowCoverPicker(true)}
                  className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet text-[9px] text-cream shadow"
                  title="Changer la couverture"
                >✎</button>
              </div>
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

            {renderStatusFields(status !== "to-read")}

            {error && <p className="text-xs font-medium text-danger">{error}</p>}

            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setSelected(null)} className="flex-1">
                ‹ Retour
              </Button>
              <Button onClick={handleAddSelected} disabled={saving} className="flex-1">
                {btnLabel}
              </Button>
            </div>
          </div>
        </Modal>

        {showCoverPicker && (
          <CoverPickerModal
            title={selected.title}
            author={selected.author}
            currentCover={activeCover}
            onPick={(url) => { setLocalCoverUrl(url); setShowCoverPicker(false); }}
            onClose={() => setShowCoverPicker(false)}
          />
        )}
      </>
    );
  }

  // ---- Vue : saisie manuelle ----
  if (manual) {
    const btnLabel = saving
      ? "Ajout…"
      : status === "to-read"
        ? "Ajouter à ma liste"
        : status === "reading"
          ? "Commencer la lecture"
          : "Marquer comme terminé";

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
              <FieldLabel>Année</FieldLabel>
              <input
                type="number"
                value={draft.year}
                onChange={(e) => setDraft({ ...draft, year: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="flex-1">
              <FieldLabel>Genre</FieldLabel>
              <input
                value={draft.genre}
                onChange={(e) => setDraft({ ...draft, genre: e.target.value })}
                placeholder="Roman, Fantasy…"
                className={inputClass}
              />
            </div>
          </div>

          {renderStatusFields()}

          {error && <p className="text-xs font-medium text-danger">{error}</p>}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setManual(false)} className="flex-1">
              ‹ Recherche
            </Button>
            <Button onClick={handleAddManual} disabled={saving} className="flex-1">
              {btnLabel}
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
                    setCurrentPage("");
                    setStatus("reading");
                    setStartDate("");
                    setEndDate("");
                    setRating(0);
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
                  Catalogue
                </p>
              )}
              {results.map((r) => (
                <button
                  key={r.googleId}
                  onClick={() => {
                    setSelected(r);
                    setError(null);
                    setPages("");
                    setStatus("reading");
                    setStartDate("");
                    setEndDate("");
                    setRating(0);
                  }}
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
          onClick={() => {
            setManual(true);
            setError(null);
            setDraft({ ...emptyDraft, title: query.trim() });
            setStatus("reading");
            setPages("");
            setCurrentPage("");
            setStartDate("");
            setEndDate("");
            setRating(0);
          }}
          className="mt-1 text-center text-xs font-medium text-violet-deep underline decoration-violet/40 underline-offset-2"
        >
          Saisir le livre manuellement
        </button>
      </div>
    </Modal>
  );
}
