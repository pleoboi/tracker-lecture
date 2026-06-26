"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const registered = params.get("registered") === "1";
  const prefillEmail = params.get("email") ?? "";

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (prefillEmail) setEmail(prefillEmail);
  }, [prefillEmail]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Email ou mot de passe incorrect.");
      setLoading(false);
      return;
    }
    router.push("/accueil");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-4xl font-black text-ink">Swena</h1>
          <p className="mt-1.5 text-sm text-muted">Club de lecture privé</p>
        </div>

        {registered && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#cfe0cf] bg-[#eaf1ea] px-4 py-3.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0 text-success">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <div>
              <p className="text-[13px] font-semibold text-success">Compte créé avec succès !</p>
              <p className="mt-0.5 text-[12px] text-ink-2">
                Connecte-toi avec ton email et ton mot de passe.
              </p>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6 shadow-sm"
        >
          <h2 className="font-serif text-xl font-bold text-ink">Connexion</h2>

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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="rounded-xl border border-line bg-paper px-3.5 py-3 text-sm text-ink outline-none placeholder:text-muted focus:border-violet"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-[#e7c7bd] bg-[#f6e7e1] px-3.5 py-2.5 text-xs font-medium text-danger">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Connexion…" : "Se connecter"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          Pas encore de compte ?{" "}
          <Link
            href="/register"
            className="font-semibold text-violet-deep underline decoration-violet/40 underline-offset-2"
          >
            S&apos;inscrire
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
