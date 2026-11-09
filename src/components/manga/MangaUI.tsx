"use client";

import { useRef, useState } from "react";
import { spineColor, initials, todayISO, shiftDateISO } from "../../lib/books";
import type { MangaDemographic, MangaStatus, MangaUnit } from "../../lib/manga";
import { MANGA_STATUS_LABELS, MANGA_DEMOGRAPHICS } from "../../lib/manga";

/* ---------------- Couverture ---------------- */

/**
 * MangaDex refuse l'affichage direct de ses images depuis un autre site
 * (redirection anti-hotlink) : on les fait passer par le proxy same-origin.
 */
export function mangaImageSrc(url?: string | null): string | null {
  if (!url) return null;
  return url.includes("uploads.mangadex.org") ? `/api/image-proxy?url=${encodeURIComponent(url)}` : url;
}

export function MangaCover({
  id,
  title,
  coverUrl,
  className = "w-12 h-[4.5rem]",
}: {
  id: number;
  title: string;
  coverUrl?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = mangaImageSrc(coverUrl);
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={title}
        onError={() => setFailed(true)}
        className={`${className} shrink-0 rounded-[4px] border-2 border-ink object-cover`}
      />
    );
  }
  return (
    <div
      className={`${className} flex shrink-0 items-center justify-center rounded-[4px] border-2 border-ink`}
      style={{ backgroundColor: spineColor(id) }}
    >
      <span className="font-serif text-cream" style={{ fontSize: "1.1em" }}>
        {initials(title)}
      </span>
    </div>
  );
}

/* ---------------- Barre de progression encrée ---------------- */

export function InkProgress({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-2.5 w-full overflow-hidden rounded-[3px] border-2 border-ink bg-card ${className}`}>
      <div
        className="manga-tone-band h-full transition-[width] duration-500"
        style={{ width: `${Math.min(Math.max(value, 0), 1) * 100}%` }}
      />
    </div>
  );
}

/* ---------------- Interrupteur chapitres / tomes ---------------- */

export function UnitSwitch({ value, onChange }: { value: MangaUnit; onChange: (u: MangaUnit) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border-2 border-ink bg-card p-1">
      {(["chapter", "volume"] as MangaUnit[]).map((u) => {
        const active = value === u;
        return (
          <button
            key={u}
            type="button"
            onClick={() => onChange(u)}
            className={`rounded-lg py-2 text-[13px] font-bold transition-colors ${
              active ? "bg-ink text-paper" : "text-ink-2 hover:bg-violet-soft"
            }`}
          >
            {u === "chapter" ? "Chapitres / scans" : "Tomes"}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Sélecteur de statut ---------------- */

export function StatusPicker({
  value,
  onChange,
  options = ["reading", "to-read", "completed", "paused", "abandoned"],
}: {
  value: MangaStatus;
  onChange: (s: MangaStatus) => void;
  options?: MangaStatus[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((s) => {
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`rounded-full border-2 px-3 py-1.5 text-[12px] font-bold transition-colors ${
              active ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-2 hover:border-ink"
            }`}
          >
            {MANGA_STATUS_LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Catégorie (shonen, seinen...) ---------------- */

export function DemographicPicker({
  value,
  onChange,
}: {
  value?: MangaDemographic | null;
  onChange: (d: MangaDemographic) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {MANGA_DEMOGRAPHICS.map((d) => {
        const active = value === d.key;
        return (
          <button
            key={d.key}
            type="button"
            title={d.hint}
            onClick={() => onChange(d.key)}
            className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-[12px] font-bold transition-colors ${
              active ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-2 hover:border-ink"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full border border-ink" style={{ background: d.color }} />
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Notation (demi-étoiles) ---------------- */

export function StarPicker({
  value,
  onChange,
  emptyLabel = "Pas de note",
}: {
  value: number;
  onChange: (v: number) => void;
  emptyLabel?: string;
}) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <p className="text-[13px] font-semibold text-muted">
        {display > 0 ? `${display.toFixed(1).replace(".", ",")} / 5` : emptyLabel}
      </p>
      <div className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="relative h-9 w-9 text-[30px] leading-9">
            <span className="text-line">★</span>
            <span
              className="absolute inset-0 overflow-hidden text-violet"
              style={{ width: display >= s ? "100%" : display >= s - 0.5 ? "50%" : "0%" }}
            >
              ★
            </span>
            {/* Deux zones cliquables par étoile : moitié gauche = x,5 */}
            <button
              type="button"
              aria-label={`${s - 0.5} étoiles`}
              className="absolute inset-y-0 left-0 w-1/2"
              onMouseEnter={() => setHover(s - 0.5)}
              onClick={() => onChange(value === s - 0.5 ? 0 : s - 0.5)}
            />
            <button
              type="button"
              aria-label={`${s} étoiles`}
              className="absolute inset-y-0 right-0 w-1/2"
              onMouseEnter={() => setHover(s)}
              onClick={() => onChange(value === s ? 0 : s)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Note affichée en lecture seule : « ★ 4,5 ». */
export function RatingTag({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`nums inline-flex items-center gap-0.5 font-bold text-violet-deep ${className}`}>
      ★ {value.toFixed(1).replace(".", ",")}
    </span>
  );
}

/* ---------------- Barre de date jour par jour ---------------- */

function dateBarLabel(iso: string) {
  const today = todayISO();
  if (iso === today) return "Aujourd'hui";
  if (iso === shiftDateISO(today, -1)) return "Hier";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const sameYear = y === new Date().getFullYear();
  return dt.toLocaleDateString("fr-FR", sameYear ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" });
}

export function DateNavBar({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isToday = value >= todayISO();
  return (
    <div className="flex items-center gap-1 rounded-xl border border-line bg-input px-1.5 py-1.5">
      <button
        type="button"
        onClick={() => onChange(shiftDateISO(value, -1))}
        aria-label="Jour précédent"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-muted transition-colors hover:bg-violet-soft hover:text-violet-deep"
      >
        ‹
      </button>
      <div className="relative min-w-0 flex-1">
        <div className="pointer-events-none flex items-center justify-center py-1.5 text-sm font-semibold text-ink">
          {dateBarLabel(value)}
        </div>
        <input
          ref={inputRef}
          type="date"
          value={value}
          max={todayISO()}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Choisir une date"
        />
      </div>
      <button
        type="button"
        onClick={() => onChange(shiftDateISO(value, 1))}
        disabled={isToday}
        aria-label="Jour suivant"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-muted transition-colors hover:bg-violet-soft hover:text-violet-deep disabled:opacity-30 disabled:hover:bg-transparent"
      >
        ›
      </button>
    </div>
  );
}

/* ---------------- Champ numérique avec - / + ---------------- */

export function Stepper({
  value,
  onChange,
  min = 0,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number | null;
}) {
  const clamp = (v: number) => Math.max(min, max ? Math.min(max, v) : v);
  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border-2 border-ink bg-input">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        className="w-12 shrink-0 text-xl font-bold text-ink hover:bg-violet-soft"
        aria-label="Moins un"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(clamp(parseInt(e.target.value || "0", 10)))}
        className="nums min-w-0 flex-1 bg-transparent py-2.5 text-center font-serif text-2xl text-ink outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        className="w-12 shrink-0 text-xl font-bold text-ink hover:bg-violet-soft"
        aria-label="Plus un"
      >
        +
      </button>
    </div>
  );
}
