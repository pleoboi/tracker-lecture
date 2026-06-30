"use client";

import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  LabelList,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import type { Book } from "../lib/types";

// ── Palette genres ────────────────────────────────────────────────────────────
const GENRE_PALETTE = [
  "#6366f1", "#7c3aed", "#ec4899", "#f59e0b", "#10b981",
  "#8b5cf6", "#ef4444", "#3b82f6", "#f97316", "#14b8a6",
  "#84cc16", "#f43f5e", "#a855f7", "#22d3ee",
];

// ── Classification Fiction / Non-Fiction ──────────────────────────────────────
const FICTION_KEYS = [
  "fiction", "fantasy", "science fiction", "sci-fi", "science-fantasy",
  "romance", "mystery", "thriller", "horror", "adventure", "young adult",
  "comics", "manga", "children", "graphic novel", "literary fiction",
  "historical fiction", "crime", "detective", "suspense", "fantastique",
  "policier", "jeunesse", "bande dessinée",
];
const NONFICTION_KEYS = [
  "non-fiction", "nonfiction", "biography", "autobiography", "history",
  "science", "philosophy", "psychology", "business", "self-help", "travel",
  "cooking", "health", "education", "politics", "economics", "memoir",
  "true crime", "journalism", "essay", "biographie", "histoire", "essai",
  "développement personnel",
];

function classifyFiction(genre: string | null | undefined): "Fiction" | "Non-Fiction" | "Inconnu" {
  if (!genre) return "Inconnu";
  const g = genre.toLowerCase().trim();
  if (FICTION_KEYS.some((k) => g.includes(k))) return "Fiction";
  if (NONFICTION_KEYS.some((k) => g.includes(k))) return "Non-Fiction";
  return "Inconnu";
}

// ── Tooltip générique ─────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, unit = "" }: {
  active?: boolean; payload?: { value: number }[]; label?: string | number; unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11px] shadow-md">
      {label !== undefined && <span className="font-semibold text-ink">{label} </span>}
      <span className="text-muted">{payload[0].value}{unit ? ` ${unit}` : ""}</span>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return <p className="text-[9.5px] font-bold uppercase tracking-widest text-muted">{label}</p>;
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. GENRE BREAKDOWN
// ══════════════════════════════════════════════════════════════════════════════
export function GenreBreakdown({ books }: { books: Book[] }) {
  const [showAll, setShowAll] = useState(false);

  const completed = books.filter((b) => b.status === "completed");
  const missing = completed.filter((b) => !b.genre).length;

  const genreMap = new Map<string, number>();
  completed.forEach((b) => {
    if (!b.genre) return;
    const g = b.genre.trim();
    genreMap.set(g, (genreMap.get(g) || 0) + 1);
  });

  const total = completed.length;
  const genres = Array.from(genreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count], i) => ({
      name,
      count,
      pct: total > 0 ? (count / total) * 100 : 0,
      color: GENRE_PALETTE[i % GENRE_PALETTE.length],
    }));

  if (genres.length === 0) return null;

  const shown = showAll ? genres : genres.slice(0, 8);
  const topGenre = genres[0]?.name ?? "Fiction";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div>
        <SectionLabel label="Genre Breakdown" />
        <h2 className="font-serif text-[16px] font-semibold text-ink">
          {topGenre} est votre genre de prédilection
        </h2>
      </div>

      <div className="flex flex-col gap-2.5">
        {shown.map(({ name, count, pct, color }) => (
          <div key={name} className="flex items-center gap-3">
            <span
              className="w-[108px] shrink-0 truncate text-[12.5px] font-semibold"
              style={{ color }}
            >
              {name}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <span className="w-[72px] shrink-0 text-right text-[11px] font-semibold text-ink-2">
              {count} ({pct.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {missing > 0 && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
            </svg>
            Données manquantes pour {missing} livre{missing > 1 ? "s" : ""}
          </p>
        )}
        {genres.length > 8 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="ml-auto rounded-lg border border-line px-3 py-1 text-[11px] font-medium text-muted transition-colors hover:text-ink"
          >
            {showAll ? "Réduire" : `Voir plus (${genres.length - 8})`}
          </button>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. FICTION VS NON-FICTION (Donut)
// ══════════════════════════════════════════════════════════════════════════════
const DONUT_META = {
  Fiction:       { color: "#ec4899", label: "Fiction" },
  "Non-Fiction": { color: "#6366f1", label: "Non-Fiction" },
  Inconnu:       { color: "#6b7280", label: "Inconnu" },
};

export function FictionDonut({ books }: { books: Book[] }) {
  const completed = books.filter((b) => b.status === "completed");
  const counts = { Fiction: 0, "Non-Fiction": 0, Inconnu: 0 };
  completed.forEach((b) => { counts[classifyFiction(b.genre)]++; });
  const total = completed.length;
  if (total === 0) return null;

  const data = (Object.keys(DONUT_META) as (keyof typeof DONUT_META)[])
    .filter((k) => counts[k] > 0)
    .map((k) => ({ name: k, value: counts[k], ...DONUT_META[k] }));

  const top = data.sort((a, b) => b.value - a.value)[0];
  const majority =
    top.name === "Fiction" ? "de la fiction"
    : top.name === "Non-Fiction" ? "de la non-fiction"
    : "une littérature variée";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div>
        <SectionLabel label="Fiction vs Non-Fiction" />
        <h2 className="font-serif text-[16px] font-semibold text-ink">
          Vous lisez principalement {majority}.
        </h2>
      </div>

      <div className="relative flex items-center justify-center">
        <PieChart width={220} height={220}>
          <Pie
            data={data}
            cx={110}
            cy={110}
            innerRadius={64}
            outerRadius={96}
            paddingAngle={3}
            dataKey="value"
            isAnimationActive={false}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <ChartTooltip active label={payload[0].name as string} payload={[{ value: payload[0].value as number }]} unit="livres" />
              ) : null
            }
          />
        </PieChart>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="font-serif text-2xl font-bold text-ink">{total}</p>
            <p className="text-[10px] text-muted">livres</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        {data.sort((a, b) => b.value - a.value).map(({ name, value, color, label }) => (
          <div key={name} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[12.5px] font-medium text-ink-2">{label}</span>
            </div>
            <span className="text-[12.5px] font-semibold text-ink">
              {total > 0 ? Math.round((value / total) * 100) : 0}%
              <span className="ml-1 font-normal text-muted">({value} livre{value > 1 ? "s" : ""})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. BOOKS BY PAGE COUNT
// ══════════════════════════════════════════════════════════════════════════════
const PAGE_RANGES = [
  { label: "1-100",   min: 1,    max: 100  },
  { label: "101-200", min: 101,  max: 200  },
  { label: "201-300", min: 201,  max: 300  },
  { label: "301-400", min: 301,  max: 400  },
  { label: "401-500", min: 401,  max: 500  },
  { label: "501-600", min: 501,  max: 600  },
  { label: "601-1000",min: 601,  max: 1000 },
  { label: "1000+",   min: 1001, max: Infinity },
];

export function PageCountHistogram({ books }: { books: Book[] }) {
  const completed = books.filter((b) => b.status === "completed" && (b.pages ?? 0) > 0);
  if (completed.length === 0) return null;

  const counts = PAGE_RANGES.map(({ label, min, max }) => ({
    label,
    value: completed.filter((b) => (b.pages ?? 0) >= min && (b.pages ?? 0) <= max).length,
  }));

  const avgPages = Math.round(completed.reduce((s, b) => s + (b.pages ?? 0), 0) / completed.length);
  const peak = counts.reduce((a, b) => (b.value > a.value ? b : a), counts[0]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionLabel label="Formats & Volumes" />
          <h2 className="font-serif text-[16px] font-semibold text-ink">
            La majorité de vos livres font entre {peak.label} pages
          </h2>
        </div>
        {avgPages > 0 && (
          <span className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-2">
            Moy. {avgPages} p.
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={counts} margin={{ top: 22, right: 4, left: -28, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--color-muted)", fontSize: 9 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <ChartTooltip active label={payload[0].payload.label} payload={[{ value: payload[0].value as number }]} unit="livres" />
              ) : null
            }
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey="value"
              position="top"
              style={{ fill: "var(--color-muted)", fontSize: 10 }}
            />
            {counts.map(({ label, value }) => (
              <Cell
                key={label}
                fill={value === peak.value ? "var(--color-violet-deep)" : "var(--color-violet)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. AUTHOR DEEP DIVE
// ══════════════════════════════════════════════════════════════════════════════
export function AuthorDeepDive({ books }: { books: Book[] }) {
  const [showAll, setShowAll] = useState(false);

  const completed = books.filter((b) => b.status === "completed");

  const authorMap = new Map<string, Book[]>();
  completed.forEach((b) => {
    const a = b.author.trim();
    if (!authorMap.has(a)) authorMap.set(a, []);
    authorMap.get(a)!.push(b);
  });

  const authors = Array.from(authorMap.entries())
    .filter(([, b]) => b.length >= 2)
    .map(([name, ab]) => {
      const rated = ab.filter((b) => (b.rating ?? 0) > 0);
      const avg = rated.length > 0 ? rated.reduce((s, b) => s + (b.rating ?? 0), 0) / rated.length : 0;
      const byDate = [...ab].sort((a, b) =>
        (a.date_read ?? a.created_at ?? "").localeCompare(b.date_read ?? b.created_at ?? "")
      );
      const lineData = byDate
        .filter((b) => (b.rating ?? 0) > 0)
        .map((b, i) => ({ i, value: b.rating ?? 0 }));
      const topCovers = [...ab].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 5);
      return { name, count: ab.length, avg, lineData, topCovers };
    })
    .sort((a, b) => b.count - a.count);

  if (authors.length === 0) return null;

  const shown = showAll ? authors : authors.slice(0, 3);

  return (
    <div className="flex flex-col gap-0 rounded-2xl border border-line bg-card p-4">
      <div className="mb-3">
        <SectionLabel label="Analyse par auteur" />
        <h2 className="font-serif text-[16px] font-semibold text-ink">Vos auteurs favoris</h2>
      </div>

      <div className="flex flex-col divide-y divide-line">
        {shown.map(({ name, count, avg, lineData, topCovers }) => {
          const initials = name
            .split(" ")
            .map((w) => w[0] ?? "")
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return (
            <div key={name} className="flex flex-col gap-3 py-4 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-soft text-[12px] font-bold text-violet-deep">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-[14.5px] font-semibold text-ink">{name}</p>
                  <p className="text-[11px] text-muted">
                    {count} livre{count > 1 ? "s" : ""}
                    {avg > 0 ? ` • Note moy. ${avg.toFixed(1)}` : ""}
                  </p>
                </div>
              </div>

              {topCovers.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-0.5">
                  {topCovers.map((b) => (
                    <div key={b.id} className="flex shrink-0 flex-col items-center gap-1">
                      {b.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={b.cover_url}
                          alt={b.title}
                          title={b.title}
                          className="h-16 w-11 rounded object-cover shadow"
                        />
                      ) : (
                        <div className="flex h-16 w-11 items-center justify-center rounded bg-violet-soft p-1 text-center text-[8px] font-medium leading-tight text-muted">
                          {b.title.slice(0, 20)}
                        </div>
                      )}
                      {(b.rating ?? 0) > 0 && (
                        <span className="text-[10px] font-semibold text-gold">{(b.rating ?? 0).toFixed(1)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {lineData.length >= 2 && (
                <div className="h-[56px] w-full">
                  <ResponsiveContainer width="100%" height={56}>
                    <LineChart data={lineData} margin={{ top: 6, right: 6, left: 6, bottom: 6 }}>
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="var(--color-gold)"
                        strokeWidth={1.5}
                        dot={{ fill: "var(--color-gold)", r: 3, strokeWidth: 0 }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {authors.length > 3 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 rounded-xl bg-violet-soft px-4 py-2 text-xs font-semibold text-violet-deep"
        >
          {showAll ? "Réduire" : `Voir tous les auteurs (${authors.length - 3} de plus)`}
        </button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 5a. DIVERGENCES CRITIQUES
// ══════════════════════════════════════════════════════════════════════════════
function CoverGrid({ items }: { items: Book[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((b) =>
        b.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={b.id}
            src={b.cover_url}
            alt={b.title}
            title={`${b.title} — ${b.rating}/5`}
            className="h-16 w-11 rounded object-cover shadow"
          />
        ) : (
          <div
            key={b.id}
            className="flex h-16 w-11 items-center justify-center rounded bg-violet-soft p-1 text-center text-[8px] font-medium leading-tight text-muted"
          >
            {b.title.slice(0, 15)}
          </div>
        )
      )}
    </div>
  );
}

export function CriticalDivergence({ books }: { books: Book[] }) {
  const rated = books.filter((b) => b.status === "completed" && (b.rating ?? 0) > 0);
  if (rated.length < 5) return null;

  const avg = rated.reduce((s, b) => s + (b.rating ?? 0), 0) / rated.length;
  const threshold = 0.75;

  const above = [...rated]
    .filter((b) => (b.rating ?? 0) >= avg + threshold)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 12);

  const below = [...rated]
    .filter((b) => (b.rating ?? 0) <= avg - threshold)
    .sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0))
    .slice(0, 12);

  if (above.length === 0 && below.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
      <div>
        <SectionLabel label="Divergences critiques" />
        <h2 className="font-serif text-[16px] font-semibold text-ink">
          Vos coups de coeur et déceptions
          <span className="ml-2 text-[12px] font-normal text-muted">(moy. personnelle : {avg.toFixed(1)})</span>
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {above.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-success">
              Notes au-dessus de votre moyenne
            </p>
            <CoverGrid items={above} />
          </div>
        )}
        {below.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-danger">
              Notes en dessous de votre moyenne
            </p>
            <CoverGrid items={below} />
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 5b. PUBLICATION TIMELINE
// ══════════════════════════════════════════════════════════════════════════════
export function PublicationTimeline({ books }: { books: Book[] }) {
  const withYear = books.filter(
    (b) => b.status === "completed" && (b.published_year ?? 0) > 0 && (b.published_year ?? 0) <= 2026
  );
  if (withYear.length < 3) return null;

  const yearMap = new Map<number, number>();
  withYear.forEach((b) => {
    const y = b.published_year!;
    yearMap.set(y, (yearMap.get(y) || 0) + 1);
  });

  const years = Array.from(yearMap.keys()).sort((a, b) => a - b);
  const minY = years[0];
  const maxY = years[years.length - 1];

  const data: { year: number; value: number }[] = [];
  for (let y = minY; y <= maxY; y++) {
    data.push({ year: y, value: yearMap.get(y) || 0 });
  }

  const range = maxY - minY;
  const labelEvery = range > 150 ? 50 : range > 60 ? 20 : range > 30 ? 10 : range > 15 ? 5 : 2;
  const barW = Math.max(2, Math.min(10, Math.floor(320 / data.length)));
  const minWidth = Math.max(360, data.length * (barW + 2));

  const modern = withYear.filter((b) => (b.published_year ?? 0) >= 2000).length;
  const classic = withYear.filter((b) => (b.published_year ?? 0) < 1970).length;
  const headline =
    modern > classic * 2 ? "des publications contemporaines"
    : classic > modern * 2 ? "des classiques"
    : "un équilibre entre classiques et contemporain";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div>
        <SectionLabel label="Voyage temporel — Année de publication" />
        <h2 className="font-serif text-[16px] font-semibold text-ink">
          Vous lisez principalement {headline}
        </h2>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth }}>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={data} margin={{ top: 8, right: 4, left: -36, bottom: 0 }} barSize={barW}>
              <XAxis
                dataKey="year"
                tick={{ fill: "var(--color-muted)", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                tickFormatter={(v: number) => (v % labelEvery === 0 ? String(v) : "")}
              />
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.[0] && (payload[0].value as number) > 0 ? (
                    <ChartTooltip
                      active
                      label={payload[0].payload.year}
                      payload={[{ value: payload[0].value as number }]}
                      unit="livre(s)"
                    />
                  ) : null
                }
              />
              <Bar dataKey="value" fill="var(--color-violet)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
