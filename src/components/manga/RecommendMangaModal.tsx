"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { mangaMessage, sendDirectMessage, MAX_MESSAGE } from "../../lib/chat";
import { AvatarImg, Modal } from "../ui";
import { useFriends } from "../chat/NewConversation";
import { MangaCover } from "./MangaUI";

type Mine = { id: number; title: string; cover_url: string | null };

/** Recommander une série de ta mangathèque à un ami : part dans la messagerie, avec la couverture cliquable. */
export default function RecommendMangaModal({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: (to: string, title: string) => void }) {
  const { user } = useAuth();
  const me = user?.id;
  const myName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Un membre";
  const friends = useFriends(open ? me : undefined);
  const [series, setSeries] = useState<Mine[] | null>(null);
  const [friendId, setFriendId] = useState<string | null>(null);
  const [mangaId, setMangaId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !me) return;
    setFriendId(null); setMangaId(null); setNote(""); setSearch(""); setError(null); setSeries(null);
    supabase.from("mangas").select("id, title, cover_url").eq("user_id", me).order("title").limit(300)
      .then(({ data }) => setSeries((data ?? []) as Mine[]));
  }, [open, me]);

  const friend = friends?.find((f) => f.id === friendId);
  const picked = series?.find((s) => s.id === mangaId);
  const shown = (series ?? []).filter((s) => !search || s.title.toLowerCase().includes(search.toLowerCase()));

  const send = async () => {
    if (!me || !friend || !picked || sending) return;
    setSending(true);
    setError(null);
    const base = `Je te recommande « ${picked.title} ».`;
    const text = note.trim() ? `${base}\n${note.trim()}` : base;
    const m = await sendDirectMessage(me, myName, friend.id, mangaMessage(picked.id, text.slice(0, MAX_MESSAGE - 20)));
    setSending(false);
    if (!m) { setError("Le message n'est pas parti, réessaie."); return; }
    onSent(friend.name, picked.title);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Recommander une série"
      footer={
        <button
          onClick={() => void send()}
          disabled={!friend || !picked || sending}
          className="btn-press w-full rounded-xl border-2 border-ink bg-violet py-3 text-sm font-bold text-cream disabled:opacity-40"
        >
          {sending ? "Envoi…" : friend && picked ? `Envoyer à ${friend.name}` : "Choisis un ami et une série"}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-muted">À qui ?</p>
          {friends === null ? (
            <p className="text-[12.5px] text-muted">Chargement…</p>
          ) : friends.length === 0 ? (
            <p className="text-[12.5px] text-muted">Suis des membres pour pouvoir leur recommander une série.</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {friends.map((f) => (
                <button key={f.id} onClick={() => setFriendId(f.id)} aria-pressed={friendId === f.id}
                  className={`flex w-[64px] shrink-0 flex-col items-center gap-1 rounded-xl p-1.5 transition-colors ${friendId === f.id ? "bg-violet-soft ring-2 ring-violet" : "hover:bg-card"}`}>
                  <AvatarImg url={f.avatar} name={f.name} className="h-11 w-11 text-[14px]" />
                  <span className="w-full truncate text-center text-[11px] font-semibold text-ink">{f.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-muted">Quelle série ?</p>
          {series === null ? (
            <p className="text-[12.5px] text-muted">Chargement…</p>
          ) : series.length === 0 ? (
            <p className="text-[12.5px] text-muted">Ta mangathèque est vide pour l&apos;instant.</p>
          ) : (
            <>
              {series.length > 8 && (
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher dans ta mangathèque"
                  className="mb-2 w-full rounded-xl border border-line bg-input px-3 py-2 text-[13px] text-ink outline-none focus:border-violet" />
              )}
              <div className="grid max-h-[260px] grid-cols-3 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-4">
                {shown.map((s) => (
                  <button key={s.id} onClick={() => setMangaId(s.id)} aria-pressed={mangaId === s.id}
                    className={`flex flex-col gap-1 rounded-lg p-1 text-left transition-colors ${mangaId === s.id ? "bg-violet-soft ring-2 ring-violet" : "hover:bg-card"}`}>
                    <MangaCover id={s.id} title={s.title} coverUrl={s.cover_url} className="aspect-[2/3] h-auto w-full" />
                    <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-ink">{s.title}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold uppercase tracking-wider text-muted">Un mot pour la donner envie (facultatif)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} rows={2} placeholder="Tu vas adorer les combats…"
            className="resize-none rounded-xl border border-line bg-input px-3 py-2 text-[13.5px] text-ink outline-none focus:border-violet" />
        </label>
        {error && <p className="text-[12.5px] font-medium text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
