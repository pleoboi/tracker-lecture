"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/ui";

export default function ComptePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-xs font-medium uppercase tracking-wider text-muted">
        Chargement…
      </div>
    );
  }

  const displayName =
    user?.user_metadata?.display_name ||
    user?.email?.split("@")[0] ||
    "Anonyme";
  const initial = displayName[0]?.toUpperCase() ?? "?";

  return (
    <div className="animate-fadeIn flex flex-col gap-6 pt-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-black text-ink">Mon compte</h1>
        <p className="text-xs font-medium text-muted">Profil et paramètres</p>
      </header>

      {/* Carte profil */}
      <div className="flex items-center gap-4 rounded-2xl border border-line bg-card p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet font-serif text-xl font-semibold text-cream">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg font-semibold text-ink">{displayName}</p>
          <p className="truncate text-xs text-muted">{user?.email}</p>
        </div>
      </div>

      {/* Lien vers profil public */}
      {user?.id && (
        <Link
          href={`/membre/${user.id}`}
          className="flex items-center justify-between rounded-2xl border border-line bg-card p-5 transition-colors hover:border-violet/40"
        >
          <div>
            <p className="font-serif text-[15px] font-medium text-ink">Voir mon profil public</p>
            <p className="mt-0.5 text-xs text-muted">
              Ce que les autres membres voient de toi
            </p>
          </div>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-4 w-4 shrink-0 text-muted"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}

      <Button
        variant="ghost"
        onClick={handleLogout}
        className="w-full border-danger/30 text-danger hover:bg-[#f6e7e1]"
      >
        Se déconnecter
      </Button>
    </div>
  );
}
