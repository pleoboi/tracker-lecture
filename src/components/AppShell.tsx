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

function SwenaWordmark() {
  return (
    <svg
      viewBox="0 0 308 70"
      xmlns="http://www.w3.org/2000/svg"
      className="h-[32px] w-auto"
    >
      <g transform="translate(0,6) scale(0.71)" className="fill-[#8b79be] dark:fill-[#9b89cf]">
        <path d="M8,68 C2,68 0,64 0,60 C0,52 4,48 12,48 C10,38 16,32 26,32 C24,24 30,18 40,18 C50,18 56,24 58,32 C62,30 70,30 74,36 C82,32 92,38 90,48 C90,56 86,64 78,66 C78,68 76,68 70,68 Z" />
        <path d="M22,17 L22.6,19.4 L25,20 L22.6,20.6 L22,23 L21.4,20.6 L19,20 L21.4,19.4 Z" />
        <path d="M42,2 L42.8,5.2 L46,6 L42.8,6.8 L42,10 L41.2,6.8 L38,6 L41.2,5.2 Z" />
        <path d="M68,15 L68.6,17.4 L71,18 L68.6,18.6 L68,21 L67.4,18.6 L65,18 L67.4,17.4 Z" />
      </g>
      <text
        x="87"
        y="50"
        fontFamily="Fraunces, Georgia, serif"
        fontWeight="700"
        fontSize="50"
        letterSpacing="-1.2"
        className="fill-[#2b2733] dark:fill-[#f0eade]"
      >
        SWENA
      </text>
    </svg>
  );
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
  userId,
  pathname,
  onGuide,
  newFollowersCount,
  onNotifClick,
}: {
  avatarUrl: string | null;
  initial: string;
  userId: string | undefined;
  pathname: string;
  onGuide: () => void;
  newFollowersCount: number;
  onNotifClick: () => void;
}) {
  const profileHref = userId ? `/membre/${userId}` : "/compte";
  const isProfileActive = userId ? pathname === `/membre/${userId}` : pathname === "/compte";
  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between border-b border-line bg-paper/90 px-5 pb-2.5 backdrop-blur-md md:hidden"
      style={{ paddingTop: "max(env(safe-area-inset-top), 0.625rem)" }}
    >
      <Link href="/accueil">
        <SwenaWordmark />
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
        <Link href={profileHref} aria-label="Mon profil">
          <AvatarRound avatarUrl={avatarUrl} initial={initial} active={isProfileActive} />
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
  userId,
  onGuide,
  newFollowersCount,
  onNotifClick,
}: {
  pathname: string;
  avatarUrl: string | null;
  initial: string;
  userId: string | undefined;
  onGuide: () => void;
  newFollowersCount: number;
  onNotifClick: () => void;
}) {
  return (
    <header
      className="sticky top-0 z-50 hidden border-b border-line bg-paper/90 backdrop-blur-md md:block"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-10">
        <Link href="/accueil">
          <SwenaWordmark />
        </Link>

        <nav className="flex items-center gap-0.5">
          {desktopNavItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium"
                style={{
                  background: active ? "color-mix(in srgb, var(--color-violet) 12%, transparent)" : "transparent",
                  color: active ? "var(--color-violet-deep)" : "var(--color-ink-2)",
                  fontWeight: active ? 600 : 500,
                  boxShadow: active ? "0 0 0 1px color-mix(in srgb, var(--color-violet) 20%, transparent)" : "none",
                  transition: "background 0.2s cubic-bezier(0.32,0.72,0,1), color 0.2s cubic-bezier(0.32,0.72,0,1), box-shadow 0.2s cubic-bezier(0.32,0.72,0,1)",
                }}
              >
                <span style={{ color: active ? "var(--color-violet-deep)" : "var(--color-muted)" }} className="[&>svg]:h-[17px] [&>svg]:w-[17px]">
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
          <Link href={userId ? `/membre/${userId}` : "/compte"} aria-label="Mon profil">
            <AvatarRound
              avatarUrl={avatarUrl}
              initial={initial}
              active={userId ? pathname === `/membre/${userId}` : isActive(pathname, "/compte")}
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
    <Link
      href={item.href}
      className="flex flex-1 flex-col items-center gap-0.5 py-1"
      style={{ transition: "opacity 0.18s cubic-bezier(0.32,0.72,0,1)" }}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-2xl [&>svg]:h-[20px] [&>svg]:w-[20px]`}
        style={{
          background: active
            ? "color-mix(in srgb, var(--color-violet) 14%, transparent)"
            : "transparent",
          color: active ? "var(--color-violet-deep)" : "var(--color-muted)",
          transition: "background 0.22s cubic-bezier(0.32,0.72,0,1), color 0.22s cubic-bezier(0.32,0.72,0,1)",
          boxShadow: active
            ? "0 0 0 1px color-mix(in srgb, var(--color-violet) 22%, transparent)"
            : "none",
        }}
      >
        {item.icon}
      </span>
      <span
        className="text-[9px] font-semibold tracking-wide"
        style={{
          color: active ? "var(--color-violet-deep)" : "var(--color-muted)",
          transition: "color 0.22s cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        {item.name}
      </span>
    </Link>
  );
}

function BottomNav({ pathname, onPlus }: { pathname: string; onPlus: () => void }) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const check = () => setKeyboardOpen(window.innerHeight - vv.height > 150);
    vv.addEventListener("resize", check);
    return () => vv.removeEventListener("resize", check);
  }, []);
  if (keyboardOpen) return null;
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 md:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
    >
      {/* Fond avec dégradé de masque vers le bas */}
      <div
        className="absolute inset-x-0 bottom-0 top-[-20px] pointer-events-none"
        style={{
          background: "linear-gradient(to top, color-mix(in srgb, var(--color-paper) 92%, transparent) 60%, transparent)",
        }}
      />
      <nav
        className="relative mx-auto flex max-w-[340px] items-end rounded-[24px] border border-line px-2 pt-1.5 pb-2"
        style={{
          background: "color-mix(in srgb, var(--color-card) 92%, transparent)",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          boxShadow: "0 8px 32px color-mix(in srgb, var(--color-ink) 10%, transparent), 0 1px 0 color-mix(in srgb, var(--color-violet) 8%, transparent) inset",
        }}
      >
        {mobileNavLeft.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        {/* Bouton + central */}
        <div className="flex flex-1 flex-col items-center pb-0.5">
          <button
            onClick={onPlus}
            aria-label="Actions rapides"
            className="-mt-6 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-violet"
            style={{
              boxShadow: "0 6px 20px color-mix(in srgb, var(--color-violet) 55%, transparent), 0 2px 6px color-mix(in srgb, var(--color-violet) 30%, transparent)",
              transition: "transform 0.14s cubic-bezier(0.32,0.72,0,1), box-shadow 0.14s cubic-bezier(0.32,0.72,0,1)",
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.07)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
            onMouseDown={e => (e.currentTarget.style.transform = "scale(0.93)")}
            onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" className="h-6 w-6">
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
  const [likeNotifs, setLikeNotifs] = useState<{
    id: string;
    from_user_id: string;
    from_name: string;
    book_id: number;
    book_title: string;
    created_at: string;
    isNew: boolean;
  }[]>([]);
  const [challengeInvites, setChallengeInvites] = useState<{
    id: string;
    from_name: string;
    challenge_id: string;
    challenge_title: string;
    created_at: string;
    isNew: boolean;
  }[]>([]);
  const [recoNotifs, setRecoNotifs] = useState<{
    id: string;
    from_name: string;
    book_title: string;
    message: string | null;
    created_at: string;
    isNew: boolean;
  }[]>([]);
  const [weeklyRecap, setWeeklyRecap] = useState<{
    pages: number;
    sessions: number;
    booksCompleted: number;
    clubChampion: { name: string; pages: number } | null;
    weekLabel: string;
  } | null>(null);

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

    const lastSeen = typeof window !== "undefined"
      ? (localStorage.getItem(`notif_last_seen_${uid}`) ?? "1970-01-01")
      : "1970-01-01";

    // Likes + invitations challenges + recommandations (parallèle)
    const [{ data: likeRows }, { data: inviteRows }, { data: recoRows }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, from_user_id, book_id, book_title, created_at")
        .eq("user_id", uid)
        .eq("type", "review_like")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("notifications")
        .select("id, from_user_id, challenge_id, book_title, created_at")
        .eq("user_id", uid)
        .eq("type", "challenge_invite")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("notifications")
        .select("id, from_user_id, book_title, message, created_at")
        .eq("user_id", uid)
        .eq("type", "book_recommendation")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    // Abonnés
    let enriched: { id: string; created_at: string; display_name: string; avatar_url: string | null; isNew: boolean }[] = [];
    if (followRows && followRows.length > 0) {
      const ids = (followRows as { follower_id: string; created_at: string }[]).map((r) => r.follower_id);
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, display_name, avatar_url")
        .in("id", ids);
      const profileMap = new Map(
        ((profiles || []) as { id: string; display_name: string; avatar_url: string | null }[]).map((p) => [p.id, p])
      );
      enriched = (followRows as { follower_id: string; created_at: string }[]).map((r) => ({
        id: r.follower_id,
        created_at: r.created_at,
        display_name: profileMap.get(r.follower_id)?.display_name ?? "Membre",
        avatar_url: profileMap.get(r.follower_id)?.avatar_url ?? null,
        isNew: r.created_at > lastSeen,
      }));
    }
    setNotifFollowers(enriched);

    // Likes
    let enrichedLikes: { id: string; from_user_id: string; from_name: string; book_id: number; book_title: string; created_at: string; isNew: boolean }[] = [];
    if (likeRows && likeRows.length > 0) {
      type LikeRow = { id: string; from_user_id: string; book_id: number; book_title: string; created_at: string };
      const senderIds = [...new Set((likeRows as LikeRow[]).map((r) => r.from_user_id))];
      const { data: senderProfiles } = await supabase.from("user_profiles").select("id, display_name").in("id", senderIds);
      const senderMap = new Map(((senderProfiles || []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name]));
      enrichedLikes = (likeRows as LikeRow[]).map((r) => ({
        id: r.id,
        from_user_id: r.from_user_id,
        from_name: senderMap.get(r.from_user_id) ?? "Membre",
        book_id: r.book_id,
        book_title: r.book_title ?? "un livre",
        created_at: r.created_at,
        isNew: r.created_at > lastSeen,
      }));
    }
    setLikeNotifs(enrichedLikes);

    // Invitations challenges
    let enrichedInvites: typeof challengeInvites = [];
    if (inviteRows && inviteRows.length > 0) {
      type InviteRow = { id: string; from_user_id: string; challenge_id: string; book_title: string; created_at: string };
      const fromIds = [...new Set((inviteRows as InviteRow[]).map((r) => r.from_user_id))];
      const { data: fromProfiles } = await supabase.from("user_profiles").select("id, display_name").in("id", fromIds);
      const fromMap = new Map(((fromProfiles || []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name]));
      enrichedInvites = (inviteRows as InviteRow[]).map((r) => ({
        id: r.id,
        from_name: fromMap.get(r.from_user_id) ?? "Membre",
        challenge_id: r.challenge_id,
        challenge_title: r.book_title ?? "Challenge",
        created_at: r.created_at,
        isNew: r.created_at > lastSeen,
      }));
    }
    setChallengeInvites(enrichedInvites);

    // Recommandations de livres
    let enrichedRecos: typeof recoNotifs = [];
    if (recoRows && recoRows.length > 0) {
      type RecoRow = { id: string; from_user_id: string; book_title: string; message: string | null; created_at: string };
      const recoFromIds = [...new Set((recoRows as RecoRow[]).map((r) => r.from_user_id))];
      const { data: recoProfiles } = await supabase.from("user_profiles").select("id, display_name").in("id", recoFromIds);
      const recoMap = new Map(((recoProfiles || []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name]));
      enrichedRecos = (recoRows as RecoRow[]).map((r) => ({
        id: r.id,
        from_name: recoMap.get(r.from_user_id) ?? "Membre",
        book_title: r.book_title ?? "un livre",
        message: r.message ?? null,
        created_at: r.created_at,
        isNew: r.created_at > lastSeen,
      }));
    }
    setRecoNotifs(enrichedRecos);

    setNewFollowersCount(
      enriched.filter((f) => f.isNew).length +
      enrichedLikes.filter((l) => l.isNew).length +
      enrichedInvites.filter((i) => i.isNew).length +
      enrichedRecos.filter((r) => r.isNew).length
    );
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
    if (!user?.id || typeof window === "undefined") return;
    const today = new Date();
    if (today.getDay() !== 1) return; // seulement le lundi
    const mondayKey = today.toISOString().split("T")[0];
    if (localStorage.getItem(`weeklyRecap_${mondayKey}`)) return; // déjà vu

    const prevWeekEnd = new Date(today);
    prevWeekEnd.setDate(today.getDate() - 1);
    const prevWeekStart = new Date(today);
    prevWeekStart.setDate(today.getDate() - 7);
    const startStr = prevWeekStart.toISOString().split("T")[0];
    const endStr = prevWeekEnd.toISOString().split("T")[0];

    const weekLabel = `${prevWeekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} – ${prevWeekEnd.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;

    (async () => {
      const uid = user.id;
      const [{ data: myLogs }, { data: followRows }] = await Promise.all([
        supabase.from("reading_logs").select("pages_read, date, book_id").eq("user_id", uid).gte("date", startStr).lte("date", endStr),
        supabase.from("user_follows").select("following_id").eq("follower_id", uid),
      ]);

      const myPages = ((myLogs ?? []) as { pages_read: number }[]).reduce((s, l) => s + (l.pages_read || 0), 0);
      const mySessions = (myLogs ?? []).length;

      const { data: completedBooks } = await supabase.from("books").select("id").eq("user_id", uid).eq("status", "completed").gte("date_read", startStr).lte("date_read", endStr);
      const booksCompleted = (completedBooks ?? []).length;

      let clubChampion: { name: string; pages: number } | null = null;
      const followedIds = ((followRows ?? []) as { following_id: string }[]).map((r) => r.following_id);
      if (followedIds.length > 0) {
        const { data: clubLogs } = await supabase.from("reading_logs").select("user_id, pages_read").in("user_id", followedIds).gte("date", startStr).lte("date", endStr);
        if (clubLogs?.length) {
          const pagesByUser = new Map<string, number>();
          (clubLogs as { user_id: string; pages_read: number }[]).forEach((l) => {
            pagesByUser.set(l.user_id, (pagesByUser.get(l.user_id) ?? 0) + (l.pages_read || 0));
          });
          const [champId, champPages] = [...pagesByUser.entries()].sort((a, b) => b[1] - a[1])[0];
          if (champPages > 0) {
            const { data: champProfile } = await supabase.from("user_profiles").select("display_name").eq("id", champId).single();
            clubChampion = { name: (champProfile as { display_name: string } | null)?.display_name ?? "Membre", pages: champPages };
          }
        }
      }

      if (myPages > 0 || mySessions > 0 || booksCompleted > 0) {
        setWeeklyRecap({ pages: myPages, sessions: mySessions, booksCompleted, clubChampion, weekLabel });
      }
    })();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restaure le thème persisté dès le montage
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    if (saved === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, []);

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
        userId={user?.id}
        onGuide={() => setShowGuide(true)}
        newFollowersCount={newFollowersCount}
        onNotifClick={openNotif}
      />
      <MobileTopBar
        avatarUrl={avatarUrl}
        initial={initial}
        userId={user?.id}
        pathname={pathname}
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

            {notifFollowers.length === 0 && likeNotifs.length === 0 && challengeInvites.length === 0 && recoNotifs.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted">
                Aucune notification pour l&apos;instant.
              </p>
            ) : (
              <div className="max-h-[28rem] overflow-y-auto">
                {/* Invitations challenges — toujours en tête */}
                {challengeInvites.map((inv) => (
                  <div key={`inv-${inv.id}`} className="border-b border-line px-4 py-3">
                    <div className="flex items-start gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-soft text-sm">⚡</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-semibold text-ink">
                          {inv.from_name} <span className="font-normal text-muted">t&apos;invite au challenge</span>
                        </p>
                        <p className="truncate text-[11px] font-medium text-violet-deep">{inv.challenge_title}</p>
                        <p className="text-[10px] text-muted">{relativeTime(inv.created_at)}</p>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={async () => {
                              if (!user?.id) return;
                              await supabase.from("challenge_participants").update({ status: "accepted" }).eq("challenge_id", inv.challenge_id).eq("user_id", user.id);
                              await supabase.from("notifications").delete().eq("id", inv.id);
                              setChallengeInvites((prev) => prev.filter((i) => i.id !== inv.id));
                              setNewFollowersCount((n) => Math.max(0, n - (inv.isNew ? 1 : 0)));
                            }}
                            className="flex-1 rounded-xl bg-violet py-1.5 text-[11px] font-bold text-cream"
                          >
                            Rejoindre
                          </button>
                          <button
                            onClick={async () => {
                              if (!user?.id) return;
                              await supabase.from("challenge_participants").update({ status: "declined" }).eq("challenge_id", inv.challenge_id).eq("user_id", user.id);
                              await supabase.from("notifications").delete().eq("id", inv.id);
                              setChallengeInvites((prev) => prev.filter((i) => i.id !== inv.id));
                              setNewFollowersCount((n) => Math.max(0, n - (inv.isNew ? 1 : 0)));
                            }}
                            className="flex-1 rounded-xl border border-line bg-card py-1.5 text-[11px] font-medium text-muted"
                          >
                            Refuser
                          </button>
                        </div>
                      </div>
                      {inv.isNew && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet" />}
                    </div>
                  </div>
                ))}

                {/* Recommandations de livres */}
                {recoNotifs.map((reco) => (
                  <div key={`reco-${reco.id}`} className="border-b border-line px-4 py-3">
                    <div className="flex items-start gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-soft text-sm">📚</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-semibold text-ink">
                          {reco.from_name} <span className="font-normal text-muted">te recommande</span>
                        </p>
                        <p className="truncate text-[11px] font-medium text-violet-deep">{reco.book_title}</p>
                        {reco.message && (
                          <p className="mt-0.5 line-clamp-2 text-[11px] italic text-muted">&ldquo;{reco.message}&rdquo;</p>
                        )}
                        <p className="mt-0.5 text-[10px] text-muted">{relativeTime(reco.created_at)}</p>
                        <button
                          onClick={async () => {
                            await supabase.from("notifications").delete().eq("id", reco.id);
                            setRecoNotifs((prev) => prev.filter((r) => r.id !== reco.id));
                            setNewFollowersCount((n) => Math.max(0, n - (reco.isNew ? 1 : 0)));
                          }}
                          className="mt-1.5 text-[11px] font-medium text-muted underline-offset-2 hover:underline"
                        >
                          Ignorer
                        </button>
                      </div>
                      {reco.isNew && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet" />}
                    </div>
                  </div>
                ))}

                {/* Likes + abonnés triés par date */}
                {[
                  ...likeNotifs.map((n) => ({ ...n, _type: "like" as const })),
                  ...notifFollowers.map((f) => ({ ...f, _type: "follow" as const })),
                ]
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .map((item) =>
                    item._type === "like" ? (
                      <Link
                        key={`like-${item.id}`}
                        href={`/livre/${(item as typeof likeNotifs[0] & { _type: "like" }).book_id}`}
                        onClick={() => setShowNotif(false)}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-violet-soft"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-soft text-sm text-danger">♥</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-semibold text-ink">
                            {(item as typeof likeNotifs[0] & { _type: "like" }).from_name}{" "}
                            <span className="font-normal text-muted">a aimé ta critique sur</span>
                          </p>
                          <p className="truncate text-[11px] text-muted italic">
                            {(item as typeof likeNotifs[0] & { _type: "like" }).book_title} · {relativeTime(item.created_at)}
                          </p>
                        </div>
                        {item.isNew && <span className="h-2 w-2 shrink-0 rounded-full bg-danger" />}
                      </Link>
                    ) : (
                      <Link
                        key={`follow-${item.id}`}
                        href={`/membre/${item.id}`}
                        onClick={() => setShowNotif(false)}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-violet-soft"
                      >
                        <AvatarRound
                          avatarUrl={(item as typeof notifFollowers[0] & { _type: "follow" }).avatar_url}
                          initial={(item as typeof notifFollowers[0] & { _type: "follow" }).display_name[0]?.toUpperCase() ?? "?"}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-semibold text-ink">
                            {(item as typeof notifFollowers[0] & { _type: "follow" }).display_name}
                          </p>
                          <p className="text-[11px] text-muted">
                            s&apos;est abonné · {relativeTime(item.created_at)}
                          </p>
                        </div>
                        {item.isNew && <span className="h-2 w-2 shrink-0 rounded-full bg-violet" />}
                      </Link>
                    )
                  )}
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

      {/* Récap hebdo du lundi */}
      {weeklyRecap && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-5">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-paper shadow-2xl">
            {/* Header */}
            <div className="relative flex flex-col items-center gap-1 px-6 pb-4 pt-7"
              style={{ background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 60%, #4f46e5 100%)" }}>
              <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
              <span className="text-3xl">📚</span>
              <h2 className="font-serif text-xl font-black text-white">Récap de la semaine</h2>
              <p className="text-[11px] font-medium text-white/60">{weeklyRecap.weekLabel}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
              {[
                { value: weeklyRecap.pages.toLocaleString("fr-FR"), label: "pages" },
                { value: String(weeklyRecap.sessions), label: "sessions" },
                { value: String(weeklyRecap.booksCompleted), label: weeklyRecap.booksCompleted > 1 ? "livres terminés" : "livre terminé" },
              ].map(({ value, label }) => (
                <div key={label} className="flex flex-col items-center gap-0.5 py-5">
                  <span className="font-serif text-2xl font-black text-ink">{value}</span>
                  <span className="text-[10px] text-muted">{label}</span>
                </div>
              ))}
            </div>

            {/* Champion du club */}
            <div className="px-6 py-4">
              {weeklyRecap.clubChampion ? (
                <div className="flex items-center gap-3 rounded-2xl border border-violet/20 bg-violet-soft px-4 py-3">
                  <span className="text-xl">🏆</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Champion du club</p>
                    <p className="truncate font-serif text-[15px] font-bold text-ink">{weeklyRecap.clubChampion.name}</p>
                    <p className="text-[11px] text-violet-deep">{weeklyRecap.clubChampion.pages.toLocaleString("fr-FR")} pages</p>
                  </div>
                </div>
              ) : (
                <p className="text-center text-[12px] text-muted">Pas encore d&apos;activité dans le club cette semaine.</p>
              )}
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={() => {
                  if (user?.id && typeof window !== "undefined") {
                    const mondayKey = new Date().toISOString().split("T")[0];
                    localStorage.setItem(`weeklyRecap_${mondayKey}`, "1");
                  }
                  setWeeklyRecap(null);
                }}
                className="w-full rounded-2xl bg-violet py-3.5 text-[14px] font-bold text-cream"
              >
                C&apos;est parti pour cette semaine 🚀
              </button>
            </div>
          </div>
        </div>
      )}

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
