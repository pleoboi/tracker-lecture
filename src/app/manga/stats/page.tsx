"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useAuth } from "../../../lib/auth-context";
import { fetchMyMangas, fetchMyMangaLogs, unitLabel, type Manga, type MangaLog, type MangaUnit } from "../../../lib/manga";
import { MangaCover } from "../../../components/manga/MangaUI";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="manga-panel flex flex-col gap-1 p-4">
      <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted">{label}</span>
      <span className="nums font-serif text-3xl text-ink">{value}</span>
    </div>
  );
}

export default function MangaStatsPage() {
  const { user } = useAuth();
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [logs, setLogs] = useState<MangaLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [unit, setUnit] = useState<MangaUnit>("chapter");

  useEffect(() => {
    if (!user) return;
    Promise.all([fetchMyMangas(user.id), fetchMyMangaLogs(user.id)]).then(([ms, ls]) => {
      setMangas(ms);
      setLogs(ls);
      setLoading(false);
    });
  }, [user]);

  const years = useMemo(() => {
    const ys = new Set<number>([new Date().getFullYear()]);
    logs.forEach((l) => ys.add(Number(l.date.slice(0, 4))));
    return [...ys].sort((a, b) => b - a);
  }, [logs]);

  const yearLogs = useMemo(() => logs.filter((l) => l.date.startsWith(String(year))), [logs, year]);
  const byId = useMemo(() => new Map(mangas.map((m) => [m.id, m])), [mangas]);

  const sum = (u: MangaUnit) => yearLogs.filter((l) => l.unit === u).reduce((s, l) => s + l.amount, 0);
  const chapters = sum("chapter");
  const volumes = sum("volume");
  const activeDays = new Set(yearLogs.map((l) => l.date)).size;
  const finished = mangas.filter((m) => m.status === "completed" && m.date_finished?.startsWith(String(year)));
  const rated = finished.filter((m) => m.rating);
  const avgRating = rated.length ? rated.reduce((s, m) => s + Number(m.rating), 0) / rated.length : null;
  const seriesRead = new Set(yearLogs.map((l) => l.manga_id)).size;

  const monthly = useMemo(() => {
    const arr = MONTHS.map((name) => ({ name, value: 0 }));
    yearLogs.filter((l) => l.unit === unit).forEach((l) => {
      arr[Number(l.date.slice(5, 7)) - 1].value += l.amount;
    });
    return arr;
  }, [yearLogs, unit]);

  const topSeries = useMemo(() => {
    const totals = new Map<number, { chapter: number; volume: number }>();
    yearLogs.forEach((l) => {
      const t = totals.get(l.manga_id) ?? { chapter: 0, volume: 0 };
      t[l.unit] += l.amount;
      totals.set(l.manga_id, t);
    });
    return [...totals.entries()]
      .map(([id, t]) => ({ manga: byId.get(id), ...t }))
      .filter((x) => x.manga)
      .sort((a, b) => b.chapter + b.volume * 10 - (a.chapter + a.volume * 10))
      .slice(0, 5);
  }, [yearLogs, byId]);

  const genres = useMemo(() => {
    const ids = new Set(yearLogs.map((l) => l.manga_id));
    const counts = new Map<string, number>();
    ids.forEach((id) => byId.get(id)?.genres?.forEach((g) => counts.set(g, (counts.get(g) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [yearLogs, byId]);

  const currentMonth = year === new Date().getFullYear() ? new Date().getMonth() : -1;

  return (
    <div className="animate-fadeIn flex flex-col gap-6 pt-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-violet-deep">統計</p>
          <h1 className="font-serif text-4xl text-ink">Stats manga</h1>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-xl border-2 border-ink bg-card px-3 py-2 text-sm font-bold text-ink outline-none"
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

          <section className="manga-panel flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-serif text-lg text-ink">Mois par mois</h2>
              <div className="flex gap-1 rounded-lg border-2 border-ink p-0.5">
                {(["chapter", "volume"] as MangaUnit[]).map((u) => (
                  <button
                    key={u}
                    onClick={() => setUnit(u)}
                    className={`rounded-md px-2.5 py-1 text-[11.5px] font-bold ${unit === u ? "bg-ink text-paper" : "text-ink-2"}`}
                  >
                    {u === "chapter" ? "Chapitres" : "Tomes"}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthly} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--color-violet-soft)" }}
                  contentStyle={{ background: "var(--color-card)", border: "2px solid var(--color-ink)", borderRadius: 6, fontSize: 12 }}
                  formatter={(v) => [`${v} ${unitLabel(unit, Number(v))}`, ""]}
                  separator=""
                />
                <Bar dataKey="value" radius={[2, 2, 0, 0]} stroke="var(--color-ink)" strokeWidth={1.5}>
                  {monthly.map((_, i) => (
                    <Cell key={i} fill={i === currentMonth ? "var(--color-violet)" : "var(--color-ink)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="manga-panel flex flex-col gap-3 p-4">
              <h2 className="font-serif text-lg text-ink">Séries les plus lues</h2>
              {topSeries.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">Pas encore de session en {year}.</p>
              ) : (
                topSeries.map((s, i) => (
                  <Link key={s.manga!.id} href={`/manga/${s.manga!.id}`} className="flex items-center gap-3">
                    <span className="w-5 font-serif text-lg text-violet-deep">{i + 1}</span>
                    <MangaCover id={s.manga!.id} title={s.manga!.title} coverUrl={s.manga!.cover_url} className="h-12 w-8" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">{s.manga!.title}</span>
                    <span className="nums shrink-0 text-[12px] text-ink-2">
                      {[s.chapter ? `${s.chapter} ch.` : null, s.volume ? `${s.volume} t.` : null].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                ))
              )}
            </section>

            <section className="manga-panel flex flex-col gap-3 p-4">
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
                      <span className="w-28 shrink-0 truncate text-[12px] font-semibold text-ink">{g}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-[3px] border-2 border-ink">
                        <div className="manga-tone-band h-full" style={{ width: `${(n / genres[0][1]) * 100}%` }} />
                      </div>
                      <span className="nums w-5 text-right text-[11px] text-muted">{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
