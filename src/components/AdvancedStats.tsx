"use client";

import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import type { Book } from "../lib/types";
import { BOOK_PANEL, type PickFn } from "./BookSheet";

// ── Palette genres ────────────────────────────────────────────────────────────
// Une seule teinte (violet) déclinée en nuances : plus sobre que l'arc-en-ciel d'avant.
const GENRE_PALETTE = Array.from({ length: 10 }, (_, i) => `color-mix(in srgb, var(--color-violet) ${100 - i * 7}%, var(--color-card))`);

// ── Classification Fiction / Non-Fiction ──────────────────────────────────────
const FICTION_KEYS = [
  "fiction", "fantasy", "science fiction", "sci-fi", "science-fantasy",
  "romance", "mystery", "thriller", "horror", "adventure", "young adult",
  "comics", "manga", "children", "graphic novel", "literary fiction",
  "historical fiction", "crime", "detective", "suspense", "fantastique",
  "policier", "jeunesse", "bande dessinée", "roman",
];
const NONFICTION_KEYS = [
  "non-fiction", "nonfiction", "biography", "autobiography", "history",
  "science", "philosophy", "psychology", "business", "self-help", "travel",
  "cooking", "health", "education", "politics", "economics", "memoir",
  "true crime", "journalism", "essay", "biographie", "histoire", "essai",
  "développement personnel", "guerre",
];

const NONFICTION_EXACT = new Set(["non-fiction", "nonfiction"]);

// La quasi-totalité des livres portent une étiquette EXPLICITE "Fiction" ou
// "Non-Fiction" parmi leurs genres — elle doit toujours trancher en premier.
// Le bug précédent : des thèmes comme "Crime", "Histoire" ou "Policier" (dans
// FICTION_KEYS pour détecter un roman policier) apparaissent aussi sur des
// livres NON-FICTION (un témoignage de guerre, un true crime…) — un livre
// explicitement tagué "Non-Fiction" + "Crime" + "Histoire" se retrouvait
// classé Fiction à cause de ces mots-clés thématiques, alors que l'étiquette
// du livre disait le contraire. On ne retombe sur les mots-clés que si aucune
// étiquette explicite n'est présente.
function classifyFiction(genre: string | null | undefined): "Fiction" | "Non-Fiction" | "Inconnu" {
  if (!genre) return "Inconnu";
  const tokens = genre.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) return "Inconnu";

  if (tokens.includes("fiction")) return "Fiction";
  if (tokens.some((t) => NONFICTION_EXACT.has(t))) return "Non-Fiction";

  // Pas d'étiquette explicite : on retombe sur les mots-clés de genre.
  let sawFiction = false;
  let sawNonFiction = false;
  for (const t of tokens) {
    if (FICTION_KEYS.some((k) => t.includes(k))) { sawFiction = true; continue; }
    if (NONFICTION_KEYS.some((k) => t.includes(k))) sawNonFiction = true;
  }
  if (sawFiction && !sawNonFiction) return "Fiction";
  if (sawNonFiction && !sawFiction) return "Non-Fiction";
  return "Inconnu"; // signaux contradictoires sans étiquette explicite : indécidable
}

function SectionLabel({ label }: { label: string }) {
  return <p className="text-[9.5px] font-bold uppercase tracking-widest text-muted">{label}</p>;
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. GENRE BREAKDOWN — top 10, pas d'expansion
// ══════════════════════════════════════════════════════════════════════════════
export function GenreBreakdown({ books, onPick }: { books: Book[]; onPick?: PickFn }) {
  const completed = books.filter((b) => b.status === "completed");
  const missing = completed.filter((b) => !b.genre).length;

  // Genres à exclure (méta-catégories utilisées pour le donut Fiction/Non-Fiction)
  const EXCLUDED = new Set(["fiction", "non-fiction", "nonfiction"]);

  const genreMap = new Map<string, number>();
  completed.forEach((b) => {
    if (!b.genre) return;
    // Chaque livre peut avoir plusieurs genres séparés par une virgule
    b.genre.split(",").forEach((raw) => {
      const g = raw.trim();
      if (!g || EXCLUDED.has(g.toLowerCase())) return;
      genreMap.set(g, (genreMap.get(g) || 0) + 1);
    });
  });

  const maxCount = Math.max(...Array.from(genreMap.values()), 1);
  const genres = Array.from(genreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count], i) => ({
      name,
      count,
      pct: (count / maxCount) * 100,
      color: GENRE_PALETTE[i % GENRE_PALETTE.length],
    }));

  if (genres.length === 0) return null;
  const topGenre = genres[0].name;

  return (
    <div className={`flex flex-col gap-3 ${BOOK_PANEL} p-4`}>
      <div>
        <SectionLabel label="Genres" />
        <h2 className="font-serif text-[16px] font-semibold text-ink">
          {topGenre} est ton genre de prédilection
        </h2>
      </div>

      <div className="flex flex-col gap-2.5">
        {genres.map(({ name, count, pct, color }) => (
          <button key={name} type="button" onClick={() => onPick?.(name, completed.filter((b) => (b.genre ?? "").split(",").some((g) => g.trim() === name)))}
            className="flex items-center gap-3 rounded-md text-left transition-transform active:scale-[0.98]">
            <span className="w-[110px] shrink-0 truncate text-[12.5px] font-semibold text-ink">
              {name}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <span className="w-[32px] shrink-0 text-right text-[12px] font-bold text-ink">
              {count}
            </span>
          </button>
        ))}
      </div>

      {missing > 0 && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
          </svg>
          Données manquantes pour {missing} livre{missing > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. FICTION VS NON-FICTION (Donut)
// ══════════════════════════════════════════════════════════════════════════════
const DONUT_META = {
  Fiction:       { color: "var(--color-violet)", label: "Fiction" },
  "Non-Fiction": { color: "var(--color-ink)", label: "Non-fiction" },
  Inconnu:       { color: "var(--color-line)", label: "Non classé" },
};

export function FictionDonut({ books, onPick }: { books: Book[]; onPick?: PickFn }) {
  const completed = books.filter((b) => b.status === "completed");
  const counts = { Fiction: 0, "Non-Fiction": 0, Inconnu: 0 };
  completed.forEach((b) => { counts[classifyFiction(b.genre)]++; });
  const total = completed.length;
  if (total === 0) return null;

  const data = (Object.keys(DONUT_META) as (keyof typeof DONUT_META)[])
    .filter((k) => counts[k] > 0)
    .map((k) => ({ name: k, value: counts[k], ...DONUT_META[k], fill: DONUT_META[k].color }));

  const top = [...data].sort((a, b) => b.value - a.value)[0];
  const majority =
    top.name === "Fiction" ? "de la fiction"
    : top.name === "Non-Fiction" ? "de la non-fiction"
    : "une littérature variée";

  return (
    <div className={`flex flex-col gap-3 ${BOOK_PANEL} p-4`}>
      <div>
        <SectionLabel label="Fiction ou non-fiction" />
        <h2 className="font-serif text-[16px] font-semibold text-ink">
          Tu lis principalement {majority}.
        </h2>
      </div>

      <div className="relative flex items-center justify-center">
        <PieChart width={220} height={220}>
          <Pie
            data={data}
            cx={110} cy={110}
            innerRadius={64} outerRadius={96}
            paddingAngle={3}
            dataKey="value"
            isAnimationActive={false}
            stroke="none"
            className="cursor-pointer outline-none"
            onClick={(_, i) => { const k = data[i].name; onPick?.(data[i].label, completed.filter((b) => classifyFiction(b.genre) === k)); }}
          >
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <div className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11px] shadow-md">
                  <span className="font-semibold text-ink">{payload[0].name}</span>
                  <span className="ml-2 text-muted">{payload[0].value} livres</span>
                </div>
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
        {[...data].sort((a, b) => b.value - a.value).map(({ name, value, color, label }) => (
          <button key={name} type="button" onClick={() => onPick?.(label, completed.filter((b) => classifyFiction(b.genre) === name))}
            className="flex items-center justify-between gap-2 rounded-md text-left transition-transform active:scale-[0.98]">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[12.5px] font-medium text-ink-2">{label}</span>
            </div>
            <span className="text-[12.5px] font-semibold text-ink">
              {Math.round((value / total) * 100)}%
              <span className="ml-1 font-normal text-muted">({value} livre{value > 1 ? "s" : ""})</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. BOOKS BY PAGE COUNT — hauteur fixe, pas d'espace vide
// ══════════════════════════════════════════════════════════════════════════════
const PAGE_RANGES = [
  { label: "1-100",    min: 1,    max: 100  },
  { label: "101-200",  min: 101,  max: 200  },
  { label: "201-300",  min: 201,  max: 300  },
  { label: "301-400",  min: 301,  max: 400  },
  { label: "401-500",  min: 401,  max: 500  },
  { label: "501-600",  min: 501,  max: 600  },
  { label: "601-1000", min: 601,  max: 1000 },
  { label: "1000+",    min: 1001, max: Infinity },
];

export function PageCountHistogram({ books, onPick }: { books: Book[]; onPick?: PickFn }) {
  const completed = books.filter((b) => b.status === "completed" && (b.pages ?? 0) > 0);
  if (completed.length === 0) return null;

  const rawCounts = PAGE_RANGES.map(({ label, min, max }) => ({
    label,
    value: completed.filter((b) => (b.pages ?? 0) >= min && (b.pages ?? 0) <= max).length,
  }));

  const avgPages = Math.round(completed.reduce((s, b) => s + (b.pages ?? 0), 0) / completed.length);
  const peak = rawCounts.reduce((a, b) => (b.value > a.value ? b : a), rawCounts[0]);
  const counts = rawCounts.map((c) => ({
    ...c,
    fill: c.value === peak.value ? "var(--color-violet-deep)" : "var(--color-violet)",
  }));

  return (
    <div className={`${BOOK_PANEL} p-4`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <SectionLabel label="Longueur des livres" />
          <h2 className="font-serif text-[16px] font-semibold text-ink">
            La majorité fait entre {peak.label} pages
          </h2>
        </div>
        {avgPages > 0 && (
          <span className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-2">
            Moy. {avgPages} p.
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={counts} margin={{ top: 20, right: 4, left: 4, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--color-muted)", fontSize: 9 }}
            axisLine={false} tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <div className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11px] shadow-md">
                  <span className="font-semibold text-ink">{payload[0].payload.label}</span>
                  <span className="ml-2 text-muted">{payload[0].value} livres</span>
                </div>
              ) : null
            }
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} className="cursor-pointer"
            onClick={(_, i) => { const r = PAGE_RANGES[i]; onPick?.(`${r.label} pages`, completed.filter((b) => (b.pages ?? 0) >= r.min && (b.pages ?? 0) <= r.max)); }}>
            {counts.map((c, i) => <Cell key={i} fill={c.fill} />)}
            <LabelList dataKey="value" position="top" style={{ fill: "var(--color-muted)", fontSize: 10 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. AUTHOR DEEP DIVE — top 4, YAxis, tooltip titre livre
// ══════════════════════════════════════════════════════════════════════════════
export function AuthorDeepDive({ books, onPick }: { books: Book[]; onPick?: PickFn }) {
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
        .map((b) => ({ value: b.rating ?? 0, title: b.title }));
      const topCovers = [...ab].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 5);
      return { name, count: ab.length, avg, lineData, topCovers, all: ab };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 4); // top 4 uniquement

  if (authors.length === 0) return null;

  return (
    <div className={`flex flex-col gap-0 ${BOOK_PANEL} p-4`}>
      <div className="mb-3">
        <SectionLabel label="Analyse par auteur" />
        <h2 className="font-serif text-[16px] font-semibold text-ink">Tes auteurs favoris</h2>
      </div>

      <div className="flex flex-col divide-y divide-line">
        {authors.map(({ name, count, avg, lineData, topCovers, all }) => {
          const initials = name.split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
          return (
            <div key={name} className="flex flex-col gap-3 py-4 last:pb-0">
              <button type="button" onClick={() => onPick?.(name, all)} className="flex items-center gap-3 text-left transition-transform active:scale-[0.98]">
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
              </button>

              {topCovers.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-0.5">
                  {topCovers.map((b) => (
                    <button type="button" key={b.id} onClick={() => onPick?.(b.title, [b])} className="flex shrink-0 flex-col items-center gap-1 transition-transform active:scale-95">
                      {b.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.cover_url} alt={b.title} title={b.title}
                          className="h-16 w-11 rounded object-cover shadow" />
                      ) : (
                        <div className="flex h-16 w-11 items-center justify-center rounded bg-violet-soft p-1 text-center text-[8px] font-medium leading-tight text-muted">
                          {b.title.slice(0, 20)}
                        </div>
                      )}
                      {(b.rating ?? 0) > 0 && (
                        <span className="text-[10px] font-semibold text-muted">{(b.rating ?? 0).toFixed(1)}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Mini line chart avec YAxis 1-5 et tooltip titre */}
              {lineData.length >= 2 && (
                <div className="h-[70px] w-full">
                  <ResponsiveContainer width="100%" height={70}>
                    <LineChart data={lineData} margin={{ top: 6, right: 8, left: 0, bottom: 4 }}>
                      <YAxis
                        domain={[0.5, 5.5]}
                        ticks={[1, 2, 3, 4, 5]}
                        tick={{ fill: "var(--color-muted)", fontSize: 8 }}
                        axisLine={false}
                        tickLine={false}
                        width={14}
                      />
                      <Tooltip
                        content={({ active, payload }) =>
                          active && payload?.[0] ? (
                            <div className="max-w-[160px] rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11px] shadow-md">
                              <p className="font-semibold leading-snug text-ink">{payload[0].payload.title}</p>
                              <p className="text-muted">{(payload[0].value as number).toFixed(1)} / 5</p>
                            </div>
                          ) : null
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="var(--color-violet)"
                        strokeWidth={1.5}
                        dot={{ fill: "var(--color-violet)", r: 3, strokeWidth: 0 }}
                        activeDot={{ r: 4, strokeWidth: 0 }}
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
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 5a. DIVERGENCES CRITIQUES — hover tooltip sur les couvertures
// ══════════════════════════════════════════════════════════════════════════════
function CoverGrid({ items, onPick }: { items: Book[]; onPick?: PickFn }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((b) => (
        <button type="button" key={b.id} onClick={() => onPick?.(b.title, [b])} className="group relative shrink-0 transition-transform active:scale-95">
          {b.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={b.cover_url}
              alt={b.title}
              className="h-16 w-11 rounded object-cover shadow"
            />
          ) : (
            <div className="flex h-16 w-11 items-center justify-center rounded bg-violet-soft p-1 text-center text-[8px] font-medium leading-tight text-muted">
              {b.title.slice(0, 15)}
            </div>
          )}
          {/* Tooltip au survol */}
          <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden w-max max-w-[150px] -translate-x-1/2 rounded-lg border border-line bg-card px-2 py-1.5 text-center shadow-md group-hover:block">
            <p className="text-[10px] font-semibold leading-snug text-ink">{b.title}</p>
            {(b.rating ?? 0) > 0 && (
              <p className="text-[10px] text-muted">{b.rating} / 5</p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

export function CriticalDivergence({ books, onPick }: { books: Book[]; onPick?: PickFn }) {
  const rated = books.filter((b) => b.status === "completed" && (b.rating ?? 0) > 0);
  if (rated.length < 5) return null;

  const avg = rated.reduce((s, b) => s + (b.rating ?? 0), 0) / rated.length;

  const above = [...rated]
    .filter((b) => (b.rating ?? 0) >= avg + 0.75)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 12);

  const below = [...rated]
    .filter((b) => (b.rating ?? 0) <= avg - 0.75)
    .sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0))
    .slice(0, 12);

  if (above.length === 0 && below.length === 0) return null;

  return (
    <div className={`flex flex-col gap-4 ${BOOK_PANEL} p-4`}>
      <div>
        <SectionLabel label="Divergences critiques" />
        <h2 className="font-serif text-[16px] font-semibold text-ink">
          Tes coups de cœur et déceptions
          <span className="ml-2 text-[12px] font-normal text-muted">(moy. {avg.toFixed(1)})</span>
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {above.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-success">
              Au-dessus de ta moyenne
            </p>
            <CoverGrid items={above} onPick={onPick} />
          </div>
        )}
        {below.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-danger">
              En dessous de ta moyenne
            </p>
            <CoverGrid items={below} onPick={onPick} />
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 5b. PUBLICATION — frise par époques (bulles)
// Frise par époques : une bulle par période, plus grosse quand on y a lu plus de livres.
const ERAS = [
  { short: "< 1900", label: "Avant 1900", min: 1, max: 1899 },
  { short: "1900", label: "1900 à 1949", min: 1900, max: 1949 },
  { short: "1950", label: "1950 à 1979", min: 1950, max: 1979 },
  { short: "1980", label: "1980 à 1999", min: 1980, max: 1999 },
  { short: "2000", label: "2000 à 2014", min: 2000, max: 2014 },
  { short: "2015+", label: "Depuis 2015", min: 2015, max: 3000 },
];

export function PublicationTimeline({ books, onPick }: { books: Book[]; onPick?: PickFn }) {
  const withYear = books.filter(
    (b) => b.status === "completed" && (b.published_year ?? 0) > 0 && (b.published_year ?? 0) <= 2026
  );
  if (withYear.length < 3) return null;

  const eras = ERAS.map((e) => ({ ...e, books: withYear.filter((b) => (b.published_year ?? 0) >= e.min && (b.published_year ?? 0) <= e.max) }));
  const max = Math.max(1, ...eras.map((e) => e.books.length));

  const modern = withYear.filter((b) => (b.published_year ?? 0) >= 2000).length;
  const classic = withYear.filter((b) => (b.published_year ?? 0) < 1970).length;
  const headline =
    modern > classic * 2 ? "des publications contemporaines"
    : classic > modern * 2 ? "des classiques"
    : "un équilibre entre classiques et contemporain";
  const oldest = withYear.reduce((m, b) => ((b.published_year ?? 9999) < (m.published_year ?? 9999) ? b : m), withYear[0]);

  return (
    <div className={`flex flex-col gap-3 ${BOOK_PANEL} p-4`}>
      <div>
        <SectionLabel label="Année de publication" />
        <h2 className="font-serif text-[16px] font-semibold text-ink">
          Tu lis principalement {headline}
        </h2>
      </div>

      <div className="relative mt-1">
        <div className="absolute left-[8%] right-[8%] top-[28px] h-px bg-line" />
        <div className="relative grid grid-cols-6">
          {eras.map((e) => {
            const n = e.books.length;
            const size = n ? 26 + (n / max) * 30 : 12;
            return (
              <button
                key={e.short}
                type="button"
                disabled={!n}
                onClick={() => onPick?.(e.label, e.books)}
                className="flex flex-col items-center gap-1.5 transition-transform active:scale-95 disabled:cursor-default"
              >
                <span className="flex h-[56px] items-center">
                  <span
                    className="flex items-center justify-center rounded-full text-[11px] font-bold"
                    style={{
                      width: size,
                      height: size,
                      background: n ? `color-mix(in srgb, var(--color-violet) ${45 + (n / max) * 55}%, var(--color-card))` : "var(--color-line)",
                      color: "var(--color-cream)",
                    }}
                  >
                    {n || ""}
                  </span>
                </span>
                <span className="text-[10.5px] font-medium text-muted">{e.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button type="button" onClick={() => onPick?.("Le plus ancien", [oldest])} className="text-left text-[12px] text-muted">
        Le plus ancien : <span className="font-semibold text-ink-2">{oldest.title}</span> ({oldest.published_year})
      </button>
    </div>
  );
}
