"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  BADGE_DEFS,
  TIER_META,
  getTotalPoints,
  getLevel,
  getStatValue,
  type BadgeDef,
  type BadgeTier,
  type IconKey,
  type UserBadgeStats,
} from "../lib/badges";

// ── SVG icons vectoriels ──────────────────────────────────────────────────────
function BadgeIcon({ iconKey, color, size = 20 }: { iconKey: IconKey; color: string; size?: number }) {
  const s = size;
  switch (iconKey) {
    case "books":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="4"  y="7"  width="3" height="12" rx="0.6" fill={color} />
          <rect x="8.5" y="5" width="3" height="14" rx="0.6" fill={color} />
          <rect x="13" y="8" width="3" height="11" rx="0.6" fill={color} />
          <line x1="3" y1="20" x2="17" y2="20" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "compass":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth="1.5" />
          <polygon points="12,4.5 13.8,10.5 12,12 10.2,10.5" fill={color} />
          <polygon points="12,19.5 10.2,13.5 12,12 13.8,13.5" fill={color} opacity="0.45" />
          <circle cx="12" cy="12" r="1.5" fill={color} />
        </svg>
      );
    case "lightning":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M13.5 2.5L4.5 13.5H11.5L10.5 21.5L19.5 10.5H12.5L13.5 2.5Z"
            stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      );
    case "quill":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M19.5 4.5C15.5 3.5 9.5 7.5 7 14L5.5 20L11.5 18.5C18 15.5 22 9.5 19.5 4.5Z"
            stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M7 14L11.5 18.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M9.5 18L5.5 21.5" stroke={color} strokeWidth="1" strokeLinecap="round" />
        </svg>
      );
    case "pages":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="3.5" y="4" width="8" height="11" rx="1" stroke={color} strokeWidth="1.4" />
          <line x1="5.5" y1="7.5"  x2="9.5"  y2="7.5"  stroke={color} strokeWidth="1" strokeLinecap="round" />
          <line x1="5.5" y1="10"   x2="9.5"  y2="10"    stroke={color} strokeWidth="1" strokeLinecap="round" />
          <rect x="12.5" y="7" width="8" height="11" rx="1" stroke={color} strokeWidth="1.4" />
          <line x1="14.5" y1="10.5" x2="18.5" y2="10.5"  stroke={color} strokeWidth="1" strokeLinecap="round" />
          <line x1="14.5" y1="13"   x2="18.5" y2="13"    stroke={color} strokeWidth="1" strokeLinecap="round" />
        </svg>
      );
    case "flame":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M12 3C9 6.5 8.5 9.5 10.5 12.5C8.5 12 7.5 10 8.5 8C5.5 11 5 16.5 8.5 19.5C9.5 20.5 10.8 21 12 21C15.5 21 19 17.5 19 14C19 11 17 9 15 8C16 10.5 14.5 12.5 13 12C14.5 9 14 5.5 12 3Z"
            stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      );
    case "calendar":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth="1.4" />
          <line x1="3"  y1="10" x2="21" y2="10" stroke={color} strokeWidth="1.4" />
          <line x1="8"  y1="3"  x2="8"  y2="7"  stroke={color} strokeWidth="1.4" strokeLinecap="round" />
          <line x1="16" y1="3"  x2="16" y2="7"  stroke={color} strokeWidth="1.4" strokeLinecap="round" />
          <text x="12" y="18.5" textAnchor="middle" fill={color} fontSize="5.5" fontWeight="700" fontFamily="system-ui">JUL</text>
        </svg>
      );
  }
}

// ── Carte badge ───────────────────────────────────────────────────────────────
function BadgeCard({
  def,
  unlocked,
  progress,
  onClick,
}: {
  def: BadgeDef;
  unlocked: boolean;
  progress?: number; // valeur actuelle (pour locked)
  onClick: () => void;
}) {
  const meta = TIER_META[def.tier as BadgeTier];

  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-all ${
        unlocked
          ? `${meta.borderClass} ${meta.bg} ${meta.bgDark}`
          : "border-line bg-card opacity-50 grayscale"
      }`}
    >
      {/* Cercle badge */}
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${
          unlocked ? meta.borderClass : "border-muted"
        }`}
      >
        <BadgeIcon iconKey={def.iconKey} color={unlocked ? meta.stroke : "#9ca3af"} size={22} />
      </div>

      {/* Tier pill */}
      <span
        className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
          unlocked ? `${meta.bg} ${meta.bgDark} ${meta.textClass}` : "bg-paper text-muted"
        }`}
      >
        {meta.label}
      </span>

      <p className="text-[11px] font-semibold leading-tight text-ink">{def.name}</p>

      {/* Progress bar si locked */}
      {!unlocked && progress !== undefined && (
        <div className="w-full">
          <div className="h-0.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-muted"
              style={{ width: `${Math.min(100, (progress / def.targetValue) * 100)}%` }}
            />
          </div>
          <p className="mt-0.5 text-[9.5px] text-muted">
            {progress.toLocaleString("fr-FR")} / {def.targetValue.toLocaleString("fr-FR")}
          </p>
        </div>
      )}

      {/* Points */}
      <p className={`text-[9.5px] font-semibold ${unlocked ? meta.textClass : "text-muted"}`}>
        +{def.points} pts
      </p>
    </button>
  );
}

// ── Modal détail badge ────────────────────────────────────────────────────────
interface BadgeModalProps {
  def: BadgeDef;
  unlocked: boolean;
  unlockedAt?: string;
  holders: { display_name: string; avatar_url: string | null }[];
  onClose: () => void;
}

function BadgeModal({ def, unlocked, unlockedAt, holders, onClose }: BadgeModalProps) {
  const meta = TIER_META[def.tier as BadgeTier];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-paper shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header coloré */}
        <div className={`flex flex-col items-center gap-3 px-6 py-7 ${meta.bg} ${meta.bgDark}`}>
          <div className={`flex h-20 w-20 items-center justify-center rounded-full border-[3px] bg-paper ${meta.borderClass}`}>
            <BadgeIcon iconKey={def.iconKey} color={unlocked ? meta.stroke : "#9ca3af"} size={36} />
          </div>
          <div className="text-center">
            <p className={`text-[10px] font-bold uppercase tracking-widest ${meta.textClass}`}>
              {meta.label}
            </p>
            <p className="font-serif text-xl font-black text-ink">{def.name}</p>
            <p className="mt-0.5 text-sm text-muted">{def.description}</p>
          </div>
          <div className={`rounded-xl px-4 py-1.5 border ${meta.borderClass}`}>
            <span className={`text-sm font-bold ${meta.textClass}`}>+{def.points} points</span>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {/* Statut */}
          {unlocked ? (
            <div className="flex items-center gap-2 rounded-xl bg-[#eaf1ea] dark:bg-[#162516] px-3 py-2.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="#3d7a3d" strokeWidth="2.2" className="h-4 w-4 shrink-0">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <p className="text-[12.5px] font-semibold text-[#3d7a3d]">
                Badge débloqué
                {unlockedAt && (
                  <span className="ml-1 font-normal text-[#5a9a5a]">
                    le {new Date(unlockedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                )}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-input px-3 py-2.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-muted">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <p className="text-[12.5px] font-medium text-muted">Non débloqué</p>
            </div>
          )}

          {/* Membres qui ont ce badge */}
          {holders.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                {holders.length} membre{holders.length > 1 ? "s" : ""} ont ce badge
              </p>
              <div className="flex flex-wrap gap-2">
                {holders.map((h, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    {h.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={h.avatar_url} alt={h.display_name} className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet text-[9px] font-bold text-cream">
                        {h.display_name[0]?.toUpperCase()}
                      </span>
                    )}
                    <span className="text-[11.5px] font-medium text-ink">{h.display_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full rounded-2xl border border-line py-3 text-sm font-semibold text-muted transition-colors hover:border-violet/40 hover:text-ink"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
interface LeaderEntry {
  id: string;
  display_name: string;
  avatar_url: string | null;
  totalPoints: number;
  badgeCount: number;
}

function Leaderboard({ currentUserId }: { currentUserId?: string }) {
  const [entries, setEntries] = useState<LeaderEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      const [{ data: allBadges }, { data: profiles }] = await Promise.all([
        supabase.from("user_badges").select("user_id, badge_id"),
        supabase.from("user_profiles").select("id, display_name, avatar_url"),
      ]);

      const pointsMap = new Map<string, number>();
      const countMap  = new Map<string, number>();
      for (const ub of (allBadges ?? []) as { user_id: string; badge_id: string }[]) {
        const def = BADGE_DEFS.find((d) => d.id === ub.badge_id);
        if (!def) continue;
        pointsMap.set(ub.user_id, (pointsMap.get(ub.user_id) ?? 0) + def.points);
        countMap.set(ub.user_id, (countMap.get(ub.user_id) ?? 0) + 1);
      }

      const result: LeaderEntry[] = (
        (profiles ?? []) as { id: string; display_name: string; avatar_url: string | null }[]
      )
        .map((p) => ({
          id:           p.id,
          display_name: p.display_name,
          avatar_url:   p.avatar_url,
          totalPoints:  pointsMap.get(p.id) ?? 0,
          badgeCount:   countMap.get(p.id)  ?? 0,
        }))
        .sort((a, b) => b.totalPoints - a.totalPoints);

      setEntries(result);
    };
    load();
  }, []);

  if (entries.length === 0) return null;

  const tierIcon = (rank: number) => {
    if (rank === 1) return <span className="text-[#d4a017]">★</span>;
    if (rank === 2) return <span className="text-[#8a9ab5]">★</span>;
    if (rank === 3) return <span className="text-[#c97d41]">★</span>;
    return <span className="text-muted text-xs">{rank}</span>;
  };

  return (
    <div className="flex flex-col gap-2">
      {entries.map((e, i) => {
        const isMe = e.id === currentUserId;
        return (
          <div
            key={e.id}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
              isMe ? "bg-violet-soft border border-violet/30" : "bg-card border border-line"
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center font-serif text-[15px] font-bold">
              {tierIcon(i + 1)}
            </span>
            {e.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.avatar_url} alt={e.display_name} className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet font-serif text-xs font-bold text-cream">
                {e.display_name[0]?.toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink">
                {e.display_name}{isMe && <span className="ml-1.5 text-[10px] font-normal text-violet-deep">(toi)</span>}
              </p>
              <p className="text-[11px] text-muted">
                {e.badgeCount} badge{e.badgeCount !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-serif text-[17px] font-black text-ink">{e.totalPoints.toLocaleString("fr-FR")}</p>
              <p className="text-[9.5px] font-medium uppercase tracking-wide text-muted">pts</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Section principale ────────────────────────────────────────────────────────
export default function BadgesSection({
  memberId,
  currentUserId,
}: {
  memberId: string;
  currentUserId?: string;
}) {
  const [tab, setTab] = useState<"won" | "available" | "leaderboard">("won");
  const [unlockedBadges, setUnlockedBadges] = useState<{ badge_id: string; unlocked_at: string }[]>([]);
  const [stats, setStats] = useState<UserBadgeStats | null>(null);
  const [selectedDef, setSelectedDef] = useState<BadgeDef | null>(null);
  const [holders, setHolders] = useState<{ display_name: string; avatar_url: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const CUTOFF = "2026-06-20";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: ubData }, logsRes, booksRes, reviewsRes] = await Promise.all([
        supabase.from("user_badges").select("badge_id, unlocked_at").eq("user_id", memberId),
        supabase.from("reading_logs").select("date, pages_read").eq("user_id", memberId).gte("date", CUTOFF),
        supabase.from("books").select("genre, status, notes, created_at").eq("user_id", memberId).gte("created_at", CUTOFF),
        supabase.from("books").select("id", { count: "exact", head: true })
          .eq("user_id", memberId).not("notes", "is", null).neq("notes", "").gte("created_at", CUTOFF),
      ]);

      setUnlockedBadges((ubData ?? []) as { badge_id: string; unlocked_at: string }[]);

      type LogRow = { date: string; pages_read: number | null };
      const logs = (logsRes.data ?? []) as LogRow[];
      const books = (booksRes.data ?? []) as { genre: string | null; status: string; notes: string | null }[];

      const totalPages = logs.reduce((s, r) => s + (r.pages_read ?? 0), 0);

      const genreSet = new Set<string>();
      for (const b of books) {
        if (!b.genre || b.status !== "completed") continue;
        b.genre.split(/[,;]+/).forEach((g) => { const t = g.trim(); if (t) genreSet.add(t); });
      }

      const dateSet = [...new Set(logs.map((r) => r.date))].sort();
      let maxStreak = dateSet.length > 0 ? 1 : 0;
      let streak = 1;
      for (let i = 1; i < dateSet.length; i++) {
        const diff = Math.round(
          (new Date(dateSet[i]).getTime() - new Date(dateSet[i - 1]).getTime()) / 86400000
        );
        if (diff === 1) { streak++; if (streak > maxStreak) maxStreak = streak; }
        else if (diff > 1) streak = 1;
      }

      const monthlyCount = logs.filter((r) => r.date >= "2026-07-01" && r.date <= "2026-07-31").length;

      setStats({
        booksCompleted:      books.filter((b) => b.status === "completed").length,
        uniqueGenres:        genreSet.size,
        sessionsCount:       logs.length,
        reviewsCount:        reviewsRes.count ?? 0,
        totalPages,
        maxStreak,
        monthlySessionCount: monthlyCount,
      });

      setLoading(false);
    };
    load();
  }, [memberId]);

  const unlockedSet = new Set(unlockedBadges.map((u) => u.badge_id));
  const totalPoints = getTotalPoints(unlockedSet);
  const { level, title } = getLevel(totalPoints);

  const openBadge = async (def: BadgeDef) => {
    setSelectedDef(def);
    // Charger qui a ce badge
    const { data: rows } = await supabase
      .from("user_badges")
      .select("user_id")
      .eq("badge_id", def.id);
    if (!rows || rows.length === 0) { setHolders([]); return; }
    const ids = (rows as { user_id: string }[]).map((r) => r.user_id);
    const { data: profs } = await supabase
      .from("user_profiles")
      .select("display_name, avatar_url")
      .in("id", ids);
    setHolders((profs ?? []) as { display_name: string; avatar_url: string | null }[]);
  };

  const wonBadges     = BADGE_DEFS.filter((d) => unlockedSet.has(d.id));
  const lockedBadges  = BADGE_DEFS.filter((d) => !unlockedSet.has(d.id));

  const TAB_BTN = (key: typeof tab, label: string) => (
    <button
      onClick={() => setTab(key)}
      className={`flex-1 rounded-xl py-2 text-[12.5px] font-semibold transition-colors ${
        tab === key ? "bg-violet text-cream" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className="flex flex-col gap-4">
      {/* Titre + points globaux */}
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg font-medium text-ink">Badges</h2>
        {totalPoints > 0 && (
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-violet-soft px-2.5 py-1 text-[11px] font-bold text-violet-deep">
              Niv. {level} · {title}
            </span>
            <span className="text-[13px] font-bold text-ink">
              {totalPoints.toLocaleString("fr-FR")} pts
            </span>
          </div>
        )}
      </div>

      {/* Onglets */}
      <div className="flex gap-1 rounded-xl bg-input p-1">
        {TAB_BTN("won",         `Remportés (${wonBadges.length})`)}
        {TAB_BTN("available",   `À débloquer (${lockedBadges.length})`)}
        {TAB_BTN("leaderboard", "Classement")}
      </div>

      {/* Bannière date de départ */}
      <div className="flex gap-2.5 rounded-2xl border border-amber-200/60 bg-amber-50/80 px-3.5 py-3 dark:border-amber-700/30 dark:bg-amber-900/10">
        <span className="mt-px shrink-0 text-base leading-none">⚠️</span>
        <p className="text-[11.5px] leading-relaxed text-amber-900 dark:text-amber-300">
          Les défis et la progression des badges ont débuté officiellement le{" "}
          <span className="font-semibold">20 juin 2026</span>. Les lectures antérieures ou imports de bibliothèques historiques ne sont pas comptabilisés.
        </p>
      </div>

      {loading ? (
        <p className="py-8 text-center text-xs text-muted">Chargement…</p>
      ) : tab === "won" ? (
        wonBadges.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            Aucun badge encore — commence à lire pour en débloquer !
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {wonBadges.map((def) => (
              <BadgeCard
                key={def.id}
                def={def}
                unlocked
                onClick={() => openBadge(def)}
              />
            ))}
          </div>
        )
      ) : tab === "available" ? (
        <div className="flex flex-col gap-3">
          {/* Groupes par catégorie */}
          {(["volume", "genre", "sessions", "review", "pages", "streak", "monthly"] as const).map((type) => {
            const group = lockedBadges.filter((d) => d.type === type);
            if (group.length === 0) return null;
            const label: Record<string, string> = {
              volume: "Bâtisseur", genre: "Explorateur", sessions: "Marathonien",
              review: "Critique", pages: "Vorace", streak: "Régulier", monthly: "Défis mensuels",
            };
            return (
              <div key={type}>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">{label[type]}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {group.map((def) => (
                    <BadgeCard
                      key={def.id}
                      def={def}
                      unlocked={false}
                      progress={stats ? getStatValue(def, stats) : undefined}
                      onClick={() => openBadge(def)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Leaderboard currentUserId={currentUserId} />
      )}

      {/* Modal badge */}
      {selectedDef && (
        <BadgeModal
          def={selectedDef}
          unlocked={unlockedSet.has(selectedDef.id)}
          unlockedAt={unlockedBadges.find((u) => u.badge_id === selectedDef.id)?.unlocked_at}
          holders={holders}
          onClose={() => setSelectedDef(null)}
        />
      )}
    </section>
  );
}
