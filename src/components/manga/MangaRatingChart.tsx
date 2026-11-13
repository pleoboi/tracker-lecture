"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { unitLabel, type MangaLog, type MangaUnit } from "../../lib/manga";

type Point = { x: number; rating: number; date: string; sessions: number };

function pointsFor(logs: MangaLog[], unit: MangaUnit): Point[] {
  const byX = new Map<number, { sum: number; n: number; date: string }>();
  for (const l of logs) {
    if (l.unit !== unit || !(Number(l.rating) > 0)) continue;
    const cur = byX.get(l.end_value) ?? { sum: 0, n: 0, date: l.date };
    cur.sum += Number(l.rating);
    cur.n += 1;
    if (l.date > cur.date) cur.date = l.date;
    byX.set(l.end_value, cur);
  }
  return [...byX.entries()]
    .map(([x, v]) => ({ x, rating: Math.round((v.sum / v.n) * 10) / 10, date: v.date, sessions: v.n }))
    .sort((a, b) => a.x - b.x);
}

const fmt = (n: number) => String(n).replace(".", ",");

/**
 * Évolution de la note au fil de la lecture : un point par fin de session notée
 * (chapitre ou tome atteint en abscisse, note donnée au moment de logger en ordonnée).
 */
export default function MangaRatingChart({ logs }: { logs: MangaLog[] }) {
  const chapters = useMemo(() => pointsFor(logs, "chapter"), [logs]);
  const volumes = useMemo(() => pointsFor(logs, "volume"), [logs]);
  const [pick, setPick] = useState<MangaUnit | null>(null);

  const unit: MangaUnit = pick ?? (chapters.length >= volumes.length ? "chapter" : "volume");
  const data = unit === "chapter" ? chapters : volumes;
  if (chapters.length + volumes.length === 0) return null;

  const both = chapters.length >= 2 && volumes.length >= 2;
  const avg = data.length ? data.reduce((s, p) => s + p.rating, 0) / data.length : 0;
  const first = data[0];
  const last = data[data.length - 1];
  const delta = data.length >= 2 ? last.rating - first.rating : null;

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl text-ink">Évolution de ma note</h2>
        {both && (
          <div className="flex gap-1.5">
            {(["chapter", "volume"] as const).map((u) => (
              <button
                key={u}
                onClick={() => setPick(u)}
                className={`rounded-full border-2 px-2.5 py-0.5 text-[11.5px] font-bold ${unit === u ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-2"}`}
              >
                {u === "chapter" ? "Chapitres" : "Tomes"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="manga-panel flex min-w-0 flex-col gap-3 p-3.5">
        {data.length < 2 ? (
          <p className="py-4 text-center text-[12.5px] text-muted">
            Une seule note pour l&apos;instant ({fmt(data[0]?.rating ?? 0)} ★). Note tes prochaines sessions pour voir la courbe évoluer.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] font-bold text-ink">
              <span>Moyenne <span className="nums text-violet-deep">{fmt(Math.round(avg * 10) / 10)} ★</span></span>
              <span>
                Dernière <span className="nums text-violet-deep">{fmt(last.rating)} ★</span>
              </span>
              {delta != null && (
                <span className={delta >= 0 ? "text-success" : "text-danger"}>
                  {delta > 0 ? "+" : ""}
                  {fmt(Math.round(delta * 10) / 10)} depuis le début
                </span>
              )}
            </div>
            <div className="h-44 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "var(--color-muted)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--color-line)" }}
                  />
                  <YAxis
                    domain={[0, 5]}
                    ticks={[1, 2, 3, 4, 5]}
                    tick={{ fontSize: 10, fill: "var(--color-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    width={34}
                  />
                  <ReferenceLine y={avg} stroke="var(--color-muted)" strokeDasharray="4 4" />
                  <Tooltip
                    cursor={{ stroke: "var(--color-line)" }}
                    content={({ active, payload }) => {
                      const p = active ? (payload?.[0]?.payload as Point | undefined) : undefined;
                      if (!p) return null;
                      return (
                        <div className="rounded-lg border-2 border-ink bg-card px-2.5 py-1.5 text-[12px] font-bold text-ink shadow-[3px_3px_0_var(--color-ink)]">
                          <p>
                            {unit === "chapter" ? "Ch." : "Tome"} {p.x} · {fmt(p.rating)} ★
                          </p>
                          <p className="text-[10.5px] font-medium text-muted">
                            {new Date(p.date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                            {p.sessions > 1 ? ` · moyenne de ${p.sessions} sessions` : ""}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rating"
                    stroke="var(--color-violet)"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: "var(--color-violet)", stroke: "var(--color-ink)", strokeWidth: 1.5 }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-[10.5px] text-muted">
              Note donnée à chaque session, selon le {unitLabel(unit, 1)} atteint. Ligne pointillée : ta moyenne.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
