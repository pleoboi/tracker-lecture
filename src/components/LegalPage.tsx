import Link from "next/link";

/** Mise en page commune aux pages légales (accessibles sans compte). */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-serif text-lg font-black text-ink">
            Swena
          </Link>
          <Link
            href="/"
            className="text-[12.5px] font-medium text-muted transition-colors hover:text-ink"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-serif text-[32px] font-black leading-tight text-ink">{title}</h1>
        <p className="mt-2 text-[12px] text-muted">Dernière mise à jour : {updated}</p>
        <div className="legal-body mt-8 flex flex-col gap-6">{children}</div>
      </main>

      <footer className="border-t border-line px-6 py-8">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link href="/mentions-legales" className="text-[11.5px] text-muted transition-colors hover:text-ink">
            Mentions légales
          </Link>
          <Link href="/confidentialite" className="text-[11.5px] text-muted transition-colors hover:text-ink">
            Confidentialité
          </Link>
          <Link href="/conditions" className="text-[11.5px] text-muted transition-colors hover:text-ink">
            Conditions d&apos;utilisation
          </Link>
        </div>
      </footer>
    </div>
  );
}

/** Section titrée d'une page légale. */
export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-serif text-[19px] font-bold text-ink">{title}</h2>
      <div className="flex flex-col gap-2 text-[14px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}
