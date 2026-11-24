"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/auth-context";
import { hydrateQuotes, type Quote } from "../../../../lib/quotes";
import MemberSectionHeader from "../../../../components/MemberSectionHeader";
import QuoteCard from "../../../../components/QuoteCard";
import QuoteComposer, { type QuoteBook } from "../../../../components/QuoteComposer";

// Citations enregistrées par un membre (les comptes privés ne les montrent qu'à leurs amis, par la base).
export default function MemberCitationsPage() {
  const memberId = useParams().id as string;
  const { user } = useAuth();
  const isOwn = user?.id === memberId;
  const [firstName, setFirstName] = useState("");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [books, setBooks] = useState<QuoteBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const [{ data: prof }, { data: rows }] = await Promise.all([
      supabase.from("user_profiles").select("display_name").eq("id", memberId).single(),
      supabase.from("book_quotes").select("*").eq("user_id", memberId).order("created_at", { ascending: false }),
    ]);
    setFirstName(((prof as { display_name?: string } | null)?.display_name ?? "").split(" ")[0]);
    setQuotes(await hydrateQuotes((rows ?? []) as Omit<Quote, "likes" | "liked">[], user?.id));
    setLoading(false);
  }, [memberId, user?.id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!isOwn) return;
    supabase.from("books").select("id, title, author, cover_url").eq("user_id", memberId).order("title")
      .then(({ data }) => setBooks((data ?? []) as QuoteBook[]));
  }, [isOwn, memberId]);

  return (
    <div className="animate-fadeIn flex flex-col gap-4 pt-4">
      <MemberSectionHeader memberId={memberId} firstName={firstName} title="Citations" />

      {isOwn && (
        <button
          onClick={() => setAdding(true)}
          disabled={books.length === 0}
          className="self-start rounded-xl bg-violet px-4 py-2.5 text-[13.5px] font-bold text-cream transition-transform duration-[140ms] hover:scale-[1.03] active:scale-95 disabled:opacity-40"
        >
          Ajouter une citation
        </button>
      )}

      {loading ? (
        <div className="py-24 text-center text-xs font-medium uppercase tracking-wider text-muted">Chargement…</div>
      ) : quotes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
          <p className="font-serif text-base text-ink">Pas encore de citation.</p>
          <p className="mt-1 text-sm text-muted">
            {isOwn ? "Garde ici les passages que tu veux retenir, à écrire ou à photographier." : "Les citations partagées apparaîtront ici."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {quotes.map((q) => (
            <QuoteCard key={q.id} quote={q} me={user?.id} showMember={false} onChange={() => void load()} />
          ))}
        </div>
      )}

      <QuoteComposer open={adding} onClose={() => setAdding(false)} books={books} onSaved={() => void load()} />
    </div>
  );
}
