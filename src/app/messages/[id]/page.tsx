"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { AvatarImg } from "../../../components/ui";
import ChatThread from "../../../components/chat/ChatThread";

// Conversation avec un membre, en pleine page.
export default function ConversationPage() {
  const otherId = useParams().id as string;
  const [other, setOther] = useState<{ name: string; avatar: string | null } | null>(null);

  useEffect(() => {
    supabase.from("user_profiles").select("display_name, avatar_url").eq("id", otherId).single().then(({ data }) => {
      const p = data as { display_name?: string; avatar_url?: string | null } | null;
      setOther({ name: p?.display_name ?? "Membre", avatar: p?.avatar_url ?? null });
    });
  }, [otherId]);

  return (
    <div className="flex h-[calc(100dvh-190px)] flex-col pt-3 md:h-[calc(100dvh-140px)]">
      <div className="flex items-center gap-3 border-b border-line pb-3">
        <Link href="/messages" className="text-xl leading-none text-muted hover:text-ink" aria-label="Retour aux messages">‹</Link>
        <Link href={`/membre/${otherId}`} className="flex min-w-0 items-center gap-2.5">
          <AvatarImg url={other?.avatar} name={other?.name ?? "?"} className="h-9 w-9 text-sm" />
          <span className="truncate font-serif text-[17px] font-bold text-ink">{other?.name ?? ""}</span>
        </Link>
      </div>
      <ChatThread otherId={otherId} otherName={other?.name} />
    </div>
  );
}
