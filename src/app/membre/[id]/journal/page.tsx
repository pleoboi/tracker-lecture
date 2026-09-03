"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import type { Book, ReadingLog } from "../../../../lib/types";
import { Cover } from "../../../../components/ui";
import MemberSectionHeader from "../../../../components/MemberSectionHeader";

export default function MemberJournalPage() {
  const params = useParams();
  const memberId = params.id as string;

  const [firstName, setFirstName] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: prof }, { data: bs }, { data: ls }] = await Promise.all([
        supabase.from("user_profiles").select("display_name").eq("id", memberId).single(),
        supabase.from("books").select("*").eq("user_id", memberId),
        supabase.from("reading_logs").select("*").eq("user_id", memberId),
      ]);
      setFirstName(((prof as { display_name?: string } | null)?.display_name ?? "").split(" ")[0]);
      setBooks((bs as Book[]) || []);
      setLogs((ls as ReadingLog[]) || []);
      setLoading(false);
    })();
  }, [memberId]);

  const bookById = new Map(books.map((b) => [b.id, b]));

  return (
    <div className="animate-fadeIn flex flex-col gap-5 pt-4">
      <MemberSectionHeader memberId={memberId} firstName={firstName} title="Journal" />

      {loading ? (
        <div className="py-24 text-center text-xs font-medium uppercase tracking-wider text-muted">Chargement…</div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
          <p className="font-serif text-base text-ink">Aucune session enregistrée.</p>
        </div>
      ) : (
        (() => {
          const byDate = new Map<string, ReadingLog[]>();
          [...logs].sort((a, b) => b.date.localeCompare(a.date)).forEach((l) => {
            if (!byDate.has(l.date)) byDate.set(l.date, []);
            byDate.get(l.date)!.push(l);
          });
          return [...byDate.entries()].map(([date, dayLogs]) => (
            <div key={date} className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <div className="flex flex-col gap-2">
                {dayLogs.map((l) => {
                  const b = bookById.get(l.book_id);
                  if (!b) return null;
                  return (
                    <Link
                      key={l.id}
                      href={`/livre/${b.id}`}
                      className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 transition-colors hover:border-violet/40"
                    >
                      <Cover id={b.id} title={b.title} coverUrl={b.cover_url} className="h-14 w-10 shrink-0" rounded="rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-serif text-[14px] font-semibold text-ink">{b.title}</p>
                        <p className="truncate text-[11px] text-muted">
                          +{l.pages_read} page{l.pages_read > 1 ? "s" : ""}
                          {l.session_notes ? ` · ${l.session_notes}` : ""}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ));
        })()
      )}
    </div>
  );
}
