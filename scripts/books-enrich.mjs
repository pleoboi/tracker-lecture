// Prépare le nettoyage des livres : ne modifie RIEN dans la base.
//   node scripts/books-enrich.mjs [dossier-de-sortie]
// Produit books-fixes.json (corrections proposées par ligne) et books-report.md (à relire).
// Les cases déjà remplies ne sont jamais écrasées, sauf le genre (normalisé).
import fs from "node:fs";
import path from "node:path";
import { normalizeGenres } from "../src/lib/genres.ts";

const out = process.argv[2] || ".";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const sb = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY };
const GB_KEY = env.GOOGLE_BOOKS_API_KEY;

const key = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const coreTitle = (t) => key((t || "").replace(/\(.*?\)/g, "").split(/[:–—-]\s/)[0]);
const lastNames = (a) => key(a).split(" ").filter((w) => w.length > 2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const empty = (v) => v === null || v === undefined || (typeof v === "string" && !v.trim()) || v === 0;

const FR = /\b(le|la|les|des|une|un|est|dans|qui|que|pour|avec|sur|elle|il|son|sa|ses|au|aux|du|et)\b/gi;
const EN = /\b(the|and|of|is|in|his|her|with|who|that|for|he|she|they|from|by)\b/gi;
const isFrench = (s) => ((s.match(FR) || []).length > (s.match(EN) || []).length * 1.5);
const cleanHtml = (s) => s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/\n{3,}/g, "\n\n").trim();

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "catalogue-cleanup" } });
      if (r.status === 429) { await sleep(4000 * (i + 1)); continue; }
      if (!r.ok) return null;
      return await r.json();
    } catch { await sleep(1500); }
  }
  return null;
}

function matches(book, title, authors) {
  const tb = coreTitle(book.title), tr = coreTitle(title);
  if (!tr || !(tb === tr || tb.includes(tr) || tr.includes(tb))) return false;
  const ln = lastNames(book.author);
  if (!ln.length || !authors?.length) return true;
  const ra = key(authors.join(" "));
  return ln.some((w) => ra.includes(w));
}

async function lookup(book) {
  const found = { year: null, pages: null, cover: null, summary: null, subjects: [] };
  const isbn = (book.isbn13 || "").replace(/\D/g, "");
  const title = book.title.replace(/\(.*?\)/g, "").trim();

  // Google Books (résumé en français en priorité, pages, année, catégories, couverture)
  const gbq = isbn.length >= 10 ? `isbn:${isbn}` : `intitle:${title}+inauthor:${(book.author || "").split(/ et |,|&/)[0].trim()}`;
  for (const lang of ["fr", ""]) {
    const u = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(gbq).replace(/%2B/g, "+")}&maxResults=5&printType=books${lang ? "&langRestrict=" + lang : ""}${GB_KEY ? "&key=" + GB_KEY : ""}`;
    const d = await getJson(u);
    for (const it of d?.items ?? []) {
      const v = it.volumeInfo ?? {};
      if (isbn.length < 10 && !matches(book, v.title ?? "", v.authors)) continue;
      if (v.pageCount && !found.pages) found.pages = v.pageCount;
      const y = parseInt(v.publishedDate, 10);
      if (y && !found.year) found.year = y;
      if (v.description && !found.summary) { const s = cleanHtml(v.description); if (s.length > 80 && isFrench(s)) found.summary = s; }
      if (v.categories) found.subjects.push(...v.categories.flatMap((c) => c.split(/\s*\/\s*/)));
      const img = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail;
      if (img && !found.cover) found.cover = img.replace("http://", "https://").replace("&edge=curl", "");
    }
    if (found.summary || lang === "") break;
    await sleep(120);
  }

  // Open Library (année de première parution, pages médianes, sujets, couverture)
  const olq = isbn.length >= 10 ? `isbn=${isbn}` : `title=${encodeURIComponent(title)}&author=${encodeURIComponent((book.author || "").split(/ et |,|&/)[0].trim())}`;
  const od = await getJson(`https://openlibrary.org/search.json?${olq}&limit=3&fields=title,author_name,first_publish_year,number_of_pages_median,subject,cover_i`);
  for (const doc of od?.docs ?? []) {
    if (isbn.length < 10 && !matches(book, doc.title ?? "", doc.author_name)) continue;
    if (doc.first_publish_year && !found.year) found.year = doc.first_publish_year;
    if (doc.number_of_pages_median && !found.pages) found.pages = doc.number_of_pages_median;
    if (doc.subject) found.subjects.push(...doc.subject.slice(0, 25));
    if (doc.cover_i && !found.cover) found.cover = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    break;
  }
  return found;
}

const MANGA_AUTHORS = /(Eiichiro Oda|Hajime Isayama|Muneyuki Kaneshiro|Tsugumi Ohba|Tatsuki Fujimoto|Tite Kubo|Masashi Kishimoto|Akira Toriyama|Kentaro Miura|Naoki Urasawa|Yoshihiro Togashi|Kohei Horikoshi|Gege Akutami|Koyoharu Gotouge|Takehiko Inoue)/i;
const COMICS = /(Alan Moore|Brian Azzarello|Straczynski|James Tynion|Mark Millar|Kirkman|Scott Snyder|Snyder Scott|Hellraiser|Batman|Spider-Man|Wolverine|DC Essentials)/i;
const MANUAL = [
  ["À l'Ouest, rien de nouveau", "Roman, Fiction, Classique, Guerre, Histoire"],
  ["The Complete Maus", "Non-Fiction, Biographie, Histoire, Guerre, BD / Roman graphique"],
  ["Sapiens - tome 2", "Non-Fiction, Histoire, BD / Roman graphique"],
  ["Harry Potter", "Roman, Fiction, Fantasy, Jeunesse, Aventure"],
  ["Les Nuits blanches", "Nouvelle, Fiction, Classique, Romance"],
  ["Jekyll", "Roman, Fiction, Classique, Fantasy"],
  ["Le pouvoir du moment présent", "Non-Fiction, Développement personnel, Philosophie"],
  ["Lady Churchill", "Roman, Fiction, Histoire"],
  ["Le livre des Baltimore", "Roman, Fiction, Drame"],
  ["Eldorado", "Roman, Fiction, Drame"],
  ["Et après ...", "Roman, Fiction, Romance, Fantasy"],
  ["The Housemaid", "Roman, Fiction, Thriller, Suspense"],
  ["A Good Girl's Guide to Murder", "Roman, Fiction, Jeunesse, Mystère, Thriller"],
  ["The Elite (The Selection", "Roman, Fiction, Jeunesse, Romance, Science-Fiction"],
  ["The Death Cure", "Roman, Fiction, Science-Fiction, Jeunesse"],
  ["The Son of Neptune", "Roman, Fiction, Fantasy, Jeunesse, Aventure"],
  ["Woody range sa chambre", "Jeunesse, Fiction"],
  ["Dix aventurières en quête d", "Non-Fiction, Biographie, Aventure"],
  ["Ghosted", "Roman, Fiction, Romance"],
  ["Lupus Deus", "Roman, Fiction, Romance, Fantasy"],
  ["Revenge and Roses", "Roman, Fiction, Romance"],
  ["Thieves and Thorns", "Roman, Fiction, Romance"],
  ["Knot Inn Love", "Roman, Fiction, Romance"],
  ["The Favor", "Roman, Fiction, Romance"],
  ["Nanny for the Bossholes", "Roman, Fiction, Romance"],
  ["Faking It as the Maid", "Roman, Fiction, Romance"],
  ["Teach Me", "Roman, Fiction, Romance"],
  ["One Percent of You", "Roman, Fiction, Romance"],
  ["When Stars Burn Out", "Roman, Fiction, Romance"],
  ["Lilah", "Roman, Fiction, Romance"],
  ["Beg For It", "Roman, Fiction, Romance"],
  ["The Mischievous Mrs. Maxfield", "Roman, Fiction, Romance"],
  ["Forbidden Literature", "Roman, Fiction, Romance"],
  ["Queen &amp; Knight", "Roman, Fiction, Romance"],
  ["Virtue and Vice", "Roman, Fiction, Romance"],
  ["After the lie", "Roman, Fiction, Romance"],
  ["Subtle Art of Not Giving", "Non-Fiction, Développement personnel"],
  ["Parce que je t", "Roman, Fiction, Romance"],
  ["Paris est une fête", "Non-Fiction, Biographie, Témoignage"],
  ["Le vieux qui ne voulait pas", "Roman, Fiction, Humour, Aventure"],
  ["La libraire de la place aux Herbes", "Roman, Fiction, Romance"],
  ["Le rêve du pêcheur", "Roman, Fiction, Drame"],
  ["Gomorra", "Non-Fiction, Crime, Témoignage"],
  ["Géographie de l", "Non-Fiction, Essai, Voyage"],
  ["Julian Alaphilippe", "Non-Fiction, Sport, Témoignage"],
  ["Arnaud Démare", "Non-Fiction, Sport, Témoignage"],
  ["Giro", "Non-Fiction, Sport"],
  ["Confessions d", "Non-Fiction, Économie, Biographie"],
  ["Tu m’avais promis", "Roman, Fiction, Développement personnel"],
  ["La dernière allumette", "Roman, Fiction, Drame"],
  ["Le verdict du plomb", "Roman, Fiction, Policier, Thriller"],
  ["La chirurgienne", "Roman, Fiction, Thriller, Suspense"],
  ["Hiroshima", "Non-Fiction, Histoire, Guerre, Témoignage"],
  ["Ne t'arrête pas", "Roman, Fiction, Thriller, Jeunesse"],
  ["CE QU'IL FAUT DE NUIT", "Roman, Fiction, Drame"],
  ["Le Passe-Muraille", "Nouvelle, Fiction, Classique, Fantasy"],
  ["Ces questions que tout le monde se pose", "Non-Fiction, Science"],
  ["Le craquant de la nougatine", "Roman, Fiction, Romance"],
  ["Nos étoiles filantes", "Roman, Fiction, Romance"],
  ["Venise n'est pas en Italie", "Roman, Fiction, Humour"],
  ["L'ART DE LA GUERRE", "Non-Fiction, Philosophie, Histoire"],
];

const CACHE = path.join(out, "books-cache.json");
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};

const rows = [];
for (let from = 0; ; from += 1000) {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/books?select=id,user_id,title,author,isbn13,genre,summary,published_year,pages,cover_url,status&order=id&limit=1000&offset=${from}`, { headers: sb });
  const page = await r.json();
  rows.push(...page);
  if (page.length < 1000) break;
}
console.log(rows.length + " lignes");

// Regroupe les doublons (même livre chez plusieurs membres)
const groups = new Map();
for (const b of rows) {
  const k = coreTitle(b.title) + "|" + (lastNames(b.author)[0] ?? "");
  (groups.get(k) ?? groups.set(k, []).get(k)).push(b);
}
console.log(groups.size + " livres distincts");

const needs = (g) => ["genre", "summary", "published_year", "pages", "cover_url"].some((f) => g.every((b) => empty(b[f])));
const todo = [...groups.entries()].filter(([k, g]) => needs(g) && !cache[k]);
console.log(todo.length + " à interroger");

let done = 0;
const queue = [...todo];
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const [k, g] = queue.shift();
    cache[k] = await lookup(g[0]);
    if (++done % 25 === 0) { fs.writeFileSync(CACHE, JSON.stringify(cache)); console.log(done + "/" + todo.length); }
    await sleep(150);
  }
}));
fs.writeFileSync(CACHE, JSON.stringify(cache));

// Propositions
const fixes = [];
const review = [];
const deducedList = [];
const stats = { genre: 0, summary: 0, published_year: 0, pages: 0, cover_url: 0, genreCleaned: 0, fictionTagged: 0 };
for (const [k, g] of groups) {
  const web = cache[k] ?? { subjects: [] };
  // Valeur commune déjà connue chez un autre membre
  const shared = {};
  for (const f of ["summary", "published_year", "pages", "cover_url"]) shared[f] = g.find((b) => !empty(b[f]))?.[f] ?? null;
  const knownGenre = g.map((b) => b.genre).find((x) => !empty(x)) ?? null;
  let nrm = knownGenre ? normalizeGenres(knownGenre) : normalizeGenres(web.subjects, { web: true });
  // Genre connu mais inexploitable (mots parasites) ou sans étiquette : on complète avec les sujets web
  if (knownGenre && (!nrm.fiction || !nrm.genre)) {
    const m = normalizeGenres([knownGenre, ...normalizeGenres(web.subjects, { web: true }).genre.split(", ")]);
    if (m.fiction || !nrm.genre) nrm = m;
  }
  const first = g[0];
  // Manga / comics : on ajoute le format quand l'auteur ou le titre le montre
  {
    const manga = MANGA_AUTHORS.test(first.author || "") || /[぀-ヿ一-鿿]/.test(first.title);
    const comics = !manga && COMICS.test(first.author + " " + first.title);
    if ((manga || comics) && !/Manga|Comics/.test(nrm.genre)) {
      const base = nrm.genre.split(", ").filter((x) => x !== "Roman").join(", ");
      nrm = normalizeGenres((base ? base + ", " : "") + "BD / Roman graphique, " + (manga ? "Manga" : "Comics"));
    }
  }
  // Ajustements faits à la main (titre -> genres complets), pour les cas que les règles ne tranchent pas
  const manual = MANUAL.find(([t]) => first.title.includes(t));
  if (manual) nrm = { ...normalizeGenres(manual[1]), review: false };
  // Titre en série numérotée (« …, #2 ») sans aucun genre trouvé : un roman, donc de la fiction
  let deduced = false;
  if (!nrm.genre && /(#\s*\d+\)?|\bTome \d+|, Vol\. \d+)/i.test(first.title)) { nrm = normalizeGenres("Roman, Fiction"); deduced = true; }

  for (const b of g) {
    const set = {};
    if (empty(b.summary) && (shared.summary ?? web.summary)) set.summary = shared.summary ?? web.summary;
    if (empty(b.published_year) && (shared.published_year ?? web.year)) set.published_year = shared.published_year ?? web.year;
    if (empty(b.pages) && (shared.pages ?? web.pages)) set.pages = shared.pages ?? web.pages;
    if (empty(b.cover_url) && (shared.cover_url ?? web.cover)) set.cover_url = shared.cover_url ?? web.cover;
    if (nrm.genre && nrm.genre !== (b.genre ?? "")) set.genre = nrm.genre;
    if (Object.keys(set).length) {
      fixes.push({ id: b.id, title: b.title, author: b.author, before: { genre: b.genre ?? null }, set });
      for (const f of Object.keys(set)) { if (f === "genre") { if (empty(b.genre)) stats.genre++; else stats.genreCleaned++; } else stats[f]++; }
      if (set.genre && !normalizeGenres(b.genre).fiction && nrm.fiction) stats.fictionTagged++;
    }
  }
  if (deduced) deducedList.push(`${first.title} — ${first.author ?? "?"}`);
  if (nrm.review || !nrm.fiction) review.push({ title: g[0].title, author: g[0].author, ids: g.map((b) => b.id), current: knownGenre, proposed: nrm.genre, subjects: [...new Set(web.subjects)].slice(0, 8) });
}

fs.writeFileSync(path.join(out, "books-fixes.json"), JSON.stringify(fixes, null, 1));
fs.writeFileSync(path.join(out, "books-review.json"), JSON.stringify(review, null, 1));

const lines = [`# Nettoyage des livres (proposition, rien n'est écrit)`, ``,
  `${rows.length} lignes, ${groups.size} livres distincts, ${fixes.length} lignes à modifier.`, ``,
  `| Correction | Lignes |`, `|---|---|`,
  `| Genre ajouté (était vide) | ${stats.genre} |`, `| Genre nettoyé (mots parasites, Roman en trop, étiquette) | ${stats.genreCleaned} |`,
  `| Dont étiquette Fiction / Non-Fiction ajoutée | ${stats.fictionTagged} |`,
  `| Résumé ajouté | ${stats.summary} |`, `| Année ajoutée | ${stats.published_year} |`, `| Pages ajoutées | ${stats.pages} |`, `| Couverture ajoutée | ${stats.cover_url} |`, ``,
  `## Genre déduit du titre (série numérotée, donc Roman + Fiction) : ${deducedList.length} livres`, ``, ...deducedList.map((d) => `- ${d}`), ``,
  `## À vérifier à la main (${review.length} livres : fiction / non-fiction incertain ou genre introuvable)`, ``,
  ...review.map((r) => `- ${r.title} — ${r.author ?? "?"} · actuel : ${r.current ?? "(vide)"} · proposé : ${r.proposed || "(rien)"}${r.subjects.length ? " · sujets web : " + r.subjects.join(", ") : ""}`)];
fs.writeFileSync(path.join(out, "books-report.md"), lines.join("\n"));
console.log(lines.slice(0, 14).join("\n"));
