"use client";

export type Preset = "month" | "3m" | "ytd";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;
  preset: Preset;
}

function fmt(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function buildRange(preset: Preset): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const today = fmt(y, m, now.getDate());

  switch (preset) {
    case "month":
      return { from: fmt(y, m, 1), to: today, preset };
    case "3m": {
      // Premier jour du mois d'il y a 2 mois (pour avoir 3 mois dont le courant)
      const d = new Date(y, now.getMonth() - 2, 1);
      return { from: fmt(d.getFullYear(), d.getMonth() + 1, 1), to: today, preset };
    }
    case "ytd":
      return { from: fmt(y, 1, 1), to: today, preset };
  }
}

export const DEFAULT_RANGE: DateRange = buildRange("ytd");

const LABELS: Record<Preset, string> = {
  month: "Ce mois",
  "3m": "3 mois",
  ytd: "YTD",
};

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {(["month", "3m", "ytd"] as Preset[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(buildRange(p))}
          className={`rounded-lg border px-3 py-1 text-[11.5px] font-semibold transition-colors ${
            value.preset === p
              ? "border-violet bg-violet text-cream"
              : "border-line bg-card text-muted hover:border-violet/40 hover:text-ink"
          }`}
        >
          {LABELS[p]}
        </button>
      ))}
    </div>
  );
}
