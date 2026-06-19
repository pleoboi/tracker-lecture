"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";
import type { Book, ReadingLog } from "../../../lib/types";
import { pct } from "../../../lib/books";
import { Cover, ProgressBar } from "../../../components/ui";
import { ObjectiveChart } from "../../../components/DashboardWidgets";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const VIOLET = "var(--color-violet)";
const VIOLET_LT = "#d8cfe6";

interface Profile {
  id: string;
  display_name: string;
  created_at: string;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ data: prof }, { data: bs }, { data: ls }] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("id", memberId).single(),
        supabase.from("books").select("*").eq("user_id", memberId),
        supabase.from("reading_logs").select("*").eq("user_id", memberId),
      ]);
      setProfile(prof as Profile);
      setBooks((bs as Book[]) || []);
      setLogs((ls as ReadingLog[]) || []);
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

  const completed = books.filter((b) => b.status === "completed");
  const reading = books.filter((b) => b.status === "reading");
  const ratedBooks = completed.filter((b) => (b.rating || 0) > 0);
  const avgRating =
    ratedBooks.length > 0
      ? ratedBooks.reduce((s, b) => s + (b.rating || 0), 0) / ratedBooks.length
      : null;
  const totalPages = logs.reduce((s, l) => s + (l.pages_read || 0), 0);

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

  const initial = profile.display_name[0]?.toUpperCase() ?? "?";

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
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-violet font-serif text-2xl font-semibold text-cream">
          {initial}
        </span>
        <div>
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

      {/* Lectures en cours */}
      {reading.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-lg font-medium text-ink">En cours de lecture</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {reading.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3"
              >
                <Cover
                  id={b.id}
                  title={b.title}
                  coverUrl={b.cover_url}
                  className="h-[72px] w-[50px] shrink-0"
                  rounded="rounded-md"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-[14px] font-medium text-ink">{b.title}</p>
                  <p className="truncate text-[11px] text-muted">{b.author}</p>
                  <div className="mt-2">
                    <ProgressBar value={pct(b) / 100} />
                    <p className="mt-1 text-[10.5px] font-medium text-muted">{pct(b)}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Livres terminés */}
      {completed.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-lg font-medium text-ink">
            Livres terminés{" "}
            <span className="font-sans text-sm font-normal text-muted">({completed.length})</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {completed
              .sort((a, b) => (b.rating || 0) - (a.rating || 0))
              .map((b) => (
                <div
                  key={b.id}
                  className="flex items-start gap-3 rounded-2xl border border-line bg-card p-3"
                >
                  <Cover
                    id={b.id}
                    title={b.title}
                    coverUrl={b.cover_url}
                    className="h-[84px] w-[58px] shrink-0"
                    rounded="rounded-md"
                  />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="truncate font-serif text-[14px] font-medium text-ink">{b.title}</p>
                    <p className="truncate text-[11px] text-muted">{b.author}</p>
                    {(b.rating || 0) > 0 && (
                      <p className="mt-1.5 text-xs">
                        <StarDisplay rating={b.rating!} />
                      </p>
                    )}
                    {b.genre && (
                      <span className="mt-1.5 inline-block rounded-md bg-violet-soft px-2 py-0.5 text-[10.5px] font-medium text-violet-deep">
                        {b.genre}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </section>
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

      {completed.length === 0 && reading.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-card p-10 text-center">
          <p className="font-serif text-base text-ink">Aucun livre pour le moment.</p>
        </div>
      )}
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
