import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Descriptif d'une série manga : intro + début du synopsis de Wikipédia FR,
// avec repli sur la description AniList (en anglais) si rien n'est trouvé.

const UA = "Swena/1.0 (tracker de lecture perso)";
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

const MANGA_RE = /\b(manga|manhwa|manhua|webtoon|s[eé]rie de romans web|bande dessin[eé]e)\b/i;
const SYNOPSIS_RE = /^(synopsis|r[eé]sum[eé]|histoire|intrigue|sc[eé]nario)$/i;

/** Coupe proprement à la fin d'une phrase, sous `max` caractères. */
function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > max * 0.5 ? cut.slice(0, end + 1) : cut.trimEnd() + "…";
}

/** Retire les prononciations / transcriptions entre parenthèses du début (ワンピース, Wan Pīsu). */
function cleanIntro(text: string): string {
  return text.replace(/\s*\([^()]*[぀-ヿ一-鿿가-힯][^()]*\)/g, "").trim();
}

async function fromWikipedia(title: string): Promise<{ summary: string; url: string } | null> {
  const search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `${title} manga`,
    gsrlimit: "6",
    prop: "extracts",
    exintro: "1",
    explaintext: "1",
    format: "json",
    utf8: "1",
  });
  const res = await fetch(`https://fr.wikipedia.org/w/api.php?${search}`, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) return null;
  const json = await res.json();
  const pages = Object.values(json?.query?.pages ?? {}) as { title: string; index: number; extract?: string }[];
  pages.sort((a, b) => a.index - b.index);

  const want = norm(title);
  // Page dont le titre correspond à la série ("Vagabond (manga)", "One Piece"),
  // jamais les listes d'épisodes / personnages ni les adaptations.
  const candidates = pages.filter((p) => {
    const base = norm(p.title.replace(/\s*\(.*\)\s*$/, ""));
    return base === want && MANGA_RE.test(p.extract ?? "") && !/^(liste|personnages)/i.test(p.title);
  });
  const page = candidates.find((p) => /\(manga\)/i.test(p.title)) ?? candidates[0];
  if (!page?.extract) return null;

  const intro = clip(cleanIntro(page.extract.split("\n")[0]), 420);

  // Début de la section Synopsis (l'histoire), quand elle existe
  let synopsis = "";
  const full = new URLSearchParams({
    action: "query",
    titles: page.title,
    prop: "extracts",
    explaintext: "1",
    exsectionformat: "wiki",
    format: "json",
    utf8: "1",
  });
  const res2 = await fetch(`https://fr.wikipedia.org/w/api.php?${full}`, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (res2.ok) {
    const j2 = await res2.json();
    const text = (Object.values(j2?.query?.pages ?? {})[0] as { extract?: string } | undefined)?.extract ?? "";
    const parts = text.split(/\n(==+)\s*(.+?)\s*\1\n/);
    // parts = [intro, "==", titre, contenu, "==", titre, contenu, ...]
    for (let i = 1; i + 2 < parts.length; i += 3) {
      if (SYNOPSIS_RE.test(parts[i + 1].trim())) {
        // Le contenu peut commencer directement par une sous-section : on prend le premier vrai paragraphe
        const body = parts.slice(i + 2).join("\n").split("\n").find((l) => l.trim().length > 80) ?? "";
        synopsis = clip(body, 650);
        break;
      }
    }
  }

  return {
    summary: synopsis ? `${intro}\n\n${synopsis}` : intro,
    url: `https://fr.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
  };
}

async function fromAniList(anilistId: number): Promise<{ summary: string; url: string } | null> {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: "query($id:Int){Media(id:$id,type:MANGA){description(asHtml:false) siteUrl}}", variables: { id: anilistId } }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const media = (await res.json())?.data?.Media;
  const raw: string = media?.description ?? "";
  const text = raw.replace(/<[^>]+>/g, " ").replace(/\(Source:[^)]*\)/gi, "").trim();
  if (!text) return null;
  return { summary: clip(text, 900), url: media.siteUrl };
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const title = (params.get("title") ?? "").trim();
  const anilistId = Number(params.get("anilistId")) || null;
  if (!title) return NextResponse.json({ error: "Titre manquant" }, { status: 400 });

  try {
    const wiki = await fromWikipedia(title);
    if (wiki) return NextResponse.json({ ...wiki, source: "Wikipédia" });
    if (anilistId) {
      const al = await fromAniList(anilistId);
      if (al) return NextResponse.json({ ...al, source: "AniList (anglais)" });
    }
  } catch {
    // on renvoie "rien trouvé" plutôt qu'une erreur
  }
  return NextResponse.json({ summary: null, source: null, url: null });
}
