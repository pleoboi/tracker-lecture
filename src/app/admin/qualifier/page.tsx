"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

const GENRES = [
  "Roman", "Fiction", "Non-Fiction", "Classique", "Nouvelle",
  "Thriller", "Policier", "Crime", "Mystère",
  "Fantasy", "Science-Fiction",
  "Histoire", "Guerre", "Biographie", "Témoignage", "Jeunesse",
  "BD / Roman graphique", "Manga", "Comics",
  "Développement personnel", "Philosophie", "Poésie", "Psychologie",
  "Économie", "Science", "Sciences humaines", "Sciences politiques",
  "Essai", "Aventure", "Romance", "Humour", "Sport", "Cinéma",
  "Musique", "Drame", "Suspense", "Théâtre",
];

type QBook = {
  title: string;
  author: string;
  cover_url: string | null;
  summary: string | null;
  pages: number | null;
  published_year: number | null;
  genre: string | null;
};

export default function QualifierPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  const [queue, setQueue] = useState<QBook[]>([]);
  const [total, setTotal] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [qualified, setQualified] = useState(0);

  const [dataLoading, setDataLoading] = useState(true);
  const [selection, setSelection] = useState<string[]>([]);
  const firstBookTitle = queue[0]?.title;
  const firstBookGenre = queue[0]?.genre;
  const [leaving, setLeaving] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email ?? null;
      if (!email || email !== ADMIN_EMAIL) {
        router.replace("/");
        return;
      }
      setToken(session?.access_token ?? null);
      setAuthLoading(false);
    });
  }, [router]);

  // ── Chargement ────────────────────────────────────────────────────────────
  const loadBooks = useCallback(async (tok: string) => {
    setDataLoading(true);
    try {
      const res = await fetch("/api/admin/qualifier", {
        headers: { Authorization: `Bearer ${tok}` },
      });
      const data = (await res.json()) as { books?: QBook[]; total?: number };
      setQueue(data.books ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) loadBooks(token);
  }, [token, loadBooks]);

  // Pré-sélectionner les genres déjà existants quand on passe au livre suivant
  useEffect(() => {
    if (!firstBookTitle) return;
    const genres = firstBookGenre?.split(",").map((g) => g.trim()).filter(Boolean) ?? [];
    setSelection(genres);
  }, [firstBookTitle, firstBookGenre]);

  // ── Action : passer / enregistrer ────────────────────────────────────────
  const advance = useCallback(
    async (save: boolean) => {
      if (!queue[0] || !token || leaving || saving) return;
      if (save && selection.length === 0) return;

      setSaving(true);
      setLeaving(true);

      // Sauvegarde en parallèle de l'animation
      const savePromise = save
        ? fetch("/api/admin/qualifier", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              title: queue[0].title,
              genre: selection.join(", "),
            }),
          })
        : Promise.resolve(null);

      // Attendre la durée de l'animation de sortie (240ms)
      await new Promise((r) => setTimeout(r, 260));
      await savePromise;

      setQueue((prev) => prev.slice(1));
      setProcessed((p) => p + 1);
      if (save) setQualified((q) => q + 1);

      setLeaving(false);
      setSaving(false);
    },
    [queue, token, leaving, saving, selection]
  );

  // Raccourci clavier : Entrée = enregistrer, Espace = passer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Enter" && selection.length > 0) advance(true);
      if (e.key === " ") { e.preventDefault(); advance(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [advance, selection]);

  // ── Rendu — auth ──────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">Vérification des droits…</p>
      </div>
    );
  }

  // ── Rendu — chargement ────────────────────────────────────────────────────
  if (dataLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-violet border-t-transparent" />
        <p className="text-sm font-medium text-muted">Chargement des livres à qualifier…</p>
      </div>
    );
  }

  const current = queue[0] ?? null;
  const remaining = total - processed;

  // ── Rendu — terminé ───────────────────────────────────────────────────────
  if (!current) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-2xl text-success">✓</div>
        <div>
          <h2 className="font-serif text-xl font-bold text-ink">File d&apos;attente épuisée</h2>
          <p className="mt-1 text-sm text-muted">
            {qualified > 0
              ? `${qualified} livre${qualified > 1 ? "s" : ""} qualifié${qualified > 1 ? "s" : ""} cette session.`
              : "Tous les livres ont déjà un genre ou la file était vide."}
          </p>
        </div>
        <button
          onClick={() => router.push("/admin")}
          className="rounded-xl bg-violet px-6 py-2.5 text-sm font-bold text-cream"
        >
          Retour admin
        </button>
      </div>
    );
  }

  // ── Rendu — carte principale ──────────────────────────────────────────────
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 px-4 py-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/admin")}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-card text-ink"
          aria-label="Retour"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
            Qualifier les genres
          </p>
          <p className="font-serif text-[15px] font-bold text-ink">
            Livre {processed + 1} / {remaining > 0 ? remaining : "—"} restants
          </p>
        </div>
        <div className="flex h-9 min-w-[36px] items-center justify-center rounded-xl border border-violet/30 bg-violet-soft px-2">
          <span className="text-[11px] font-bold text-violet-deep">{qualified} ✓</span>
        </div>
      </div>

      {/* Card avec animation */}
      <div className={leaving ? "animate-slideOutLeft" : "animate-slideInRight"}>

        {/* Infos livre */}
        <div className="flex gap-4 rounded-2xl border border-line bg-card p-4">
          <div className="shrink-0">
            {current.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.cover_url}
                alt={current.title}
                className="h-[130px] w-[88px] rounded-xl object-cover shadow-md"
              />
            ) : (
              <div className="flex h-[130px] w-[88px] items-center justify-center rounded-xl bg-violet-soft p-2 text-center text-[10px] font-medium leading-tight text-violet-deep">
                {current.title.slice(0, 35)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-[17px] font-semibold leading-snug text-ink">
              {current.title}
            </h2>
            <p className="mt-0.5 text-[13px] text-muted">{current.author}</p>
            {(current.published_year || current.pages) && (
              <p className="mt-1 text-[11px] text-muted">
                {[
                  current.published_year,
                  current.pages ? `${current.pages} p.` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {current.genre && current.genre.trim() && (
              <div className="mt-2 flex flex-wrap gap-1">
                {current.genre.split(",").map((g) => g.trim()).filter(Boolean).map((g) => (
                  <span
                    key={g}
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: "#2a1a58", color: "#b09de0" }}
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
            {current.summary && (
              <p className="mt-2 line-clamp-4 text-[12px] leading-relaxed text-ink-2">
                {current.summary}
              </p>
            )}
          </div>
        </div>

        {/* Sélecteur de genres — fond violet sombre */}
        <div
          className="mt-3 rounded-2xl p-4"
          style={{ background: "#1a1040" }}
        >
          <p
            className="mb-3 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "#8b7db8" }}
          >
            Sélectionner le ou les genres
          </p>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => {
              const active = selection.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() =>
                    setSelection((prev) =>
                      active ? prev.filter((x) => x !== g) : [...prev, g]
                    )
                  }
                  className="rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all"
                  style={
                    active
                      ? { background: "#7c5cbf", color: "#ffffff" }
                      : { background: "#2a1a58", color: "#9b8ec4" }
                  }
                >
                  {g}
                </button>
              );
            })}
          </div>

          {selection.length > 0 && (
            <p
              className="mt-3 text-[11px] font-medium"
              style={{ color: "#b09de0" }}
            >
              {selection.join(", ")}
            </p>
          )}
        </div>

        {/* Boutons d'action */}
        <div className="mt-3 flex gap-3">
          <button
            onClick={() => advance(false)}
            disabled={leaving || saving}
            className="flex-1 rounded-xl border border-line bg-card py-3.5 text-[14px] font-semibold text-muted transition-colors hover:border-violet/30 hover:text-ink disabled:opacity-40"
          >
            Passer
          </button>
          <button
            onClick={() => advance(true)}
            disabled={leaving || saving || selection.length === 0}
            className="flex-[2] rounded-xl bg-violet py-3.5 text-[14px] font-bold text-cream disabled:opacity-40"
          >
            {saving ? "…" : "Enregistrer"}
          </button>
        </div>

        <p className="mt-2 text-center text-[10px] text-muted">
          Entrée pour enregistrer · Espace pour passer
        </p>
      </div>
    </div>
  );
}
