"use client";

import { useState } from "react";
import { AvatarImg } from "./ui";

export type ReviewComment = {
  id: number;
  name: string;
  avatar?: string | null;
  body: string;
  when: string;
  likes?: number;
  replyTo?: string;
  mine?: boolean;
};

/** Fil de commentaires sous une review : réponses nommées, saisie en bas. Présentationnel (données en props). */
export default function ReviewThread({ comments, onSend, placeholder = "Rebondir sur cette critique…" }: {
  comments: ReviewComment[];
  onSend?: (text: string, replyTo?: string) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | undefined>();
  const [liked, setLiked] = useState<Set<number>>(new Set());

  const submit = () => {
    if (!text.trim()) return;
    onSend?.(text.trim(), replyTo);
    setText("");
    setReplyTo(undefined);
  };

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      {comments.map((c) => {
        const on = liked.has(c.id);
        return (
          <div key={c.id} className="flex gap-2.5">
            <AvatarImg url={c.avatar} name={c.name} className="h-7 w-7 shrink-0 text-[10px]" />
            <div className="min-w-0 flex-1">
              <div className="rounded-2xl rounded-tl-md bg-paper px-3 py-2">
                <p className="text-[12px] font-bold text-ink">{c.name}{c.mine && <span className="ml-1.5 font-medium text-muted">toi</span>}</p>
                <p className="text-[13px] leading-snug text-ink-2">
                  {c.replyTo && <span className="font-semibold text-violet-deep">@{c.replyTo} </span>}
                  {c.body}
                </p>
              </div>
              <div className="mt-1 flex items-center gap-3 pl-2 text-[11px] text-muted">
                <span>{c.when}</span>
                <button
                  onClick={() => setLiked((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}
                  className={`font-semibold transition-colors ${on ? "text-violet-deep" : "hover:text-ink"}`}
                >
                  J&apos;aime{(c.likes ?? 0) + (on ? 1 : 0) > 0 ? ` · ${(c.likes ?? 0) + (on ? 1 : 0)}` : ""}
                </button>
                <button onClick={() => setReplyTo(c.name)} className="font-semibold transition-colors hover:text-ink">Répondre</button>
              </div>
            </div>
          </div>
        );
      })}

      <div>
        {replyTo && (
          <p className="mb-1 flex items-center gap-2 pl-1 text-[11.5px] text-muted">
            Réponse à <span className="font-semibold text-ink-2">{replyTo}</span>
            <button onClick={() => setReplyTo(undefined)} aria-label="Annuler la réponse" className="text-muted hover:text-ink">✕</button>
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 500))}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            rows={1}
            placeholder={placeholder}
            className="max-h-24 min-h-[38px] flex-1 resize-none rounded-2xl border border-line bg-input px-3.5 py-2 text-[13.5px] text-ink outline-none focus:border-violet"
          />
          <button
            onClick={submit}
            disabled={!text.trim()}
            className="h-[38px] shrink-0 rounded-2xl bg-violet px-4 text-[13px] font-bold text-cream transition-transform duration-[140ms] active:scale-95 disabled:opacity-40"
          >
            Publier
          </button>
        </div>
      </div>
    </div>
  );
}
