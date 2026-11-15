"use client";

const CSS = `
@keyframes wrapped-snow-fall {
  0% { transform: translate3d(0, -6dvh, 0); opacity: 0; }
  8% { opacity: var(--o, 0.85); }
  92% { opacity: var(--o, 0.85); }
  100% { transform: translate3d(var(--dx, 24px), 104dvh, 0); opacity: 0; }
}
@keyframes wrapped-twinkle { 0%, 100% { opacity: 0.25; transform: scale(0.7); } 50% { opacity: 1; transform: scale(1.1); } }
@keyframes wrapped-bulb { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
@keyframes wrapped-breathe { 0%, 100% { opacity: 0.55; } 50% { opacity: 0.9; } }
.wrapped-snow-flake {
  position: absolute; top: 0; border-radius: 9999px; background: #fff;
  animation: wrapped-snow-fall var(--d, 11s) linear var(--delay, 0s) infinite;
}
.wrapped-sparkle { position: absolute; animation: wrapped-twinkle var(--d, 3s) ease-in-out var(--delay, 0s) infinite; }
.wrapped-bulb { position: absolute; border-radius: 9999px; animation: wrapped-bulb 1.9s ease-in-out infinite; }
.wrapped-frost-glow { animation: wrapped-breathe 7s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .wrapped-snow-flake { animation: none; top: 40%; opacity: 0.5; }
  .wrapped-sparkle, .wrapped-bulb, .wrapped-frost-glow { animation: none; }
}
`;

// Positions déterministes (pas de hasard : même rendu côté serveur et client)
const FAR = Array.from({ length: 36 }).map((_, i) => ({
  left: (i * 37 + 5) % 100,
  size: 2 + ((i * 5) % 3), // 2 à 4 px : flocons lointains, lents
  dur: 14 + ((i * 7) % 9),
  delay: -(((i * 53) % 230) / 10),
  dx: (i % 2 ? 1 : -1) * (10 + ((i * 11) % 24)),
  o: 0.5 + ((i * 3) % 4) * 0.1,
}));
const NEAR = Array.from({ length: 12 }).map((_, i) => ({
  left: (i * 29 + 11) % 100,
  size: 6 + ((i * 3) % 6), // 6 à 11 px : gros flocons flous, au premier plan
  dur: 8 + ((i * 5) % 5),
  delay: -(((i * 41) % 130) / 10),
  dx: (i % 2 ? 1 : -1) * (24 + ((i * 13) % 40)),
  o: 0.55 + ((i * 7) % 4) * 0.08,
}));
const SPARKLES = [
  [12, 14, 9], [84, 10, 7], [66, 22, 6], [28, 30, 6], [92, 38, 8], [8, 52, 6], [76, 58, 7], [44, 12, 5],
];
const BULBS = ["#ff6b6f", "#ffd166", "#7ee8b4", "#7cc4ff"];

function Fir({ x, h, fill }: { x: number; h: number; fill: string }) {
  const w = h * 0.55;
  const d = `M0 ${-h} L${w * 0.5} ${-h * 0.55} L${w * 0.28} ${-h * 0.55} L${w * 0.62} ${-h * 0.22} L${w * 0.36} ${-h * 0.22} L${w * 0.75} 0 L${-w * 0.75} 0 L${-w * 0.36} ${-h * 0.22} L${-w * 0.62} ${-h * 0.22} L${-w * 0.28} ${-h * 0.55} L${-w * 0.5} ${-h * 0.55} Z`;
  return (
    <g transform={`translate(${x} 0)`} fill={fill}>
      <path d={d} />
    </g>
  );
}

/**
 * Ambiance d'hiver du Wrapped (novembre et décembre) : voile glacé et lueur boréale,
 * étoiles qui scintillent, deux plans de neige qui tombent, sapins et congères en bas,
 * et en décembre une guirlande lumineuse. Posée sous le contenu, sans interaction,
 * et incluse dans l'image partagée.
 */
export default function WrappedSnow({ december = false }: { december?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
      <style>{CSS}</style>

      {/* Voile glacé : refroidit les couleurs de chaque slide */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(170,205,255,0.30) 0%, rgba(120,160,230,0.10) 45%, rgba(20,40,100,0.30) 100%)" }}
      />
      {/* Lueur boréale en haut */}
      <div
        className="wrapped-frost-glow absolute -inset-x-10 top-0 h-[34%]"
        style={{ background: "linear-gradient(90deg, transparent 0%, rgba(120,235,200,0.35) 30%, rgba(125,185,255,0.35) 60%, rgba(185,150,255,0.3) 85%, transparent 100%)", filter: "blur(36px)" }}
      />
      {/* Givre sur les bords */}
      <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 70px 6px rgba(215,236,255,0.38)" }} />

      {/* Étoiles qui scintillent */}
      {SPARKLES.map(([x, y, s], i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className="wrapped-sparkle"
          style={{ left: `${x}%`, top: `${y}%`, width: s * 2, height: s * 2, "--d": `${2.4 + (i % 4) * 0.7}s`, "--delay": `${-i * 0.5}s` } as React.CSSProperties}
        >
          <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" fill="#fff" />
        </svg>
      ))}

      {/* Guirlande de décembre */}
      {december && (
        <>
          <svg viewBox="0 0 420 40" preserveAspectRatio="none" className="absolute inset-x-0 top-[34px] h-[34px] w-full">
            <path d="M-5 6 Q50 36 105 10 T215 10 T325 10 T425 8" fill="none" stroke="rgba(8,20,50,0.7)" strokeWidth="1.6" />
          </svg>
          {Array.from({ length: 9 }).map((_, i) => (
            <span
              key={i}
              className="wrapped-bulb"
              style={{
                left: `${4 + i * 11.6}%`,
                top: i % 2 ? 52 : 46,
                width: 8,
                height: 11,
                background: BULBS[i % BULBS.length],
                boxShadow: `0 0 10px 2px ${BULBS[i % BULBS.length]}`,
                animationDelay: `${(i * 0.43) % 1.9}s`,
              }}
            />
          ))}
        </>
      )}

      {/* Flocons lointains puis flocons du premier plan */}
      {FAR.map((f, i) => (
        <span
          key={`f${i}`}
          className="wrapped-snow-flake"
          style={{ left: `${f.left}%`, width: f.size, height: f.size, "--d": `${f.dur}s`, "--delay": `${f.delay}s`, "--dx": `${f.dx}px`, "--o": f.o } as React.CSSProperties}
        />
      ))}
      {NEAR.map((f, i) => (
        <span
          key={`n${i}`}
          className="wrapped-snow-flake"
          style={{ left: `${f.left}%`, width: f.size, height: f.size, filter: "blur(1.5px)", "--d": `${f.dur}s`, "--delay": `${f.delay}s`, "--dx": `${f.dx}px`, "--o": f.o } as React.CSSProperties}
        />
      ))}

      {/* Sapins et congères en bas */}
      <svg viewBox="0 0 420 150" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 h-[150px] w-full">
        <g transform="translate(0 132)">
          <Fir x={26} h={92} fill="rgba(8,24,56,0.62)" />
          <Fir x={64} h={64} fill="rgba(8,24,56,0.55)" />
          <Fir x={372} h={100} fill="rgba(8,24,56,0.62)" />
          <Fir x={338} h={58} fill="rgba(8,24,56,0.55)" />
          <Fir x={404} h={60} fill="rgba(8,24,56,0.5)" />
        </g>
        <path d="M0 150 V108 Q70 84 150 104 T300 98 T420 106 V150 Z" fill="#cfe2fa" opacity="0.75" />
        <path d="M0 150 V124 Q90 106 180 122 T330 118 T420 122 V150 Z" fill="#ffffff" opacity="0.95" />
      </svg>
    </div>
  );
}
