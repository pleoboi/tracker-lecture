"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

/* ---------------- Indicateur d'avance (Année + Mois) ---------------- */

interface Period {
  cur: number;
  goal: number;
  expected: number; // attendu à date (pour calculer l'avance/retard)
}

function fmt(n: number) {
  return Math.round(n).toLocaleString("fr-FR");
}

function PeriodRow({ name, period, unit, accent }: { name: string; period: Period; unit: string; accent: string }) {
  const delta = period.cur - period.expected;
  const ok = delta >= 0;
  const frac = period.goal > 0 ? Math.min(period.cur / period.goal, 1) : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-ink">{name}</span>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            ok ? "bg-[#eaf1ea] text-success" : "bg-[#f6e7e1] text-danger"
          }`}
        >
          {ok ? "+" : "−"}
          {fmt(Math.abs(delta))} {unit}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#e6decc]">
        <div className="h-full rounded-full" style={{ width: `${frac * 100}%`, backgroundColor: accent }} />
      </div>
      <span className="text-[11px] font-medium text-muted">
        {fmt(period.cur)} / {fmt(period.goal)} {unit}
      </span>
    </div>
  );
}

export function GoalIndicator({
  title,
  accent,
  unit,
  year,
  month,
}: {
  title: string;
  accent: string;
  unit: string;
  year: Period;
  month: Period;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
        <h3 className="font-serif text-[16px] font-medium text-ink">{title}</h3>
      </div>
      <PeriodRow name="Année" period={year} unit={unit} accent={accent} />
      <div className="h-px bg-line" />
      <PeriodRow name="Ce mois" period={month} unit={unit} accent={accent} />
    </div>
  );
}

/* ---------------- Graphe mensuel avec objectif ajustable ---------------- */

function ChartTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2 text-xs font-semibold text-ink shadow-sm">
      {label} : {fmt(payload[0].value)} {unit}
    </div>
  );
}

export function ObjectiveChart({
  title,
  data,
  objective,
  unit,
  color,
  lightColor,
  currentMonth,
  onObjectiveChange,
  empty,
  type = "bar",
}: {
  title: string;
  data: { name: string; value: number }[];
  objective: number | null;
  unit: string;
  color: string;
  lightColor: string;
  currentMonth: number;
  onObjectiveChange?: (value: number) => void;
  empty?: string;
  type?: "bar" | "area";
}) {
  const gradId = "grad-" + title.replace(/[^a-zA-Z]/g, "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(objective ?? ""));

  const commit = () => {
    const v = Number(draft);
    if (!isNaN(v) && v > 0 && onObjectiveChange) onObjectiveChange(v);
    setEditing(false);
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-serif text-[15px] font-medium text-ink">{title}</h3>
        {objective !== null && (editing ? (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && commit()}
              autoFocus
              className="w-20 rounded-lg border border-violet bg-white px-2 py-1 text-xs font-semibold text-ink outline-none"
            />
            <button onClick={commit} className="rounded-lg bg-violet px-2 py-1 text-xs font-semibold text-cream">
              OK
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setDraft(String(objective)); setEditing(true); }}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-ink-2"
            disabled={!onObjectiveChange}
          >
            Objectif : {fmt(objective ?? 0)} {unit}/mois {onObjectiveChange && <span className="text-muted">✎</span>}
          </button>
        ))}
      </div>

      {empty ? (
        <div className="flex h-[150px] items-center justify-center rounded-xl bg-paper text-xs font-medium text-muted">
          {empty}
        </div>
      ) : type === "area" ? (
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={data} margin={{ top: 8, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.32} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="name"
              interval={0}
              tickLine={false}
              axisLine={false}
              padding={{ left: 6, right: 6 }}
              tick={{ fontSize: 9, fill: "#968da1" }}
            />
            <YAxis hide domain={[0, "dataMax"]} />
            <Tooltip cursor={{ stroke: "#d8cfe6" }} content={(p) => <ChartTooltip {...p} unit={unit} />} />
            {objective !== null && <ReferenceLine y={objective} stroke={color} strokeDasharray="4 4" strokeOpacity={0.65} />}
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#${gradId})`}
              dot={(props: any) =>
                props.index === currentMonth ? (
                  <circle key={props.index} cx={props.cx} cy={props.cy} r={3.5} fill={color} stroke="var(--color-card)" strokeWidth={2} />
                ) : (
                  <g key={props.index} />
                )
              }
              activeDot={{ r: 4, fill: color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={data} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
            <XAxis
              dataKey="name"
              interval={0}
              tickLine={false}
              axisLine={false}
              padding={{ left: 2, right: 2 }}
              tick={{ fontSize: 9, fill: "#968da1" }}
            />
            <YAxis hide domain={[0, "dataMax"]} />
            <Tooltip cursor={{ fill: "rgba(139,121,190,0.08)" }} content={(p) => <ChartTooltip {...p} unit={unit} />} />
            {objective !== null && <ReferenceLine y={objective} stroke={color} strokeDasharray="4 4" strokeOpacity={0.65} />}
            <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={20}>
              {data.map((_, i) => (
                <Cell key={i} fill={i === currentMonth ? color : lightColor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/* ---------------- Répartition des notes (façon Letterboxd) ---------------- */

function RatingsTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2 text-xs font-semibold text-ink shadow-sm">
      <span className="text-gold">{"★".repeat(Math.round(p.stars))}</span> {p.label} — {p.value} livre{p.value > 1 ? "s" : ""}
    </div>
  );
}

export function RatingsChart({ counts, average, total }: { counts: number[]; average: number; total: number }) {
  // counts[0] = 0,5★ ... counts[9] = 5★
  const data = counts.map((c, i) => {
    const stars = (i + 1) * 0.5;
    return {
      stars,
      label: stars.toFixed(1).replace(".", ",") + "★",
      name: Number.isInteger(stars) ? String(stars) : "",
      value: c,
    };
  });

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-end justify-between">
        <h3 className="font-serif text-[15px] font-medium text-ink">Répartition des notes</h3>
        <div className="text-right">
          <span className="font-serif text-xl font-black text-gold">
            {average > 0 ? average.toFixed(2).replace(".", ",") : "—"}
          </span>
          <span className="ml-1 text-[11px] font-medium text-muted">moy.</span>
        </div>
      </div>

      {total === 0 ? (
        <div className="flex h-[130px] items-center justify-center rounded-xl bg-paper text-xs font-medium text-muted">
          Note tes livres terminés pour voir la répartition
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={data} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
              <XAxis
                dataKey="name"
                interval={0}
                tickLine={false}
                axisLine={false}
                padding={{ left: 2, right: 2 }}
                tick={{ fontSize: 10, fill: "#968da1" }}
              />
              <YAxis hide domain={[0, "dataMax"]} />
              <Tooltip cursor={{ fill: "rgba(215,163,63,0.10)" }} content={<RatingsTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={26} fill="var(--color-gold)" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-between px-1 text-[11px] font-medium text-muted">
            <span className="text-gold">½★</span>
            <span>{total} livre{total > 1 ? "s" : ""} noté{total > 1 ? "s" : ""}</span>
            <span className="text-gold">★★★★★</span>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Petite carte de stat ---------------- */

export function StatCard({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-card p-4">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className="font-serif text-2xl font-black" style={{ color: accent || "var(--color-ink)" }}>
        {value} {unit && <span className="text-xs font-medium text-muted">{unit}</span>}
      </span>
    </div>
  );
}
