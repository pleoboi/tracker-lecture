"use client";

import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { ensurePushSubscription } from "../lib/push.client";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[sw] Échec enregistrement service worker:", err);
    });

    // Appel ensurePushSubscription uniquement quand la session est confirmée,
    // pas juste après le register() où l'auth n'est pas encore disponible.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) ensurePushSubscription();
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
