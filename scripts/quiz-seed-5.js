// Génère supabase-quiz-seed-5.sql : lot 5, livres en cours de lecture (infos vérifiées par recherche web).
// node scripts/quiz-seed-4.js
const fs = require("fs");
const key = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// [titres, [palier, question, options (bonne réponse en premier avant mélange), 0, explication]]
const BOOKS = [
  [["Ready Player Two"], [
    [50, "Que découvre Wade, peu après sa victoire, dans les coffres d'Halliday ?", ["Une nouvelle technologie d'immersion, le casque ONI", "Un second œuf de Pâques caché dans l'OASIS", "Le testament secret de James Halliday", "Le code source complet de l'OASIS"], 0,
      "Wade trouve une technologie capable de changer à nouveau le monde, l'ONI, une interface cerveau-machine. Elle s'accompagne d'une nouvelle quête d'Halliday et d'un adversaire dangereux."],
  ]],
  [["Ne t'arrête pas"], [
    [50, "Dans quel état Noa se retrouve-t-elle au début du roman ?", ["Sur une table d'opération, une cicatrice sur la poitrine", "Enfermée dans un laboratoire, les mains attachées", "Perdue en forêt, un sac de billets à la main", "À l'hôpital, entourée de sa famille"], 0,
      "Noa se réveille sans savoir où elle est ni ce qui lui est arrivé, avec une cicatrice en travers de la poitrine. Elle s'enfuit alors que des tueurs sont à ses trousses."],
  ]],
  [["La loi du talion"], [
    [50, "Quel est le métier d'Élisabeth, qui disparaît au début du roman ?", ["Infirmière à Lyon", "Avocate à Paris", "Institutrice à Marseille", "Journaliste à Bordeaux"], 0,
      "Élisabeth a 29 ans, travaille comme infirmière à Lyon et porte un lourd secret. Ses proches se lancent à sa recherche après sa disparition."],
  ]],
  [["Il suffit parfois d'un signe"], [
    [50, "Quels phénomènes l'autrice présente-t-elle comme des signes ?", ["Les rêves, les intuitions et les synchronicités", "Uniquement les prédictions des astrologues", "Seulement les événements spectaculaires", "Les coïncidences de dates et de chiffres"], 0,
      "Anne Tuffigo parle de prémonitions, de songes, de synchronicités, de déjà-vu et d'intuitions, que l'on reçoit au quotidien sans forcément y prêter attention."],
    [100, "Que permet, selon le livre, de savoir décrypter ces signes ?", ["Mieux se connaître soi-même", "Gagner en endurance physique", "Améliorer sa mémoire des dates", "Réussir tous ses examens"], 0,
      "Le livre affirme que prendre conscience de ces signes et apprendre à les décrypter ouvre les portes d'une formidable connaissance de soi et permet de renouer avec l'essentiel."],
  ]],
  [["L'élégance de la manipulation"], [
    [100, "Que propose Marwan Mery quand les arguments et la pression échouent ?", ["Faire changer d'avis sans heurter l'autre", "Imposer sa décision par la hiérarchie", "Éviter définitivement le sujet", "Répéter ses arguments plus fort"], 0,
      "Le livre explique comment influencer et convaincre sans conflit, y compris dans des situations difficiles comme détourner un enfant de son écran."],
  ]],
  [["Le 3e Reich des origines à la chute tome 1"], [
    [50, "Quelle période couvre ce premier volume ?", ["Les années 1920 à 1939", "Les années 1914 à 1918", "Les années 1945 à 1960", "Les années 1871 à 1914"], 0,
      "Le premier volume suit l'histoire de l'Allemagne dans son contexte européen des années 1920 à 1939. Le second couvre 1939-1945."],
    [100, "Quelle distinction l'ouvrage de Shirer a-t-il reçue aux États-Unis en 1961 ?", ["Le National Book Award de non-fiction", "Le prix Médicis", "Le prix Renaudot", "Le prix Nobel de littérature"], 0,
      "Publié en 1960, l'ouvrage reçoit le National Book Award de non-fiction en 1961 et s'impose comme une référence sur le IIIe Reich."],
  ]],
];

require("./quiz-overrides.js")(BOOKS);
const esc = (s) => s.replace(/'/g, "''");
let out = "-- Questions de lecture, lot 5 : livres en cours (généré par scripts/quiz-seed-5.js)\n";
out += "insert into public.book_quiz (book_key, book_title, tier, question, options, answer, explanation) values\n";
const rows = [];
const entries = [];
for (const [titles, qs] of BOOKS) {
  for (const t of titles) {
    for (const [tier, q, opts, ans, expl] of qs) {
      rows.push(`('${esc(key(t))}', '${esc(t)}', ${tier}, '${esc(q)}', '${esc(JSON.stringify(opts))}'::jsonb, ${ans}, '${esc(expl)}')`);
      entries.push({ book_key: key(t), book_title: t, tier, question: q, options: opts, answer: ans, explanation: expl });
    }
  }
}
out += rows.join(",\n") + "\non conflict (book_key, tier) do update set book_title = excluded.book_title, question = excluded.question, options = excluded.options, answer = excluded.answer, explanation = excluded.explanation;\n";
fs.writeFileSync("supabase-quiz-seed-5.sql", out);
fs.mkdirSync("src/data/quiz", { recursive: true });
fs.writeFileSync("src/data/quiz/5.json", JSON.stringify(entries, null, 1));
console.log(rows.length + " lignes, " + BOOKS.length + " livres");
