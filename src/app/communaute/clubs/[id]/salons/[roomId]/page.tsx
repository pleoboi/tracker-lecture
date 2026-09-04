"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../../lib/supabase";
import { useAuth } from "../../../../../../lib/auth-context";
import type { BookClub, BookClubRoom, BookClubMessage } from "../../../../../../lib/bookclubs";
import { clubThemeVar } from "../../../../../../lib/bookclubs";
import { AvatarImg } from "../../../../../../components/ui";
import { RoomIcon } from "../../../../../../components/RoomIcon";

interface ProfileLite {
  display_name: string;
  avatar_url: string | null;
}

function formatMsgTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  return isToday
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function ClubRoomPage() {
  const params = useParams();
  const { user } = useAuth();
  const clubId = params.id as string;
  const roomId = params.roomId as string;

  const [club, setClub] = useState<BookClub | null>(null);
  const [room, setRoom] = useState<BookClubRoom | null>(null);
  const [messages, setMessages] = useState<BookClubMessage[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(new Map());
  const [isMember, setIsMember] = useState<boolean | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = (smooth = false) => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" }));
  };

  const markRead = useCallback(() => {
    if (!user?.id) return;
    supabase.from("book_club_room_reads").upsert(
      { room_id: roomId, user_id: user.id, last_read_at: new Date().toISOString() },
      { onConflict: "room_id,user_id" }
    );
  }, [roomId, user]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    const [{ data: clubData }, { data: roomData }, { data: memberRow }] = await Promise.all([
      supabase.from("book_clubs").select("*").eq("id", clubId).maybeSingle(),
      supabase.from("book_club_rooms").select("*").eq("id", roomId).maybeSingle(),
      supabase.from("book_club_members").select("user_id").eq("club_id", clubId).eq("user_id", user.id).maybeSingle(),
    ]);
    setClub((clubData as BookClub) ?? null);
    setRoom((roomData as BookClubRoom) ?? null);
    setIsMember(!!memberRow);

    if (memberRow) {
      const [{ data: msgs }, { data: memberRows }] = await Promise.all([
        supabase.from("book_club_messages").select("*").eq("room_id", roomId).order("created_at", { ascending: true }).limit(200),
        supabase.from("book_club_members").select("user_id").eq("club_id", clubId),
      ]);
      setMessages((msgs ?? []) as BookClubMessage[]);
      const ids = ((memberRows ?? []) as { user_id: string }[]).map((r) => r.user_id);
      if (ids.length) {
        const { data: profs } = await supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", ids);
        setProfiles(
          new Map(((profs ?? []) as { id: string; display_name: string; avatar_url: string | null }[]).map((p) => [p.id, p]))
        );
      }
      scrollToBottom(false);
      markRead();
    }

    setLoading(false);
  }, [clubId, roomId, user, markRead]);

  useEffect(() => { load(); }, [load]);

  // Réception temps réel des nouveaux messages du salon — le salon étant
  // ouvert, on marque aussi la lecture au fil de l'eau.
  useEffect(() => {
    if (!isMember) return;
    const channel = supabase
      .channel(`book-club-room-${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "book_club_messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const msg = payload.new as BookClubMessage;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          scrollToBottom(true);
          markRead();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, isMember, markRead]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || !user?.id || sending) return;
    setSending(true);
    setDraft("");
    const { error } = await supabase
      .from("book_club_messages")
      .insert({ room_id: roomId, club_id: clubId, user_id: user.id, content });
    setSending(false);
    if (error) setDraft(content); // remet le brouillon si l'envoi a échoué
    else markRead();
  };

  if (loading) {
    return <div className="animate-fadeIn py-16 text-center text-xs text-muted">Chargement…</div>;
  }
  if (!club || !room) {
    return (
      <div className="animate-fadeIn flex flex-col items-center gap-3 py-16 text-center">
        <p className="font-serif text-lg text-ink">Salon introuvable.</p>
        <Link href={`/communaute/clubs/${clubId}`} className="text-sm font-semibold text-violet-deep">‹ Retour au club</Link>
      </div>
    );
  }
  if (!isMember) {
    return (
      <div className="animate-fadeIn flex flex-col items-center gap-3 py-16 text-center">
        <p className="font-serif text-lg text-ink">Réservé aux membres du club.</p>
        <Link href={`/communaute/clubs/${clubId}`} className="text-sm font-semibold text-violet-deep">‹ Retour au club</Link>
      </div>
    );
  }

  const theme = clubThemeVar(club.theme_color);

  return (
    <div className="animate-fadeIn flex flex-col gap-4 pb-32 pt-4">
      <header className="flex items-center gap-3">
        <Link href={`/communaute/clubs/${clubId}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink transition-transform active:scale-90">
          ‹
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `color-mix(in srgb, ${theme} 18%, transparent)`, color: theme }}
          >
            <RoomIcon icon={room.icon} className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold text-ink">{room.name}</p>
            <p className="truncate text-[10.5px] text-muted">{club.name}</p>
          </div>
        </div>
        <div className="w-10 shrink-0" />
      </header>

      {/* Messages */}
      <div className="flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-card p-6 text-center">
            <p className="text-[12.5px] text-muted">Aucun message pour l&apos;instant — lance la discussion !</p>
          </div>
        ) : (
          messages.map((m) => {
            const prof = profiles.get(m.user_id);
            const isMe = m.user_id === user?.id;
            return (
              <div key={m.id} className={`flex items-start gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
                <AvatarImg url={prof?.avatar_url ?? null} name={prof?.display_name ?? "?"} className="h-7 w-7 shrink-0 text-[9px]" />
                <div className={`flex max-w-[75%] flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                  <div className="flex items-center gap-1.5">
                    {!isMe && <span className="text-[11px] font-semibold text-ink">{prof?.display_name ?? "Membre"}</span>}
                    <span className="text-[10px] text-muted">{formatMsgTime(m.created_at)}</span>
                  </div>
                  <p
                    className="whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed"
                    style={
                      isMe
                        ? { backgroundColor: theme, color: "var(--color-cream)" }
                        : { backgroundColor: "var(--color-card)", border: "1px solid var(--color-line)", color: "var(--color-ink)" }
                    }
                  >
                    {m.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composeur — flotte au-dessus de la barre de navigation */}
      <div
        className="fixed inset-x-0 z-40 flex justify-center px-4"
        style={{ bottom: "calc(max(env(safe-area-inset-bottom), 1rem) + 4.75rem)" }}
      >
        <div className="flex w-full max-w-2xl items-center gap-2 rounded-2xl border border-line bg-paper p-1.5 shadow-lg md:max-w-3xl">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Écris un message…"
            className="min-w-0 flex-1 rounded-xl bg-transparent px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            style={{ backgroundColor: theme }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-cream transition-transform active:scale-90 disabled:opacity-40"
            aria-label="Envoyer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16M14 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
