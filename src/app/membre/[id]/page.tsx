"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import type { Book, ReadingLog } from "../../../lib/types";
import { pct, isCompleted } from "../../../lib/books";
import { Cover, ProgressBar, AvatarImg } from "../../../components/ui";
import { ObjectiveChart, RatingsChart } from "../../../components/DashboardWidgets";
import AddToLibraryModal from "../../../components/AddToLibraryModal";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const VIOLET = "var(--color-violet)";
const VIOLET_LT = "#d8cfe6";

interface Profile {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  created_at: string;
  bio?: string | null;
  favorite_book_ids?: number[] | null;
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="font-medium text-[#c9a227]">
      {"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))}
      {" "}{rating.toFixed(1).replace(".", ",")}
    </span>
  );
}

export default function MembrePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const memberId = params.id as string;
  const isOwn = user?.id === memberId;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [favoriteBooks, setFavoriteBooks] = useState<Book[]>([]);
  const [sessionPhotos, setSessionPhotos] = useState<{ url: string; date: string; bookTitle: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addTarget, setAddTarget] = useState<Book | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [championDays, setChampionDays] = useState(0);
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  useEffect(() => {
    const load = async () => {
      type LogRow = { user_id: string; pages_read: number; date: string };
      const [{ data: prof }, { data: bs }, { data: ls }, { data: allLogs }, { data: logsWithPhotos }] =
        await Promise.all([
          supabase.from("user_profiles").select("*").eq("id", memberId).single(),
          supabase.from("books").select("*").eq("user_id", memberId),
          supabase.from("reading_logs").select("*").eq("user_id", memberId),
          supabase.from("reading_logs").select("user_id, pages_read, date"),
          supabase
            .from("reading_logs")
            .select("session_photo_url, date, book_id")
            .eq("user_id", memberId)
            .not("session_photo_url", "is", null)
            .order("date", { ascending: false })
            .limit(12),
        ]);

      const profileData = prof as Profile;
      setProfile(profileData);
      const booksData = (bs as Book[]) || [];
      setBooks(booksData);
      setLogs((ls as ReadingLog[]) || []);

      // Favoris
      const favIds = (profileData?.favorite_book_ids ?? []).filter(Boolean);
      if (favIds.length > 0) {
        const { data: favData } = await supabase
          .from("books")
          .select("id, title, author, cover_url, rating")
          .in("id", favIds);
        const orderedFavs = favIds
          .map((id) => (favData as Book[])?.find((b) => b.id === id))
          .filter(Boolean) as Book[];
        setFavoriteBooks(orderedFavs);
      }

      // Photos de session
      type PhotoRow = { session_photo_url: string | null; date: string; book_id: number };
      const photosRaw = (logsWithPhotos as PhotoRow[]) || [];
      const bookMap = new Map(booksData.map((b) => [b.id, b.title]));
      setSessionPhotos(
        photosRaw
          .filter((r) => r.session_photo_url)
          .map((r) => ({
            url: r.session_photo_url!,
            date: r.date,
            bookTitle: bookMap.get(r.book_id) ?? "",
          }))
      );

      // Champion du jour
      const rows = (allLogs as LogRow[]) || [];
      const dateMap = new Map<string, Map<string, number>>();
      rows.forEach(({ date, user_id, pages_read }) => {
        if (!dateMap.has(date)) dateMap.set(date, new Map());
        const m = dateMap.get(date)!;
        m.set(user_id, (m.get(user_id) || 0) + pages_read);
      });
      let count = 0;
      for (const userMap of dateMap.values()) {
        const maxPages = Math.max(...userMap.values());
        if (maxPages > 0 && (userMap.get(memberId) || 0) >= maxPages) count++;
      }
      setChampionDays(count);

      setLoading(false);
    };
    load();
  }, [memberId]);

  if (loading) {
    return (
      <div className="py-24 text-center text-xs font-medium uppercase tracking-wider text-muted">
        Chargement…
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="py-24 text-center">
        <p className="font-serif text-lg text-ink">Profil introuvable.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-sm font-medium text-violet-deep"
        >
          ← Retour
        </button>
      </div>
    );
  }

  const completed = books.filter(isCompleted);
  const reading = books.filter((b) => b.status === "reading");
  const abandoned = books.filter((b) => b.status === "abandoned");

  // Recency key : date du dernier log (activité réelle) > date_read > created_at
  // Cela évite que les imports Goodreads de 2021 remontent devant des lectures de cette semaine
  const lastLogByBook = new Map<number, string>();
  logs.forEach((l) => {
    const existing = lastLogByBook.get(l.book_id);
    if (!existing || l.date > existing) lastLogByBook.set(l.book_id, l.date);
  });
  const recencyKey = (b: Book): string =>
    lastLogByBook.get(b.id) || b.date_read || b.created_at || "";

  // Lecture en cours la plus récemment loggée
  const currentReading = reading.slice().sort(
    (a, b) => recencyKey(b).localeCompare(recencyKey(a))
  )[0] ?? null;

  // 3 derniers terminés : exclure les imports sans date_read ET sans log
  // (livres Goodreads marqués "lus" avec date inconnue → pas d'activité concrète)
  const last3Completed = [...completed]
    .filter((b) => lastLogByBook.has(b.id) || !!b.date_read)
    .sort((a, b) => recencyKey(b).localeCompare(recencyKey(a)))
    .slice(0, 3);
  const ratedBooks = completed.filter((b) => (b.rating || 0) > 0);
  const avgRating =
    ratedBooks.length > 0
      ? ratedBooks.reduce((s, b) => s + (b.rating || 0), 0) / ratedBooks.length
      : null;
  const totalPages = logs.reduce((s, l) => s + (l.pages_read || 0), 0);

  const ratingCounts = Array(10).fill(0);
  let ratingSum = 0;
  let ratedCount = 0;
  completed.forEach((b) => {
    const r = b.rating || 0;
    if (r > 0) {
      const bucket = Math.min(9, Math.max(0, Math.round(r * 2) - 1));
      ratingCounts[bucket] += 1;
      ratingSum += r;
      ratedCount += 1;
    }
  });
  const ratingAvg = ratedCount > 0 ? ratingSum / ratedCount : 0;

  const now = new Date();
  const pagesByMonth = Array(12).fill(0);
  logs.forEach((l) => {
    const d = new Date(l.date);
    if (d.getFullYear() === now.getFullYear()) {
      pagesByMonth[d.getMonth()] += l.pages_read || 0;
    }
  });
  const chartData = pagesByMonth.map((v, i) => ({ name: MONTHS[i], value: v }));

  const memberSince = new Date(profile.created_at).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="animate-fadeIn flex flex-col gap-6 pt-4">
      {/* Retour */}
      <button
        onClick={() => router.back()}
        className="flex w-fit items-center gap-1 text-xs font-medium text-muted"
      >
        ← Membres
      </button>

      {/* En-tête profil */}
      <div className="flex items-center gap-4 rounded-2xl bg-violet-soft px-5 py-6">
        <AvatarImg url={profile.avatar_url} name={profile.display_name} className="h-16 w-16 text-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl font-black text-ink">{profile.display_name}</h1>
            {isOwn && (
              <Link
                href="/compte"
                className="rounded-lg border border-line bg-card px-2 py-0.5 text-[11px] font-medium text-muted"
              >
                Modifier
              </Link>
            )}
          </div>
          <p className="mt-0.5 text-xs font-medium text-muted">Membre depuis {memberSince}</p>
          {profile.bio && (
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2" style={{ whiteSpace: "pre-line" }}>{profile.bio}</p>
          )}
        </div>
      </div>

      {/* Chips stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip value={String(completed.length)} label="Livres terminés" />
        <StatChip value={(totalPages).toLocaleString("fr-FR")} label="Pages lues" />
        <StatChip value={reading.length > 0 ? String(reading.length) : "—"} label="En cours" />
        <StatChip
          value={avgRating != null ? avgRating.toFixed(1).replace(".", ",") + " ★" : "—"}
          label="Note moy."
        />
      </div>

      {/* Top 4 Favoris (style Letterboxd) — juste après les indicateurs */}
      {favoriteBooks.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="font-serif text-[15px] font-medium text-ink">
            Livres favoris{" "}
            <span className="font-sans text-xs font-normal text-muted">({favoriteBooks.length})</span>
          </h2>
          <div className="grid grid-cols-4 gap-2.5">
            {favoriteBooks.map((b) => (
              <Link key={b.id} href={`/livre/${b.id}`} className="group flex w-full flex-col items-center gap-1.5">
                <div className="relative w-full overflow-hidden rounded-xl shadow-sm transition-transform group-hover:scale-105">
                  <Cover
                    id={b.id}
                    title={b.title}
                    coverUrl={b.cover_url}
                    className="aspect-[3/4] w-full"
                    rounded="rounded-xl"
                  />
                  {(b.rating || 0) > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/70 to-transparent px-1.5 pb-1.5 pt-4">
                      <p className="text-[9px] font-bold text-cream">★ {b.rating!.toFixed(1)}</p>
                    </div>
                  )}
                </div>
                <p className="max-w-full truncate text-center text-[9.5px] font-medium text-muted">
                  {b.title}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Mise en avant lectures : en cours + derniers lus */}
      {(currentReading || last3Completed.length > 0) && (
        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-[15px] font-medium text-ink">Activités récentes</h2>
          <div className="grid grid-cols-4 gap-2">
            {/* En cours (col 1 — plus large) */}
            <div className="col-span-1">
              {currentReading ? (
                <Link href={`/livre/${currentReading.id}`} className="group flex h-full flex-col gap-1.5">
                  <div className="relative overflow-hidden rounded-xl shadow-sm transition-transform group-hover:scale-[1.03]">
                    <Cover
                      id={currentReading.id}
                      title={currentReading.title}
                      coverUrl={currentReading.cover_url}
                      className="aspect-[3/4] w-full"
                      rounded="rounded-xl"
                    />
                    <div className="absolute inset-x-0 bottom-0 rounded-b-xl bg-gradient-to-t from-ink/70 to-transparent px-2 pb-2 pt-6">
                      <div className="h-1 overflow-hidden rounded-full bg-white/30">
                        <div className="h-full rounded-full bg-cream" style={{ width: `${pct(currentReading)}%` }} />
                      </div>
                      <p className="mt-0.5 text-[9px] font-semibold text-cream">{pct(currentReading)}%</p>
                    </div>
                  </div>
                  <p className="line-clamp-2 text-center text-[9px] font-medium text-muted">{currentReading.title}</p>
                </Link>
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center rounded-xl border border-dashed border-line bg-card">
                  <span className="text-[9px] text-muted">En cours</span>
                </div>
              )}
            </div>

            {/* 3 derniers terminés */}
            {[0, 1, 2].map((i) => {
              const b = last3Completed[i];
              return b ? (
                <Link key={b.id} href={`/livre/${b.id}`} className="group flex flex-col gap-1.5">
                  <div className="relative overflow-hidden rounded-xl shadow-sm transition-transform group-hover:scale-[1.03]">
                    <Cover
                      id={b.id}
                      title={b.title}
                      coverUrl={b.cover_url}
                      className="aspect-[3/4] w-full"
                      rounded="rounded-xl"
                    />
                    {(b.rating || 0) > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/70 to-transparent px-1.5 pb-1.5 pt-4">
                        <p className="text-[9px] font-bold text-cream">★ {b.rating!.toFixed(1)}</p>
                      </div>
                    )}
                  </div>
                  <p className="line-clamp-2 text-center text-[9px] font-medium text-muted">{b.title}</p>
                </Link>
              ) : (
                <div key={i} className="flex aspect-[3/4] items-center justify-center rounded-xl border border-dashed border-line bg-card">
                  <span className="text-[9px] text-muted">—</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted">
            <span className="font-medium text-ink-2">En cours</span> · <span className="font-medium text-ink-2">3 derniers terminés</span>
          </p>
        </section>
      )}

      {/* Trophée Champion du jour */}
      {championDays > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-[#fdf7e9] p-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-xl">
            🏆
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink">
              {isOwn ? "Tes trophées Champion du jour" : "Trophées Champion du jour"}
            </p>
            <p className="text-[11px] text-muted">Jours où {isOwn ? "tu as" : profile.display_name + " a"} lu le plus de pages</p>
          </div>
          <div className="text-right">
            <p className="font-serif text-2xl font-black text-[#b8890a]">{championDays}</p>
            <p className="text-[10.5px] font-medium text-muted">{championDays > 1 ? "jours" : "jour"}</p>
          </div>
        </div>
      )}

      {/* Lectures en cours */}
      {reading.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-medium text-ink">
              En cours de lecture{" "}
              <span className="font-sans text-sm font-normal text-muted">({reading.length})</span>
            </h2>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {reading.map((b) => (
              <div key={b.id} className="flex flex-col gap-1.5">
                <Link
                  href={`/livre/${b.id}`}
                  className="flex h-[96px] items-center gap-3.5 overflow-hidden rounded-2xl border border-line bg-card p-3.5 transition-colors hover:border-violet/40"
                >
                  <Cover id={b.id} title={b.title} coverUrl={b.cover_url} className="h-[70px] w-[48px] shrink-0" rounded="rounded-md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-[13.5px] font-medium text-ink">{b.title}</p>
                    <p className="truncate text-[11px] text-muted">{b.author}</p>
                    <div className="mt-2">
                      <ProgressBar value={pct(b) / 100} />
                      <p className="mt-0.5 text-[10px] font-medium text-muted">{pct(b)}%</p>
                    </div>
                  </div>
                </Link>
                {!isOwn && (
                  <button
                    onClick={() => setAddTarget(b)}
                    className="flex w-full items-center justify-center gap-1 rounded-xl border border-violet/30 bg-violet-soft py-1.5 text-[11px] font-semibold text-violet-deep"
                  >
                    + Ajouter à mes lectures
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Livres terminés */}
      {completed.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-medium text-ink">
              Livres terminés{" "}
              <span className="font-sans text-sm font-normal text-muted">({completed.length})</span>
            </h2>
          </div>

          {/* Mode compact : 1 livre affiché */}
          {!showAllCompleted ? (
            <>
              {completed
                .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                .slice(0, 1)
                .map((b) => (
                  <div key={b.id} className="flex flex-col gap-1.5">
                    <Link
                      href={`/livre/${b.id}`}
                      className="flex h-[96px] items-center gap-3.5 overflow-hidden rounded-2xl border border-line bg-card p-3.5 transition-colors hover:border-violet/40"
                    >
                      <Cover id={b.id} title={b.title} coverUrl={b.cover_url} className="h-[70px] w-[48px] shrink-0" rounded="rounded-md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-serif text-[13.5px] font-medium text-ink">{b.title}</p>
                        <p className="truncate text-[11px] text-muted">{b.author}</p>
                        {(b.rating || 0) > 0 ? (
                          <p className="mt-1.5 text-[11px] font-medium text-gold">
                            {"★".repeat(Math.round(b.rating!))} {b.rating!.toFixed(1).replace(".", ",")}
                          </p>
                        ) : (
                          <p className="mt-1.5 text-[10px] font-medium text-success">✓ Terminé</p>
                        )}
                      </div>
                    </Link>
                    {!isOwn && (
                      <button
                        onClick={() => setAddTarget(b)}
                        className="flex w-full items-center justify-center gap-1 rounded-xl border border-violet/30 bg-violet-soft py-1.5 text-[11px] font-semibold text-violet-deep"
                      >
                        + Ajouter à mes lectures
                      </button>
                    )}
                  </div>
                ))}
              {completed.length > 1 && (
                <button
                  onClick={() => setShowAllCompleted(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet py-3 text-[13px] font-semibold text-cream transition-colors hover:opacity-90 active:opacity-80"
                >
                  Voir toute la bibliothèque · {completed.length} livres
                </button>
              )}
            </>
          ) : (
            /* Mode étendu : tous les livres */
            <>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {completed
                  .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                  .map((b) => (
                    <div key={b.id} className="flex flex-col gap-1.5">
                      <Link
                        href={`/livre/${b.id}`}
                        className="flex h-[96px] items-center gap-3.5 overflow-hidden rounded-2xl border border-line bg-card p-3.5 transition-colors hover:border-violet/40"
                      >
                        <Cover id={b.id} title={b.title} coverUrl={b.cover_url} className="h-[70px] w-[48px] shrink-0" rounded="rounded-md" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-serif text-[13.5px] font-medium text-ink">{b.title}</p>
                          <p className="truncate text-[11px] text-muted">{b.author}</p>
                          {(b.rating || 0) > 0 ? (
                            <p className="mt-1.5 text-[11px] font-medium text-gold">
                              {"★".repeat(Math.round(b.rating!))} {b.rating!.toFixed(1).replace(".", ",")}
                            </p>
                          ) : (
                            <p className="mt-1.5 text-[10px] font-medium text-success">✓ Terminé</p>
                          )}
                        </div>
                      </Link>
                      {!isOwn && (
                        <button
                          onClick={() => setAddTarget(b)}
                          className="flex w-full items-center justify-center gap-1 rounded-xl border border-violet/30 bg-violet-soft py-1.5 text-[11px] font-semibold text-violet-deep"
                        >
                          + Ajouter à mes lectures
                        </button>
                      )}
                    </div>
                  ))}
              </div>
              <button
                onClick={() => setShowAllCompleted(false)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-card py-2.5 text-[12px] font-medium text-muted hover:border-violet/40 hover:text-violet-deep"
              >
                Réduire ↑
              </button>
            </>
          )}
        </section>
      )}

      {/* Livres abandonnés */}
      {abandoned.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-medium text-ink">
              Abandonnés{" "}
              <span className="font-sans text-sm font-normal text-muted">({abandoned.length})</span>
            </h2>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {abandoned.map((b) => (
              <Link
                key={b.id}
                href={`/livre/${b.id}`}
                className="flex h-[96px] items-center gap-3.5 overflow-hidden rounded-2xl border border-line bg-card p-3.5 opacity-70 transition-colors hover:border-line hover:opacity-90"
              >
                <Cover id={b.id} title={b.title} coverUrl={b.cover_url} className="h-[70px] w-[48px] shrink-0 grayscale" rounded="rounded-md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-[13.5px] font-medium text-ink">{b.title}</p>
                  <p className="truncate text-[11px] text-muted">{b.author}</p>
                  <span className="mt-1.5 inline-block rounded-md bg-paper px-2 py-0.5 text-[10.5px] font-medium text-muted">
                    Abandonné
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Galerie de photos de sessions */}
      {sessionPhotos.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-lg font-medium text-ink">Galerie</h2>
          <div className="grid grid-cols-3 gap-2">
            {sessionPhotos.map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className="group relative overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.bookTitle}
                  className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                  onError={(e) => ((e.target as HTMLImageElement).parentElement!.style.display = "none")}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink/60 to-transparent px-2 pb-1.5 pt-4 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="truncate text-[9px] font-semibold text-cream">{p.bookTitle}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Histogramme des notes */}
      {ratedCount > 0 && (
        <RatingsChart counts={ratingCounts} average={ratingAvg} total={ratedCount} />
      )}

      {/* Graphique pages / mois */}
      {totalPages > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-lg font-medium text-ink">Pages lues en {now.getFullYear()}</h2>
          <ObjectiveChart
            title=""
            type="area"
            data={chartData}
            objective={null}
            unit="p."
            color={VIOLET}
            lightColor={VIOLET_LT}
            currentMonth={now.getMonth()}
          />
        </section>
      )}

      {completed.length === 0 && reading.length === 0 && abandoned.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-card p-10 text-center">
          <p className="font-serif text-base text-ink">Aucun livre pour le moment.</p>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[70] -translate-x-1/2 rounded-2xl bg-ink px-4 py-2.5 text-sm font-medium text-cream shadow-xl">
          {toast}
        </div>
      )}

      <AddToLibraryModal
        open={addTarget !== null}
        onClose={() => setAddTarget(null)}
        book={addTarget}
        onAdded={(msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); }}
      />
    </div>
  );
}

function StatChip({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-2xl border border-line bg-card px-3 py-3.5 text-center">
      <span className="font-serif text-xl font-bold text-ink">{value}</span>
      <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted">{label}</span>
    </div>
  );
}
