"use client";

import { useState, useEffect } from "react";

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

  const visibleCovers = covers.filter((url) => !failed.has(url));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4 pt-4 pb-24 [touch-action:none]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl bg-paper p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg font-bold text-ink">Choisir une couverture</h2>
            <p className="text-[11px] text-muted">{title}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-sm text-muted hover:bg-card"
          >
            ✕
          </button>
        </div>

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
            {covers.map((url, i) => (
              <button
                key={i}
                onClick={() => { onPick(url); onClose(); }}
                className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                  failed.has(url) ? "hidden" :
                  currentCover === url
                    ? "border-violet shadow-md"
                    : "border-transparent hover:border-violet/50"
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
                {currentCover === url && (
                  <div className="absolute inset-0 flex items-center justify-center bg-violet/30">
                    <span className="text-2xl font-bold text-cream">✓</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

