"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function EmailSentContent() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-5 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex justify-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-soft text-4xl">
            ✉️
          </span>
        </div>
        <h1 className="font-serif text-3xl font-black text-ink">Vérifie tes e-mails !</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Un lien de confirmation vient d&apos;être envoyé à{" "}
          {email && (
            <span className="font-semibold text-ink">{email}</span>
          )}
          .
        </p>
        <p className="mt-2 text-sm text-muted">
          Clique dessus pour activer ton compte et rejoindre le club.
        </p>

        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-line bg-card p-5 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">À savoir</p>
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 text-base">📬</span>
            <p className="text-[13px] text-ink-2">
              Vérifie aussi ton dossier <span className="font-semibold">Spam</span> si tu ne vois rien
              dans ta boîte principale.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 text-base">⏱️</span>
            <p className="text-[13px] text-ink-2">
              L&apos;e-mail peut prendre quelques minutes à arriver.
            </p>
          </div>
        </div>

        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-semibold text-violet-deep underline decoration-violet/40 underline-offset-2"
        >
          Retour à la connexion
        </Link>
      </div>
    </div>
  );
}

export default function EmailSentPage() {
  return (
    <Suspense>
      <EmailSentContent />
    </Suspense>
  );
}
