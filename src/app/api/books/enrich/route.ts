import { NextResponse } from "next/server";
import { stripHtml, mapCategoriesToGenres, pickBookExtract, isFrench } from "../../../../lib/googleBooks";

export const dynamic = "force-dynamic";

interface GBVolume {
  volumeInfo?: {
    title?: string;
    description?: string;
    language?: string;
    categories?: string[];
    publishedDate?: string;
    industryIdentifiers?: { type?: string; identifier?: string }[];
  };
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// Préfixes ISBN-13 des grands éditeurs de poche français (édition la plus achetée).
// Folio/Gallimard, Le Livre de Poche, Pocket, J'ai Lu, Points, 10/18, Flammarion GF.
const POCHE_PREFIXES = ["978207", "9782253", "9782266", "9782290", "9782757", "9782264", "9782081"];
const isPoche = (isbn: string) => POCHE_PREFIXES.some((p) => isbn.startsWith(p));

// Détecte les descriptions de type « fiche de lecture / analyse scolaire » (Profil,
// lePetitLittéraire, Bac…), qui décrivent une étude de l'œuvre et non le livre lui-même.
const STUDY_GUIDE_RE =
  /fiche de lecture|cl[eé]s? de lecture|analyse (litt[eé]raire|de l|du livre|compl[eè]te|de l'œuvre|de l'oeuvre)|commentaire (compos[eé]|de texte)|r[eé]sum[eé] et analyse|questionnaire|petitlitteraire|lepetitlitteraire|d[eé]cryptage|profil d'une œuvre|profil d'une oeuvre|dossier p[eé]dagogique|dissertation|bac de fran[cç]ais|cette (étude|analyse|fiche)|guide de lecture|tout savoir sur|en quelques (minutes|pages)|notre fiche/i;
const isStudyGuide = (t: string) => STUDY_GUIDE_RE.test(t);

// Détecte une description qui est en fait une BIOGRAPHIE de l'auteur (fréquent sur
// certaines éditions), au lieu du résumé du livre. On teste le tout début du texte.
const AUTHOR_BIO_RE =
  /(n[eé]e? le \d|n[eé]e? à |nom de plume|pseudonyme d|est un[e]? (écrivain|écrivaine|romanci|auteur|auteure|journaliste|po[eè]te|essayiste))/i;
const isAuthorBio = (t: string) => AUTHOR_BIO_RE.test(t.slice(0, 130));

async function fromGoogleBooks(title: string, author: string) {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  const surname = author.split(/\s+/).filter(Boolean).pop() || author;
  const queries = [
    `intitle:"${title}" inauthor:"${surname}"`,
    `${title} ${author}`.trim(),
  ];
  const wantTitle = norm(title);

  const categories = new Set<string>();
  let summary: string | null = null;
  let year: number | null = null;
  // Candidats ISBN : on choisira le meilleur (poche FR + 978 → édition la plus achetée).
  const isbnCandidates: { isbn: string; fr: boolean; is978: boolean; poche: boolean }[] = [];
  // Candidats résumé : on écartera fiches de lecture et bios d'auteur, et on préférera une édition de poche.
  const descCandidates: { text: string; fr: boolean; poche: boolean; study: boolean; bio: boolean }[] = [];

  for (const q of queries) {
    const params = new URLSearchParams({ q, maxResults: "20", printType: "books" });
    if (key) params.set("key", key);
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`, {
        next: { revalidate: 86400 },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const items = (data.items || []) as GBVolume[];

      // On ne garde que les éditions dont le titre correspond vraiment au livre demandé
      // (sinon on récupère la description d'un autre livre du même auteur).
      const matches = items.filter((it) => {
        const t = norm(it.volumeInfo?.title || "");
        return t.length > 0 && (t === wantTitle || t.includes(wantTitle) || wantTitle.includes(t));
      });
      const pool = matches.length > 0 ? matches : items;

      for (const it of pool) {
        (it.volumeInfo?.categories || []).forEach((c) => categories.add(c));
        if (year == null) {
          const m = (it.volumeInfo?.publishedDate || "").match(/\d{4}/);
          if (m) year = Number(m[0]);
        }
        const idsArr = it.volumeInfo?.industryIdentifiers || [];
        const found =
          idsArr.find((i) => i.type === "ISBN_13")?.identifier ||
          idsArr.find((i) => i.type === "ISBN_10")?.identifier;
        const clean = found ? found.replace(/[^0-9Xx]/g, "") : null;
        const editionPoche = clean ? isPoche(clean) : false;
        if (clean) {
          isbnCandidates.push({
            isbn: clean,
            fr: it.volumeInfo?.language === "fr",
            is978: clean.startsWith("978"),
            poche: editionPoche,
          });
        }
        // Description de cette édition (candidat résumé)
        const rawDesc = it.volumeInfo?.description;
        if (rawDesc) {
          const cleaned = stripHtml(rawDesc);
          if (cleaned.length > 40) {
            const fr = it.volumeInfo?.language === "fr" || isFrench(cleaned);
            descCandidates.push({
              text: cleaned,
              fr,
              poche: editionPoche,
              study: isStudyGuide(cleaned),
              bio: isAuthorBio(cleaned),
            });
          }
        }
      }
    } catch {
      /* on tente la requête suivante */
    }
    if (descCandidates.length > 0 && isbnCandidates.length > 0 && categories.size > 0) break;
  }

  // Résumé : français, ni fiche de lecture ni biographie d'auteur, en privilégiant
  // une édition de poche. Repli progressif si rien de parfait.
  const clean = descCandidates.filter((c) => c.fr && !c.study && !c.bio);
  summary =
    (clean.find((c) => c.poche) ?? clean[0])?.text ??
    // repli : accepte une bio d'auteur plutôt que rien, mais jamais une fiche de lecture
    descCandidates.find((c) => c.fr && !c.study)?.text ??
    null;

  // Meilleur ISBN, par ordre de préférence :
  // poche FR → poche → FR+978 → 978 → FR → n'importe lequel.
  const isbn =
    (isbnCandidates.find((c) => c.fr && c.poche) ??
      isbnCandidates.find((c) => c.poche) ??
      isbnCandidates.find((c) => c.fr && c.is978) ??
      isbnCandidates.find((c) => c.is978) ??
      isbnCandidates.find((c) => c.fr) ??
      isbnCandidates[0])?.isbn ?? null;

  return { summary, genres: mapCategoriesToGenres([...categories]), year, isbn };
}

// Repli résumé : Wikipédia FR, avec vérification stricte livre ≠ film/série.
async function fromWikipedia(title: string, author: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://fr.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        `${title} ${author} roman livre`,
      )}&gsrlimit=5&prop=extracts&exintro&explaintext&format=json`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const pages = Object.values(data.query?.pages || {}) as { extract?: string; index?: number }[];
    return pickBookExtract(pages, author);
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const title = url.searchParams.get("title")?.trim() || "";
  const author = url.searchParams.get("author")?.trim() || "";
  if (!title) return NextResponse.json({ summary: null, genres: [], year: null, isbn: null });

  const gb = await fromGoogleBooks(title, author);
  let summary: string | null = gb.summary;
  if (!summary) summary = await fromWikipedia(title, author);

  return NextResponse.json({ summary, genres: gb.genres, year: gb.year, isbn: gb.isbn });
}
