"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import type { Book } from "../../../../lib/types";
import { isCompleted } from "../../../../lib/books";
import { Cover } from "../../../../components/ui";
import MemberSectionHeader from "../../../../components/MemberSectionHeader";

export default function MemberReviewsPage() {
  const params = useParams();
  const memberId = params.id as string;

  const [firstName, setFirstName] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: prof }, { data: bs }] = await Promise.all([
        supabase.from("user_profiles").select("display_name").eq("id", memberId).single(),
        supabase.from("books").select("*").eq("user_id", memberId),
      ]);
      setFirstName(((prof as { display_name?: string } | null)?.display_name ?? "").split(" ")[0]);
      setBooks((bs as Book[]) || []);
      setLoading(false);
    })();
  }, [memberId]);

  const reviewedBooks = books
    .filter(isCompleted)
    .filter((b) => !!b.notes?.trim())
    .sort((a, b) => (b.date_read ?? "").localeCompare(a.date_read ?? ""));

  return (
    <div className="animate-fadeIn flex flex-col gap-5 pt-4">
      <MemberSectionHeader memberId={memberId} firstName={firstName} title="Reviews" />

      {loading ? (
        <div className="py-24 text-center text-xs font-medium uppercase tracking-wider text-muted">Chargement…</div>
      ) : reviewedBooks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
          <p className="font-serif text-base text-ink">Aucune review pour le moment.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {reviewedBooks.map((b) => (
            <div key={b.id} className="flex gap-3 border-b border-line pb-4 last:border-0">
              <Link href={`/livre/${b.id}`} className="shrink-0">
                <Cover id={b.id} title={b.title} coverUrl={b.cover_url} className="h-24 w-16" rounded="rounded-lg" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/livre/${b.id}`}>
                  <p className="font-serif text-[15px] font-semibold leading-tight text-ink">
                    {b.title}{" "}
                    {b.published_year && <span className="font-sans text-[12px] font-normal text-muted">{b.published_year}</span>}
                  </p>
                  <p className="text-[12px] text-muted">{b.author}</p>
                </Link>
                {!!b.rating && (
                  <p className="mt-1 text-[13px] font-bold text-gold">{"★".repeat(Math.round(b.rating))}</p>
                )}
                <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-ink-2">{b.notes}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
