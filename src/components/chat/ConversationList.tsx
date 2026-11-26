"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { AvatarImg } from "../ui";
import { parseMessage, shortTime, type DirectMessage } from "../../lib/chat";

export type Convo = { otherId: string; name: string; avatar: string | null; last: DirectMessage; unread: number };

/** Conversations de l'utilisateur, la plus récente en premier (se recharge à chaque message). */
export function useConversations() {
  const { user } = useAuth();
  const me = user?.id;
  const [convos, setConvos] = useState<Convo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!me) return;
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
      .order("created_at", { ascending: false })
      .limit(500);
    const map = new Map<string, { last: DirectMessage; unread: number }>();
    for (const m of (data as DirectMessage[]) ?? []) {
      const other = m.sender_id === me ? m.recipient_id : m.sender_id;
      const c = map.get(other) ?? { last: m, unread: 0 };
      if (m.recipient_id === me && !m.read_at) c.unread++;
      map.set(other, c);
    }
    const ids = [...map.keys()];
    const { data: profs } = ids.length
      ? await supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", ids)
      : { data: [] };
    const pm = new Map(((profs ?? []) as { id: string; display_name: string; avatar_url: string | null }[]).map((p) => [p.id, p]));
    setConvos(ids.map((id) => ({ otherId: id, name: pm.get(id)?.display_name ?? "Membre", avatar: pm.get(id)?.avatar_url ?? null, ...map.get(id)! })));
    setLoading(false);
  }, [me]);

  useEffect(() => {
    void load();
    const reload = () => void load();
    window.addEventListener("swena:messages-read", reload);
    window.addEventListener("swena:message-received", reload);
    window.addEventListener("swena:message-sent", reload);
    return () => {
      window.removeEventListener("swena:messages-read", reload);
      window.removeEventListener("swena:message-received", reload);
      window.removeEventListener("swena:message-sent", reload);
    };
  }, [load]);

  return { convos, loading, me };
}

export default function ConversationList({ convos, me, onSelect, compact = false }: {
  convos: Convo[];
  me?: string;
  onSelect: (c: Convo) => void;
  compact?: boolean;
}) {
  return (
    <ul className="flex flex-col">
      {convos.map((c) => (
        <li key={c.otherId}>
          <button onClick={() => onSelect(c)} className={`flex w-full items-center gap-3 text-left hover:bg-paper ${compact ? "px-3.5 py-2.5" : "px-4 py-3.5"}`}>
            <AvatarImg url={c.avatar} name={c.name} className={`${compact ? "h-10 w-10" : "h-11 w-11"} shrink-0 text-base`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className={`truncate text-[14px] text-ink ${c.unread ? "font-bold" : "font-semibold"}`}>{c.name}</p>
                <span className="shrink-0 text-[11px] text-muted">{shortTime(c.last.created_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className={`truncate text-[12.5px] ${c.unread ? "font-semibold text-ink" : "text-muted"}`}>
                  {c.last.sender_id === me ? "Toi : " : ""}{parseMessage(c.last.body).bookId ? "Livre · " : ""}{parseMessage(c.last.body).text}
                </p>
                {c.unread > 0 && <span className="h-2 w-2 shrink-0 rounded-full bg-violet" />}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
