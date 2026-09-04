"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import type { Book, ReadingLog } from "../../../lib/types";
import { pct, isCompleted } from "../../../lib/books";
import { Cover, AvatarImg } from "../../../components/ui";
import { notifyUser } from "../../../lib/push.client";

interface Profile {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  created_at: string;
  bio?: string | null;
  favorite_book_ids?: number[] | null;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MembrePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const memberId = params.id as string;
  const isOwn = user?.id === memberId;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [favoriteBooks, setFavoriteBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Follow system
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [followListType, setFollowListType] = useState<"followers" | "following" | null>(null);
  const [followList, setFollowList] = useState<{ id: string; display_name: string; avatar_url: string | null }[]>([]);

  // Recommandation / message
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showRecoModal, setShowRecoModal] = useState(false);
  const [recoBooks, setRecoBooks] = useState<{ id: number; title: string; author: string; cover_url: string | null }[]>([]);
  const [recoSearch, setRecoSearch] = useState("");
  const [recoSelected, setRecoSelected] = useState<{ id: number; title: string; author: string; cover_url: string | null } | null>(null);
  const [recoMessage, setRecoMessage] = useState("");
  const [sendingReco, setSendingReco] = useState(false);

  // Compteurs du menu (façon Letterboxd) — chargés à part, en léger, pour ne pas
  // tirer toutes les données détaillées de chaque section sur cette page.
  const [badgeCount, setBadgeCount] = useState<number | null>(null);
  const [challengesCount, setChallengesCount] = useState<number | null>(null);
  const [listsCount, setListsCount] = useState<number | null>(null);

  // ── Chargement principal ─────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const [
        { data: prof }, { data: bs }, { data: ls },
        { count: fCount }, { count: ingCount },
      ] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("id", memberId).single(),
        supabase.from("books").select("*").eq("user_id", memberId),
        supabase.from("reading_logs").select("*").eq("user_id", memberId),
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

      setLoading(false);
    };
    load();
  }, [memberId, user?.id]);

  // ── Compteurs légers pour le menu ────────────────────────────────────────────
  useEffect(() => {
    supabase.from("user_badges").select("id", { count: "exact", head: true }).eq("user_id", memberId)
      .then(({ count }) => setBadgeCount(count ?? 0));
    supabase.from("challenge_participants").select("challenge_id", { count: "exact", head: true })
      .eq("user_id", memberId).neq("status", "declined")
      .then(({ count }) => setChallengesCount(count ?? 0));
    supabase.from("book_lists").select("id", { count: "exact", head: true }).eq("user_id", memberId)
      .then(({ count }) => setListsCount(count ?? 0));
  }, [memberId]);

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
      const senderName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";
      notifyUser(memberId, "Swena", `${senderName} s'est abonné à toi`, undefined, "follows");
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

  const memberSince = new Date(profile.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const reviewedCount = completed.filter((b) => !!b.notes?.trim()).length;

  // Menu façon Letterboxd : chaque ligne pousse vers sa propre page. Sur SON
  // PROPRE profil, on renvoie vers l'outil complet et éditable déjà existant
  // (/journal, /bibliotheque, /dashboard) plutôt que vers la version en
  // lecture seule — celle-ci ne sert que pour consulter le profil d'un autre
  // membre (ces pages perso ne savent afficher que "moi"). Badges/Challenges/
  // Listes/Reviews n'ont pas d'équivalent "perso" hors profil, donc toujours
  // la sous-page /membre/[id]/…
  const SECTIONS: { label: string; href: string; count: number | null }[] = [
    { label: "Journal",      href: isOwn ? "/journal" : `/membre/${memberId}/journal`,           count: logs.length },
    { label: "Bibliothèque", href: isOwn ? "/bibliotheque" : `/membre/${memberId}/bibliotheque`,  count: books.length },
    { label: "Statistiques", href: isOwn ? "/dashboard" : `/membre/${memberId}/statistiques`,     count: null },
    { label: "Badges",       href: `/membre/${memberId}/badges`,     count: badgeCount },
    { label: "Challenges",   href: `/membre/${memberId}/challenges`, count: challengesCount },
    { label: "Listes",       href: `/membre/${memberId}/listes`,     count: listsCount },
    { label: "Reviews",      href: `/membre/${memberId}/reviews`,    count: reviewedCount },
  ];

  return (
    <div className="animate-fadeIn flex flex-col gap-6 pt-4">

      {/* Profile header — le bouton options/message flotte dans le coin de la
          carte plutôt que d'occuper une ligne à part (le bouton retour a été
          retiré : chaque section a désormais son propre lien de retour). */}
      <div className="relative flex items-center gap-4 rounded-2xl bg-violet-soft px-5 py-6">
        {!isOwn && user?.id && (
          <button
            onClick={() => { setMessageText(""); setShowMessageModal(true); }}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-muted transition-colors hover:border-violet/40 hover:text-ink"
            aria-label="Envoyer un message"
            title="Envoyer un message"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <circle cx="5" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </button>
        )}
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

      {/* ── Menu (façon Letterboxd) ────────────────────────────────────────── */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-card">
        {SECTIONS.map(({ label, href, count }, i) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-violet-soft/50 ${i > 0 ? "border-t border-line" : ""}`}
          >
            <span className="text-[14px] font-medium text-ink">{label}</span>
            <span className="flex items-center gap-2">
              {count !== null && <span className="text-[13px] font-semibold text-muted">{count.toLocaleString("fr-FR")}</span>}
              <span className="text-muted">›</span>
            </span>
          </Link>
        ))}
      </div>

      {/* ── Modales ──────────────────────────────────────────────────────────── */}

      {/* Message */}
      {showMessageModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 pt-4 pb-24 [touch-action:none]" onClick={() => setShowMessageModal(false)}>
          <div className="animate-slideUp w-full max-w-sm rounded-2xl bg-card p-5 flex flex-col gap-4 max-h-[85dvh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-semibold text-ink">Message à {profile?.display_name}</h3>
              <button onClick={() => setShowMessageModal(false)} className="text-sm text-muted">✕</button>
            </div>

            <textarea
              rows={4}
              placeholder="Ton message…"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value.slice(0, 300))}
              className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet resize-none"
              autoFocus
            />
            <p className="text-right text-[10.5px] text-muted">{messageText.length} / 300</p>

            <button
              disabled={!messageText.trim() || sendingMessage}
              onClick={async () => {
                if (!messageText.trim() || !user?.id) return;
                setSendingMessage(true);
                const text = messageText.trim();
                await supabase.from("notifications").insert({
                  user_id: memberId,
                  from_user_id: user.id,
                  type: "direct_message",
                  message: text,
                });
                const senderName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";
                notifyUser(memberId, "Swena", `${senderName} vous a envoyé un message : "${text}"`, undefined, "messages");
                setSendingMessage(false);
                setShowMessageModal(false);
                setToast("Message envoyé.");
                setTimeout(() => setToast(null), 3000);
              }}
              className="w-full rounded-2xl bg-violet py-3.5 text-[14px] font-bold text-cream disabled:opacity-40"
            >
              {sendingMessage ? "Envoi…" : "Envoyer le message"}
            </button>
          </div>
        </div>
      )}

      {/* Recommandation */}
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
                        // eslint-disable-next-line @next/next/no-img-element
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
                  // eslint-disable-next-line @next/next/no-img-element
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
                const senderNameReco = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";
                const recoBody = recoMessage.trim()
                  ? `${senderNameReco} te recommande «${recoSelected.title}» : ${recoMessage.trim()}`
                  : `${senderNameReco} te recommande «${recoSelected.title}»`;
                notifyUser(memberId, "Swena", recoBody, "/communaute", "recommendations");
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] left-1/2 z-[70] -translate-x-1/2 rounded-2xl border border-[#a78bfa]/45 bg-[#252131] px-4 py-2.5 text-sm font-medium text-[#fdfbf7] shadow-[0_8px_28px_rgba(0,0,0,0.4)] md:bottom-6">
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
