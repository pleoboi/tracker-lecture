"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  title: string;
  author: string;
  currentCover?: string | null;
  onPick: (url: string) => void;
  onClose: () => void;
}

export default function CoverPickerModal({ title, author, currentCover, onPick, onClose }: Props) {
  const [covers, setCovers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const markFailed = (url: string) =>
    setFailed((prev) => new Set([...prev, url]));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setFailed(new Set());
      try {
        const params = new URLSearchParams({ title, author });
        const res = await fetch(`/api/books/covers?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setCovers((data.covers as string[]) || []);
        }
      } catch { /* silent */ }
      setLoading(false);
    };
    load();
  }, [title, author]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // La couverture actuelle reste toujours proposée, en tête de liste.
  const current = currentCover?.trim() || null;
  const allCovers = current ? [current, ...covers.filter((c) => c !== current)] : covers;
  const visibleCovers = allCovers.filter((url) => !failed.has(url));

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/50 px-0 backdrop-blur-sm sm:items-center sm:px-4 [touch-action:none]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-bold text-ink">Choisir une couverture</h2>
            <p className="truncate text-[11px] text-muted">{title}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-sm text-muted hover:bg-card"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] [touch-action:pan-y]">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-xs font-medium text-muted">
              Chargement des couvertures…
            </div>
          ) : visibleCovers.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-xs font-medium text-muted">
              <span className="text-2xl">📚</span>
              Aucune couverture disponible pour ce titre.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {visibleCovers.map((url, i) => {
                const isCurrent = current === url;
                return (
                  <button
                    key={`${url}-${i}`}
                    onClick={() => { onPick(url); onClose(); }}
                    className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                      isCurrent ? "border-violet shadow-md" : "border-transparent hover:border-violet/50"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="aspect-[2/3] w-full object-cover"
                      loading="lazy"
                      onError={() => markFailed(url)}
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        if (img.naturalWidth < 50 || img.naturalHeight < 60) markFailed(url);
                      }}
                    />
                    {isCurrent && (
                      <span className="absolute left-1 top-1 rounded-md bg-violet px-1.5 py-0.5 text-[9px] font-semibold text-cream shadow">
                        Actuelle
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
