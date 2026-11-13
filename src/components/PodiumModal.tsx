"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { Snowfall } from "./ChampionProposals";

interface PodiumEntry {
  userId: string;
  name: string;
  pages: number;
}

// Dates en heure locale : toISOString() renvoyait la veille après minuit.
function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayISO() {
  return localISO(new Date());
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return localISO(d);
}

const RANK_STYLES = [
  { medal: "bg-[#f4cf5e]", text: "text-[#7a5c00]", step: "linear-gradient(to top, #cfe1f7, #f6faff)" },
  { medal: "bg-[#d6dde6]", text: "text-[#3f4b5c]", step: "linear-gradient(to top, #d9e6f6, #f6faff)" },
  { medal: "bg-[#d9a273]", text: "text-[#5a3000]", step: "linear-gradient(to top, #dde9f7, #f6faff)" },
];
const PODIUM_HEIGHTS = ["h-28", "h-20", "h-14"];
// Ordre visuel de gauche à droite : 2e, 1er, 3e
const VISUAL_ORDER = [1, 0, 2];

export default function PodiumModal({ onClose, initialDate, demo }: { onClose: () => void; initialDate?: string; demo?: PodiumEntry[] }) {
  const [date, setDate] = useState(initialDate ?? todayISO());
  const [podium, setPodium] = useState<PodiumEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (demo) {
        setPodium(demo);
        setLoading(false);
        return;
      }
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
  }, [date, demo]);

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
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-md flex-col overflow-y-auto rounded-t-3xl bg-paper shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête givré, avec la neige qui tombe */}
        <div
          className="relative shrink-0 overflow-hidden px-5 pb-6 pt-5"
          style={{ background: "linear-gradient(180deg, #f4f9ff 0%, #dbe9fb 100%)" }}
        >
          <Snowfall color="#8fb4e6" />
          <svg viewBox="0 0 400 30" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-[16px] w-full" aria-hidden>
            <path d="M0 30 V14 Q70 2 150 12 T290 8 T400 12 V30 Z" fill="var(--color-paper)" />
          </svg>
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#4a76b8]">Classement</p>
              <h2 className="font-serif text-xl font-black text-[#17325c]">Podium du jour</h2>
              <p className="text-[11px] capitalize text-[#5f7fa8]">{formattedDate}</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#b9d0f5] bg-white/70 text-sm text-[#4a76b8] hover:bg-white"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-5 pt-3">
          {/* Navigation de date */}
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-line bg-card px-2 py-1.5">
            <button onClick={() => setDate(shiftDate(date, -1))} className="px-2 text-base font-bold text-muted hover:text-ink">
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
              onClick={() => {
                if (date < todayISO()) setDate(shiftDate(date, 1));
              }}
              disabled={date >= todayISO()}
              className="px-2 text-base font-bold text-muted hover:text-ink disabled:opacity-30"
            >
              ›
            </button>
          </div>

          {loading ? (
            <div className="flex h-44 items-center justify-center text-xs font-medium text-muted">Chargement…</div>
          ) : podium.length === 0 ? (
            <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed border-line bg-card text-sm text-muted">
              Aucune lecture enregistrée ce jour-là.
            </div>
          ) : (
            <>
              {/* Podium : marches de neige avec leur chapeau blanc */}
              <div className="flex items-end justify-center gap-2 px-2 pb-1">
                {VISUAL_ORDER.map((rank) => {
                  const entry = podium[rank];
                  const rs = RANK_STYLES[rank];
                  if (!entry) return <div key={rank} className="flex-1" />;
                  return (
                    <div key={rank} className="flex flex-1 flex-col items-center gap-1">
                      {rank === 0 && (
                        <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#6fa3e8]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                          <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" />
                        </svg>
                      )}
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full ${rs.medal}`}>
                        <span className={`font-serif text-[13px] font-black ${rs.text}`}>{rank + 1}</span>
                      </div>
                      <Link href={`/membre/${entry.userId}`} onClick={onClose} className="max-w-[84px] truncate text-center text-[11.5px] font-semibold text-ink underline-offset-2 hover:text-violet-deep hover:underline">
                        {entry.name}
                      </Link>
                      <p className="text-[10px] font-medium text-muted">{entry.pages.toLocaleString("fr-FR")} p.</p>
                      <div
                        className={`relative flex w-full items-center justify-center rounded-t-xl border border-b-0 border-[#c6d9f1] ${PODIUM_HEIGHTS[rank]}`}
                        style={{ background: rs.step }}
                      >
                        <span className="pointer-events-none absolute -top-1.5 left-[-3px] right-[-3px] h-3 rounded-full bg-white shadow-[0_1px_2px_rgba(80,120,180,0.25)]" />
                        <span className="font-serif text-xl font-black text-[#4a76b8] opacity-70">#{rank + 1}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Liste détaillée */}
              <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
                {podium.map((entry, i) => (
                  <div key={entry.userId} className="flex items-center gap-3">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${RANK_STYLES[i].medal}`}>
                      <span className={`font-serif text-[11px] font-black ${RANK_STYLES[i].text}`}>{i + 1}</span>
                    </div>
                    <Link href={`/membre/${entry.userId}`} onClick={onClose} className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink underline-offset-2 hover:text-violet-deep hover:underline">
                      {entry.name}
                    </Link>
                    <p className="shrink-0 font-serif text-[15px] font-bold text-ink">
                      {entry.pages.toLocaleString("fr-FR")} <span className="text-xs font-medium text-muted">pages</span>
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
