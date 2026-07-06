"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";

interface TLEvent {
  id: string;
  user_id: string;
  book_id: number | null;
  title: string;
  description: string | null;
  start_year: number;
  end_year: number | null;
  book_title: string | null;
  book_cover_url: string | null;
}

interface PlacedEvent extends TLEvent {
  row: "top" | "bottom";
  cardX: number;
  dotX: number;
}

// ── Layout constants ────────────────────────────────────────────────────────
const CARD_W      = 154;
const CARD_H      = 136;
const SIDE_PAD    = 60;
const MIN_SPACING = CARD_W + 14;
const TOP_START   = 10;
const AXIS_Y      = TOP_START + CARD_H + 16;   // 162
const BOT_START   = AXIS_Y + 2 + 18;           // 182
const TICK_Y      = BOT_START + CARD_H + 8;    // 326
const INNER_H     = TICK_Y + 32;               // 358
const CONTAINER_H = INNER_H + 10;              // 368

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtYear(y: number): string {
  return y < 0 ? `${Math.abs(y)} av. J.-C.` : `${y}`;
}
function fmtPeriod(start: number, end: number | null): string {
  return end != null ? `${fmtYear(start)} — ${fmtYear(end)}` : fmtYear(start);
}
function bestTickInterval(range: number): number {
  if (range <= 50) return 5;
  if (range <= 200) return 25;
  if (range <= 500) return 50;
  if (range <= 1000) return 100;
  if (range <= 3000) return 250;
  if (range <= 5000) return 500;
  return 1000;
}

function placeEvents(events: TLEvent[], minYearDisplay: number, scale: number): PlacedEvent[] {
  const sorted = [...events].sort((a, b) => a.start_year - b.start_year);
  let lastTopX = SIDE_PAD - MIN_SPACING;
  let lastBotX = SIDE_PAD - MIN_SPACING;

  return sorted.map((ev, i) => {
    const row: "top" | "bottom" = i % 2 === 0 ? "top" : "bottom";
    const lastX = row === "top" ? lastTopX : lastBotX;
    const dotX  = (ev.start_year - minYearDisplay) * scale + SIDE_PAD;
    const cardX = Math.max(dotX, lastX + MIN_SPACING);

    if (row === "top") lastTopX = cardX;
    else               lastBotX = cardX;

    return { ...ev, row, cardX, dotX };
  });
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function FrisePage() {
  const { user, loading: authLoading } = useAuth();
  const [events,      setEvents]      = useState<TLEvent[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showAdd,     setShowAdd]     = useState(false);
  const [myBooks,     setMyBooks]     = useState<{ id: number; title: string; cover_url: string | null }[]>([]);
  const [booksLoaded, setBooksLoaded] = useState(false);
  const [tlTitle,     setTlTitle]     = useState("");
  const [tlStart,     setTlStart]     = useState("");
  const [tlEnd,       setTlEnd]       = useState("");
  const [tlDesc,      setTlDesc]      = useState("");
  const [tlBookId,    setTlBookId]    = useState("");
  const [saving,      setSaving]      = useState(false);
  const [detail,      setDetail]      = useState<PlacedEvent | null>(null);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [hoveredId,   setHoveredId]   = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const userId = user?.id;

  const loadEvents = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    // No user_id filter — RLS returns own events + shared book events
    const { data } = await supabase
      .from("user_timeline_events")
      .select("id, user_id, book_id, title, description, start_year, end_year, book_title, book_cover_url")
      .order("start_year", { ascending: true });

    const rows = (data ?? []) as TLEvent[];

    // Fallback : pour les events sans snapshot (avant migration v20), on récupère la couverture depuis books
    const ownMissing = rows.filter((r) => r.user_id === userId && r.book_id && !r.book_cover_url);
    if (ownMissing.length > 0) {
      const ids = ownMissing.map((r) => r.book_id!);
      const { data: bkData } = await supabase.from("books").select("id, title, cover_url").in("id", ids);
      const bkMap = new Map((bkData ?? []).map((b) => [b.id, b as { id: number; title: string; cover_url: string | null }]));
      setEvents(rows.map((r) => {
        if (r.user_id === userId && r.book_id && !r.book_cover_url) {
          const bk = bkMap.get(r.book_id);
          if (bk) return { ...r, book_title: r.book_title ?? bk.title, book_cover_url: bk.cover_url };
        }
        return r;
      }));
    } else {
      setEvents(rows);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { if (userId) loadEvents(); }, [userId, loadEvents]);

  // Block ALL touchmove on document when modal open (only working iOS fix)
  useEffect(() => {
    const open = detail !== null || showAdd;
    if (!open) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => document.removeEventListener("touchmove", prevent);
  }, [detail, showAdd]);

  const openAdd = async () => {
    setShowAdd(true);
    if (!booksLoaded && userId) {
      const { data } = await supabase
        .from("books")
        .select("id, title, cover_url")
        .eq("user_id", userId)
        .order("title");
      setMyBooks((data ?? []) as { id: number; title: string; cover_url: string | null }[]);
      setBooksLoaded(true);
    }
  };

  const handleAdd = async () => {
    if (!userId) return;
    const startNum = parseInt(tlStart, 10);
    if (!tlTitle.trim() || isNaN(startNum)) return;
    setSaving(true);
    const selectedBook = tlBookId ? myBooks.find((b) => b.id === parseInt(tlBookId, 10)) : null;
    await supabase.from("user_timeline_events").insert({
      user_id:       userId,
      title:         tlTitle.trim(),
      description:   tlDesc.trim() || null,
      start_year:    startNum,
      end_year:      tlEnd.trim() ? parseInt(tlEnd, 10) : null,
      book_id:       selectedBook?.id ?? null,
      book_title:    selectedBook?.title ?? null,
      book_cover_url: selectedBook?.cover_url ?? null,
    });
    setSaving(false);
    setTlTitle(""); setTlStart(""); setTlEnd(""); setTlDesc(""); setTlBookId("");
    setShowAdd(false);
    loadEvents();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await supabase.from("user_timeline_events").delete().eq("id", id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setDetail(null);
    setDeletingId(null);
  };

  // ── Header ──────────────────────────────────────────────────────────────────
  const header = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Link
          href="/compte"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-card text-[13px] text-muted transition-colors hover:border-violet/40 hover:text-ink"
        >
          ←
        </Link>
        <h1 className="font-serif text-xl font-semibold text-ink">Ma Frise Historique</h1>
      </div>
      <button
        onClick={openAdd}
        className="flex items-center gap-1.5 rounded-full bg-violet px-4 py-2 text-[12px] font-semibold text-cream"
      >
        + Ajouter
      </button>
    </div>
  );

  if (authLoading || loading) {
    return (
      <div className="py-24 text-center text-xs font-medium uppercase tracking-wider text-muted">
        Chargement…
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="animate-fadeIn flex flex-col gap-5 pt-4">
        {header}
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <p className="text-3xl">🗓️</p>
          <p className="font-serif text-lg font-semibold text-ink">Aucun repère historique</p>
          <p className="text-center text-[13px] text-muted">
            Commence par ajouter un événement lié à tes lectures.
          </p>
          <button
            onClick={openAdd}
            className="mt-2 rounded-2xl bg-violet px-6 py-3 text-[13px] font-semibold text-cream"
          >
            Créer mon premier repère
          </button>
        </div>
        {showAdd && <AddModal {...{ saving, tlTitle, setTlTitle, tlStart, setTlStart, tlEnd, setTlEnd, tlDesc, setTlDesc, tlBookId, setTlBookId, myBooks, onAdd: handleAdd, onClose: () => !saving && setShowAdd(false) }} />}
      </div>
    );
  }

  // ── Layout computations ─────────────────────────────────────────────────────
  const minYear = Math.min(...events.map((e) => e.start_year));
  const maxYear = Math.max(...events.map((e) => e.end_year ?? e.start_year));
  const range = Math.max(1, maxYear - minYear);
  const pad = Math.max(10, Math.round(range * 0.07));
  const minYearDisplay = minYear - pad;
  const maxYearDisplay = maxYear + pad;
  const displayRange = maxYearDisplay - minYearDisplay;

  const SCALE = Math.max(2, Math.min(12, 1000 / Math.max(displayRange, 1)));

  const placed = placeEvents(events, minYearDisplay, SCALE);
  const maxCardRight = Math.max(...placed.map((e) => e.cardX + CARD_W));
  const axisRight = displayRange * SCALE + 2 * SIDE_PAD;
  const totalWidth = Math.max(maxCardRight + SIDE_PAD, axisRight);

  const interval = bestTickInterval(displayRange);
  const firstTick = Math.ceil(minYearDisplay / interval) * interval;
  const ticks: number[] = [];
  for (let y = firstTick; y <= maxYearDisplay; y += interval) ticks.push(y);

  return (
    <div className="animate-fadeIn flex flex-col gap-4 pt-4">
      {header}

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted">
          {events.length} repère{events.length > 1 ? "s" : ""}
          {events.some((e) => e.user_id !== userId) && " · dont des repères partagés par d'autres membres"}
        </p>
        <div className="flex gap-1.5">
          <button
            onClick={() => scrollRef.current?.scrollBy({ left: -320, behavior: "smooth" })}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-card text-[14px] text-muted hover:border-violet/40 hover:text-violet-deep"
          >
            ‹
          </button>
          <button
            onClick={() => scrollRef.current?.scrollBy({ left: 320, behavior: "smooth" })}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-card text-[14px] text-muted hover:border-violet/40 hover:text-violet-deep"
          >
            ›
          </button>
        </div>
      </div>

      {/* ── Timeline ─────────────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-hidden rounded-2xl border border-line bg-card"
        style={{ height: CONTAINER_H, WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        <div className="relative" style={{ width: totalWidth, height: INNER_H }}>

          {/* Axis line */}
          <div className="absolute left-0 right-0 h-px bg-violet/20" style={{ top: AXIS_Y }} />

          {placed.map((ev) => {
            const isTop    = ev.row === "top";
            const isOwn    = ev.user_id === userId;
            const isHovered = hoveredId === ev.id;
            const cardTop  = isTop ? TOP_START : BOT_START;
            const connTop  = isTop ? TOP_START + CARD_H : AXIS_Y + 2;
            const connH    = isTop ? AXIS_Y - (TOP_START + CARD_H) : BOT_START - (AXIS_Y + 2);
            const clampedDotX = Math.max(SIDE_PAD, Math.min(ev.dotX, totalWidth - SIDE_PAD));

            return (
              <div key={ev.id}>
                {/* Span bar for periods */}
                {ev.end_year != null && (
                  <div
                    className="absolute rounded-full transition-all duration-200"
                    style={{
                      left:       clampedDotX,
                      top:        AXIS_Y - 2,
                      width:      Math.max(4, (ev.end_year - ev.start_year) * SCALE),
                      height:     isHovered ? 8 : 5,
                      background: isHovered ? "var(--color-violet)" : "color-mix(in srgb, var(--color-violet) 30%, transparent)",
                      opacity:    isHovered ? 1 : 0.6,
                    }}
                  />
                )}

                {/* Axis dot — hoverable avec zone de clic élargie */}
                <div
                  className="absolute z-10 -translate-x-1/2 cursor-pointer rounded-full border-2 border-violet transition-all duration-200"
                  style={{
                    left:    clampedDotX,
                    top:     AXIS_Y - (isHovered ? 5 : 4),
                    width:   isHovered ? 14 : 10,
                    height:  isHovered ? 14 : 10,
                    background: isHovered ? "var(--color-violet)" : "var(--color-card)",
                  }}
                  onMouseEnter={() => setHoveredId(ev.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => setDetail(ev)}
                />

                {/* Connector */}
                {connH > 0 && (
                  <div
                    className="absolute w-px transition-opacity duration-200"
                    style={{
                      left:    ev.cardX + CARD_W / 2,
                      top:     connTop,
                      height:  connH,
                      background: isHovered
                        ? "color-mix(in srgb, var(--color-violet) 40%, transparent)"
                        : "color-mix(in srgb, var(--color-violet) 18%, transparent)",
                    }}
                  />
                )}

                {/* Hover tooltip dans l'espace connecteur */}
                {isHovered && (
                  <div
                    className="pointer-events-none absolute z-30 overflow-hidden rounded-full border border-violet/40 bg-paper px-2.5 py-0.5 shadow-md"
                    style={{
                      left:      clampedDotX,
                      top:       isTop ? AXIS_Y + 3 : AXIS_Y - 20,
                      transform: "translateX(-50%)",
                      maxWidth:  CARD_W + 40,
                    }}
                  >
                    <p className="truncate font-serif text-[9px] font-semibold text-ink">{ev.title}</p>
                  </div>
                )}

                {/* Card */}
                <div
                  className={`absolute overflow-hidden rounded-2xl border bg-paper transition-all duration-200 cursor-pointer select-none
                    ${isHovered ? "border-violet shadow-lg shadow-violet/10 z-20" : "border-line hover:border-violet/30 z-10"}
                    ${!isOwn ? "ring-1 ring-violet/10" : ""}`}
                  style={{ left: ev.cardX, top: cardTop, width: CARD_W, height: CARD_H }}
                  onClick={() => setDetail(ev)}
                  onMouseEnter={() => setHoveredId(ev.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div className="flex h-full flex-col gap-1 p-3">
                    {/* Date badge — Fraunces, pas de monospace */}
                    <span className="inline-block w-fit rounded-full bg-violet-soft px-2 py-0.5 font-serif text-[10px] font-semibold text-violet-deep">
                      {fmtPeriod(ev.start_year, ev.end_year)}
                    </span>

                    <p className="mt-0.5 line-clamp-2 font-serif text-[12.5px] font-semibold leading-snug text-ink">
                      {ev.title}
                    </p>

                    {ev.description && (
                      <p className="line-clamp-2 flex-1 text-[10.5px] leading-relaxed text-muted">
                        {ev.description}
                      </p>
                    )}

                    {ev.book_cover_url ? (
                      <div className="mt-auto flex items-center gap-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ev.book_cover_url} alt="" className="h-7 w-5 shrink-0 rounded object-cover" />
                        {ev.book_title && (
                          <p className="truncate text-[9px] text-muted">{ev.book_title}</p>
                        )}
                      </div>
                    ) : ev.book_title ? (
                      <p className="mt-auto truncate text-[9.5px] text-muted">📚 {ev.book_title}</p>
                    ) : null}

                    {!isOwn && (
                      <span className="absolute right-2 top-2 rounded-full bg-violet-soft px-1.5 py-0.5 text-[8px] font-semibold text-violet-deep">
                        Partagé
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Year ticks — sans monospace */}
          {ticks.map((tick) => {
            const x = (tick - minYearDisplay) * SCALE + SIDE_PAD;
            const isHoveredTick = placed.some(
              (e) => hoveredId === e.id &&
                     e.start_year <= tick &&
                     (e.end_year ?? e.start_year) >= tick
            );
            return (
              <div key={tick}>
                <div
                  className="absolute w-px transition-colors duration-200"
                  style={{
                    left:       x,
                    top:        AXIS_Y,
                    height:     isHoveredTick ? 12 : 7,
                    background: isHoveredTick
                      ? "var(--color-violet)"
                      : "color-mix(in srgb, var(--color-violet) 25%, transparent)",
                  }}
                />
                <p
                  className="absolute text-[9px] font-medium text-muted transition-colors duration-200"
                  style={{
                    left:      x,
                    top:       TICK_Y,
                    transform: "translateX(-50%)",
                    whiteSpace: "nowrap",
                    color:     isHoveredTick ? "var(--color-violet-deep)" : undefined,
                    fontWeight: isHoveredTick ? 600 : undefined,
                  }}
                >
                  {tick < 0 ? `${Math.abs(tick)} av.` : `${tick}`}
                </p>
              </div>
            );
          })}

          {/* Edge year labels */}
          <p className="absolute text-[9px] font-medium text-violet-deep/40" style={{ left: 8, top: AXIS_Y - 14 }}>
            {fmtYear(minYearDisplay)}
          </p>
          <p className="absolute text-[9px] font-medium text-violet-deep/40" style={{ right: 8, top: AXIS_Y - 14 }}>
            {fmtYear(maxYearDisplay)}
          </p>
        </div>
      </div>

      {/* ── Detail modal ──────────────────────────────────────────────────────── */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
          onClick={() => setDetail(null)}
        >
          <div
            className="flex w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-paper max-h-[85dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with book cover */}
            {detail.book_cover_url ? (
              <div className="relative h-28 shrink-0 overflow-hidden bg-violet-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={detail.book_cover_url}
                  alt=""
                  className="h-full w-full object-cover opacity-30 blur-sm"
                />
                <div className="absolute inset-0 flex items-end gap-4 p-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={detail.book_cover_url}
                    alt={detail.book_title ?? ""}
                    className="h-20 w-14 shrink-0 rounded-xl object-cover shadow-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-[11px] font-medium text-ink/60">{detail.book_title}</p>
                  </div>
                </div>
                <button
                  onClick={() => setDetail(null)}
                  className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-ink/30 text-cream backdrop-blur-sm"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-5 pb-0">
                <div />
                <button onClick={() => setDetail(null)} className="text-xl font-light text-muted">✕</button>
              </div>
            )}

            <div
              className="flex flex-col gap-3 overflow-y-auto overscroll-contain p-5"
              onTouchMove={(e) => e.stopPropagation()}
            >
              {/* Period */}
              <p className="font-serif text-2xl font-semibold text-violet-deep">
                {fmtPeriod(detail.start_year, detail.end_year)}
              </p>

              {/* Title */}
              <h2 className="font-serif text-xl font-semibold leading-snug text-ink">
                {detail.title}
              </h2>

              {/* Description */}
              {detail.description && (
                <p className="text-[14px] leading-relaxed text-muted" style={{ whiteSpace: "pre-line" }}>
                  {detail.description}
                </p>
              )}

              {/* Shared indicator */}
              {detail.user_id !== userId && (
                <div className="rounded-2xl border border-violet/20 bg-violet-soft px-3 py-2.5">
                  <p className="text-[12px] text-violet-deep">
                    Ce repère a été créé par un autre membre qui a lu le même livre.
                  </p>
                </div>
              )}

              {/* Delete */}
              {detail.user_id === userId && (
                <button
                  onClick={() => handleDelete(detail.id)}
                  disabled={deletingId === detail.id}
                  className="mt-1 text-[12px] font-medium text-muted hover:text-danger disabled:opacity-40"
                >
                  {deletingId === detail.id ? "Suppression…" : "Supprimer ce repère"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <AddModal
          {...{
            saving, tlTitle, setTlTitle, tlStart, setTlStart,
            tlEnd, setTlEnd, tlDesc, setTlDesc,
            tlBookId, setTlBookId, myBooks,
            onAdd: handleAdd,
            onClose: () => !saving && setShowAdd(false),
          }}
        />
      )}
    </div>
  );
}

// ── Add modal ────────────────────────────────────────────────────────────────

function AddModal({
  saving, tlTitle, setTlTitle, tlStart, setTlStart,
  tlEnd, setTlEnd, tlDesc, setTlDesc,
  tlBookId, setTlBookId, myBooks, onAdd, onClose,
}: {
  saving: boolean;
  tlTitle: string; setTlTitle: (v: string) => void;
  tlStart: string; setTlStart: (v: string) => void;
  tlEnd: string;   setTlEnd:   (v: string) => void;
  tlDesc: string;  setTlDesc:  (v: string) => void;
  tlBookId: string; setTlBookId: (v: string) => void;
  myBooks: { id: number; title: string; cover_url: string | null }[];
  onAdd: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-3 overflow-hidden rounded-t-3xl bg-paper p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-base font-semibold text-ink">Nouveau repère</h3>
          <button onClick={onClose} className="text-xl font-light text-muted">✕</button>
        </div>
        <input
          value={tlTitle}
          onChange={(e) => setTlTitle(e.target.value)}
          placeholder="Titre de l'événement"
          autoFocus
          className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-[13px] text-ink placeholder:text-muted outline-none focus:border-violet"
        />
        <div className="flex gap-2">
          <div className="flex-1">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Année début</p>
            <input
              type="number"
              value={tlStart}
              onChange={(e) => setTlStart(e.target.value)}
              placeholder="1154 ou -44"
              className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-[13px] text-ink placeholder:text-muted outline-none focus:border-violet"
            />
          </div>
          <div className="flex-1">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Année fin</p>
            <input
              type="number"
              value={tlEnd}
              onChange={(e) => setTlEnd(e.target.value)}
              placeholder="optionnel"
              className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-[13px] text-ink placeholder:text-muted outline-none focus:border-violet"
            />
          </div>
        </div>
        <select
          value={tlBookId}
          onChange={(e) => setTlBookId(e.target.value)}
          className="w-full rounded-xl border border-line bg-input px-3 py-2.5 text-[13px] text-ink outline-none focus:border-violet"
        >
          <option value="">Lier à un livre (optionnel)</option>
          {myBooks.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
        </select>
        <textarea
          value={tlDesc}
          onChange={(e) => setTlDesc(e.target.value)}
          rows={2}
          placeholder="Description ou notes…"
          className="w-full resize-none rounded-xl border border-line bg-input px-3 py-2.5 text-[13px] text-ink placeholder:text-muted outline-none focus:border-violet"
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-line py-3 text-[13px] font-semibold text-muted"
          >
            Annuler
          </button>
          <button
            onClick={onAdd}
            disabled={saving || !tlTitle.trim() || !tlStart.trim()}
            className="flex-1 rounded-2xl bg-violet py-3 text-[13px] font-semibold text-cream disabled:opacity-40"
          >
            {saving ? "Enregistrement…" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}
