// Liste les livres lus ou en cours qui n'ont pas encore de question (à relancer à chaque reconnexion).
// node scripts/quiz-missing.js   (lit .env.local, ne modifie rien)
const fs = require("fs");
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
const key = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const h = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY };
(async () => {
  const get = (p) => fetch(env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/" + p, { headers: h }).then((r) => r.json());
  const have = new Set((await get("book_quiz?select=book_key&limit=5000")).map((q) => q.book_key));
  const books = await get("books?select=title,author,isbn13,status,summary&status=in.(reading,completed)&limit=5000");
  const miss = new Map();
  for (const b of books) {
    const k = key(b.title);
    if (have.has(k)) continue;
    const m = miss.get(k) ?? { title: b.title, author: b.author, isbn13: b.isbn13, readers: 0, reading: 0 };
    m.readers++; if (b.status === "reading") m.reading++;
    miss.set(k, m);
  }
  const list = [...miss.values()].sort((a, b) => b.reading - a.reading || b.readers - a.readers);
  console.log(list.length + " livres sans question (en cours d'abord) :");
  for (const m of list.slice(0, 60)) console.log(`${m.reading ? "[en cours] " : ""}${m.title} — ${m.author ?? "?"} (${m.readers} lecteur(s))`);
})();
