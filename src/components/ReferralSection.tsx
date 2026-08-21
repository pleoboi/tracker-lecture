"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function ReferralSection({ userId }: { userId?: string }) {
  const [count, setCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  // Calculable directement au rendu (pas besoin d'un effet) : window est
  // disponible dès le premier rendu client de ce composant "use client".
  const link = userId && typeof window !== "undefined"
    ? `${window.location.origin}/register?ref=${userId}`
    : "";

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", userId)
      .then(({ count: c, error }) => setCount(error ? 0 : (c ?? 0)));
  }, [userId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* presse-papiers indisponible */ }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Rejoins-moi sur Swena", url: link });
      } catch { /* partage annulé */ }
    } else {
      handleCopy();
    }
  };

  if (!userId || !link) return null;

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card p-4">
      <div>
        <p className="font-serif text-[15px] font-medium text-ink">Invite tes amis</p>
        <p className="mt-0.5 text-xs text-muted">
          {count === null
            ? "Chargement…"
            : count > 0
              ? `${count} ami${count > 1 ? "s" : ""} ${count > 1 ? "ont" : "a"} rejoint Swena grâce à toi.`
              : "Partage ton lien pour inviter des amis sur Swena."}
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-input px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted">{link}</span>
        <button
          onClick={handleCopy}
          className="shrink-0 text-[11.5px] font-semibold text-violet-deep"
        >
          {copied ? "Copié ✓" : "Copier"}
        </button>
      </div>
      <button
        onClick={handleShare}
        className="w-full rounded-xl bg-violet py-2.5 text-[12.5px] font-semibold text-cream transition-opacity hover:opacity-90"
      >
        Partager mon lien
      </button>
    </div>
  );
}
