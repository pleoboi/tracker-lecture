import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type OLWork = { description?: string | { value?: string } };

/**
 * Résumé d'une œuvre Open Library. La recherche (search.json, utilisée pour
 * le "Ajouter un livre" des book clubs) ne renvoie jamais de description —
 * il faut interroger la fiche œuvre elle-même.
 */
export async function GET(req: NextRequest) {
  const workId = new URL(req.url).searchParams.get("workId")?.trim();
  if (!workId || !/^OL\d+W$/i.test(workId)) {
    return NextResponse.json({ description: null });
  }
  try {
    const res = await fetch(`https://openlibrary.org/works/${workId}.json`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return NextResponse.json({ description: null });
    const data = (await res.json()) as OLWork;
    const desc = typeof data.description === "string" ? data.description : data.description?.value ?? null;
    return NextResponse.json({ description: desc?.trim() || null });
  } catch {
    return NextResponse.json({ description: null });
  }
}
