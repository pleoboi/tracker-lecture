"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import { todayISO, shiftDateISO } from "../../../lib/books";
import { getAniListById, enrichMangaSummary, type Manga } from "../../../lib/manga";
import { AvatarImg } from "../../../components/ui";
import { MangaCover } from "../../../components/manga/MangaUI";
import FriendsMangaActivity from "../../../components/manga/FriendsMangaActivity";
import MangaChampion from "../../../components/manga/MangaChampion";

type Release = {
  id: number;
  anilist_id: number | null;
  series_title: string;
  chapter: number;
  chapter_title: string | null;
  url: string;
  cover_url: string | null;
  released_at: string;
};

type Leader = { userId: string; name: string; avatar: string | null; chapters: number; volumes: number };

const RELEASE_DAYS = 14;

function dayLabel(iso: string) {
  const today = todayISO();
  if (iso === today) return "Aujourd'hui";
  if (iso === shiftDateISO(today, -1)) return "Hier";
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** Date locale (YYYY-MM-DD) d'un horodatage, pour regrouper les sorties par jour. */
function localDay(ts: string) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MangaCommunityPage() {
  const { user } = useAuth();
  const [releases, setReleases] = useState<Release[]>([]);
  const [mine, setMine] = useState<Pick<Manga, "id" | "anilist_id" | "current_chapter">[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [onlyMine, setOnlyMine] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const since = new Date(Date.now() - RELEASE_DAYS * 86_400_000).toISOString();
    const monthStart = `${todayISO().slice(0, 7)}-01`;
    const [{ data: rel }, { data: my }, { data: follows }] = await Promise.all([
      supabase.from("manga_releases").select("*").gte("released_at", since).order("released_at", { ascending: false }).limit(200),
      supabase.from("mangas").select("id, anilist_id, current_chapter").eq("user_id", user.id),
      supabase.from("user_follows").select("following_id").eq("follower_id", user.id),
    ]);
    setReleases((rel as Release[]) ?? []);
    setMine((my as Pick<Manga, "id" | "anilist_id" | "current_chapter">[]) ?? []);

    // Classement du club ce mois-ci (toi + tes abonnements)
    const clubIds = [user.id, ...((follows ?? []) as { following_id: string }[]).map((f) => f.following_id)];
    const [{ data: logs }, { data: profs }] = await Promise.all([
      supabase.from("manga_logs").select("user_id, unit, amount").in("user_id", clubIds).gte("date", monthStart),
      supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", clubIds),
    ]);
    const profMap = new Map(((profs ?? []) as { id: string; display_name: string; avatar_url: string | null }[]).map((p) => [p.id, p]));
    const totals = new Map<string, { chapters: number; volumes: number }>();
    for (const l of (logs ?? []) as { user_id: string; unit: string; amount: number }[]) {
      const t = totals.get(l.user_id) ?? { chapters: 0, volumes: 0 };
      if (l.unit === "chapter") t.chapters += l.amount;
      else t.volumes += l.amount;
      totals.set(l.user_id, t);
    }
    setLeaders(
      [...totals.entries()]
        .map(([id, t]) => ({
          userId: id,
          name: id === user.id ? "Toi" : profMap.get(id)?.display_name ?? "Membre",
          avatar: profMap.get(id)?.avatar_url ?? null,
          ...t,
        }))
        .sort((a, b) => b.chapters + b.volumes * 10 - (a.chapters + a.volumes * 10))
        .slice(0, 5)
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Va chercher les dernières sorties MANGA Plus (au plus une fois par heure côté serveur)
  useEffect(() => {
    if (!user) return;
    fetch("/api/manga/releases/sync", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => { if (res?.inserted) load(); })
      .catch(() => {});
  }, [user, load]);

  const mineByAnilist = useMemo(() => new Map(mine.filter((m) => m.anilist_id).map((m) => [m.anilist_id!, m])), [mine]);

  const shown = onlyMine ? releases.filter((r) => r.anilist_id && mineByAnilist.has(r.anilist_id)) : releases;
  const groups = useMemo(() => {
    const out: { day: string; items: Release[] }[] = [];
    for (const r of shown) {
      const day = localDay(r.released_at);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(r);
      else out.push({ day, items: [r] });
    }
    return out;
  }, [shown]);

  const follow = async (r: Release) => {
    if (!user || !r.anilist_id) return;
    setAdding(r.id);
    const info = await getAniListById(r.anilist_id).catch(() => null);
    const { data: created, error } = await supabase
      .from("mangas")
      .insert({
        user_id: user.id,
        title: info?.title ?? r.series_title,
        title_native: info?.title_native ?? null,
        author: info?.author ?? null,
        cover_url: info?.cover_url ?? r.cover_url,
        anilist_id: r.anilist_id,
        format: info?.format ?? "MANGA",
        publication_status: info?.publication_status ?? "RELEASING",
        total_chapters: info?.total_chapters ?? null,
        total_volumes: info?.total_volumes ?? null,
        genres: info?.genres?.length ? info.genres : null,
        published_year: info?.published_year ?? null,
        status: "reading",
      })
      .select("id, title, anilist_id, current_chapter")
      .single();
    setAdding(null);
    if (error || !created) {
      setToast("Impossible d'ajouter la série.");
    } else {
      enrichMangaSummary(created).catch(() => {});
      setMine((prev) => [...prev, created]);
      setToast(`« ${created.title} » ajouté à ta mangathèque`);
    }
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="animate-fadeIn flex flex-col gap-6 pt-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-violet-deep">仲間</p>
          <h1 className="font-serif text-4xl text-ink">Communauté manga</h1>
        </div>
        <Link href="/communaute" className="text-[12px] font-semibold text-muted hover:text-ink">Côté livres →</Link>
      </header>

      {/* Activité du club */}
      {user && (
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-xl text-ink">Activité du club</h2>
          <MangaChampion />
              <FriendsMangaActivity userId={user.id} />
        </section>
      )}

      {/* Classement du mois */}
      {leaders.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-xl text-ink">Top lecteurs du mois</h2>
          <div className="manga-panel divide-y divide-line p-0">
            {leaders.map((l, i) => (
              <Link key={l.userId} href={`/membre/${l.userId}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-violet-soft">
                <span className="w-5 font-serif text-lg text-violet-deep">{i + 1}</span>
                <AvatarImg url={l.avatar} name={l.name} className="h-7 w-7 text-[11px]" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">{l.name}</span>
                <span className="nums shrink-0 text-[12px] font-semibold text-ink-2">
                  {[l.chapters ? `${l.chapters} ch.` : null, l.volumes ? `${l.volumes} t.` : null].filter(Boolean).join(" · ")}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Sorties MANGA Plus */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-serif text-xl text-ink">
              Nouveaux chapitres
              <span className="manga-tone-band rounded-[3px] border-2 border-ink px-1.5 text-[11px] font-bold text-cream">VF</span>
            </h2>
            <p className="text-[11.5px] text-muted">Sorties officielles MANGA Plus en français, {RELEASE_DAYS} derniers jours</p>
          </div>
          <div className="flex gap-1 rounded-lg border-2 border-ink p-0.5">
            {[
              { v: false, label: "Toutes" },
              { v: true, label: "Mes séries" },
            ].map((o) => (
              <button
                key={o.label}
                onClick={() => setOnlyMine(o.v)}
                className={`rounded-md px-2.5 py-1 text-[11.5px] font-bold ${onlyMine === o.v ? "bg-ink text-paper" : "text-ink-2"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="py-10 text-center text-xs font-medium uppercase tracking-wider text-muted">Chargement…</p>
        ) : groups.length === 0 ? (
          <p className="rounded-lg border-2 border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            {onlyMine ? "Aucune sortie récente pour les séries de ta mangathèque." : "Pas encore de sortie récupérée."}
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.day} className="flex flex-col gap-2">
              <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted first-letter:uppercase">{dayLabel(g.day)}</p>
              <div className="grid gap-2.5 md:grid-cols-2">
                {g.items.map((r) => {
                  const own = r.anilist_id ? mineByAnilist.get(r.anilist_id) : undefined;
                  const chapter = Math.floor(Number(r.chapter));
                  return (
                    <div key={r.id} className={`manga-panel flex items-center gap-3 p-2.5 ${own ? "ring-2 ring-violet ring-offset-2 ring-offset-paper" : ""}`}>
                      {own ? (
                        <Link href={`/manga/${own.id}`}>
                          <MangaCover id={r.id} title={r.series_title} coverUrl={r.cover_url} className="h-[72px] w-12" />
                        </Link>
                      ) : (
                        <MangaCover id={r.id} title={r.series_title} coverUrl={r.cover_url} className="h-[72px] w-12" />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <p className="truncate text-[13.5px] font-bold text-ink">{r.series_title}</p>
                        <p className="text-[12.5px] font-bold text-violet-deep">Chapitre {chapter}</p>
                        {r.chapter_title && <p className="truncate text-[11.5px] italic text-ink-2">« {r.chapter_title} »</p>}
                        {own && own.current_chapter > 0 && (
                          <p className="text-[10.5px] text-muted">
                            {own.current_chapter >= chapter ? "Déjà lu" : `Tu es au ch. ${own.current_chapter}`}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5">
                        {/* Le lien mène exactement au chapitre annoncé (même entrée MANGA Plus) */}
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="btn-press rounded-lg border-2 border-ink bg-violet px-2.5 py-1.5 text-center text-[11.5px] font-bold text-cream">
                          Lire le ch. {chapter}
                        </a>
                        {!own && r.anilist_id && (
                          <button
                            onClick={() => follow(r)}
                            disabled={adding === r.id}
                            className="btn-press rounded-lg border-2 border-ink bg-card px-2.5 py-1.5 text-[11.5px] font-bold text-ink disabled:opacity-50"
                          >
                            {adding === r.id ? "Ajout…" : "+ Suivre"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>

      {toast && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] left-1/2 z-[70] -translate-x-1/2 rounded-xl border-2 border-ink bg-card px-4 py-2.5 text-sm font-bold text-ink shadow-[4px_4px_0_var(--color-ink)] md:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
