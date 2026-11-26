"use client";

import { openCookieSettings } from "../lib/cookieConsent";

/** Rouvre le bandeau pour modifier son choix (obligation : retirer son consentement aussi facilement qu'on l'a donné). */
export default function CookieSettingsButton() {
  return (
    <button onClick={openCookieSettings} className="font-semibold text-violet-deep underline underline-offset-2">
      Gérer mes cookies
    </button>
  );
}
