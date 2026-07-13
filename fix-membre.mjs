import fs from "fs";

let c = fs.readFileSync("src/app/membre/[id]/page.tsx", "utf8");

// 1. Add wantToRead computation
const OLD_FILTER = `  const completed = books.filter(isCompleted);
  const reading = books.filter((b) => b.status === "reading");
  const abandoned = books.filter((b) => b.status === "abandoned");`;

const NEW_FILTER = `  const completed = books.filter(isCompleted);
  const reading = books.filter((b) => b.status === "reading");
  const abandoned = books.filter((b) => b.status === "abandoned");
  const wantToRead = books.filter((b) => b.status === "to-read");`;

if (!c.includes(OLD_FILTER)) {
  console.error("filter block not found");
  process.exit(1);
}
c = c.replace(OLD_FILTER, NEW_FILTER);

// 2. Add "Envie de lire" section after abandoned section
const OLD_AFTER_ABANDONED = `      {/* Galerie de photos de sessions */}`;

const NEW_AFTER_ABANDONED = `      {/* Envie de lire */}
      {wantToRead.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-lg font-medium text-ink">
            Envie de lire{" "}
            <span className="font-sans text-sm font-normal text-muted">({wantToRead.length})</span>
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {wantToRead.map((b) => (
              <Link
                key={b.id}
                href={`/livre/${b.id}`}
                className="group relative flex flex-col gap-1.5"
              >
                <div className="relative overflow-hidden rounded-xl">
                  <Cover
                    id={b.id}
                    title={b.title}
                    coverUrl={b.cover_url}
                    className="aspect-[3/4] w-full"
                    rounded="rounded-xl"
                  />
                  <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-violet/90">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
                    </svg>
                  </div>
                </div>
                <p className="line-clamp-2 text-[10.5px] font-medium leading-snug text-ink">{b.title}</p>
              </Link>
            ))}
          </div>
          {!isOwn && (
            <p className="text-[11px] text-muted">
              Ces livres sont dans la liste d&apos;envies de {memberName}.
            </p>
          )}
        </section>
      )}

      {/* Galerie de photos de sessions */}`;

if (!c.includes(OLD_AFTER_ABANDONED)) {
  console.error("galerie block not found");
  process.exit(1);
}
c = c.replace(OLD_AFTER_ABANDONED, NEW_AFTER_ABANDONED);

fs.writeFileSync("src/app/membre/[id]/page.tsx", c);
console.log("membre page updated");
