"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { bookMessage } from "../../lib/chat";

type MiniBook = { id: number; title: string; author: string; cover_url: string | null; status: string; progress: number | null; pages: number | null };

/**
 * Boutons préparés au-dessus de la saisie : recommander un livre, partager sa lecture en cours,
 * ou pré-remplir une question. `onSend` envoie directement, `onPrefill` place le texte dans la saisie.
 */
export default function QuickActions({ me, otherId, onSend, onPrefill }: {
  me?: string;
  otherId: string;
  onSend: (text: string) => Promise<boolean>;
  onPrefill: (text: string) => void;
}) {
  const [picker, setPicker] = useState<null | "reco" | "reading">(null);
  const [books, setBooks] = useState<MiniBook[] | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const openPicker = async (mode: "reco" | "reading") => {
    setPicker(mode);
    setSearch("");
    setBooks(null);
    if (!me) { setBooks([]); return; }
    let q = supabase.from("books").select("id, title, author, cover_url, status, progress, pages").eq("user_id", me);
    q = mode === "reading" ? q.eq("status", "reading") : q.neq("status", "to-read");
    const { data } = await q.order("created_at", { ascending: false }).limit(200);
    setBooks((data ?? []) as MiniBook[]);
  };

  const choose = async (b: MiniBook) => {
    if (busy) return;
    setBusy(true);
    let text: string;
    if (picker === "reco") {
      text = `Je te recommande « ${b.title} »${b.author ? ` de ${b.author}` : ""}.`;
      if (me) {
        // Même trace qu'une recommandation faite depuis le profil (visible dans Communauté)
        await supabase.from("book_recommendations").insert({
          from_user_id: me, to_user_id: otherId, book_title: b.title, book_author: b.author, book_cover: b.cover_url, message: null,
        });
        await supabase.from("notifications").insert({ user_id: otherId, from_user_id: me, type: "book_recommendation", book_title: b.title, message: null });
      }
    } else {
      const where = b.pages && b.progress ? ` (page ${b.progress} sur ${b.pages})` : "";
      text = `Je lis en ce moment « ${b.title} »${b.author ? ` de ${b.author}` : ""}${where}.`;
    }
    const ok = await onSend(bookMessage(b.id, text));
    setBusy(false);
    if (ok) setPicker(null);
  };

  const chips: { label: string; run: () => void }[] = [
    { label: "Recommander un livre", run: () => void openPicker("reco") },
    { label: "Ma lecture en cours", run: () => void openPicker("reading") },
    { label: "Tu lis quoi ?", run: () => onPrefill("Tu lis quoi en ce moment ?") },
    { label: "Lecture commune ?", run: () => onPrefill("Ça te dirait qu'on lise un livre ensemble ? ") },
  ];

  const shown = (books ?? []).filter((b) => !search || `${b.title} ${b.author}`.toLowerCase().includes(search.toLowerCase())).slice(0, 30);

  return (
    <div className="relative">
      {picker && (
        <div className="absolute inset-x-2 bottom-full z-10 mb-1 flex max-h-[300px] flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-xl">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <p className="flex-1 text-[13px] font-bold text-ink">{picker === "reco" ? "Quel livre recommander ?" : "Quelle lecture partager ?"}</p>
            <button onClick={() => setPicker(null)} aria-label="Fermer" className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-card">✕</button>
          </div>
          {picker === "reco" && (books?.length ?? 0) > 6 && (
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher dans ta bibliothèque"
              className="mx-3 mt-2 rounded-xl border border-line bg-input px-3 py-1.5 text-[13px] text-ink outline-none focus:border-violet" />
          )}
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {books === null ? (
              <p className="py-6 text-center text-[12.5px] text-muted">Chargement…</p>
            ) : shown.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12.5px] text-muted">
                {picker === "reading" ? "Aucune lecture en cours pour l'instant." : "Aucun livre trouvé dans ta bibliothèque."}
              </p>
            ) : shown.map((b) => (
              <button key={b.id} disabled={busy} onClick={() => void choose(b)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-card disabled:opacity-50">
                {b.cover_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={b.cover_url} alt="" className="h-10 w-7 shrink-0 rounded object-cover" />
                  : <span className="h-10 w-7 shrink-0 rounded bg-violet-soft" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">{b.title}</span>
                  <span className="block truncate text-[11.5px] text-muted">{b.author}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto px-3 pb-1 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map((c) => (
          <button key={c.label} type="button" onClick={c.run}
            className="shrink-0 rounded-full border border-line bg-card px-3 py-1 text-[12px] font-semibold text-ink-2 transition-colors hover:border-violet hover:text-violet-deep active:scale-95">
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
