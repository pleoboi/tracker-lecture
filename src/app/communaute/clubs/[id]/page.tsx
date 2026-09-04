"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/auth-context";
import { notifyUser } from "../../../../lib/push.client";
import type { BookClub, BookClubMember, BookClubInvite, BookClubRoom, BookClubBook, BookClubMilestone } from "../../../../lib/bookclubs";
import { clubThemeVar } from "../../../../lib/bookclubs";
import { RoomIcon, ROOM_ICON_KEYS } from "../../../../components/RoomIcon";
import { AvatarImg } from "../../../../components/ui";
import { searchBooks, type BookSuggestion } from "../../../../lib/googleBooks";

interface MemberRow {
  user_id: string;
  role: BookClubMember["role"];
  display_name: string;
  avatar_url: string | null;
}

interface FollowedCandidate {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export default function ClubDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const clubId = params.id as string;

  const [club, setClub] = useState<BookClub | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [myRole, setMyRole] = useState<BookClubMember["role"] | null>(null);
  const [myInvite, setMyInvite] = useState<BookClubInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [candidates, setCandidates] = useState<FollowedCandidate[]>([]);
  const [inviting, setInviting] = useState<string | null>(null);

  const [rooms, setRooms] = useState<BookClubRoom[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomIcon, setNewRoomIcon] = useState(ROOM_ICON_KEYS[0]);
  const [creatingRoom, setCreatingRoom] = useState(false);

  const [currentBook, setCurrentBook] = useState<BookClubBook | null>(null);
  const [pastBooks, setPastBooks] = useState<BookClubBook[]>([]);
  const [milestones, setMilestones] = useState<BookClubMilestone[]>([]);
  const [showAddBook, setShowAddBook] = useState(false);
  const [bookQuery, setBookQuery] = useState("");
  const [bookResults, setBookResults] = useState<BookSuggestion[]>([]);
  const [bookSearching, setBookSearching] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BookSuggestion | null>(null);
  const [chapterCount, setChapterCount] = useState("");
  const [savingBook, setSavingBook] = useState(false);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [milestoneChapter, setMilestoneChapter] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [showChaptersForm, setShowChaptersForm] = useState(false);
  const [chaptersLater, setChaptersLater] = useState("");
  const [savingChapters, setSavingChapters] = useState(false);
  const [bookInfo, setBookInfo] = useState<BookClubBook | null>(null);
  const [bookInfoSummary, setBookInfoSummary] = useState<string | null>(null);
  const [bookInfoSummaryLoading, setBookInfoSummaryLoading] = useState(false);
  const [showHistoryList, setShowHistoryList] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: clubData, error: clubErr } = await supabase
      .from("book_clubs")
      .select("*")
      .eq("id", clubId)
      .maybeSingle();

    if (clubErr || !clubData) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setClub(clubData as BookClub);

    const { data: memberRows } = await supabase
      .from("book_club_members")
      .select("user_id, role")
      .eq("club_id", clubId);
    const rows = (memberRows ?? []) as { user_id: string; role: BookClubMember["role"] }[];

    const mine = user?.id ? rows.find((r) => r.user_id === user.id) : undefined;
    setMyRole(mine?.role ?? null);

    if (rows.length) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, display_name, avatar_url")
        .in("id", rows.map((r) => r.user_id));
      const profileMap = new Map(
        ((profiles ?? []) as { id: string; display_name: string; avatar_url: string | null }[]).map((p) => [p.id, p])
      );
      setMembers(
        rows
          .map((r) => ({
            user_id: r.user_id,
            role: r.role,
            display_name: profileMap.get(r.user_id)?.display_name ?? "Membre",
            avatar_url: profileMap.get(r.user_id)?.avatar_url ?? null,
          }))
          .sort((a, b) => (a.role === b.role ? a.display_name.localeCompare(b.display_name) : a.role === "moderator" ? -1 : 1))
      );
    } else {
      setMembers([]);
    }

    if (!mine && user?.id) {
      const { data: invite } = await supabase
        .from("book_club_invites")
        .select("*")
        .eq("club_id", clubId)
        .eq("invited_user_id", user.id)
        .eq("status", "pending")
        .maybeSingle();
      setMyInvite((invite as BookClubInvite | null) ?? null);
    } else {
      setMyInvite(null);
    }

    if (mine && user?.id) {
      const { data: roomRows } = await supabase
        .from("book_club_rooms")
        .select("*")
        .eq("club_id", clubId)
        .order("position", { ascending: true });
      const roomList = (roomRows ?? []) as BookClubRoom[];
      setRooms(roomList);

      if (roomList.length) {
        const { data: readRows } = await supabase
          .from("book_club_room_reads")
          .select("room_id, last_read_at")
          .eq("user_id", user.id)
          .in("room_id", roomList.map((r) => r.id));
        const readMap = new Map(((readRows ?? []) as { room_id: string; last_read_at: string }[]).map((r) => [r.room_id, r.last_read_at]));
        const counts = await Promise.all(
          roomList.map(async (r) => {
            const since = readMap.get(r.id) ?? "1970-01-01T00:00:00Z";
            const { count } = await supabase
              .from("book_club_messages")
              .select("id", { count: "exact", head: true })
              .eq("room_id", r.id)
              .gt("created_at", since);
            return [r.id, count ?? 0] as const;
          })
        );
        setUnreadCounts(new Map(counts));
      } else {
        setUnreadCounts(new Map());
      }
    } else {
      setRooms([]);
      setUnreadCounts(new Map());
    }

    if (mine) {
      const { data: bookRows } = await supabase
        .from("book_club_books")
        .select("*")
        .eq("club_id", clubId)
        .order("started_at", { ascending: false });
      const books = (bookRows ?? []) as BookClubBook[];
      const current = books.find((b) => b.is_current) ?? null;
      setCurrentBook(current);
      setPastBooks(books.filter((b) => !b.is_current));

      if (current) {
        const { data: msRows } = await supabase
          .from("book_club_milestones")
          .select("*")
          .eq("club_book_id", current.id)
          .order("chapter_number", { ascending: true });
        setMilestones((msRows ?? []) as BookClubMilestone[]);
      } else {
        setMilestones([]);
      }
    } else {
      setCurrentBook(null);
      setPastBooks([]);
      setMilestones([]);
    }

    setLoading(false);
  }, [clubId, user]);

  useEffect(() => { load(); }, [load]);

  // Recherche de livre (debounced) dans la modale "Ajouter un livre".
  useEffect(() => {
    if (!showAddBook || selectedBook) return;
    const q = bookQuery.trim();
    if (q.length < 3) { setBookResults([]); return; }
    setBookSearching(true);
    const handle = setTimeout(() => {
      searchBooks(q)
        .then((results) => setBookResults(results))
        .catch(() => setBookResults([]))
        .finally(() => setBookSearching(false));
    }, 350);
    return () => clearTimeout(handle);
  }, [bookQuery, showAddBook, selectedBook]);

  // La recherche Open Library ne renvoie jamais de résumé — on va le chercher
  // sur la fiche œuvre au moment d'afficher la fiche de repli (livre absent du site).
  useEffect(() => {
    if (!bookInfo) { setBookInfoSummary(null); return; }
    if (bookInfo.summary) { setBookInfoSummary(bookInfo.summary); return; }
    if (!bookInfo.openlibrary_work_id) { setBookInfoSummary(null); return; }
    setBookInfoSummary(null);
    setBookInfoSummaryLoading(true);
    fetch(`/api/openlibrary/description?workId=${bookInfo.openlibrary_work_id}`)
      .then((r) => r.json())
      .then((d) => setBookInfoSummary(d.description ?? null))
      .catch(() => setBookInfoSummary(null))
      .finally(() => setBookInfoSummaryLoading(false));
  }, [bookInfo]);

  const isMember = !!myRole;
  const isModerator = myRole === "moderator";
  const moderatorLead = members.find((m) => m.user_id === club?.created_by) ?? members.find((m) => m.role === "moderator");

  const handleJoin = async () => {
    if (!user?.id) return;
    await supabase.from("book_club_members").insert({ club_id: clubId, user_id: user.id, role: "member" });
    load();
  };
  const handleAcceptInvite = async () => {
    if (!user?.id || !myInvite) return;
    await supabase.from("book_club_members").insert({ club_id: clubId, user_id: user.id, role: "member" });
    await supabase.from("book_club_invites").delete().eq("id", myInvite.id);
    load();
  };
  const handleDeclineInvite = async () => {
    if (!myInvite) return;
    await supabase.from("book_club_invites").delete().eq("id", myInvite.id);
    router.push("/communaute");
  };
  const handleLeave = async () => {
    if (!user?.id) return;
    await supabase.from("book_club_members").delete().eq("club_id", clubId).eq("user_id", user.id);
    router.push("/communaute");
  };
  const handleSetRole = async (userId: string, role: BookClubMember["role"]) => {
    await supabase.from("book_club_members").update({ role }).eq("club_id", clubId).eq("user_id", userId);
    load();
  };
  const handleKick = async (userId: string) => {
    await supabase.from("book_club_members").delete().eq("club_id", clubId).eq("user_id", userId);
    load();
  };
  const handleCreateRoom = async () => {
    if (!user?.id || !newRoomName.trim()) return;
    setCreatingRoom(true);
    await supabase.from("book_club_rooms").insert({
      club_id: clubId,
      name: newRoomName.trim(),
      icon: newRoomIcon,
      position: rooms.length,
      created_by: user.id,
    });
    setCreatingRoom(false);
    setShowNewRoom(false);
    setNewRoomName("");
    setNewRoomIcon(ROOM_ICON_KEYS[0]);
    load();
  };
  const handleDeleteRoom = async (room: BookClubRoom) => {
    if (rooms.length <= 1) { alert("Un club doit garder au moins un salon."); return; }
    if (!confirm(`Supprimer le salon « ${room.name} » et tous ses messages ?`)) return;
    await supabase.from("book_club_rooms").delete().eq("id", room.id);
    load();
  };

  const openAddBook = () => {
    setBookQuery("");
    setBookResults([]);
    setSelectedBook(null);
    setChapterCount("");
    setShowAddBook(true);
  };

  // Notifie tous les membres du club (sauf l'auteur de l'action) — nouveau
  // livre du moment, livre terminé, etc. Même canal que les invitations
  // (préférence "clubs"), avec un enregistrement en base pour l'historique.
  const notifyClubMembers = (bookTitle: string, body: string) => {
    if (!user?.id || !club) return;
    const targets = members.filter((m) => m.user_id !== user.id).map((m) => m.user_id);
    if (!targets.length) return;
    supabase.from("notifications").insert(
      targets.map((uid) => ({ user_id: uid, type: "club_book_update", from_user_id: user.id, club_id: clubId, book_title: bookTitle }))
    );
    targets.forEach((uid) => notifyUser(uid, "Swena", body, `/communaute/clubs/${clubId}`, "clubs"));
  };

  const handleConfirmAddBook = async () => {
    if (!user?.id || !selectedBook) return;
    const chapters = Number(chapterCount) || null;
    // Résultats Open Library : googleId porte le work id ("OL...W"), qui
    // regroupe toutes les éditions/traductions — sert à retrouver la fiche
    // existante du livre sur le site (même principe que le dédoublonnage v23).
    const workId = /^OL\d+W$/i.test(selectedBook.googleId) ? selectedBook.googleId : null;
    setSavingBook(true);
    const { data: bookRow, error: bookErr } = await supabase
      .from("book_club_books")
      .insert({
        club_id: clubId,
        title: selectedBook.title,
        author: selectedBook.author,
        cover_url: selectedBook.coverUrl,
        isbn: selectedBook.isbn,
        openlibrary_work_id: workId,
        genre: selectedBook.genre,
        published_year: selectedBook.year,
        summary: selectedBook.summary,
        total_chapters: chapters,
        added_by: user.id,
      })
      .select("id")
      .single();

    if (!bookErr && bookRow && chapters && chapters > 0) {
      const { id: bookId } = bookRow as { id: string };
      const chapterRooms = Array.from({ length: chapters }, (_, i) => ({
        club_id: clubId,
        type: "chapter" as const,
        chapter_number: i + 1,
        name: `Chapitre ${i + 1}`,
        icon: "book",
        position: rooms.length + i,
        created_by: user.id,
      }));
      await supabase.from("book_club_rooms").insert(chapterRooms);
      void bookId; // le lien room ↔ livre se fait via chapter_number, pas besoin de le stocker ici
    }

    if (!bookErr) {
      const senderName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";
      notifyClubMembers(selectedBook.title, `${senderName} a ajouté « ${selectedBook.title} » comme livre du club «${club?.name}»`);
    }

    setSavingBook(false);
    setShowAddBook(false);
    load();
  };

  const handleFinishBook = async () => {
    if (!currentBook) return;
    if (!confirm(`Marquer « ${currentBook.title} » comme terminé pour le club ?`)) return;
    await supabase.from("book_club_books").update({ is_current: false, finished_at: new Date().toISOString() }).eq("id", currentBook.id);
    notifyClubMembers(currentBook.title, `Le club «${club?.name}» a terminé « ${currentBook.title} » !`);
    load();
  };

  const handleSetChaptersLater = async () => {
    if (!currentBook || !user?.id) return;
    const chapters = Number(chaptersLater);
    if (!chapters || chapters <= 0) return;
    setSavingChapters(true);
    await supabase.from("book_club_books").update({ total_chapters: chapters }).eq("id", currentBook.id);
    const chapterRooms = Array.from({ length: chapters }, (_, i) => ({
      club_id: clubId,
      type: "chapter" as const,
      chapter_number: i + 1,
      name: `Chapitre ${i + 1}`,
      icon: "book",
      position: rooms.length + i,
      created_by: user.id,
    }));
    await supabase.from("book_club_rooms").insert(chapterRooms);
    setSavingChapters(false);
    setShowChaptersForm(false);
    setChaptersLater("");
    load();
  };

  const handleAddMilestone = async () => {
    if (!currentBook || !milestoneChapter || !milestoneDate) return;
    await supabase.from("book_club_milestones").insert({
      club_id: clubId,
      club_book_id: currentBook.id,
      chapter_number: Number(milestoneChapter),
      target_date: milestoneDate,
    });
    setMilestoneChapter("");
    setMilestoneDate("");
    setShowMilestoneForm(false);
    load();
  };

  const handleDeleteMilestone = async (id: string) => {
    await supabase.from("book_club_milestones").delete().eq("id", id);
    load();
  };

  // Si le livre existe déjà sur Swena (par work id Open Library, puis ISBN en
  // repli), on va directement sur sa fiche plutôt que d'en montrer une copie.
  const handleViewBook = async (book: BookClubBook) => {
    if (book.openlibrary_work_id) {
      const { data } = await supabase
        .from("books")
        .select("id")
        .eq("openlibrary_work_id", book.openlibrary_work_id)
        .limit(1)
        .maybeSingle();
      if (data) { router.push(`/livre/${(data as { id: number }).id}`); return; }
    }
    if (book.isbn) {
      const { data } = await supabase
        .from("books")
        .select("id")
        .eq("isbn13", book.isbn)
        .limit(1)
        .maybeSingle();
      if (data) { router.push(`/livre/${(data as { id: number }).id}`); return; }
    }

    // Repli : une édition différente (traduction, réédition...) porte un ISBN
    // différent — on cherche des candidats par titre puis on compare leur
    // "work id" Open Library (même mécanisme que le dédoublonnage Goodreads).
    const { data: candidateRows } = await supabase
      .from("books")
      .select("id, isbn13, openlibrary_work_id")
      .ilike("title", `%${book.title.trim()}%`)
      .limit(10);
    const candidates = (candidateRows ?? []) as { id: number; isbn13: string | null; openlibrary_work_id: string | null }[];

    const already = candidates.find((c) => c.openlibrary_work_id && c.openlibrary_work_id === book.openlibrary_work_id);
    if (already) { router.push(`/livre/${already.id}`); return; }

    if (book.isbn && candidates.length) {
      const isbnsToResolve = [
        book.isbn,
        ...candidates.filter((c) => !c.openlibrary_work_id && c.isbn13).map((c) => c.isbn13!),
      ];
      try {
        const res = await fetch("/api/openlibrary/work-id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isbns: isbnsToResolve }),
        });
        const { workIds } = (await res.json()) as { workIds: Record<string, string | null> };
        const myWorkId = workIds[book.isbn];
        if (myWorkId) {
          const match = candidates.find(
            (c) => c.openlibrary_work_id === myWorkId || (c.isbn13 && workIds[c.isbn13] === myWorkId)
          );
          if (match) {
            supabase.from("book_club_books").update({ openlibrary_work_id: myWorkId }).eq("id", book.id); // met en cache pour la prochaine fois
            router.push(`/livre/${match.id}`);
            return;
          }
        }
      } catch {
        // Open Library indisponible : on retombe sur la fiche de repli.
      }
    }

    setBookInfo(book);
  };

  const openInvite = async () => {
    if (!user?.id) return;
    setShowInvite(true);
    const { data: follows } = await supabase.from("user_follows").select("following_id").eq("follower_id", user.id);
    const followIds = ((follows ?? []) as { following_id: string }[]).map((f) => f.following_id);
    const memberIds = new Set(members.map((m) => m.user_id));
    const eligible = followIds.filter((id) => !memberIds.has(id));
    if (!eligible.length) { setCandidates([]); return; }
    const { data: existingInvites } = await supabase
      .from("book_club_invites")
      .select("invited_user_id")
      .eq("club_id", clubId)
      .in("invited_user_id", eligible);
    const invitedSet = new Set(((existingInvites ?? []) as { invited_user_id: string }[]).map((i) => i.invited_user_id));
    const remaining = eligible.filter((id) => !invitedSet.has(id));
    if (!remaining.length) { setCandidates([]); return; }
    const { data: profiles } = await supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", remaining);
    setCandidates((profiles ?? []) as FollowedCandidate[]);
  };

  const handleInvite = async (candidate: FollowedCandidate) => {
    if (!user?.id || !club) return;
    setInviting(candidate.id);
    await supabase.from("book_club_invites").insert({ club_id: clubId, invited_user_id: candidate.id, invited_by: user.id });
    await supabase.from("notifications").insert({ user_id: candidate.id, type: "club_invite", from_user_id: user.id, club_id: clubId });
    const senderName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";
    notifyUser(candidate.id, "Swena", `${senderName} t'invite à rejoindre le club «${club.name}»`, `/communaute/clubs/${clubId}`, "clubs");
    setCandidates((cs) => cs.filter((c) => c.id !== candidate.id));
    setInviting(null);
  };

  if (loading) {
    return <div className="animate-fadeIn py-16 text-center text-xs text-muted">Chargement…</div>;
  }
  if (notFound || !club) {
    return (
      <div className="animate-fadeIn flex flex-col items-center gap-3 py-16 text-center">
        <p className="font-serif text-lg text-ink">Club introuvable.</p>
        <Link href="/communaute" className="text-sm font-semibold text-violet-deep">‹ Retour à la Communauté</Link>
      </div>
    );
  }

  const theme = clubThemeVar(club.theme_color);

  return (
    <div className="animate-fadeIn flex flex-col gap-5 pb-10 pt-4">
      <header className="flex items-center gap-3">
        <Link href="/communaute" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink transition-transform active:scale-90">
          ‹
        </Link>
        <p className="min-w-0 flex-1 truncate text-center font-serif text-base font-bold text-ink">{club.name}</p>
        <div className="flex shrink-0 items-center gap-2">
          {isMember && (
            <button
              onClick={openInvite}
              aria-label="Inviter des amis"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card text-ink transition-transform active:scale-90"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m3 11 18-8-8 18-2-8-8-2z" />
              </svg>
            </button>
          )}
          {isModerator ? (
            <Link
              href={`/communaute/clubs/${clubId}/modifier`}
              aria-label="Modifier le club"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink transition-transform active:scale-90"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.13.31.35.58.62.78" />
              </svg>
            </Link>
          ) : (
            !isMember && <div className="w-10 shrink-0" />
          )}
        </div>
      </header>

      {/* Cover — façon masthead Fable, sans occuper toute la largeur */}
      <div
        className="relative mx-auto flex h-44 w-44 items-center justify-center overflow-hidden rounded-3xl shadow-sm"
        style={{ backgroundColor: theme }}
      >
        {club.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={club.cover_url} alt={club.name} className="h-full w-full object-cover" />
        ) : (
          <span className="font-serif text-5xl font-black text-cream/95">{club.name[0]?.toUpperCase()}</span>
        )}
      </div>

      {/* Identité */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div>
          <h1 className="font-serif text-2xl font-black text-ink">{club.name}</h1>
          {club.description && <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{club.description}</p>}
        </div>
        {moderatorLead && (
          <div className="flex items-center gap-2">
            <AvatarImg url={moderatorLead.avatar_url} name={moderatorLead.display_name} className="h-6 w-6 text-[9px]" />
            <span className="text-[12px] text-muted">
              Modéré par <span className="font-semibold text-ink">{moderatorLead.display_name}</span>
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span className="rounded-full border border-line bg-card px-2.5 py-1 text-[10.5px] font-semibold text-ink">
            {club.member_count} membre{club.member_count > 1 ? "s" : ""}
          </span>
          <span className="rounded-full border border-line bg-card px-2.5 py-1 text-[10.5px] font-semibold text-muted">
            {club.is_public ? "Public" : "Privé"}
          </span>
          {club.genres.slice(0, 3).map((g) => (
            <span key={g} className="rounded-full border border-line bg-card px-2.5 py-1 text-[10.5px] font-medium text-muted">{g}</span>
          ))}
        </div>
      </div>

      {/* Actions selon statut — accentuées avec le thème du club */}
      {myInvite && (
        <div
          className="flex items-center gap-2 rounded-2xl border p-3"
          style={{ backgroundColor: `color-mix(in srgb, ${theme} 15%, transparent)`, borderColor: `color-mix(in srgb, ${theme} 45%, transparent)` }}
        >
          <p className="flex-1 text-[12.5px] font-medium text-ink">Tu es invité à rejoindre ce club</p>
          <button onClick={handleAcceptInvite} style={{ backgroundColor: theme }} className="rounded-xl px-3.5 py-2 text-[12px] font-bold text-cream transition-transform active:scale-95">Accepter</button>
          <button onClick={handleDeclineInvite} className="rounded-xl border border-line bg-card px-3.5 py-2 text-[12px] font-medium text-muted transition-transform active:scale-95">Décliner</button>
        </div>
      )}
      {!isMember && !myInvite && club.is_public && (
        <button onClick={handleJoin} style={{ backgroundColor: theme }} className="w-full rounded-2xl py-3.5 text-[14px] font-bold text-cream transition-transform active:scale-[0.98]">
          Rejoindre le club
        </button>
      )}
      {!isMember && !myInvite && !club.is_public && (
        <div className="rounded-2xl border border-dashed border-line bg-card p-4 text-center text-[12.5px] text-muted">
          Club privé — une invitation d&apos;un membre est nécessaire pour le rejoindre.
        </div>
      )}

      {/* Livre du moment + Historique — tuiles image plein cadre, façon Fable */}
      {isMember && (
        <section className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => (currentBook ? handleViewBook(currentBook) : isModerator && openAddBook())}
              className="relative flex h-36 flex-col justify-end overflow-hidden rounded-2xl text-left transition-transform active:scale-[0.98]"
              style={{ backgroundColor: `color-mix(in srgb, ${theme} 14%, transparent)` }}
            >
              {currentBook ? (
                <>
                  {currentBook.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentBook.cover_url} alt={currentBook.title} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: theme }}>
                      <span className="font-serif text-4xl font-black text-cream/90">{currentBook.title[0]?.toUpperCase()}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  <div className="relative p-3">
                    <p className="text-[9.5px] font-semibold uppercase tracking-wide text-cream/80">Livre du moment</p>
                    <p className="truncate font-serif text-[15px] font-bold text-cream">{currentBook.title}</p>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1.5 p-3 text-center">
                  <span className="text-[11.5px] text-muted">Aucun livre en cours</span>
                  {isModerator && <span style={{ color: theme }} className="text-[11.5px] font-bold">+ Ajouter un livre</span>}
                </div>
              )}
            </button>

            <button
              onClick={() => pastBooks.length > 0 && setShowHistoryList((v) => !v)}
              className="relative flex h-36 flex-col justify-end overflow-hidden rounded-2xl text-left transition-transform active:scale-[0.98]"
              style={{ backgroundColor: `color-mix(in srgb, ${theme} 8%, transparent)` }}
            >
              {pastBooks.length > 0 ? (
                <>
                  {pastBooks[0].cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pastBooks[0].cover_url} alt={pastBooks[0].title} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: `color-mix(in srgb, ${theme} 55%, var(--color-ink))` }}>
                      <span className="font-serif text-4xl font-black text-cream/90">{pastBooks[0].title[0]?.toUpperCase()}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  <div className="relative p-3">
                    <p className="text-[9.5px] font-semibold uppercase tracking-wide text-cream/80">Historique</p>
                    <p className="font-serif text-[15px] font-bold text-cream">{pastBooks.length} livre{pastBooks.length > 1 ? "s" : ""}</p>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center p-3 text-center">
                  <span className="text-[11.5px] text-muted">Pas encore d&apos;historique</span>
                </div>
              )}
            </button>
          </div>

          {showHistoryList && pastBooks.length > 0 && (
            <div className="flex flex-col gap-1 rounded-2xl border border-line bg-card p-2">
              {pastBooks.map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleViewBook(b)}
                  className="flex items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-paper"
                >
                  <div
                    className="flex h-10 w-8 shrink-0 items-center justify-center overflow-hidden rounded"
                    style={{ backgroundColor: `color-mix(in srgb, ${theme} 20%, transparent)` }}
                  >
                    {b.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.cover_url} alt={b.title} className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-serif text-[11px] font-black" style={{ color: theme }}>{b.title[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink">{b.title}</p>
                    {b.author && <p className="truncate text-[11px] text-muted">{b.author}</p>}
                  </div>
                  {b.finished_at && (
                    <span className="shrink-0 text-[10.5px] text-muted">
                      {new Date(b.finished_at).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Actions discrètes liées au livre en cours (texte seul, pas de blocs) */}
          {currentBook && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
              {isModerator && (
                <button onClick={handleFinishBook} style={{ color: theme }} className="text-[11.5px] font-semibold">
                  Marquer comme terminé
                </button>
              )}
              {isModerator && !currentBook.total_chapters && (
                <button onClick={() => setShowChaptersForm((v) => !v)} style={{ color: theme }} className="text-[11.5px] font-semibold">
                  + Définir le nombre de chapitres
                </button>
              )}
              {isModerator && (
                <button onClick={() => setShowMilestoneForm((v) => !v)} style={{ color: theme }} className="text-[11.5px] font-semibold">
                  + Ajouter un jalon
                </button>
              )}
            </div>
          )}

          {showChaptersForm && (
            <div className="flex items-end gap-2 rounded-2xl border border-line bg-card p-3">
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Nombre de chapitres</label>
                <input
                  type="number"
                  min={1}
                  value={chaptersLater}
                  onChange={(e) => setChaptersLater(e.target.value)}
                  placeholder="Ex. : 24"
                  className="w-full rounded-lg border border-line bg-input px-2.5 py-2 text-sm text-ink outline-none focus:border-violet"
                />
              </div>
              <button
                onClick={handleSetChaptersLater}
                disabled={savingChapters || !chaptersLater}
                style={{ backgroundColor: theme }}
                className="rounded-lg px-3 py-2 text-[12px] font-bold text-cream transition-transform active:scale-95 disabled:opacity-40"
              >
                {savingChapters ? "…" : "OK"}
              </button>
            </div>
          )}

          {showMilestoneForm && (
            <div className="flex items-end gap-2 rounded-2xl border border-line bg-card p-3">
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Chapitre</label>
                <input
                  type="number"
                  min={1}
                  value={milestoneChapter}
                  onChange={(e) => setMilestoneChapter(e.target.value)}
                  className="w-full rounded-lg border border-line bg-input px-2.5 py-2 text-sm text-ink outline-none focus:border-violet"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Date</label>
                <input
                  type="date"
                  value={milestoneDate}
                  onChange={(e) => setMilestoneDate(e.target.value)}
                  className="w-full rounded-lg border border-line bg-input px-2.5 py-2 text-sm text-ink outline-none focus:border-violet"
                />
              </div>
              <button
                onClick={handleAddMilestone}
                disabled={!milestoneChapter || !milestoneDate}
                style={{ backgroundColor: theme }}
                className="rounded-lg px-3 py-2 text-[12px] font-bold text-cream transition-transform active:scale-95 disabled:opacity-40"
              >
                OK
              </button>
            </div>
          )}

          {milestones.length > 0 && (
            <div className="flex flex-col gap-0.5 rounded-2xl border border-line bg-card p-1">
              {milestones.map((ms) => (
                <div key={ms.id} className="flex items-center gap-2 px-2.5 py-2">
                  <span className="flex-1 text-[12px] font-medium text-ink">
                    Chapitre {ms.chapter_number} — {new Date(ms.target_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </span>
                  {isModerator && (
                    <button
                      onClick={() => handleDeleteMilestone(ms.id)}
                      aria-label="Supprimer ce jalon"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-danger transition-transform active:scale-90"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Salons de discussion */}
      {isMember && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Salons de discussion</h2>
            {isModerator && (
              <button
                onClick={() => setShowNewRoom(true)}
                aria-label="Nouveau salon"
                style={{ color: theme }}
                className="flex h-7 w-7 items-center justify-center rounded-full text-lg font-bold transition-transform active:scale-90"
              >
                +
              </button>
            )}
          </div>
          {rooms.length === 0 ? (
            <p className="px-1 text-[12.5px] text-muted">Aucun salon pour l&apos;instant.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-card">
              {rooms.map((r) => (
                <div key={r.id} className="flex items-center gap-2 pl-3.5 pr-2 py-2.5">
                  <Link href={`/communaute/clubs/${clubId}/salons/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-1">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `color-mix(in srgb, ${theme} 18%, transparent)`, color: theme }}
                    >
                      <RoomIcon icon={r.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">{r.name}</span>
                      {r.type === "chapter" && r.chapter_number != null && (
                        <span className="block text-[10.5px] text-muted">
                          Chapitre {r.chapter_number}
                          {(() => {
                            const ms = milestones.find((m) => m.chapter_number === r.chapter_number);
                            return ms ? ` — ${new Date(ms.target_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : "";
                          })()}
                        </span>
                      )}
                    </span>
                  </Link>
                  {!!unreadCounts.get(r.id) && (
                    <span
                      style={{ backgroundColor: theme }}
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold text-cream"
                    >
                      {unreadCounts.get(r.id)! > 99 ? "99+" : unreadCounts.get(r.id)}
                    </span>
                  )}
                  {isModerator ? (
                    <button
                      onClick={() => handleDeleteRoom(r)}
                      aria-label="Supprimer le salon"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-danger transition-transform active:scale-90"
                    >
                      ✕
                    </button>
                  ) : (
                    <span className="shrink-0 px-1 text-muted">›</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Membres */}
      <section className="flex flex-col gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Membres</h2>
        <div className="overflow-hidden rounded-2xl border border-line bg-card">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 px-3.5 py-2.5">
              <AvatarImg url={m.avatar_url} name={m.display_name} className="h-8 w-8 shrink-0 text-xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">
                  {m.display_name}{m.user_id === user?.id && <span className="ml-1 text-[10.5px] font-normal text-muted">(toi)</span>}
                </p>
                {m.role === "moderator" && <p className="text-[10.5px] font-medium" style={{ color: theme }}>Modérateur</p>}
              </div>
              {isModerator && m.user_id !== user?.id && (
                <div className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => handleSetRole(m.user_id, m.role === "moderator" ? "member" : "moderator")}
                    className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-muted transition-transform active:scale-95"
                  >
                    {m.role === "moderator" ? "Rétrograder" : "Promouvoir"}
                  </button>
                  <button
                    onClick={() => handleKick(m.user_id)}
                    className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-danger transition-transform active:scale-95"
                  >
                    Retirer
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {isMember && (
          <button onClick={handleLeave} className="self-center px-2 py-1 text-[12px] font-medium text-danger">
            Quitter le club
          </button>
        )}
      </section>

      {/* Modale d'invitation */}
      {showInvite && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pt-4 pb-24 [touch-action:none] sm:items-center"
          onClick={() => setShowInvite(false)}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-paper shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="font-serif text-base font-semibold text-ink">Inviter des amis</h3>
              <button
                onClick={() => setShowInvite(false)}
                aria-label="Fermer"
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-muted transition-transform active:scale-90"
              >
                ✕
              </button>
            </div>
            <div className="flex max-h-[60dvh] flex-col gap-1.5 overflow-y-auto px-5 py-4">
              {candidates.length === 0 ? (
                <p className="py-6 text-center text-[12.5px] text-muted">
                  Aucun ami à inviter — tous ceux que tu suis sont déjà membres ou déjà invités.
                </p>
              ) : (
                candidates.map((c) => (
                  <div key={c.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-card px-3 py-2">
                    <AvatarImg url={c.avatar_url} name={c.display_name} className="h-7 w-7 shrink-0 text-[10px]" />
                    <span className="flex-1 text-[13px] font-medium text-ink">{c.display_name}</span>
                    <button
                      onClick={() => handleInvite(c)}
                      disabled={inviting === c.id}
                      style={{ backgroundColor: theme }}
                      className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-cream transition-transform active:scale-95 disabled:opacity-40"
                    >
                      {inviting === c.id ? "…" : "Inviter"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modale de création de salon */}
      {showNewRoom && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pt-4 pb-24 [touch-action:none] sm:items-center"
          onClick={() => setShowNewRoom(false)}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-paper shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="font-serif text-base font-semibold text-ink">Nouveau salon</h3>
              <button
                onClick={() => setShowNewRoom(false)}
                aria-label="Fermer"
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-muted transition-transform active:scale-90"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-4 px-5 py-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">Icône</label>
                <div className="flex flex-wrap gap-2">
                  {ROOM_ICON_KEYS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setNewRoomIcon(icon)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform active:scale-90"
                      style={{
                        backgroundColor: newRoomIcon === icon ? `color-mix(in srgb, ${theme} 25%, transparent)` : "var(--color-card)",
                        outline: newRoomIcon === icon ? `2px solid ${theme}` : "1px solid var(--color-line)",
                        color: theme,
                      }}
                    >
                      <RoomIcon icon={icon} className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">Nom du salon</label>
                <input
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Ex. : Recos de lecture"
                  className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet"
                />
              </div>
              <button
                onClick={handleCreateRoom}
                disabled={creatingRoom || !newRoomName.trim()}
                style={{ backgroundColor: theme }}
                className="w-full rounded-2xl py-3 text-[13px] font-bold text-cream transition-transform active:scale-[0.98] disabled:opacity-40"
              >
                {creatingRoom ? "Création…" : "Créer le salon"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale d'ajout du livre du club */}
      {showAddBook && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pt-4 pb-24 [touch-action:none] sm:items-center"
          onClick={() => setShowAddBook(false)}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-paper shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="font-serif text-base font-semibold text-ink">
                {selectedBook ? "Nombre de chapitres" : "Ajouter un livre"}
              </h3>
              <button
                onClick={() => setShowAddBook(false)}
                aria-label="Fermer"
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-muted transition-transform active:scale-90"
              >
                ✕
              </button>
            </div>

            {!selectedBook ? (
              <div className="flex flex-col gap-3 px-5 py-4">
                <input
                  autoFocus
                  value={bookQuery}
                  onChange={(e) => setBookQuery(e.target.value)}
                  placeholder="Titre ou auteur…"
                  className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet"
                />
                <div className="flex max-h-[50dvh] flex-col gap-1.5 overflow-y-auto">
                  {bookSearching ? (
                    <p className="py-6 text-center text-[12.5px] text-muted">Recherche…</p>
                  ) : bookResults.length === 0 ? (
                    <p className="py-6 text-center text-[12.5px] text-muted">
                      {bookQuery.trim().length < 3 ? "Tape au moins 3 caractères." : "Aucun résultat."}
                    </p>
                  ) : (
                    bookResults.map((b) => (
                      <button
                        key={b.googleId}
                        onClick={() => setSelectedBook(b)}
                        className="flex items-center gap-3 rounded-xl border border-line bg-card px-3 py-2 text-left transition-transform active:scale-[0.98]"
                      >
                        <div className="flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-input">
                          {b.coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={b.coverUrl} alt={b.title} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-muted">?</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-ink">{b.title}</p>
                          <p className="truncate text-[11px] text-muted">{b.author}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 px-5 py-4">
                <div className="flex items-center gap-3 rounded-xl border border-line bg-card px-3 py-2">
                  <div className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-input">
                    {selectedBook.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedBook.coverUrl} alt={selectedBook.title} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-muted">?</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink">{selectedBook.title}</p>
                    <p className="truncate text-[11px] text-muted">{selectedBook.author}</p>
                  </div>
                  <button
                    onClick={() => setSelectedBook(null)}
                    className="shrink-0 text-[11px] font-semibold text-muted"
                  >
                    Changer
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Nombre de chapitres (optionnel)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={chapterCount}
                    onChange={(e) => setChapterCount(e.target.value)}
                    placeholder="Ex. : 24"
                    className="w-full rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet"
                  />
                  <p className="text-[11px] text-muted">Génère automatiquement un salon de discussion par chapitre.</p>
                </div>
                <button
                  onClick={handleConfirmAddBook}
                  disabled={savingBook}
                  style={{ backgroundColor: theme }}
                  className="w-full rounded-2xl py-3 text-[13px] font-bold text-cream transition-transform active:scale-[0.98] disabled:opacity-40"
                >
                  {savingBook ? "Ajout…" : "Ajouter au club"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fiche livre */}
      {bookInfo && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pt-4 pb-24 [touch-action:none] sm:items-center"
          onClick={() => setBookInfo(null)}
        >
          <div
            className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-y-auto rounded-2xl bg-paper shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h3 className="font-serif text-base font-semibold text-ink">Fiche du livre</h3>
                <p className="text-[10.5px] text-muted">Pas encore dans la bibliothèque Swena</p>
              </div>
              <button
                onClick={() => setBookInfo(null)}
                aria-label="Fermer"
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-muted transition-transform active:scale-90"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-4 px-5 py-4">
              <div className="flex gap-3">
                <div
                  className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg shadow-sm"
                  style={{ backgroundColor: `color-mix(in srgb, ${theme} 25%, transparent)` }}
                >
                  {bookInfo.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={bookInfo.cover_url} alt={bookInfo.title} className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-serif text-2xl font-black" style={{ color: theme }}>{bookInfo.title[0]?.toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg font-bold leading-tight text-ink">{bookInfo.title}</p>
                  {bookInfo.author && <p className="mt-0.5 text-[13px] text-muted">{bookInfo.author}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {bookInfo.genre && (
                      <span className="rounded-full border border-line bg-card px-2 py-0.5 text-[10.5px] font-medium text-muted">{bookInfo.genre}</span>
                    )}
                    {bookInfo.published_year && (
                      <span className="rounded-full border border-line bg-card px-2 py-0.5 text-[10.5px] font-medium text-muted">{bookInfo.published_year}</span>
                    )}
                    {bookInfo.total_chapters && (
                      <span className="rounded-full border border-line bg-card px-2 py-0.5 text-[10.5px] font-medium text-muted">{bookInfo.total_chapters} chapitres</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted">Résumé</p>
                {bookInfoSummaryLoading ? (
                  <p className="text-[12.5px] text-muted">Chargement…</p>
                ) : bookInfoSummary ? (
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">{bookInfoSummary}</p>
                ) : (
                  <p className="text-[12.5px] text-muted">Aucun résumé disponible pour ce livre.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
