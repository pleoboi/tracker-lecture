"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/ui";

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
        data: { display_name: displayName.trim() },
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/accueil`,
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
      router.push("/accueil");
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
