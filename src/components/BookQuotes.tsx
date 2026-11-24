"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { bookKey } from "../lib/quiz";
import { hydrateQuotes, type Quote } from "../lib/quotes";
import QuoteCard from "./QuoteCard";
import QuoteComposer, { type QuoteBook } from "./QuoteComposer";

/** Citations de ce livre enregistrées par les membres (hors comptes privés non amis, filtré par la base). */
export default function BookQuotes({ title, ownBook }: { title: string; ownBook?: QuoteBook | null }) {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [all, setAll] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("book_quotes").select("*").eq("book_key", bookKey(title)).order("created_at", { ascending: false }).limit(60);
    if (error) { setLoaded(true); return; }
    const hydrated = await hydrateQuotes((data ?? []) as Omit<Quote, "likes" | "liked">[], user?.id);
    // Les plus aimées d'abord, puis les plus récentes
    setQuotes(hydrated.sort((a, b) => b.likes - a.likes || b.created_at.localeCompare(a.created_at)));
    setLoaded(true);
  }, [title, user?.id]);

  useEffect(() => { void load(); }, [load]);

  if (!loaded || (quotes.length === 0 && !ownBook)) return null;
  const shown = all ? quotes : quotes.slice(0, 3);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Citations{quotes.length > 0 ? ` · ${quotes.length}` : ""}
        </p>
        {ownBook && (
          <button
            onClick={() => setAdding(true)}
            className="rounded-full border border-line bg-card px-3 py-1 text-[12px] font-semibold text-ink-2 transition-[transform,border-color] duration-[140ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-105 hover:border-violet active:scale-95"
          >
            Ajouter
          </button>
        )}
      </div>

      {quotes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-card px-4 py-5 text-center text-[13px] text-muted">
          Aucune citation pour ce livre. Ajoute la première.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {shown.map((q) => <QuoteCard key={q.id} quote={q} me={user?.id} showBook={false} onChange={() => void load()} />)}
        </div>
      )}
      {quotes.length > 3 && (
        <button onClick={() => setAll((v) => !v)} className="self-center text-[12.5px] font-semibold text-violet-deep">
          {all ? "Réduire" : `Voir les ${quotes.length} citations`}
        </button>
      )}

      {ownBook && <QuoteComposer open={adding} onClose={() => setAdding(false)} books={[ownBook]} onSaved={() => void load()} />}
    </section>
  );
}
