"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/auth-context";
import {
  fetchMyMangas,
  fetchMyMangaLogs,
  mangaProgress,
  progressSummary,
  releaseState,
  readTarget,
  unitLabel,
  MANGA_STATUS_LABELS,
  MANGA_STATUS_ORDER,
  type Manga,
  type MangaLog,
  type MangaStatus,
} from "../../lib/manga";
import { MangaCover, InkProgress } from "../../components/manga/MangaUI";
import AddMangaModal from "../../components/manga/AddMangaModal";
import LogMangaModal from "../../components/manga/LogMangaModal";
import FriendsMangaActivity from "../../components/manga/FriendsMangaActivity";
import MangaChampion from "../../components/manga/MangaChampion";

function relativeDay(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j.`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function fmtShortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function MangaPage() {
  const { user } = useAuth();
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [logs, setLogs] = useState<MangaLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<MangaStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [logFor, setLogFor] = useState<number | null | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const year = new Date().getFullYear();
    const [ms, ls] = await Promise.all([fetchMyMangas(user.id), fetchMyMangaLogs(user.id, `${year}-01-01`)]);
    setMangas(ms);
    setLogs(ls);
    setLoading(false);
  }, [user]);

  // Vérifie les nouveaux chapitres des séries en cours de parution (MangaDex,
  // côté serveur), puis recharge si quelque chose a été mis à jour.
  useEffect(() => {
    if (!user) return;
    fetch("/api/manga/refresh", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => { if (res?.checked) load(); })
      .catch(() => {});
  }, [user, load]);

  useEffect(() => {
    load();
    const onUpdate = () => load();
    window.addEventListener("mangas-updated", onUpdate);
    return () => window.removeEventListener("mangas-updated", onUpdate);
  }, [load]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const reading = mangas.filter((m) => m.status === "reading");
  // Séries en cours de lecture avec des chapitres sortis pas encore lus
  const newChapters = reading
    .filter((m) => { const rs = releaseState(m); return rs && rs.behind > 0 && m.current_chapter > 0; })
    .sort((a, b) => (b.latest_chapter_at ?? "").localeCompare(a.latest_chapter_at ?? ""));
  const byId = useMemo(() => new Map(mangas.map((m) => [m.id, m])), [mangas]);

  const yearChapters = logs.filter((l) => l.unit === "chapter").reduce((s, l) => s + l.amount, 0);
  const yearVolumes = logs.filter((l) => l.unit === "volume").reduce((s, l) => s + l.amount, 0);
  const yearCompleted = mangas.filter(
    (m) => m.status === "completed" && m.date_finished?.startsWith(String(new Date().getFullYear()))
  ).length;

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: mangas.length };
    for (const m of mangas) c[m.status] = (c[m.status] ?? 0) + 1;
    return c;
  }, [mangas]);

  const shown = mangas.filter((m) => {
    if (filter !== "all" && m.status !== filter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return m.title.toLowerCase().includes(q) || (m.author ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="animate-fadeIn flex min-w-0 flex-col gap-6 pt-4">
      {/* En-tête */}
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-violet-deep">マンガ</p>
          <h1 className="font-serif text-4xl text-ink">Mangathèque</h1>
        </div>
        <div className="hidden gap-2 md:flex">
          <button onClick={() => setLogFor(null)} className="btn-press rounded-xl border-2 border-ink bg-card px-4 py-2.5 text-[13px] font-bold text-ink">
            Noter ma lecture
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-press rounded-xl border-2 border-ink bg-violet px-4 py-2.5 text-[13px] font-bold text-cream shadow-[3px_3px_0_var(--color-ink)]">
            + Ajouter un manga
          </button>
        </div>
      </header>

      {/* Bandeau stats de l'année */}
      <section className="manga-panel grid grid-cols-3 divide-x-2 divide-ink overflow-hidden p-0">
        {[
          { value: yearChapters, label: `chapitres en ${new Date().getFullYear()}` },
          { value: yearVolumes, label: `tomes en ${new Date().getFullYear()}` },
          { value: yearCompleted, label: yearCompleted > 1 ? "séries finies" : "série finie" },
        ].map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-0.5 px-2 py-4">
            <span className="nums font-serif text-3xl text-ink">{s.value.toLocaleString("fr-FR")}</span>
            <span className="text-center text-[10.5px] font-medium text-muted">{s.label}</span>
          </div>
        ))}
      </section>

      {loading ? (
        <p className="py-16 text-center text-xs font-medium uppercase tracking-wider text-muted">Chargement…</p>
      ) : mangas.length === 0 ? (
        <section className="manga-panel manga-speedlines flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="font-serif text-2xl text-ink">Ta mangathèque est vide</p>
          <p className="max-w-sm text-sm text-ink-2">
            Ajoute tes séries, puis note tes sessions en chapitres (scans) ou en tomes. Rien ici ne se mélange avec tes livres.
          </p>
          <button onClick={() => setShowAdd(true)} className="btn-press mt-2 rounded-xl border-2 border-ink bg-violet px-5 py-3 text-sm font-bold text-cream shadow-[3px_3px_0_var(--color-ink)]">
            + Ajouter mon premier manga
          </button>
        </section>
      ) : null}

      {!loading && mangas.length === 0 && user && (
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-xl text-ink">Activité du club</h2>
          <MangaChampion />
              <FriendsMangaActivity userId={user.id} />
        </section>
      )}

      {loading || mangas.length === 0 ? null : (
        <>
          {/* Nouveaux chapitres */}
          {newChapters.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 font-serif text-xl text-ink">
                Nouveaux chapitres
                <span className="manga-tone-band rounded-[3px] border-2 border-ink px-1.5 text-[11px] font-bold text-cream">NEW</span>
              </h2>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
                {newChapters.map((m) => {
                  const rs = releaseState(m)!;
                  const target = readTarget(m);
                  return (
                    <div key={m.id} className="manga-panel flex min-w-0 items-center gap-3 p-3">
                      <MangaCover id={m.id} title={m.title} coverUrl={m.cover_url} className="h-20 w-14" />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <p className="truncate text-[14px] font-bold text-ink">{m.title}</p>
                        <p className="text-[12.5px] font-bold text-violet-deep">
                          Chapitre {rs.latest} sorti{m.latest_chapter_at ? ` ${relativeDay(m.latest_chapter_at)}` : ""}
                        </p>
                        {m.latest_chapter_title && <p className="truncate text-[11.5px] italic text-ink-2">« {m.latest_chapter_title} »</p>}
                        <p className="text-[11px] text-muted">
                          Tu es au ch. {m.current_chapter} · {rs.behind} de retard
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5">
                        {target && (
                          <a href={target.url} target="_blank" rel="noopener noreferrer" className="btn-press rounded-lg border-2 border-ink bg-violet px-3 py-1.5 text-center text-[12px] font-bold text-cream">
                            {target.label}
                          </a>
                        )}
                        <button onClick={() => setLogFor(m.id)} className="btn-press rounded-lg border-2 border-ink bg-card px-3 py-1.5 text-[12px] font-bold text-ink">
                          Noter
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* En cours */}
          {reading.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="font-serif text-xl text-ink">En cours</h2>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5 md:grid-cols-2 lg:grid-cols-3">
                {reading.map((m) => {
                  const p = mangaProgress(m);
                  return (
                    <div key={m.id} className="manga-panel flex min-w-0 gap-2.5 p-2.5">
                      <Link href={`/manga/${m.id}`}>
                        <MangaCover id={m.id} title={m.title} coverUrl={m.cover_url} className="h-[84px] w-14" />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <Link href={`/manga/${m.id}`} className="truncate text-[13.5px] font-bold text-ink hover:underline">
                          {m.title}
                        </Link>
                        <p className="nums truncate text-[11.5px] font-semibold text-ink-2">{progressSummary(m)}</p>
                        {p && (
                          <div className="flex items-center gap-2">
                            <InkProgress value={p.value} />
                            {releaseState(m) && (
                              <span className="shrink-0 text-[10.5px] font-bold text-violet-deep">{p.label}</span>
                            )}
                          </div>
                        )}
                        <div className="mt-auto flex gap-1.5">
                          <button
                            onClick={() => setLogFor(m.id)}
                            className="btn-press rounded-md border-2 border-ink bg-violet px-2 py-1 text-[11px] font-bold text-cream"
                          >
                            Noter
                          </button>
                          {readTarget(m) && (
                            <a href={readTarget(m)!.url} target="_blank" rel="noopener noreferrer" className="btn-press truncate rounded-md border-2 border-ink bg-card px-2 py-1 text-[11px] font-bold text-ink">
                              {readTarget(m)!.label}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Activité des amis */}
          {user && (
            <section className="flex flex-col gap-3">
              <h2 className="font-serif text-xl text-ink">Activité du club</h2>
              <MangaChampion />
              <FriendsMangaActivity userId={user.id} />
            </section>
          )}

          {/* Toutes les séries */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-xl text-ink">Toutes mes séries</h2>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="w-full rounded-xl border-2 border-line bg-input px-3 py-2 text-sm text-ink outline-none focus:border-ink md:w-56"
              />
            </div>
            <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 md:mx-0 md:px-0">
              {(["all", ...MANGA_STATUS_ORDER] as const).map((s) => {
                const active = filter === s;
                const n = counts[s] ?? 0;
                if (s !== "all" && n === 0) return null;
                return (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={`shrink-0 rounded-full border-2 px-3 py-1.5 text-[12px] font-bold transition-colors ${
                      active ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-2 hover:border-ink"
                    }`}
                  >
                    {s === "all" ? "Toutes" : MANGA_STATUS_LABELS[s]} <span className="opacity-60">{n}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 md:grid-cols-6">
              {shown.map((m) => (
                <Link key={m.id} href={`/manga/${m.id}`} className="group flex flex-col gap-1.5">
                  <div className="relative">
                    <MangaCover
                      id={m.id}
                      title={m.title}
                      coverUrl={m.cover_url}
                      className="aspect-[2/3] h-auto w-full transition-transform group-hover:-translate-y-1"
                    />
                    {m.rating ? (
                      <span className="absolute right-1 top-1 rounded-[3px] border-2 border-ink bg-card px-1 text-[10px] font-bold text-ink">
                        ★ {String(m.rating).replace(".", ",")}
                      </span>
                    ) : null}
                  </div>
                  <p className="line-clamp-2 text-[12px] font-bold leading-tight text-ink">{m.title}</p>
                  <p className="-mt-1 text-[10.5px] text-muted">
                    {m.status === "reading" ? progressSummary(m) : MANGA_STATUS_LABELS[m.status]}
                  </p>
                </Link>
              ))}
            </div>
            {shown.length === 0 && <p className="py-6 text-center text-sm text-muted">Aucune série ne correspond.</p>}
          </section>

          {/* Dernières sessions */}
          {logs.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="font-serif text-xl text-ink">Dernières sessions</h2>
              <div className="manga-panel divide-y divide-line p-0">
                {logs.slice(0, 8).map((l) => {
                  const m = byId.get(l.manga_id);
                  return (
                    <Link key={l.id} href={`/manga/${l.manga_id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-violet-soft">
                      <span className="nums w-14 shrink-0 text-[11px] font-semibold text-muted">{fmtShortDate(l.date)}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{m?.title ?? "Série supprimée"}</span>
                      <span className="nums shrink-0 text-[12px] font-bold text-violet-deep">
                        +{l.amount} {unitLabel(l.unit, l.amount, true)}{" "}
                        <span className="font-medium text-muted">→ {l.end_value}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {toast && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] left-1/2 z-[70] -translate-x-1/2 rounded-xl border-2 border-ink bg-card px-4 py-2.5 text-sm font-bold text-ink shadow-[4px_4px_0_var(--color-ink)] md:bottom-6">
          {toast}
        </div>
      )}

      <AddMangaModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={(msg) => {
          setShowAdd(false);
          flash(msg);
          load();
        }}
      />
      <LogMangaModal
        open={logFor !== undefined}
        presetMangaId={logFor ?? null}
        onClose={() => setLogFor(undefined)}
        onSaved={(msg) => {
          setLogFor(undefined);
          flash(msg);
          load();
        }}
      />
    </div>
  );
}
