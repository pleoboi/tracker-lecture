"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

// Formats de code-barres utilisés par les livres (EAN-13 pour l'ISBN, EAN-8/UPC
// plus rares selon l'édition) — on restreint la détection pour aller plus vite
// et éviter les faux positifs sur d'autres types de codes.
const BOOK_FORMATS = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E];

export default function BarcodeScannerModal({
  open,
  onClose,
  onDetected,
}: {
  open: boolean;
  onClose: () => void;
  /** Code-barres brut détecté (ou saisi manuellement) — le plus souvent un ISBN-13. */
  onDetected: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    if (!open) return;
    setError(null);
    setManualMode(false);
    setManualCode("");
    let cancelled = false;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, BOOK_FORMATS);
    const reader = new BrowserMultiFormatReader(hints);

    (async () => {
      try {
        if (!videoRef.current) return;
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current,
          (result) => {
            if (result && !cancelled) {
              const text = result.getText().trim();
              cancelled = true;
              controlsRef.current?.stop();
              onDetected(text);
            }
          }
        );
        if (cancelled) {
          controls.stop();
        } else {
          controlsRef.current = controls;
        }
      } catch (e) {
        if (cancelled) return;
        const name = (e as { name?: string })?.name;
        setError(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Accès à la caméra refusé. Autorise-la dans les réglages de ton navigateur, ou saisis le code manuellement."
            : name === "NotFoundError"
              ? "Aucune caméra détectée sur cet appareil."
              : "Impossible d'ouvrir la caméra. Saisis le code manuellement."
        );
        setManualMode(true);
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onDetected]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-black [touch-action:none]">
      <div className="flex items-center justify-between px-4 pb-3 pt-[max(env(safe-area-inset-top),1rem)]">
        <p className="text-[13px] font-semibold text-white/90">Scanner un livre</p>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {!manualMode && (
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        )}

        {!manualMode && (
          <>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className="h-[110px] w-[78%] max-w-sm rounded-2xl border-2 border-white/85"
                style={{ boxShadow: "0 0 0 2000px rgba(0,0,0,0.45)" }}
              />
            </div>
            <p className="absolute inset-x-0 bottom-6 px-6 text-center text-[12.5px] font-medium text-white/80">
              Cadre le code-barres au dos du livre dans le rectangle.
            </p>
          </>
        )}

        {manualMode && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
            {error && (
              <p className="max-w-xs text-center text-[12.5px] leading-relaxed text-white/85">{error}</p>
            )}
            <div className="flex w-full max-w-xs flex-col gap-2">
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && manualCode.trim() && onDetected(manualCode.trim())}
                inputMode="numeric"
                placeholder="ISBN (ex. 9782253006329)"
                className="w-full rounded-xl border border-white/25 bg-white/10 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/60"
                autoFocus
              />
              <button
                onClick={() => manualCode.trim() && onDetected(manualCode.trim())}
                disabled={!manualCode.trim()}
                className="w-full rounded-xl bg-white py-2.5 text-[13px] font-semibold text-ink disabled:opacity-40"
              >
                Valider
              </button>
            </div>
          </div>
        )}
      </div>

      {!manualMode && (
        <button
          onClick={() => setManualMode(true)}
          className="mx-auto mb-[max(env(safe-area-inset-bottom),1rem)] mt-3 text-[12.5px] font-medium text-white/70 underline underline-offset-2"
        >
          Saisir le code manuellement
        </button>
      )}
    </div>,
    document.body
  );
}
