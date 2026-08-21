"use client";

import { useState } from "react";
import { Modal, Button } from "./ui";

/**
 * Rappel de parrainage affiché une fois, à partir du 7e jour suivant la création
 * du compte (AppShell décide du déclenchement). Jamais montré avant : on laisse
 * l'utilisateur s'installer dans l'app avant de lui proposer d'inviter des amis.
 */
export default function ReferralPromptModal({
  open,
  onClose,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  userId?: string;
}) {
  const [copied, setCopied] = useState(false);
  const link = userId && typeof window !== "undefined"
    ? `${window.location.origin}/register?ref=${userId}`
    : "";

  const markSeen = () => {
    if (userId && typeof window !== "undefined") {
      localStorage.setItem(`referral_prompt_seen_${userId}`, "1");
    }
  };

  const handleClose = () => { markSeen(); onClose(); };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* presse-papiers indisponible */ }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Rejoins-moi sur Swena", url: link }); } catch { /* annulé */ }
    } else {
      handleCopy();
    }
    markSeen();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Et si tu invitais des amis ?">
      <div className="flex flex-col gap-4">
        <p className="text-[13px] leading-relaxed text-muted">
          Swena est plus sympa à plusieurs. Partage ton lien personnel : chaque ami qui
          rejoint grâce à toi te rapproche du badge Le Parrain.
        </p>

        <div className="flex items-center gap-2 rounded-xl border border-line bg-input px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted">{link}</span>
          <button onClick={handleCopy} className="shrink-0 text-[11.5px] font-semibold text-violet-deep">
            {copied ? "Copié ✓" : "Copier"}
          </button>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleClose} className="flex-1 py-3">
            Plus tard
          </Button>
          <Button onClick={handleShare} className="flex-1 py-3">
            Partager
          </Button>
        </div>
      </div>
    </Modal>
  );
}
