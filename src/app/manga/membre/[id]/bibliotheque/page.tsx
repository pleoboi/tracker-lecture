"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../lib/supabase";
import {
  fetchMyMangas,
  mangaProfileHref,
  progressSummary,
  MANGA_STATUS_LABELS,
  MANGA_STATUS_ORDER,
  type Manga,
  type MangaStatus,
} from "../../../../../lib/manga";
import { MangaCover } from "../../../../../components/manga/MangaUI";

/** Mangathèque d'un membre en lecture seule (la sienne s'ouvre sur /manga). */
export default function MangaMemberLibraryPage() {
  const params = useParams();
  const memberId = params.id as string;
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<MangaStatus | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchMyMangas(memberId),
      supabase.from("user_profiles").select("display_name").eq("id", memberId).single(),
    ]).then(([ms, prof]) => {
      if (cancelled) return;
      setMangas(ms);
      setName((prof.data as { display_name?: string } | null)?.display_name ?? "");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: mangas.length };
    for (const m of mangas) c[m.status] = (c[m.status] ?? 0) + 1;
    return c;
  }, [mangas]);

  const shown = mangas.filter((m) => {
    if (filter !== "all" && m.status !== filter) return false;
    const q = search.trim().toLowerCase();
    return !q || m.title.toLowerCase().includes(q) || (m.author ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="animate-fadeIn flex min-w-0 flex-col gap-5 pt-4">
      <Link href={mangaProfileHref(memberId)} className="text-[12px] font-semibold text-muted hover:text-ink">← Profil manga</Link>
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-violet-deep">マンガ</p>
        <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">Mangathèque{name ? ` de ${name}` : ""}</h1>
      </header>

      {loading ? (
        <p className="py-16 text-center text-xs font-medium uppercase tracking-wider text-muted">Chargement…</p>
      ) : mangas.length === 0 ? (
        <p className="rounded-lg border-2 border-dashed border-line px-4 py-10 text-center text-sm text-muted">Aucun manga pour l&apos;instant.</p>
      ) : (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full rounded-xl border-2 border-line bg-input px-3 py-2 text-sm text-ink outline-none focus:border-ink md:w-64"
          />
          <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 md:mx-0 md:px-0">
            {(["all", ...MANGA_STATUS_ORDER] as const).map((s) => {
              const n = counts[s] ?? 0;
              if (s !== "all" && n === 0) return null;
              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`shrink-0 rounded-full border-2 px-3 py-1.5 text-[12px] font-bold transition-colors ${
                    filter === s ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-2 hover:border-ink"
                  }`}
                >
                  {s === "all" ? "Toutes" : MANGA_STATUS_LABELS[s]} <span className="opacity-60">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 md:grid-cols-6">
            {shown.map((m) => (
              <Link key={m.id} href={`/manga/${m.id}`} className="group flex min-w-0 flex-col gap-1.5">
                <div className="relative">
                  <MangaCover id={m.id} title={m.title} coverUrl={m.cover_url} className="aspect-[2/3] h-auto w-full transition-transform group-hover:-translate-y-1" />
                  {m.rating ? (
                    <span className="absolute right-1 top-1 rounded-[3px] border-2 border-ink bg-card px-1 text-[10px] font-bold text-ink">
                      ★ {String(m.rating).replace(".", ",")}
                    </span>
                  ) : null}
                </div>
                <p className="line-clamp-2 text-[12px] font-bold leading-tight text-ink">{m.title}</p>
                <p className="-mt-1 truncate text-[10.5px] text-muted">
                  {m.status === "reading" ? progressSummary(m) : MANGA_STATUS_LABELS[m.status]}
                </p>
              </Link>
            ))}
          </div>
          {shown.length === 0 && <p className="py-6 text-center text-sm text-muted">Aucune série ne correspond.</p>}
        </>
      )}
    </div>
  );
}
