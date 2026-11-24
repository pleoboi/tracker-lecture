"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ConversationList, { useConversations } from "../../components/chat/ConversationList";

// Liste des conversations en pleine page, la plus récente en haut.
export default function MessagesPage() {
  const router = useRouter();
  const { convos, loading, me } = useConversations();

  return (
    <div className="animate-fadeIn flex flex-col gap-4 pt-4">
      <h1 className="font-serif text-3xl font-black text-ink">Messages</h1>

      {loading ? (
        <div className="py-20 text-center text-xs font-medium uppercase tracking-wider text-muted">Chargement…</div>
      ) : convos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
          <p className="font-serif text-base text-ink">Aucune conversation pour l&apos;instant.</p>
          <p className="mt-1 text-sm text-muted">Ouvre le profil d&apos;un membre et touche « Message » pour lui écrire.</p>
          <Link href="/membres" className="mt-4 inline-block rounded-xl bg-violet px-4 py-2 text-[13px] font-semibold text-cream">Voir les membres</Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          <ConversationList convos={convos} me={me} onSelect={(c) => router.push(`/messages/${c.otherId}`)} />
        </div>
      )}
    </div>
  );
}
