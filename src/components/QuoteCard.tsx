"use client";

import { useState } from "react";
import Link from "next/link";
import { AvatarImg } from "./ui";
import { BOOK_PANEL } from "./BookSheet";
import { toggleQuoteLike, type Quote } from "../lib/quotes";
import { supabase } from "../lib/supabase";

const Heart = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.5s-7.5-4.6-9.2-9.3C1.7 8 3.6 5 6.7 5c1.9 0 3.5 1 5.3 3 1.8-2 3.4-3 5.3-3 3.1 0 5 3 3.9 6.2-1.7 4.7-9.2 9.3-9.2 9.3Z" />
  </svg>
);

/** Citation : texte en serif, livre, auteur du partage, like et (pour la sienne) suppression. */
export default function QuoteCard({ quote, me, showBook = true, showMember = true, onChange }: {
  quote: Quote; me?: string | null; showBook?: boolean; showMember?: boolean; onChange?: () => void;
}) {
  const [liked, setLiked] = useState(quote.liked);
  const [likes, setLikes] = useState(quote.likes);
  const [confirm, setConfirm] = useState(false);
  const mine = me === quote.user_id;

  const like = async () => {
    if (!me) return;
    const was = liked;
    setLiked(!was);
    setLikes((n) => n + (was ? -1 : 1));
    try { await toggleQuoteLike(quote.id, me, was); }
    catch { setLiked(was); setLikes((n) => n + (was ? 1 : -1)); }
  };

  const remove = async () => {
    await supabase.from("book_quotes").delete().eq("id", quote.id);
    onChange?.();
  };

  return (
    <article className={`flex flex-col gap-3 p-4 ${BOOK_PANEL}`}>
      <p className="font-serif text-[15px] italic leading-relaxed text-ink">« {quote.body} »</p>

      {showBook && (
        <p className="text-[12px] text-muted">
          <span className="font-semibold text-ink-2">{quote.book_title}</span>
          {quote.book_author ? ` · ${quote.book_author}` : ""}
          {quote.page ? ` · p. ${quote.page}` : ""}
        </p>
      )}
      {!showBook && quote.page ? <p className="text-[12px] text-muted">Page {quote.page}</p> : null}

      <div className="flex items-center gap-2">
        {showMember && (
          <Link href={`/membre/${quote.user_id}`} className="flex min-w-0 items-center gap-2 text-[12px] text-muted hover:text-ink">
            <AvatarImg url={quote.author_avatar} name={quote.author_name ?? "?"} className="h-6 w-6 shrink-0 text-[10px]" />
            <span className="truncate">{mine ? "Toi" : quote.author_name}</span>
          </Link>
        )}
        <div className="ml-auto flex items-center gap-1">
          {mine && (
            confirm ? (
              <>
                <button onClick={() => void remove()} className="rounded-full px-2.5 py-1 text-[12px] font-semibold text-danger hover:bg-card">Supprimer</button>
                <button onClick={() => setConfirm(false)} className="rounded-full px-2.5 py-1 text-[12px] text-muted hover:bg-card">Annuler</button>
              </>
            ) : (
              <button onClick={() => setConfirm(true)} aria-label="Supprimer la citation" className="rounded-full px-2.5 py-1 text-[12px] text-muted transition-colors hover:bg-card hover:text-ink">Supprimer</button>
            )
          )}
          <button
            onClick={() => void like()}
            disabled={!me}
            aria-label={liked ? "Retirer mon like" : "Liker la citation"}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold transition-[transform,color,background-color] duration-[140ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-105 active:scale-90 ${
              liked ? "bg-violet-soft text-violet-deep" : "text-muted hover:bg-card hover:text-ink"}`}
          >
            <Heart on={liked} />
            {likes > 0 && likes}
          </button>
        </div>
      </div>
    </article>
  );
}
