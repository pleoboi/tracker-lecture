"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../../lib/auth-context";
import type { Book, ReadingLog } from "../../../../lib/types";
import { isCompleted } from "../../../../lib/books";
import { ObjectiveChart, RatingsChart } from "../../../../components/DashboardWidgets";
import {
  GenreBreakdown,
  FictionDonut,
  PageCountHistogram,
  AuthorDeepDive,
  CriticalDivergence,
  PublicationTimeline,
} from "../../../../components/AdvancedStats";
import MemberSectionHeader from "../../../../components/MemberSectionHeader";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const VIOLET = "var(--color-violet)";
const VIOLET_LT = "#d8cfe6";

export default function MemberStatistiquesPage() {
  const params = useParams();
  const { user } = useAuth();
  const memberId = params.id as string;
  const isOwn = user?.id === memberId;

  const [firstName, setFirstName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [championDays, setChampionDays] = useState(0);
  const [sessionPhotos, setSessionPhotos] = useState<{ url: string; date: string; bookTitle: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      type LogRow = { user_id: string; pages_read: number; date: string };
      const [{ data: prof }, { data: bs }, { data: ls }, { data: allLogs }, { data: logsWithPhotos }] = await Promise.all([
        supabase.from("user_profiles").select("display_name").eq("id", memberId).single(),
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
      const dn = (prof as { display_name?: string } | null)?.display_name ?? "";
      setDisplayName(dn);
      setFirstName(dn.split(" ")[0]);
      const booksData = (bs as Book[]) || [];
      setBooks(booksData);
      setLogs((ls as ReadingLog[]) || []);

      type PhotoRow = { session_photo_url: string | null; date: string; book_id: number };
      const photosRaw = (logsWithPhotos as PhotoRow[]) || [];
      const bookMap = new Map(booksData.map((b) => [b.id, b.title]));
      setSessionPhotos(
        photosRaw
          .filter((r) => r.session_photo_url)
          .map((r) => ({ url: r.session_photo_url!, date: r.date, bookTitle: bookMap.get(r.book_id) ?? "" }))
      );

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
    })();
  }, [memberId]);

  const completed = books.filter(isCompleted);
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
    if (d.getFullYear() === now.getFullYear()) pagesByMonth[d.getMonth()] += l.pages_read || 0;
  });
  const chartData = pagesByMonth.map((v, i) => ({ name: MONTHS[i], value: v }));

  return (
    <div className="animate-fadeIn flex flex-col gap-5 pt-4">
      <MemberSectionHeader memberId={memberId} firstName={firstName} title="Statistiques" />

      {loading ? (
        <div className="py-24 text-center text-xs font-medium uppercase tracking-wider text-muted">Chargement…</div>
      ) : (
        <>
          {/* Champion du jour */}
          {championDays > 0 && (
            <div
              className="relative overflow-hidden rounded-2xl p-4 shadow-md"
              style={{ background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 55%, #4f46e5 100%)" }}
            >
              <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
              <div className="pointer-events-none absolute -bottom-5 right-10 h-20 w-20 rounded-full bg-white/5" />
              <div className="relative flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fde68a" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                    <path d="M4 22h16" />
                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-white/90">
                    {isOwn ? "Tes trophées Champion du jour" : "Trophées Champion du jour"}
                  </p>
                  <p className="text-[11px] text-white/55">
                    Jours où {isOwn ? "tu as" : displayName + " a"} lu le plus de pages
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-serif text-2xl font-black text-yellow-200">{championDays}</p>
                  <p className="text-[10.5px] font-medium text-white/60">{championDays > 1 ? "jours" : "jour"}</p>
                </div>
              </div>
            </div>
          )}

          {/* Photos de sessions */}
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

          {/* Pages / mois */}
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

          {/* Stats avancées */}
          {completed.length >= 3 && (
            <>
              <GenreBreakdown books={books} />
              <FictionDonut books={books} />
              <PageCountHistogram books={books} />
              <AuthorDeepDive books={books} />
              <CriticalDivergence books={books} />
              <PublicationTimeline books={books} />
            </>
          )}

          {totalPages === 0 && completed.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
              <p className="font-serif text-base text-ink">Pas encore de statistiques.</p>
              <p className="mt-1 text-sm text-muted">Les graphiques apparaissent dès les premières lectures.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
