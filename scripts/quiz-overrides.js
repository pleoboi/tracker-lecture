// Équilibre les choix des questions : la bonne réponse ne doit être ni la plus longue, ni toujours à la même place.
// 1) OVERRIDES remplace les choix d'une question, bonne réponse en premier : "premier titre|palier": [bonne, faux, faux, faux]
//    (null supprime la question)
// 2) Tous les choix sont ensuite mélangés de façon déterministe (même ordre à chaque génération).
const OVERRIDES = {
  // Lot 1
  "La Ferme des animaux|50": ["Il le fait chasser par ses chiens dressés", "Il le dénonce à Jones pour qu'il le capture", "Il le bat lors d'un vote et l'exile", "Il l'envoie vendre du blé chez Pilkington"],
  "La Ferme des animaux|100": ["Cochons et fermiers jouer aux cartes ensemble", "Les cochons se battre entre eux autour de la table", "Jones revenir avec ses hommes reprendre la ferme", "Des hommes armés encercler la ferme de nuit"],
  "The Little Prince|50": ["Pour oublier qu'il a honte de boire", "Parce qu'il s'ennuie sur sa planète déserte", "Pour fêter une victoire qu'il a remportée", "Parce que le roi le lui a ordonné"],
  "The Little Prince|100": ["En se laissant mordre par le serpent jaune", "Avec l'avion réparé par le narrateur", "En suivant une migration d'oiseaux sauvages", "En traversant le désert jusqu'à la mer"],
  "L'étranger|100": ["Que beaucoup de spectateurs viennent le huer", "Que le président lui accorde sa grâce", "Revoir Marie une toute dernière fois", "Fumer une dernière cigarette en paix"],
  "Fahrenheit 451|50": ["Pour ne vexer aucune minorité ni aucun groupe", "À cause d'une loi votée après la guerre", "Parce que les gens ne savaient plus lire", "Pour faire oublier les horreurs de la guerre"],
  "Harry Potter and the Sorcerer's Stone (Harry Potter, #1)|100": ["Quirrell, avec Voldemort sur la nuque", "Rogue, fidèle serviteur de Dumbledore", "Malefoy, sur ordre de son père", "Hagrid, pour récupérer son dragon"],
  "1984|50": ["Dans une chambre louée chez un antiquaire", "Dans une cave du ministère de l'Amour", "Dans un entrepôt abandonné de Londres", "Dans la salle commune des Prolétaires"],

  // Lot 2
  "L'Ombre du vent|50": ["Un homme défiguré qui se fait appeler Laín Coubert", "Un libraire rival de Sempere, jaloux des livres", "Le policier Fumero, chargé d'une vieille enquête", "Nuria Monfort, ancienne amie de Carax"],
  "L'Ombre du vent|100": ["Daniel emmène son fils au Cimetière des livres oubliés", "Daniel brûle le dernier exemplaire du roman de Carax", "Daniel quitte Barcelone pour ne plus jamais revenir", "Daniel devient l'éditeur posthume de Julián Carax"],
  "La promesse de l'aube|50": ["Ambassadeur de France, héros de guerre et grand écrivain", "Chef d'orchestre célèbre dans les plus grandes salles", "Médecin réputé installé dans un quartier de Paris", "Riche banquier à la tête d'une grande maison"],
  "La promesse de l'aube|100": ["Qu'elle était morte, ses lettres écrites à l'avance", "Qu'elle l'avait oublié et vivait à l'étranger", "Qu'elle s'était remariée et avait refait sa vie", "Qu'elle était devenue célèbre sous un nom d'emprunt"],
  "Le Joueur d'Echec|50": ["En rejouant de tête les parties d'un livre volé", "Avec un échiquier offert par un gardien compatissant", "En observant les gardes jouer pendant les interrogatoires", "Grâce à un codétenu qui lui a tout appris"],
  "Le Joueur d'Echec|100": ["Il abandonne et renonce à jamais aux échecs", "Il gagne et est sacré champion du monde", "Il s'évanouit avant la fin de la partie", "Il réclame une troisième revanche immédiate"],
  "La Vérité sur l'Affaire Harry Quebert|50": ["Enterré dans la propriété de Harry Quebert", "Au fond du lac, près de la ville de Somerset", "Dans les bois derrière la maison du pasteur", "Dans une cave du commissariat de Somerset"],
  "La Vérité sur l'Affaire Harry Quebert|100": null, // la bonne réponse était le titre du livre lui-même
  "Le Comte de Monte-Cristo I|100": ["En prenant la place de Faria dans son sac funéraire", "En creusant lui-même un tunnel jusqu'à la mer", "Grâce à un bateau affrété par Mercédès", "En corrompant un gardien avec l'or de Faria"],
  "Le fantôme de l'opéra|100": ["Il laisse partir Christine et Raoul", "Il tue Raoul dans un duel au fond du lac", "Il fait s'effondrer le grand lustre de l'Opéra", "Il s'enfuit avec Christine hors de Paris"],
  "Harry Potter and the Chamber of Secrets|100": ["L'épée de Gryffondor sortie du Choixpeau", "La baguette de Dumbledore prêtée à Harry", "Un sortilège de Lockhart appris en cours", "Les larmes de Fumseck versées sur le monstre"],
  "Harry Potter and the Order of the Phoenix|50": ["Dolores Ombrage", "Severus Rogue", "Remus Lupin", "Alastor Maugrey"],
  "Harry Potter and the Half-Blood Prince|50": ["Un manuel de potions couvert de notes anonymes", "Un chaudron en étain prêté par Slughorn", "Une baguette ancienne offerte par Dumbledore", "Un sortilège de réussite appris à la bibliothèque"],
  "Les Trois Mousquetaires|100": ["Elle est exécutée par le bourreau de Lille", "Elle s'échappe et regagne l'Angleterre", "Elle est tuée par d'Artagnan lors d'un duel", "Elle est graciée par le cardinal de Richelieu"],
  "Le journal d'Anne Frank|50": ["Parce que Margot a été convoquée dans un camp", "Pour échapper à une épidémie qui frappait Amsterdam", "Parce qu'Otto devait fuir des créanciers", "Pour suivre Otto parti vivre à l'étranger"],
  "Martin Eden|100": ["Il se jette d'un bateau et se noie", "Il épouse Ruth et devient avocat", "Il repart en mer comme simple marin", "Il devient professeur de littérature"],
  "Romeo and Juliet|100": ["Il croit Juliette morte alors qu'elle dort", "Il est condamné à mort par le prince", "Il perd un duel contre le comte Paris", "Il apprend la trahison de frère Laurent"],
  "The Great Gatsby|50": ["Il tend les bras vers une lumière verte", "Il pêche seul pour oublier ses soirées", "Il écrit chaque nuit une lettre à Daisy", "Il guette l'arrivée de la police fédérale"],
  "Dune|50": ["L'épice, appelée le mélange", "L'eau cachée sous les dunes", "Le plutonium des vieux réacteurs", "Le pétrole des sables profonds"],
  "Project Hail Mary|100": ["Sur Erid, avec les Eridiens", "Sur Terre, auprès de sa famille", "À bord du Hail Mary, en orbite", "Sur Mars, dans une colonie"],
  "Matilda|50": ["Elle peut déplacer des objets par la pensée", "Elle peut lire dans les pensées des adultes", "Elle peut parler aux animaux du quartier", "Elle peut devenir invisible à volonté"],
  "Percy Jackson - Le voleur de foudre|100": ["Luke, fils d'Hermès", "Hadès, dieu des Enfers", "Ares, dieu de la guerre", "Annabeth, fille d'Athéna"],
  "Killers of the Flower Moon|50": ["Grâce au pétrole sous leurs terres", "Grâce à l'élevage de chevaux de course", "Grâce à une mine d'or de la réserve", "Grâce à de grandes exploitations de blé"],
  "Killers of the Flower Moon|100": ["William Hale, éleveur et notable du comté", "Ernest Burkhart, neveu de William Hale", "Tom White, enquêteur du Bureau fédéral", "Mollie Burkhart, épouse d'Ernest Burkhart"],
  "Le Meurtre de Roger Ackroyd (Hercule Poirot, #4)|100": ["Le docteur Sheppard, le narrateur", "Ralph Paton, le beau-fils d'Ackroyd", "Le major Blunt, grand chasseur", "Geoffrey Raymond, le secrétaire"],
  "L'Odyssée|100": ["Par le secret de leur lit nuptial", "Par la cicatrice sur sa jambe", "Par le son de sa voix familière", "Par sa force à bander son arc"],
  "Le Portrait de Dorian Gray|50": ["Que le portrait vieillisse à sa place", "Devenir l'homme le plus riche de Londres", "Retrouver l'innocence de son enfance", "Devenir un peintre célèbre comme Basil"],
  "Le Portrait de Dorian Gray|100": ["Il meurt vieilli, le portrait retrouve sa beauté", "Le portrait prend feu et Dorian en réchappe", "Il ne se passe rien, la toile reste intacte", "Le portrait disparaît et Dorian rajeunit encore"],
  "Le Trône de fer, Tome 1 : Le Trône de fer|50": ["Tyrion Lannister", "Jaime Lannister", "Varys, l'eunuque", "Petyr Baelish"],
  "Le Trône de fer, Tome 1 : Le Trône de fer|100": ["Trois dragons naissent du bûcher de Drogo", "Daenerys est couronnée reine de Westeros", "Ses œufs de dragon sont volés par un rival", "Daenerys est capturée par les Dothrakis"],
  "Red Rising (Red Rising Saga, #1)|50": ["Il infiltre l'Institut des Ors pour les détruire", "Il s'engage dans la flotte de la Société", "Il retourne dans les mines pour se cacher", "Il part vivre avec les Gris sur Luna"],
  "La femme de ménage|50": ["Sous les combles, dans une chambre verrouillée", "Dans la maison d'amis au fond du jardin", "Dans la chambre de la fille de la famille", "À l'hôtel du village, aux frais des Winchester"],
  "L'épreuve - tome 1 Le Labyrinthe|50": ["Dans un monte-charge, sans aucun souvenir", "En parachute, largué au-dessus des murs", "Par une porte du Labyrinthe, à l'aube", "À pied, après une longue traversée du désert"],

  // Lot 3
  "Les mains du miracle|100": ["La libération de détenus", "Une forte somme en or", "Un poste dans le gouvernement", "Un passeport pour la Suède"],
  "Dans son silence|50": ["Psychothérapeute", "Avocat pénaliste", "Médecin légiste", "Journaliste d'enquête"],
  "Dark Matter|50": ["Professeur de physique", "Médecin urgentiste", "Journaliste scientifique", "Policier de Chicago"],
  "Replay|50": ["Il revit sa vie à 18 ans, avec ses souvenirs", "Il meurt pour de bon et le roman s'arrête", "Il devient un fantôme qui hante sa famille", "Il se réveille dans un corps du futur"],
  "Inconnu à cette adresse|100": ["En écrivant des lettres qui alertent la censure", "En le dénonçant lui-même à la Gestapo", "En l'attaquant en justice après la guerre", "En faisant disparaître sa famille par des complices"],
  "Je suis une légende|100": ["Qu'il est le monstre de la nouvelle société", "Qu'il est immunisé et peut tous les sauver", "Que le virus a enfin disparu d'Amérique", "Que sa femme est encore en vie quelque part"],
  "Rhinocéros|100": ["De résister seul, sans jamais capituler", "De suivre les autres dans leur métamorphose", "De s'enfuir de la ville en voiture", "De se transformer pour rejoindre Daisy"],
  "Un sac de billes|50": ["Pour les mettre à l'abri des rafles", "Pour leur offrir des vacances au soleil", "Pour qu'ils travaillent dans une ferme", "Pour qu'ils poursuivent leurs études"],
  "L'Enfant de Noé|50": ["Le père Pons, un prêtre", "Un instituteur du village", "Un fermier des environs", "Un rabbin de Bruxelles"],
  "La Défense Lincoln|50": ["De la banquette arrière de sa Lincoln", "D'un grand bureau en centre-ville", "De son appartement de Los Angeles", "D'un café en face du palais de justice"],
  "Lettre d'une inconnue|100": ["Qu'une femme l'a aimé en secret toute sa vie", "Qu'il a un frère dont il ignorait tout", "Qu'on l'accuse d'un crime qu'il n'a pas commis", "Qu'un ami lui a légué toute sa fortune"],
  "Les Misérables|50": ["Il ajoute les chandeliers à l'argenterie volée", "Il le dénonce aux gendarmes de la ville", "Il l'embauche comme jardinier au presbytère", "Il l'aide à s'évader du bagne de Toulon"],
  "Les Pilliers De La Terre|50": ["La cathédrale de Kingsbridge", "Le château fort de Shiring", "Un grand pont sur la Tamise", "Une forteresse royale à Londres"],
  "Les Rois maudits|50": ["Jacques de Molay, sur son bûcher", "Le pape Clément V, sur son lit de mort", "Enguerrand de Marigny, avant sa pendaison", "Isabelle d'Angleterre, depuis sa prison"],
  "La pierre et le sabre (Musashi, #1)|50": ["Miyamoto Musashi", "Sasaki Kojirō", "Matahachi Hon'iden", "Takuan Sōhō"],
  "The Unhoneymooners (Unhoneymooners, #1)|50": ["Tous les invités tombent malades sauf eux deux", "Ils ont gagné un voyage lors d'un concours", "Les mariés leur offrent le voyage en remerciement", "Leur ami commun a annulé et leur a cédé les billets"],
  "The Unhoneymooners (Unhoneymooners, #1)|100": ["Ils se mettent en couple pour de bon", "Ils se séparent à jamais", "Ils déménagent chacun de leur côté", "Ils restent seulement de bons amis"],
  "The Spanish Love Deception (Love Deception, #1)|50": ["Aaron, un collègue qu'elle supporte mal", "Son ex-petit ami de longue date", "Son voisin de palier, très serviable", "Un ami d'enfance revenu d'Espagne"],
  "Normal People|50": ["La mère de Connell fait le ménage chez elle", "Ils sont cousins éloignés par leurs mères", "Ils sont voisins depuis leur plus jeune âge", "Ils travaillent ensemble dans un café"],
  "Last Samurai Standing 1|50": ["Des samouraïs se battent à mort sur le Tokaido", "Un tournoi à mort dans une arène de Kyoto", "Une chasse à l'homme à travers tout Kyoto", "Une course de chevaux à travers le Japon"],
  "A comme aujourd'hui|50": ["A change de corps chaque matin", "A voyage dans le temps à chaque réveil", "A rêve d'un autre monde chaque nuit", "A perd la mémoire à chaque réveil"],
  "Le mage du Kremlin|50": ["Un conseiller du pouvoir russe", "Un général de l'armée russe", "Un ambassadeur de Russie à Paris", "Un journaliste d'opposition"],
  "Le pouvoir du moment présent|100": ["Dans le moment présent", "Dans l'avenir que l'on prépare", "Dans le passé que l'on revisite", "Dans les souvenirs d'enfance"],
  "La Splendeur et l'Infamie|100": ["Churchill à Londres pendant le Blitz", "La libération de Paris en 1944", "Le débarquement en Normandie, en 1944", "La bataille de Stalingrad, en 1942"],
};

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

module.exports = function balance(BOOKS) {
  const missing = new Set(Object.keys(OVERRIDES));
  for (const b of BOOKS) {
    const titles = Array.isArray(b) ? b[0] : b.titles;
    const qs = Array.isArray(b) ? b[1] : b.q;
    for (let i = qs.length - 1; i >= 0; i--) {
      const q = qs[i];
      const k = `${titles[0]}|${q[0]}`;
      if (k in OVERRIDES) {
        missing.delete(k);
        if (OVERRIDES[k] === null) { qs.splice(i, 1); continue; }
        q[2] = [...OVERRIDES[k]];
        q[3] = 0;
      }
      // Mélange déterministe, la bonne réponse suit son option
      const right = q[2][q[3]];
      const rand = rng(hash(q[1] + "#" + q[2].join("|")));
      rand(); rand(); rand();
      const opts = [...q[2]];
      for (let j = opts.length - 1; j > 0; j--) {
        const r = Math.floor(rand() * (j + 1));
        [opts[j], opts[r]] = [opts[r], opts[j]];
      }
      q[2] = opts;
      q[3] = opts.indexOf(right);
    }
  }
  // (les overrides des autres lots ne sont pas dans ce lot : normal)
};
