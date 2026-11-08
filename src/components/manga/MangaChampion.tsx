"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { todayISO, shiftDateISO } from "../../lib/books";
import { AvatarImg } from "../ui";

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

type Props = { today: Champion | null; yesterday: Champion | null };

function Name({ c, className, ring }: { c: Champion; className: string; ring: string }) {
  return (
    <Link href={`/membre/${c.userId}`} className="flex min-w-0 items-center gap-2.5">
      <AvatarImg url={c.avatar} name={c.name} className={`h-10 w-10 text-sm ring-2 ${ring}`} />
      <span className={`truncate font-serif text-[22px] leading-tight ${className}`}>{c.name}</span>
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
  today, yesterday, bg, scene, eyebrow, name, ring, count, unit, muted, strong,
}: Props & {
  bg: React.CSSProperties; scene: React.ReactNode; eyebrow: string; name: string; ring: string;
  count: string; unit: string; muted: string; strong: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border-2 border-[#111]" style={{ boxShadow: "4px 4px 0 #111", ...bg }}>
      <div className="pointer-events-none absolute bottom-0 right-2 h-[150px] w-[190px]">{scene}</div>
      <div className="relative flex min-h-[150px] flex-col justify-between gap-2 p-4 pr-[170px] sm:pr-[200px]">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-[0.25em] ${eyebrow}`}>Champion du jour · 今日の王者</p>
          <div className="mt-2">{today ? <Name c={today} className={name} ring={ring} /> : <Empty className={muted} />}</div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
          {today && <Count n={today.chapters} className={count} unit={unit} />}
          {yesterday && <Yesterday y={yesterday} className={muted} strong={strong} />}
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
  return <MangaChampionBanner today={today} yesterday={yesterday} />;
}
