"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { notifyUser } from "../../lib/push.client";
import type { BookClub, BookClubMember, BookClubInvite } from "../../lib/bookclubs";
import { clubThemeVar } from "../../lib/bookclubs";
import { Cover, AvatarImg } from "../../components/ui";
import AddToLibraryModal, { type BookRef } from "../../components/AddToLibraryModal";
import { searchBooks } from "../../lib/googleBooks";
import type { Book } from "../../lib/types";
import { GENRES } from "../../components/BibliothequeView";

const GENRE_SET = new Set(GENRES);

interface ActivityItem {
  key: string;
  type: "completed" | "reading";
  bookId: number;
  title: string;
  coverUrl: string | null;
  userName: string;
  userAvatar: string | null;
  date: string;
}

interface LeaderEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  score: number;
}

interface RecoItem {
  id: string;
  fromName: string;
  fromAvatar: string | null;
  title: string;
  author: string;
  coverUrl: string | null;
  message: string | null;
}

interface InviteWithClub extends BookClubInvite {
  club: BookClub;
  inviterName: string;
}

// ── Prochaines lectures suggérées — personnalisation par genre/auteur préféré ──
const GENRE_TO_QUERY: Record<string, string> = {
  "Roman": "literary fiction bestseller", "Fiction": "fiction novel", "Non-Fiction": "nonfiction",
  "Classique": "classic literature", "Nouvelle": "short stories novella",
  "Thriller": "thriller suspense crime", "Policier": "detective mystery crime", "Crime": "crime true crime",
  "Mystère": "mystery suspense", "Science-Fiction": "science fiction", "Fantasy": "fantasy magic",
  "Biographie": "biography autobiography", "Témoignage": "memoir true story", "Histoire": "history historical",
  "Essai": "essays nonfiction", "Poésie": "poetry", "BD / Roman graphique": "graphic novel comics",
  "Manga": "manga japanese", "Comics": "comics superhero graphic",
  "Développement personnel": "self-help personal development", "Science": "popular science",
  "Psychologie": "psychology", "Philosophie": "philosophy", "Aventure": "adventure", "Romance": "romance",
  "Humour": "humor comedy satire", "Jeunesse": "young adult fiction", "Économie": "economics business",
  "Sciences humaines": "sociology anthropology", "Sciences politiques": "political history",
  "Sport": "sports biography", "Cinéma": "cinema film movies", "Musique": "music biography",
  "Drame": "drama literary fiction", "Suspense": "suspense psychological thriller", "Théâtre": "theater plays drama",
};

interface NextReadItem {
  key: string;
  title: string;
  author: string;
  coverUrl: string | null;
  genre: string | null;
  year: number | null;
  summary: string | null;
  source: "community" | "external";
  peerCount?: number;
  bookId?: number;
}

const ARTICLES = new Set(["le", "la", "les", "l", "un", "une", "des", "du", "de", "the", "a", "an"]);

function dedupeKey(b: { title: string; author: string | null }) {
  return `${b.title.toLowerCase().trim()}__${(b.author || "").toLowerCase().trim()}`;
}

function fuzzyKey(title: string, author: string): string {
  const surname = (author || "").toLowerCase().replace(/,/g, " ").split(/\s+/).filter(Boolean).pop() ?? "";
  const normTitle = title
    .toLowerCase()
    .replace(/[''"""«»\-—–:,!?.()[\]]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !ARTICLES.has(w))
    .slice(0, 4)
    .join(" ");
  return `${surname}_${normTitle}`;
}

function ClubCard({ club, badge, href }: { club: BookClub; badge?: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col overflow-hidden rounded-2xl border border-line bg-card transition-transform active:scale-[0.98]"
    >
      <div
        className="flex aspect-[4/3] w-full items-center justify-center"
        style={{ backgroundColor: club.cover_url ? undefined : `color-mix(in srgb, ${clubThemeVar(club.theme_color)} 22%, transparent)` }}
      >
        {club.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={club.cover_url} alt={club.name} className="h-full w-full object-cover" />
        ) : (
          <span className="font-serif text-2xl font-black" style={{ color: clubThemeVar(club.theme_color) }}>
            {club.name[0]?.toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-serif text-[14px] font-bold text-ink">{club.name}</p>
          {badge && (
            <span className="shrink-0 rounded-full bg-violet-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-deep">
              {badge}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted">
          {club.member_count} membre{club.member_count > 1 ? "s" : ""}
          {club.genres.length > 0 && ` · ${club.genres.slice(0, 2).join(", ")}`}
        </p>
      </div>
    </Link>
  );
}

export default function CommunautePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [myClubs, setMyClubs] = useState<(BookClub & { role: BookClubMember["role"] })[]>([]);
  const [discoverClubs, setDiscoverClubs] = useState<BookClub[]>([]);
  const [invites, setInvites] = useState<InviteWithClub[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<BookClub[] | null>(null);
  const [bookResults, setBookResults] = useState<NextReadItem[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[] | null>(null);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"month" | "year">("month");
  const [leaderboardMetric, setLeaderboardMetric] = useState<"pages" | "books">("pages");
  const [recos, setRecos] = useState<RecoItem[] | null>(null);
  const [addReco, setAddReco] = useState<{ id: string; ref: BookRef } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [nextReads, setNextReads] = useState<NextReadItem[] | null>(null);
  const [selectedNextRead, setSelectedNextRead] = useState<NextReadItem | null>(null);
  const [addNextRead, setAddNextRead] = useState<BookRef | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    const { data: memberships } = await supabase
      .from("book_club_members")
      .select("club_id, role")
      .eq("user_id", user.id);
    const myRows = (memberships ?? []) as { club_id: string; role: BookClubMember["role"] }[];
    const myClubIds = myRows.map((r) => r.club_id);
    const roleByClub = new Map(myRows.map((r) => [r.club_id, r.role]));

    const [{ data: mine }, { data: discover }, { data: pendingInvites }] = await Promise.all([
      myClubIds.length
        ? supabase.from("book_clubs").select("*").in("id", myClubIds).order("last_activity_at", { ascending: false })
        : Promise.resolve({ data: [] as BookClub[] }),
      supabase
        .from("book_clubs")
        .select("*")
        .eq("is_public", true)
        .order("member_count", { ascending: false })
        .order("last_activity_at", { ascending: false })
        .limit(24),
      supabase
        .from("book_club_invites")
        .select("*, club:book_clubs(*)")
        .eq("invited_user_id", user.id)
        .eq("status", "pending"),
    ]);

    setMyClubs(((mine ?? []) as BookClub[]).map((c) => ({ ...c, role: roleByClub.get(c.id) ?? "member" })));
    setDiscoverClubs(((discover ?? []) as BookClub[]).filter((c) => !myClubIds.includes(c.id)));

    const inviteRows = (pendingInvites ?? []) as (BookClubInvite & { club: BookClub })[];
    if (inviteRows.length) {
      const inviterIds = [...new Set(inviteRows.map((i) => i.invited_by).filter(Boolean))] as string[];
      const { data: profiles } = inviterIds.length
        ? await supabase.from("user_profiles").select("id, display_name").in("id", inviterIds)
        : { data: [] };
      const nameById = new Map(((profiles ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name]));
      setInvites(inviteRows.map((i) => ({ ...i, inviterName: nameById.get(i.invited_by ?? "") ?? "Un membre" })));
    } else {
      setInvites([]);
    }

    setLoading(false);

    // Activité de lecture des membres suivis.
    const { data: follows } = await supabase.from("user_follows").select("following_id").eq("follower_id", user.id);
    const followingIds = ((follows ?? []) as { following_id: string }[]).map((f) => f.following_id);
    if (followingIds.length) {
      const [{ data: completed }, { data: reading }] = await Promise.all([
        supabase
          .from("books")
          .select("id, title, cover_url, user_id, date_read")
          .in("user_id", followingIds)
          .eq("status", "completed")
          .not("date_read", "is", null)
          .order("date_read", { ascending: false })
          .limit(15),
        supabase
          .from("books")
          .select("id, title, cover_url, user_id, date_started")
          .in("user_id", followingIds)
          .eq("status", "reading")
          .not("date_started", "is", null)
          .order("date_started", { ascending: false })
          .limit(15),
      ]);
      type Raw = { id: number; title: string; cover_url: string | null; user_id: string; date_read?: string; date_started?: string };
      const merged = [
        ...((completed ?? []) as Raw[]).map((b) => ({ ...b, type: "completed" as const, date: b.date_read! })),
        ...((reading ?? []) as Raw[]).map((b) => ({ ...b, type: "reading" as const, date: b.date_started! })),
      ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);

      const activityUserIds = [...new Set(merged.map((m) => m.user_id))];
      const { data: actProfiles } = activityUserIds.length
        ? await supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", activityUserIds)
        : { data: [] };
      const actMap = new Map(((actProfiles ?? []) as { id: string; display_name: string; avatar_url: string | null }[]).map((p) => [p.id, p]));

      setActivity(
        merged.map((m) => ({
          key: `${m.type}-${m.id}`,
          type: m.type,
          bookId: m.id,
          title: m.title,
          coverUrl: m.cover_url,
          userName: actMap.get(m.user_id)?.display_name ?? "Membre",
          userAvatar: actMap.get(m.user_id)?.avatar_url ?? null,
          date: m.date,
        }))
      );
    } else {
      setActivity([]);
    }

    // Recommandations reçues d'autres membres.
    const { data: recoRows } = await supabase
      .from("book_recommendations")
      .select("id, from_user_id, book_title, book_author, book_cover, message")
      .eq("to_user_id", user.id)
      .order("created_at", { ascending: false });
    const recoList = (recoRows ?? []) as {
      id: string; from_user_id: string; book_title: string; book_author: string; book_cover: string | null; message: string | null;
    }[];
    if (recoList.length) {
      const senderIds = [...new Set(recoList.map((r) => r.from_user_id))];
      const { data: senderProfiles } = await supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", senderIds);
      const senderMap = new Map(((senderProfiles ?? []) as { id: string; display_name: string; avatar_url: string | null }[]).map((p) => [p.id, p]));
      setRecos(
        recoList.map((r) => ({
          id: r.id,
          fromName: senderMap.get(r.from_user_id)?.display_name ?? "Un membre",
          fromAvatar: senderMap.get(r.from_user_id)?.avatar_url ?? null,
          title: r.book_title,
          author: r.book_author,
          coverUrl: r.book_cover,
          message: r.message,
        }))
      );
    } else {
      setRecos([]);
    }
  }, [user]);

  const handleDismissReco = async (id: string) => {
    await supabase.from("book_recommendations").delete().eq("id", id);
    setRecos((prev) => (prev ?? []).filter((r) => r.id !== id));
  };

  const openAddReco = (reco: RecoItem) => {
    setAddReco({ id: reco.id, ref: { title: reco.title, author: reco.author, pages: 0, cover_url: reco.coverUrl } });
  };

  // Prochaines lectures suggérées — profil de goût pondéré par tes notes (tes
  // 3 genres et 2 auteurs préférés, en excluant ce que tu notes en moyenne
  // <3), d'abord croisé avec ce que des lecteurs aux goûts proches ont aimé
  // sur Swena, complété seulement si besoin par Open Library/Google Books —
  // sans remplissage aléatoire. Calculé une fois par visite.
  useEffect(() => {
    if (!user?.id || nextReads !== null) return;
    (async () => {
      const { data: myBooksData } = await supabase.from("books").select("*").eq("user_id", user.id);
      const myBooks = (myBooksData ?? []) as Book[];
      if (!myBooks.length) { setNextReads([]); return; }

      const existingExact = new Set(myBooks.map((b) => dedupeKey(b)));
      const existingFuzzy = new Set(myBooks.map((b) => fuzzyKey(b.title, b.author || "")));

      // Profil pondéré par tes notes — les livres non notés n'influencent pas le goût.
      // On classe par NOTE MOYENNE (force du goût), pas par nombre de livres :
      // "Fiction"/"Roman" apparaissent sur presque tout ton étagère et n'ont
      // donc aucun pouvoir discriminant, même s'ils cumulent le plus de points.
      const genreRatingSum = new Map<string, number>();
      const genreRatingCount = new Map<string, number>();
      const authorRatingSum = new Map<string, number>();
      const authorRatingCount = new Map<string, number>();
      let ratedCount = 0;
      for (const b of myBooks) {
        const rating = b.rating || 0;
        if (rating <= 0) continue;
        ratedCount++;
        if (b.genre) {
          for (const g of b.genre.split(",").map((s) => s.trim()).filter((g) => GENRE_SET.has(g))) {
            genreRatingSum.set(g, (genreRatingSum.get(g) || 0) + rating);
            genreRatingCount.set(g, (genreRatingCount.get(g) || 0) + 1);
          }
        }
        if (b.author) {
          authorRatingSum.set(b.author, (authorRatingSum.get(b.author) || 0) + rating);
          authorRatingCount.set(b.author, (authorRatingCount.get(b.author) || 0) + 1);
        }
      }

      // Seuil minimum pour ignorer les flukes (un seul livre à 5★ ne fait pas un genre préféré).
      const minGenreCount = Math.max(5, Math.round(ratedCount * 0.02));
      let topGenres = [...genreRatingCount.keys()]
        .filter((g) => genreRatingCount.get(g)! >= minGenreCount)
        .map((g) => [g, genreRatingSum.get(g)! / genreRatingCount.get(g)!] as const)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([g]) => g);
      let topAuthors = [...authorRatingCount.keys()]
        .filter((a) => authorRatingCount.get(a)! >= 2)
        .map((a) => [a, authorRatingSum.get(a)! / authorRatingCount.get(a)!] as const)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([a]) => a);

      // Repli si rien n'est encore noté : fréquence brute sur tes derniers ajouts.
      if (!topGenres.length && !topAuthors.length) {
        const genreFreq = new Map<string, number>();
        const authorFreq = new Map<string, number>();
        myBooks.slice(0, 8).forEach((b) => {
          b.genre?.split(",").map((s) => s.trim()).filter(Boolean).forEach((g) => genreFreq.set(g, (genreFreq.get(g) || 0) + 1));
          if (b.author) authorFreq.set(b.author, (authorFreq.get(b.author) || 0) + 1);
        });
        topGenres = [...genreFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g);
        topAuthors = [...authorFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([a]) => a);
      }
      if (!topGenres.length && !topAuthors.length) { setNextReads([]); return; }

      const genreSet = new Set(topGenres);
      const authorSet = new Set(topAuthors);
      const picked = new Map<string, NextReadItem>();

      // 1) Livres déjà sur Swena, bien notés par des lecteurs aux goûts proches des tiens.
      const { data: peerBooksData } = await supabase
        .from("books")
        .select("id, title, author, cover_url, genre, published_year, summary, rating, user_id")
        .neq("user_id", user.id)
        .gte("rating", 4)
        .limit(500);
      type PeerBook = { id: number; title: string; author: string; cover_url: string | null; genre: string | null; published_year: number | null; summary: string | null; rating: number; user_id: string };
      const peerGrouped = new Map<string, { item: NextReadItem; raters: Set<string>; ratingSum: number; ratingCount: number }>();
      for (const b of (peerBooksData ?? []) as PeerBook[]) {
        const bookGenres = (b.genre || "").split(",").map((s) => s.trim());
        const genreMatch = bookGenres.some((g) => genreSet.has(g));
        const authorMatch = b.author ? authorSet.has(b.author) : false;
        if (!genreMatch && !authorMatch) continue;
        const eKey = dedupeKey(b);
        const fKey = fuzzyKey(b.title, b.author || "");
        if (existingExact.has(eKey) || existingFuzzy.has(fKey)) continue;
        const entry = peerGrouped.get(eKey) ?? {
          item: { key: eKey, title: b.title, author: b.author, coverUrl: b.cover_url, genre: b.genre, year: b.published_year, summary: b.summary, source: "community" as const, bookId: b.id },
          raters: new Set<string>(), ratingSum: 0, ratingCount: 0,
        };
        entry.raters.add(b.user_id);
        entry.ratingSum += b.rating;
        entry.ratingCount += 1;
        peerGrouped.set(eKey, entry);
      }
      [...peerGrouped.values()]
        .sort((a, b) => b.raters.size - a.raters.size || b.ratingSum / b.ratingCount - a.ratingSum / a.ratingCount)
        .slice(0, 8)
        .forEach((e) => picked.set(e.item.key, { ...e.item, peerCount: e.raters.size }));

      // 2) Complète via recherche externe seulement si la communauté ne suffit pas.
      if (picked.size < 8) {
        const queries: string[] = [
          ...topGenres.map((g) => GENRE_TO_QUERY[g] || g),
          ...topAuthors.map((a) => `inauthor:"${a.split(" ").pop() || a}"`),
        ];
        try {
          const results = await Promise.allSettled(queries.map((q) => searchBooks(q)));
          results.forEach((r) => {
            if (r.status !== "fulfilled") return;
            let taken = 0;
            for (const s of r.value) {
              if (picked.size >= 8 || taken >= 2) break;
              const eKey = dedupeKey({ title: s.title, author: s.author });
              const fKey = fuzzyKey(s.title, s.author);
              if (picked.has(eKey) || existingExact.has(eKey) || existingFuzzy.has(fKey) || !s.coverUrl) continue;
              picked.set(eKey, { key: eKey, title: s.title, author: s.author, coverUrl: s.coverUrl, genre: s.genre, year: s.year, summary: s.summary, source: "external" });
              taken++;
            }
          });
        } catch { /* la recherche externe n'est qu'un complément, pas bloquant */ }
      }

      setNextReads([...picked.values()]);
    })();
  }, [user, nextReads]);

  const quickAddNextRead = async (s: NextReadItem, status: "to-read" | "completed") => {
    if (!user?.id) return;
    const { data: existing } = await supabase.from("books").select("id").eq("user_id", user.id).ilike("title", s.title).limit(1);
    if (existing && existing.length) {
      setToast("Ce livre est déjà dans ta bibliothèque.");
      setTimeout(() => setToast(null), 3000);
      return;
    }
    const { error } = await supabase.from("books").insert({
      title: s.title, author: s.author || "Auteur inconnu", pages: 0, progress: 0, status,
      cover_url: s.coverUrl ?? null, genre: s.genre ?? null, published_year: s.year ?? null,
      summary: s.summary ?? null, rating: 0, user_id: user.id,
    });
    if (!error) {
      setNextReads((prev) => (prev ?? []).filter((r) => r.key !== s.key));
      setSelectedNextRead(null);
      setToast(status === "to-read" ? `« ${s.title} » ajouté à ta liste Envie de lire.` : `« ${s.title} » ajouté à tes livres terminés.`);
      setTimeout(() => setToast(null), 3500);
    }
  };

  useEffect(() => { load(); }, [load]);

  // Classement — pages ou livres lus, sur le mois ou l'année en cours.
  useEffect(() => {
    if (!user?.id) return;
    setLeaderboard(null);
    (async () => {
      const now = new Date();
      const since = leaderboardPeriod === "year"
        ? `${now.getFullYear()}-01-01`
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      const scoreMap = new Map<string, number>();
      if (leaderboardMetric === "pages") {
        const { data: logs } = await supabase.from("reading_logs").select("user_id, pages_read").gte("date", since);
        for (const l of (logs ?? []) as { user_id: string; pages_read: number }[]) {
          scoreMap.set(l.user_id, (scoreMap.get(l.user_id) ?? 0) + (l.pages_read || 0));
        }
      } else {
        const { data: rows } = await supabase
          .from("books")
          .select("user_id")
          .eq("status", "completed")
          .gte("date_read", since);
        for (const r of (rows ?? []) as { user_id: string }[]) {
          scoreMap.set(r.user_id, (scoreMap.get(r.user_id) ?? 0) + 1);
        }
      }
      const rankedIds = [...scoreMap.keys()];
      const { data: rankProfiles } = rankedIds.length
        ? await supabase.from("user_profiles").select("id, display_name, avatar_url").in("id", rankedIds)
        : { data: [] };
      setLeaderboard(
        ((rankProfiles ?? []) as { id: string; display_name: string; avatar_url: string | null }[])
          .map((p) => ({ userId: p.id, name: p.display_name, avatarUrl: p.avatar_url, score: scoreMap.get(p.id) ?? 0 }))
          .filter((e) => e.score > 0)
          .sort((a, b) => b.score - a.score)
      );
    })();
  }, [user, leaderboardPeriod, leaderboardMetric]);

  // Recherche unifiée (debounced) — clubs ET livres (Swena puis Open Library/
  // Google Books) dans la même barre. Rien ne s'affiche tant qu'on ne cherche
  // pas : pas de liste "tous les livres de la base" par défaut.
  useEffect(() => {
    const q = search.trim();
    if (!q) { setSearchResults(null); setBookResults(null); return; }
    setSearching(true);
    const handle = setTimeout(async () => {
      const qSafe = q.replace(/,/g, " "); // évite de casser le filtre .or() de PostgREST
      const [{ data: clubData }, { data: internalBooks }] = await Promise.all([
        supabase.from("book_clubs").select("*").ilike("name", `%${q}%`).order("member_count", { ascending: false }).limit(30),
        supabase
          .from("books")
          .select("id, title, author, cover_url, genre, published_year, summary")
          .or(`title.ilike.%${qSafe}%,author.ilike.%${qSafe}%`)
          .limit(20),
      ]);
      setSearchResults((clubData ?? []) as BookClub[]);

      const seenExact = new Set<string>();
      const seenFuzzy = new Set<string>();
      const internalItems: NextReadItem[] = [];
      type InternalBook = { id: number; title: string; author: string; cover_url: string | null; genre: string | null; published_year: number | null; summary: string | null };
      for (const b of (internalBooks ?? []) as InternalBook[]) {
        const eKey = dedupeKey(b);
        if (seenExact.has(eKey)) continue;
        seenExact.add(eKey);
        seenFuzzy.add(fuzzyKey(b.title, b.author || ""));
        internalItems.push({ key: eKey, title: b.title, author: b.author, coverUrl: b.cover_url, genre: b.genre, year: b.published_year, summary: b.summary, source: "community", bookId: b.id });
      }

      const externalItems: NextReadItem[] = [];
      if (q.length >= 2) {
        try {
          const results = await searchBooks(q);
          for (const s of results) {
            if (externalItems.length >= 8) break;
            if (!s.coverUrl) continue;
            const eKey = dedupeKey({ title: s.title, author: s.author });
            const fKey = fuzzyKey(s.title, s.author);
            if (seenExact.has(eKey) || seenFuzzy.has(fKey)) continue;
            seenExact.add(eKey);
            externalItems.push({ key: eKey, title: s.title, author: s.author, coverUrl: s.coverUrl, genre: s.genre, year: s.year, summary: s.summary, source: "external" });
          }
        } catch { /* recherche externe indisponible : on garde les résultats internes */ }
      }

      setBookResults([...internalItems, ...externalItems]);
      setSearching(false);
    }, 350);
    return () => clearTimeout(handle);
  }, [search]);

  const handleAcceptInvite = async (invite: InviteWithClub) => {
    if (!user?.id) return;
    await supabase.from("book_club_members").insert({ club_id: invite.club_id, user_id: user.id, role: "member" });
    await supabase.from("book_club_invites").delete().eq("id", invite.id);
    load();
  };
  const handleDeclineInvite = async (invite: InviteWithClub) => {
    await supabase.from("book_club_invites").delete().eq("id", invite.id);
    load();
  };

  const handleJoinPublic = async (club: BookClub) => {
    if (!user?.id) return;
    await supabase.from("book_club_members").insert({ club_id: club.id, user_id: user.id, role: "member" });
    if (club.created_by !== user.id) {
      const senderName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";
      notifyUser(club.created_by, "Swena", `${senderName} a rejoint ton club «${club.name}»`, `/communaute/clubs/${club.id}`, "clubs");
    }
    load();
  };

  return (
    <div className="animate-fadeIn flex flex-col gap-5 pb-10 pt-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-black text-ink">Communauté</h1>
          <p className="mt-0.5 text-[12.5px] text-muted">Book clubs et lectures partagées</p>
        </div>
        {!search.trim() && (
          <Link
            href="/communaute/nouveau"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-violet px-4 py-2.5 text-[12.5px] font-bold text-cream transition-transform active:scale-95"
          >
            + Créer
          </Link>
        )}
      </header>

      {/* Recherche unifiée — clubs et livres, à la fois */}
      <div className="relative">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="m20 20-3.5-3.5" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un club ou un livre…"
          className="w-full rounded-2xl border border-line bg-input py-3 pl-10 pr-3.5 text-sm text-ink outline-none placeholder:text-muted focus:border-violet"
        />
      </div>

      {search.trim() ? (
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Clubs</h2>
            {searching && searchResults === null ? (
              <p className="px-1 text-[12.5px] text-muted">Recherche…</p>
            ) : (searchResults ?? []).length === 0 ? (
              <p className="px-1 text-[12.5px] text-muted">Aucun club ne correspond à cette recherche.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {(searchResults ?? []).map((c) => {
                  const mine = myClubs.find((m) => m.id === c.id);
                  return <ClubCard key={c.id} club={c} badge={mine?.role === "moderator" ? "Modérateur" : undefined} href={`/communaute/clubs/${c.id}`} />;
                })}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Livres</h2>
            {bookResults === null ? (
              <p className="px-1 text-[12.5px] text-muted">Recherche…</p>
            ) : bookResults.length === 0 ? (
              <p className="px-1 text-[12.5px] text-muted">Aucun livre ne correspond à cette recherche.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {bookResults.map((b) => (
                  <button
                    key={b.key}
                    onClick={() => (b.bookId ? router.push(`/livre/${b.bookId}`) : setSelectedNextRead(b))}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3.5 py-2.5 text-left transition-colors hover:bg-paper"
                  >
                    <div className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-input">
                      {b.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.coverUrl} alt={b.title} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-muted">?</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-serif text-[14px] font-semibold text-ink">{b.title}</p>
                      <p className="truncate text-[11px] text-muted">{b.author}</p>
                    </div>
                    {b.bookId ? (
                      <span className="shrink-0 text-muted">›</span>
                    ) : (
                      <span className="shrink-0 text-[11px] font-semibold text-violet-deep">+ Ajouter</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        loading ? (
          <div className="py-10 text-center text-xs text-muted">Chargement…</div>
        ) : (
          <>
            {invites.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Invitations</h2>
                <div className="flex flex-col gap-2">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-3 rounded-2xl border border-violet/40 bg-violet-soft p-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-serif text-base font-black"
                        style={{ backgroundColor: `color-mix(in srgb, ${clubThemeVar(inv.club.theme_color)} 30%, transparent)`, color: clubThemeVar(inv.club.theme_color) }}
                      >
                        {inv.club.name[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-ink">{inv.club.name}</p>
                        <p className="text-[11px] text-muted">Invité par {inv.inviterName}</p>
                      </div>
                      <button
                        onClick={() => handleAcceptInvite(inv)}
                        className="shrink-0 rounded-xl bg-violet px-3.5 py-2 text-[12px] font-bold text-cream transition-transform active:scale-95"
                      >
                        Accepter
                      </button>
                      <button
                        onClick={() => handleDeclineInvite(inv)}
                        className="shrink-0 rounded-xl border border-line bg-card px-3.5 py-2 text-[12px] font-medium text-muted transition-transform active:scale-95"
                      >
                        Décliner
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {recos !== null && recos.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Recommandations</h2>
                  <div className="flex flex-col gap-2">
                    {recos.map((r) => (
                      <div key={r.id} className="flex items-start gap-3 rounded-2xl border border-line bg-card p-3">
                        <div className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-input">
                          {r.coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.coverUrl} alt={r.title} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-[10px] text-muted">?</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-serif text-[14px] font-semibold text-ink">{r.title}</p>
                          <p className="truncate text-[11px] text-muted">{r.author}</p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <AvatarImg url={r.fromAvatar} name={r.fromName} className="h-4 w-4 text-[7px]" />
                            <p className="truncate text-[11px] text-muted">Recommandé par {r.fromName}</p>
                          </div>
                          {r.message && <p className="mt-1 text-[11.5px] italic text-ink-2">« {r.message} »</p>}
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => openAddReco(r)}
                              className="rounded-xl bg-violet px-3 py-1.5 text-[11.5px] font-semibold text-cream transition-transform active:scale-95"
                            >
                              Ajouter à ma liste
                            </button>
                            <button
                              onClick={() => handleDismissReco(r.id)}
                              className="rounded-xl border border-line bg-card px-3 py-1.5 text-[11.5px] font-medium text-muted transition-transform active:scale-95"
                            >
                              Ignorer
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {nextReads !== null && nextReads.length > 0 && (
                <section className="flex flex-col gap-2">
                  <div>
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Tes prochaines lectures</h2>
                    <p className="text-[11px] text-muted">Basé sur tes genres et auteurs préférés</p>
                  </div>
                  <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
                    {nextReads.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => (s.bookId ? router.push(`/livre/${s.bookId}`) : setSelectedNextRead(s))}
                        className="flex w-36 shrink-0 flex-col gap-2 text-left transition-transform active:scale-[0.98]"
                      >
                        {s.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.coverUrl} alt={s.title} className="aspect-[3/4] w-full rounded-xl object-cover shadow-sm" />
                        ) : (
                          <div className="flex aspect-[3/4] w-full items-center justify-center rounded-xl bg-violet-soft">
                            <span className="font-serif text-2xl font-black text-violet-deep">{s.title[0]?.toUpperCase()}</span>
                          </div>
                        )}
                        <p className="line-clamp-2 text-[12.5px] font-semibold text-ink">{s.title}</p>
                        {s.source === "community" && s.peerCount ? (
                          <p className="truncate text-[11px] font-medium text-violet-deep">
                            Aimé par {s.peerCount} lecteur{s.peerCount > 1 ? "s" : ""}
                          </p>
                        ) : (
                          <p className="truncate text-[11px] text-muted">{s.author}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Activité de lecture — ce que lisent les membres suivis */}
              <section className="flex flex-col gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Activité de lecture</h2>
                {activity === null ? (
                  <p className="px-1 text-[12.5px] text-muted">Chargement…</p>
                ) : activity.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-line bg-card p-6 text-center">
                    <p className="text-[12.5px] text-muted">Suis des membres pour voir ce qu&apos;ils lisent ici.</p>
                    <Link href="/membres" className="mt-2 inline-block text-[12px] font-semibold text-violet-deep">
                      Découvrir des membres →
                    </Link>
                  </div>
                ) : (
                  <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
                    {activity.map((a) => (
                      <Link key={a.key} href={`/livre/${a.bookId}`} className="flex w-36 shrink-0 flex-col gap-2">
                        <Cover id={a.bookId} title={a.title} coverUrl={a.coverUrl} className="aspect-[3/4] w-full shadow-sm" rounded="rounded-xl" />
                        <p className="line-clamp-2 text-[12.5px] font-semibold text-ink">{a.title}</p>
                        <p className="truncate text-[11px] text-muted">
                          {a.userName} · {a.type === "completed" ? "a terminé" : "lit"}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              {/* Classement — pages ou livres lus, mois ou année */}
              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Classement {leaderboardPeriod === "year" ? "de l'année" : "du mois"}
                  </h2>
                  <div className="flex gap-1.5">
                    <div className="flex overflow-hidden rounded-full border border-line text-[10.5px] font-semibold">
                      {(["month", "year"] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setLeaderboardPeriod(p)}
                          className={`px-2.5 py-1 transition-colors ${
                            leaderboardPeriod === p ? "bg-violet text-cream" : "bg-card text-muted hover:text-ink"
                          }`}
                        >
                          {p === "month" ? "Mois" : "Année"}
                        </button>
                      ))}
                    </div>
                    <div className="flex overflow-hidden rounded-full border border-line text-[10.5px] font-semibold">
                      {(["pages", "books"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setLeaderboardMetric(m)}
                          className={`px-2.5 py-1 transition-colors ${
                            leaderboardMetric === m ? "bg-violet text-cream" : "bg-card text-muted hover:text-ink"
                          }`}
                        >
                          {m === "pages" ? "Pages" : "Livres"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {leaderboard === null ? (
                  <p className="px-1 text-[12.5px] text-muted">Chargement…</p>
                ) : leaderboard.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-line bg-card p-6 text-center">
                    <p className="text-[12.5px] text-muted">
                      Personne n&apos;a encore {leaderboardMetric === "pages" ? "enregistré de lecture" : "terminé de livre"}{" "}
                      {leaderboardPeriod === "year" ? "cette année" : "ce mois-ci"}.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-line bg-card">
                    {leaderboard.slice(0, 5).map((e, i) => {
                      const isMe = e.userId === user?.id;
                      return (
                        <div key={e.userId} className={`flex items-center gap-3 px-3.5 py-2.5 ${isMe ? "bg-violet-soft" : ""}`}>
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[12px] font-bold text-muted">{i + 1}</span>
                          <AvatarImg url={e.avatarUrl} name={e.name} className="h-8 w-8 shrink-0 text-xs" />
                          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                            {e.name}{isMe && <span className="ml-1.5 text-[10.5px] font-normal text-violet-deep">(toi)</span>}
                          </p>
                          <p className="shrink-0 text-[12.5px] font-bold text-ink">
                            {e.score.toLocaleString("fr-FR")}{" "}
                            <span className="text-[9.5px] font-medium uppercase tracking-wide text-muted">
                              {leaderboardMetric === "pages" ? "pages" : e.score > 1 ? "livres" : "livre"}
                            </span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {myClubs.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Tes clubs</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {myClubs.map((c) => (
                      <ClubCard key={c.id} club={c} badge={c.role === "moderator" ? "Modérateur" : undefined} href={`/communaute/clubs/${c.id}`} />
                    ))}
                  </div>
                </section>
              )}

              <section className="flex flex-col gap-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Découvrir des clubs</h2>
                {discoverClubs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
                    <p className="font-serif text-base text-ink">Aucun club public pour l&apos;instant.</p>
                    <p className="mt-1 text-sm text-muted">Sois le premier à en créer un !</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {discoverClubs.map((c) => (
                      <div key={c.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-card">
                        <ClubCard club={c} href={`/communaute/clubs/${c.id}`} />
                        <button
                          onClick={() => handleJoinPublic(c)}
                          className="border-t border-line py-2.5 text-[12.5px] font-bold text-violet-deep transition-colors active:bg-violet-soft"
                        >
                          Rejoindre
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {myClubs.length === 0 && invites.length === 0 && discoverClubs.length === 0 && (
                <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
                  <p className="font-serif text-base text-ink">Aucun club pour le moment.</p>
                  <p className="mt-1 text-sm text-muted">Crée le premier book club de la communauté !</p>
                </div>
              )}
            </>
          )
        )}

      <AddToLibraryModal
        open={addReco !== null}
        onClose={() => setAddReco(null)}
        book={addReco?.ref ?? null}
        onAdded={(msg) => {
          if (addReco) handleDismissReco(addReco.id);
          setAddReco(null);
          setToast(msg);
          setTimeout(() => setToast(null), 3500);
        }}
      />

      {/* Détail d'une suggestion de prochaine lecture */}
      {selectedNextRead && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pt-4 pb-24 [touch-action:none] sm:items-center"
          onClick={() => setSelectedNextRead(null)}
        >
          <div
            className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-y-auto rounded-2xl bg-paper shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="font-serif text-base font-semibold text-ink">Détails</h3>
              <button
                onClick={() => setSelectedNextRead(null)}
                aria-label="Fermer"
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-muted transition-transform active:scale-90"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-4 px-5 py-4">
              <div className="flex gap-3">
                {selectedNextRead.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedNextRead.coverUrl} alt={selectedNextRead.title} className="h-28 w-20 shrink-0 rounded-lg object-cover shadow-sm" />
                ) : (
                  <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-lg bg-violet-soft">
                    <span className="font-serif text-2xl font-black text-violet-deep">{selectedNextRead.title[0]?.toUpperCase()}</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg font-bold leading-tight text-ink">{selectedNextRead.title}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{selectedNextRead.author}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedNextRead.source === "community" && selectedNextRead.peerCount && (
                      <span className="rounded-full bg-violet-soft px-2 py-0.5 text-[10.5px] font-semibold text-violet-deep">
                        Aimé par {selectedNextRead.peerCount} lecteur{selectedNextRead.peerCount > 1 ? "s" : ""}
                      </span>
                    )}
                    {selectedNextRead.genre && (
                      <span className="rounded-full border border-line bg-card px-2 py-0.5 text-[10.5px] font-medium text-muted">{selectedNextRead.genre}</span>
                    )}
                    {selectedNextRead.year && (
                      <span className="rounded-full border border-line bg-card px-2 py-0.5 text-[10.5px] font-medium text-muted">{selectedNextRead.year}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted">Résumé</p>
                {selectedNextRead.summary ? (
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">{selectedNextRead.summary}</p>
                ) : (
                  <p className="text-[12.5px] text-muted">Aucun résumé disponible pour ce livre.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => quickAddNextRead(selectedNextRead, "completed")}
                  className="flex items-center justify-center gap-1.5 rounded-2xl bg-[#eaf1ea] py-3 text-[13px] font-semibold text-success transition-transform active:scale-[0.98]"
                >
                  Terminé
                </button>
                <button
                  onClick={() => quickAddNextRead(selectedNextRead, "to-read")}
                  className="flex items-center justify-center gap-1.5 rounded-2xl bg-violet-soft py-3 text-[13px] font-semibold text-violet-deep transition-transform active:scale-[0.98]"
                >
                  Envie de lire
                </button>
              </div>
              <button
                onClick={() => {
                  setAddNextRead({
                    title: selectedNextRead.title,
                    author: selectedNextRead.author,
                    pages: 0,
                    cover_url: selectedNextRead.coverUrl,
                    genre: selectedNextRead.genre,
                    published_year: selectedNextRead.year,
                    summary: selectedNextRead.summary,
                  });
                  setSelectedNextRead(null);
                }}
                className="text-[12px] font-medium text-muted underline underline-offset-2"
              >
                Personnaliser l&apos;ajout…
              </button>
            </div>
          </div>
        </div>
      )}

      <AddToLibraryModal
        open={addNextRead !== null}
        onClose={() => setAddNextRead(null)}
        book={addNextRead}
        onAdded={(msg) => {
          setNextReads((prev) => (prev ?? []).filter((r) => !(r.title === addNextRead?.title && r.author === addNextRead?.author)));
          setAddNextRead(null);
          setToast(msg);
          setTimeout(() => setToast(null), 3500);
        }}
      />

      {toast && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] left-1/2 z-[70] -translate-x-1/2 rounded-2xl border border-[#a78bfa]/45 bg-[#252131] px-4 py-2.5 text-sm font-medium text-[#fdfbf7] shadow-[0_8px_28px_rgba(0,0,0,0.4)] md:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
