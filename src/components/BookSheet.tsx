"use client";

import Link from "next/link";
import type { Book } from "../lib/types";
import { Modal } from "./ui";

/**
 * Cadre des blocs de statistiques : une feuille encadrée posée sur deux autres
 * (pile de pages), l'équivalent « livre » du cadre BD des stats manga.
 */
export const BOOK_PANEL =
  "rounded-xl border border-ink/70 bg-card shadow-[4px_4px_0_-1px_var(--color-card),4px_4px_0_0_color-mix(in_srgb,var(--color-ink)_28%,transparent),8px_8px_0_-1px_var(--color-card),8px_8px_0_0_color-mix(in_srgb,var(--color-ink)_14%,transparent)]";

export type SheetState = { title: string; books: Book[] } | null;
export type PickFn = (title: string, books: Book[]) => void;

const fr = (n: number) => n.toLocaleString("fr-FR").replace(/\s/g, " ");

/** Fenêtre (feuille du bas sur mobile) listant les livres derrière une statistique. */
export default function BookSheet({ sheet, onClose, linkable }: { sheet: SheetState; onClose: () => void; linkable: boolean }) {
  const list = sheet ? [...sheet.books].sort((a, b) => (b.date_read ?? "").localeCompare(a.date_read ?? "")) : [];
  const pages = list.reduce((s, b) => s + (b.pages || 0), 0);
  return (
    <Modal open={!!sheet} onClose={onClose} title={sheet?.title ?? ""}>
      <p className="mb-3 text-[12.5px] text-muted">
        {list.length} livre{list.length > 1 ? "s" : ""}{pages > 0 ? ` · ${fr(pages)} pages` : ""}
      </p>
      <ul className="flex flex-col divide-y divide-line">
        {list.map((b) => {
          const row = (
            <div className="flex items-center gap-3 py-2.5">
              {b.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.cover_url} alt={b.title} className="h-[54px] w-[36px] shrink-0 rounded object-cover shadow" />
              ) : (
                <div className="flex h-[54px] w-[36px] shrink-0 items-center justify-center rounded bg-violet-soft p-1 text-center text-[7px] leading-tight text-muted">{b.title.slice(0, 14)}</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink">{b.title}</p>
                <p className="truncate text-[12px] text-muted">
                  {b.author}{b.pages ? ` · ${b.pages} p.` : ""}{b.published_year ? ` · ${b.published_year}` : ""}
                </p>
              </div>
              {(b.rating ?? 0) > 0 && <span className="shrink-0 text-[13px] font-bold text-gold">{(b.rating ?? 0).toFixed(1).replace(".", ",")}</span>}
            </div>
          );
          return <li key={b.id}>{linkable ? <Link href={`/livre/${b.id}`} onClick={onClose}>{row}</Link> : row}</li>;
        })}
      </ul>
    </Modal>
  );
}
