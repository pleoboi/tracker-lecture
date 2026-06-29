import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_EMAIL  = process.env.ADMIN_EMAIL ?? "";

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

// Normalise un titre pour comparaison (retire accents, ponctuation, casse)
function normTitle(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ").trim();
}

// True si les titres partagent suffisamment de mots longs
function titlesMatch(a: string, b: string): boolean {
  const words = (s: string) =>
    new Set(normTitle(s).split(" ").filter((w) => w.length >= 4));
  const wa = words(a), wb = words(b);
  if (!wa.size || !wb.size) return false;
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  return common / Math.min(wa.size, wb.size) >= 0.65;
}

// True si le nom d'auteur correspond (on compare juste le dernier mot/nom de famille)
function authorsMatch(a: string, b: string): boolean {
  const surname = (s: string) =>
    normTitle(s).split(" ").filter(Boolean).pop() ?? "";
  const sa = surname(a), sb = surname(b);
  return !sa || !sb || sa === sb || sa.includes(sb) || sb.includes(sa);
}

export async function POST(req: NextRequest) {
  const { sourceId, targetId, callerEmail, dryRun } =
    (await req.json()) as {
      sourceId?: string;
      targetId?: string;
      callerEmail?: string;
      dryRun?: boolean;
    };

  if (!callerEmail || callerEmail !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (!sourceId || !targetId || sourceId === targetId) {
    return NextResponse.json({ error: "IDs source et cible requis et distincts" }, { status: 400 });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── 1. Charger les deux livres de référence ──────────────────────────────────
  const [{ data: srcData }, { data: tgtData }] = await Promise.all([
    db.from("books").select("*").eq("id", sourceId).single(),
    db.from("books").select("*").eq("id", targetId).single(),
  ]);

  if (!srcData || !tgtData) {
    return NextResponse.json({ error: "Un des deux livres est introuvable" }, { status: 404 });
  }

  const source = srcData as BookRow;
  const target = tgtData as BookRow;

  // ── 2. Trouver TOUS les livres qui ressemblent au source (toutes langues, tous membres) ─
  // Critères : même ISBN13, ou même titre + même auteur
  const { data: allBooks } = await db
    .from("books")
    .select("*")
    .neq("id", targetId); // garder targetId hors du scope

  const candidates = ((allBooks ?? []) as BookRow[]).filter((b) => {
    if (b.id === targetId) return false;
    // Correspondance ISBN13 (éditions différentes, même œuvre)
    if (source.isbn13 && b.isbn13 && b.isbn13 === source.isbn13) return true;
    // Correspondance titre + auteur (pour livres sans ISBN ou ISBN différent)
    return titlesMatch(b.title, source.title) && authorsMatch(b.author, source.author);
  });

  // ── 3. Pour chaque doublon, calculer l'action à appliquer ────────────────────
  // Charger les profils pour les noms d'affichage
  const userIds = [...new Set(candidates.map((b) => b.user_id))];
  const { data: profiles } = await db
    .from("user_profiles")
    .select("id, display_name")
    .in("id", userIds);
  const nameMap = new Map(
    (profiles ?? []).map((p: { id: string; display_name: string }) => [p.id, p.display_name])
  );

  type AffectedEntry = {
    bookId: string;
    userId: string;
    memberName: string;
    originalTitle: string;
    action: "update_metadata" | "deduplicate";
    targetBookId?: string; // pour l'action "deduplicate"
  };

  const affected: AffectedEntry[] = [];

  for (const dup of candidates) {
    // Chercher si ce membre a déjà un exemplaire correspondant au TARGET
    const sameUserTarget = ((allBooks ?? []) as BookRow[]).find(
      (b) =>
        b.user_id === dup.user_id &&
        b.id !== dup.id &&
        (
          (target.isbn13 && b.isbn13 && b.isbn13 === target.isbn13) ||
          (titlesMatch(b.title, target.title) && authorsMatch(b.author, target.author))
        )
    );

    affected.push({
      bookId:        dup.id,
      userId:        dup.user_id,
      memberName:    nameMap.get(dup.user_id) ?? "Inconnu",
      originalTitle: dup.title,
      action:        sameUserTarget ? "deduplicate" : "update_metadata",
      targetBookId:  sameUserTarget?.id,
    });
  }

  // ── Mode prévisualisation : on retourne sans modifier ───────────────────────
  if (dryRun) {
    return NextResponse.json({ affected, count: affected.length });
  }

  // ── 4. Application des fusions ───────────────────────────────────────────────
  const targetMeta = {
    title:          target.title,
    author:         target.author,
    isbn13:         target.isbn13,
    cover_url:      target.cover_url,
    summary:        target.summary,
    genre:          target.genre,
    published_year: target.published_year,
    pages:          target.pages || source.pages,
  };

  let updated = 0;
  let deduplicated = 0;
  const errors: string[] = [];

  for (const entry of affected) {
    if (entry.action === "update_metadata") {
      // Basculer l'entrée vers les métadonnées françaises en conservant les données personnelles
      const { error } = await db
        .from("books")
        .update(targetMeta)
        .eq("id", entry.bookId);
      if (error) errors.push(`update ${entry.bookId}: ${error.message}`);
      else updated++;

    } else if (entry.action === "deduplicate" && entry.targetBookId) {
      // Ce membre a déjà la version française : transférer les reading_logs et supprimer le doublon
      const { error: logsErr } = await db
        .from("reading_logs")
        .update({ book_id: entry.targetBookId })
        .eq("book_id", entry.bookId);

      if (logsErr) {
        errors.push(`logs ${entry.bookId}: ${logsErr.message}`);
        continue;
      }

      // Enrichir le livre français de ce membre si ses données sont meilleures
      const { data: dupBook } = await db.from("books").select("*").eq("id", entry.bookId).single();
      const dup = dupBook as BookRow | null;
      if (dup) {
        const { data: frBook } = await db.from("books").select("*").eq("id", entry.targetBookId).single();
        const fr = frBook as BookRow | null;
        if (fr) {
          await db.from("books").update({
            notes:  fr.notes  ?? dup.notes,
            rating: fr.rating ?? dup.rating,
            pages:  Math.max(fr.pages ?? 0, dup.pages ?? 0) || fr.pages,
          }).eq("id", entry.targetBookId);
        }
      }

      const { error: delErr } = await db.from("books").delete().eq("id", entry.bookId);
      if (delErr) errors.push(`delete ${entry.bookId}: ${delErr.message}`);
      else deduplicated++;
    }
  }

  // ── 5. Mettre à jour les quiz du source ──────────────────────────────────────
  await db
    .from("book_quizzes")
    .update({ quiz_key: `book-${targetId}` })
    .eq("quiz_key", `book-${sourceId}`);

  return NextResponse.json({
    ok: true,
    updated,
    deduplicated,
    errors: errors.length ? errors : undefined,
    affected,
  });
}
