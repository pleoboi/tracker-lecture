"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { ensurePushSubscription } from "../lib/push.client";

const SESSION_KEY = "swena_push_dismissed_session";

export default function PushPermissionPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const t = setTimeout(() => setVisible(true), 1800);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setVisible(false);
  };

  const accept = async () => {
    dismiss();
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const result = await ensurePushSubscription();
      if (!result.ok) {
        console.error("[push] PushPermissionPrompt: activation échouée —", result.message);
      }
    }
  };

  if (!visible) return null;

  return (
    <div
      className="animate-fadeUp fixed inset-x-4 bottom-24 z-[60] mx-auto max-w-sm rounded-3xl border border-line bg-card shadow-[0_16px_48px_color-mix(in_srgb,var(--color-ink)_12%,transparent)]"
      style={{ "--delay": "0s" } as React.CSSProperties}
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-soft">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-violet-deep">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-[15px] font-semibold text-ink">Rester dans la boucle</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
              Reçois une notification quand un membre like ta session ou te recommande un livre.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={dismiss}
            className="flex-1 rounded-2xl border border-line py-2.5 text-[12px] font-semibold text-muted transition-[transform,opacity] duration-150 active:scale-[0.97]"
          >
            Plus tard
          </button>
          <button
            onClick={accept}
            className="flex-1 rounded-2xl bg-violet py-2.5 text-[12px] font-semibold text-cream transition-[transform,opacity] duration-150 active:scale-[0.97]"
          >
            Activer
          </button>
        </div>
      </div>
    </div>
  );
}
