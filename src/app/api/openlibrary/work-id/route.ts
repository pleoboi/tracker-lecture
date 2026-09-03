import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CHUNK_SIZE = 20;
const MAX_ISBNS = 400;

type OLDetails = { works?: { key: string }[] };
type OLEntry = { details?: OLDetails };

/**
 * Résout, par lot, l'identifiant "œuvre" Open Library de chaque ISBN fourni.
 * Un ISBN identifie une édition précise (langue, éditeur…) ; le work id
 * regroupe toutes les éditions/traductions d'un même livre — ce qui permet de
 * détecter des doublons entre une édition anglaise et sa traduction française,
 * ce qu'aucune comparaison d'ISBN ou de titre ne peut faire.
 */
async function resolveChunk(isbns: string[]): Promise<Record<string, string | null>> {
  const bibkeys = isbns.map((isbn) => `ISBN:${isbn}`).join(",");
  const url = `https://openlibrary.org/api/books?bibkeys=${encodeURIComponent(bibkeys)}&format=json&jscmd=details`;
  const result: Record<string, string | null> = {};
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return result;
    const data = (await res.json()) as Record<string, OLEntry>;
    for (const isbn of isbns) {
      const workKey = data[`ISBN:${isbn}`]?.details?.works?.[0]?.key; // "/works/OL...W"
      result[isbn] = workKey ? workKey.replace("/works/", "") : null;
    }
  } catch {
    // Open Library indisponible : on laisse simplement ces ISBN non résolus.
  }
  return result;
}

export async function POST(req: NextRequest) {
  const { isbns } = (await req.json()) as { isbns?: string[] };
  const unique = [...new Set((isbns ?? []).filter((s): s is string => !!s?.trim()))].slice(0, MAX_ISBNS);
  if (!unique.length) return NextResponse.json({ workIds: {} });

  const workIds: Record<string, string | null> = {};
  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    Object.assign(workIds, await resolveChunk(chunk));
  }

  return NextResponse.json({ workIds });
}
