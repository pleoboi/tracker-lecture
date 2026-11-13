"use client";

import { AvatarImg } from "./ui";

export type ChampionData = { name: string; avatar?: string | null; pages: number };
type Props = { champion: ChampionData; yesterday: ChampionData | null; onOpen?: () => void };

function Shell({ onOpen, className, style, children }: { onOpen?: () => void; className: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      className={`relative overflow-hidden ${onOpen ? "cursor-pointer" : ""} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Proposition A : "Veilleuse" - lecture du soir sous une lampe        */
/* ------------------------------------------------------------------ */

export function ChampionLamp({ champion, yesterday, onOpen }: Props) {
  return (
    <Shell onOpen={onOpen} className="rounded-2xl shadow-md" style={{ background: "linear-gradient(160deg, #1d1a38 0%, #2f2766 60%, #4a3a86 100%)" }}>
      {/* Etoiles */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        {[[12, 18], [30, 60], [48, 14], [62, 40], [78, 22], [90, 55], [22, 80], [70, 78]].map(([x, y], i) => (
          <circle key={i} cx={`${x}%`} cy={`${y}%`} r={i % 3 === 0 ? 1.6 : 1} fill="#fff" opacity={0.35 + (i % 3) * 0.15} />
        ))}
      </svg>
      {/* Lampe, cone de lumiere et livre ouvert */}
      <svg viewBox="0 0 150 130" className="pointer-events-none absolute bottom-0 right-1 h-[130px] w-[150px]" aria-hidden>
        <defs>
          <linearGradient id="lampCone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe9a8" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffe9a8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M58 30 L18 112 L122 112 L82 30 Z" fill="url(#lampCone)" />
        <path d="M70 12 L70 30" stroke="#c9b6ff" strokeWidth="2" />
        <path d="M54 32 Q70 6 86 32 Z" fill="#f4c95d" />
        <ellipse cx="70" cy="32" rx="16" ry="3" fill="#ffe9a8" />
        <path d="M30 116 L70 106 L110 116 L110 122 L70 114 L30 122 Z" fill="#f7f2ea" />
        <path d="M70 106 L70 114" stroke="#9b89cf" strokeWidth="1.2" />
        <rect x="20" y="122" width="100" height="8" rx="2" fill="#17142e" />
      </svg>
      <div className="relative flex min-h-[132px] flex-col justify-between gap-2 p-4 pr-[140px]">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ffe9a8]/80">Champion du jour</p>
          <p className="mt-1 truncate font-serif text-[22px] font-black leading-tight text-white">{champion.name}</p>
        </div>
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
          <p className="font-serif leading-none text-[#ffe9a8]">
            <span className="text-[38px] font-black">{champion.pages}</span>
            <span className="ml-1 text-[13px] text-white/70">pages ce soir</span>
          </p>
          {yesterday && (
            <p className="text-[10.5px] text-white/55">
              Hier : <span className="font-semibold text-white/80">{yesterday.name}</span>
            </p>
          )}
        </div>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Proposition B : "Medaillon" - avatar couronne de lauriers           */
/* ------------------------------------------------------------------ */

function Laurel({ flip }: { flip?: boolean }) {
  return (
    <g transform={flip ? "translate(100 0) scale(-1 1)" : undefined} fill="var(--color-gold)">
      {Array.from({ length: 7 }).map((_, i) => {
        const a = (200 + i * 20) * (Math.PI / 180);
        const x = 50 + 43 * Math.cos(a);
        const y = 50 - 43 * Math.sin(a);
        return <ellipse key={i} cx={x} cy={y} rx="3.2" ry="7" transform={`rotate(${200 + i * 20 + 90} ${x} ${y})`} opacity={0.55 + i * 0.06} />;
      })}
    </g>
  );
}

export function ChampionMedal({ champion, yesterday, onOpen }: Props) {
  return (
    <Shell onOpen={onOpen} className="rounded-2xl border border-line bg-card shadow-sm">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[color:var(--color-gold)] to-transparent" />
      <div className="flex items-center gap-4 p-4">
        <div className="relative h-[84px] w-[84px] shrink-0">
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
            <Laurel />
            <Laurel flip />
          </svg>
          <div className="absolute inset-[15px] overflow-hidden rounded-full ring-2 ring-[color:var(--color-gold)]">
            <AvatarImg url={champion.avatar} name={champion.name} className="h-full w-full text-2xl font-bold" />
          </div>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[color:var(--color-gold)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#3a2a05]">
            N°1
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--color-gold)]">Champion du jour</p>
          <p className="truncate font-serif text-[22px] font-black leading-tight text-ink">{champion.name}</p>
          <p className="mt-0.5 font-serif leading-none text-violet-deep">
            <span className="text-[30px] font-black">{champion.pages}</span>
            <span className="ml-1 text-[13px] text-muted">pages lues</span>
          </p>
          {yesterday && (
            <p className="mt-1 text-[10.5px] text-muted">
              Hier : <span className="font-semibold text-ink-2">{yesterday.name}</span> · {yesterday.pages} p.
            </p>
          )}
        </div>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Proposition C : "Pile de livres" - la hauteur de la pile = les pages */
/* ------------------------------------------------------------------ */

const SPINES = ["#8b79be", "#5b6ba8", "#9b5c8f", "#4e8c8a", "#c15f88", "#d7a33f"];
const PAGES_PER_BOOK = 50;

export function ChampionStack({ champion, yesterday, onOpen }: Props) {
  const books = Math.max(1, Math.min(6, Math.round(champion.pages / PAGES_PER_BOOK)));
  const h = 15;
  return (
    <Shell onOpen={onOpen} className="rounded-2xl shadow-md" style={{ background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 55%, #4f46e5 100%)" }}>
      <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
      <svg viewBox="0 0 130 140" className="pointer-events-none absolute bottom-0 right-2 h-[140px] w-[130px]" aria-hidden>
        <rect x="10" y="130" width="110" height="6" rx="3" fill="#000" opacity="0.25" />
        {Array.from({ length: books }).map((_, i) => {
          const w = 84 - (i % 3) * 10;
          const x = 65 - w / 2 + ((i * 7) % 12) - 6;
          const y = 128 - (i + 1) * h;
          return (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h - 1.5} rx="2" fill={SPINES[i % SPINES.length]} />
              <rect x={x + 8} y={y + 4} width={w * 0.35} height="2" rx="1" fill="#fff" opacity="0.7" />
              <rect x={x + w - 10} y={y} width="3" height={h - 1.5} fill="#000" opacity="0.12" />
            </g>
          );
        })}
        {/* Etoile au sommet */}
        <path
          transform={`translate(65 ${128 - books * h - 12})`}
          d="M0 -9 L2.6 -2.8 L9.3 -2.8 L3.9 1.4 L6 8 L0 4 L-6 8 L-3.9 1.4 L-9.3 -2.8 L-2.6 -2.8 Z"
          fill="#fde68a"
        />
      </svg>
      <div className="relative flex min-h-[140px] flex-col justify-between gap-2 p-4 pr-[140px]">
        <div className="flex min-w-0 items-center gap-2.5">
          <AvatarImg url={champion.avatar} name={champion.name} className="h-10 w-10 shrink-0 text-base ring-2 ring-white/60" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60">Champion du jour</p>
            <p className="truncate font-serif text-[20px] font-black leading-tight text-yellow-200">{champion.name}</p>
          </div>
        </div>
        <div>
          <p className="font-serif leading-none text-white">
            <span className="text-[38px] font-black">{champion.pages}</span>
            <span className="ml-1 text-[13px] text-white/70">pages</span>
          </p>
          <p className="mt-1 text-[10px] text-white/50">
            1 livre empile = {PAGES_PER_BOOK} pages{yesterday ? ` · Hier : ${yesterday.name}` : ""}
          </p>
        </div>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Proposition D : "Hiver" - epure, flocons qui tombent en continu      */
/* ------------------------------------------------------------------ */

const FLAKES = Array.from({ length: 42 }).map((_, i) => ({
  left: (i * 37 + 11) % 100, // % de la largeur, reparti sans hasard (pas de souci d'hydratation)
  size: 3 + ((i * 5) % 5), // 3 a 7 px
  dur: 7 + ((i * 3) % 7), // 7 a 13 s
  delay: -((i * 29) % 13), // negatif : la neige tombe deja a l'affichage
  drift: ((i % 2 ? 1 : -1) * (8 + ((i * 7) % 18))),
  opacity: 0.6 + ((i * 11) % 5) * 0.1,
  star: i % 6 === 0,
}));

const SNOW_CSS = `
@keyframes swena-snowfall {
  0% { transform: translate3d(0, -14px, 0); opacity: 0; }
  12% { opacity: var(--snow-o, 0.8); }
  88% { opacity: var(--snow-o, 0.8); }
  100% { transform: translate3d(var(--snow-drift, 14px), 200px, 0); opacity: 0; }
}
.swena-snowflake { position: absolute; top: 0; display: block; animation: swena-snowfall var(--snow-d, 8s) linear var(--snow-delay, 0s) infinite; }
@media (prefers-reduced-motion: reduce) { .swena-snowflake { animation: none; top: 35%; opacity: 0.5; } }
`;

export function Snowfall({ color = "#ffffff" }: { color?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <style>{SNOW_CSS}</style>
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className="swena-snowflake"
          style={
            {
              left: `${f.left}%`,
              width: f.star ? f.size * 3 : f.size,
              height: f.star ? f.size * 3 : f.size,
              "--snow-d": `${f.dur}s`,
              "--snow-delay": `${f.delay}s`,
              "--snow-drift": `${f.drift}px`,
              "--snow-o": f.opacity,
            } as React.CSSProperties
          }
        >
          {f.star ? (
            <svg viewBox="0 0 24 24" className="h-full w-full" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round">
              <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" />
            </svg>
          ) : (
            <span className="block h-full w-full rounded-full" style={{ background: color }} />
          )}
        </span>
      ))}
    </div>
  );
}

export function ChampionWinter({ champion, yesterday, onOpen }: Props) {
  return (
    <Shell onOpen={onOpen} className="rounded-2xl shadow-md" style={{ background: "linear-gradient(180deg, #16243f 0%, #22365c 70%, #2d4673 100%)" }}>
      <Snowfall />
      {/* Crete enneigee, tres discrete, en bas */}
      <svg viewBox="0 0 400 30" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-[26px] w-full" aria-hidden>
        <path d="M0 30 V16 Q60 4 130 14 T270 10 T400 14 V30 Z" fill="#eaf2ff" opacity="0.92" />
      </svg>
      <div className="relative flex flex-col gap-3 px-5 pb-9 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b9d0f5]">Champion du jour</p>
        <div className="flex items-end justify-between gap-4">
          <p className="min-w-0 truncate font-serif text-[26px] font-black leading-none text-white">{champion.name}</p>
          <p className="shrink-0 font-serif leading-none text-white">
            <span className="text-[34px] font-black">{champion.pages}</span>
            <span className="ml-1 text-[12px] font-medium text-[#b9d0f5]">pages</span>
          </p>
        </div>
        {yesterday && (
          <p className="text-[10.5px] text-[#b9d0f5]/80">
            Hier : <span className="font-semibold text-[#dbe8ff]">{yesterday.name}</span>
          </p>
        )}
      </div>
    </Shell>
  );
}
