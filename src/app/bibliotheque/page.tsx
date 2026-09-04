"use client";

import { useAuth } from "../../lib/auth-context";
import BibliothequeView from "../../components/BibliothequeView";

export default function BibliothequePage() {
  const { user } = useAuth();
  const userId = user?.id;

  return (
    <div className="animate-fadeIn flex flex-col gap-4 pt-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-black text-ink">Bibliothèque</h1>
      </header>

      {userId && <BibliothequeView targetUserId={userId} isOwn persistState />}
    </div>
  );
}
