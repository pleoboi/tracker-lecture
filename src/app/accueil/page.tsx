"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import type { Book } from "../../lib/types";
import { pct, isCompleted } from "../../lib/books";
import { Cover, ProgressBar, Button } from "../../components/ui";
import LogReadingModal from "../../components/LogReadingModal";
import AddBookModal from "../../components/AddBookModal";

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

const today = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(new Date());

export default function AccueilPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const displayName =
    user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [logBookId, setLogBookId] = useState<number | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data: booksData } = await supabase
      .from("books")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setBooks((booksData as Book[]) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3500);
  };

  const reading = books.filter((b) => !isCompleted(b));

  return (
    <div className="animate-fadeIn flex flex-col gap-6 pt-4">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">{today}</p>
        <h1 className="font-serif text-3xl font-black text-ink">
          {greeting()}{displayName ? `, ${displayName}` : ""}
        </h1>
      </header>

      <div className="flex gap-3">
        <Button
          onClick={() => { setLogBookId(undefined); setShowLog(true); }}
          className="flex-1"
        >
          ✎ Noter ma lecture
        </Button>
        <Button variant="ghost" onClick={() => setShowAdd(true)}>
          ＋ Livre
        </Button>
      </div>

      {toast && (
        <div className="rounded-xl border border-[#cfe0cf] bg-[#eaf1ea] px-4 py-3 text-xs font-semibold text-success">
          {toast}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-xs font-medium uppercase tracking-wider text-muted">
          Chargement…
        </div>
      ) : reading.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
          <p className="font-serif text-lg text-ink">Aucune lecture en cours</p>
          <p className="mt-1 text-sm text-muted">Ajoute ton premier livre pour démarrer.</p>
          <Button onClick={() => setShowAdd(true)} className="mt-4">
            ＋ Ajouter un livre
          </Button>
        </div>
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-medium text-ink">En cours</h2>
            <Link href="/bibliotheque" className="text-xs font-medium text-violet-deep">
              Tout voir
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reading.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        </section>
      )}

      <LogReadingModal
        open={showLog}
        onClose={() => setShowLog(false)}
        books={reading}
        defaultBookId={logBookId}
        onSaved={(m) => { showToast(m); load(); }}
      />
      <AddBookModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={(m) => { showToast(m); load(); }}
      />
    </div>
  );
}

function BookCard({ book }: { book: Book }) {
  const p = pct(book);
  return (
    <Link
      href={`/livre/${book.id}`}
      className="flex items-center gap-3.5 rounded-2xl border border-line bg-card p-3 transition-colors hover:border-violet/50"
    >
      <Cover
        id={book.id}
        title={book.title}
        coverUrl={book.cover_url}
        className="h-[80px] w-[56px] shrink-0"
        rounded="rounded-md"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div>
          <h3 className="truncate font-serif text-[15px] font-medium text-ink">{book.title}</h3>
          <p className="truncate text-[11.5px] text-muted">{book.author}</p>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-ink-2">p. {book.progress} / {book.pages}</span>
          <span className="font-semibold text-violet-deep">{p}%</span>
        </div>
        <ProgressBar value={p / 100} className="h-1.5" />
      </div>
    </Link>
  );
}
