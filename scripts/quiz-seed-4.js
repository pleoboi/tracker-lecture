// Génère supabase-quiz-seed-4.sql : lot 4, livres en cours de lecture (infos vérifiées par recherche web).
// node scripts/quiz-seed-4.js
const fs = require("fs");
const key = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// [titres, [palier, question, options (bonne réponse en premier avant mélange), 0, explication]]
const BOOKS = [
  [["Les quatre accords toltèques"], [
    [50, "Quel est le premier des quatre accords ?", ["Que ta parole soit impeccable", "Toujours chercher à plaire aux autres", "Ne jamais pardonner une offense", "Rester fidèle à ses ancêtres"], 0,
      "Le premier accord de Don Miguel Ruiz est d'avoir une parole impeccable : parler avec intégrité, sans médire ni se juger soi-même."],
    [100, "Lequel de ces principes fait partie des quatre accords ?", ["Ne rien prendre personnellement", "Toujours viser la perfection", "Dire oui à toutes les demandes", "Deviner les intentions des autres"], 0,
      "Les quatre accords sont : une parole impeccable, ne rien prendre personnellement, ne pas faire de suppositions, toujours faire de son mieux. Faire de son mieux n'est pas viser la perfection."],
  ]],
  [["Le Passe-Muraille"], [
    [50, "Quel est le métier de Dutilleul au début de la nouvelle ?", ["Petit employé au ministère de l'Enregistrement", "Comptable dans une banque de Montmartre", "Facteur dans le quartier de Montmartre", "Clerc de notaire dans le centre de Paris"], 0,
      "Dutilleul est un modeste employé de bureau de Montmartre. C'est cette vie banale qui fait contraste avec le don étrange qu'il découvre."],
    [100, "Que devient Dutilleul à la fin de la nouvelle ?", ["Il reste prisonnier à l'intérieur d'un mur", "Il est arrêté et jugé pour ses cambriolages", "Il perd son don et retrouve son bureau", "Il s'enfuit à l'étranger avec son butin"], 0,
      "Son don s'interrompt alors qu'il traverse un mur : il y reste figé pour toujours. La statue de Montmartre rappelle ce destin."],
  ]],
  [["Les ingénieurs du chaos"], [
    [50, "Quel mouvement italien sert de point de départ au livre ?", ["Le Mouvement 5 Étoiles", "Forza Italia de Berlusconi", "Le Parti démocrate de Renzi", "Fratelli d'Italia de Meloni"], 0,
      "Da Empoli part du Mouvement 5 Étoiles : une petite entreprise de web-marketing devenue le premier parti d'Italie."],
    [100, "Que sont les « ingénieurs du chaos » ?", ["Des stratèges du numérique au service des populistes", "Des ingénieurs qui sécurisent les réseaux d'État", "Des militants qui sabotent des usines polluantes", "Des économistes qui conseillent les banques centrales"], 0,
      "Ce sont les spin doctors, idéologues et experts de la donnée qui amplifient les colères pour porter des dirigeants populistes, de l'Italie à Trump et au Brexit."],
  ]],
  [["Venise n'est pas en Italie"], [
    [50, "Pourquoi Émile part-il à Venise ?", ["Une camarade de classe l'invite à la rejoindre", "Il a gagné un voyage scolaire en Italie", "Son père doit y retrouver un vieil ami", "Ses parents y fêtent leur anniversaire de mariage"], 0,
      "Émile, 15 ans, est amoureux d'une camarade issue d'une famille aisée. Quand elle l'invite à Venise, il y va en voiture avec sa famille, ce qui promet de belles situations gênantes."],
  ]],
  [["Morsures"], [
    [50, "Quel événement ouvre le roman, sur la côte bretonne ?", ["Une attaque de requin près de la plage", "Un naufrage de chalutier dans la tempête", "Une marée noire sur toute la baie", "La disparition d'un enfant sur la plage"], 0,
      "Le thriller de Maxime Chattam s'ouvre sur une attaque de requin, clin d'œil assumé aux Dents de la mer, à Saint-Cast-le-Guildo."],
  ]],
  [["Nos étoiles filantes"], [
    [50, "Où Fanny part-elle se reconstruire après la mort d'Hadrien ?", ["Au Canada, pour un road trip", "En Islande, pour un tour de l'île", "Au Japon, pour un voyage en train", "En Écosse, pour une longue randonnée"], 0,
      "Fanny réalise le rêve d'Hadrien en partant au Canada, où un road trip lui fait traverser lacs et forêts et rencontrer des personnes qui l'aident à avancer."],
  ]],
  [["Ces questions que tout le monde se pose"], [
    [100, "De quel support ce livre de Maud Ankaoua est-il tiré ?", ["De son podcast du même nom", "D'une série télévisée", "D'une émission de radio d'actualité", "D'un blog de voyage"], 0,
      "Le livre prolonge le podcast de Maud Ankaoua, qui aborde la confiance en soi, la jalousie, l'ego ou l'optimisme."],
  ]],
];

require("./quiz-overrides.js")(BOOKS);
const esc = (s) => s.replace(/'/g, "''");
let out = "-- Questions de lecture, lot 4 : livres en cours (généré par scripts/quiz-seed-4.js)\n";
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
fs.writeFileSync("supabase-quiz-seed-4.sql", out);
fs.mkdirSync("src/data/quiz", { recursive: true });
fs.writeFileSync("src/data/quiz/4.json", JSON.stringify(entries, null, 1));
console.log(rows.length + " lignes, " + BOOKS.length + " livres");
