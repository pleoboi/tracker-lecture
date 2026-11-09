"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/ui";
import { ALL_UNIVERSES, homeFor, type Universe } from "../../lib/universes";

const UNIVERSE_OPTIONS: { key: Universe; label: string; desc: string }[] = [
  { key: "books", label: "Livres", desc: "Tes lectures, objectifs et ton club" },
  { key: "manga", label: "Manga", desc: "Ta mangathèque, tes chapitres, les sorties" },
];

const REFERRAL_STORAGE_KEY = "swena_ref";

// useSearchParams() exige un contexte Suspense pour ne pas bloquer la
// génération statique de la page.
export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Le lien de parrainage contient l'id du parrain (?ref=uuid). On le mémorise
  // dès l'arrivée sur la page : la confirmation d'e-mail peut recharger la page
  // sans le paramètre, donc on ne peut pas compter sur l'URL au moment du submit.
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      try { localStorage.setItem(REFERRAL_STORAGE_KEY, ref); } catch { /* ignore */ }
    }
  }, [searchParams]);

  // ?univers=manga ou ?univers=livres (lien partagé) présélectionne un seul univers
  const [universes, setUniverses] = useState<Universe[]>(() => {
    const wanted = searchParams.get("univers");
    return wanted === "manga" ? ["manga"] : wanted === "livres" || wanted === "books" ? ["books"] : ALL_UNIVERSES;
  });
  const toggleUniverse = (u: Universe) =>
    setUniverses((cur) => (cur.includes(u) ? (cur.length > 1 ? cur.filter((x) => x !== u) : cur) : ALL_UNIVERSES.filter((x) => x === u || cur.includes(x))));

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) return setError("Ton pseudo est obligatoire.");

    setLoading(true);

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim(), universes },
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${homeFor(universes)}`,
      },
    });

    if (signUpErr) {
      const msg = signUpErr.message.includes("already registered")
        ? "Un compte existe déjà avec cet email."
        : signUpErr.message;
      setError(msg);
      setLoading(false);
      return;
    }

    // Si "Confirm email" est désactivé dans Supabase, la session est disponible immédiatement
    if (data.session) {
      router.push(homeFor(universes));
      router.refresh();
      return;
    }

    // Sinon, email de confirmation envoyé
    router.push(`/email-sent?email=${encodeURIComponent(email)}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-4xl font-black text-ink">Swena</h1>
          <p className="mt-1.5 text-sm text-muted">Rejoins le cercle de lecture</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6 shadow-sm"
        >
          <h2 className="font-serif text-xl font-bold text-ink">Créer un compte</h2>

          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Tu veux suivre…
            </label>
            <div className="grid grid-cols-2 gap-2">
              {UNIVERSE_OPTIONS.map((o) => {
                const on = universes.includes(o.key);
                return (
                  <button
                    key={o.key}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggleUniverse(o.key)}
                    className={`flex min-w-0 flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-colors ${
                      on ? "border-violet bg-violet-soft" : "border-line bg-paper hover:border-violet/40"
                    }`}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="font-serif text-base font-bold text-ink">{o.label}</span>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
                          on ? "border-violet bg-violet text-cream" : "border-line text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                    </span>
                    <span className="text-[11px] leading-snug text-muted">{o.desc}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted">Tu pourras ajouter ou retirer un univers dans les paramètres.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Ton pseudo
            </label>
            <input
              type="text"
              required
              autoFocus
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex : Léo_lit, Emma_B…"
              className="rounded-xl border border-line bg-paper px-3.5 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-violet"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Adresse e-mail
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@exemple.fr"
              className="rounded-xl border border-line bg-paper px-3.5 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-violet"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Mot de passe
            </label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 caractères"
              className="rounded-xl border border-line bg-paper px-3.5 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-violet"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-danger-soft bg-danger-soft px-3.5 py-2.5 text-xs font-medium text-danger">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Création…" : "Créer mon compte"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          Déjà un compte ?{" "}
          <Link
            href="/login"
            className="font-semibold text-violet-deep underline decoration-violet/40 underline-offset-2"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
