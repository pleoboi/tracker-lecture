import type { Book } from "./types";

// Tag affilié Amazon. Configurable via .env (NEXT_PUBLIC_AMAZON_AFFILIATE_TAG),
// avec repli sur "swena21" pour que le lien fonctionne même sans variable définie.
const AMAZON_TAG = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG || "swena21";

type BookLike = Pick<Book, "isbn13" | "title" | "author">;

/**
 * Normalise l'ISBN stocké et vérifie sa validité (clé de contrôle comprise).
 * Accepte indifféremment un ISBN-10 ou un ISBN-13 — on interroge Amazon avec
 * celui qui est réellement renseigné, sans conversion, pour rester conforme
 * à l'édition saisie. Retourne null si l'ISBN est absent ou invalide.
 */
export function normalizeIsbn(raw?: string | null): string | null {
  const s = (raw || "").replace(/[^0-9Xx]/g, "").toUpperCase();

  if (s.length === 13) {
    if (!/^\d{13}$/.test(s)) return null;
    // Clé ISBN-13 : somme pondérée 1/3 alternée.
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
    return (10 - (sum % 10)) % 10 === Number(s[12]) ? s : null;
  }

  if (s.length === 10) {
    if (!/^\d{9}[\dX]$/.test(s)) return null;
    // Clé ISBN-10 : somme pondérée 10..1, modulo 11, X valant 10.
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += Number(s[i]) * (10 - i);
    const check = s[9] === "X" ? 10 : Number(s[9]);
    return (sum + check) % 11 === 0 ? s : null;
  }

  return null;
}

/**
 * Lien affilié Amazon.fr, ou null si le livre n'a pas d'ISBN valide.
 *
 * On passe par la recherche et non par /dp/{asin} : l'ISBN-10 ne correspond à un
 * ASIN valide que si Amazon référence exactement cette édition. Comme l'ISBN vient
 * souvent d'une édition poche qu'Amazon ne porte pas sous ce numéro, /dp/ tombait
 * régulièrement sur une page introuvable. Résoudre le bon ASIN demanderait le flux
 * produit d'Amazon (PA-API), réservé aux comptes affiliés validés.
 *
 * La recherche par ISBN aboutit toujours et pointe sur le bon livre ;
 * l'attribution affiliée est identique (le tag est porté par le lien).
 */
export function getAmazonAffiliateUrl(book: BookLike): string | null {
  const isbn = normalizeIsbn(book.isbn13);
  if (!isbn) return null;
  return `https://www.amazon.fr/s?k=${isbn}&i=stripbooks&tag=${AMAZON_TAG}`;
}

export interface BuyLink {
  name: string;
  url: string;
}

/**
 * Liens d'achat disponibles pour un livre. Liste vide si aucun ISBN valide :
 * on préfère ne pas afficher de bouton plutôt que d'envoyer vers un résultat
 * approximatif. Fnac et Cultura s'ajouteront ici dès la validation Awin.
 */
export function getBuyLinks(book: BookLike): BuyLink[] {
  const links: BuyLink[] = [];
  const amazon = getAmazonAffiliateUrl(book);
  if (amazon) links.push({ name: "Amazon", url: amazon });
  // À activer après inscription Awin :
  // const fnac = getFnacAffiliateUrl(book); if (fnac) links.push({ name: "Fnac", url: fnac });
  return links;
}
