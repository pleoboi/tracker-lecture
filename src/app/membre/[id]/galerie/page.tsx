"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { maskPrivateSessionsForViewer } from "../../../../lib/privacy";
import MemberSectionHeader from "../../../../components/MemberSectionHeader";
import Lightbox from "../../../../components/Lightbox";

type Photo = { id: number; url: string; date: string; bookTitle: string; note: string | null };

// Toutes les photos prises pendant les sessions de lecture, des plus récentes aux plus anciennes.
export default function MemberGaleriePage() {
  const memberId = useParams().id as string;
  const [firstName, setFirstName] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Photo | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: prof }, { data: logs }] = await Promise.all([
        supabase.from("user_profiles").select("display_name").eq("id", memberId).single(),
        supabase
          .from("reading_logs")
          .select("id, session_photo_url, session_notes, session_private, date, book_id")
          .eq("user_id", memberId)
          .not("session_photo_url", "is", null)
          .order("date", { ascending: false }),
      ]);
      setFirstName(((prof as { display_name?: string } | null)?.display_name ?? "").split(" ")[0]);
      type Row = { id: number; session_photo_url: string | null; session_notes: string | null; session_private?: boolean | null; date: string; book_id: number };
      const rows = (await maskPrivateSessionsForViewer((logs as Row[]) ?? [], memberId)).filter((r) => r.session_photo_url);
      const ids = [...new Set(rows.map((r) => r.book_id))];
      const { data: books } = ids.length ? await supabase.from("books").select("id, title").in("id", ids) : { data: [] };
      const titles = new Map(((books as { id: number; title: string }[]) ?? []).map((b) => [b.id, b.title]));
      setPhotos(rows.map((r) => ({ id: r.id, url: r.session_photo_url!, date: r.date, bookTitle: titles.get(r.book_id) ?? "", note: r.session_notes })));
      setLoading(false);
    })();
  }, [memberId]);

  // Regroupement par mois
  const groups: { label: string; items: Photo[] }[] = [];
  for (const p of photos) {
    const label = new Date(p.date + "T00:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const g = groups[groups.length - 1];
    if (g?.label === label) g.items.push(p);
    else groups.push({ label, items: [p] });
  }

  return (
    <div className="animate-fadeIn flex flex-col gap-5 pt-4">
      <MemberSectionHeader memberId={memberId} firstName={firstName} title="Galerie" />

      {loading ? (
        <div className="py-24 text-center text-xs font-medium uppercase tracking-wider text-muted">Chargement…</div>
      ) : photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
          <p className="font-serif text-base text-ink">Pas encore de photo.</p>
          <p className="mt-1 text-sm text-muted">Les photos ajoutées en notant une lecture apparaissent ici.</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.label} className="flex flex-col gap-2">
            <h2 className="text-[12px] font-bold uppercase tracking-wider text-muted">{g.label}</h2>
            <div className="grid grid-cols-3 gap-1.5">
              {g.items.map((p) => (
                <button key={p.id} onClick={() => setOpen(p)} className="group relative overflow-hidden rounded-xl transition-transform active:scale-95">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.bookTitle} loading="lazy" className="aspect-square w-full object-cover" />
                  {p.bookTitle && (
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4 text-left text-[9.5px] font-semibold text-white">
                      {p.bookTitle}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      <Lightbox src={open?.url ?? null} alt={open?.bookTitle} onClose={() => setOpen(null)} />
    </div>
  );
}
