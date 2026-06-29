import { ImageResponse } from "next/og";

export const size        = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Dégradé violet (iOS applique ses propres coins arrondis, pas de transparence)
          background: "linear-gradient(145deg, #9b8cd4 0%, #7c5bbf 50%, #5b3fa8 100%)",
        }}
      >
        {/* Nuage blanc centré, occupe ~72% de la largeur */}
        <svg
          viewBox="0 0 100 80"
          width="130"
          height="104"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g fill="white">
            {/* Nuage principal */}
            <path d="M8,68 C2,68 0,64 0,60 C0,52 4,48 12,48 C10,38 16,32 26,32 C24,24 30,18 40,18 C50,18 56,24 58,32 C62,30 70,30 74,36 C82,32 92,38 90,48 C90,56 86,64 78,66 C78,68 76,68 70,68 Z" />
            {/* Étoiles / étincelles */}
            <path d="M22,14 L22.8,16.8 L25.5,17.5 L22.8,18.2 L22,21 L21.2,18.2 L18.5,17.5 L21.2,16.8 Z" />
            <path d="M44,2 L44.9,5.6 L48.5,6.5 L44.9,7.4 L44,11 L43.1,7.4 L39.5,6.5 L43.1,5.6 Z" />
            <path d="M70,13 L70.7,15.6 L73.3,16.3 L70.7,17 L70,19.6 L69.3,17 L66.7,16.3 L69.3,15.6 Z" />
          </g>
        </svg>
      </div>
    ),
    { width: 180, height: 180 }
  );
}
