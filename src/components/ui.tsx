"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { spineColor, initials } from "../lib/books";

/* ---------------- Couverture ---------------- */

export function Cover({
  id,
  title,
  coverUrl,
  className = "w-12 h-16",
  rounded = "rounded-md",
}: {
  id: number;
  title: string;
  coverUrl?: string | null;
  className?: string;
  rounded?: string;
}) {
  if (coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coverUrl}
        alt={title}
        className={`${className} ${rounded} object-cover shadow-sm`}
      />
    );
  }
  return (
    <div
      className={`${className} ${rounded} flex items-center justify-center shadow-sm`}
      style={{ backgroundColor: spineColor(id) }}
    >
      <span className="font-serif text-cream/95" style={{ fontSize: "1.1em" }}>
        {initials(title)}
      </span>
    </div>
  );
}

/* ---------------- Barre de progression ---------------- */

export function ProgressBar({
  value,
  color = "var(--color-violet)",
  className = "",
}: {
  value: number; // 0..1
  color?: string;
  className?: string;
}) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-[#e6decc] ${className}`}>
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.min(Math.max(value, 0), 1) * 100}%`, backgroundColor: color }}
      />
    </div>
  );
}

/* ---------------- Pastille ---------------- */

const PILL_TONES: Record<string, string> = {
  violet: "bg-violet-soft text-violet-deep",
  sage: "bg-[#eaede2] text-sage",
  neutral: "bg-card text-ink-2 border border-line",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  gold: "bg-amber-soft text-amber-label",
};

export function Pill({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: keyof typeof PILL_TONES | string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium ${PILL_TONES[tone] || PILL_TONES.neutral} ${className}`}
    >
      {children}
    </span>
  );
}

/* ---------------- Bouton ---------------- */

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[13px] font-semibold transition-[colors,transform] duration-[180ms] [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-violet text-cream hover:bg-violet-deep"
      : "bg-card text-ink border border-line hover:bg-paper";
  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}

/* ---------------- Étoiles ---------------- */

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center" style={{ gap: size * 0.18 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          style={{ fontSize: size, color: s <= Math.round(value) ? "var(--color-gold)" : "#dad2c2" }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

/* ---------------- Modale / Feuille ---------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Zone d'action ancrée en bas, hors zone de défilement (reste toujours visible). */
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // `open` ne passe à true que côté client, donc document est disponible ici.
  if (!open || typeof document === "undefined") return null;

  // Rendu via portal sur <body> : les pages utilisent .animate-fadeIn / .reveal,
  // dont le transform/filter persistant crée un bloc conteneur qui capturerait
  // un position:fixed enfant (modale coincée dans la zone de contenu).
  return createPortal((
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 px-0 backdrop-blur-sm sm:items-center sm:px-4 [touch-action:none]"
      onClick={onClose}
    >
      <div
        // Hauteur bornée en dvh pour que le clavier virtuel / la barre Safari ne masquent rien.
        className="animate-fadeIn flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-line bg-paper shadow-2xl sm:max-h-[88dvh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Corps défilant */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 [touch-action:pan-y]">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-serif text-2xl font-black text-ink">{title}</h2>
            <button
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-card text-ink-2 hover:text-ink"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
          {children}
        </div>

        {/* Pied d'action ancré (sticky), toujours visible, respecte la safe-area iOS */}
        {footer && (
          <div className="shrink-0 border-t border-line bg-paper px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  ), document.body);
}

/* ---------------- Interrupteur ---------------- */

/**
 * Interrupteur on/off. Le rail est en inline-flex et ne peut pas se comprimer
 * (shrink-0) : le curseur restait sinon coincé hors du rail quand le libellé
 * voisin était long. Le décalage est calculé pour laisser 2px de marge des deux côtés.
 */
export function Toggle({ on, className = "" }: { on: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
        on ? "bg-violet" : "bg-line"
      } ${className}`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-cream shadow transition-transform duration-200 ${
          on ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </span>
  );
}

/* ---------------- Libellé de champ ---------------- */

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted">
      {children}
    </label>
  );
}

export const inputClass =
  "w-full min-w-0 rounded-xl border border-line bg-input px-3.5 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-violet";

/* ---------------- Avatar membre ---------------- */
export function AvatarImg({
  url,
  name,
  className = "h-10 w-10",
}: {
  url?: string | null;
  name: string;
  className?: string;
}) {
  const initial = name[0]?.toUpperCase() ?? "?";
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-violet font-serif font-semibold text-cream ${className}`}
    >
      {initial}
    </span>
  );
}

