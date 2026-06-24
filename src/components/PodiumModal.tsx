"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

interface PodiumEntry {
  userId: string;
  name: string;
  pages: number;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const MEDALS = ["🥇", "🥈", "🥉"];
const PODIUM_COLORS = ["bg-[#f4cf5e]", "bg-[#c5c5c5]", "bg-[#cd8b50]/80"];
const PODIUM_HEIGHTS = ["h-28", "h-20", "h-16"];
// Visual left-to-right order: 2nd, 1st, 3rd
const VISUAL_ORDER = [1, 0, 2];

export default function PodiumModal({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState(todayISO());
  const [podium, setPodium] = useState<PodiumEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: logsData }, { data: profilesData }] = await Promise.all([
        supabase.from("reading_logs").select("user_id, pages_read").eq("date", date),
        supabase.from("user_profiles").select("id, display_name"),
      ]);

      type LogRow = { user_id: string; pages_read: number };
      type ProfRow = { id: string; display_name: string };

      const logs = (logsData as LogRow[]) || [];
      const profiles = (profilesData as ProfRow[]) || [];
      const profileMap = new Map(profiles.map((p) => [p.id, p.display_name]));

      const pagesByUser = new Map<string, number>();
      logs.forEach((l) => {
        pagesByUser.set(l.user_id, (pagesByUser.get(l.user_id) || 0) + (l.pages_read || 0));
      });

      const sorted = [...pagesByUser.entries()]
        .filter(([, p]) => p > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([userId, pages]) => ({
          userId,
          name: profileMap.get(userId) || "Membre",
          pages,
        }));

      setPodium(sorted);
      setLoading(false);
    };
    load();
  }, [date]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const formattedDate = new Date(date + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-md flex-col overflow-y-auto rounded-t-3xl bg-paper p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl font-bold text-ink">Podium du jour</h2>
            <p className="text-[11px] capitalize text-muted">{formattedDate}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-sm text-muted hover:bg-card"
          >
            ✕
          </button>
        </div>

        {/* Navigation de date */}
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-line bg-card px-2 py-1.5">
          <button
            onClick={() => setDate(shiftDate(date, -1))}
            className="px-2 text-base font-bold text-muted hover:text-ink"
          >
            ‹
          </button>
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="flex-1 bg-transparent text-center text-sm font-semibold text-ink outline-none"
          />
          <button
            onClick={() => { if (date < todayISO()) setDate(shiftDate(date, 1)); }}
            disabled={date >= todayISO()}
            className="px-2 text-base font-bold text-muted hover:text-ink disabled:opacity-30"
          >
            ›
          </button>
        </div>

        {loading ? (
          <div className="flex h-44 items-center justify-center text-xs font-medium text-muted">
            Chargement…
          </div>
        ) : podium.length === 0 ? (
          <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed border-line bg-card text-sm text-muted">
            Aucune lecture enregistrée ce jour-là.
          </div>
        ) : (
          <>
            {/* Podium visuel */}
            <div className="flex items-end justify-center gap-2 px-2 pb-1">
              {VISUAL_ORDER.map((rank) => {
                const entry = podium[rank];
                if (!entry) return <div key={rank} className="flex-1" />;
                return (
                  <div key={rank} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-2xl leading-none">{MEDALS[rank]}</span>
                    <p className="max-w-[72px] truncate text-center text-[11px] font-semibold text-ink">
                      {entry.name}
                    </p>
                    <p className="text-[9.5px] font-medium text-muted">
                      {entry.pages.toLocaleString("fr-FR")} p.
                    </p>
                    <div
                      className={`flex w-full items-center justify-center rounded-t-2xl ${PODIUM_COLORS[rank]} ${PODIUM_HEIGHTS[rank]}`}
                    >
                      <span className="font-serif text-xl font-black text-white/70">
                        #{rank + 1}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Liste détaillée */}
            <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
              {podium.map((entry, i) => (
                <div key={entry.userId} className="flex items-center gap-3">
                  <span className="w-7 text-center text-lg leading-none">{MEDALS[i]}</span>
                  <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">
                    {entry.name}
                  </p>
                  <p className="shrink-0 font-serif text-[15px] font-bold text-ink">
                    {entry.pages.toLocaleString("fr-FR")}{" "}
                    <span className="text-xs font-medium text-muted">pages</span>
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
