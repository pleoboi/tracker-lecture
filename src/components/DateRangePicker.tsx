"use client";

import { useState, useRef, useEffect } from "react";

export type Preset = "month" | "3m" | "ytd" | "custom";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;
  preset: Preset;
}

function fmt(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function buildRange(preset: Preset, customFrom?: string, customTo?: string): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const today = fmt(y, m, now.getDate());

  switch (preset) {
    case "month":
      return { from: fmt(y, m, 1), to: today, preset };
    case "3m": {
      const d = new Date(y, now.getMonth() - 2, 1);
      return { from: fmt(d.getFullYear(), d.getMonth() + 1, 1), to: today, preset };
    }
    case "ytd":
      return { from: fmt(y, 1, 1), to: today, preset };
    case "custom":
      return { from: customFrom ?? today, to: customTo ?? today, preset };
  }
}

export const DEFAULT_RANGE: DateRange = buildRange("ytd");

const LABELS: Record<Preset, string> = {
  month: "Ce mois",
  "3m": "3 mois",
  ytd: "YTD",
  custom: "Perso",
};

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const DAYS_FR = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

function buildCalendarCells(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1; // lundi en premier
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
}) {
  const [showCal, setShowCal] = useState(false);
  const [tempFrom, setTempFrom] = useState("");
  const [tempTo, setTempTo] = useState("");
  const [selecting, setSelecting] = useState<"from" | "to">("from");
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);
  const calRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCal) return;
    const handle = (e: MouseEvent) => {
      if (calRef.current && !calRef.current.contains(e.target as Node)) {
        setShowCal(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showCal]);

  const openCustom = () => {
    const now = new Date();
    setTempFrom(value.preset === "custom" ? value.from : "");
    setTempTo(value.preset === "custom" ? value.to : "");
    setSelecting("from");
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth() + 1);
    setShowCal(true);
  };

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const today = fmt(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());

  const handleDayClick = (day: number) => {
    const clicked = fmt(viewYear, viewMonth, day);
    if (clicked > today) return;
    if (selecting === "from" || !tempFrom) {
      setTempFrom(clicked);
      setTempTo("");
      setSelecting("to");
    } else {
      if (clicked < tempFrom) {
        setTempFrom(clicked);
        setTempTo(tempFrom);
      } else {
        setTempTo(clicked);
      }
      setSelecting("from");
    }
  };

  const apply = () => {
    if (!tempFrom) return;
    const to = tempTo || tempFrom;
    onChange({ from: tempFrom, to, preset: "custom" });
    setShowCal(false);
  };

  const cells = buildCalendarCells(viewYear, viewMonth);
  const isStart = (d: number) => tempFrom === fmt(viewYear, viewMonth, d);
  const isEnd = (d: number) => tempTo === fmt(viewYear, viewMonth, d);
  const isInRange = (d: number) => {
    if (!tempFrom || !tempTo) return false;
    const s = fmt(viewYear, viewMonth, d);
    return s > tempFrom && s < tempTo;
  };
  const isToday = (d: number) => today === fmt(viewYear, viewMonth, d);
  const isFuture = (d: number) => fmt(viewYear, viewMonth, d) > today;

  const fmtDisplay = (s: string) =>
    s ? `${s.slice(8)}/${s.slice(5, 7)}` : "—";

  return (
    <div className="relative" ref={calRef}>
      <div className="flex flex-wrap gap-1.5">
        {(["month", "3m", "ytd"] as Preset[]).map((p) => (
          <button
            key={p}
            onClick={() => { onChange(buildRange(p)); setShowCal(false); }}
            className={`rounded-lg border px-3 py-1 text-[11.5px] font-semibold transition-colors ${
              value.preset === p
                ? "border-violet bg-violet text-cream"
                : "border-line bg-card text-muted hover:border-violet/40 hover:text-ink"
            }`}
          >
            {LABELS[p]}
          </button>
        ))}
        <button
          onClick={openCustom}
          className={`rounded-lg border px-3 py-1 text-[11.5px] font-semibold transition-colors ${
            value.preset === "custom"
              ? "border-violet bg-violet text-cream"
              : "border-line bg-card text-muted hover:border-violet/40 hover:text-ink"
          }`}
        >
          {value.preset === "custom"
            ? `${fmtDisplay(value.from)} → ${fmtDisplay(value.to)}`
            : "Perso"}
        </button>
      </div>

      {showCal && (
        <div className="absolute left-0 top-10 z-50 w-72 rounded-2xl border border-line bg-paper p-4 shadow-2xl">
          {/* Navigation mois */}
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={prevMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-ink hover:bg-violet-soft"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-ink">
              {MONTHS_FR[viewMonth - 1]} {viewYear}
            </span>
            <button
              onClick={nextMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-ink hover:bg-violet-soft"
            >
              ›
            </button>
          </div>

          {/* En-têtes jours */}
          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {DAYS_FR.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold uppercase text-muted">
                {d}
              </div>
            ))}
          </div>

          {/* Grille des jours */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const start = isStart(day);
              const end = isEnd(day);
              const inRange = isInRange(day);
              const future = isFuture(day);
              const tod = isToday(day);
              return (
                <button
                  key={i}
                  disabled={future}
                  onClick={() => handleDayClick(day)}
                  className={`flex h-8 w-full items-center justify-center rounded-lg text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-25 ${
                    start || end
                      ? "bg-violet font-bold text-cream"
                      : inRange
                        ? "bg-violet/15 text-violet-deep"
                        : tod
                          ? "border border-violet/40 text-violet-deep"
                          : "text-ink hover:bg-violet-soft"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Résumé + boutons */}
          <div className="mt-3 border-t border-line pt-3">
            <p className="mb-2.5 text-[11px] text-muted">
              {!tempFrom
                ? "Clique sur une date de début"
                : !tempTo
                  ? `Début : ${fmtDisplay(tempFrom)} · Clique sur une date de fin`
                  : `Du ${fmtDisplay(tempFrom)} au ${fmtDisplay(tempTo)}`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCal(false)}
                className="flex-1 rounded-xl border border-line py-2 text-xs font-medium text-muted hover:border-violet/40 hover:text-ink"
              >
                Annuler
              </button>
              <button
                onClick={apply}
                disabled={!tempFrom}
                className="flex-1 rounded-xl bg-violet py-2 text-xs font-semibold text-cream disabled:opacity-40"
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
