// Choix de l'utilisateur sur les cookies et traceurs (RGPD / directive ePrivacy).
// Les cookies strictement nécessaires (session, préférences d'affichage) ne demandent pas de consentement.
// Toute future mesure d'audience ou intégration tierce doit passer par hasConsent("analytics").

export type ConsentCategory = "analytics";

export type ConsentRecord = {
  v: 1;
  at: string; // date ISO du choix
  analytics: boolean;
};

const KEY = "swena_cookie_consent";
export const OPEN_COOKIE_SETTINGS = "swena:open-cookie-settings";
export const COOKIE_CONSENT_CHANGED = "swena:cookie-consent-changed";

export function readConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as ConsentRecord;
    return r && r.v === 1 && typeof r.analytics === "boolean" ? r : null;
  } catch {
    return null;
  }
}

export function saveConsent(analytics: boolean): ConsentRecord {
  const rec: ConsentRecord = { v: 1, at: new Date().toISOString(), analytics };
  try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch { /* stockage indisponible */ }
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED, { detail: rec }));
  return rec;
}

export function hasConsent(category: ConsentCategory): boolean {
  return readConsent()?.[category] === true;
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS));
}
