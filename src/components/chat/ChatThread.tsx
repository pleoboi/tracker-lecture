"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { MAX_MESSAGE, markConversationRead, sendDirectMessage, type DirectMessage } from "../../lib/chat";
import QuickActions from "./QuickActions";

function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Aujourd'hui";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** Fil d'une conversation (bulles + saisie), utilisé en pleine page et dans le dock. */
export default function ChatThread({ otherId, otherName, compact = false }: { otherId: string; otherName?: string; compact?: boolean }) {
  const { user } = useAuth();
  const me = user?.id;
  const myName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Un membre";
  const [msgs, setMsgs] = useState<DirectMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!me) return;
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`and(sender_id.eq.${me},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${me})`)
      .order("created_at", { ascending: true })
      .limit(500);
    setMsgs((data as DirectMessage[]) ?? []);
    setLoaded(true);
    void markConversationRead(me, otherId);
  }, [me, otherId]);

  useEffect(() => { void load(); }, [load]);

  // Message reçu en direct (relayé par le dock global)
  useEffect(() => {
    const onMsg = (e: Event) => {
      const m = (e as CustomEvent<DirectMessage>).detail;
      if (m.sender_id !== otherId || !me) return;
      setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      void markConversationRead(me, otherId);
    };
    window.addEventListener("swena:message-received", onMsg);
    return () => window.removeEventListener("swena:message-received", onMsg);
  }, [me, otherId]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, loaded]);

  const input = useRef<HTMLTextAreaElement>(null);

  const deliver = async (body: string) => {
    if (!me || !body.trim()) return false;
    setError(null);
    const m = await sendDirectMessage(me, myName, otherId, body);
    if (!m) { setError("Le message n'est pas parti, réessaie."); return false; }
    setMsgs((prev) => [...prev, m]);
    return true;
  };

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const ok = await deliver(text);
    setSending(false);
    if (ok) setText("");
  };

  const prefill = (t: string) => {
    setText(t);
    requestAnimationFrame(() => { const el = input.current; if (el) { el.focus(); el.setSelectionRange(t.length, t.length); } });
  };

  const lastMine = [...msgs].reverse().find((m) => m.sender_id === me);
  const bubble = compact ? "text-[13.5px] px-3 py-1.5" : "text-[14px] px-3.5 py-2";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className={`min-h-0 flex-1 overflow-y-auto ${compact ? "px-3 py-3" : "py-4"}`}>
        {loaded && msgs.length === 0 && (
          <p className="mt-10 text-center text-[13px] text-muted">Dis bonjour{otherName ? ` à ${otherName}` : ""} !</p>
        )}
        <div className="flex flex-col gap-1.5">
          {msgs.map((m, i) => {
            const mine = m.sender_id === me;
            const newDay = i === 0 || new Date(msgs[i - 1].created_at).toDateString() !== new Date(m.created_at).toDateString();
            return (
              <div key={m.id}>
                {newDay && <p className="my-3 text-center text-[11px] font-semibold capitalize text-muted">{dayLabel(m.created_at)}</p>}
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl leading-snug ${bubble} ${
                    mine ? "rounded-br-md bg-violet text-cream" : "rounded-bl-md border border-line bg-card text-ink"}`}>
                    {m.body}
                    <span className={`ml-2 inline-block align-bottom text-[10px] ${mine ? "text-cream/70" : "text-muted"}`}>
                      {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
                {mine && m.id === lastMine?.id && m.read_at && <p className="mt-0.5 text-right text-[10.5px] text-muted">Vu</p>}
              </div>
            );
          })}
        </div>
      </div>

      {error && <p className="px-3 pb-1 text-[12px] font-medium text-danger">{error}</p>}
      <div className="border-t border-line">
        <QuickActions me={me} otherId={otherId} onSend={deliver} onPrefill={prefill} />
      </div>
      <div className={`flex items-end gap-2 ${compact ? "px-3 pb-2.5 pt-1" : "pt-1"}`}>
        <textarea
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_MESSAGE))}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          rows={1}
          placeholder="Ton message…"
          className="max-h-28 min-h-[40px] flex-1 resize-none rounded-2xl border border-line bg-input px-3.5 py-2 text-[14px] text-ink outline-none focus:border-violet"
        />
        <button
          onClick={() => void send()}
          disabled={!text.trim() || sending}
          className="h-[40px] shrink-0 rounded-2xl bg-violet px-4 text-[13.5px] font-bold text-cream transition-transform active:scale-95 disabled:opacity-40"
        >
          Envoyer
        </button>
      </div>
    </div>
  );
}
