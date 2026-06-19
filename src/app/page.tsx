import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <span className="font-serif text-lg font-black text-ink">Ma Bibliothèque</span>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-ink-2 hover:text-ink"
          >
            Se connecter
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-violet px-4 py-2 text-sm font-semibold text-cream transition-opacity hover:opacity-85"
          >
            Créer un compte
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center md:py-24">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-violet-soft text-5xl">
          📚
        </div>
        <div className="max-w-lg">
          <h1 className="font-serif text-5xl font-black leading-[1.1] text-ink md:text-6xl">
            Ta bibliothèque<br />
            <span className="text-violet">personnelle.</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-2">
            Suis tes lectures, note tes livres et partage
            ta progression avec tes proches.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/register"
            className="rounded-2xl bg-violet px-7 py-3.5 text-sm font-semibold text-cream transition-opacity hover:opacity-85"
          >
            Rejoindre le club →
          </Link>
          <Link
            href="/login"
            className="rounded-2xl border border-line bg-card px-7 py-3.5 text-sm font-medium text-ink transition-colors hover:border-violet/40"
          >
            J&apos;ai déjà un compte
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-violet-soft px-6 py-14 md:px-10">
        <h2 className="mb-8 text-center font-serif text-2xl font-bold text-ink">
          Tout ce dont tu as besoin
        </h2>
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: "📖",
              title: "Bibliothèque",
              desc: "Catalogue tous tes livres avec couvertures, notes personnelles et statuts de lecture.",
            },
            {
              icon: "✏️",
              title: "Journal",
              desc: "Enregistre chaque session et visualise ta progression page par page.",
            },
            {
              icon: "📊",
              title: "Statistiques",
              desc: "Graphiques annuels, objectifs personnalisés et records de lecture.",
            },
            {
              icon: "👥",
              title: "Membres",
              desc: "Découvre les lectures de tes proches et compare vos bibliothèques.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-5"
            >
              <span className="text-2xl">{f.icon}</span>
              <h3 className="font-serif text-base font-semibold text-ink">{f.title}</h3>
              <p className="text-[13px] leading-relaxed text-ink-2">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line px-6 py-6 text-center">
        <p className="text-xs text-muted">
          Club de lecture privé · Accès sur invitation
        </p>
      </footer>
    </div>
  );
}
