import { adminSupabase, sendPushToUser } from "./push.server";

// MangaDex bloque les appels navigateur (challenge anti-bot) mais répond
// normalement côté serveur avec un User-Agent identifiable.
const MD = "https://api.mangadex.org";
const UA = "Swena/1.0 (tracker de lecture perso)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function md<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${MD}${path}`, { headers: { "User-Agent": UA }, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type MdManga = { id: string; attributes: { links?: Record<string, string> | null } };
type MdChapter = {
  id: string;
  attributes: {
    chapter: string | null;
    title: string | null;
    translatedLanguage: string;
    externalUrl: string | null;
    publishAt: string;
  };
};

/** Retrouve la série MangaDex correspondant à un id AniList (MangaDex stocke le lien "al"). */
export async function resolveMangadexId(title: string, anilistId: number | null): Promise<string | null> {
  if (!anilistId) return null;
  const q = new URLSearchParams({ title, limit: "15" });
  ["safe", "suggestive", "erotica"].forEach((c) => q.append("contentRating[]", c));
  const json = await md<{ data: MdManga[] }>(`/manga?${q}`);
  const hit = json?.data?.find((m) => m.attributes.links?.al === String(anilistId));
  return hit?.id ?? null;
}

export type LatestChapter = { number: number; title: string | null; at: string; url: string };

/** Dernier chapitre sorti en français, lien officiel (MANGA Plus...) quand MangaDex le connaît. */
export async function fetchLatestChapter(mangadexId: string): Promise<LatestChapter | null> {
  const q = new URLSearchParams({ manga: mangadexId, limit: "20", "order[chapter]": "desc" });
  q.append("translatedLanguage[]", "fr");
  ["safe", "suggestive", "erotica"].forEach((c) => q.append("contentRating[]", c));
  const json = await md<{ data: MdChapter[] }>(`/chapter?${q}`);
  const chapters = (json?.data ?? []).filter((c) => c.attributes.chapter && !isNaN(Number(c.attributes.chapter)));
  if (!chapters.length) return null;
  const max = Math.max(...chapters.map((c) => Number(c.attributes.chapter)));
  const same = chapters.filter((c) => Number(c.attributes.chapter) === max);
  // Lien officiel en priorité pour la lecture
  const official = same.find((c) => c.attributes.externalUrl);
  const ref = official ?? same[0];
  return {
    number: max,
    title: ref.attributes.title,
    at: same.map((c) => c.attributes.publishAt).sort()[0],
    url: official?.attributes.externalUrl ?? `https://mangadex.org/chapter/${ref.id}`,
  };
}

type Row = {
  id: number;
  user_id: string;
  title: string;
  anilist_id: number | null;
  mangadex_id: string | null;
  latest_chapter: number | null;
  current_chapter: number;
  status: string;
};

/**
 * Met à jour le dernier chapitre sorti pour les lignes données (et toutes les
 * lignes des autres membres qui partagent la même série), puis prévient par
 * push les membres qui lisent la série quand un nouveau chapitre apparaît.
 * Pas de notification au premier remplissage (latest_chapter encore vide).
 */
export async function refreshReleases(rows: Row[], opts: { skipNotifyUserId?: string } = {}) {
  const now = new Date().toISOString();
  let checked = 0;
  let released = 0;

  // 1. Rattacher les séries qui n'ont pas encore d'id MangaDex
  for (const r of rows.filter((r) => !r.mangadex_id && r.anilist_id)) {
    const mdId = await resolveMangadexId(r.title, r.anilist_id);
    await sleep(250);
    if (mdId) {
      r.mangadex_id = mdId;
      await adminSupabase.from("mangas").update({ mangadex_id: mdId }).eq("anilist_id", r.anilist_id!).is("mangadex_id", null);
    } else {
      // Pas trouvé : on note la vérification pour ne pas réessayer à chaque ouverture
      await adminSupabase.from("mangas").update({ latest_checked_at: now }).eq("id", r.id);
    }
  }

  // 2. Un appel par série, pas par membre
  const ids = [...new Set(rows.map((r) => r.mangadex_id).filter(Boolean))] as string[];
  for (const mdId of ids) {
    const latest = await fetchLatestChapter(mdId);
    await sleep(250);
    checked++;
    if (!latest) {
      await adminSupabase.from("mangas").update({ latest_checked_at: now }).eq("mangadex_id", mdId);
      continue;
    }

    const { data: all } = await adminSupabase
      .from("mangas")
      .select("id, user_id, title, latest_chapter, current_chapter, status")
      .eq("mangadex_id", mdId);
    const members = (all ?? []) as Row[];

    await adminSupabase
      .from("mangas")
      .update({
        latest_chapter: latest.number,
        latest_chapter_title: latest.title,
        latest_chapter_at: latest.at,
        latest_chapter_url: latest.url,
        latest_checked_at: now,
      })
      .eq("mangadex_id", mdId);

    for (const m of members) {
      const isNew = m.latest_chapter != null && latest.number > Number(m.latest_chapter);
      if (!isNew || m.status !== "reading" || m.user_id === opts.skipNotifyUserId) continue;
      released++;
      await sendPushToUser(
        m.user_id,
        {
          title: `${m.title} · chapitre ${latest.number}`,
          body: latest.title ? `« ${latest.title} » est sorti.` : "Un nouveau chapitre vient de sortir.",
          url: `/manga/${m.id}`,
        },
        "manga",
      );
    }
  }

  return { checked, released };
}

/** Séries à surveiller : uniquement celles en cours de parution (pas les séries finies ni en hiatus, ex. Vagabond). */
export const RELEASE_ROW_SELECT = "id, user_id, title, anilist_id, mangadex_id, latest_chapter, current_chapter, status, publication_status, total_chapters, latest_checked_at";

export function needsReleaseTracking(r: { publication_status: string | null; status: string }) {
  if (r.status === "completed" || r.status === "abandoned") return false;
  return r.publication_status === "RELEASING";
}

/* ---------------- Couvertures de tomes ---------------- */

type MdCover = { attributes: { volume: string | null; locale: string | null; fileName: string } };

/** Tome qui contient un chapitre donné (agrégat MangaDex, toutes langues). */
async function volumeOfChapter(mangadexId: string, chapter: number): Promise<number | null> {
  const json = await md<{ volumes?: Record<string, { volume: string; chapters: Record<string, unknown> }> }>(
    `/manga/${mangadexId}/aggregate`
  );
  for (const v of Object.values(json?.volumes ?? {})) {
    if (v.volume === "none") continue;
    if (Object.keys(v.chapters).some((c) => Math.floor(Number(c)) === chapter)) return Number(v.volume);
  }
  return null;
}

/**
 * Couverture du tome lu (ou du tome qui contient le chapitre lu). Édition
 * française en priorité, sinon japonaise. Si le tome n'a pas encore de
 * couverture (chapitres pas encore reliés), on prend le dernier tome connu.
 */
export async function findLogCover(mangadexId: string, unit: "chapter" | "volume", value: number): Promise<string | null> {
  const vol = unit === "volume" ? value : await volumeOfChapter(mangadexId, value);
  const covers: MdCover[] = [];
  for (let offset = 0; offset < 300; offset += 100) {
    const json = await md<{ data: MdCover[]; total: number }>(
      `/cover?manga[]=${mangadexId}&limit=100&offset=${offset}&order[volume]=asc`
    );
    covers.push(...(json?.data ?? []));
    if (!json || covers.length >= json.total) break;
  }
  const numbered = covers.filter((c) => c.attributes.volume && !isNaN(Number(c.attributes.volume)));
  if (!numbered.length) return null;
  const rank = (c: MdCover) => (c.attributes.locale === "fr" ? 0 : c.attributes.locale === "ja" ? 1 : 2);
  const vols = [...new Set(numbered.map((c) => Number(c.attributes.volume)))].sort((a, b) => a - b);
  const target = vol != null ? [...vols].reverse().find((v) => v <= vol) ?? vols[0] : vols[vols.length - 1];
  const best = numbered.filter((c) => Number(c.attributes.volume) === target).sort((a, b) => rank(a) - rank(b))[0];
  return `https://uploads.mangadex.org/covers/${mangadexId}/${best.attributes.fileName}.256.jpg`;
}

/* ---------------- Flux MANGA Plus (toutes séries, VF) ---------------- */

// Groupe officiel "MangaPlus" sur MangaDex : uniquement des chapitres publiés
// par Shueisha, avec leur lien MANGA Plus (externalUrl).
const MANGAPLUS_GROUP = "4f1de6a2-f0c5-4ac5-bce5-02c7dbb67deb";

type MdChapterWithManga = MdChapter & {
  relationships: { id: string; type: string; attributes?: { title?: Record<string, string>; links?: Record<string, string> | null } }[];
};

/**
 * Récupère les dernières sorties MANGA Plus en français et les enregistre dans
 * manga_releases. Numéro, titre et lien viennent de la même entrée MangaDex :
 * le chapitre annoncé est toujours celui vers lequel mène le lien.
 */
export async function syncMangaPlusReleases(): Promise<{ fetched: number; inserted: number; notified?: number }> {
  const q = new URLSearchParams({ limit: "100", "order[readableAt]": "desc" });
  q.append("groups[]", MANGAPLUS_GROUP);
  q.append("translatedLanguage[]", "fr");
  q.append("includes[]", "manga");
  ["safe", "suggestive", "erotica"].forEach((c) => q.append("contentRating[]", c));
  const json = await md<{ data: MdChapterWithManga[] }>(`/chapter?${q}`);
  const chapters = (json?.data ?? []).filter(
    (c) => c.attributes.externalUrl && c.attributes.chapter && !isNaN(Number(c.attributes.chapter))
  );
  if (!chapters.length) return { fetched: 0, inserted: 0 };

  // Ne garder que les chapitres pas encore connus
  const ids = chapters.map((c) => c.id);
  const { data: known } = await adminSupabase.from("manga_releases").select("mangadex_chapter_id").in("mangadex_chapter_id", ids);
  const knownSet = new Set(((known ?? []) as { mangadex_chapter_id: string }[]).map((k) => k.mangadex_chapter_id));
  const fresh = chapters.filter((c) => !knownSet.has(c.id));
  if (!fresh.length) return { fetched: chapters.length, inserted: 0 };

  // Couvertures des séries concernées (un seul appel)
  const mangaIds = [...new Set(fresh.map((c) => c.relationships.find((r) => r.type === "manga")!.id))];
  const mq = new URLSearchParams({ limit: "100" });
  mangaIds.forEach((id) => mq.append("ids[]", id));
  mq.append("includes[]", "cover_art");
  ["safe", "suggestive", "erotica"].forEach((c) => mq.append("contentRating[]", c));
  const mangaJson = await md<{ data: { id: string; relationships: { type: string; attributes?: { fileName?: string } }[] }[] }>(`/manga?${mq}`);
  const coverOf = new Map<string, string>();
  for (const m of mangaJson?.data ?? []) {
    const file = m.relationships.find((r) => r.type === "cover_art")?.attributes?.fileName;
    if (file) coverOf.set(m.id, `https://uploads.mangadex.org/covers/${m.id}/${file}.256.jpg`);
  }

  const rows = fresh.map((c) => {
    const rel = c.relationships.find((r) => r.type === "manga")!;
    const t = rel.attributes?.title ?? {};
    const al = rel.attributes?.links?.al;
    return {
      mangadex_chapter_id: c.id,
      mangadex_manga_id: rel.id,
      anilist_id: al && !isNaN(Number(al)) ? Number(al) : null,
      series_title: t.en || t["ja-ro"] || t.fr || Object.values(t)[0] || "Série",
      chapter: Number(c.attributes.chapter),
      chapter_title: c.attributes.title,
      url: c.attributes.externalUrl!,
      cover_url: coverOf.get(rel.id) ?? null,
      released_at: c.attributes.publishAt,
    };
  });
  await adminSupabase.from("manga_releases").upsert(rows, { onConflict: "mangadex_chapter_id", ignoreDuplicates: true });

  // Prévient tout de suite les lecteurs des séries concernées : une seule fois
  // par chapitre (latest_chapter mis à jour juste après), au numéro et au lien
  // exacts de la sortie MANGA Plus.
  const newestBySeries = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const cur = newestBySeries.get(r.mangadex_manga_id);
    if (!cur || r.chapter > cur.chapter) newestBySeries.set(r.mangadex_manga_id, r);
  }
  let notified = 0;
  for (const r of newestBySeries.values()) {
    const filter = r.anilist_id ? `mangadex_id.eq.${r.mangadex_manga_id},anilist_id.eq.${r.anilist_id}` : `mangadex_id.eq.${r.mangadex_manga_id}`;
    const { data: readers } = await adminSupabase
      .from("mangas")
      .select("id, user_id, title, status, current_chapter, latest_chapter, publication_status")
      .or(filter);
    for (const m of (readers ?? []) as { id: number; user_id: string; title: string; status: string; current_chapter: number; latest_chapter: number | null; publication_status: string | null }[]) {
      if (m.publication_status !== "RELEASING") continue;
      if (m.latest_chapter != null && Number(m.latest_chapter) >= r.chapter) continue;
      await adminSupabase
        .from("mangas")
        .update({
          mangadex_id: r.mangadex_manga_id,
          latest_chapter: r.chapter,
          latest_chapter_title: r.chapter_title,
          latest_chapter_at: r.released_at,
          latest_chapter_url: r.url,
          latest_checked_at: new Date().toISOString(),
        })
        .eq("id", m.id);
      if (m.status !== "reading" || m.current_chapter >= r.chapter) continue;
      notified++;
      await sendPushToUser(
        m.user_id,
        {
          title: `${m.title} · chapitre ${Math.floor(r.chapter)}`,
          body: r.chapter_title ? `« ${r.chapter_title} » est sorti en VF sur MANGA Plus.` : "Un nouveau chapitre est sorti en VF sur MANGA Plus.",
          url: `/manga/${m.id}`,
        },
        "manga",
      );
    }
  }
  return { fetched: chapters.length, inserted: rows.length, notified };
}
