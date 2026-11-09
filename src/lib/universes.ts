// Univers activés pour un compte : « livres » et/ou « manga ». Choisis à
// l'inscription, modifiables dans les paramètres. Stocké dans les métadonnées
// du compte (user_metadata.universes) : pas de table en plus, et le proxy peut
// le lire côté serveur. Un compte sans valeur (créé avant ce choix) a les deux.

export type Universe = "books" | "manga";

export const ALL_UNIVERSES: Universe[] = ["books", "manga"];

export function parseUniverses(raw: unknown): Universe[] {
  const list = Array.isArray(raw) ? raw.filter((u): u is Universe => u === "books" || u === "manga") : [];
  return list.length ? ALL_UNIVERSES.filter((u) => list.includes(u)) : ALL_UNIVERSES;
}

export function userUniverses(user: { user_metadata?: Record<string, unknown> } | null | undefined): Universe[] {
  return parseUniverses(user?.user_metadata?.universes);
}

/** Page d'arrivée après connexion / inscription. */
export function homeFor(universes: Universe[]): string {
  return universes.includes("books") ? "/accueil" : "/manga";
}

// Pages qui n'existent que côté livres
const BOOK_ONLY_PREFIXES = ["/accueil", "/bibliotheque", "/communaute", "/dashboard", "/journal", "/decouverte", "/frise", "/livre", "/listes"];

const isMangaPathname = (p: string) => p === "/manga" || p.startsWith("/manga/");
const underPrefix = (p: string, prefix: string) => p === prefix || p.startsWith(`${prefix}/`);

/**
 * Où renvoyer un membre qui tombe sur une page d'un univers qu'il n'a pas
 * activé (lien partagé, notification, ancien favori...). null = rien à faire.
 */
export function universeRedirect(pathname: string, universes: Universe[]): string | null {
  const hasBooks = universes.includes("books");
  const hasManga = universes.includes("manga");

  if (!hasBooks) {
    if (underPrefix(pathname, "/compte")) return "/manga/compte";
    if (pathname === "/membres") return "/manga/membres";
    const profile = pathname.match(/^\/membre\/([\w-]+)/);
    if (profile) return `/manga/membre/${profile[1]}`;
    if (BOOK_ONLY_PREFIXES.some((p) => underPrefix(pathname, p))) return "/manga";
  }

  if (!hasManga) {
    if (pathname === "/manga/compte") return "/compte";
    if (pathname === "/manga/membres") return "/membres";
    const profile = pathname.match(/^\/manga\/membre\/([\w-]+)/);
    if (profile) return `/membre/${profile[1]}`;
    if (isMangaPathname(pathname)) return "/accueil";
  }

  return null;
}
