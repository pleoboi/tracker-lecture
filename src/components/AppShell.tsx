"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import { supabase } from "../lib/supabase";
import type { Book } from "../lib/types";
import GuideModal from "./GuideModal";
import AddBookModal from "./AddBookModal";
import LogReadingModal from "./LogReadingModal";

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

const desktopNavItems = allNavItems.slice(0, 6);
const mobileNavLeft  = [allNavItems[0], allNavItems[2]];  // Accueil, Journal
const mobileNavRight = [allNavItems[3], allNavItems[4]];  // Découverte, Statistiques

const NO_SHELL_PATHS = ["/login", "/register", "/", "/email-sent"];

function isActive(pathname: string, href: string) {
  if (href === "/accueil") return pathname === "/accueil";
  if (href === "/membres") return pathname.startsWith("/membres") || pathname.startsWith("/membre/");
  return pathname.startsWith(href);
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j.`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
  return `il y a ${Math.floor(days / 30)} mois`;
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

// ── Avatar circulaire (photo ou initiale) ──────────────────────────────────
function AvatarRound({
  avatarUrl,
  initial,
  size = "md",
  active = false,
}: {
  avatarUrl: string | null;
  initial: string;
  size?: "sm" | "md" | "lg";
  active?: boolean;
}) {
  const sizeClass =
    size === "sm" ? "h-8 w-8 text-xs" :
    size === "lg" ? "h-14 w-14 text-xl" :
    "h-9 w-9 text-sm";
  const ring = active ? "ring-2 ring-violet ring-offset-1" : "";
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={avatarUrl}
        alt="Avatar"
        className={`shrink-0 rounded-full object-cover ${sizeClass} ${ring}`}
      />
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-violet font-serif font-semibold text-cream ${sizeClass} ${ring}`}
    >
      {initial}
    </span>
  );
}

// ── Header mobile ──────────────────────────────────────────────────────────
function MobileTopBar({
  avatarUrl,
  initial,
  isAccountActive,
  onGuide,
  newFollowersCount,
  onNotifClick,
}: {
  avatarUrl: string | null;
  initial: string;
  isAccountActive: boolean;
  onGuide: () => void;
  newFollowersCount: number;
  onNotifClick: () => void;
}) {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-line bg-paper/90 px-5 py-2.5 backdrop-blur-md md:hidden">
      <Link href="/accueil" className="font-serif text-[17px] font-black tracking-tight text-ink">
        Ma Bibliothèque
      </Link>
      <div className="flex items-center gap-2">
        <button
          onClick={onGuide}
          aria-label="Guide d'utilisation"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-xs font-bold text-muted"
        >
          ?
        </button>
        <div className="relative">
          <button
            onClick={onNotifClick}
            aria-label="Notifications"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-muted"
          >
            <BellIcon />
          </button>
          {newFollowersCount > 0 && (
            <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet text-[9px] font-bold text-cream">
              {newFollowersCount > 9 ? "9+" : newFollowersCount}
            </span>
          )}
        </div>
        <Link href="/compte" aria-label="Mon compte">
          <AvatarRound avatarUrl={avatarUrl} initial={initial} active={isAccountActive} />
        </Link>
      </div>
    </header>
  );
}

// ── Header desktop ─────────────────────────────────────────────────────────
function TopBar({
  pathname,
  avatarUrl,
  initial,
  onGuide,
  newFollowersCount,
  onNotifClick,
}: {
  pathname: string;
  avatarUrl: string | null;
  initial: string;
  onGuide: () => void;
  newFollowersCount: number;
  onNotifClick: () => void;
}) {
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
                  active ? "bg-violet-soft font-semibold text-violet-deep" : "text-ink-2 hover:bg-card"
                }`}
              >
                <span className={`[&>svg]:h-[18px] [&>svg]:w-[18px] ${active ? "text-violet-deep" : "text-muted"}`}>
                  {item.icon}
                </span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={onGuide}
            title="Guide d'utilisation"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-sm font-bold text-muted transition-colors hover:border-violet hover:text-violet-deep"
          >
            ?
          </button>
          <div className="relative">
            <button
              onClick={onNotifClick}
              title="Notifications"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-muted transition-colors hover:border-violet hover:text-violet-deep"
            >
              <BellIcon />
            </button>
            {newFollowersCount > 0 && (
              <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet text-[9px] font-bold text-cream">
                {newFollowersCount > 9 ? "9+" : newFollowersCount}
              </span>
            )}
          </div>
          <Link href="/compte" aria-label="Mon compte">
            <AvatarRound
              avatarUrl={avatarUrl}
              initial={initial}
              active={isActive(pathname, "/compte")}
            />
          </Link>
        </div>
      </div>
    </header>
  );
}

// ── Nav basse mobile ───────────────────────────────────────────────────────
function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  return (
    <Link href={item.href} className="flex flex-1 flex-col items-center gap-0.5 py-1.5">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors [&>svg]:h-[19px] [&>svg]:w-[19px] ${
          active ? "bg-violet-soft text-violet-deep" : "text-muted"
        }`}
      >
        {item.icon}
      </span>
      <span className={`text-[9px] font-medium ${active ? "text-violet-deep" : "text-muted"}`}>
        {item.name}
      </span>
    </Link>
  );
}

function BottomNav({ pathname, onPlus }: { pathname: string; onPlus: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-card/95 backdrop-blur-md md:hidden">
      <nav className="mx-auto flex max-w-md items-end pt-1.5 pb-[max(env(safe-area-inset-bottom),_1rem)]">
        {mobileNavLeft.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        {/* Bouton + central */}
        <div className="flex flex-1 flex-col items-center pb-0.5">
          <button
            onClick={onPlus}
            aria-label="Actions rapides"
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-violet shadow-[0_4px_16px_rgba(108,75,163,0.45)] transition-transform active:scale-95"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" className="h-7 w-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        {mobileNavRight.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
    </div>
  );
}

// ── AppShell ───────────────────────────────────────────────────────────────
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [showGuide, setShowGuide] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [readingBooks, setReadingBooks] = useState<Book[]>([]);
  const [shellToast, setShellToast] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showNotif, setShowNotif] = useState(false);
  const [newFollowersCount, setNewFollowersCount] = useState(0);
  const [notifFollowers, setNotifFollowers] = useState<{
    id: string;
    display_name: string;
    avatar_url: string | null;
    created_at: string;
    isNew: boolean;
  }[]>([]);

  const displayName =
    user?.user_metadata?.display_name || user?.email?.split("@")[0] || "?";
  const initial = displayName[0]?.toUpperCase() ?? "?";

  const fetchAvatar = async (uid: string) => {
    const { data } = await supabase
      .from("user_profiles")
      .select("avatar_url, has_seen_onboarding")
      .eq("id", uid)
      .single();
    setAvatarUrl((data as { avatar_url?: string | null } | null)?.avatar_url ?? null);

    const hasSeen = (data as { has_seen_onboarding?: boolean | null } | null)?.has_seen_onboarding;
    if (hasSeen === false) {
      setShowGuide(true);
    } else if (data === null && typeof window !== "undefined") {
      const lsKey = `onboarding_done_${uid}`;
      if (!localStorage.getItem(lsKey)) setShowGuide(true);
    }
  };

  const fetchNotifications = async (uid: string) => {
    const { data: followRows } = await supabase
      .from("user_follows")
      .select("follower_id, created_at")
      .eq("following_id", uid)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!followRows || followRows.length === 0) return;

    const ids = (followRows as { follower_id: string; created_at: string }[]).map((r) => r.follower_id);
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, display_name, avatar_url")
      .in("id", ids);

    const profileMap = new Map(
      ((profiles || []) as { id: string; display_name: string; avatar_url: string | null }[]).map((p) => [p.id, p])
    );

    const lastSeen = typeof window !== "undefined"
      ? (localStorage.getItem(`notif_last_seen_${uid}`) ?? "1970-01-01")
      : "1970-01-01";

    const enriched = (followRows as { follower_id: string; created_at: string }[]).map((r) => ({
      id: r.follower_id,
      created_at: r.created_at,
      display_name: profileMap.get(r.follower_id)?.display_name ?? "Membre",
      avatar_url: profileMap.get(r.follower_id)?.avatar_url ?? null,
      isNew: r.created_at > lastSeen,
    }));

    setNotifFollowers(enriched);
    setNewFollowersCount(enriched.filter((f) => f.isNew).length);
  };

  const openNotif = () => {
    setShowNotif(true);
    if (user?.id && typeof window !== "undefined") {
      localStorage.setItem(`notif_last_seen_${user.id}`, new Date().toISOString());
      setNewFollowersCount(0);
      setNotifFollowers((prev) => prev.map((f) => ({ ...f, isNew: false })));
    }
  };

  useEffect(() => {
    if (user?.id) { fetchAvatar(user.id); fetchNotifications(user.id); }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onUpdate = () => { if (user?.id) fetchAvatar(user.id); };
    window.addEventListener("profile-updated", onUpdate);
    return () => window.removeEventListener("profile-updated", onUpdate);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (NO_SHELL_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  const showToast = (msg: string) => {
    setShellToast(msg);
    setTimeout(() => setShellToast(null), 3500);
  };

  const openAdd = () => { setShowActionMenu(false); setShowAdd(true); };

  const openLog = async () => {
    setShowActionMenu(false);
    if (user) {
      const { data } = await supabase
        .from("books")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "reading");
      setReadingBooks((data as Book[]) || []);
    }
    setShowLog(true);
  };

  const handleAdded = (msg: string) => {
    setShowAdd(false);
    showToast(msg);
    window.dispatchEvent(new CustomEvent("books-updated"));
    router.refresh();
  };

  const handleSaved = (msg: string) => {
    setShowLog(false);
    showToast(msg);
    window.dispatchEvent(new CustomEvent("books-updated"));
    router.refresh();
  };

  return (
    <div className="min-h-screen">
      <TopBar
        pathname={pathname}
        avatarUrl={avatarUrl}
        initial={initial}
        onGuide={() => setShowGuide(true)}
        newFollowersCount={newFollowersCount}
        onNotifClick={openNotif}
      />
      <MobileTopBar
        avatarUrl={avatarUrl}
        initial={initial}
        isAccountActive={isActive(pathname, "/compte")}
        onGuide={() => setShowGuide(true)}
        newFollowersCount={newFollowersCount}
        onNotifClick={openNotif}
      />

      <main className="mx-auto w-full max-w-2xl px-5 pb-32 pt-3 md:max-w-6xl md:px-10 md:pb-12 md:pt-6">
        {children}
      </main>

      <BottomNav pathname={pathname} onPlus={() => setShowActionMenu(true)} />

      {/* Menu d'actions rapides */}
      {showActionMenu && (
        <div
          className="fixed inset-0 z-[45] md:hidden"
          onClick={() => setShowActionMenu(false)}
        >
          <div
            className="absolute left-1/2 -translate-x-1/2 w-64 rounded-3xl border border-line bg-paper p-2.5 shadow-2xl"
            style={{ bottom: "calc(max(env(safe-area-inset-bottom), 1rem) + 5rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={openAdd}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-violet-soft active:bg-violet-soft"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-soft">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-violet-deep)" strokeWidth="1.8" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Ajouter un livre</p>
                <p className="text-[11px] text-muted">Rechercher ou saisir manuellement</p>
              </div>
            </button>
            <button
              onClick={openLog}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-violet-soft active:bg-violet-soft"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-soft">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-violet-deep)" strokeWidth="1.8" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Noter ma lecture</p>
                <p className="text-[11px] text-muted">Enregistrer une session</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Panel notifications */}
      {showNotif && (
        <div
          className="fixed inset-0 z-[60]"
          onClick={() => setShowNotif(false)}
        >
          <div
            className="absolute right-5 top-[3.5rem] w-72 overflow-hidden rounded-2xl border border-line bg-paper shadow-2xl md:right-10 md:top-[4.5rem]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h3 className="font-serif text-[15px] font-semibold text-ink">Notifications</h3>
              <button onClick={() => setShowNotif(false)} className="text-xs text-muted">✕</button>
            </div>

            {notifFollowers.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted">
                Personne ne s&apos;est encore abonné à toi.
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {notifFollowers.map((f) => (
                  <Link
                    key={f.id}
                    href={`/membre/${f.id}`}
                    onClick={() => setShowNotif(false)}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-violet-soft"
                  >
                    <AvatarRound
                      avatarUrl={f.avatar_url}
                      initial={f.display_name[0]?.toUpperCase() ?? "?"}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-semibold text-ink">{f.display_name}</p>
                      <p className="text-[11px] text-muted">
                        s&apos;est abonné · {relativeTime(f.created_at)}
                      </p>
                    </div>
                    {f.isNew && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-violet" />
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast global */}
      {shellToast && (
        <div className="fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 rounded-2xl bg-ink px-4 py-2.5 text-sm font-medium text-cream shadow-xl md:bottom-6">
          {shellToast}
        </div>
      )}

      <GuideModal userId={user?.id} open={showGuide} onClose={() => setShowGuide(false)} />

      <AddBookModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={handleAdded}
      />
      <LogReadingModal
        open={showLog}
        onClose={() => setShowLog(false)}
        books={readingBooks}
        onSaved={handleSaved}
      />
    </div>
  );
}
