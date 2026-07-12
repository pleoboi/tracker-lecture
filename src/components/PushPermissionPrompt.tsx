"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const STORAGE_KEY = "swena_push_dismissed";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

async function registerAndSubscribe(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
  });

  const { keys } = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth }),
  });

  return res.ok;
}

export default function PushPermissionPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    // Délai léger pour ne pas bloquer le chargement initial
    const t = setTimeout(() => setVisible(true), 1800);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  const accept = async () => {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      await registerAndSubscribe();
    }
    dismiss();
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
              Reçois une notification quand un membre like ta session ou t&apos;invite à un challenge.
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
