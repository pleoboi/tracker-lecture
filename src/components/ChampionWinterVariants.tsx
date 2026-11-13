"use client";

import { Snowfall, type ChampionData } from "./ChampionProposals";

type Props = { champion: ChampionData; yesterday: ChampionData | null; onOpen?: () => void };

const EXTRA_CSS = `
@keyframes swena-twinkle { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
@keyframes swena-aurora { 0% { transform: translateX(-8%) skewX(-8deg); opacity: 0.55; } 50% { transform: translateX(8%) skewX(8deg); opacity: 0.9; } 100% { transform: translateX(-8%) skewX(-8deg); opacity: 0.55; } }
.swena-twinkle { animation: swena-twinkle 1.8s ease-in-out infinite; }
.swena-aurora { animation: swena-aurora 9s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .swena-twinkle, .swena-aurora { animation: none; } }
`;

function Shell({ onOpen, className, style, children }: { onOpen?: () => void; className: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      className={`relative overflow-hidden ${onOpen ? "cursor-pointer" : ""} ${className}`}
      style={style}
    >
      <style>{EXTRA_CSS}</style>
      {children}
    </div>
  );
}

type Palette = { eyebrow: string; name: string; pages: string; muted: string; strong: string };

function Content({ champion, yesterday, p, label = "Champion du jour", note }: { champion: ChampionData; yesterday: ChampionData | null; p: Palette; label?: string; note?: string }) {
  return (
    <div className="relative flex flex-col gap-3 px-5 pb-9 pt-5">
      <p className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${p.eyebrow}`}>{label}</p>
      <div className="flex items-end justify-between gap-4">
        <p className={`min-w-0 truncate font-serif text-[26px] font-black leading-none ${p.name}`}>{champion.name}</p>
        <p className={`shrink-0 font-serif leading-none ${p.pages}`}>
          <span className="text-[34px] font-black">{champion.pages}</span>
          <span className={`ml-1 text-[12px] font-medium ${p.muted}`}>pages</span>
        </p>
      </div>
      {note ? (
        <p className={`text-[10.5px] ${p.muted}`}>{note}</p>
      ) : yesterday && (
        <p className={`text-[10.5px] ${p.muted}`}>
          Hier : <span className={`font-semibold ${p.strong}`}>{yesterday.name}</span>
        </p>
      )}
    </div>
  );
}

function Fir({ x, h, fill }: { x: number; h: number; fill: string }) {
  const w = h * 0.55;
  const d = `M0 ${-h} L${w * 0.5} ${-h * 0.55} L${w * 0.28} ${-h * 0.55} L${w * 0.62} ${-h * 0.22} L${w * 0.36} ${-h * 0.22} L${w * 0.75} 0 L${-w * 0.75} 0 L${-w * 0.36} ${-h * 0.22} L${-w * 0.62} ${-h * 0.22} L${-w * 0.28} ${-h * 0.55} L${-w * 0.5} ${-h * 0.55} Z`;
  return (
    <g transform={`translate(${x} 0)`} fill={fill}>
      <path d={d} />
    </g>
  );
}

function SnowGround({ fill, h = 24 }: { fill: string; h?: number }) {
  return (
    <svg viewBox="0 0 400 40" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 w-full" style={{ height: h }} aria-hidden>
      <path d="M0 40 V22 Q70 6 150 20 T290 14 T400 20 V40 Z" fill={fill} opacity="0.95" />
    </svg>
  );
}

/* Aurore boreale : nuit polaire, rubans de lumiere qui ondulent doucement */
export function ChampionAurora({ champion, yesterday, onOpen }: Props) {
  return (
    <Shell onOpen={onOpen} className="rounded-2xl shadow-md" style={{ background: "linear-gradient(180deg, #0b1630 0%, #14284d 100%)" }}>
      <div
        className="swena-aurora pointer-events-none absolute -inset-x-10 top-0 h-24 blur-2xl"
        style={{ background: "linear-gradient(90deg, transparent 5%, #3ddc97 30%, #4fb3ff 55%, #b28dff 80%, transparent 100%)" }}
      />
      <Snowfall />
      <SnowGround fill="#e6f1ff" h={28} />
      <Content champion={champion} yesterday={yesterday} p={{ eyebrow: "text-[#9fe8c8]", name: "text-white", pages: "text-white", muted: "text-[#a9c4ec]", strong: "text-[#dbe8ff]" }} />
    </Shell>
  );
}

/* Noel : vert sapin, guirlande lumineuse, sapins enneiges */
export function ChampionChristmas({ champion, yesterday, onOpen }: Props) {
  const bulbs = ["#ff5a5f", "#ffd166", "#6ee7b7", "#7cc4ff"];
  return (
    <Shell onOpen={onOpen} className="rounded-2xl shadow-md" style={{ background: "linear-gradient(180deg, #0f2d24 0%, #164232 100%)" }}>
      <Snowfall />
      <svg viewBox="0 0 400 26" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-0 h-[26px] w-full" aria-hidden>
        <path d="M0 4 Q50 22 100 6 T200 6 T300 6 T400 4" fill="none" stroke="#0a1f19" strokeWidth="1.6" />
      </svg>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[26px]" aria-hidden>
        {Array.from({ length: 9 }).map((_, i) => (
          <span
            key={i}
            className="swena-twinkle absolute h-2 w-2 rounded-full"
            style={{
              left: `${6 + i * 11.5}%`,
              top: i % 2 ? 11 : 6,
              background: bulbs[i % bulbs.length],
              boxShadow: `0 0 8px 1px ${bulbs[i % bulbs.length]}`,
              animationDelay: `${(i * 0.37) % 1.8}s`,
            }}
          />
        ))}
      </div>
      <svg viewBox="0 0 400 60" preserveAspectRatio="xMaxYMax meet" className="pointer-events-none absolute bottom-0 right-0 h-[60px] w-[200px]" aria-hidden>
        <g transform="translate(0 60)">
          <Fir x={250} h={44} fill="#0b2219" />
          <Fir x={300} h={56} fill="#0d281d" />
          <Fir x={355} h={38} fill="#0b2219" />
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[8px] bg-[#f3f8f5]" />
      <Content champion={champion} yesterday={yesterday} p={{ eyebrow: "text-[#ffd166]", name: "text-white", pages: "text-[#ffd166]", muted: "text-[#a8cdbd]", strong: "text-[#e6f4ec]" }} />
    </Shell>
  );
}

/* Rouge de Noel : velours rouge, ruban dore, neige */
export function ChampionRibbon({ champion, yesterday, onOpen }: Props) {
  return (
    <Shell onOpen={onOpen} className="rounded-2xl shadow-md" style={{ background: "linear-gradient(135deg, #8f1d2c 0%, #b3283a 55%, #7a1624 100%)" }}>
      <Snowfall />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-2.5 bg-gradient-to-b from-[#e8c36a] via-[#fbe7a1] to-[#e8c36a] opacity-90" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[8px] bg-[#fff4f0]/90" />
      <Content champion={champion} yesterday={yesterday} p={{ eyebrow: "text-[#fbe7a1]", name: "text-white", pages: "text-white", muted: "text-[#f3c4ca]", strong: "text-[#ffe9ec]" }} />
    </Shell>
  );
}

/* Givre : version claire et douce (jour d'hiver), neige bleutee */
export function ChampionFrost({ champion, yesterday, onOpen, label, note }: Props & { label?: string; note?: string }) {
  return (
    <Shell onOpen={onOpen} className="rounded-2xl border border-[#d5e4f7] shadow-sm" style={{ background: "linear-gradient(180deg, #f4f9ff 0%, #dbe9fb 100%)" }}>
      <Snowfall color="#8fb4e6" />
      <SnowGround fill="#ffffff" h={22} />
      <Content champion={champion} yesterday={yesterday} label={label} note={note} p={{ eyebrow: "text-[#4a76b8]", name: "text-[#17325c]", pages: "text-[#17325c]", muted: "text-[#5f7fa8]", strong: "text-[#17325c]" }} />
    </Shell>
  );
}
