"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/auth-context";
import { notifyUser } from "../../../../lib/push.client";
import { userUniverses } from "../../../../lib/universes";
import {
  fetchMyMangas,
  fetchMyMangaLogs,
  backfillDemographics,
  progressSummary,
  MANGA_DEMOGRAPHICS,
  type Manga,
  type MangaLog,
} from "../../../../lib/manga";
import { AvatarImg, Modal, Button, inputClass } from "../../../../components/ui";
import { MangaCover } from "../../../../components/manga/MangaUI";
import { MangaBadgeMedal } from "../../../../components/manga/MangaBadgeIcon";
import { MANGA_BADGE_DEFS } from "../../../../lib/mangaBadges";

interface Profile {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  created_at: string;
  bio?: string | null;
  favorite_manga_ids?: number[] | null;
}

type PersonRow = { id: string; display_name: string; avatar_url: string | null };

const MAX_FAVORITES = 4;

function StatChip({ value, label }: { value: string; label: string }) {
  return (
    <div className="manga-panel flex min-w-0 flex-col items-center gap-0.5 px-2 py-3.5 text-center">
      <span className="nums font-serif text-2xl text-ink">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</span>
    </div>
  );
}

/** Profil manga d'un membre : même esprit que le profil Swena livres, mais pour ses mangas. */
export default function MangaMemberPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const memberId = params.id as string;
  const isOwn = user?.id === memberId;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [logs, setLogs] = useState<MangaLog[]>([]);
  const [favIds, setFavIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [followListType, setFollowListType] = useState<"followers" | "following" | null>(null);
  const [followList, setFollowList] = useState<PersonRow[]>([]);

  const [showMessage, setShowMessage] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const [badgeRows, setBadgeRows] = useState<{ badge_id: string; unlocked_at: string }[]>([]);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: prof }, ms, ls, { count: fCount }, { count: ingCount }] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("id", memberId).single(),
        fetchMyMangas(memberId),
        fetchMyMangaLogs(memberId),
        supabase.from("user_follows").select("*", { count: "exact", head: true }).eq("following_id", memberId),
        supabase.from("user_follows").select("*", { count: "exact", head: true }).eq("follower_id", memberId),
      ]);
      if (cancelled) return;
      if (user?.id && user.id !== memberId) {
        const { data: row } = await supabase
          .from("user_follows")
          .select("id")
          .eq("follower_id", user.id)
          .eq("following_id", memberId)
          .maybeSingle();
        if (!cancelled) setIsFollowing(!!row);
      }
      const p = (prof as Profile | null) ?? null;
      setProfile(p);
      setFavIds((p?.favorite_manga_ids ?? []).filter(Boolean));
      setMangas(ms);
      setLogs(ls);
      setFollowersCount(fCount ?? 0);
      setFollowingCount(ingCount ?? 0);
      setLoading(false);
      // Séries sans catégorie (shonen, seinen...) : complétées via AniList, uniquement chez soi
      if (user?.id === memberId) {
        const filled = await backfillDemographics(ms).catch(() => ms);
        if (!cancelled) setMangas(filled);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [memberId, user?.id]);

  useEffect(() => {
    supabase
      .from("user_badges")
      .select("badge_id, unlocked_at")
      .eq("user_id", memberId)
      .like("badge_id", "manga-%")
      .order("unlocked_at", { ascending: false })
      .then(({ data }) => setBadgeRows((data ?? []) as { badge_id: string; unlocked_at: string }[]));
  }, [memberId]);

  const recentBadges = useMemo(
    () => badgeRows.map((b) => MANGA_BADGE_DEFS.find((d) => d.id === b.badge_id)).filter((d) => !!d).slice(0, 5),
    [badgeRows]
  );

  const byId = useMemo(() => new Map(mangas.map((m) => [m.id, m])), [mangas]);
  const favorites = favIds.map((id) => byId.get(id)).filter(Boolean) as Manga[];

  const stats = useMemo(() => {
    const completed = mangas.filter((m) => m.status === "completed");
    const rated = mangas.filter((m) => Number(m.rating) > 0);
    return {
      completed,
      chapters: logs.filter((l) => l.unit === "chapter").reduce((s, l) => s + l.amount, 0),
      volumes: logs.filter((l) => l.unit === "volume").reduce((s, l) => s + l.amount, 0),
      avgRating: rated.length ? rated.reduce((s, m) => s + Number(m.rating), 0) / rated.length : null,
    };
  }, [mangas, logs]);

  const { currentReading, last3Completed } = useMemo(() => {
    const lastLog = new Map<number, string>();
    logs.forEach((l) => {
      const prev = lastLog.get(l.manga_id);
      if (!prev || l.date > prev) lastLog.set(l.manga_id, l.date);
    });
    const key = (m: Manga) => lastLog.get(m.id) ?? m.date_started ?? m.created_at;
    return {
      currentReading: mangas.filter((m) => m.status === "reading").sort((a, b) => key(b).localeCompare(key(a)))[0] ?? null,
      last3Completed: mangas
        .filter((m) => m.status === "completed")
        .sort((a, b) => (b.date_finished ?? key(b)).localeCompare(a.date_finished ?? key(a)))
        .slice(0, 3),
    };
  }, [mangas, logs]);

  const demographics = useMemo(() => {
    const counts = new Map<string, number>();
    mangas.forEach((m) => counts.set(m.demographic ?? "none", (counts.get(m.demographic ?? "none") ?? 0) + 1));
    return [
      ...MANGA_DEMOGRAPHICS.map((d) => ({ key: d.key as string, label: d.label, color: d.color, value: counts.get(d.key) ?? 0 })),
      { key: "none", label: "Non classé", color: "var(--color-line)", value: counts.get("none") ?? 0 },
    ]
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [mangas]);

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
      const sender = user.user_metadata?.display_name || user.email?.split("@")[0] || "";
      notifyUser(memberId, "Swena", `${sender} s'est abonné à toi`, undefined, "follows");
    }
    setLoadingFollow(false);
  };

  const showFollowList = async (type: "followers" | "following") => {
    setFollowList([]);
    setFollowListType(type);
    const filterCol = type === "followers" ? "following_id" : "follower_id";
    const selectCol = type === "followers" ? "follower_id" : "following_id";
    const { data } = await supabase.from("user_follows").select(selectCol).eq(filterCol, memberId);
    const ids = ((data ?? []) as unknown as Record<string, string>[]).map((r) => r[selectCol]);
    if (!ids.length) return;
    const { data: people } = await supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", ids);
    setFollowList((people ?? []) as PersonRow[]);
  };

  const sendMessage = async () => {
    const text = messageText.trim();
    if (!text || !user?.id) return;
    setSendingMessage(true);
    await supabase.from("notifications").insert({ user_id: memberId, from_user_id: user.id, type: "direct_message", message: text });
    const sender = user.user_metadata?.display_name || user.email?.split("@")[0] || "";
    notifyUser(memberId, "Swena", `${sender} vous a envoyé un message : "${text}"`, undefined, "messages");
    setSendingMessage(false);
    setShowMessage(false);
    flash("Message envoyé.");
  };

  const saveFavorites = async (next: number[]) => {
    const previous = favIds;
    setFavIds(next);
    const { error } = await supabase.from("user_profiles").upsert({ id: memberId, favorite_manga_ids: next }, { onConflict: "id" });
    if (error) {
      setFavIds(previous);
      flash("Impossible d'enregistrer tes favoris pour le moment.");
    }
  };

  if (loading) {
    return <div className="py-24 text-center text-xs font-medium uppercase tracking-wider text-muted">Chargement…</div>;
  }
  if (!profile) {
    return (
      <div className="py-24 text-center">
        <p className="font-serif text-lg text-ink">Profil introuvable.</p>
        <button onClick={() => router.back()} className="mt-4 text-sm font-semibold text-violet-deep">← Retour</button>
      </div>
    );
  }

  const memberSince = new Date(profile.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const pickable = mangas
    .filter((m) => !favIds.includes(m.id))
    .filter((m) => !pickerSearch.trim() || m.title.toLowerCase().includes(pickerSearch.trim().toLowerCase()));

  const SECTIONS: { label: string; href: string; count: number | null }[] = [
    { label: isOwn ? "Toutes mes séries" : "Mangathèque", href: `/manga/membre/${memberId}/bibliotheque`, count: mangas.length },
    { label: "Dernières sessions", href: `/manga/membre/${memberId}/sessions`, count: null },
    { label: "Statistiques", href: isOwn ? "/manga/stats" : `/manga/membre/${memberId}/stats`, count: null },
    { label: "Badges", href: `/manga/membre/${memberId}/badges`, count: badgeRows.length },
    ...(isOwn ? [{ label: "Paramètres", href: "/manga/compte", count: null }] : []),
    ...(userUniverses(user).includes("books") ? [{ label: "Profil livres", href: `/membre/${memberId}`, count: null }] : []),
  ];

  return (
    <div className="animate-fadeIn flex min-w-0 flex-col gap-6 pt-4">
      {/* En-tête */}
      <div className="manga-panel manga-speedlines relative flex min-w-0 items-start gap-4 px-4 py-5">
        {!isOwn && user?.id && (
          <button
            onClick={() => { setMessageText(""); setShowMessage(true); }}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-card text-ink"
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
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pr-9">
            <h1 className="min-w-0 break-words font-serif text-2xl leading-tight text-ink">{profile.display_name}</h1>
            {isOwn && (
              <Link href="/manga/compte" className="shrink-0 rounded-lg border-2 border-ink bg-card px-2 py-0.5 text-[11px] font-bold text-ink">
                Modifier
              </Link>
            )}
          </div>
          <p className="mt-0.5 text-xs font-medium text-muted">Membre depuis {memberSince}</p>
          {profile.bio && (
            <p className="mt-2 break-words text-[12.5px] leading-relaxed text-ink-2" style={{ whiteSpace: "pre-line" }}>{profile.bio}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button onClick={() => showFollowList("followers")} className="flex items-center gap-1 text-[12px] text-ink hover:text-violet-deep">
              <span className="font-bold">{followersCount}</span>
              <span className="text-muted">abonné{followersCount !== 1 ? "s" : ""}</span>
            </button>
            <span className="text-muted">·</span>
            <button onClick={() => showFollowList("following")} className="flex items-center gap-1 text-[12px] text-ink hover:text-violet-deep">
              <span className="font-bold">{followingCount}</span>
              <span className="text-muted">abonnement{followingCount !== 1 ? "s" : ""}</span>
            </button>
          </div>
          {!isOwn && user?.id && (
            <button
              onClick={handleFollow}
              disabled={loadingFollow}
              className={`btn-press mt-3 w-full rounded-xl border-2 border-ink py-2.5 text-[13px] font-bold disabled:opacity-50 sm:w-auto sm:px-6 ${
                isFollowing ? "bg-card text-ink" : "bg-violet text-cream shadow-[3px_3px_0_var(--color-ink)]"
              }`}
            >
              {loadingFollow ? "…" : isFollowing ? "Abonné ✓" : "S'abonner"}
            </button>
          )}
        </div>
      </div>

      {/* Chiffres */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip value={stats.chapters.toLocaleString("fr-FR")} label="Chapitres lus" />
        <StatChip value={stats.volumes.toLocaleString("fr-FR")} label="Tomes lus" />
        <StatChip value={String(stats.completed.length)} label="Séries finies" />
        <StatChip value={stats.avgRating != null ? `${stats.avgRating.toFixed(1).replace(".", ",")} ★` : "—"} label="Note moy." />
      </div>

      {/* Favoris */}
      {(isOwn || favorites.length > 0) && (
        <section className="flex min-w-0 flex-col gap-2.5">
          <h2 className="font-serif text-[17px] text-ink">
            {isOwn ? "Mes 4 mangas favoris" : "Mangas favoris"}{" "}
            <span className="font-sans text-xs font-normal text-muted">({favorites.length}/{MAX_FAVORITES})</span>
          </h2>
          <div className="grid grid-cols-4 gap-2.5">
            {favorites.map((m) => (
              <div key={m.id} className="relative flex min-w-0 flex-col gap-1.5">
                <Link href={`/manga/${m.id}`} className="group relative block">
                  <MangaCover id={m.id} title={m.title} coverUrl={m.cover_url} className="aspect-[2/3] h-auto w-full transition-transform group-hover:-translate-y-0.5" />
                  {Number(m.rating) > 0 && (
                    <span className="absolute bottom-1 left-1 rounded-[3px] border-2 border-ink bg-card px-1 text-[9.5px] font-bold text-ink">
                      ★ {Number(m.rating).toFixed(1).replace(".", ",")}
                    </span>
                  )}
                </Link>
                <p className="line-clamp-2 text-center text-[10px] font-bold leading-tight text-ink">{m.title}</p>
                {isOwn && (
                  <button
                    onClick={() => saveFavorites(favIds.filter((id) => id !== m.id))}
                    aria-label={`Retirer ${m.title} des favoris`}
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-card text-[11px] font-bold text-ink"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {isOwn &&
              Array.from({ length: MAX_FAVORITES - favorites.length }).map((_, i) => (
                <button
                  key={`empty-${i}`}
                  onClick={() => { setPickerSearch(""); setShowPicker(true); }}
                  disabled={mangas.length === 0}
                  className="flex aspect-[2/3] w-full flex-col items-center justify-center gap-1 rounded-[4px] border-2 border-dashed border-line bg-card text-muted transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
                >
                  <span className="text-2xl leading-none">+</span>
                  <span className="text-[9.5px] font-bold">Favori {favorites.length + i + 1}</span>
                </button>
              ))}
          </div>
        </section>
      )}

      {/* Catégories */}
      {demographics.length > 0 && (
        <section className="flex min-w-0 flex-col gap-2.5">
          <h2 className="font-serif text-[17px] text-ink">Catégories</h2>
          <div className="manga-panel flex min-w-0 flex-col gap-3 p-3.5">
            <div className="flex h-4 overflow-hidden rounded-[3px] border-2 border-ink">
              {demographics.map((d) => (
                <div key={d.key} title={`${d.label} : ${d.value}`} style={{ flexGrow: d.value, background: d.color }} className="min-w-0 border-r-2 border-ink last:border-r-0" />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {demographics.map((d) => (
                <span key={d.key} className="flex items-center gap-1.5 text-[12px] font-bold text-ink">
                  <span className="h-3 w-3 shrink-0 rounded-[3px] border-2 border-ink" style={{ background: d.color }} />
                  {d.label} <span className="nums font-medium text-muted">{d.value}</span>
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Badges récents */}
      {recentBadges.length > 0 && (
        <section className="flex min-w-0 flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-serif text-[17px] text-ink">Badges récents</h2>
            <Link href={`/manga/membre/${memberId}/badges`} className="text-[12px] font-bold text-violet-deep">Tout voir →</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {recentBadges.map((d) => (
              <Link key={d!.id} href={`/manga/membre/${memberId}/badges`} className="flex w-[64px] shrink-0 flex-col items-center gap-1.5 text-center">
                <MangaBadgeMedal icon={d!.icon} tier={d!.tier} className="h-14 w-14" />
                <span className="line-clamp-2 w-full break-words text-[10px] font-bold leading-tight text-ink">{d!.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Activités récentes */}
      {(currentReading || last3Completed.length > 0) && (
        <section className="flex min-w-0 flex-col gap-2">
          <h2 className="font-serif text-[17px] text-ink">Activités récentes</h2>
          <div className="grid grid-cols-4 gap-2.5">
            {currentReading ? (
              <Link href={`/manga/${currentReading.id}`} className="group flex min-w-0 flex-col gap-1.5">
                <MangaCover id={currentReading.id} title={currentReading.title} coverUrl={currentReading.cover_url} className="aspect-[2/3] h-auto w-full transition-transform group-hover:-translate-y-0.5" />
                <p className="line-clamp-2 text-center text-[10px] font-bold leading-tight text-ink">{currentReading.title}</p>
                <p className="nums truncate text-center text-[9.5px] font-semibold text-violet-deep">{progressSummary(currentReading)}</p>
              </Link>
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center rounded-[4px] border-2 border-dashed border-line bg-card">
                <span className="text-[9.5px] text-muted">En cours</span>
              </div>
            )}
            {[0, 1, 2].map((i) => {
              const m = last3Completed[i];
              return m ? (
                <Link key={m.id} href={`/manga/${m.id}`} className="group flex min-w-0 flex-col gap-1.5">
                  <div className="relative">
                    <MangaCover id={m.id} title={m.title} coverUrl={m.cover_url} className="aspect-[2/3] h-auto w-full transition-transform group-hover:-translate-y-0.5" />
                    {Number(m.rating) > 0 && (
                      <span className="absolute bottom-1 left-1 rounded-[3px] border-2 border-ink bg-card px-1 text-[9.5px] font-bold text-ink">
                        ★ {Number(m.rating).toFixed(1).replace(".", ",")}
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-center text-[10px] font-bold leading-tight text-ink">{m.title}</p>
                </Link>
              ) : (
                <div key={i} className="flex aspect-[2/3] items-center justify-center rounded-[4px] border-2 border-dashed border-line bg-card">
                  <span className="text-[9.5px] text-muted">—</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10.5px] text-muted">
            <span className="font-bold text-ink-2">En cours</span> · <span className="font-bold text-ink-2">3 derniers terminés</span>
          </p>
        </section>
      )}

      {/* Menu */}
      <div className="manga-panel flex flex-col overflow-hidden p-0">
        {SECTIONS.map(({ label, href, count }, i) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-violet-soft ${i > 0 ? "border-t border-line" : ""}`}
          >
            <span className="text-[14px] font-bold text-ink">{label}</span>
            <span className="flex items-center gap-2">
              {count !== null && <span className="nums text-[13px] font-semibold text-muted">{count.toLocaleString("fr-FR")}</span>}
              <span className="text-muted">›</span>
            </span>
          </Link>
        ))}
      </div>

      {/* Choix d'un favori */}
      <Modal open={showPicker} onClose={() => setShowPicker(false)} title="Choisir un favori">
        <div className="flex flex-col gap-3">
          <input
            value={pickerSearch}
            onChange={(e) => setPickerSearch(e.target.value)}
            placeholder="Chercher dans ta mangathèque…"
            className={inputClass}
          />
          {pickable.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Aucune série à proposer.</p>
          ) : (
            <div className="flex max-h-[50dvh] flex-col gap-1.5 overflow-y-auto">
              {pickable.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { saveFavorites([...favIds, m.id].slice(0, MAX_FAVORITES)); setShowPicker(false); }}
                  className="flex min-w-0 items-center gap-3 rounded-xl border-2 border-line bg-card p-2 text-left transition-colors hover:border-ink"
                >
                  <MangaCover id={m.id} title={m.title} coverUrl={m.cover_url} className="h-14 w-10" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">{m.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Message */}
      <Modal
        open={showMessage}
        onClose={() => setShowMessage(false)}
        title={`Message à ${profile.display_name}`}
        footer={
          <Button onClick={sendMessage} disabled={!messageText.trim() || sendingMessage} className="w-full">
            {sendingMessage ? "Envoi…" : "Envoyer le message"}
          </Button>
        }
      >
        <textarea
          rows={4}
          placeholder="Ton message…"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value.slice(0, 300))}
          className={`${inputClass} resize-none`}
          autoFocus
        />
        <p className="mt-1 text-right text-[10.5px] text-muted">{messageText.length} / 300</p>
      </Modal>

      {/* Abonnés / abonnements */}
      <Modal open={followListType !== null} onClose={() => setFollowListType(null)} title={followListType === "followers" ? "Abonnés" : "Abonnements"}>
        {followList.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            {followListType === "followers" ? "Aucun abonné pour l'instant." : "Aucun abonnement pour l'instant."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {followList.map((p) => (
              <Link
                key={p.id}
                href={`/manga/membre/${p.id}`}
                onClick={() => setFollowListType(null)}
                className="flex min-w-0 items-center gap-3 rounded-xl border-2 border-line bg-card px-3 py-2.5 hover:border-ink"
              >
                <AvatarImg url={p.avatar_url} name={p.display_name} className="h-8 w-8 shrink-0 text-sm" />
                <span className="min-w-0 truncate text-sm font-bold text-ink">{p.display_name}</span>
              </Link>
            ))}
          </div>
        )}
      </Modal>

      {toast && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] left-1/2 z-[70] max-w-[90vw] -translate-x-1/2 rounded-xl border-2 border-ink bg-card px-4 py-2.5 text-center text-sm font-bold text-ink shadow-[4px_4px_0_var(--color-ink)] md:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
