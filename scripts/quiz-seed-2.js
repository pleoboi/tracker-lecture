// Génère supabase-quiz-seed-2.sql : lot 2 de questions de lecture (paliers 50 % et 100 %).
// node scripts/quiz-seed-2.js
const fs = require("fs");
const key = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// [titres (alias inclus), [palier, question, options, index bonne réponse, explication] ...]
const BOOKS = [
  [["L'Ombre du vent", "La sombra del viento"], [
    [50, "Quel personnage cherche à réunir et à brûler tous les livres de Julián Carax ?", ["Un libraire rival de Sempere", "Un homme défiguré qui se fait appeler Laín Coubert", "Le policier Fumero en personne", "Nuria Monfort"], 1,
      "Laín Coubert est le nom du diable dans un roman de Carax : celui qui détruit ses livres emprunte donc le nom de son propre personnage. Daniel va chercher qui il est vraiment."],
    [100, "Comment l'histoire se referme-t-elle, en écho à son tout début ?", ["Daniel brûle le roman de Carax", "Daniel s'apprête à emmener son fils au Cimetière des livres oubliés, comme son père l'avait fait", "Daniel quitte Barcelone pour toujours", "Daniel devient éditeur de Carax"], 1,
      "Le roman commence quand le père de Daniel l'emmène pour la première fois au Cimetière des livres oubliés. Il se termine sur le même geste, transmis à la génération suivante."],
  ]],
  [["La promesse de l'aube"], [
    [50, "Quel avenir Mina, la mère de Romain, rêve-t-elle pour son fils ?", ["Un grand chef d'orchestre", "Ambassadeur de France, héros de guerre, grand écrivain", "Un médecin à Paris", "Un riche banquier"], 1,
      "Mina est persuadée que son fils sera un grand homme : elle lui répète qu'il deviendra ambassadeur, officier de la Légion d'honneur et écrivain. Ce rêve pèse sur toute sa vie."],
    [100, "Que découvre Romain au retour de la guerre au sujet de sa mère ?", ["Qu'elle l'a oublié", "Qu'elle était morte depuis plusieurs années, ses lettres ayant été écrites à l'avance", "Qu'elle s'était remariée", "Qu'elle était devenue célèbre"], 1,
      "Mina est morte pendant la guerre mais avait écrit des lettres d'avance, envoyées à Romain par une amie pour qu'il tienne bon. Il comprend alors jusqu'où est allé son amour."],
  ]],
  [["Le Joueur d'Echec", "Le Joueur d'échecs"], [
    [50, "Comment le docteur B. a-t-il appris à jouer aux échecs pendant son isolement par les nazis ?", ["Avec un vrai échiquier offert par un gardien", "En rejouant de tête les parties d'un livre qu'il avait volé", "En observant les gardes jouer", "Grâce à un autre prisonnier"], 1,
      "Isolé dans une chambre d'hôtel, il vole un recueil de parties de maîtres et les rejoue mentalement, jusqu'à se dédoubler. Ce jeu solitaire le sauve de l'ennui, puis menace sa raison."],
    [100, "Que fait le docteur B. à la fin de la seconde partie contre Czentovic ?", ["Il gagne et devient champion", "Il abandonne et décide de ne plus jamais jouer aux échecs", "Il s'évanouit sans finir la partie", "Il demande une troisième revanche"], 1,
      "Le rythme volontairement lent de Czentovic le déstabilise ; il reprend conscience de sa fragilité, abandonne et s'excuse. Il renonce aux échecs par peur de retomber dans la folie."],
  ]],
  [["La Vérité sur l'Affaire Harry Quebert"], [
    [50, "Où retrouve-t-on le corps de Nola Kellergan en 2008 ?", ["Dans le lac près de Somerset", "Enterré dans la propriété de Harry Quebert", "Dans la forêt de Side Creek", "Dans la maison du pasteur"], 1,
      "La découverte du corps dans le jardin de Harry fait de lui le suspect numéro un de la disparition de 1975. Marcus, persuadé de son innocence, mène alors sa propre enquête."],
    [100, "Quel titre Marcus donne-t-il finalement au livre qu'il écrit sur l'enquête ?", ["L'Affaire Harry Quebert", "La Vérité sur l'affaire Harry Quebert", "Les Origines du mal", "Nola"], 1,
      "Le titre évolue au fil de l'écriture : « La Vérité sur l'affaire Harry Quebert » est le livre dans le livre, celui que le lecteur est en train de lire."],
  ]],
  [["Le Comte de Monte-Cristo I", "Le Comte de Monte-Cristo"], [
    [50, "Qui Edmond Dantès rencontre-t-il au château d'If, qui lui révèle l'existence d'un trésor ?", ["Le geôlier Caderousse", "L'abbé Faria", "Villefort", "Mercédès"], 1,
      "L'abbé Faria, érudit enfermé depuis des années, creuse un tunnel qui débouche par erreur chez Dantès. Il l'instruit et lui révèle le trésor caché sur l'île de Monte-Cristo."],
    [100, "Comment Dantès s'évade-t-il du château d'If ?", ["En creusant un tunnel jusqu'à la mer", "En prenant la place du cadavre de Faria, cousu dans un sac jeté à la mer", "Grâce à un bateau envoyé par Mercédès", "En corrompant un gardien"], 1,
      "À la mort de Faria, Dantès prend la place du corps dans le sac funéraire. Jeté à la mer, il s'en libère et gagne l'île où l'attend la fortune qui lui permettra de se venger."],
  ]],
  [["Le fantôme de l'opéra"], [
    [50, "Sous quel nom Christine Daaé connaît-elle son mystérieux professeur de chant ?", ["Le Maître de musique", "L'Ange de la musique", "Le Roi de l'Opéra", "Monsieur Erik"], 1,
      "Christine croit que l'Ange de la musique, annoncé par son père mourant, lui donne des leçons. C'est en réalité Erik, caché dans les murs et les sous-sols de l'Opéra."],
    [100, "Que fait Erik à la fin, après avoir ému Christine par son baiser ?", ["Il tue Raoul", "Il libère Christine et Raoul", "Il détruit l'Opéra", "Il s'enfuit avec Christine"], 1,
      "Bouleversé que Christine l'embrasse sans dégoût, Erik cède et les laisse partir. Il meurt peu après, brisé : le « monstre » est surtout un homme seul."],
  ]],
  [["Harry Potter and the Chamber of Secrets", "Harry Potter et la Chambre des secrets"], [
    [50, "À qui appartenait le journal intime que Harry trouve dans les toilettes de Mimi Geignarde ?", ["Dumbledore", "Tom Elvis Jedusor", "Lucius Malefoy", "Salazar Serpentard"], 1,
      "Le journal conserve un souvenir de Tom Jedusor, élève il y a cinquante ans, qui deviendra Voldemort. Il manipule Ginny par ses réponses écrites."],
    [100, "Quelle arme permet à Harry de vaincre le basilic ?", ["La baguette de Dumbledore", "L'épée de Gryffondor sortie du Choixpeau", "Un sortilège de Lockhart", "Les larmes de Fumseck"], 1,
      "Harry saisit l'épée de Gryffondor, que seul un vrai Gryffondor peut tirer du Choixpeau, et la plante dans la gueule du basilic. Un croc brisé lui sert ensuite à détruire le journal."],
  ]],
  [["Harry Potter and the Order of the Phoenix", "Harry Potter et l'Ordre du Phénix"], [
    [50, "Qui le Ministère impose-t-il comme professeur de Défense contre les forces du Mal ?", ["Dolores Ombrage", "Rogue", "Lupin", "Mondingus Fletcher"], 0,
      "Dolores Ombrage, inspectrice puis directrice, impose des règlements absurdes. Harry et ses amis fondent l'Armée de Dumbledore pour apprendre à se défendre."],
    [100, "Qui meurt lors du combat au Département des Mystères ?", ["Sirius Black", "Remus Lupin", "Arthur Weasley", "Alastor Maugrey"], 0,
      "Sirius, venu secourir Harry tombé dans un piège de Voldemort, est frappé par Bellatrix et disparaît derrière le voile. Harry perd son parrain, dernier lien familial."],
  ]],
  [["Harry Potter and the Half-Blood Prince", "Harry Potter et le Prince de Sang-Mêlé"], [
    [50, "Quel objet permet à Harry de réussir ses potions bien mieux que les autres ?", ["Une baguette ancienne", "Un manuel de potions annoté par le « Prince de sang-mêlé »", "Un sortilège de Slughorn", "Un chaudron de Hagrid"], 1,
      "Le vieux manuel de Harry est couvert de notes d'un mystérieux Prince de sang-mêlé : cela agace Hermione et intrigue Rogue. Le mystère de son identité n'est levé qu'à la fin."],
    [100, "Qui tue Dumbledore au sommet de la tour d'Astronomie ?", ["Draco Malefoy", "Severus Rogue", "Bellatrix Lestrange", "Fenrir Greyback"], 1,
      "Draco a désarmé Dumbledore, mais c'est Rogue qui lance le sortilège mortel. Harry découvre aussi que Rogue est le Prince de sang-mêlé."],
  ]],
  [["Harry Potter and the Deathly Hallows", "Harry Potter et les Reliques de la Mort"], [
    [50, "Quel objet Dumbledore a-t-il légué à Ron par testament ?", ["Le Vif d'or", "Le Déluminateur", "L'épée de Gryffondor", "Le Livre de Beedle le Barde"], 1,
      "Le Déluminateur aspire la lumière et guide Ron vers ses amis quand il a quitté la quête. Hermione reçoit le livre de Beedle le Barde, Harry le Vif d'or."],
    [100, "Qui est le véritable maître de la Baguette de Sureau lors du duel final contre Voldemort ?", ["Voldemort", "Harry", "Rogue", "Draco Malefoy"], 1,
      "Draco a désarmé Dumbledore puis Harry a désarmé Draco : la baguette obéit donc à Harry. Le sortilège de mort de Voldemort se retourne contre lui."],
  ]],
  [["Les Trois Mousquetaires"], [
    [50, "Que doit rapporter d'Angleterre d'Artagnan pour sauver l'honneur de la reine ?", ["Une lettre de Buckingham", "Les ferrets de diamants", "Un portrait de la reine", "Un traité de paix"], 1,
      "La reine a offert ses ferrets à Buckingham : d'Artagnan, avec l'aide des mousquetaires, doit les récupérer à temps pour le bal. Milady en a volé deux, qu'il faut remplacer."],
    [100, "Comment se termine la vie de Milady de Winter ?", ["Elle s'échappe en Angleterre", "Elle est exécutée par le bourreau de Lille, devant les quatre amis", "Elle est tuée par d'Artagnan en duel", "Elle est pardonnée par Richelieu"], 1,
      "Les quatre amis jugent Milady, responsable de la mort de Constance et du duc de Buckingham, et la font exécuter. Richelieu pardonne pourtant à d'Artagnan."],
  ]],
  [["Le journal d'Anne Frank"], [
    [50, "Pourquoi la famille Frank se cache-t-elle dans l'Annexe ?", ["Pour fuir une épidémie", "Parce que Margot a reçu une convocation pour un camp de travail", "Pour échapper à des dettes", "Pour suivre Otto Frank en voyage"], 1,
      "La convocation de Margot pousse les Frank à entrer dans la clandestinité, en juillet 1942. Ils sont rejoints par la famille Van Pels, puis par Fritz Pfeffer."],
    [100, "Combien de membres de la famille Frank survivent à la guerre ?", ["Aucun", "Seul Otto Frank", "Anne et Margot", "Toute la famille"], 1,
      "Anne meurt du typhus à Bergen-Belsen début 1945, Margot peu avant. Otto, seul survivant, publie le journal retrouvé par Miep Gies."],
  ]],
  [["Ne tirez pas sur l'oiseau moqueur", "To Kill a Mockingbird"], [
    [50, "Quel avocat défend Tom Robinson, accusé à tort de viol ?", ["Atticus Finch", "Jem Finch", "Boo Radley", "Heck Tate"], 0,
      "Atticus, père de Scout, accepte la défense malgré l'hostilité de la ville. Il tente de prouver l'innocence de Tom devant un jury entièrement blanc."],
    [100, "Qui sauve Scout et Jem de l'attaque de Bob Ewell ?", ["Heck Tate", "Atticus", "Boo Radley", "Calpurnia"], 2,
      "Boo Radley, le voisin reclus dont tout le monde avait peur, intervient pour sauver les enfants. L'« oiseau moqueur » du titre, c'est lui : un innocent protégé en retour."],
  ]],
  [["Martin Eden"], [
    [50, "Qui fait découvrir à Martin Eden le monde de la culture et de l'écriture, par amour ?", ["Ruth Morse", "Lizzie Connolly", "Maria Silva", "Mademoiselle Brissenden"], 0,
      "Ruth, jeune bourgeoise, lui apprend la grammaire et la littérature. Martin se met à lire et à écrire avec acharnement pour devenir digne d'elle."],
    [100, "Comment se termine l'histoire de Martin Eden ?", ["Il épouse Ruth", "Il met fin à ses jours en se jetant d'un bateau", "Il retourne en mer", "Il devient professeur"], 1,
      "Devenu riche et célèbre, Martin est désabusé : ceux qui le méprisaient l'admirent maintenant. Il se noie volontairement en sortant par le hublot de sa cabine."],
  ]],
  [["Romeo and Juliet", "Roméo et Juliette"], [
    [50, "Qui Roméo tue-t-il, ce qui entraîne son bannissement de Vérone ?", ["Paris", "Tybalt", "Mercutio", "Capulet"], 1,
      "Tybalt a tué Mercutio, ami de Roméo, qui venge sa mort et est banni. C'est le tournant qui précipite la tragédie."],
    [100, "Pourquoi Roméo se donne-t-il la mort ?", ["Il est condamné à mort", "Il croit Juliette morte alors qu'elle dort sous l'effet d'une potion", "Il est trahi par frère Laurent", "Il perd un duel contre Paris"], 1,
      "Le message de frère Laurent n'arrive pas : Roméo apprend la fausse mort de Juliette. Elle se réveille, le trouve mort et se poignarde à son tour."],
  ]],
  [["The Great Gatsby", "Gatsby le Magnifique"], [
    [50, "Que fait Gatsby la nuit, au bout de son quai, face à la baie ?", ["Il pêche", "Il tend les bras vers une lumière verte", "Il écrit à Daisy", "Il guette la police"], 1,
      "La lumière verte brille au bout du ponton de Daisy, de l'autre côté de la baie. Elle symbolise son rêve de la retrouver et de revenir au passé."],
    [100, "Qui conduisait la voiture qui a tué Myrtle Wilson ?", ["Gatsby", "Tom Buchanan", "Daisy Buchanan", "Nick Carraway"], 2,
      "C'est Daisy qui conduit, mais Gatsby accepte d'endosser la faute. Wilson, croyant Gatsby coupable, l'abat avant de se suicider."],
  ]],
  [["Dune"], [
    [50, "Quelle ressource unique, que seule Arrakis produit, fait de cette planète un enjeu majeur ?", ["L'eau", "L'épice (le mélange)", "Le plutonium", "Le pétrole"], 1,
      "L'épice prolonge la vie, étend la conscience et permet la navigation spatiale. Qui contrôle Arrakis contrôle l'empire."],
    [100, "Qui Paul affronte-t-il et tue-t-il en duel à la fin ?", ["Le baron Harkonnen", "Feyd-Rautha", "L'empereur Shaddam", "Stilgar"], 1,
      "Feyd-Rautha, neveu du baron, est le champion des Harkonnen. Après sa victoire, Paul impose ses conditions au trône."],
  ]],
  [["Project Hail Mary"], [
    [50, "Comment Grace surnomme-t-il l'extraterrestre qu'il rencontre dans l'espace ?", ["Bobby", "Rocky", "Spock", "Eridan"], 1,
      "Grace appelle « Rocky » cet alien en carapace de pierre, qui communique par des notes de musique. Ensemble, ils cherchent comment sauver leurs deux mondes."],
    [100, "Où Grace choisit-il finalement de rester ?", ["Sur Terre", "Sur Erid, parmi les Eridiens", "Dans le vaisseau", "Sur Mars"], 1,
      "Grace renonce à rentrer : il enseigne aux jeunes Eridiens. Sa vie loin de chez lui donne un sens à son sacrifice."],
  ]],
  [["Matilda"], [
    [50, "Que découvre Matilda quand elle se concentre très fort sur un objet ?", ["Elle peut lire dans les pensées", "Elle peut le déplacer par la pensée", "Elle peut parler aux animaux", "Elle peut voler"], 1,
      "Matilda comprend qu'elle a un pouvoir télékinétique après une colère contre Mlle Legourdin. Elle l'utilise pour rendre justice."],
    [100, "Avec qui Matilda vit-elle à la fin du livre ?", ["Ses parents", "Mlle Candy", "Mlle Legourdin", "Une famille d'accueil lointaine"], 1,
      "Ses parents s'enfuient et la laissent à Mlle Candy, la douce institutrice qui l'a toujours soutenue. Elle trouve ainsi la famille qu'elle méritait."],
  ]],
  [["Percy Jackson - Le voleur de foudre", "Percy Jackson and the Lightning Thief"], [
    [50, "Qui Percy découvre-t-il être son père divin ?", ["Zeus", "Hadès", "Poséidon", "Hermès"], 2,
      "Percy est fils de Poséidon, ce qui le met immédiatement en danger : on l'accuse d'avoir volé la foudre de Zeus. Il a dix jours pour la retrouver."],
    [100, "Qui avait en réalité volé la foudre de Zeus ?", ["Hadès", "Luke, fils d'Hermès", "Ares", "Annabeth"], 1,
      "Luke, le conseiller de Camp Half-Blood, a trahi pour le compte de Cronos. Percy ramène la foudre à Zeus et évite la guerre entre dieux."],
  ]],
  [["Killers of the Flower Moon"], [
    [50, "Pourquoi les Osages sont-ils devenus riches dans les années 1920 ?", ["Grâce à l'agriculture", "Grâce au pétrole découvert sur leurs terres", "Grâce à l'or", "Grâce au commerce de fourrures"], 1,
      "Un gisement de pétrole sous la réserve les rend riches. Leur fortune attire aussi la convoitise et la violence."],
    [100, "Qui est le cerveau des meurtres des Osages ?", ["Ernest Burkhart", "William Hale, le « roi des collines Osages »", "Tom White", "Mollie Burkhart"], 1,
      "Hale manipulait ses neveux et des hommes de main pour hériter des droits pétroliers. L'enquête du Bureau of Investigation permet de le faire condamner."],
  ]],
  [["Le Meurtre de Roger Ackroyd (Hercule Poirot, #4)", "Le Meurtre de Roger Ackroyd"], [
    [50, "Qui est retrouvé assassiné dans son bureau ?", ["Roger Ackroyd", "Le docteur Sheppard", "Mrs Ferrars", "Ralph Paton"], 0,
      "Le riche Roger Ackroyd est tué après avoir reçu une lettre accusatrice. Hercule Poirot, retiré à la campagne, est appelé pour enquêter."],
    [100, "Qui est le meurtrier ?", ["Ralph Paton", "Le docteur Sheppard, le narrateur", "Le major Blunt", "Geoffrey Raymond"], 1,
      "Le docteur Sheppard, qui raconte l'histoire, a menti par omission. Son récit fait partie de l'intrigue : Poirot le démasque."],
  ]],
  [["L'Odyssée"], [
    [50, "Comment Ulysse trompe-t-il le Cyclope Polyphème ?", ["Il lui dit s'appeler « Personne »", "Il l'enivre de vin et s'enfuit", "Il l'enferme dans sa caverne", "Il lui offre un faux trésor"], 0,
      "Quand Polyphème hurle que « Personne » l'a aveuglé, les autres Cyclopes ne viennent pas l'aider. Ulysse s'enfuit sous le ventre d'un bélier."],
    [100, "Comment Pénélope reconnaît-elle enfin Ulysse ?", ["Par sa cicatrice", "Par le secret de leur lit nuptial", "Par sa voix", "Par son arc"], 1,
      "Pénélope le teste en parlant de déplacer le lit : seul Ulysse sait qu'il est taillé dans un olivier enraciné. Elle comprend alors que c'est bien lui."],
  ]],
  [["Le Portrait de Dorian Gray"], [
    [50, "Quel souhait Dorian formule-t-il devant son portrait ?", ["Devenir riche", "Que le portrait vieillisse à sa place", "Retrouver son enfance", "Devenir un peintre célèbre"], 1,
      "Dorian souhaite garder sa jeunesse et que son portrait porte les marques du temps. Le vœu est exaucé : chaque faute s'inscrit sur la toile."],
    [100, "Que se passe-t-il quand Dorian poignarde le portrait ?", ["Le portrait brûle", "Il meurt vieilli et le portrait retrouve sa beauté", "Rien ne se produit", "Le portrait disparaît"], 1,
      "En détruisant le tableau, Dorian se tue : il redevient un vieillard hideux et le portrait retrouve son éclat. Le prix de sa vie jeune est enfin payé."],
  ]],
  [["Le Trône de fer, Tome 1 : Le Trône de fer", "A Game of Thrones", "Le Trône de fer"], [
    [50, "Qui Catelyn Stark fait-elle arrêter, convaincue qu'il a voulu faire tuer Bran ?", ["Jaime Lannister", "Tyrion Lannister", "Varys", "Petyr Baelish"], 1,
      "Au détour d'une auberge, Catelyn prend Tyrion pour le commanditaire. Cet acte précipite la querelle entre Starks et Lannisters."],
    [100, "Quel événement clôt le premier tome, du côté de Daenerys ?", ["Elle épouse Khal Drogo", "Les œufs de dragon éclosent sur le bûcher de Drogo", "Elle devient reine de Westeros", "Elle perd ses dragons"], 1,
      "Daenerys entre dans le bûcher funéraire et en ressort avec trois dragons nés des œufs pétrifiés. C'est le premier signe du retour de la magie."],
  ]],
  [["Red Rising (Red Rising Saga, #1)", "Red Rising"], [
    [50, "Que fait Darrow après avoir été transformé physiquement en Or ?", ["Il rejoint l'armée de la Société", "Il infiltre l'Institut pour renverser la hiérarchie de l'intérieur", "Il retourne dans les mines", "Il fuit vers Mars"], 1,
      "Darrow, un Rouge mineur, est sculpté en Or après l'exécution d'Éo. Il intègre l'Institut, école d'élite des Ors, pour combattre le système de l'intérieur."],
  ]],
  [["La femme de ménage", "La Femme de ménage"], [
    [50, "Où Millie est-elle logée chez les Winchester ?", ["Dans la maison d'amis", "Dans une chambre sous les combles qui ferme de l'extérieur", "Dans la chambre de la fille", "À l'hôtel du village"], 1,
      "La petite chambre sous les toits ferme de l'extérieur, ce qui inquiète Millie. Elle comprend vite que quelque chose cloche chez la famille Winchester."],
  ]],
  [["L'épreuve - tome 1 Le Labyrinthe", "The Maze Runner"], [
    [50, "Comment Thomas arrive-t-il dans la Clairière ?", ["En parachute", "Dans un monte-charge, sans souvenirs sauf son prénom", "À pied", "Par un tunnel"], 1,
      "Chaque mois, un nouveau « Blocard » arrive par le monte-charge avec la mémoire effacée. Thomas est le premier à poser autant de questions sur le Labyrinthe."],
  ]],
];

require("./quiz-overrides.js")(BOOKS);
const esc = (s) => s.replace(/'/g, "''");
let out = "-- Questions de lecture, lot 2 : paliers 50 % et 100 % (généré par scripts/quiz-seed-2.js)\n";
out += "delete from public.book_quiz where book_key = 'la verite sur l affaire harry quebert' and tier = 100;\n";
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
fs.writeFileSync("supabase-quiz-seed-2.sql", out);
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
fs.writeFileSync("src/data/quiz/2.json", JSON.stringify(entries, null, 1));
