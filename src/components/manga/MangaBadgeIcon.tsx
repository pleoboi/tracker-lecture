import type { MangaBadgeIconKey, MangaBadgeTier } from "../../lib/mangaBadges";
import { TIER_META } from "../../lib/badges";

// Pictogrammes simples (trait, 24×24) : aucun visuel officiel des séries, juste
// un symbole évocateur par badge.
const ICONS: Record<MangaBadgeIconKey, React.ReactNode> = {
  scroll: (<><path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2H8a2 2 0 0 1-2-2V4z" /><path d="M6 4a2 2 0 0 0-2 2v1h2M10 9h6M10 13h6" /></>),
  stack: (<><path d="M4 7l8-4 8 4-8 4-8-4z" /><path d="M4 12l8 4 8-4M4 16.5l8 4 8-4" /></>),
  check: (<><path d="M6 3h12v18l-6-4-6 4V3z" /><path d="M9 10l2 2 4-4" /></>),
  shelf: (<><path d="M5 4h3v16H5zM10 6h3v14h-3z" /><path d="M15.5 5.5l3-.8 3.2 14.6-3 .7z" /></>),
  compass: (<><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>),
  flame: (<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" />),
  bolt: (<path d="M13 2L5 13h6l-1 9 8-11h-6l1-9z" />),
  star: (<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" />),
  target: (<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>),
  hat: (<><path d="M3 14c0-1 4-2 9-2s9 1 9 2-4 3-9 3-9-2-9-3z" /><path d="M7 13c0-5 2-8 5-8s5 3 5 8M8 10.5h8" /></>),
  crown: (<><path d="M3 18h18M4 18L3 7l5 4 4-6 4 6 5-4-1 11" /></>),
  leaf: (<><path d="M12 21V9" /><path d="M12 9C8 9 5 6 5 3c4 0 7 2 7 6zM12 9c4 0 7-3 7-6-4 0-7 2-7 6z" /></>),
  orb: (<><circle cx="12" cy="12" r="9" /><path d="M12 8.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z" /></>),
  blade: (<path d="M20 4L9 15M10 9l5 5M9 15l-5 5" />),
  gear: (<><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="6.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>),
  notebook: (<><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M6 7h12M10 12h4M10 15h4" /></>),
  wings: (<path d="M12 12c-2-5-6-7-9-7 1 4 3 8 9 11 6-3 8-7 9-11-3 0-7 2-9 7z" />),
  diamond: (<path d="M12 3l8 9-8 9-8-9zM4 12h16" />),
  greatsword: (<path d="M12 2l2 4v12h-4V6l2-4zM8 18h8M12 18v4" />),
  enso: (<path d="M17.5 6.5A8 8 0 1 0 20 12" />),
  eye: (<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  wave: (<path d="M2 9c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 19c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />),
  fist: (<path d="M7 11V7a1.5 1.5 0 0 1 3 0v3M10 10V6a1.5 1.5 0 0 1 3 0v4M13 10V7a1.5 1.5 0 0 1 3 0v4M16 11V9a1.5 1.5 0 0 1 3 0v6c0 4-3 6-7 6s-6-2-7-5l-1-4a1.5 1.5 0 0 1 3-1l1 2" />),
  saw: (<path d="M3 9h13v6H3zM16 11h5M16 13h5M5 9V7M8 9V7M11 9V7M14 9V7M5 15v2M8 15v2M11 15v2M14 15v2" />),
  ball: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>),
  wand: (<path d="M5 19L16 8M14 4v4M12 6h4M18 11v4M16 13h4" />),
};

export function MangaBadgeGlyph({ icon, className = "h-6 w-6" }: { icon: MangaBadgeIconKey; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {ICONS[icon]}
    </svg>
  );
}

/** Médaille : pictogramme dans un disque encré, couleur du palier en bordure. Grisée tant que verrouillée. */
export function MangaBadgeMedal({
  icon,
  tier,
  unlocked = true,
  className = "h-16 w-16",
}: {
  icon: MangaBadgeIconKey;
  tier: MangaBadgeTier;
  unlocked?: boolean;
  className?: string;
}) {
  const tone = TIER_META[tier].stroke;
  return (
    <div
      className={`${className} relative flex shrink-0 items-center justify-center rounded-full border-2 border-ink bg-card transition-opacity ${
        unlocked ? "" : "opacity-40 grayscale"
      }`}
      style={unlocked ? { boxShadow: `inset 0 0 0 3px var(--color-card), inset 0 0 0 5px ${tone}` } : undefined}
    >
      <div className="h-[46%] w-[46%]" style={{ color: unlocked ? tone : "var(--color-muted)" }}>
        <MangaBadgeGlyph icon={icon} className="h-full w-full" />
      </div>
    </div>
  );
}
