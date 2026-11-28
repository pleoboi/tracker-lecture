---
description: Met à jour les quiz de lecture (questions des livres ajoutés depuis la dernière fois)
---

Mets à jour les questions du quiz de lecture de Swena.

1. Lance `node scripts/quiz-missing.js` pour lister les livres sans question (en cours d'abord).
2. Pour chaque livre, cherche sur le web avec titre + auteur (+ ISBN si besoin). N'écris des questions que pour les livres que tu connais avec certitude : jamais d'invention. Les autres, signale-les à la fin.
3. Rédige 4 questions par livre (paliers 50 % et 100 %, deux questions chacun si possible) avec une explication, dans un nouveau lot `scripts/quiz-seed-N.js`. Modèle : `scripts/quiz-seed-5.js`.
   - Bonne réponse en premier dans la liste (le mélange est fait par `scripts/quiz-overrides.js`).
   - Les choix ont une longueur équivalente : la bonne réponse n'est jamais plus longue ni plus détaillée que les autres.
   - Pas de spoiler de fin de livre dans les questions du palier 50 %.
4. Lance le script pour générer `supabase-quiz-seed-N.sql` et `src/data/quiz/N.json`, puis pousse en base par upsert REST avec la clé de `.env.local`, comme pour les lots 1 à 5. Si l'écriture est refusée, donne le SQL à l'utilisateur pour qu'il le passe lui-même.
5. Relance `node scripts/quiz-missing.js` pour vérifier, puis résume en français : livres couverts, livres laissés de côté et pourquoi.

Ne déploie rien : les questions sont en base, pas besoin de commit sauf demande.
