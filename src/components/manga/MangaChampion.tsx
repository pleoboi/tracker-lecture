"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { todayISO, shiftDateISO } from "../../lib/books";
import { AvatarImg, Modal } from "../ui";
import { mangaProfileHref } from "../../lib/manga";

export type Champion = { userId: string; name: string; avatar: string | null; chapters: number };

/** Membre qui a lu le plus de chapitres sur la journée (tous les membres, comme le champion livres). */
async function championOf(date: string): Promise<Omit<Champion, "name" | "avatar"> | null> {
  const { data } = await supabase.from("manga_logs").select("user_id, amount").eq("date", date).eq("unit", "chapter");
  const byUser = new Map<string, number>();
  for (const l of (data ?? []) as { user_id: string; amount: number }[]) {
    byUser.set(l.user_id, (byUser.get(l.user_id) ?? 0) + l.amount);
  }
  const top = [...byUser.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])[0];
  return top ? { userId: top[0], chapters: top[1] } : null;
}

/* ---------------- Classement du jour ---------------- */

type Ranked = { userId: string; name: string; avatar: string | null; chapters: number };

async function rankingOf(date: string): Promise<Ranked[]> {
  const { data } = await supabase.from("manga_logs").select("user_id, amount").eq("date", date).eq("unit", "chapter");
  const byUser = new Map<string, number>();
  for (const l of (data ?? []) as { user_id: string; amount: number }[]) {
    byUser.set(l.user_id, (byUser.get(l.user_id) ?? 0) + l.amount);
  }
  const sorted = [...byUser.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return [];
  const { data: profs } = await supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", sorted.map(([id]) => id));
  const map = new Map(((profs ?? []) as { id: string; display_name: string; avatar_url: string | null }[]).map((p) => [p.id, p]));
  return sorted.map(([userId, chapters]) => ({
    userId,
    chapters,
    name: map.get(userId)?.display_name ?? "Membre",
    avatar: map.get(userId)?.avatar_url ?? null,
  }));
}

const PODIUM = [
  { rank: 1, h: "h-24", bg: "bg-violet", text: "text-cream", kanji: "壱" },
  { rank: 2, h: "h-16", bg: "bg-card", text: "text-ink", kanji: "弐" },
  { rank: 3, h: "h-11", bg: "bg-card", text: "text-ink", kanji: "参" },
];

/** Podium (3 premiers, avec leurs chapitres) puis liste du reste du club, avec barres relatives. */
function Ranking({ rows, empty }: { rows: Ranked[]; empty: string }) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted">{empty}</p>;
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const max = rows[0].chapters;
  // Ordre visuel du podium : 2e, 1er, 3e
  const order = [top[1], top[0], top[2]].map((r, i) => (r ? { r, p: PODIUM[[1, 0, 2][i]] } : null));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 items-end gap-2">
        {order.map((o, i) =>
          o ? (
            <Link key={o.r.userId} href={mangaProfileHref(o.r.userId)} className="flex min-w-0 flex-col items-center gap-1.5">
              <AvatarImg url={o.r.avatar} name={o.r.name} className={`${o.p.rank === 1 ? "h-14 w-14" : "h-11 w-11"} text-base ring-2 ring-ink`} />
              <span className="w-full truncate text-center text-[12px] font-bold text-ink">{o.r.name}</span>
              <div className={`${o.p.h} ${o.p.bg} ${o.p.text} flex w-full flex-col items-center justify-start gap-0.5 rounded-t-[5px] border-2 border-ink pt-1.5`}>
                <span className="font-serif text-[18px] leading-none">{o.p.kanji}</span>
                <span className="nums text-[13px] font-bold leading-none">{o.r.chapters} ch.</span>
              </div>
            </Link>
          ) : (
            <div key={i} />
          )
        )}
      </div>
      {rest.length > 0 && (
        <div className="flex flex-col gap-2 border-t-2 border-ink pt-3">
          {rest.map((r, i) => (
            <Link key={r.userId} href={mangaProfileHref(r.userId)} className="flex min-w-0 items-center gap-2.5">
              <span className="nums w-5 shrink-0 text-center text-[12px] font-bold text-muted">{i + 4}</span>
              <AvatarImg url={r.avatar} name={r.name} className="h-7 w-7 shrink-0 text-[11px]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12.5px] font-bold text-ink">{r.name}</span>
                  <span className="nums shrink-0 text-[12px] font-bold text-violet-deep">{r.chapters} ch.</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full border border-ink bg-card">
                  <div className="h-full bg-violet" style={{ width: `${Math.max(6, (r.chapters / max) * 100)}%` }} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function RankingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [day, setDay] = useState<"today" | "yesterday">("today");
  const [rows, setRows] = useState<Record<string, Ranked[]>>({});
  useEffect(() => {
    if (!open || rows[day]) return;
    const date = day === "today" ? todayISO() : shiftDateISO(todayISO(), -1);
    rankingOf(date).then((r) => setRows((prev) => ({ ...prev, [day]: r })));
  }, [open, day, rows]);
  const data = rows[day];
  return (
    <Modal open={open} onClose={onClose} title="Classement du jour">
      <div className="mb-4 flex gap-1.5">
        {(["today", "yesterday"] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDay(d)}
            className={`rounded-full border-2 px-3 py-1 text-[12px] font-bold ${day === d ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-2"}`}
          >
            {d === "today" ? "Aujourd'hui" : "Hier"}
          </button>
        ))}
      </div>
      {data ? (
        <Ranking rows={data} empty={day === "today" ? "Personne n'a encore lu de chapitre aujourd'hui." : "Aucun chapitre lu hier."} />
      ) : (
        <p className="py-8 text-center text-xs text-muted">Chargement…</p>
      )}
    </Modal>
  );
}

/* ---------------- Torii ---------------- */

/**
 * Torii de style myōjin (comme à Hakone) : kasagi épais aux extrémités
 * relevées, shimaki juste dessous, gakuzuka central, nuki qui dépasse des
 * piliers (avec ses cales), piliers ronds légèrement inclinés sur socles.
 */
function Torii({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      {/* Kasagi : poutre haute, bords relevés */}
      <path d="M2 6 Q80 17 158 6 L155 14 Q80 24 5 14 Z" />
      {/* Shimaki : seconde poutre juste dessous, à peine incurvée */}
      <path d="M11 15 Q80 23 149 15 L148 23 Q80 30 12 23 Z" />
      {/* Gakuzuka : montant central entre les deux poutres */}
      <rect x="76" y="26" width="8" height="15" />
      {/* Nuki : poutre basse droite, dépasse des piliers */}
      <rect x="13" y="41" width="134" height="7" />
      {/* Cales (kusabi) au-dessus du nuki, contre les piliers */}
      <rect x="35" y="38" width="15" height="3" />
      <rect x="110" y="38" width="15" height="3" />
      {/* Piliers ronds, légèrement évasés vers le bas */}
      <path d="M39 22 L49 22 L46 104 L34 104 Z" />
      <path d="M111 22 L121 22 L126 104 L114 104 Z" />
      {/* Socles arrondis (kamebara) */}
      <rect x="29" y="101" width="22" height="9" rx="4.5" />
      <rect x="109" y="101" width="22" height="9" rx="4.5" />
    </g>
  );
}

function ToriiScene({ torii, sun, ground }: { torii: string; sun?: string; ground?: string }) {
  return (
    <svg viewBox="0 0 160 118" className="h-full w-full" preserveAspectRatio="xMidYMax meet" aria-hidden>
      {sun && <circle cx="80" cy="60" r="40" fill={sun} />}
      {ground && <rect x="0" y="110" width="160" height="8" fill={ground} />}
      <Torii fill={torii} />
    </svg>
  );
}

/* ---------------- Morceaux communs ---------------- */

type Props = { today: Champion | null; yesterday: Champion | null; onOpen?: () => void };

function Name({ c, className, ring }: { c: Champion; className: string; ring: string }) {
  return (
    <Link href={mangaProfileHref(c.userId)} onClick={(e) => e.stopPropagation()} className="flex min-w-0 items-center gap-2.5">
      <AvatarImg url={c.avatar} name={c.name} className={`h-10 w-10 text-sm ring-2 ${ring}`} />
      <span className={`truncate font-serif text-[20px] leading-tight sm:text-[22px] ${className}`}>{c.name}</span>
    </Link>
  );
}

function Count({ n, className, unit }: { n: number; className: string; unit: string }) {
  return (
    <p className={`font-serif leading-none ${className}`}>
      <span className="nums text-[40px]">{n}</span>
      <span className={`ml-1 text-[15px] ${unit}`}>ch.</span>
    </p>
  );
}

function Yesterday({ y, className, strong }: { y: Champion; className: string; strong: string }) {
  return (
    <p className={`text-[10.5px] font-medium ${className}`}>
      Hier : <span className={`font-bold ${strong}`}>{y.name}</span> ({y.chapters} ch.)
    </p>
  );
}

function Empty({ className }: { className: string }) {
  return <p className={`text-[13px] ${className}`}>Personne n&apos;a encore lu de chapitre aujourd&apos;hui.</p>;
}

/** Mise en page commune aux variantes "paysage" : texte à gauche, scène torii à droite. */
function SceneLayout({
  today, yesterday, onOpen, bg, scene, eyebrow, name, ring, count, unit, muted, strong,
}: Props & {
  bg: React.CSSProperties; scene: React.ReactNode; eyebrow: string; name: string; ring: string;
  count: string; unit: string; muted: string; strong: string;
}) {
  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={onOpen ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } } : undefined}
      className={`relative overflow-hidden rounded-lg border-2 border-[#111] ${onOpen ? "cursor-pointer" : ""}`}
      style={{ boxShadow: "4px 4px 0 #111", ...bg }}
    >
      <div className="pointer-events-none absolute bottom-0 right-2 h-[150px] w-[190px]">{scene}</div>
      <div className="relative flex min-h-[150px] flex-col justify-between gap-2 p-4 pr-[130px] sm:pr-[200px]">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-[0.25em] ${eyebrow}`}>Champion du jour · 今日の王者</p>
          <div className="mt-2">{today ? <Name c={today} className={name} ring={ring} /> : <Empty className={muted} />}</div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
          {today && <Count n={today.chapters} className={count} unit={unit} />}
          {yesterday && <Yesterday y={yesterday} className={muted} strong={strong} />}
          {onOpen && <span className={`text-[10.5px] font-bold underline underline-offset-2 ${strong}`}>Voir le classement →</span>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Bannière ---------------- */

/** Crépuscule : ciel orange → rose → violet, soleil pâle, torii en silhouette. */
function Crepuscule(p: Props) {
  return (
    <SceneLayout
      {...p}
      bg={{ background: "linear-gradient(180deg, #ff9a4d 0%, #f2546b 55%, #6b3fa0 100%)" }}
      scene={<ToriiScene sun="#ffe7a8" torii="#1a0f24" ground="#1a0f24" />}
      eyebrow="text-[#fff1d6]"
      name="text-white"
      ring="ring-[#fff1d6]"
      count="text-white"
      unit="text-[#ffe7a8]"
      muted="text-white/80"
      strong="text-white"
    />
  );
}

/** Bannière seule (sans chargement), réutilisée par l'aperçu de développement. */
export function MangaChampionBanner(props: Props) {
  return <Crepuscule {...props} />;
}

export default function MangaChampion() {
  const [today, setToday] = useState<Champion | null>(null);
  const [yesterday, setYesterday] = useState<Champion | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showRanking, setShowRanking] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, y] = await Promise.all([championOf(todayISO()), championOf(shiftDateISO(todayISO(), -1))]);
      const ids = [t?.userId, y?.userId].filter(Boolean) as string[];
      const { data: profs } = ids.length
        ? await supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", ids)
        : { data: [] };
      const map = new Map(((profs ?? []) as { id: string; display_name: string; avatar_url: string | null }[]).map((p) => [p.id, p]));
      const full = (c: typeof t): Champion | null =>
        c ? { ...c, name: map.get(c.userId)?.display_name ?? "Membre", avatar: map.get(c.userId)?.avatar_url ?? null } : null;
      setToday(full(t));
      setYesterday(full(y));
      setLoaded(true);
    })();
  }, []);

  if (!loaded || (!today && !yesterday)) return null;
  return (
    <>
      <MangaChampionBanner today={today} yesterday={yesterday} onOpen={() => setShowRanking(true)} />
      <RankingModal open={showRanking} onClose={() => setShowRanking(false)} />
    </>
  );
}
