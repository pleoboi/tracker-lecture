import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Dernier recours pour résoudre titre/auteur à partir d'un ISBN quand ni
 * Open Library ni Google Books ne connaissent l'édition (fréquent pour de
 * petites maisons ou des éditions franco-françaises récentes). La BnF, par
 * dépôt légal, catalogue quasiment tout ce qui est publié en France.
 * API SRU publique, sans clé — on demande le schéma UNIMARC (marcxchange),
 * plus fiable à parser que le "dublincore" qui mélange titre et auteur dans
 * un seul champ.
 */

function unescapeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractDatafield(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<[\\w:]*datafield tag="${tag}"[^>]*>([\\s\\S]*?)<\\/[\\w:]*datafield>`));
  return m ? m[1] : null;
}

function extractSubfield(block: string, code: string): string | null {
  const m = block.match(new RegExp(`<[\\w:]*subfield code="${code}">([^<]*)<\\/[\\w:]*subfield>`));
  return m ? unescapeXml(m[1]).trim() : null;
}

function extractAllSubfields(xml: string, tag: string, code: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<[\\w:]*datafield tag="${tag}"[^>]*>([\\s\\S]*?)<\\/[\\w:]*datafield>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const v = extractSubfield(m[1], code);
    if (v) out.push(v);
  }
  return out;
}

function isbn10to13(digits10: string): string | null {
  if (digits10.length !== 10) return null;
  const core = "978" + digits10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += (i % 2 === 0 ? 1 : 3) * Number(core[i]);
  const check = (10 - (sum % 10)) % 10;
  return core + String(check);
}

/** Normalise un ISBN (10 ou 13, avec ou sans tirets) vers sa forme ISBN-13. */
function normalizeIsbn13(raw: string): string | null {
  const digits = raw.replace(/[^0-9Xx]/g, "");
  if (digits.length === 13) return digits;
  if (digits.length === 10) return isbn10to13(digits);
  return null;
}

export async function GET(req: Request) {
  const isbn = new URL(req.url).searchParams.get("isbn")?.replace(/[^0-9Xx]/g, "");
  if (!isbn) return NextResponse.json({ result: null });

  try {
    const params = new URLSearchParams({
      version: "1.2",
      operation: "searchRetrieve",
      query: `bib.fuzzyIsbn="${isbn}"`,
      recordSchema: "unimarcXchange",
      maximumRecords: "1",
    });
    const res = await fetch(`https://catalogue.bnf.fr/api/SRU?${params.toString()}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return NextResponse.json({ result: null });
    const xml = await res.text();

    // bib.fuzzyIsbn matche large (utile pour retrouver un ISBN-13 catalogué
    // sous sa forme ISBN-10 côté BnF) : on vérifie qu'un des ISBN du disque
    // renvoyé correspond bien à celui recherché avant de faire confiance au
    // titre/auteur, pour ne jamais renvoyer le mauvais livre.
    const queried = normalizeIsbn13(isbn);
    const candidateIsbns = [
      ...extractAllSubfields(xml, "010", "a"),
      ...extractAllSubfields(xml, "073", "a"),
    ].map(normalizeIsbn13).filter(Boolean);
    if (!queried || !candidateIsbns.includes(queried)) {
      return NextResponse.json({ result: null });
    }

    const title200 = extractDatafield(xml, "200");
    const title = title200 ? extractSubfield(title200, "a") : null;
    if (!title) return NextResponse.json({ result: null });

    const author = title200 ? extractSubfield(title200, "f") : null;
    const publish210 = extractDatafield(xml, "210");
    const yearRaw = publish210 ? extractSubfield(publish210, "d") : null;
    const yearMatch = yearRaw?.match(/\d{4}/);

    return NextResponse.json({
      result: {
        title,
        author: author || null,
        year: yearMatch ? Number(yearMatch[0]) : null,
      },
    });
  } catch {
    return NextResponse.json({ result: null });
  }
}
