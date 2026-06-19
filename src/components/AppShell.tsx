"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import GuideModal from "./GuideModal";

type NavItem = { name: string; href: string; icon: React.ReactNode };

const allNavItems: NavItem[] = [
  {
    name: "Accueil",
    href: "/accueil",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[22px] w-[22px]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 4l9 6.5M5 9.5V20h14V9.5" />
      </svg>
    ),
  },
  {
    name: "Bibliothèque",
    href: "/bibliotheque",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[22px] w-[22px]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h5v16H5zM14 4l4 .8-2.6 14.4L11.4 18M5 8h5M5 16h5" />
      </svg>
    ),
  },
  {
    name: "Journal",
    href: "/journal",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[22px] w-[22px]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0-9-9M3 12V3m0 0h9M3 3l7.5 7.5" />
      </svg>
    ),
  },
  {
    name: "Découverte",
    href: "/decouverte",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[22px] w-[22px]">
        <circle cx="12" cy="12" r="9" strokeLinecap="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.5 7.5-3.66 5.5L9 14.5l3.66-5.5L16.5 7.5z" />
      </svg>
    ),
  },
  {
    name: "Statistiques",
    href: "/dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[22px] w-[22px]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 20V11M12 20V4M19 20v-6" />
      </svg>
    ),
  },
  {
    name: "Membres",
    href: "/membres",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[22px] w-[22px]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20a5 5 0 0 0-10 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm6 2a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 6a4 4 0 0 0-3-3.87M1 20a4 4 0 0 1 3-3.87" />
      </svg>
    ),
  },
  {
    name: "Compte",
    href: "/compte",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[22px] w-[22px]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0" />
      </svg>
    ),
  },
];

// Desktop : Accueil → Membres (6 items) + avatar → Compte
const desktopNavItems = allNavItems.slice(0, 6);
// Mobile : Accueil, Bibliothèque, Journal, Découverte, Membres, Compte
const mobileNavItems = [
  ...allNavItems.slice(0, 4),
  allNavItems[5], // Membres
  allNavItems[6], // Compte
];

const NO_SHELL_PATHS = ["/login", "/register", "/"];

function isActive(pathname: string, href: string) {
  if (href === "/accueil") return pathname === "/accueil";
  if (href === "/membres") return pathname.startsWith("/membres") || pathname.startsWith("/membre/");
  return pathname.startsWith(href);
}

function TopBar({
  pathname,
  onGuide,
}: {
  pathname: string;
  onGuide: () => void;
}) {
  const { user } = useAuth();
  const displayName =
    user?.user_metadata?.display_name || user?.email?.split("@")[0] || "?";
  const initial = displayName[0]?.toUpperCase() ?? "?";

  return (
    <header className="sticky top-0 z-50 hidden border-b border-line bg-paper/90 backdrop-blur-md md:block">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-10">
        <Link href="/accueil" className="font-serif text-lg font-black text-ink">
          Ma Bibliothèque
        </Link>

        <nav className="flex items-center gap-0.5">
          {desktopNavItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-violet-soft font-semibold text-violet-deep"
                    : "text-ink-2 hover:bg-card"
                }`}
              >
                <span
                  className={`[&>svg]:h-[18px] [&>svg]:w-[18px] ${
                    active ? "text-violet-deep" : "text-muted"
                  }`}
                >
                  {item.icon}
                </span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {/* Bouton Guide — Desktop */}
          <button
            onClick={onGuide}
            title="Guide d'utilisation"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-sm font-bold text-muted transition-colors hover:border-violet hover:text-violet-deep"
          >
            ?
          </button>

          <Link
            href="/compte"
            className={`flex h-9 w-9 items-center justify-center rounded-full font-serif text-sm font-semibold text-cream transition-opacity hover:opacity-80 ${
              isActive(pathname, "/compte") ? "bg-violet-deep" : "bg-violet"
            }`}
            title={displayName}
          >
            {initial}
          </Link>
        </div>
      </div>
    </header>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-card/95 backdrop-blur-md md:hidden">
      <nav className="mx-auto flex max-w-md items-stretch pb-[env(safe-area-inset-bottom)]">
        {mobileNavItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2"
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors [&>svg]:h-[19px] [&>svg]:w-[19px] ${
                  active ? "bg-violet-soft text-violet-deep" : "text-muted"
                }`}
              >
                {item.icon}
              </span>
              <span
                className={`text-[9px] font-medium ${
                  active ? "text-violet-deep" : "text-muted"
                }`}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showGuide, setShowGuide] = useState(false);

  if (NO_SHELL_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      <TopBar pathname={pathname} onGuide={() => setShowGuide(true)} />
      <main className="mx-auto w-full max-w-2xl px-5 pb-28 pt-2 md:max-w-6xl md:px-10 md:pb-12 md:pt-6">
        {children}
      </main>
      <BottomNav pathname={pathname} />

      {/* Bouton Guide — Mobile uniquement (au-dessus de la barre de nav) */}
      <button
        onClick={() => setShowGuide(true)}
        aria-label="Guide d'utilisation"
        className="fixed bottom-[76px] right-4 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-card text-sm font-bold text-muted shadow-md transition-colors hover:border-violet hover:text-violet-deep md:hidden"
      >
        ?
      </button>

      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}
