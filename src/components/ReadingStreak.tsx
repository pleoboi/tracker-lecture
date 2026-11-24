"use client";

import { useMemo } from "react";
import { computeStreaks } from "../lib/mangaBadges";
import { localISO, shiftDateISO } from "../lib/books";
import { BOOK_PANEL } from "./BookSheet";

/** Série de jours de lecture : jours d'affilée, record et 14 derniers jours (même bloc que côté manga). */
export default function ReadingStreak({ dates, isOwn = true }: { dates: string[]; isOwn?: boolean }) {
  const streaks = useMemo(() => computeStreaks(dates, localISO()), [dates]);
  const lastDays = useMemo(() => {
    const read = new Set(dates);
    const today = localISO();
    return Array.from({ length: 14 }, (_, i) => {
      const d = shiftDateISO(today, i - 13);
      return { d, read: read.has(d), isToday: d === today };
    });
  }, [dates]);

  if (dates.length === 0) return null;
  const { current, best, readToday } = streaks;

  return (
    <section className={`flex min-w-0 flex-col gap-3 p-4 ${BOOK_PANEL}`}>
      <div className="flex items-center gap-3.5">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-ink/70 ${current > 0 ? "bg-violet text-cream" : "bg-card text-muted"}`}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
            <path d="M12 3C9 6.5 8.5 9.5 10.5 12.5C8.5 12 7.5 10 8.5 8C5.5 11 5 16.5 8.5 19.5C9.5 20.5 10.8 21 12 21C15.5 21 19 17.5 19 14C19 11 17 9 15 8C16 10.5 14.5 12.5 13 12C14.5 9 14 5.5 12 3Z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted">Série en cours</p>
          <p className="font-serif text-3xl font-bold leading-none text-ink">
            {current} <span className="font-sans text-sm font-semibold text-muted">jour{current > 1 ? "s" : ""}</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted">Record</p>
          <p className="font-serif text-2xl font-bold leading-none text-ink">
            {best} <span className="font-sans text-xs font-semibold text-muted">j.</span>
          </p>
        </div>
      </div>

      <div className="flex gap-1" aria-label="14 derniers jours">
        {lastDays.map((day) => (
          <div
            key={day.d}
            title={day.d}
            className={`h-6 min-w-0 flex-1 rounded-[4px] border ${
              day.read ? "border-violet-deep/60 bg-violet" : day.isToday ? "border-dashed border-ink/60 bg-card" : "border-line bg-card"
            }`}
          />
        ))}
      </div>

      {isOwn && (
        <p className="text-[12px] text-muted">
          {readToday
            ? current > 1 && current === best
              ? "Série du jour validée, et c'est ton record !"
              : "Série du jour validée."
            : current > 0
              ? `Lis quelques pages aujourd'hui pour garder ta série de ${current} jour${current > 1 ? "s" : ""}.`
              : "Lis quelques pages aujourd'hui pour lancer une série."}
        </p>
      )}
    </section>
  );
}
