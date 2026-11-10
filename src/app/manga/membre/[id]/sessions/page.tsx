"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../lib/supabase";
import { useAuth } from "../../../../../lib/auth-context";
import {
  fetchMyMangas,
  fetchMyMangaLogs,
  mergeMangaLogs,
  mangaProfileHref,
  unitLabel,
  type Manga,
  type MangaLog,
} from "../../../../../lib/manga";
import { RatingTag } from "../../../../../components/manga/MangaUI";

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

/** Historique des sessions manga d'un membre, regroupées par jour. */
export default function MangaMemberSessionsPage() {
  const params = useParams();
  const memberId = params.id as string;
  const { user } = useAuth();
  const isOwn = user?.id === memberId;
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [logs, setLogs] = useState<MangaLog[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchMyMangas(memberId),
      fetchMyMangaLogs(memberId),
      supabase.from("user_profiles").select("display_name").eq("id", memberId).single(),
    ]).then(([ms, ls, prof]) => {
      if (cancelled) return;
      setMangas(ms);
      setLogs(ls);
      setName((prof.data as { display_name?: string } | null)?.display_name ?? "");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  const byId = useMemo(() => new Map(mangas.map((m) => [m.id, m])), [mangas]);
  const merged = useMemo(() => mergeMangaLogs(logs).slice(0, 150), [logs]);

  return (
    <div className="animate-fadeIn flex min-w-0 flex-col gap-5 pt-4">
      <Link href={mangaProfileHref(memberId)} className="text-[12px] font-semibold text-muted hover:text-ink">← Profil manga</Link>
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-violet-deep">マンガ</p>
        <h1 className="font-serif text-3xl leading-tight text-ink sm:text-4xl">
          {isOwn ? "Mes dernières sessions" : `Sessions${name ? ` de ${name}` : ""}`}
        </h1>
      </header>

      {loading ? (
        <p className="py-16 text-center text-xs font-medium uppercase tracking-wider text-muted">Chargement…</p>
      ) : merged.length === 0 ? (
        <p className="rounded-lg border-2 border-dashed border-line px-4 py-10 text-center text-sm text-muted">Aucune session pour l&apos;instant.</p>
      ) : (
        <div className="manga-panel divide-y divide-line p-0">
          {merged.map((l) => (
            <Link key={l.id} href={`/manga/${l.manga_id}`} className="flex min-w-0 items-center gap-3 px-3.5 py-2.5 hover:bg-violet-soft">
              <span className="nums w-[4.5rem] shrink-0 text-[11px] font-semibold capitalize text-muted">{fmtDate(l.date)}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{byId.get(l.manga_id)?.title ?? "Série supprimée"}</span>
              {l.avgRating != null && <RatingTag value={l.avgRating} className="shrink-0 text-[11.5px]" />}
              <span className="nums shrink-0 text-[12px] font-bold text-violet-deep">
                +{l.amount} {unitLabel(l.unit, l.amount, true)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
