"use client";

import { useEffect, useState } from "react";
import { BOOK_PANEL } from "./BookSheet";

export type AuthUniverse = "livres" | "manga";
const KEY = "swena-auth-universe";

const QUOTES = [
  { text: "Un lecteur vit mille vies avant de mourir. Celui qui ne lit jamais n'en vit qu'une.", author: "George R. R. Martin" },
  { text: "On ne lit jamais un livre. On se lit à travers les livres.", author: "Romain Rolland" },
  { text: "Lire, c'est boire et manger. L'esprit qui ne lit pas maigrit comme le corps qui ne mange pas.", author: "Victor Hugo" },
];

// Étagère de dos de livres : hauteurs et largeurs fixes (pas d'aléatoire, rendu identique serveur/client).
const SPINES = [
  [58, 14], [72, 18], [64, 12], [80, 20], [54, 16], [68, 13], [76, 22], [60, 15], [84, 17], [66, 12],
  [74, 19], [56, 14], [70, 16], [82, 21], [62, 13], [78, 18], [58, 15], [72, 12], [66, 20], [80, 14],
  [60, 17], [76, 13], [68, 22], [54, 15], [74, 18], [64, 12], [82, 16], [70, 20], [58, 13], [78, 17],
];

function Shelf() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 z-0 overflow-hidden">
      <div className="mx-auto flex w-max items-end gap-[3px] px-2">
        {[...SPINES, ...SPINES].map(([h, w], i) => {
          const tone = [22, 34, 16, 28, 40, 20][i % 6];
          const base = i % 3 === 0 ? "var(--color-ink)" : "var(--color-violet)";
          return (
            <div key={i} className="relative rounded-t-[3px]"
              style={{ height: h, width: w, background: `color-mix(in srgb, ${base} ${tone}%, var(--color-paper))` }}>
              <span className="absolute inset-x-[3px] top-[18%] h-px bg-paper/60" />
              <span className="absolute inset-x-[3px] top-[24%] h-px bg-paper/40" />
            </div>
          );
        })}
      </div>
      <div className="h-2 bg-[color-mix(in_srgb,var(--color-ink)_30%,var(--color-paper))]" />
    </div>
  );
}

function MangaBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Lignes de vitesse rayonnantes depuis le haut */}
      <div className="absolute left-1/2 top-[-40vh] h-[160vh] w-[160vh] -translate-x-1/2"
        style={{ background: "repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--color-ink) 8%, transparent) 0deg 1.2deg, transparent 1.2deg 6deg)",
          maskImage: "radial-gradient(circle, transparent 18%, black 30%, transparent 62%)", WebkitMaskImage: "radial-gradient(circle, transparent 18%, black 30%, transparent 62%)" }} />
    </div>
  );
}

/**
 * Décor des écrans de connexion et d'inscription : univers Livres (étagère, citation)
 * ou Manga (trame, lignes de vitesse, typographie manga), au choix.
 */
export default function AuthScene({ initial, children }: { initial?: AuthUniverse | null; children: (u: AuthUniverse) => React.ReactNode }) {
  const [universe, setUniverse] = useState<AuthUniverse>(initial ?? "livres");
  const [quote, setQuote] = useState(0);

  useEffect(() => {
    if (initial) return;
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "manga" || saved === "livres") setUniverse(saved);
    } catch {}
  }, [initial]);

  useEffect(() => {
    document.documentElement.classList.toggle("manga", universe === "manga");
    try { localStorage.setItem(KEY, universe); } catch {}
    return () => { document.documentElement.classList.remove("manga"); };
  }, [universe]);

  useEffect(() => {
    const id = setInterval(() => setQuote((q) => (q + 1) % QUOTES.length), 7000);
    return () => clearInterval(id);
  }, []);

  const manga = universe === "manga";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-paper px-5 pb-28 pt-10">
      {manga ? <MangaBackdrop /> : <Shelf />}

      <div className="relative z-10 w-full max-w-sm">
        {/* Choix de l'univers */}
        <div className="mx-auto mb-6 flex w-max rounded-full border border-line bg-card p-1 text-[13px] font-semibold shadow-sm">
          {(["livres", "manga"] as const).map((u) => (
            <button key={u} type="button" onClick={() => setUniverse(u)}
              className={`rounded-full px-4 py-1.5 transition-colors ${universe === u ? "bg-violet text-cream" : "text-muted hover:text-ink"}`}>
              {u === "livres" ? "Livres" : "Manga"}
            </button>
          ))}
        </div>

        <div className="mb-7 text-center">
          <h1 className="font-serif text-[44px] font-black leading-none text-ink">Swena</h1>
          {manga ? (
            <p className="mx-auto mt-3 w-max -rotate-1 bg-violet px-3 py-1 text-[13px] font-bold uppercase tracking-wider text-cream">
              Chapitre après chapitre
            </p>
          ) : (
            <figure key={quote} className="animate-fadeIn mx-auto mt-3 max-w-[300px]">
              <blockquote className="font-serif text-[14.5px] italic leading-snug text-ink-2">« {QUOTES[quote].text} »</blockquote>
              <figcaption className="mt-1 text-[11.5px] text-muted">{QUOTES[quote].author}</figcaption>
            </figure>
          )}
        </div>

        {children(universe)}
      </div>
    </div>
  );
}

/** Cadre du formulaire selon l'univers : pile de pages (livres) ou case encrée (manga). */
export const authCardClass = (u: AuthUniverse) =>
  `flex flex-col gap-4 p-6 ${u === "manga" ? "manga-panel" : BOOK_PANEL}`;
