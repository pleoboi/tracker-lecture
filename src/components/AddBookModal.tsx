"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { searchBooks, type BookSuggestion } from "../lib/googleBooks";
import type { Book } from "../lib/types";
import { Modal, Button, FieldLabel, inputClass, Cover } from "./ui";
import CoverPickerModal from "./CoverPickerModal";
import BarcodeScannerModal from "./BarcodeScannerModal";

type Status = "to-read" | "reading" | "completed" | "paused";

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "to-read", label: "Envie de lire" },
  { value: "reading", label: "En cours" },
  { value: "paused", label: "En pause" },
  { value: "completed", label: "Terminé ✓" },
];

type Draft = { title: string; author: string; pages: string; genre: string; year: string; isbn: string };
const emptyDraft: Draft = { title: "", author: "", pages: "", genre: "", year: "", isbn: "" };

const GENRE_LIST = [
  "Roman", "Fiction", "Non-Fiction", "Classique", "Nouvelle",
  "Thriller", "Policier", "Crime", "Mystère",
  "Fantasy", "Science-Fiction",
  "Histoire", "Biographie", "Témoignage", "Jeunesse",
  "BD / Roman graphique", "Manga", "Comics",
  "Développement personnel", "Philosophie", "Poésie", "Psychologie",
  "Économie", "Science", "Sciences humaines", "Sciences politiques",
  "Essai", "Aventure", "Romance", "Humour", "Sport", "Cinéma",
  "Musique", "Drame", "Suspense", "Théâtre", "Guerre",
];

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
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [genreOpen, setGenreOpen] = useState(false);
  const [coverSuggestions, setCoverSuggestions] = useState<string[]>([]);
  const [selectedSuggestionCover, setSelectedSuggestionCover] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const coverDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);

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
      setSelectedGenres([]);
      setGenreOpen(false);
      setCoverSuggestions([]);
      setSelectedSuggestionCover(null);
      setSummary("");
      setEnriching(false);
      setEnrichMsg(null);
      setShowScanner(false);
      setScanning(false);
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
            isbn: b.isbn13 ?? null,
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

  // Suggestions de couvertures en mode manuel (au fil de la frappe).
  // On n'écrase pas si une couverture a déjà été choisie (ex. via l'enrichissement web).
  useEffect(() => {
    if (!manual || !open) return;
    if (selectedSuggestionCover) return;
    clearTimeout(coverDebounce.current);
    if (draft.title.trim().length < 3) { setCoverSuggestions([]); return; }
    coverDebounce.current = setTimeout(async () => {
      try {
        const q = encodeURIComponent(`${draft.title} ${draft.author}`.trim());
        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=8&fields=items(volumeInfo(imageLinks))&langRestrict=fr`);
        if (!res.ok) return;
        const data = await res.json();
        const covers: string[] = (data.items || [])
          .map((item: { volumeInfo?: { imageLinks?: { thumbnail?: string; smallThumbnail?: string } } }) =>
            item.volumeInfo?.imageLinks?.thumbnail || item.volumeInfo?.imageLinks?.smallThumbnail
          )
          .filter(Boolean)
          .map((url: string) => url.replace("http://", "https://").replace("&zoom=1", "&zoom=3"));
        const unique = [...new Set(covers)] as string[];
        setCoverSuggestions(unique.slice(0, 6));
      } catch { /* silencieux */ }
    }, 700);
    return () => clearTimeout(coverDebounce.current);
  }, [draft.title, draft.author, manual, open, selectedSuggestionCover]);

  const insertBook = async (b: {
    title: string;
    author: string;
    pages: number;
    cover_url?: string | null;
    genre?: string | null;
    year?: number | null;
    summary?: string | null;
    isbn?: string | null;
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
      isbn13: b.isbn ? b.isbn.replace(/[^0-9Xx]/g, "") : null,
      user_id: user.id,
    };

    if ((status === "reading" || status === "paused") && startDate) bookData.date_started = startDate;
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
      "paused": `« ${b.title} » ajouté en pause.`,
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
    const n = pages ? Number(pages) : 0;
    if (!draft.title.trim()) return setError("Le titre est obligatoire.");
    const genreStr = selectedGenres.length > 0 ? selectedGenres.join(", ") : null;
    await insertBook({
      title: draft.title.trim(),
      author: draft.author.trim(),
      pages: n,
      cover_url: selectedSuggestionCover || null,
      genre: genreStr,
      year: draft.year ? Number(draft.year) : null,
      summary: summary.trim() || null,
      isbn: draft.isbn.trim() || null,
    });
  };

  // Dernier recours de résolution ISBN : la BnF catalogue par dépôt légal
  // quasiment tout ce qui est publié en France, y compris de petites
  // maisons absentes d'Open Library / Google Books. Pas de couverture ni de
  // résumé côté BnF — juste de quoi amorcer runEnrichment ensuite.
  const bnfLookup = async (isbnCode: string) => {
    try {
      const res = await fetch(`/api/books/bnf?isbn=${encodeURIComponent(isbnCode)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return (data.result ?? null) as { title: string; author: string | null; year: number | null } | null;
    } catch {
      return null;
    }
  };

  // Enrichit couverture / résumé / genre pour un titre+auteur déjà connus.
  // Partagé entre le bouton manuel et la résolution automatique après scan.
  const runEnrichment = async (title: string, author: string) => {
    const [results, enrichRes, coversRes] = await Promise.all([
      searchBooks(`${title} ${author}`.trim()).catch((): BookSuggestion[] => []),
      fetch(`/api/books/enrich?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`)
        .then((r) => (r.ok ? r.json() : { summary: null, genres: [], year: null, isbn: null }))
        .catch(() => ({ summary: null as string | null, genres: [] as string[], year: null as number | null, isbn: null as string | null })),
      fetch(`/api/books/covers?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`)
        .then((r) => (r.ok ? r.json() : { covers: [] }))
        .catch(() => ({ covers: [] as string[] })),
    ]);

    const best = results[0];
    setDraft((d) => ({
      ...d,
      author: d.author.trim() || best?.author || "",
      year: enrichRes.year ? String(enrichRes.year) : best?.year ? String(best.year) : d.year,
      isbn: d.isbn.trim() || enrichRes.isbn || best?.isbn || "",
    }));

    // Genres : on ajoute tous ceux détectés qui existent dans la liste canonique,
    // sans retirer ceux déjà choisis à la main.
    const canonical = new Set(GENRE_LIST);
    const detected: string[] = [...(enrichRes.genres || [])];
    if (best?.genre) detected.push(best.genre);
    const toAdd = detected.filter((g) => canonical.has(g));
    if (toAdd.length > 0) {
      setSelectedGenres((prev) => {
        const s = new Set(prev);
        toAdd.forEach((g) => s.add(g));
        return [...s];
      });
    }

    if (enrichRes.summary) setSummary(enrichRes.summary);

    const covers: string[] = coversRes.covers || [];
    if (covers.length > 0) {
      setCoverSuggestions(covers);
      setSelectedSuggestionCover(covers[0]);
    } else if (best?.coverUrl) {
      setCoverSuggestions([best.coverUrl]);
      setSelectedSuggestionCover(best.coverUrl);
    }

    const gotSomething = !!best || !!enrichRes.summary || (enrichRes.genres?.length ?? 0) > 0 || covers.length > 0;
    setEnrichMsg(
      gotSomething
        ? "Infos récupérées. Choisis la bonne couverture ci-dessous si besoin."
        : "Aucune information trouvée pour ce titre.",
    );
  };

  // Code-barres scanné (ou saisi manuellement dans le scanner) — on cherche
  // par ISBN, dans cet ordre :
  //  1. Déjà dans TA bibliothèque → on ne relance pas l'ajout, on prévient.
  //  2. Le même livre existe déjà sur Swena (ajouté par quelqu'un d'autre) →
  //     on réutilise directement sa fiche (couverture, résumé, genre déjà
  //     renseignés) plutôt que de repartir d'une recherche externe.
  //  3. Sinon → recherche externe (Open Library / Google Books).
  //  4. Rien nulle part → la BnF (dépôt légal, forte pour les éditions
  //     franco-françaises) donne au moins titre/auteur, puis on enrichit
  //     couverture/résumé/genre à partir de ça.
  //  5. Toujours rien → saisie manuelle avec l'ISBN déjà rempli.
  const handleBarcodeDetected = async (rawCode: string) => {
    setShowScanner(false);
    const code = rawCode.replace(/[^0-9Xx]/g, "");
    if (!code) return;
    setScanning(true);
    setError(null);
    try {
      const { data: existingRows } = await supabase
        .from("books")
        .select("id, user_id, title, author, cover_url, genre, published_year, summary, isbn13, pages")
        .eq("isbn13", code)
        .limit(20);
      const rows = (existingRows ?? []) as {
        id: number; user_id: string; title: string; author: string; cover_url: string | null;
        genre: string | null; published_year: number | null; summary: string | null;
        isbn13: string | null; pages: number | null;
      }[];

      const own = user ? rows.find((r) => r.user_id === user.id) : undefined;
      if (own) {
        setError(`« ${own.title} » est déjà dans ta bibliothèque.`);
        return;
      }

      const fromSwena = rows.find((r) => r.cover_url) ?? rows[0];
      let best: BookSuggestion | undefined;
      if (fromSwena) {
        best = {
          googleId: `club-${fromSwena.id}`,
          title: fromSwena.title,
          author: fromSwena.author,
          coverUrl: fromSwena.cover_url,
          genre: fromSwena.genre,
          year: fromSwena.published_year,
          summary: fromSwena.summary,
          isbn: fromSwena.isbn13,
        };
      } else {
        const found = await searchBooks(`isbn:${code}`).catch((): BookSuggestion[] => []);
        best = found.find((b) => b.isbn === code) ?? found[0];
      }

      if (best) {
        setSelected(fromSwena ? { ...best, pages: fromSwena.pages || undefined } : best);
        setPages(fromSwena?.pages ? String(fromSwena.pages) : "");
        setCurrentPage("");
        setStatus("reading");
        setStartDate("");
        setEndDate("");
        setRating(0);
      } else {
        const bnf = await bnfLookup(code);
        setManual(true);
        setDraft({
          ...emptyDraft,
          isbn: code,
          title: bnf?.title ?? "",
          author: bnf?.author ?? "",
          year: bnf?.year ? String(bnf.year) : "",
        });
        setStatus("reading");
        setPages("");
        setCurrentPage("");
        setStartDate("");
        setEndDate("");
        setRating(0);
        if (bnf) {
          setEnriching(true);
          try {
            await runEnrichment(bnf.title, bnf.author ?? "");
          } finally {
            setEnriching(false);
          }
        } else {
          setError(`Aucun livre trouvé pour le code ${code}. Renseigne le titre puis réessaie "Récupérer les infos", ou complète à la main.`);
        }
      }
    } finally {
      setScanning(false);
    }
  };

  // Récupère automatiquement les infos du livre depuis le web.
  // Métadonnées : Google Books / Open Library. Résumé : Google Books FR puis Wikipédia FR.
  // Couvertures : route /api/books/covers (plusieurs images de qualité, placeholders filtrés).
  // Si on n'a que l'ISBN (ex. scan sans résultat côté catalogue), on résout
  // d'abord le titre/auteur à partir de l'ISBN (Open Library/Google, puis
  // BnF en dernier recours) avant de lancer l'enrichissement.
  const enrichFromWeb = async () => {
    let title = draft.title.trim();
    let author = draft.author.trim();
    const isbn = draft.isbn.trim();
    if (!title && !isbn) { setError("Renseigne au moins le titre ou l'ISBN."); return; }
    setEnriching(true);
    setError(null);
    setEnrichMsg(null);
    try {
      if (!title && isbn) {
        const isbnHits = await searchBooks(`isbn:${isbn}`).catch((): BookSuggestion[] => []);
        const hit = isbnHits[0];
        if (hit) {
          title = hit.title;
          if (!author && hit.author && hit.author !== "Auteur inconnu") author = hit.author;
        } else {
          const bnf = await bnfLookup(isbn);
          if (bnf) {
            title = bnf.title;
            if (!author && bnf.author) author = bnf.author;
          }
        }
        if (!title) {
          setEnrichMsg("Aucune information trouvée pour cet ISBN. Renseigne le titre manuellement.");
          setEnriching(false);
          return;
        }
        setDraft((d) => ({ ...d, title, author: d.author.trim() || author }));
      }
      await runEnrichment(title, author);
    } catch {
      setEnrichMsg("Récupération indisponible pour le moment.");
    } finally {
      setEnriching(false);
    }
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

      {/* Page actuelle — En cours et En pause */}
      {(status === "reading" || status === "paused") && (
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

      {/* Date de début — En cours, En pause et Terminé */}
      {(status === "reading" || status === "paused" || status === "completed") && (
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
          : status === "paused"
            ? "Ajouter en pause"
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
          : status === "paused"
            ? "Ajouter en pause"
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

          {/* Enrichissement automatique depuis le web */}
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={enrichFromWeb}
              disabled={enriching || (draft.title.trim().length < 2 && draft.isbn.trim().length < 10)}
              className="flex items-center justify-center gap-2 rounded-xl border border-violet/40 bg-violet-soft py-2.5 text-[12.5px] font-semibold text-violet-deep transition-colors hover:border-violet disabled:opacity-50"
            >
              {enriching ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Recherche en cours…
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M17.7 6.3l1.4-1.4M4.9 19.1l1.4-1.4" />
                    <circle cx="12" cy="12" r="3.5" />
                  </svg>
                  Récupérer les infos depuis le web
                </>
              )}
            </button>
            {enrichMsg && <p className="text-center text-[11px] font-medium text-muted">{enrichMsg}</p>}
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
            <div className="relative flex-1">
              <FieldLabel>Genre</FieldLabel>
              <button
                type="button"
                onClick={() => setGenreOpen((o) => !o)}
                className={`${inputClass} flex w-full items-center justify-between text-left`}
              >
                <span className={selectedGenres.length === 0 ? "text-muted" : "text-ink"}>
                  {selectedGenres.length === 0
                    ? "Choisir…"
                    : selectedGenres.length === 1
                      ? selectedGenres[0]
                      : `${selectedGenres.length} genres`}
                </span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="shrink-0 text-muted">
                  <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                </svg>
              </button>
              {genreOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-xl border border-line bg-card shadow-lg">
                  {GENRE_LIST.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setSelectedGenres((prev) =>
                          prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
                        );
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink hover:bg-violet-soft"
                    >
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selectedGenres.includes(g) ? "border-violet bg-violet text-cream" : "border-line"}`}>
                        {selectedGenres.includes(g) && "✓"}
                      </span>
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <FieldLabel>ISBN (optionnel)</FieldLabel>
            <input
              value={draft.isbn}
              onChange={(e) => setDraft({ ...draft, isbn: e.target.value })}
              placeholder="ex. 9782253006329"
              inputMode="numeric"
              className={inputClass}
            />
          </div>

          {/* Suggestions de couverture */}
          {coverSuggestions.length > 0 && (
            <div>
              <FieldLabel>Couverture (choisir ou ignorer)</FieldLabel>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {coverSuggestions.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedSuggestionCover(selectedSuggestionCover === url ? null : url)}
                    className={`shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${selectedSuggestionCover === url ? "border-violet" : "border-transparent"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-[72px] w-[50px] object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Résumé (rempli par l'enrichissement, éditable) */}
          <div>
            <FieldLabel>Résumé (optionnel)</FieldLabel>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="Résumé du livre, ou récupéré automatiquement depuis le web…"
              className={`${inputClass} resize-y leading-relaxed`}
            />
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
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Titre ou auteur…"
            className={`${inputClass} flex-1`}
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            aria-label="Scanner un code-barres"
            title="Scanner un code-barres"
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-line bg-card text-ink-2 transition-colors hover:border-violet/40 hover:text-violet-deep"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
              <path d="M4 6v12M8 6v12M11 6v12M15 6v12M17.5 6v12M21 6v12" />
              <path d="M2 4v2M2 18v2M22 4v2M22 18v2" />
            </svg>
          </button>
        </div>
        {scanning && <p className="text-xs font-medium text-muted">Recherche du livre scanné…</p>}
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
                  className="flex items-center gap-3 rounded-2xl border border-amber-soft bg-amber-soft p-3 transition-colors hover:border-gold"
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

      <BarcodeScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onDetected={handleBarcodeDetected}
      />
    </Modal>
  );
}
