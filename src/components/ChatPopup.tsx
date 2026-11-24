"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth-context";
import { AvatarImg } from "./ui";
import { unreadCount, type DirectMessage } from "../lib/chat";
import ChatThread from "./chat/ChatThread";
import ConversationList, { useConversations, type Convo } from "./chat/ConversationList";
import NewConversation, { useFriends, type Friend } from "./chat/NewConversation";

const openChat = (detail?: { otherId: string; name: string; avatar: string | null }) =>
  window.dispatchEvent(new CustomEvent("swena:open-chat", { detail }));

const ChatIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z" />
  </svg>
);

const ComposeIcon = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5M17.5 3.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 8.5-8.5Z" />
  </svg>
);

const iconBtn = "flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-card hover:text-ink";

function useUnread() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    const refresh = () => { unreadCount(uid).then(setUnread).catch(() => {}); };
    refresh();
    window.addEventListener("swena:message-received", refresh);
    window.addEventListener("swena:messages-read", refresh);
    return () => {
      window.removeEventListener("swena:message-received", refresh);
      window.removeEventListener("swena:messages-read", refresh);
    };
  }, [user?.id]);
  return unread;
}

/** Bouton « Messages » de l'en-tête (ordinateur) : ouvre la messagerie, avec le nombre de non lus. */
export function ChatButton() {
  const unread = useUnread();
  return (
    <button
      type="button"
      onClick={() => openChat()}
      aria-label="Messages"
      title="Messages"
      className="relative flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-muted transition-[color,border-color,transform] duration-[140ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-[1.07] active:scale-[0.93] hover:border-violet hover:text-violet-deep"
    >
      <ChatIcon />
      {unread > 0 && (
        <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

/** Le bouton flottant du téléphone s'efface quand on fait défiler vers le bas, revient vers le haut. */
function useHideOnScroll() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > last + 8 && y > 80) setHidden(true);
      else if (y < last - 8) setHidden(false);
      last = y;
    };
    const vv = window.visualViewport;
    const onResize = () => { if (vv) setHidden(window.innerHeight - vv.height > 150); };
    window.addEventListener("scroll", onScroll, { passive: true });
    vv?.addEventListener("resize", onResize);
    return () => { window.removeEventListener("scroll", onScroll); vv?.removeEventListener("resize", onResize); };
  }, []);
  return hidden;
}

type Peer = { otherId: string; name: string; avatar: string | null };
type Banner = Peer & { body: string };

/**
 * Messagerie flottante :
 * - ordinateur : pastille « Messages » en bas à droite, qui s'ouvre en panneau (liste, nouveau message, conversation) ;
 * - téléphone : petit bouton rond au-dessus de la barre de navigation (il s'efface au défilement),
 *   qui ouvre le même panneau en feuille ; un message reçu s'annonce par un bandeau.
 */
export default function ChatPopup({ demo }: { demo?: { convos: Convo[]; friends?: Friend[]; banner?: Banner; open?: boolean; compose?: boolean; peer?: Peer } } = {}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const live = useConversations();
  const convos = demo?.convos ?? live.convos;
  const me = live.me ?? "me";
  const unread = convos.reduce((s, c) => s + c.unread, 0);
  const [open, setOpen] = useState(!!demo?.open);
  const [peer, setPeer] = useState<Peer | null>(demo?.peer ?? null);
  const [composing, setComposing] = useState(!!demo?.compose);
  const [banner, setBanner] = useState<Banner | null>(demo?.banner ?? null);
  const friends = useFriends(open && composing ? user?.id : undefined, demo?.friends);
  const fabHidden = useHideOnScroll();
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);

  // Ouverture depuis l'en-tête ou un autre écran
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<Peer | undefined>).detail;
      setPeer(d ?? null);
      setComposing(false);
      setOpen(true);
      setBanner(null);
    };
    window.addEventListener("swena:open-chat", onOpen);
    return () => window.removeEventListener("swena:open-chat", onOpen);
  }, []);

  // Réception en direct
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    const channel = supabase
      .channel(`dm-${uid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${uid}` }, async (payload) => {
        const m = payload.new as DirectMessage;
        window.dispatchEvent(new CustomEvent("swena:message-received", { detail: m }));
        if (window.location.pathname === `/messages/${m.sender_id}`) return;
        const { data } = await supabase.from("user_profiles").select("display_name, avatar_url").eq("id", m.sender_id).single();
        const p = data as { display_name?: string; avatar_url?: string | null } | null;
        const from: Peer = { otherId: m.sender_id, name: p?.display_name ?? "Un membre", avatar: p?.avatar_url ?? null };
        if (window.matchMedia("(min-width: 768px)").matches) {
          // Ordinateur : la conversation s'ouvre directement dans le panneau
          setPeer((cur) => cur ?? from);
          setComposing(false);
          setOpen(true);
        } else {
          if (!openRef.current) setBanner({ ...from, body: m.body });
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  // Pas de dock sur les pages Messages (déjà en plein écran) ni sans compte
  if ((!user && !demo) || pathname.startsWith("/messages")) return null;

  const close = () => { setOpen(false); setPeer(null); setComposing(false); };
  const startWith = (f: Friend) => { setPeer({ otherId: f.id, name: f.name, avatar: f.avatar }); setComposing(false); };

  return (
    <>
      {/* Bandeau de message reçu (téléphone) */}
      {banner && !open && (
        <div className="animate-slideUp fixed inset-x-3 bottom-24 z-[70] flex items-center gap-3 rounded-2xl border border-line bg-paper p-3 shadow-2xl md:hidden">
          <button onClick={() => openChat(banner)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <AvatarImg url={banner.avatar} name={banner.name} className="h-10 w-10 shrink-0 text-sm" />
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-bold text-ink">{banner.name}</span>
              <span className="block truncate text-[12.5px] text-muted">{banner.body}</span>
            </span>
          </button>
          <button onClick={() => setBanner(null)} aria-label="Fermer" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-card">✕</button>
        </div>
      )}

      {/* Bouton rond (téléphone), au-dessus de la barre de navigation, à droite */}
      {!open && !banner && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Messages"
          className={`fixed right-4 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-violet text-cream shadow-[0_6px_18px_color-mix(in_srgb,var(--color-violet)_45%,transparent)] transition-[transform,opacity] duration-[140ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-[1.07] active:scale-[0.93] md:hidden ${
            fabHidden ? "pointer-events-none translate-y-4 opacity-0" : "opacity-100"}`}
          style={{ bottom: "calc(max(env(safe-area-inset-bottom), 8px) + 84px)" }}
        >
          <ChatIcon className="h-[22px] w-[22px]" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-paper">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}

      {/* Pastille fermée (ordinateur) */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[70] hidden items-center gap-3 rounded-full border border-line bg-paper py-2.5 pl-4 pr-3 shadow-xl transition-transform duration-[140ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-[1.07] active:scale-[0.93] md:flex"
        >
          <span className="relative text-ink">
            <ChatIcon className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -bottom-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>
            )}
          </span>
          <span className="text-[14px] font-bold text-ink">Messages</span>
          {convos.length > 0 && (
            <span className="ml-3 flex -space-x-2">
              {convos.slice(0, 3).map((c) => (
                <AvatarImg key={c.otherId} url={c.avatar} name={c.name} className="h-7 w-7 text-[11px] ring-2 ring-paper" />
              ))}
            </span>
          )}
        </button>
      )}

      {/* Panneau ouvert : hauteur fixe pour une conversation, ajustée au contenu pour la liste */}
      {open && (
        <>
          <div className="fixed inset-0 z-[74] bg-ink/30 md:hidden" onClick={close} />
          <div className={`animate-slideUp fixed inset-x-0 bottom-0 z-[75] flex flex-col overflow-hidden rounded-t-3xl border border-line bg-paper shadow-2xl md:inset-auto md:bottom-6 md:right-6 md:w-[370px] md:rounded-2xl ${
            peer ? "h-[85dvh] md:h-[540px]" : "max-h-[80dvh] md:max-h-[540px]"}`}
            style={{ paddingBottom: peer ? undefined : "env(safe-area-inset-bottom)" }}>
            <div className="flex shrink-0 items-center gap-1 border-b border-line px-3 py-2.5">
              {peer || composing ? (
                <button onClick={() => { setPeer(null); setComposing(false); }} aria-label="Retour" className={`${iconBtn} text-xl leading-none`}>‹</button>
              ) : null}
              {peer ? (
                <Link href={`/membre/${peer.otherId}`} onClick={close} className="flex min-w-0 flex-1 items-center gap-2 pl-1">
                  <AvatarImg url={peer.avatar} name={peer.name} className="h-8 w-8 shrink-0 text-sm" />
                  <span className="truncate text-[15px] font-bold text-ink">{peer.name}</span>
                </Link>
              ) : composing ? (
                <p className="flex-1 pl-1 text-[16px] font-bold text-ink">Nouveau message</p>
              ) : (
                <p className="flex flex-1 items-center gap-2 pl-1.5 text-[16px] font-bold text-ink">
                  Messages
                  {unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">{unread}</span>}
                </p>
              )}
              {!peer && !composing && (
                <button onClick={() => setComposing(true)} aria-label="Nouvelle conversation" title="Nouvelle conversation" className={iconBtn}>
                  <ComposeIcon />
                </button>
              )}
              {!composing && (
                <Link href={peer ? `/messages/${peer.otherId}` : "/messages"} onClick={close} aria-label="Agrandir" title="Agrandir" className={iconBtn}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg>
                </Link>
              )}
              <button onClick={close} aria-label="Fermer" title="Fermer" className={iconBtn}>✕</button>
            </div>

            {peer ? (
              <ChatThread key={peer.otherId} otherId={peer.otherId} otherName={peer.name} compact />
            ) : composing ? (
              <NewConversation friends={friends} onSelect={startWith} />
            ) : convos.length ? (
              <div className="min-h-0 overflow-y-auto py-1">
                <ConversationList convos={convos} me={me} compact onSelect={(c) => setPeer({ otherId: c.otherId, name: c.name, avatar: c.avatar })} />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 px-8 py-8 text-center">
                <ChatIcon className="h-9 w-9 text-muted" />
                <p className="text-[13.5px] text-muted">Aucune conversation pour l&apos;instant.</p>
                <button onClick={() => setComposing(true)} className="rounded-xl bg-violet px-4 py-2 text-[13px] font-semibold text-cream">Écrire à un ami</button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
