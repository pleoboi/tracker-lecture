"use client";

import { useEffect } from "react";

/**
 * Visionneuse plein écran (lightbox) sur fond sombre pour afficher une image
 * en haute résolution. Épurée : un clic n'importe où ferme.
 */
export default function Lightbox({
  src,
  alt = "",
  onClose,
}: {
  src: string | null;
  alt?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="animate-fadeIn fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4 [touch-action:none]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        aria-label="Fermer"
        className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg text-white backdrop-blur-sm transition-colors hover:bg-white/20"
      >
        ✕
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl"
      />
    </div>
  );
}
