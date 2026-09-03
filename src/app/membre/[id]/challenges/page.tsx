"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/auth-context";
import { todayISO } from "../../../../lib/books";
import { AvatarImg } from "../../../../components/ui";
import MemberSectionHeader from "../../../../components/MemberSectionHeader";
import { notifyUser } from "../../../../lib/push.client";

interface ChallengeParticipantRow {
  user_id: string;
  status: string;
  completed_at?: string | null;
}

interface ChallengeRow {
  id: string;
  creator_id: string;
  title: string;
  metric: "pages" | "books" | "sessions";
  target_value: number | null;
  reward_points: number;
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

  const today = todayISO();
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

  const isGoal = !!challenge.target_value;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="font-serif text-[15px] font-semibold text-ink">{challenge.title}</p>
          <p className="mt-0.5 text-[11px] text-muted">
            {new Date(challenge.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} —{" "}
            {new Date(challenge.end_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · {metricLabel}
            {isGoal && ` · objectif ${challenge.target_value!.toLocaleString("fr-FR")}`}
          </p>
          {isGoal && challenge.reward_points > 0 && (
            <span className="mt-1 inline-flex items-center rounded-full bg-violet-soft px-2 py-0.5 text-[10px] font-bold text-violet-deep">
              +{challenge.reward_points} pts à l&apos;objectif
            </span>
          )}
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
          {!isGoal && (
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Classement</p>
          )}
          {loadingScores ? (
            <p className="py-2 text-center text-[11px] text-muted">Chargement…</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {sorted.map((p, i) => {
                const score = scores?.get(p.user_id) ?? 0;
                const prof = profileMap.get(p.user_id);
                const isMe = p.user_id === currentUserId;
                const maxScore = scores ? Math.max(...[...scores.values()], 1) : 1;
                const target = challenge.target_value ?? 0;
                const done = isGoal ? (score >= target || !!p.completed_at) : false;
                const barPct = isGoal ? Math.min(100, (score / Math.max(target, 1)) * 100) : Math.min(100, (score / maxScore) * 100);
                return (
                  <div
                    key={p.user_id}
                    className={`flex items-center gap-2 rounded-xl p-2 ${isMe ? "bg-violet-soft" : ""}`}
                  >
                    {isGoal ? (
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                        done ? "bg-success text-cream" : "border border-line text-transparent"
                      }`}>
                        {done ? "✓" : "·"}
                      </span>
                    ) : (
                      <span className="w-4 shrink-0 text-center text-[10px] font-bold text-muted">{i + 1}</span>
                    )}
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
                        <div className={`h-full rounded-full ${isGoal && done ? "bg-success" : "bg-violet"}`} style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                    <span className="shrink-0 text-[10.5px] font-bold text-ink">
                      {score.toLocaleString("fr-FR")}{isGoal && ` / ${target.toLocaleString("fr-FR")}`}
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MemberChallengesPage() {
  const params = useParams();
  const { user } = useAuth();
  const memberId = params.id as string;
  const isOwn = user?.id === memberId;

  const [firstName, setFirstName] = useState("");
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(true);
  const [challengeProfileMap, setChallengeProfileMap] = useState<Map<string, { display_name: string; avatar_url: string | null }>>(new Map());
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [challengeForm, setChallengeForm] = useState({
    title: "",
    mode: "classement" as "classement" | "objectif",
    metric: "pages" as "pages" | "books" | "sessions",
    startDate: todayISO(),
    endDate: "",
    targetValue: "",
    rewardPoints: "50",
  });
  const [inviteIds, setInviteIds] = useState<string[]>([]);
  const [followedMembers, setFollowedMembers] = useState<{ id: string; display_name: string; avatar_url: string | null }[]>([]);
  const [savingChallenge, setSavingChallenge] = useState(false);

  useEffect(() => {
    supabase.from("user_profiles").select("display_name").eq("id", memberId).single()
      .then(({ data }) => setFirstName(((data as { display_name?: string } | null)?.display_name ?? "").split(" ")[0]));
  }, [memberId]);

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
      .select("*, challenge_participants(user_id, status, completed_at)")
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

  useEffect(() => { loadChallenges(); }, [loadChallenges]);

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
    const isGoal = challengeForm.mode === "objectif";
    if (isGoal && (!challengeForm.targetValue || Number(challengeForm.targetValue) <= 0)) return;
    setSavingChallenge(true);
    const { data: ch } = await supabase.from("challenges").insert({
      creator_id: user.id,
      title: challengeForm.title.trim(),
      metric: challengeForm.metric,
      target_value: isGoal ? Number(challengeForm.targetValue) : null,
      reward_points: isGoal ? (Number(challengeForm.rewardPoints) || 50) : 0,
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
        const senderName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";
        inviteIds.forEach((uid) =>
          notifyUser(uid, "Swena", `${senderName} t'invite à rejoindre le challenge «${challengeForm.title.trim()}»`, undefined, "challenges"),
        );
      }
    }
    setSavingChallenge(false);
    setShowCreateChallenge(false);
    setChallengeForm({ title: "", mode: "classement", metric: "pages", startDate: todayISO(), endDate: "", targetValue: "", rewardPoints: "50" });
    setInviteIds([]);
    loadChallenges();
  };

  return (
    <div className="animate-fadeIn flex flex-col gap-4 pt-4">
      <MemberSectionHeader memberId={memberId} firstName={firstName} title="Challenges" />

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
              {/* Type de challenge */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">Type</label>
                <div className="flex gap-2">
                  {([
                    { id: "classement" as const, label: "Classement", desc: "Un vainqueur, le plus gros score" },
                    { id: "objectif" as const, label: "Objectif individuel", desc: "Chacun son rythme, tous récompensés" },
                  ]).map(({ id, label, desc }) => (
                    <button
                      key={id}
                      onClick={() => setChallengeForm((f) => ({ ...f, mode: id }))}
                      className={`flex-1 rounded-xl border px-3 py-2 text-left transition-colors ${
                        challengeForm.mode === id
                          ? "border-violet bg-violet-soft"
                          : "border-line bg-card"
                      }`}
                    >
                      <p className={`text-[12px] font-semibold ${challengeForm.mode === id ? "text-violet-deep" : "text-ink"}`}>{label}</p>
                      <p className="mt-0.5 text-[10px] text-muted">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Titre */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">Titre</label>
                <input
                  value={challengeForm.title}
                  onChange={(e) => setChallengeForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder={challengeForm.mode === "objectif" ? "Ex. : Finir 5 livres avant la fin de l'année" : "Ex. : Juillet littéraire"}
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

              {/* Objectif + points de récompense (mode "objectif individuel" uniquement) */}
              {challengeForm.mode === "objectif" && (
                <div className="flex gap-3">
                  <div className="flex flex-1 flex-col gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Objectif ({challengeForm.metric === "pages" ? "pages" : challengeForm.metric === "books" ? "livres" : "sessions"})
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={challengeForm.targetValue}
                      onChange={(e) => setChallengeForm((f) => ({ ...f, targetValue: e.target.value }))}
                      placeholder="Ex. : 5"
                      className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">Points offerts</label>
                    <input
                      type="number"
                      min={0}
                      value={challengeForm.rewardPoints}
                      onChange={(e) => setChallengeForm((f) => ({ ...f, rewardPoints: e.target.value }))}
                      className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet"
                    />
                  </div>
                </div>
              )}

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
                disabled={
                  savingChallenge || !challengeForm.title || !challengeForm.endDate ||
                  (challengeForm.mode === "objectif" && (!challengeForm.targetValue || Number(challengeForm.targetValue) <= 0))
                }
                className="mt-1 w-full rounded-2xl bg-violet py-3.5 text-[14px] font-bold text-cream disabled:opacity-40"
              >
                {savingChallenge ? "Création…" : "Créer le challenge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
