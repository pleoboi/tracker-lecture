"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { supabase } from "../../lib/supabase";
import {
  fetchMyMangas,
  fetchMyMangaLogs,
  backfillDemographics,
  volumeEvents,
  sumVolumeEvents,
  mangaProfileHref,
  unitLabel,
  MANGA_DEMOGRAPHICS,
  type Manga,
  type MangaLog,
  type MangaUnit,
} from "../../lib/manga";
import { localISO, shiftDateISO } from "../../lib/books";
import { computeStreaks } from "../../lib/mangaBadges";
import { MangaCover, RatingTag } from "./MangaUI";
import { MangaBadgeGlyph } from "./MangaBadgeIcon";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="manga-panel flex min-w-0 flex-col gap-1 p-4">
      <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted">{label}</span>
      <span className="nums font-serif text-3xl text-ink">{value}</span>
    </div>
  );
}

/** « ch. 12–14 », « ch. 12 » ou « tome 3 » selon l'unité de la session. */
function sessionRange(l: MangaLog) {
  if (l.unit === "volume") return `tome ${l.end_value}`;
  const start = l.end_value - l.amount + 1;
  return l.amount > 1 && start < l.end_value ? `ch. ${start}–${l.end_value}` : `ch. ${l.end_value}`;
}

/**
 * Statistiques manga d'un membre. Sur ses propres stats, les séries sans
 * catégorie (shonen, seinen...) sont complétées automatiquement via AniList.
 */
export default function MangaStatsView({ userId, isOwn }: { userId: string; isOwn: boolean }) {
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [logs, setLogs] = useState<MangaLog[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [demoScope, setDemoScope] = useState<"library" | "year">("library");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ms, ls, prof] = await Promise.all([
        fetchMyMangas(userId),
        fetchMyMangaLogs(userId),
        isOwn ? null : supabase.from("user_profiles").select("display_name").eq("id", userId).single(),
      ]);
      if (cancelled) return;
      setMangas(ms);
      setLogs(ls);
      setName((prof?.data as { display_name?: string } | null)?.display_name ?? "");
      setLoading(false);
      if (isOwn) {
        const filled = await backfillDemographics(ms).catch(() => ms);
        if (!cancelled) setMangas(filled);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, isOwn]);

  const years = useMemo(() => {
    const ys = new Set<number>([new Date().getFullYear()]);
    logs.forEach((l) => ys.add(Number(l.date.slice(0, 4))));
    return [...ys].sort((a, b) => b - a);
  }, [logs]);

  const yearLogs = useMemo(() => logs.filter((l) => l.date.startsWith(String(year))), [logs, year]);
  const byId = useMemo(() => new Map(mangas.map((m) => [m.id, m])), [mangas]);

  const sum = (u: MangaUnit) => yearLogs.filter((l) => l.unit === u).reduce((s, l) => s + l.amount, 0);
  const chapters = sum("chapter");
  const volEvents = useMemo(() => volumeEvents(mangas, logs), [mangas, logs]);
  const volumes = sumVolumeEvents(volEvents, String(year));
  const activeDays = new Set(yearLogs.map((l) => l.date)).size;
  const finished = mangas.filter((m) => m.status === "completed" && m.date_finished?.startsWith(String(year)));
  const rated = finished.filter((m) => m.rating);
  const avgRating = rated.length ? rated.reduce((s, m) => s + Number(m.rating), 0) / rated.length : null;
  const seriesRead = new Set(yearLogs.map((l) => l.manga_id)).size;

  const monthlyChapters = useMemo(() => {
    const arr = MONTHS.map((n) => ({ name: n, value: 0 }));
    yearLogs.filter((l) => l.unit === "chapter").forEach((l) => {
      arr[Number(l.date.slice(5, 7)) - 1].value += l.amount;
    });
    return arr;
  }, [yearLogs]);
  const monthlyVolumes = useMemo(() => {
    const arr = MONTHS.map((n) => ({ name: n, value: 0 }));
    volEvents.filter((e) => e.date.startsWith(String(year))).forEach((e) => {
      arr[Number(e.date.slice(5, 7)) - 1].value += e.delta;
    });
    return arr;
  }, [volEvents, year]);

  const topSeries = useMemo(() => {
    const totals = new Map<number, { chapter: number; volume: number }>();
    yearLogs.forEach((l) => {
      const t = totals.get(l.manga_id) ?? { chapter: 0, volume: 0 };
      if (l.unit === "chapter") t.chapter += l.amount;
      totals.set(l.manga_id, t);
    });
    volEvents.filter((e) => e.date.startsWith(String(year))).forEach((e) => {
      const t = totals.get(e.manga_id);
      if (t) t.volume += e.delta;
    });
    return [...totals.entries()]
      .map(([id, t]) => ({ manga: byId.get(id), ...t }))
      .filter((x) => x.manga)
      .sort((a, b) => b.chapter + b.volume * 10 - (a.chapter + a.volume * 10))
      .slice(0, 5);
  }, [yearLogs, byId, volEvents, year]);

  const genres = useMemo(() => {
    const ids = new Set(yearLogs.map((l) => l.manga_id));
    const counts = new Map<string, number>();
    ids.forEach((id) => byId.get(id)?.genres?.forEach((g) => counts.set(g, (counts.get(g) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [yearLogs, byId]);

  // Répartition par catégorie : toute la mangathèque, ou seulement les séries lues dans l'année
  const demographics = useMemo(() => {
    const scope = demoScope === "library" ? mangas : mangas.filter((m) => yearLogs.some((l) => l.manga_id === m.id));
    const counts = new Map<string, number>();
    scope.forEach((m) => counts.set(m.demographic ?? "none", (counts.get(m.demographic ?? "none") ?? 0) + 1));
    const total = scope.length;
    const rows = [
      ...MANGA_DEMOGRAPHICS.map((d) => ({ key: d.key as string, label: d.label, color: d.color, value: counts.get(d.key) ?? 0 })),
      { key: "none", label: "Non classé", color: "var(--color-line)", value: counts.get("none") ?? 0 },
    ].filter((r) => r.value > 0);
    return { rows: rows.sort((a, b) => b.value - a.value), total };
  }, [mangas, yearLogs, demoScope]);

  // Meilleures sessions : les chapitres / tomes que tu as le mieux notés en les loggant
  const bestSessions = useMemo(
    () =>
      yearLogs
        .filter((l) => l.rating && byId.has(l.manga_id))
        .sort((a, b) => Number(b.rating) - Number(a.rating) || b.date.localeCompare(a.date))
        .slice(0, 5),
    [yearLogs, byId]
  );

  // Série de jours : sur tout l'historique, pas seulement l'année affichée
  const streaks = useMemo(() => computeStreaks(logs.map((l) => l.date), localISO()), [logs]);
  const lastDays = useMemo(() => {
    const read = new Set(logs.map((l) => l.date));
    const today = localISO();
    return Array.from({ length: 14 }, (_, i) => {
      const d = shiftDateISO(today, i - 13);
      return { d, read: read.has(d), isToday: d === today };
    });
  }, [logs]);

  const currentMonth = year === new Date().getFullYear() ? new Date().getMonth() : -1;
  const seriesHref = (id: number) => `/manga/${id}`;

  return (
    <div className="animate-fadeIn flex min-w-0 flex-col gap-6 pt-4">
      {!isOwn && (
        <Link href={mangaProfileHref(userId)} className="text-[12px] font-semibold text-muted hover:text-ink">
          ← Profil manga
        </Link>
      )}
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-violet-deep">統計</p>
          <h1 className="font-serif text-3xl text-ink sm:text-4xl">{isOwn ? "Stats manga" : `Stats de ${name || "…"}`}</h1>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="shrink-0 rounded-xl border-2 border-ink bg-card px-3 py-2 text-sm font-bold text-ink outline-none"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </header>

      {loading ? (
        <p className="py-16 text-center text-xs font-medium uppercase tracking-wider text-muted">Chargement…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Chapitres" value={chapters.toLocaleString("fr-FR")} />
            <Stat label="Tomes" value={volumes.toLocaleString("fr-FR")} />
            <Stat label="Séries finies" value={String(finished.length)} />
            <Stat label="Jours de lecture" value={String(activeDays)} />
          </div>

          {/* Série de jours */}
          <section className="manga-panel flex min-w-0 flex-col gap-3 p-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-ink ${
                  streaks.current > 0 ? "bg-violet text-cream" : "bg-card text-muted"
                }`}
              >
                <MangaBadgeGlyph icon="flame" className="h-7 w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted">Série en cours</p>
                <p className="nums font-serif text-3xl leading-none text-ink">
                  {streaks.current} <span className="font-sans text-sm font-semibold text-muted">jour{streaks.current > 1 ? "s" : ""}</span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted">Record</p>
                <p className="nums font-serif text-2xl leading-none text-ink">
                  {streaks.best} <span className="font-sans text-xs font-semibold text-muted">j.</span>
                </p>
              </div>
            </div>
            <div className="flex gap-1" aria-label="14 derniers jours">
              {lastDays.map((day) => (
                <div
                  key={day.d}
                  title={day.d}
                  className={`h-6 min-w-0 flex-1 rounded-[3px] border-2 ${
                    day.read ? "border-ink bg-violet" : day.isToday ? "border-dashed border-ink bg-card" : "border-line bg-card"
                  }`}
                />
              ))}
            </div>
            {isOwn && (
              <p className="text-[12px] text-muted">
                {streaks.readToday
                  ? streaks.current > 1 && streaks.current === streaks.best
                    ? "Série du jour validée, et c'est ton record !"
                    : "Série du jour validée."
                  : streaks.current > 0
                    ? `Lis un chapitre aujourd'hui pour garder ta série de ${streaks.current} jour${streaks.current > 1 ? "s" : ""}.`
                    : "Lis un chapitre aujourd'hui pour lancer une série."}
              </p>
            )}
          </section>

          <section className="manga-panel flex min-w-0 flex-col gap-3 p-4">
            <h2 className="font-serif text-lg text-ink">Chapitres, mois par mois</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyChapters} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--color-violet-soft)" }}
                  contentStyle={{ background: "var(--color-card)", border: "2px solid var(--color-ink)", borderRadius: 6, fontSize: 12 }}
                  labelStyle={{ color: "var(--color-ink)", fontWeight: 700 }}
                  itemStyle={{ color: "var(--color-ink)" }}
                  formatter={(v) => [`${v} ${unitLabel("chapter", Number(v))}`, ""]}
                  separator=""
                />
                <Bar dataKey="value" radius={[2, 2, 0, 0]} stroke="var(--color-ink)" strokeWidth={1.5}>
                  {monthlyChapters.map((_, i) => (
                    <Cell key={i} fill={i === currentMonth ? "var(--color-violet)" : "var(--color-ink)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="manga-panel flex min-w-0 flex-col gap-3 p-4">
            <h2 className="font-serif text-lg text-ink">Tomes, mois par mois</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyVolumes} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--color-violet-soft)" }}
                  contentStyle={{ background: "var(--color-card)", border: "2px solid var(--color-ink)", borderRadius: 6, fontSize: 12 }}
                  labelStyle={{ color: "var(--color-ink)", fontWeight: 700 }}
                  itemStyle={{ color: "var(--color-ink)" }}
                  formatter={(v) => [`${v} ${unitLabel("volume", Number(v))}`, ""]}
                  separator=""
                />
                <Bar dataKey="value" radius={[2, 2, 0, 0]} stroke="var(--color-ink)" strokeWidth={1.5}>
                  {monthlyVolumes.map((_, i) => (
                    <Cell key={i} fill={i === currentMonth ? "var(--color-violet)" : "var(--color-ink)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>

          {/* Répartition par catégorie */}
          <section className="manga-panel flex min-w-0 flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-lg text-ink">Répartition par catégorie</h2>
              <div className="flex gap-1 rounded-lg border-2 border-ink p-0.5">
                {([
                  { v: "library", label: "Mangathèque" },
                  { v: "year", label: `Lus en ${year}` },
                ] as const).map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setDemoScope(o.v)}
                    className={`rounded-md px-2.5 py-1 text-[11.5px] font-bold ${demoScope === o.v ? "bg-ink text-paper" : "text-ink-2"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            {demographics.total === 0 ? (
              <p className="py-4 text-center text-sm text-muted">
                {demoScope === "year" ? `Pas encore de série lue en ${year}.` : "Aucune série dans la mangathèque."}
              </p>
            ) : (
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-center gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
                <div className="relative mx-auto h-[200px] w-[200px] max-w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={demographics.rows}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={54}
                        outerRadius={92}
                        paddingAngle={2}
                        stroke="var(--color-ink)"
                        strokeWidth={2}
                        isAnimationActive={false}
                      >
                        {demographics.rows.map((r) => (
                          <Cell key={r.key} fill={r.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="nums font-serif text-3xl leading-none text-ink">{demographics.total}</span>
                    <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted">séries</span>
                  </div>
                </div>
                <ul className="flex min-w-0 flex-col gap-2">
                  {demographics.rows.map((r) => (
                    <li key={r.key} className="flex items-center gap-2.5">
                      <span className="h-3.5 w-3.5 shrink-0 rounded-[3px] border-2 border-ink" style={{ background: r.color }} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">{r.label}</span>
                      <span className="nums shrink-0 text-[12px] text-ink-2">
                        {r.value} · {Math.round((r.value / demographics.total) * 100)} %
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
            <section className="manga-panel flex min-w-0 flex-col gap-3 p-4">
              <h2 className="font-serif text-lg text-ink">Séries les plus lues</h2>
              {topSeries.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">Pas encore de session en {year}.</p>
              ) : (
                topSeries.map((s, i) => (
                  <Link key={s.manga!.id} href={seriesHref(s.manga!.id)} className="flex min-w-0 items-center gap-3">
                    <span className="w-5 shrink-0 font-serif text-lg text-violet-deep">{i + 1}</span>
                    <MangaCover id={s.manga!.id} title={s.manga!.title} coverUrl={s.manga!.cover_url} className="h-12 w-8" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">{s.manga!.title}</span>
                    <span className="nums shrink-0 text-[12px] text-ink-2">
                      {[s.chapter ? `${s.chapter} ch.` : null, s.volume ? `${s.volume} t.` : null].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                ))
              )}
            </section>

            <section className="manga-panel flex min-w-0 flex-col gap-3 p-4">
              <h2 className="font-serif text-lg text-ink">En {year}</h2>
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted">Séries lues</p>
                  <p className="nums font-serif text-2xl text-ink">{seriesRead}</p>
                </div>
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted">Note moyenne</p>
                  <p className="nums font-serif text-2xl text-ink">{avgRating ? avgRating.toFixed(2).replace(".", ",") : "–"}</p>
                </div>
              </div>
              {genres.length > 0 && (
                <div className="flex flex-col gap-1.5 border-t border-line pt-3">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted">Genres</p>
                  {genres.map(([g, n]) => (
                    <div key={g} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 truncate text-[12px] font-semibold text-ink sm:w-28">{g}</span>
                      <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-[3px] border-2 border-ink">
                        <div className="manga-tone-band h-full" style={{ width: `${(n / genres[0][1]) * 100}%` }} />
                      </div>
                      <span className="nums w-5 shrink-0 text-right text-[11px] text-muted">{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Meilleurs chapitres, d'après les notes données en les loggant */}
          <section className="manga-panel flex min-w-0 flex-col gap-3 p-4">
            <h2 className="font-serif text-lg text-ink">Meilleurs chapitres</h2>
            {bestSessions.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted">
                {isOwn
                  ? "Note tes chapitres quand tu les logues : tes meilleurs passages apparaîtront ici."
                  : `Aucun chapitre noté en ${year}.`}
              </p>
            ) : (
              bestSessions.map((l) => {
                const m = byId.get(l.manga_id)!;
                return (
                  <Link key={l.id} href={seriesHref(m.id)} className="flex min-w-0 items-center gap-3">
                    <MangaCover id={m.id} title={m.title} coverUrl={l.cover_url ?? m.cover_url} className="h-12 w-8" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-ink">{m.title}</p>
                      <p className="nums truncate text-[11.5px] text-muted">
                        {sessionRange(l)}
                        {l.unit === "chapter" && l.volume ? ` · tome ${l.volume}` : ""}
                      </p>
                    </div>
                    <RatingTag value={Number(l.rating)} className="shrink-0 text-[13px]" />
                  </Link>
                );
              })
            )}
          </section>
        </>
      )}
    </div>
  );
}
