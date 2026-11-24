"use client";

import { useState } from "react";
import { Modal, Button } from "./ui";
import type { QuizQuestion, QuizResult } from "../lib/quiz";

const LETTERS = ["A", "B", "C", "D"];

// Avis sur la qualité des questions : uniquement en développement local.
const DEV = process.env.NODE_ENV === "development";

function DevFeedback({ book, quiz }: { book: string; quiz: QuizQuestion }) {
  const [sent, setSent] = useState<"up" | "down" | null>(null);
  const [comment, setComment] = useState("");
  const send = async (verdict: "up" | "down") => {
    setSent(verdict);
    await fetch("/api/dev/quiz-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book, tier: quiz.tier, question: quiz.question, verdict, comment }),
    }).catch(() => {});
  };
  return (
    <div className="rounded-xl border border-dashed border-line p-3">
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Avis sur la question (local)</p>
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Commentaire facultatif (ce qui ne va pas)"
        className="mt-2 w-full rounded-lg border border-line bg-input px-2.5 py-1.5 text-[12.5px] text-ink outline-none"
      />
      <div className="mt-2 flex gap-2">
        <button onClick={() => send("up")} className={`flex-1 rounded-lg border-2 px-3 py-1.5 text-[12.5px] font-bold ${sent === "up" ? "border-success bg-success/10 text-success" : "border-line text-ink"}`}>
          Bonne question
        </button>
        <button onClick={() => send("down")} className={`flex-1 rounded-lg border-2 px-3 py-1.5 text-[12.5px] font-bold ${sent === "down" ? "border-danger bg-danger/10 text-danger" : "border-line text-ink"}`}>
          À revoir
        </button>
      </div>
      {sent && <p className="mt-1.5 text-[11.5px] text-muted">Avis enregistré.</p>}
    </div>
  );
}

const CSS = `
@keyframes quiz-pop { 0% { transform: scale(1); } 40% { transform: scale(1.04); } 100% { transform: scale(1); } }
@keyframes quiz-burst { 0% { transform: translate(0,0) rotate(0deg) scale(1); opacity: 1; } 100% { transform: translate(var(--x), var(--y)) rotate(var(--r)) scale(0.6); opacity: 0; } }
@keyframes quiz-ring { 0% { transform: scale(0.6); opacity: 0.7; } 100% { transform: scale(1.5); opacity: 0; } }
@keyframes quiz-xp { 0% { transform: translateY(8px) scale(0.8); opacity: 0; } 25% { opacity: 1; } 100% { transform: translateY(-34px) scale(1.1); opacity: 0; } }
.quiz-right { animation: quiz-pop 0.45s ease-out; }
.quiz-bit { position: absolute; left: 50%; top: 50%; width: 7px; height: 11px; border-radius: 2px; animation: quiz-burst 0.95s cubic-bezier(.2,.7,.3,1) forwards; }
.quiz-ring { position: absolute; inset: 0; border-radius: 12px; border: 2px solid var(--color-success); animation: quiz-ring 0.8s ease-out forwards; pointer-events: none; }
.quiz-xp { position: absolute; right: 14px; top: 8px; font-weight: 800; font-size: 15px; color: var(--color-success); animation: quiz-xp 1.3s ease-out forwards; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .quiz-right, .quiz-bit, .quiz-ring, .quiz-xp { animation: none; } .quiz-bit, .quiz-ring { display: none; } }
`;
const COLORS = ["#5e8c61", "#f4cf5e", "#8f7ad6", "#e8a07a", "#7ac0d6"];
// Éclats déterministes (même rendu serveur / client)
const BITS = Array.from({ length: 18 }).map((_, i) => {
  const a = (i / 18) * Math.PI * 2 + (i % 3) * 0.15;
  const d = 55 + ((i * 37) % 50);
  return { x: Math.cos(a) * d, y: Math.sin(a) * d - 10, r: ((i * 83) % 360) - 180, c: COLORS[i % COLORS.length], delay: (i % 4) * 0.03 };
});

/**
 * Question de lecture posée quand un palier (25 / 50 / 75 / 100 %) est franchi.
 * Après la réponse : bonne réponse en vert, explication, et les XP gagnés.
 */
export default function QuizModal({
  open,
  bookTitle,
  quiz,
  onAnswer,
  onClose,
}: {
  open: boolean;
  bookTitle: string;
  quiz: QuizQuestion;
  onAnswer: (choice: number) => Promise<QuizResult | null>;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = async (i: number) => {
    if (picked !== null || busy) return;
    setPicked(i);
    setBusy(true);
    const r = await onAnswer(i);
    setBusy(false);
    if (r) setResult(r);
    else onClose();
  };

  const stateOf = (i: number) => {
    if (!result) return picked === i ? "picked" : "idle";
    if (i === result.answer) return "right";
    if (i === picked) return "wrong";
    return "dim";
  };
  const styles: Record<string, string> = {
    idle: "border-line bg-card hover:border-violet hover:bg-violet-soft",
    picked: "border-violet bg-violet-soft",
    right: "border-success bg-success/10",
    wrong: "border-danger bg-danger/10",
    dim: "border-line bg-card opacity-50",
  };

  return (
    <Modal
      open={open}
      onClose={result ? onClose : () => {}}
      title=""
      footer={result ? <Button onClick={onClose} className="w-full py-3">Continuer</Button> : undefined}
    >
      <div className="flex flex-col gap-4">
        <style>{CSS}</style>
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-violet-deep">
            Question de lecture · {quiz.tier} %
          </p>
          <p className="mt-0.5 truncate text-[12px] text-muted">{bookTitle}</p>
        </div>
        <p className="font-serif text-[19px] font-bold leading-snug text-ink">{quiz.question}</p>

        <div className="flex flex-col gap-2">
          {quiz.options.map((o, i) => (
            <button
              key={i}
              onClick={() => choose(i)}
              disabled={picked !== null}
              className={`relative flex items-start gap-3 rounded-xl border-2 px-3.5 py-3 text-left text-[14px] text-ink transition-colors ${styles[stateOf(i)]} ${result?.correct && i === result.answer ? "quiz-right" : ""}`}
            >
              {result?.correct && i === result.answer && (
                <>
                  <span className="quiz-ring" />
                  {result.xp > 0 && <span className="quiz-xp">+{result.xp} XP</span>}
                  {BITS.map((b, k) => (
                    <span
                      key={k}
                      className="quiz-bit"
                      style={{ background: b.c, animationDelay: `${b.delay}s`, "--x": `${b.x}px`, "--y": `${b.y}px`, "--r": `${b.r}deg` } as React.CSSProperties}
                    />
                  ))}
                </>
              )}
              <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-paper text-[11px] font-bold text-muted">
                {LETTERS[i]}
              </span>
              <span>{o}</span>
            </button>
          ))}
        </div>

        {result && (
          <div className="rounded-xl border border-line bg-card p-3.5">
            <p className={`text-[13px] font-bold ${result.correct ? "text-success" : "text-danger"}`}>
              {result.correct ? `Bonne réponse, +${result.xp} XP` : `Raté, la bonne réponse était ${LETTERS[result.answer]}`}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{result.explanation}</p>
          </div>
        )}
        {result && DEV && <DevFeedback book={bookTitle} quiz={quiz} />}
      </div>
    </Modal>
  );
}
