"use client";

// Icônes des salons de club — traits SVG (même langage que le reste du site),
// pas d'émoji.
const PATHS: Record<string, React.ReactNode> = {
  chat: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V6.8c0-1 .8-1.8 1.8-1.8h12.4c1 0 1.8.8 1.8 1.8v8.4c0 1-.8 1.8-1.8 1.8H9l-5 3z" />
  ),
  wave: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9.5" r="2.3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 20a5.5 5.5 0 0 1 11 0M14.6 20a4 4 0 0 1 5.9-3.5" />
    </>
  ),
  book: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5c0-.83.67-1.5 1.5-1.5H11v15H5.5A1.5 1.5 0 0 1 4 17.5v-12ZM20 5.5c0-.83-.67-1.5-1.5-1.5H13v15h5.5c.83 0 1.5-.67 1.5-1.5v-12Z" />
  ),
  coffee: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 10.5h1.3a2.4 2.4 0 0 1 0 4.8H16M8.2 5.3C8.2 4.4 9 3.9 9 3M12 5.3c0-.9.8-1.4.8-2.3" />
    </>
  ),
  film: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
      <path strokeLinecap="round" d="M8 5.5v13M16 5.5v13M3.5 9.5H8M3.5 14.5H8M16 9.5h4.5M16 14.5h4.5" />
    </>
  ),
  pencil: (
    <path strokeLinecap="round" strokeLinejoin="round" d="m4 20 1-4.2L15.8 5a1.5 1.5 0 0 1 2.1 0l1.1 1.1a1.5 1.5 0 0 1 0 2.1L8.2 19 4 20Z" />
  ),
  bookmark: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z" />
  ),
};

export const ROOM_ICON_KEYS = Object.keys(PATHS);

export function RoomIcon({ icon, className = "h-4 w-4" }: { icon: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      {PATHS[icon] ?? PATHS.chat}
    </svg>
  );
}
