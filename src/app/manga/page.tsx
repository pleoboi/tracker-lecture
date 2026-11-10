"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/auth-context";
import {
  fetchMyMangas,
  mangaProgress,
  progressSummary,
  releaseState,
  readTarget,
  type Manga,
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

export default function MangaPage() {
  const { user } = useAuth();
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [logFor, setLogFor] = useState<number | null | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setMangas(await fetchMyMangas(user.id));
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
