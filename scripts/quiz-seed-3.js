// Génère supabase-quiz-seed-3.sql : lot 3, livres moins connus. Un seul palier quand une
// seule question large est sûre (50 % ou 100 %).
// node scripts/quiz-seed-3.js
const fs = require("fs");
const key = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const BOOKS = [
  [["Les mains du miracle"], [
    [50, "Quel dignitaire nazi Félix Kersten soigne-t-il grâce à ses massages ?", ["Goebbels", "Himmler", "Goering", "Hess"], 1,
      "Le masseur finlandais Félix Kersten soulage les douleurs d'estomac d'Heinrich Himmler. Cette relation de confiance lui donne un pouvoir d'influence rare."],
    [100, "Que cherche Kersten à obtenir de Himmler en échange de ses soins ?", ["De l'argent", "La libération de prisonniers et d'internés", "Un poste au gouvernement", "Un passeport pour la Suède"], 1,
      "Kersten négocie la libération de nombreux détenus, dont des Juifs et des Scandinaves. Le roman de Kessel s'appuie sur cette histoire vraie."],
  ]],
  [["Dans son silence", "The Silent Patient"], [
    [50, "Quel est le métier de Theo Faber ?", ["Avocat", "Psychothérapeute", "Policier", "Journaliste"], 1,
      "Theo, psychothérapeute, obtient un poste à la clinique où est internée Alicia Berenson. Il veut la faire parler après sa condamnation pour le meurtre de son mari."],
    [100, "Qui a réellement tué Gabriel, le mari d'Alicia ?", ["Alicia elle-même", "Theo Faber", "Le frère d'Alicia", "Kathy"], 1,
      "Theo, obsédé par Alicia, a organisé les événements et commis le meurtre. Son journal retrouvé par Alicia dévoile le piège."],
  ]],
  [["Dark Matter"], [
    [50, "Quel est le métier de Jason Dessen au début du roman ?", ["Médecin", "Professeur de physique", "Journaliste", "Policier"], 1,
      "Jason mène une vie tranquille à Chicago avec sa femme Daniela et son fils, après avoir renoncé à une grande carrière scientifique. Cette vie est bouleversée par son enlèvement."],
  ]],
  [["Replay"], [
    [50, "Que se passe-t-il quand Jeff Winston meurt à 43 ans ?", ["Il disparaît pour toujours", "Il se réveille à 18 ans, 25 ans plus tôt, avec sa mémoire", "Il devient un fantôme", "Il change de corps dans le futur"], 1,
      "Jeff revit sa vie depuis 1963 avec toutes ses connaissances. Il comprend que ce cycle peut se répéter à chaque mort."],
  ]],
  [["L'énigme de la chambre 622"], [
    [50, "Dans quel cadre se déroule le meurtre non résolu qui sert de fil rouge à l'intrigue ?", ["Un hôtel de luxe à Verbier", "Un château en Normandie", "Un train de nuit", "Une clinique suisse"], 0,
      "Un meurtre a eu lieu au Palace de Verbier, dans la chambre 622, sans que personne ne soit jamais identifié. Le narrateur enquête avec Scarlett."],
  ]],
  [["Inconnu à cette adresse"], [
    [100, "Comment Max se venge-t-il de Martin, qui l'a abandonné sous le nazisme ?", ["Il le dénonce aux autorités", "Il lui envoie des lettres au contenu suspect qui attirent la censure nazie sur lui", "Il l'attaque en justice", "Il tue sa famille"], 1,
      "Max, juif, écrit à Martin des lettres codées qui alertent la censure nazie. Martin, compromis, finit par voir ses lettres revenir : « destinataire inconnu »."],
  ]],
  [["Je suis une légende", "I Am Legend"], [
    [100, "Que comprend Robert Neville à la fin du roman ?", ["Qu'il est immunisé grâce à un vaccin", "Qu'il est devenu une légende, un monstre pour la nouvelle société des infectés", "Que le virus a disparu", "Qu'il n'est pas le dernier homme"], 1,
      "Neville a tué de nombreux infectés qui forment désormais une société organisée : il en est le « monstre ». Il accepte son sort et devient la légende du titre."],
  ]],
  [["Petit pays"], [
    [50, "Dans quel pays Gabriel, le narrateur, passe-t-il son enfance ?", ["Rwanda", "Burundi", "Congo", "Kenya"], 1,
      "Gabriel vit au Burundi, dans une enclave d'enfance heureuse, jusqu'à la guerre civile qui éclate dans la région. Son père est français et sa mère rwandaise."],
  ]],
  [["Rhinocéros"], [
    [50, "Que deviennent peu à peu les habitants de la ville ?", ["Des statues", "Des rhinocéros", "Des fantômes", "Des animaux sauvages"], 1,
      "La « rhinocérite » transforme les habitants en rhinocéros, par conformisme. Bérenger, lui, s'interroge devant ce mal contagieux."],
    [100, "Que décide Bérenger à la fin ?", ["De suivre les autres", "De résister, seul humain, en refusant de capituler", "De fuir la ville", "De devenir rhinocéros par amour"], 1,
      "Resté le dernier homme, Bérenger crie qu'il ne capitulera pas. Ionesco met en scène la résistance à la pensée unique."],
  ]],
  [["Un sac de billes"], [
    [50, "Pourquoi le père de Joseph et Maurice les envoie-t-il seuls loin de Paris ?", ["Pour passer des vacances", "Pour échapper aux persécutions visant les Juifs", "Pour un travail à la campagne", "Pour étudier"], 1,
      "Dans la France occupée, être juif devient dangereux : le père confie à ses fils la mission de fuir vers la zone libre. Les deux enfants se débrouillent seuls."],
  ]],
  [["L'Enfant de Noé"], [
    [50, "Qui cache Joseph, enfant juif, pendant l'Occupation en Belgique ?", ["Un instituteur", "Le père Pons, un prêtre", "Un fermier", "Un rabbin"], 1,
      "Le père Pons accueille Joseph et d'autres enfants sous de fausses identités. Il y risque sa vie."],
  ]],
  [["La Défense Lincoln", "The Lincoln Lawyer"], [
    [50, "D'où Mickey Haller dirige-t-il son cabinet d'avocat ?", ["D'un grand bureau", "De la banquette arrière de sa Lincoln", "De chez lui", "D'un café"], 1,
      "Mickey, avocat pénaliste, passe ses journées entre tribunaux et prisons, dans une Lincoln avec chauffeur. L'affaire d'un riche héritier va tout bouleverser."],
  ]],
  [["La femme à la fenêtre", "The Woman in the Window"], [
    [50, "Que croit avoir vu Anna Fox chez ses voisins ?", ["Un cambriolage", "Un meurtre", "Une dispute", "Un enlèvement d'enfant"], 1,
      "Anna, agoraphobe, observe ses voisins depuis sa fenêtre. Personne ne la croit lorsqu'elle affirme avoir assisté à un meurtre."],
  ]],
  [["Lettre d'une inconnue"], [
    [100, "Que révèle la lettre à l'écrivain R. ?", ["Qu'il a un frère", "Qu'une femme l'aime en secret depuis l'adolescence et qu'ils ont eu un fils", "Qu'il est héritier", "Qu'il est accusé d'un crime"], 1,
      "Une femme, mourante, lui raconte son amour silencieux, une nuit passée ensemble et leur fils mort. R. ne l'avait jamais reconnue."],
  ]],
  [["L'ART DE LA GUERRE", "L'Art de la guerre"], [
    [100, "Selon Sun Tzu, quelle est la plus haute victoire ?", ["Détruire l'armée ennemie", "Vaincre sans combattre", "Prendre la capitale", "Obtenir un tribut"], 1,
      "Sun Tzu juge supérieur de soumettre l'ennemi sans bataille. Il privilégie la ruse, la préparation et la connaissance de l'adversaire."],
  ]],
  [["Les Misérables"], [
    [50, "Quel geste de Mgr Myriel change la vie de Jean Valjean ?", ["Il le dénonce", "Il lui offre aussi les chandeliers qu'il vient de voler", "Il l'embauche", "Il le fait évader"], 1,
      "Au lieu de le dénoncer pour le vol de l'argenterie, l'évêque ajoute les chandeliers. Valjean, bouleversé, décide de devenir un homme juste."],
    [100, "Comment Javert met-il fin à ses jours ?", ["Il est tué sur une barricade", "Il se jette dans la Seine", "Il est fusillé", "Il disparaît à l'étranger"], 1,
      "Javert, déchiré entre la loi et la dette qu'il doit à Valjean, se jette dans la Seine. Cette contradiction lui est insupportable."],
  ]],
  [["Les Pilliers De La Terre", "Les Piliers de la Terre"], [
    [50, "Quelle construction est au cœur du roman ?", ["Un château fort", "La cathédrale de Kingsbridge", "Un pont", "Une abbaye en Écosse"], 1,
      "Tom Builder rêve de bâtir une cathédrale. Sa construction se mêle aux luttes de pouvoir de l'Angleterre du XIIe siècle."],
  ]],
  [["Les Rois maudits", "Le Roi de fer"], [
    [50, "Qui lance la malédiction contre la dynastie des Capétiens ?", ["Le pape Clément V", "Jacques de Molay, grand maître des Templiers, sur le bûcher", "Enguerrand de Marigny", "Isabelle de France"], 1,
      "Avant de mourir sur le bûcher, Jacques de Molay maudit Philippe le Bel, le pape et Nogaret. Les morts qui suivent alimentent la légende."],
  ]],
  [["La pierre et le sabre (Musashi, #1)", "La pierre et le sabre"], [
    [50, "Quel nom adopte Takezō après avoir été sauvé et éduqué ?", ["Sasaki Kojirō", "Miyamoto Musashi", "Matahachi", "Takuan"], 1,
      "Sauvé par le moine Takuan, Takezō renaît sous le nom de Miyamoto Musashi. Il entame alors une voie de perfectionnement par le sabre."],
  ]],
  [["The Unhoneymooners (Unhoneymooners, #1)", "The Unhoneymooners"], [
    [50, "Pourquoi Olive et Ethan partent-ils ensemble en voyage de noces ?", ["Ils sont mariés", "Tous les autres invités sont tombés malades, et ils profitent du voyage prépayé", "Ils ont gagné un concours", "Un ami a annulé"], 1,
      "Une intoxication alimentaire frappe tous les invités du mariage, sauf eux. Ils partent à Maui en se faisant passer pour de jeunes mariés."],
    [100, "Que deviennent Olive et Ethan à la fin ?", ["Ils se séparent à jamais", "Ils se mettent ensemble", "Ils déménagent séparément", "Ils restent amis"], 1,
      "Les deux rivaux découvrent qu'ils s'aiment : l'« enemies to lovers » est la mécanique du livre."],
  ]],
  [["The Spanish Love Deception (Love Deception, #1)", "The Spanish Love Deception"], [
    [50, "Qui Catalina emmène-t-elle comme faux petit ami au mariage de sa sœur en Espagne ?", ["Son ex", "Aaron, un collègue qu'elle déteste", "Son voisin", "Un ami d'enfance"], 1,
      "Catalina demande à Aaron Blackford, qu'elle trouve insupportable au bureau, de jouer son compagnon. Leur arrangement devient plus complexe en route."],
  ]],
  [["Normal People"], [
    [50, "Quel lien relie d'abord Connell et Marianne ?", ["Ils sont cousins", "La mère de Connell fait le ménage chez la famille de Marianne", "Ils sont voisins", "Ils sont collègues"], 1,
      "Connell, populaire, vient chercher sa mère chez Marianne, élève solitaire. Leur relation reste secrète au lycée."],
  ]],
  [["Last Samurai Standing 1", "Last samurai standing"], [
    [50, "Quel est le principe du jeu mortel de Last Samurai Standing ?", ["Un tournoi dans une arène", "D'anciens samouraïs s'affrontent à mort sur la route du Tokaido", "Une chasse à l'homme à Kyoto", "Une course de chevaux"], 1,
      "En 1878, des centaines d'anciens guerriers se battent pour gagner. Le gagnant remporte une énorme récompense."],
  ]],
  [["A comme aujourd'hui", "Every Day"], [
    [50, "Quel est le point de départ de l'histoire d'A ?", ["A voyage dans le temps", "A se réveille chaque jour dans le corps d'une personne différente", "A rêve d'un autre monde", "A perd la mémoire chaque jour"], 1,
      "A habite chaque jour un adolescent différent, sans jamais garder de corps. Sa rencontre avec Rhiannon bouleverse cette règle."],
  ]],
  [["Boomerang"], [
    [50, "Sur quelle île se déroule le retour d'Antoine sur les lieux de son passé ?", ["À Noirmoutier", "À Bordeaux", "À Biarritz", "À Saint-Malo"], 0,
      "Antoine retourne à Noirmoutier, où l'attendent les secrets de sa famille. Le roman mêle présent et souvenirs d'enfance."],
  ]],
  [["Le mage du Kremlin"], [
    [50, "Qui est Vadim Baranov, le « mage » du titre ?", ["Un chef militaire", "Un conseiller du pouvoir russe, inspiré de Vladislav Sourkov", "Un ambassadeur", "Un journaliste"], 1,
      "Baranov est le conseiller de Poutine, inspiré de Sourkov : il théâtralise le pouvoir. Le roman suit son ascension et son recul."],
  ]],
  [["Le pouvoir du moment présent", "The Power of Now"], [
    [100, "Selon Eckhart Tolle, où se trouve la vraie vie ?", ["Dans l'avenir", "Dans le moment présent", "Dans le passé", "Dans les souvenirs"], 1,
      "Tolle explique que souffrance et angoisse viennent de l'attachement au passé et à l'avenir. La paix vient de l'attention au présent."],
  ]],
  [["Le Comte de Monte-Cristo II"], [
    [50, "Qui le comte sauve-t-il des bandits de Luigi Vampa, à Rome ?", ["Franz d'Épinay", "Albert de Morcerf", "Maximilien Morrel", "Danglars"], 1,
      "Albert, enlevé par le chef de bande Luigi Vampa, est libéré grâce à l'intervention du comte. Il lui devra sa vie."],
  ]],
  [["La Splendeur et l'Infamie", "The Splendid and the Vile"], [
    [100, "Sur quelle période de la guerre se concentre le livre d'Erik Larson ?", ["La libération de Paris", "L'année de Churchill à Londres sous le Blitz (1940-1941)", "Le débarquement en Normandie", "La bataille de Stalingrad"], 1,
      "Larson suit Churchill, sa famille et son entourage pendant la première année du Blitz. On y suit le quotidien du pouvoir pendant la guerre."],
  ]],
];

require("./quiz-overrides.js")(BOOKS);
const esc = (s) => s.replace(/'/g, "''");
let out = "-- Questions de lecture, lot 3 (généré par scripts/quiz-seed-3.js)\n";
out += "insert into public.book_quiz (book_key, book_title, tier, question, options, answer, explanation) values\n";
const rows = [];
const seen = new Set();
for (const [titles, qs] of BOOKS) {
  for (const t of titles) {
    for (const [tier, q, opts, ans, expl] of qs) {
      if (seen.has(key(t) + tier)) continue;
      seen.add(key(t) + tier);
      rows.push(`('${esc(key(t))}', '${esc(t)}', ${tier}, '${esc(q)}', '${esc(JSON.stringify(opts))}'::jsonb, ${ans}, '${esc(expl)}')`);
    }
  }
}
out += rows.join(",\n") + "\non conflict (book_key, tier) do update set book_title = excluded.book_title, question = excluded.question, options = excluded.options, answer = excluded.answer, explanation = excluded.explanation;\n";
fs.writeFileSync("supabase-quiz-seed-3.sql", out);
console.log(rows.length + " lignes, " + BOOKS.length + " livres");

// Export JSON pour le test local (/dev/quiz-test)
const entries = [];
for (const b of BOOKS) {
  const titles = Array.isArray(b) ? b[0] : b.titles;
  const qs = Array.isArray(b) ? b[1] : b.q;
  for (const t of titles) for (const [tier, q, opts, ans, expl] of qs) {
    if (tier !== 50 && tier !== 100) continue;
    entries.push({ book_key: key(t), book_title: t, tier, question: q, options: opts, answer: ans, explanation: expl });
  }
}
fs.mkdirSync("src/data/quiz", { recursive: true });
fs.writeFileSync("src/data/quiz/3.json", JSON.stringify(entries, null, 1));
