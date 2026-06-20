/**
 * One-shot enrichment script — adds cover_url, summary, published_year, genre
 * to ALL books in the Supabase table that are missing a cover.
 *
 * Prerequisites:
 *   1. Add your Supabase Service Role key to .env.local:
 *      SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *      (Supabase Dashboard → Settings → API → service_role)
 *
 * Run:
 *   node --env-file=.env.local scripts/enrich-books.mjs
 *   (requires Node.js ≥ 20.6 for --env-file flag)
 *
 *   Older Node: npx dotenv-cli -e .env.local -- node scripts/enrich-books.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_KEY = process.env.GOOGLE_BOOKS_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌  SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local");
  console.error("   Récupère-le sur : Supabase Dashboard → Settings → API → service_role");
  process.exit(1);
}
if (!GOOGLE_KEY) {
  console.warn("⚠️  GOOGLE_BOOKS_API_KEY absent — les résumés/couvertures peuvent être limités");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function httpsCover(url) {
  if (!url) return null;
  return url.replace(/^http:/, "https:").replace(/&edge=curl/, "");
}

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const FR_MARKERS = [
  " est ", " une ", " dans ", " avec ", " pour ", " mais ", " qui ",
  " que ", " les ", " des ", " cette ", " sont ", " sur ", " par ",
];
function isFrench(text) {
  const h = " " + text.toLowerCase() + " ";
  let hits = 0;
  for (const w of FR_MARKERS) if (h.includes(w) && ++hits >= 3) return true;
  return false;
}

const GENRE_FR = {
  fiction: "Roman",
  "juvenile fiction": "Jeunesse",
  "science fiction": "Science-Fiction",
  fantasy: "Fantasy",
  history: "Histoire",
  biography: "Biographie",
  "biography & autobiography": "Biographie",
  philosophy: "Philosophie",
  poetry: "Poésie",
  "comics & graphic novels": "BD / Roman graphique",
  thriller: "Thriller",
  "detective and mystery stories": "Policier",
  "self-help": "Développement personnel",
  psychology: "Psychologie",
  science: "Science",
};
function frenchGenre(cat) {
  if (!cat) return null;
  const key = cat.toLowerCase().split("/").pop().trim();
  return GENRE_FR[key] || GENRE_FR[cat.toLowerCase()] || cat.split("/").pop().trim();
}

async function queryGoogleBooks(title, author) {
  const q = encodeURIComponent(`${title} ${author || ""}`.trim());
  const keyParam = GOOGLE_KEY ? `&key=${GOOGLE_KEY}` : "";
  const url =
    `https://www.googleapis.com/books/v1/volumes?q=${q}` +
    `&langRestrict=fr&hl=fr&maxResults=5${keyParam}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.items?.length) return null;

  // Prend le premier résultat dont l'auteur correspond
  const authorSurname = (author || "").toLowerCase().split(/\s+/).pop() ?? "";
  const best =
    data.items.find((item) => {
      const a = (item.volumeInfo?.authors?.[0] || "").toLowerCase();
      return !authorSurname || a.includes(authorSurname);
    }) ?? data.items[0];

  const v = best.volumeInfo || {};
  const yearMatch = (v.publishedDate || "").match(/\d{4}/);
  const rawDesc = v.description;
  const summary =
    rawDesc
      ? (() => {
          const clean = stripHtml(rawDesc);
          return isFrench(clean) ? clean : null;
        })()
      : null;

  const cats = v.categories || [];
  return {
    title: v.title || null,
    coverUrl: httpsCover(v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail),
    summary,
    year: yearMatch ? Number(yearMatch[0]) : null,
    genre: frenchGenre(cats[0]),
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ─────────────────────────────────────────────────────────────────────

const { data: books, error } = await supabase
  .from("books")
  .select("id, title, author, cover_url")
  .or("cover_url.is.null,cover_url.eq.");

if (error) {
  console.error("❌  Erreur lecture Supabase :", error.message);
  process.exit(1);
}

console.log(`\n📚  ${books.length} livre(s) sans couverture trouvé(s)\n`);

let updated = 0;
let noMatch = 0;
let failed = 0;

for (let i = 0; i < books.length; i++) {
  const book = books[i];
  const progress = `[${i + 1}/${books.length}]`;

  try {
    const meta = await queryGoogleBooks(book.title, book.author);
    if (!meta || !meta.coverUrl) {
      console.log(`  ${progress} ⬛  ${book.title} — aucune correspondance`);
      noMatch++;
    } else {
      const update = {
        cover_url: meta.coverUrl,
        ...(meta.year && { published_year: meta.year }),
        ...(meta.summary && { summary: meta.summary }),
        ...(meta.genre && { genre: meta.genre }),
      };
      const { error: upErr } = await supabase.from("books").update(update).eq("id", book.id);
      if (upErr) {
        console.log(`  ${progress} ❌  ${book.title} — ${upErr.message}`);
        failed++;
      } else {
        const founds = [meta.year, meta.genre].filter(Boolean).join(", ");
        console.log(`  ${progress} ✅  ${book.title}${founds ? " (" + founds + ")" : ""}`);
        updated++;
      }
    }
  } catch (e) {
    console.log(`  ${progress} ⚠️  ${book.title} — ${e.message}`);
    failed++;
  }

  if (i < books.length - 1) await sleep(300 + Math.random() * 200);
}

console.log(`\n✨  Terminé — ${updated} enrichi(s), ${noMatch} sans résultat, ${failed} erreur(s)\n`);
