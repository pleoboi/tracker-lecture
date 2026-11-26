"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OPEN_COOKIE_SETTINGS, readConsent, saveConsent } from "../lib/cookieConsent";

const EASE = "duration-[140ms] ease-[cubic-bezier(0.32,0.72,0,1)]";

/** Bandeau cookies : refuser est aussi simple qu'accepter, et le choix se rouvre depuis la politique de confidentialité. */
export default function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const rec = readConsent();
    if (!rec) setOpen(true);
    else setAnalytics(rec.analytics);
    const reopen = () => {
      setAnalytics(readConsent()?.analytics ?? false);
      setCustom(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, reopen);
  }, []);

  if (!open) return null;

  const choose = (value: boolean) => {
    saveConsent(value);
    setAnalytics(value);
    setOpen(false);
    setCustom(false);
  };

  const btn = `rounded-full px-4 py-2.5 text-[13px] font-bold transition-transform ${EASE} hover:scale-[1.04] active:scale-[0.96]`;

  return (
    <div
      role="dialog"
      aria-label="Gestion des cookies"
      className="fixed inset-x-0 bottom-0 z-[120] flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))]"
    >
      <div className="w-full max-w-[560px] rounded-3xl border border-line bg-card p-4 shadow-[0_18px_50px_-12px_rgba(20,10,60,0.45)] animate-fadeIn sm:p-5">
        <p className="font-serif text-[16px] font-semibold text-ink">Vos cookies</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Swena utilise uniquement des cookies nécessaires : ils gardent votre session ouverte et retiennent vos préférences d&apos;affichage.
          Aucun traceur publicitaire. Vous pouvez aussi autoriser la mesure d&apos;audience, aujourd&apos;hui inactive.{" "}
          <Link href="/confidentialite" className="font-semibold text-violet-deep underline underline-offset-2">En savoir plus</Link>
        </p>

        {custom && (
          <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-paper p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink">Strictement nécessaires</p>
                <p className="text-[12px] text-muted">Session, sécurité, préférences. Toujours actifs.</p>
              </div>
              <span className="shrink-0 rounded-full bg-line px-2.5 py-1 text-[11px] font-semibold text-muted">Actifs</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line pt-2">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink">Mesure d&apos;audience</p>
                <p className="text-[12px] text-muted">Statistiques de fréquentation anonymes.</p>
              </div>
              <button
                role="switch"
                aria-checked={analytics}
                aria-label="Mesure d'audience"
                onClick={() => setAnalytics((a) => !a)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${EASE} ${analytics ? "bg-violet" : "bg-line"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${EASE} ${analytics ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {custom ? (
            <button onClick={() => choose(analytics)} className={`${btn} flex-1 bg-violet text-cream`}>Enregistrer mon choix</button>
          ) : (
            <>
              <button onClick={() => choose(true)} className={`${btn} flex-1 bg-violet text-cream`}>Tout accepter</button>
              <button onClick={() => choose(false)} className={`${btn} flex-1 border border-line bg-paper text-ink`}>Tout refuser</button>
              <button onClick={() => setCustom(true)} className={`${btn} w-full text-violet-deep sm:w-auto`}>Personnaliser</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
