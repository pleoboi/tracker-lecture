"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { BADGE_DEFS, type BadgeDef } from "../lib/badges";
import { useAuth } from "../lib/auth-context";
import { VictoryModal } from "./BadgesSection";

// Vérifie les badges au chargement de chaque page (max 1 fois toutes les 5 min par session)
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const SESSION_KEY = "badgeLastCheck";

export default function GlobalBadgeChecker() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [queue, setQueue] = useState<BadgeDef[]>([]);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!user?.id || pendingRef.current) return;

    const lastCheck = Number(sessionStorage.getItem(SESSION_KEY) ?? 0);
    if (Date.now() - lastCheck < CHECK_INTERVAL_MS) return;

    pendingRef.current = true;
    sessionStorage.setItem(SESSION_KEY, String(Date.now()));

    fetch("/api/badges/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    })
      .then((r) => r.json())
      .then((data: { awarded?: { id: string }[] }) => {
        const newBadges = (data.awarded ?? [])
          .map((a) => BADGE_DEFS.find((d) => d.id === a.id))
          .filter((d): d is BadgeDef => d !== undefined);
        if (newBadges.length > 0) setQueue(newBadges);
      })
      .catch(() => {})
      .finally(() => { pendingRef.current = false; });
  // Re-vérifier à chaque changement de page (pathname change)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, pathname]);

  // Affichage immédiat quand un badge vient d'être gagné (ex. après une session),
  // sans attendre le prochain changement de page ni le throttle de 5 min.
  useEffect(() => {
    const onAwarded = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }[]>).detail || [];
      const newBadges = detail
        .map((a) => BADGE_DEFS.find((d) => d.id === a.id))
        .filter((d): d is BadgeDef => d !== undefined);
      if (newBadges.length > 0) setQueue((q) => [...q, ...newBadges]);
    };
    window.addEventListener("swena:badges-awarded", onAwarded);
    return () => window.removeEventListener("swena:badges-awarded", onAwarded);
  }, []);

  if (!queue.length) return null;

  return (
    <VictoryModal
      def={queue[0]}
      onClose={() => setQueue((q) => q.slice(1))}
    />
  );
}
