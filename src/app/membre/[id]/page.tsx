"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import type { Book, ReadingLog } from "../../../lib/types";
import { pct, isCompleted } from "../../../lib/books";
import { Cover, ProgressBar, AvatarImg } from "../../../components/ui";
import { ObjectiveChart, RatingsChart } from "../../../components/DashboardWidgets";
import AddToLibraryModal from "../../../components/AddToLibraryModal";
import BadgesSection from "../../../components/BadgesSection";
import {
  GenreBreakdown,
  FictionDonut,
  PageCountHistogram,
  AuthorDeepDive,
  CriticalDivergence,
  PublicationTimeline,
} from "../../../components/AdvancedStats";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const VIOLET = "var(--color-violet)";
const VIOLET_LT = "#d8cfe6";

type TabId = "bibliotheque" | "statistiques" | "collection" | "challenges" | "listes";

interface Profile {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  created_at: string;
  bio?: string | null;
  favorite_book_ids?: number[] | null;
}

interface ChallengeParticipantRow {
  user_id: string;
  status: string;
}

interface ChallengeRow {
  id: string;
  creator_id: string;
  title: string;
  metric: "pages" | "books" | "sessions";
  target_value: number | null;
  start_date: string;
  end_date: string;
  created_at: string;
  challenge_participants: ChallengeParticipantRow[];
}

// ── Score loader ──────────────────────────────────────────────────────────────
async function loadChallengeScores(
  challenge: Pick<ChallengeRow, "metric" | "start_date" | "end_date">,
  participantIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!participantIds.length) return map;
  if (challenge.metric === "pages") {
    const { data } = await supabase
      .from("reading_logs")
      .select("user_id, pages_read")
      .in("user_id", participantIds)
      .gte("date", challenge.start_date)
      .lte("date", challenge.end_date);
    for (const r of (data ?? []) as { user_id: string; pages_read: number }[])
      map.set(r.user_id, (map.get(r.user_id) ?? 0) + (r.pages_read ?? 0));
  } else if (challenge.metric === "books") {
    const { data } = await supabase
      .from("books")
      .select("user_id")
      .in("user_id", participantIds)
      .eq("status", "completed")
      .gte("date_read", challenge.start_date)
      .lte("date_read", challenge.end_date);
    for (const r of (data ?? []) as { user_id: string }[])
      map.set(r.user_id, (map.get(r.user_id) ?? 0) + 1);
  } else {
    const { data } = await supabase
      .from("reading_logs")
      .select("user_id")
      .in("user_id", participantIds)
      .gte("date", challenge.start_date)
      .lte("date", challenge.end_date);
    for (const r of (data ?? []) as { user_id: string }[])
      map.set(r.user_id, (map.get(r.user_id) ?? 0) + 1);
  }
  return map;
}

// ── Challenge Card ────────────────────────────────────────────────────────────
function ChallengeCard({ challenge, currentUserId, profileMap, onUpdate }: {
  challenge: ChallengeRow;
  currentUserId?: string;
  profileMap: Map<string, { display_name: string; avatar_url: string | null }>;
  onUpdate: () => void;
}) {
  const [scores, setScores] = useState<Map<string, number> | null>(null);
  const [loadingScores, setLoadingScores] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const isActive = challenge.start_date <= today && challenge.end_date >= today;
  const isEnded = challenge.end_date < today;
  const isUpcoming = challenge.start_date > today;

  const accepted = challenge.challenge_participants.filter((p) => p.status === "accepted");
  const pendingMe = challenge.challenge_participants.find(
    (p) => p.user_id === currentUserId && p.status === "pending"
  );

  useEffect(() => {
    if ((!isActive && !isEnded) || !accepted.length) return;
    setLoadingScores(true);
    loadChallengeScores(challenge, accepted.map((p) => p.user_id)).then((s) => {
      setScores(s);
      setLoadingScores(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.id]);

  const sorted = scores
    ? accepted.slice().sort((a, b) => (scores.get(b.user_id) ?? 0) - (scores.get(a.user_id) ?? 0))
    : accepted;

  const metricLabel = challenge.metric === "pages" ? "pages" : challenge.metric === "books" ? "livres" : "sessions";
  const statusLabel = isUpcoming ? "À venir" : isEnded ? "Terminé" : "En cours";
  const statusCls = isUpcoming
    ? "bg-[#fef3c7] text-[#b45309] dark:bg-[#2a1f0a] dark:text-[#f59e0b]"
    : isEnded
    ? "border border-line bg-card text-muted"
    : "bg-[#d1fae5] text-[#065f46] dark:bg-[#0a2a1a] dark:text-[#34d399]";

  const handleAccept = async () => {
    await supabase
      .from("challenge_participants")
      .update({ status: "accepted" })
      .eq("challenge_id", challenge.id)
      .eq("user_id", currentUserId);
    onUpdate();
  };
  const handleDecline = async () => {
    await supabase
      .from("challenge_participants")
      .update({ status: "declined" })
      .eq("challenge_id", challenge.id)
      .eq("user_id", currentUserId);
    onUpdate();
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="font-serif text-[15px] font-semibold text-ink">{challenge.title}</p>
          <p className="mt-0.5 text-[11px] text-muted">
            {new Date(challenge.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} —{" "}
            {new Date(challenge.end_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · {metricLabel}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusCls}`}>
          {statusLabel}
        </span>
      </div>

      {pendingMe && (
        <div className="flex items-center gap-2 border-t border-line bg-violet-soft px-4 py-3">
          <p className="flex-1 text-[12px] font-medium text-ink">Tu es invité à ce challenge</p>
          <button
            onClick={handleAccept}
            className="rounded-xl bg-violet px-3 py-1.5 text-[11px] font-bold text-cream"
          >
            Accepter
          </button>
          <button
            onClick={handleDecline}
            className="rounded-xl border border-line bg-card px-3 py-1.5 text-[11px] font-medium text-muted"
          >
            Décliner
          </button>
        </div>
      )}

      {(isActive || isEnded) && accepted.length > 0 && (
        <div className="border-t border-line px-4 pb-4 pt-3">
          {loadingScores ? (
            <p className="py-2 text-center text-[11px] text-muted">Chargement du classement…</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {sorted.map((p, i) => {
                const score = scores?.get(p.user_id) ?? 0;
                const prof = profileMap.get(p.user_id);
                const isMe = p.user_id === currentUserId;
                const maxScore = scores ? Math.max(...[...scores.values()], 1) : 1;
                const barPct = Math.min(100, (score / maxScore) * 100);
                return (
                  <div
                    key={p.user_id}
                    className={`flex items-center gap-2 rounded-xl p-2 ${isMe ? "bg-violet-soft" : ""}`}
                  >
                    <span className="w-4 shrink-0 text-center text-[10px] font-bold text-muted">{i + 1}</span>
                    <AvatarImg
                      url={prof?.avatar_url ?? null}
                      name={prof?.display_name ?? "?"}
                      className="h-6 w-6 shrink-0 text-[9px]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-ink">
                        {prof?.display_name ?? "Membre"}
                        {isMe && <span className="ml-1 text-[9.5px] font-normal text-muted">(toi)</span>}
                      </p>
                      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-line">
                        <div className="h-full rounded-full bg-violet" style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                    <span className="shrink-0 text-[10.5px] font-bold text-ink">
                      {score.toLocaleString("fr-FR")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MembrePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const memberId = params.id as string;
  const isOwn = user?.id === memberId;

  // Existing state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [favoriteBooks, setFavoriteBooks] = useState<Book[]>([]);
  const [sessionPhotos, setSessionPhotos] = useState<{ url: string; date: string; bookTitle: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addTarget, setAddTarget] = useState<Book | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const [championDays, setChampionDays] = useState(0);
  const [noteModal, setNoteModal] = useState<{
    type: "review" | "session";
    text: string;
    bookTitle?: string;
    bookId: number;
    reviewerUserId: string;
  } | null>(null);
  const [noteLiked, setNoteLiked] = useState(false);
  const [noteLikeCount, setNoteLikeCount] = useState(0);
  const [noteLikeLoading, setNoteLikeLoading] = useState(false);

  // Follow system
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [followListType, setFollowListType] = useState<"followers" | "following" | null>(null);
  const [followList, setFollowList] = useState<{ id: string; display_name: string; avatar_url: string | null }[]>([]);

  // Tabs
  const [activeTab, setActiveTab] = useState<TabId>("bibliotheque");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "rating" | "title">("date");
  const [libLimit, setLibLimit] = useState(20);

  // Listes thématiques
  const [lists, setLists] = useState<{ id: string; title: string; description: string | null; created_at: string; covers: (string | null)[]; count: number }[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [creatingList, setCreatingList] = useState(false);

  const loadLists = useCallback(async () => {
    setListsLoading(true);
    const { data } = await supabase.from("book_lists").select("id, title, description, created_at").eq("user_id", memberId).order("created_at", { ascending: false });
    const rows = (data ?? []) as { id: string; title: string; description: string | null; created_at: string }[];
    // Fetch first 4 covers per list
    const withCovers = await Promise.all(rows.map(async (l) => {
      const { data: items, count: totalCount } = await supabase.from("book_list_items").select("book_cover_url", { count: "exact" }).eq("list_id", l.id).order("position").limit(4);
      return { ...l, covers: ((items ?? []) as { book_cover_url: string | null }[]).map((i) => i.book_cover_url), count: totalCount ?? 0 };
    }));
    setLists(withCovers);
    setListsLoading(false);
  }, [memberId]);

  // Recommandation
  const [showRecoModal, setShowRecoModal] = useState(false);
  const [recoBooks, setRecoBooks] = useState<{ id: number; title: string; author: string; cover_url: string | null }[]>([]);
  const [recoSearch, setRecoSearch] = useState("");
  const [recoSelected, setRecoSelected] = useState<{ id: number; title: string; author: string; cover_url: string | null } | null>(null);
  const [recoMessage, setRecoMessage] = useState("");
  const [sendingReco, setSendingReco] = useState(false);

  // Challenge state
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [challengeProfileMap, setChallengeProfileMap] = useState<Map<string, { display_name: string; avatar_url: string | null }>>(new Map());
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [challengeForm, setChallengeForm] = useState({
    title: "",
    metric: "pages" as "pages" | "books" | "sessions",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
  });
  const [inviteIds, setInviteIds] = useState<string[]>([]);
  const [followedMembers, setFollowedMembers] = useState<{ id: string; display_name: string; avatar_url: string | null }[]>([]);
  const [savingChallenge, setSavingChallenge] = useState(false);

  useEffect(() => {
    if (!showSettingsMenu) return;
    const handle = (e: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node))
        setShowSettingsMenu(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showSettingsMenu]);

  const toggleDark = () => {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  };
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // ── Main data load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      type LogRow = { user_id: string; pages_read: number; date: string };
      const [
        { data: prof }, { data: bs }, { data: ls }, { data: allLogs }, { data: logsWithPhotos },
        { count: fCount }, { count: ingCount },
      ] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("id", memberId).single(),
        supabase.from("books").select("*").eq("user_id", memberId),
        supabase.from("reading_logs").select("*").eq("user_id", memberId),
        supabase.from("reading_logs").select("user_id, pages_read, date"),
        supabase
          .from("reading_logs")
          .select("session_photo_url, date, book_id")
          .eq("user_id", memberId)
          .not("session_photo_url", "is", null)
          .order("date", { ascending: false })
          .limit(12),
        supabase.from("user_follows").select("*", { count: "exact", head: true }).eq("following_id", memberId),
        supabase.from("user_follows").select("*", { count: "exact", head: true }).eq("follower_id", memberId),
      ]);
      setFollowersCount(fCount ?? 0);
      setFollowingCount(ingCount ?? 0);

      if (user?.id && user.id !== memberId) {
        const { data: myFollowRow } = await supabase
          .from("user_follows")
          .select("id")
          .eq("follower_id", user.id)
          .eq("following_id", memberId)
          .maybeSingle();
        setIsFollowing(!!myFollowRow);
      }

      const profileData = prof as Profile;
      setProfile(profileData);
      const booksData = (bs as Book[]) || [];
      setBooks(booksData);
      setLogs((ls as ReadingLog[]) || []);

      const favIds = (profileData?.favorite_book_ids ?? []).filter(Boolean);
      if (favIds.length > 0) {
        const { data: favData } = await supabase
          .from("books").select("id, title, author, cover_url, rating").in("id", favIds);
        const orderedFavs = favIds
          .map((id) => (favData as Book[])?.find((b) => b.id === id))
          .filter(Boolean) as Book[];
        setFavoriteBooks(orderedFavs);
      }

      type PhotoRow = { session_photo_url: string | null; date: string; book_id: number };
      const photosRaw = (logsWithPhotos as PhotoRow[]) || [];
      const bookMap = new Map(booksData.map((b) => [b.id, b.title]));
      setSessionPhotos(
        photosRaw
          .filter((r) => r.session_photo_url)
          .map((r) => ({ url: r.session_photo_url!, date: r.date, bookTitle: bookMap.get(r.book_id) ?? "" }))
      );

      const rows = (allLogs as LogRow[]) || [];
      const dateMap = new Map<string, Map<string, number>>();
      rows.forEach(({ date, user_id, pages_read }) => {
        if (!dateMap.has(date)) dateMap.set(date, new Map());
        const m = dateMap.get(date)!;
        m.set(user_id, (m.get(user_id) || 0) + pages_read);
      });
      let count = 0;
      for (const userMap of dateMap.values()) {
        const maxPages = Math.max(...userMap.values());
        if (maxPages > 0 && (userMap.get(memberId) || 0) >= maxPages) count++;
      }
      setChampionDays(count);
      setLoading(false);
    };
    load();
  }, [memberId, user?.id]);

  // ── Like state ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!noteModal || !user?.id) { setNoteLiked(false); setNoteLikeCount(0); return; }
    const fetchLikes = async () => {
      const [{ count }, { data: mine }] = await Promise.all([
        supabase.from("review_likes").select("*", { count: "exact", head: true })
          .eq("book_id", noteModal.bookId).eq("reviewer_user_id", noteModal.reviewerUserId),
        supabase.from("review_likes").select("id")
          .eq("book_id", noteModal.bookId).eq("reviewer_user_id", noteModal.reviewerUserId)
          .eq("liker_user_id", user.id).maybeSingle(),
      ]);
      setNoteLikeCount(count ?? 0);
      setNoteLiked(!!mine);
    };
    fetchLikes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteModal?.bookId, noteModal?.reviewerUserId, user?.id]);

  const toggleNoteLike = async () => {
    if (!noteModal || !user?.id || noteModal.reviewerUserId === user.id || noteLikeLoading) return;
    setNoteLikeLoading(true);
    if (noteLiked) {
      await supabase.from("review_likes").delete()
        .eq("book_id", noteModal.bookId).eq("reviewer_user_id", noteModal.reviewerUserId)
        .eq("liker_user_id", user.id);
      setNoteLiked(false);
      setNoteLikeCount((n) => Math.max(0, n - 1));
    } else {
      await supabase.from("review_likes").upsert(
        { book_id: noteModal.bookId, reviewer_user_id: noteModal.reviewerUserId, liker_user_id: user.id },
        { onConflict: "book_id,reviewer_user_id,liker_user_id" }
      );
      setNoteLiked(true);
      setNoteLikeCount((n) => n + 1);
      await supabase.from("notifications").insert({
        user_id: noteModal.reviewerUserId,
        type: "review_like",
        from_user_id: user.id,
        book_id: noteModal.bookId,
        book_title: noteModal.bookTitle ?? "",
      });
    }
    setNoteLikeLoading(false);
  };

  // ── Follow ──────────────────────────────────────────────────────────────────
  const handleFollow = async () => {
    if (!user?.id) return;
    setLoadingFollow(true);
    if (isFollowing) {
      await supabase.from("user_follows").delete().eq("follower_id", user.id).eq("following_id", memberId);
      setIsFollowing(false);
      setFollowersCount((n) => Math.max(0, n - 1));
    } else {
      await supabase.from("user_follows").insert({ follower_id: user.id, following_id: memberId });
      setIsFollowing(true);
      setFollowersCount((n) => n + 1);
    }
    setLoadingFollow(false);
  };

  const handleShowFollowList = async (type: "followers" | "following") => {
    setFollowList([]);
    setFollowListType(type);
    const filterCol = type === "followers" ? "following_id" : "follower_id";
    const selectCol = type === "followers" ? "follower_id" : "following_id";
    const { data } = await supabase.from("user_follows").select(selectCol).eq(filterCol, memberId);
    const ids = ((data || []) as Record<string, string>[]).map((r) => r[selectCol]);
    if (!ids.length) return;
    const { data: profiles } = await supabase
      .from("user_profiles").select("id, display_name, avatar_url").in("id", ids);
    setFollowList((profiles || []) as { id: string; display_name: string; avatar_url: string | null }[]);
  };

  // ── Challenges ──────────────────────────────────────────────────────────────
  const loadChallenges = useCallback(async () => {
    setChallengesLoading(true);
    const [{ data: created }, { data: participating }] = await Promise.all([
      supabase.from("challenges").select("id").eq("creator_id", memberId),
      supabase.from("challenge_participants").select("challenge_id").eq("user_id", memberId).neq("status", "declined"),
    ]);
    const allIds = [...new Set([
      ...((created ?? []) as { id: string }[]).map((c) => c.id),
      ...((participating ?? []) as { challenge_id: string }[]).map((p) => p.challenge_id),
    ])];
    if (!allIds.length) { setChallenges([]); setChallengesLoading(false); return; }
    const { data: challengeData } = await supabase
      .from("challenges")
      .select("*, challenge_participants(user_id, status)")
      .in("id", allIds)
      .order("end_date", { ascending: false });
    const rows = (challengeData ?? []) as ChallengeRow[];
    setChallenges(rows);
    const userIds = [...new Set(rows.flatMap((c) => c.challenge_participants.map((p) => p.user_id)))];
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("user_profiles").select("id, display_name, avatar_url").in("id", userIds);
      setChallengeProfileMap(
        new Map(((profs ?? []) as { id: string; display_name: string; avatar_url: string | null }[]).map((p) => [p.id, p]))
      );
    }
    setChallengesLoading(false);
  }, [memberId]);

  useEffect(() => {
    if (activeTab === "challenges") loadChallenges();
    if (activeTab === "listes") loadLists();
  }, [activeTab, loadChallenges, loadLists]);

  // Load followers for invite selector (own profile only)
  useEffect(() => {
    if (!isOwn || !user?.id) return;
    supabase.from("user_follows").select("following_id").eq("follower_id", user.id).then(async ({ data }) => {
      if (!data?.length) return;
      const ids = (data as { following_id: string }[]).map((r) => r.following_id);
      const { data: profs } = await supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", ids);
      setFollowedMembers((profs ?? []) as { id: string; display_name: string; avatar_url: string | null }[]);
    });
  }, [isOwn, user?.id]);

  const createChallenge = async () => {
    if (!user?.id || !challengeForm.title || !challengeForm.endDate) return;
    setSavingChallenge(true);
    const { data: ch } = await supabase.from("challenges").insert({
      creator_id: user.id,
      title: challengeForm.title.trim(),
      metric: challengeForm.metric,
      target_value: null,
      start_date: challengeForm.startDate,
      end_date: challengeForm.endDate,
    }).select("id").single();
    if (ch) {
      const { id: challengeId } = ch as { id: string };
      await supabase.from("challenge_participants").insert({ challenge_id: challengeId, user_id: user.id, status: "accepted" });
      if (inviteIds.length) {
        await supabase.from("challenge_participants").insert(
          inviteIds.map((uid) => ({ challenge_id: challengeId, user_id: uid, status: "pending" }))
        );
        await supabase.from("notifications").insert(
          inviteIds.map((uid) => ({
            user_id: uid,
            type: "challenge_invite",
            from_user_id: user.id,
            challenge_id: challengeId,
            book_title: challengeForm.title.trim(),
          }))
        );
      }
    }
    setSavingChallenge(false);
    setShowCreateChallenge(false);
    setChallengeForm({ title: "", metric: "pages", startDate: new Date().toISOString().split("T")[0], endDate: "" });
    setInviteIds([]);
    loadChallenges();
  };

  // ── Filtered books (memo) ───────────────────────────────────────────────────
  const filteredBooks = useMemo(() => {
    const lastLogByBook = new Map<number, string>();
    logs.forEach((l) => {
      const existing = lastLogByBook.get(l.book_id);
      if (!existing || l.date > existing) lastLogByBook.set(l.book_id, l.date);
    });
    const recency = (b: Book) => lastLogByBook.get(b.id) || b.date_read || b.created_at || "";
    let filtered = books.filter((b) => {
      if (filterStatus === "all") return true;
      if (filterStatus === "reading") return b.status === "reading";
      if (filterStatus === "completed") return isCompleted(b);
      if (filterStatus === "abandoned") return b.status === "abandoned";
      if (filterStatus === "to-read") return b.status === "to-read";
      return true;
    });
    if (sortBy === "rating") filtered = [...filtered].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else if (sortBy === "title") filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title, "fr"));
    else filtered = [...filtered].sort((a, b) => recency(b).localeCompare(recency(a)));
    return filtered;
  }, [books, logs, filterStatus, sortBy]);

  // ── Early returns ───────────────────────────────────────────────────────────
  if (loading) {
    return <div className="py-24 text-center text-xs font-medium uppercase tracking-wider text-muted">Chargement…</div>;
  }
  if (!profile) {
    return (
      <div className="py-24 text-center">
        <p className="font-serif text-lg text-ink">Profil introuvable.</p>
        <button onClick={() => router.back()} className="mt-4 text-sm font-medium text-violet-deep">← Retour</button>
      </div>
    );
  }

  // ── Computed values ─────────────────────────────────────────────────────────
  const completed = books.filter(isCompleted);
  const reading = books.filter((b) => b.status === "reading");
  const abandoned = books.filter((b) => b.status === "abandoned");
  const wantToRead = books.filter((b) => b.status === "to-read");

  const bookSessionNoteMap = new Map<number, string>();
  logs.forEach((l) => { if (l.session_notes) bookSessionNoteMap.set(l.book_id, l.session_notes); });

  const lastLogByBook = new Map<number, string>();
  logs.forEach((l) => {
    const existing = lastLogByBook.get(l.book_id);
    if (!existing || l.date > existing) lastLogByBook.set(l.book_id, l.date);
  });
  const recencyKey = (b: Book): string => lastLogByBook.get(b.id) || b.date_read || b.created_at || "";

  const currentReading = reading.slice().sort((a, b) => recencyKey(b).localeCompare(recencyKey(a)))[0] ?? null;
  // Pour les terminés : date_read prime sur la dernière session (c'est la date de fin qui compte)
  const completedKey = (b: Book): string => b.date_read || lastLogByBook.get(b.id) || b.created_at || "";
  const last3Completed = [...completed]
    .filter((b) => !!b.date_read || lastLogByBook.has(b.id))
    .sort((a, b) => completedKey(b).localeCompare(completedKey(a)))
    .slice(0, 3);

  const ratedBooks = completed.filter((b) => (b.rating || 0) > 0);
  const avgRating = ratedBooks.length > 0
    ? ratedBooks.reduce((s, b) => s + (b.rating || 0), 0) / ratedBooks.length
    : null;
  const totalPages = logs.reduce((s, l) => s + (l.pages_read || 0), 0);

  const ratingCounts = Array(10).fill(0);
  let ratingSum = 0;
  let ratedCount = 0;
  completed.forEach((b) => {
    const r = b.rating || 0;
    if (r > 0) {
      const bucket = Math.min(9, Math.max(0, Math.round(r * 2) - 1));
      ratingCounts[bucket] += 1;
      ratingSum += r;
      ratedCount += 1;
    }
  });
  const ratingAvg = ratedCount > 0 ? ratingSum / ratedCount : 0;

  const now = new Date();
  const pagesByMonth = Array(12).fill(0);
  logs.forEach((l) => {
    const d = new Date(l.date);
    if (d.getFullYear() === now.getFullYear()) pagesByMonth[d.getMonth()] += l.pages_read || 0;
  });
  const chartData = pagesByMonth.map((v, i) => ({ name: MONTHS[i], value: v }));
  const memberSince = new Date(profile.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const TABS: { id: TabId; label: string }[] = [
    { id: "bibliotheque", label: "Bibliothèque" },
    { id: "statistiques", label: "Statistiques" },
    { id: "collection", label: "Collection" },
    { id: "challenges", label: "Challenges" },
    { id: "listes", label: "Listes" },
  ];

  return (
    <div className="animate-fadeIn flex flex-col gap-6 pt-4">

      {/* Back + settings */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-xs font-medium text-muted">
          ← Membres
        </button>
        {isOwn && (
          <div className="relative" ref={settingsMenuRef}>
            <button
              onClick={() => setShowSettingsMenu((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-muted transition-colors hover:border-violet/40 hover:text-ink"
              aria-label="Options"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>
            {showSettingsMenu && (
              <div className="absolute right-0 top-10 z-[60] w-52 overflow-hidden rounded-2xl border border-line bg-paper shadow-2xl">
                <Link href="/compte" onClick={() => setShowSettingsMenu(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-ink transition-colors hover:bg-violet-soft">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-muted">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0" />
                  </svg>
                  Paramètres du compte
                </Link>
                <button onClick={() => { toggleDark(); setShowSettingsMenu(false); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-ink transition-colors hover:bg-violet-soft">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-muted">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                  Basculer le mode sombre
                </button>
                <div className="mx-3 h-px bg-line" />
                <button onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-danger transition-colors hover:bg-[#f6e7e1] dark:hover:bg-[#2a1510]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profile header */}
      <div className="flex items-center gap-4 rounded-2xl bg-violet-soft px-5 py-6">
        <AvatarImg url={profile.avatar_url} name={profile.display_name} className="h-16 w-16 text-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl font-black text-ink">{profile.display_name}</h1>
            {isOwn && (
              <Link href="/compte" className="rounded-lg border border-line bg-card px-2 py-0.5 text-[11px] font-medium text-muted">
                Modifier
              </Link>
            )}
          </div>
          <p className="mt-0.5 text-xs font-medium text-muted">Membre depuis {memberSince}</p>
          {profile.bio && (
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2" style={{ whiteSpace: "pre-line" }}>{profile.bio}</p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <button onClick={() => handleShowFollowList("followers")}
              className="flex items-center gap-1 text-[12px] text-ink hover:text-violet-deep">
              <span className="font-bold">{followersCount}</span>
              <span className="text-muted"> abonné{followersCount !== 1 ? "s" : ""}</span>
            </button>
            <span className="text-muted">·</span>
            <button onClick={() => handleShowFollowList("following")}
              className="flex items-center gap-1 text-[12px] text-ink hover:text-violet-deep">
              <span className="font-bold">{followingCount}</span>
              <span className="text-muted"> abonnement{followingCount !== 1 ? "s" : ""}</span>
            </button>
          </div>
          {!isOwn && user?.id && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleFollow}
                disabled={loadingFollow}
                className={`flex-1 rounded-2xl py-3 text-sm font-semibold transition-colors disabled:opacity-50 sm:flex-none sm:rounded-xl sm:px-5 sm:py-2 ${
                  isFollowing
                    ? "border border-line bg-card text-muted hover:border-danger/50 hover:text-danger"
                    : "bg-violet text-cream hover:opacity-90"
                }`}
              >
                {loadingFollow ? "…" : isFollowing ? "Abonné ✓" : "S'abonner"}
              </button>
              <button
                onClick={async () => {
                  if (!user?.id) return;
                  const { data } = await supabase.from("books").select("id, title, author, cover_url").eq("user_id", user.id).order("title");
                  setRecoBooks((data ?? []) as { id: number; title: string; author: string; cover_url: string | null }[]);
                  setRecoSelected(null);
                  setRecoMessage("");
                  setRecoSearch("");
                  setShowRecoModal(true);
                }}
                className="flex-1 rounded-2xl border border-violet/40 bg-violet-soft py-3 text-sm font-semibold text-violet-deep transition-colors hover:bg-violet/10 sm:flex-none sm:rounded-xl sm:px-5 sm:py-2"
              >
                Recommander un livre
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip value={String(completed.length)} label="Livres terminés" />
        <StatChip value={totalPages.toLocaleString("fr-FR")} label="Pages lues" />
        <StatChip value={reading.length > 0 ? String(reading.length) : "—"} label="En cours" />
        <StatChip
          value={avgRating != null ? avgRating.toFixed(1).replace(".", ",") + " ★" : "—"}
          label="Note moy."
        />
      </div>

      {/* Favoris */}
      {favoriteBooks.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="font-serif text-[15px] font-medium text-ink">
            Livres favoris <span className="font-sans text-xs font-normal text-muted">({favoriteBooks.length})</span>
          </h2>
          <div className="grid grid-cols-4 gap-2.5">
            {favoriteBooks.map((b) => (
              <Link key={b.id} href={`/livre/${b.id}`} className="group flex w-full flex-col items-center gap-1.5">
                <div className="relative w-full overflow-hidden rounded-xl shadow-sm transition-transform group-hover:scale-105">
                  <Cover id={b.id} title={b.title} coverUrl={b.cover_url} className="aspect-[3/4] w-full" rounded="rounded-xl" />
                  {(b.rating || 0) > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/70 to-transparent px-1.5 pb-1.5 pt-4">
                      <p className="text-[9px] font-bold text-cream">★ {b.rating!.toFixed(1)}</p>
                    </div>
                  )}
                </div>
                <p className="max-w-full truncate text-center text-[9.5px] font-medium text-muted">{b.title}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Activités récentes */}
      {(currentReading || last3Completed.length > 0) && (
        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-[15px] font-medium text-ink">Activités récentes</h2>
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-1">
              {currentReading ? (
                <Link href={`/livre/${currentReading.id}`} className="group flex h-full flex-col gap-1.5">
                  <div className="relative overflow-hidden rounded-xl shadow-sm transition-transform group-hover:scale-[1.03]">
                    <Cover id={currentReading.id} title={currentReading.title} coverUrl={currentReading.cover_url} className="aspect-[3/4] w-full" rounded="rounded-xl" />
                    <div className="absolute inset-x-0 bottom-0 rounded-b-xl bg-gradient-to-t from-ink/70 to-transparent px-2 pb-2 pt-6">
                      <div className="h-1 overflow-hidden rounded-full bg-white/30">
                        <div className="h-full rounded-full bg-cream" style={{ width: `${pct(currentReading)}%` }} />
                      </div>
                      <p className="mt-0.5 text-[9px] font-semibold text-cream">{pct(currentReading)}%</p>
                    </div>
                  </div>
                  <p className="line-clamp-2 text-center text-[9px] font-medium text-muted">{currentReading.title}</p>
                </Link>
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center rounded-xl border border-dashed border-line bg-card">
                  <span className="text-[9px] text-muted">En cours</span>
                </div>
              )}
            </div>
            {[0, 1, 2].map((i) => {
              const b = last3Completed[i];
              return b ? (
                <Link key={b.id} href={`/livre/${b.id}`} className="group flex flex-col gap-1.5">
                  <div className="relative overflow-hidden rounded-xl shadow-sm transition-transform group-hover:scale-[1.03]">
                    <Cover id={b.id} title={b.title} coverUrl={b.cover_url} className="aspect-[3/4] w-full" rounded="rounded-xl" />
                    {(b.rating || 0) > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/70 to-transparent px-1.5 pb-1.5 pt-4">
                        <p className="text-[9px] font-bold text-cream">★ {b.rating!.toFixed(1)}</p>
                      </div>
                    )}
                  </div>
                  <p className="line-clamp-2 text-center text-[9px] font-medium text-muted">{b.title}</p>
                </Link>
              ) : (
                <div key={i} className="flex aspect-[3/4] items-center justify-center rounded-xl border border-dashed border-line bg-card">
                  <span className="text-[9px] text-muted">—</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted">
            <span className="font-medium text-ink-2">En cours</span> · <span className="font-medium text-ink-2">3 derniers terminés</span>
          </p>
        </section>
      )}

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div
        className="flex gap-1 overflow-x-auto rounded-2xl p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ background: "#1a1040" }}
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-[12px] font-semibold transition-all"
            style={activeTab === id
              ? { background: "#7c3aed", color: "#ffffff" }
              : { background: "transparent", color: "#9b8ec4" }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Bibliothèque tab ─────────────────────────────────────────────────── */}
      {activeTab === "bibliotheque" && (
        <div className="flex flex-col gap-4">
          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { id: "all", label: `Tout (${books.length})` },
              { id: "reading", label: `En cours (${reading.length})` },
              { id: "completed", label: `Terminés (${completed.length})` },
              { id: "abandoned", label: `Abandonnés (${abandoned.length})` },
              { id: "to-read", label: `À lire (${wantToRead.length})` },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { setFilterStatus(id); setLibLimit(20); }}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  filterStatus === id
                    ? "bg-violet text-cream"
                    : "border border-line bg-card text-muted hover:border-violet/30 hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sort row */}
          <div className="flex items-center justify-end gap-1">
            <span className="mr-1 text-[11px] text-muted">Trier :</span>
            {([
              { id: "date", label: "Date" },
              { id: "rating", label: "Note" },
              { id: "title", label: "Titre" },
            ] as const).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSortBy(id)}
                className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                  sortBy === id ? "bg-violet-soft text-violet-deep" : "text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filteredBooks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
              <p className="font-serif text-base text-ink">Aucun livre dans cette catégorie.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {filteredBooks.slice(0, libLimit).map((b) => {
                  const hasReview = !!b.notes;
                  const sessionNote = bookSessionNoteMap.get(b.id) ?? null;
                  return (
                    <div key={b.id} className="flex flex-col gap-1.5">
                      <Link
                        href={`/livre/${b.id}`}
                        className="flex h-[96px] items-center gap-2.5 overflow-hidden rounded-2xl border border-line bg-card p-2.5 transition-colors hover:border-violet/40"
                      >
                        <Cover id={b.id} title={b.title} coverUrl={b.cover_url} className="h-[68px] w-[46px] shrink-0" rounded="rounded-md" />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 font-serif text-[12px] font-medium leading-snug text-ink">{b.title}</p>
                          <p className="truncate text-[10px] text-muted">{b.author}</p>
                          {b.status === "reading" && (
                            <div className="mt-1">
                              <ProgressBar value={pct(b) / 100} />
                              <p className="mt-0.5 text-[9.5px] font-medium text-muted">{pct(b)}%</p>
                            </div>
                          )}
                          {isCompleted(b) && (
                            (b.rating ?? 0) > 0
                              ? <p className="mt-1 text-[10.5px] font-medium text-gold">{"★".repeat(Math.round(b.rating!))} {b.rating!.toFixed(1).replace(".", ",")}</p>
                              : <p className="mt-1 text-[9.5px] font-medium text-success">✓ Terminé</p>
                          )}
                          {b.status === "abandoned" && (
                            <span className="mt-1.5 inline-block rounded-md bg-paper px-2 py-0.5 text-[10.5px] font-medium text-muted">Abandonné</span>
                          )}
                          {b.status === "to-read" && (
                            <span className="mt-1.5 inline-block rounded-md bg-violet-soft px-2 py-0.5 text-[10px] font-medium text-violet-deep">À lire</span>
                          )}
                          {(hasReview || sessionNote) && (
                            <div className="mt-1 flex gap-1">
                              {hasReview && (
                                <button
                                  onClick={(e) => { e.preventDefault(); setNoteModal({ type: "review", text: b.notes!, bookTitle: b.title, bookId: b.id, reviewerUserId: memberId }); }}
                                  className="flex h-[16px] w-[16px] items-center justify-center rounded bg-[#e4c97e] text-[8px] font-bold text-[#7a5c00]"
                                >≡</button>
                              )}
                              {sessionNote && (
                                <button
                                  onClick={(e) => { e.preventDefault(); setNoteModal({ type: "session", text: sessionNote, bookTitle: b.title, bookId: b.id, reviewerUserId: memberId }); }}
                                  className="flex h-[16px] w-[16px] items-center justify-center rounded bg-violet-soft text-[8px] font-bold text-violet-deep"
                                >≡</button>
                              )}
                            </div>
                          )}
                        </div>
                      </Link>
                      {!isOwn && (
                        <button
                          onClick={() => setAddTarget(b)}
                          className="flex w-full items-center justify-center gap-1 rounded-xl border border-violet/30 bg-violet-soft py-1.5 text-[10.5px] font-semibold text-violet-deep"
                        >
                          + Ajouter
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {libLimit < filteredBooks.length && (
                <button
                  onClick={() => setLibLimit((n) => n + 20)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet py-2.5 text-[12.5px] font-semibold text-cream"
                >
                  Voir plus · {Math.min(20, filteredBooks.length - libLimit)} de plus
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Statistiques tab ─────────────────────────────────────────────────── */}
      {activeTab === "statistiques" && (
        <div className="flex flex-col gap-5">
          {/* Champion du jour */}
          {championDays > 0 && (
            <div
              className="relative overflow-hidden rounded-2xl p-4 shadow-md"
              style={{ background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 55%, #4f46e5 100%)" }}
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
              <div className="pointer-events-none absolute -bottom-5 right-10 h-20 w-20 rounded-full bg-white/5" />
              <div className="relative flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fde68a" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                    <path d="M4 22h16" />
                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-white/90">
                    {isOwn ? "Tes trophées Champion du jour" : "Trophées Champion du jour"}
                  </p>
                  <p className="text-[11px] text-white/55">
                    Jours où {isOwn ? "tu as" : profile.display_name + " a"} lu le plus de pages
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-serif text-2xl font-black text-yellow-200">{championDays}</p>
                  <p className="text-[10.5px] font-medium text-white/60">{championDays > 1 ? "jours" : "jour"}</p>
                </div>
              </div>
            </div>
          )}

          {/* Photos de sessions */}
          {sessionPhotos.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="font-serif text-lg font-medium text-ink">Galerie</h2>
              <div className="grid grid-cols-3 gap-2">
                {sessionPhotos.map((p, i) => (
                  <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="group relative overflow-hidden rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={p.bookTitle}
                      className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                      onError={(e) => ((e.target as HTMLImageElement).parentElement!.style.display = "none")}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/60 to-transparent px-2 pb-1.5 pt-4 opacity-0 transition-opacity group-hover:opacity-100">
                      <p className="truncate text-[9px] font-semibold text-cream">{p.bookTitle}</p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Histogramme des notes */}
          {ratedCount > 0 && (
            <RatingsChart counts={ratingCounts} average={ratingAvg} total={ratedCount} />
          )}

          {/* Pages / mois */}
          {totalPages > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="font-serif text-lg font-medium text-ink">Pages lues en {now.getFullYear()}</h2>
              <ObjectiveChart
                title=""
                type="area"
                data={chartData}
                objective={null}
                unit="p."
                color={VIOLET}
                lightColor={VIOLET_LT}
                currentMonth={now.getMonth()}
              />
            </section>
          )}

          {/* Stats avancées */}
          {completed.length >= 3 && (
            <>
              <GenreBreakdown books={books} />
              <FictionDonut books={books} />
              <PageCountHistogram books={books} />
              <AuthorDeepDive books={books} />
              <CriticalDivergence books={books} />
              <PublicationTimeline books={books} />
            </>
          )}

          {totalPages === 0 && completed.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
              <p className="font-serif text-base text-ink">Pas encore de statistiques.</p>
              <p className="mt-1 text-sm text-muted">Les graphiques apparaissent dès les premières lectures.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Collection tab ───────────────────────────────────────────────────── */}
      {activeTab === "collection" && (
        <BadgesSection memberId={memberId} currentUserId={user?.id} />
      )}

      {/* ── Challenges tab ───────────────────────────────────────────────────── */}
      {activeTab === "challenges" && (
        <div className="flex flex-col gap-4">
          {!!user?.id && (
            <button
              onClick={() => setShowCreateChallenge(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet py-3.5 text-[14px] font-bold text-cream"
            >
              + Créer un challenge
            </button>
          )}

          {challengesLoading ? (
            <div className="py-8 text-center text-xs text-muted">Chargement…</div>
          ) : challenges.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
              <p className="font-serif text-base text-ink">Aucun challenge pour le moment.</p>
              {isOwn && <p className="mt-1 text-sm text-muted">Crée ton premier challenge et invite des amis !</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {challenges.map((c) => (
                <ChallengeCard
                  key={c.id}
                  challenge={c}
                  currentUserId={user?.id}
                  profileMap={challengeProfileMap}
                  onUpdate={loadChallenges}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab Listes ───────────────────────────────────────────────────────── */}
      {activeTab === "listes" && (
        <div className="flex flex-col gap-4">
          {isOwn && (
            <button
              onClick={() => { setNewListTitle(""); setNewListDesc(""); setShowCreateList(true); }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet py-3.5 text-[14px] font-bold text-cream"
            >
              + Nouvelle liste
            </button>
          )}
          {listsLoading ? (
            <div className="py-8 text-center text-xs text-muted">Chargement…</div>
          ) : lists.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
              <p className="font-serif text-base text-ink">Aucune liste pour le moment.</p>
              {isOwn && <p className="mt-1 text-sm text-muted">Crée ta première liste thématique !</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {lists.map((l) => (
                <Link key={l.id} href={`/listes/${l.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-violet/40">
                  {/* Mini covers */}
                  <div className="flex shrink-0 gap-0.5">
                    {[0, 1, 2, 3].map((i) => (
                      l.covers[i]
                        ? <img key={i} src={l.covers[i]!} alt="" className="h-12 w-8 rounded object-cover shadow-sm" />
                        : <div key={i} className="h-12 w-8 rounded bg-violet-soft" />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-[15px] font-semibold text-ink">{l.title}</p>
                    {l.description && <p className="truncate text-[11px] text-muted">{l.description}</p>}
                    <p className="text-[10px] text-muted">{l.count} livre{l.count !== 1 ? "s" : ""}</p>
                  </div>
                  <span className="shrink-0 text-muted">›</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modales ──────────────────────────────────────────────────────────── */}

      {/* Créer une liste */}
      {showCreateList && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 pt-4 pb-24 [touch-action:none]" onClick={() => setShowCreateList(false)}>
          <div className="animate-slideUp w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-semibold text-ink">Nouvelle liste</h3>
              <button onClick={() => setShowCreateList(false)} className="text-sm text-muted">✕</button>
            </div>
            <input
              type="text"
              placeholder="Titre de la liste"
              value={newListTitle}
              onChange={(e) => setNewListTitle(e.target.value)}
              className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet"
              autoFocus
            />
            <textarea
              rows={2}
              placeholder="Description (optionnelle)"
              value={newListDesc}
              onChange={(e) => setNewListDesc(e.target.value)}
              className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet resize-none"
            />
            <button
              disabled={!newListTitle.trim() || creatingList}
              onClick={async () => {
                if (!user?.id || !newListTitle.trim()) return;
                setCreatingList(true);
                await supabase.from("book_lists").insert({ user_id: user.id, title: newListTitle.trim(), description: newListDesc.trim() || null });
                setCreatingList(false);
                setShowCreateList(false);
                loadLists();
              }}
              className="w-full rounded-2xl bg-violet py-3.5 text-[14px] font-bold text-cream disabled:opacity-40"
            >
              {creatingList ? "Création…" : "Créer la liste"}
            </button>
          </div>
        </div>
      )}

      {/* Créer un challenge */}
      {showCreateChallenge && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 pt-4 pb-24 [touch-action:none]"
          onClick={() => setShowCreateChallenge(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-paper shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="font-serif text-base font-semibold text-ink">Nouveau challenge</h3>
              <button onClick={() => setShowCreateChallenge(false)} className="text-sm text-muted">✕</button>
            </div>
            <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4 max-h-[70dvh]">
              {/* Titre */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">Titre</label>
                <input
                  value={challengeForm.title}
                  onChange={(e) => setChallengeForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Ex. : Juillet littéraire"
                  className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet"
                />
              </div>

              {/* Métrique */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">Métrique</label>
                <div className="flex gap-2">
                  {([
                    { id: "pages", label: "Pages lues" },
                    { id: "books", label: "Livres terminés" },
                    { id: "sessions", label: "Sessions" },
                  ] as const).map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => setChallengeForm((f) => ({ ...f, metric: id }))}
                      className={`flex-1 rounded-xl border py-2 text-[12px] font-semibold transition-colors ${
                        challengeForm.metric === id
                          ? "border-violet bg-violet-soft text-violet-deep"
                          : "border-line bg-card text-muted"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">Du</label>
                  <input
                    type="date"
                    value={challengeForm.startDate}
                    onChange={(e) => setChallengeForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">Au</label>
                  <input
                    type="date"
                    value={challengeForm.endDate}
                    onChange={(e) => setChallengeForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet"
                  />
                </div>
              </div>

              {/* Inviter */}
              {followedMembers.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">Inviter des membres</label>
                  <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                    {followedMembers.map((m) => {
                      const checked = inviteIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => setInviteIds((ids) => checked ? ids.filter((id) => id !== m.id) : [...ids, m.id])}
                          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${
                            checked ? "border-violet bg-violet-soft" : "border-line bg-card"
                          }`}
                        >
                          <AvatarImg url={m.avatar_url} name={m.display_name} className="h-7 w-7 shrink-0 text-[10px]" />
                          <span className="flex-1 text-[13px] font-medium text-ink">{m.display_name}</span>
                          {checked && <span className="text-xs font-bold text-violet-deep">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                onClick={createChallenge}
                disabled={savingChallenge || !challengeForm.title || !challengeForm.endDate}
                className="mt-1 w-full rounded-2xl bg-violet py-3.5 text-[14px] font-bold text-cream disabled:opacity-40"
              >
                {savingChallenge ? "Création…" : "Créer le challenge"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal recommandation */}
      {showRecoModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 pt-4 pb-24 [touch-action:none]" onClick={() => setShowRecoModal(false)}>
          <div className="animate-slideUp w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-4 max-h-[85dvh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-semibold text-ink">Recommander à {profile?.display_name}</h3>
              <button onClick={() => setShowRecoModal(false)} className="text-sm text-muted">✕</button>
            </div>

            {/* Recherche */}
            <input
              type="text"
              placeholder="Chercher dans ta bibliothèque…"
              value={recoSearch}
              onChange={(e) => setRecoSearch(e.target.value)}
              className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet"
              autoFocus
            />

            {/* Liste livres */}
            {!recoSelected && (
              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-48">
                {recoBooks
                  .filter((b) => !recoSearch || b.title.toLowerCase().includes(recoSearch.toLowerCase()) || b.author.toLowerCase().includes(recoSearch.toLowerCase()))
                  .slice(0, 20)
                  .map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setRecoSelected(b)}
                      className="flex items-center gap-3 rounded-xl border border-line bg-card px-3 py-2.5 text-left transition-colors hover:border-violet/40 hover:bg-violet-soft"
                    >
                      {b.cover_url
                        ? <img src={b.cover_url} alt="" className="h-10 w-7 shrink-0 rounded object-cover" />
                        : <div className="h-10 w-7 shrink-0 rounded bg-violet-soft" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-ink">{b.title}</p>
                        <p className="truncate text-[11px] text-muted">{b.author}</p>
                      </div>
                    </button>
                  ))}
              </div>
            )}

            {/* Livre sélectionné */}
            {recoSelected && (
              <div className="flex items-center gap-3 rounded-xl border border-violet/40 bg-violet-soft px-3 py-2.5">
                {recoSelected.cover_url
                  ? <img src={recoSelected.cover_url} alt="" className="h-12 w-8 shrink-0 rounded object-cover shadow" />
                  : <div className="h-12 w-8 shrink-0 rounded bg-violet/20" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink">{recoSelected.title}</p>
                  <p className="truncate text-[11px] text-muted">{recoSelected.author}</p>
                </div>
                <button onClick={() => setRecoSelected(null)} className="shrink-0 text-xs text-muted">✕</button>
              </div>
            )}

            {/* Message */}
            {recoSelected && (
              <textarea
                rows={3}
                placeholder="Un message ? (optionnel)"
                value={recoMessage}
                onChange={(e) => setRecoMessage(e.target.value)}
                className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet resize-none"
              />
            )}

            <button
              disabled={!recoSelected || sendingReco}
              onClick={async () => {
                if (!recoSelected || !user?.id) return;
                setSendingReco(true);
                await supabase.from("book_recommendations").insert({
                  from_user_id: user.id,
                  to_user_id: memberId,
                  book_title: recoSelected.title,
                  book_author: recoSelected.author,
                  book_cover: recoSelected.cover_url,
                  message: recoMessage.trim() || null,
                });
                await supabase.from("notifications").insert({
                  user_id: memberId,
                  from_user_id: user.id,
                  type: "book_recommendation",
                  book_title: recoSelected.title,
                  message: recoMessage.trim() || null,
                });
                setSendingReco(false);
                setShowRecoModal(false);
              }}
              className="w-full rounded-2xl bg-violet py-3.5 text-[14px] font-bold text-cream disabled:opacity-40"
            >
              {sendingReco ? "Envoi…" : "Envoyer la recommandation"}
            </button>
          </div>
        </div>
      )}

      {/* Note / review modal */}
      {noteModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 pt-4 pb-24 [touch-action:none]"
          onClick={() => setNoteModal(null)}
        >
          <div
            className="animate-slideUp w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-3 max-h-[75dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                noteModal.type === "review"
                  ? "bg-[#fdf7e9] text-[#8a6400] dark:bg-[#2a2210] dark:text-[#e0b83d]"
                  : "bg-violet-soft text-violet-deep"
              }`}>
                {noteModal.type === "review" ? "Review globale" : "Note de session"}
              </span>
              {noteModal.bookTitle && (
                <p className="text-[11px] font-semibold text-ink truncate max-w-[55%] text-right">{noteModal.bookTitle}</p>
              )}
            </div>
            <p className="font-serif text-[14px] italic leading-relaxed text-ink" style={{ whiteSpace: "pre-line" }}>
              « {noteModal.text} »
            </p>
            {noteModal.reviewerUserId !== user?.id && (
              <button
                onClick={toggleNoteLike}
                disabled={noteLikeLoading}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12px] font-semibold transition-colors disabled:opacity-50 ${
                  noteLiked
                    ? "border-danger/30 bg-[#f6e7e1] dark:bg-[#2a1510] text-danger"
                    : "border-line bg-card text-muted hover:border-danger/30 hover:text-danger"
                }`}
              >
                <span className="text-sm">{noteLiked ? "♥" : "♡"}</span>
                {noteLikeCount > 0 ? `${noteLikeCount} j'aime` : "J'aime"}
              </button>
            )}
            <button
              onClick={() => setNoteModal(null)}
              className="w-full rounded-xl border border-line bg-card py-2.5 text-[12px] font-medium text-muted hover:text-ink"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Abonnés / abonnements */}
      {followListType !== null && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/30 px-4 pt-4 pb-24 backdrop-blur-sm [touch-action:none]"
          onClick={() => setFollowListType(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-paper p-5 pb-10 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold text-ink">
                {followListType === "followers" ? "Abonnés" : "Abonnements"}
              </h3>
              <button onClick={() => setFollowListType(null)} className="text-sm text-muted">✕</button>
            </div>
            {followList.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                {followListType === "followers" ? "Aucun abonné pour l'instant." : "Aucun abonnement pour l'instant."}
              </p>
            ) : (
              <div className="flex flex-col gap-2 overflow-y-auto max-h-72">
                {followList.map((m) => (
                  <Link
                    key={m.id}
                    href={`/membre/${m.id}`}
                    onClick={() => setFollowListType(null)}
                    className="flex items-center gap-3 rounded-xl border border-line bg-card px-3 py-2.5 hover:border-violet/40"
                  >
                    <AvatarImg url={m.avatar_url} name={m.display_name} className="h-8 w-8 shrink-0 text-sm" />
                    <span className="text-sm font-medium text-ink">{m.display_name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add to library */}
      <AddToLibraryModal
        open={addTarget !== null}
        onClose={() => setAddTarget(null)}
        book={addTarget}
        onAdded={(msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); }}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 rounded-2xl bg-ink px-4 py-2.5 text-sm font-medium text-cream shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function StatChip({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-2xl border border-line bg-card px-3 py-3.5 text-center">
      <span className="font-serif text-xl font-bold text-ink">{value}</span>
      <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted">{label}</span>
    </div>
  );
}
