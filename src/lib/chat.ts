import { supabase } from "./supabase";
import { notifyUser } from "./push.client";

// Messagerie privée entre membres (table direct_messages, migration v44).
export type DirectMessage = {
  id: number;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export const MAX_MESSAGE = 1000;

export async function sendDirectMessage(fromId: string, fromName: string, toId: string, text: string): Promise<DirectMessage | null> {
  const body = text.trim().slice(0, MAX_MESSAGE);
  if (!body) return null;
  const { data, error } = await supabase
    .from("direct_messages")
    .insert({ sender_id: fromId, recipient_id: toId, body })
    .select()
    .single();
  if (error) return null;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("swena:message-sent"));
  notifyUser(toId, "Swena", `${fromName} : ${body.length > 90 ? body.slice(0, 90) + "…" : body}`, `/messages/${fromId}`, "messages");
  return data as DirectMessage;
}

export async function markConversationRead(meId: string, otherId: string) {
  await supabase
    .from("direct_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", meId)
    .eq("sender_id", otherId)
    .is("read_at", null);
  window.dispatchEvent(new CustomEvent("swena:messages-read"));
}

export async function unreadCount(meId: string): Promise<number> {
  const { count } = await supabase
    .from("direct_messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", meId)
    .is("read_at", null);
  return count ?? 0;
}

/** Heure courte : "14:32" aujourd'hui, "hier", sinon "12 nov." */
export function shortTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
