"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  BADGE_DEFS, TIER_META, getTotalPoints, getLevelProgress, getStatValue,
  BADGE_CUTOFF_DATE,
  type BadgeDef, type BadgeTier, type IconKey, type BadgeType, type UserBadgeStats,
} from "../lib/badges";

// ── Gradient par (type, palier) ───────────────────────────────────────────────
// Chaque tableau = [Bronze, Argent, Or, Platine] = [top, bottom]
const TYPE_GRADIENT: Record<BadgeType, [string, string][]> = {
  volume:   [["#93c5fd","#1d4ed8"],["#60a5fa","#1e3a8a"],["#3b82f6","#172554"],["#1e40af","#0f172a"]],
  genre:    [["#6ee7b7","#059669"],["#34d399","#047857"],["#10b981","#065f46"],["#059669","#022c22"]],
  sessions: [["#fcd34d","#d97706"],["#fbbf24","#b45309"],["#f59e0b","#92400e"],["#d97706","#451a03"]],
  review:   [["#f9a8d4","#db2777"],["#f472b6","#be185d"],["#ec4899","#9d174d"],["#db2777","#500724"]],
  pages:    [["#a5b4fc","#4f46e5"],["#818cf8","#4338ca"],["#6366f1","#3730a3"],["#4f46e5","#1e1b4b"]],
  streak:   [["#fca5a5","#dc2626"],["#f87171","#b91c1c"],["#ef4444","#991b1b"],["#dc2626","#450a0a"]],
  monthly:  [["#c4b5fd","#7c3aed"],["#a78bfa","#6d28d9"],["#8b5cf6","#5b21b6"],["#7c3aed","#2e1065"]],
};

// ── Stats helper ──────────────────────────────────────────────────────────────
type LogRow = { book_id: string; date: string; pages_read: number | null };

async function fetchBadgeStats(memberId: string): Promise<UserBadgeStats> {
  const { data: logsData } = await supabase
    .from("reading_logs").select("book_id, date, pages_read")
    .eq("user_id", memberId).gte("date", BADGE_CUTOFF_DATE);

  const logs = (logsData ?? []) as LogRow[];
  const activeBookIds = [...new Set(logs.map((r) => r.book_id))];
  const totalPages    = logs.reduce((s, r) => s + (r.pages_read ?? 0), 0);
  const sessionsCount = logs.length;

  const dateSet = [...new Set(logs.map((r) => r.date))].sort();
  let maxStreak = dateSet.length > 0 ? 1 : 0;
  let streak    = 1;
  for (let i = 1; i < dateSet.length; i++) {
    const d = Math.round(
      (new Date(dateSet[i]).getTime() - new Date(dateSet[i - 1]).getTime()) / 86400000
    );
    if (d === 1) { streak++; if (streak > maxStreak) maxStreak = streak; }
    else if (d > 1) streak = 1;
  }

  const monthlySessionCount = logs.filter(
    (r) => r.date >= "2026-07-01" && r.date <= "2026-07-31"
  ).length;

  let booksCompleted = 0, uniqueGenres = 0, reviewsCount = 0;

  if (activeBookIds.length > 0) {
    const [booksRes, reviewsRes] = await Promise.all([
      supabase.from("books").select("genre, status").eq("user_id", memberId).in("id", activeBookIds),
      supabase.from("books").select("id", { count: "exact", head: true })
        .eq("user_id", memberId).not("notes", "is", null).neq("notes", "").in("id", activeBookIds),
    ]);
    const books = (booksRes.data ?? []) as { genre: string | null; status: string }[];
    booksCompleted = books.filter((b) => b.status === "completed").length;
    reviewsCount   = reviewsRes.count ?? 0;
    const genreSet = new Set<string>();
    for (const b of books) {
      if (!b.genre || b.status !== "completed") continue;
      b.genre.split(/[,;]+/).forEach((g) => { const t = g.trim(); if (t) genreSet.add(t); });
    }
    uniqueGenres = genreSet.size;
  }

  return { booksCompleted, uniqueGenres, sessionsCount, reviewsCount, totalPages, maxStreak, monthlySessionCount };
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────
function BadgeIcon({ iconKey, size = 22 }: { iconKey: IconKey; size?: number }) {
  const s = size;
  const p: Record<IconKey, React.ReactElement> = {
    books: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="4" y="7" width="3" height="12" rx="0.6" fill="white" />
        <rect x="8.5" y="5" width="3" height="14" rx="0.6" fill="white" />
        <rect x="13" y="8" width="3" height="11" rx="0.6" fill="white" />
        <line x1="3" y1="20" x2="17" y2="20" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
    compass: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8.5" stroke="white" strokeWidth="1.5" />
        <polygon points="12,4.5 13.8,10.5 12,12 10.2,10.5" fill="white" />
        <polygon points="12,19.5 10.2,13.5 12,12 13.8,13.5" fill="white" opacity="0.45" />
        <circle cx="12" cy="12" r="1.5" fill="white" />
      </svg>
    ),
    lightning: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M13.5 2.5L4.5 13.5H11.5L10.5 21.5L19.5 10.5H12.5L13.5 2.5Z"
          stroke="white" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    ),
    quill: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M19.5 4.5C15.5 3.5 9.5 7.5 7 14L5.5 20L11.5 18.5C18 15.5 22 9.5 19.5 4.5Z"
          stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M7 14L11.5 18.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M9.5 18L5.5 21.5" stroke="white" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
    pages: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="3.5" y="4" width="8" height="11" rx="1" stroke="white" strokeWidth="1.4" />
        <line x1="5.5" y1="7.5" x2="9.5" y2="7.5" stroke="white" strokeWidth="1" strokeLinecap="round" />
        <line x1="5.5" y1="10" x2="9.5" y2="10" stroke="white" strokeWidth="1" strokeLinecap="round" />
        <rect x="12.5" y="7" width="8" height="11" rx="1" stroke="white" strokeWidth="1.4" />
        <line x1="14.5" y1="10.5" x2="18.5" y2="10.5" stroke="white" strokeWidth="1" strokeLinecap="round" />
        <line x1="14.5" y1="13" x2="18.5" y2="13" stroke="white" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
    flame: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M12 3C9 6.5 8.5 9.5 10.5 12.5C8.5 12 7.5 10 8.5 8C5.5 11 5 16.5 8.5 19.5C9.5 20.5 10.8 21 12 21C15.5 21 19 17.5 19 14C19 11 17 9 15 8C16 10.5 14.5 12.5 13 12C14.5 9 14 5.5 12 3Z"
          stroke="white" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    ),
    calendar: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="16" rx="2" stroke="white" strokeWidth="1.4" />
        <line x1="3" y1="10" x2="21" y2="10" stroke="white" strokeWidth="1.4" />
        <line x1="8" y1="3" x2="8" y2="7" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="16" y1="3" x2="16" y2="7" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
        <text x="12" y="18.5" textAnchor="middle" fill="white" fontSize="5.5" fontWeight="700" fontFamily="system-ui">JUL</text>
      </svg>
    ),
  };
  return p[iconKey] ?? null;
}

// ── Bookmark Badge Visual ─────────────────────────────────────────────────────
function BookmarkBadge({ def, unlocked, unlockedAt, size = 56 }: {
  def: BadgeDef; unlocked: boolean; unlockedAt?: string; size?: number;
}) {
  const w = size;
  const h = Math.round(w * 1.42);
  const notch = Math.round(h * 0.13);
  const hdrH  = Math.round(h * 0.26);
  const gradId   = `bk-g-${def.id}-${size}`;
  const shadowId = `bk-s-${def.id}-${size}`;
  const tierMeta = TIER_META[def.tier as BadgeTier];
  const [c1, c2] = unlocked
    ? TYPE_GRADIENT[def.type as BadgeType][def.tier - 1]
    : ["#374151", "#1f2937"];

  const path    = `M 4,0 L ${w - 4},0 Q ${w},0 ${w},4 L ${w},${h} L ${w / 2},${h - notch} L 0,${h} L 0,4 Q 0,0 4,0 Z`;
  const hdrPath = `M 4,0 L ${w - 4},0 Q ${w},0 ${w},4 L ${w},${hdrH} L 0,${hdrH} L 0,4 Q 0,0 4,0 Z`;
  const iconY   = hdrH + (h - notch - hdrH) / 2 - 12;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
        <filter id={shadowId} x="-30%" y="-15%" width="160%" height="145%">
          <feDropShadow dx="0" dy={unlocked ? 3 : 1} stdDeviation={unlocked ? 4 : 2}
            floodOpacity={unlocked ? 0.4 : 0.12} floodColor="#000" />
        </filter>
      </defs>
      {/* Corps principal */}
      <path d={path} fill={`url(#${gradId})`} filter={`url(#${shadowId})`} />
      {/* Bande en-tête */}
      <path d={hdrPath} fill="white" fillOpacity={0.14} />
      {/* Séparateur */}
      <line x1={w * 0.14} y1={hdrH} x2={w * 0.86} y2={hdrH}
        stroke="white" strokeWidth="0.6" opacity={0.28} />
      {/* Lignes décoratives bas (effet pages) */}
      {unlocked && (
        <>
          <line x1={w * 0.2} y1={h * 0.72} x2={w * 0.8} y2={h * 0.72}
            stroke="white" strokeWidth="0.8" opacity={0.22} />
          <line x1={w * 0.27} y1={h * 0.8} x2={w * 0.73} y2={h * 0.8}
            stroke="white" strokeWidth="0.7" opacity={0.14} />
        </>
      )}
      {/* Icône centrée */}
      <g transform={`translate(${w / 2 - 11}, ${iconY})`} opacity={unlocked ? 1 : 0.28}>
        <BadgeIcon iconKey={def.iconKey} size={22} />
      </g>
      {/* Cercle de palier (haut droite) */}
      {unlocked && (
        <>
          <circle cx={w - 9} cy={9} r={7.5} fill={tierMeta.stroke} />
          <text x={w - 9} y={12.5} textAnchor="middle" fill="white"
            fontSize={7} fontWeight="800" fontFamily="system-ui">{def.tier}</text>
        </>
      )}
      {/* Trou en haut (œillet de marque-page) */}
      <circle cx={w / 2} cy={5.5} r={3.5} fill="black" fillOpacity={unlocked ? 0.32 : 0.18} />
      <circle cx={w / 2} cy={5.5} r={2}   fill={unlocked ? c1 : "#444"} fillOpacity={0.65} />
      {/* Petit reflet en haut gauche */}
      {unlocked && (
        <ellipse cx={w * 0.28} cy={hdrH * 0.45} rx={w * 0.12} ry={hdrH * 0.2}
          fill="white" fillOpacity={0.12} />
      )}
      {/* Date mini si obtenu (bas de la bande) */}
      {unlocked && unlockedAt && (
        <text x={w / 2} y={hdrH - 3} textAnchor="middle" fill="white"
          fontSize={Math.max(5.5, w * 0.095)} fontWeight="600" fontFamily="system-ui" opacity={0.7}>
          {new Date(unlockedAt).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })}
        </text>
      )}
    </svg>
  );
}

// ── Badge Detail (bottom sheet) ───────────────────────────────────────────────
function BadgeDetailSheet({ def, unlocked, unlockedAt, onClose }: {
  def: BadgeDef; unlocked: boolean; unlockedAt?: string; onClose: () => void;
}) {
  const [holders, setHolders] = useState<{ display_name: string; avatar_url: string | null }[]>([]);

  useEffect(() => {
    supabase.from("user_badges").select("user_id").eq("badge_id", def.id).then(async ({ data }) => {
      if (!data?.length) return;
      const ids = (data as { user_id: string }[]).map((r) => r.user_id);
      const { data: profs } = await supabase.from("user_profiles")
        .select("display_name, avatar_url").in("id", ids);
      setHolders((profs ?? []) as { display_name: string; avatar_url: string | null }[]);
    });
  }, [def.id]);

  const meta = TIER_META[def.tier as BadgeTier];
  const dateStr = unlockedAt
    ? new Date(unlockedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center"
      onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-t-3xl bg-paper sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-0">
          <div className="h-1 w-10 rounded-full bg-line" />
        </div>
        <div className="flex flex-col items-center gap-3 px-6 pt-5 pb-4">
          <BookmarkBadge def={def} unlocked={unlocked} unlockedAt={unlockedAt} size={80} />
          <div className="text-center">
            <p className={`text-[10px] font-bold uppercase tracking-widest ${meta.textClass}`}>{meta.label}</p>
            <p className="font-serif text-xl font-black text-ink">{def.name}</p>
            <p className="mt-0.5 text-sm text-muted">{def.description}</p>
          </div>
          <span className={`rounded-xl border px-4 py-1.5 text-sm font-bold ${meta.borderClass} ${meta.textClass}`}>
            +{def.points} points
          </span>
        </div>

        <div className="px-5 pb-3">
          {unlocked ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" className="h-4 w-4 shrink-0">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <p className="text-[12.5px] font-semibold text-emerald-800 dark:text-emerald-300">
                Obtenu{dateStr && ` le ${dateStr}`}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-input px-3 py-2.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-muted">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <p className="text-[12.5px] font-medium text-muted">Non obtenu</p>
            </div>
          )}
        </div>

        {holders.length > 0 && (
          <div className="px-5 pb-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
              {holders.length} membre{holders.length > 1 ? "s" : ""} ont ce marque-page
            </p>
            <div className="flex flex-wrap gap-2">
              {holders.map((h, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  {h.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={h.avatar_url} alt={h.display_name} className="h-6 w-6 rounded-full object-cover" />
                    : <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet text-[9px] font-bold text-cream">
                        {h.display_name[0]?.toUpperCase()}
                      </span>
                  }
                  <span className="text-[11.5px] font-medium text-ink">{h.display_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-5 pb-8">
          <button onClick={onClose}
            className="w-full rounded-2xl border border-line py-3 text-sm font-semibold text-muted
              transition-colors hover:border-violet/40 hover:text-ink">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
interface LeaderEntry {
  id: string; display_name: string; avatar_url: string | null;
  totalPoints: number; badgeCount: number;
}

function LeaderboardView({ currentUserId }: { currentUserId?: string }) {
  const [entries, setEntries] = useState<LeaderEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ data: allBadges }, { data: profiles }] = await Promise.all([
        supabase.from("user_badges").select("user_id, badge_id"),
        supabase.from("user_profiles").select("id, display_name, avatar_url"),
      ]);
      const pts = new Map<string, number>();
      const cnt = new Map<string, number>();
      for (const ub of (allBadges ?? []) as { user_id: string; badge_id: string }[]) {
        const def = BADGE_DEFS.find((d) => d.id === ub.badge_id);
        if (!def) continue;
        pts.set(ub.user_id, (pts.get(ub.user_id) ?? 0) + def.points);
        cnt.set(ub.user_id, (cnt.get(ub.user_id) ?? 0) + 1);
      }
      const result = (
        (profiles ?? []) as { id: string; display_name: string; avatar_url: string | null }[]
      ).map((p) => ({
        id: p.id, display_name: p.display_name, avatar_url: p.avatar_url,
        totalPoints: pts.get(p.id) ?? 0, badgeCount: cnt.get(p.id) ?? 0,
      })).sort((a, b) => b.totalPoints - a.totalPoints);
      setEntries(result);
    };
    load();
  }, []);

  if (!entries.length) return <p className="py-8 text-center text-sm text-muted">Aucun classement disponible.</p>;

  const rankIcon = (r: number) => {
    if (r === 1) return <span className="text-[#d4a017] text-lg">★</span>;
    if (r === 2) return <span className="text-[#8a9ab5] text-lg">★</span>;
    if (r === 3) return <span className="text-[#c97d41] text-lg">★</span>;
    return <span className="text-[13px] font-bold text-muted">{r}</span>;
  };

  return (
    <div className="flex flex-col gap-2">
      {entries.map((e, i) => {
        const isMe = e.id === currentUserId;
        return (
          <div key={e.id} className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
            isMe ? "bg-violet-soft border-violet/30" : "bg-card border-line"
          }`}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center">{rankIcon(i + 1)}</span>
            {e.avatar_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={e.avatar_url} alt={e.display_name} className="h-8 w-8 shrink-0 rounded-full object-cover" />
              : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet font-serif text-xs font-bold text-cream">
                  {e.display_name[0]?.toUpperCase()}
                </span>
            }
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink">
                {e.display_name}
                {isMe && <span className="ml-1.5 text-[10px] font-normal text-violet-deep">(toi)</span>}
              </p>
              <p className="text-[11px] text-muted">{e.badgeCount} marque-page{e.badgeCount !== 1 ? "s" : ""}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-serif text-[17px] font-black text-ink">{e.totalPoints.toLocaleString("fr-FR")}</p>
              <p className="text-[9px] font-medium uppercase tracking-widest text-muted">pts</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Badges Hub (full-screen modal, style Garmin) ──────────────────────────────
function BadgesHub({ memberId, currentUserId, onClose }: {
  memberId: string; currentUserId?: string; onClose: () => void;
}) {
  const [tab,  setTab]  = useState<"won" | "available" | "leaderboard">("won");
  const [loading, setLoading] = useState(true);
  const [profile,  setProfile]  = useState<{ display_name: string; avatar_url: string | null } | null>(null);
  const [unlocked, setUnlocked] = useState<{ badge_id: string; unlocked_at: string }[]>([]);
  const [stats,    setStats]    = useState<UserBadgeStats | null>(null);
  const [selected, setSelected] = useState<BadgeDef | null>(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // Attribution automatique (propre profil uniquement)
      if (currentUserId === memberId) {
        await fetch("/api/badges/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: memberId }),
        }).catch(() => {});
      }
      const [profileRes, ubRes, computedStats] = await Promise.all([
        supabase.from("user_profiles").select("display_name, avatar_url").eq("id", memberId).single(),
        supabase.from("user_badges").select("badge_id, unlocked_at").eq("user_id", memberId)
          .order("unlocked_at", { ascending: false }),
        fetchBadgeStats(memberId),
      ]);
      setProfile(profileRes.data as { display_name: string; avatar_url: string | null } | null);
      setUnlocked((ubRes.data ?? []) as { badge_id: string; unlocked_at: string }[]);
      setStats(computedStats);
      setLoading(false);
    };
    load();
  }, [memberId, currentUserId]);

  const unlockedSet  = new Set(unlocked.map((u) => u.badge_id));
  const totalPoints  = getTotalPoints(unlockedSet);
  const lvl          = getLevelProgress(totalPoints);
  const wonBadges    = BADGE_DEFS.filter((d) => unlockedSet.has(d.id));
  const lockedBadges = BADGE_DEFS.filter((d) => !unlockedSet.has(d.id));
  const TYPE_LABEL: Record<string, string> = {
    volume:"Bâtisseur", genre:"Explorateur", sessions:"Marathonien",
    review:"Critique", pages:"Vorace", streak:"Régulier", monthly:"Défis mensuels",
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-paper">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <button onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-input text-muted
            transition-colors hover:text-ink">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M19 12H5M5 12l7 7M5 12l7-7" />
          </svg>
        </button>
        <p className="font-serif text-base font-semibold text-ink">
          {currentUserId === memberId ? "Mes marque-pages" : "Marque-pages"}
        </p>
        <div className="w-8" />
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted">Chargement…</p>
        </div>
      ) : (
        <>
          {/* Avatar + Level progress (style Garmin) */}
          <div className="flex items-center gap-4 border-b border-line px-5 py-4">
            <div className="relative shrink-0">
              {profile?.avatar_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={profile.avatar_url} alt={profile.display_name}
                    className="h-14 w-14 rounded-full object-cover ring-2 ring-violet/30" />
                : <span className="flex h-14 w-14 items-center justify-center rounded-full bg-violet
                    font-serif text-xl font-bold text-cream ring-2 ring-violet/30">
                    {profile?.display_name?.[0]?.toUpperCase()}
                  </span>
              }
              <span className="absolute -bottom-1 -right-1 flex h-[22px] w-[22px] items-center justify-center
                rounded-full bg-violet font-mono text-[11px] font-black text-cream ring-2 ring-paper">
                {lvl.level}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <p className="truncate text-[13px] font-semibold text-ink">{profile?.display_name}</p>
                <span className="shrink-0 rounded-full bg-violet-soft px-2 py-0.5 text-[9.5px] font-bold text-violet-deep">
                  {lvl.title}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-input">
                <div className="h-full rounded-full bg-gradient-to-r from-violet to-violet-deep transition-all duration-700"
                  style={{ width: `${lvl.pct}%` }} />
              </div>
              <p className="mt-1 text-[10.5px] text-muted">
                {lvl.toNext > 0
                  ? <>{lvl.toNext} pts avant <span className="font-semibold text-ink">{lvl.nextTitle}</span></>
                  : <span className="font-semibold text-violet-deep">Niveau maximum atteint</span>
                }
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-serif text-xl font-black text-ink">{totalPoints.toLocaleString("fr-FR")}</p>
              <p className="text-[9px] font-medium uppercase tracking-widest text-muted">pts</p>
            </div>
          </div>

          {/* Tabs (style Garmin) */}
          <div className="flex border-b border-line">
            {([["won", `Gagnés (${wonBadges.length})`], ["available", "Disponible"], ["leaderboard", "Leaders"]] as const).map(
              ([key, label]) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`flex-1 py-3 text-[12.5px] font-semibold transition-colors ${
                    tab === key ? "border-b-2 border-violet text-violet" : "text-muted"
                  }`}>
                  {label}
                </button>
              )
            )}
          </div>

          {/* Notice date butoir */}
          <div className="flex items-center gap-2 border-b border-line bg-amber-50/70 px-4 py-2 dark:bg-amber-900/10">
            <span className="shrink-0">⚠️</span>
            <p className="text-[10.5px] text-amber-900 dark:text-amber-300">
              Progression depuis le <span className="font-semibold">20 juin 2026</span> uniquement.
            </p>
          </div>

          {/* Contenu onglet */}
          <div className="flex-1 overflow-y-auto p-4">
            {tab === "won" ? (
              wonBadges.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16 text-center">
                  <p className="font-serif text-base text-ink">Aucun marque-page encore</p>
                  <p className="text-sm text-muted">Commence à lire pour en débloquer !</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {wonBadges.map((def) => {
                    const ub = unlocked.find((u) => u.badge_id === def.id);
                    return (
                      <button key={def.id} onClick={() => setSelected(def)}
                        className="group flex flex-col items-center gap-1.5 focus:outline-none">
                        <div className="transition-transform group-hover:scale-105">
                          <BookmarkBadge def={def} unlocked unlockedAt={ub?.unlocked_at} size={76} />
                        </div>
                        <p className="text-center text-[10.5px] font-semibold leading-tight text-ink">
                          {def.name}
                        </p>
                        <p className={`text-[9.5px] font-bold ${TIER_META[def.tier as BadgeTier].textClass}`}>
                          {TIER_META[def.tier as BadgeTier].label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )
            ) : tab === "available" ? (
              <div className="flex flex-col gap-5">
                {(["volume","genre","sessions","review","pages","streak","monthly"] as BadgeType[]).map((type) => {
                  const group = lockedBadges.filter((d) => d.type === type);
                  if (!group.length) return null;
                  return (
                    <div key={type}>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                        {TYPE_LABEL[type]}
                      </p>
                      <div className="grid grid-cols-3 gap-4">
                        {group.map((def) => {
                          const current = stats ? getStatValue(def, stats) : 0;
                          const pct     = Math.min(100, (current / def.targetValue) * 100);
                          return (
                            <button key={def.id} onClick={() => setSelected(def)}
                              className="group flex flex-col items-center gap-1.5 focus:outline-none">
                              <div className="opacity-35 grayscale transition-all group-hover:opacity-45">
                                <BookmarkBadge def={def} unlocked={false} size={76} />
                              </div>
                              <p className="text-center text-[10.5px] font-semibold leading-tight text-ink">
                                {def.name}
                              </p>
                              <div className="w-full px-1">
                                <div className="h-1 overflow-hidden rounded-full bg-line">
                                  <div className="h-full rounded-full bg-violet transition-all"
                                    style={{ width: `${pct}%` }} />
                                </div>
                                <p className="mt-0.5 text-center text-[9px] text-muted">
                                  {current.toLocaleString("fr-FR")} / {def.targetValue.toLocaleString("fr-FR")}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <LeaderboardView currentUserId={currentUserId} />
            )}
          </div>
        </>
      )}

      {selected && (
        <BadgeDetailSheet
          def={selected}
          unlocked={unlockedSet.has(selected.id)}
          unlockedAt={unlocked.find((u) => u.badge_id === selected.id)?.unlocked_at}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// ── Showcase vitrine (style Strava) ────────────────────────────────────────────
export default function BadgesSection({ memberId, currentUserId }: {
  memberId: string; currentUserId?: string;
}) {
  const [hubOpen,  setHubOpen]  = useState(false);
  const [unlocked, setUnlocked] = useState<{ badge_id: string; unlocked_at: string }[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    supabase.from("user_badges").select("badge_id, unlocked_at")
      .eq("user_id", memberId)
      .order("unlocked_at", { ascending: false })
      .then(({ data }) => {
        setUnlocked((data ?? []) as { badge_id: string; unlocked_at: string }[]);
        setLoading(false);
      });
  }, [memberId]);

  const wonCount = unlocked.length;
  const recent   = unlocked.slice(0, 5)
    .map((ub) => ({ ub, def: BADGE_DEFS.find((d) => d.id === ub.badge_id) }))
    .filter((x): x is { ub: typeof unlocked[0]; def: BadgeDef } => x.def !== undefined);

  return (
    <>
      <section className="flex flex-col gap-3">
        {/* Titre + compteur */}
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-medium text-ink">Collection de marque-pages</h2>
          <span className="text-sm font-bold text-ink">{wonCount}</span>
        </div>

        {loading ? (
          <p className="py-4 text-center text-xs text-muted">Chargement…</p>
        ) : wonCount === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-8 text-center">
            <p className="text-sm text-muted">Aucun marque-page encore</p>
            <button onClick={() => setHubOpen(true)}
              className="text-[12px] font-semibold text-violet underline-offset-2 hover:underline">
              Voir les défis →
            </button>
          </div>
        ) : (
          <>
            {/* Carrousel horizontal */}
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1"
              style={{ scrollbarWidth: "none" }}>
              {recent.map(({ ub, def }) => (
                <button key={def.id} onClick={() => setHubOpen(true)}
                  className="group flex shrink-0 flex-col items-center gap-1 focus:outline-none">
                  <div className="transition-transform group-hover:scale-105">
                    <BookmarkBadge def={def} unlocked unlockedAt={ub.unlocked_at} size={58} />
                  </div>
                  <p className="max-w-[60px] text-center text-[10px] font-semibold leading-tight text-ink">
                    {def.name}
                  </p>
                  <p className={`text-[8.5px] font-bold ${TIER_META[def.tier as BadgeTier].textClass}`}>
                    {TIER_META[def.tier as BadgeTier].label}
                  </p>
                </button>
              ))}

              {/* Bouton "Voir tout" */}
              <button onClick={() => setHubOpen(true)}
                className="group flex shrink-0 flex-col items-center gap-1.5 focus:outline-none">
                <div className="flex items-center justify-center rounded-2xl border border-line bg-card
                  transition-colors group-hover:border-violet/40 group-hover:bg-violet-soft"
                  style={{ width: 58, height: Math.round(58 * 1.42) }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                    className="h-5 w-5 text-muted group-hover:text-violet-deep">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
                <p className="text-[10px] font-medium text-muted">Tous</p>
              </button>
            </div>

            {/* Lien bas */}
            <button onClick={() => setHubOpen(true)}
              className="self-end text-[12.5px] font-semibold text-violet underline-offset-2 hover:underline">
              Tous les marque-pages →
            </button>
          </>
        )}
      </section>

      {hubOpen && (
        <BadgesHub memberId={memberId} currentUserId={currentUserId} onClose={() => setHubOpen(false)} />
      )}
    </>
  );
}
