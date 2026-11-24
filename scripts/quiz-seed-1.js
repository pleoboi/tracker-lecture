// Génère supabase-quiz-seed-1.sql : questions de lecture (4 paliers par livre).
// node scripts/quiz-seed-1.js
const fs = require("fs");
const key = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// Chaque question : [palier, question, options, index de la bonne réponse (0-3), explication]
const BOOKS = [
  {
    titles: ["La Ferme des animaux", "Animal Farm"],
    q: [
      [25, "Quel animal inspire la révolte en racontant son rêve à tous les autres, avant de mourir ?", ["Napoléon", "Old Major, le vieux sanglier", "Boule de Neige", "Malabar"], 1,
        "Old Major, le vieux sanglier respecté de la ferme, décrit un monde sans hommes où les animaux vivraient libres. Sa mort quelques jours plus tard déclenche la rébellion contre M. Jones."],
      [50, "Comment Napoléon se débarrasse-t-il de son rival Boule de Neige ?", ["Il le dénonce à Jones", "Il le fait chasser par les chiens qu'il avait élevés en secret", "Il le bat lors d'un vote", "Il l'envoie vendre du blé"], 1,
        "Napoléon a pris les chiots à leur naissance pour les éduquer lui-même. Devenus des molosses, ils chassent Boule de Neige : c'est le début de la dictature des cochons."],
      [75, "Que devient Malabar, le cheval, quand il s'effondre d'épuisement ?", ["Il prend sa retraite dans un pré", "Il est vendu à l'équarrisseur", "Il est soigné à l'hôpital des hommes", "Il devient le chef de la ferme"], 1,
        "Malabar est vendu pour de l'argent alors que les cochons promettaient une retraite aux animaux âgés. Squealer prétend ensuite qu'il est mort à l'hôpital : le mensonge devient un outil de pouvoir."],
      [100, "Que voient les animaux par la fenêtre à la toute dernière scène ?", ["Les cochons se disputer entre eux", "Jones revenir à la ferme", "Les cochons et les hommes jouer aux cartes, impossibles à distinguer", "La ferme brûler"], 2,
        "Les cochons trinquent avec les fermiers voisins : ils sont devenus semblables aux hommes qu'ils avaient chassés. C'est la chute du livre : le pouvoir a corrompu la révolution."],
    ],
  },
  {
    titles: ["The Little Prince", "Le Petit Prince"],
    q: [
      [25, "Quelle est la toute première demande que le petit prince adresse au narrateur dans le désert ?", ["Dessine-moi un mouton", "Ramène-moi chez moi", "Donne-moi à boire", "Répare ton avion"], 0,
        "Le narrateur, pilote en panne dans le Sahara, est réveillé à l'aube par cette demande surprenante. Ses dessins d'adulte ne conviennent pas : seule la caisse avec un mouton « dedans » plaît au petit prince."],
      [50, "Pourquoi le buveur, sur sa planète, continue-t-il de boire ?", ["Par ennui", "Pour oublier qu'il a honte de boire", "Pour fêter quelque chose", "Parce qu'on le lui ordonne"], 1,
        "Le buveur est enfermé dans un cercle absurde : il boit pour oublier la honte… de boire. Le petit prince repart perplexe, comme à chaque rencontre d'adulte."],
      [75, "Selon le renard, que signifie « apprivoiser » ?", ["Dresser quelqu'un", "Créer des liens", "Posséder", "Protéger de la peur"], 1,
        "Le renard explique que, apprivoisés, le petit prince et lui deviendront uniques l'un pour l'autre. C'est là que le petit prince comprend pourquoi sa rose compte tant pour lui."],
      [100, "Comment le petit prince retourne-t-il sur sa planète ?", ["Avec l'avion réparé", "En se laissant mordre par le serpent jaune", "Grâce à une migration d'oiseaux", "En traversant le désert à pied"], 1,
        "Le serpent promet de le renvoyer d'où il vient : son corps reste, mais il retrouve sa planète et sa rose. Le narrateur, lui, répare son moteur et garde les étoiles qui rient."],
    ],
  },
  {
    titles: ["L'étranger", "L'Étranger"],
    q: [
      [25, "Que fait Meursault pendant la veillée funèbre de sa mère ?", ["Il prie toute la nuit", "Il boit du café au lait et fume", "Il pleure longuement", "Il refuse de voir le corps et part"], 1,
        "Meursault accepte du café au lait et fume près du cercueil : ce calme est le premier signe de son détachement, que la société lui reprochera plus tard."],
      [50, "Quelle raison Meursault donne-t-il pour avoir tiré sur l'Arabe ?", ["Une vengeance personnelle", "Il a eu peur d'un complot", "À cause du soleil", "Un ordre de Raymond"], 2,
        "Aveuglé par la lumière et la chaleur sur la plage, il tire. Le « c'était à cause du soleil » est l'une des répliques les plus célèbres du roman."],
      [75, "Qu'est-ce qui pèse le plus lourd contre Meursault lors de son procès ?", ["Ses anciennes condamnations", "Son manque d'émotion à l'enterrement de sa mère", "Le témoignage de Marie", "Ses mensonges à la police"], 1,
        "L'accusation s'appuie moins sur le meurtre que sur le caractère de Meursault : il n'a pas pleuré à l'enterrement. La société le condamne pour ne pas jouer le jeu des émotions attendues."],
      [100, "Que souhaite Meursault à la dernière phrase, avant son exécution ?", ["Être gracié", "Une foule de spectateurs qui l'accueille avec des cris de haine", "Revoir Marie", "Une dernière cigarette"], 1,
        "Réconcilié avec sa condition après sa colère contre l'aumônier, il souhaite être haï pour se sentir moins seul. Il accepte ainsi l'indifférence « tendre » du monde."],
    ],
  },
  {
    titles: ["Fahrenheit 451"],
    q: [
      [25, "Quelle question de Clarisse bouleverse Montag lors de leur première rencontre ?", ["« Pourquoi brûles-tu ? »", "« Es-tu heureux ? »", "« As-tu déjà lu un livre ? »", "« As-tu peur de moi ? »"], 1,
        "Clarisse, jeune voisine curieuse du monde, demande simplement à Montag s'il est heureux. Cette question lui fait réaliser que sa vie de pompier, qui brûle les livres, est vide."],
      [50, "Selon le capitaine Beatty, pourquoi a-t-on fini par brûler les livres ?", ["Une loi du gouvernement", "Pour ne froisser personne : chacun trouvait les livres offensants", "Pour faire disparaître la guerre", "Parce que les gens ne savaient plus lire"], 1,
        "Beatty raconte que les minorités et les groupes se sentaient visés ; on a peu à peu tout aplani, jusqu'à rendre les livres inutiles. Les citoyens ont, selon lui, choisi eux-mêmes le divertissement facile."],
      [75, "Qui Montag va-t-il voir pour apprendre à comprendre les livres ?", ["Faber, ancien professeur d'anglais", "Clarisse", "Granger, chef des exilés", "Le capitaine Beatty"], 0,
        "Faber, ex-professeur, lui explique que les livres valent par leur détail, leur loisir de réfléchir et le droit d'agir d'après ce qu'on a lu. Il lui prête une oreillette pour le guider."],
      [100, "Comment les exilés que Montag rencontre à la fin conservent-ils les livres ?", ["En les cachant dans des grottes", "En les apprenant par cœur", "En les imprimant en secret", "En les enterrant"], 1,
        "Chacun mémorise un livre : ce sont des « hommes-livres ». Ils sauront reconstruire la culture après la guerre qui détruit la ville."],
    ],
  },
  {
    titles: ["Harry Potter and the Sorcerer's Stone (Harry Potter, #1)", "Harry Potter and the Philosopher's Stone", "Harry Potter à l'école des sorciers"],
    q: [
      [25, "De quoi est faite la baguette que choisit Harry chez Ollivander ?", ["Une plume de phénix, du houx", "Un crin de licorne, du saule", "Un nerf de dragon, du chêne", "Un cheveu de vélane, de l'if"], 0,
        "La plume vient du même phénix que celle de la baguette de Voldemort : c'est elle qui lui a laissé sa cicatrice. Ollivander en conclut que Harry est promis à de grandes choses."],
      [50, "Qui Harry et Ron sauvent-ils du troll, à Halloween ?", ["Neville", "Hermione", "Dean", "Ginny"], 1,
        "Hermione se cache pleurant dans les toilettes quand le troll arrive. Cette aventure commune scelle l'amitié du trio."],
      [75, "Comment endormir Touffu, le chien à trois têtes qui garde la trappe ?", ["Avec de la musique", "Avec un sortilège de Hagrid", "Avec de la viande", "En lui lançant un os"], 0,
        "Touffu s'endort au son d'une harpe ou d'une flûte. Hagrid l'a révélé sans le vouloir, ce qui permet à Harry de passer."],
      [100, "Qui voulait voler la pierre philosophale, et à qui obéissait-il ?", ["Rogue, pour Dumbledore", "Quirrell, pour Voldemort qu'il porte sous son turban", "Malefoy, pour son père", "Hagrid, pour Norbert"], 1,
        "Le timide professeur Quirrell est possédé par Voldemort : son visage apparaît à l'arrière de sa tête. Rogue, soupçonné, protégeait en fait Harry."],
    ],
  },
  {
    titles: ["1984", "Nineteen Eighty-Four"],
    q: [
      [25, "Dans quel ministère travaille Winston Smith ?", ["Le ministère de l'Amour", "Le ministère de la Paix", "Le ministère de la Vérité", "Le ministère de l'Abondance"], 2,
        "Au ministère de la Vérité, Winston réécrit les articles du passé pour qu'ils collent à la version actuelle du Parti. C'est ce travail qui fait naître ses doutes."],
      [50, "Où Winston et Julia se retrouvent-ils en secret ?", ["Dans les caves du ministère", "Dans une chambre louée au-dessus de la boutique de M. Charrington", "Dans la campagne seulement", "Chez O'Brien"], 1,
        "La chambre au-dessus de la boutique d'antiquités leur donne l'illusion d'un coin à l'abri des télécrans. C'est un piège : Charrington appartient à la Police de la Pensée."],
      [75, "Que révèle-t-on de M. Charrington lorsque Winston et Julia sont arrêtés ?", ["Qu'il est le chef de la Fraternité", "Qu'il est agent de la Police de la Pensée", "Qu'il est un ami d'enfance de Winston", "Qu'il est un prisonnier lui aussi"], 1,
        "Un télécran est caché derrière le tableau de la chambre : ils étaient surveillés depuis le début. Charrington, d'apparence si aimable, était un policier déguisé."],
      [100, "Qu'est-ce qui brise Winston dans la salle 101 ?", ["La torture électrique", "La peur des rats", "La faim", "Le manque de sommeil"], 1,
        "La salle 101 contient « la pire chose au monde », propre à chacun. Pour Winston ce sont les rats : il finit par supplier qu'on les fasse subir à Julia, et trahit ainsi son dernier attachement."],
    ],
  },
];

require("./quiz-overrides.js")(BOOKS);
const esc = (s) => s.replace(/'/g, "''");
let out = "-- Questions de lecture, lot 1 (généré par scripts/quiz-seed-1.js)\n";
out += "insert into public.book_quiz (book_key, book_title, tier, question, options, answer, explanation) values\n";
const rows = [];
const seen = new Set();
for (const b of BOOKS) {
  for (const t of b.titles) {
    for (const [tier, q, opts, ans, expl] of b.q) {
      if (tier !== 50 && tier !== 100) continue;
      if (seen.has(key(t) + tier)) continue;
      seen.add(key(t) + tier);
      rows.push(`('${esc(key(t))}', '${esc(t)}', ${tier}, '${esc(q)}', '${esc(JSON.stringify(opts))}'::jsonb, ${ans}, '${esc(expl)}')`);
    }
  }
}
out += rows.join(",\n") + "\non conflict (book_key, tier) do update set book_title = excluded.book_title, question = excluded.question, options = excluded.options, answer = excluded.answer, explanation = excluded.explanation;\n";
fs.writeFileSync("supabase-quiz-seed-1.sql", out);
console.log(rows.length + " questions");

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
fs.writeFileSync("src/data/quiz/1.json", JSON.stringify(entries, null, 1));
