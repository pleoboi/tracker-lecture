"use client";

import React from "react";
import { TIER_META, type BadgeDef, type BadgeTier } from "../lib/badges";

/*
 * Marque-pages illustrés : chaque badge est un vrai marque-page, avec
 *  - une forme (ruban en queue d'aronde, arche, fanion, cuir surpiqué, pince métal, gland),
 *  - une matière de couleur propre à la famille (bordeaux, marine, forêt…),
 *  - un emblème dessiné en dorure (un motif par badge),
 *  - un palier rendu par la matière de la dorure : bronze, argent, or, platine (+ pastilles).
 */

type Shape = "ribbon" | "arch" | "pennant" | "leather" | "clip" | "tassel";

const BODY: Record<string, [string, string]> = {
  burgundy: ["#8a2a43", "#4d1426"],
  navy: ["#27467d", "#12254a"],
  forest: ["#23654b", "#0f3627"],
  plum: ["#6a3490", "#391a50"],
  teal: ["#177579", "#0b4144"],
  charcoal: ["#434958", "#20242d"],
  terracotta: ["#b0532f", "#6a2c1b"],
  brown: ["#76502b", "#3f2913"],
  rose: ["#b03d66", "#62213c"],
  indigo: ["#434496", "#222360"],
  midnight: ["#1b2b4d", "#0b1329"],
  slate: ["#4a6070", "#25333d"],
  moss: ["#5d7332", "#2f3d16"],
  wine: ["#5e1f3a", "#2f0f1d"],
};

const FOIL: Record<BadgeTier, { a: string; b: string; hi: string; trim: string }> = {
  1: { a: "#e8a468", b: "#b8692f", hi: "#ffd9b0", trim: "#c07a3d" },
  2: { a: "#eef2f8", b: "#a9b4c6", hi: "#ffffff", trim: "#bcc6d6" },
  3: { a: "#f6d56e", b: "#c8961a", hi: "#fff4c2", trim: "#d9a92a" },
  4: { a: "#d7c6ff", b: "#8fd6ff", hi: "#ffffff", trim: "#b9a4ff" },
};

// Forme et matière par famille de badge (nom) ; sinon par type
const BY_NAME: Record<string, { shape: Shape; body: string }> = {
  Fantasy: { shape: "arch", body: "plum" }, "Science-Fiction": { shape: "arch", body: "indigo" },
  Romance: { shape: "arch", body: "rose" }, Thriller: { shape: "arch", body: "charcoal" },
  Policier: { shape: "arch", body: "navy" }, Aventure: { shape: "arch", body: "forest" },
  Jeunesse: { shape: "arch", body: "teal" }, Manga: { shape: "arch", body: "burgundy" },
  Classique: { shape: "arch", body: "brown" }, Histoire: { shape: "arch", body: "terracotta" },
  Biographie: { shape: "arch", body: "slate" }, "Développement personnel": { shape: "arch", body: "moss" },
  Philosophie: { shape: "arch", body: "midnight" }, Psychologie: { shape: "arch", body: "plum" },
  Essai: { shape: "arch", body: "charcoal" }, Guerre: { shape: "arch", body: "wine" },
};
const BY_TYPE: Record<string, { shape: Shape; body: string }> = {
  volume: { shape: "ribbon", body: "navy" }, genre: { shape: "ribbon", body: "forest" },
  sessions: { shape: "pennant", body: "terracotta" }, review: { shape: "tassel", body: "burgundy" },
  pages: { shape: "tassel", body: "indigo" }, streak: { shape: "ribbon", body: "wine" },
  monthly: { shape: "pennant", body: "plum" }, monthly_books: { shape: "pennant", body: "forest" },
  event: { shape: "pennant", body: "rose" }, time_of_day: { shape: "ribbon", body: "midnight" },
  performance: { shape: "pennant", body: "charcoal" }, social: { shape: "clip", body: "teal" },
  goal: { shape: "leather", body: "brown" }, monthly_goal: { shape: "leather", body: "terracotta" },
  author: { shape: "tassel", body: "slate" }, champion_month: { shape: "pennant", body: "burgundy" },
  challenge: { shape: "pennant", body: "indigo" }, milestone: { shape: "leather", body: "midnight" },
  referral: { shape: "clip", body: "moss" }, genre_specific: { shape: "arch", body: "forest" },
};
const BY_ID: Record<string, { shape?: Shape; body?: string }> = {
  "time-dawn": { body: "terracotta" }, "time-night": { body: "midnight" },
  "event-oct31": { body: "charcoal" }, "event-sep1": { body: "navy" }, "event-feb14": { body: "rose" },
  "event-jan1": { body: "slate" }, "event-dec31": { body: "midnight" }, "event-mar8": { body: "plum" },
  "perf-ritual": { body: "brown" }, "perf-comeback": { body: "wine" }, "perf-100days": { body: "wine" },
};

/** Emblèmes : dessinés dans une boîte 48x48 avec la dorure `f` (traits), `h` (reflet) et le fond `d`. */
type EP = { f: string; h: string; d: string };
const S = (f: string, w = 2) => ({ stroke: f, strokeWidth: w, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

const EMBLEMS: Record<string, (p: EP) => React.ReactElement> = {
  books: ({ f, h }) => (
    <g>
      <rect x="7" y="31" width="34" height="8" rx="1.5" {...S(f)} fill={f} fillOpacity=".25" />
      <rect x="10" y="22" width="29" height="8" rx="1.5" {...S(f)} fill={f} fillOpacity=".25" />
      <rect x="8" y="13" width="31" height="8" rx="1.5" {...S(f)} transform="rotate(-5 24 17)" fill={f} fillOpacity=".25" />
      <path d="M13 35h6M16 26h6" {...S(h, 1.4)} />
    </g>
  ),
  compass: ({ f, h }) => (
    <g>
      <circle cx="24" cy="24" r="16" {...S(f)} />
      <circle cx="24" cy="24" r="12" {...S(f, 1)} strokeDasharray="1 3" />
      <path d="M24 8l4 12-4 4-4-4z" fill={f} />
      <path d="M24 40l-4-12 4-4 4 4z" fill={f} fillOpacity=".4" />
      <circle cx="24" cy="24" r="2.2" fill={h} />
    </g>
  ),
  wizard: ({ f, h }) => (
    <g>
      <path d="M8 36c8-2 14-6 16-26 2 10 8 22 16 26z" fill={f} fillOpacity=".25" {...S(f)} />
      <path d="M6 37h36" {...S(f)} />
      <path d="M26 20l1 2.5 2.6.3-2 1.8.6 2.6-2.2-1.4-2.2 1.4.6-2.6-2-1.8 2.6-.3z" fill={h} />
      <circle cx="37" cy="12" r="1.4" fill={h} /><circle cx="12" cy="14" r="1" fill={h} />
    </g>
  ),
  planet: ({ f, h }) => (
    <g>
      <circle cx="24" cy="24" r="9" fill={f} fillOpacity=".3" {...S(f)} />
      <ellipse cx="24" cy="24" rx="19" ry="6" transform="rotate(-22 24 24)" {...S(h, 1.8)} />
      <circle cx="39" cy="9" r="1.3" fill={h} /><circle cx="9" cy="38" r="1" fill={h} />
    </g>
  ),
  rose: ({ f, h }) => (
    <g>
      <path d="M24 41c-14-9-16-17-16-22a8 8 0 0 1 16-2 8 8 0 0 1 16 2c0 5-2 13-16 22z" fill={f} fillOpacity=".3" {...S(f)} />
      <path d="M31 7l-14 26" {...S(h, 1.8)} />
      <path d="M31 7l-5 1.5M31 7l-.8 5.2" {...S(h, 1.8)} />
      <path d="M17 33l-3-.4M17 33l1.2 2.8" {...S(h, 1.8)} />
    </g>
  ),
  eye: ({ f, h }) => (
    <g>
      <path d="M4 24c6-10 13-14 20-14s14 4 20 14c-6 10-13 14-20 14S10 34 4 24z" fill={f} fillOpacity=".2" {...S(f)} />
      <circle cx="24" cy="24" r="8" {...S(f)} />
      <circle cx="24" cy="24" r="3.6" fill={h} />
      <path d="M24 3v4M10 8l2.4 3M38 8l-2.4 3" {...S(f, 1.6)} />
    </g>
  ),
  magnifier: ({ f, h }) => (
    <g>
      <circle cx="20" cy="20" r="12" fill={f} fillOpacity=".18" {...S(f, 2.4)} />
      <path d="M29 29l12 12" {...S(f, 4.5)} />
      <path d="M13 17c1-3 3.5-5.5 7-6" {...S(h, 1.8)} />
      <path d="M15 24c2 3 5 4 8 3" {...S(h, 1.4)} strokeDasharray="1 3" />
    </g>
  ),
  mountain: ({ f, h }) => (
    <g>
      <path d="M3 38l13-22 7 10 5-7 17 19z" fill={f} fillOpacity=".25" {...S(f)} />
      <path d="M13 21l3 4 3-3" {...S(h, 1.6)} />
      <path d="M31 19V7l8 3-8 3" fill={h} {...S(h, 1.6)} />
    </g>
  ),
  kite: ({ f, h }) => (
    <g>
      <path d="M26 5l12 14-12 16-12-16z" fill={f} fillOpacity=".28" {...S(f)} />
      <path d="M26 5v30M14 19h24" {...S(h, 1.4)} />
      <path d="M26 35c-3 4 3 5 0 9M26 40l-4 1M26 40l4-1" {...S(f, 1.6)} />
    </g>
  ),
  panels: ({ f, h }) => (
    <g>
      <rect x="6" y="7" width="22" height="16" {...S(f)} fill={f} fillOpacity=".22" />
      <rect x="31" y="7" width="11" height="34" {...S(f)} />
      <rect x="6" y="26" width="11" height="15" {...S(f)} />
      <rect x="20" y="26" width="8" height="15" {...S(f)} fill={f} fillOpacity=".22" />
      <path d="M9 14l5-3 4 5 5-6" {...S(h, 1.6)} />
      <path d="M34 14l5 3M34 24l5-2" {...S(h, 1.4)} />
    </g>
  ),
  column: ({ f, h }) => (
    <g>
      <path d="M8 12h32M10 8h28M8 40h32M10 36h28" {...S(f)} />
      <path d="M14 14v21M21 14v21M28 14v21M34 14v21" {...S(f, 2.6)} />
      <path d="M17 20v10M24 20v10M31 20v10" {...S(h, 1)} />
    </g>
  ),
  hourglass: ({ f, h }) => (
    <g>
      <path d="M11 6h26M11 42h26" {...S(f, 3)} />
      <path d="M14 6c0 10 6 12 10 18-4 6-10 8-10 18M34 6c0 10-6 12-10 18 4 6 10 8 10 18" {...S(f)} />
      <path d="M18 38c2-4 4-5 6-5s4 1 6 5z" fill={h} />
      <path d="M24 24v8" {...S(h, 1.4)} />
    </g>
  ),
  portrait: ({ f, h }) => (
    <g>
      <rect x="6" y="6" width="26" height="34" rx="3" {...S(f)} fill={f} fillOpacity=".18" />
      <circle cx="19" cy="18" r="5" {...S(h, 1.8)} />
      <path d="M10 34c1-6 5-9 9-9s8 3 9 9" {...S(h, 1.8)} />
      <path d="M42 10c-5 2-9 8-11 17l-2 7 7-2c6-3 9-9 6-22z" fill={f} fillOpacity=".3" {...S(f, 1.6)} />
    </g>
  ),
  sprout: ({ f, h }) => (
    <g>
      <path d="M24 42V22" {...S(f)} />
      <path d="M24 26c-9 1-13-4-13-11 8-1 13 3 13 11z" fill={f} fillOpacity=".3" {...S(f)} />
      <path d="M24 21c1-8 6-12 14-12 0 8-5 12-14 12z" fill={h} fillOpacity=".5" {...S(h)} />
      <path d="M14 42h20" {...S(f)} />
    </g>
  ),
  owl: ({ f, h }) => (
    <g>
      <path d="M10 14l6 4h16l6-4v18c0 7-6 10-14 10S10 39 10 32z" fill={f} fillOpacity=".22" {...S(f)} />
      <circle cx="18" cy="22" r="5" {...S(f)} /><circle cx="30" cy="22" r="5" {...S(f)} />
      <circle cx="18" cy="22" r="1.8" fill={h} /><circle cx="30" cy="22" r="1.8" fill={h} />
      <path d="M22 27l2 3 2-3z" fill={h} />
      <path d="M17 36l2 2M24 35v4M31 36l-2 2" {...S(h, 1.2)} />
    </g>
  ),
  mind: ({ f, h }) => (
    <g>
      <path d="M26 5c-11 0-17 7-17 16 0 5 2 7 4 10v8h14v-6c7-1 12-5 12-13C39 11 34 5 26 5z" fill={f} fillOpacity=".2" {...S(f)} />
      <path d="M26 14c-5 0-8 3-8 7s3 6 7 6 6-2 6-5-2-4-4-4-3 1-3 2" {...S(h, 1.8)} />
    </g>
  ),
  nib: ({ f, h }) => (
    <g>
      <path d="M24 4l9 13-3 15h-12l-3-15z" fill={f} fillOpacity=".25" {...S(f)} />
      <path d="M24 17v13" {...S(h, 1.6)} /><circle cx="24" cy="20" r="2" fill={h} />
      <path d="M17 36h14M15 41h18" {...S(f)} />
    </g>
  ),
  poppy: ({ f, h }) => (
    <g>
      <path d="M24 44V30" {...S(f)} />
      <path d="M24 38c-6-1-9-4-9-8 6 0 9 3 9 8z" fill={f} fillOpacity=".3" {...S(f, 1.6)} />
      <path d="M24 28c-7 3-14-1-14-8 0-6 7-10 14-4 7-6 14-2 14 4 0 7-7 11-14 8z" fill={f} fillOpacity=".3" {...S(f)} />
      <circle cx="24" cy="21" r="3.4" fill={h} />
    </g>
  ),
  stopwatch: ({ f, h }) => (
    <g>
      <circle cx="24" cy="26" r="15" {...S(f)} fill={f} fillOpacity=".15" />
      <path d="M20 6h8M24 6v5M37 11l3 3" {...S(f)} />
      <path d="M26 17l-6 10h5l-2 8 8-11h-5z" fill={h} />
    </g>
  ),
  quill: ({ f, h }) => (
    <g>
      <path d="M40 6C28 5 16 14 12 30l-2 10 10-3C34 33 41 22 40 6z" fill={f} fillOpacity=".28" {...S(f)} />
      <path d="M12 30l16-16M10 40l9-9" {...S(h, 1.6)} />
      <path d="M30 24c3 0 6-1 8-3" {...S(h, 1.2)} />
    </g>
  ),
  openbook: ({ f, h }) => (
    <g>
      <path d="M24 12c-4-4-12-5-18-4v28c6-1 14 0 18 4 4-4 12-5 18-4V8c-6-1-14 0-18 4z" fill={f} fillOpacity=".2" {...S(f)} />
      <path d="M24 12v28" {...S(f)} />
      <path d="M10 15c4 0 8 1 11 3M10 21c4 0 8 1 11 3M10 27c4 0 8 1 11 3" {...S(h, 1.2)} />
      <path d="M33 4l1.3 3 3 .3-2.3 2 .7 3-2.7-1.6-2.7 1.6.7-3-2.3-2 3-.3z" fill={h} />
    </g>
  ),
  flame: ({ f, h }) => (
    <g>
      <path d="M24 4c3 8 12 12 12 24a12 12 0 0 1-24 0c0-5 2-8 5-11 0 4 2 6 4 6-3-8-1-14 3-19z" fill={f} fillOpacity=".3" {...S(f)} />
      <path d="M24 26c4 3 6 5 6 8a6 6 0 0 1-12 0c0-3 3-5 6-8z" fill={h} />
    </g>
  ),
  bolt: ({ f, h }) => (
    <g>
      <circle cx="24" cy="24" r="17" {...S(f, 1.4)} strokeDasharray="2 3" />
      <path d="M28 5L11 27h10l-3 16 19-24H26z" fill={f} fillOpacity=".4" {...S(f)} />
      <path d="M26 14l-7 10" {...S(h, 1.4)} />
    </g>
  ),
  fireworks: ({ f, h }) => (
    <g>
      <path d="M24 24V8M24 24l12-12M24 24l12 4M24 24L12 12M24 24l-12 4M24 24l4 14M24 24l-4 14" {...S(f, 1.8)} />
      <circle cx="24" cy="24" r="3" fill={h} />
      <circle cx="24" cy="6" r="1.8" fill={h} /><circle cx="38" cy="10" r="1.8" fill={h} /><circle cx="10" cy="10" r="1.8" fill={h} />
      <circle cx="38" cy="29" r="1.6" fill={h} /><circle cx="10" cy="29" r="1.6" fill={h} />
    </g>
  ),
  blank: ({ f, h }) => (
    <g>
      <path d="M12 6h18l8 8v28H12z" fill={f} fillOpacity=".12" {...S(f)} />
      <path d="M30 6v8h8" {...S(f)} />
      <path d="M33 26l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" fill={h} />
      <path d="M17 20h8" {...S(h, 1.4)} strokeDasharray="1 3" />
    </g>
  ),
  twohearts: ({ f, h }) => (
    <g>
      <path d="M18 40C6 32 5 23 5 20a7 7 0 0 1 13-3 7 7 0 0 1 4 6c0 6-4 12-4 17z" fill={f} fillOpacity=".3" {...S(f)} />
      <path d="M30 42c-12-9-14-18-14-22a8.5 8.5 0 0 1 14-5 8.5 8.5 0 0 1 14 5c0 4-2 13-14 22z" fill={f} fillOpacity=".45" {...S(h)} />
    </g>
  ),
  venus: ({ f, h }) => (
    <g>
      <circle cx="24" cy="18" r="11" {...S(f, 2.4)} fill={f} fillOpacity=".15" />
      <path d="M24 29v15M17 37h14" {...S(f, 2.4)} />
      <path d="M18 14c1-3 4-5 7-5" {...S(h, 1.6)} />
    </g>
  ),
  sunrise: ({ f, h }) => (
    <g>
      <path d="M8 32a16 16 0 0 1 32 0z" fill={f} fillOpacity=".3" {...S(f)} />
      <path d="M24 8v6M9 15l4 4M39 15l-4 4M4 26h5M39 26h5" {...S(h, 2)} />
      <path d="M5 37h38M11 42h26" {...S(f)} />
    </g>
  ),
  moon: ({ f, h }) => (
    <g>
      <path d="M36 28A16 16 0 0 1 20 8a16 16 0 1 0 16 20z" fill={f} fillOpacity=".3" {...S(f)} transform="translate(2 4)" />
      <path d="M34 10l1.2 2.8 2.8 1.2-2.8 1.2L34 18l-1.2-2.8L30 14l2.8-1.2z" fill={h} />
      <circle cx="40" cy="26" r="1.5" fill={h} /><circle cx="28" cy="6" r="1.2" fill={h} />
    </g>
  ),
  cup: ({ f, h }) => (
    <g>
      <path d="M8 18h26v10a12 12 0 0 1-12 12h-2A12 12 0 0 1 8 28z" fill={f} fillOpacity=".25" {...S(f)} />
      <path d="M34 21h3a5 5 0 0 1 0 10h-4" {...S(f)} />
      <path d="M6 44h30" {...S(f)} />
      <path d="M16 6c-2 3 2 4 0 8M24 6c-2 3 2 4 0 8" {...S(h, 1.6)} />
    </g>
  ),
  infinity: ({ f, h }) => (
    <g>
      <path d="M24 24c-4-7-8-9-12-9a9 9 0 0 0 0 18c4 0 8-2 12-9 4 7 8 9 12 9a9 9 0 0 0 0-18c-4 0-8 2-12 9z" fill={f} fillOpacity=".15" {...S(f, 2.6)} />
      <path d="M12 20c2-1 4 0 6 3" {...S(h, 1.4)} />
    </g>
  ),
  steps: ({ f, h }) => (
    <g>
      <path d="M5 42h9V32h9V22h9V12h11v30z" fill={f} fillOpacity=".22" {...S(f)} />
      <path d="M8 24l12-12M13 12h7v7" {...S(h, 2.2)} />
    </g>
  ),
  brick: ({ f, h }) => (
    <g>
      <rect x="6" y="9" width="30" height="34" rx="2.5" {...S(f)} fill={f} fillOpacity=".25" />
      <path d="M36 14l6-1v29l-6 1" {...S(f)} />
      <path d="M12 17h18M12 22h18M12 27h12" {...S(h, 1.6)} />
      <path d="M6 39h30" {...S(f, 1.4)} />
    </g>
  ),
  heartup: ({ f, h }) => (
    <g>
      <path d="M24 40C10 31 8 23 8 19a8 8 0 0 1 16-2 8 8 0 0 1 16 2c0 4-2 12-16 21z" fill={f} fillOpacity=".3" {...S(f)} />
      <path d="M24 6V0M14 8l-3-4M34 8l3-4" {...S(h, 2)} />
    </g>
  ),
  idcard: ({ f, h }) => (
    <g>
      <rect x="5" y="9" width="38" height="30" rx="4" {...S(f)} fill={f} fillOpacity=".18" />
      <circle cx="16" cy="21" r="4.5" {...S(h, 1.8)} />
      <path d="M9 33c1-4 4-6 7-6s6 2 7 6" {...S(h, 1.8)} />
      <path d="M28 18h10M28 24h10M28 30h6" {...S(f, 1.8)} />
    </g>
  ),
  frame: ({ f, h }) => (
    <g>
      <rect x="5" y="6" width="38" height="36" rx="2" {...S(f, 2.6)} />
      <rect x="10" y="11" width="28" height="26" {...S(f, 1)} fill={f} fillOpacity=".12" />
      <path d="M10 33l9-10 7 7 5-5 7 8" {...S(h, 1.8)} />
      <circle cx="31" cy="17" r="3" fill={h} />
    </g>
  ),
  drawer: ({ f, h }) => (
    <g>
      <rect x="6" y="6" width="36" height="13" rx="2" {...S(f)} fill={f} fillOpacity=".22" />
      <rect x="6" y="22" width="36" height="13" rx="2" {...S(f)} />
      <rect x="9" y="37" width="30" height="7" rx="1.5" {...S(f, 1.4)} />
      <path d="M20 13h8M20 29h8" {...S(h, 2.2)} />
    </g>
  ),
  targetpage: ({ f, h }) => (
    <g>
      <circle cx="20" cy="26" r="15" {...S(f)} /><circle cx="20" cy="26" r="9" {...S(f, 1.6)} /><circle cx="20" cy="26" r="3" fill={h} />
      <path d="M30 8h12v14H30z" {...S(f, 1.6)} fill={f} fillOpacity=".25" /><path d="M33 13h6M33 17h6" {...S(h, 1.2)} />
    </g>
  ),
  targetbook: ({ f, h }) => (
    <g>
      <circle cx="20" cy="26" r="15" {...S(f)} /><circle cx="20" cy="26" r="9" {...S(f, 1.6)} /><circle cx="20" cy="26" r="3" fill={h} />
      <path d="M30 9c3-2 7-2 11 0v13c-4-2-8-2-11 0z" {...S(f, 1.6)} fill={f} fillOpacity=".25" />
    </g>
  ),
  targetbeyond: ({ f, h }) => (
    <g>
      <circle cx="19" cy="29" r="13" {...S(f)} /><circle cx="19" cy="29" r="7" {...S(f, 1.6)} />
      <path d="M19 29L40 8M34 8h6v6" {...S(h, 2.4)} />
    </g>
  ),
  cal3: ({ f, h }) => (
    <g>
      <rect x="6" y="9" width="36" height="32" rx="4" {...S(f)} fill={f} fillOpacity=".16" />
      <path d="M6 18h36M15 5v8M33 5v8" {...S(f)} />
      <path d="M17 24h5l-3 4a3 3 0 1 1-2 5M27 24h5v9h-5z" {...S(h, 1.8)} />
    </g>
  ),
  laurel12: ({ f, h }) => (
    <g>
      <path d="M12 38C4 32 3 21 8 12M36 38c8-6 9-17 4-26" {...S(f, 2)} />
      <path d="M8 16l5 2M6 22l5 1M7 28l5 0M10 33l4-1M40 16l-5 2M42 22l-5 1M41 28l-5 0M38 33l-4-1" {...S(f, 2.4)} />
      <path d="M17 19h4l-3 17M27 22c1-2 2-3 4-3s4 1 4 4c0 5-8 8-8 13h8" {...S(h, 2)} />
    </g>
  ),
  twobooks: ({ f, h }) => (
    <g>
      <rect x="5" y="14" width="19" height="28" rx="2" {...S(f)} fill={f} fillOpacity=".25" />
      <rect x="24" y="8" width="19" height="34" rx="2" {...S(f)} fill={f} fillOpacity=".15" />
      <path d="M9 22h11M28 16h11M28 22h11" {...S(h, 1.4)} />
    </g>
  ),
  slimbook: ({ f, h }) => (
    <g>
      <rect x="14" y="7" width="20" height="34" rx="2" {...S(f)} fill={f} fillOpacity=".22" />
      <path d="M19 7v34M23 16h7M23 21h7" {...S(h, 1.4)} />
      <path d="M38 36l3 3-3 3M10 36l-3 3 3 3" {...S(f, 1.6)} />
    </g>
  ),
  n1000: ({ f, h }) => (
    <g>
      <path d="M8 13h32v22H8z" {...S(f)} fill={f} fillOpacity=".15" />
      <path d="M13 19l3-2v14M21 17h6v14h-6zM31 17h6v14h-6z" {...S(h, 2)} />
      <path d="M8 40h32" {...S(f, 1.6)} strokeDasharray="1 3" />
    </g>
  ),
  n100: ({ f, h }) => (
    <g>
      <circle cx="24" cy="24" r="17" {...S(f)} fill={f} fillOpacity=".15" />
      <path d="M13 20l3-2v13M21 18h5v13h-5zM29 18h5v13h-5z" {...S(h, 2)} />
      <path d="M12 38c8 4 16 4 24 0" {...S(f, 1.6)} />
    </g>
  ),
  cal100: ({ f, h }) => (
    <g>
      <rect x="6" y="8" width="36" height="33" rx="4" {...S(f)} fill={f} fillOpacity=".15" />
      <path d="M6 17h36M15 5v7M33 5v7" {...S(f)} />
      <path d="M14 23l3-1.5V34M23 22h5v12h-5zM31 22h5v12h-5z" {...S(h, 1.8)} />
    </g>
  ),
  ember: ({ f, h }) => (
    <g>
      <path d="M24 5c2 6 10 9 10 19a10 10 0 0 1-20 0c0-4 2-6 4-8 0 3 1 5 3 5-2-6-1-11 3-16z" {...S(f)} fill={f} fillOpacity=".25" />
      <path d="M6 41c6-3 10-3 18-3s12 0 18 3" {...S(f, 1.8)} />
      <path d="M20 40l-2-4M28 40l2-4M24 40v-5" {...S(h, 1.6)} />
    </g>
  ),
  bubbles: ({ f, h }) => (
    <g>
      <path d="M5 8h22a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H15l-6 5v-5H5a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3z" transform="translate(2 0)" {...S(f)} fill={f} fillOpacity=".22" />
      <path d="M24 22h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-1v5l-6-5H24a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3z" transform="translate(2 -2)" {...S(h, 1.6)} />
      <path d="M11 15h12" {...S(h, 1.4)} />
    </g>
  ),
  gem: ({ f, h }) => (
    <g>
      <path d="M13 8h22l8 11-19 23L5 19z" fill={f} fillOpacity=".22" {...S(f)} />
      <path d="M5 19h38M18 8l-4 11 10 23 10-23-4-11M24 8l-4 11M24 8l4 11" {...S(h, 1.3)} />
    </g>
  ),
  ring: ({ f, h }) => (
    <g>
      <circle cx="24" cy="29" r="12" {...S(f, 3)} />
      <path d="M17 11l4-5h6l4 5-7 7z" fill={h} fillOpacity=".7" {...S(f, 1.6)} />
    </g>
  ),
  shelf: ({ f, h }) => (
    <g>
      <rect x="6" y="14" width="8" height="26" rx="1.2" {...S(f)} fill={f} fillOpacity=".3" />
      <rect x="16" y="10" width="8" height="30" rx="1.2" {...S(f)} fill={f} fillOpacity=".3" />
      <rect x="26" y="14" width="8" height="26" rx="1.2" {...S(f)} fill={f} fillOpacity=".3" />
      <path d="M36 17l7 2-5 21-7-2z" {...S(f)} fill={f} fillOpacity=".15" />
      <path d="M4 42h40" {...S(h, 2)} />
    </g>
  ),
  newbook: ({ f, h }) => (
    <g>
      <rect x="10" y="9" width="24" height="33" rx="2.5" {...S(f)} fill={f} fillOpacity=".22" />
      <path d="M15 9v33M20 18h9M20 23h9" {...S(h, 1.6)} />
      <path d="M36 5l1.2 3 3 .3-2.3 2 .7 3-2.6-1.6-2.7 1.6.7-3-2.3-2 3-.3z" fill={h} />
    </g>
  ),
  scroll: ({ f, h }) => (
    <g>
      <path d="M12 8h26a4 4 0 0 1 0 8H12a4 4 0 0 1 0-8zM12 32h26a4 4 0 0 1 0 8H12a4 4 0 0 1 0-8z" {...S(f)} fill={f} fillOpacity=".25" />
      <path d="M15 16v16M35 16v16" {...S(f)} />
      <path d="M19 21h12M19 26h12" {...S(h, 1.6)} />
    </g>
  ),
  curator: ({ f, h }) => (
    <g>
      <path d="M24 6l5 11 12 1-9 8 3 12-11-7-11 7 3-12-9-8 12-1z" fill={f} fillOpacity=".25" {...S(f)} />
      <circle cx="24" cy="23" r="5" {...S(h, 1.8)} /><path d="M28 27l4 4" {...S(h, 2)} />
    </g>
  ),
  quotes: ({ f, h }) => (
    <g>
      <path d="M8 31c0-8 3-14 10-17l1.5 3C15 19 14 22 14.5 25H19v12H8zM27 31c0-8 3-14 10-17l1.5 3C34 19 33 22 33.5 25H38v12H27z" fill={f} fillOpacity=".35" {...S(f)} />
      <path d="M12 34h3M31 34h3" {...S(h, 1.6)} />
    </g>
  ),
  gavel: ({ f, h }) => (
    <g>
      <rect x="9" y="8" width="20" height="10" rx="2" transform="rotate(35 19 13)" {...S(f)} fill={f} fillOpacity=".3" />
      <path d="M25 21l16 16" {...S(f, 4)} />
      <path d="M6 42h20" {...S(h, 2.4)} />
    </g>
  ),
  scales: ({ f, h }) => (
    <g>
      <path d="M24 6v34M14 42h20M10 12h28" {...S(f)} />
      <path d="M10 12l-6 14c0 3 12 3 12 0zM38 12l-6 14c0 3 12 3 12 0z" fill={f} fillOpacity=".25" {...S(f, 1.8)} />
      <circle cx="24" cy="8" r="2.2" fill={h} />
    </g>
  ),
  camera: ({ f, h }) => (
    <g>
      <path d="M6 15h8l3-5h14l3 5h8v24H6z" fill={f} fillOpacity=".2" {...S(f)} />
      <circle cx="24" cy="26" r="8" {...S(f)} /><circle cx="24" cy="26" r="3.6" fill={h} />
      <circle cx="37" cy="20" r="1.4" fill={h} />
    </g>
  ),
  megaphone: ({ f, h }) => (
    <g>
      <path d="M6 19h9l20-10v30L15 29H6z" fill={f} fillOpacity=".25" {...S(f)} />
      <path d="M15 29l3 11h6l-3-10" {...S(f, 1.8)} />
      <path d="M39 17c3 2 3 8 0 10M43 13c6 5 6 15 0 20" {...S(h, 1.8)} />
    </g>
  ),
  gift: ({ f, h }) => (
    <g>
      <rect x="6" y="19" width="36" height="22" rx="2" {...S(f)} fill={f} fillOpacity=".22" />
      <rect x="4" y="13" width="40" height="7" rx="2" {...S(f)} fill={f} fillOpacity=".35" />
      <path d="M24 13v28" {...S(h, 2.4)} />
      <path d="M24 13c-6 0-10-2-8-6s8-1 8 6c0-7 6-10 8-6s-2 6-8 6z" {...S(h, 1.8)} />
    </g>
  ),
  chatquill: ({ f, h }) => (
    <g>
      <path d="M6 8h36v24H20l-9 8v-8H6z" fill={f} fillOpacity=".2" {...S(f)} />
      <path d="M30 14c-5 0-9 3-11 9l-1 4 4-1c5-2 8-6 8-12z" fill={h} fillOpacity=".5" {...S(h, 1.6)} />
      <path d="M12 16h7M12 22h5" {...S(f, 1.6)} />
    </g>
  ),
  lighthouse: ({ f, h }) => (
    <g>
      <path d="M18 42l3-26h6l3 26z" fill={f} fillOpacity=".25" {...S(f)} />
      <path d="M19 16h10l-1-5h-8zM22 11V7h4v4" {...S(f)} />
      <path d="M20 26h8M19 34h10" {...S(h, 2)} />
      <path d="M5 11l11 4M43 11l-11 4M3 19l13 1M45 19l-13 1" {...S(h, 1.6)} />
      <path d="M8 42h32" {...S(f)} />
    </g>
  ),
  trophy: ({ f, h }) => (
    <g>
      <path d="M14 6h20v12a10 10 0 0 1-20 0z" fill={f} fillOpacity=".3" {...S(f)} />
      <path d="M14 10H7c0 7 3 10 8 11M34 10h7c0 7-3 10-8 11" {...S(f)} />
      <path d="M24 28v8M16 42h16M18 36h12" {...S(f)} />
      <path d="M24 10l1.6 3.4 3.6.4-2.7 2.5.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.7-2.5 3.6-.4z" fill={h} />
    </g>
  ),
  finishflag: ({ f, h }) => (
    <g>
      <path d="M10 6v38" {...S(f, 2.6)} />
      <path d="M10 8h28v20H10z" {...S(f)} fill={f} fillOpacity=".15" />
      <path d="M10 8h7v5h-7zM24 8h7v5h-7zM17 13h7v5h-7zM31 13h7v5h-7zM10 18h7v5h-7zM24 18h7v5h-7zM17 23h7v5h-7zM31 23h7v5h-7z" fill={h} fillOpacity=".8" />
    </g>
  ),
  shield: ({ f, h }) => (
    <g>
      <path d="M24 5l16 6v13c0 9-7 15-16 19-9-4-16-10-16-19V11z" fill={f} fillOpacity=".25" {...S(f)} />
      <path d="M16 24l6 6 11-12" {...S(h, 3)} />
    </g>
  ),
  cake: ({ f, h }) => (
    <g>
      <rect x="8" y="24" width="32" height="16" rx="3" {...S(f)} fill={f} fillOpacity=".25" />
      <path d="M8 31c4 3 6-3 10 0s6-3 10 0 6-3 12 0" {...S(h, 1.8)} />
      <path d="M24 24v-9" {...S(f, 2)} />
      <path d="M24 6c3 3 3 6 0 8-3-2-3-5 0-8z" fill={h} />
      <path d="M5 42h38" {...S(f)} />
    </g>
  ),
  medal: ({ f, h }) => (
    <g>
      <path d="M14 4l8 14M34 4l-8 14" {...S(f, 2.4)} />
      <circle cx="24" cy="30" r="12" fill={f} fillOpacity=".3" {...S(f)} />
      <path d="M24 22l2.3 5 5.2.5-3.9 3.5 1.2 5.2-4.8-2.8-4.8 2.8 1.2-5.2-3.9-3.5 5.2-.5z" fill={h} />
    </g>
  ),
  migrate: ({ f, h }) => (
    <g>
      <path d="M6 22h22v20H6z" {...S(f)} fill={f} fillOpacity=".2" /><path d="M6 22l11 8 11-8" {...S(f, 1.6)} />
      <path d="M22 10h18M32 4l8 6-8 6" {...S(h, 2.4)} />
    </g>
  ),
  barcode: ({ f, h }) => (
    <g>
      <rect x="5" y="9" width="38" height="30" rx="3" {...S(f)} fill={f} fillOpacity=".12" />
      <path d="M11 15v18M15 15v18M20 15v18M23 15v18M28 15v18M31 15v18M36 15v18" {...S(h, 2)} />
      <path d="M11 15v18M20 15v18M28 15v18" {...S(f, 3.4)} />
    </g>
  ),
  school: ({ f, h }) => (
    <g>
      <path d="M8 18c0-6 4-10 16-10s16 4 16 10v22H8z" fill={f} fillOpacity=".22" {...S(f)} />
      <rect x="13" y="26" width="22" height="10" rx="2" {...S(f, 1.8)} />
      <path d="M13 18h22" {...S(f, 1.8)} /><path d="M24 26v10" {...S(h, 1.6)} />
      <path d="M30 6l5 4M14 6L9 10" {...S(h, 1.6)} />
    </g>
  ),
  pumpkin: ({ f, h }) => (
    <g>
      <path d="M24 12c-4-2-16-1-17 14 0 10 8 16 17 16s17-6 17-16c-1-15-13-16-17-14z" fill={f} fillOpacity=".3" {...S(f)} />
      <path d="M24 12c0-3 1-5 4-6" {...S(f, 2.4)} />
      <path d="M14 24l5 2-5 3zM34 24l-5 2 5 3zM17 35c4 3 10 3 14 0" fill={h} {...S(h, 1.8)} />
    </g>
  ),
  "m-01": ({ f, h }) => (
    <g>
      <path d="M24 5v38M7.5 14.5l33 19M40.5 14.5l-33 19" {...S(f, 2)} />
      <path d="M19 8l5 4 5-4M19 40l5-4 5 4M8 21l6 1-2 5M40 21l-6 1 2 5M8 27l6-1-2-5M40 27l-6-1 2-5" {...S(h, 1.5)} />
      <circle cx="24" cy="24" r="3" fill={h} />
    </g>
  ),
  "m-02": ({ f, h }) => (
    <g>
      <path d="M24 44V28" {...S(f, 2)} />
      <path d="M24 28c-8 0-10-8-8-18 5 3 8 9 8 18zM24 28c8 0 10-8 8-18-5 3-8 9-8 18zM24 28c-3-6-3-13 0-20 3 7 3 14 0 20z" fill={f} fillOpacity=".3" {...S(f, 1.8)} />
      <path d="M17 44h14" {...S(h, 1.6)} />
    </g>
  ),
  "m-03": ({ f, h }) => (
    <g>
      <path d="M24 44V26" {...S(f, 2)} />
      <path d="M12 12c0 10 4 16 12 16s12-6 12-16l-6 4-6-6-6 6z" fill={f} fillOpacity=".3" {...S(f)} />
      <path d="M24 38c-5-1-9-4-10-9 5 0 9 3 10 9z" {...S(h, 1.6)} />
    </g>
  ),
  "m-04": ({ f, h }) => (
    <g>
      <path d="M5 24C5 12 14 6 24 6s19 6 19 18z" fill={f} fillOpacity=".28" {...S(f)} />
      <path d="M5 24c3-3 6-3 9 0 3-3 7-3 10 0 3-3 7-3 10 0 3-3 4-3 9 0" {...S(f, 1.6)} />
      <path d="M24 24v15a4 4 0 0 1-8 0" {...S(h, 2)} />
      <path d="M36 32l-1.5 4M42 30l-1.5 4M30 34l-1.5 4" {...S(h, 1.8)} />
    </g>
  ),
  "m-05": ({ f, h }) => (
    <g>
      <circle cx="24" cy="21" r="4" fill={h} />
      <path d="M24 9c3 0 4 4 0 8-4-4-3-8 0-8zM24 33c-3 0-4-4 0-8 4 4 3 8 0 8zM12 21c0-3 4-4 8 0-4 4-8 3-8 0zM36 21c0 3-4 4-8 0 4-4 8-3 8 0zM15.5 12.5c2-2 5 0 6 5-5-1-8-3-6-5zM32.5 12.5c2 2 0 5-5 6 1-5 3-8 5-6zM15.5 29.5c2 2 5 0 6-5-5 1-8 3-6 5zM32.5 29.5c-2 2-5 0-6-5 5 1 8 3 6 5z" fill={f} fillOpacity=".35" {...S(f, 1.4)} />
      <path d="M24 33v11" {...S(f, 2)} />
    </g>
  ),
  "m-06": ({ f, h }) => (
    <g>
      <circle cx="24" cy="24" r="9" fill={f} fillOpacity=".35" {...S(f)} />
      <path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M38 10l-4 4M10 38l4-4" {...S(h, 2.2)} />
    </g>
  ),
  "m-07": ({ f, h }) => (
    <g>
      <path d="M6 22C6 11 14 5 24 5s18 6 18 17z" fill={f} fillOpacity=".3" {...S(f)} />
      <path d="M24 5v36M15 22l-2 0M24 22C21 14 18 8 15 6M24 22c3-8 6-14 9-16" {...S(f, 1.6)} />
      <path d="M14 43h20" {...S(h, 2.2)} />
      <circle cx="38" cy="36" r="3" fill={h} />
    </g>
  ),
  "m-08": ({ f, h }) => (
    <g>
      <path d="M3 20c4-5 8-5 12 0s8 5 12 0 8-5 12 0 3 3 6 0" {...S(f, 2.2)} />
      <path d="M3 28c4-5 8-5 12 0s8 5 12 0 8-5 12 0 3 3 6 0" {...S(h, 2)} />
      <path d="M3 36c4-5 8-5 12 0s8 5 12 0 8-5 12 0 3 3 6 0" {...S(f, 1.6)} />
      <circle cx="35" cy="9" r="4" fill={h} />
    </g>
  ),
  "m-09": ({ f, h }) => (
    <g>
      <path d="M14 18c0-5 4-7 10-7s10 2 10 7z" fill={f} fillOpacity=".5" {...S(f)} />
      <path d="M15 18c0 12 3 22 9 24 6-2 9-12 9-24z" fill={f} fillOpacity=".25" {...S(f)} />
      <path d="M24 11c0-3 1-5 3-6M20 24c0 6 1 11 3 14" {...S(h, 1.6)} />
    </g>
  ),
  "m-10": ({ f, h }) => (
    <g>
      <path d="M24 6c6 4 6 10 4 14 5-3 9-2 13 0-2 4-5 6-9 6 3 3 3 7 0 9-4-3-5-5-8-5s-4 2-8 5c-3-2-3-6 0-9-4 0-7-2-9-6 4-2 8-3 13 0-2-4-2-10 4-14z" fill={f} fillOpacity=".3" {...S(f, 1.8)} />
      <path d="M24 12v32" {...S(h, 1.8)} />
    </g>
  ),
  "m-11": ({ f, h }) => (
    <g>
      <path d="M13 28a8 8 0 0 1 1-16 11 11 0 0 1 21 3 7 7 0 0 1-1 13z" fill={f} fillOpacity=".3" {...S(f)} />
      <path d="M15 34l-2 6M24 34l-2 6M33 34l-2 6" {...S(h, 2.2)} />
    </g>
  ),
  "m-12": ({ f, h }) => (
    <g>
      <path d="M24 4l9 12h-5l8 11H12l8-11h-5z" fill={f} fillOpacity=".3" {...S(f)} />
      <path d="M24 27v13M19 41h10" {...S(f, 2.4)} />
      <circle cx="21" cy="14" r="1.2" fill={h} /><circle cx="27" cy="22" r="1.2" fill={h} /><circle cx="19" cy="24" r="1.2" fill={h} />
      <path d="M38 8l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill={h} />
    </g>
  ),
  duo: ({ f, h }) => (
    <g>
      <circle cx="17" cy="16" r="6" {...S(f)} fill={f} fillOpacity=".25" />
      <path d="M5 40c0-8 5-13 12-13s12 5 12 13" {...S(f)} />
      <circle cx="33" cy="17" r="4.5" {...S(h, 1.8)} />
      <path d="M33 28c6 0 10 4 10 11" {...S(h, 1.8)} />
      <path d="M40 4v8M36 8h8" {...S(h, 2.2)} />
    </g>
  ),
};

/** Badges mensuels (défis, objectifs, champions) : l'emblème est la saison du mois, un pictogramme marque le type. */
const MONTHLY_GLYPH: Record<string, string> = { monthly_books: "newbook", monthly: "stopwatch", monthly_goal: "targetpage", champion_month: "trophy" };
function monthOf(def: BadgeDef): { mm: string; yy: string } | null {
  if (!MONTHLY_GLYPH[def.type]) return null;
  const m = def.id.match(/-(\d{4})-(\d{2})$/);
  return m ? { mm: m[2], yy: m[1].slice(2) } : null;
}

/** Quel emblème pour quel badge. */
function emblemKey(def: BadgeDef): string {
  const id = def.id;
  const exact: Record<string, string> = {
    "genre-fantasy": "wizard", "genre-scifi": "planet", "genre-romance": "rose", "genre-thriller": "eye",
    "genre-policier": "magnifier", "genre-aventure": "mountain", "genre-jeunesse": "kite", "genre-manga": "panels",
    "genre-classique": "column", "genre-histoire": "hourglass", "genre-biographie": "portrait", "genre-devperso": "sprout",
    "genre-philosophie": "owl", "genre-psychologie": "mind", "genre-essai": "nib", "genre-guerre": "poppy",
    "sprint-eclair": "bolt", "event-dec31": "fireworks", "event-jan1": "blank", "event-feb14": "twohearts",
    "event-mar8": "venus", "time-dawn": "sunrise", "time-night": "moon", "perf-ritual": "cup", "perf-unending": "infinity",
    "perf-climbing": "steps", "perf-brick": "brick", "social-liked": "heartup", "social-id": "idcard", "social-photo": "frame",
    "social-archive": "drawer", "goal-set-pages": "targetpage", "goal-set-books": "targetbook", "goal-exceeded": "targetbeyond",
    "goal-3-months": "cal3", "goal-12-months": "laurel12", "perf-brick2": "twobooks", "perf-shorts": "slimbook",
    "perf-week1000": "n1000", "perf-century": "n100", "perf-100days": "cal100", "perf-comeback": "ember",
    polyglot: "bubbles", "genre-specialist": "gem", "author-loyal": "ring", "author-collect": "shelf",
    "author-contemp": "newbook", "author-classic": "column", "review-long": "scroll", "review-curator": "curator",
    "note-quote": "quotes", "rating-harsh": "gavel", "rating-lover": "heartup", "rating-balanced": "scales",
    "social-photographer": "camera", "social-influencer": "megaphone", "social-generous": "gift", "social-liked-2": "twohearts",
    "social-commenter": "chatquill", "social-mentor": "lighthouse", "challenge-winner": "trophy", "challenge-finisher": "finishflag",
    "challenge-addict": "shield", "anniversary-1": "cake", "anniversary-2": "medal", "import-migrator": "migrate",
    "isbn-librarian": "barcode", "event-sep1": "school", "event-oct31": "pumpkin",
  };
  if (exact[id]) return exact[id];
  const month = monthOf(def);
  if (month) return `m-${month.mm}`;
  const family = id.split("-")[0];
  const fam: Record<string, string> = {
    builder: "books", explorer: "compass", marathon: "stopwatch", critic: "quill", voracious: "openbook",
    streak: "flame", referral: "duo",
  };
  return fam[family] ?? "compass";
}

function materialOf(def: BadgeDef): { shape: Shape; body: string } {
  const byId = BY_ID[def.id] ?? {};
  const base = BY_NAME[def.name] ?? BY_TYPE[def.type] ?? { shape: "ribbon" as Shape, body: "navy" };
  return { shape: byId.shape ?? base.shape, body: byId.body ?? base.body };
}

const W = 64;
const H = 91;

/** Forme du corps + position de l'emblème + position des pastilles de palier. */
function geometry(shape: Shape) {
  switch (shape) {
    case "arch":
      return { d: "M5 82V30C5 12 17 3 32 2c15 1 27 10 27 28v52l-27 7z", cx: 32, cy: 41, pips: 76, ring: 22 };
    case "pennant":
      return { d: "M4 0h56v62L32 91 4 62z", cx: 32, cy: 33, pips: 58, ring: 22 };
    case "leather":
      return { d: "M10 0h44a6 6 0 0 1 6 6v74a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V6a6 6 0 0 1 6-6z", cx: 32, cy: 41, pips: 74, ring: 21 };
    case "clip":
      return { d: "M8 14h48v68l-24 9L8 82z", cx: 32, cy: 50, pips: 76, ring: 20 };
    case "tassel":
      return { d: "M5 0h54v66a6 6 0 0 1-6 6H11a6 6 0 0 1-6-6z", cx: 32, cy: 33, pips: 62, ring: 21 };
    default:
      return { d: "M5 0h54v91L32 74 5 91z", cx: 32, cy: 36, pips: 62, ring: 22 };
  }
}

export default function BookmarkBadge({ def, unlocked, size = 56 }: {
  def: BadgeDef; unlocked: boolean; unlockedAt?: string; size?: number;
}) {
  const tier = def.tier as BadgeTier;
  const foil = FOIL[tier];
  const { shape, body } = materialOf(def);
  const [b1, b2] = unlocked ? BODY[body] ?? BODY.navy : ["#4a4f5a", "#262a33"];
  const g = geometry(shape);
  const uid = `bm-${def.id}-${size}-${unlocked ? "u" : "l"}`;
  const Emblem = EMBLEMS[emblemKey(def)] ?? EMBLEMS.compass;
  const month = monthOf(def);
  const fA = unlocked ? foil.a : "#8d93a0";
  const fB = unlocked ? foil.b : "#6a707c";
  const hi = unlocked ? foil.hi : "#aab0bb";
  const meta = TIER_META[tier];
  const height = Math.round(size * 1.42);

  return (
    <svg width={size} height={height} viewBox={`0 0 ${W} ${H}`} overflow="visible" role="img" aria-label={def.name}>
      <defs>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor={b1} /><stop offset="1" stopColor={b2} />
        </linearGradient>
        <linearGradient id={`${uid}-foil`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={hi} /><stop offset="0.35" stopColor={fA} /><stop offset="1" stopColor={fB} />
        </linearGradient>
        <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${uid}-clip`}><path d={g.d} /></clipPath>
        <filter id={`${uid}-sh`} x="-30%" y="-15%" width="160%" height="145%">
          <feDropShadow dx="0" dy={unlocked ? 2.5 : 1} stdDeviation={unlocked ? 2.8 : 1.5} floodOpacity={unlocked ? 0.38 : 0.12} floodColor="#000" />
        </filter>
      </defs>

      {/* Gland (forme « gland » seulement) */}
      {shape === "tassel" && (
        <g>
          <path d="M32 72v6" stroke={`url(#${uid}-foil)`} strokeWidth="2" strokeLinecap="round" />
          <path d="M26 79h12l1 12h-14z" fill={`url(#${uid}-foil)`} opacity={unlocked ? 1 : 0.5} />
          <path d="M28 82v9M32 82v9M36 82v9" stroke={b2} strokeWidth="0.8" opacity="0.5" />
        </g>
      )}

      {/* Corps */}
      <path d={g.d} fill={`url(#${uid}-body)`} filter={`url(#${uid}-sh)`} />
      <g clipPath={`url(#${uid}-clip)`}>
        {/* grain de papier / tissu */}
        <path d="M0 8h64M0 16h64M0 24h64M0 32h64M0 40h64M0 48h64M0 56h64M0 64h64M0 72h64M0 80h64M0 88h64" stroke="#fff" strokeWidth="0.4" opacity="0.05" />
        <rect x="0" y="0" width={W} height={H} fill={`url(#${uid}-sheen)`} />
        <path d={`M0 0h${W}v10H0z`} fill="#000" opacity="0.12" />
      </g>

      {/* Liseré de dorure */}
      {shape === "leather" ? (
        <path d="M10 6h44a2 2 0 0 1 2 2v70a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="none" stroke={`url(#${uid}-foil)`} strokeWidth="1" strokeDasharray="2.4 2.2" opacity={unlocked ? 0.95 : 0.4} />
      ) : (
        <path d={g.d} fill="none" stroke={`url(#${uid}-foil)`} strokeWidth="1.3" opacity={unlocked ? 0.9 : 0.35} transform="translate(32 45.5) scale(0.9) translate(-32 -45.5)" />
      )}

      {/* Pince métallique */}
      {shape === "clip" && (
        <g>
          <path d="M16 0h32a5 5 0 0 1 5 5v14H11V5a5 5 0 0 1 5-5z" fill={`url(#${uid}-foil)`} opacity={unlocked ? 1 : 0.5} />
          <path d="M20 5h24" stroke={b2} strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
          <path d="M16 13h32" stroke="#fff" strokeWidth="0.8" opacity="0.5" />
        </g>
      )}
      {/* Œillet (arche, gland, cuir) */}
      {(shape === "tassel" || shape === "arch" || shape === "leather" || shape === "ribbon") && (
        <g>
          <circle cx="32" cy={shape === "arch" ? 8 : 6.5} r="3.2" fill="#000" fillOpacity="0.4" />
          <circle cx="32" cy={shape === "arch" ? 8 : 6.5} r="3.2" fill="none" stroke={`url(#${uid}-foil)`} strokeWidth="1.4" opacity={unlocked ? 1 : 0.5} />
        </g>
      )}

      {/* Médaillon + emblème en dorure */}
      <g opacity={unlocked ? 1 : 0.45}>
        <circle cx={g.cx} cy={g.cy} r={g.ring} fill="#000" fillOpacity="0.18" />
        <circle cx={g.cx} cy={g.cy} r={g.ring} fill="none" stroke={`url(#${uid}-foil)`} strokeWidth="1.2" />
        <circle cx={g.cx} cy={g.cy} r={g.ring - 3} fill="none" stroke={`url(#${uid}-foil)`} strokeWidth="0.5" strokeDasharray="1 2" opacity="0.8" />
        <g fill="none" transform={`translate(${g.cx - 17} ${g.cy - 17}) scale(0.71)`}>
          <Emblem f={`url(#${uid}-foil)`} h={hi} d={b2} />
        </g>
      </g>

      {/* Mois : pictogramme du type de défi, accroché au médaillon */}
      {month && (
        <g opacity={unlocked ? 1 : 0.45}>
          <circle cx={g.cx + g.ring * 0.74} cy={g.cy - g.ring * 0.74} r="7.6" fill={b2} stroke={`url(#${uid}-foil)`} strokeWidth="1.1" />
          <g fill="none" transform={`translate(${g.cx + g.ring * 0.74 - 6.2} ${g.cy - g.ring * 0.74 - 6.2}) scale(0.26)`}>
            {React.createElement(EMBLEMS[MONTHLY_GLYPH[def.type]], { f: `url(#${uid}-foil)`, h: hi, d: b2 })}
          </g>
        </g>
      )}

      {/* Pastilles de palier */}
      {unlocked && (
        <g>
          {Array.from({ length: tier }).map((_, i) => (
            <circle key={i} cx={32 + (i - (tier - 1) / 2) * 7} cy={g.pips} r="2.2" fill={`url(#${uid}-foil)`} stroke={b2} strokeWidth="0.5" />
          ))}
        </g>
      )}

      {/* Année des badges mensuels */}
      {unlocked && month && (
        <text x={32} y={g.pips + 9} textAnchor="middle" fill={hi} fontSize="5" fontWeight="600" fontFamily="system-ui" opacity="0.8" letterSpacing="0.4">
          {`20${month.yy}`}
        </text>
      )}
      <title>{`${def.name} · ${meta.label}`}</title>
    </svg>
  );
}
