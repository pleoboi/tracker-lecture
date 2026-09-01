"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { AvatarImg } from "./ui";

export interface ChallengeSummary {
  id: string;
  title: string;
  metric: string;
  target_value: number | null;
  start_date: string;
  end_date: string;
}

interface RankEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  score: number;
}

const RANK_STYLES = [
  { bg: "bg-[#f4cf5e]", text: "text-[#7a5c00]" },
  { bg: "bg-[#d6d6d6]", text: "text-[#4a4a4a]" },
  { bg: "bg-[#cd8b50]/80", text: "text-[#5a3000]" },
];

export default function ChallengeModal({
  challenge,
  currentUserId,
  onClose,
}: {
  challenge: ChallengeSummary;
  currentUserId?: string;
  onClose: () => void;
}) {
  const [ranking, setRanking] = useState<RankEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: parts } = await supabase
        .from("challenge_participants")
        .select("user_id")
        .eq("challenge_id", challenge.id)
        .eq("status", "accepted");
      const userIds = ((parts ?? []) as { user_id: string }[]).map((p) => p.user_id);
      if (!userIds.length) {
        if (!cancelled) setRanking([]);
        return;
      }

      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);
      const profileMap = new Map(
        ((profiles ?? []) as { id: string; display_name: string; avatar_url: string | null }[]).map((p) => [p.id, p]),
      );

      const scoreMap = new Map<string, number>();
      if (challenge.metric === "pages") {
        const { data } = await supabase
          .from("reading_logs")
          .select("user_id, pages_read")
          .in("user_id", userIds)
          .gte("date", challenge.start_date)
          .lte("date", challenge.end_date);
        ((data ?? []) as { user_id: string; pages_read: number }[]).forEach((l) => {
          scoreMap.set(l.user_id, (scoreMap.get(l.user_id) ?? 0) + (l.pages_read || 0));
        });
      } else if (challenge.metric === "books") {
        const { data } = await supabase
          .from("books")
          .select("user_id")
          .in("user_id", userIds)
          .eq("status", "completed")
          .gte("date_read", challenge.start_date)
          .lte("date_read", challenge.end_date);
        ((data ?? []) as { user_id: string }[]).forEach((b) => {
          scoreMap.set(b.user_id, (scoreMap.get(b.user_id) ?? 0) + 1);
        });
      } else {
        const { data } = await supabase
          .from("reading_logs")
          .select("user_id")
          .in("user_id", userIds)
          .gte("date", challenge.start_date)
          .lte("date", challenge.end_date);
        ((data ?? []) as { user_id: string }[]).forEach((l) => {
          scoreMap.set(l.user_id, (scoreMap.get(l.user_id) ?? 0) + 1);
        });
      }

      const entries: RankEntry[] = userIds
        .map((id) => ({
          userId: id,
          name: profileMap.get(id)?.display_name || "Membre",
          avatarUrl: profileMap.get(id)?.avatar_url ?? null,
          score: scoreMap.get(id) ?? 0,
        }))
        .sort((a, b) => b.score - a.score);

      if (!cancelled) setRanking(entries);
    })();
    return () => {
      cancelled = true;
    };
  }, [challenge.id, challenge.metric, challenge.start_date, challenge.end_date]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const metricLabel = challenge.metric === "pages" ? "pages" : challenge.metric === "books" ? "livres" : "sessions";
  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.end_date).getTime() - Date.now()) / 86_400_000));

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-y-auto rounded-t-3xl bg-paper p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">Classement du challenge</p>
            <h2 className="font-serif text-xl font-bold leading-tight text-ink">{challenge.title}</h2>
            <p className="mt-0.5 text-[11px] text-muted">
              {daysLeft === 0 ? "Dernier jour" : `${daysLeft} jour${daysLeft > 1 ? "s" : ""} restant${daysLeft > 1 ? "s" : ""}`}
              {" · "}en {metricLabel}
              {challenge.target_value ? ` · objectif ${challenge.target_value.toLocaleString("fr-FR")}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-sm text-muted hover:bg-card"
          >
            ✕
          </button>
        </div>

        {ranking === null ? (
          <div className="flex h-44 items-center justify-center text-xs font-medium text-muted">Chargement…</div>
        ) : ranking.length === 0 ? (
          <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed border-line bg-card text-center text-sm text-muted">
            Personne n&apos;a encore rejoint ce challenge.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {ranking.map((r, i) => {
              const isMe = r.userId === currentUserId;
              return (
                <div
                  key={r.userId}
                  className={`flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 ${
                    isMe ? "border-violet/40 bg-violet-soft" : "border-line bg-card"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-serif text-[12px] font-black ${
                      i < 3 ? `${RANK_STYLES[i].bg} ${RANK_STYLES[i].text}` : "bg-input text-muted"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <AvatarImg url={r.avatarUrl} name={r.name} className="h-8 w-8 text-xs" />
                  <p className={`min-w-0 flex-1 truncate font-serif text-[14px] font-bold ${isMe ? "text-violet-deep" : "text-ink"}`}>
                    {isMe ? "Toi" : r.name}
                  </p>
                  <p className="shrink-0 text-[12px] font-semibold text-muted">
                    {r.score.toLocaleString("fr-FR")}
                    {challenge.target_value ? ` / ${challenge.target_value.toLocaleString("fr-FR")}` : ""} {metricLabel}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
