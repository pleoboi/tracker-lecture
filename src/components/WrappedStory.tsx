"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { toPng } from "html-to-image";
import { Cover } from "./ui";
import type { WrappedStats } from "../lib/wrapped";

const SLIDE_MS = 6200;
const TICK_MS = 50;

export interface WrappedProfile {
  displayName: string;
  avatarUrl: string | null;
}

/** Route une image externe via le proxy same-origin de l'app — nécessaire pour
 *  que le collage de couvertures s'affiche de façon fiable et que l'export PNG
 *  (html-to-image) puisse l'inliner sans être bloqué par le CORS. */
function proxied(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

/* ────────────────────────────────────────────────────────────────────────
   Palette : une tonalité par slide (dégradé + halo + accent).
   ──────────────────────────────────────────────────────────────────────── */
type ToneKey = "violet" | "teal" | "bronze" | "flame" | "plum" | "forest" | "indigo" | "gold" | "finale";

const TONES: Record<ToneKey, { c1: string; c2: string; c3: string; halo: string; accent: string }> = {
  violet: { c1: "#7d6bb8", c2: "#7c3aed", c3: "#372c7a", halo: "rgba(255,255,255,0.4)",   accent: "#e4d9ff" },
  teal:   { c1: "#4e9c98", c2: "#2e615f", c3: "#173836", halo: "rgba(190,255,244,0.35)",  accent: "#a8f2e5" },
  bronze: { c1: "#b48a5c", c2: "#8c6a4a", c3: "#452e1a", halo: "rgba(255,225,180,0.35)",  accent: "#f4d9ac" },
  flame:  { c1: "#e2ab4a", c2: "#c97d41", c3: "#6e3c15", halo: "rgba(255,232,180,0.4)",   accent: "#ffdd9a" },
  plum:   { c1: "#af6ba2", c2: "#8b4a7f", c3: "#3b1733", halo: "rgba(255,220,244,0.32)",  accent: "#f3c3ea" },
  forest: { c1: "#7c8a63", c2: "#5a6448", c3: "#272d1a", halo: "rgba(224,255,196,0.3)",   accent: "#d3e8ab" },
  indigo: { c1: "#6577b8", c2: "#465387", c3: "#1a2140", halo: "rgba(212,222,255,0.35)",  accent: "#c1cbff" },
  gold:   { c1: "#e2ba52", c2: "#c8961a", c3: "#5f470b", halo: "rgba(255,242,195,0.4)",   accent: "#ffe38a" },
  finale: { c1: "#7d6bb8", c2: "#4f46e5", c3: "#191552", halo: "rgba(255,255,255,0.35)",  accent: "#d5c9ff" },
};

function toneBackground(tone: ToneKey): string {
  const t = TONES[tone];
  return [
    `radial-gradient(130% 85% at 12% -8%, ${t.halo} 0%, transparent 55%)`,
    `radial-gradient(90% 70% at 100% 105%, ${t.c3} 0%, transparent 60%)`,
    `linear-gradient(165deg, ${t.c1} 0%, ${t.c2} 55%, ${t.c3} 100%)`,
  ].join(", ");
}

/* ────────────────────────────────────────────────────────────────────────
   Texture de grain — discrète, posée en overlay sur toute la carte.
   ──────────────────────────────────────────────────────────────────────── */
const NOISE_BG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'>" +
  "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter>" +
  "<rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

function NoiseOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] opacity-[0.05] mix-blend-overlay"
      style={{ backgroundImage: NOISE_BG }}
    />
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Grand mot fantôme en fond — signature visuelle façon Wrapped.
   ──────────────────────────────────────────────────────────────────────── */
function GhostWord({ word, corner = "top" }: { word: string; corner?: "top" | "bottom" }) {
  return (
    <p
      aria-hidden
      className="pointer-events-none absolute z-[1] select-none whitespace-nowrap font-serif font-black text-white/[0.08]"
      style={{
        fontSize: "clamp(64px, 26vw, 130px)",
        letterSpacing: "-0.02em",
        lineHeight: 0.8,
        ...(corner === "top"
          ? { top: "6%", left: "-6%", transform: "rotate(-6deg)" }
          : { bottom: "4%", right: "-8%", transform: "rotate(4deg)" }),
      }}
    >
      {word}
    </p>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Halos décoratifs (taches de lumière douces, sans blur coûteux).
   ──────────────────────────────────────────────────────────────────────── */
function GlowSpots({ tone }: { tone: ToneKey }) {
  const t = TONES[tone];
  return (
    <>
      <div
        className="pointer-events-none absolute -right-10 -top-16 z-0 h-56 w-56 rounded-full opacity-60"
        style={{ background: `radial-gradient(circle, ${t.accent}55 0%, transparent 70%)` }}
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-14 z-0 h-64 w-64 rounded-full opacity-50"
        style={{ background: `radial-gradient(circle, ${t.c3}aa 0%, transparent 70%)` }}
      />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Collage de couvertures — habille le fond avec les vrais livres du mois.
   "feature" = très visible (couverture + slide finale), "subtle" = simple
   texture derrière une stat.
   ──────────────────────────────────────────────────────────────────────── */
const COLLAGE_LAYOUT = [
  { top: "1%", left: "-4%", rot: -4, w: 96 },
  { top: "-2%", left: "56%", rot: 3, w: 84 },
  { top: "20%", left: "78%", rot: -3, w: 90 },
  { top: "36%", left: "-10%", rot: 3, w: 104 },
  { top: "56%", left: "68%", rot: 4, w: 88 },
  { top: "62%", left: "18%", rot: -3, w: 96 },
  { top: "80%", left: "46%", rot: 2, w: 80 },
  { top: "10%", left: "30%", rot: -2, w: 76 },
  { top: "44%", left: "38%", rot: 3, w: 74 },
  { top: "84%", left: "-6%", rot: -2, w: 84 },
  { top: "2%", left: "80%", rot: 2, w: 70 },
  { top: "70%", left: "-8%", rot: -2, w: 76 },
];

function CoverCollage({
  covers,
  tone,
  intensity = "subtle",
}: {
  covers: { id: number; title: string; cover_url: string | null }[];
  tone: ToneKey;
  intensity?: "subtle" | "feature";
}) {
  const usable = covers.filter((c) => c.cover_url);
  if (!usable.length) return null;
  const t = TONES[tone];
  const isFeature = intensity === "feature";
  // Peu de livres ce mois-ci ? On répète le motif (façon papier peint) plutôt
  // que de laisser le fond vide — jusqu'à 3x par couverture unique.
  const target = isFeature ? 12 : 10;
  const count = Math.min(target, usable.length * 3);
  const tiles = Array.from({ length: count }, (_, i) => usable[i % usable.length]);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {tiles.map((c, i) => {
        const p = COLLAGE_LAYOUT[i % COLLAGE_LAYOUT.length];
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${c.id}-${i}`}
            src={proxied(c.cover_url)}
            alt=""
            crossOrigin="anonymous"
            style={{
              position: "absolute",
              top: p.top,
              left: p.left,
              width: p.w,
              height: Math.round(p.w * 1.42),
              transform: `rotate(${p.rot}deg)`,
              borderRadius: 8,
              objectFit: "cover",
              opacity: isFeature ? 0.92 : 0.62,
              boxShadow: "0 12px 26px rgba(0,0,0,0.4)",
            }}
          />
        );
      })}
      <div
        className="absolute inset-0"
        style={{
          background: isFeature
            ? `linear-gradient(175deg, ${t.c1}4d 0%, ${t.c2}b3 45%, ${t.c3}f0 100%)`
            : `linear-gradient(175deg, ${t.c1}b3 0%, ${t.c2}cc 50%, ${t.c3}e8 100%)`,
        }}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Avatar de profil — mis en avant à l'ouverture et sur la slide finale.
   ──────────────────────────────────────────────────────────────────────── */
function ProfileAvatar({ profile, size = 72 }: { profile: WrappedProfile; size?: number }) {
  return (
    <div
      className="animate-scaleIn flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-[3px] ring-white/80 shadow-xl"
      style={{ width: size, height: size, background: "rgba(255,255,255,0.18)" }}
    >
      {profile.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={proxied(profile.avatarUrl)} alt={profile.displayName} crossOrigin="anonymous" className="h-full w-full object-cover" />
      ) : (
        <span className="font-serif font-black text-white" style={{ fontSize: size * 0.38 }}>
          {profile.displayName[0]?.toUpperCase() ?? "?"}
        </span>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Icônes vectorielles maison (pas d'emoji) — silhouettes pleines, fiables.
   ──────────────────────────────────────────────────────────────────────── */
export type IconVariant = "sparkle" | "book" | "flame" | "heart" | "compass" | "bolt" | "medal" | "party" | "share";

export function IconGlyph({ variant, accent }: { variant: IconVariant; accent: string }) {
  const common = { width: "100%", height: "100%" } as const;
  switch (variant) {
    case "sparkle":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M12 2 L14 9 L21 12 L14 15 L12 22 L10 15 L3 12 L10 9 Z" fill="#fff" />
          <path d="M19 3 L19.7 5 L21.7 5.7 L19.7 6.4 L19 8.4 L18.3 6.4 L16.3 5.7 L18.3 5 Z" fill={accent} />
        </svg>
      );
    case "book":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M4 5c3-1.4 6-1.4 8 0v14c-2-1.4-5-1.4-8 0V5z" fill="#fff" />
          <path d="M20 5c-3-1.4-6-1.4-8 0v14c2-1.4 5-1.4 8 0V5z" fill={accent} />
        </svg>
      );
    case "flame":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M12 2c4 6 7 9 7 13a7 7 0 1 1-14 0c0-4 3-7 7-13z" fill="#fff" />
          <path d="M12 9c1.8 2.4 3 4 3 6a3 3 0 1 1-6 0c0-2 1.2-3.6 3-6z" fill={accent} />
        </svg>
      );
    case "heart":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M12 21s-7.5-4.6-10-9.3C.5 8 2 4 6 4c2 0 3.5 1.2 4 2.3.5-1.1 2-2.3 4-2.3 4 0 5.5 4 4 7.7C19.5 16.4 12 21 12 21z" fill="#fff" />
          <path d="M12 21s-4.3-2.6-7.2-6.2c1.9 1 4 1 5.2-.4.9 1.4 3.1 1.6 5.1.6C12.4 18.6 12 21 12 21z" fill={accent} opacity="0.85" />
        </svg>
      );
    case "compass":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9" />
          <path d="m16.2 7.8-3.4 5.1-3.4 1.3 1.3-3.4 3.4-5.1z" fill={accent} stroke="none" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M13 2 3 14h7l-2 8 10-12h-7l2-8z" fill="#fff" />
          <path d="M13 2 8.5 11h3.2L10 22l8-11h-4.3L13 2z" fill={accent} opacity="0.5" />
        </svg>
      );
    case "medal":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M8 11 5 20l7-3 7 3-3-9" fill={accent} />
          <circle cx="12" cy="9" r="7" fill="#fff" />
          <path d="M12 5.2l1.4 3 3.2.3-2.4 2.2.7 3.3-2.9-1.7-2.9 1.7.7-3.3-2.4-2.2 3.2-.3z" fill={accent} />
        </svg>
      );
    case "party":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M3 21 9 8l7 7-13 6z" fill="#fff" />
          <path d="M9 8l1.6-4.2c.2-.5.9-.6 1.2-.1L14 7l4.1 1.2c.5.2.5.9 0 1.1L14 11l-2.5 2.8L9 8z" fill={accent} />
          <circle cx="19" cy="4" r="1.1" fill={accent} />
          <circle cx="21" cy="9" r="0.9" fill="#fff" />
        </svg>
      );
    case "share":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="2.4" fill={accent} stroke="none" />
          <circle cx="6" cy="12" r="2.4" fill={accent} stroke="none" />
          <circle cx="18" cy="19" r="2.4" fill={accent} stroke="none" />
          <path d="M8.1 10.8 15.9 6.2M8.1 13.2l7.8 4.6" />
        </svg>
      );
  }
}

function IconBadge({ variant, tone, size = 76 }: { variant: IconVariant; tone: ToneKey; size?: number }) {
  return (
    <div
      className="animate-scaleIn flex shrink-0 items-center justify-center rounded-full border border-white/25 shadow-lg"
      style={{
        width: size,
        height: size,
        background: "rgba(255,255,255,0.14)",
        backdropFilter: "blur(6px)",
        boxShadow: `0 8px 24px -6px ${TONES[tone].c3}bb, inset 0 1px 0 rgba(255,255,255,0.3)`,
      }}
    >
      <div style={{ width: size * 0.5, height: size * 0.5 }}>
        <IconGlyph variant={variant} accent={TONES[tone].accent} />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Compteur animé — les chiffres montent en s'affichant.
   ──────────────────────────────────────────────────────────────────────── */
function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format ? format(display) : display.toLocaleString("fr-FR")}</>;
}

/* ────────────────────────────────────────────────────────────────────────
   Étoiles de notation (SVG, pas de caractères ★).
   ──────────────────────────────────────────────────────────────────────── */
function Stars({ rating, accent }: { rating: number; accent: string }) {
  const rounded = Math.round(rating);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="18" height="18" viewBox="0 0 24 24">
          <path
            d="M12 2l2.9 6.2 6.8.9-5 4.7 1.3 6.8L12 17.3 5.9 20.6l1.3-6.8-5-4.7 6.8-.9L12 2z"
            fill={i < rounded ? accent : "rgba(255,255,255,0.22)"}
          />
        </svg>
      ))}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85 backdrop-blur-sm">
      {children}
    </span>
  );
}

function Delta({ pct }: { pct: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold ${
        pct >= 0 ? "bg-white/18 text-white" : "bg-black/20 text-white/80"
      }`}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" style={{ transform: pct >= 0 ? "none" : "rotate(180deg)" }}>
        <path d="M12 3 20 15H4z" fill="currentColor" />
      </svg>
      {Math.abs(pct)}% vs le mois dernier
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Frise de régularité — grille "contributions" jour par jour.
   ──────────────────────────────────────────────────────────────────────── */
function ReadingHeatmap({ daily, accent }: { daily: { date: string; pages: number }[]; accent: string }) {
  if (!daily.length) return null;
  const max = Math.max(1, ...daily.map((d) => d.pages));
  const firstDow = (new Date(daily[0].date + "T12:00:00").getDay() + 6) % 7; // lundi = 0
  return (
    <div className="grid w-full max-w-[196px] grid-cols-7 gap-[5px]">
      {Array.from({ length: firstDow }).map((_, i) => (
        <div key={`pad-${i}`} />
      ))}
      {daily.map((d) => {
        const t = d.pages > 0 ? 0.28 + 0.72 * Math.min(1, d.pages / max) : 0;
        return (
          <div
            key={d.date}
            className="aspect-square rounded-[3px]"
            style={t > 0 ? { background: accent, opacity: t } : { background: "rgba(255,255,255,0.12)" }}
          />
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Confettis pour le récap final (même recette que la page livre).
   ──────────────────────────────────────────────────────────────────────── */
const CONFETTI_COLORS = ["#ffe38a", "#c9b8ff", "#a8f2e5", "#f3c3ea", "#ffffff"];

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
      {Array.from({ length: 26 }).map((_, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: `${(i * 8.3 + (i % 3) * 11) % 100}%`,
            top: "-16px",
            width: `${5 + (i % 5) * 2}px`,
            height: `${5 + (i % 5) * 2}px`,
            borderRadius: i % 3 === 0 ? "50%" : i % 3 === 1 ? "2px" : "0",
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDuration: `${2.4 + (i % 5) * 0.4}s`,
            animationDelay: `${(i * 0.09) % 1.4}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Petit logo Swena — signature de marque sur la slide finale exportable.
   ──────────────────────────────────────────────────────────────────────── */
function SwenaMark({ size = 18 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 90 70" style={{ height: size, width: "auto" }}>
        <g transform="translate(0,6) scale(0.71)" fill="#fff">
          <path d="M8,68 C2,68 0,64 0,60 C0,52 4,48 12,48 C10,38 16,32 26,32 C24,24 30,18 40,18 C50,18 56,24 58,32 C62,30 70,30 74,36 C82,32 92,38 90,48 C90,56 86,64 78,66 C78,68 76,68 70,68 Z" />
        </g>
      </svg>
      <span className="font-serif font-black tracking-tight text-white" style={{ fontSize: size * 0.8 }}>SWENA</span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Gros chiffre héro. Pas d'ombre portée façon "poster IA" — juste la police
   maison (Fraunces), au même traitement que les StatCard du reste de l'app.
   ──────────────────────────────────────────────────────────────────────── */
function HeroNumber({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-serif font-black leading-[0.9] tracking-tight text-white"
      style={{ fontSize: "clamp(48px, 15vw, 68px)" }}
    >
      {children}
    </p>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

type Slide = {
  tone: ToneKey;
  ghostWord?: { word: string; corner?: "top" | "bottom" };
  collage?: "subtle" | "feature";
  /** La slide gère elle-même son padding interne (carte plein cadre) — le
   *  wrapper générique ne doit pas lui imposer px-8 py-16, sous peine de lui
   *  manger la hauteur et de faire disparaître son bas (vécu sur la finale). */
  fullBleed?: boolean;
  render: () => React.ReactNode;
};

export default function WrappedStory({
  stats,
  profile,
  onClose,
}: {
  stats: WrappedStats;
  profile?: WrappedProfile;
  onClose: () => void;
}) {
  const me: WrappedProfile = profile ?? { displayName: "Toi", avatarUrl: null };
  const firstName = me.displayName.split(" ")[0];

  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [];
    const monthWord = stats.monthLabel.split(" ")[0];

    // ── Couverture ────────────────────────────────────────────────────────
    list.push({
      tone: "violet",
      collage: "feature",
      render: () => (
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="relative">
            <ProfileAvatar profile={me} size={88} />
            <div className="animate-scaleIn absolute -right-2 -top-1" style={{ ["--delay" as string]: "0.2s" }}>
              <div style={{ width: 22, height: 22 }}><IconGlyph variant="sparkle" accent={TONES.violet.accent} /></div>
            </div>
          </div>
          <div className="animate-fadeUp flex flex-col items-center gap-3" style={{ ["--delay" as string]: "0.08s" }}>
            <Eyebrow>Le Wrapped de {firstName}</Eyebrow>
            <h2 className="font-serif text-[40px] font-black leading-[0.95] text-white">{stats.monthLabel}</h2>
            <p className="max-w-[230px] text-[14.5px] leading-snug text-white/80">
              Ton mois de lecture, mis en lumière. Prêt·e à voir ce que tu as accompli ?
            </p>
          </div>
        </div>
      ),
    });

    // ── Pages totales ─────────────────────────────────────────────────────
    list.push({
      tone: "teal",
      ghostWord: { word: "PAGES", corner: "top" },
      collage: "subtle",
      render: () => (
        <div className="flex flex-col items-center gap-4 text-center">
          <IconBadge variant="book" tone="teal" />
          <div className="animate-fadeUp" style={{ ["--delay" as string]: "0.06s" }}><Eyebrow>Pages lues en {monthWord.toLowerCase()}</Eyebrow></div>
          <div className="animate-fadeUp" style={{ ["--delay" as string]: "0.14s" }}>
            <HeroNumber><CountUp value={stats.totalPages} /></HeroNumber>
          </div>
          <div className="animate-fadeUp" style={{ ["--delay" as string]: "0.22s" }}>
            {stats.deltaPct !== null ? <Delta pct={stats.deltaPct} /> : (
              <span className="text-xs text-white/55">Premier mois suivi, bien joué pour le lancement</span>
            )}
          </div>
        </div>
      ),
    });

    // ── Livres terminés ───────────────────────────────────────────────────
    if (stats.booksCompleted.length > 0) {
      const ROTATIONS = [-6, 5, -4];
      list.push({
        tone: "bronze",
        ghostWord: { word: "LIVRES", corner: "bottom" },
        collage: "subtle",
        render: () => (
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="animate-fadeUp flex flex-col items-center gap-2" style={{ ["--delay" as string]: "0.04s" }}>
              <Eyebrow>Livres terminés</Eyebrow>
              <HeroNumber><CountUp value={stats.booksCompleted.length} /></HeroNumber>
            </div>
            <div className="mt-1 flex items-end justify-center">
              {stats.booksCompleted.slice(0, 3).map((b, i) => (
                <div
                  key={b.id}
                  className="animate-scaleIn"
                  style={{
                    transform: `rotate(${ROTATIONS[i % ROTATIONS.length]}deg)`,
                    marginLeft: i === 0 ? 0 : -22,
                    zIndex: 3 - i,
                    ["--delay" as string]: `${0.16 + i * 0.09}s`,
                  }}
                >
                  <Cover id={b.id} title={b.title} coverUrl={b.cover_url} className="h-40 w-28 shadow-2xl ring-1 ring-white/25" rounded="rounded-xl" />
                </div>
              ))}
            </div>
            {stats.booksCompleted.length > 3 && (
              <p className="animate-fadeUp text-[13px] text-white/75" style={{ ["--delay" as string]: "0.4s" }}>
                {stats.booksCompleted[3] && `« ${stats.booksCompleted[3].title} »`}
                {stats.booksCompleted.length > 4 && ` et ${stats.booksCompleted.length - 4} autre${stats.booksCompleted.length - 4 > 1 ? "s" : ""}`}
              </p>
            )}
          </div>
        ),
      });
    }

    // ── Régularité ────────────────────────────────────────────────────────
    list.push({
      tone: "flame",
      ghostWord: { word: "SÉRIE", corner: "top" },
      collage: "subtle",
      render: () => (
        <div className="flex flex-col items-center gap-4 text-center">
          <IconBadge variant="flame" tone="flame" size={64} />
          <div className="animate-fadeUp" style={{ ["--delay" as string]: "0.06s" }}><Eyebrow>Régularité</Eyebrow></div>
          <div className="animate-fadeUp" style={{ ["--delay" as string]: "0.12s" }}>
            <HeroNumber>
              <CountUp value={stats.daysActive} />
              <span className="ml-1.5 text-2xl font-bold text-white/65">/ {stats.daysInMonth} j.</span>
            </HeroNumber>
          </div>
          <div className="animate-fadeUp" style={{ ["--delay" as string]: "0.2s" }}>
            <ReadingHeatmap daily={stats.dailyPages} accent={TONES.flame.accent} />
          </div>
          <div className="animate-fadeUp" style={{ ["--delay" as string]: "0.28s" }}>
            <p className="max-w-[220px] text-[13.5px] text-white/80">
              {stats.longestStreak > 1
                ? <>Ta plus longue série : <span className="font-bold text-white">{stats.longestStreak} jours</span> d&apos;affilée</>
                : "Tu as lu ce mois-ci — continue comme ça"}
            </p>
          </div>
        </div>
      ),
    });

    // ── Coup de cœur ──────────────────────────────────────────────────────
    if (stats.topBook) {
      const b = stats.topBook;
      const isCrush = stats.booksCompleted.some((c) => c.id === b.id);
      list.push({
        tone: "plum",
        collage: "subtle",
        render: () => (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="animate-fadeUp" style={{ ["--delay" as string]: "0.04s" }}>
              <Eyebrow>{isCrush ? "Ton coup de cœur du mois" : "Ta lecture du mois"}</Eyebrow>
            </div>
            <div className="relative animate-scaleIn" style={{ ["--delay" as string]: "0.12s" }}>
              <div
                className="pointer-events-none absolute inset-0 -z-10 rounded-[28px] opacity-70"
                style={{ background: `radial-gradient(60% 60% at 50% 45%, ${TONES.plum.accent}66 0%, transparent 75%)`, transform: "scale(1.6)" }}
              />
              <Cover id={b.id} title={b.title} coverUrl={b.cover_url} className="h-48 w-32 shadow-2xl ring-1 ring-white/25" rounded="rounded-xl" />
              <div className="animate-scaleIn absolute -right-3 -top-3" style={{ ["--delay" as string]: "0.4s" }}>
                <div style={{ width: 26, height: 26 }}><IconGlyph variant="sparkle" accent={TONES.plum.accent} /></div>
              </div>
            </div>
            <div className="animate-fadeUp flex flex-col items-center gap-2" style={{ ["--delay" as string]: "0.24s" }}>
              <p className="max-w-[240px] font-serif text-[21px] font-bold leading-tight text-white">{b.title}</p>
              <p className="text-[13px] text-white/70">{b.author}</p>
              {!!b.rating && <Stars rating={b.rating} accent={TONES.plum.accent} />}
            </div>
          </div>
        ),
      });
    }

    // ── Genres du mois ────────────────────────────────────────────────────
    if (stats.topGenres.length > 0) {
      list.push({
        tone: "forest",
        ghostWord: { word: "GENRE", corner: "bottom" },
        collage: "subtle",
        render: () => (
          <div className="flex flex-col items-center gap-5 text-center">
            <IconBadge variant="compass" tone="forest" />
            <div className="animate-fadeUp flex flex-col items-center gap-2" style={{ ["--delay" as string]: "0.06s" }}>
              <Eyebrow>Genres du mois</Eyebrow>
              <p className="font-serif text-[32px] font-black leading-[1.02] text-white">{stats.topGenres[0].genre}</p>
            </div>
            <div className="animate-fadeUp flex w-full max-w-[230px] flex-col gap-2.5" style={{ ["--delay" as string]: "0.2s" }}>
              {stats.topGenres.map((g, i) => {
                const pct = stats.totalPages > 0 ? Math.round((g.pages / stats.totalPages) * 100) : 0;
                return (
                  <div key={g.genre} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11.5px] text-white/80">
                      <span className="font-semibold">{g.genre}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-[6px] w-full overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: i === 0 ? TONES.forest.accent : "rgba(255,255,255,0.55)" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ),
      });
    }

    // ── Record du jour ────────────────────────────────────────────────────
    if (stats.bestDay) {
      list.push({
        tone: "indigo",
        ghostWord: { word: "RECORD", corner: "top" },
        collage: "subtle",
        render: () => (
          <div className="flex flex-col items-center gap-4 text-center">
            <IconBadge variant="bolt" tone="indigo" />
            <div className="animate-fadeUp" style={{ ["--delay" as string]: "0.06s" }}><Eyebrow>Ton record du mois</Eyebrow></div>
            <div className="animate-fadeUp" style={{ ["--delay" as string]: "0.14s" }}>
              <HeroNumber>
                <CountUp value={stats.bestDay!.pages} />
                <span className="ml-1.5 text-2xl font-bold text-white/65">pages</span>
              </HeroNumber>
            </div>
            <div className="animate-fadeUp" style={{ ["--delay" as string]: "0.22s" }}>
              <p className="text-[14px] capitalize text-white/75">le {formatDate(stats.bestDay!.date)}</p>
            </div>
          </div>
        ),
      });
    }

    // ── Classement ────────────────────────────────────────────────────────
    if (stats.rankPercentile !== null && stats.activeReadersCount) {
      const rankPercentile = stats.rankPercentile;
      const activeReadersCount = stats.activeReadersCount;
      list.push({
        tone: "gold",
        ghostWord: { word: "TOP", corner: "bottom" },
        collage: "subtle",
        render: () => (
          <div className="flex flex-col items-center gap-4 text-center">
            <IconBadge variant="medal" tone="gold" />
            <div className="animate-fadeUp" style={{ ["--delay" as string]: "0.06s" }}><Eyebrow>Classement Swena</Eyebrow></div>
            <div className="animate-fadeUp" style={{ ["--delay" as string]: "0.14s" }}>
              <p className="font-serif text-[52px] font-black leading-none tracking-tight text-white">
                Top {Math.max(1, 100 - rankPercentile)}%
              </p>
            </div>
            <div className="animate-fadeUp" style={{ ["--delay" as string]: "0.22s" }}>
              <p className="max-w-[240px] text-[14px] text-white/80">
                Tu as lu plus que <span className="font-bold text-white">{rankPercentile}%</span> des {activeReadersCount} lecteurs actifs ce mois-ci.
              </p>
            </div>
          </div>
        ),
      });
    }

    // ── Récap final : carte exportable façon Spotify Wrapped ─────────────
    // Une image héro nette (pas un collage éparpillé), puis une carte
    // structurée à deux colonnes (stats / livres), un gros chiffre en pied
    // de page et la marque — inspiré du format "trading card" de Spotify.
    list.push({
      tone: "finale",
      collage: "feature",
      fullBleed: true,
      render: () => {
        const heroBook = stats.topBook ?? stats.booksCompleted[0] ?? null;
        const listBooks = stats.booksCompleted.slice(0, 4);
        return (
          // Flux naturel en interne (l'image suit l'en-tête, la carte suit l'image) —
          // c'est le wrapper parent qui centre ce bloc entier au milieu de l'espace
          // disponible, exactement comme sur toutes les autres slides.
          <div className="flex w-full flex-col px-6">
            {/* En-tête : bien visible, pas juste une ligne discrète */}
            <div className="animate-fadeUp flex items-center justify-between" style={{ ["--delay" as string]: "0.02s" }}>
              <SwenaMark size={22} />
              <span className="font-serif text-[15px] font-bold text-white">{stats.monthLabel}</span>
            </div>

            {/* Image héro : le livre du mois, seul, net et bien plus grand */}
            <div className="animate-scaleIn my-5 flex items-center justify-center" style={{ ["--delay" as string]: "0.08s" }}>
              {heroBook ? (
                <div className="relative">
                  <div
                    className="pointer-events-none absolute inset-0 -z-10 rounded-[32px] opacity-70"
                    style={{ background: `radial-gradient(60% 60% at 50% 45%, ${TONES.finale.accent}55 0%, transparent 75%)`, transform: "scale(1.7)" }}
                  />
                  <Cover id={heroBook.id} title={heroBook.title} coverUrl={heroBook.cover_url} className="h-60 w-[168px] shadow-2xl ring-1 ring-white/25" rounded="rounded-xl" />
                </div>
              ) : (
                <ProfileAvatar profile={me} size={96} />
              )}
            </div>

            {/* Carte structurée : fond propre pour rester lisible par-dessus le collage */}
            <div className="animate-fadeUp flex flex-col gap-3 rounded-2xl border border-white/15 bg-black/30 px-4 py-3.5 backdrop-blur-md" style={{ ["--delay" as string]: "0.18s" }}>
              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="flex flex-col gap-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/45">Ce mois-ci</p>
                  {[
                    { label: "Livres", value: stats.booksCompleted.length },
                    { label: "Sessions", value: stats.sessionsCount },
                    { label: "Jours actifs", value: stats.daysActive },
                  ].map((s) => (
                    <div key={s.label} className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] text-white/70">{s.label}</span>
                      <span className="font-serif text-[15px] font-bold text-white">{s.value}</span>
                    </div>
                  ))}
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/45">Tes livres</p>
                  {listBooks.length > 0 ? (
                    listBooks.map((b, i) => (
                      <p key={b.id} className="truncate text-[11px] text-white/85">
                        <span className="text-white/40">{i + 1}</span> {b.title}
                      </p>
                    ))
                  ) : (
                    <p className="text-[11px] text-white/50">—</p>
                  )}
                </div>
              </div>

              <div className="flex items-end justify-between border-t border-white/10 pt-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white/45">Pages lues</p>
                  <p className="font-serif text-[28px] font-black leading-none text-white">{stats.totalPages.toLocaleString("fr-FR")}</p>
                </div>
                {stats.topGenre && (
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/45">Genre</p>
                    <p className="text-[13px] font-bold text-white">{stats.topGenre}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      },
    });

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, me.displayName, me.avatarUrl]);

  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0); // 0..1 de la slide courante
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);

  const isLast = index === slides.length - 1;

  const goTo = (i: number) => {
    if (i < 0) return;
    if (i >= slides.length) { onClose(); return; }
    setIndex(i);
    setProgress(0);
  };

  useEffect(() => {
    if (isLast) return; // la dernière slide attend une fermeture manuelle
    const interval = setInterval(() => {
      if (pausedRef.current) return;
      setProgress((p) => {
        const next = p + TICK_MS / SLIDE_MS;
        if (next >= 1) {
          goTo(index + 1);
          return 0;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, isLast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goTo(index + 1);
      if (e.key === "ArrowLeft") goTo(index - 1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const sharePoster = async () => {
    const node = posterRef.current;
    if (!node || exportBusy) return;
    setExportBusy(true);
    setExportError(null);
    try {
      await (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
      const dataUrl = await toPng(node, { pixelRatio: 2.5, cacheBust: true });
      const filename = `swena-wrapped-${stats.year}-${String(stats.month).padStart(2, "0")}.png`;

      const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
      if (nav.share && nav.canShare) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], filename, { type: "image/png" });
        if (nav.canShare({ files: [file] })) {
          try {
            await nav.share({ files: [file], title: `Mon Wrapped Swena — ${stats.monthLabel}` });
            setExportBusy(false);
            return;
          } catch {
            // partage annulé par l'utilisateur → on retombe sur le téléchargement
          }
        }
      }
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();
    } catch {
      setExportError("Export impossible, réessaie.");
      setTimeout(() => setExportError(null), 3000);
    } finally {
      setExportBusy(false);
    }
  };

  const slide = slides[index];

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black p-0 sm:p-6">
      <div
        className="relative h-[100dvh] w-full max-w-[420px] overflow-hidden border border-white/10 sm:h-[92dvh] sm:rounded-[28px] sm:shadow-2xl"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
      >
        {/* Surface exportable : uniquement ce qui doit apparaître dans l'image
            partagée (fond, collage, contenu) — jamais les contrôles de la story. */}
        <div
          ref={isLast ? posterRef : undefined}
          className="absolute inset-0"
          style={{ background: toneBackground(slide.tone), transition: "background 500ms ease" }}
        >
          {slide.collage && <CoverCollage key={`collage-${index}`} covers={stats.coverPool} tone={slide.tone} intensity={slide.collage} />}
          <GlowSpots key={`glow-${index}`} tone={slide.tone} />
          {slide.ghostWord && <GhostWord key={`ghost-${index}`} word={slide.ghostWord.word} corner={slide.ghostWord.corner} />}
          <NoiseOverlay />
          {isLast && <Confetti key={`confetti-${index}`} />}

          <div
            key={index}
            className={
              slide.fullBleed
                // Même principe que les autres slides (centré au milieu de l'espace
                // disponible) — mais avec un padding-bottom qui réserve la place des
                // boutons Partager/Fermer, pour que le centrage ne les chevauche pas.
                // overflow-y-auto reste un filet de sécurité sur les petits écrans.
                ? "absolute inset-0 z-[2] flex flex-col justify-center overflow-y-auto"
                : "relative z-[2] flex h-full items-center justify-center px-8 py-16"
            }
            style={slide.fullBleed ? { paddingTop: 24, paddingBottom: 140 } : undefined}
          >
            {slide.render()}
          </div>
        </div>

        {/* ── Chrome interactif de la story — jamais capturé dans l'export ── */}

        {/* Barres de progression */}
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1.5 px-3 pt-3" style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}>
          {slides.map((_, i) => (
            <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width: `${i < index ? 100 : i === index ? progress * 100 : 0}%`,
                  transition: i === index ? "none" : "width 200ms",
                  boxShadow: i === index ? "0 0 8px rgba(255,255,255,0.7)" : "none",
                }}
              />
            </div>
          ))}
        </div>

        {/* Fermer */}
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm text-white backdrop-blur-sm"
          style={{ top: "max(env(safe-area-inset-top), 0.75rem)", marginTop: "1.1rem" }}
        >
          ✕
        </button>

        {/* Zones de tap gauche/droite */}
        <button
          aria-label="Précédent"
          className="absolute inset-y-0 left-0 z-10 w-1/3"
          onClick={() => goTo(index - 1)}
        />
        <button
          aria-label={isLast ? "Fermer" : "Suivant"}
          className="absolute inset-y-0 right-0 z-10 w-2/3"
          onClick={() => (isLast ? undefined : goTo(index + 1))}
        />

        {isLast && (
          <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 px-6 pb-8">
            {exportError && <p className="text-center text-[12px] font-medium text-white/85">{exportError}</p>}
            <button
              onClick={sharePoster}
              disabled={exportBusy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/18 py-3.5 text-[14px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/25 disabled:opacity-60"
            >
              <div style={{ width: 16, height: 16 }}><IconGlyph variant="share" accent={TONES.finale.accent} /></div>
              {exportBusy ? "Préparation…" : "Partager mon Wrapped"}
            </button>
            <button onClick={onClose} className="w-full rounded-2xl py-2 text-[13px] font-medium text-white/60">
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
