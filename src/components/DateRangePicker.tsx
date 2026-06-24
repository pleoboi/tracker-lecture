"use client";

import { useState } from "react";

export type Preset = "7d" | "month" | "year" | "prev-year" | "custom";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;
  preset: Preset;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function buildDefaults() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const ago7 = new Date(now.getTime() - 6 * 86_400_000).toISOString().split("T")[0];
  return {
    today: todayISO(),
    yearStart: `${y}-01-01`,
    yearEnd: `${y}-12-31`,
    prevYearStart: `${y - 1}-01-01`,
    prevYearEnd: `${y - 1}-12-31`,
    monthStart: `${y}-${m}-01`,
    ago7,
  };
}

export function buildRange(preset: Preset): DateRange {
  const d = buildDefaults();
  switch (preset) {
    case "7d": return { from: d.ago7, to: d.today, preset };
    case "month": return { from: d.monthStart, to: d.today, preset };
    case "prev-year": return { from: d.prevYearStart, to: d.prevYearEnd, preset };
    case "year": return { from: d.yearStart, to: d.yearEnd, preset };
    default: return { from: d.yearStart, to: d.today, preset: "custom" };
  }
}

export const DEFAULT_RANGE: DateRange = buildRange("year");

const PRESETS: { key: Preset; label: string }[] = [
  { key: "7d", label: "7 jours" },
  { key: "month", label: "Ce mois" },
  { key: "year", label: "Cette année" },
  { key: "prev-year", label: "Année préc." },
  { key: "custom", label: "Perso" },
];

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
}) {
  const [localFrom, setLocalFrom] = useState(value.from);
  const [localTo, setLocalTo] = useState(value.to);
  const today = todayISO();

  const apply = () => {
    if (localFrom && localTo && localFrom <= localTo) {
      onChange({ from: localFrom, to: localTo, preset: "custom" });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => {
              if (p.key === "custom") {
                setLocalFrom(value.from);
                setLocalTo(value.to);
                onChange({ ...value, preset: "custom" });
              } else {
                onChange(buildRange(p.key));
              }
            }}
            className={`rounded-xl border px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
              value.preset === p.key
                ? "border-violet bg-violet text-cream"
                : "border-line bg-card text-muted hover:border-violet/40 hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {value.preset === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={localFrom}
            max={localTo || today}
            onChange={(e) => setLocalFrom(e.target.value)}
            className="flex-1 rounded-xl border border-line bg-card px-3 py-1.5 text-xs text-ink outline-none focus:border-violet"
          />
          <span className="text-xs font-medium text-muted">→</span>
          <input
            type="date"
            value={localTo}
            min={localFrom}
            max={today}
            onChange={(e) => setLocalTo(e.target.value)}
            className="flex-1 rounded-xl border border-line bg-card px-3 py-1.5 text-xs text-ink outline-none focus:border-violet"
          />
          <button
            onClick={apply}
            className="rounded-xl bg-violet px-3 py-1.5 text-xs font-semibold text-cream"
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}
