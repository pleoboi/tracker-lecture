"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  AreaChart,
  Area,
  LineChart,
  Line,
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
  expected: number;
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

export interface FriendLine {
  name: string;
  color: string;
  data: { name: string; value: number }[];
}

function ChartTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2 shadow-sm">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-[11px] font-semibold">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
          <span className="text-ink">
            {p.dataKey === "value" ? "Moi" : p.name || p.dataKey} : {fmt(p.value)} {unit}
          </span>
        </div>
      ))}
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
  friendLines,
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
  friendLines?: FriendLine[];
}) {
  const gradId = "grad-" + title.replace(/[^a-zA-Z]/g, "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(objective ?? ""));

  const mergedData = friendLines
    ? data.map((d, i) => {
        const row: Record<string, number | string> = { name: d.name, value: d.value };
        friendLines.forEach(({ name, data: fd }) => {
          row[name] = fd[i]?.value ?? 0;
        });
        return row;
      })
    : data;

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
        <>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={mergedData} margin={{ top: 8, right: 10, left: 10, bottom: 0 }}>
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
              {friendLines && friendLines.map(({ name, color: c }) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={c}
                  strokeWidth={1.8}
                  strokeDasharray="5 3"
                  dot={false}
                  activeDot={{ r: 3, fill: c }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
          {friendLines && friendLines.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 px-1">
              <div className="flex items-center gap-1.5">
                <span className="block h-0.5 w-4 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[10px] font-medium text-muted">Moi</span>
              </div>
              {friendLines.map(({ name, color: c }) => (
                <div key={name} className="flex items-center gap-1.5">
                  <span className="block w-4 border-t-[2px] border-dashed" style={{ borderColor: c }} />
                  <span className="text-[10px] font-medium text-muted">{name}</span>
                </div>
              ))}
            </div>
          )}
        </>
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

const HALF_LABELS = ["½", "1", "1½", "2", "2½", "3", "3½", "4", "4½", "5"];

function barFill(stars: number) {
  const t = (stars - 0.5) / 4.5;
  return `rgb(${Math.round(232 - 17 * t)},${Math.round(217 - 54 * t)},${Math.round(168 - 105 * t)})`;
}

function RatingsTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2 text-xs font-semibold text-ink shadow-sm">
      <span style={{ color: "#c9a227" }}>{p.label}</span> — {p.value} livre{p.value > 1 ? "s" : ""}
    </div>
  );
}

export function RatingsChart({ counts, average, total }: { counts: number[]; average: number; total: number }) {
  const data = counts.map((c, i) => {
    const stars = (i + 1) * 0.5;
    return {
      stars,
      label: stars.toFixed(1).replace(".", ",") + "★",
      name: HALF_LABELS[i],
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
            <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
              <XAxis
                dataKey="name"
                interval={0}
                tickLine={false}
                axisLine={false}
                padding={{ left: 2, right: 2 }}
                tick={{ fontSize: 8, fill: "#968da1" }}
              />
              <YAxis hide domain={[0, "dataMax"]} />
              <Tooltip cursor={{ fill: "rgba(215,163,63,0.10)" }} content={<RatingsTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={22}>
                {data.map((d, i) => (
                  <Cell key={i} fill={barFill(d.stars)} />
                ))}
              </Bar>
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

/* ---------------- Graphique comparatif jour par jour (mois en cours) ---------------- */

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function DailyTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2 shadow-sm">
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-[11px] font-semibold">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-ink">: {fmt(p.value)} p.</span>
        </div>
      ))}
    </div>
  );
}

export function DailyComparisonChart({
  myData,
  mutuals,
  month,
  year,
  myColor = "var(--color-violet)",
}: {
  myData: { day: number; pages: number }[];
  mutuals: { name: string; color: string; data: { day: number; pages: number }[] }[];
  month: number;
  year: number;
  myColor?: string;
}) {
  const chartData = myData.map(({ day, pages }) => {
    const row: Record<string, number> = { day, Moi: pages };
    mutuals.forEach(({ name, data }) => {
      row[name] = data.find((d) => d.day === day)?.pages ?? 0;
    });
    return row;
  });

  if (chartData.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div>
        <h3 className="font-serif text-[15px] font-medium text-ink">Pages / jour — 10 derniers jours</h3>
        <p className="text-[10px] text-muted">{MONTHS_FR[month]} {year}</p>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 9, fill: "#968da1" }}
            interval={0}
          />
          <YAxis hide />
          <Tooltip content={<DailyTooltip />} />
          <Line
            type="monotone"
            dataKey="Moi"
            stroke={myColor}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: myColor }}
          />
          {mutuals.map(({ name, color }) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={color}
              strokeWidth={1.8}
              strokeDasharray="5 3"
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap items-center gap-3 px-1">
        <div className="flex items-center gap-1.5">
          <span className="block h-0.5 w-4 rounded-full" style={{ backgroundColor: myColor }} />
          <span className="text-[10px] font-medium text-muted">Moi</span>
        </div>
        {mutuals.map(({ name, color }) => (
          <div key={name} className="flex items-center gap-1.5">
            <span className="block w-4 border-t-[2px] border-dashed" style={{ borderColor: color }} />
            <span className="text-[10px] font-medium text-muted">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Petite carte de stat ---------------- */

export function StatCard({
  label,
  value,
  unit,
  accent,
  vs,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: string;
  vs?: { label: string; value: string; color?: string };
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-card p-4">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className="font-serif text-2xl font-black" style={{ color: accent || "var(--color-ink)" }}>
        {value} {unit && <span className="text-xs font-medium text-muted">{unit}</span>}
      </span>
      {vs && (
        <div className="flex items-center gap-1.5 border-t border-line pt-1.5">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: vs.color || "#e07246" }}
          />
          <span className="text-[10px] font-medium text-muted">{vs.label}</span>
          <span
            className="font-serif text-[13px] font-bold"
            style={{ color: vs.color || "#e07246" }}
          >
            {vs.value}
          </span>
        </div>
      )}
    </div>
  );
}
