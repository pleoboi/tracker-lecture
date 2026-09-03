import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// NEXT_PUBLIC_ADMIN_EMAIL, pas ADMIN_EMAIL (qui n'existe nulle part, même bug
// que dans search-books) — la route rejetait systématiquement l'appel.
const ADMIN_EMAIL  = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

type BookRow = {
  id: string;
  user_id: string;
  title: string;
  author: string;
  isbn13: string | null;
  cover_url: string | null;
  summary: string | null;
  genre: string | null;
  published_year: number | null;
  pages: number;
  rating: number | null;
  notes: string | null;
  status: string;
  date_read: string | null;
  date_started: string | null;
  import_source: string | null;
};

export type AffectedEntry = {
  bookId: string;
  userId: string;
  memberName: string;
  originalTitle: string;
  action: "update_metadata" | "deduplicate";
  targetBookId?: string;
};

export async function POST(req: NextRequest) {
  const { sourceIds, targetId, callerEmail, dryRun } =
    (await req.json()) as {
      sourceIds?: string[];
      targetId?: string;
      callerEmail?: string;
      dryRun?: boolean;
    };

  if (!callerEmail || callerEmail !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (!sourceIds?.length || !targetId) {
    return NextResponse.json({ error: "sourceIds et targetId requis" }, { status: 400 });
  }
  if (sourceIds.includes(targetId)) {
    return NextResponse.json({ error: "La cible ne peut pas être dans les sources" }, { status: 400 });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Charger le livre cible (métadonnées de référence) ────────────────────────
  const { data: tgtData } = await db.from("books").select("*").eq("id", targetId).single();
  if (!tgtData) {
    return NextResponse.json({ error: "Le livre cible est introuvable" }, { status: 404 });
  }
  const target = tgtData as BookRow;

  // ── Charger les profils pour les noms d'affichage ────────────────────────────
  const { data: allProfiles } = await db.from("user_profiles").select("id, display_name");
  const nameMap = new Map(
    (allProfiles ?? []).map((p: { id: string; display_name: string }) => [p.id, p.display_name])
  );

  // ── Construire la liste des entrées affectées ────────────────────────────────
  // Pour chaque source sélectionné par l'admin :
  //   - Si l'utilisateur propriétaire de cette source a déjà la cible → fusion (transfer + delete)
  //   - Sinon → mise à jour des métadonnées de l'entrée source
  const affected: AffectedEntry[] = [];
  const seenBookIds = new Set<string>();

  for (const sourceId of sourceIds) {
    if (seenBookIds.has(sourceId)) continue;
    seenBookIds.add(sourceId);

    const { data: srcData } = await db.from("books").select("*").eq("id", sourceId).single();
    if (!srcData) continue;
    const source = srcData as BookRow;

    // Ce membre a-t-il déjà un livre correspondant à la cible (autre que lui-même) ?
    const { data: sameUserBooks } = await db
      .from("books")
      .select("id, title, isbn13")
      .eq("user_id", source.user_id)
      .neq("id", sourceId);

    const frenchVersion = (sameUserBooks ?? []).find((b: { id: string; title: string; isbn13: string | null }) => {
      if (b.id === targetId) return true;
      if (target.isbn13 && b.isbn13 && b.isbn13 === target.isbn13) return true;
      return normTitle(b.title) === normTitle(target.title);
    });

    affected.push({
      bookId:        sourceId,
      userId:        source.user_id,
      memberName:    nameMap.get(source.user_id) ?? "Inconnu",
      originalTitle: source.title,
      action:        frenchVersion ? "deduplicate" : "update_metadata",
      targetBookId:  frenchVersion?.id ?? targetId,
    });
  }

  // ── Mode prévisualisation ────────────────────────────────────────────────────
  if (dryRun) {
    return NextResponse.json({ affected, count: affected.length });
  }

  // ── Application ─────────────────────────────────────────────────────────────
  const targetMeta = {
    title:          target.title,
    author:         target.author,
    isbn13:         target.isbn13,
    cover_url:      target.cover_url,
    summary:        target.summary,
    genre:          target.genre,
    published_year: target.published_year,
    pages:          target.pages,
  };

  let updated = 0;
  let deduplicated = 0;
  const errors: string[] = [];

  for (const entry of affected) {
    if (entry.action === "update_metadata") {
      // Remplacer les métadonnées en conservant les données personnelles
      const { error } = await db.from("books").update(targetMeta).eq("id", entry.bookId);
      if (error) errors.push(`update ${entry.bookId}: ${error.message}`);
      else updated++;

    } else if (entry.action === "deduplicate" && entry.targetBookId) {
      // Transférer les reading_logs
      const { error: logsErr } = await db
        .from("reading_logs")
        .update({ book_id: entry.targetBookId })
        .eq("book_id", entry.bookId);
      if (logsErr) { errors.push(`logs ${entry.bookId}: ${logsErr.message}`); continue; }

      // Fusionner notes/rating si l'entrée française est vide
      const { data: srcFull } = await db.from("books").select("notes, rating, pages").eq("id", entry.bookId).single();
      const { data: tgtFull } = await db.from("books").select("notes, rating, pages").eq("id", entry.targetBookId).single();
      const src = srcFull as { notes: string | null; rating: number | null; pages: number } | null;
      const tgt = tgtFull as { notes: string | null; rating: number | null; pages: number } | null;
      if (src && tgt) {
        await db.from("books").update({
          notes:  tgt.notes  ?? src.notes,
          rating: tgt.rating ?? src.rating,
          pages:  Math.max(tgt.pages ?? 0, src.pages ?? 0) || tgt.pages,
        }).eq("id", entry.targetBookId);
      }

      // Supprimer la source
      const { error: delErr } = await db.from("books").delete().eq("id", entry.bookId);
      if (delErr) errors.push(`delete ${entry.bookId}: ${delErr.message}`);
      else deduplicated++;
    }
  }

  return NextResponse.json({ ok: true, updated, deduplicated, errors: errors.length ? errors : undefined, affected });
}

function normTitle(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ").trim();
}
