"use client";

import { useEffect } from "react";
import { ensurePushSubscription } from "../lib/push.client";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").then(() => {
      // Réabonnement automatique si la permission est déjà accordée
      ensurePushSubscription();
    }).catch((err) => {
      console.warn("[sw] Échec enregistrement service worker:", err);
    });
  }, []);
  return null;
}
