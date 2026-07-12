import { supabase } from "./supabase";

export function notifyUser(targetUserId: string, title: string, body: string, url?: string) {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) return;
    fetch("/api/push/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ targetUserId, title, body, url }),
    }).catch(() => {});
  });
}
