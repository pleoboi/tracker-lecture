"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { todayISO } from "../../lib/books";
import {
  searchAniList,
  enrichMangaSummary,
  formatLabel,
  publicationLabel,
  type AniListResult,
  type MangaDemographic,
  type MangaStatus,
} from "../../lib/manga";
import { Modal, Button, FieldLabel, inputClass } from "../ui";
import { MangaCover, StatusPicker, DemographicPicker } from "./MangaUI";

type Draft = {
  anilist_id: number | null;
  title: string;
  title_native: string | null;
  author: string;
  cover_url: string | null;
  format: string | null;
  publication_status: string | null;
  total_chapters: string;
  total_volumes: string;
  genres: string[];
  published_year: number | null;
  demographic: MangaDemographic | null;
};

const EMPTY_DRAFT: Draft = {
  anilist_id: null,
  title: "",
  title_native: null,
  author: "",
  cover_url: null,
  format: null,
  publication_status: null,
  total_chapters: "",
  total_volumes: "",
  genres: [],
  published_year: null,
  demographic: null,
};

function fromResult(r: AniListResult): Draft {
  return {
    anilist_id: r.anilist_id,
    title: r.title,
    title_native: r.title_native,
    author: r.author ?? "",
    cover_url: r.cover_url,
    format: r.format,
    publication_status: r.publication_status,
    total_chapters: r.total_chapters ? String(r.total_chapters) : "",
    total_volumes: r.total_volumes ? String(r.total_volumes) : "",
    genres: r.genres,
    published_year: r.published_year,
    demographic: r.demographic,
  };
}

const toInt = (s: string) => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default function AddMangaModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (msg: string) => void;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AniListResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState<MangaStatus>("reading");
  const [startChapter, setStartChapter] = useState("");
  const [startVolume, setStartVolume] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Réinitialise à chaque ouverture
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setDraft(null);
    setStatus("reading");
    setStartChapter("");
    setStartVolume("");
    setError(null);
    setSearchError(null);
  }, [open]);

  // Recherche AniList avec anti-rebond
  useEffect(() => {
    if (!open || draft) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setSearching(true);
      setSearchError(null);
      try {
        setResults(await searchAniList(q, ctrl.signal));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setSearchError("Recherche AniList indisponible. Tu peux saisir la série à la main.");
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, open, draft]);

  const save = async () => {
    if (!user || !draft) return;
    if (!draft.title.trim()) {
      setError("Le titre est obligatoire.");
      return;
    }
    setSaving(true);
    setError(null);

    if (draft.anilist_id) {
      const { data: existing } = await supabase
        .from("mangas")
        .select("id")
        .eq("user_id", user.id)
        .eq("anilist_id", draft.anilist_id)
        .limit(1);
      if (existing && existing.length > 0) {
        setSaving(false);
        setError("Cette série est déjà dans ta mangathèque.");
        return;
      }
    }

    const today = todayISO();
    const { data: created, error: insertError } = await supabase.from("mangas").insert({
      user_id: user.id,
      title: draft.title.trim(),
      title_native: draft.title_native,
      author: draft.author.trim() || null,
      cover_url: draft.cover_url,
      anilist_id: draft.anilist_id,
      format: draft.format,
      publication_status: draft.publication_status,
      total_chapters: toInt(draft.total_chapters),
      total_volumes: toInt(draft.total_volumes),
      genres: draft.genres.length ? draft.genres : null,
      published_year: draft.published_year,
      ...(draft.demographic ? { demographic: draft.demographic } : {}),
      status,
      // Point de départ (déjà lu avant Swena) : ne crée pas de session, donc
      // n'entre pas dans les stats — comme la progression initiale d'un livre.
      current_chapter: status === "completed" ? toInt(draft.total_chapters) ?? 0 : toInt(startChapter) ?? 0,
      current_volume: status === "completed" ? toInt(draft.total_volumes) ?? 0 : toInt(startVolume) ?? 0,
      date_started: status === "reading" ? today : null,
      date_finished: status === "completed" ? today : null,
    }).select("id, title, anilist_id").single();
    setSaving(false);
    if (insertError) {
      setError("Impossible d'ajouter la série. Réessaie.");
      return;
    }
    // Descriptif Wikipédia en arrière-plan, la série est déjà ajoutée
    if (created) enrichMangaSummary(created).catch(() => {});
    onAdded(`« ${draft.title.trim()} » ajouté à ta mangathèque`);
  };

  const footer = draft ? (
    <div className="flex gap-2">
      <Button variant="ghost" onClick={() => setDraft(null)} className="flex-1">
        Retour
      </Button>
      <Button onClick={save} disabled={saving} className="flex-[2]">
        {saving ? "Ajout…" : "Ajouter la série"}
      </Button>
    </div>
  ) : undefined;

  return (
    <Modal open={open} onClose={onClose} title="Ajouter un manga" footer={footer}>
      {!draft ? (
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="One Piece, Vagabond, Solo Leveling…"
            className={inputClass}
          />
          <p className="text-[11px] text-muted">Recherche sur AniList (titres en romaji ou en anglais).</p>

          {searching && <p className="py-4 text-center text-xs text-muted">Recherche…</p>}
          {searchError && <p className="text-xs text-danger">{searchError}</p>}

          <div className="flex flex-col gap-2">
            {results.map((r) => (
              <button
                key={r.anilist_id}
                onClick={() => setDraft(fromResult(r))}
                className="flex items-center gap-3 rounded-xl border border-line bg-card p-2.5 text-left transition-colors hover:border-ink"
              >
                <MangaCover id={r.anilist_id} title={r.title} coverUrl={r.cover_url} className="h-16 w-11" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-ink">{r.title}</p>
                  <p className="truncate text-[11.5px] text-muted">
                    {[r.author, r.published_year].filter(Boolean).join(" · ")}
                  </p>
                  <p className="truncate text-[11px] text-ink-2">
                    {[
                      formatLabel(r.format),
                      r.total_volumes ? `${r.total_volumes} tomes` : null,
                      r.total_chapters ? `${r.total_chapters} ch.` : null,
                      publicationLabel(r.publication_status),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => setDraft({ ...EMPTY_DRAFT, title: query.trim() })}
            className="mt-1 text-center text-[12px] font-semibold text-violet-deep underline-offset-2 hover:underline"
          >
            Pas trouvé ? Saisir la série à la main
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <MangaCover id={draft.anilist_id ?? 0} title={draft.title || "?"} coverUrl={draft.cover_url} className="h-28 w-20" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div>
                <FieldLabel>Titre</FieldLabel>
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={inputClass} />
              </div>
              <div>
                <FieldLabel>Auteur</FieldLabel>
                <input value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} className={inputClass} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Chapitres (total)</FieldLabel>
              <input
                inputMode="numeric"
                value={draft.total_chapters}
                onChange={(e) => setDraft({ ...draft, total_chapters: e.target.value.replace(/\D/g, "") })}
                placeholder="En cours"
                className={inputClass}
              />
            </div>
            <div>
              <FieldLabel>Tomes (total)</FieldLabel>
              <input
                inputMode="numeric"
                value={draft.total_volumes}
                onChange={(e) => setDraft({ ...draft, total_volumes: e.target.value.replace(/\D/g, "") })}
                placeholder="En cours"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <FieldLabel>Catégorie</FieldLabel>
            <DemographicPicker value={draft.demographic} onChange={(d) => setDraft({ ...draft, demographic: d })} />
          </div>

          <div>
            <FieldLabel>Statut</FieldLabel>
            <StatusPicker value={status} onChange={setStatus} />
          </div>

          {(status === "reading" || status === "paused" || status === "abandoned") && (
            <div>
              <FieldLabel>Déjà lu avant (facultatif)</FieldLabel>
              <div className="grid grid-cols-2 gap-3">
                <input
                  inputMode="numeric"
                  value={startChapter}
                  onChange={(e) => setStartChapter(e.target.value.replace(/\D/g, ""))}
                  placeholder="Chapitre atteint"
                  className={inputClass}
                />
                <input
                  inputMode="numeric"
                  value={startVolume}
                  onChange={(e) => setStartVolume(e.target.value.replace(/\D/g, ""))}
                  placeholder="Tome atteint"
                  className={inputClass}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted">Sert de point de départ, sans compter dans tes stats.</p>
            </div>
          )}

          {error && <p className="text-xs font-medium text-danger">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
