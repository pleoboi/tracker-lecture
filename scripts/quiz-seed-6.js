// Génère supabase-quiz-seed-6.sql : lot 6, livres en cours et les plus lus (infos vérifiées par recherche web).
// node scripts/quiz-seed-6.js
const fs = require("fs");
const key = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// [titres, [palier, question, options (bonne réponse en premier avant mélange), 0, explication]]
const BOOKS = [
  [["Un avenir radieux"], [
    [50, "Dans quelle saga de Pierre Lemaitre ce roman s'inscrit-il ?", ["Les Années glorieuses", "Les Enfants du désastre", "Les Années noires", "Les Grandes Espérances"], 0,
      "Un avenir radieux est le troisième tome des Années glorieuses, la saga consacrée à la famille Pelletier, après Les Belles Promesses."],
    [100, "Entre quelles villes l'intrigue se partage-t-elle ?", ["Paris et Prague", "Lyon et Vienne", "Berlin et Moscou", "Marseille et Rome"], 0,
      "En pleine guerre froide, le roman mêle drame familial et mission secrète entre Paris et Prague."],
  ]],
  [["L'Affaire Alaska Sanders"], [
    [50, "Où le corps d'Alaska Sanders est-il découvert en 1999 ?", ["Près d'un lac, à Mount Pleasant", "Dans les bois, près de Boston", "Sur une plage, dans le Maine", "Dans un parking, à New York"], 0,
      "Le corps de la jeune femme est retrouvé au bord d'un lac, dans la paisible bourgade de Mount Pleasant, dans le New Hampshire."],
    [100, "Qu'est-ce qui relance l'enquête onze ans plus tard ?", ["Une lettre anonyme reçue par un sergent", "Un aveu inattendu d'un ancien suspect", "Une arme retrouvée au fond d'un lac", "Le témoignage tardif d'un ancien voisin"], 0,
      "En 2010, le sergent Perry Gahalowood reçoit une lettre anonyme troublante et enquête de nouveau avec son ami, l'écrivain Marcus Goldman."],
  ]],
  [["Veiller Sur Elle"], [
    [50, "Quel est le métier de Mimo, Michelangelo Vitaliani ?", ["Sculpteur", "Peintre", "Architecte", "Orfèvre"], 0,
      "Mimo est un sculpteur d'origine modeste. Le roman s'ouvre sur lui, très âgé, dans une abbaye du Piémont, veillant sur une sculpture."],
    [100, "Quel est le nom du village de la famille aristocratique de Viola ?", ["Pietra d'Alba", "Monte Lucente", "Borgo Sereno", "San Fiore"], 0,
      "Viola est l'héritière de la famille Orsini, à Pietra d'Alba. Le roman, prix Goncourt 2023, couvre environ quatre-vingts ans d'histoire italienne."],
  ]],
  [["Glacé"], [
    [50, "Quel animal est retrouvé mort au début de l'enquête ?", ["Un cheval sans tête", "Un chien égorgé", "Un loup empaillé", "Un taureau pendu"], 0,
      "Par un matin glacial de décembre, des ouvriers d'une centrale hydroélectrique découvrent le corps d'un cheval décapité, accroché à la falaise."],
    [100, "Quel indice relie un détenu aux crimes de l'enquête ?", ["Son ADN retrouvé sur les lieux", "Son écriture sur un message", "Son arme laissée sur place", "Ses empreintes sur un téléphone"], 0,
      "Le commandant Martin Servaz découvre que l'ADN d'un psychopathe enfermé dans un centre de détention a été retrouvé sur des lieux de crime."],
  ]],
  [["Le Vagabond des étoiles"], [
    [50, "Dans quelle prison est enfermé Darrell Standing ?", ["San Quentin", "Alcatraz", "Sing Sing", "Leavenworth"], 0,
      "Darrell Standing, un ancien professeur condamné à mort, est détenu à la prison californienne de San Quentin."],
    [100, "Comment Darrell Standing échappe-t-il mentalement à sa cellule ?", ["Grâce à la camisole de force", "Grâce à des plantes interdites", "Grâce à l'hypnose d'un gardien", "Grâce à de longues prières"], 0,
      "Torturé par la camisole, il apprend à quitter son corps et revit ses vies antérieures, d'où le titre du roman de Jack London."],
  ]],
  [["Chien blanc"], [
    [50, "À quoi le chien recueilli par le couple a-t-il été dressé ?", ["À attaquer des Noirs", "À garder une villa", "À chasser des rats", "À suivre des pistes"], 0,
      "Romain Gary et sa femme, l'actrice Jean Seberg, adoptent un chien dressé pour attaquer les Noirs, un « chien blanc »."],
    [100, "Quel est le métier de Keys, qui veut rééduquer le chien ?", ["Dresseur d'animaux", "Vétérinaire", "Policier", "Gardien de zoo"], 0,
      "Keys, dresseur noir, veut inverser le conditionnement du chien pour qu'il cesse d'attaquer les Noirs."],
  ]],
  [["The love hypothesis"], [
    [50, "Avec qui Olive fait-elle semblant de sortir ?", ["Adam Carlsen", "Jeremy Langley", "Tom Chen", "Ethan Cole"], 0,
      "Olive, doctorante, embrasse par surprise le professeur Adam Carlsen pour convaincre son amie Anh qu'elle est en couple."],
    [100, "Dans quelle université se déroule l'histoire ?", ["Stanford", "Harvard", "Yale", "Princeton"], 0,
      "Olive et Adam travaillent à l'université de Stanford, dans le monde de la recherche en biologie."],
  ]],
  [["Love on the Brain"], [
    [50, "Quelle est la profession de Bee Königswasser ?", ["Neuroscientifique", "Astrophysicienne", "Biologiste marine", "Médecin urgentiste"], 0,
      "Bee est neuroscientifique : elle étudie le cerveau, d'où le titre du roman d'Ali Hazelwood."],
    [100, "Pour quel organisme Bee et Levi travaillent-ils ensemble ?", ["La NASA", "L'ESA", "Le CERN", "La NOAA"], 0,
      "Bee est choisie pour co-diriger un projet de la NASA avec Levi Ward, qu'elle croit son ennemi de longue date."],
  ]],
  [["Prisonniers de la géographie"], [
    [50, "Quel est le métier de l'auteur, Tim Marshall ?", ["Journaliste", "Diplomate", "Géologue", "Historien"], 0,
      "Tim Marshall est un journaliste britannique spécialiste de politique étrangère et de diplomatie."],
    [100, "Quel handicap géographique la Russie cherche-t-elle à compenser ?", ["Un accès limité aux mers chaudes", "Un manque de ressources pétrolières", "Une population trop faible", "Un relief trop montagneux"], 0,
      "Selon le livre, la Russie manque de ports libres de glace toute l'année et son immense plaine reste vulnérable aux invasions, ce qui guide sa politique."],
  ]],
  [["Dungeon Crawler Carl - Tome 1"], [
    [50, "Qui accompagne Carl dans le donjon ?", ["Princess Donut, une chatte", "Rex, un chien robot", "Biscuit, un lapin", "Bella, une exploratrice"], 0,
      "Carl se retrouve dans le donjon avec Princess Donut, la chatte de son ex-petite amie."],
    [100, "Comment le donjon est-il présenté dans le roman ?", ["Un jeu télévisé pour extraterrestres", "Une simulation d'entraînement militaire", "Un parc d'attractions souterrain", "Un test scientifique de la NASA"], 0,
      "La Terre est transformée en donjon et les épreuves sont diffusées comme un spectacle pour un public extraterrestre."],
  ]],
  [["L'espion et le traître"], [
    [50, "Pour quel service secret Oleg Gordievsky travaille-t-il officiellement ?", ["Le KGB", "La Stasi", "La CIA", "Le Mossad"], 0,
      "Oleg Gordievsky est un colonel du KGB, mais il renseigne en secret les services britanniques du MI6."],
    [100, "Vers quel pays est-il exfiltré en 1985 ?", ["La Finlande", "La Suède", "La Pologne", "La Norvège"], 0,
      "Gordievsky est exfiltré d'Union soviétique par les services britanniques, caché dans un coffre de voiture, et passe en Finlande."],
  ]],
  [["La tresse"], [
    [50, "Dans quel pays vit Smita, l'une des trois héroïnes ?", ["L'Inde", "Le Pakistan", "Le Népal", "Le Sri Lanka"], 0,
      "Smita est une Intouchable indienne qui rêve d'une autre vie pour sa fille."],
    [100, "Quel élément relie les trois destins du roman ?", ["Les cheveux", "Un héritage", "Une lettre", "Un voyage"], 0,
      "Les trois femmes, Smita en Inde, Giulia en Sicile et Sarah au Canada, sont reliées par les cheveux, d'où le titre."],
  ]],
  [["Numéro deux"], [
    [50, "Quel rôle le héros a-t-il failli obtenir ?", ["Celui de Harry Potter", "Celui de Frodon", "Celui d'Anakin Skywalker", "Celui de Peter Pan"], 0,
      "Le roman de David Foenkinos suit un garçon arrivé deuxième au casting pour incarner Harry Potter."],
    [100, "Quel est le nom de famille du héros ?", ["Hill", "Taylor", "Brown", "Evans"], 0,
      "Le héros s'appelle Martin Hill, le « numéro deux » du casting."],
  ]],
  [["Le Joueur ..."], [
    [50, "Quel est le métier d'Alexeï Ivanovitch auprès du Général ?", ["Précepteur", "Intendant", "Secrétaire", "Médecin"], 0,
      "Alexeï Ivanovitch est le précepteur des enfants du Général, et le narrateur du roman de Dostoïevski."],
    [100, "Combien de jours Dostoïevski a-t-il mis à dicter ce roman ?", ["26 jours", "40 jours", "3 mois", "1 an"], 0,
      "Pressé par un contrat d'édition, il a dicté Le Joueur en vingt-six jours à sa sténographe Anna Snitkina, qui devint sa seconde épouse."],
  ]],
  [["Le poète"], [
    [50, "Quel est le métier de Jack McEvoy ?", ["Journaliste", "Policier", "Avocat", "Médecin légiste"], 0,
      "Jack McEvoy est journaliste criminel, et enquête après la mort de son frère, policier à Denver."],
    [100, "Que laisse le tueur près de ses victimes ?", ["Une citation de Poe", "Une carte à jouer", "Une rose fanée", "Un numéro codé"], 0,
      "Le tueur laisse des vers d'Edgar Allan Poe comme messages d'adieu, d'où son surnom de Poète."],
  ]],
  [["La Voie des Rois Volume 1 (Les Archives de Roshar, Tome 1)", "La Voie des Rois"], [
    [50, "Comment s'appelle la saga dont ce livre est le premier tome ?", ["Les Archives de Roshar", "Fils-des-Brumes", "Le Cycle de Ténébreuse", "La Roue du Temps"], 0,
      "La Voie des Rois ouvre Les Archives de Roshar (The Stormlight Archive) de Brandon Sanderson."],
    [100, "Quel phénomène météo rythme la vie sur Roshar ?", ["Les hautes tempêtes", "Les pluies de cendres", "Les brumes nocturnes", "Les marées de sable"], 0,
      "Sur Roshar, de violentes hautes tempêtes balaient régulièrement le monde et façonnent sa culture."],
  ]],
  [["Les Guerriers de l'Hiver"], [
    [50, "Quel conflit raconte ce roman d'Olivier Norek ?", ["La guerre d'Hiver", "La guerre de Corée", "La campagne de Russie", "Le siège de Leningrad"], 0,
      "Le roman raconte la guerre d'Hiver entre la Finlande et l'URSS, de 1939 à 1940, soit 113 jours de combats par un froid extrême."],
    [100, "Quel surnom porte le sniper Simo Häyhä ?", ["La Mort Blanche", "L'Ours des neiges", "Le Loup gris", "L'Ange noir"], 0,
      "Le livre est né de la découverte du destin de Simo Häyhä, sniper finlandais surnommé la Mort Blanche."],
  ]],
  [["La Prophétie des abeilles"], [
    [50, "De quel roman de Bernard Werber ce livre est-il la suite ?", ["La Boîte de Pandore", "Le Miroir de Cassandre", "Les Fourmis", "Le Rire du cyclope"], 0,
      "La Prophétie des abeilles prolonge directement La Boîte de Pandore, publié en 2021."],
    [100, "Qui a écrit la prophétie que l'on cherche à retrouver ?", ["Un templier, à Jérusalem", "Un moine, en Égypte", "Un alchimiste, à Prague", "Un astronome, à Athènes"], 0,
      "La prophétie a été écrite en 1099, à Jérusalem, par un chevalier templier, et le roman raconte la quête pour la retrouver."],
  ]],
  [["Le livre du voyage"], [
    [50, "À quelle personne le livre s'adresse-t-il au lecteur ?", ["À la deuxième personne, « tu »", "À la première personne, « je »", "À la troisième personne, « il »", "À la première du pluriel, « nous »"], 0,
      "Le Livre du voyage parle directement au lecteur en « tu » : c'est lui qui imagine l'aventure, guidé par Bernard Werber."],
    [100, "En quelle année est paru ce livre ?", ["1997", "1987", "2003", "2010"], 0,
      "Le Livre du voyage de Bernard Werber est paru en 1997."],
  ]],
];

require("./quiz-overrides.js")(BOOKS);
const esc = (s) => s.replace(/'/g, "''");
let out = "-- Questions de lecture, lot 6 : livres en cours (généré par scripts/quiz-seed-6.js)\n";
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
fs.writeFileSync("supabase-quiz-seed-6.sql", out);
fs.mkdirSync("src/data/quiz", { recursive: true });
fs.writeFileSync("src/data/quiz/6.json", JSON.stringify(entries, null, 1));
console.log(rows.length + " lignes, " + BOOKS.length + " livres");
