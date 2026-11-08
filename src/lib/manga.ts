import { supabase } from "./supabase";

export type MangaStatus = "reading" | "completed" | "to-read" | "paused" | "abandoned";
export type MangaUnit = "chapter" | "volume";

export interface Manga {
  id: number;
  created_at: string;
  user_id: string;
  title: string;
  title_native?: string | null;
  author?: string | null;
  cover_url?: string | null;
  anilist_id?: number | null;
  format?: string | null;
  publication_status?: string | null;
  total_chapters?: number | null;
  total_volumes?: number | null;
  genres?: string[] | null;
  published_year?: number | null;
  status: MangaStatus;
  current_chapter: number;
  current_volume: number;
  rating?: number | null;
  notes?: string | null;
  date_started?: string | null;
  date_finished?: string | null;
  mangadex_id?: string | null;
  latest_chapter?: number | null;
  latest_chapter_title?: string | null;
  latest_chapter_at?: string | null;
  latest_chapter_url?: string | null;
  latest_checked_at?: string | null;
  read_url?: string | null;
  read_url_volume?: string | null;
  last_unit?: MangaUnit | null;
  summary?: string | null;
  summary_source?: string | null;
  summary_url?: string | null;
}

export interface MangaLog {
  id: number;
  created_at?: string;
  user_id: string;
  manga_id: number;
  date: string;
  unit: MangaUnit;
  amount: number;
  end_value: number;
  notes?: string | null;
  cover_url?: string | null;
}

export const MANGA_STATUS_LABELS: Record<MangaStatus, string> = {
  reading: "En cours",
  "to-read": "À lire",
  paused: "En pause",
  completed: "Terminé",
  abandoned: "Abandonné",
};

export const MANGA_STATUS_ORDER: MangaStatus[] = ["reading", "to-read", "paused", "completed", "abandoned"];

const PUBLICATION_LABELS: Record<string, string> = {
  FINISHED: "Série terminée",
  RELEASING: "En cours de parution",
  HIATUS: "En pause (hiatus)",
  CANCELLED: "Arrêtée",
  NOT_YET_RELEASED: "Pas encore sortie",
};

export function publicationLabel(s?: string | null): string | null {
  return s ? PUBLICATION_LABELS[s] ?? null : null;
}

const FORMAT_LABELS: Record<string, string> = {
  MANGA: "Manga",
  ONE_SHOT: "One shot",
  NOVEL: "Light novel",
};

/** AniList ne distingue pas manhwa / manhua par le format, mais par le pays d'origine. */
export function formatLabel(format?: string | null): string | null {
  if (!format) return null;
  return FORMAT_LABELS[format] ?? format.charAt(0) + format.slice(1).toLowerCase();
}

export function unitLabel(unit: MangaUnit, n: number, short = false): string {
  if (short) return unit === "chapter" ? "ch." : "t.";
  if (unit === "chapter") return n > 1 ? "chapitres" : "chapitre";
  return n > 1 ? "tomes" : "tome";
}

/** Série encore en cours de parution : pas de fin connue (One Piece...). Une série en hiatus (Vagabond) n'en fait pas partie. */
export function isOngoing(m: Pick<Manga, "publication_status">): boolean {
  return m.publication_status === "RELEASING";
}

/**
 * Retard sur le dernier chapitre sorti (séries en cours de parution).
 * Le numéro vient UNIQUEMENT de la source qui fournit aussi le lien officiel
 * (latest_chapter / latest_chapter_url) : jamais d'annonce d'un chapitre vers
 * lequel le bouton "Lire" ne mène pas. Le total saisi à la main est ignoré ici.
 */
export function releaseState(m: Manga): { latest: number; behind: number; upToDate: boolean } | null {
  if (!isOngoing(m) || m.latest_chapter == null) return null;
  const latest = Math.floor(Number(m.latest_chapter));
  if (latest <= 0) return null;
  const behind = Math.max(0, latest - m.current_chapter);
  return { latest, behind, upToDate: behind === 0 };
}

/**
 * Bouton "Lire" : l'URL ET le libellé qui annonce exactement où elle mène.
 * - deux liens perso possibles (chapitres / tomes) : on prend celui de l'unité
 *   de la dernière session, ou le seul rempli ;
 * - lien avec {chapitre} / {tome} : prochain chapitre / tome à lire ;
 * - lien fixe (Drive...) : pas de numéro, on ne promet rien ;
 * - sinon lien officiel du dernier chapitre sorti, au numéro de latest_chapter.
 */
export function readTarget(m: Manga): { url: string; label: string } | null {
  const personal =
    m.read_url && m.read_url_volume
      ? m.last_unit === "volume" ? m.read_url_volume : m.read_url
      : m.read_url || m.read_url_volume;
  if (personal) {
    const nextCh = m.current_chapter + 1;
    const nextVol = m.current_volume + 1;
    const url = personal.replace(/{chapitre}/gi, String(nextCh)).replace(/{tome}/gi, String(nextVol));
    const label = /{chapitre}/i.test(personal)
      ? `Lire le ch. ${nextCh}`
      : /{tome}/i.test(personal)
        ? `Lire le tome ${nextVol}`
        : "Lire";
    return { url, label };
  }
  if (m.latest_chapter_url && m.latest_chapter != null) {
    return { url: m.latest_chapter_url, label: `Lire le ch. ${Math.floor(Number(m.latest_chapter))}` };
  }
  return null;
}

/** Progression 0..1 sur l'unité la plus parlante pour la série. */
export function mangaProgress(m: Manga): { value: number; label: string } | null {
  // Série sans fin : on mesure par rapport au dernier chapitre sorti
  const rs = releaseState(m);
  if (rs && rs.latest > 0 && m.current_chapter > 0) {
    return {
      value: Math.min(1, m.current_chapter / rs.latest),
      label: rs.upToDate ? "À jour" : `${rs.behind} ch. de retard`,
    };
  }
  if (m.total_chapters && m.current_chapter > 0) {
    return {
      value: Math.min(1, m.current_chapter / m.total_chapters),
      label: `Ch. ${m.current_chapter} / ${m.total_chapters}`,
    };
  }
  if (m.total_volumes && m.current_volume > 0) {
    return {
      value: Math.min(1, m.current_volume / m.total_volumes),
      label: `T. ${m.current_volume} / ${m.total_volumes}`,
    };
  }
  return null;
}

/** Résumé court de l'avancement : "Ch. 1045 · T. 12" */
export function progressSummary(m: Manga): string {
  const parts: string[] = [];
  const latest = releaseState(m)?.latest ?? null;
  if (m.current_chapter > 0) parts.push(`Ch. ${m.current_chapter}${latest ? ` / ${latest} sortis` : m.total_chapters ? ` / ${m.total_chapters}` : ""}`);
  if (m.current_volume > 0) parts.push(`T. ${m.current_volume}${m.total_volumes ? ` / ${m.total_volumes}` : ""}`);
  return parts.join(" · ") || "Pas commencé";
}

/* ---------------- AniList ---------------- */

export interface AniListResult {
  anilist_id: number;
  title: string;
  title_native: string | null;
  author: string | null;
  cover_url: string | null;
  format: string | null;
  country: string | null;
  publication_status: string | null;
  total_chapters: number | null;
  total_volumes: number | null;
  genres: string[];
  published_year: number | null;
}

const ANILIST_QUERY = `
query ($search: String) {
  Page(perPage: 12) {
    media(search: $search, type: MANGA, isAdult: false, sort: SEARCH_MATCH) {
      id
      title { romaji english native userPreferred }
      coverImage { large }
      format
      countryOfOrigin
      status
      chapters
      volumes
      genres
      startDate { year }
      staff(perPage: 4, sort: RELEVANCE) {
        edges { role node { name { full } } }
      }
    }
  }
}`;

type AniListMedia = {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null; userPreferred: string | null };
  coverImage: { large: string | null } | null;
  format: string | null;
  countryOfOrigin: string | null;
  status: string | null;
  chapters: number | null;
  volumes: number | null;
  genres: string[] | null;
  startDate: { year: number | null } | null;
  staff: { edges: { role: string; node: { name: { full: string } } }[] } | null;
};

/** Auteur(s) : "Story & Art" en priorité, sinon scénariste + dessinateur. */
function pickAuthor(media: AniListMedia): string | null {
  const edges = media.staff?.edges ?? [];
  const both = edges.find((e) => /story\s*&\s*art/i.test(e.role));
  if (both) return both.node.name.full;
  const names = edges
    .filter((e) => /^(story|art)\b/i.test(e.role) || /original creator/i.test(e.role))
    .map((e) => e.node.name.full);
  const unique = [...new Set(names)];
  return unique.length ? unique.slice(0, 2).join(", ") : null;
}

export async function searchAniList(query: string, signal?: AbortSignal): Promise<AniListResult[]> {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: ANILIST_QUERY, variables: { search: query } }),
    signal,
  });
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  const json = await res.json();
  const media: AniListMedia[] = json?.data?.Page?.media ?? [];
  return media.map((m) => ({
    anilist_id: m.id,
    // Titre le plus courant côté lecteurs français : romaji (One Piece, Shingeki
    // no Kyojin...) plutôt que l'anglais, qui diverge souvent des éditions FR.
    title: m.title.romaji || m.title.userPreferred || m.title.english || "Sans titre",
    title_native: m.title.native,
    author: pickAuthor(m),
    cover_url: m.coverImage?.large ?? null,
    format: m.countryOfOrigin === "KR" ? "MANHWA" : m.countryOfOrigin === "CN" ? "MANHUA" : m.format,
    country: m.countryOfOrigin,
    publication_status: m.status,
    total_chapters: m.chapters,
    total_volumes: m.volumes,
    genres: m.genres ?? [],
    published_year: m.startDate?.year ?? null,
  }));
}

/* ---------------- Données ---------------- */

export async function fetchMyMangas(userId: string): Promise<Manga[]> {
  const { data } = await supabase
    .from("mangas")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data as Manga[]) ?? [];
}

/** Tous les logs d'un membre, paginés (Supabase plafonne à 1000 lignes par requête). */
export async function fetchMyMangaLogs(userId: string, from?: string, to?: string): Promise<MangaLog[]> {
  const out: MangaLog[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    let q = supabase
      .from("manga_logs")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);
    const { data, error } = await q;
    if (error || !data) break;
    out.push(...(data as MangaLog[]));
    if (data.length < PAGE) break;
  }
  return out;
}

/**
 * Recalcule current_chapter / current_volume d'une série à partir de ses logs
 * restants (après suppression d'une session).
 */
export async function recomputeMangaProgress(mangaId: number): Promise<{ current_chapter: number; current_volume: number }> {
  const { data } = await supabase.from("manga_logs").select("unit, end_value").eq("manga_id", mangaId);
  const logs = (data as Pick<MangaLog, "unit" | "end_value">[]) ?? [];
  const current_chapter = Math.max(0, ...logs.filter((l) => l.unit === "chapter").map((l) => l.end_value));
  const current_volume = Math.max(0, ...logs.filter((l) => l.unit === "volume").map((l) => l.end_value));
  await supabase.from("mangas").update({ current_chapter, current_volume }).eq("id", mangaId);
  return { current_chapter, current_volume };
}

/** Le mode manga se déduit de l'URL : tout ce qui vit sous /manga. */
export function isMangaPath(pathname: string | null): boolean {
  return !!pathname && (pathname === "/manga" || pathname.startsWith("/manga/"));
}

/** Va chercher le descriptif (Wikipédia FR, sinon AniList) et l'enregistre sur la série. */
export async function enrichMangaSummary(
  m: Pick<Manga, "id" | "title" | "anilist_id">
): Promise<Pick<Manga, "summary" | "summary_source" | "summary_url"> | null> {
  const q = new URLSearchParams({ title: m.title });
  if (m.anilist_id) q.set("anilistId", String(m.anilist_id));
  const res = await fetch(`/api/manga/enrich?${q}`).catch(() => null);
  if (!res?.ok) return null;
  const json = await res.json();
  if (!json.summary) return null;
  const patch = { summary: json.summary as string, summary_source: json.source as string, summary_url: json.url as string };
  await supabase.from("mangas").update(patch).eq("id", m.id);
  return patch;
}

/** Une série AniList par son identifiant (ajout en un clic depuis le flux des sorties). */
export async function getAniListById(id: number): Promise<AniListResult | null> {
  const query = ANILIST_QUERY.replace("query ($search: String)", "query ($id: Int)")
    .replace("Page(perPage: 12) {", "Page(perPage: 1) {")
    .replace("media(search: $search, type: MANGA, isAdult: false, sort: SEARCH_MATCH)", "media(id: $id, type: MANGA)");
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { id } }),
  });
  if (!res.ok) return null;
  const m: AniListMedia | undefined = (await res.json())?.data?.Page?.media?.[0];
  if (!m) return null;
  return {
    anilist_id: m.id,
    title: m.title.romaji || m.title.userPreferred || m.title.english || "Sans titre",
    title_native: m.title.native,
    author: pickAuthor(m),
    cover_url: m.coverImage?.large ?? null,
    format: m.countryOfOrigin === "KR" ? "MANHWA" : m.countryOfOrigin === "CN" ? "MANHUA" : m.format,
    country: m.countryOfOrigin,
    publication_status: m.status,
    total_chapters: m.chapters,
    total_volumes: m.volumes,
    genres: m.genres ?? [],
    published_year: m.startDate?.year ?? null,
  };
}
